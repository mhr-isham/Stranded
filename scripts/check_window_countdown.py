"""Check the live modeled departure countdown and its planner shortcut."""
from pathlib import Path
import re
import shutil
from playwright.sync_api import expect, sync_playwright

OUTPUT = Path('/tmp/stranded-window-countdown')
OUTPUT.mkdir(exist_ok=True)
SETUP = """async()=>{
  const {ECHO}=await import('/src/game/echo.ts');
  const {currentWorld}=await import('/src/game/sim.ts');
  const {keysFor,truthValues}=await import('/src/engine/chain.ts');
  __game.getState().newGame(316,{difficulty:'navigator',sound:false,survival:true,formulas:true});
  const values=truthValues(currentWorld().system);
  window.validSheet=Object.fromEntries(keysFor('standard').map(key=>[key,{value:values[key],sigma:Math.abs(values[key])*.002}]));
  __clock.paused=true;__clock.emit();
  __game.setState({phase:'play',screen:'hub',storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5]});
}"""
FIRST_WINDOW = """async()=>{
  const {navigationModel}=await import('/src/game/readiness.ts');
  const {predictedWindows}=await import('/src/engine/planner.ts');
  const {currentWorld}=await import('/src/game/sim.ts');
  const {lifeSupportEnd}=await import('/src/game/survival.ts');
  const s=__game.getState(), {system}=currentWorld();
  return predictedWindows(navigationModel(s.sheet,'standard'),__clock.t,lifeSupportEnd(s,system),1)[0];
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(320, 740), (390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:5178/', wait_until='networkidle')
        page.evaluate(SETUP)
        page.get_by_role('button', name='Next event', exact=True).click()
        guide = page.locator('details').filter(has=page.get_by_text('Which clock is this?', exact=True))
        assert guide.get_attribute('open') is None
        guide.locator('summary').click()
        for label in ['Expedition day', 'Local solar time', 'Real seconds']:
            expect(guide.get_by_text(label, exact=True)).to_be_visible()
        page.get_by_role('button', name='Close', exact=True).click()
        assert page.evaluate('__clock.t === 0 && __clock.paused')
        button = page.get_by_role('button', name=re.compile('^Estimated launch window:'))
        expect(button).to_have_count(0)
        page.evaluate('__game.setState({sheet:validSheet})')
        expect(button).to_be_visible()
        assert page.locator('.hud').evaluate("hud=>[...hud.children].map(e=>e.getBoundingClientRect()).every(b=>b.right<=innerWidth+1)")
        page.locator('.hud').screenshot(path=str(OUTPUT/f'countdown-{width}.png'))
        before = button.get_attribute('aria-label')
        first = page.evaluate(FIRST_WINDOW)
        page.evaluate("__game.setState({sheet:{...validSheet,tOpp:{...validSheet.tOpp,value:validSheet.tOpp.value+8*86400}}})")
        expect(button).not_to_have_attribute('aria-label', before)
        selected = page.evaluate(FIRST_WINDOW)
        assert selected > first
        page.evaluate('(at)=>{__clock.t=at-28800;__clock.emit()}',selected)
        expect(button).to_have_attribute('aria-label','Estimated launch window: under 1 day. Open launch planner.')
        button.focus()
        button.press('Enter')
        depart = page.locator('[data-tut="launch-departure"]')
        expect(depart).to_be_visible()
        same_day = depart.get_by_text(re.compile('^Same departure'))
        expect(same_day).to_contain_text(f'{selected/86400+1:.1f}')
        expect(depart.get_by_role('slider', name='Departure day')).to_have_attribute(
            'aria-valuetext', f'Expedition day {selected/86400+1:.1f}')
        assert abs(page.evaluate('__clock.t') - (selected-28800)) < 1
        assert page.evaluate('__clock.paused')
        page.get_by_role('button', name='Now', exact=True).click()
        expect(same_day).not_to_contain_text(f'{selected/86400+1:.1f}')
        button.click()
        expect(same_day).to_contain_text(f'{selected/86400+1:.1f}')
        page.evaluate('(at)=>{__clock.t=at+3600;__clock.emit()}', selected)
        expect(button).not_to_have_attribute('aria-label','Estimated launch window: under 1 day. Open launch planner.')
        page.evaluate('__game.setState({sheet:{...validSheet,g:{value:-1,sigma:1}}})')
        expect(button).to_have_count(0)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors, errors
        print(f'{width}×{height}: missing/valid/invalid, live countdown, window shortcut and safe HUD width passed', flush=True)
        page.close()
