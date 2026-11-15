"""Exercise Campaign, independent expeditions and the direct-entry sandbox in a fresh Vite server."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
out=Path('/tmp/stranded-entrypoints');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:d.accept())
 page.goto('http://localhost:5173/',wait_until='networkidle')
 page.get_by_role('button',name='Single expedition',exact=True).click()
 assert page.get_by_role('combobox').locator('option').count()==1
 page.get_by_role('button',name='Close',exact=True).click()
 page.get_by_role('button',name='Free Roam',exact=False).click()
 assert page.get_by_role('button',name='2. The Silent Planet',exact=True).is_enabled()
 assert page.get_by_role('button',name='9. Home',exact=True).is_enabled()
 page.get_by_role('button',name='2. The Silent Planet',exact=True).click()
 page.screenshot(path=str(out/'sandbox-setup-mobile.png'))
 page.get_by_role('button',name='Start exploring',exact=True).click()
 page.wait_for_function("__game.getState().phase==='play'",timeout=60000)
 s=page.evaluate('''()=>{const s=__game.getState();return {chapter:s.chapter,camp:s.camp,identified:s.identified,queue:s.storyQueue,echo:s.echo,campaign:s.campaign,settings:s.settings}}''')
 assert s['chapter']==2 and s['camp'] and s['identified']
 assert not s['queue'] and not s['echo'] and not s['campaign'],s
 assert not s['settings']['showTruth'] and not s['settings']['freeRoamGuidance']
 assert page.get_by_role('button',name='Probe bay').count()>0
 page.get_by_role('button',name='Menu',exact=True).click()
 page.get_by_role('button',name='ECHO guidance',exact=False).click()
 assert page.evaluate('__game.getState().settings.freeRoamGuidance')
 page.get_by_role('button',name='ECHO guidance',exact=False).click()
 page.get_by_role('button',name='Sandbox: show the true values',exact=False).click()
 assert page.evaluate('__game.getState().settings.showTruth')
 page.get_by_role('button',name='Practice landing',exact=True).click()
 page.wait_for_function("__game.getState().phase==='prologue'")
 page.get_by_role('button',name='Skip',exact=False).click()
 page.wait_for_function("__game.getState().phase==='play'")
 assert page.evaluate('__game.getState().storyQueue.length')==0
 assert page.evaluate('Object.keys(__game.getState().campaign).length')==0
 page.get_by_role('button',name='Menu',exact=True).click()
 page.get_by_role('button',name='Save & quit to title',exact=True).click()
 page.get_by_role('button',name='Continue',exact=True).click()
 page.wait_for_function("__game.getState().phase==='play'")
 # A successful sandbox transfer gives diagnostics, never scored progress.
 page.evaluate('''async()=>{const{currentWorld}=await import('/src/game/sim.ts');const{botPlay,PERFECT}=await import('/src/engine/solver.ts');const{bestTransfer}=await import('/src/engine/planner.ts');const r=botPlay(currentWorld().system,PERFECT,7);if(r.result?.outcome!=='success')throw Error('No successful fixture');const p=bestTransfer(r.model,r.departTime);__game.setState({phase:'results',outcome:{plan:p.plan,result:r.result,sheet:r.primaries}})}''')
 page.get_by_role('button',name='Return to exploring',exact=True).wait_for()
 assert page.get_by_role('button',name='Share result',exact=True).count()==0
 assert page.get_by_role('columnheader',name='Points',exact=True).count()==0
 assert page.evaluate('Object.keys(__game.getState().campaign).length')==0
 assert page.evaluate('__game.getState().atlas.length')==0
 assert page.evaluate('__game.getState().achievements.length')==0
 assert page.evaluate('__game.getState().debriefSeen') is False
 page.get_by_role('button',name='Return to exploring',exact=True).click()
 page.wait_for_function("__game.getState().phase==='play'")
 page.evaluate("__game.setState({phase:'title',campaign:{2:{done:true,best:{}}}})")
 page.get_by_role('button',name='Single expedition',exact=True).click()
 assert page.get_by_role('combobox').locator('option').count()==2
 page.get_by_role('combobox').select_option('2')
 page.get_by_placeholder('random',exact=True).fill('316')
 page.get_by_role('button',name='Launch expedition',exact=True).click()
 page.wait_for_function("__game.getState().phase==='prologue'",timeout=60000)
 assert page.evaluate('__game.getState().chapter')==2
 assert page.evaluate('__game.getState().settings.freeRoam') is False
 assert page.evaluate('__game.getState().settings.campaignRun') is False
 assert page.evaluate('__game.getState().settings.showTruth') is False
 page.evaluate('''async()=>{const{currentWorld}=await import('/src/game/sim.ts');const{botPlay,PERFECT}=await import('/src/engine/solver.ts');const{bestTransfer}=await import('/src/engine/planner.ts');const r=botPlay(currentWorld().system,PERFECT,7);if(r.result?.outcome!=='success')throw Error('No successful fixture');const p=bestTransfer(r.model,r.departTime);__game.setState({phase:'results',outcome:{plan:p.plan,result:r.result,sheet:r.primaries}})}''')
 page.get_by_role('button',name='Share result',exact=True).wait_for()
 page.wait_for_function('__game.getState().atlas.length===1')
 assert page.evaluate('Object.keys(__game.getState().campaign).length')==1
 assert page.evaluate('__game.getState().campaign[3]') is None
 assert page.get_by_role('button',name='Chapter 3:',exact=False).count()==0
 # Campaign still selects its own mode, independent of the previous sandbox.
 page.evaluate("__game.setState({phase:'title'})")
 page.get_by_role('button',name='Campaign',exact=False).click()
 page.get_by_role('button',name='1 First Light',exact=False).click()
 page.get_by_role('radio',name='Navigator',exact=False).click()
 page.get_by_role('button',name='Start chapter 1',exact=True).click()
 page.wait_for_function("__game.getState().phase==='prologue'",timeout=60000)
 assert page.evaluate('__game.getState().settings.campaignRun') is True
 assert page.evaluate('__game.getState().settings.difficulty')=='navigator'
 assert page.evaluate('__game.getState().settings.freeRoam') is False
 assert not errors,errors
 print('PASS mobile menus, variation locks, all sandbox systems, direct camp/tools, guidance/truth toggles, optional landing/continue, sandbox debrief isolation, independent seeded results, campaign mode selection')
 b.close()
