"""Follow a real generated lunar eclipse and keep live telescope sightings."""
from pathlib import Path
import shutil
from playwright.sync_api import expect, sync_playwright

out = Path('/tmp/stranded-lunar-eclipse')
out.mkdir(exist_ok=True)

fixture = """async () => {
  const { lunarLight, lunarExposure } = await import('/src/engine/eclipse.ts');
  const { apparentMoonDisks } = await import('/src/engine/occultation.ts');
  const { opticalStatus } = await import('/src/game/observing.ts');
  const { currentWorld } = await import('/src/game/sim.ts');
  const { ECHO } = await import('/src/game/echo.ts');
  const { dot, unit } = await import('/src/engine/vec.ts');
  const { DAY, DEG } = await import('/src/engine/constants.ts');
  __game.getState().newGame(316,{difficulty:'navigator',survival:false,sound:false,formulas:true});
  const s=__game.getState(), {system}=currentWorld();
  function view(at, lighting) {
    const {moon, light}=apparentMoonDisks(system,at);
    const status=opticalStatus(system,s,at,'moon-watch',{direction:moon});
    if (!status.ok || status.alt < 20*DEG || status.sunAlt > -8*DEG || light < 1) return null;
    const d=unit(moon);
    if (dot(unit(lighting.toStar),d) > .9) return null;
    const {fraction,darkEdge}=lunarExposure(lighting,d);
    return lighting.shadow==='total'?'dark':fraction>.94?'steady':darkEdge?'shadow':'dim';
  }
  const result={};
  // Daylight can interrupt a passage. Use visible frames from later eclipses
  // when a single night does not cover every phase.
  for (let t=0;t<350*DAY;t+=120) {
    const light=lunarLight(system,t);
    const stage=view(t,light);
    if (stage==='steady' && result.dark) { result.after=t; break; }
    if (stage==='steady' && !result.dim) result.before=t;
    if (stage==='dim' && result.before) result.dim ??= t;
    if (stage==='shadow' && result.dim) {
      const {moon}=apparentMoonDisks(system,t);
      const {fraction}=lunarExposure(light,unit(moon));
      if (fraction>.24 && fraction<.67) result.shadow ??= t;
    }
    if (stage==='dark' && result.shadow) result.dark ??= t;
  }
  if (result.after) {
    __clock.t=result.before; __clock.paused=true; __clock.emit();
    __game.setState({phase:'play',screen:'observatory',identified:true,storyQueue:[],echo:[],
      seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5]});
    return result;
  }
  throw Error('Missing visible eclipse frames: '+JSON.stringify(result)+'');
}"""

def at(page, when):
    page.evaluate('t => { __clock.t = t; __clock.paused = true; __clock.emit(); }', when)

def open_watch(page):
    page.get_by_role('button', name='Moon', exact=True).click()
    page.get_by_role('button', name='Open eclipse watch', exact=True).click()
    return page.get_by_role('region', name='Lunar eclipse watch', exact=True)

def centre_brightness(canvas):
    return canvas.evaluate("""c => {
      const size=Math.max(4,Math.floor(Math.min(c.width,c.height)*.05));
      const rgba=c.getContext('2d').getImageData(c.width/2-size/2,c.height/2-size/2,size,size).data;
      return rgba.reduce((sum,n,i)=>sum+(i%4===1?n:0),0)/(size*size);
    }""")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    for width,height in [(320,740),(390,844),(1440,900),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height}, reduced_motion='reduce')
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto('http://127.0.0.1:5187/',wait_until='domcontentloaded')
        page.wait_for_function('window.__game && window.__clock')
        event=page.evaluate(fixture)
        watch=open_watch(page)
        canvas=page.locator('.tool-stage canvas')
        status=watch.get_by_role('status')
        expect(status).to_have_text('Moonlight steady.')
        watch.get_by_role('button',name='+5 min',exact=True).click()
        assert page.evaluate('__clock.t') == event['before']+300
        at(page,event['before'])
        expect(status).to_have_text('Moonlight steady.')
        bright=centre_brightness(canvas)
        for stage, message in [
            ('dim','Moonlight is dimmer'),('shadow','A dark shadow cuts'),('dark','The disk has gone dark.'),('after','Moonlight steady.')
        ]:
            at(page,event[stage])
            expect(status).to_contain_text(message)
            if stage in ['shadow','dark']:
                canvas.screenshot(path=str(out/f'{stage}-{width}.png'))
            if stage == 'dark':
                assert bright > centre_brightness(canvas)+55
            watch.get_by_label('Observation note (optional)').fill('Watched the limb' if stage=='shadow' else '')
            watch.get_by_role('button',name='Keep moon sighting',exact=True).click()
        watch.get_by_role('button',name='Keep moon sighting',exact=True).click()
        expect(watch.get_by_text('Sighting updated.',exact=True)).to_be_visible()
        assert page.evaluate('__game.getState().eclipseSightings.length') == 4
        assert page.evaluate('__game.getState().sheet.Pm === undefined')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('window.__game && window.__clock')
        watch=open_watch(page)
        watch.get_by_text('Eclipse log (4)',exact=True).click()
        expect(watch.get_by_text('Watched the limb',exact=True)).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors, errors
        print(f'{width}×{height}: real penumbra, partial and total shadow, disk fade, log and reload passed',flush=True)
        page.close()
