"""SCI-06 saved-data replay and shared training recognition, phone/desktop.

Fixtures set edge-case tracks and bypass story. The retrograde school case
uses the actual nightly tracker and normal prediction/mark/send/finish UI.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-replay-rewards');out.mkdir(exist_ok=True)

def guide(page):return page.get_by_role('dialog',name='Flight School',exact=True)
def library(page):return page.get_by_role('region',name='Flight School library',exact=True)
def expand(page):
    page.wait_for_timeout(200)  # Let the new step apply its initial compact layout.
    if guide(page).get_by_role('button',name='Expand',exact=True).count():guide(page).get_by_role('button',name='Expand',exact=True).click()
def minimise(page):
    if guide(page).get_by_role('button',name='Minimise',exact=True).count():guide(page).get_by_role('button',name='Minimise',exact=True).click()
def step(page,id):
    index=page.evaluate('async(id)=>(await __tut.steps()).STEPS.findIndex(s=>s.id===id)',id)
    page.wait_for_function('(index)=>__game.getState().tutorial.step===index',arg=index,timeout=30000)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        page.set_default_timeout(60000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        page.evaluate('''async()=>{const {ECHO}=await import('/src/game/echo.ts');const {freshSchoolRewards}=await import('/src/game/schoolRewards.ts');__game.getState().newGame(316,{difficulty:'legend',freeRoam:true,survival:false,sound:false,formulas:false});__clock.t=50*86400;__clock.paused=true;__clock.emit();__game.setState({phase:'play',screen:'observatory',identified:true,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5],sheet:{},track:[[10,40],[11,41.2],[12,40.8],[17,40.2],[18,41]].map(([d,v])=>({at:d*86400,v:v*Math.PI/180})),schoolRewards:freshSchoolRewards(),training:{}})}''')
        page.get_by_role('button',name='Tracker',exact=True).click()
        replay=page.locator('details[aria-label="Recorded observation replay"]')
        replay.locator('summary').click()
        at=page.evaluate('__clock.t')
        replay.get_by_role('checkbox',name='Show observed trail',exact=True).check()
        slider=replay.get_by_role('slider',name='Observation in replay',exact=True)
        slider.focus();slider.press('End')
        expect(replay).to_contain_text('1 gap longer')
        assert replay.locator('svg polyline').count()==2
        assert replay.locator('svg circle').count()==5
        assert replay.locator('svg text').filter(has_text='gap').count()==1
        replay.get_by_role('button',name='Play observations',exact=True).click()
        page.wait_for_timeout(1800)
        assert page.evaluate('__clock.t')==at
        assert page.evaluate('__game.getState().track.length')==5
        replay.get_by_role('button',name='Restart replay',exact=True).click()
        slider.focus();slider.press('End')
        replay.get_by_role('button',name='Use this recorded date as chart cursor',exact=True).click()
        page.get_by_role('button',name='Mark opposition here',exact=True).click()
        assert page.evaluate('__game.getState().oppPicks.length')==1
        page.get_by_role('spinbutton',name='Chart cursor day',exact=True).fill('18')
        page.get_by_role('button',name='Mark opposition here',exact=True).click()
        assert page.evaluate('__game.getState().oppPicks.length')==1
        replay.screenshot(path=str(out/f'replay-{width}.png'))
        # A native tracker run now saves both pointing coordinates for the
        # historical wide-sky overlay; old logs continue to work on the chart.
        page.get_by_role('checkbox',name='Show saved sightings on the wide sky',exact=True).check()
        expect(page.get_by_text('Gold rings are past recorded pointings',exact=False)).to_be_visible()
        page.evaluate('__game.setState({track:[],trackOn:true,lastNightLog:-1});__ff(__clock.t+5*86400);__clock.paused=true;__clock.emit()')
        assert page.evaluate('__game.getState().track.length')>0
        assert page.evaluate('__game.getState().track.every(o=>Number.isFinite(o.skyLatitude)&&o.source==="tracker")')
        # Start from a real saved expedition; every reward must survive return
        # without supplying it with practice fuel or measurements.
        page.evaluate("__game.getState().newGame(91,{difficulty:'navigator',sound:false,survival:false,formulas:true});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}},training:{},schoolRewards:{patches:{},cards:{},milestones:{}}})")
        page.get_by_role('button',name='Flight School',exact=False).click()
        assert library(page).locator('[data-training]').count()==48
        library(page).locator('[data-training="exercise:opposition"]').get_by_role('button',name=re.compile('^Open')).click()
        page.wait_for_function('__game.getState().schoolSession?.id==="opposition"',timeout=60000)
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        expand(page)
        guide(page).get_by_role('button',name=re.compile('Fast-forward 40 days')).click()
        step(page,'opp-mark');expand(page)
        if page.evaluate('__game.getState().screen')!='observatory':
            guide(page).get_by_role('button',name='Take me there',exact=True).click()
        page.get_by_role('button',name='Tracker',exact=True).click()
        minimise(page)
        investigation=page.get_by_role('region',name='Flight School motion investigation',exact=True)
        investigation.get_by_role('combobox',name='My next-position prediction',exact=True).select_option('west')
        investigation.get_by_role('button',name='Commit motion prediction',exact=True).click()
        before=page.evaluate('__game.getState().track.length')
        investigation.get_by_role('button',name='Collect another three days',exact=True).click()
        expect(investigation.get_by_role('status')).to_contain_text('next saved sighting')
        assert page.evaluate('__game.getState().track.length')>before
        assert page.evaluate('!!__game.getState().schoolRewards.milestones["predict-motion"]')
        # Player-selected opposition estimate from the observed backward interval.
        # The fixture computes its approximate middle from records, not the
        # hidden opposition; the UI itself makes no automatic date choice.
        middle=page.evaluate('''async()=>{const {observedMotion}=await import('/src/game/observedMotion.ts');const p=observedMotion(__game.getState().track,86400);const b=p.filter((v,i)=>i&&v.y<p[i-1].y);return b.length?(b[0].x+b.at(-1).x)/2:p[Math.floor(p.length/2)].x;}''')
        page.get_by_role('spinbutton',name='Chart cursor day',exact=True).fill(str(middle))
        page.get_by_role('button',name='Mark opposition here',exact=True).click()
        step(page,'opp-send');minimise(page)
        sender=page.locator('[data-tut="track-send-t0"]')
        sender.locator('input').fill('2')
        sender.get_by_role('button',name='Send to progress sheet',exact=True).click()
        expand(page);guide(page).get_by_role('button',name='Finish exercise',exact=True).click()
        library(page).wait_for()
        assert page.evaluate('__game.getState().sheet.g.value')==9.81
        assert page.evaluate('__clock.t')==123
        assert page.evaluate('__game.getState().penaltyDv')==0
        assert page.evaluate('__game.getState().track.length')==0
        rewards=page.evaluate('__game.getState().schoolRewards')
        assert 'exercise:opposition' in rewards['patches']
        assert rewards['cards']['exercise:opposition']['first']['plot']
        assert rewards['cards']['exercise:opposition']['first']['assisted'] is False
        logbook=page.locator('details[aria-label="Flight School logbook"]')
        logbook.locator('summary').click()
        logbook.get_by_role('button',name='Inspect patch · Mark an opposition',exact=True).click()
        expect(logbook.get_by_role('article',name='Saved discovery card',exact=True)).to_contain_text('Tracker sightings')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        logbook.screenshot(path=str(out/f'logbook-{width}.png'))
        # Reopening the module starts another attempt. A first-completion patch
        # remains one patch while later snapshots can update the latest card.
        patch_count=len(rewards['patches'])
        page.reload(wait_until='networkidle')
        assert page.evaluate('Object.keys(__game.getState().schoolRewards.patches).length')==patch_count
        assert page.get_by_role('status',name='Flight School recognition').count()==0
        # A new-system button is available without completing or unlocking it.
        prior=page.evaluate('__game.getState().seed')
        library(page).locator('[data-training="exercise:year"]').get_by_role('button',name='New system',exact=True).click()
        page.wait_for_function('__game.getState().schoolSession?.id==="year"',timeout=60000)
        assert page.evaluate('__game.getState().seed')!=316
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        expand(page);guide(page).get_by_role('button',name='Exit tutorial',exact=True).click()
        page.get_by_role('button',name='Return to library',exact=True).click()
        library(page).wait_for()
        assert page.evaluate('__game.getState().seed')==prior
        assert page.evaluate('__game.getState().sheet.g.value')==9.81
        # Boundary fixture reaches a valid orbit; completion and return still
        # use native flight UI. Assisted/manual repeats earn equal recognition.
        for assisted in [True,False]:
            library(page).get_by_role('combobox',name='Practice handling',exact=True).select_option('cadet')
            library(page).get_by_role('button',name='Practice ascent',exact=True).click()
            page.wait_for_function('__game.getState().phase==="ascent"',timeout=60000)
            page.get_by_role('button',name='Ready to fly',exact=True).click()
            if assisted:page.get_by_role('button',name='Let ECHO fly',exact=True).click()
            page.evaluate('''()=>{const a=__ascent;Object.assign(a.state.current,{r:a.params.R+a.params.orbitAlt,vr:0,vt:Math.sqrt(a.params.mu/(a.params.R+a.params.orbitAlt)),dv:a.baseline});a.controls.pause(false)}''')
            page.get_by_role('button',name='Finish practice',exact=True).click()
            library(page).wait_for()
            cards=page.evaluate('__game.getState().schoolRewards.cards["flight:ascent"]')
            assert cards['first']['assisted'] is True
            assert cards['latest']['assisted'] is assisted
            assert page.evaluate('__game.getState().sheet.g.value')==9.81
            assert page.evaluate('__clock.t')==123
        assert cards['first']['attempt']!=cards['latest']['attempt']
        assert not errors,errors
        page.close()
    browser.close()
print('PASS SCI-06 replay gaps/trails/clock isolation and native coordinate logs; real motion prediction/opposition practice, persistent patches/cards/milestones, zero-resource restoration and new-system access at phone/desktop sizes')
