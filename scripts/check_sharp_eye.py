"""SCI-23: native measurements, once-only evidence credit, persistence and UI.
The fixture chooses recorded weather and uses model periods only to schedule
test waiting. Bonus eligibility never receives hidden gravity/radius. No full
human expedition, measurement accuracy or long-term enjoyment is implied.
"""
from pathlib import Path
import re
import shutil
import sys
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-sharp-eye');out.mkdir(exist_ok=True)
def points(page):return page.evaluate('async()=>{const{sharpEyePoints}=await import("/src/game/sharpEye.ts");return sharpEyePoints(__game.getState())}')
def ledger(page):return page.evaluate('JSON.stringify(__game.getState().sharpEyeAwards)')
def setup(page):
    return page.evaluate('''async()=>{
      const {world}=await import('/src/game/world.ts');const {surfaceGravity,pendulumPeriod}=await import('/src/engine/measure.ts');const {hash32}=await import('/src/engine/rng.ts');const {windAt,instrumentHumidK}=await import('/src/game/anomalies.ts');const {ECHO}=await import('/src/game/echo.ts');
      let seed=1;while(seed<40&&surfaceGravity(world(seed,'navigator').system)<25)seed++;
      __game.getState().newGame(seed,{difficulty:'navigator',sound:false,survival:false,formulas:true});const {system:sys}=world(seed,'navigator');
      const s=__game.getState();let windy=0,wet=0;while(windAt(s,windy)<=6)windy+=86400;while(instrumentHumidK(s,wet)<=0)wet+=86400;
      windy+=3600;wet+=3600;__clock.t=windy;__clock.paused=true;__clock.emit();
      __game.setState({phase:'play',screen:'pendulum',storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5],readings:[],sheet:{}});
      const length=.6+((hash32(sys.seed,60)/4294967296)*3-1.5)/100;
      return {period:pendulumPeriod(surfaceGravity(sys),length,6*Math.PI/180),wet,dry:wet-wet%86400+18*3600};
    }''')
def timing(page,period):
    page.get_by_role('button',name='Release',exact=True).click();page.get_by_role('button',name='Start',exact=True).click()
    page.wait_for_timeout(period*6.15*1000)
    page.get_by_role('button',name='Stop',exact=True).click();page.locator('.modal input').fill('6')
    page.get_by_role('button',name='Calculate g',exact=True).click();page.get_by_role('button',name='Keep reading',exact=True).click()
