"""Exercise the clock menu, wait, cancellation, and the answer boundary."""
from pathlib import Path
import re
import shutil
from playwright.sync_api import expect, sync_playwright

OUTPUT = Path('/tmp/stranded-events')
OUTPUT.mkdir(exist_ok=True)
SETUP = """async()=>{
  const {ECHO}=await import('/src/game/echo.ts');
  __game.getState().newGame(316,{difficulty:'legend',sound:false,survival:false,formulas:false});
  __clock.paused=true;__clock.emit();
  __game.setState({phase:'play',screen:'hub',storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5],
    predictions:[{id:'private-event',kind:'moon',made:0,due:14400,value:999,sigma:.2}]});
}"""
SCHEDULE = """()=>{
  const s=__game.getState();
  __game.setState({
    rover:{dist:0,target:500000,departAt:0,arriveAt:21600},
    surface:{...s.surface,iceLoads:1,task:{kind:'process',start:0,done:10800}},
    roverOuting:{start:25000,end:26000,at:25200,localHour:22,distance:500000,
      lowerAltitude:.5,margin:.02,observations:3,observedFrom:1,observedTo:30}
  });
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(320, 740), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:5179/', wait_until='networkidle')
        page.evaluate(SETUP)
        clock_button = page.get_by_role('button', name='Next event', exact=True)
        clock_button.focus()
        clock_button.press('Enter')
        menu = page.get_by_role('region', name='Scheduled events', exact=True)
        expect(menu).to_contain_text('Nothing scheduled')
        assert page.evaluate('__clock.paused && __clock.t===0')
        page.evaluate(SCHEDULE)
        schedules = menu.get_by_role('group', name='Upcoming schedules')
        choices = schedules.get_by_role('button')
        expect(choices).to_have_count(3)
        expect(choices.nth(0)).to_contain_text('Ice processing complete')
        expect(choices.nth(1)).to_contain_text('Camera rover arrival')
        expect(choices.nth(2)).to_contain_text('Your track estimate')
        assert 'moon' not in menu.inner_text().lower() and '999' not in menu.inner_text()
        assert menu.get_by_role('button', name='Wait and pause').count() == 0
        choices.nth(0).click()
        expect(menu).to_contain_text('Wait 3 h and pause on day 1.')
        page.evaluate('__clock.stopAt=1000;__clock.emit()')
        page.wait_for_timeout(250)
        wait = menu.get_by_role('button', name='Wait and pause', exact=True)
        expect(wait).to_be_disabled()
        page.evaluate('__clock.stopAt=Infinity;__clock.emit()')
        expect(wait).to_be_enabled()
        if width == 1440:
            menu.screenshot(path=str(OUTPUT/'event-menu.png'))
        wait.click()
        expect(menu.get_by_label('Scheduled wait')).to_contain_text('Ice processing complete')
        page.wait_for_function('__clock.t===10800 && __clock.paused && !__game.getState().surface.task')
        expect(menu.get_by_label('Scheduled wait')).to_have_count(0)
        assert page.evaluate('__game.getState().surface.iceLoads===0 && !__game.getState().predictions[0].result')
        expect(choices).to_have_count(2)
        choices.nth(0).click()
        wait.click()
        menu.get_by_role('button', name='Cancel wait', exact=True).click()
        assert page.evaluate('__clock.paused && __clock.stopAt===Infinity && __clock.t<21600')
        page.evaluate("""async()=>{const {currentWorld}=await import('/src/game/sim.ts');
          __game.setState({roverOuting:{...__game.getState().roverOuting,at:currentWorld().system.lifeSupport+86400}})}""")
        schedules.get_by_role('button', name=re.compile('^Saved camera outing')).click()
        expect(menu).to_contain_text('beyond the current supplies deadline')
        expect(wait).to_be_disabled()
        page.keyboard.press('Escape')
        expect(menu).to_have_count(0)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors, errors
        print(f'{width}×{height}: public-only schedules, wait preview, real completion, cancellation and supplied deadline passed', flush=True)
        page.close()
