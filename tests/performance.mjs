import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
 await page.waitForFunction(()=>document.querySelector('#mapPreview svg')?.dataset.renderer==='cached');
 const result=await page.evaluate(async()=>{
  const svg=document.querySelector('#mapPreview svg'),cell=svg.querySelector('#map'),raster=cell.firstElementChild,durations=[];
  for(let i=0;i<60;i++){
   await new Promise(requestAnimationFrame);
   document.querySelector('#zoom').value=1+(i%20)/20;
   const start=performance.now();mapStudio.render();durations.push(performance.now()-start);
   if(document.querySelector('#mapPreview svg')!==svg || cell.firstElementChild!==raster)throw Error('Gesture rebuilt map geometry or texture');
  }
  const exported=mapStudio.createSvg(2000);
  return {p95:durations.sort((a,b)=>a-b)[57],copies:svg.querySelector('[data-copies]').children.length,raster:!!svg.querySelector('image[href^="data:image/png"]'),vectorExport:exported.includes('data-layer="china-maritime"') && !exported.includes('<image')};
 });
 assert.ok(result.p95<12,`Slow preview update: ${result.p95.toFixed(1)} ms`);
 assert.ok(result.copies>1 && result.copies<100);
 assert.ok(result.raster && result.vectorExport);
 await page.locator('[data-palette="terracotta"]').click();
 await page.waitForFunction(()=>document.querySelector('#mapPreview svg')?.dataset.renderer==='cached' && document.querySelector('#mapPreview #map')?.dataset.appearance.includes('#f2ddcb'));
 const key=await page.locator('#mapPreview #map').getAttribute('data-appearance');
 assert.ok(key.includes('#f2ddcb'));
 const oldTexture=await page.locator('#mapPreview image').getAttribute('href');
 await page.locator('#sea').fill('#123456');
 await page.waitForFunction(()=>document.querySelector('#mapPreview [data-background]').getAttribute('fill')==='#123456');
 assert.equal(await page.locator('#mapPreview image').getAttribute('href'),oldTexture);
 console.log(`Performance checks passed: stable preview/texture through 60 zoom frames, p95 ${result.p95.toFixed(1)} ms, palette refresh, sea-only cache reuse, vector export retained.`);
}finally{await browser.close();}
