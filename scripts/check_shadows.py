"""SCI-11: native survey, paired shadow marking, inference and school return.
Pixel targeting uses deterministic physical fixtures, not an automated player
accuracy assessment. Native capture/mark/log/send controls do the actual work.
"""
from pathlib import Path
import math
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-shadows');out.mkdir(exist_ok=True)
def expedition(page): return page.get_by_role('main',name='Two-site shadow expedition',exact=True)
def guide(page): return page.get_by_role('dialog',name='Flight School',exact=True)
def expand(page):
    page.wait_for_timeout(150)
    b=guide(page).get_by_role('button',name='Expand',exact=True)
    if b.count(): b.click()
def mini(page):
    b=guide(page).get_by_role('button',name='Minimise',exact=True)
    if b.count(): b.click()
def fixture(page):
    return page.evaluate('''async()=>{const {currentWorld}=await import('/src/game/sim.ts');const {shadowView,northSite}=await import('/src/game/shadowObservation.ts');const s=__game.getState(),sys=currentWorld().system;return {camp:shadowView(sys,__clock.t,sys.site),rover:shadowView(sys,__clock.t,northSite(sys.site,s.northTrip.dist,sys.home.radius)),at:__clock.t}}''')
def dismiss(page):
    page.evaluate('async()=>{const {ECHO}=await import("/src/game/echo.ts");__game.setState({echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5,6]})}')
