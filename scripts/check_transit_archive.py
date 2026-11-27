"""Exercise the real Kepler archive on desktop and compact layouts."""
import re
import shutil
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

URL = 'http://127.0.0.1:5183/'
OUT = Path('/tmp/stranded-transit-archive-qa')
OUT.mkdir(exist_ok=True)


def point(dialog, day):
    # Use the real chart interaction, mapping the known test day to its full survey plot.
    canvas = dialog.get_by_role('img', name='Kepler survey brightness')
    canvas.scroll_into_view_if_needed()
    bounds = canvas.bounding_box()
    cursor = dialog.get_by_role('slider', name=re.compile('Cursor'))
    start, end = cursor.evaluate('e => [Number(e.min), Number(e.max)]')
    x = 52 + (bounds['width'] - 63) * (day - start) / (end - start)
    canvas.click(position={'x': x, 'y': 60})
    actual = cursor.evaluate('e => Number(e.value)')
    assert abs(actual - day) < .05
    # Refine to the same estimate across viewports with the keyboard control.
    for _ in range(5):
        if abs(actual - day) <= .005:
            break
        cursor.press('ArrowLeft' if actual > day else 'ArrowRight')
        actual = cursor.evaluate('e => Number(e.value)')


def open_archive(page):
    page.get_by_role('button', name=re.compile(r'(Open Transit Archive|Transit Archive · discovery logged)')).click()
    dialog = page.get_by_role('dialog', name='Follow the shadow')
    expect(dialog).to_be_visible()
    return dialog


def discover(page, width, height):
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.goto(URL, wait_until='domcontentloaded')
    dialog = open_archive(page)
    expect(dialog.get_by_role('heading', name='Follow the shadow')).to_be_focused()
    expect(dialog.get_by_text('HAT-P-7 b', exact=True)).to_have_count(0)
    expect(dialog.get_by_role('img', name='Kepler follow-up brightness')).to_have_count(0)
    page.screenshot(path=str(OUT / f'survey-{width}.png'))

    point(dialog, 1.42)
    dialog.get_by_role('button', name='Mark first dip').click()
    expect(dialog.get_by_text('This mark misses', exact=False)).to_be_visible()
    point(dialog, .89 if width == 1440 else .83)
    cursor = dialog.get_by_role('slider', name=re.compile('Cursor'))
    before = cursor.evaluate('e=>Number(e.value)')
    cursor.press('ArrowLeft')
    assert abs(cursor.evaluate('e=>Number(e.value)') - before + .01) < .001
    cursor.press('ArrowRight')
    zoom = dialog.get_by_role('button', name='Zoom near cursor')
    zoom.click()
    expect(dialog.get_by_role('button', name='Full survey')).to_be_visible()
    dialog.get_by_role('button', name='Full survey').click()
    dialog.get_by_role('button', name='Mark first dip').click()
    expect(dialog.get_by_role('heading', name='Find the next dip')).to_be_visible()
    if width == 390:
        page.keyboard.press('Escape')
        expect(dialog).to_have_count(0)
        expect(page.get_by_role('button', name='Open Transit Archive')).to_be_focused()
        page.reload(wait_until='domcontentloaded')
        dialog = open_archive(page)
        expect(dialog.get_by_role('heading', name='Find the next dip')).to_be_visible()

    point(dialog, 2.97 if width == 1440 else 3.03)
    dialog.get_by_role('button', name='Mark next dip').click()
    dialog.get_by_role('button', name='Observe at the predicted time').click()
    if width == 1440:
        expect(dialog.get_by_role('heading', name='No matching dip in this window')).to_be_visible()
        expect(dialog.get_by_text('HAT-P-7 b', exact=True)).to_have_count(0)
        dialog.get_by_role('button', name='Adjust your marks').click()
        expect(dialog.get_by_role('heading', name='Find the next dip')).to_be_visible()
        point(dialog, 3.03)
        dialog.get_by_role('button', name='Mark next dip').click()
        dialog.get_by_role('button', name='Observe at the predicted time').click()
    expect(dialog.get_by_role('heading', name='HAT-P-7 b', exact=True)).to_be_visible()
    expect(dialog.get_by_role('img', name='Kepler follow-up brightness')).to_be_visible()
    page.screenshot(path=str(OUT / f'discovery-{width}.png'))
    dialog.get_by_text('Data and method', exact=True).click()
    expect(dialog.get_by_role('link', name='NASA Exoplanet Archive')).to_have_attribute('href', re.compile('/HAT-P-7$'))
    dialog.get_by_role('button', name='Close archive').click()
    expect(page.get_by_text('Transit Archive · discovery logged', exact=True)).to_be_visible()
    page.reload(wait_until='domcontentloaded')
    dialog = open_archive(page)
    expect(dialog.get_by_role('heading', name='HAT-P-7 b', exact=True)).to_be_visible()
    assert dialog.evaluate('e=>e.scrollWidth <= e.clientWidth+1')
    if width == 1440:
        dialog.get_by_role('button', name='Replay the observation').click()
        expect(dialog.get_by_role('heading', name='Find the first dip')).to_be_visible()
        dialog.get_by_role('button', name='Close archive').click()
        expect(page.get_by_text('Transit Archive · discovery logged', exact=True)).to_be_visible()
    assert not errors, errors
    print(f'{width}×{height}: interactive marks, forecast, planet reveal and reload verified', flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'))
    for width, height in [(390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width':width, 'height':height}, reduced_motion='reduce')
        discover(page, width, height)
        page.close()

    page = browser.new_page(viewport={'width':390, 'height':844})
    page.goto(URL, wait_until='domcontentloaded')
    page.wait_for_function('Boolean(window.__game && window.__clock)')
    page.evaluate("""() => {
      __game.getState().newGame(316,{difficulty:'navigator',sound:false,formulas:true,survival:false});
      __clock.paused=false;
      __game.setState({phase:'play',screen:'observatory',actsSeen:[1,2,3,4,5],storyQueue:[],echo:[]});
    }""")
    dialog = open_archive(page)
    assert page.evaluate('__clock.paused')
    frozen = page.evaluate('__clock.t')
    page.wait_for_timeout(250)
    assert page.evaluate('__clock.t') == frozen
    dialog.get_by_role('button', name='Close archive').click()
    page.wait_for_function('__clock.t > ' + str(frozen))
    print('Observatory archive preserves and restores the expedition clock', flush=True)
