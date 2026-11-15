"""Check Navigator/Astronomer assistance in Chromium against a fresh Vite server."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

out = Path('/tmp/stranded-independent-modes')
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])
    for width, height in [(390, 844), (1440, 900)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: d.accept())
        page.goto('http://localhost:5173/', wait_until='networkidle')
        page.evaluate('''()=>{__game.getState().newGame(316,{difficulty:'navigator',survival:false,formulas:true,sound:false,campaignRun:false});__clock.t=1;__clock.paused=true;__game.setState({phase:'play',screen:'hub',savedT:1,seenEcho:['welcomeNavigator']})}''')
        page.locator('.mission-active').get_by_text('Measure the surface gravity g.', exact=True).wait_for()
        assert page.locator('.echo').count() == 0
        assert page.get_by_text('Time the pendulum and keep at least 3 gravity readings.', exact=True).count() == 0
        # The actual prediction UI must not correct Navigator's guess. Numeric
        # readings are test fixtures, not measurements supplied by the game.
        page.evaluate('''()=>{for(let i=0;i<2;i++)__game.getState().addReading({key:'g',value:9+i/100,at:i,note:'QA fixture'});__game.getState().go('pendulum')}''')
        predict = page.locator('.predict')
        predict.locator('input[inputmode="decimal"]').fill('500')
        assert predict.get_by_text('Your data says otherwise', exact=True).count() == 0
        assert predict.get_by_text('Use a ratio:', exact=False).count() == 0
        page.evaluate('''()=>{const s=__game.getState();__game.setState({settings:{...s.settings,difficulty:'cadet'}})}''')
        predict.get_by_text('Your data says otherwise', exact=True).wait_for()
        page.evaluate('''()=>{const s=__game.getState();__game.setState({settings:{...s.settings,difficulty:'navigator'}})}''')
        assert predict.get_by_text('Your data says otherwise', exact=True).count() == 0
        predict.get_by_role('button', name='How to estimate', exact=True).click()
        page.locator('.lesson-modal').wait_for()
        page.get_by_role('button', name='Close lesson', exact=True).click()
        # Navigator may explicitly inspect a trend fitted to their own readings.
        page.evaluate('''()=>{__game.setState({starObs:[{at:0,v:0},{at:86400,v:0.02},{at:172800,v:0.041}]});__game.getState().go('observatory')}''')
        page.locator('[data-tut="obs-tab-year"]').click()
        page.get_by_role('checkbox', name='Show the straight line through my readings', exact=True).check()
        assert page.get_by_role('checkbox', name='Show the straight line through my readings', exact=True).is_checked()
        # Requested assistance still works and retains its original costs/limits.
        page.evaluate('''()=>{__game.getState().setSheet('g',{value:9,sigma:0.1});__game.getState().go('sheet')}''')
        page.get_by_role('button', name='Nudge me', exact=True).click()
        assert page.evaluate('__game.getState().hintsUsed') == 1
        assert page.get_by_role('button', name='How is it measured?', exact=True).count() == 0
        assert page.get_by_role('button', name='Ask ECHO to verify', exact=False).is_visible()
        page.get_by_role('button', name='Menu', exact=True).click()
        for i in range(3):
            page.get_by_role('button', name='Save', exact=True).first.click()
        assert page.evaluate('__game.getState().checkpointsUsed') == 3
        assert all(page.get_by_role('button', name='Save', exact=True).nth(i).is_disabled() for i in range(3))
        page.get_by_role('button', name='Close', exact=True).click()
        # Astronomer's formula default comes from the real setup selector.
        page.evaluate("__game.setState({phase:'title',savedT:0})")
        page.get_by_role('button', name='Single expedition', exact=True).click()
        page.get_by_role('radio', name='Astronomer', exact=False).click()
        page.get_by_placeholder('random', exact=True).fill('316')
        page.get_by_role('button', name='Launch expedition', exact=True).click()
        page.wait_for_function("__game.getState().phase==='prologue'")
        assert page.evaluate('__game.getState().settings.formulas') is False
        page.evaluate('''()=>{__clock.t=1;__clock.paused=true;__game.setState({phase:'play',screen:'hub',savedT:1,seenEcho:['welcomeQuiet'],storyQueue:[]})}''')
        assert page.locator('.missions').count() == 0
        page.get_by_role('button', name='Menu', exact=True).click()
        assert page.get_by_role('button', name='Save', exact=True).count() == 0
        page.get_by_role('button', name='Formula sheet', exact=False).click()
        assert page.evaluate('__game.getState().settings.formulas') is True
        page.get_by_role('button', name='Close', exact=True).click()
        page.evaluate('''()=>{__game.getState().setSheet('g',{value:9,sigma:0.1});__game.getState().setSheet('R1',{value:6e6,sigma:1e4});__game.getState().go('sheet')}''')
        assert page.get_by_role('button', name='Nudge me', exact=True).count() == 0
        assert page.get_by_role('button', name='Ask ECHO to verify', exact=False).count() == 0
        page.get_by_text('Consistency checks', exact=True).wait_for()
        assert page.locator('[data-tut="sheet-panel"] .katex').count() > 0
        page.get_by_role('button', name='📜 Codex', exact=True).click()
        page.get_by_role('button', name='Making a good estimate', exact=False).click()
        page.locator('.lesson-modal').wait_for()
        page.get_by_role('button', name='Close lesson', exact=True).click()
        page.screenshot(path=str(out / f'astronomer-lessons-{width}.png'))
        assert not errors, errors
        page.close()
    browser.close()
print('PASS Navigator goal-only guidance, no automatic prediction correction, requested lessons/hints, three-save limit; Astronomer defaults, formula toggle, arithmetic/lessons and absent hints/verification/checkpoints at phone/desktop widths')
