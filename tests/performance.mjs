import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
 await page.waitForFunction(()=>document.querySelector('#mapPreview svg')?.dataset.renderer==='vector');
 await page.waitForTimeout(250);
 await page.evaluate(()=>{
  window.redraws=0;window.scene=document.querySelector('#mapPreview svg');window.originalPath=scene.querySelector('#map path');
  window.originalCopies=[...scene.querySelectorAll('[data-copies] use')];
  new MutationObserver(records=>{redraws+=records.filter(r=>r.attributeName==='viewBox').length;}).observe(scene,{attributes:true});
 });
 const frame=await page.locator('#mapPreview').boundingBox();
 await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2);
 const before=await page.locator('#tessellation').getAttribute('patternTransform');
 await page.mouse.down();await page.mouse.move(frame.x+frame.width/2+2300,frame.y+frame.height/2+1300,{steps:12});await page.mouse.up();
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>redraws),0,'Pan must not redraw, even after release');
 assert.notEqual(await page.locator('#tessellation').getAttribute('patternTransform'),before);
 assert.ok(await page.evaluate(()=>scene.querySelector('#map path')===originalPath && originalCopies.every((n,i)=>scene.querySelectorAll('[data-copies] use')[i]===n)));
 // A held middle-button gesture must not redraw during a pause.
 await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2);
 const oldPattern=await page.locator('#tessellation').getAttribute('patternTransform');
 await page.mouse.down({button:'middle'});await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2-80,{steps:4});
 await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>redraws),0,'Held scale gesture redrew before release');
 assert.equal(await page.locator('#tessellation').getAttribute('patternTransform'),oldPattern);
 await page.mouse.up({button:'middle'});
 await page.waitForFunction(()=>redraws===1);
 const matchesScale=()=>page.evaluate(()=>{
  const pattern=document.querySelector('#tessellation');
  const actual=Number(pattern.getAttribute('patternTransform').match(/scale\(([^)]+)\)/)[1]);
  const expected=1600/(Number(pattern.getAttribute('width'))*Number(document.querySelector('#density').value))*Number(document.querySelector('#zoom').value);
  return Math.abs(actual-expected)<1e-9;
 });
 assert.ok(await matchesScale());
 const slider=await page.evaluate(async()=>{
  redraws=0;
  for(let i=0;i<30;i++){
   document.querySelector('#zoom').value=1+i/20;document.querySelector('#zoom').dispatchEvent(new Event('input'));
   await new Promise(resolve=>setTimeout(resolve,5));
  }
  const during=redraws;await new Promise(resolve=>setTimeout(resolve,350));return {during,after:redraws};
 });
 assert.deepEqual(slider,{during:0,after:1});assert.ok(await matchesScale());
 const wheel=await page.evaluate(async()=>{
  redraws=0;const preview=document.querySelector('#mapPreview'),rect=preview.getBoundingClientRect();
  for(let i=0;i<10;i++){
   preview.dispatchEvent(new WheelEvent('wheel',{deltaY:-20,clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,cancelable:true}));
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  const during=redraws;await new Promise(resolve=>setTimeout(resolve,350));return {during,after:redraws};
 });
 assert.deepEqual(wheel,{during:0,after:1});assert.ok(await matchesScale());
 // Compare the periodic preview against the independently tiled vector export.
 const difference=await page.evaluate(async()=>{
  const sources=[new XMLSerializer().serializeToString(scene),mapStudio.createSvg(1600)];const pixels=[];
  for(const source of sources){
   const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(source);await image.decode();
   const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=693;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,1600,693);pixels.push(ctx.getImageData(0,0,1600,693).data);
  }
  let total=0;for(let i=0;i<pixels[0].length;i++)total+=Math.abs(pixels[0][i]-pixels[1][i]);return total/pixels[0].length;
 });
 assert.ok(difference<1,`Preview/export periodic alignment mismatch: ${difference}`);
 assert.equal(await page.locator('#mapPreview image').count(),0);
 console.log(`Interaction checks passed: pan has zero redraws; held scale has zero redraws; release/slider idle/wheel idle redraw once; periodic preview matches vector export (mean pixel difference ${difference.toFixed(3)}).`);
}finally{await browser.close();}
