"""Watch real generated occultations through the telescope.

The fixture locates visible contacts so the test can run quickly. The UI gets
only the simulated time and the player still has to keep each live frame.
"""
import re
import shutil
from playwright.sync_api import expect, sync_playwright

SETUP = """async () => {
  const { currentWorld } = await import('/src/game/sim.ts');
  const { moonLight } = await import('/src/engine/occultation.ts');
  const { localFrame, topocentric, toHorizontal } = await import('/src/engine/sky.ts');
  const { isCloudy } = await import('/src/game/survival.ts');
  const { ECHO } = await import('/src/game/echo.ts');
  __game.getState().newGame(316,{difficulty:'navigator',survival:false,formulas:true,sound:false});
  const { system } = currentWorld(), site = system.site, day = 86400;
  const image = at => {
    const target = topocentric(system,'target',at,site), moon = topocentric(system,'moon',at,site);
    return moonLight(target,moon,Math.asin(system.target.radius/Math.hypot(...target)),
      Math.asin(system.moon.radius/Math.hypot(...moon)));
  };
  const clear = at => {
    const frame = localFrame(system,at,site);
    const alt = id => toHorizontal(topocentric(system,id,at,site),frame).alt;
    return alt('star') < -.14 && alt('target') > .34;
  };
  const events = [];
  let start = null;
  for(let at=600; at<350*day && events.length<2; at+=600) {
    if (image(at) === 0) { start ??= at; continue; }
    if (start === null) continue;
    const last = at-600;
    let visible = start-600, returned = at;
    while (image(visible) < 1 && start-visible < 3600) visible-=60;
    while (image(returned) < 1 && returned-last < 3600) returned+=60;
    if (image(visible) === 1 && image(returned) === 1 &&
      start-visible <= 3600 && returned-last <= 3600 &&
      [visible,start,last,returned].every(clear)) events.push([visible,start,last,returned]);
    start=null;
  }
  if (events.length !== 2) throw Error('Need two observable generated events for the fixture');
  __clock.t=events[0][0]; __clock.paused=true; __clock.emit();
  __game.setState({phase:'play',screen:'observatory',identified:true,storyQueue:[],echo:[],
     actsSeen:[1,2,3,4,5],seenEcho:Object.values(ECHO).map(line=>line.id)});
  let cloudy = events[1][3];
  while (!isCloudy(316,cloudy)) cloudy+=day;
  return {events,cloudy};
}"""

def at(page, when):
    page.evaluate('at => { __clock.t = at; __clock.paused = true; __clock.emit(); }', when)

def open_watch(page):
    page.get_by_role('button', name='Moon', exact=True).click()
    page.get_by_role('button', name='Open occultation watch', exact=True).click()
    return page.get_by_role('region', name='Moon occultation watch', exact=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(320, 740), (390, 844), (1440, 900), (844, 390)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('pageerror', lambda err: errors.append(str(err)))
        page.goto('http://127.0.0.1:5184/', wait_until='networkidle')
        fixture = page.evaluate(SETUP)
        watch = open_watch(page)
        expect(watch.get_by_role('status')).to_have_text('Moonlight visible in the eyepiece.')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        initial = fixture['events'][0][0]
        watch.get_by_role('button', name='+1 min', exact=True).click()
        assert page.evaluate('__clock.t') == initial + 60
        for idx, (before, hidden, still, returned) in enumerate(fixture['events']):
            at(page, before)
            expect(watch.get_by_role('status')).to_have_text('Moonlight visible in the eyepiece.')
            watch.get_by_role('button', name='Mark visible', exact=True).click()
            at(page, hidden)
            expect(watch.get_by_role('status')).to_have_text('No moonlight beside the disk.')
            watch.get_by_role('button', name='Mark disappearance', exact=True).click()
            if still > hidden:
                at(page, still)
                watch.get_by_role('button', name='Mark still hidden', exact=True).click()
            at(page, returned)
            expect(watch.get_by_role('status')).to_have_text('Moonlight visible in the eyepiece.')
            watch.get_by_role('button', name='Mark return', exact=True).click()
            expect(watch.get_by_text(f'Watch log ({idx + 1})', exact=True)).to_be_visible()
        log = page.evaluate('__game.getState().occultations')
        assert [list(record.values()) for record in log] == fixture['events']
        assert page.evaluate('__game.getState().sheet.Pm === undefined')
        watch.get_by_text('Watch log (2)', exact=True).click()
        line = watch.get_by_text(re.compile('days per apparent cycle'))
        expected = (sum(fixture['events'][1]) - sum(fixture['events'][0])) / 4 / 86400
        expect(line).to_contain_text(f'{expected:.4f}')
        watch.get_by_label('Cycles between watches').fill('2')
        expect(line).to_contain_text(f'{expected / 2:.4f}')
        page.evaluate("__game.setState({settings:{...__game.getState().settings,survival:true}})")
        at(page, fixture['cloudy'])
        expect(watch.get_by_role('status')).to_contain_text('Cloud cover')
        expect(watch.get_by_role('button', name='Mark visible', exact=True)).to_be_disabled()
        page.reload(wait_until='networkidle')
        watch = open_watch(page)
        expect(watch.get_by_text('Watch log (2)', exact=True)).to_be_visible()
        watch.get_by_role('button', name='Back to moon chart', exact=True).click()
        expect(page.get_by_label('Moon orbit analysis', exact=True)).to_be_visible()
        assert not errors, errors
        print(f'{width}×{height}: real contacts, timestamp log, cycle comparison, cloud guard and reload passed', flush=True)
        page.close()
