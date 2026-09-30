import {loadTestData,fixture} from './fixtures.mjs';
import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
 let downloads=0;page.on('download',()=>downloads++);
 await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
 await loadTestData(page);
 await page.waitForFunction(()=>document.querySelector('.paper').dataset.state==='ready');
 assert.ok((await page.locator('.data-notice').textContent()).includes('未经过官方审图，仅供学习'));
 await page.locator('#showDisclaimer').click();
 assert.equal(await page.locator('#downloadDisclaimer').isVisible(),true);
 assert.equal(await page.locator('#confirmDownload').isVisible(),false);
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 assert.equal(downloads,0);
 await page.locator('#exportSvg').click();
 assert.equal(await page.locator('#downloadDisclaimer').isVisible(),true);
 assert.equal(await page.locator('#downloadFormat').textContent(),'SVG');
 assert.equal(downloads,0);
 await page.getByRole('button',{name:'取消',exact:true}).click();
 await page.waitForTimeout(100);assert.equal(downloads,0);
 await page.locator('#exportPng').click();assert.equal(await page.locator('#downloadFormat').textContent(),'PNG');
 await page.keyboard.press('Escape');await page.waitForTimeout(100);assert.equal(downloads,0);
 await page.locator('#exportSvg').click();
 const downloaded=page.waitForEvent('download');await page.locator('#confirmDownload').click();await downloaded;
 assert.equal(downloads,1);assert.equal(await page.locator('#downloadDisclaimer').isVisible(),false);
 assert.ok((await page.evaluate(()=>mapStudio.createSvg(2000))).includes('未经过官方审图，仅供学习'));
 // Acknowledgement is required again for each export; no saved global consent.
 await page.locator('#exportPng').click();assert.equal(await page.locator('#downloadDisclaimer').isVisible(),true);
 await page.setViewportSize({width:320,height:700});
 const bounds=await page.locator('#downloadDisclaimer').boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=320);
 assert.ok(await page.locator('#confirmDownload').isVisible());
 await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(downloads,1);
 console.log('Disclaimer checks passed: visible data notice, PNG/SVG prompt, cancel/Escape prevent downloads, confirmation downloads once, every download prompts, SVG metadata, mobile fit.');
}finally{await browser.close();}
