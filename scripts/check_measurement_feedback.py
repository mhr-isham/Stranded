"""SCI-24: native recording feedback and requested analysis, three layouts.
Year/moon fixtures isolate presentation and selection; no completed expedition
or human enjoyment/measurement-accuracy assessment is implied.
"""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-measurement-feedback');out.mkdir(exist_ok=True)
def resources(page):
    return page.evaluate('JSON.stringify({t:__clock.t,sheet:__game.getState().sheet,penalty:__game.getState().penaltyDv,hints:__game.getState().hintsUsed,checks:__game.getState().checksUsed,predictions:__game.getState().predictions})')
def keep_hill(page):
    canvas=page.get_by_role('img',name='Horizon instrument; arrows adjust pitch, plus or minus zoom, Space braces, Enter reads',exact=True)
    canvas.focus();canvas.press('ArrowDown');canvas.press('Enter')
    page.get_by_role('button',name='Keep reading',exact=True).click()
def year_records(page,pairs):
    page.evaluate('(pairs)=>__game.setState({starObs:pairs.map(([d,y])=>({at:d*86400,v:y*Math.PI/180,source:"manual"}))})',pairs)
def summary(scope,text):return scope.get_by_text(text,exact=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,1000),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1,reduced_motion='reduce' if width==390 else 'no-preference')
        page.set_default_timeout(20000);errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
        page.evaluate('''async()=>{const{ECHO}=await import('/src/game/echo.ts');__game.getState().newGame(316,{difficulty:'navigator',survival:false,sound:false,formulas:true,freeRoam:true});__clock.t=3600;__clock.paused=true;__clock.emit();__game.setState({phase:'play',screen:'hill',identified:true,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});window.__recordAnimations=0;document.addEventListener('animationstart',e=>{if(e.animationName==='observation-recorded')window.__recordAnimations++});}''')
        assert page.locator('.observation-receipt').count()==0
        page.evaluate('async()=>{const{saveSlot}=await import("/src/game/checkpoints.ts");if(!saveSlot(0))throw Error("save") }')
        before=resources(page);keep_hill(page)
        receipt=page.locator('.observation-receipt');expect(receipt).to_contain_text('Observation saved');expect(receipt).to_contain_text('1 in log')
        expect(page.locator('.measurement-announcement')).to_contain_text('Observation saved: R₁')
        receipt.evaluate('(el)=>el.scrollIntoView({block:"center"})');page.screenshot(path=str(out/f'record-{width}.png'))
        assert page.locator('.screen').evaluate('el=>el.scrollTop===0 && el.scrollHeight<=el.clientHeight+1')
        page.wait_for_function('window.__recordAnimations===1')
        page.get_by_title('Exclude from average',exact=True).click();expect(receipt).to_contain_text('excluded from your selection')
        page.get_by_title('Include in average',exact=True).click()
        assert page.evaluate('window.__recordAnimations')==1 and resources(page)==before
        page.evaluate('async()=>{const{saveSlot}=await import("/src/game/checkpoints.ts");if(!saveSlot(1))throw Error("save") }')
        page.wait_for_function('!document.querySelector(".observation-receipt.recorded")',timeout=7000)
        page.evaluate('async()=>{const{loadSlot}=await import("/src/game/checkpoints.ts");loadSlot(0);loadSlot(1)}')
        expect(receipt).to_contain_text('Latest saved observation');assert page.locator('.observation-receipt.recorded').count()==0
        page.reload(wait_until='networkidle');page.evaluate('__clock.paused=true;__clock.emit()')
        expect(page.locator('.observation-receipt')).to_contain_text('Latest saved observation')
        assert page.locator('.observation-receipt.recorded').count()==0
        keep_hill(page);expect(page.locator('.observation-receipt')).to_contain_text('2 in log')
        # A selected year baseline yields a candidate, not an accuracy badge.
        page.evaluate('__game.getState().go("observatory")');page.get_by_role('button',name='Year',exact=True).click()
        fit=page.get_by_label('Year fit assessment',exact=True)
        year_records(page,[[0,20],[1,21]])
        expect(fit).to_contain_text('Your first drift estimate');expect(fit).to_contain_text('Early estimate')
        assert fit.get_by_role('img',name='Selected year residuals plot',exact=True).count()==0
        year_records(page,[[0,20],[1,21.02],[26,46]])
        expect(fit).to_contain_text('A line you can test')
        assert 'Rate standard error from scatter' not in fit.inner_text()
        before=resources(page);summary(fit,'Inspect year fit and residuals').click()
        residual=fit.get_by_label('Selected year residuals',exact=True);expect(residual).to_contain_text('3 selected observations')
        expect(residual.get_by_role('img',name='Selected year residuals plot',exact=True)).to_be_visible()
        expect(fit).to_contain_text('Rate standard error from scatter')
        summary(residual,'Numerical residuals and units').click()
        assert residual.locator('tbody tr').count()==3
        residual.scroll_into_view_if_needed();page.screenshot(path=str(out/f'year-residuals-{width}.png'))
        page.get_by_role('spinbutton',name='To day',exact=True).fill('1')
        expect(residual).to_contain_text('2 selected observations')
        assert residual.locator('tbody tr').count()==2
        assert resources(page)==before
        # Legend retains requested residual arithmetic, but no error-guide leak.
        page.evaluate('__game.setState({settings:{...__game.getState().settings,difficulty:"legend",formulas:false}})')
        assert 'Rate standard error from scatter' not in fit.inner_text()
        expect(residual.get_by_role('img',name='Selected year residuals plot',exact=True)).to_be_visible()
        page.evaluate('__game.setState({settings:{...__game.getState().settings,challenges:["handFit"]}})')
        expect(fit).to_contain_text('Your chart, your fit')
        assert fit.get_by_text('Inspect year fit and residuals',exact=True).count()==0 and 'Inferred year' not in fit.inner_text()
        assert page.locator('.katex').count()==0
        # Synthetic ambiguous orbit: switching candidates updates the same data's residuals.
        page.evaluate('''()=>{__game.setState({settings:{...__game.getState().settings,difficulty:'navigator',challenges:[]},moonTrack:Array.from({length:20},(_,i)=>{const d=i+(i%3)*.005;return{at:d*86400,v:30*Math.sin(2*Math.PI*d/.8+.4)*Math.PI/648000}}),track:Array.from({length:21},(_,i)=>({at:i*86400,v:0}))})}''')
        page.get_by_role('button',name='Moon',exact=True).click();moon=page.get_by_label('Moon orbit analysis',exact=True)
        expect(moon).to_contain_text('Two possible rhythms')
        assert moon.get_by_role('img',name='Selected moon residuals plot',exact=True).count()==0
        assert moon.locator('details[open]').count()==0
        before=resources(page);summary(moon,'Analysis details and other candidates').click();summary(moon,'Inspect selected moon fit residuals').click()
        mr=moon.get_by_label('Selected moon residuals',exact=True);expect(mr.get_by_role('img',name='Selected moon residuals plot',exact=True)).to_be_visible()
        summary(mr,'Numerical residuals and units').click();assert mr.locator('tbody tr').count()==20
        first=mr.locator('tbody').inner_text();moon.get_by_role('button',name='Use model B',exact=True).click()
        assert mr.locator('tbody').inner_text()!=first
        expect(moon.get_by_label('Selected moon fit',exact=True)).to_contain_text('(B)')
        mr.scroll_into_view_if_needed();page.screenshot(path=str(out/f'moon-residuals-{width}.png'))
        assert resources(page)==before
        page.evaluate('__game.setState({settings:{...__game.getState().settings,challenges:["handFit"]}})')
        expect(moon).to_contain_text('Your chart, your orbit')
        assert moon.get_by_text('Inspect selected moon fit residuals',exact=True).count()==0
        assert moon.get_by_label('Selected moon fit',exact=True).count()==0
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert page.locator('.screen').evaluate('el=>el.scrollTop===0')
        assert not errors,errors
        print(f'{width}×{height}: native save/receipt, no replay on toggles/checkpoint/reload, requested selected residuals, model switch, resources and hard/manual restrictions passed',flush=True)
        page.close()
    browser.close()
