"""SCI-04 hill travel/aiming checks using ordinary UI after deterministic setup.

The fixture bypasses story and supplies equipment for the equipment test only.
It does not align the instrument to the true horizon or certify human accuracy.
"""
from pathlib import Path
import math
import shutil
from playwright.sync_api import sync_playwright, expect

out=Path('/tmp/stranded-hill')
out.mkdir(exist_ok=True)

def setup(page,mode='navigator',equipment=False,deadline=False):
    return page.evaluate('''async({mode,equipment,deadline})=>{
      const {ECHO}=await import('/src/game/echo.ts');
      __game.getState().newGame(316,{difficulty:mode,sound:false,survival:equipment,formulas:!equipment,freeRoam:!deadline});
      const {currentWorld}=await import('/src/game/sim.ts');const sys=currentWorld().system;
      __clock.t=deadline?sys.lifeSupport-30:500;__clock.warpIndex=5;__clock.paused=true;__clock.emit();
      const s=__game.getState();
      __game.setState({phase:'play',screen:'hill',savedT:__clock.t,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5],readings:[],sheet:{},camp:{site:'flat',landing:'clean',x:0,hillKm:4,iceKm:6},survival:{...s.survival,upgrades:equipment?['tripod','vernier']:[]}});
      return {height:sys.hillHeight,at:__clock.t};
    }''',{'mode':mode,'equipment':equipment,'deadline':deadline})

def time_label(seconds):
    minutes=math.floor(seconds/60+.5)
    hours,rest=divmod(minutes,60)
    return (f'{hours} h'+(f' {rest} min' if rest else '')) if hours else f'{minutes} min'

def pitch(page):
    return float(page.get_by_label('Instrument pitch',exact=True).inner_text().replace('°',''))

