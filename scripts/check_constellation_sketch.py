"""Exercise sky capture, drawing, saving and the existing wait across layouts."""
from pathlib import Path
import re
import shutil
from playwright.sync_api import expect, sync_playwright

OUTPUT = Path('/tmp/stranded-constellations')
OUTPUT.mkdir(exist_ok=True)
SETUP = """async()=>{
  const {ECHO}=await import('/src/game/echo.ts');
  const {currentWorld}=await import('/src/game/sim.ts');
  const {starAltitude}=await import('/src/engine/sky.ts');
  const {visibleSkyLights}=await import('/src/game/skyObservation.ts');
  const {makeLandscape}=await import('/src/render/terrain.ts');
  const {opticalWeather}=await import('/src/game/observing.ts');
  __game.getState().newGame(316,{difficulty:'navigator',sound:false,survival:false,formulas:true});
  const {system,catalog,solarDay}=currentWorld(), state=__game.getState();
  const land=makeLandscape(system.seed,system.hillHeight);
  let day, night;
  for(let t=0;t<3*solarDay;t+=900){
    const sun=starAltitude(system,t,system.site), weather=opticalWeather(system,state,t);
    if(weather.flare)continue;
    if(day===undefined && sun>.2)day=t;
    if(night===undefined && sun<-.6 && visibleSkyLights(system,catalog,t,
      {az:Math.PI,alt:43*Math.PI/180,fov:95*Math.PI/180,w:320,h:200},land).filter(s=>s.ref.kind==='catalog').length>=3)night=t;
  }
  if(day===undefined || night===undefined)throw Error('Missing sky fixture');
  __clock.t=day;__clock.paused=true;__clock.emit();
  __game.setState({phase:'play',screen:'hub',storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5]});
  return {day,night};
}"""

def open_wait_options(page):
    page.get_by_role('button',name='Next event',exact=True).click()
    menu = page.get_by_role('region',name='Scheduled events',exact=True)
    options = menu.get_by_text('While you wait', exact=True)
    if not options.locator('..').evaluate('el=>el.open'):
        options.click()
    return menu

with sync_playwright() as p:
    browser= p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    for width,height in [(320,740),(1440,900),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height}, reduced_motion='reduce')
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto('http://127.0.0.1:5181/',wait_until='networkidle')
        fixture=page.evaluate(SETUP)
        menu=open_wait_options(page)
        menu.get_by_role('button',name='Review sky observations',exact=True).click()
        assert page.evaluate("__game.getState().screen==='observatory' && __clock.paused && __clock.stopAt===Infinity")
        menu=open_wait_options(page)
        menu.get_by_role('button',name='Open launch planner',exact=True).click()
        assert page.evaluate("__game.getState().screen==='launch' && __clock.paused")
        menu=open_wait_options(page)
        menu.get_by_role('button',name='Open constellation sketchpad',exact=True).click()
        pad=page.get_by_role('region',name='Constellation sketchpad',exact=True)
        pad.get_by_role('button',name='Capture star field',exact=True).click()
        expect(pad.get_by_role('status')).to_contain_text('Too few bright stars')
        page.evaluate("(at)=>{__clock.t=at;__clock.emit()}",fixture['night'])
        pad.get_by_role('button',name='Capture star field',exact=True).click()
        stars=pad.get_by_role('group',name='Stars in your captured field',exact=True).get_by_role('button')
        assert stars.count()>=3
        expect(pad.get_by_role('status')).to_contain_text('Field captured')
        stars.nth(0).press('Enter')
        stars.nth(1).press('Enter')
        expect(pad.get_by_text('1 line',exact=True)).to_be_visible()
        pad.get_by_role('button',name='Undo line',exact=True).click()
        expect(pad.get_by_role('button',name='Save sketch',exact=True)).to_be_disabled()
        stars.nth(1).press('Enter')
        stars.nth(2).press('Enter')
        pad.get_by_label('Sketch name',exact=True).fill('The Lantern')
        pad.get_by_role('button',name='Save sketch',exact=True).click()
        expect(pad.get_by_role('status')).to_contain_text('Saved')
        assert page.evaluate("({sheet:__game.getState().sheet,predictions:__game.getState().predictions.length})")=={'sheet':{},'predictions':0}
        assert page.evaluate('(at)=>__clock.paused&&__clock.t===at&&__clock.stopAt===Infinity',fixture['night'])
        pad.locator('.sketch-chart').first.screenshot(path=str(OUTPUT/f'field-{width}.png'))
        page.reload(wait_until='networkidle')
        menu=open_wait_options(page)
        menu.get_by_role('button',name='Open constellation sketchpad',exact=True).click()
        pad.get_by_text('Saved sketches (1)',exact=True).click()
        pad.get_by_text(re.compile('^The Lantern')).click()
        expect(pad.get_by_role('img',name='Saved pattern with 1 lines')).to_be_visible()
        menu.get_by_role('button',name='Back to next event',exact=True).click()
        due=page.evaluate("""()=>{const s=__game.getState(),at=__clock.t+19800;__game.setState({rover:{dist:0,target:500000,departAt:__clock.t,arriveAt:at}});return at;}""")
        menu.get_by_role('button',name=re.compile('^Camera rover arrival')).click()
        menu.get_by_role('button',name='Wait and pause',exact=True).click()
        summary=menu.get_by_text('While you wait',exact=True)
        if not summary.locator('..').evaluate('el=>el.open'):
            summary.click()
        menu.get_by_role('button',name='Open constellation sketchpad',exact=True).click()
        assert page.evaluate('(at)=>__clock.t<at&&__clock.stopAt===at&&!__clock.paused',due)
        page.wait_for_function('(at)=>__clock.t===at&&__clock.paused&&__game.getState().rover.dist===500000',arg=due)
        expect(pad).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        print(f'{width}×{height}: shortcuts, visible-star capture, drawing, saved sketch and uninterrupted wait passed',flush=True)
        page.close()
