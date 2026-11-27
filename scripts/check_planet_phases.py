"""Inspect generated inner-planet phases, the saved gallery and the filar wires."""
from pathlib import Path
import re
import shutil
import sys

from playwright.sync_api import expect, sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
out = Path('/tmp/stranded-planet-phases')
out.mkdir(exist_ok=True)
fixture = """async () => {
    const { ECHO } = await import('/src/game/echo.ts');
    const { currentWorld } = await import('/src/game/sim.ts');
    const { ARCSEC, DAY, DEG } = await import('/src/engine/constants.ts');
    const { planetPhase, phaseReadable } = await import('/src/engine/planetPhase.ts');
    const { localFrame, toHorizontal, topocentric } = await import('/src/engine/sky.ts');
    const { opticalStatus } = await import('/src/game/observing.ts');
    const { skyline } = await import('/src/game/skyObservation.ts');
    const { makeLandscape } = await import('/src/render/terrain.ts');
    __game.getState().newGame(316, {difficulty:'navigator',sound:false,survival:false,formulas:true}, 5);
    __clock.paused = true;
    __game.setState({phase:'play',screen:'observatory',identified:true,echo:[],storyQueue:[],
      seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5]});
    const s = __game.getState(), { system } = currentWorld(), land = makeLandscape(system.seed, system.hillHeight);
    const chosen = {};
    for (let at = 0; at < Math.min(system.lifeSupport, 900 * DAY); at += 1800) {
      const target = topocentric(system, 'target', at, system.site), star = topocentric(system, 'star', at, system.site);
      const f = localFrame(system, at, system.site);
      const p = toHorizontal(target, f);
      if (p.alt < skyline(land, p.az) + 1 * DEG) continue;
      const optical = opticalStatus(system, s, at, 'view', {direction:target,horizon:skyline(land,p.az)});
      if (optical.code === 'solar-glare') chosen.glare ??= at;
      if (!optical.ok || toHorizontal(star, f).alt > 1 * DEG) continue;
      const phase = planetPhase(target, star), radius = Math.asin(system.target.radius / Math.hypot(...target));
      if (!phaseReadable(phase, 2 * radius, 1.2 * ARCSEC * optical.seeing, 100)) continue;
      if (phase.cosine > -.76 && phase.cosine < -.36) chosen.crescent ??= {at, ...phase};
      if (phase.cosine > .39 && phase.cosine < .78) chosen.gibbous ??= {at, ...phase};
      if (chosen.crescent && chosen.gibbous && chosen.glare !== undefined && chosen.gibbous.at > chosen.crescent.at) break;
    }
    if (!chosen.crescent || !chosen.gibbous || chosen.glare === undefined) throw Error('Need a clear crescent, gibbous and glare fixture');
    __clock.t = chosen.crescent.at; __game.setState({savedT:__clock.t}); __clock.emit();
    return chosen;
}"""
seek = "(at) => { __clock.t = at; __clock.paused = true; __game.setState({savedT: at}); __clock.emit(); }"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which('chromium'))
    for width, height in [(390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True)
        page.set_default_timeout(15000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game && window.__clock)')
        chosen = page.evaluate(fixture)
        page.get_by_role('button', name='Open planet phase watch').click()
        watch = page.get_by_role('region', name='Planet phase watch')
        live = page.get_by_role('img', name=re.compile('^Telescope;'))
        keep = watch.get_by_role('button', name='Keep phase view')
        expect(watch.get_by_text('Crescent', exact=True)).to_be_visible()
        # Rendered brightness must be stronger on the Sun-facing half of the eyepiece.
        contrast = live.evaluate("""(c, phase) => {
            const w = c.width, h = c.height, cx = w / 2, cy = h / 2;
            const ctx = c.getContext('2d');
            const edge = Math.round(Math.min(w, h) * 0.18);
            const data = ctx.getImageData(Math.floor(cx-edge), Math.floor(cy-edge), 2*edge, 2*edge).data;
            const sides = [0,0];
            for (let i = 0; i < data.length; i += 4) {
                const px = i / 4 % (2*edge) - edge, py = Math.floor(i / 4 / (2*edge)) - edge;
                const side = Number(px * phase.limbX + py * phase.limbY >= 0);
                sides[side] += Math.max(0, data[i+2] - 2*data[i] - 45);
            }
            return sides;
        }""", chosen['crescent'])
        assert contrast[1] > 3 * contrast[0] and contrast[1] > 0, contrast
        page.screenshot(path=str(out / f'crescent-{width}.png'))
        watch.get_by_label('Observation note (optional)').fill('Thin bright limb.')
        keep.click()
        assert page.evaluate('__game.getState().phaseSightings.length') == 1

        # Glare must suppress both the shape readout and the save action.
        page.evaluate(seek, chosen['glare'])
        expect(watch.get_by_text(re.compile('^Solar glare'))).to_be_visible()
        expect(keep).to_be_disabled()
        page.evaluate(seek, chosen['gibbous']['at'])
        watch.get_by_role('button', name='Centre and frame').click()
        expect(watch.get_by_text('Gibbous', exact=True)).to_be_visible()
        keep.click()
        watch.get_by_text('Saved phase views (2)', exact=True).click()
        expect(watch.get_by_role('img', name='Crescent inner planet')).to_be_visible()
        expect(watch.get_by_role('img', name='Gibbous inner planet')).to_be_visible()
        assert watch.get_by_text(re.compile(r'° from the star$')).count() == 2
        expect(watch.get_by_text('Thin bright limb.', exact=True)).to_be_visible()
        page.screenshot(path=str(out / f'gallery-{width}.png'))
        native = page.evaluate('__game.getState().phaseSightings')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function("window.__game?.getState().phaseSightings?.length === 2")
        page.evaluate(seek, chosen['crescent']['at'])
        assert page.evaluate('__game.getState().phaseSightings') == native

        page.get_by_role('button', name='Micrometer', exact=True).click()
        page.get_by_role('button', name='Point at the blue planet', exact=True).click()
        controls = page.get_by_role('group', name='Micrometer wire controls')
        expect(page.get_by_text(re.compile('^Frame the disk, then place the wires across the two tips'))).to_be_visible()
        controls.get_by_role('button', name='Wire A', exact=True).click()
        controls.get_by_role('button', name='Decrease selected wire position').click()
        page.get_by_role('button', name='Log diameter', exact=True).click()
        assert page.evaluate('__game.getState().readings.at(-1)?.micrometer?.wireA < 0'), page.locator('.toast').all_text_contents()
        assert page.evaluate('__game.getState().phaseSightings.length') == 2
        assert not errors, errors
        print(f'{width}×{height}: geometry, bright limb, glare, gallery, reload and manual diameter passed', flush=True)
        page.close()
    browser.close()
