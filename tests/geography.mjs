import fs from 'node:fs';
import assert from 'node:assert/strict';
import {feature,mesh} from 'topojson-client';
import {geoContains,geoArea,geoPath} from 'd3-geo';
import {p} from '../src/projection.js';
const world=JSON.parse(fs.readFileSync('data/world-cn.topo.json'));
const countries=feature(world,world.objects.countries).features;
const china=countries.find(f=>f.id==='CHN');
assert.ok(china);assert.ok(geoArea(china)>.1 && geoArea(china)<.5);
assert.ok(!countries.some(f=>['TWN','HKG','MAC'].includes(f.id)));
for(const [name,location] of [
 ['Taiwan',[121,23.8]],['Hong Kong',[114.15,22.33]],['Macao',[113.543,22.198]],
 ['Tawang',[91.86,27.59]],['Aksai Chin',[79,35]],['Hainan',[109.5,19.2]]
]){
 assert.ok(geoContains(china,location),name+' must be inside China POV');
 assert.equal(countries.filter(f=>geoContains(f,location)).length,1,name+' has overlapping territorial features');
}
const maritime=JSON.parse(fs.readFileSync('data/china-maritime.geojson'));
assert.equal(maritime.features.length,9);
const points=JSON.parse(fs.readFileSync('data/china-island-markers.geojson'));
const diaoyu=points.features.find(f=>f.properties.name==='钓鱼岛');
assert.deepEqual(diaoyu.geometry.coordinates,[123+28.4/60,25+44.6/60]);
assert.ok(points.features.some(f=>f.properties.name==='赤尾屿'));
assert.ok(points.features.some(f=>f.properties.name==='黄岩岛'));
assert.equal(points.features.find(f=>f.properties.name==='曾母暗沙').properties.kind,'shoal');
const path=geoPath(p);
for(const g of [feature(world,world.objects.land),mesh(world,world.objects.countries),maritime,points]){
 const rendered=path(g);assert.ok(rendered?.length>100);assert.ok(!rendered.includes('NaN'));
}
console.log('China-POV geography checks passed: Taiwan/HK/Macao unified, Tawang/Aksai Chin membership, non-overlap samples, nine sourced maritime segments, official Diaoyu coordinates, reef/shoal distinction, finite projected paths.');
