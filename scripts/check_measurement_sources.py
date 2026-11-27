"""SCI-21: error-source teaching and recorded-data consistency.
Generated worksheet/probe fixtures only expose the relevant UI states. Native
scan/log controls create the observations tested below. These checks do not
calibrate a physical instrument or establish learning/long-term enjoyment.
"""
from pathlib import Path
import hashlib
import math
import re
import shutil
import statistics
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-measurement-sources');out.mkdir(exist_ok=True)
def preserved(page):
    return page.evaluate('''()=>{const s=__game.getState();return JSON.stringify({sheet:s.sheet,readings:s.readings,starObs:s.starObs,starPar:s.starPar,t:__clock.t,checks:s.checksUsed,hints:s.hintsUsed,fuel:s.penaltyDv})}''')
def raw(page,key):return page.evaluate('(key)=>JSON.stringify(__game.getState()[key])',key)
def pixels(page,label):
    page.evaluate('document.fonts.ready.then(()=>true)');page.wait_for_timeout(180)
    data=page.get_by_role('img',name=label,exact=True).evaluate('(c)=>c.toDataURL()')
    return hashlib.sha256(data.encode()).hexdigest()
def nearby_log(page):
    details=page.locator('details').filter(has=page.get_by_text('Recorded position log',exact=True))
    was_open=details.get_attribute('open') is not None
    if not was_open:details.locator('summary').click()
    text=details.locator('table').inner_text()
    if not was_open:details.locator('summary').click()
    return text
def setup(page,chapter,screen):
    page.evaluate('''async({chapter,screen})=>{
      const {ECHO}=await import('/src/game/echo.ts');
      __game.getState().newGame(316,{difficulty:'cadet',survival:false,sound:false,formulas:true},chapter);
      __clock.paused=true;__clock.t=100;__clock.emit();
      __game.setState({phase:'play',screen,identified:true,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});
    }''',{'chapter':chapter,'screen':screen})
def revisit(page,screen,tab=None):
    page.evaluate("__game.getState().go('sheet')");page.wait_for_timeout(80)
    page.evaluate('(screen)=>__game.getState().go(screen)',screen)
    if tab:page.get_by_role('button',name=tab,exact=True).click()
def reload(page,tab=None):
    page.reload(wait_until='networkidle');page.evaluate('__clock.paused=true;__clock.emit()')
    if tab:page.get_by_role('button',name=tab,exact=True).click()
def checkpoint_round_trip(page,key):
    saved=raw(page,key)
    result=page.evaluate('''async(key)=>{const {saveSlot,loadSlot}=await import('/src/game/checkpoints.ts');const r=saveSlot(0);__game.setState({[key]:key==='probe'?null:[]});return {saved:r,loaded:loadSlot(0)}}''',key)
    assert result['saved'] and result['loaded'],result
    assert raw(page,key)==saved
def values(modal):
    return [float(re.search(r': ([-\d.]+) m$',t).group(1)) for t in modal.locator('svg circle title').all_text_contents()]
