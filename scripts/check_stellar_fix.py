"""Check the Chapter 8 survey, catalogue, reveal and fold progression."""
from pathlib import Path
import re
import shutil

from playwright.sync_api import expect, sync_playwright

OUT = Path('/tmp/stranded-stellar-fix')
OUT.mkdir(exist_ok=True)
SETUP = """async difficulty => {
  const { ECHO } = await import('/src/game/echo.ts');
  const { currentWorld } = await import('/src/game/sim.ts');
  const { truthValues } = await import('/src/engine/chain.ts');
  const { nearStarsOf, parallaxOffset, catalogueOf } = await import('/src/engine/nearstars.ts');
  const { opticalStatus } = await import('/src/game/observing.ts');
  const { stellarEvidence } = await import('/src/game/stellarFix.ts');
  const { DAY, HOUR } = await import('/src/engine/constants.ts');
  __game.getState().newGame(316, {difficulty, sound:false, formulas:true, survival:false, campaignRun:true}, 8);
  const { system, catalog } = currentWorld();
  const truth = truthValues(system);
  const sheet = Object.fromEntries(['P1','S2','tOpp','dPar','pStarA','pStarB','pStarC']
    .map(key => [key, { value:truth[key], sigma: Math.abs(truth[key])*.00001 }]));
  __clock.t=0; __clock.paused=true; __clock.emit();
  __game.setState({ phase:'play', screen:'launch', sheet, storyQueue:[], echo:[], seenEcho:Object.values(ECHO).map(line=>line.id), actsSeen:[1,2,3,4,5] });
  const stars = nearStarsOf(system);
  const windows = stars.map(star => {
    const times = [];
    for (let t = HOUR; t < Math.min(system.lifeSupport - DAY, 1.55 * system.home.period); t += 17 * DAY) {
      let found = t;
      while (found < t + 12 * DAY && !opticalStatus(system, __game.getState(), found, 'nearby-star', {direction:catalog[star.index].dir}).ok) found += HOUR;
      if (found < t + 12 * DAY) times.push(found);
    }
    return times;
  });
  const clear = windows.flatMap((times,i) => times.map(at => ({i, at, v:parallaxOffset(system,stars[i],at), source:'tracker'})));
  const noisy = clear.map(o => ({...o, environment: {instrument:'telescope', at:o.at, rawValue:o.v, seeing:{factor:20, frozen:false}}}));
  const exact = stellarEvidence({sheet, starPar:clear}, system);
  const wide = stellarEvidence({sheet, starPar:noisy}, system);
  if (exact.matches.length !== 1 || wide.matches.length < 2 || windows.some(list => list.length < 6)) throw Error('Fixture needs a well observed system plus an ambiguous survey.');
  return { windows, clear, noisy, location: exact.matches[0].label, wrong: catalogueOf(system).find(p => p.label !== exact.matches[0].label).label, at: Math.max(...clear.map(x=>x.at)) };
}"""
SET_OBS = """({at, starPar}) => { __clock.t=at; __clock.paused=true; __game.setState({savedT:at, starPar}); __clock.emit(); }"""


def exercise(page, width, height, difficulty):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:5179/', wait_until='domcontentloaded')
    page.wait_for_function('Boolean(window.__game && window.__clock)')
    data = page.evaluate(SETUP, difficulty)
    expect(page.get_by_text('AWAITING ORIGIN FIX')).to_be_visible()
    expect(page.get_by_role('button', name='Engage fold drive')).to_have_count(0)
    page.get_by_role('button', name='Open stellar survey').click()
    survey = page.get_by_role('region', name='Stellar survey', exact=True)
    board = page.get_by_role('region', name='Mira’s catalogue')
    page.evaluate("""at => { __clock.t=at; __clock.paused=true; __clock.emit(); }""", data['windows'][0][0])
    log = survey.get_by_role('button', name='Log Kestrel’s position')
    expect(log).to_be_enabled()
    log.click()
    expect(log).to_be_disabled()
    expect(survey.get_by_role('img', name='Recorded Kestrel positions')).to_be_visible()
    expect(board.get_by_role('button', name='Confirm location fix')).to_be_disabled()
    if width == 390:
        seek = survey.get_by_role('button', name='Next clear view')
        seek.click()
        expect(survey.get_by_role('button', name='Stop waiting')).to_be_visible()
        page.wait_for_function('__clock.paused && __clock.stopAt === Infinity')
        expect(log).to_be_enabled()
    page.evaluate(SET_OBS, {'at': data['at'], 'starPar': data['noisy']})
    expect(board.get_by_text(re.compile(r'^\d locations still fit'))).to_be_visible()
    expect(board.get_by_role('button', name='Confirm location fix')).to_be_disabled()
    hint = board.get_by_text('from a new part of the orbit', exact=False)
    if difficulty == 'stargazer':
        expect(hint).to_be_visible()
    else:
        expect(hint).to_have_count(0)

    page.evaluate(SET_OBS, {'at': data['at'], 'starPar': data['clear']})
    expect(board.get_by_text('One catalogue entry fits the measurements.')).to_be_visible()
    confirm = board.get_by_role('button', name='Confirm location fix')
    board.get_by_role('button', name=re.compile('^'+data['wrong'])).click()
    confirm.click()
    expect(board.get_by_text(re.compile('^This choice is not supported'))).to_be_visible()
    assert page.evaluate('__game.getState().navFix') is None
    board.get_by_role('button', name=re.compile('^'+data['location'])).click()
    board.locator('.stellar-catalogue').scroll_into_view_if_needed()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(OUT / f'catalogue-{width}.png'))
    confirm.click()

    expect(page.get_by_role('heading', name='What ECHO is')).to_be_visible()
    page.get_by_role('button', name='Skip', exact=True).click()
    expect(page.get_by_text('ORIGIN FIX LOCKED')).to_be_visible()
    expect(page.get_by_text(data['location'], exact=True)).to_be_visible()
    page.screenshot(path=str(OUT / f'fold-{width}.png'))
    if width == 1440:
        page.evaluate(SET_OBS, {'at': data['at'], 'starPar': data['noisy']})
        expect(page.get_by_role('button', name='Engage fold drive')).to_have_count(0)
        page.evaluate(SET_OBS, {'at': data['at'], 'starPar': data['clear']})
    page.get_by_role('button', name='Engage fold drive').click()
    if width == 1440:
        page.reload(wait_until='domcontentloaded')
    expect(page.get_by_role('status').filter(has_text='Fold complete')).to_be_visible()
    page.get_by_role('button', name='Open debrief').click()
    expect(page.get_by_role('heading', name='Fold complete')).to_be_visible()
    expect(page.get_by_role('button', name=re.compile(r'^Chapter 9'))).to_be_visible()
    assert page.evaluate('__game.getState().outcome') is None
    assert page.evaluate('__game.getState().campaign[8].done')
    assert not page.evaluate("__game.getState().achievements.includes('landed')")
    assert not errors, errors
    print(f'{width}×{height} {difficulty}: logged real sighting, ambiguous and unique fits, reveal and fold passed', flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'))
    for width, height, difficulty in [(390, 844, 'stargazer'), (1440, 900, 'navigator'), (844, 390, 'astronomer')]:
        page = browser.new_page(viewport={'width':width,'height':height}, reduced_motion='reduce')
        exercise(page, width, height, difficulty)
        page.close()
