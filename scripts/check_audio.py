"""Render and verify Stranded audio in Chromium. Requires Python Playwright and a fresh Vite dev server."""
import argparse, base64, json, pathlib, shutil, wave
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://localhost:5173/')
parser.add_argument('--output', default='/tmp/stranded-audio-check')
parser.add_argument('--browser', default=shutil.which('chromium'))
args=parser.parse_args()
OUT=pathlib.Path(args.output)
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':900})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''
 window.__audio=[];
 const Native=window.AudioContext;
 window.AudioContext=class extends Native {
   constructor(...args) {
     super(...args); this.sources=0; this.live=0; window.__audio.push(this);
   }
   createOscillator() { const s=super.createOscillator(); this.sources++; this.live++; s.addEventListener('ended',()=>this.live--); return s; }
   createBufferSource() { const s=super.createBufferSource(); this.sources++; this.live++; s.addEventListener('ended',()=>this.live--); return s; }
   createDynamicsCompressor() {const c=super.createDynamicsCompressor(); this.meter=super.createAnalyser(); this.meter.fftSize=2048;c.connect(this.meter);return c;}
 };
 ''')
 page.goto(args.url,wait_until='networkidle')
 assert page.evaluate('window.__audio.length')==0,'audio began before a gesture'
 page.mouse.click(10,10)
 page.wait_for_timeout(1200)
 print('LIVE START',page.evaluate('({contexts:__audio.length,state:__audio[0]?.state,sources:__audio[0]?.sources,live:__audio[0]?.live})'))
 # Render a full harmony cycle from the actual music voices, plus every effect.
 result=page.evaluate('''async () => {
   const {Synth}=await import('/src/game/synth.ts');
   const {scoreStep,STEP_SECONDS}=await import('/src/game/score.ts');
   const outputs={};
   const scenes=['explore','focus','flight','story','success','failure','flight-mix','flight-max'];
   const cues=['click','tick','measure','shutter','radio','log','good','bad','unlock','launch','chute','touchdown'];
   for(const kind of [...scenes,...cues,'engine']) {
     const isScene=scenes.includes(kind), length=isScene ? 128*STEP_SECONDS+2 : kind==='engine'?5:3;
     const c=new OfflineAudioContext(2,Math.ceil(length*24000),24000);
     const comp=c.createDynamicsCompressor(); comp.threshold.value=-12; comp.knee.value=12; comp.ratio.value=5; comp.attack.value=.003; comp.release.value=.18;comp.connect(c.destination);
     const master=c.createGain(); master.gain.value=.8;
     const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=28;master.connect(hp).connect(comp);
     const bus=c.createGain();bus.gain.value=isScene?(kind==='flight-max'?1:.65):.8;bus.connect(master);
     const s=new Synth(c,bus,isScene);
     if(isScene) { s.out.gain.value=1.8*(kind==='focus'?.7:kind==='story'?.38:1);for(let i=0;i<128;i++)scoreStep(kind.startsWith('flight-')?'flight':kind,i).forEach(n=>s.note(n,.05+i*STEP_SECONDS)); }
     if(kind.startsWith('flight-')){const fx=c.createGain();fx.gain.value=kind==='flight-max'?1:.8;fx.connect(master);const effects=new Synth(c,fx);const e=effects.engine(fx);e.set(.85,.4);effects.cue('launch',.05);effects.cue('unlock',.15);}
     else if(kind==='engine') {const e=s.engine(bus);e.set(.85,.35);}
     else if(!isScene) s.cue(kind,.05);
     const b=await c.startRendering();
     let peak=0,ss=0,clipped=0,nonfinite=0;
     for(let ch=0;ch<b.numberOfChannels;ch++) for(const v of b.getChannelData(ch)){if(!Number.isFinite(v))nonfinite++;peak=Math.max(peak,Math.abs(v));ss+=v*v;if(Math.abs(v)>=.99)clipped++;}
     const data=new Int16Array(b.length*2);
     for(let i=0;i<b.length;i++)for(let ch=0;ch<2;ch++)data[i*2+ch]=Math.round(Math.max(-1,Math.min(1,b.getChannelData(ch)[i]))*32767);
     const bytes=new Uint8Array(data.buffer);let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));
     outputs[kind]={peak,rms:Math.sqrt(ss/(b.length*2)),clipped,nonfinite,pcm:btoa(str)};
   }
   return outputs;
 }''')
 for name,data in result.items():
  pcm=base64.b64decode(data.pop('pcm'))
  with wave.open(str(OUT/(name+'.wav')),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(24000);w.writeframes(pcm)
  assert data['nonfinite']==0 and data['clipped']==0,(name,data)
  assert data['rms']>.0001,(name,'silent')
 print('RENDERS',json.dumps(result,indent=2))
 (OUT/'render-metrics.json').write_text(json.dumps(result,indent=2))
 # Test main mix mute/restore and independent levels against live waveform.
 page.evaluate('''async()=>{const {useGame}=await import('/src/game/store.ts');useGame.setState({phase:'play',screen:'hub',storyQueue:[]});}''')
 def meter():
  return page.evaluate('''()=>{const c=__audio[0],d=new Float32Array(c.meter.fftSize);c.meter.getFloatTimeDomainData(d);return {rms:Math.sqrt(d.reduce((s,v)=>s+v*v,0)/d.length),live:c.live,sources:c.sources,state:c.state}}''')
 page.wait_for_timeout(1000);print('EXPLORATION',meter())
 page.evaluate('''async()=>{const{useGame}=await import('/src/game/store.ts');const s=useGame.getState();s.set({settings:{...s.settings,sound:false}})}''')
 page.wait_for_timeout(1200);muted=meter(); print('MUTED',muted);assert muted['rms']<.0001
 page.mouse.click(10,10)
 page.evaluate('''async()=>{const{useGame}=await import('/src/game/store.ts');const s=useGame.getState();s.set({settings:{...s.settings,sound:true}})}''')
 page.mouse.click(10,10);page.wait_for_timeout(1200);assert meter()['rms']>.0001
 page.evaluate('''async()=>{const{useGame}=await import('/src/game/store.ts');const s=useGame.getState();s.set({settings:{...s.settings,musicVolume:0}})}''')
 page.wait_for_timeout(1800);assert meter()['rms']<.0001,'music volume zero is not silent'
 page.evaluate('''async()=>{const{setRumble,sfx}=await import('/src/game/audio.ts');setRumble(.8,.4);sfx('shutter')}''')
 page.wait_for_timeout(600);print('EFFECTS ONLY',meter(),page.evaluate('window.__game.getState().settings'));assert meter()['rms']>.001,'effects muted with music'
 page.evaluate('''async()=>{const{useGame}=await import('/src/game/store.ts');const s=useGame.getState();s.set({settings:{...s.settings,effectsVolume:0}})}''')
 page.wait_for_timeout(1000);assert meter()['rms']<.0001,'effects volume zero is not silent'
 page.evaluate('''async()=>{const{stopRumble}=await import('/src/game/audio.ts');stopRumble();const{useGame}=await import('/src/game/store.ts');const s=useGame.getState();s.set({settings:{...s.settings,musicVolume:.65,effectsVolume:.8}})}''')
 page.wait_for_timeout(1000)
 # Background suspension and return, without creating another context.
 page.evaluate('''()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}''')
 page.wait_for_timeout(200);assert meter()['state']=='suspended'
 page.evaluate('''()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));}''')
 page.mouse.click(10,10);page.wait_for_timeout(600);assert meter()['state']=='running'
 # Exercise real screen components and the sound settings controls.
 page.evaluate('''async()=>{const{useGame}=await import('/src/game/store.ts');useGame.setState({phase:'play',screen:'pendulum',storyQueue:[],actsSeen:[1,2,3,4,5]});}''')
 page.wait_for_timeout(800)
 if page.get_by_role('button',name='Got it',exact=True).count():page.get_by_role('button',name='Got it',exact=True).click()
 page.screenshot(path=str(OUT/'desktop-pendulum.png'))
 page.get_by_role('button',name='Menu',exact=True).click();page.wait_for_timeout(400)
 page.get_by_role('slider',name='Music volume').fill('0.3')
 page.get_by_role('slider',name='Sound effects volume').fill('0.55')
 assert page.evaluate('window.__game.getState().settings.musicVolume')==.3
 page.screenshot(path=str(OUT/'desktop-audio-settings.png'))
 page.get_by_role('button',name='Resume',exact=True).click()
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500)
 page.get_by_role('button',name='Menu',exact=True).click();page.wait_for_timeout(400)
 page.screenshot(path=str(OUT/'mobile-audio-settings.png'))
 assert page.get_by_role('slider',name='Music volume').is_visible()
 page.get_by_role('button',name='Sound',exact=True).click()
 page.wait_for_timeout(400);assert meter()['rms']<.0001
 page.get_by_role('button',name='Sound',exact=True).click()
 page.wait_for_timeout(600);assert meter()['rms']>.0001
 assert page.evaluate('window.__audio.length')==1,'duplicate audio contexts'
 assert meter()['live']<64,'voices not being released'
 page.get_by_role('button',name='Resume',exact=True).click()
 # A real computed transfer drives the actual Flight component and its engine cues.
 page.set_viewport_size({'width':1440,'height':900})
 page.evaluate('''async()=>{const{useGame}=await import('/src/game/store.ts');const{currentWorld}=await import('/src/game/sim.ts');const{botPlay,PERFECT}=await import('/src/engine/solver.ts');const r=botPlay(currentWorld().system,PERFECT,7);if(!r.result)throw Error('No transfer');const{bestTransfer}=await import('/src/engine/planner.ts');const p=bestTransfer(r.model,r.departTime);useGame.setState({phase:'flight',outcome:{plan:p.plan,result:r.result,sheet:r.primaries}});}''')
 page.wait_for_timeout(800);assert meter()['rms']>.001
 page.screenshot(path=str(OUT/'desktop-flight.png'))
 page.wait_for_timeout(14500)
 assert page.get_by_role('button',name='Land at the beacon').is_enabled()
 page.get_by_role('button',name='Land at the beacon').click()
 page.wait_for_timeout(700);page.screenshot(path=str(OUT/'desktop-landing.png'))
 assert not errors,errors

 page.reload(wait_until='networkidle');page.wait_for_timeout(400)
 assert page.evaluate('window.__game.getState().settings.musicVolume')==.3,'mix did not persist'
 assert not errors, errors
 # Browsers without Web Audio must still run the game after a gesture.
 fallback=browser.new_page()
 fallback_errors=[]
 fallback.on('pageerror',lambda e:fallback_errors.append(str(e)))
 fallback.add_init_script('window.AudioContext=undefined;window.webkitAudioContext=undefined;')
 fallback.goto(args.url,wait_until='networkidle');fallback.mouse.click(10,10)
 fallback.wait_for_timeout(250);assert not fallback_errors,fallback_errors
 print('BROWSER ERRORS',errors)
 print('PASS autoplay, actual score/effects rendering, clipping, mute/re-enable, independent volumes, visibility, desktop/mobile settings, persistence, real transfer/landing, Web Audio fallback')
 browser.close()
