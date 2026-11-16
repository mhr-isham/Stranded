"""Paid evidence/sensor checks and checkpoint-safe budgets at two viewport sizes."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

out=Path('/tmp/stranded-verification')
out.mkdir(exist_ok=True)

def setup(page, mode='cadet'):
    page.evaluate('''async mode=>{
      const {ECHO}=await import('/src/game/echo.ts');
      __game.getState().newGame(316,{difficulty:mode,sound:false,survival:false,formulas:mode!=='legend'});
      __clock.t=123;__clock.paused=true;__clock.emit();
      __game.setState({phase:'play',screen:'sheet',savedT:123,sheet:{g:{value:9.8,sigma:.01}},storyQueue:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});
      for(const value of[9.6,9.8,10])__game.getState().addReading({key:'g',value,at:123,...(value===10?{environment:{instrument:'pendulum',at:123,rawValue:value,wind:{speed:12,protection:'none'}}}:{})});
    }''',mode)

def paid(page):
    return page.get_by_role('region',name='Paid ECHO checks',exact=True)

def menu(page):
    page.get_by_role('button',name='Menu',exact=True).click()
    return page.locator('.modal')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in[(390,844),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        setup(page)
        m=menu(page)
        m.get_by_role('button',name='Save',exact=True).nth(0).click()
        m.get_by_role('button',name='Close',exact=True).click()
        assert '5 remaining' in paid(page).inner_text()
        paid(page).get_by_role('button',name='Review my evidence',exact=True).click()
        report=paid(page).get_by_role('region',name='Saved ECHO result',exact=True).first
        assert 'matches this average' in report.inner_text()
        assert 'exposed rig in strong wind' in report.inner_text()
        assert 'INSIDE' not in report.inner_text() and 'OUTSIDE' not in report.inner_text()
        report.get_by_text('Why this matters',exact=True).click()
        report.get_by_text('How to investigate',exact=True).click()
        assert page.evaluate('__game.getState().checksUsed')==1
        assert page.evaluate('__game.getState().penaltyDv')==40
        report.scroll_into_view_if_needed()
        page.screenshot(path=str(out/f'evidence-{width}.png'))
        paid(page).get_by_role('button',name='Verify against ship sensors',exact=True).click()
        assert page.evaluate('__game.getState().checksUsed')==2
        assert page.evaluate('__game.getState().penaltyDv')==80
        report=paid(page).get_by_role('region',name='Saved ECHO result',exact=True).first
        assert 'INSIDE' in report.inner_text() or 'OUTSIDE' in report.inner_text()
        page.reload(wait_until='networkidle')
        assert page.evaluate('__game.getState().verificationHistory.length')==2
        report=paid(page).get_by_role('region',name='Saved ECHO result',exact=True).first
        value=page.locator('[data-tut="sheet-panel"] input').nth(0)
        value.fill('9.9')
        value.press('Tab')
        report.get_by_text('The entry or supporting records have changed.',exact=False).wait_for()
        paid(page).get_by_role('button',name='Review my evidence',exact=True).click()
        assert page.evaluate('__game.getState().checksUsed')==3
        m=menu(page)
        m.get_by_role('button',name='Load',exact=True).nth(0).click()
        assert page.evaluate('__game.getState().sheet.g.value')==9.8
        assert page.evaluate('__game.getState().checksUsed')==3
        assert page.evaluate('__game.getState().penaltyDv')==120
        assert page.evaluate('__game.getState().verificationHistory.length')==3
        for _ in range(2):paid(page).get_by_role('button',name='Verify against ship sensors',exact=True).click()
        assert paid(page).get_by_role('button',name='Review my evidence',exact=True).is_disabled()
        assert paid(page).get_by_role('button',name='Verify against ship sensors',exact=True).is_disabled()
        m=menu(page)
        m.get_by_role('button',name='Load',exact=True).nth(0).click()
        assert page.evaluate('__game.getState().checksUsed')==5
        assert page.evaluate('__game.getState().penaltyDv')==200
        assert paid(page).get_by_role('button',name='Verify against ship sensors',exact=True).is_disabled()
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
        setup(page,'navigator')
        paid(page).get_by_role('button',name='Review my evidence',exact=True).click()
        report=paid(page).get_by_role('region',name='Saved ECHO result',exact=True).first
        assert report.get_by_text('Why this matters',exact=True).count()==0
        assert report.get_by_text('How to investigate',exact=True).count()==0
        paid(page).get_by_role('button',name='Verify against ship sensors',exact=True).click()
        assert paid(page).get_by_role('button',name='Review my evidence',exact=True).is_disabled()
        setup(page,'stargazer')
        paid(page).get_by_role('button',name='Review my evidence',exact=True).click()
        assert paid(page).locator('details[open]').count()==2
        for _ in range(5):paid(page).get_by_role('button',name='Verify against ship sensors',exact=True).click()
        assert paid(page).get_by_role('button',name='Verify against ship sensors',exact=True).is_enabled()
        setup(page)
        page.evaluate("async()=>{const{currentWorld}=await import('/src/game/sim.ts');__game.setState({penaltyDv:currentWorld().system.fuelDv-39})}")
        assert paid(page).get_by_role('button',name='Review my evidence',exact=True).is_disabled()
        assert paid(page).get_by_role('button',name='Verify against ship sensors',exact=True).is_disabled()
        assert page.evaluate('__game.getState().checksUsed')==0
        setup(page)
        page.evaluate('__game.setState({readings:[]})')
        paid(page).get_by_role('button',name='Review my evidence',exact=True).click()
        assert page.evaluate('__game.getState().checksUsed')==0
        assert page.evaluate('__game.getState().penaltyDv')==0
        for mode in['astronomer','legend']:
            setup(page,mode)
            assert paid(page).count()==0
            assert page.locator('[data-tut="sheet-checks"]').is_visible()
        assert not errors,errors
        page.close()
    browser.close()
print('PASS paid evidence/sensor actions, distinct sources, shared fuel/use budgets, saved/stale results, real checkpoint save/load persistence, mode depths, depleted fuel and no-data rejection at phone/desktop widths')
