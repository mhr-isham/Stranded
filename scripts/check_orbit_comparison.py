"""Exercise the optional Chapter 4 comparison with a generated tracker record."""
from pathlib import Path
import re
import shutil
import sys

from playwright.sync_api import expect, sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
out = Path('/tmp/stranded-orbit-comparison')
out.mkdir(exist_ok=True)
fixture = """async (difficulty) => {
    const {DAY} = await import('/src/engine/constants.ts');
    const {targetLongitude} = await import('/src/engine/measure.ts');
    const {oppositions} = await import('/src/engine/ephemeris.ts');
    const {currentWorld} = await import('/src/game/sim.ts');
    const {ECHO} = await import('/src/game/echo.ts');
    __game.getState().newGame(5, {difficulty, sound: false, survival: false, formulas: difficulty !== 'legend'}, 4);
    const {system} = currentWorld(), opposition = oppositions(system, 0, system.lifeSupport)[1];
    const track = [];
    for (let d = 3; d < opposition / DAY + 20; d += 4) {
        track.push({at: d * DAY, v: targetLongitude(system, d * DAY, system.site)});
    }
    __clock.t = track.at(-1).at;
    __clock.paused = true;
    __game.setState({phase: 'play', screen: 'observatory', track, identified: true, oppPicks: [opposition], echo: [],
        seenEcho: Object.values(ECHO).map(line => line.id), storyQueue: [], actsSeen: [1, 2, 3, 4, 5],
        sheet: {P1: {value: system.home.period, sigma: 100}, tOpp: {value: opposition, sigma: 100}}});
    __clock.emit();
    return track.length;
}"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which('chromium'))
    for width, height, mode in [(390, 844, 'cadet'), (1440, 900, 'navigator'), (844, 390, 'legend')]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True)
        page.set_default_timeout(16000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game && window.__clock)')
        count = page.evaluate(fixture, mode)
        page.get_by_role('button', name='Orbit', exact=True).click()
        panel = page.get_by_role('region', name='Orbit fit')
        panel.get_by_role('button', name='Fit the orbit', exact=True).click()
        base_plot = panel.get_by_role('img', name='Fitted orbit, top-down')
        comparison = panel.locator('#orbit-comparison')
        toggle = panel.get_by_role('button', name='Compare circle and ellipse', exact=True)
        expect(base_plot).to_be_visible()
        expect(toggle).to_have_attribute('aria-expanded', 'false')
        expect(comparison).to_have_count(0)
        assert panel.get_by_role('button', name='Send to progress sheet').count() == 3
        page.screenshot(path=str(out / f'fit-{width}.png'))

        toggle.click()
        overlay = panel.get_by_role('img', name='Fitted circle and ellipse in one orbital frame')
        expect(overlay).to_be_visible()
        expect(comparison.get_by_text(f'{count} fitted sightings')).to_be_visible()
        expect(comparison.get_by_role('img', name='Signed longitude errors by night for the circle and ellipse')).to_be_visible()
        slider = comparison.get_by_role('slider', name='Inspect an orbit sighting by night')
        values = comparison.locator('.orbit-error-values')
        initial = values.inner_text()
        slider.press('ArrowRight')
        expect(slider).to_have_attribute('aria-valuetext', 'Day 8.00')
        assert values.inner_text() != initial
        assert page.evaluate('Object.keys(__game.getState().sheet).length') == 2
        comparison.scroll_into_view_if_needed()
        page.screenshot(path=str(out / f'comparison-{width}.png'))

        # The original comparison persists until the player requests a refit.
        page.evaluate("""() => {
            const s = __game.getState(), last = s.track.at(-1);
            __game.setState({track: [...s.track, {at: last.at + 86400, v: last.v + 0.01}]});
        }""")
        expect(panel.get_by_text(re.compile('^This fit uses an earlier snapshot'))).to_be_visible()
        expect(comparison.get_by_text(f'{count} fitted sightings')).to_be_visible()
        panel.get_by_role('button', name='Refit the orbit', exact=True).click()
        expect(toggle).to_have_attribute('aria-expanded', 'false')
        expect(panel.get_by_text(re.compile('^This fit uses an earlier snapshot'))).to_have_count(0)
        toggle.click()
        expect(comparison.get_by_text(f'{count + 1} fitted sightings')).to_be_visible()
        panel.get_by_role('button', name='Close model comparison', exact=True).click()
        expect(base_plot).to_be_visible()
        expect(overlay).to_have_count(0)

        fields = panel.get_by_role('textbox')
        assert fields.count() == 3
        for field in fields.all():
            field.fill('0.1')
        for _ in range(3):
            panel.get_by_role('button', name='Send to progress sheet', exact=True).first.click()
        assert page.evaluate("""() => {
            const s = __game.getState();
            return [s.sheet.Porb, s.sheet.ecc, s.sheet.wPeri].every(value => value && value.sigma > 0);
        }""")
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.locator('[data-tut="obs-tab-sky"]').click()
        expect(page.get_by_role('img', name=re.compile('^Wide sky'))).to_be_visible()
        assert not errors, errors
        print(f'{width}×{height} {mode}: optional overlay, signed comparison, selectable nights, snapshot/refit, and native worksheet sends passed', flush=True)
        page.close()
    browser.close()
