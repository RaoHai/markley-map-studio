import assert from 'node:assert/strict';
import {feature,mesh} from 'topojson-client';
import {geoContains,geoPath} from 'd3-geo';
import {p} from '../src/projection.js';
import {fixture} from './fixtures.mjs';
const world=fixture.world,countries=feature(world,world.objects.countries).features;
assert.equal(countries.length,3);
for(const point of [[-20,0],[20,0],[50,0]])assert.equal(countries.filter(f=>geoContains(f,point)).length,1);
for(const geometry of [feature(world,world.objects.land),mesh(world,world.objects.countries),fixture.provinces]){
 const rendered=geoPath(p)(geometry);assert.ok(rendered?.length>10);assert.ok(!/NaN|Infinity/.test(rendered));
}
console.log('Fictional geography checks passed: shared topology, non-overlap and finite projection. No real map data is used.');
