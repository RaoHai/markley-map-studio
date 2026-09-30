import {p,W,H,d3} from './projection.js';
import {mesh,feature} from 'topojson-client';
import {setCartography,countryFill,antarcticaFill,provincePath,oceanFill,oceanLabels,scaleBar} from './cartography.js';
const $=id=>document.getElementById(id);
const path=d3.geoPath(p).digits(3);
let dataLoaded=false,land='',edges='',maritimePath='',islandPath='',shoalPath='';
function loadMapData(data){
 if(!data||data.format!=='markley-map-data-v1'||data.world?.type!=='Topology'||!data.world.objects?.countries||!data.world.objects?.land||!Array.isArray(data.maritime?.features)||!Array.isArray(data.islands?.features)||!data.provinces?.geometry||!Array.isArray(data.bathymetry?.features))throw Error('请选择 Markley 地图数据包 JSON。');
 const world=data.world;
 const nextLand=path(feature(world,world.objects.land)),nextEdges=path(mesh(world,world.objects.countries)),nextMaritime=path(data.maritime);
 const nextIslands=d3.geoPath(p).pointRadius(.7)({type:'FeatureCollection',features:data.islands.features.filter(f=>f.properties.kind!=='shoal')});
 const nextShoals=d3.geoPath(p).pointRadius(.9)({type:'FeatureCollection',features:data.islands.features.filter(f=>f.properties.kind==='shoal')});
 if([nextLand,nextEdges,nextMaritime,nextIslands,nextShoals].some(s=>s&&/NaN|Infinity/.test(s)))throw Error('数据包含无法投影的坐标。');
 setCartography(world,data.provinces,data.bathymetry,data.oceanLabels);
 [land,edges,maritimePath,islandPath,shoalPath]=[nextLand,nextEdges,nextMaritime,nextIslands,nextShoals];
 dataLoaded=true;appearanceKey='';textureKey='';$('mapControls').disabled=false;
 $('dataStatus').textContent='数据已加载，仅在当前浏览器会话中使用。';
 $('previewText').textContent='正在生成地图…';$('previewMessage').hidden=false;
 finishRender();
}
const grids=new Map();
const palettes={
 terracotta:['#D6A071','#F2DDCB','#995F4E','#A56E55'],
 mist:['#AEBFC9','#DCD3C1','#FAF7F0','#748D98'],
 ocean:['#F2F3ED','#17485B','#D4E7E6','#87A9B4'],
 ink:['#FAF9F5','#FAF9F5','#202828','#82908E']
};
const state={offsetX:0,offsetY:0,aspect:4/Math.sqrt(3)};
const ratios={original:4/Math.sqrt(3),wide:16/9,ultrawide:21/9,square:1,print:3/2,tile:1/(4*H/W)};
function pixels(validate=false){
 const width=Number($('outputWidth').value),height=Number($('outputHeight').value);
 if(validate&&(!Number.isInteger(width)||!Number.isInteger(height)||width<64||height<64||width>12000||height>12000))throw Error('宽度和高度请输入 64–12000 之间的整数。');
 return [width||4000,height||1732];
}
function syncResolution(id){
 if(id==='ratio'){
  if(ratios[$('ratio').value])state.aspect=ratios[$('ratio').value];
  $('outputHeight').value=Math.round(pixels()[0]/state.aspect);
 }else if(id==='resolution'){
  $('outputWidth').value=$('resolution').value;
  $('outputHeight').value=Math.round(pixels()[0]/state.aspect);
 }else if(id==='outputWidth'||id==='outputHeight'){
  if(!$(id).value)return;
  if($('lockAspect').checked||$('ratio').value==='tile'){
   if(id==='outputWidth')$('outputHeight').value=Math.round(pixels()[0]/state.aspect);
   else $('outputWidth').value=Math.round(pixels()[1]*state.aspect);
  }else{ $('ratio').value='custom';state.aspect=pixels()[0]/pixels()[1]; }
 }else if(id==='lockAspect'&&$('lockAspect').checked)state.aspect=pixels()[0]/pixels()[1];
 $('outputHeight').readOnly=$('ratio').value==='tile';
}
let currentSvg='';
let renderTimer=0,renderFrame=0,settleTimer=0,lastRender=-Infinity;
const renderInterval=50;
const svgNS='http://www.w3.org/2000/svg';
let previewCanvas,previewContext,previewScale=1,previewStyle,texture,textureKey='',textureGeneration=0,paintFrame=0;
let appearanceKey='',cellSource='',scalePending=false,sliderScaling=false;
let scalePaintTimer=0,lastScalePaint=-Infinity;
const scalePaintInterval=33;

