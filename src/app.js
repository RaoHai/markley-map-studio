import {p,W,H,d3} from './projection.js';
import {mesh,feature} from 'topojson-client';
import world from '../data/world-cn.topo.json';
import maritime from '../data/china-maritime.geojson';
import islandMarkers from '../data/china-island-markers.geojson';
const $=id=>document.getElementById(id);
const path=d3.geoPath(p).digits(3), land=path(feature(world,world.objects.land));
const edges=path(mesh(world,world.objects.countries));
const maritimePath=path(maritime);
const islandPath=d3.geoPath(p).pointRadius(.7)( {type:'FeatureCollection',features:islandMarkers.features.filter(f=>f.properties.kind!=='shoal')} );
const shoalPath=d3.geoPath(p).pointRadius(.9)( {type:'FeatureCollection',features:islandMarkers.features.filter(f=>f.properties.kind==='shoal')} );
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
let pending=false,currentSvg='';
function dimensions(){
 const mode=$('ratio').value;
 if(mode==='tile')return [1000,4*H];
 const [width,height]=pixels();
 return [1600,1600*height/width];
}
function grid(){const step=+$('spacing').value;if(!grids.has(step))grids.set(step,path(d3.geoGraticule().step([step,step]).precision(.5)()));return grids.get(step);}
function createSvg(pixelWidth){
 const [vw,vh]=dimensions(),tile=$('ratio').value==='tile';
 const k=tile?1:vw/(W*+$('density').value)*+$('zoom').value;
 const tw=W*k,th=H*k,ox=tile?0:state.offsetX,oy=tile?0:state.offsetY;
 let uses='';
 const j0=Math.floor((-oy-th/2)/(2*th))-1,j1=Math.ceil((vh-oy+th)/(2*th))+1;
 const i0=Math.floor((-ox-tw)/(tw))-2,i1=Math.ceil((vw-ox+tw)/tw)+2;
 for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
  const x=tw/2+(i+(j%2)/2)*tw+ox,y=th/2+2*j*th+oy;
  for(const [r,dx,dy] of [[180,-tw/4,-th],[0,0,0]]){
   const cx=x+dx,cy=y+dy;if(cx+tw/2<0||cx-tw/2>vw||cy+th/2<0||cy-th/2>vh)continue;
   uses+=`<use href="#map" transform="translate(${cx} ${cy}) rotate(${r}) scale(${k})"/>`;
  }
 }
 const ph=Math.round(pixelWidth*vh/vw),line=+$('lineWidth').value,gwidth=+$('gridWidth').value;
 const [sea,landColor,lineColor,gridColor]=['sea','land','line','grid'].map(id=>$(id).value);
 const transparent=$('transparent').checked;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${ph}" viewBox="0 0 ${vw} ${vh}"><title>Markley Tessellated World Map</title><metadata>Natural Earth 5.1.1 China POV, shared reduced 1:10m topology; China maritime supplement 5.1.0; official Diaoyu island coordinate markers; geographic correction only, no Chinese map-review approval; Lee conformal tetrahedral projection with Markley rectangular arrangement. Geographic coordinates, deduplicated national boundary mesh.</metadata><defs><clipPath id="cell"><rect x="${-W/2}" y="${-H/2}" width="${W}" height="${H}"/></clipPath><g id="map" clip-path="url(#cell)" stroke-linejoin="round" stroke-linecap="round"><path d="${land}" fill="${landColor}" stroke="${landColor}" stroke-width=".3"/>${$('showGrid').checked?`<path d="${grid()}" fill="none" stroke="${gridColor}" stroke-width="${gwidth}" opacity="${$('gridOpacity').value}"/>`:''}<path d="${edges}" fill="none" stroke="${lineColor}" stroke-width="${line}"/><path data-layer="china-maritime" d="${maritimePath}" fill="none" stroke="${lineColor}" stroke-width="${line}"/><path data-layer="china-islands" d="${islandPath}" fill="${landColor}" stroke="${lineColor}" stroke-width="${Math.max(.25,line*.65)}"/><path data-layer="china-shoals" d="${shoalPath}" fill="none" stroke="${lineColor}" stroke-width="${Math.max(.25,line*.65)}"/></g></defs>${transparent?'':`<rect width="100%" height="100%" fill="${sea}"/>`}${uses}</svg>`;
}
function render(){
 pending=false;
 const preview=$('mapPreview'),paper=preview.parentElement,message=$('previewMessage');
 try{
  const nextSvg=createSvg(1600),[aspectWidth,aspectHeight]=dimensions();
  // Render SVG directly: preview updates no longer depend on a temporary
  // image URL surviving asynchronous decoding during pan/zoom gestures.
  preview.innerHTML=nextSvg;
  currentSvg=nextSvg;
  paper.style.maxWidth=`min(1400px, calc((100vh - 290px) * ${aspectWidth/aspectHeight}))`;
  paper.style.aspectRatio=`${aspectWidth} / ${aspectHeight}`;
  paper.dataset.state='ready';
  message.hidden=true;
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
  paper.dataset.state='error';
  $('previewText').textContent=currentSvg?'地图更新失败，已保留上一张预览。':'地图预览暂时无法生成。';
  $('retryPreview').hidden=false;
  message.hidden=false;
 }
}
$('retryPreview').onclick=schedule;
function schedule(){if(!pending){pending=true;requestAnimationFrame(render);}}
function applyPalette(id){palettes[id].forEach((value,i)=>$( ['sea','land','line','grid'][i]).value=value);document.querySelectorAll('.palette').forEach(b=>b.classList.toggle('active',b.dataset.palette===id));schedule();}
document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{
 $('status').textContent='';
 syncResolution(el.id);
 if(el.id==='ratio'){state.offsetX=state.offsetY=0;}
 if(['sea','land','line','grid'].includes(el.id))document.querySelectorAll('.palette').forEach(b=>b.classList.remove('active'));
 schedule();
}));
document.querySelectorAll('.palette').forEach(b=>b.addEventListener('click',()=>applyPalette(b.dataset.palette)));
$('resetView').onclick=()=>{state.offsetX=state.offsetY=0;$('zoom').value=1;schedule();};
let drag;
function anchoredZoom(next,ax,ay,baseZoom=+$('zoom').value,baseX=state.offsetX,baseY=state.offsetY){
 $('zoom').value=Math.max(.2,Math.min(8,next));
 const factor=+$('zoom').value/baseZoom;
 state.offsetX=ax-(ax-baseX)*factor;state.offsetY=ay-(ay-baseY)*factor;
 schedule();
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
 const [w,h]=dimensions(),rect=e.currentTarget.getBoundingClientRect();
 drag={x:e.clientX,y:e.clientY,ox:state.offsetX,oy:state.offsetY,sx:w/rect.width,sy:h/rect.height,button:e.button,zoom:+$('zoom').value,ax:(e.clientX-rect.left)*w/rect.width,ay:(e.clientY-rect.top)*h/rect.height};
 e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('dragging');
});
$('mapPreview').addEventListener('pointermove',e=>{
 if(!drag)return;
 if(drag.button===1){anchoredZoom(drag.zoom*Math.exp((drag.y-e.clientY)*.006),drag.ax,drag.ay,drag.zoom,drag.ox,drag.oy);return;}
 state.offsetX=drag.ox+(e.clientX-drag.x)*drag.sx;state.offsetY=drag.oy+(e.clientY-drag.y)*drag.sy;schedule();
});
for(const event of ['pointerup','pointercancel'])$('mapPreview').addEventListener(event,()=>{drag=null;$('mapPreview').classList.remove('dragging');});
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function filename(ext){const [w,h]=pixels();return `markley-${$('ratio').value}-${w}x${h}.${ext}`;}
$('exportSvg').onclick=()=>{try{const [width]=pixels(true);download(new Blob([createSvg(width)],{type:'image/svg+xml'}),filename('svg'));}catch(error){$('status').textContent=error.message;}};
$('exportPng').onclick=async()=>{
 const button=$('exportPng');button.disabled=true;button.textContent='正在生成截图…';$('status').textContent='';
 let url;
 try{
  const [width,height]=pixels(true);
  if(width*height>40000000)throw Error('截图超过 4000 万像素，请降低导出宽度。');
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
applyPalette('mist');
window.mapStudio={render,createSvg,dimensions};
