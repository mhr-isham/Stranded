"""Exercise native framing, exposure and saved meteor photographs."""
from pathlib import Path
import re
import shutil
from playwright.sync_api import expect, sync_playwright

out = Path('/tmp/stranded-meteor-watch')
out.mkdir(exist_ok=True)
setup = """async()=>{
  const {ECHO}=await import('/src/game/echo.ts');
  __game.getState().newGame(316,{difficulty:'navigator',survival:false,sound:false,formulas:true});
  __clock.t=0; __clock.paused=true; __clock.emit();
  __game.setState({phase:'play',screen:'observatory',identified:true,storyQueue:[],echo:[],
    seenEcho:Object.values(ECHO).map(line=>line.id),actsSeen:[1,2,3,4,5]});
}"""
fixture = """async()=>{
  const {currentWorld}=await import('/src/game/sim.ts');
  const {meteorWatchStatus, exposeMeteorPhoto, visibleMeteorTrails, METEOR_EXPOSURE}=await import('/src/game/meteorWatch.ts');
  const {isCloudy}=await import('/src/game/survival.ts');
  const {makeLandscape}=await import('/src/render/terrain.ts');
  const {makeProjector}=await import('/src/render/projection.ts');
  const s=__game.getState(), {system}=currentWorld(), c=document.querySelector('.tool-stage canvas');
  // The test pans right once through the actual camera controls.
  const camera={az:195*Math.PI/180,alt:35*Math.PI/180,fov:Math.PI/2,w:c.width,h:c.height};
  const land=makeLandscape(system.seed,system.hillHeight);
  const P=makeProjector(camera);
  let start=null, empty=null, live=null;
  for(let t=360;t<system.home.period*1.2;t+=120){
    const status=meteorWatchStatus(system,s,t);
    if(empty===null && status.available && !status.active) empty=t;
    if(!status.active || !isCloudy(s.seed,t)) continue;
    const photo=exposeMeteorPhoto(system,s,camera,land,t,t+METEOR_EXPOSURE);
    if(!photo || photo.trails.length<(c.width/c.height>3 ? 1 : 3)) continue;
    for(let now=t+3;now<t+METEOR_EXPOSURE&&!live;now+=3){
      for(const trail of visibleMeteorTrails(system,s,now)){
        const a=P.project(trail.from), b=P.project(trail.to);
        if(!a || !b || trail.intensity<.35) continue;
        const x=.2*a.x+.8*b.x, y=.2*a.y+.8*b.y;
        if(x>10&&x<c.width-10&&y>10&&y<c.height*.78) {live={now,x,y,w:c.width,h:c.height};break;}
      }
    }
    if(live){start=t;break;}
  }
  if(start===null || empty===null) throw Error('Expected a clear exposure and an empty frame');
  return {start,empty,live};
}"""

def at(page, t):
    page.evaluate('t=>{__clock.t=t;__clock.paused=true;__clock.emit()}', t)

def open_watch(page):
    page.get_by_role('button',name='Open meteor watch',exact=True).click()
    return page.get_by_role('region',name='Meteor watch',exact=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    for width,height in [(320,740),(390,844),(1440,900),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:5189/',wait_until='domcontentloaded')
        page.wait_for_function('window.__game && window.__clock')
        page.evaluate(setup)
        watch=open_watch(page)
        page.wait_for_function("document.querySelector('.tool-stage canvas')?.width > 0")
        times=page.evaluate(fixture)
        watch.get_by_text('Frame and wait',exact=True).click()
        watch.get_by_role('button',name='Pan sky right',exact=True).click()
        watch.get_by_text('Frame and wait',exact=True).click()
        at(page,times['empty'])
        expect(watch.get_by_role('status')).to_contain_text('no shower activity')
        button=watch.get_by_role('button',name='Expose photo · 90 s',exact=True)
        button.click()
        assert page.evaluate('__clock.t') == times['empty']+90
        expect(watch.get_by_text(re.compile('No clear streaks'))).to_be_visible()
        assert page.evaluate('__game.getState().meteorPhotos.length') == 0
        at(page,times['live']['now'])
        page.wait_for_function("""({x,y,w,h})=>{
          const c=document.querySelector('.tool-stage canvas'), ctx=c.getContext('2d');
          const actualX=c.width/2+(x-w/2)*c.width/w, actualY=c.height/2+(y-h/2)*c.width/w;
          const pixels=ctx.getImageData(Math.floor(actualX)-4,Math.floor(actualY)-4,9,9).data;
          return pixels.some((n,i)=>i%4===1&&n>45);
        }""",arg=times['live'])
        at(page,times['start'])
        expect(watch.get_by_role('status')).to_contain_text('Meteor shower active')
        page.evaluate("""at=>{
          const current=__game.getState(), exposure=document.querySelector('.moon-watch .btn.primary');
          __game.setState({settings:{...current.settings,survival:true}});
          __clock.t=at;
          exposure.click();
        }""",times['start'])
        expect(watch.get_by_role('status')).to_contain_text('Clouds cover')
        expect(button).to_be_disabled()
        assert page.evaluate('__clock.t') == times['start']
        page.evaluate('__game.setState({settings:{...__game.getState().settings,survival:false}})')
        expect(button).to_be_enabled()
        button.click()
        assert page.evaluate('__clock.t') == times['start']+90
        assert page.evaluate('__clock.paused')
        photo=page.get_by_role('region',name='Meteor photograph',exact=True)
        expect(photo).to_be_visible()
        expect(photo.get_by_role('heading',name='Meteor photograph')).to_be_focused()
        expect(photo.get_by_role('img',name=re.compile('Night sky photograph'))).to_be_visible()
        assert page.evaluate('__game.getState().meteorPhotos[0].trails.length')>=1
        photo.screenshot(path=str(out/f'shower-{width}.png'))
        page.get_by_role('button',name='Close',exact=True).click()
        watch.get_by_role('button',name='Watch at 1 min/s',exact=True).click()
        page.wait_for_function('__clock.rate === 60')
        watch.get_by_role('button',name='Hold sky',exact=True).click()
        assert page.evaluate('__clock.paused')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('window.__game && window.__clock')
        watch=open_watch(page)
        watch.get_by_text('Meteor photos (1)',exact=True).click()
        watch.get_by_role('button',name=re.compile(r'Day .*streaks?')).click()
        expect(photo).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        print(f'{width}×{height}: framing, exposure, empty and cloudy frames, clock and saved photograph passed',flush=True)
        page.close()
