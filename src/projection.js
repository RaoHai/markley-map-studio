import * as geo from 'd3-geo';
import * as poly from 'd3-geo-polygon';
const d3={...geo,...poly,range:n=>Array.from({length:n},(_,i)=>i)};
const degrees=180/Math.PI,radians=Math.PI/180,sqrt3_4=Math.sqrt(3)/4;
const rotate=[115,Math.acos(1/3)*.5*degrees-90,180];
// Tetrahedral Lee faces rearranged into a periodic Markley rectangle.
// Mathematical reference: Markley, A conformal map of the world (2020).
const rawLee=d3.geoTetrahedralLee().rotate(rotate).scale(1).translate([0,0]);
// Use exact face vertices, rather than the inset streamed Sphere bounds.
const root=rawLee.tree(),origin=rawLee(geo.geoRotation(rotate).invert(root.site)),vertices=[];
function collect(node){for(const v of node.face){let q=node.project(v),t=node.transform;if(t)q=[t[0]*q[0]+t[1]*q[1]+t[2],t[3]*q[0]+t[4]*q[1]+t[5]];const a=Math.PI/6;vertices.push([Math.cos(a)*q[0]+Math.sin(a)*q[1]+origin[0],-Math.sin(a)*q[0]+Math.cos(a)*q[1]+origin[1]]);}for(const child of node.children||[])collect(child);}
collect(root);
const minx=Math.min(...vertices.map(v=>v[0])),maxx=Math.max(...vertices.map(v=>v[0])),miny=Math.min(...vertices.map(v=>v[1])),maxy=Math.max(...vertices.map(v=>v[1]));
const normalizationScale=8/(maxx-minx);
rawLee.scale(normalizationScale).translate([-(minx+maxx)/2*normalizationScale,-(miny+maxy)/2*normalizationScale]);
// A reflected half-net and horizontal period produce the rectangular chart.
const period = 8;
function raw(longitude, latitude) {
  const point = rawLee([longitude * degrees, latitude * degrees]);
  const foldedX = point[1] < 0 ? -4 - point[0] : point[0];
  const wrappedX = ((foldedX + 5) % period + period) % period - 5;
  return [wrappedX, -Math.abs(point[1])];
}
// Unfold into the triangular net. Test neighboring copies in deterministic
// order because seam points belong to more than one face.
raw.invert = (x, y) => {
  const candidates = [[x, -y]];
  if (x > 0) candidates.push([4 - x, y]);
  if (x < 0) candidates.push([-4 - x, y], [x + period, -y]);
  for (const candidate of candidates) {
    const geographic = rawLee.invert(candidate);
    if (geographic) return geographic.map(angle => angle * radians);
  }
};
function clipPolygon(inset = .001) {
  const left = -7 + inset, right = 1 - inset;
  const top = inset, bottom = 2 * Math.sqrt(3) - inset;
  const corners = [[left,top],[left,bottom],[right,bottom],[right,top]];
  const ring = [];
  for (let edge = 0; edge < corners.length; edge++) {
    const start = corners[edge], end = corners[(edge+1)%4];
    const samples = edge % 2 === 0 ? 38 : 9;
    for (let step = 0; step < samples; step++) {
      const t = step / samples;
      const position = start.map((v,axis) => v + t*(end[axis]-v));
      ring.push(raw.invert(...position).map(angle => angle*degrees));
    }
  }
  ring.push(ring[0]);
  return {type:'Polygon',coordinates:[ring]};
}
const W=1000,H=W*sqrt3_4;
const r0=raw(0,0),tileScale=W/8;
const p=d3.geoProjection(raw).preclip(d3.geoClipPolygon(clipPolygon())).scale(tileScale).center([0,0]).translate([tileScale*(r0[0]+1),-tileScale*(r0[1]+Math.sqrt(3))]).precision(.1);

export {p,W,H,d3};