def station(page,i):
    return page.locator(f'[data-hill-station="{i}"]')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=3 if width==390 else 1,has_touch=width==390)
        page.set_default_timeout(15000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        fixture=setup(page)
        controls=page.get_by_role('region',name='Horizon aiming controls',exact=True)
        canvas=page.get_by_role('img',name='Horizon instrument; arrows adjust pitch, plus or minus zoom, Space braces, Enter reads')
        expect(station(page,0)).to_be_disabled()
        cost=(fixture['height']/350+.25+1)*3600
        expect(station(page,3)).to_contain_text('≈ '+time_label(cost)+' expedition time')
        assert f'{fixture["height"]} m' in station(page,3).inner_text()
        canvas.focus();canvas.press('ArrowUp')
        expect(page.get_by_label('Instrument pitch',exact=True)).to_have_text('-0.295°')
        canvas.press('Shift+ArrowDown')
        expect(page.get_by_label('Instrument pitch',exact=True)).to_have_text('-0.345°')
        controls.get_by_role('button',name='Raise instrument',exact=True).click()
        expect(page.get_by_label('Instrument pitch',exact=True)).to_have_text('-0.340°')
        # The same CSS drag must work even above the renderer's DPR cap of 2.
        box=canvas.bounding_box();start=pitch(page)
        x,y=box['x']+box['width']*.5,box['y']+box['height']*.35
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,y+60,steps=8);page.mouse.up()
        expected=start+60/(box['height']*4)
        page.wait_for_timeout(100)
        assert abs(pitch(page)-expected)<.006,(pitch(page),expected)
        # Brace can be activated by touch or native keyboard, with an honest
        # real-time countdown even while the expedition clock is paused.
        brace=controls.get_by_role('button',name='Brace (4 s)',exact=True)
        if width==390: brace.tap()
        else: brace.focus();brace.press('Space')
        expect(controls.get_by_label('Brace status')).to_contain_text('Braced')
        clock_at=page.evaluate('__clock.t')
        page.wait_for_timeout(450)
        meter=controls.get_by_role('meter',name='Brace time remaining')
        assert 0<float(meter.get_attribute('value'))<3.8
        assert page.evaluate('__clock.t')==clock_at
        controls.get_by_role('button',name='Read angle',exact=True).click()
        page.wait_for_timeout(4100)
        expect(controls.get_by_label('Brace status')).to_have_text('Unbraced')
        page.get_by_role('button',name='Keep reading',exact=True).click()
        saved=page.evaluate('__game.getState().readings[0]')
        assert saved['environment']['horizon']['aim']=={'braced':True,'tripod':False,'stepDeg':.005,'zoom':4}
        notes=page.locator('.measurement-notes').first
        notes.locator('summary').click()
        expect(notes).to_contain_text('At capture: hand-held, braced')
        page.locator('[data-tut="hill-stage"]').screenshot(path=str(out/f'aiming-{width}.png'))
        # Pause the journey briefly through the HUD to inspect in-transit UI.
        station(page,3).click()
        page.get_by_title('Tap to pause / resume',exact=True).click()
        expect(page.get_by_role('status',name='Hill journey',exact=True)).to_be_visible()
        expect(controls.get_by_role('button',name='Read angle',exact=True)).to_be_disabled()
        expect(controls.get_by_role('button',name='Raise instrument',exact=True)).to_be_disabled()
        target=page.evaluate('__clock.stopAt')
        assert math.isclose(target,clock_at+cost,abs_tol=1e-6)
        during=pitch(page)
        canvas.focus();canvas.press('ArrowUp');canvas.press('Enter')
        assert pitch(page)==during
        assert page.locator('[data-tut="hill-result"]').count()==0
        page.locator('[data-tut="hill-stage"]').screenshot(path=str(out/f'travel-{width}.png'))
        page.get_by_title('Tap to pause / resume',exact=True).click()
        expect(station(page,3)).to_have_attribute('aria-current','location',timeout=25000)
        assert page.evaluate('__clock.paused')
        assert page.evaluate('__clock.warpIndex')==5
        assert math.isclose(page.evaluate('__clock.t'),clock_at+cost,abs_tol=1e-6)
        arrived=page.evaluate('__clock.t')
        page.wait_for_timeout(300)
        assert page.evaluate('__clock.t')==arrived
        expect(page.get_by_label('Current survey height')).to_contain_text(f'{fixture["height"]+1.7:,.1f} m')
        saddle=math.floor(fixture['height']*.55+.5)
        down=(abs(fixture['height']-saddle)/350+.25)*3600
        expect(station(page,2)).to_contain_text('≈ '+time_label(down)+' expedition time')
        station(page,2).click()
        expect(station(page,2)).to_have_attribute('aria-current','location',timeout=25000)
        assert math.isclose(page.evaluate('__clock.t'),arrived+down,abs_tol=1e-6)
        # Cancellation retains time already spent and does not later claim arrival.
        setup(page)
        station(page,3).click()
        page.wait_for_timeout(100)
        page.get_by_role('button',name='← Camp',exact=True).click()
        page.wait_for_function('__game.getState().screen==="hub"')
        canceled=page.evaluate('__clock.t')
        assert canceled>500
        assert page.evaluate('__clock.paused')
        assert page.evaluate('__clock.stopAt===Infinity')
        page.wait_for_timeout(500)
        assert page.evaluate('__clock.t')==canceled
        assert page.evaluate('!__game.getState().tutorial.flags.includes("hill-summit")')
        # A pause explicitly made during travel also survives leaving the tool,
        # even when the expedition had been running before departure.
        setup(page)
        page.evaluate('__clock.warpIndex=0;__clock.paused=false;__clock.emit()')
        station(page,3).click()
        page.get_by_title('Tap to pause / resume',exact=True).click()
        page.get_by_role('button',name='← Camp',exact=True).click()
        page.wait_for_function('__game.getState().screen==="hub"')
        assert page.evaluate('__clock.paused')
        assert page.evaluate('__clock.warpIndex')==0
        # Tripod and vernier are real equipment; expert mode gets the controls
        # and observational statuses without an automatic method or gyro access.
        setup(page,'legend',True)
        controls=page.get_by_role('region',name='Horizon aiming controls',exact=True)
        expect(controls).to_contain_text('Tripod fitted')
        controls.get_by_role('button',name='Raise instrument',exact=True).click()
        expect(page.get_by_label('Instrument pitch',exact=True)).to_have_text('-0.299°')
        controls.get_by_role('button',name='Read angle',exact=True).click()
        page.get_by_role('button',name='Keep reading',exact=True).click()
        aim=page.evaluate('__game.getState().readings[0].environment.horizon.aim')
        assert aim=={'tripod':True,'braced':False,'stepDeg':.001,'zoom':4}
        assert page.locator('.katex').count()==0
        page.reload(wait_until='networkidle')
        assert page.evaluate('__game.getState().readings[0].environment.horizon.aim')==aim
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        # A deadline reached en route is not a successful arrival or mission.
        setup(page,deadline=True)
        station(page,3).click()
        page.wait_for_function('__game.getState().phase==="results"')
        assert page.evaluate('!__game.getState().tutorial.flags.includes("hill-summit")')
        assert not errors,errors
        page.close()
    browser.close()
print('PASS SCI-04 preview/charged travel time, paused arrival, cancellation/deadline guards, keyboard/touch/DPR-3 aiming, brace countdown, frozen equipment provenance and expert/formula-off behavior at 390/1440px')
