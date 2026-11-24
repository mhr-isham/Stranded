"""Use the expedition tracker, route controls and cameras for a saved outing."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright, expect

OUTPUT = Path('/tmp/stranded-rover-outing')
OUTPUT.mkdir(exist_ok=True)
SETUP = """async()=>{
  const {ECHO}=await import('/src/game/echo.ts');
  const {currentWorld}=await import('/src/game/sim.ts');
  const game=__game.getState();
  game.newGame(316,{difficulty:'navigator',sound:false,survival:false,formulas:true});
  const {system,solarDay}=currentWorld();
  __clock.t=system.firstOpposition-5*solarDay;
  __clock.paused=true;
  __clock.emit();
  __game.setState({phase:'play',screen:'observatory',identified:true,storyQueue:[],echo:[],
    seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});
  return solarDay;
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width':width,'height':height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:5173/', wait_until='networkidle')
        day = page.evaluate(SETUP)
        page.get_by_role('button', name='Tracker', exact=True).click()
        planner = page.locator('details.outing-planner')
        expect(planner).not_to_have_attribute('open', '')
        planner.locator('summary').first.click()
        search = planner.get_by_role('button', name='Find camera windows', exact=True)
        search.click()
        expect(planner.get_by_role('status')).to_contain_text('three recent sights')
        page.get_by_role('button', name='Turn on nightly auto-log', exact=True).click()
        page.evaluate('(day)=>{__ff(__clock.t+4*day);__clock.paused=true;__clock.emit()}',day)
        assert page.evaluate('__game.getState().track.length>=3')
        # An exact day and numeric site can be entered without chart gestures.
        day_field = planner.get_by_label('Expedition day (optional)', exact=True)
        day_field.fill('1')
        search.click()
        expect(planner.get_by_role('status')).to_contain_text('today or a later expedition day')
        day_field.fill('')
        search.click()
        choices = planner.get_by_role('button', name='Save this outing', exact=True)
        choices.first.wait_for()
        assert 1 <= choices.count() <= 3
        assert page.evaluate('__game.getState().roverOuting===null')
        choices.first.locator('..').screenshot(path=str(OUTPUT/f'window-{width}.png'))
        choices.first.click()
        saved = page.evaluate('__game.getState().roverOuting')
        assert saved['distance'] == 500000 and 'capturedAt' not in saved
        planner.get_by_role('button', name='Open rover camera', exact=True).click()
        outing = page.get_by_role('region', name='Saved rover outing', exact=True)
        expect(outing).to_contain_text('Saved camera outing')
        outing.get_by_role('button', name='Set planned site', exact=True).click()
        expect(page.get_by_role('slider', name='Rover route distance in kilometres')).to_have_value('500')
        page.get_by_role('button', name='Drive', exact=True).click()
        page.reload(wait_until='networkidle')
        assert page.evaluate('__game.getState().roverOuting') == saved
        assert page.evaluate('__game.getState().parallaxPair===null')
        outing.get_by_role('button', name='Wait to planned time', exact=True).click()
        page.wait_for_function('(at)=>__clock.paused && __clock.t===at', arg=saved['at'], timeout=45000)
        expect(outing).to_contain_text('Planned camera window')
        assert page.evaluate('__game.getState().rover.dist===500000 && __game.getState().parallaxPair===null')
        page.get_by_role('button', name='Take simultaneous images', exact=True).click()
        expect(outing).to_contain_text('Outing captured')
        assert page.evaluate('''()=>{const s=__game.getState();return s.parallaxPair.at===s.roverOuting.capturedAt && s.parallaxPair.roverDistance===s.roverOuting.distance}''')
        assert page.evaluate('__game.getState().predictions.length===0 && !__game.getState().sheet.dPar')
        outing.screenshot(path=str(OUTPUT/f'captured-{width}.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors, errors
        print(f'{width}×{height}: tracker → forecast → saved route → real arrival → paired image',flush=True)
        page.close()
