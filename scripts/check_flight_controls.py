"""Flight deck controls, independent practice and required-flight accounting.

Uses real controls and generated systems. Clearly marked state fixtures put
flights near transitions without pretending to be human piloting playtests.
"""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

out = Path('/tmp/stranded-flight')
out.mkdir(exist_ok=True)

def unobstructed(locator):
    assert locator.is_visible()
    assert locator.evaluate('''el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit)}''')

fixture = '''async difficulty=>{
 __game.getState().newGame(316,{difficulty,survival:difficulty==='legend',formulas:false,sound:false,campaignRun:true});
 const {currentWorld}=await import('/src/game/sim.ts'); const {botPlay,PERFECT}=await import('/src/engine/solver.ts');
 const {bestTransfer}=await import('/src/engine/planner.ts'); const r=botPlay(currentWorld().system,PERFECT,7);
 if(r.result?.outcome!=='success')throw Error('No successful transfer fixture'); const p=bestTransfer(r.model,r.departTime);
 window.__flightFixture={plan:p.plan,result:r.result,sheet:r.primaries};
 __clock.t=r.departTime;__clock.paused=true;
 __game.setState({phase:'play',screen:'launch',savedT:r.departTime,sheet:r.primaries,identified:true,names:{target:'QA world'},actsSeen:[1,2,3,4,5],seenEcho:['welcomeQuiet','nameIt','relayHint','lowLife'],storyQueue:[],campaign:{}});
}'''

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])
    for width, height in [(390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:5173/', wait_until='networkidle')
        page.evaluate('''()=>{__game.getState().newGame(91,{difficulty:'navigator',survival:false,formulas:true,sound:false});__game.getState().setSheet('g',{value:9.81,sigma:.2});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123})}''')
        page.get_by_role('button', name='Flight School', exact=False).click()
        page.get_by_role('combobox', name='Practice handling', exact=True).select_option('astronomer')
        page.get_by_role('button', name='Practice ascent', exact=True).click()
        page.wait_for_function("__game.getState().phase==='ascent'", timeout=60000)
        page.get_by_role('button', name='Ready to fly', exact=True).click()
        page.keyboard.down('w'); page.keyboard.down('d')
        assert page.evaluate('__ascent.input.current.thrust && __ascent.input.current.right')
        page.keyboard.up('w')
        assert page.evaluate('!__ascent.input.current.thrust && __ascent.input.current.right')
        page.keyboard.up('d')
        burn = page.get_by_role('button', name='Burn', exact=True)
        r = burn.bounding_box()
        page.mouse.move(r['x'] + r['width']/2, r['y'] + r['height']/2)
        page.mouse.down(); page.keyboard.down('w'); page.mouse.up()
        assert page.evaluate('__ascent.input.current.thrust')
        page.keyboard.up('w')
        assert not page.evaluate('__ascent.input.current.thrust')
        page.get_by_role('button', name='Pitch up', exact=True).focus()
        page.keyboard.down(' ')
        assert page.evaluate('__ascent.input.current.left && !__ascent.input.current.thrust')
        page.keyboard.up(' ')
        page.get_by_role('button', name='Pause flight', exact=True).click()
        t = page.evaluate('__ascent.state.current.t')
        page.wait_for_timeout(200)
        assert page.evaluate('__ascent.state.current.t') == t
        page.get_by_role('button', name='Controls', exact=True).click()
        slider = page.get_by_role('slider', name='Steering sensitivity', exact=False)
        slider.focus(); slider.press('Home'); slider.press('ArrowRight'); slider.press('ArrowRight')
        page.get_by_role('button', name='Reduced flight motion', exact=False).click()
        assert abs(page.evaluate('__game.getState().settings.flightSensitivity') - .7) < .01
        assert page.evaluate('__game.getState().settings.flightReducedMotion')
        page.get_by_role('button', name='Close', exact=True).click()
        page.reload(wait_until='networkidle')
        page.wait_for_function("__game.getState().phase==='ascent'")
        assert page.evaluate('__game.getState().practiceReturn.state.sheet.g.value') == 9.81
        page.get_by_role('button', name='Ready to fly', exact=True).click()
        page.keyboard.down('w')
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        assert not page.evaluate('__ascent.input.current.thrust')
        page.keyboard.up('w')
        page.get_by_role('button', name='Ready to fly', exact=True).wait_for()
        unobstructed(page.get_by_role('button', name='Exit practice', exact=True))
        page.screenshot(path=str(out / f'ascent-{width}.png'))
        page.get_by_role('button', name='Exit practice', exact=True).click()
        assert page.evaluate('__game.getState().seed') == 91
        assert page.evaluate('__game.getState().sheet.g.value') == 9.81
        assert page.evaluate('__clock.t') == 123
        assert page.evaluate('__game.getState().atlas.length') == 0
        page.get_by_role('combobox', name='Practice handling', exact=True).select_option('astronomer')
        page.get_by_role('button', name='Practice entry and landing', exact=True).click()
        page.wait_for_function("__game.getState().phase==='landing'", timeout=60000)
        page.screenshot(path=str(out / f'entry-{width}.png'))
        page.get_by_role('button', name='Ready to fly', exact=True).click()
        page.keyboard.down('a'); page.wait_for_timeout(100); page.keyboard.up('a')
        # Transition fixture: let the real entry update enter descent at a safe height.
        page.evaluate('''()=>{const x=__prologue;const s=x.sim.current;s.alt=11001;s.d.x=0;s.d.y=x.terrain.height(0)+1000;s.d.vx=0;s.d.vy=-20;s.d.th=0}''')
        page.wait_for_function("__prologue.sim.current.stage==='descent'")
        left = page.get_by_role('button', name='Rotate left', exact=True).bounding_box()
        thrust = page.get_by_role('button', name='Burn', exact=True).bounding_box()
        cdp = page.context.new_cdp_session(page)
        cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[
            {'x':left['x']+left['width']/2,'y':left['y']+left['height']/2,'id':1},
            {'x':thrust['x']+thrust['width']/2,'y':thrust['y']+thrust['height']/2,'id':2}]})
        assert page.evaluate('__prologue.input.current.left && __prologue.input.current.thrust')
        cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
        assert page.evaluate('!__prologue.input.current.left && !__prologue.input.current.thrust')
        page.get_by_role('button', name='Pause flight', exact=True).click()
        page.screenshot(path=str(out / f'descent-{width}.png'))
        unobstructed(page.get_by_role('button', name='Exit practice', exact=True))
        page.get_by_role('button', name='Exit practice', exact=True).click()
        assert page.evaluate('__game.getState().sheet.g.value') == 9.81
        assert not errors, errors
        page.close()

    for difficulty in ['astronomer', 'legend']:
        page = browser.new_page(viewport={'width':390,'height':844})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:5173/', wait_until='networkidle')
        page.evaluate(fixture, difficulty)
        page.get_by_role('button', name='Now', exact=True).click()
        page.get_by_role('button', name='Launch now', exact=True).click()
        assert page.get_by_role('button', name='🚀 Confirm launch', exact=True).count() == 0
        page.get_by_role('button', name='🕹 Begin manual ascent', exact=True).click()
        page.wait_for_function("__game.getState().phase==='ascent'")
        page.get_by_role('button', name='Request ECHO rescue', exact=True).click()
        page.get_by_role('button', name='Keep manual control', exact=True).click()
        assert page.evaluate('__game.getState().piloting.assisted.length') == 0
        # Trigger the real automatic-rescue branch with a falling ascent fixture.
        page.evaluate('''()=>{const a=__ascent;Object.assign(a.state.current,{t:100,r:a.params.R+1000,vr:-200,vt:0});a.controls.pause(false)}''')
        page.wait_for_function("__game.getState().piloting.assisted.includes('ascent')")
        page.evaluate('''()=>{const a=__ascent;Object.assign(a.state.current,{r:a.params.R+a.params.orbitAlt,vr:0,vt:Math.sqrt(a.params.mu/(a.params.R+a.params.orbitAlt)),dv:a.baseline})}''')
        page.get_by_role('button', name='Departure burn →', exact=True).wait_for()
        page.get_by_role('button', name='Departure burn →', exact=True).click()
        page.wait_for_function("__game.getState().phase==='flight'")
        # Bypass the coast animation only; keep the actual destination landing UI.
        page.evaluate("__game.setState({phase:'landing'})")
        page.get_by_role('button', name='ECHO landing', exact=True).click()
        page.get_by_role('button', name='Continue assisted', exact=True).click()
        page.wait_for_function("__game.getState().phase==='results' && __game.getState().atlas.length===1")
        assert page.evaluate('__game.getState().atlas[0].assisted')
        assert page.evaluate('__game.getState().atlas[0].score') == 0
        assert page.evaluate('Object.keys(__game.getState().campaign[1].best).length') == 0
        assert page.evaluate('__game.getState().campaign[1].done')
        assert page.evaluate('__game.getState().achievements.length') == 0
        assert page.get_by_role('columnheader', name='Points', exact=True).count() == 0
        assert page.evaluate('Object.keys(__game.getState().sheet).length') > 5
        assert page.evaluate('__game.getState().logs.length') > 0
        # Story rewards intentionally remain available on an assisted journey.
        # Close the queued story presentation to inspect the underlying debrief.
        page.evaluate('__game.setState({storyQueue:[]})')
        page.evaluate("navigator.clipboard.writeText=t=>{window.__share=t;return Promise.resolve()}")
        page.get_by_role('button', name='Share assisted journey', exact=True).click()
        shared = page.evaluate('window.__share')
        assert 'assisted journey · unscored' in shared and 'pts' not in shared and 'grade' not in shared
        page.screenshot(path=str(out / f'assisted-{difficulty}.png'))
        # A successful manual branch must still earn a normal grade.
        page.evaluate(fixture, difficulty)
        page.evaluate("__game.setState({phase:'ascent',pendingLaunch:{plan:__flightFixture.plan}})")
        page.wait_for_function('__ascent.runId===__game.getState().runId')
        page.evaluate('''()=>{const a=__ascent;Object.assign(a.state.current,{r:a.params.R+a.params.orbitAlt,vr:0,vt:Math.sqrt(a.params.mu/(a.params.R+a.params.orbitAlt)),dv:a.baseline});a.controls.pause(false)}''')
        page.get_by_role('button', name='Departure burn →', exact=True).wait_for()
        assert page.evaluate('__game.getState().piloting.ascent') == 'manual'
        page.get_by_role('button', name='Departure burn →', exact=True).click()
        page.evaluate("__game.setState({phase:'landing'})")
        page.get_by_role('button', name='Ready to fly', exact=True).click()
        page.evaluate('''difficulty=>{const x=__prologue;const s=x.sim.current;s.alt=11001;const f=x.terrain.features.find(f=>f.kind==='flat');s.d.x=(f.x0+f.x1)/2;s.d.y=x.terrain.height(s.d.x)+.01;s.d.vy=difficulty==='legend'?-6:-1;s.d.vx=0;s.d.th=0;s.d.om=0}''', difficulty)
        page.get_by_role('button', name='Continue', exact=True).wait_for()
        page.get_by_role('button', name='Continue', exact=True).click()
        page.wait_for_function("__game.getState().phase==='results' && __game.getState().atlas.length===2")
        assert page.evaluate('__game.getState().piloting.landing') == 'manual'
        assert page.evaluate('__game.getState().arrival.landing') == ('rough' if difficulty == 'legend' else 'clean')
        assert not page.evaluate('__game.getState().atlas.at(-1).assisted || false')
        assert page.evaluate('Object.keys(__game.getState().campaign[1].best).length') == 1
        assert page.get_by_role('columnheader', name='Points', exact=True).is_visible()
        # Destination-only emergency rescue must also remove hard-mode scoring.
        page.evaluate(fixture, difficulty)
        page.evaluate("__game.setState({phase:'landing',outcome:__flightFixture,piloting:{ascent:'manual',assisted:[]}})")
        page.get_by_role('button', name='Ready to fly', exact=True).click()
        page.evaluate('''()=>{const x=__prologue;const s=x.sim.current;s.alt=11001;s.d.x=0;s.d.y=x.terrain.height(0)+100;s.d.vy=-120;s.d.vx=0;s.d.th=0}''')
        page.wait_for_function("__game.getState().piloting.assisted.includes('landing')")
        page.get_by_role('button', name='ECHO landing', exact=True).click()
        page.get_by_role('button', name='Continue assisted', exact=True).click()
        page.wait_for_function("__game.getState().phase==='results' && __game.getState().atlas.length===3")
        assert page.evaluate('__game.getState().atlas.at(-1).assisted')
        assert not errors, errors
        page.close()
    browser.close()
print('PASS flight keyboard/pointer/multitouch, pause/focus release, sensitivity/motion, practice restoration, required hard launch, automatic rescue/assisted accounting/share, successful manual branches; phone, desktop and landscape layouts')
