"""Check the timeline's source labels and tool links in the live UI."""
from pathlib import Path
import shutil
from playwright.sync_api import expect, sync_playwright

OUTPUT = Path('/tmp/stranded-timeline')
OUTPUT.mkdir(exist_ok=True)
SETUP = """async()=>{
  const {ECHO}=await import('/src/game/echo.ts');
  const {currentWorld}=await import('/src/game/sim.ts');
  const {keysFor,truthValues}=await import('/src/engine/chain.ts');
  __game.getState().newGame(316,{difficulty:'navigator',sound:false,survival:false,formulas:true});
  const values=truthValues(currentWorld().system), state=__game.getState(), day=86400;
  const sheet=Object.fromEntries(keysFor('standard').map(key=>[key,{value:values[key],sigma:Math.abs(values[key])*.002}]));
  __clock.paused=true;__clock.emit();
  __game.setState({phase:'play',screen:'hub',sheet,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5],
    rover:{dist:0,target:500000,departAt:0,arriveAt:4*day},
    surface:{...state.surface,task:{kind:'process',start:0,done:day}},
    roverOuting:{start:2.9*day,end:3.1*day,at:3*day,localHour:22,distance:500000,lowerAltitude:.5,margin:.02,observations:3,observedFrom:1,observedTo:30},
    predictions:[{id:'private',kind:'moon',made:0,due:2*day,value:999,sigma:.2}]});
}"""
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(320, 740), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:5180/', wait_until='networkidle')
        page.evaluate(SETUP)
        page.get_by_role('button',name='Next event',exact=True).click()
        menu = page.get_by_role('region', name='Scheduled events', exact=True)
        expect(menu.get_by_role('heading',name='Next event',exact=True)).to_be_visible()
        menu.get_by_role('button',name='View timeline',exact=True).press('Enter')
        expect(menu.get_by_role('heading',name='Expedition timeline',exact=True)).to_be_visible()
        expect(menu).to_contain_text('A rover trip or job already underway')
        expect(menu).to_contain_text('Check conditions when you arrive')
        expect(menu).to_contain_text('It can shift as your measurements change')
        entries = menu.get_by_role('listitem')
        expect(entries).to_have_count(4)
        for i, text in enumerate(['Ice processing complete', 'Saved camera outing', 'Camera rover arrival', 'Launch window']):
            expect(entries.nth(i)).to_contain_text(text)
        expect(entries.nth(1)).to_contain_text('The rover is scheduled to be busy')
        assert '999' not in menu.inner_text() and 'moon' not in menu.inner_text().lower()
        if width == 320:
            page.locator('.modal').screenshot(path=str(OUTPUT/'timeline-320.png'))
        menu.get_by_role('button',name='Back to next event',exact=True).click()
        expect(menu.get_by_role('group',name='Upcoming schedules').get_by_role('button')).to_have_count(3)
        menu.get_by_role('button',name='View timeline',exact=True).click()
        entries.nth(1).get_by_role('button',name='Open rover camera',exact=True).click()
        expect(menu).to_have_count(0)
        assert page.evaluate("__game.getState().screen==='rover' && __clock.t===0 && __clock.paused")
        page.get_by_role('button',name='Next event',exact=True).click()
        menu.get_by_role('button',name='View timeline',exact=True).click()
        menu.get_by_role('button',name='Open launch planner',exact=True).click()
        expect(page.locator('[data-tut="launch-departure"]')).to_be_visible()
        assert page.evaluate("__game.getState().screen==='launch' && __clock.t===0 && !__game.getState().predictions[0].result")
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors, errors
        print(f'{width}×{height}: source explanations, chronological list, conflict, tool links and prediction boundary passed', flush=True)
        page.close()
