"""SCI-17: existing lesson controls and player-model notes on three viewports.
Planner fixtures provide labelled complete worksheet inputs. They do not verify
manual observation accuracy or imply the fitted model matches hidden truth.
"""
from pathlib import Path
import math
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-model-notes');out.mkdir(exist_ok=True)
def library(page): return page.get_by_role('region',name='Flight School library',exact=True)
def lesson(page): return page.locator('.lesson-modal')
def open_lesson(page,key):
    library(page).locator(f'[data-training="lesson:{key}"]').get_by_role('button',name=re.compile('^(Open|Repeat)')).click()
    expect(lesson(page)).to_be_visible()
def interval(page):return float(lesson(page).locator('[data-synodic-days]').get_attribute('data-synodic-days'))
def ghost_distance(page):
    return page.evaluate('''()=>{const s=document.querySelector('.lesson-modal svg'),g=s.querySelector('g[aria-label="Circular reference at the same elapsed fraction of the year"] circle[r="6"]'),p=s.querySelector(':scope > circle[r="6"]');return Math.hypot(Number(g.getAttribute('cx'))-Number(p.getAttribute('cx')),Number(g.getAttribute('cy'))-Number(p.getAttribute('cy')))}''')
def planning(page,chapter=1,zero=False):
    return page.evaluate('''async({chapter,zero})=>{const {currentWorld}=await import('/src/game/sim.ts');const {botMeasure,PERFECT}=await import('/src/engine/solver.ts');const {makeRng}=await import('/src/engine/rng.ts');const {ECHO}=await import('/src/game/echo.ts');__game.getState().newGame(316,{difficulty:'legend',survival:false,sound:false,formulas:false,freeRoam:true},chapter);const sys=currentWorld().system,p=botMeasure(sys,PERFECT,makeRng(812)).primaries;if(zero)p.ecc={...p.ecc,value:0};__clock.t=100;__clock.paused=true;__clock.emit();__game.setState({phase:'play',screen:'launch',sheet:p,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});return {realE:sys.target.e??0,enteredE:p.ecc?.value??null}}''',{'chapter':chapter,'zero':zero})

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,1000),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1,reduced_motion='reduce' if width==390 else 'no-preference')
        page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        page.evaluate("__game.getState().newGame(91,{difficulty:'navigator',survival:false,sound:false,formulas:true});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}},training:{},schoolRewards:{patches:{},cards:{},milestones:{}}})")
        page.get_by_role('button',name='Flight School',exact=False).click();assert library(page).locator('[data-training]').count()==49
        before=page.evaluate('({t:__clock.t,sheet:__game.getState().sheet,readings:__game.getState().readings})')
        open_lesson(page,'synodic')
        if width==390:expect(lesson(page).get_by_role('button',name='Play animation',exact=True)).to_be_visible()
        lesson(page).get_by_role('button',name='Earth → Mars',exact=True).click();assert abs(interval(page)-779.94)<.1
        formula=lesson(page).locator('.lesson-formula annotation').all_text_contents();assert any('-' in t for t in formula)
        lesson(page).get_by_role('button',name='Earth → Venus',exact=True).click();assert abs(interval(page)-583.92)<.1
        expect(lesson(page)).to_contain_text('An inner target has the shorter year')
        assert any('+' in t for t in lesson(page).locator('.lesson-formula annotation').all_text_contents())
        assert lesson(page).locator('details[open]').count()==0 and lesson(page).locator('.katex-error').count()==0
        # Pause and replay freeze the picture, including while the original clock is paused.
        pause=lesson(page).get_by_role('button',name='Pause animation',exact=True)
        if pause.count():pause.click()
        lesson(page).get_by_role('button',name='Replay from alignment',exact=True).click()
        circles=lesson(page).locator('svg circle').evaluate_all('(els)=>els.map(e=>[e.getAttribute("cx"),e.getAttribute("cy")])')
        page.wait_for_timeout(350);assert lesson(page).locator('svg circle').evaluate_all('(els)=>els.map(e=>[e.getAttribute("cx"),e.getAttribute("cy")])')==circles
        lesson(page).get_by_role('button',name='Play animation',exact=True).click();page.wait_for_timeout(300)
        assert lesson(page).locator('svg circle').evaluate_all('(els)=>els.map(e=>[e.getAttribute("cx"),e.getAttribute("cy")])')!=circles
        lesson(page).get_by_role('button',name='Pause animation',exact=True).click()
        # Native range keys cannot push the target onto the wrong side of home.
        sliders=lesson(page).get_by_role('slider');sliders.nth(0).focus();page.keyboard.press('Home');sliders.nth(1).focus();page.keyboard.press('End')
        home=float(sliders.nth(0).input_value());target=float(sliders.nth(1).input_value());assert target<home and math.isfinite(interval(page))
        lesson(page).get_by_role('button',name='Outer target',exact=True).click();sliders.nth(1).focus();page.keyboard.press('Home');assert float(sliders.nth(1).input_value())>float(sliders.nth(0).input_value())
        lesson(page).get_by_role('button',name='Earth → Venus',exact=True).click();lesson(page).get_by_role('img',name=re.compile('^Circular teaching orbits')).scroll_into_view_if_needed();page.screenshot(path=str(out/f'synodic-{width}.png'))
        lesson(page).get_by_role('button',name='Got it',exact=True).click()
        open_lesson(page,'ellipse');show=lesson(page).get_by_label('Show a circular reference with the same semi-major axis and year',exact=True)
        expect(show).not_to_be_checked();show.check();e=lesson(page).get_by_role('slider').nth(0);e.focus();page.keyboard.press('Home');assert ghost_distance(page)<1e-6
        page.keyboard.press('End');assert ghost_distance(page)>1
        expect(lesson(page)).to_contain_text('circular speed at a');assert '× average' not in lesson(page).inner_text()
        assert lesson(page).locator('.katex-error').count()==0
        lesson(page).get_by_role('slider').nth(1).scroll_into_view_if_needed();page.screenshot(path=str(out/f'ellipse-{width}.png'))
        lesson(page).get_by_role('button',name='Got it',exact=True).click()
        open_lesson(page,'hohmann');expect(lesson(page).get_by_text('When does this picture need a different model?',exact=True)).to_be_visible()
        assert lesson(page).locator('details[open]').count()==0
        lesson(page).get_by_text('When does this picture need a different model?',exact=True).click();expect(lesson(page)).to_contain_text('Lambert solution')
        lesson(page).get_by_role('button',name='Got it',exact=True).click()
        assert before==page.evaluate('({t:__clock.t,sheet:__game.getState().sheet,readings:__game.getState().readings})')
        # The game describes the player's model. Requested details stay closed by default.
        for chapter in [1,5,4]:
            data=planning(page,chapter,zero=chapter==4)
            notes=page.locator('[aria-label="Player planning model"]');expect(notes).to_be_visible()
            assert notes.locator('details[open]').count()==0 and page.locator('.lesson-modal').count()==0
            assert page.locator('.katex').count()==0
            expect(notes).to_contain_text('fitted target orbit' if chapter==4 else 'inner target' if chapter==5 else 'outer target')
            if chapter==4:assert data['realE']>0 and data['enteredE']==0
            notes.locator('summary').click();expect(notes).to_contain_text('zero-revolution Lambert')
            if chapter==4:expect(notes).to_contain_text('zero reduces this model to a circle')
            notes.scroll_into_view_if_needed();page.screenshot(path=str(out/f'planner-{chapter}-{width}.png'))
            box=notes.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1
        page.evaluate('__game.setState({sheet:{}})');assert page.locator('[aria-label="Player planning model"]').count()==0
        assert not errors,errors
        page.close()
    browser.close()
print('PASS existing synodic/ellipse/Hohmann lessons, both reference cases and signs, pause/replay/reduced-motion, native range bounds, circular reference overlay, zero-eccentricity player-model distinction, collapsed assumptions, incomplete-sheet handling, untouched expedition and phone/desktop/landscape layouts')
