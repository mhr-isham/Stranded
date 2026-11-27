"""Exercise the receiver, saved schedules and archive controls in the probe bay."""
from pathlib import Path
import re
import shutil
import sys

from playwright.sync_api import expect, sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
out = Path('/tmp/stranded-probe-listening')
out.mkdir(exist_ok=True)
fixture = """async () => {
    const { ECHO } = await import('/src/game/echo.ts');
    const { currentWorld } = await import('/src/game/sim.ts');
    const { botMeasure, PERFECT } = await import('/src/engine/solver.ts');
    const { makeRng } = await import('/src/engine/rng.ts');
    __game.getState().newGame(316, {difficulty: 'navigator', sound: false, survival: false, formulas: true}, 2);
    __clock.t = 1000;
    __clock.paused = true;
    const {system} = currentWorld();
    __game.setState({phase: 'play', screen: 'probe', sheet: botMeasure(system, PERFECT, makeRng(812)).primaries, echo: [], storyQueue: [],
        seenEcho: Object.values(ECHO).map(line => line.id), actsSeen: [1, 2, 3, 4, 5]});
}"""
seek = """offset => {
    const pass = __game.getState().probe.arriveAt;
    __clock.t = pass + offset * 3600;
    __clock.paused = true;
    __clock.emit();
}"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which('chromium'))
    for width, height in [(390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True)
        page.set_default_timeout(12000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game && window.__clock)')
        page.evaluate(fixture)
        page.get_by_role('button', name='Launch probe', exact=True).click()
        schedule = page.get_by_role('region', name='Probe listening schedule')
        chart = page.get_by_role('img', name='Recorded probe Doppler samples')
        expect(schedule.get_by_text('0 received', exact=True)).to_be_visible()
        expect(chart).to_have_count(0)
        assert not page.evaluate('__game.getState().probe.crashed')
        schedule.get_by_text('Add a manual window', exact=True).click()
        schedule.get_by_label('Start offset (h)').fill('-42')
        schedule.get_by_label('End offset (h)').fill('-38')
        schedule.get_by_label('Read every').select_option('7200')
        schedule.get_by_role('button', name='Schedule window').click()
        expect(schedule.get_by_text('Listening window scheduled.', exact=True)).to_be_visible()
        expect(schedule.get_by_text('Listening windows (4)', exact=True)).to_be_visible()
        assert page.evaluate('__game.getState().probeLog[0].windows.length') == 4

        # Reach the actual scheduled boundary through the cockpit's real wait control.
        first = page.evaluate("""() => {
            const at = __game.getState().probe.windows[0].start;
            __clock.t = at - 20; __clock.emit(); return at;
        }""")
        schedule.get_by_role('button', name='Wait to next window').click()
        page.wait_for_function('at => __clock.t === at && __clock.paused', arg=first)
        expect(schedule.get_by_text('1 received', exact=True)).to_be_visible()
        expect(chart).to_be_visible()
        assert page.get_by_text('3 · Radar altimeter', exact=True).count() == 0

        # Time and telemetry advance while the Probe Bay is unmounted.
        page.evaluate("__game.getState().go('hub')")
        page.evaluate(seek, -37)
        page.evaluate("__game.getState().go('probe')")
        expected = page.evaluate("""async () => {
            const { receivedProbeSamples } = await import('/src/game/probeListening.ts');
            const { currentWorld } = await import('/src/game/sim.ts');
            const samples = receivedProbeSamples(currentWorld().system, __game.getState().probe, __clock.t);
            return [samples.length, samples.filter(s => [-42, -40, -38].includes(s.hours)).length];
        }""")
        assert expected[1] == 3
        expect(schedule.get_by_text(f'{expected[0]} received', exact=True)).to_be_visible()
        schedule.get_by_text('Listening windows (4)', exact=True).click()
        expect(schedule.get_by_role('button', name=re.compile('^Remove Manual window'))).to_have_count(0)

        page.evaluate(seek, -1)
        assert page.get_by_text('3 · Radar altimeter', exact=True).count() == 0
        page.evaluate(seek, 4)
        expect(page.get_by_text('3 · Radar altimeter', exact=True)).to_be_visible()
        page.screenshot(path=str(out / f'receiver-{width}.png'))
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        original = page.evaluate('__game.getState().probe')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game?.getState().probe)')
        page.evaluate('__clock.paused = true; __clock.emit()')
        expect(chart).to_be_visible()
        assert page.evaluate('__game.getState().probe') == original

        page.get_by_role('button', name='Launch probe', exact=True).click()
        page.get_by_label('Flight record').select_option(index=1)
        expect(chart).to_be_visible()
        assert page.evaluate('__game.getState().probeLog[0].windows.length') == 4

        page.evaluate("""async () => {
            const { currentWorld } = await import('/src/game/sim.ts');
            const { launchProbe } = await import('/src/game/probeState.ts');
            const state = __game.getState();
            const {system} = currentWorld();
            const patch = launchProbe(system, state, .8 * system.target.radius, __clock.t);
            __game.setState(patch);
            __clock.t = patch.probe.arriveAt + 1;
            __clock.emit();
        }""")
        page.get_by_label('Flight record').select_option('current')
        expect(schedule.get_by_text(re.compile('Signal lost at the planned encounter'))).to_be_visible()
        expect(chart).to_be_visible()
        assert page.get_by_text('3 · Radar altimeter', exact=True).count() == 0
        assert not errors, errors
        print(f'{width}×{height}: native launch, scheduled wait, manual windows, received samples, record reload and signal loss passed', flush=True)
        page.close()
    browser.close()
