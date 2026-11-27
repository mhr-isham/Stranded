"""Check the Surface Map itinerary and shadow instrument on the same rover trip."""
from pathlib import Path
import re
import shutil
import sys

from playwright.sync_api import expect, sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
out = Path('/tmp/stranded-north-survey')
out.mkdir(exist_ok=True)
fixture = """async () => {
    const { ECHO } = await import('/src/game/echo.ts');
    __game.getState().newGame(316, { difficulty: 'navigator', sound: false, survival: false, formulas: true }, 3);
    __clock.t = 21_600; __clock.paused = true;
    __game.setState({ phase: 'play', screen: 'gnomon', echo: [], storyQueue: [],
        actsSeen: [1, 2, 3, 4, 5], seenEcho: Object.values(ECHO).map(line => line.id) });
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
        lab = page.get_by_role('main', name='Two-site shadow expedition')
        itinerary = page.get_by_role('region', name='North survey itinerary')
        slider = lab.get_by_role('slider', name='Northward rover distance in kilometres')
        slider.press('ArrowRight')
        expect(slider).to_have_value('850')
        lab.get_by_role('button', name='Open north survey map').click()
        expect(itinerary.get_by_text('Camp to north station · 850.0 km')).to_be_visible()
        expect(itinerary.get_by_text('Rover at camp')).to_be_visible()
        noon = itinerary.locator('dt').filter(has_text=re.compile('^Next .* noon'))
        expect(noon).to_have_count(2)
        assert noon.nth(0).locator('xpath=following-sibling::dd[1]').inner_text() == noon.nth(1).locator('xpath=following-sibling::dd[1]').inner_text()
        itinerary.get_by_role('button', name='Open shadow instrument').click()
        expect(slider).to_have_value('850')
        lab.get_by_role('button', name='Drive north').click()

        # Advance the simulated clock to mid-trip to exercise both map layers.
        trip = page.evaluate("""() => {
            const trip = __game.getState().northTrip;
            __clock.t = (trip.departAt + trip.arriveAt) / 2; __clock.emit();
            return trip;
        }""")
        expect(lab.get_by_role('progressbar', name='Northward rover travel progress')).to_have_attribute('value', '0.5')
        lab.get_by_role('button', name='Open north survey map').click()
        expect(itinerary.get_by_text('425.0 km north', exact=True)).to_be_visible()
        expect(itinerary.get_by_text('Rover underway')).to_be_visible()
        expect(itinerary.get_by_role('progressbar')).to_have_attribute('value', '0.5')
        expect(page.get_by_role('img', name=re.compile('Camp to north station'))).to_be_visible()
        page.screenshot(path=str(out / f'underway-{width}.png'))
        page.get_by_role('button', name='Camp strip', exact=True).click()
        expect(page.get_by_text('on the north survey', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name=re.compile('Take the rover for a drive'))).to_be_disabled()
        page.get_by_role('button', name='North survey', exact=True).click()
        expect(itinerary.get_by_text('425.0 km north', exact=True)).to_be_visible()
        assert page.evaluate('__game.getState().northTrip') == trip
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function("window.__game?.getState().screen === 'map'")
        page.evaluate('__clock.paused = true; __clock.emit()')
        expect(itinerary).to_be_visible()
        itinerary.get_by_role('button', name='Open shadow instrument').click()
        page.evaluate('__clock.t = __game.getState().northTrip.arriveAt - 20; __clock.emit()')
        lab.get_by_role('button', name='Wait for rover', exact=True).click()
        page.wait_for_function('__clock.paused && __clock.t === __game.getState().northTrip.arriveAt')
        lab.get_by_role('button', name='Open north survey map').click()
        expect(itinerary.get_by_text('Rover on station')).to_be_visible()
        expect(itinerary.get_by_text('850.0 km north', exact=True)).to_be_visible()
        itinerary.get_by_role('button', name='Open shadow instrument').click()
        lab.get_by_role('button', name='Return rover').click()
        lab.get_by_role('button', name='Open north survey map').click()
        expect(itinerary.get_by_text('Returning to camp')).to_be_visible()
        page.evaluate('__clock.t = __game.getState().northTrip.arriveAt; __clock.emit()')
        expect(itinerary.get_by_text('Rover at camp')).to_be_visible()
        page.get_by_role('button', name='Camp strip', exact=True).click()
        expect(page.get_by_role('button', name=re.compile('Take the rover for a drive'))).to_be_enabled()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        assert not errors, errors
        print(f'{width}×{height}: shared plan, noon, travel, reload and rover control passed', flush=True)
        page.close()
    browser.close()
