import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fixture} from './fixtures.mjs';
assert.ok(fs.statSync('dist/index.html').size<300000,'Application must not contain real geography');
assert.deepEqual(fs.readdirSync('data'),['README.md']);
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
 let requests=0,downloads=0,fail=true;
 page.on('download',()=>downloads++);
 await page.route('**/map-data.json',async route=>{
  requests++;
  await route.fulfill(fail?{status:503,body:'Unavailable',headers:{'Access-Control-Allow-Origin':'*'}}:{status:200,contentType:'application/json',body:JSON.stringify(fixture),headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
 await page.waitForTimeout(250);assert.equal(requests,0);assert.equal(downloads,0);
 assert.equal(await page.locator('#mapPreview canvas').count(),0);
 assert.equal(await page.locator('#exportSvg').isDisabled(),true);
 await page.screenshot({path:process.cwd()+'/../markley-map-studio-no-data.png',fullPage:true});
 await page.locator('#downloadData').click();await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(requests,0);
 await page.locator('#downloadData').click();await page.locator('#confirmDownload').click();
 await page.waitForFunction(()=>document.querySelector('#dataStatus').textContent.includes('失败'));
 assert.equal(requests,1);assert.equal(downloads,0);assert.ok(await page.locator('#downloadData').isEnabled());
 fail=false;await page.locator('#downloadData').click();
 const download=page.waitForEvent('download');await page.locator('#confirmDownload').click();await download;
 await page.waitForFunction(()=>document.querySelector('.paper').dataset.state==='ready');
 assert.equal(requests,2);assert.equal(downloads,1);assert.ok(await page.locator('#exportSvg').isEnabled());
 const previous=await page.locator('#mapPreview').innerHTML();
 await page.locator('#importData').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('null')});
 await page.waitForFunction(()=>document.querySelector('#dataStatus').textContent.includes('请选择'));
 assert.equal(await page.locator('#mapPreview').innerHTML(),previous);
 await page.reload();assert.equal(await page.locator('#mapPreview canvas').count(),0);assert.equal(requests,2);
 console.log('Data loading checks passed: no embedded geography, no automatic requests, explicit acknowledgement, failed download retry, download and load, invalid import preserves map, refresh clears data.');
}finally{await browser.close();}
