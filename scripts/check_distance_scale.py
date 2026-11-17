"""SCI-08 dated separation selection, own-model diagrams and optional teaching.
Fixtures provide two known dated observations and a complete planner model.
Native controls select/send/edit dates and complete/repeat the new lesson.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-distance-scale');out.mkdir(exist_ok=True)
def library(page):return page.get_by_role('region',name='Flight School library',exact=True)
def node(page,key):
    page.locator(f'[data-tut="sheet-node-{key}"]').click()
    page.locator('[data-tut="sheet-panel"]').wait_for()

def take(page,lab,when):
    lab.get_by_role('button',name=when,exact=True).click()
    lab.get_by_role('button',name='Keep dated teaching observation',exact=True).click()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        dataset=page.evaluate('''async()=>{
          const {distanceTeachingObservation}=await import('/src/game/distanceScale.ts');const {ECHO}=await import('/src/game/echo.ts');
          const a=distanceTeachingObservation(0),b=distanceTeachingObservation(a.synodicDays/4);
          __game.getState().newGame(316,{difficulty:'legend',sound:false,survival:false,formulas:false,freeRoam:true});__clock.t=999;__clock.paused=true;__clock.emit();
          __game.setState({phase:'play',screen:'rover',sheet:a.p,readings:[{id:'dated-a',key:'dPar',value:a.p.dPar.value,at:0,kept:true,note:'Fixture A'},{id:'dated-b',key:'dPar',value:b.p.dPar.value,at:b.p.dPar.at,kept:true,note:'Fixture B'}],storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});
          return {a:a.p.dPar,b:b.p.dPar};
        }''')
        sender=page.locator('[data-tut="rover-send"]')
        chooser=sender.get_by_role('combobox',name='Distance observation',exact=True)
        expect(chooser).to_have_value('dated-b')
        assert chooser.locator('option').count()==2
        assert 'Average of 2' not in sender.inner_text()
        sender.locator('input').fill('3')
        sender.get_by_role('button',name='Update',exact=True).click()
        assert page.evaluate('__game.getState().sheet.dPar.at')==dataset['b']['at']
        assert page.evaluate('__game.getState().sheet.dPar.value')==dataset['b']['value']
        chooser.select_option('dated-a');sender.locator('input').fill('2')
        sender.get_by_role('button',name='Update',exact=True).click()
        assert page.evaluate('__game.getState().sheet.dPar.at')==0
        assert page.evaluate('__game.getState().sheet.dPar.value')==dataset['a']['value']
        page.locator('[data-tut="nav-sheet"]').click();node(page,'a2')
        context=page.get_by_role('region',name='Dated distance reference',exact=True)
        details=context.locator('details')
        assert not details.evaluate('(el)=>el.open')
        assert page.locator('.lesson-modal').count()==0
        details.locator('summary').click()
        expect(context).to_contain_text('160.000 million km')
        expect(context).to_contain_text('day 0.0000')
        assert context.get_by_role('img',name='Separation between planets and orbit size around the star',exact=True).is_visible()
        assert page.locator('.katex').count()==0
        context.scroll_into_view_if_needed();page.screenshot(path=str(out/f'dated-model-{width}.png'))
        node(page,'dPar')
        field=page.get_by_role('spinbutton',name='Observation day',exact=True)
        field.fill(str(dataset['b']['at']/86400));field.press('Tab')
        assert abs(page.evaluate('__game.getState().sheet.dPar.at')-dataset['b']['at'])<1e-6
        field.fill('');field.press('Tab')
        assert page.evaluate('__game.getState().sheet.dPar.at===undefined')
        expect(page.get_by_role('region',name='Dated distance reference',exact=True)).to_contain_text('date not recorded')
        expect(page.get_by_role('region',name='Dated distance reference',exact=True)).to_contain_text('Current geometry assumes day 0.0000')
        page.reload(wait_until='networkidle');node(page,'dPar')
        expect(page.get_by_role('spinbutton',name='Observation day',exact=True)).to_have_value('')
        assert page.evaluate('__game.getState().sheet.dPar.at===undefined')
        # A real full fixture makes the existing planner available. Moving the
        # departure control must not rewrite the observation epoch or value.
        frozen=page.evaluate('''async()=>{
          const {currentWorld}=await import('/src/game/sim.ts');const {botMeasure,PERFECT}=await import('/src/engine/solver.ts');const {makeRng}=await import('/src/engine/rng.ts');
          const p=botMeasure(currentWorld().system,PERFECT,makeRng(7)).primaries;__game.setState({sheet:p});return JSON.stringify(p);
        }''')
        page.locator('[data-tut="nav-launch"]').click()
        departure=page.get_by_role('slider',name='Departure day',exact=True)
        departure.focus();departure.press('ArrowRight')
        assert page.evaluate('JSON.stringify(__game.getState().sheet)')==frozen
        ref=page.get_by_role('region',name='Dated distance reference',exact=True)
        assert not ref.locator('details').evaluate('(el)=>el.open')
        assert page.locator('.katex').count()==0
        page.screenshot(path=str(out/f'planner-dates-{width}.png'))
        # The optional lesson is always available and does not alter expedition
        # observations/time. Closing without Got it must not earn its patch.
        page.evaluate("__game.getState().newGame(91,{difficulty:'navigator',sound:false,survival:false,formulas:true});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}},training:{},schoolRewards:{patches:{},cards:{},milestones:{}}})")
        page.get_by_role('button',name='Flight School',exact=False).click()
        assert library(page).locator('[data-training]').count()==48
        module=library(page).locator('[data-training="lesson:distance-scale"]')
        module.get_by_role('button',name=re.compile('^Open')).click()
        lab=page.get_by_role('region',name='Changing distance mini expedition',exact=True)
        take(page,lab,'Opposition')
        page.get_by_role('button',name='Close lesson',exact=True).click()
        assert page.evaluate('__game.getState().schoolRewards.patches["lesson:distance-scale"]===undefined')
        module.get_by_role('button',name=re.compile('^Open')).click()
        lab.get_by_role('combobox',name='My expectation',exact=True).select_option('Orbit size changes; separation stays the same')
        lab.get_by_role('button',name='Commit my expectation',exact=True).click()
        take(page,lab,'Opposition');take(page,lab,'Later · ⅛ cycle')
        lab.get_by_role('button',name='Compare my dated observations',exact=True).click()
        expect(lab.get_by_role('status')).to_contain_text('same orbit size')
        assert lab.locator('.katex').count()>0 and lab.locator('.katex-error').count()==0
        radical=lab.locator('.equation .sqrt svg').first
        assert radical.evaluate('(el)=>parseFloat(getComputedStyle(el).height)')>10
        lab.get_by_role('checkbox',name='Make the next teaching reading 3% high',exact=True).check()
        take(page,lab,'Later · ¼ cycle')
        lab.get_by_role('button',name='Compare my dated observations',exact=True).click()
        expect(lab.get_by_role('status')).to_contain_text('inferred orbit sizes differ')
        assert page.evaluate('__clock.t')==123
        assert page.evaluate('__game.getState().sheet.g.value')==9.81
        assert page.evaluate('__game.getState().readings.length')==0
        lab.get_by_role('img',name='Dated separations and inferred orbit sizes',exact=True).scroll_into_view_if_needed()
        page.screenshot(path=str(out/f'investigation-{width}.png'))
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        cards=page.evaluate('__game.getState().schoolRewards.cards["lesson:distance-scale"]')
        assert cards['first']['kind']=='teaching'
        assert len(cards['first']['plot'])==3
        assert any(r['label']=='Your committed expectation' and r['value'].startswith('Orbit size changes') for r in cards['first']['summary'])
        assert any(r['label']=='Source' and 'not expedition measurements' in r['value'] for r in cards['first']['summary'])
        first=cards['first']['attempt']
        page.evaluate('__game.setState({settings:{...__game.getState().settings,formulas:false}})')
        module.get_by_role('button',name=re.compile('^Repeat')).click()
        lab.get_by_role('combobox',name='Teaching system',exact=True).select_option('inner')
        take(page,lab,'Conjunction');take(page,lab,'Later · ¼ cycle')
        lab.get_by_role('button',name='Compare my dated observations',exact=True).click()
        expect(lab.get_by_role('status')).to_contain_text('same orbit size')
        assert lab.locator('.katex').count()==0
        page.locator('.lesson-modal').get_by_role('button',name='Got it',exact=True).click()
        cards=page.evaluate('__game.getState().schoolRewards.cards["lesson:distance-scale"]')
        assert cards['first']['attempt']==first and cards['latest']['attempt']!=first
        assert any('Inner orbit' in r['value'] for r in cards['latest']['summary'])
        logbook=page.locator('[aria-label="Flight School logbook"]');logbook.locator('summary').click()
        logbook.get_by_role('button',name='Inspect patch · Changing distance, same orbit',exact=True).click()
        expect(logbook.get_by_role('article',name='Saved discovery card',exact=True)).to_contain_text('Teaching investigation')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.reload(wait_until='networkidle')
        assert page.evaluate('!!__game.getState().schoolRewards.patches["lesson:distance-scale"]')
        assert page.get_by_role('status',name='Flight School recognition',exact=True).count()==0
        assert not errors,errors
        page.close()
    browser.close()
print('PASS dated-distance selection, sheet date editing/legacy labels, optional own-model diagram, unchanged observation epoch during departure changes, outer/inner Flight School comparison, rough-reading feedback, formula preferences, saved first/latest teaching cards and reloads at phone/desktop sizes')