def place(page,length):
    svg=expedition(page).get_by_role('group',name=re.compile('^Shadow measuring instrument;'))
    span=min(12,max(3,length*1.35));scale=min(460/span,90)
    svg.scroll_into_view_if_needed();box=svg.bounding_box()
    svg.click(position={'x':(70+length*scale)/600*box['width'],'y':228/320*box['height']})
    expect(expedition(page).get_by_label('Shadow marker position in metres',exact=True)).not_to_have_value('')
    result=float(expedition(page).get_by_label('Shadow marker position in metres',exact=True).input_value())
    assert abs(result-length)<.015,(result,length)
    svg.focus();page.keyboard.press('Shift+ArrowRight');page.keyboard.press('Shift+ArrowLeft')
    assert abs(float(expedition(page).get_by_label('Shadow marker position in metres',exact=True).input_value())-result)<1e-9
    return result

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,1000),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        page.evaluate("__game.getState().newGame(91,{difficulty:'navigator',sound:false,survival:false,formulas:false});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}},training:{},schoolRewards:{patches:{},cards:{},milestones:{}}})")
        page.get_by_role('button',name='Flight School',exact=False).click()
        library=page.get_by_role('region',name='Flight School library',exact=True)
        assert library.locator('[data-training]').count()==49
        library.locator('[data-training="exercise:shadows"]').get_by_role('button',name=re.compile('^Open')).click()
        page.wait_for_function('__game.getState().schoolSession?.id==="shadows"')
        expect(page.locator('.lesson-modal')).to_be_visible()
        assert page.locator('.lesson-modal .katex-error').count()==0
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        expand(page);guide(page).get_by_role('button',name='Next',exact=True).click()
        mini(page);dismiss(page)
        lab=expedition(page);expect(lab).to_be_visible()
        assert page.locator('.lesson-modal').count()==0
        assert lab.locator('details[open]').count()==0
        expect(lab.get_by_role('button',name='Capture both shadow views',exact=True)).to_be_disabled()
        # Shared rover and route guards.
        page.evaluate('__game.setState({rover:{dist:100000,target:100000,departAt:0,arriveAt:0}})')
        lab.get_by_role('button',name='Drive north',exact=True).click()
        assert page.evaluate('__game.getState().northTrip.dist')==0
        page.evaluate('__game.setState({rover:{dist:0,target:0,departAt:0,arriveAt:0}})')
        lab.get_by_role('button',name='Drive north',exact=True).click()
        assert page.evaluate('__game.getState().northTrip.dist')==800000
        expect(lab.get_by_role('button',name='Capture both shadow views',exact=True)).to_be_disabled()
        lab.get_by_role('button',name='Wait for rover',exact=True).click()
        page.wait_for_function('__clock.paused&&__clock.t>=__game.getState().northTrip.arriveAt',timeout=45000)
        lab.get_by_role('button',name='Wait to next local noon',exact=True).click()
        page.wait_for_function('__clock.paused&&__clock.stopAt===Infinity',timeout=45000)
        page.wait_for_timeout(200);observed=fixture(page)
        lab.get_by_role('button',name='Capture both shadow views',exact=True).click()
        assert lab.locator('details[open]').count()==0
        place(page,observed['camp']['length'])
        lab.get_by_role('button',name='Keep camp mark',exact=True).click()
        expect(lab.get_by_role('button',name='Keep camp mark',exact=True)).to_be_enabled()
        lab.get_by_role('button',name='Keep camp mark',exact=True).click()
        assert page.evaluate('__game.getState().shadows.length')==1
        first=page.evaluate('__game.getState().shadows[0]');assert first['at']==observed['at'] and 'position' in first and 'solarDay' in first
        # Frozen views keep their acquisition date while the live clock changes.
        page.evaluate('__clock.t+=600;__clock.emit()')
        lab.get_by_role('button',name='Rover view',exact=True).click()
        expect(lab.get_by_label('Shadow marker position in metres',exact=True)).to_have_value('')
        place(page,observed['rover']['length']);lab.get_by_role('button',name='Keep rover mark',exact=True).click()
        page.wait_for_function('__game.getState().shadows.length===2')
        records=page.evaluate('__game.getState().shadows');assert records[0]['capture']==records[1]['capture'] and records[0]['at']==records[1]['at']
        expect(lab.get_by_role('region',name='Shadow radius comparison',exact=True)).to_contain_text('A radius estimate is available')
        assert lab.locator('details[open]').count()==0
        if width==844:
            page.locator('[data-tut="shadow-stage"]').scroll_into_view_if_needed()
        else:
            lab.get_by_role('region',name='Shadow radius comparison',exact=True).scroll_into_view_if_needed()
        page.wait_for_timeout(2200);page.screenshot(path=str(out/f'shadows-{width}.png'))
        review=lab.locator('details').filter(has=page.locator('summary').filter(has_text='Review dates, angles and uncertainty')).first
        review.locator('summary').click()
        assert review.locator('.katex').count()>0 and review.locator('.katex-error').count()==0
        use=lab.locator('details').filter(has=page.locator('summary').filter(has_text='Use this radius')).first
        use.locator('summary').click();use.locator('input').fill('150')
        use.get_by_role('button',name='Send to progress sheet',exact=True).click()
        expand(page);guide(page).get_by_role('button',name='Finish exercise',exact=True).click();library.wait_for()
        assert page.evaluate('__clock.t')==123 and page.evaluate('__game.getState().sheet.g.value')==9.81
        assert page.evaluate('__game.getState().shadows.length')==0
        card=page.evaluate('__game.getState().schoolRewards.cards["exercise:shadows"].latest')
        assert len(card['plot'])==2 and not card['assisted']
        assert card['plot'][0]['y']==records[0]['length']
        assert card['plot'][1]['y']==records[1]['length']
        page.reload(wait_until='networkidle')
        assert page.evaluate('__game.getState().schoolRewards.cards["exercise:shadows"].latest.plot')==card['plot']
        # Main-game access without a chapter unlock; optional teaching stays closed.
        page.evaluate("__game.getState().newGame(316,{difficulty:'legend',sound:false,survival:false,formulas:false});__clock.paused=true;__game.setState({phase:'play',screen:'hill',storyQueue:[],echo:[]})")
        dismiss(page);page.get_by_role('button',name='Alternative: two-site noon shadows',exact=True).click()
        lab=expedition(page);expect(lab).to_be_visible()
        assert page.locator('.lesson-modal').count()==0 and lab.locator('details[open]').count()==0 and lab.locator('.katex').count()==0
        # A daylight/noon fixture makes weather/capture and reload guards deterministic.
        page.evaluate('''async()=>{const {currentWorld}=await import('/src/game/sim.ts');const {nextShadowNoon}=await import('/src/game/shadowObservation.ts');__clock.t=nextShadowNoon(currentWorld().system,0);__clock.emit();__game.setState({northTrip:{dist:800000,arriveAt:0}})}''')
        lab.get_by_label('Baseline uncertainty in kilometres',exact=True).fill('0')
        expect(lab.get_by_role('button',name='Capture both shadow views',exact=True)).to_be_disabled()
        lab.get_by_label('Baseline uncertainty in kilometres',exact=True).fill('1')
        lab.get_by_role('button',name='Capture both shadow views',exact=True).click();sample=fixture(page)
        lab.get_by_label('Shadow marker position in metres',exact=True).fill(str(sample['camp']['length']))
        lab.get_by_role('button',name='Keep camp mark',exact=True).click()
        page.reload(wait_until='networkidle');assert page.evaluate('__game.getState().shadows[0].solarDay') is not None
        # The live image and acquisition gate agree when clouds cover the site.
        page.evaluate('''async()=>{const {currentWorld}=await import('/src/game/sim.ts');const {nextShadowNoon}=await import('/src/game/shadowObservation.ts');const {isCloudy}=await import('/src/game/survival.ts');const sys=currentWorld().system;let t=0;for(let i=0;i<90;i++){t=nextShadowNoon(sys,t+1);if(isCloudy(__game.getState().seed,t)){__clock.t=t;break;}}__clock.paused=true;__clock.emit();__game.setState({settings:{...__game.getState().settings,survival:true}})}''')
        expect(expedition(page).get_by_role('button',name='Capture both shadow views',exact=True)).to_be_disabled()
        expect(expedition(page)).to_contain_text('Live view obscured')
        # Tidally locked site offers an explanation, not an endless noon wait.
        page.evaluate("__game.getState().newGame(316,{difficulty:'navigator',sound:false,survival:false},6);__game.setState({phase:'play',screen:'gnomon',storyQueue:[],echo:[]})")
        dismiss(page);expect(expedition(page)).to_contain_text('No usable noon cycle')
        assert expedition(page).get_by_role('button',name='Wait to next local noon',exact=True).count()==0
        assert not errors,errors
        page.close()
    browser.close()
print('PASS shadows native rover dispatch/travel/noon waits, paired capture, retina pointer and fine keyboard marks, revisions, frozen epochs, signed inference, formulas, native send/finish and archived work, expedition restoration, reload, alternate access and locked-site guards at phone/desktop/landscape')
