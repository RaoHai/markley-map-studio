import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
 await page.waitForFunction(()=>document.querySelector('#mapPreview svg')?.dataset.renderer==='vector');
 const result=await page.evaluate(async()=>{
  const svg=document.querySelector('#mapPreview svg'),cell=svg.querySelector('#map'),path=cell.firstElementChild;
  let frames=0;const observer=new MutationObserver(records=>{frames+=records.filter(r=>r.attributeName==='viewBox').length;});
  observer.observe(svg,{attributes:true});
  const start=performance.now(),zoom=document.querySelector('#zoom');
  for(let i=0;i<30;i++){
   zoom.value=1+i/20;zoom.dispatchEvent(new Event('input'));
   await new Promise(resolve=>setTimeout(resolve,5));
  }
  const inputMs=performance.now()-start;
  await new Promise(resolve=>setTimeout(resolve,350));observer.disconnect();
  const actual=[...svg.querySelectorAll('[data-copies] use')].map(n=>n.getAttribute('transform'));
  const expected=[...mapStudio.createSvg(2000).matchAll(/<use href="#map" transform="([^"]+)"/g)].map(m=>m[1]);
  return {frames,inputMs,stable:svg===document.querySelector('#mapPreview svg') && cell.firstElementChild===path,actual,expected,images:svg.querySelectorAll('image').length};
 });
 assert.ok(result.frames<30,`Did not throttle ${result.frames} redraws`);
 assert.ok(result.frames<=Math.ceil(result.inputMs/50)+4);
 assert.ok(result.stable);assert.equal(result.images,0);
 assert.deepEqual(result.actual,result.expected,'Idle zoom must redraw the final scale');
 // Wheel inactivity and middle-button release must both commit the last scale.
 const frame=await page.locator('#mapPreview').boundingBox();
 await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2);
 await page.mouse.wheel(0,-180);
 await page.waitForTimeout(350);
 const matchesFinal=()=>page.evaluate(()=>{
  const actual=[...document.querySelectorAll('#mapPreview [data-copies] use')].map(n=>n.getAttribute('transform'));
  const expected=[...mapStudio.createSvg(2000).matchAll(/<use href="#map" transform="([^"]+)"/g)].map(m=>m[1]);
  return JSON.stringify(actual)===JSON.stringify(expected);
 });
 assert.ok(await matchesFinal(),'Wheel idle did not redraw');
 await page.mouse.down({button:'middle'});await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2-80,{steps:4});await page.mouse.up({button:'middle'});
 await page.waitForFunction(()=>document.querySelector('#zoomValue').textContent===Number(document.querySelector('#zoom').value).toFixed(2)+'×');
 assert.ok(await matchesFinal(),'Middle-button release did not redraw');
 await page.locator('[data-palette="terracotta"]').click();
 await page.waitForFunction(()=>document.querySelector('#mapPreview #map')?.dataset.appearance.includes('#f2ddcb'));
 assert.equal(await page.locator('#mapPreview image').count(),0);
 assert.ok(await page.locator('#mapPreview [data-layer="china-maritime"]').count());
 console.log(`Interaction checks passed: ${result.frames} redraws for 30 inputs, persistent vector geometry, final idle/wheel/middle-release redraw, palette and China layers preserved.`);
}finally{await browser.close();}
