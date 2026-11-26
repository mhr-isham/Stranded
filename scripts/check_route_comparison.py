"""Verify same-departure route choices and their shared planner displays."""
from pathlib import Path
import re
import shutil
from playwright.sync_api import expect, sync_playwright

OUTPUT = Path('/tmp/stranded-route-comparison')
OUTPUT.mkdir(exist_ok=True)
SETUP = """async()=>{
  const {ECHO}=await import('/src/game/echo.ts');
  const {currentWorld}=await import('/src/game/sim.ts');
  const {keysFor,truthValues}=await import('/src/engine/chain.ts');
  __game.getState().newGame(316,{difficulty:'navigator',sound:false,formulas:true,survival:false});
  const values=truthValues(currentWorld().system);
  const sheet=Object.fromEntries(keysFor('standard').map(key=>[key,{value:values[key],sigma:Math.abs(values[key])*.002}]));
  __clock.paused=true;__clock.emit();
  __game.setState({phase:'play',screen:'launch',sheet,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5]});
}"""

def value(card, label):
    return card.locator('dt').filter(has_text=re.compile(f'^{label}$')).locator('xpath=following-sibling::dd[1]')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:5177/', wait_until='networkidle')
        page.evaluate(SETUP)
        compare = page.get_by_role('region', name='Compare routes', exact=True)
        saver = compare.get_by_role('region', name='Fuel-saver route', exact=True)
        fast = compare.get_by_role('region', name='Fast route', exact=True)
        fuel = page.locator('[data-tut="launch-fuel"]')
        outcomes = page.get_by_label('Simulated transfer outcomes', exact=True)
        saver_button = saver.get_by_role('button', name='Fuel-saver', exact=True)
        fast_button = fast.get_by_role('button', name='Fast', exact=True)

        expect(saver_button).to_have_attribute('aria-pressed', 'true')
        expect(value(saver, 'Captures within budget')).to_contain_text('of 36')
        expect(value(fast, 'Captures within budget')).to_contain_text('of 36')
        departure = compare.get_by_text(re.compile('^Same departure')).inner_text()
        days = lambda card: float(value(card, 'Flight time').inner_text().split()[0].replace(',', ''))
        assert abs(days(fast) - .75 * days(saver)) < .15
        remaining = lambda card: float(card.get_by_text(re.compile(r'^At arrival')).inner_text().split(' · ')[1].split()[0].replace(',', ''))
        assert abs((remaining(fast) - remaining(saver)) - (days(saver) - days(fast))) <= .2
        saver_total = value(fuel, 'Total planned').inner_text()
        expect(outcomes).to_contain_text(value(saver, 'Captures within budget').inner_text() + ' succeeded')
        cards = compare.locator('.route-comparison')
        cards.evaluate("""element => {
            const panel = element.closest('.tool-side');
            panel.scrollTop += element.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12;
        }""")
        card_bounds = cards.bounding_box()
        assert card_bounds['y'] + card_bounds['height'] < page.locator('nav.nav').bounding_box()['y']
        cards.screenshot(path=str(OUTPUT/f'routes-{width}.png'))
        assert saver.bounding_box()['x'] < fast.bounding_box()['x']

        overlay = page.get_by_role('group', name='Trajectory display', exact=True)
        overlay.get_by_role('button', name='Show possible paths', exact=True).click()
        expect(overlay.get_by_role('status')).to_contain_text('from 36 trials')
        fast_button.focus()
        fast_button.press('Enter')
        expect(fast_button).to_have_attribute('aria-pressed', 'true')
        expect(saver_button).to_have_attribute('aria-pressed', 'false')
        expect(compare.get_by_text(departure, exact=True)).to_be_visible()
        expect(outcomes).to_contain_text(value(fast, 'Captures within budget').inner_text() + ' succeeded')
        expect(overlay.get_by_role('status')).to_contain_text('from 36 trials')
        assert value(fuel, 'Total planned').inner_text() != saver_total
        assert page.get_by_role('slider', name='Custom flight time').count() == 0

        custom = compare.get_by_role('button', name='Custom', exact=True)
        custom.click()
        expect(custom).to_have_attribute('aria-pressed', 'true')
        slider = page.get_by_role('slider', name='Custom flight time', exact=True)
        slider.press('Home')
        expect(outcomes).to_contain_text('of 36 succeeded')
        expect(compare.get_by_text(departure, exact=True)).to_be_visible()
        expect(value(saver, 'Captures within budget')).to_contain_text('of 36')

        page.locator('[data-tut="launch-porkchop"] canvas').click(position={'x': 40, 'y': 60})
        expect(custom).to_have_attribute('aria-pressed', 'true')
        expect(compare.get_by_text(re.compile('^Same departure'))).not_to_have_text(departure)
        expect(value(fast, 'Captures within budget')).to_contain_text('of 36')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors, errors
        print(f'{width}×{height}: comparison, keyboard route choice, forecast and overlay sync, Custom and cost map passed', flush=True)
        page.close()
