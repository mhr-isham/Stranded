"""Exercise ordinary expedition forecasts through the actual recording controls."""
import shutil
from playwright.sync_api import expect, sync_playwright

def measure(page, seconds, keep=True):
    page.locator('[data-tut="pend-scale"] canvas').click(position={'x': 100, 'y': 20})
    page.get_by_role('button', name='Release', exact=True).click()
    page.get_by_role('button', name='Start', exact=True).click()
    page.wait_for_timeout(seconds * 1000)
    page.get_by_role('button', name='Stop', exact=True).click()
    page.locator('.modal input').fill('5')
    page.get_by_role('button', name='Calculate g', exact=True).click()
    if keep:
        page.get_by_role('button', name='Keep reading', exact=True).click()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(390, 844), (1440, 900)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:5173/', wait_until='networkidle')
        page.evaluate('''async()=>{const {ECHO}=await import('/src/game/echo.ts');
          __game.getState().newGame(316,{difficulty:'navigator',sound:false,survival:false,formulas:true});
          __clock.paused=true;__clock.emit();
          __game.setState({phase:'play',screen:'pendulum',storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});}''')
        assert page.get_by_label('Pendulum field trial').count() == 0
        measure(page, 4)
        trial = page.get_by_label('Pendulum field trial')
        expect(trial.locator('details[open]')).to_have_count(0)
        trial.get_by_text('Optional · Try a different swing', exact=True).click()
        trial.get_by_role('textbox', name='Forecast (s)', exact=True).fill('1.23')
        trial.get_by_role('button', name='Log forecast', exact=True).click()
        expect(trial).to_contain_text('Swing trial underway')
        assert page.evaluate('__game.getState().predictions[0].result===undefined')
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('slider', name='String length setting')).to_have_value('0.6')
        measure(page, 4, keep=False)
        assert page.evaluate('__game.getState().predictions[0].result===undefined')
        page.get_by_role('button', name='Keep reading', exact=True).click()
        expect(trial).to_contain_text('Swing trial recorded')
        expect(trial).to_contain_text('Outside your forecast range')
        expect(trial.get_by_text('Check the measured string length', exact=False)).to_be_hidden()
        trial.get_by_text('Ask ECHO what to check', exact=True).click()
        trial.get_by_role('button', name='Go to swing readings').click()
        expect(page.locator('#swing-observations')).to_be_focused()
        assert page.evaluate('''()=>{const s=__game.getState();return s.predictions[0].result.truth===s.readings.at(-1).pendulum.period && s.predictions[0].result.points===0}''')

        page.evaluate('''()=>{__clock.t=3*86400;__clock.emit();__game.setState({screen:'observatory',starObs:[]})}''')
        page.get_by_role('button', name='Year', exact=True).click()
        assert page.get_by_text('Optional · Plan a star sighting', exact=True).count() == 0
        page.evaluate('''()=>__game.setState({starObs:[0,1,2].map(d=>({at:d*86400,v:(20+d)*Math.PI/180,source:'manual'}))})''')
        page.get_by_text('Optional · Plan a star sighting', exact=True).click()
        page.get_by_role('button', name='Tomorrow', exact=True).click()
        page.get_by_role('textbox', name='Forecast (°)', exact=True).fill('24')
        page.get_by_role('button', name='Log forecast', exact=True).click()
        expect(page.get_by_text('Forecast logged', exact=True)).to_be_visible()
        page.evaluate('''async () => {
            const { DAY } = await import('/src/engine/constants.ts');
            const { toHorizontal, topocentric, localFrame } = await import('/src/engine/sky.ts');
            const { opticalStatus } = await import('/src/game/observing.ts');
            const { skyline } = await import('/src/game/skyObservation.ts');
            const { makeLandscape } = await import('/src/render/terrain.ts');
            const { currentWorld } = await import('/src/game/sim.ts');
            const { resolvePredictions } = await import('/src/game/predictions.ts');
            const state = __game.getState();
            const day = state.predictions.at(-1).due;
            const { system } = currentWorld();
            const land = makeLandscape(system.seed, system.hillHeight);
            for (let at = day; at < day + DAY; at += 120) {
                const sun = toHorizontal(topocentric(system, 'star', at, system.site), localFrame(system, at, system.site));
                if (!opticalStatus(system, state, at, 'solar-year', { horizon: skyline(land, sun.az) }).ok) continue;
                __clock.t = at;
                resolvePredictions(at);
                __clock.emit();
                return;
            }
            throw Error('No usable solar-filter sighting in the forecast window');
        }''')

        assert page.evaluate('__game.getState().predictions.at(-1).result===undefined')
        page.get_by_role('button', name='Point at the star (solar filter)', exact=True).click()
        page.get_by_role('button', name='Log star position', exact=True).click()
        expect(page.get_by_text('Sky forecast compared', exact=True)).to_be_visible()
        assert page.evaluate('__game.getState().predictions.at(-1).result.observedAt===__game.getState().starObs.at(-1).at')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors, errors
        print(f'{width}×{height}: native swing and sky forecasts resolved only on keeping a new observation', flush=True)
        page.close()
