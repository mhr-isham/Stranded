"""SCI-10: native date controls, optional real-log comparisons and school return.
Uses the existing school-generated moon/planet logs. Explicit synthetic data
fixtures additionally exercise aliases, missing phase and manual-fit guards.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-moon');out.mkdir(exist_ok=True)
def guide(page): return page.get_by_role('dialog',name='Flight School',exact=True)
def expand(page):
    page.wait_for_timeout(180)
    b=guide(page).get_by_role('button',name='Expand',exact=True)
    if b.count(): b.click()
def mini(page):
    b=guide(page).get_by_role('button',name='Minimise',exact=True)
    if b.count(): b.click()
def panel(page): return page.locator('[aria-label="Moon orbit analysis"]')
def details(page,name): return panel(page).locator('details').filter(has=page.locator('summary').filter(has_text=re.compile('^'+re.escape(name)+'$'))).first

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        page.evaluate("__game.getState().newGame(91,{difficulty:'navigator',sound:false,survival:false,formulas:true});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}},training:{},schoolRewards:{patches:{},cards:{},milestones:{}}})")
        page.get_by_role('button',name='Flight School',exact=False).click()
        library=page.get_by_role('region',name='Flight School library',exact=True)
        library.locator('[data-training="exercise:moon"]').get_by_role('button',name=re.compile('^Open')).click()
        page.wait_for_function('__game.getState().schoolSession?.id==="moon"',timeout=60000)
        expect(page.locator('.lesson-modal')).to_be_visible()
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        expand(page);guide(page).get_by_role('button',name='Next',exact=True).click()
        page.wait_for_function('async()=>__game.getState().tutorial.step===(await __tut.steps()).STEPS.findIndex(s=>s.id==="moon-fit")')
        expand(page)
        if page.evaluate('__game.getState().screen')!='observatory':guide(page).get_by_role('button',name='Take me there',exact=True).click()
        page.get_by_role('button',name='Moon',exact=True).click();mini(page)
        moon=panel(page);expect(moon).to_be_visible()
        assert moon.locator('details[open]').count()==0
        assert page.locator('.moon-analysis-focus').count()==1
        moon.get_by_role('button',name='Last 20 days',exact=True).scroll_into_view_if_needed()
        page.get_by_role('button',name='Show sky beside the chart',exact=True).click()
        assert page.locator('.moon-analysis-focus').count()==0
        page.get_by_role('button',name='Focus on the moon chart',exact=True).click()
        assert page.locator('.moon-analysis-focus').count()==1
        before=page.evaluate('({t:__clock.t,n:__game.getState().moonTrack.length,p:__game.getState().penaltyDv,c:__game.getState().checksUsed})')
        moon.get_by_role('button',name='Last 20 days',exact=True).click()
        expect(moon.locator('[aria-label="Selected moon fit"]')).to_be_visible()
        assert moon.locator('details[open]').count()==0
        start=float(moon.get_by_label('Moon start day',exact=True).input_value());end=float(moon.get_by_label('Moon end day',exact=True).input_value())
        assert abs(end-start-20)<1e-6
        moon.get_by_label('Moon start day',exact=True).fill(str(end+1));moon.get_by_role('button',name='Apply dates',exact=True).click()
        expect(moon.get_by_role('alert')).to_contain_text('start no later than end')
        moon.get_by_label('Moon start day',exact=True).fill(str(end-15));moon.get_by_role('button',name='Apply dates',exact=True).click()
        expect(moon.locator('[aria-label="Selected moon fit"]')).to_be_visible()
        # Opening optional investigation is an explicit player choice.
        lab=moon.locator('[aria-label="Flight School moon investigation"]');lab.locator('summary').click()
        lab.get_by_role('button',name='Keep this fit for comparison',exact=True).click()
        expect(lab).to_contain_text('2. Try different dates')
        lab.get_by_role('button',name='Keep this fit for comparison',exact=True).click()
        expect(lab.get_by_role('status')).to_contain_text('already kept')
        moon.get_by_role('button',name='Last 10 days',exact=True).click()
        lab.get_by_role('button',name='Keep this fit for comparison',exact=True).click()
        expect(lab).to_contain_text('3. Compare your saved fits')
        saved=page.evaluate('__game.getState().moonStudies');assert len(saved)==2 and saved[0]['signature']!=saved[1]['signature']
        assert all(pt['x']>=saved[1]['from'] and pt['x']<=saved[1]['to'] for pt in saved[1]['plot'])
        assert before==page.evaluate('({t:__clock.t,n:__game.getState().moonTrack.length,p:__game.getState().penaltyDv,c:__game.getState().checksUsed})')
        # All date fields and actions fit the viewport, including short landscape.
        for locator in [moon.get_by_label('Moon start day',exact=True),moon.get_by_label('Moon end day',exact=True),moon.get_by_role('button',name='Apply dates',exact=True)]:
            box=locator.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1
        page.wait_for_timeout(2500)
        close=details(page,'Enlarge the selected interval');close.locator('summary').click()
        expect(close.locator('[aria-label="Close view of selected moon sightings"]')).to_be_visible()
        close.locator('summary').scroll_into_view_if_needed();page.screenshot(path=str(out/f'moon-{width}.png'))
        # Native sheet submission; no optional comparison is required for completion.
        use=details(page,'Use this fit');use.locator('summary').click()
        inputs=use.locator('input');assert inputs.count()==2
        inputs.nth(0).fill('.5');inputs.nth(1).fill('.1')
        use.get_by_role('button',name='Send to progress sheet',exact=True).first.click()
        use.get_by_role('button',name='Send to progress sheet',exact=True).click()
        expand(page);guide(page).get_by_role('button',name='Finish exercise',exact=True).click();library.wait_for()
        assert page.evaluate('__clock.t')==123 and page.evaluate('__game.getState().sheet.g.value')==9.81
        assert page.evaluate('__game.getState().moonStudies.length')==0
        card=page.evaluate('__game.getState().schoolRewards.cards["exercise:moon"].latest')
        assert len(card['plot'])==len(saved[-1]['plot']) and len([s for s in card['summary'] if s['label'].startswith('Kept candidate')])==2
        assert not card['assisted']
        page.reload(wait_until='networkidle');assert page.evaluate('__game.getState().schoolRewards.cards["exercise:moon"].latest.plot')==card['plot']
        # Synthetic alias fixture, ordinary play: details closed and optional teaching absent.
        page.evaluate('''()=>{__game.getState().newGame(316,{difficulty:'legend',sound:false,survival:false,formulas:false,freeRoam:true});__clock.paused=true;__game.setState({phase:'play',screen:'observatory',identified:true,storyQueue:[],echo:[],moonTrack:Array.from({length:20},(_,i)=>({at:i*86400,v:30*Math.sin(2*Math.PI*i/.8+.4)*Math.PI/648000})),track:Array.from({length:21},(_,i)=>({at:i*86400,v:0}))});}''')
        page.get_by_role('button',name='Moon',exact=True).click();moon=panel(page)
        assert moon.locator('details[open]').count()==0 and moon.locator('[aria-label="Flight School moon investigation"]').count()==0
        assert page.locator('.katex').count()==0
        diagnostics=details(page,'Analysis details and other candidates');diagnostics.locator('summary').first.click()
        expect(diagnostics).to_contain_text('Model B:')
        diagnostics.get_by_role('button',name='Use model B',exact=True).click()
        expect(moon.locator('[aria-label="Selected moon fit"]')).to_contain_text('(B)')
        diagnostics.get_by_text('Compare five-day model forecasts',exact=True).click()
        expect(diagnostics.locator('[aria-label="Uncertain moon model forecasts, no observed samples"]')).to_be_visible()
        page.evaluate('__game.setState({track:[]})')
        expect(moon.locator('[aria-label="Moon fit status"]')).to_contain_text('does not support')
        assert moon.locator('[aria-label="Selected moon fit"]').count()==0
        page.evaluate("__game.setState({settings:{...__game.getState().settings,challenges:['handFit']}})")
        expect(moon.locator('[aria-label="Moon fit status"]')).to_contain_text('Manual-fit challenge')
        assert moon.locator('[aria-label="Selected moon fit"]').count()==0
        assert not errors,errors
        page.close()
    browser.close()
print('PASS moon date fields/presets/validation, native real-log fits, optional comparisons/duplicates, selected sample archives, native send/finish, expedition and clock restoration, reload, aliases/B choice/model-only forecasts, missing-phase/manual guards, uncluttered defaults and three viewports')
