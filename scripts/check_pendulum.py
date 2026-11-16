"""SCI-02 UI and provenance checks; fixtures bypass the opening story.

Short hand-operated timings exercise data flow, not realistic human technique.
The illustrative timing budget never becomes the saved total uncertainty.
"""
from pathlib import Path
import math
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-pendulum')
out.mkdir(exist_ok=True)

def setup(page,mode='cadet',formulas=True):
    page.evaluate('''async({mode,formulas})=>{
      const {ECHO}=await import('/src/game/echo.ts');
      __game.getState().newGame(316,{difficulty:mode,sound:false,survival:false,formulas,freeRoam:true});
      __clock.t=500;__clock.warpIndex=5;__clock.paused=false;__clock.emit();
      __game.setState({phase:'play',screen:'pendulum',savedT:500,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5],readings:[],sheet:{}});
    }''',{'mode':mode,'formulas':formulas})
    page.wait_for_function('__clock.realtime&&__clock.rate===1')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        page.set_default_timeout(15000)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        setup(page)
        status=page.locator('[aria-label="Pendulum clock status"]')
        expect(status).to_contain_text('Rig & watch: real time')
        expect(status).to_contain_text('Expedition: 1× · saved warp: 1 day/s')
        expect(page.get_by_role('button',name='Faster',exact=True)).to_be_disabled()
        expect(page.get_by_role('button',name='Slower',exact=True)).to_be_disabled()
        comparison=page.locator('details[aria-label="Swing timing comparison"]')
        assert comparison.get_attribute('open') is None
        page.locator('.tool-stage').screenshot(path=str(out/f'rig-{width}.png'))
        comparison.locator('summary').click()
        assert '2-second period' in comparison.inner_text()
        rows=comparison.locator('tbody tr')
        assert '10.0%' in rows.first.inner_text()
        assert '0.500%' in rows.last.inner_text()
        assert comparison.locator('.katex').count()>0
        budget=comparison.get_by_role('spinbutton',name='Assumed total start/stop error (seconds)',exact=True)
        budget.fill('0.4')
        assert '20.0%' in rows.first.inner_text()
        budget.fill('')
        expect(comparison).to_contain_text('Enter a positive, finite timing error')
        budget.fill('0.2')
        comparison.locator('summary').click()
        # Native keyboard button activation must start/count once, without the
        # window hotkeys also handling the same event.
        page.locator('[data-tut="pend-scale"] canvas').click(position={'x':100,'y':20})
        page.get_by_role('button',name='Release',exact=True).click()
        start=page.get_by_role('button',name='Start',exact=True)
        start.focus();start.press('Space')
        expect(page.get_by_role('button',name='Stop',exact=True)).to_be_visible()
        assert 'full swings tapped: 0' in page.locator('[data-tut="pend-watch"]').inner_text()
        expect(page.get_by_role('slider',name='String length setting')).to_be_disabled()
        expect(page.get_by_role('slider',name='Release angle',exact=True)).to_be_disabled()
        expect(page.get_by_role('button',name='Release',exact=True)).to_be_disabled()
        count=page.get_by_role('button',name='+1',exact=True)
        count.focus();count.press('Enter')
        assert 'full swings tapped: 1' in page.locator('[data-tut="pend-watch"]').inner_text()
        count.click()
        assert 'full swings tapped: 2' in page.locator('[data-tut="pend-watch"]').inner_text()
        # Expedition pause does not pause the physical stopwatch or bob.
        page.get_by_title('Tap to pause / resume',exact=True).click()
        expect(status).to_contain_text('Expedition paused')
        assert page.locator('[data-tut="hud-warp"] .rate').inner_text()=='paused'
        at=page.evaluate('__clock.t')
        before=page.locator('[data-tut="pend-watch"] .readout').inner_text()
        page.wait_for_timeout(350)
        assert page.evaluate('__clock.t')==at
        assert page.locator('[data-tut="pend-watch"] .readout').inner_text()!=before
        stop=page.get_by_role('button',name='Stop',exact=True)
        stop.focus();stop.press('Space')
        modal=page.locator('.modal')
        modal.get_by_role('heading',name='How many full swings?',exact=True).wait_for()
        field=modal.locator('input')
        assert field.input_value()=='2'
        field.fill('9'*310)
        expect(modal.get_by_role('button',name='Calculate g',exact=True)).to_be_disabled()
        field.fill('2')
        modal.get_by_role('button',name='Calculate g',exact=True).click()
        result=page.locator('[data-tut="pend-result"]')
        meaning=result.locator('details[aria-label="Gravity compared with Earth"]')
        meaning.locator('summary').click()
        assert 'This instrument result' in meaning.inner_text()
        assert 'no stated uncertainty yet' in meaning.inner_text()
        assert meaning.locator('.katex').count()>0
        comparison.locator('summary').click()
        expect(comparison).to_contain_text('Your current timing')
        expect(comparison.locator('[aria-label="Your swing count"]')).to_contain_text('2 · yours')
        result.get_by_role('button',name='Keep reading',exact=True).click()
        reading=page.evaluate('__game.getState().readings[0]')
        assert reading['pendulum']['swings']==2
        assert reading['pendulum']['time']>0
        assert math.isclose(reading['value'],4*math.pi**2*reading['pendulum']['length']/reading['pendulum']['period']**2)
        expect(comparison).to_contain_text('Your latest kept timing')
        # Send the actual recorded value with a player's own error bar.
        sender=page.locator('[data-tut="pend-send"]').first
        sender.locator('input').fill(str(reading['value']*.1))
        sender.get_by_role('button',name='Send to progress sheet',exact=True).click()
        log=page.locator('[data-tut="pend-log"]')
        meaning=log.locator('details[aria-label="Gravity compared with Earth"]')
        meaning.locator('summary').click()
        assert 'Your progress-sheet estimate' in meaning.inner_text()
        assert 'percentage points' in meaning.inner_text()
        assert page.evaluate('__game.getState().sheet.g.sigma')==reading['value']*.1
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        comparison.screenshot(path=str(out/f'timing-{width}.png'))
        meaning.screenshot(path=str(out/f'earth-{width}.png'))
        page.get_by_role('button',name='← Camp',exact=True).click()
        page.wait_for_function('!__clock.realtime')
        assert page.evaluate('__clock.warpIndex')==5
        assert page.evaluate('__clock.paused')
        page.evaluate("__game.getState().go('pendulum')")
        page.wait_for_function('__clock.realtime')
        page.reload(wait_until='networkidle')
        page.wait_for_function('__clock.realtime')
        assert page.evaluate('__game.getState().readings[0].pendulum.swings')==2
        comparison=page.locator('details[aria-label="Swing timing comparison"]')
        comparison.locator('summary').click()
        expect(comparison).to_contain_text('Your latest kept timing')
        # Reload retains observation metadata; clock preferences themselves
        # follow the game's existing reload defaults. Test the current state.
        saved_warp=page.evaluate('__clock.warpIndex')
        paused=page.evaluate('__clock.paused')
        page.get_by_role('button',name='← Camp',exact=True).click()
        page.wait_for_function('!__clock.realtime')
        assert page.evaluate('__clock.warpIndex')==saved_warp
        assert page.evaluate('__clock.paused')==paused
        # Every mode keeps optional interpretation; formula-off stays off.
        for mode in ['stargazer','navigator','astronomer','legend']:
            setup(page,mode,False)
            page.evaluate("__game.setState({sheet:{g:{value:4.905,sigma:.4905}}})")
            meaning=page.locator('details[aria-label="Gravity compared with Earth"]')
            assert meaning.get_attribute('open') is None
            meaning.locator('summary').click()
            expect(meaning).to_contain_text('50.0% of their Earth weight')
            expect(meaning).to_contain_text('±5.00 percentage points')
            assert page.locator('.katex').count()==0
            assert page.evaluate('__game.getState().penaltyDv')==0
        # Losing visibility invalidates an unfinished manual timing. This event
        # fixture checks the handler, not actual operating-system throttling.
        page.get_by_role('button',name='Release',exact=True).click()
        page.get_by_role('button',name='Start',exact=True).click()
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        expect(page.get_by_role('button',name='Start',exact=True)).to_be_visible()
        expect(page.locator('[data-tut="pend-watch"]')).to_contain_text('Timing interrupted while hidden')
        assert page.locator('[data-tut="pend-result"]').count()==0
        assert page.evaluate('__game.getState().readings.length')==0
        assert not errors,errors
        page.close()
    browser.close()
print('PASS SCI-02: own timing budgets, scaled player uncertainty, keyboard counting, setup locks, paused/real clocks, saved warp, metadata persistence, formula-off modes and interrupted timing at phone/desktop widths')
