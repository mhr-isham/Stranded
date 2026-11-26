"""Check the navigation count and requested transfer estimate on three layouts."""
import shutil
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:5173/', wait_until='networkidle')
        page.evaluate("""async()=>{const {ECHO}=await import('/src/game/echo.ts');
            __game.getState().newGame(316,{difficulty:'navigator',sound:false,formulas:true,survival:false});
            __clock.paused=true;__clock.emit();
            __game.setState({phase:'play',screen:'hub',storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5]});}""")
        hud = page.locator('.hud-ready')
        expect(hud).to_have_attribute('aria-label', 'Mission readiness: 0 of 9 navigation values logged')
        hud.click()
        log = page.get_by_role('region', name='Navigation log', exact=True)
        transfer = page.get_by_role('region', name='Transfer estimate', exact=True)
        expect(log).to_contain_text('0 of 9 navigation values logged')
        expect(transfer).to_contain_text('Log the remaining navigation values')
        assert 'simulations' not in transfer.inner_text()
        page.evaluate("""async()=>{const {currentWorld}=await import('/src/game/sim.ts');
            const {keysFor,truthValues}=await import('/src/engine/chain.ts');
            const {system}=currentWorld(), values=truthValues(system);
            window.__validSheet=Object.fromEntries(keysFor('standard').map(key=>[key,{value:values[key],sigma:0}]));
            __game.setState({sheet:{...__validSheet,g:{value:-1,sigma:1}}});}""")
        expect(log).to_contain_text('9 of 9 navigation values logged')
        expect(transfer).to_contain_text('do not form a usable flight model')
        page.evaluate("__game.setState({sheet:__validSheet})")
        expect(transfer).to_contain_text('of 24')
        expect(transfer).to_contain_text('within the fuel budget')
        expect(hud).to_have_attribute('aria-label', 'Mission readiness: 9 of 9 navigation values logged')
        transfer.get_by_text('What this covers', exact=True).click()
        expect(transfer).to_contain_text('arrival deadline and any manual flight separately')
        page.evaluate("""async()=>{const {currentWorld}=await import('/src/game/sim.ts');
            __clock.t=currentWorld().system.lifeSupport-60;__clock.emit();}""")
        expect(transfer).to_contain_text('no upcoming departure window')
        page.keyboard.press('Escape')
        page.evaluate("__game.setState({screen:'launch',sheet:{...__validSheet,g:{value:-1,sigma:1}}})")
        expect(page.get_by_text('Review the flight model', exact=True)).to_be_visible()
        expect(page.get_by_text('9 of 9 navigation values logged', exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors, errors
        print(f'{width}×{height}: separate HUD count, missing/invalid/modelled states, scope and launch guard passed', flush=True)
        page.close()
