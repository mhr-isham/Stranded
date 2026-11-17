"""SCI-09 live micrometer controls and optional size interpretation.
A deterministic fixture selects an observing window. Native pointer/keyboard
controls place wires; native logs, dated sightings and course completion save it.
"""
from pathlib import Path
import math
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-micrometer');out.mkdir(exist_ok=True)
def wire(page,key):return page.get_by_label(f'Wire {key} position',exact=True)
def value(page,key):return float(wire(page,key).inner_text())
def scope(page):return page.locator('[data-tut="obs-stage"] canvas')
def library(page):return page.get_by_role('region',name='Flight School library',exact=True)
def guide(page):return page.get_by_role('dialog',name='Flight School',exact=True)
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
def coordinates(page,key,field=60):
    box=scope(page).bounding_box();rad=math.pi/648000
    return {'x':box['width']/2+math.tan(value(page,key)*rad)*box['width']/(2*math.tan(field*rad/2)), 'y':box['height']*.5}
def drag(page,start,end):
    box=scope(page).bounding_box()
    page.mouse.move(box['x']+start['x'],box['y']+start['y']);page.mouse.down()
    page.mouse.move(box['x']+end['x'],box['y']+end['y'],steps=8);page.mouse.up()
    page.wait_for_timeout(180)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        at=page.evaluate('''async()=>{
          const {ECHO}=await import('/src/game/echo.ts');const {currentWorld}=await import('/src/game/sim.ts');const {localFrame,toHorizontal,topocentric}=await import('/src/engine/sky.ts');const {flareAt}=await import('/src/engine/flares.ts');
          __game.getState().newGame(316,{difficulty:'legend',sound:false,survival:false,formulas:false,freeRoam:true});const sys=currentWorld().system;let found=null;
          for(let h=0;h<1000;h++){const t=sys.firstOpposition+h*1800,f=localFrame(sys,t,sys.site);if(!flareAt(sys,t)&&toHorizontal(topocentric(sys,'star',t,sys.site),f).alt<-.3&&toHorizontal(topocentric(sys,'target',t,sys.site),f).alt>.65){found=t;break;}}
          if(found===null)throw Error('No observing window');__clock.t=found;__clock.paused=true;__clock.emit();__game.setState({phase:'play',screen:'observatory',identified:true,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});return found;
        }''')
        page.get_by_role('button',name='Micrometer',exact=True).click()
        point=page.get_by_role('button',name='Point at the blue planet (1′ field)',exact=True)
        point.click();expect(page.get_by_role('group',name='Micrometer wire controls',exact=True)).to_be_visible()
        page.wait_for_timeout(200)
        assert page.get_by_role('region',name='Flight School angular-size investigation',exact=True).count()==0
        assert page.locator('.lesson-modal').count()==0 and page.locator('.katex').count()==0
        a,b=value(page,'A'),value(page,'B')
        scope(page).focus();scope(page).press('2');scope(page).press('Shift+ArrowRight');page.wait_for_timeout(160)
        assert abs(value(page,'B')-b-.01)<.002
        expect(page.get_by_role('button',name='Wire B',exact=True)).to_have_attribute('aria-pressed','true')
        page.get_by_role('button',name='Move selected wire left',exact=True).click();page.wait_for_timeout(160)
        assert abs(value(page,'B')-b+.09)<.002
        # Start 20 CSS pixels from B: high-DPI hit area must remain 24 CSS px,
        # and the grab offset must prevent jumping to the finger position.
        before=value(page,'B');pos=coordinates(page,'B');pos['x']+=20
        drag(page,pos,{'x':pos['x']+8,'y':pos['y']})
        moved=value(page,'B')-before
        assert abs(moved-8*60/scope(page).bounding_box()['width'])<.02
        assert abs(value(page,'A')-a)<.002
        page.get_by_role('button',name='Pan image',exact=True).click()
        before=(value(page,'A'),value(page,'B'));pos=coordinates(page,'B')
        drag(page,pos,{'x':pos['x']+8,'y':pos['y']})
        assert (value(page,'A'),value(page,'B'))==before
        # Coincident wires must not log a diameter.
        page.get_by_role('button',name='Wire B',exact=True).click()
        drag(page,coordinates(page,'B'),coordinates(page,'A'))
        assert float(page.get_by_label('Measured angular diameter',exact=True).inner_text().replace('″',''))<.05
        page.get_by_role('button',name='Log diameter',exact=True).click()
        assert page.evaluate('__game.getState().readings.length')==0
        point.click();page.wait_for_timeout(150)
        page.get_by_role('button',name='Log diameter',exact=True).click()
        assert page.evaluate('__game.getState().readings.length')==1
        first=page.evaluate('__game.getState().readings[0]')
        assert first['at']==at and first['micrometer']['revisions']==0
        page.get_by_role('button',name='Wire B',exact=True).click()
        page.get_by_role('button',name='Move selected wire right',exact=True).click()
        page.get_by_role('button',name='Log diameter',exact=True).click()
        assert page.evaluate('__game.getState().readings.length')==1
        assert page.evaluate('__game.getState().readings[0].micrometer.revisions')==1
        before=(value(page,'A'),value(page,'B'))
        page.get_by_role('button',name='Magnify micrometer image',exact=True).click()
        page.get_by_role('button',name='Widen micrometer image',exact=True).click();page.wait_for_timeout(150)
        assert (value(page,'A'),value(page,'B'))==before
        page.evaluate('__ff(__clock.t+60);__clock.paused=true;__clock.emit()');page.wait_for_timeout(250)
        page.get_by_role('button',name='Log diameter',exact=True).click()
        assert page.evaluate('__game.getState().readings.length')==2
        assert page.evaluate('__game.getState().readings[0].environment.at')==at
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(out/f'controls-{width}.png'))
        # Below-horizon acquisition remains blocked.
        page.evaluate('''async()=>{const {currentWorld}=await import('/src/game/sim.ts');const {localFrame,toHorizontal,topocentric}=await import('/src/engine/sky.ts');const sys=currentWorld().system;for(let h=1;h<100;h++){const t=__clock.t+h*3600;if(toHorizontal(topocentric(sys,'target',t,sys.site),localFrame(sys,t,sys.site)).alt<-.2){__clock.t=t;__clock.emit();break;}}}''')
        expect(page.get_by_role('button',name='Log diameter',exact=True)).to_be_disabled()
        page.reload(wait_until='networkidle')
        assert page.evaluate('__game.getState().readings[0].micrometer.revisions')==1
        if width==844:
            assert not errors,errors;page.close();continue
        # Real focused size exercise, supplied orbital prerequisites labelled.
        page.evaluate("__game.getState().newGame(91,{difficulty:'navigator',sound:false,survival:false,formulas:true});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}},training:{},schoolRewards:{patches:{},cards:{},milestones:{}}})")
        page.get_by_role('button',name='Flight School',exact=False).click()
        library(page).locator('[data-training="exercise:size"]').get_by_role('button',name=re.compile('^Open')).click()
        page.wait_for_function('__game.getState().schoolSession?.id==="size"',timeout=60000)
        lab=page.get_by_role('region',name='Angular size and uncertainty mini expedition',exact=True)
        lesson_t=page.evaluate('__clock.t')
        r1=float(lab.locator('[data-size-radius]').get_attribute('data-size-radius'))
        lab.get_by_role('button',name='Keep teaching size calculation',exact=True).click()
        lab.get_by_role('button',name='Double the distance, keep the angle',exact=True).click()
        r2=float(lab.locator('[data-size-radius]').get_attribute('data-size-radius'))
        assert abs(r2/r1-2)<1e-10
        lab.get_by_role('button',name='Keep teaching size calculation',exact=True).click()
        assert page.evaluate('__clock.t')==lesson_t and page.evaluate('__game.getState().readings.length')==0
        assert lab.locator('.katex').count()>0 and lab.locator('.katex-error').count()==0
        lab.get_by_role('img',name='Apparent disk angle and physical planet radius',exact=True).scroll_into_view_if_needed()
        page.screenshot(path=str(out/f'teaching-{width}.png'))
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        expand(page);guide(page).get_by_role('button',name='Next',exact=True).click()
        step(page,'micro-point');expand(page)
        if page.evaluate('__game.getState().screen')!='observatory':guide(page).get_by_role('button',name='Take me there',exact=True).click()
        page.get_by_role('button',name='Micrometer',exact=True).click()
        page.get_by_role('button',name='Point at the blue planet (1′ field)',exact=True).click()
        step(page,'micro-measure');mini(page)
        investigation=page.get_by_role('region',name='Flight School angular-size investigation',exact=True)
        for i in range(3):
            if i:investigation.get_by_role('button',name='Next practice sighting (+60 s)',exact=True).click();page.wait_for_timeout(180)
            page.get_by_role('button',name='Wire B',exact=True).click()
            page.get_by_role('button',name='Move selected wire right',exact=True).click()
            page.get_by_role('button',name='Log diameter',exact=True).click()
        step(page,'micro-send');mini(page)
        assert page.evaluate('new Set(__game.getState().readings.filter(r=>r.key==="alpha2").map(r=>r.at)).size')==3
        investigation.get_by_role('spinbutton',name='My angular uncertainty (arcsec)',exact=True).fill('.5')
        expect(investigation).to_contain_text('Inferred physical radius')
        investigation.get_by_role('button',name='Save my size interpretation',exact=True).click()
        expect(investigation.get_by_role('status')).to_contain_text('Interpretation saved')
        review=page.evaluate('__game.getState().readings.at(-1).micrometer.interpretation')
        assert review['radius']>0 and review['sigmaModel']>0 and review['sigmaAngle']>0
        investigation.scroll_into_view_if_needed();page.screenshot(path=str(out/f'interpretation-{width}.png'))
        # Revising a sighting clears its previous calculation; save the new one.
        page.get_by_role('button',name='Move selected wire right',exact=True).click()
        page.get_by_role('button',name='Log diameter',exact=True).click()
        assert page.evaluate('__game.getState().readings.at(-1).micrometer.interpretation===undefined')
        investigation.get_by_role('button',name='Save my size interpretation',exact=True).click()
        sender=page.locator('[data-tut="micro-send"]');sender.locator('input').fill('.5')
        sender.get_by_role('button',name='Send to progress sheet',exact=True).click()
        expand(page);guide(page).get_by_role('button',name='Finish exercise',exact=True).click()
        library(page).wait_for()
        assert page.evaluate('__clock.t')==123 and page.evaluate('__game.getState().sheet.g.value')==9.81
        assert page.evaluate('__game.getState().readings.length')==0
        cards=page.evaluate('__game.getState().schoolRewards.cards')
        assert cards['lesson:angular']['latest']['kind']=='teaching' and len(cards['lesson:angular']['latest']['plot'])==2
        assert any(r['label']=='Your size interpretation' for r in cards['exercise:size']['latest']['summary'])
        assert not cards['exercise:size']['latest']['assisted']
        assert page.evaluate('__game.getState().penaltyDv')==0
        page.reload(wait_until='networkidle')
        assert page.evaluate('!!__game.getState().schoolRewards.patches["exercise:size"]')
        assert not errors,errors
        page.close()
    browser.close()
print('PASS micrometer selected/nearest-wire controls, retina grab offsets, keyboard/fine adjustment, pan/zoom, overlap/horizon guards, same-epoch revisions, new dated sightings, saved conditions, optional Angular lesson/real size investigation, uncertainty contributions and expedition restoration at phone/desktop plus landscape controls')