def record_horizon(page,t):
    page.evaluate('(t)=>{__clock.t=t;__clock.paused=true;__clock.emit()}',t);page.wait_for_timeout(150)
    canvas=page.get_by_role('img',name='Horizon instrument; arrows adjust pitch, plus or minus zoom, Space braces, Enter reads',exact=True)
    canvas.focus();canvas.press('ArrowDown');canvas.press('ArrowUp');canvas.press('Enter')
    page.get_by_role('button',name='Keep reading',exact=True).click()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in ([(844,390)] if '--landscape' in sys.argv else [(390,844),(1440,1000),(844,390)]):
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1,reduced_motion='reduce')
        page.set_default_timeout(30000);errors=[]
        def on_error(e):
            stack=getattr(e,'stack',str(e))
            if stack not in errors:errors.append(stack)
        page.on('pageerror',on_error)
        page.goto('http://127.0.0.1:5173/',wait_until='networkidle');f=setup(page)
        page.evaluate('async()=>{const{saveSlot}=await import("/src/game/checkpoints.ts");if(!saveSlot(0))throw Error("Checkpoint failed")};')
        page.get_by_role('slider',name='String length setting',exact=True).focus();page.keyboard.press('Home')
        page.locator('[data-tut="pend-scale"] canvas').click(position={'x':100,'y':20})
        if width==844:
            stage=page.locator('.pendulum-tool .tool-stage').bounding_box()
            start=page.get_by_role('button',name='Start',exact=True).bounding_box()
            nav=page.locator('nav.nav').bounding_box()
            assert stage['height']>=380 and start['y']+start['height']<nav['y']
        page.screenshot(path=str(out/f'pendulum-{width}.png'))
        expect(page.get_by_role('button',name='Fit windscreen',exact=True)).to_be_enabled()
        timing(page,f['period']);assert points(page)==0
        first=page.evaluate('__game.getState().readings[0]')
        assert first['pendulum']['technique']['source']=='manual' and first['environment']['wind']['protection']=='none'
        page.get_by_title('Exclude from average',exact=True).first.click();assert points(page)==0
        page.get_by_role('button',name='Fit windscreen',exact=True).click();timing(page,f['period'])
        assert points(page)==15,page.evaluate('__game.getState().readings')
        expect(page.locator('.toast')).to_contain_text('Sharp Eye +15 base')
        assert page.evaluate('__game.getState().sharpEyeNotified')==['wind']
        archived=ledger(page)
        page.evaluate('async()=>{const{loadSlot}=await import("/src/game/checkpoints.ts");if(!loadSlot(0))throw Error("Checkpoint load failed")}')
        assert points(page)==15 and ledger(page)==archived and page.evaluate('__game.getState().readings.length')==0
        page.reload(wait_until='networkidle');page.evaluate('__clock.paused=true;__clock.emit()');page.wait_for_timeout(400)
        assert points(page)==15 and ledger(page)==archived
        assert page.locator('.toast').count()==0
        # Re-aim and read the actual hill instrument in two recorded conditions.
        # This is not a claim that our fixture's aiming estimates are accurate.
        page.evaluate("__game.getState().go('hill')")
        record_horizon(page,f['wet']);assert points(page)==15
        record_horizon(page,f['dry']);assert points(page)==30
        expect(page.locator('.toast')).to_contain_text('Sharp Eye +15 base')
        assert sorted(page.evaluate('__game.getState().sharpEyeNotified'))==['refraction','wind']
        assert page.evaluate('__game.getState().readings.every(r=>r.environment.horizon.aim.adjusted)')
        archive=ledger(page)
        record_horizon(page,f['dry']+3600);assert points(page)==30 and ledger(page)==archive
        page.evaluate('for(const r of __game.getState().readings){__game.getState().toggleReading(r.id);__game.getState().toggleReading(r.id)}')
        assert points(page)==30 and ledger(page)==archive
        # Isolated Flight School practice cannot mint expedition credit; leaving
        # the real exercise restores the original ledger and notification state.
        page.get_by_role('button',name='Menu',exact=True).click();page.get_by_role('button',name='Open Flight School',exact=True).click()
        library=page.get_by_role('region',name='Flight School library',exact=True);assert library.locator('[data-training]').count()==49
        library.locator('[data-training="exercise:gravity"]').get_by_role('button',name=re.compile('^(Open|Repeat)')).click()
        page.wait_for_function('__game.getState().schoolSession!==null')
        page.wait_for_timeout(200)
        if page.locator('.lesson-modal').count():page.get_by_role('button',name='Close lesson',exact=True).click()
        assert points(page)==0
        page.evaluate('(archive)=>__game.setState({readings:JSON.parse(archive).wind.readings})',archive)
        assert points(page)==0 and page.evaluate('Object.keys(__game.getState().sharpEyeAwards).length')==0
        page.get_by_role('button',name='Exit tutorial',exact=True).click();page.get_by_role('button',name='Return to library',exact=True).click()
        expect(page.get_by_role('region',name='Flight School library',exact=True)).to_be_visible()
        assert points(page)==30 and ledger(page)==archive
        page.locator('.modal-x').first.click()
        page.reload(wait_until='networkidle');page.evaluate('__clock.paused=true;__clock.emit()');page.wait_for_timeout(400)
        assert points(page)==30 and ledger(page)==archive and page.locator('.toast').count()==0
        # Explicit result-screen fixture: no completed flight is claimed.
        page.evaluate("__game.setState({phase:'results',outcome:null,debriefSeen:true,sheet:{},hintsUsed:0,rewindsUsed:0,arrival:null,predictions:[],schoolOpen:null,storyQueue:[],echo:[]})")
        summary=page.get_by_label('Sharp Eye investigations',exact=True);expect(summary).to_contain_text('Sharp Eye · +30 base')
        assert summary.locator('details[open]').count()==0
        expect(summary).to_contain_text('Wind investigation · +15 base');expect(summary).to_contain_text('Refraction investigation · +15 base')
        score=page.locator('dt').filter(has_text=re.compile('^Score$')).locator('xpath=following-sibling::dd[1]');expect(score).to_have_text('30')
        summary.get_by_text('Recorded evidence',exact=True).first.click();expect(summary).to_contain_text('survives checkpoint loads')
        summary.scroll_into_view_if_needed();page.screenshot(path=str(out/f'result-{width}.png'))
        assert 'left out · Sharp Eye +15' not in page.locator('body').inner_text()
        assert page.evaluate('__game.getState().atlas.at(-1).sharpEyePolicy')=='investigation-v1'
        page.evaluate("__game.getState().newGame(17,{difficulty:'navigator',sound:false,survival:false,formulas:true})")
        assert points(page)==0 and page.evaluate('__game.getState().sharpEyeNotified.length')==0
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        print(f'{width}×{height}: native wind/horizon investigations; once-only notices/credits; checkpoint/reload; practice isolation; actual grade integration and fresh-run reset passed',flush=True)
        page.close()
    browser.close()
