"""SCI-01 actual sky UI at phone/desktop sizes; fixtures bypass opening story.

Coordinates select a test night and guide UI panning; all discoveries and notebook
entries use ordinary controls. This verifies behavior, not human enjoyment.
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright, expect

out = Path('/tmp/stranded-sky')
out.mkdir(exist_ok=True)

def setup(page, mode='cadet', chapter=1):
    return page.evaluate('''async({mode,chapter})=>{
      const {ECHO}=await import('/src/game/echo.ts');
      __game.getState().newGame(316,{difficulty:mode,sound:false,survival:false,formulas:true,freeRoam:true,freeRoamGuidance:mode==='cadet'},chapter);
      __game.setState({phase:'play',screen:'observatory',identified:false,storyQueue:[],echo:[],seenEcho:Object.values(ECHO).map(e=>e.id),actsSeen:[1,2,3,4,5]});
      const {currentWorld}=await import('/src/game/sim.ts');
      const {skyCode,skyDirection,skyline}=await import('/src/game/skyObservation.ts');
      const {localFrame,toHorizontal,starAltitude}=await import('/src/engine/sky.ts');
      const {makeLandscape}=await import('/src/render/terrain.ts');
      const {flareAt}=await import('/src/engine/flares.ts');
      const {system:sys,catalog}=currentWorld(), land=makeLandscape(sys.seed,sys.hillHeight);
      window.skyFixture={sys,catalog,skyCode,skyDirection,localFrame,toHorizontal,starAltitude,land,skyline,flareAt};
      return window.findSkyNight=(offset=0,kind='target')=>{
        for(let at=sys.firstOpposition+offset;at<sys.firstOpposition+offset+30*86400;at+=1800){
          const h=toHorizontal(skyDirection(sys,catalog,{kind},at),localFrame(sys,at,sys.site));
          if(starAltitude(sys,at,sys.site)<-18*Math.PI/180&&h.alt>25*Math.PI/180&&h.alt>skyline(land,h.az)&&!flareAt(sys,at)){
            __clock.t=at;__clock.paused=true;__clock.emit();__game.setState({savedT:at});
            return {at,az:h.az*180/Math.PI,alt:h.alt*180/Math.PI,code:skyCode(sys.seed,{kind}),stars:catalog.map((_,i)=>skyCode(sys.seed,{kind:'catalog',i}))};
          }
        }throw Error('No night fixture');
      }, findSkyNight(0,chapter===7?'giant':'target');
    }''', {'mode':mode,'chapter':chapter})

def pan_to(page, fixture):
    explorer=page.get_by_role('region',name='Sky exploration controls')
    text=explorer.inner_text()
    az,alt=map(float,re.search(r'Bearing (\d+)° · elevation (-?\d+)°',text).groups())
    delta=(fixture['az']-az+180)%360-180
    for _ in range(round(abs(delta)/15)):
        explorer.get_by_role('button',name='Pan sky right' if delta>0 else 'Pan sky left',exact=True).click()
    for _ in range(round(abs(fixture['alt']-alt)/10)):
        explorer.get_by_role('button',name='Pan sky up' if fixture['alt']>alt else 'Pan sky down',exact=True).click()
    summary=explorer.locator('summary').filter(has_text='Lights in this view')
    if summary.locator('..').get_attribute('open') is None:
        summary.click()
    page.locator(f'[data-sky-light="{fixture["code"]}"]').wait_for()
    return explorer

def select(page,code):
    page.locator(f'[data-sky-light="{code}"]').click()

def log(page,note):
    notebook=page.get_by_role('region',name='Sky observation notebook')
    notebook.get_by_role('textbox',name='What I noticed',exact=True).fill(note)
    notebook.get_by_role('button',name='Log selected light',exact=True).click()
    return notebook

def magnify(page):
    canvas=page.get_by_role('img',name='Telescope; arrow keys nudge the image and plus or minus zoom')
    for _ in range(23):
        for attempt in range(12):
            cue=page.locator('[aria-label="Selected light observations"] [role="status"]').inner_text()
            moved=False
            for word,direction in [('Left of','right'),('Right of','left'),('Above','down'),('Below','up')]:
                if word in cue:
                    page.get_by_role('button',name='Move telescope image '+direction,exact=True).click()
                    moved=True
            if not moved: break
        canvas.focus();canvas.press('+')
    page.get_by_text('Resolved disk at this scale.',exact=False).wait_for()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2 if width==390 else 1)
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto('http://localhost:5173/',wait_until='networkidle')
        fixture=setup(page)
        explorer=pan_to(page,fixture)
        assert explorer.get_by_text('Help me compare lights',exact=True).count()==1
        explorer.get_by_role('checkbox',name='Show neutral light labels').check()
        explorer.get_by_role('checkbox',name='Reduce visual twinkle').check()
        select(page,fixture['code'])
        notebook=log(page,'My first steady light')
        assert not page.evaluate('__game.getState().identified')
        stars=explorer.locator('[data-sky-light]').evaluate_all('(els)=>els.map(e=>e.dataset.skyLight)')
        star=next(code for code in stars if code in fixture['stars'])
        select(page,star)
        log(page,'Comparison light flickers')
        page.locator('[data-tut="obs-scope-btn"]').click()
        page.get_by_text('Point-like image at this scale.',exact=False).wait_for()
        canvas=page.get_by_role('img',name='Telescope; arrow keys nudge the image and plus or minus zoom')
        canvas.focus();canvas.press('ArrowLeft');canvas.press('ArrowRight')
        page.locator('[data-tut="obs-stage"]').screenshot(path=str(out/f'star-scope-{width}.png'))
        page.locator('[data-tut="obs-identify"]').click()
        assert not page.evaluate('__game.getState().identified')
        page.get_by_role('button',name='Wide sky',exact=True).click()
        fixture=page.evaluate('findSkyNight(20*86400)')
        pan_to(page,fixture)
        select(page,fixture['code'])
        notebook=log(page,'Returned on another night')
        notebook.get_by_role('combobox',name='Compare recorded light').select_option(label=star)
        assert notebook.get_by_text('Recorded pointing change:',exact=False).count()==1
        plot=notebook.get_by_role('group',name='Change between your recorded sky pointings')
        assert plot.locator('circle').count()==2
        assert plot.locator('rect').count()==1
        plot.locator('circle').last.focus();plot.locator('circle').last.press('Enter')
        assert 'Returned on another night' in notebook.get_by_role('status').inner_text()
        plot.locator('rect').focus();plot.locator('rect').press('Enter')
        assert 'Comparison light flickers' in notebook.get_by_role('status').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        notebook.screenshot(path=str(out/f'notebook-{width}.png'))
        page.reload(wait_until='networkidle')
        assert page.evaluate('__game.getState().skySightings.length')==3
        assert page.get_by_role('checkbox',name='Reduce visual twinkle').is_checked()
        assert not page.evaluate('__game.getState().identified')
        # The notebook is optional: a fresh hard-mode run can identify directly.
        fixture=setup(page,'legend')
        explorer=pan_to(page,fixture)
        assert explorer.get_by_text('Help me compare lights',exact=True).count()==0
        select(page,fixture['code'])
        page.locator('[data-tut="obs-scope-btn"]').click()
        assert page.evaluate('__game.getState().skySightings.length')==0
        magnify(page)
        page.locator('[data-tut="obs-stage"]').screenshot(path=str(out/f'blue-scope-{width}.png'))
        page.locator('[data-tut="obs-identify"]').click()
        assert page.evaluate('__game.getState().identified')
        # Giant stays a distinct visible body rather than masquerading as a star.
        fixture=setup(page,'cadet',7)
        pan_to(page,fixture);select(page,fixture['code'])
        page.locator('[data-tut="obs-scope-btn"]').click()
        magnify(page)
        page.locator('[data-tut="obs-stage"]').screenshot(path=str(out/f'giant-scope-{width}.png'))
        page.locator('[data-tut="obs-identify"]').click()
        assert not page.evaluate('__game.getState().identified')
        # Opaque weather blocks the same actual selected field and its actions.
        page.evaluate("""async()=>{const {isCloudy}=await import('/src/game/survival.ts');const s=__game.getState();let at=__clock.t;for(let n=0;n<1000&&!isCloudy(s.seed,at);n++)at+=3600;__game.setState({settings:{...s.settings,survival:true}});__clock.t=at;__clock.emit();}""")
        expect(page.get_by_role('button',name='Log selected light',exact=True)).to_be_disabled()
        expect(page.locator('[data-tut="obs-identify"]')).to_be_disabled()
        page.get_by_role('button',name='Wide sky',exact=True).click()
        page.get_by_text('Lights in this view (0)',exact=True).wait_for()
        # In daylight, the wide field must not offer invisible comparison stars.
        page.evaluate("""()=>{const {sys,starAltitude}=skyFixture;let at=__clock.t;for(let n=0;n<1000&&starAltitude(sys,at,sys.site)<15*Math.PI/180;n++)at+=1800;const s=__game.getState();__game.setState({settings:{...s.settings,survival:false}});__clock.t=at;__clock.emit();}""")
        page.wait_for_timeout(300)
        labels=page.locator('[data-sky-light]').evaluate_all('(els)=>els.map(e=>e.textContent)')
        assert all('Our star' in label for label in labels), labels
        assert not errors, errors
        page.close()
    browser.close()
print('Sky discovery, notebook comparisons, persistence, mode guidance and giant checks passed at 390/1440px.')
