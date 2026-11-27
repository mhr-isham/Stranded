"""Follow actual generated relay passes through the telescope UI."""
from pathlib import Path
import re
import shutil
import sys

from playwright.sync_api import expect, sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
out = Path('/tmp/stranded-relay-watch')
out.mkdir(exist_ok=True)
position = """async () => {
    const { currentWorld } = await import('/src/game/sim.ts');
    const { DAY, DEG } = await import('/src/engine/constants.ts');
    const { localFrame, toHorizontal, topocentric } = await import('/src/engine/sky.ts');
    const { relayTopocentric, relaySunlit } = await import('/src/engine/relay.ts');
    const { makeLandscape } = await import('/src/render/terrain.ts');
    const { skyline, visibleSkyLights } = await import('/src/game/skyObservation.ts');
    const { system, catalog } = currentWorld();
    const land = makeLandscape(system.seed, system.hillHeight);
    const canvas = document.querySelector('.tool-stage canvas');
    const rect = canvas.getBoundingClientRect();
    const camera = {az: 180 * DEG, alt: 35 * DEG, fov: 90 * DEG, w: rect.width, h: rect.height};
    const clear = (at) => {
      const frame = localFrame(system, at, system.site);
      const sky = toHorizontal(topocentric(system, 'star', at, system.site), frame);
      const relay = toHorizontal(relayTopocentric(system, at, system.site), frame);
      return sky.alt < -7 * DEG && relay.alt > Math.max(6 * DEG, skyline(land, relay.az)) && relaySunlit(system, at);
    };
    for (let at = DAY; at < 12 * DAY; at += 180) {
        if (![0, 45, 90, 135].every(dt => clear(at + dt))) continue;
        const visible = visibleSkyLights(system, catalog, at, camera, land).find(light => light.ref.kind === 'relay');
        if (!visible) continue;
        __clock.t = at; __clock.paused = true; __clock.emit();
        return {start: at, code: visible.code};
    }
    throw Error('No clear relay pass entered the default sky field');
}"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which('chromium'))
    for width, height, free_roam in [(390, 844, False), (1440, 900, True), (844, 390, False)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True)
        page.set_default_timeout(12000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game && window.__clock)')
        page.evaluate("""async (freeRoam) => {
            const { ECHO } = await import('/src/game/echo.ts');
            __game.getState().newGame(316, {difficulty: 'navigator', sound: false, survival: false, formulas: true, freeRoam});
            __clock.paused = true;
            __game.setState({phase: 'play', screen: 'observatory', echo: [], storyQueue: [], atlas: [],
                seenEcho: Object.values(ECHO).map(line => line.id), actsSeen: [1, 2, 3, 4, 5]});
        }""", free_roam)
        sight = page.evaluate(position)
        page.get_by_text(re.compile('^Lights in this view')).click()
        page.locator(f'[data-sky-light="{sight["code"]}"]').click()
        watch = page.get_by_role('region', name='Moving-light watch')
        expect(watch.get_by_role('button', name='Read hull tag')).to_have_count(0)
        watch.get_by_role('button', name='Follow in telescope', exact=True).click()
        keep = watch.get_by_role('button', name='Keep telescope sighting')
        nudge = page.get_by_role('button', name='Move telescope image right', exact=True)
        for _ in range(4):
            nudge.click()
        expect(keep).to_be_disabled()
        for _ in range(4):
            page.get_by_role('button', name='Move telescope image left', exact=True).click()
        keep.click()
        keep.click()
        assert page.evaluate('__game.getState().skySightings.length') == 1
        for i in [1, 2]:
            watch.get_by_role('button', name='Wait 45 s').click()
            page.wait_for_function('target => __clock.t === target && __clock.paused', arg=sight['start'] + i * 45)
            keep.click()
        expect(watch.get_by_text('Motion recorded against the background stars.', exact=True)).to_be_visible()
        expect(watch.get_by_text(re.compile(r'° across 90 s$'))).to_be_visible()
        expect(watch.get_by_role('button', name='Read hull tag')).to_be_disabled()
        assert page.evaluate("!__game.getState().relayTag && !__game.getState().logs.includes('relay')")
        page.screenshot(path=str(out / f'evidence-{width}.png'))
        watch.get_by_role('button', name='Zoom on selected light').click()
        watch.get_by_role('button', name='Read hull tag').click()
        if not free_roam:
            expect(page.get_by_role('heading', name='A star that moves')).to_be_visible()
            page.locator('.story-card').get_by_role('button', name='Skip', exact=True).click()
        expect(watch.get_by_text('HALCYON', exact=True)).to_be_visible()
        watch.get_by_text('Review recorded motion', exact=True).click()
        expect(watch.get_by_label('Motion from your telescope sightings')).to_be_visible()
        page.screenshot(path=str(out / f'capture-{width}.png'))
        assert page.evaluate("""free => {
            const s = __game.getState();
            return s.logs.includes('relay') !== free && s.relayTag.mark === 'HALCYON' && s.relayTag.signal.length === 112
                && s.skySightings.length === 3 && s.skySightings.every(n => n.instrument === 'scope')
                && !Object.keys(s.sheet).length && !s.checksUsed && !s.penaltyDv;
        }""", free_roam)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function("Boolean(window.__game?.getState().relayTag?.mark === 'HALCYON')")
        assert page.evaluate('__game.getState().skySightings.length') == 3
        assert not errors, errors
        print(f'{width}×{height}: sightings, timed waits, zoom gate, optical capture and reload passed (Free Roam {free_roam})', flush=True)
        page.close()
    browser.close()
