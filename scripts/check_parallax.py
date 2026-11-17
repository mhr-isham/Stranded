"""SCI-07: native camera/mark controls and complete optional Flight School work.
Window selection and pixel targeting use deterministic optical fixtures; the
UI still captures, marks, compares, keeps, sends, completes and restores.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-parallax');out.mkdir(exist_ok=True)
def guide(page):return page.get_by_role('dialog',name='Flight School',exact=True)
def library(page):return page.get_by_role('region',name='Flight School library',exact=True)
def expand(page):
    page.wait_for_timeout(200)
    b=guide(page).get_by_role('button',name='Expand',exact=True)
    if b.count():b.click()
def mini(page):
    b=guide(page).get_by_role('button',name='Minimise',exact=True)
    if b.count():b.click()
def step(page,id):
    index=page.evaluate('async(id)=>(await __tut.steps()).STEPS.findIndex(s=>s.id===id)',id)
    page.wait_for_function('(index)=>__game.getState().tutorial.step===index',arg=index)
def canvas(page):return page.locator('[data-tut="rover-stage"] canvas')
def image_point(page,key):
    return page.evaluate('''async(key)=>{const {scopeProjector}=await import('/src/render/telescope.ts');const c=document.querySelector('[data-tut="rover-stage"] canvas'),r=c.getBoundingClientRect(),p=__game.getState().parallaxPair;const slider=document.querySelector('[aria-label="Comparator field in arcseconds"]');const P=scopeProjector({center:p.dirA,fov:Number(slider.value)*Math.PI/648000,w:c.width,h:c.height});const pt=P.project(key==='A'?p.dirA:p.dirB);return {x:pt.x*r.width/c.width,y:pt.y*r.height/c.height}}''',key)
def mark_pair(page):
    for key in ['A','B']:
        page.get_by_role('button',name=f'Mark in {key}',exact=True).click()
        page.wait_for_timeout(60)
        canvas(page).click(position=image_point(page,key))
def window(page,dist=1000000):
    return page.evaluate('''async(dist)=>{
      const {currentWorld}=await import('/src/game/sim.ts');const {parallaxSite,targetSkyLimits}=await import('/src/engine/measure.ts');const {localFrame,toHorizontal,topocentric}=await import('/src/engine/sky.ts');const {flareAt}=await import('/src/engine/flares.ts');
      const sys=currentWorld().system,site=parallaxSite(sys,sys.site,dist),lim=targetSkyLimits(sys),body=sys.giant?'giant':'target';
      const opp=(await __tut.tutorial()).tutorialOppositions()[0];let found=null;
      for(let h=0;h<1440;h++){const at=opp+h*1800;if(flareAt(sys,at))continue;const ok=[sys.site,site].every(p=>{const f=localFrame(sys,at,p);return toHorizontal(topocentric(sys,body,at,p),f).alt>lim.par&&toHorizontal(topocentric(sys,'star',at,p),f).alt<lim.sun});if(ok){found=at;break;}}
      if(found===null)throw Error('No imaging window');__clock.t=found;__clock.paused=true;__clock.emit();__game.setState({identified:true,rover:{dist,target:dist,departAt:0,arriveAt:0}});return found;
    }''',dist)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        page.evaluate('''async()=>{const {ECHO}=await import('/src/game/echo.ts');__game.getState().newGame(316,{difficulty:'legend',sound:false,survival:false,formulas:false,freeRoam:true});__clock.paused=true;__game.setState({phase:'play',screen:'rover',storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});}''')
        at=window(page)
        page.get_by_role('button',name='Take simultaneous images',exact=True).click()
        assert page.get_by_role('region',name='Parallax geometry mini expedition',exact=True).count()==0
        assert page.get_by_role('region',name='Flight School parallax investigation',exact=True).count()==0
        assert page.locator('.lesson-modal').count()==0
        assert page.locator('.katex').count()==0
        expect(page.locator('[data-camera-frame]')).to_contain_text('A · frozen')
        pair=page.evaluate('__game.getState().parallaxPair')
        assert pair['at']==at and pair['projectedBaseline']<=pair['baseline']
        canvas(page).focus();canvas(page).press('Enter')
        page.get_by_role('button',name='Mark in B',exact=True).click();canvas(page).focus();canvas(page).press('Enter')
        assert page.get_by_role('button',name='Keep reading',exact=True).is_disabled()
        canvas(page).press('Shift+ArrowRight')
        assert abs(page.evaluate('__game.getState().parallaxPair.marks.B.x')-.1*3.141592653589793/648000)<1e-12
        mark_pair(page)
        page.get_by_role('button',name='Keep reading',exact=True).click()
        reading=page.evaluate('__game.getState().readings.at(-1)')
        expected=page.evaluate('''async()=>{const {currentWorld}=await import('/src/game/sim.ts');const {targetDistance}=await import('/src/engine/measure.ts');const sys=currentWorld().system;return targetDistance(sys,__game.getState().parallaxPair.at,sys.site)}''')
        # Browser pointer coordinates have finite subpixel resolution; the
        # analytic geometry is checked separately by the unit tests.
        print('Optical centre relative distance',width,reading['value']/expected,flush=True)
        assert abs(reading['value']/expected-1)<.0025
        assert reading['parallax']['captureId']==pair['id']
        count=page.evaluate('__game.getState().readings.length')
        canvas(page).focus();canvas(page).press('ArrowRight')
        page.get_by_role('button',name='Update pair reading',exact=True).click()
        assert page.evaluate('__game.getState().readings.length')==count
        assert page.evaluate('__game.getState().readings.at(-1).at')==at
        frozen=page.evaluate('JSON.stringify(__game.getState().parallaxPair)')
        page.evaluate('__clock.t+=86400;__clock.emit()');page.wait_for_timeout(250)
        assert page.evaluate('JSON.stringify(__game.getState().parallaxPair)')==frozen
        page.reload(wait_until='networkidle')
        assert page.evaluate('JSON.stringify(__game.getState().parallaxPair)')==frozen
        expect(page.locator('[data-camera-frame]')).to_contain_text('A · frozen')
        page.get_by_role('combobox',name='Blink speed',exact=True).select_option('1200')
        page.get_by_role('button',name='Play blink',exact=True).click()
        expect(page.locator('[data-camera-frame]')).to_have_attribute('data-camera-frame','B')
        page.wait_for_timeout(60)
        # Clicking during B must freeze B and write B, even though A was the
        # last manually selected frame before blinking.
        before_a=page.evaluate('__game.getState().parallaxPair.marks.A')
        canvas(page).click(position={'x':canvas(page).bounding_box()['width']*.55,'y':canvas(page).bounding_box()['height']*.5})
        expect(page.locator('[data-camera-frame]')).to_contain_text('B · frozen')
        assert page.evaluate('__game.getState().parallaxPair.marks.A')==before_a
        assert page.get_by_role('button',name='Play blink',exact=True).is_visible()
        slider=page.get_by_role('slider',name='Comparator field in arcseconds',exact=True)
        prior_marks=page.evaluate('__game.getState().parallaxPair.marks')
        slider.focus();slider.press('End')
        assert page.evaluate('__game.getState().parallaxPair.marks')==prior_marks
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(out/f'comparator-{width}.png'))
        if width==844:
            assert not errors,errors;page.close();continue
        # Standalone Flight School geometry experiment leaves the saved game alone.
        page.evaluate("__game.getState().newGame(91,{difficulty:'navigator',sound:false,survival:false,formulas:true});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}},training:{},schoolRewards:{patches:{},cards:{},milestones:{}}})")
        page.get_by_role('button',name='Flight School',exact=False).click()
        library(page).locator('[data-training="lesson:parallax"]').get_by_role('button',name=re.compile('^Open')).click()
        lab=page.get_by_role('region',name='Parallax geometry mini expedition',exact=True)
        lab.get_by_role('img',name='Laser baseline and its sideways component',exact=True).scroll_into_view_if_needed()
        page.screenshot(path=str(out/f'geometry-view-{width}.png'))
        lab.get_by_role('button',name='0° · toward',exact=True).click();expect(lab).to_contain_text('no sideways jump')
        expect(lab.locator('dd').nth(1)).to_have_text('0.000″')
        lab.get_by_role('button',name='Keep teaching comparison',exact=True).click()
        lab.get_by_role('button',name='30° · diagonal',exact=True).click();expect(lab).to_contain_text('Only 50%')
        lab.get_by_role('button',name='Keep teaching comparison',exact=True).click()
        lab.get_by_role('button',name='90° · sideways',exact=True).click();expect(lab).to_contain_text('whole laser baseline')
        lab.get_by_role('button',name='Keep teaching comparison',exact=True).click()
        assert lab.locator('.katex').count()>0 and lab.locator('.katex-error').count()==0
        assert page.evaluate('__clock.t')==123 and page.evaluate('__game.getState().readings.length')==0
        lab.screenshot(path=str(out/f'geometry-{width}.png'))
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        library(page).locator('[data-training="exercise:distance"]').get_by_role('button',name=re.compile('^Open')).click()
        page.wait_for_function('__game.getState().schoolSession?.id==="distance"',timeout=60000)
        page.locator('.lesson-modal').get_by_role('button',name='Close lesson',exact=True).click()
        expand(page);guide(page).get_by_role('button',name='Next',exact=True).click()
        step(page,'go-rover');mini(page)
        page.locator('[data-tut="hotspot-rover"]').click()
        step(page,'rover-drive');mini(page)
        page.get_by_role('button',name='Drive',exact=True).click()
        step(page,'rover-wait');expand(page)
        guide(page).get_by_role('button',name='Fast-forward to imaging night',exact=False).click()
        step(page,'rover-image');mini(page)
        page.get_by_role('button',name='Take simultaneous images',exact=True).click()
        step(page,'rover-blink');mini(page)
        investigation=page.get_by_role('region',name='Flight School parallax investigation',exact=True)
        investigation.get_by_role('combobox',name='My parallax jump prediction',exact=True).select_option('up')
        investigation.get_by_role('button',name='Commit parallax prediction',exact=True).click()
        mark_pair(page)
        investigation.get_by_role('button',name='Compare with my camera marks',exact=True).click()
        expect(investigation.get_by_role('status')).to_contain_text('Your compared marks')
        assert page.evaluate('!!__game.getState().schoolRewards.milestones["predict-parallax"]')
        result=page.evaluate('__game.getState().parallaxPair.prediction.comparison')
        canvas(page).focus();canvas(page).press('ArrowRight')
        assert page.evaluate('__game.getState().parallaxPair.prediction.comparison')==result
        mark_pair(page)
        page.get_by_role('button',name='Keep reading',exact=True).click()
        step(page,'rover-send');mini(page)
        sender=page.locator('[data-tut="rover-send"]')
        own_distance=page.evaluate('__game.getState().readings.at(-1).value')
        sender.locator('input').fill(str(own_distance*.03/1e9))
        sender.get_by_role('button',name='Send to progress sheet',exact=True).click()
        expand(page);guide(page).get_by_role('button',name='Finish exercise',exact=True).click()
        library(page).wait_for()
        assert page.evaluate('__clock.t')==123
        assert page.evaluate('__game.getState().sheet.g.value')==9.81
        assert page.evaluate('__game.getState().parallaxPair') is None
        assert page.evaluate('__game.getState().parallaxInvestigations.length')==0
        assert page.evaluate('__game.getState().penaltyDv')==0
        card=page.evaluate('__game.getState().schoolRewards.cards["exercise:distance"].latest')
        assert card['plot'] and any(r['label']=='Committed parallax prediction' for r in card['summary'])
        assert not card['assisted']
        page.reload(wait_until='networkidle')
        assert page.evaluate('!!__game.getState().schoolRewards.patches["exercise:distance"]')
        assert not errors,errors
        page.close()
    browser.close()
print('PASS parallax visible-frame marking, keyboard/high-DPI controls, blink speed, frozen/persistent pairs, projected distance, one-reading-per-pair, optional main help, Flight School geometry/prediction/native course, rewards and restoration at phone/desktop plus landscape comparator')
