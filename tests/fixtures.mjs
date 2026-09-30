import {topology} from 'topojson-server';
import {mergeArcs} from 'topojson-client';
// Deliberately fictional rectangles, not real country or administrative data.
const collection=features=>({type:'FeatureCollection',features});
const polygon=(id,x0,x1)=>({type:'Feature',id,properties:{name:id},geometry:{type:'Polygon',coordinates:[[[x0,-25],[x0,25],[x1,25],[x1,-25],[x0,-25]]]}});
const world=topology({countries:collection([polygon('A',-40,0),polygon('B',0,40),polygon('C',40,65)])},1e5);
world.objects.land=mergeArcs(world,world.objects.countries.geometries);
export const fixture={format:'markley-map-data-v1',world,maritime:collection([]),islands:collection([]),provinces:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[-30,0],[30,0]]}},bathymetry:collection([])};
export async function loadTestData(page){
 await page.locator('#importData').setInputFiles({name:'fictional-test-data.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
}
