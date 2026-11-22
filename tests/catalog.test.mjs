import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBbox, searchSentinel } from '../lib/catalog.js';

test('normaliza un área válida en Potosí', () => {
  const out = normalizeBbox('-65.76,-19.58,-65.74,-19.56');
  assert.equal(out.bbox.length, 4);
  assert.ok(out.areaKm2 > 0);
});
test('rechaza terrenos de tamaño excesivo', () => {
  assert.throws(() => normalizeBbox('-70,-23,-65,-19'), /2.500/);
});
test('rechaza coordenadas inválidas', () => {
  assert.throws(() => normalizeBbox('hola'), /dos esquinas/);
  assert.throws(() => normalizeBbox('-65,-19,-66,-18'), /válidos/);
});
test('consulta el catálogo y ordena escenas por nubosidad', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    assert.equal(u.searchParams.get('collections'), 'sentinel-2-l2a');
    assert.equal(u.searchParams.get('bbox'), '-65.76,-19.58,-65.74,-19.56');
    return { ok: true, json: async () => ({features: [
      {id:'a',properties:{datetime:'2026-11-02T10:00:00Z','eo:cloud_cover':30,platform:'sentinel-2a'}},
      {id:'b',properties:{datetime:'2026-11-01T10:00:00Z','eo:cloud_cover':5,platform:'sentinel-2b'}}
    ]}) };
  };
  try {
    const result = await searchSentinel('-65.76,-19.58,-65.74,-19.56');
    assert.equal(result.scenes.length, 2);
    assert.equal(result.scenes[0].id, 'b');
    assert.match(result.note, /no se ha realizado/i);
  } finally { globalThis.fetch = original; }
});
