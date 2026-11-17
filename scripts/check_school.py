"""Exercise the skill library and isolated guided modules at phone/desktop widths."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

out = Path('/tmp/stranded-school')
out.mkdir(exist_ok=True)

def library(page):
    return page.get_by_role('region', name='Flight School library', exact=True)

def close_library(page):
    library(page).locator('..').get_by_role('button', name='Close', exact=True).click()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])
    for width, height in [(390, 844), (1440, 900)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:5173/', wait_until='networkidle')
        page.evaluate('''()=>{__game.getState().newGame(91,{difficulty:'navigator',sound:false,survival:false,formulas:true});__clock.t=123;__clock.paused=true;__game.setState({phase:'title',savedT:123,sheet:{g:{value:9.81,sigma:.2}}})}''')
        page.get_by_role('button', name='Flight School', exact=False).click()
        lib = library(page)
        assert lib.locator('[data-training]').count() == 47
        assert lib.get_by_role('combobox', name='Skill group', exact=True).locator('option').count() == 7
        assert lib.get_by_role('button', name='Open · The distances of the stars', exact=True).is_enabled()
        stellar = lib.locator('[data-training="lesson:stellar"]')
        stellar.get_by_role('button', name='Skip for now', exact=True).click()
        assert stellar.get_by_text('Skipped for now', exact=True).is_visible()
        page.reload(wait_until='networkidle')
        library(page).locator('[data-training="lesson:stellar"]').get_by_text('Skipped for now', exact=True).wait_for()
        lib.get_by_role('combobox', name='Skill group', exact=True).select_option('predictions')
        assert lib.locator('[data-training]').count() == 12
        estimate = lib.locator('[data-training="lesson:estimate"]')
        estimate.get_by_role('button', name='Open · Making a good estimate', exact=True).click()
        page.get_by_role('button', name='Close lesson', exact=True).click()
        assert page.evaluate('__game.getState().training["lesson:estimate"].status') == 'started'
        estimate.get_by_role('button', name='Open · Making a good estimate', exact=True).click()
        page.locator('.lesson-modal').get_by_role('button', name='Got it', exact=True).click()
        assert page.evaluate('__game.getState().training["lesson:estimate"].status') == 'completed'
        estimate.get_by_role('button', name='Repeat · Making a good estimate', exact=True).click()
        page.get_by_role('button', name='Close lesson', exact=True).click()
        lib.get_by_role('combobox', name='Skill group', exact=True).select_option('all')
        lib.get_by_role('searchbox', name='Find a module', exact=True).fill('Use the pendulum')
        assert lib.locator('[data-training]').count() == 1
        page.screenshot(path=str(out / f'library-{width}.png'))
        lib.get_by_role('button', name='Open · Use the pendulum', exact=True).click()
        page.wait_for_function("__game.getState().schoolSession?.id==='gravity'", timeout=60000)
        assert page.evaluate('__game.getState().settings.freeRoam')
        # Use real instrument controls, then the explicitly labeled teaching
        # helper for repeated readings; assisted practice must be labeled.
        for _ in range(60):
            if page.evaluate('__game.getState().schoolSession===null'):
                break
            if page.locator('.lesson-modal').count():
                page.locator('.lesson-modal').get_by_role('button', name='Got it', exact=True).click()
            step = page.evaluate('''async()=>{const {STEPS}=await __tut.steps();return STEPS[__game.getState().tutorial.step].id}''')
            card = page.get_by_role('dialog', name='Flight School', exact=True)
            if step == 'go-pendulum':
                page.locator('[data-tut="hotspot-pendulum"]').click()
            elif step == 'pend-scale':
                page.locator('[data-tut="pend-scale"] canvas').click(position={'x':100,'y':20})
            elif step == 'pend-release':
                page.get_by_role('button', name='Release', exact=True).click()
            elif step == 'pend-watch':
                page.get_by_role('button', name='Start', exact=True).click()
                page.get_by_role('button', name='Stop', exact=True).click()
            elif step == 'pend-count':
                page.locator('.modal input').fill('1')
                page.get_by_role('button', name='Calculate g', exact=True).click()
            elif step in ['pend-keep', 'pend-repeat', 'pend-send']:
                helper = card.get_by_role('button', name='Do it for me', exact=False)
                if step == 'pend-repeat': helper = card.get_by_role('button', name='Add a reading for me', exact=False)
                if helper.count(): helper.click()
            if card.get_by_role('button', name='Finish exercise', exact=True).count():
                card.get_by_role('button', name='Finish exercise', exact=True).click()
                break
            next_button = card.get_by_role('button', name='Next', exact=True)
            if next_button.count(): next_button.click()
            else: page.wait_for_timeout(1200)
        library(page).wait_for()
        assert page.evaluate('__game.getState().sheet.g.value') == 9.81
        assert page.evaluate('__clock.t') == 123
        assert page.evaluate('__game.getState().training["exercise:gravity"].status') == 'completed'
        assert page.evaluate('__game.getState().training["exercise:gravity"].assisted')
        assert page.evaluate('__game.getState().schoolRewards.patches["exercise:gravity"].assisted')
        assert page.evaluate('__game.getState().schoolRewards.cards["exercise:gravity"].first.assisted')
        assert page.evaluate('__game.getState().atlas.length') == 0
        # A different exercise opens directly, without replaying Basic Training.
        library(page).get_by_role('button', name='Open · Read the horizon dip', exact=True).click()
        page.wait_for_function("__game.getState().schoolSession?.id==='radius'", timeout=60000)
        page.get_by_role('button', name='Close lesson', exact=True).click()
        page.get_by_role('button', name='Exit tutorial', exact=True).click()
        page.get_by_role('button', name='Skip exercise for now', exact=True).click()
        library(page).locator('[data-training="exercise:radius"]').get_by_text('Skipped for now', exact=True).wait_for()
        assert page.evaluate('__game.getState().sheet.g.value') == 9.81
        close_library(page)
        page.get_by_role('button', name='Campaign', exact=False).click()
        page.get_by_role('button', name='1 First Light', exact=False).click()
        page.get_by_role('button', name='Train first · recommended modules', exact=True).click()
        assert library(page).get_by_text('Recommended', exact=True).count() == 5
        close_library(page)
        assert page.get_by_role('button', name='Start chapter 1', exact=True).is_enabled()
        # Open the library from a live expedition and return with its clock/data intact.
        page.evaluate("__game.setState({phase:'play',schoolOpen:null,screen:'hub',seenEcho:['welcomeNavigator']})")
        page.evaluate('__clock.warpIndex=0; __clock.paused=false')
        page.get_by_role('button', name='Menu', exact=True).click()
        page.get_by_role('button', name='Open Flight School', exact=True).click()
        saved_time = page.evaluate('__clock.t')
        page.wait_for_timeout(250)
        assert page.evaluate('__clock.t') == saved_time
        library(page).get_by_role('button', name='Open · Basic Training', exact=True).click()
        page.wait_for_function("__game.getState().schoolSession?.id==='basic'", timeout=60000)
        page.get_by_role('button', name='Exit tutorial', exact=True).click()
        page.get_by_role('button', name='Return to library', exact=True).click()
        library(page).wait_for()
        assert page.evaluate('__game.getState().phase') == 'play'
        assert page.evaluate('__game.getState().settings.difficulty') == 'navigator'
        assert page.evaluate('__game.getState().sheet.g.value') == 9.81
        assert page.evaluate('__clock.t') == saved_time
        if width == 1440:
            # Smoke every remaining guided entry point and its prerequisite data.
            for module, title in [('sky','Find and track a planet'),('year','Log and fit the year'),('distance','Drive and measure parallax'),('size','Use the micrometer'),('moon','Fit the moon’s swing'),('sheet','Use the progress sheet'),('opposition','Mark an opposition'),('synodic','Measure the synodic period'),('planning','Plan a transfer')]:
                library(page).get_by_role('button', name='Open · '+title, exact=True).click()
                page.wait_for_function('(id)=>__game.getState().schoolSession?.id===id', arg=module, timeout=60000)
                page.get_by_role('button', name='Close lesson', exact=True).click()
                if module == 'moon':
                    assert page.evaluate('__game.getState().moonTrack.length') > 0
                    assert page.evaluate('__game.getState().sheet.dPar.value') > 0
                    assert page.evaluate('__game.getState().sheet.thetaM') is None
                if module == 'synodic':
                    assert page.evaluate('__game.getState().oppPicks.length') == 1
                    assert page.evaluate('__game.getState().sheet.P1.value') > 0
                    assert page.evaluate('__game.getState().sheet.S2') is None
                if module == 'year': assert page.evaluate('__game.getState().sheet.P1') is None
                if module == 'size': assert page.evaluate('__game.getState().sheet.alpha2') is None
                page.get_by_role('button', name='Exit tutorial', exact=True).click()
                page.get_by_role('button', name='Return to library', exact=True).click()
                library(page).wait_for()
                assert page.evaluate('__game.getState().sheet.g.value') == 9.81
                assert page.evaluate('__game.getState().sheet.R1') is None
                assert page.evaluate('__clock.t') == saved_time
        assert not errors, errors
        page.close()
    browser.close()
print('PASS 47-module library, filters/search, skip/view/complete/repeat, guided exercise and assisted completion, chapter recommendations, optional campaign start, safe return to title/live expedition at phone/desktop widths')
