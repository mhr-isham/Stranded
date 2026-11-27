"""Check elapsed-only flare evidence, persistent sessions, and quiet-window risk."""
from pathlib import Path
import re
import shutil
import sys

from playwright.sync_api import expect, sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
out = Path('/tmp/stranded-flare-monitor')
out.mkdir(exist_ok=True)
fixture = """async () => {
    const { ECHO } = await import('/src/game/echo.ts');
    const { currentWorld } = await import('/src/game/sim.ts');
    const { DAY, HOUR } = await import('/src/engine/constants.ts');
    const { flaresOf } = await import('/src/engine/flares.ts');
    const { isCloudy } = await import('/src/game/survival.ts');
    __game.getState().newGame(316, {difficulty:'navigator',sound:false,survival:false,formulas:true}, 6);
    const { system } = currentWorld(), flares = flaresOf(system);
    const f = flares.find((flare, i) => flare.start > DAY && (flares[i-1]?.end ?? 0) < flare.start - 2 * HOUR && (flares[i+1]?.start ?? Infinity) > flare.start + DAY);
    const start = f.start - HOUR;
    const cloudy = Array.from({length:100}, (_,i) => i).find(i => i * DAY > start + DAY && isCloudy(system.seed,i*DAY)) * DAY;
    __clock.t = start; __clock.paused = true;
    __game.setState({phase:'play',screen:'observatory',echo:[],storyQueue:[], savedT:start,
        seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5]});
    __clock.emit();
    return {start, peak: f.start + .15 * (f.end - f.start), end: start + DAY, cloudy};
}"""
seek = "(at) => {__clock.t=at;__clock.paused=true;__game.setState({savedT: at});__clock.emit()}"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which('chromium'))
    for width, height in [(390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True)
        page.set_default_timeout(15000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game && window.__clock)')
        when = page.evaluate(fixture)
        opener = page.get_by_role('button', name='Open flare monitor')
        opener.click()
        monitor = page.get_by_role('region', name='Flare monitor')
        expect(monitor.get_by_text('Quiet sky', exact=True)).to_be_visible()
        monitor.get_by_label('Session length').select_option('1')
        monitor.get_by_role('button', name='Start recording').click()
        risk = monitor.get_by_text('Estimate risk for a planned observation', exact=True)
        risk.click()
        expect(monitor.get_by_text(re.compile('^Keep a clear stretch'))).to_be_visible()

        # Move the same expedition clock while the monitor is closed.
        monitor.get_by_role('button', name='Back to Sky').click()
        page.evaluate(seek, when['peak'])
        opener.click()
        expect(monitor.get_by_text('Elevated sky glow', exact=True)).to_be_visible()
        expect(monitor.get_by_role('img', name='Measured sky glow during this session')).to_be_visible()
        page.evaluate(seek, when['end'] - 12)
        monitor.get_by_role('button', name='Wait to session end').click()
        page.wait_for_function('end => __clock.paused && Math.abs(__clock.t - end) < .01', arg=when['end'])
        expect(monitor.get_by_role('button', name='Start recording')).to_be_visible()
        risk.click()
        expect(monitor.locator('dt').filter(has_text='Starts seen').locator('xpath=following-sibling::dd[1]')).to_have_text('1')
        result = monitor.get_by_label('Flare risk estimate')
        expect(result.get_by_text(re.compile('^90% range'))).to_be_visible()
        short = result.get_by_text(re.compile('^About')).inner_text()
        monitor.get_by_label('Observing window').select_option('24')
        assert result.get_by_text(re.compile('^About')).inner_text() != short
        page.screenshot(path=str(out / f'record-{width}.png'))
        sessions = page.evaluate('__game.getState().flareSessions')

        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game?.getState().flareSessions?.length)')
        page.evaluate(seek, when['end'])
        assert page.evaluate('__game.getState().flareSessions') == sessions
        opener.click()
        expect(monitor.get_by_role('img', name='Measured sky glow during this session')).to_be_visible()

        # A separate survival session with an obscured first cadence adds no exposure.
        page.evaluate("""t => {
            __clock.t=t;
            const s=__game.getState();
            __game.setState({settings:{...s.settings,survival:true},survival:{...s.survival,o2:100,food:100}});
            __clock.emit();
        }""", when['cloudy'])
        monitor.get_by_label('Session length').select_option('1')
        monitor.get_by_role('button', name='Start recording').click()
        expect(monitor.get_by_text('Cloud gap', exact=True)).to_be_visible()
        expect(monitor.get_by_text(re.compile('^No clear samples'))).to_be_visible()
        monitor.get_by_label('Session shown').select_option(index=1)
        expect(monitor.get_by_role('img', name='Measured sky glow during this session')).to_be_visible()
        assert not errors, errors
        print(f'{width}×{height}: elapsed sampling, offline tool use, risk window, cloud gaps and reload passed', flush=True)
        page.close()
    browser.close()