function dimensions(){
 const mode=$('ratio').value;
 if(mode==='tile')return [1000,4*H];
 const [width,height]=pixels();
 return [1600,1600*height/width];
}
function grid(){const step=+$('spacing').value;if(!grids.has(step))grids.set(step,path(d3.geoGraticule().step([step,step]).precision(.5)()));return grids.get(step);}
function layout(unit=false,preview=false){
 const [vw,vh]=unit?[W,4*H]:dimensions(),tile=$('ratio').value==='tile';
 const k=preview?previewScale:unit||tile?1:vw/(W*+$('density').value)*+$('zoom').value;
 const tw=W*k,th=H*k,ox=unit||tile?0:state.offsetX,oy=unit||tile?0:state.offsetY;
 const transforms=[],copies=[];
 const j0=Math.floor((-oy-th/2)/(2*th))-1,j1=Math.ceil((vh-oy+th)/(2*th))+1;
 const i0=Math.floor((-ox-tw)/(tw))-2,i1=Math.ceil((vw-ox+tw)/tw)+2;
 for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
  const x=tw/2+(i+(j%2)/2)*tw+ox,y=th/2+2*j*th+oy;
  for(const [r,dx,dy] of [[180,-tw/4,-th],[0,0,0]]){
   const cx=x+dx,cy=y+dy;if(cx+tw/2<0||cx-tw/2>vw||cy+th/2<0||cy-th/2>vh)continue;
   transforms.push(`translate(${cx} ${cy}) rotate(${r}) scale(${k})`);copies.push({x:cx,y:cy,rotation:r});
  }
 }
 return {vw,vh,k,transforms,copies};
}
function appearance(){
 const line=+$('lineWidth').value,gwidth=+$('gridWidth').value;
 const [sea,landColor,lineColor,gridColor]=['sea','land','line','grid'].map(id=>$(id).value);
 const showGrid=$('showGrid').checked,opacity=$('gridOpacity').value,step=$('spacing').value;
 const fillStyle=$('countryFill').value,showOcean=$('showOcean').checked&&!$('transparent').checked,showProvinces=$('showProvinces').checked,showScale=$('showScale').checked,showOceanLabels=$('showOceanLabels').checked;
 const key=JSON.stringify([landColor,lineColor,gridColor,line,gwidth,showGrid,opacity,step,fillStyle,showOcean,showProvinces,showScale,showOceanLabels,sea]);
 if(key!==appearanceKey){
  cellSource=`${showOcean?oceanFill(sea):''}<path d="${land}" fill="${landColor}" stroke="${landColor}" stroke-width=".3"/>${countryFill(fillStyle)}${antarcticaFill()}${showGrid?`<path d="${grid()}" fill="none" stroke="${gridColor}" stroke-width="${gwidth}" opacity="${opacity}"/>`:''}${showProvinces?`<path data-layer="china-provinces" d="${provincePath}" fill="none" stroke="${lineColor}" stroke-width="${line*.55}" opacity=".75"/>`:''}<path d="${edges}" fill="none" stroke="${lineColor}" stroke-width="${line}"/><path data-layer="china-maritime" d="${maritimePath}" fill="none" stroke="${lineColor}" stroke-width="${line}"/><path data-layer="china-islands" d="${islandPath}" fill="${landColor}" stroke="${lineColor}" stroke-width="${Math.max(.25,line*.65)}"/><path data-layer="china-shoals" d="${shoalPath}" fill="none" stroke="${lineColor}" stroke-width="${Math.max(.25,line*.65)}"/>${showOceanLabels?oceanLabels(gridColor):''}${showScale?scaleBar(gridColor):''}`;
  appearanceKey=key;
 }
 return {key,sea,transparent:$('transparent').checked,source:cellSource};
}
const metadata='User-loaded external geographic data; no map-review approval is claimed by this tool. Lee conformal tetrahedral projection with Markley rectangular arrangement. Shared national-boundary topology. 未经过官方审图，仅供学习。';
function createSvg(pixelWidth){
 if(!dataLoaded)throw Error('请先下载或导入地图数据。');
 const {vw,vh,transforms}=layout(),{source,sea,transparent}=appearance();
 const ph=Math.round(pixelWidth*vh/vw);
 return `<svg xmlns="${svgNS}" width="${pixelWidth}" height="${ph}" viewBox="0 0 ${vw} ${vh}"><title>Markley Tessellated World Map</title><metadata>${metadata}</metadata><defs><clipPath id="cell"><rect x="${-W/2}" y="${-H/2}" width="${W}" height="${H}"/></clipPath><g id="map" clip-path="url(#cell)" stroke-linejoin="round" stroke-linecap="round">${source}</g></defs>${transparent?'':`<rect width="100%" height="100%" fill="${sea}"/>`}${transforms.map(t=>`<use href="#map" transform="${t}"/>`).join('')}</svg>`;
}
function paintPreview(){
 if(!texture||!previewContext)return;
 const {vw,vh,k,copies}=layout(false,true),ctx=previewContext;
 previewCanvas.dataset.previewScale=String(k);
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,previewCanvas.width,previewCanvas.height);
 const sx=previewCanvas.width/vw,sy=previewCanvas.height/vh;
 if(!previewStyle.transparent){ctx.fillStyle=previewStyle.sea;ctx.fillRect(0,0,previewCanvas.width,previewCanvas.height);}
 for(const cell of copies){
  ctx.setTransform(sx,0,0,sy,cell.x*sx,cell.y*sy);
  if(cell.rotation)ctx.rotate(Math.PI);
  // Only copy pixels from the existing cell. No SVG painting during drag.
  ctx.drawImage(texture,-W*k/2,-H*k/2,W*k,H*k);
 }
}
function movePreview(){
 if(paintFrame)return;
 paintFrame=requestAnimationFrame(()=>{paintFrame=0;paintPreview();});
}
function updatePreview(style,view){
 const preview=$('mapPreview');
 if(!previewCanvas){
  previewCanvas=document.createElement('canvas');previewCanvas.setAttribute('aria-hidden','true');
  previewCanvas.style.cssText='display:block;width:100%;height:100%';
  preview.replaceChildren(previewCanvas);previewContext=previewCanvas.getContext('2d');
  if(!previewContext)throw Error('浏览器无法创建地图预览画布。');
 }
 previewScale=view.k;previewStyle=style;
 const rect=preview.getBoundingClientRect(),dpr=2;
 const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
 if(previewCanvas.width!==width||previewCanvas.height!==height){previewCanvas.width=width;previewCanvas.height=height;}
 previewCanvas.dataset.scale=String(view.k);
 preview.dataset.sceneVersion=String((Number(preview.dataset.sceneVersion)||0)+1);
 if(texture)paintPreview();
 const cellWidth=Math.max(256,Math.min(12288,Math.ceil(rect.width/view.vw*view.k*W*dpr)));
 // Exact settled scale and viewport size are part of the key: every zoom/resize
 // completion gets a fresh texture, rather than reusing a resolution bucket.
 const key=JSON.stringify([style.key,view.k,rect.width,rect.height,dpr]);
 if(textureKey===key)return;
 textureKey=key;const generation=++textureGeneration;
 (async()=>{
  try{
   const height=Math.ceil(cellWidth*H/W),image=new Image();
   image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="${svgNS}" width="${cellWidth}" height="${height}" viewBox="${-W/2} ${-H/2} ${W} ${H}"><g stroke-linejoin="round" stroke-linecap="round">${style.source}</g></svg>`);
   await image.decode();if(generation!==textureGeneration)return;
   const next=document.createElement('canvas');next.width=cellWidth;next.height=height;
   const context=next.getContext('2d');if(!context)throw Error('浏览器无法生成地图预览。');
   context.drawImage(image,0,0,cellWidth,height);
   if(generation!==textureGeneration){next.width=next.height=1;return;}
   const previous=texture;texture=next;paintPreview();
   if(previous)previous.width=previous.height=1;
   previewCanvas.dataset.textureVersion=String(generation);previewCanvas.dataset.appearance=style.key;
   previewCanvas.dataset.pixelDensity=String(dpr);previewCanvas.dataset.textureWidth=String(cellWidth);
   preview.parentElement.dataset.state='ready';$('previewMessage').hidden=true;currentSvg='ready';
  }catch(error){
   if(generation!==textureGeneration)return;
   textureKey='';preview.parentElement.dataset.state='error';
   $('previewText').textContent=texture?'地图更新失败，已保留上一张预览。':'地图预览暂时无法生成。';
   $('retryPreview').hidden=false;$('previewMessage').hidden=false;
  }
 })();
}

function render(){
 if(!dataLoaded)return;
 const preview=$('mapPreview'),paper=preview.parentElement,message=$('previewMessage');
 try{
  const style=appearance(),view=layout(),[aspectWidth,aspectHeight]=dimensions();
  scalePending=false;
  paper.style.maxWidth=`min(1400px, calc((100vh - 290px) * ${aspectWidth/aspectHeight}))`;
  paper.style.aspectRatio=`${aspectWidth} / ${aspectHeight}`;
  updatePreview(style,view);
  if(texture){paper.dataset.state='ready';message.hidden=true;}
  const [outW,outH]=pixels();
  $('sizeLabel').textContent=`${outW.toLocaleString()} × ${outH.toLocaleString()} px`;
  $('modeLabel').textContent=$('ratio').value==='tile'?'矩形重复单元 · 上下左右可平铺':'左键平移 · 滚轮缩放 · 中键拖动调整 scale';
  $('zoomValue').textContent=(+$('zoom').value).toFixed(2)+'×';
  $('lineValue').textContent=(+$('lineWidth').value).toFixed(2);
  $('gridValue').textContent=(+$('gridWidth').value).toFixed(2);
  $('gridOpacityValue').textContent=Math.round(+$('gridOpacity').value*100)+'%';
  for(const id of ['density','zoom'])$(id).disabled=$('ratio').value==='tile';
 }catch(error){
  // Keep the last successful map in place, and expose a useful retry state.
  textureGeneration++;textureKey='';
  paper.dataset.state='error';
  $('previewText').textContent=currentSvg?'地图更新失败，已保留上一张预览。':'地图预览暂时无法生成。';
  $('retryPreview').hidden=false;
  message.hidden=false;
 }
}
$('retryPreview').onclick=schedule;
function queueFrame(){
 renderTimer=0;
 renderFrame=requestAnimationFrame(()=>{renderFrame=0;render();lastRender=performance.now();});
}
function finishRender(){
 clearTimeout(scalePaintTimer);scalePaintTimer=0;
 clearTimeout(renderTimer);clearTimeout(settleTimer);renderTimer=settleTimer=0;
 if(renderFrame)cancelAnimationFrame(renderFrame);
 queueFrame();
}
function schedule(){
 // Limit continuous input to 20 updates/sec, then always paint the final state.
 clearTimeout(settleTimer);settleTimer=setTimeout(finishRender,160);
 if(renderTimer||renderFrame)return;
 const delay=Math.max(0,renderInterval-(performance.now()-lastRender));
 if(delay)renderTimer=setTimeout(queueFrame,delay);else queueFrame();
}
function throttleScalePreview(){
 if(scalePaintTimer)return;
 const delay=Math.max(0,scalePaintInterval-(performance.now()-lastScalePaint));
 scalePaintTimer=setTimeout(()=>{
  scalePaintTimer=0;lastScalePaint=performance.now();movePreview();
 },delay);
}
function requestScale(debounce=true){
 scalePending=true;
 clearTimeout(renderTimer);clearTimeout(settleTimer);renderTimer=settleTimer=0;
 if(renderFrame){cancelAnimationFrame(renderFrame);renderFrame=0;}
 $('zoomValue').textContent=(+$('zoom').value).toFixed(2)+'×';
 const [vw]=dimensions();
 previewScale=$('ratio').value==='tile'?1:vw/(W*+$('density').value)*+$('zoom').value;
 throttleScalePreview();
 if(debounce)settleTimer=setTimeout(finishRender,160);
}
$('zoom').addEventListener('pointerdown',()=>{sliderScaling=true;clearTimeout(settleTimer);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('zoom').addEventListener(event,()=>{
 if(!sliderScaling)return;sliderScaling=false;finishRender();
});
function applyPalette(id){palettes[id].forEach((value,i)=>$( ['sea','land','line','grid'][i]).value=value);document.querySelectorAll('.palette').forEach(b=>b.classList.toggle('active',b.dataset.palette===id));schedule();}
$('atlasStyle').onclick=()=>{
 ['#b6dce3','#faf3d1','#5c8390','#6f9da6'].forEach((value,i)=>$( ['sea','land','line','grid'][i]).value=value);
 $('countryFill').value='pastel';for(const id of ['showOcean','showOceanLabels','showProvinces','showScale','showGrid'])$(id).checked=true;
 document.querySelectorAll('.palette').forEach(b=>b.classList.remove('active'));finishRender();
};
document.querySelectorAll('#mapControls input,#mapControls select').forEach(el=>el.addEventListener('input',()=>{
 $('status').textContent='';
 syncResolution(el.id);
 if(el.id==='zoom'){requestScale(!sliderScaling);return;}
 if(el.id==='ratio'){state.offsetX=state.offsetY=0;}
 if(['sea','land','line','grid'].includes(el.id))document.querySelectorAll('.palette').forEach(b=>b.classList.remove('active'));
 schedule();
}));
$('atlasStyle').onclick=()=>{
 ['#b6dce3','#faf3d1','#5c8390','#6f9da6'].forEach((value,i)=>$( ['sea','land','line','grid'][i]).value=value);
 $('countryFill').value='pastel';for(const id of ['showOcean','showOceanLabels','showProvinces','showScale','showGrid'])$(id).checked=true;
 document.querySelectorAll('.palette').forEach(b=>b.classList.remove('active'));finishRender();
};
document.querySelectorAll('#mapControls input,#mapControls select').forEach(el=>el.addEventListener('change',finishRender));
document.querySelectorAll('.palette').forEach(b=>b.addEventListener('click',()=>applyPalette(b.dataset.palette)));
$('resetView').onclick=()=>{state.offsetX=state.offsetY=0;$('zoom').value=1;schedule();};
let drag;
function anchoredZoom(next,ax,ay,baseZoom=+$('zoom').value,baseX=state.offsetX,baseY=state.offsetY){
 $('zoom').value=Math.max(.2,Math.min(8,next));
 const factor=+$('zoom').value/baseZoom;
 state.offsetX=ax-(ax-baseX)*factor;state.offsetY=ay-(ay-baseY)*factor;
 requestScale(drag?.button!==1);
}
$('mapPreview').addEventListener('wheel',e=>{
 e.preventDefault();if($('ratio').value==='tile')return;
 const [w,h]=dimensions(),rect=e.currentTarget.getBoundingClientRect();
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?rect.height:1);
 anchoredZoom(+$('zoom').value*Math.exp(-delta*.0015),(e.clientX-rect.left)*w/rect.width,(e.clientY-rect.top)*h/rect.height);
},{passive:false});
$('mapPreview').addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
$('mapPreview').addEventListener('pointerdown',e=>{
 if($('ratio').value==='tile'||(e.button!==0&&e.button!==1))return;
 e.preventDefault();
 if(scalePending){clearTimeout(settleTimer);settleTimer=0;render();}
 const [w,h]=dimensions(),rect=e.currentTarget.getBoundingClientRect();
 drag={x:e.clientX,y:e.clientY,ox:state.offsetX,oy:state.offsetY,sx:w/rect.width,sy:h/rect.height,button:e.button,zoom:+$('zoom').value,ax:(e.clientX-rect.left)*w/rect.width,ay:(e.clientY-rect.top)*h/rect.height};
 e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('dragging');
});
$('mapPreview').addEventListener('pointermove',e=>{
 if(!drag)return;
 if(drag.button===1){anchoredZoom(drag.zoom*Math.exp((drag.y-e.clientY)*.006),drag.ax,drag.ay,drag.zoom,drag.ox,drag.oy);return;}
 state.offsetX=drag.ox+(e.clientX-drag.x)*drag.sx;state.offsetY=drag.oy+(e.clientY-drag.y)*drag.sy;movePreview();
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('mapPreview').addEventListener(event,()=>{
 if(!drag)return;const scaling=drag.button===1;drag=null;$('mapPreview').classList.remove('dragging');
 if(scaling)finishRender();
});
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function filename(ext){const [w,h]=pixels();return `markley-${$('ratio').value}-${w}x${h}.${ext}`;}
let pendingDownload;
function confirmDownload(format){
 if(pendingDownload)return Promise.resolve(false);
 const dialog=$('downloadDisclaimer');dialog.returnValue='';$('downloadFormat').textContent=format;
 $('downloadContext').hidden=false;$('confirmDownload').hidden=false;$('closeDisclaimer').textContent='取消';
 dialog.showModal();
 return new Promise(resolve=>{pendingDownload=resolve;});
}
$('showDisclaimer').onclick=()=>{
 if(pendingDownload)return;
 $('downloadContext').hidden=true;$('confirmDownload').hidden=true;$('closeDisclaimer').textContent='关闭';
 $('downloadDisclaimer').returnValue='';$('downloadDisclaimer').showModal();
};
$('downloadDisclaimer').addEventListener('close',()=>{
 const resolve=pendingDownload;pendingDownload=null;
 resolve?.($('downloadDisclaimer').returnValue==='download');
});
$('exportSvg').onclick=async()=>{
 try{
  const [width]=pixels(true);if(!await confirmDownload('SVG'))return;
  download(new Blob([createSvg(width)],{type:'image/svg+xml'}),filename('svg'));
 }catch(error){$('status').textContent=error.message;}
};
$('exportPng').onclick=async()=>{
 let width,height;
 try{
  [width,height]=pixels(true);
  if(width*height>40000000)throw Error('截图超过 4000 万像素，请降低导出宽度。');
  if(!await confirmDownload('PNG'))return;
 }catch(error){$('status').textContent=error.message;return;}
 const button=$('exportPng');button.disabled=true;button.textContent='正在生成截图…';$('status').textContent='';
 let url;
 try{
  const source=createSvg(width);url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw Error('浏览器无法创建截图画布。');
  context.drawImage(image,0,0,width,height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw Error('截图生成失败，请降低导出宽度后重试。');
  download(blob,filename('png'));$('status').textContent='PNG 已生成，下载已开始。';canvas.width=canvas.height=1;
 }catch(error){$('status').textContent=error.message;}
 finally{if(url)URL.revokeObjectURL(url);button.disabled=false;button.textContent='生成 PNG 截图';}
};
let resizeTimer,observedSize='';
new ResizeObserver(entries=>{
 const rect=entries[0].contentRect,key=`${rect.width}:${rect.height}`;
 if(key===observedSize)return;
 const first=!observedSize;observedSize=key;
 if(first)return;
 // Let CSS resize the existing pixels while the window is moving. Allocate
 // the framebuffer and rerasterize geography only after resizing settles.
 clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!drag&&!sliderScaling)finishRender();},180);
}).observe($('mapPreview'));
applyPalette('mist');
$('downloadData').onclick=async()=>{
 const button=$('downloadData');
 if(!await confirmDownload('地图数据'))return;
 button.disabled=true;$('dataStatus').textContent='正在下载外部数据…';
 try{
  const url=location.protocol==='file:'?'https://markley-map-studio.pages.dev/map-data.json':new URL('map-data.json',location.href).href;
  const response=await fetch(url,{credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('数据下载失败，请重试或导入本地数据包。');
  const text=await response.text();loadMapData(JSON.parse(text));
  download(new Blob([text],{type:'application/json'}),'markley-map-data.json');
 }catch(error){$('dataStatus').textContent=error.message;}
 finally{button.disabled=false;}
};
$('importData').onchange=async()=>{
 const file=$('importData').files[0];if(!file)return;
 try{if(file.size>50*1024*1024)throw Error('数据包不能超过 50 MB。');loadMapData(JSON.parse(await file.text()));}
 catch(error){$('dataStatus').textContent=error.message;}
 finally{$('importData').value='';}
};
window.mapStudio={render,createSvg,dimensions};
