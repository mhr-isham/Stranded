"""Check real generated conjunction conditions, the recording guard and the filter."""
from pathlib import Path
import re
import shutil
from playwright.sync_api import expect, sync_playwright

out = Path('/tmp/stranded-solar-glare')
out.mkdir(exist_ok=True)

fixture = """async () => {
  const { currentWorld } = await import('/src/game/sim.ts');
  const { opticalStatus } = await import('/src/game/observing.ts');
  const { angleBetween } = await import('/src/engine/vec.ts');
  const { topocentric } = await import('/src/engine/sky.ts');
  const { ECHO } = await import('/src/game/echo.ts');
  const { planetPhase, phaseReadable } = await import('/src/engine/planetPhase.ts');
  const { ARCSEC, DEG, DAY } = await import('/src/engine/constants.ts');
  __game.getState().newGame(316,{difficulty:'navigator',survival:false,sound:false,formulas:true},5);
  const s = __game.getState(), {system} = currentWorld();
  const instants = {};
  for (let t = 0; t < 500 * DAY && Object.keys(instants).length < 3; t += 900) {
    const obs = opticalStatus(system,s,t,'diameter');
    if (obs.sunAlt < 22 * DEG || obs.alt < 20 * DEG) continue;
    if (obs.code === 'solar-glare' && instants.strong === undefined) {
      const star = topocentric(system,'star',t,system.site), planet = topocentric(system,'target',t,system.site);
      if (angleBetween(planet,star) - Math.asin(system.star.radius / Math.hypot(...star)) > .15 * DEG) instants.strong = t;
    }
    if (!obs.ok) continue;
    const star = topocentric(system,'star',t,system.site), planet = topocentric(system,'target',t,system.site);
    const r = Math.asin(system.target.radius / Math.hypot(...planet)), phase = planetPhase(planet, star);
    if (!phaseReadable(phase, 2*r, 1.2 * ARCSEC * obs.seeing, 100)) continue;
    if (obs.solarGlare > .29 && obs.solarGlare < .55) instants.soft ??= t;
    if (obs.solarGlare < .008) instants.clear ??= t;
  }
  if (Object.keys(instants).length !== 3) throw Error('Missing generated conjunction fixtures');
  __clock.t = instants.clear; __clock.paused = true; __clock.emit();
  __game.setState({phase:'play',screen:'observatory',identified:true,storyQueue:[],echo:[],
    seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5]});
  return instants;
}"""

def at(page, when):
    page.evaluate('t => { __clock.t = t; __clock.paused = true; __clock.emit(); }', when)

def center_sample(canvas):
    return canvas.evaluate("""c => {
      const x = Math.floor(c.width * .18), y = Math.floor(c.height * .27);
      const pixels = c.getContext('2d').getImageData(x,y,6,6).data;
      return pixels.reduce((s,v,i) => s + (i%4 === 0 ? v : 0), 0) / 36;
    }""")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(320, 740), (390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:5185/', wait_until='networkidle')
        instants = page.evaluate(fixture)
        page.get_by_role('button', name='Micrometer', exact=True).click()
        page.get_by_role('button', name=re.compile('^Point at the blue planet')).click()
        availability = page.get_by_label('Observing availability', exact=True)
        log = page.locator('[data-tut="micro-log"]')
        canvas = page.locator('.tool-stage canvas')
        expect(availability).to_contain_text('View usable.')
        expect(log).to_be_enabled()
        clear = center_sample(canvas)
        at(page, instants['soft'])
        page.get_by_role('button', name=re.compile('^Point at the blue planet')).click()
        expect(availability).to_contain_text('Solar glare lowers contrast')
        expect(log).to_be_enabled()
        soft = center_sample(canvas)
        page.evaluate("""at => {
          __clock.t = at;
          const button = document.querySelector('[data-tut="micro-log"]');
          if (button.disabled) throw Error('Expected stale usable button');
          button.click();
          __clock.emit();
        }""", instants['strong'])
        expect(availability).to_contain_text('Solar glare — the star is too close')
        expect(log).to_be_disabled()
        assert page.evaluate("__game.getState().readings.filter(r=>r.key==='alpha2').length") == 0
        strong = center_sample(canvas)
        assert clear + 15 < soft < strong - 15, (clear, soft, strong)
        availability.get_by_text('View details', exact=True).click()
        expect(availability).to_contain_text('scatters inside the unfiltered telescope')
        slider = page.get_by_role('slider', name='Telescope field of view')
        slider.press('End')
        canvas.screenshot(path=str(out / f'glare-{width}.png'))
        page.get_by_role('button', name='Transit', exact=True).click()
        page.get_by_role('button', name='Look at the star (solar filter)', exact=True).click()
        expect(availability).to_contain_text('View usable.')
        expect(availability).not_to_contain_text('Solar glare')
        canvas.screenshot(path=str(out / f'filter-{width}.png'))
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        assert not errors, errors
        print(f'{width}×{height}: directional/offscreen veil, recording recheck, and solar filter passed', flush=True)
        page.close()
