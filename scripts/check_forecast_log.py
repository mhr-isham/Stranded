"""Check completed forecast comparisons and ECHO permissions in the browser."""
import re
import shutil
import sys

from playwright.sync_api import expect, sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
fixture = """async (settings) => {
    const { ECHO } = await import('/src/game/echo.ts');
    const { DAY } = await import('/src/engine/constants.ts');
    const { currentWorld } = await import('/src/game/sim.ts');
    const { makePrediction, nextMoonEast, nextStationary, compareStarTrial, resolvePredictions } =
        await import('/src/game/predictions.ts');
    __game.getState().newGame(316, { sound: false, survival: false, formulas: true, ...settings }, 1);
    const { system } = currentWorld();
    const made = 7 * DAY;
    const peak = nextMoonEast(system, made);
    const turn = nextStationary(system, made);
    if (peak === null || turn === null) throw Error('Missing scored events for the fixture');
    __clock.t = made;
    __clock.paused = true;
    __game.setState({ phase: 'play', screen: 'observatory', echo: [], storyQueue: [], identified: true,
        actsSeen: [1, 2, 3, 4, 5], seenEcho: Object.values(ECHO).map((line) => line.id),
        starObs: [0, 1, 2].map(d => ({ at: d * DAY, v: (20 + d) * Math.PI / 180, source: 'manual' })) });
    makePrediction({ kind: 'star', made: 3 * DAY, due: 4 * DAY, at: 4, value: 25, sigma: 0.1, fieldTrial: true });
    const sighting = { at: 4.25 * DAY, v: 26 * Math.PI / 180, source: 'manual' };
    compareStarTrial(sighting);
    __game.setState({ starObs: [...__game.getState().starObs, sighting] });
    makePrediction({ kind: 'star', made: 5 * DAY, due: 6 * DAY, at: 6, value: 27, sigma: 0.1, fieldTrial: true });
    resolvePredictions(made);
    makePrediction({ kind: 'moon', made, due: peak + 0.05 * DAY, value: peak / DAY - 0.5, sigma: 0.1 });
    makePrediction({ kind: 'retro', made, due: turn + DAY, value: turn / DAY, sigma: 1 });
    __clock.emit();
    return Math.max(peak + 0.05 * DAY, turn + DAY);
}"""

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which('chromium'))
    cases = [
        ({'difficulty': 'stargazer'}, 390, True, True),
        ({'difficulty': 'cadet'}, 1440, True, True),
        ({'difficulty': 'cadet', 'cadetGuidance': False}, 390, False, False),
        ({'difficulty': 'navigator'}, 1440, True, False),
        ({'difficulty': 'navigator', 'freeRoam': True}, 390, False, False),
        ({'difficulty': 'navigator', 'freeRoam': True, 'freeRoamGuidance': True}, 1440, True, False),
        ({'difficulty': 'astronomer'}, 390, False, False),
        ({'difficulty': 'legend'}, 1440, False, False),
    ]
    for settings, width, help_enabled, walkthrough in cases:
        page = browser.new_page(viewport={'width': width, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game && window.__clock)')
        due = page.evaluate(fixture, settings)
        page.get_by_role('button', name='Moon', exact=True).click()
        moon = page.get_by_label('Moon orbit analysis')
        assert moon.get_by_text(re.compile('^Forecast log')).count() == 0

        # Resolve through the gameplay model, then open the log without a usable fit.
        page.evaluate("""async (due) => {
            const { resolvePredictions } = await import('/src/game/predictions.ts');
            __clock.t = due;
            resolvePredictions(due);
            __clock.emit();
        }""", due)
        for line in page.evaluate('__game.getState().echo.filter((line) => line.id.startsWith("pred-"))'):
            assert 'elapsed day' not in line['text'] and 'Forecast resolved' in line['text']
        echo_button = page.locator('.echo button')
        while echo_button.count():
            echo_button.click()
        moon.get_by_text('Forecast log · 1', exact=True).click()
        moon.get_by_text(re.compile('^Set on elapsed day .*Outside range')).click()
        expect(moon.get_by_text('0.50 days later', exact=True)).to_be_visible()
        expect(moon.get_by_text('Scored event', exact=True)).to_be_visible()
        expect(moon.get_by_text(re.compile('^Simulation time used for scoring'))).to_be_visible()
        assert moon.get_by_text('Ask ECHO what to check', exact=True).count() == int(help_enabled)
        if help_enabled:
            check = moon.get_by_text('Ask ECHO what to check', exact=True)
            expect(moon.get_by_text(re.compile('^Check whether the sightings'))).to_be_hidden()
            before = page.evaluate('JSON.stringify([__clock.t, __game.getState().predictions, __game.getState().checksUsed])')
            check.click()
            expect(moon.get_by_text(re.compile('^Check whether the sightings'))).to_be_visible()
            assert moon.get_by_text(re.compile('^If you miss a crest')).count() == int(walkthrough)
            moon.get_by_role('button', name='Go to Moon observations').click()
            expect(page.locator('#moon-observations')).to_be_focused()
            assert page.evaluate('JSON.stringify([__clock.t, __game.getState().predictions, __game.getState().checksUsed])') == before

        page.get_by_role('button', name='Tracker', exact=True).click()
        page.get_by_text('Forecast log · 1', exact=True).click()
        page.get_by_text(re.compile('^Set on elapsed day .*Inside range')).click()
        expect(page.get_by_text('Matches forecast', exact=True)).to_be_visible()
        assert page.get_by_text('Ask ECHO what to check', exact=True).count() == 0

        page.get_by_role('button', name='Year', exact=True).click()
        page.get_by_text(re.compile('^Optional · Plan a star sighting')).click()
        expect(page.get_by_text('Kept reading', exact=True)).to_be_visible()
        expect(page.get_by_text('1.00° higher', exact=True)).to_be_visible()
        expect(page.get_by_text(re.compile('^Kept on elapsed day 4.25 · Unscored'))).to_be_visible()
        if help_enabled:
            page.get_by_text('Ask ECHO what to check', exact=True).click()
            expect(page.get_by_text(re.compile('^The pre-forecast sightings still in your log span 2.0 days'))).to_be_visible()
        page.get_by_text('Forecast log · 1', exact=True).click()
        page.get_by_text(re.compile('^Set on elapsed day .*No kept sighting')).click()
        expect(page.get_by_text(re.compile('^The window passed without a kept sighting. There’s no comparison'))).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        assert not errors, errors
        print(f'{width}px {settings}: chronology, comparisons, assistance, and instrument link passed', flush=True)
        page.close()
    browser.close()
