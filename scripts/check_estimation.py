"""Check optional estimation practice, observation gates and expedition restoration.

The pendulum smoke test uses a short stopwatch interval to check the real UI
data flow. It does not certify realistic human timing or measurement accuracy.
"""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

out = Path('/tmp/stranded-estimation')
out.mkdir(exist_ok=True)

def library(page):
    return page.get_by_role('region', name='Flight School library', exact=True)

def workshop(page):
    return page.get_by_role('region', name='Estimation exercise', exact=True)

def restore_check(page):
    library(page).wait_for()
    assert page.evaluate('__game.getState().sheet.g.value') == 9.81
    assert page.evaluate('__clock.t') == 123
    assert page.evaluate('__game.getState().atlas.length') == 0
    assert page.evaluate('__game.getState().predictions.length') == 0

def start(page, title, module):
    library(page).get_by_role('button', name='Open · '+title, exact=True).click()
    page.wait_for_function('(id)=>__game.getState().schoolSession?.id===id', arg=module, timeout=60000)
    card = page.get_by_role('dialog', name='Flight School', exact=True)
    if card.get_by_role('button', name='Minimise', exact=True).count():
        card.get_by_role('button', name='Minimise', exact=True).click()
    return card

def time_and_keep(page):
    page.get_by_role('button', name='Release', exact=True).click()
    page.get_by_role('button', name='Start', exact=True).click()
    page.wait_for_timeout(200)
    page.get_by_role('button', name='Stop', exact=True).click()
    page.locator('.modal input').fill('1')
    page.get_by_role('button', name='Calculate g', exact=True).click()
    page.get_by_role('button', name='Keep reading', exact=True).click()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])
    for width, height in [(390, 844), (1440, 900)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:5173/', wait_until='networkidle')
        page.evaluate("""()=>{__game.getState().newGame(91,{difficulty:'navigator',sound:false,survival:false,formulas:true});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}}})}""")
        page.get_by_role('button', name='Flight School', exact=False).click()
        library(page).get_by_role('combobox', name='Skill group', exact=True).select_option('predictions')
        assert library(page).locator('[data-training]').count() == 12
        for id in ['line', 'interpolate', 'ratio', 'bracket', 'scale', 'scatter', 'parallax']:
            library(page).locator(f'[data-training="estimate:{id}"]').get_by_role('button', name='Open', exact=False).click()
            w = workshop(page)
            assert w.get_by_role('button', name='Reveal worked comparison', exact=True).count() == 0
            assert w.get_by_role('button', name='Commit estimate', exact=True).is_disabled()
            inputs = w.locator('input')
            inputs.nth(0).fill('10')
            inputs.nth(1).fill('0')
            assert w.get_by_role('button', name='Commit estimate', exact=True).is_disabled()
            inputs.nth(1).fill('2')
            w.get_by_role('button', name='Show a reasoning hint', exact=True).click()
            assert w.locator('.katex').count() > 0
            original_data = w.locator('table').inner_text()
            w.get_by_role('button', name='Commit estimate', exact=True).click()
            assert w.locator('input').count() == 0
            assert w.get_by_role('status').count() == 0
            w.get_by_role('button', name='Reveal worked comparison', exact=True).click()
            assert w.get_by_role('status').is_visible()
            assert w.get_by_role('img', name='Your interval compared with the worked interval').is_visible()
            if id == 'bracket':
                assert 'not a statistical' in w.inner_text()
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            if id in ['line', 'parallax']:
                page.screenshot(path=str(out / f'{id}-{width}.png'))
                w.get_by_role('button', name='Try another example', exact=True).click()
                assert w.locator('table').inner_text() != original_data
                assert w.get_by_role('status').count() == 0
                w.locator('input').nth(0).fill('11')
                w.locator('input').nth(1).fill('2')
                w.get_by_role('button', name='Commit estimate', exact=True).click()
                w.get_by_role('button', name='Reveal worked comparison', exact=True).click()
            w.get_by_role('button', name='Finish exercise', exact=True).click()
            assert page.evaluate('(id)=>__game.getState().training["estimate:"+id].status', id) == 'completed'
            restore_check(page)
        page.reload(wait_until='networkidle')
        library(page).locator('[data-training="estimate:scatter"]').get_by_text('Completed with help', exact=True).wait_for()
        # Pendulum: keep a real UI reading, measure a different length, lock a
        # guess before the new timing, and compare only after keeping it.
        card = start(page, 'Predict a measured swing', 'estimate-pendulum')
        assert card.get_by_role('button', name='Finish exercise', exact=True).is_disabled()
        page.locator('[data-tut="pend-scale"] canvas').click(position={'x':100,'y':20})
        time_and_keep(page)
        assert page.evaluate('__game.getState().readings.at(-1).pendulum.period') > 0
        length = page.locator('[data-tut="pend-length"]')
        length.focus()
        length.press('End')
        page.locator('[data-tut="pend-scale"] canvas').click(position={'x':100,'y':20})
        practice = page.get_by_role('region', name='Swing prediction practice')
        practice.locator('input').nth(0).fill('2.5')
        practice.locator('input').nth(1).fill('.2')
        practice.get_by_role('button', name='Show reasoning hint', exact=True).click()
        assert practice.locator('.katex').count() > 0
        practice.get_by_role('button', name='Commit prediction', exact=True).click()
        assert practice.get_by_role('status').count() == 0
        time_and_keep(page)
        practice.get_by_role('status').wait_for()
        assert 'Observed:' in practice.get_by_role('status').inner_text()
        card.get_by_role('button', name='Prediction panel', exact=True).click()
        practice.get_by_role('status').scroll_into_view_if_needed()
        page.screenshot(path=str(out / f'pendulum-{width}.png'))
        card.get_by_role('button', name='Finish exercise', exact=True).click()
        restore_check(page)
        # Star: obtain two fresh observations using the observing controls,
        # commit at a future dusk and reveal only on a new target-time log.
        card = start(page, 'Predict from your star logs', 'estimate-star')
        page.get_by_role('button', name='Year', exact=True).click()
        practice = page.get_by_role('region', name='Star prediction practice')
        for _ in range(2):
            practice.get_by_role('button', name='Advance to an observing dusk', exact=True).click()
            page.get_by_role('button', name='Log star position', exact=True).click()
        assert page.evaluate('__game.getState().starObs.length') == 2
        practice.locator('input').nth(0).fill('invalid')
        practice.locator('input').nth(1).fill('1')
        assert practice.get_by_role('button', name='Commit prediction', exact=True).is_disabled()
        assert 'NaN' not in practice.locator('svg').inner_html()
        practice.locator('input').nth(0).fill('35')
        practice.get_by_role('button', name='Commit prediction', exact=True).click()
        assert practice.get_by_role('status').count() == 0
        assert page.evaluate('__game.getState().readingPredictions.star.comparison===undefined')
        page.reload(wait_until='networkidle')
        page.get_by_role('button', name='Year', exact=True).click()
        card = page.get_by_role('dialog', name='Flight School', exact=True)
        if card.get_by_role('button', name='Minimise', exact=True).count():
            card.get_by_role('button', name='Minimise', exact=True).click()
        practice.get_by_role('button', name='Advance to prediction time', exact=True).click()
        page.get_by_role('button', name='Log star position', exact=True).click()
        practice.get_by_role('status').wait_for()
        card.get_by_role('button', name='Prediction panel', exact=True).click()
        practice.get_by_role('status').scroll_into_view_if_needed()
        page.screenshot(path=str(out / f'star-{width}.png'))
        card.get_by_role('button', name='Finish exercise', exact=True).click()
        restore_check(page)
        # Existing Basic Training keeps the estimate optional: its measurement
        # step remains satisfied without committing any prediction.
        library(page).get_by_role('combobox', name='Skill group', exact=True).select_option('all')
        start(page, 'Basic Training', 'basic')
        page.evaluate("""async()=>{const {STEPS}=await __tut.steps();const g=__game.getState();__game.setState({screen:'pendulum',sheet:{g:{value:9,sigma:.1}},tutorial:{...g.tutorial,step:STEPS.findIndex(s=>s.id==='pend-send')}})}""")
        page.get_by_role('button', name='Optional prediction exercise', exact=True).click()
        assert page.get_by_role('region', name='Swing prediction practice').is_visible()
        assert page.evaluate('Object.keys(__game.getState().readingPredictions).length') == 0
        page.get_by_role('dialog', name='Flight School', exact=True).get_by_role('button', name='Next', exact=True).click()
        assert page.evaluate("__game.getState().tutorial.step") > 0
        # Next opens the horizon lesson in an effect; await it before exiting.
        page.get_by_role('button', name='Close lesson', exact=True).click()
        page.get_by_role('button', name='Exit tutorial', exact=True).click()
        page.get_by_role('button', name='Return to library', exact=True).click()
        restore_check(page)
        assert not errors, errors
        page.close()
    browser.close()
print('PASS seven estimation workshops, hints/math/ranges/repeats, real pendulum and star UI predictions, commit/observation gates, reload persistence, optional Basic Training and expedition restoration at phone/desktop widths')
