import { searchSentinel } from '../lib/catalog.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const result = await searchSentinel(req.query?.bbox);
    return res.status(200).json(result);
  } catch(error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    const invalid = /Selecciona|límite|terreno|superar|pequeño|válidos/.test(message);
    return res.status(invalid ? 400 : 503).json({ error: message });
  }
}
