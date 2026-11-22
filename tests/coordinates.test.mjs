import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGpsPair,sectorCsv} from '../src/coordinates.js';
import {squareFromCenter} from '../src/geo.js';

test('ingresa coordenadas decimales de cualquier terreno y genera bbox en 5 km',()=>{
 for(const str of ['-19.6189, -65.7497','-19.6189 -65.7497']){
   const {lat,lon}=parseGpsPair(str);
   assert.equal(lat,-19.6189);assert.equal(lon,-65.7497);
   const b=squareFromCenter(lon,lat,5);
   assert.ok(b[0]<lon&&b[2]>lon&&b[1]<lat&&b[3]>lat);
 }
});
test('rechaza coordenadas inválidas',()=>{
 for(const s of ['', 'texto', '-91, 20', '18, 181', '-19,65,30'])assert.throws(()=>parseGpsPair(s));
});
test('exporta CSV sectores para Excel con prioridad y coordenadas correctas',()=>{
 const csv=sectorCsv({scene:{date:'2026-11-20T12:00Z'},zones:{iron:[{number:1,lat:-19.619,lon:-65.75,peakRatio:1.82,pixels:22}],clay:[]},decision:{zones:[{kind:'iron',number:1,priority:'Alta'}]}});
 assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/"-19.619000","-65.750000"/);assert.match(csv,/"Alta"/);assert.match(csv,/"2026-11-20"/);
});
