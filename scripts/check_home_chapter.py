"""Exercise Chapter 9 through Mars flight, Earth transit tracking and the debrief."""
from pathlib import Path
import re
import shutil

from playwright.sync_api import expect, sync_playwright

OUT = Path('/tmp/stranded-home-chapter')
OUT.mkdir(exist_ok=True)

START = """async () => {
  __game.getState().newGame(316,{difficulty:'navigator',survival:false,sound:false,formulas:true,campaignRun:true},9);
}"""

SURVEY = """async () => {
  const { currentWorld } = await import('/src/game/sim.ts');
  const { DAY } = await import('/src/engine/constants.ts');
  const { oppositions } = await import('/src/engine/ephemeris.ts');
  const sys = currentWorld().system;
  const targets = oppositions(sys, 2 * DAY, sys.lifeSupport - 3 * DAY);
  window.__homeTransits = { targets, DAY };
  __clock.t = Math.max(0, targets[0] - 2 * DAY);
  __clock.paused = true;
  __game.setState({phase:'play', screen:'observatory', identified:true,
    missionsDone:['parallax','disk'], actsSeen:[1,2,4,5], storyQueue:[], echo:[]});
  __clock.emit();
}"""

READ_TRANSIT = """() => {
  const {targets, DAY} = __homeTransits;
  for (const t of targets) {
    __ff(t + 2 * DAY);
    if (__game.getState().sunLog.length >= 3) break;
    __game.setState({sunLog:[]});
  }
  return __game.getState().sunLog.map(o=>o.at);
}"""

SET_DEBRIEF = """async () => {
  const { currentWorld } = await import('/src/game/sim.ts');
  const { truthValues } = await import('/src/engine/chain.ts');
  const { botPlay, PERFECT } = await import('/src/engine/solver.ts');
  const { bestTransfer } = await import('/src/engine/planner.ts');
  const { system } = currentWorld();
  const v = truthValues(system);
  const transfer = botPlay(system, PERFECT, 7);
  if (transfer.result?.outcome !== 'success') throw Error('Need a successful Earth transfer fixture');
  const plan = bestTransfer(transfer.model, transfer.departTime);
  // Brief coverage: Mars radius spans the reference; Mars gravity deliberately misses.
  const sheet = {R1:{value:v.R1+1000,sigma:3000},g:{value:4.3,sigma:.1}, P1:{value:v.P1,sigma:86400}};
  for (const key of ['S2','tOpp','dPar','alpha2']) sheet[key]={value:v[key],sigma:Math.abs(v[key])*.01};
  __game.setState({phase:'landing', sheet, outcome:{plan:plan.plan, result:transfer.result, sheet}, storyQueue:[], echo:[]});
}"""


