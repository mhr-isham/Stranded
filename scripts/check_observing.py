"""SCI-22: shared live availability, low-clutter feedback and recording guards.
Fixtures choose observing instants and deploy a rover without charging travel;
native buttons take the actual readings. These are UI/consistency checks, not
human accuracy tests or evidence of long-term engagement.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-observing');out.mkdir(exist_ok=True)
def setup(page,chapter,screen,difficulty='cadet'):
    page.evaluate('''async({chapter,screen,difficulty})=>{const {ECHO}=await import('/src/game/echo.ts');__game.getState().newGame(316,{difficulty,survival:true,sound:false,formulas:true},chapter);__clock.paused=true;__clock.t=0;__clock.emit();__game.setState({phase:'play',screen,identified:true,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});}''',{'chapter':chapter,'screen':screen,'difficulty':difficulty})
def at(page,t):page.evaluate('(t)=>{__clock.t=t;__clock.paused=true;__clock.emit()}',t);page.wait_for_timeout(180)
def raw(page,key):return page.evaluate('(key)=>JSON.stringify(__game.getState()[key])',key)
def find(page,method,code='ready',both=False):
    return page.evaluate('''async({method,code,both})=>{
      const {currentWorld}=await import('/src/game/sim.ts');const {opticalStatus}=await import('/src/game/observing.ts');
      const {nearStarsOf}=await import('/src/engine/nearstars.ts');const {parallaxSite}=await import('/src/engine/measure.ts');
      const {localFrame,topocentric,toHorizontal}=await import('/src/engine/sky.ts');const {makeLandscape}=await import('/src/render/terrain.ts');const {skyline}=await import('/src/game/skyObservation.ts');
      const s=__game.getState(),{system:sys,catalog}=currentWorld(),land=makeLandscape(sys.seed,sys.hillHeight),star=nearStarsOf(sys)[0];
      for(let k=0;k<7000;k++){
        const t=k*(method==='solar-year'?300:1800);let options={};
        if(method==='nearby-star')options.direction=catalog[star.index].dir;
        if(method==='solar-year'||method==='diameter'){const pos=toHorizontal(topocentric(sys,method==='solar-year'?'star':'target',t,sys.site),localFrame(sys,t,sys.site));options.horizon=skyline(land,pos.az);}
        const a=opticalStatus(sys,s,t,method,options);
        if(code==='rover-only'){const b=opticalStatus(sys,s,t,method,{site:parallaxSite(sys,sys.site,s.rover.dist)});if(a.ok&&!b.ok)return t;continue;}
        if(a.code!==code)continue;
        if(both&&!opticalStatus(sys,s,t,method,{site:parallaxSite(sys,sys.site,s.rover.dist)}).ok)continue;
        return t;
      }throw Error('No observing fixture '+method+' '+code);
    }''',{'method':method,'code':code,'both':both})
def stale_click(page,t,selector):
    page.evaluate('''({t,selector})=>{__clock.t=t;const b=document.querySelector(selector);if(!b||b.disabled)throw Error('Expected an enabled stale button');b.click();}''',{'t':t,'selector':selector})
def check_status(page,phrase):
    status=page.get_by_label('Observing availability',exact=True)
    expect(status).to_contain_text(phrase)
    assert status.locator(':scope > div').count()==1
    assert status.locator('details[open]').count()==0
    return status
def hud_fits(page):
    assert page.locator('.hud').evaluate('''hud=>{const boxes=[...hud.children].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.getBoundingClientRect());return boxes.every((b,i)=>b.left>=0&&b.right<=innerWidth+1&&(!i||b.left>=boxes[i-1].right-1));}'''), 'Visible HUD controls overlap or leave the viewport'
    assert page.locator('.hud-time .day').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    expect(page.get_by_role('button',name='Menu',exact=True)).to_be_visible()
    expect(page.locator('.hud-ready')).to_be_visible()
    page.get_by_role('button',name='Menu',exact=True).click();expect(page.get_by_role('heading',name='Expedition',exact=True)).to_be_visible()
    page.get_by_role('button',name='Resume',exact=True).click()
    page.locator('.hud-ready').click();expect(page.get_by_role('heading',name='Mission readiness',exact=True)).to_be_visible()
    page.keyboard.press('Escape')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height,difficulty in [(390,844,'cadet'),(1440,1000,'astronomer'),(844,390,'legend')]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1,reduced_motion='reduce')
        page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
        setup(page,8,'observatory',difficulty)
        ready=find(page,'nearby-star');cloud=find(page,'nearby-star','clouds');low=find(page,'nearby-star','low');day=find(page,'nearby-star','daylight')
        at(page,ready);page.get_by_role('button',name='Stars',exact=True).click()
        hud_fits(page)
        log=page.get_by_role('button',name=re.compile('^Log .+position$'));expect(log).to_be_enabled()
        check_status(page,'View usable.');log.click();original=raw(page,'starPar')
        # Use the real DOM button without emitting a clock refresh. The recording
        # handler must reject the now-obscured view before generating a sample.
        log.evaluate('(b)=>b.setAttribute("data-check-record","star")')
        stale_click(page,cloud,'[data-check-record="star"]');assert raw(page,'starPar')==original
        at(page,cloud);expect(log).to_be_disabled();check_status(page,'Cloud cover')
        page.get_by_text('Recorded position log',exact=True).click();expect(page.locator('table.log').first).to_contain_text('Position scan')
        assert raw(page,'starPar')==original
        for t,reason in [(low,'Target too low'),(day,'Sky too bright')]:
            at(page,t);expect(log).to_be_disabled();check_status(page,reason);assert raw(page,'starPar')==original
        page.evaluate('__game.setState(s=>({settings:{...s.settings,challenges:[...(s.settings.challenges??[]),"seeing"]}}))')
        at(page,ready);expect(log).to_be_enabled();status=check_status(page,'View usable.')
        status.get_by_text('View details',exact=True).click();expect(status).to_contain_text('Turbulent image; usable views can still be measured')
        log.click();assert page.evaluate('__game.getState().starPar.at(-1).environment.seeing.factor')>=3
        status.get_by_text('View details',exact=True).click();status.scroll_into_view_if_needed();page.screenshot(path=str(out/f'star-status-{width}.png'))
        # The solar-filter method remains a usable daytime/twilight exception.
        setup(page,1,'observatory',difficulty);ready=find(page,'solar-year');cloud=find(page,'solar-year','clouds');at(page,ready)
        page.get_by_role('button',name='Year',exact=True).click();page.locator('[data-tut="year-point"]').click()
        log=page.locator('[data-tut="year-log"]');expect(log).to_be_enabled();check_status(page,'View usable.')
        stale_click(page,cloud,'[data-tut="year-log"]');assert page.evaluate('__game.getState().starObs.length')==0
        at(page,ready);expect(log).to_be_enabled();log.click();assert page.evaluate('__game.getState().starObs[0].source')=='manual'
        # A stale micrometer button also rechecks weather before keeping wires.
        setup(page,1,'observatory',difficulty);ready=find(page,'diameter');cloud=find(page,'diameter','clouds');at(page,ready)
        page.get_by_role('button',name='Micrometer',exact=True).click();page.locator('[data-tut="micro-point"]').click()
        log=page.locator('[data-tut="micro-log"]');expect(log).to_be_enabled();check_status(page,'View usable.');page.wait_for_timeout(100)
        stale_click(page,cloud,'[data-tut="micro-log"]');assert page.evaluate('__game.getState().readings.length')==0
        at(page,cloud);expect(log).to_be_disabled();check_status(page,'Cloud cover')
        # Both rover sites are assessed. A blocked new capture leaves the saved
        # pair, its marks and original seeing quality available for inspection.
        setup(page,1,'rover',difficulty)
        page.evaluate('__game.setState({rover:{dist:1e6,target:1e6,departAt:0,arriveAt:0}})')
        ready=find(page,'parallax',both=True);cloud=find(page,'parallax','clouds');single=find(page,'parallax','rover-only');at(page,ready)
        capture=page.get_by_role('button',name='Take simultaneous images',exact=True);expect(capture).to_be_enabled()
        capture.evaluate('(b)=>b.setAttribute("data-check-record","pair")');stale_click(page,single,'[data-check-record="pair"]')
        assert page.evaluate('__game.getState().parallaxPair') is None
        at(page,single);expect(capture).to_be_disabled();check_status(page,'Rover:')
        at(page,ready);expect(capture).to_be_enabled()
        capture.evaluate('(b)=>b.setAttribute("data-check-record","pair")');stale_click(page,cloud,'[data-check-record="pair"]')
        assert page.evaluate('__game.getState().parallaxPair') is None
        at(page,ready);capture.click();original=raw(page,'parallaxPair');factor=page.evaluate('__game.getState().parallaxPair.seeing')
        page.evaluate('__game.setState(s=>({settings:{...s.settings,challenges:[...(s.settings.challenges??[]),"seeing"]}}))')
        at(page,cloud);expect(capture).to_be_disabled();check_status(page,'Cloud cover')
        conditions=page.get_by_role('region',name='Telescope conditions',exact=True)
        # section has an accessible label but no explicit role on some browsers.
        if not conditions.count():conditions=page.locator('section[aria-label="Telescope conditions"]')
        expect(conditions).to_contain_text('Turbulent air' if factor>1.5 else 'Steadier air')
        assert raw(page,'parallaxPair')==original
        page.reload(wait_until='networkidle');page.evaluate('__clock.paused=true;__clock.emit()');assert raw(page,'parallaxPair')==original
        expect(page.get_by_role('button',name='Mark in A',exact=True)).to_be_visible()
        page.screenshot(path=str(out/f'blocked-frozen-pair-{width}.png'))
        # The locked-world reference tracker remains usable without a solar day,
        # while actual flare glare blocks a fresh log at recording time.
        setup(page,6,'observatory',difficulty);ready=find(page,'locked-year');flare=find(page,'locked-year','flare');at(page,ready)
        page.get_by_role('button',name='Year',exact=True).click();log=page.locator('[data-tut="year-log"]');expect(log).to_be_enabled()
        stale_click(page,flare,'[data-tut="year-log"]');assert page.evaluate('__game.getState().starObs.length')==0
        at(page,flare);expect(log).to_be_disabled();check_status(page,'Flare glare')
        at(page,ready);log.click();assert page.evaluate('__game.getState().starObs[0].source')=='tracker'
        hud_fits(page)
        # The inner-planet alternate route is requested, and its manually kept
        # candidates have usable senders even when transit photos are unavailable.
        # These arbitrary recorded-date cursor picks test controls, not an
        # inferred physical alignment or accuracy of a player's period estimate.
        setup(page,5,'observatory',difficulty)
        page.evaluate('''async()=>{const {fastForward}=await import('/src/game/sim.ts');__game.setState({trackOn:true});fastForward(110*86400);__game.setState({storyQueue:[],echo:[]});}''')
        page.get_by_role('button',name='Transit',exact=True).click()
        fallback=page.locator('details').filter(has=page.get_by_text('Other ways to time the alignment',exact=True));assert fallback.get_attribute('open') is None
        fallback.locator('summary').click();fallback.get_by_role('button',name='Open planet tracker',exact=True).click()
        dates=page.evaluate('(()=>{const a=__game.getState().track;return [a[Math.floor(a.length/4)].at/86400,a[Math.floor(a.length*3/4)].at/86400]})()')
        for day in dates:
            page.get_by_label('Chart cursor day',exact=True).fill(str(day));page.get_by_role('button',name='Mark candidate alignment',exact=True).click()
        expect(page.get_by_text('Date of passing the star t₀ (latest candidate)',exact=True)).to_be_visible()
        assert page.evaluate('__game.getState().oppPicks.length')==2
        assert page.locator('[data-tut="track-send-S"]').get_by_role('button',name='Send to progress sheet',exact=True).count()==1
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        print(f'{width}×{height}: one-reason/collapsed status; cloud/altitude/daylight gates; rough usable scans; stale-button guards; solar/locked exceptions; frozen data and reload passed')
        page.close()
    browser.close()
