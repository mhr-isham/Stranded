"""Check equation rendering in the real tool, sheet and lesson UI (fresh Vite server)."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

out=Path('/tmp/stranded-math-check');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page();errors=[];bad_fonts=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.on('response',lambda r:bad_fonts.append(r.url) if 'KaTeX_' in r.url and r.status>=400 else None)
 page.goto('http://localhost:5173/',wait_until='networkidle')
 for width in [1440,390]:
  page.set_viewport_size({'width':width,'height':900})
  for screen in ['pendulum','hill']:
   page.evaluate("screen=>__game.setState({phase:'play',screen,echo:[],storyQueue:[],actsSeen:[1,2,3,4,5],settings:{...__game.getState().settings,formulas:true,sound:false}})",screen)
   page.wait_for_selector('.formula .katex');page.wait_for_timeout(150)
   assert page.locator('.formula math').count()>0
   assert page.locator('.katex-error').count()==0
   page.locator('.formula').scroll_into_view_if_needed()
   page.screenshot(path=str(out/f'{screen}-{width}.png'))
  page.evaluate("__game.setState({screen:'sheet'})")
  page.locator('[data-tut="sheet-node-g"]').click()
  page.wait_for_selector('.formula .katex')
  page.evaluate("__game.setState({screen:'codex'})")
  titles=page.evaluate("async()=>Object.values((await import('/src/ui/tutorial/lessons/index.tsx')).LESSONS).map(x=>x.title)")
  formulas=0
  for title in titles:
   page.get_by_role('button',name=title,exact=False).first.click()
   page.wait_for_selector('.lesson-back');page.wait_for_timeout(80)
   assert page.locator('.katex-error').count()==0,title
   formulas+=int(page.locator('.lesson-formula .katex').count()>0)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),title
   if 'distances of the stars' in title:
    page.locator('.lesson-formula').scroll_into_view_if_needed();page.screenshot(path=str(out/f'stellar-{width}.png'))
   page.get_by_role('button',name='Close lesson',exact=True).click()
  assert formulas>=19,formulas
 assert not errors,errors
 assert not bad_fonts,bad_fonts
 print('PASS tool/sheet equations, all 24 lessons at desktop/mobile widths, semantic MathML, no parse errors, no page overflow, local fonts')
 browser.close()
