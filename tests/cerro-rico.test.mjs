import test from 'node:test';
import assert from 'node:assert/strict';
import { CERRO_RICO,cerroRicoBbox,coversCerroRico,geologyContextFor } from '../src/cerro-rico.js';

test('caso Cerro Rico localiza coordenadas de referencia dentro de un cuadrado próximo a 25 km²',()=>{
  const b=cerroRicoBbox();const [lon,lat]=CERRO_RICO.center;
  assert.equal(coversCerroRico(b),true);
  assert.ok(b[0]<lon&&lon<b[2]&&b[1]<lat&&lat<b[3]);
  const area=(b[2]-b[0])*(b[3]-b[1])*111.32*111.32*Math.cos(lat*Math.PI/180);
  assert.ok(Math.abs(area-25)<0.06,`área ${area}`);
});
test('fuentes reales enlazadas, sin polígonos mineros ficticios',()=>{
 const context=geologyContextFor(cerroRicoBbox());
 assert.ok(context);assert.ok(context.sources.some(s=>s.url.includes('usgs.gov')));
 assert.ok(context.sources.some(s=>s.url.includes('sergeomin.gob.bo')));
 assert.match(context.evidenceType,/NO intersección/);
 assert.equal(geologyContextFor([-68,-18,-67,-17]),null);
});
test('no se confunde ningún indicador con confirmación de plata',()=>{
 const context=geologyContextFor(cerroRicoBbox());
 assert.match(context.observedMetals,/no se observa directamente/i);
 assert.match(context.caution,/falsos positivos/i);
});
