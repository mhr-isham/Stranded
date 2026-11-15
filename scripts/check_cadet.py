"""Cadet objective/help flows at phone and desktop widths, using a fresh Vite server."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

out = Path('/tmp/stranded-cadet')
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])
    for width, height in [(390, 844), (1440, 900)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:5173/', wait_until='networkidle')
        # Use the real generated world and store; bypass only the landing/story sequence.
        page.evaluate('''()=>{__game.getState().newGame(316,{difficulty:'cadet',survival:false,formulas:true,sound:false,campaignRun:true});__clock.t=1;__clock.paused=true;__game.setState({phase:'play',screen:'hub',savedT:1,storyQueue:[],seenEcho:['welcomeCadet']})}''')
        guide = page.get_by_role('region', name='Cadet guidance', exact=True)
        guide.wait_for()
        assert guide.get_by_text('Measure the surface gravity g.', exact=True).is_visible()
        assert guide.get_by_text('Surface gravity g tells', exact=False).count() == 0
        assert page.locator('.echo').count() == 0
        guide.get_by_role('button', name='Why this matters', exact=True).click()
        assert guide.get_by_text('Surface gravity g tells', exact=False).is_visible()
        guide.get_by_role('button', name='How do I do this?', exact=True).click()
        guide.get_by_role('button', name='Walk me through it', exact=True).click()
        assert guide.get_by_text('Walkthrough · 1 / 3', exact=True).is_visible()
        guide.get_by_role('button', name='Next step', exact=True).click()
        assert guide.get_by_text('Walkthrough · 2 / 3', exact=True).is_visible()
        guide.get_by_role('button', name='Previous step', exact=True).click()
        guide.get_by_role('button', name='Close walkthrough', exact=True).click()
        page.screenshot(path=str(out / f'goal-{width}.png'))
        guide.get_by_role('button', name='Hide guidance', exact=True).click()
        page.get_by_role('button', name='Show next goal', exact=True).wait_for()
        # Hidden help survives reload; players can restore it in camp or the menu.
        page.reload(wait_until='networkidle')
        page.get_by_role('button', name='Show next goal', exact=True).wait_for()
        page.get_by_role('button', name='Menu', exact=True).click()
        page.get_by_role('button', name='Cadet guidance', exact=False).click()
        page.get_by_role('button', name='Close', exact=True).click()
        guide.get_by_role('button', name='Expedition overview', exact=True).click()
        guide.get_by_role('button', name='The distance scale', exact=True).click()
        page.wait_for_function("__game.getState().screen==='rover'")
        page.get_by_role('button', name='⛺ Camp', exact=True).click()
        guide.get_by_role('button', name='Open the tool', exact=True).click()
        page.wait_for_function("__game.getState().screen==='pendulum'")
        # Earlier manual walkthrough use already acknowledged its offer. Reset
        # only that test fixture to exercise the separate unsolicited offer.
        page.evaluate('__game.setState({cadetHelp:{warnings:{},offered:[]}})')
        page.locator('[data-tut="pend-scale"] canvas').click(position={'x': 100, 'y': 20})
        # Three explicit short timings raise real instrument warnings. Paused time
        # and changing screens alone must never offer "stuck" help.
        for i in range(3):
            page.get_by_role('button', name='Start', exact=True).click()
            page.get_by_role('button', name='Stop', exact=True).click()
            modal = page.locator('.modal')
            modal.locator('input').fill('1')
            modal.get_by_role('button', name='Calculate', exact=False).click()
            page.get_by_text('⚠ Suspicious reading', exact=True).wait_for()
            page.get_by_role('button', name='Discard', exact=True).click()
        assert page.evaluate('__game.getState().cadetHelp.warnings.gravity') == 3
        assert guide.get_by_role('button', name='Show walkthrough', exact=True).is_visible()
        guide.get_by_role('button', name='I’ll keep exploring', exact=True).click()
        page.get_by_role('button', name='← Camp', exact=True).click()
        guide.get_by_role('button', name='Open the tool', exact=True).click()
        assert guide.get_by_role('button', name='Show walkthrough', exact=True).count() == 0
        # Completion reacts to kept observations and never fills the sheet for us.
        page.evaluate('''()=>{for(let i=0;i<3;i++)__game.getState().addReading({key:'g',value:9+i/100,at:i,note:'QA fixture'})}''')
        page.get_by_role('region', name='Measurement next step', exact=True).wait_for()
        assert page.evaluate('__game.getState().sheet.g') is None
        page.get_by_role('button', name='← Camp', exact=True).click()
        guide.get_by_text('Measure the planet’s radius R₁.', exact=True).wait_for()
        page.evaluate('''()=>{for(let i=0;i<3;i++)__game.getState().addReading({key:'R1',value:6e6+i*100,at:i,note:'QA fixture'});__game.getState().go('sheet')}''')
        guide.get_by_text('Put g and R₁ on the progress sheet.', exact=True).wait_for()
        assert page.evaluate('__game.getState().hintsUsed') == 0
        assert page.evaluate('__game.getState().checksUsed') == 0
        assert page.evaluate('__game.getState().penaltyDv') == 0
        # Other difficulties retain their own mission presentation and silence.
        for mode in ['stargazer', 'navigator', 'astronomer', 'legend']:
            page.evaluate('(difficulty)=>{const s=__game.getState();__game.setState({screen:"hub",settings:{...s.settings,difficulty}})}', mode)
            assert guide.count() == 0
            assert page.locator('.missions').count() == (1 if mode in ['stargazer', 'navigator'] else 0)
        assert not errors, errors
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.close()
    browser.close()
print('PASS Cadet layered goals, walkthroughs, free exploration, persistent hide/reopen, real-warning offer/dismissal, reading feedback and goal progression at phone/desktop widths')
