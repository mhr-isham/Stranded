"""Verify the Chapter 7 route choice through confirmation and flight."""
from pathlib import Path
import re
import shutil

from playwright.sync_api import expect, sync_playwright

OUT = Path('/tmp/stranded-slingshot-routes')
OUT.mkdir(exist_ok=True)
SETUP = """async difficulty => {
  const { ECHO } = await import('/src/game/echo.ts');
  const { currentWorld } = await import('/src/game/sim.ts');
  const { keysFor, truthValues } = await import('/src/engine/chain.ts');
  const { bestDirectTransfer, bestSlingshot, modelFromPrimaries, routeWindows } = await import('/src/engine/planner.ts');
  __game.getState().newGame(316, {difficulty, sound: false, survival: false, formulas: true}, 7);
  const system = currentWorld().system;
  const truth = truthValues(system);
  const sheet = Object.fromEntries(keysFor('slingshot').map(key => [key, {
    value: truth[key], sigma: Math.abs(truth[key]) * .0001,
    ...(['dPar', 'thetaMg'].includes(key) ? {at: 0} : {}),
  }]));
  const model = modelFromPrimaries(sheet, 'slingshot');
  const time = routeWindows(model, 0, system.lifeSupport, 1)[0];
  __clock.t = time; __clock.paused = true;
  __game.setState({phase: 'play', screen: 'launch', sheet, savedT: time, storyQueue: [], echo: [],
    seenEcho: Object.values(ECHO).map(line => line.id), actsSeen: [1, 2, 3, 4, 5]});
  __clock.emit();
  return {
    time, budget: system.fuelDv,
    direct: bestDirectTransfer(model, time), flyby: bestSlingshot(model, time),
  };
}"""


def reading(panel, name):
    return panel.locator('dt').filter(has_text=re.compile(f'^{name}$')).locator('xpath=following-sibling::dd[1]')


def compare(page, width, height, difficulty, selected):
    failures = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.goto('http://127.0.0.1:5177/', wait_until='domcontentloaded')
    page.wait_for_function('Boolean(window.__game && window.__clock)')
    model = page.evaluate(SETUP, difficulty)
    page.get_by_role('button', name='Now', exact=True).click()
    routes = page.get_by_role('region', name='Compare routes')
    flyby = routes.get_by_role('region', name='Giant flyby route')
    direct = routes.get_by_role('region', name='Direct route')
    flyby_button = flyby.get_by_role('button', name='Giant flyby', exact=True)
    direct_button = direct.get_by_role('button', name='Direct', exact=True)
    expect(flyby_button).to_have_attribute('aria-pressed', 'true')
    expect(routes.get_by_text('Burn at closest approach', exact=True)).to_be_hidden()

    margin = model['budget'] - model['direct']['total']
    expect(routes.get_by_text(re.compile('^Both routes fit' if margin >= 0 else '^Only the giant flyby fits'))).to_be_visible()
    label = 'Fuel for corrections' if margin >= 0 else 'Over budget by'
    assert abs(float(reading(direct, label).inner_text().split()[0]) - abs(margin) / 1000) < .01
    assert abs(float(reading(flyby, 'Flight time').inner_text().split()[0].replace(',', '')) - model['flyby']['plan']['tof'] / 86400) < .06
    fuel = page.locator('[data-tut="launch-fuel"]')
    expect(reading(fuel, 'Flyby maneuvers')).to_be_visible()
    expect(page.get_by_role('img', name=re.compile('^Giant flyby route'))).to_be_visible()

    routes.get_by_text('Inside the giant encounter', exact=True).click()
    expect(reading(routes, 'Closest to the giant\'s centre')).to_be_visible()
    expect(reading(routes, 'Burn at closest approach')).to_be_visible()
    routes.get_by_text('Inside the giant encounter', exact=True).click()
    expect(reading(routes, 'Closest to the giant\'s centre')).to_be_hidden()
    cards = routes.locator('.route-comparison')
    cards.evaluate("""el => {
      const panel = el.closest('.tool-side');
      panel.scrollTop += el.getBoundingClientRect().top - panel.getBoundingClientRect().top - 30;
    }""")
    assert cards.bounding_box()['x'] >= 0
    assert cards.bounding_box()['x'] + cards.bounding_box()['width'] <= width
    page.screenshot(path=str(OUT / f'compare-{width}.png'))
    direct_button.focus()
    direct_button.press('Enter')
    expect(direct_button).to_have_attribute('aria-pressed', 'true')
    expect(flyby_button).to_have_attribute('aria-pressed', 'false')
    expect(page.get_by_role('img', name='Direct route from home to the blue planet')).to_be_visible()
    expect(reading(fuel, 'Flyby maneuvers')).to_have_count(0)
    expect(page.get_by_label('Simulated transfer outcomes')).to_contain_text('of 36 succeeded')
    if selected != 'direct':
        flyby_button.click()
    page.get_by_role('button', name='Launch now', exact=True).click()
    expect(page.get_by_label('Supplies if you launch now')).to_contain_text('Direct' if selected == 'direct' else 'Giant flyby')
    if height < 500:
        page.get_by_role('button', name=re.compile('Fly the ascent yourself')).click()
        page.wait_for_function("__game.getState().phase === 'ascent'")
        actual = page.evaluate('__game.getState().pendingLaunch.plan')
    else:
        page.get_by_role('button', name=re.compile('Confirm launch')).click()
        page.wait_for_function("__game.getState().phase === 'flight'")
        actual = page.evaluate('__game.getState().outcome.plan')
        assert page.evaluate("__game.getState().outcome.result.outcome") == 'success'
    assert actual == model[selected]['plan']
    assert not failures, failures
    print(f'{width}×{height}, {difficulty}: cards, chart, detail toggle and {selected} launch passed', flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'))
    for width, height, difficulty, selected in [
        (390, 844, 'navigator', 'flyby'),
        (1440, 900, 'stargazer', 'direct'),
        (844, 390, 'stargazer', 'flyby'),
    ]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        compare(page, width, height, difficulty, selected)
        page.close()
