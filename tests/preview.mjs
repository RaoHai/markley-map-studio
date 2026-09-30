import {loadTestData,fixture} from './fixtures.mjs';
import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const url=pathToFileURL(process.cwd()+'/dist/index.html').href;
 // The initial placeholder has a real frame even before JavaScript runs.
 const initial=await browser.newPage({javaScriptEnabled:false,viewport:{width:1440,height:1000}});
 await initial.goto(url);
 assert.ok((await initial.locator('.paper').boundingBox()).height>100);
 assert.equal(await initial.locator('#previewText').textContent(),'请先下载或导入地图数据。');
 assert.equal(await initial.locator('#mapPreview img').count(),0);
 await initial.close();
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Even if image/blob URLs are unavailable, the live preview must work.
 await page.addInitScript(()=>{URL.createObjectURL=()=>{throw Error('Blob URLs unavailable in preview test');};});
 await page.goto(url);
 await loadTestData(page);
 await page.waitForFunction(()=>document.querySelector('.paper').dataset.state==='ready');
 assert.equal(await page.locator('#previewMessage').isVisible(),false);
 await page.waitForFunction(()=>document.querySelector('#mapPreview canvas')?.dataset.textureVersion);
 const previous=await page.locator('#mapPreview').innerHTML();
 await page.evaluate(()=>{
  window.savedSea=document.querySelector('#sea');
  savedSea.remove();mapStudio.render();
 });
 assert.equal(await page.locator('.paper').getAttribute('data-state'),'error');
 assert.equal(await page.locator('#mapPreview').innerHTML(),previous);
 assert.ok((await page.locator('#previewText').textContent()).includes('保留'));
 await page.evaluate(()=>document.querySelector('.color-grid label').prepend(savedSea));
 await page.locator('#retryPreview').click();
 await page.waitForFunction(()=>document.querySelector('.paper').dataset.state==='ready');
 assert.equal(await page.locator('#previewMessage').isVisible(),false);
 await page.evaluate(async()=>{
  const zoom=document.querySelector('#zoom');
  for(let i=0;i<60;i++){
   zoom.value=.5+(i%15)/10;zoom.dispatchEvent(new Event('input'));
   await new Promise(requestAnimationFrame);
  }
 });
 assert.equal(await page.locator('.paper').getAttribute('data-state'),'ready');
 await page.waitForFunction(()=>Number(document.querySelector('#mapPreview canvas').dataset.scale)===1600/(1000*Number(document.querySelector('#density').value))*Number(document.querySelector('#zoom').value));
 assert.equal(await page.locator('#mapPreview canvas').count(),1);
 for(const width of [1440,1024,768,620,390,320]){
  await page.setViewportSize({width,height:1000});
  const frame=await page.locator('#mapPreview').boundingBox();
  assert.ok(frame.width>0 && frame.height>0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual(errors,[]);
 console.log('Preview checks passed: reserved loading frame, no blob dependency, preserve last map, retry, rapid zoom, six responsive widths.');
}finally{await browser.close();}
