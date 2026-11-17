"""SCI-12 native comparison, reflection, saved-note and persistence flows.
Stored-observation fixtures seed both instruments; the existing hill/shadow
browser checks separately exercise native physical acquisition and provenance.
"""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-radius-cross-check');out.mkdir(exist_ok=True)
def panel(page): return page.locator('[aria-label="Two-method radius cross-check"]')
def fields(page,hill='400',shadow='400'):
    p=panel(page)
    p.get_by_label('Hill uncertainty for cross-check in kilometres',exact=True).fill(hill)
    p.get_by_label('Shadow uncertainty for cross-check in kilometres',exact=True).fill(shadow)
def compare(page):panel(page).get_by_role('button',name='Compare my stated ranges',exact=True).click()
def setup(page,mode='navigator'):
    return page.evaluate('''async(mode)=>{
      const {currentWorld}=await import('/src/game/sim.ts');const {makeShadowCapture,markedShadow,nextShadowNoon,compareShadows}=await import('/src/game/shadowObservation.ts');const {correctHorizon}=await import('/src/game/measurementEnvironment.ts');const {ECHO}=await import('/src/game/echo.ts');
      __game.getState().newGame(316,{difficulty:mode,sound:false,survival:false,formulas:false,freeRoam:true});const sys=currentWorld().system,t=nextShadowNoon(sys,0),frame=makeShadowCapture(sys,t,800000,1000,'browser-pair');
      if(!frame)throw Error('No fixture pair');const shadows=[markedShadow(frame,'camp',frame.camp.length,.01),markedShadow(frame,'rover',frame.rover.length,.01)];const R=compareShadows(shadows).result.radius,height=1001.7,angle=Math.acos((R*1.05)/(R*1.05+height)),r=correctHorizon(height,angle);
      __clock.t=t;__clock.paused=true;__clock.emit();__game.setState({phase:'play',screen:'gnomon',storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5],radiusFieldNote:null,radiusDiscoveries:null,shadows,northTrip:{dist:800000,arriveAt:0},sheet:{R1:{value:1234,sigma:10}},readings:[{id:'hill-fixture',key:'R1',value:r.radius,at:1200,kept:true,note:'Summit · instrument fixture',environment:{instrument:'horizon',at:1200,rawValue:r.radius,horizon:{station:'Summit',height,rawAngle:angle,usedAngle:angle,damp:false}}}]});return {t,R,hill:r.radius};
    }''',mode)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,1000),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        page.set_default_timeout(20000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle');fixture=setup(page)
        p1=panel(page);expect(p1).to_be_visible();assert not p1.get_attribute('open')
        assert page.locator('.lesson-modal').count()==0 and p1.locator('[aria-label="Requested radius comparison"]').count()==0
        before=page.evaluate('({t:__clock.t,sheet:__game.getState().sheet,penalty:__game.getState().penaltyDv,hints:__game.getState().hintsUsed,checks:__game.getState().checksUsed,achievements:__game.getState().achievements})')
        p1.locator('summary').first.click()
        expect(p1.get_by_role('button',name='Compare my stated ranges',exact=True)).to_be_disabled()
        fields(page,'-1','400');expect(p1.get_by_role('button',name='Compare my stated ranges',exact=True)).to_be_disabled()
        fields(page,'400','400');compare(page)
        reveal=p1.locator('[aria-label="Requested radius comparison"]');expect(reveal).to_contain_text('Your stated ranges overlap')
        assert reveal.locator('details[open]').count()==0
        reveal.get_by_role('button',name='Shared errors matter',exact=True).click()
        reveal.get_by_text('Add your own words',exact=True).click()
        p1.get_by_label('My radius cross-check field note',exact=True).fill('The two observations overlap, but the same atmosphere still matters.\nI want to compare them on a clearer day.')
        reveal.get_by_role('button',name='Keep my field discovery',exact=True).click()
        expect(p1.get_by_role('status')).to_contain_text('Field discovery kept')
        first=page.evaluate('__game.getState().radiusDiscoveries.first');note=page.evaluate('__game.getState().radiusFieldNote')
        assert note['comparison']['hillRadius']!=1234 and note['comparison']['hillRadius']==fixture['hill']
        reveal.get_by_role('button',name='Update my expedition field note',exact=True).click()
        expect(p1.get_by_role('status')).to_contain_text('already kept')
        # A mismatch receives the same recognition and only updates the existing note.
        fields(page,'1','1');p1.get_by_label('Relationship between radius calibrations',exact=True).select_option('linked');compare(page)
        expect(reveal).to_contain_text('Your stated ranges are separated')
        expect(reveal).to_contain_text('not independent corroboration')
        reveal.get_by_role('button',name='I want more evidence',exact=True).click()
        reveal.get_by_role('button',name='Update my expedition field note',exact=True).click()
        expect(p1.get_by_role('status')).to_contain_text('recognition is unchanged')
        assert page.evaluate('__game.getState().radiusDiscoveries.first')==first
        assert page.evaluate('__game.getState().radiusDiscoveries.latest.comparison.outcome')=='apart'
        assert before==page.evaluate('({t:__clock.t,sheet:__game.getState().sheet,penalty:__game.getState().penaltyDv,hints:__game.getState().hintsUsed,checks:__game.getState().checksUsed,achievements:__game.getState().achievements})')
        reveal.scroll_into_view_if_needed();page.screenshot(path=str(out/f'comparison-{width}.png'))
        # Revisions invalidate the preview and do not rewrite the archived snapshot.
        old=page.evaluate('__game.getState().radiusFieldNote')
        page.evaluate('__game.setState({shadows:__game.getState().shadows.map(r=>r.site==="camp"?{...r,sigmaLength:.02}:r)})')
        expect(p1).to_contain_text('source observations were revised')
        assert p1.locator('[aria-label="Requested radius comparison"]').count()==0
        assert page.evaluate('__game.getState().radiusFieldNote')==old
        p1.get_by_role('button',name='Read my field discovery in the Codex',exact=True).click()
        saved=page.get_by_role('region',name='Saved radius field discoveries',exact=True);expect(saved).to_be_visible()
        expect(saved).to_contain_text('saved snapshot is unchanged')
        assert saved.get_by_role('group',name='Choose a saved radius discovery',exact=True).get_by_role('button').count()==2
        saved.get_by_role('button',name='First discovery',exact=True).click();expect(saved).to_contain_text('Your stated ranges overlap')
        saved.get_by_role('button',name='This expedition',exact=True).click();expect(saved).to_contain_text('Your stated ranges are separated')
        saved.scroll_into_view_if_needed();page.screenshot(path=str(out/f'discovery-{width}.png'))
        page.reload(wait_until='networkidle');assert page.evaluate('__game.getState().radiusFieldNote')==old
        # The same optional tool is present on the hill, and discarded data are not offered.
        page.evaluate('__game.getState().go("hill")');p1=panel(page);p1.locator('summary').first.click()
        page.evaluate('__game.getState().toggleReading("hill-fixture")');expect(p1).to_contain_text('A hill observation is needed')
        assert p1.get_by_role('button',name='Compare my stated ranges',exact=True).count()==0
        # Main-game independent modes receive no automatic error fill or unsolicited preview.
        setup(page,'legend');p1=panel(page);assert not p1.get_attribute('open');p1.locator('summary').first.click()
        assert p1.get_by_role('button',name='Use recorded shadow error estimate',exact=True).count()==0
        assert p1.locator('[aria-label="Requested radius comparison"]').count()==0
        fields(page,'500','500');compare(page);expect(p1).to_contain_text('Your stated ranges overlap')
        for locator in [p1.get_by_label('Hill observation for cross-check',exact=True),p1.get_by_label('Relationship between radius calibrations',exact=True)]:
            box=locator.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1
        assert not errors,errors
        page.close()
    browser.close()
print('PASS requested range comparisons, both outcomes, linked calibration, entered uncertainty, reflection, bounded recognition, immutable/stale notes, Codex first/latest, reload, kept-data guards, no score/resource/sheet/time effects, independent-mode defaults and phone/desktop/landscape layouts')
