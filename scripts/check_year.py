"""SCI-05 fitting, interactive lessons and an actual Flight School investigation.
Fixtures bypass story for numerical edge cases. The school case logs through
ordinary scope/time controls and restores the original expedition afterward.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-year')
out.mkdir(exist_ok=True)

def setup(page,mode='cadet',chapter=1,manual=False):
    page.evaluate('''async({mode,chapter,manual})=>{
      const {ECHO}=await import('/src/game/echo.ts');
      __game.getState().newGame(316,{difficulty:mode,sound:false,survival:false,formulas:mode!=='legend',freeRoam:true,challenges:manual?['handFit']:[]},chapter);
      __clock.t=500;__clock.paused=true;__clock.emit();
      __game.setState({phase:'play',screen:'observatory',savedT:500,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5],starObs:[],sheet:{}});
    }''',{'mode':mode,'chapter':chapter,'manual':manual})
    page.get_by_role('button',name='Year',exact=True).click()

def records(page,pairs):
    page.evaluate('(pairs)=>__game.setState({starObs:pairs.map(([d,y])=>({at:d*86400,v:y*Math.PI/180}))})',pairs)

def guide(page):
    return page.get_by_role('dialog',name='Flight School',exact=True)

def expand(page):
    button=guide(page).get_by_role('button',name='Expand',exact=True)
    if button.count(): button.click()

def minimise(page):
    button=guide(page).get_by_role('button',name='Minimise',exact=True)
    if button.count(): button.click()

def step(page,id):
    page.wait_for_function('async(id)=>{const {STEPS}=await __tut.steps();return STEPS[__game.getState().tutorial.step].id===id}',arg=id,timeout=30000)

def library(page):
    return page.get_by_role('region',name='Flight School library',exact=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        page.set_default_timeout(15000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        setup(page)
        fit=page.locator('[aria-label="Year fit assessment"]')
        records(page,[[0,20],[0,21]])
        expect(fit).to_contain_text('same time add no time baseline')
        assert fit.get_by_role('button',name='Send to progress sheet',exact=True).count()==0
        records(page,[[0,20],[.1,20.1]])
        expect(fit).to_contain_text('less than half a day')
        records(page,[[0,20],[1,21]])
        expect(fit).to_contain_text('Early estimate')
        expect(fit).to_contain_text('360.00 days')
        assert 'Rate standard error from scatter' not in fit.inner_text()
        records(page,[[0,20],[1,21.02],[26,46]])
        expect(fit).to_contain_text('Rate standard error from scatter')
        expect(page.get_by_role('img',name='Your recorded positions and year fit')).to_be_visible()
        page.get_by_role('spinbutton',name='To day',exact=True).fill('1')
        expect(fit).to_contain_text('2 distinct selected dates')
        expect(fit).to_contain_text('Early estimate')
        page.get_by_role('spinbutton',name='From day',exact=True).fill('100')
        assert fit.get_by_role('button',name='Send to progress sheet',exact=True).count()==0
        page.get_by_role('button',name='Use all observing dates',exact=True).click()
        expect(fit).to_contain_text('3 distinct selected dates')
        records(page,[[0,20],[1,20],[2,20]])
        expect(fit).to_contain_text('do not establish positive annual drift')
        setup(page,'legend',manual=True)
        records(page,[[0,20],[1,21],[26,46.05]])
        expect(fit).to_contain_text('Manual-fit challenge')
        assert 'Inferred year' not in fit.inner_text()
        assert 'Rate standard error' not in fit.inner_text()
        assert fit.get_by_role('button',name='Send to progress sheet',exact=True).count()==0
        assert page.get_by_text('Blue line: fitted drift.',exact=False).count()==0
        assert page.locator('.katex').count()==0
        # The locked-world instrument accepts the actual sky turn, under the
        # same time-baseline checks, without requiring the stationary star.
        setup(page,'navigator',6)
        page.evaluate('''async()=>{const {flareAt}=await import('/src/engine/flares.ts');const {currentWorld}=await import('/src/game/sim.ts');let at=500;while(flareAt(currentWorld().system,at))at+=3600;__clock.t=at;__clock.emit();}''')
        page.get_by_role('button',name='Log the sky’s turn',exact=True).click()
        page.evaluate('''async()=>{const {flareAt}=await import('/src/engine/flares.ts');const {currentWorld}=await import('/src/game/sim.ts');let at=__clock.t+86400;while(flareAt(currentWorld().system,at))at+=3600;__clock.t=at;__clock.emit();}''')
        expect(page.get_by_role('button',name='Log the sky’s turn',exact=True)).to_be_enabled()
        page.get_by_role('button',name='Log the sky’s turn',exact=True).click()
        expect(fit).to_contain_text('Early estimate')
        assert page.evaluate('__game.getState().starObs.length')==2
        # Open the optional teaching lesson through Flight School itself.
        page.evaluate("__game.getState().newGame(91,{difficulty:'navigator',sound:false,survival:false,formulas:true});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}}})")
        page.get_by_role('button',name='Flight School',exact=False).click()
        library(page).locator('[data-training="lesson:year"]').get_by_role('button',name=re.compile('^Open')).click()
        lab=page.get_by_role('region',name='Year baseline mini expedition',exact=True)
        lab.get_by_role('button',name='Observe again now',exact=True).click()
        expect(lab).to_contain_text('same timestamp')
        lab.get_by_role('button',name='Observe 1 day later',exact=True).click()
        expect(lab).to_contain_text('Early estimate')
        lab.get_by_role('button',name='Observe 25 days later',exact=True).click()
        expect(lab).to_contain_text('Rate standard error from scatter')
        lab.get_by_role('checkbox',name='Make the next teaching sighting rough (+3° offset)',exact=True).check()
        lab.get_by_role('button',name='Observe 10 days later',exact=True).click()
        expect(lab).to_contain_text('deliberately offset observation')
        assert page.evaluate('__game.getState().starObs.length')==0
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        lab.screenshot(path=str(out/f'baseline-lab-{width}.png'))
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        # The locked-world lesson offers the same hands-on baseline experiment
        # for a clearly labeled sixty-day teaching orbit.
        library(page).locator('[data-training="lesson:locked"]').get_by_role('button',name=re.compile('^Open')).click()
        locked_lab=page.get_by_role('region',name='Year baseline mini expedition',exact=True)
        expect(locked_lab).to_contain_text('one rotation per 60-day orbit')
        locked_lab.get_by_role('button',name='Observe 1 day later',exact=True).click()
        locked_lab.get_by_role('button',name='Observe 10 days later',exact=True).click()
        expect(locked_lab).to_contain_text('Rate standard error from scatter')
        assert page.evaluate('__game.getState().starObs.length')==0
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        # Complete the actual year exercise with native date/point/log controls.
        library(page).locator('[data-training="exercise:year"]').get_by_role('button',name=re.compile('^Open')).click()
        page.wait_for_function('__game.getState().schoolSession?.id==="year"',timeout=60000)
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        expand(page)
        guide(page).get_by_role('button',name=re.compile('Fast-forward to dusk')).click()
        step(page,'year-tab');expand(page)
        if page.evaluate('__game.getState().screen')!='observatory': guide(page).get_by_role('button',name='Take me there',exact=True).click()
        page.get_by_role('button',name='Year',exact=True).click()
        page.get_by_role('button',name='Point at the star (solar filter)',exact=True).click()
        step(page,'year-log1');minimise(page)
        page.get_by_role('button',name='Log star position',exact=True).click()
        step(page,'year-log2');expand(page)
        guide(page).get_by_role('button',name=re.compile('Return on the next observing day')).click()
        minimise(page)
        page.get_by_role('button',name='Log star position',exact=True).click()
        step(page,'year-log3')
        investigation=page.get_by_role('region',name='Flight School year investigation',exact=True)
        expect(investigation).to_contain_text('First two dates')
        investigation.get_by_role('button',name='Return after 25 days',exact=True).click()
        page.get_by_role('button',name='Log star position',exact=True).click()
        step(page,'year-send');minimise(page)
        expect(investigation).to_contain_text('tested the first line')
        investigation.get_by_role('button',name='What did the extra date change?',exact=True).click()
        expect(investigation.get_by_role('status')).to_contain_text('Neither a narrow fit')
        assert page.evaluate('__game.getState().starObs.every(o=>o.source==="manual")')
        assert page.evaluate('__game.getState().schoolSession.assisted') is False
        investigation.screenshot(path=str(out/f'own-investigation-{width}.png'))
        fit=page.locator('[aria-label="Year fit assessment"]')
        fit.locator('input').fill('5')
        fit.get_by_role('button',name='Send to progress sheet',exact=True).click()
        expand(page)
        guide(page).get_by_role('button',name='Finish exercise',exact=True).click()
        library(page).wait_for()
        assert page.evaluate('__game.getState().sheet.g.value')==9.81
        assert page.evaluate('__clock.t')==123
        assert page.evaluate('__game.getState().starObs.length')==0
        assert page.evaluate('__game.getState().training["exercise:year"].status')=='completed'
        assert not errors,errors
        page.close()
    browser.close()
print('PASS SCI-05 baseline/finite-fit guards, range selection, manual/formula restrictions, real locked-world logs, interactive lesson mini expedition and native three-date Flight School investigation with restoration at 390/1440px')