def test_home(page, width, height):
    page.set_default_timeout(20000)
    faults = []
    page.on('pageerror', lambda e: faults.append(str(e)))
    page.goto('http://127.0.0.1:5181/', wait_until='domcontentloaded')
    page.wait_for_function('Boolean(window.__game && window.__prologue) || window.__game?.getState().phase === "title"')
    page.evaluate(START)
    expect(page.get_by_text('Mars arrival', exact=True)).to_be_visible()
    page.wait_for_function('__prologue.params.rho0 === .016 && __prologue.params.scaleH === 11000')
    page.evaluate("""() => { const s=__prologue.sim.current; s.ang=-Math.PI/2; s.spin=0; s.burn=.994; }""")
    page.keyboard.down('w')
    page.wait_for_function("__prologue.sim.current.stage === 'entry'")
    page.keyboard.up('w')
    page.evaluate("""() => { const p=__prologue, s=p.sim.current;
      s.alt=11010;
      if (innerWidth === 1440) {
        const flat=p.terrain.features.find(t=>t.kind==='flat');
        s.d.x=(flat.x0+flat.x1)/2;
        s.d.vx=0;
        s.d.y=p.terrain.height(s.d.x)+1800;
        s.d.vy=-70;
      }
    }""")
    page.wait_for_function("__prologue.sim.current.stage === 'descent'")
    expect(page.get_by_text('Dynamic pressure', exact=True)).to_be_visible()
    page.get_by_role('button', name='Pause flight', exact=True).click()
    page.screenshot(path=str(OUT / f'mars-{width}.png'))
    page.get_by_role('button', name='Parachute', exact=False).click()
    page.wait_for_function("__prologue.sim.current.d.chute === 'open'")
    if width == 1440:
        page.get_by_role('button', name='Resume flight', exact=True).click()
        # Scripted throttle uses the same path as the Burn control. The fixture
        # puts the ship over flat terrain so this specifically measures braking.
        landing = page.evaluate("""() => new Promise(resolve => {
          const p=__prologue, timeout=performance.now()+90000;
          const pulse=setInterval(()=>{
            const s=p.sim.current;
            if(s.stage==='landed' || performance.now()>timeout) {
              clearInterval(pulse); p.input.current.thrust=false;
              resolve({result:s.result, fuel:s.d.fuel}); return;
            }
            const h=Math.max(0,s.d.y-p.terrain.height(s.d.x));
            const limit=Math.min(85,Math.sqrt(2*(p.params.thrust-p.params.g)*h*.6+9));
            p.input.current.thrust=(-s.d.vy>limit);
          }, 16);
        })""")
        assert landing['result']['touch'] == 'clean', landing
        assert 0 < landing['fuel'] < 850, landing
        page.get_by_role('button', name='Continue', exact=True).click()
        expect(page.get_by_role('heading', name='Home', exact=True)).to_be_visible()
    page.evaluate(SURVEY)
    page.get_by_role('button', name='Transit', exact=True).click()
    expect(page.get_by_text('Earth transit timer', exact=True)).to_be_visible()
    page.get_by_role('button', name='Turn on the solar camera').click()
    logs = page.evaluate(READ_TRANSIT)
    assert len(logs) >= 3, logs
    expect(page.get_by_role('img', name='Solar-camera transit readings')).to_be_visible()
    page.get_by_role('button', name='Fit latest transit').click()
    page.get_by_role('button', name='Log this transit').click()
    expect(page.get_by_role('heading', name='Earth', exact=True)).to_be_visible()
    expect(page.get_by_text('Act III complete', exact=False)).to_be_visible()
    assert page.evaluate("__game.getState().missionsDone.includes('transit') && __game.getState().oppPicks.length === 1")
    assert not page.evaluate("__game.getState().missionsDone.includes('opposition')")
    page.evaluate(SET_DEBRIEF)
    expect(page.get_by_text('Earth landing', exact=True)).to_be_visible()
    page.wait_for_function('__prologue.params.rho0 === 1.217 && __prologue.params.scaleH === 8500')
    page.get_by_role('button', name='Skip', exact=True).click()
    page.wait_for_function("__game.getState().phase === 'results' && __game.getState().campaign[9]?.done")
    page.evaluate('__game.setState({storyQueue:[]})')
    ref = page.get_by_role('region', name='Mars and Earth reference comparison')
    expect(ref.get_by_text('inside your range', exact=False).first).to_be_visible()
    expect(ref.get_by_text('outside your range', exact=False).first).to_be_visible()
    expect(ref.get_by_text('3,389.5', exact=True)).to_be_visible()
    expect(ref.get_by_text('365.256', exact=True)).to_be_visible()
    expect(ref.get_by_role('region', name='Earth reference values').get_by_text('inside your range', exact=False).first).to_be_visible()
    expect(page.get_by_role('columnheader', name='Model value')).to_be_visible()
    ref.get_by_text('Why the mission and the reference can differ').click()
    expect(ref.get_by_role('link', name='NASA Mars Fact Sheet')).to_have_attribute('href', re.compile(r'^https://nssdc.gsfc.nasa.gov/'))
    expect(ref.get_by_text('J2000', exact=False)).to_be_visible()
    ref.get_by_role('heading', name='Compare with NASA’s Mars and Earth values').scroll_into_view_if_needed()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / f'references-{width}.png'))
    assert not faults, faults
    print(f'{width}×{height}: Mars descent, live Earth transit, Act III and NASA references passed', flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'))
    for width, height in [(390, 844), (844, 390), (1440, 900)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        test_home(page, width, height)
        page.close()
