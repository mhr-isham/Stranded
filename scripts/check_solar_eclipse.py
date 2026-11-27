"""Check real destination eclipse previews and ensure the expedition clock stays put."""
from pathlib import Path
import shutil
from playwright.sync_api import expect, sync_playwright

out = Path('/tmp/stranded-beacon-eclipse')
out.mkdir(exist_ok=True)

fixture = """async ({chapter,wanted})=>{
  const {currentWorld}=await import('/src/game/sim.ts');
  const {botPlay,PERFECT}=await import('/src/engine/solver.ts');
  const {bestTransfer}=await import('/src/engine/planner.ts');
  const {beaconSolarFrame,nextBeaconEclipse}=await import('/src/engine/solarEclipse.ts');
  const {ECHO}=await import('/src/game/echo.ts');
  for(const seed of [316,3,21,42,91,127,218,1,2,6,11,19,58]){
    __game.getState().newGame(seed,{difficulty:'navigator',survival:false,freeRoam:true,formulas:true,sound:false},chapter);
    const {system}=currentWorld();
    const measured=botPlay(system,PERFECT,7);
    if(measured.result?.outcome!=='success') continue;
    const plan=bestTransfer(measured.model,measured.departTime).plan;
    const arrival=plan.departTime+plan.tof;
    let start=arrival;
    for(let n=0;n<6;n++){
      const pass=nextBeaconEclipse(system,start);
      if(!pass) break;
      let at=null;
      for(let t=pass.from;t<=pass.to;t+=30) {
        const frame=beaconSolarFrame(system,t);
        if(frame.overlap?.kind!==wanted) continue;
        // Choose a total eclipse whose Moon leaves some of the illustrated
        // inner corona in sight. Much larger apparent moons can hide it.
        if(wanted==='total' && frame.moon.radius/frame.starRadius>=1.8) continue;
        at=t; break;
      }
      if(at!==null){
        __clock.t=arrival; __clock.paused=true;
        __game.setState({phase:'results',screen:'hub',
          outcome:{plan,result:measured.result,sheet:measured.primaries}, sheet:measured.primaries,
          arrival:{landing:'clean',site:'flat'}, storyQueue:[], echo:[], seenEcho:Object.values(ECHO).map(e=>e.id)});
        return {arrival,at:at-pass.from,nexts:n};
      }
      start=pass.to+300;
    }
  }
  throw Error('No generated '+wanted+' view');
}"""

def pixel_samples(canvas):
    return canvas.evaluate("""c=>{
      const ctx=c.getContext('2d'), w=c.width,h=c.height;
      const one=(x,y)=>Array.from(ctx.getImageData(Math.floor(w*x),Math.floor(h*y),1,1).data);
      const rgba=ctx.getImageData(0,0,w,h).data;
      let corona=0;
      for(let i=0;i<rgba.length;i+=16) if(rgba[i+2]>38&&rgba[i+2]>rgba[i]+6) corona++;
      return {center:one(.5,.5),edge:one(.02,.02),corona};
    }""")

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    for width,height,chapter,kind in [(320,740,9,'annular'),(390,844,1,'total'),(1440,900,1,'total'),(844,390,9,'annular')]:
        page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:5200/',wait_until='domcontentloaded')
        page.wait_for_function('Boolean(window.__game && window.__clock)')
        eclipse=page.evaluate(fixture,{'chapter':chapter,'wanted':kind})
        page.evaluate('__game.setState({storyQueue:[],echo:[]})')
        open_button=page.get_by_role('button',name='Open beacon eclipse watch',exact=True)
        open_button.click()
        watch=page.get_by_role('region',name='Beacon eclipse watch',exact=True)
        expect(watch.get_by_role('heading')).to_be_focused()
        for _ in range(eclipse['nexts']):
            watch.get_by_role('button',name='Next eclipse',exact=True).click()
        slider=watch.get_by_role('slider',name='Eclipse preview time')
        canvas=watch.get_by_role('img')
        slider.evaluate("""(slider,offset)=>{
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(slider,String(Math.round(offset)));
          slider.dispatchEvent(new Event('input',{bubbles:true}));
        }""",eclipse['at'])
        expect(watch.get_by_role('status')).to_have_text(kind.capitalize()+' eclipse')
        page.wait_for_timeout(100)
        samples=pixel_samples(canvas)
        assert max(samples['center'][:3])<30,samples
        if kind=='total':
            assert samples['corona']>15,samples
            expect(watch.get_by_text('The corona is illustrated.',exact=False)).to_be_visible()
        else:
            assert samples['edge'][0]<30,samples
            expect(watch.get_by_text('Solar-filter camera',exact=False)).to_be_visible()
        watch.screenshot(path=str(out/f'{kind}-{width}.png'))
        at=slider.input_value()
        watch.get_by_role('button',name='Play passage',exact=True).click()
        expect(slider).not_to_have_value(at)
        watch.get_by_role('button',name='Pause passage',exact=True).click()
        page.keyboard.press('Escape')
        expect(watch).to_have_count(0)
        expect(open_button).to_be_focused()
        assert page.evaluate('__clock.t')==eclipse['arrival']
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        print(f'{width}×{height}: {kind} geometry, image, playback and unchanged expedition clock passed',flush=True)
        page.close()