def metric(modal,label):return modal.locator('dt').filter(has_text=re.compile('^'+re.escape(label)+'$')).locator('xpath=following-sibling::dd[1]').inner_text()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,1000),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1,reduced_motion='reduce')
        page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
        page.evaluate("__game.getState().newGame(91,{difficulty:'legend',survival:false,sound:false,formulas:true});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}}})")
        before=preserved(page);page.get_by_role('button',name='Flight School',exact=False).click()
        library=page.get_by_role('region',name='Flight School library',exact=True)
        assert library.locator('[data-training]').count()==49
        library.locator('[data-training="lesson:measure"]').get_by_role('button',name=re.compile('^(Open|Repeat)')).click()
        modal=page.locator('.lesson-modal');expect(modal).to_be_visible()
        assert modal.locator('details[open]').count()==0
        expect(modal).to_contain_text('does not measure your real reaction time')
        modal.get_by_role('button',name='Take 10',exact=True).click();modal.get_by_role('button',name='Take 10',exact=True).click()
        v=values(modal);assert len(v)==20
        assert abs(float(metric(modal,'Average').split()[0])-statistics.mean(v))<.00006
        displayed=float(metric(modal,'Scatter-only standard error').replace('±','').split()[0])
        assert abs(displayed-statistics.stdev(v)*1000/math.sqrt(len(v)))<.006
        stored=modal.locator('svg circle').evaluate_all('(els)=>els.map(e=>e.outerHTML)')
        modal.get_by_label('Reveal the truth',exact=True).check()
        assert modal.locator('svg circle').evaluate_all('(els)=>els.map(e=>e.outerHTML)')==stored
        modal.get_by_label('Biased ruler (+6 mm)',exact=True).check();assert values(modal)==[]
        for _ in range(10):modal.get_by_role('button',name='Take 10',exact=True).click()
        v=values(modal);assert len(v)==100 and statistics.mean(v)>1.004
        assert float(metric(modal,'Scatter-only standard error').replace('±','').split()[0])<1
        assert modal.locator('svg circle').evaluate_all('(els)=>els.every(e=>Number(e.getAttribute("cx"))>=30&&Number(e.getAttribute("cx"))<=570)')
        modal.get_by_label('Coarse ruler (2 mm steps)',exact=True).check();assert values(modal)==[]
        modal.get_by_role('button',name='Take 10',exact=True).click();v=values(modal)
        assert all(abs(x/.002-round(x/.002))<1e-8 for x in v)
        notes=modal.get_by_label('Connect error sources to instruments',exact=True);notes.locator('summary').click()
        for term in ['Technique:','Resolution:','receiver scatter:','Shared systematic effects:']:expect(notes).to_contain_text(term)
        assert modal.locator('.katex-error').count()==0
        modal.locator('.lesson-demo').scroll_into_view_if_needed();page.screenshot(path=str(out/f'lesson-{width}.png'))
        modal.get_by_role('button',name='Got it',exact=True).click();assert preserved(page)==before
        # A real saved pass, generated through the existing launch helper. No
        # manual observation accuracy or spacecraft-control accuracy is implied.
        setup(page,2,'probe')
        page.evaluate('''async()=>{const {currentWorld}=await import('/src/game/sim.ts');const {launchProbe}=await import('/src/game/probeState.ts');const s=__game.getState(),sys=currentWorld().system;const patch=launchProbe(sys,s,sys.target.radius*3,100);__game.setState({...patch,probesLaunched:1});__clock.t=patch.probe.arriveAt+4*3600;__clock.emit();}''')
        chart='Recorded probe Doppler samples';expect(page.get_by_role('img',name=chart)).to_be_visible()
        original=raw(page,'probe');image=pixels(page,chart)
        notes=page.get_by_label('Measurement sources',exact=True);assert notes.get_attribute('open') is None
        notes.locator('summary').click();expect(notes).to_contain_text('simplified simulated Doppler scatter')
        assert pixels(page,chart)==image and raw(page,'probe')==original
        altitude=page.get_by_text(re.compile('^At closest approach the probe was')).inner_text()
        page.evaluate('''async()=>{const {currentWorld}=await import('/src/game/sim.ts');const {botMeasure,PERFECT}=await import('/src/engine/solver.ts');const {makeRng}=await import('/src/engine/rng.ts');__game.setState({sheet:botMeasure(currentWorld().system,PERFECT,makeRng(812)).primaries});__clock.t+=86400;__clock.emit();}''')
        assert raw(page,'probe')==original and pixels(page,chart)==image
        assert page.get_by_text(re.compile('^At closest approach the probe was')).inner_text()==altitude
        revisit(page,'probe');assert pixels(page,chart)==image and raw(page,'probe')==original
        checkpoint_round_trip(page,'probe');assert pixels(page,chart)==image
        reload(page);assert raw(page,'probe')==original and pixels(page,chart)==image
        # Native nearby-star scans are generated only on Log. Known and unknown
        # provenance remains distinguishable, without rewriting old samples.
        setup(page,8,'observatory')
        page.evaluate('''async()=>{const {currentWorld}=await import('/src/game/sim.ts');const {nearStarsOf}=await import('/src/engine/nearstars.ts');const {localFrame,topocentric,toHorizontal}=await import('/src/engine/sky.ts');const {DEG}=await import('/src/engine/constants.ts');const {system:sys,catalog}=currentWorld(),star=nearStarsOf(sys)[0];for(let i=0;i<2000;i++){const t=i*sys.home.period/2000,f=localFrame(sys,t,sys.site);if(toHorizontal(topocentric(sys,'star',t,sys.site),f).alt< -12*DEG&&toHorizontal(catalog[star.index].dir,f).alt>15*DEG){__clock.t=t;__clock.emit();return;}}throw Error('No observable nearby-star fixture');}''')
        page.get_by_role('button',name='Stars',exact=True).click()
        log=page.get_by_role('button',name=re.compile('^Log .+position$'));expect(log).to_be_enabled();log.click()
        first=page.evaluate('__game.getState().starPar[0]');assert first['source']=='tracker' and first['environment']['rawValue']==first['v']
        assert abs(first['v']/(math.pi/648000*.001)-round(first['v']/(math.pi/648000*.001)))<1e-7
        log.click();assert page.evaluate('__game.getState().starPar.length')==2
        assert page.evaluate('__game.getState().starPar[0]')==first
        original=raw(page,'starPar');chart='Recorded nearby-star positions';visible_log=nearby_log(page)
        notes=page.get_by_label('Measurement sources',exact=True);assert notes.get_attribute('open') is None
        notes.locator('summary').click();expect(notes).to_contain_text('display resolution is not its accuracy')
        assert raw(page,'starPar')==original and nearby_log(page)==visible_log
        revisit(page,'observatory','Stars');assert raw(page,'starPar')==original, 'Stored nearby-star records changed on navigation'
        assert nearby_log(page)==visible_log
        expect(page.get_by_role('img',name=chart,exact=True)).to_be_visible()
        checkpoint_round_trip(page,'starPar');assert raw(page,'starPar')==original
        reload(page,'Stars');assert raw(page,'starPar')==original and nearby_log(page)==visible_log
        page.get_by_text('Recorded position log',exact=True).click();expect(page.locator('table.log').first).to_contain_text('Position scan')
        page.screenshot(path=str(out/f'nearby-star-log-{width}.png'))
        # Legacy samples retain their numeric values and have no invented source.
        page.evaluate('__game.setState(s=>({starPar:s.starPar.map(({i,at,v})=>({i,at,v}))}))')
        expect(page.locator('table.log').first).to_contain_text('Source not recorded')
        assert page.evaluate('__game.getState().starPar[0].v')==first['v']
        # Locked-world synthetic readings have tracker provenance and are
        # rejected at duplicate dates without producing another saved sample.
        setup(page,6,'observatory')
        page.evaluate('''async()=>{const {currentWorld}=await import('/src/game/sim.ts');const {flareAt}=await import('/src/engine/flares.ts');const sys=currentWorld().system;let t=100;while(flareAt(sys,t))t+=86400;__clock.t=t;__clock.emit();}''')
        page.get_by_role('button',name='Year',exact=True).click();log=page.get_by_role('button',name='Log the sky’s turn',exact=True)
        log.click();assert page.evaluate('__game.getState().starObs[0].source')=='tracker'
        original=raw(page,'starObs');log.click();assert raw(page,'starObs')==original
        revisit(page,'observatory','Year');assert raw(page,'starObs')==original
        reload(page,'Year');assert raw(page,'starObs')==original
        page.get_by_text('Observation log and conditions',exact=True).click();expect(page.locator('table.log').first).to_contain_text('tracker sample')
        assert page.get_by_label('Measurement sources',exact=True).get_attribute('open') is None
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        print(f'{width}×{height}: lesson statistics/resolution/bias and isolation; recorded probe/star data; native scan provenance; checkpoint/reload; legacy and locked-world records passed')
        page.close()
    browser.close()
