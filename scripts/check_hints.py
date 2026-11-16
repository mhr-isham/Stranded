"""Paid hint access/cost persistence using real checkpoint controls."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

out=Path('/tmp/stranded-hints')
out.mkdir(exist_ok=True)

def setup(page,mode='cadet'):
    page.evaluate('''async mode=>{const{ECHO}=await import('/src/game/echo.ts');__game.getState().newGame(316,{difficulty:mode,sound:false,survival:false,formulas:mode!=='legend'});__clock.t=123;__clock.paused=true;__clock.emit();__game.setState({phase:'play',screen:'sheet',savedT:123,sheet:{g:{value:9.8,sigma:.1}},storyQueue:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]})}''',mode)

def menu(page):
    page.get_by_role('button',name='Menu',exact=True).click()
    return page.locator('.modal')

def save(page,slot=0):
    m=menu(page)
    m.get_by_role('button',name='Save',exact=True).nth(slot).click()
    m.get_by_role('button',name='Close',exact=True).click()

def load(page,slot=0):
    menu(page).get_by_role('button',name='Load',exact=True).nth(slot).click()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in[(390,844),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        setup(page)
        hints=page.locator('[data-tut="sheet-hints"]')
        assert hints.get_by_text('25 points per level',exact=True).is_visible()
        save(page)
        hints.get_by_role('button',name='Nudge me',exact=True).click()
        assert page.evaluate('__game.getState().hintsUsed')==1
        page.reload(wait_until='networkidle')
        assert page.evaluate('__game.getState().hintsSeen.g')==1
        assert page.evaluate('__game.getState().hintsUsed')==1
        load(page)
        hints.get_by_text('What swings faster when gravity is stronger?',exact=True).wait_for()
        assert hints.get_by_role('button',name='Nudge me',exact=True).count()==0
        assert page.evaluate('__game.getState().hintsUsed')==1
        hints.get_by_role('button',name='How is it measured?',exact=True).click()
        assert page.evaluate('__game.getState().hintsUsed')==2
        load(page)
        assert page.evaluate('__game.getState().hintsSeen.g')==2
        assert page.evaluate('__game.getState().hintsUsed')==2
        page.locator('[data-tut="nav-camp"]').click()
        page.locator('[data-tut="nav-sheet"]').click()
        assert page.evaluate('__game.getState().hintsUsed')==2
        hints.get_by_role('button',name='Show me the first step',exact=True).click()
        assert page.evaluate('__game.getState().hintsSeen.g')==3
        assert page.evaluate('__game.getState().hintsUsed')==3
        save(page,1)
        load(page,0);load(page,1)
        assert page.evaluate('__game.getState().hintsSeen.g')==3
        assert page.evaluate('__game.getState().hintsUsed')==3
        hints.scroll_into_view_if_needed()
        page.screenshot(path=str(out/f'paid-{width}.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
        # The core rewind path is also covered by numerical tests and the flight
        # browser regression; here it must preserve the visible unlocked text.
        setup(page)
        page.evaluate("async()=>{const{savePrelaunch}=await import('/src/game/checkpoints.ts');savePrelaunch()}")
        hints.get_by_role('button',name='Nudge me',exact=True).click()
        page.evaluate("async()=>{const{rewindToLaunch}=await import('/src/game/checkpoints.ts');rewindToLaunch()}")
        page.locator('[data-tut="nav-sheet"]').click()
        assert page.evaluate('__game.getState().hintsUsed')==1
        hints.get_by_text('What swings faster when gravity is stronger?',exact=True).wait_for()
        setup(page,'navigator')
        save(page)
        hints.get_by_role('button',name='Nudge me',exact=True).click()
        load(page)
        assert page.evaluate('__game.getState().hintsUsed')==1
        assert hints.get_by_role('button',name='How is it measured?',exact=True).count()==0
        setup(page,'stargazer')
        save(page)
        for title in['Nudge me','How is it measured?','Show me the first step']:
            hints.get_by_role('button',name=title,exact=True).click()
        load(page)
        assert page.evaluate('__game.getState().hintsSeen.g')==3
        assert page.evaluate('__game.getState().hintsUsed')==0
        assert hints.get_by_text('free in this mode',exact=True).is_visible()
        setup(page)
        page.evaluate('__game.setState({settings:{...__game.getState().settings,freeRoam:true}})')
        assert hints.get_by_text('unscored practice',exact=True).is_visible()
        for mode in['astronomer','legend']:
            setup(page,mode)
            assert hints.get_by_role('button',name='Nudge me',exact=True).count()==0
        assert not errors,errors
        page.close()
    browser.close()
print('PASS paid/free hint visibility, exact unlock counts, reloads, checkpoint Save/Load across slots, rewind retention, Navigator cap and hard-mode absence at phone/desktop widths')
