"""Check the optional transfer overlay and the independent trial counts."""
import re
import shutil
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width, height, limit in [(390, 844, 12), (1440, 900, 24), (844, 390, 12)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script("""(()=>{
          const stroke = CanvasRenderingContext2D.prototype.stroke;
          CanvasRenderingContext2D.prototype.stroke = function(...args) {
            if (this.strokeStyle === 'rgba(124, 166, 224, 0.24)') window.sampleStrokes = (window.sampleStrokes ?? 0) + 1;
            return stroke.apply(this, args);
          };
        })()""")
        page.goto('http://127.0.0.1:5176/', wait_until='networkidle')
        page.evaluate("""async()=>{const {ECHO}=await import('/src/game/echo.ts');
            const {currentWorld}=await import('/src/game/sim.ts');
            const {keysFor,truthValues}=await import('/src/engine/chain.ts');
            __game.getState().newGame(316,{difficulty:'navigator',sound:false,formulas:true,survival:false});
            const values=truthValues(currentWorld().system);
            const sheet=Object.fromEntries(keysFor('standard').map(key=>[key,{value:values[key],sigma:Math.abs(values[key])*.002}]));
            __clock.paused=true;__clock.emit();
            __game.setState({phase:'play',screen:'launch',sheet,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5]});}""")
        outcomes = page.get_by_label('Simulated transfer outcomes', exact=True)
        expect(outcomes).to_contain_text('of 36 succeeded')
        trial_result = outcomes.inner_text()
        overlay = page.get_by_role('group', name='Trajectory display', exact=True)
        show = overlay.get_by_role('button', name='Show possible paths', exact=True)
        expect(show).to_have_attribute('aria-pressed', 'false')
        assert page.evaluate('(window.sampleStrokes ?? 0) === 0')
        show.focus()
        show.press('Enter')
        expect(overlay.get_by_role('status')).to_have_text(f'{limit} paths shown from 36 trials')
        expect(page.get_by_role('img', name='Planned route with sampled trajectories')).to_be_visible()
        page.wait_for_function('window.sampleStrokes > 0')
        assert outcomes.inner_text() == trial_result
        if width == 1440:
            page.set_viewport_size({'width': 820, 'height': 900})
            expect(overlay.get_by_role('status')).to_have_text('12 paths shown from 36 trials')
            page.set_viewport_size({'width': width, 'height': height})
            expect(overlay.get_by_role('status')).to_have_text('24 paths shown from 36 trials')
        page.get_by_role('button', name=re.compile('Fast$')).click()
        expect(overlay.get_by_role('status')).to_have_text(f'{limit} paths shown from 36 trials')
        expect(outcomes).to_contain_text('of 36 succeeded')
        overlay.get_by_role('button', name='Hide possible paths', exact=True).click()
        expect(page.get_by_role('img', name='Planned route and planetary orbits')).to_be_visible()
        expect(overlay.get_by_role('status')).to_have_count(0)
        page.wait_for_timeout(80)
        strokes = page.evaluate('window.sampleStrokes')
        page.wait_for_timeout(100)
        assert page.evaluate('window.sampleStrokes') == strokes
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors, errors
        print(f'{width}×{height}: clear default, {limit}/36 overlay, independent counts, plan change and toggle passed', flush=True)
        page.close()
