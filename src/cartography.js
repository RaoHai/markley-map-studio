import {feature, neighbors} from 'topojson-client';
import {p, d3, W, H} from './projection.js';


const path = d3.geoPath(p).digits(3);
export let adjacency=[],countryColors=[],provincePath='';
let countryPaths=[],depths=[],marineLabels=[];
export function setCartography(world,provinces,bathymetry,labels={features:[]}){
const geometries = world.objects.countries.geometries;
adjacency = neighbors(geometries);
countryColors = Array(geometries.length).fill(-1);
// Deterministic saturation ordering: neighboring countries have distinct fills.
for (let remaining = geometries.length; remaining; remaining--) {
 const pending = countryColors.map((color,i)=>color<0?i:-1).filter(i=>i>=0);
 pending.sort((a,b)=>new Set(adjacency[b].map(i=>countryColors[i]).filter(c=>c>=0)).size-new Set(adjacency[a].map(i=>countryColors[i]).filter(c=>c>=0)).size || adjacency[b].length-adjacency[a].length || a-b);
 const i=pending[0],used=new Set(adjacency[i].map(j=>countryColors[j]));
 let color=0;while(used.has(color))color++;countryColors[i]=color;
}
countryPaths=countryColors.map((_,i)=>path(feature(world,geometries[i])));
provincePath=path(provinces)||'';
marineLabels=labels.features.filter(f=>f.geometry?.type==='Point').map(f=>[String(f.properties?.name||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])),f.geometry.coordinates]);
depths=bathymetry.features.map(f=>({depth:f.properties.depth,path:path(f)}));
}
const palettes={pastel:['#faf3d1','#efc7b4','#c9dfcb','#ced2ea','#c9e2e1','#e6d9be'],vintage:['#e7d4ae','#cbae95','#b8c3a1','#b8becd','#a7c4c6','#d5c7b8']};
export function countryFill(style){
 const colors=palettes[style];if(!colors)return '';
 return `<g data-layer="country-colors">${colors.map((color,i)=>`<path fill="${color}" d="${countryPaths.filter((_,j)=>countryColors[j]%colors.length===i).join('')}"/>`).join('')}</g>`;
}

function mix(hex,target,amount){return '#'+[0,1,2].map(i=>Math.round(parseInt(hex.slice(1+i*2,3+i*2),16)*(1-amount)+target*amount).toString(16).padStart(2,'0')).join('');}
export function oceanFill(sea){
 return `<g data-layer="bathymetry"><rect x="${-W/2}" y="${-H/2}" width="${W}" height="${H}" fill="${mix(sea,255,.35)}"/>${depths.map(({depth,path})=>`<path data-depth="${depth}" fill="${depth===200?mix(sea,255,.15):sea}" d="${path}"/>`).join('')}</g>`;
}
export function oceanLabels(color){return `<g data-layer="ocean-labels" fill="${color}" font-family="Georgia,serif" font-size="7" letter-spacing="1.2" text-anchor="middle" opacity=".8">${marineLabels.map(([name,coordinate])=>{const [x,y]=p(coordinate);return `<text x="${x}" y="${y}">${name}</text>`;}).join('')}</g>`;}

// A local scale measured at a specific geographic point, not a global ratio.
export const scaleReference=[-120,-20];
const a=p(scaleReference),b=p([-120+.001,-20]);
export const scaleLength=Math.hypot(b[0]-a[0],b[1]-a[1])/ (d3.geoDistance(scaleReference,[-120+.001,-20])*6371.0088)*1000;
export function scaleBar(color){
 const length=scaleLength,half=length/2;
 return `<g data-layer="local-scale" transform="translate(${a[0]} ${a[1]})" font-family="sans-serif" font-size="5.5" fill="${color}"><path d="M0 0H${length}M0 -3V3M${half} -3V3M${length} -3V3" fill="none" stroke="${color}" stroke-width=".65"/><text y="10">0</text><text x="${half}" y="10" text-anchor="middle">500</text><text x="${length}" y="10" text-anchor="end">1000 km</text><text y="21">局部比例尺 · 120°W, 20°S</text></g>`;
}
