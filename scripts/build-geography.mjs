import fs from 'node:fs';
import {topology} from 'topojson-server';
import {presimplify,simplify,quantile} from 'topojson-simplify';
import {mergeArcs,quantize} from 'topojson-client';
import {gunzipSync} from 'node:zlib';
const source=JSON.parse(gunzipSync(fs.readFileSync('data/countries-cn.geojson.gz')));
const original=topology({countries:source},1e6);
const weighted=presimplify(original);
// A shared topology preserves coincident national boundaries during reduction.
const world=quantize(simplify(weighted,quantile(weighted,.7)),1e6);
world.objects.land=mergeArcs(world,world.objects.countries.geometries);
fs.writeFileSync('data/world-cn.topo.json',JSON.stringify(world));
console.log('Built shared China-POV topology',world.objects.countries.geometries.length,'countries');
