"""Check the real aurora scene, aiming, weather, and photo recovery."""
from pathlib import Path
import re
import shutil
from playwright.sync_api import expect, sync_playwright

out = Path('/tmp/stranded-aurora-preview')
out.mkdir(exist_ok=True)
fixture = """async () => {
  const { ECHO }=await import('/src/game/echo.ts');
  const { auroraView }=await import('/src/game/auroraWatch.ts');
  const { auroraStorm }=await import('/src/engine/aurora.ts');
  const { currentWorld }=await import('/src/game/sim.ts');
  const { isCloudy }=await import('/src/game/survival.ts');
  const { makeLandscape }=await import('/src/render/terrain.ts');
  const { starAltitude }=await import('/src/engine/sky.ts');
  const { DAY, DEG }=await import('/src/engine/constants.ts');
  __game.getState().newGame(316,{difficulty:'navigator',survival:false,sound:false,formulas:true});
  const s=__game.getState(), {system}=currentWorld(), land=makeLandscape(system.seed,system.hillHeight);
  let at=null, inactive=null, strength=0;
  for(let t=120;t<180*DAY;t+=1200){
    const view=auroraView(system,s,land,t,0), storm=auroraStorm(system,t);
    if(inactive===null && view.reason.includes('no auroral')) inactive=t;
    if(view.direction && storm.strength>strength && isCloudy(s.seed,t) && starAltitude(system,t,system.site)<-17*DEG){
      at=t; strength=storm.strength;
      if(strength>.93 && Math.asin(view.direction[2])>.10) break;
    }
  }
  if(at===null || inactive===null) throw Error('Missing a generated aurora watch fixture');
  __clock.t=inactive; __clock.paused=true; __clock.emit();
  __game.setState({phase:'play',screen:'observatory',identified:true,storyQueue:[],echo:[],
    seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});
  return {at,inactive};
}"""

def at(page, instant):
    page.evaluate('t => { __clock.t = t; __clock.paused = true; __clock.emit(); }', instant)

def open_watch(page):
    page.get_by_role('button',name='Open aurora watch',exact=True).click()
    return page.get_by_role('region',name='Aurora watch',exact=True)

def green_pixels(canvas):
    return canvas.evaluate("""c=>{
      const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let green=0;
      for(let i=0;i<data.length;i+=16) if(data[i+1]>45 && data[i+1]>data[i]+13 && data[i+1]>data[i+2]+8) green++;
      return green;
    }""")

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    for width,height in [(320,740),(390,844),(1440,900),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce' if width!=1440 else 'no-preference')
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto('http://127.0.0.1:5194/',wait_until='domcontentloaded')
        page.wait_for_function('window.__game && window.__clock')
        times=page.evaluate(fixture)
        watch=open_watch(page)
        status=watch.get_by_role('status')
        expect(status).to_contain_text('no auroral activity')
        save=watch.get_by_role('button',name='Keep aurora view',exact=True)
        expect(save).to_be_disabled()
        at(page,times['at'])
        expect(status).to_contain_text('Aurora visible')
        watch.get_by_role('button',name='Face the glow',exact=True).click()
        live=page.locator('.tool-stage canvas')
        page.wait_for_function("""()=>{
          const c=document.querySelector('.tool-stage canvas'), data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          let count=0;
          for(let i=0;i<data.length;i+=16) if(data[i+1]>45 && data[i+1]>data[i]+13 && data[i+1]>data[i+2]+8) if(++count>15) return true;
          return false;
        }""")
        live.screenshot(path=str(out/f'live-{width}.png'))
        page.evaluate("""()=>{
          const prior=__game.getState(), save=document.querySelector('.moon-watch .btn.primary');
          __game.setState({settings:{...prior.settings,survival:true}});
          save.click();
        }""")
        expect(status).to_contain_text('Clouds cover')
        expect(save).to_be_disabled()
        assert page.evaluate('__game.getState().auroraPhotos.length')==0
        page.evaluate('__game.setState({settings:{...__game.getState().settings,survival:false}})')
        expect(save).to_be_enabled()
        save.click()
        assert page.evaluate('__clock.t')==times['at']
        phase=page.evaluate('__game.getState().auroraPhotos[0].phase')
        assert (phase==0 if width!=1440 else phase>0)
        photo=page.get_by_role('region',name='Aurora photograph',exact=True)
        expect(photo.get_by_role('heading',name='Aurora photograph')).to_be_focused()
        assert green_pixels(photo.get_by_role('img'))>15
        photo.screenshot(path=str(out/f'photo-{width}.png'))
        page.get_by_role('button',name='Close',exact=True).click()
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('window.__game && window.__clock')
        watch=open_watch(page)
        watch.get_by_text('Aurora photos (1)',exact=True).click()
        watch.get_by_role('button',name=re.compile(r'^Aurora · Day')).click()
        expect(photo).to_be_visible()
        assert green_pixels(photo.get_by_role('img'))>15
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        print(f'{width}×{height}: curtains, face glow, cloud guard, motion and photo recovery passed',flush=True)
        page.close()
