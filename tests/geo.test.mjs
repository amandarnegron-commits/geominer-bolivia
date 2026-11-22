import test from 'node:test';
import assert from 'node:assert/strict';
import { squareFromCenter, bboxGeoJSON, bboxKml } from '../src/geo.js';

test('genera selección alrededor de un punto GPS en Potosí',()=>{
  const b = squareFromCenter(-65.753,-19.572,5);
  assert.equal(b.length,4);
  assert.ok(b[0]<-65.753 && b[2]>-65.753);
  assert.ok(b[1]<-19.572 && b[3]>-19.572);
});
test('rechaza coordenadas y tamaños peligrosos',()=>{
  assert.throws(()=>squareFromCenter('hola',-19,5));
  assert.throws(()=>squareFromCenter(-65,-19,80));
});
test('exporta polígono cerrado de GeoJSON y KML',()=>{
  const b=[-65.78,-19.58,-65.73,-19.53];
  const f=bboxGeoJSON(b).features[0];
  assert.deepEqual(f.geometry.coordinates[0][0],f.geometry.coordinates[0][4]);
  assert.equal(f.properties.mineral_detected,false);
  assert.match(bboxKml(b),/Polygon/);
  assert.match(bboxKml(b),/-65\.78,-19\.58,0/);
});
