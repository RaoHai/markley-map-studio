import {loadTestData,fixture} from './fixtures.mjs';
import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
 await loadTestData(page);
 await page.waitForFunction(()=>document.querySelector('#mapPreview canvas')?.dataset.textureVersion);
 await page.waitForTimeout(250);
 const initial=await page.locator('#mapPreview canvas').evaluate(c=>({density:c.dataset.pixelDensity,width:c.width,version:c.dataset.textureVersion}));
 const rect=await page.locator('#mapPreview').boundingBox();
 assert.equal(initial.density,'2');assert.equal(initial.width,Math.round(rect.width*2));
 await page.locator('#zoom').evaluate(el=>{el.value=8;el.dispatchEvent(new Event('input'));el.dispatchEvent(new Event('change'));});
 await page.waitForFunction(version=>document.querySelector('#mapPreview canvas').dataset.textureVersion!==version,initial.version,{timeout:30000});
 const maximum=await page.locator('#mapPreview canvas').evaluate(c=>({density:c.dataset.pixelDensity,textureWidth:Number(c.dataset.textureWidth),scale:Number(c.dataset.scale)}));
 const expected=Math.ceil(rect.width/2*8*2);
 assert.ok(maximum.textureWidth>=expected && maximum.textureWidth<=expected+1);assert.ok(maximum.textureWidth>4096);
 assert.equal(maximum.scale,6.4);
 console.log(`Retina checks passed: browser DPR 1 still renders at 2x; maximum scale refreshes a ${maximum.textureWidth}px cell (was capped at 4096px).`);
}finally{await browser.close();}
