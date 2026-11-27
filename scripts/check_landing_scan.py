"""Exercise the opening scan and land away from the selected waypoint."""
from pathlib import Path
import re
import shutil
import sys

from playwright.sync_api import expect, sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
artifacts = Path('/tmp/stranded-landing-scan')
artifacts.mkdir(exist_ok=True)


def clear_hit(locator):
    assert locator.evaluate("""button => {
        const {x, y, width, height} = button.getBoundingClientRect();
        const hit = document.elementFromPoint(x + width / 2, y + height / 2);
        return hit === button || button.contains(hit);
    }""")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which('chromium'))
    for width, height, mode in [(390, 844, 'Cadet'), (1440, 900, 'Stargazer'), (844, 390, 'Navigator')]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True, reduced_motion='reduce')
        page.set_default_timeout(10000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url, wait_until='domcontentloaded')
        page.get_by_role('button', name='Single expedition', exact=True).click()
        page.get_by_role('radio', name=mode, exact=True).click()
        page.get_by_placeholder('random').fill('316')
        page.get_by_role('button', name='Launch expedition', exact=True).click()
        opener = page.get_by_role('button', name='Scan landing terrain')
        expect(page.get_by_text('Attitude thrusters restarting', exact=True)).to_be_visible()
        opener.click()
        scan = page.get_by_role('region', name='Landing scan')
        expect(scan).to_be_focused()
        expect(scan.get_by_role('button', name=re.compile('Ice basin'))).to_be_visible()
        expect(scan.get_by_role('button', name=re.compile('Flat plain'))).to_be_visible()
        assert scan.get_by_role('button', name=re.compile('Highlands')).count() == int(mode != 'Navigator')
        page.screenshot(path=str(artifacts / f'scan-{width}.png'))

        # Reading the scan does not stop flight recovery.
        page.evaluate("__prologue.sim.current.stageT = 8.96")
        page.wait_for_function("__prologue.sim.current.stage === 'stabilize'")
        clear_hit(page.get_by_role('button', name='Rotate left', exact=True))
        ice = scan.get_by_role('button', name=re.compile('Ice basin'))
        ice.click()
        waypoint = page.locator('[aria-label="Landing waypoint"]')
        expect(waypoint).to_contain_text('Ice basin')
        expect(waypoint).to_contain_text('Left')
        expect(opener).to_be_focused()
        opener.click()
        scan.get_by_role('button', name='Clear waypoint').click()
        expect(waypoint).to_have_count(0)
        opener.click()
        ice.click()

        # Begin the normal descent and land manually on the plain instead.
        page.evaluate("__prologue.sim.current.spin = 0; __prologue.sim.current.calm = 0.81")
        page.wait_for_function("__prologue.sim.current.stage === 'deorbit'")
        page.evaluate("__prologue.sim.current.ang = -Math.PI / 2; __prologue.sim.current.burn = 0.995")
        page.get_by_role('region', name='Landing flight').focus()
        page.keyboard.down('w')
        page.wait_for_function("__prologue.sim.current.stage === 'entry'")
        page.keyboard.up('w')
        expected = page.evaluate("""async () => {
            const { campDistances } = await import('/src/game/surface.ts');
            const {sim, terrain} = __prologue;
            const plain = terrain.features.find(f => f.kind === 'flat');
            const x = (plain.x0 + plain.x1) / 2;
            Object.assign(sim.current.d, {x, y: terrain.height(x) + 20, vx: 0, vy: -2});
            sim.current.alt = 11001;
            return { x, ...campDistances(terrain, x) };
        }""")
        page.wait_for_function("__prologue.sim.current.stage === 'descent'")
        expect(waypoint).to_contain_text('Ice basin')
        expect(waypoint).to_contain_text('Left')
        page.screenshot(path=str(artifacts / f'waypoint-{width}.png'))
        page.evaluate("""() => {
            const {sim, terrain} = __prologue;
            Object.assign(sim.current.d, { y: terrain.height(sim.current.d.x) + 0.01, vy: -2 });
        }""")
        expect(page.get_by_role('heading', name='A clean landing')).to_be_visible()
        expect(page.get_by_text('A flat plain. Easy ground for the camp and the rover.', exact=True)).to_be_visible()
        distances = page.locator('[aria-label="Camp distances"]')
        expect(distances).to_contain_text(f"{expected['iceKm']:.1f} km")
        expect(distances).to_contain_text(f"{expected['hillKm']:.1f} km")
        page.screenshot(path=str(artifacts / f'touchdown-{width}.png'))
        page.get_by_role('button', name='Continue', exact=True).click()
        page.wait_for_function("__game.getState().camp?.site === 'flat'")
        assert page.evaluate("""expected => {
            const camp = __game.getState().camp;
            return camp.x === expected.x && camp.iceKm === expected.iceKm && camp.hillKm === expected.hillKm;
        }""", expected)
        assert not errors, errors
        print(f'{mode} {width}×{height}: scan, free steering, waypoint and actual camp passed', flush=True)
        page.close()
    browser.close()
