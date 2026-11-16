"""SCI-03: real bob motion, optional feedback and cosmetic reward lifecycle.

A deterministic fixture chooses a short-period world to keep the actual twenty-
swing browser measurement practical. Hidden values guide test waiting only.
"""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-technique')
out.mkdir(exist_ok=True)

def setup(page,mode='cadet'):
    return page.evaluate('''async(mode)=>{
      const {generateSystem}=await import('/src/engine/system.ts');
      const {surfaceGravity,pendulumPeriod}=await import('/src/engine/measure.ts');
      const {hash32}=await import('/src/engine/rng.ts');
      const {ECHO}=await import('/src/game/echo.ts');
      let seed=1;while(seed<500&&surfaceGravity(generateSystem(seed,mode))<25)seed++;
      __game.getState().newGame(seed,{difficulty:mode,sound:false,survival:false,formulas:true,freeRoam:true});
      __clock.t=500;__clock.paused=true;__clock.emit();
      __game.setState({phase:'play',screen:'pendulum',savedT:500,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5],sheet:{},readings:[]});
      const {currentWorld}=await import('/src/game/sim.ts');
      const sys=currentWorld().system;
      const length=.6+((hash32(sys.seed,60)/4294967296)*3-1.5)/100;
      return pendulumPeriod(surfaceGravity(sys),length,6*Math.PI/180);
    }''',mode)

def time_reading(page,N,seconds):
    page.get_by_role('button',name='Release',exact=True).click()
    page.get_by_role('button',name='Start',exact=True).click()
    page.wait_for_timeout(seconds*1000)
    page.get_by_role('button',name='Stop',exact=True).click()
    page.locator('.modal input').fill(str(N))
    page.get_by_role('button',name='Calculate g',exact=True).click()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        page.set_default_timeout(15000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        T=setup(page)
        page.get_by_role('slider',name='String length setting').focus()
        page.get_by_role('slider',name='String length setting').press('Home')
        page.locator('[data-tut="pend-scale"] canvas').click(position={'x':100,'y':20})
        page.get_by_role('button',name='Fit windscreen',exact=True).click()
        technique=page.get_by_role('region',name='Pendulum technique',exact=True)
        assert technique.locator('details').first.get_attribute('open') is None
        technique.get_by_text('Timing assistance & scoring',exact=True).click()
        expect(technique).to_contain_text('no score, fuel, hint uses or verification charges')
        # A number typed into the count dialog is not proof of twenty swings.
        time_reading(page,20,.15)
        page.get_by_role('button',name='Keep reading',exact=True).click()
        assert page.evaluate('__game.getState().pendulumMilestones.length')==0
        assert page.get_by_role('status',name='Twenty-swing celebration').count()==0
        # Real ordinary physics, timer and manual count entry; no fast-forward,
        # mocked result or synthetic motion record in the award path.
        time_reading(page,20,T*20.2)
        page.get_by_role('button',name='Keep reading',exact=True).click()
        expect(page.get_by_role('status',name='Twenty-swing celebration')).to_be_visible()
        assert page.evaluate('__game.getState().pendulumMilestones')==['twentySwings']
        record=page.evaluate('__game.getState().readings.at(-1)')
        assert record['pendulum']['technique']['source']=='manual'
        assert record['pendulum']['technique']['turns']>=39, record
        assert record['pendulum']['swings']==20
        assert page.evaluate('__game.getState().penaltyDv+__game.getState().checksUsed+__game.getState().hintsUsed')==0
        page.locator('.tool-stage').screenshot(path=str(out/f'celebration-{width}.png'))
        page.wait_for_timeout(3300)
        expect(page.get_by_role('status',name='Twenty-swing celebration')).to_have_count(0)
        # Two more actual releases make a three-release comparison group.
        for _ in range(2):
            time_reading(page,5,T*5.2)
            page.get_by_role('button',name='Keep reading',exact=True).click()
            assert page.get_by_role('status',name='Twenty-swing celebration').count()==0
        technique.get_by_text('Review my technique',exact=True).click()
        expect(technique).to_contain_text('✓ Controlled release recorded')
        expect(technique).to_contain_text('3 comparable kept timings from separate releases')
        expect(technique).to_contain_text('Your recorded period range:')
        sender=page.locator('[data-tut="pend-send"]').first
        sender.locator('input').fill('0.5')
        sender.get_by_role('button',name='Send to progress sheet',exact=True).click()
        expect(technique).to_contain_text('✓ Your progress sheet includes a stated gravity uncertainty')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        technique.screenshot(path=str(out/f'technique-{width}.png'))
        page.reload(wait_until='networkidle')
        technique=page.get_by_role('region',name='Pendulum technique',exact=True)
        expect(technique.locator('.technique-badge')).to_be_visible()
        assert technique.locator('details').first.get_attribute('open') is None
        assert page.get_by_role('status',name='Twenty-swing celebration').count()==0
        # Repeated eligible keeps after reload do not create another celebration.
        # This uses a stored-record fixture to test the lifecycle without a
        # second forty-second timing; the first award above used real motion.
        page.evaluate("const s=__game.getState();s.addReading(s.readings.find(r=>r.pendulum?.swings===20&&r.pendulum?.technique?.turns>=39));")
        assert page.evaluate('__game.getState().pendulumMilestones')==['twentySwings']
        # ECHO's existing practice shortcut is explicitly labeled and cannot
        # earn a manual technique badge, even though its note says 20 swings.
        setup(page,'legend')
        page.evaluate("async()=>{const t=await __tut.tutorial();t.doPendulum();}")
        assert page.evaluate('__game.getState().readings[0].pendulum.technique.source')=='echo'
        assert page.evaluate('__game.getState().pendulumMilestones.length')==0
        expect(page.get_by_text('ECHO-supplied timing; manual technique not recorded. Conditions not recorded.',exact=True)).to_be_visible()
        assert page.locator('details:has-text("Review my technique")').first.get_attribute('open') is None
        assert not errors,errors
        page.close()
    browser.close()
print('PASS SCI-03 actual twenty-swing motion and three-release review, false-count rejection, zero-point milestone, one-time/reload lifecycle, player uncertainty, ECHO labels and expert opt-in at phone/desktop sizes')
