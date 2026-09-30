import {loadTestData,fixture} from './fixtures.mjs';
import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
 await page.goto(pathToFileURL(process.cwd()+'/dist/index.html').href);
 await loadTestData(page);
 await page.waitForFunction(()=>document.querySelector('#mapPreview canvas')?.dataset.textureVersion);
 await page.waitForTimeout(350);
 const info=()=>page.evaluate(()=>({scene:Number(document.querySelector('#mapPreview').dataset.sceneVersion),texture:Number(document.querySelector('#mapPreview canvas').dataset.textureVersion),scale:Number(document.querySelector('#mapPreview canvas').dataset.scale),width:document.querySelector('#mapPreview canvas').width}));
 const frame=await page.locator('#mapPreview').boundingBox(),before=await info();
 const pixels=await page.locator('#mapPreview canvas').evaluate(c=>c.toDataURL());
 await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2);await page.mouse.down();
 await page.mouse.move(frame.x+frame.width/2+2300,frame.y+frame.height/2+1300,{steps:20});await page.mouse.up();
 await page.waitForTimeout(250);
 assert.deepEqual(await info(),before,'Pan regenerated the scene or map texture');
 assert.notEqual(await page.locator('#mapPreview canvas').evaluate(c=>c.toDataURL()),pixels,'Pan did not move the map');
 assert.equal(await page.locator('#mapPreview svg').count(),0,'SVG painting remained in the interactive preview');
 const beforeScalePixels=await page.locator('#mapPreview canvas').evaluate(c=>c.toDataURL());
 await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2);await page.mouse.down({button:'middle'});
 await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2-80,{steps:4});await page.waitForTimeout(350);
 assert.deepEqual(await info(),before,'Held scale gesture regenerated the texture before release');
 assert.notEqual(await page.locator('#mapPreview canvas').evaluate(c=>c.toDataURL()),beforeScalePixels,'Scale was invisible until release');
 assert.ok(Math.abs(Number(await page.locator('#mapPreview canvas').getAttribute('data-preview-scale'))-1600/(1000*Number(await page.locator('#density').inputValue()))*Number(await page.locator('#zoom').inputValue()))<1e-9);
 await page.mouse.up({button:'middle'});
 await page.waitForFunction(old=>Number(document.querySelector('#mapPreview canvas').dataset.textureVersion)>old,before.texture);
 const scaled=await info();assert.equal(scaled.scene,before.scene+1);
 assert.ok(Math.abs(scaled.scale-1600/(1000*Number(await page.locator('#density').inputValue()))*Number(await page.locator('#zoom').inputValue()))<1e-9);
 // Continuous input must animate the existing cell at the throttled rate.
 const animated=await page.evaluate(async()=>{
  const canvas=document.querySelector('#mapPreview canvas'),zoom=document.querySelector('#zoom');
  let paints=0;const observer=new MutationObserver(records=>{paints+=records.filter(r=>r.attributeName==='data-preview-scale').length;});
  observer.observe(canvas,{attributes:true});zoom.dispatchEvent(new PointerEvent('pointerdown'));
  const version=canvas.dataset.textureVersion,scene=document.querySelector('#mapPreview').dataset.sceneVersion,start=performance.now();
  for(let i=0;i<30;i++){zoom.value=1+i/50;zoom.dispatchEvent(new Event('input'));await new Promise(resolve=>setTimeout(resolve,5));}
  await new Promise(resolve=>setTimeout(resolve,75));observer.disconnect();
  const result={paints,elapsed:performance.now()-start,reused:canvas.dataset.textureVersion===version && document.querySelector('#mapPreview').dataset.sceneVersion===scene};
  zoom.dispatchEvent(new PointerEvent('pointerup'));return result;
 });
 assert.ok(animated.reused);assert.ok(animated.paints>1 && animated.paints<20);
 assert.ok(animated.paints<=Math.ceil(animated.elapsed/33)+2);
 await page.waitForFunction(old=>Number(document.querySelector('#mapPreview canvas').dataset.textureVersion)>old,scaled.texture);
 const refreshed=await info();
 // Small changes within the old resolution bucket must still refresh after settling.
 await page.locator('#zoom').evaluate(zoom=>{zoom.value=Number(zoom.value)+.05;zoom.dispatchEvent(new Event('input'));zoom.dispatchEvent(new Event('change'));});
 await page.waitForFunction(old=>Number(document.querySelector('#mapPreview canvas').dataset.textureVersion)>old,refreshed.texture);
 const settled=await info();
 for(let i=0;i<20;i++)await page.setViewportSize({width:1440-i*10,height:1000});
 assert.deepEqual(await info(),settled,'Continuous resize allocated a new scene/framebuffer');
 await page.waitForFunction(old=>Number(document.querySelector('#mapPreview canvas').dataset.textureVersion)>old,settled.texture);
 const resized=await info();assert.equal(resized.scene,settled.scene+1);
 const bounds=await page.locator('#mapPreview').boundingBox();assert.equal(resized.width,Math.round(bounds.width*2));
 // The bitmap preview must agree with the independent full-vector exporter.
 const difference=await page.evaluate(async()=>{
  const actual=document.querySelector('#mapPreview canvas'),source=mapStudio.createSvg(actual.width);
  const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(source);await image.decode();
  const expected=document.createElement('canvas');expected.width=actual.width;expected.height=actual.height;
  const ctx=expected.getContext('2d');ctx.drawImage(image,0,0,actual.width,actual.height);
  const a=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data,b=ctx.getImageData(0,0,actual.width,actual.height).data;
  let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length;
 });
 assert.ok(difference<2,`Preview/export alignment mismatch: ${difference}`);
 console.log(`Interaction checks passed: pan reuses texture; held scale animates without regenerating; scale animation is throttled; even a small settled scale regenerates; resize waits until idle, then redraws at 2x density; mean preview/export pixel difference ${difference.toFixed(3)}.`);
}finally{await browser.close();}
