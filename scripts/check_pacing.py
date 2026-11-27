"""Test the opt-in pacing report against a running Vite dev server."""
from pathlib import Path
import re
import shutil
import sys

from playwright.sync_api import expect, sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5204/'
read_record = """async () => {
    const {flushPacing} = await import('/src/game/pacingRecorder.ts');
    const {totalForeground} = await import('/src/game/pacing.ts');
    flushPacing();
    const record = __game.getState().pacingRecord;
    return {record, total: totalForeground(record)};
}"""

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which('chromium'))
    for mode, width, height in [('Cadet', 390, 844), ('Navigator', 1440, 900)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game && window.__clock)')
        assert page.evaluate('__game.getState().pacingRecord') is None
        page.get_by_role('button', name='Single expedition', exact=True).click()
        page.get_by_role('radio', name=mode, exact=True).click()
        page.get_by_text('Optional pacing playtest', exact=True).click()
        page.get_by_role('button', name=re.compile('^Record local pacing')).click()
        page.get_by_placeholder('random').fill('316')
        page.get_by_role('button', name='Launch expedition', exact=True).click()
        page.wait_for_function("__game.getState().phase === 'prologue'")
        assert page.evaluate('__game.getState().pacingRecord.mode') == mode.lower()
        # Enter the camp without waiting for the opening cinematic.
        page.evaluate("""async () => {
            const {ECHO} = await import('/src/game/echo.ts');
            __clock.t = 900;
            __clock.warpIndex = 1;
            __clock.paused = false;
            __clock.stopAt = 1000000;
            __game.setState({phase: 'play', screen: 'hub', echo: [], storyQueue: [],
                seenEcho: Object.values(ECHO).map(e => e.id), actsSeen: [1, 2, 3, 4, 5]});
        }""")
        page.wait_for_timeout(450)
        page.evaluate('__clock.stopAt = Infinity')
        page.wait_for_timeout(450)
        page.evaluate('__clock.paused = true')
        before = page.evaluate(read_record)
        ground = before['record']['buckets']['Ground']
        assert ground['scheduledMs'] > 0 and ground['warpMs'] > 0, ground

        page.evaluate("""() => {
            Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'});
            document.dispatchEvent(new Event('visibilitychange'));
        }""")
        hidden = page.evaluate(read_record)
        page.wait_for_timeout(350)
        assert page.evaluate(read_record)['total'] == hidden['total']
        page.evaluate("""() => {
            delete document.visibilityState;
            document.dispatchEvent(new Event('visibilitychange'));
        }""")
        page.evaluate("""async () => {
            const {saveSlot, loadSlot} = await import('/src/game/checkpoints.ts');
            if (!saveSlot(0) || !loadSlot(0)) throw Error('Checkpoint could not be restored');
        }""")
        assert page.evaluate(read_record)['total'] >= hidden['total']
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game && window.__clock)')
        assert page.evaluate(read_record)['total'] >= hidden['total']
        if page.get_by_role('button', name='Continue', exact=True).count():
            page.get_by_role('button', name='Continue', exact=True).click()
        page.get_by_role('button', name='Menu', exact=True).click()
        page.get_by_role('button', name='Open local pacing report').click()
        report = page.get_by_role('region', name='Local pacing report')
        expect(report).to_be_visible()
        paused = page.evaluate(read_record)['total']
        report.get_by_label(re.compile('What slowed you down')).fill('I stayed to watch the sky.')
        assert page.evaluate(read_record)['total'] == paused
        with page.expect_download() as downloaded:
            report.get_by_role('button', name='Download pacing report').click()
        download = downloaded.value
        assert download.suggested_filename == f'stranded-pacing-{mode.lower()}-316.md'
        content = Path(download.path()).read_text()
        for section in ['Scheduled waits', '## Milestones', 'Camp reached', '## Time by screen or activity',
                        'I stayed to watch the sky.']:
            assert section in content, content
        report.get_by_role('button', name='Stop recording for this run').click()
        expect(report.get_by_text(re.compile('^Recording stopped'))).to_be_visible()
        assert page.evaluate(read_record)['record']['stopped']
        print(f'{mode} {width}px: opt-in, wait categories, background exclusion, checkpoint, reload, download, and stop passed')
        page.close()
    browser.close()
