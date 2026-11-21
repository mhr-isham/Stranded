"""MODE-14 UI checks; short timings/placed marks verify data flow, not human accuracy."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

out = Path('/tmp/stranded-environment')
out.mkdir(exist_ok=True)

def setup(page, mode, screen, episode='wind', chapter=1, legacy=False):
    return page.evaluate('''async({mode,screen,episode,chapter,legacy})=>{
      const {windAt,rawHumidK}=await import('/src/game/anomalies.ts');
      const {ECHO}=await import('/src/game/echo.ts');
      __game.getState().newGame(316,{difficulty:mode,sound:false,survival:false,formulas:true,freeRoam:true,challenges:mode==='legend'?['seeing']:[]},chapter);
      if(legacy)__game.setState({settings:{...__game.getState().settings,rulesetVersion:2}});
      let at=1;
      if(episode!=='none')for(let day=0;day<300;day++){const t=day*86400+1;if(episode==='wind'?windAt(__game.getState(),t)>6:rawHumidK(__game.getState(),t)>0){at=t;break;}}
      __clock.t=at;__clock.paused=true;__clock.emit();
      __game.setState({phase:'play',screen,savedT:at,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),readings:[],sheet:{}});
      return at;
    }''', {'mode': mode, 'screen': screen, 'episode': episode, 'chapter': chapter, 'legacy': legacy})

def keep_timing(page):
    page.locator('[data-tut="pend-scale"] canvas').click(position={'x':100,'y':20})
    page.get_by_role('button',name='Release',exact=True).click()
    page.get_by_role('button',name='Start',exact=True).click()
    assert page.get_by_role('button',name='Remove windscreen',exact=True).is_disabled()
    page.wait_for_timeout(250)
    page.get_by_role('button',name='Stop',exact=True).click()
    page.locator('.modal input').fill('1')
    page.get_by_role('button',name='Calculate g',exact=True).click()
    # Changing setup after the measurement must not rewrite its provenance.
    page.get_by_role('button',name='Remove windscreen',exact=True).click()
    page.get_by_role('button',name='Keep reading',exact=True).click()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        page.set_default_timeout(15000)
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        at=setup(page,'legend','pendulum')
        page.screenshot(path=str(out/f'exposed-wind-{width}.png'))
        page.get_by_role('button',name='Fit windscreen',exact=True).click()
        keep_timing(page)
        assert page.evaluate('__game.getState().readings[0].environment.wind.protection')=='windscreen'
        notes=page.locator('.measurement-notes').first
        notes.locator('summary').click()
        assert 'no numerical wind correction' in notes.inner_text().lower()
        assert page.evaluate('__game.getState().readings[0].environment.at')==at
        page.get_by_role('button',name='Fit windscreen',exact=True).click()
        page.reload(wait_until='networkidle')
        assert page.get_by_role('button',name='Remove windscreen',exact=True).get_attribute('aria-pressed')=='true'
        assert page.evaluate('__game.getState().readings[0].environment.wind.protection')=='windscreen'
        page.get_by_role('button',name='Remove windscreen',exact=True).scroll_into_view_if_needed()
        page.screenshot(path=str(out/f'wind-{width}.png'))

        at=setup(page,'astronomer','hill','humidity')
        conditions=page.locator('[aria-label="Horizon conditions"]')
        select=conditions.get_by_role('combobox',name='Angle treatment')
        assert select.input_value()=='raw'
        assert select.locator('option[value="auto"]').count()==0
        select.select_option('manual')
        assert page.get_by_role('button',name='Read angle',exact=True).is_disabled()
        conditions.get_by_role('button',name='Sample local air',exact=True).click()
        assert float(conditions.get_by_role('textbox',name='Your refraction k',exact=True).input_value())>0
        conditions.get_by_role('textbox',name='Your refraction k',exact=True).fill('1')
        assert page.get_by_role('button',name='Read angle',exact=True).is_disabled()
        conditions.get_by_role('textbox',name='Your refraction k',exact=True).fill('.2')
        conditions.get_by_role('textbox',name='± uncertainty in k',exact=True).fill('.02')
        page.get_by_role('button',name='Read angle',exact=True).click()
        result=page.locator('[data-tut="hill-result"]')
        assert result.get_by_text('Your refraction correction',exact=True).is_visible()
        # Advance the weather after reading; its saved time/conditions stay frozen.
        page.evaluate('__clock.t+=13*3600;__clock.emit()')
        page.get_by_role('button',name='Keep reading',exact=True).click()
        saved=page.evaluate('__game.getState().readings[0]')
        assert saved['at']==at
        assert saved['environment']['horizon']['damp']
        assert saved['environment']['rawValue']>saved['value']
        assert saved['environment']['horizon']['correction']['source']=='player'
        notes=page.locator('.measurement-notes').first
        notes.locator('summary').click()
        assert 'Instrument result:' in notes.inner_text() and 'Used result:' in notes.inner_text()
        sender=page.locator('[data-tut="hill-send"]')
        sender.locator('input').fill('.000001')
        assert sender.get_by_role('button',name='Send to progress sheet',exact=True).is_disabled()
        sender.get_by_role('button',name='Use scatter + model estimate',exact=True).click()
        sender.get_by_role('button',name='Send to progress sheet',exact=True).click()
        assert page.evaluate('__game.getState().sheet.R1.sigma')>=saved['environment']['horizon']['correction']['sigmaValue']
        notes.scroll_into_view_if_needed()
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
        page.screenshot(path=str(out/f'refraction-{width}.png'))
        page.reload(wait_until='networkidle')
        assert page.evaluate('__game.getState().readings[0]')==saved

        setup(page,'cadet','hill','humidity')
        assert page.get_by_role('combobox',name='Angle treatment').input_value()=='auto'
        page.get_by_role('button',name='Read angle',exact=True).click()
        assert page.locator('[data-tut="hill-result"]').get_by_text('ECHO humidity correction',exact=True).is_visible()
        page.get_by_role('button',name='Keep reading',exact=True).click()
        assert page.evaluate('__game.getState().readings[0].environment.horizon.correction.source')=='echo-humidity'
        setup(page,'cadet','hill','humidity',legacy=True)
        assert page.get_by_role('combobox',name='Angle treatment').input_value()=='raw'
        assert 'Legacy compensated sight' in page.locator('[aria-label="Horizon conditions"]').inner_text()
        page.get_by_role('button',name='Read angle',exact=True).click()
        page.get_by_role('button',name='Keep reading',exact=True).click()
        assert page.evaluate('__game.getState().readings[0].environment.horizon.legacyCompensated')
        assert page.evaluate('__game.getState().readings[0].environment.horizon.correction===undefined')

        # Seeing methods remain readable in Legend, including the persistent season.
        setup(page,'legend','observatory','none')
        page.evaluate("async()=>{const t=await __tut.tutorial();t.emitTut('micro-ready')}")
        quality=page.get_by_role('region',name='Telescope conditions')
        quality.get_by_text('Conditions and methods',exact=True).click()
        assert 'bad-seeing season' in quality.inner_text()
        assert 'Identical repeats' in quality.inner_text()
        quality.scroll_into_view_if_needed()
        page.screenshot(path=str(out/f'seeing-{width}.png'))
        setup(page,'legend','rover','none')
        capture_at=page.evaluate('''async()=>{
          const {currentWorld}=await import('/src/game/sim.ts');
          const {parallaxSite,targetSkyLimits}=await import('/src/engine/measure.ts');
          const {localFrame,toHorizontal,topocentric}=await import('/src/engine/sky.ts');
          const tut=await __tut.tutorial(); const sys=currentWorld().system;
          const site=parallaxSite(sys,sys.site,1e6),lim=targetSkyLimits(sys);
          const info=(at,p)=>{const f=localFrame(sys,at,p);return {a:toHorizontal(topocentric(sys,'target',at,p),f).alt,s:toHorizontal(topocentric(sys,'star',at,p),f).alt}};
          const start=tut.tutorialOppositions()[0]; let found=null;
          for(let hour=0;hour<360;hour++){const t=start+hour*3600,a=info(t,sys.site),b=info(t,site);if(a.a>lim.par&&b.a>lim.par&&a.s<lim.sun&&b.s<lim.sun){found=t;break;}}
          if(found===null)throw Error('No simultaneous-imaging test window');
          __clock.t=found;__clock.paused=true;__clock.emit();
          __game.setState({identified:true,rover:{dist:1e6,target:1e6,departAt:0,arriveAt:0}});return found;
        }''')
        page.get_by_role('button',name='Take simultaneous images',exact=True).click()
        page.get_by_role('button',name='Mark in A',exact=True).click()
        page.locator('[data-tut="rover-stage"] canvas').click(position={'x':100,'y':150})
        page.get_by_role('button',name='Mark in B',exact=True).click()
        page.locator('[data-tut="rover-stage"] canvas').click(position={'x':120,'y':150})
        page.get_by_role('button',name='Keep reading',exact=True).click()
        captured=page.evaluate('__game.getState().readings[0]')
        assert captured['environment']['seeing']['frozen']
        assert captured['at']==capture_at
        quality=page.get_by_role('region',name='Telescope conditions')
        before=quality.inner_text()
        page.evaluate('__clock.t+=86400;__clock.emit()')
        page.wait_for_timeout(600)
        assert quality.inner_text()==before
        notes=page.locator('.measurement-notes').first
        notes.locator('summary').click()
        assert 'not independent exposures' in notes.inner_text()
        notes.scroll_into_view_if_needed()
        page.screenshot(path=str(out/f'rover-{width}.png'))
        if width==1440:
            setup(page,'cadet','rover','none',chapter=6)
            page.evaluate('''async()=>{const{currentWorld}=await import('/src/game/sim.ts');const{flaresOf}=await import('/src/engine/flares.ts');const f=flaresOf(currentWorld().system)[0];__clock.t=(f.start+f.end)/2;__clock.paused=true;__clock.emit();__game.setState({identified:true,rover:{dist:1e6,target:1e6,departAt:0,arriveAt:0}})}''')
            assert page.get_by_role('button',name='Take simultaneous images',exact=True).is_disabled()
            page.get_by_text('Flare glare — wait for it to fade.',exact=False).wait_for(state='visible')
        assert not errors,errors
        page.close()
    browser.close()
print('PASS environmental UI: windscreen and frozen/reloaded timings, expert refraction inputs/provenance/uncertainty floor, ECHO/manual/legacy treatment, Legend seeing methods, frozen rover images and flare blocking at phone/desktop widths')
