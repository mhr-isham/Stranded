"""SCI-18: optional evidence breakdown, pure what-if controls and conditional
forecast outcomes. Complete PERFECT fixtures are UI scaffolding, not tests of
the accuracy of manual observations or of calibrated real-world probabilities.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out = Path('/tmp/stranded-uncertainty'); out.mkdir(exist_ok=True)
def setup(page, difficulty='cadet'):
    page.evaluate('''async(difficulty)=>{
      const {currentWorld}=await import('/src/game/sim.ts');
      const {botMeasure,PERFECT}=await import('/src/engine/solver.ts');
      const {makeRng}=await import('/src/engine/rng.ts');
      const {ECHO}=await import('/src/game/echo.ts');
      __game.getState().newGame(316,{difficulty,survival:false,sound:false,formulas:true});
      const p=botMeasure(currentWorld().system,PERFECT,makeRng(812)).primaries;
      for(const e of Object.values(p))e.sigma=0;
      p.dPar.sigma=p.dPar.value*.05;p.alpha2.sigma=p.alpha2.value*.01;
      __clock.t=100;__clock.paused=true;__clock.emit();
      __game.setState({phase:'play',screen:'sheet',sheet:p,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});
    }''', difficulty)
def unchanged(page):
    return page.evaluate('''()=>{const s=__game.getState();return JSON.stringify({sheet:s.sheet,readings:s.readings,t:__clock.t,checks:s.checksUsed,fuel:s.penaltyDv,hints:s.hintsUsed})}''')
def open_budget(page):
    page.locator('[data-tut="sheet-node-R2"]').click()
    budget=page.get_by_label('Uncertainty breakdown',exact=True)
    expect(budget).to_be_visible(); assert budget.get_attribute('open') is None
    budget.locator(':scope > summary').click(); return budget

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,1000),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1,reduced_motion='reduce')
        page.set_default_timeout(30000); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:5173/',wait_until='networkidle');setup(page)
        before=unchanged(page);budget=open_budget(page)
        rows=budget.get_by_role('list',name='Sources of uncertainty').get_by_role('listitem')
        assert rows.count()>=5; expect(rows.first).to_contain_text('largest contribution')
        expect(rows.first).to_contain_text('96.2%'); expect(rows.first).to_contain_text('Distance')
        assert budget.locator('.uncertainty-scenario[open]').count()==0
        expect(budget).to_contain_text('independent confirmations')
        assert budget.locator('.callout.tip').count()==1
        total=budget.locator('.uncertainty-total b').inner_text()
        budget.locator('.uncertainty-scenario > summary').click()
        preview=budget.locator('.uncertainty-preview'); original=preview.inner_text()
        budget.get_by_role('button',name='Halve error',exact=True).click();expect(preview).not_to_have_text(original)
        assert budget.locator('.uncertainty-total b').inner_text()==total
        assert unchanged(page)==before
        budget.get_by_label('Hypothetical input',exact=True).select_option('alpha2')
        budget.get_by_role('button',name='Double error',exact=True).click(); assert unchanged(page)==before
        expect(preview).to_contain_text('Hypothetical only')
        page.get_by_role('button',name='Expand worksheet view',exact=True).click()
        expect(page.get_by_role('button',name='Show constellation',exact=True)).to_be_visible()
        assert not page.locator('[data-tut="sheet-map"]').is_visible()
        # Inspect the actual bars at the top of the expanded reader, rather than
        # scrolling the bottom of a long details block into the viewport.
        budget.locator(':scope > summary').evaluate('(el)=>el.scrollIntoView({block:"start"})')
        page.screenshot(path=str(out/f'breakdown-{width}.png'))
        page.get_by_role('button',name='Show constellation',exact=True).click()
        # Source links take the player back to their actual observation input.
        rows.first.get_by_role('button').click();panel=page.locator('[data-tut="sheet-panel"]')
        expect(panel.locator('h2')).to_contain_text('d');assert panel.locator('input').count()>=2
        old=page.evaluate('__game.getState().sheet.dPar.sigma')
        page.evaluate('__game.setState(s=>({sheet:{...s.sheet,dPar:{...s.sheet.dPar,sigma:s.sheet.dPar.sigma*2}}}))')
        budget=open_budget(page);assert budget.locator('.uncertainty-total b').inner_text()!=total
        assert page.evaluate('__game.getState().sheet.dPar.sigma')==old*2
        # Expert modes get factual source inspection, without volunteered next-step advice.
        setup(page,'legend');budget=open_budget(page);assert budget.locator('.callout.tip').count()==0
        assert budget.get_by_role('listitem').count()>=5
        # A malformed imported allowance must not become zero or an invalid SVG radius.
        page.evaluate('__game.setState(s=>({sheet:{...s.sheet,dPar:{...s.sheet.dPar,sigma:NaN}}}))')
        expect(budget).to_contain_text('Uncertainty unavailable');expect(panel).not_to_contain_text('± NaN')
        assert page.locator('svg circle[r="NaN"]').count()==0
        # Conditional forecast has all 36 attempts and explains exactly what is excluded.
        setup(page);page.evaluate("__game.getState().go('launch')")
        forecast=page.get_by_label('Simulated transfer outcomes',exact=True)
        expect(forecast).to_contain_text(re.compile(r'\d+ of 36 succeeded'),timeout=60000)
        expect(forecast).to_contain_text(re.compile(r'\d+ unsuccessful · \d+ unassessable'))
        assert forecast.locator('details[open]').count()==0
        forecast.get_by_text('What does this forecast include?',exact=True).click()
        expect(forecast).to_contain_text('exclude the survival deadline')
        expect(forecast).to_contain_text('not a measured chance')
        assert 'Chance of success' not in page.locator('body').inner_text()
        forecast.scroll_into_view_if_needed();page.screenshot(path=str(out/f'forecast-{width}.png'))
        # Nonphysical draws are retained. These intentionally enormous error bars
        # test accounting and are not a scientifically justified player estimate.
        page.evaluate('__game.setState(s=>({sheet:{...s.sheet,Pm:{...s.sheet.Pm,sigma:s.sheet.Pm.value*100}}}))')
        expect(forecast).to_contain_text(re.compile(r'[1-9]\d* unassessable'),timeout=60000)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        print(f'{width}×{height}: optional bars, scenario isolation, live update, source link, expert help, invalid errors and forecast accounting passed')
        page.close()
    browser.close()
