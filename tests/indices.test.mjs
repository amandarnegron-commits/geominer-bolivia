import test from 'node:test';
import assert from 'node:assert/strict';
import {computeIndices,statsFor,rasterRGBA,exportTopPoints} from '../src/indices.js';

test('calcula razones B4/B2 y B11/B12 con suelo descubierto',()=>{
  const data={blue:[.1,.1,.1,.1],red:[.3,.3,.3,.3],nir:[.2,.2,.2,.2],swir16:[.4,.4,.4,.4],swir22:[.2,.2,.2,.2],scl:[5,8,4,5]};
  const result=computeIndices(data,2,2);
  assert.equal(result.valid,2);
  assert.equal(result.iron[0],3);
  assert.equal(result.clay[0],2);
  assert.ok(Number.isNaN(result.iron[1]));
  assert.ok(Number.isNaN(result.iron[2]));
});
test('no toma nubes/agua/vegetación como anomalías',()=>{
  const data={blue:[.1,.1,.1],red:[.2,.2,.2],nir:[.9,.1,.1],swir16:[.3,.3,.3],swir22:[.2,.2,.2],scl:[5,6,9]};
  const result=computeIndices(data,3,1);
  assert.equal(result.valid,0);
  assert.equal(statsFor(result.iron).count,0);
});
test('resalta únicamente respuesta alta y exporta coordenadas con advertencia',()=>{
  const values=new Float32Array([1,2,3,4]);
  const stats=statsFor(values);
  assert.equal(stats.p50,2.5);
  assert.equal(rasterRGBA(values,stats,'iron').length,16);
  assert.equal(rasterRGBA(values,stats,'iron')[3],0);
  const geojson=exportTopPoints({width:2,height:2,iron:values},[-65.8,-19.6,-65.7,-19.5]);
  assert.equal(geojson.type,'FeatureCollection');
  assert.equal(geojson.features.length,1);
  assert.match(geojson.features[0].properties.note,/NO mineral confirmado/);
});
