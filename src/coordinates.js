/** Entrada libre de coordenadas WGS84 y salida CSV de sectores. */
export function parseGpsPair(value){
  if(typeof value!=='string' || value.length>120)throw new Error('Escribe latitud, longitud en grados decimales.');
  const parts=value.trim().split(/[;,\s]+/).filter(Boolean);
  if(parts.length!==2||parts.some(p=>!/^[-+]?\d+(?:\.\d+)?$/.test(p)))
    throw new Error('Formato esperado: latitud, longitud. Ej.: -19.6189, -65.7497');
  const lat=Number(parts[0]),lon=Number(parts[1]);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)
    throw new Error('Latitud permitida: -85 a 85; longitud: -180 a 180.');
  return {lat,lon};
}
export function sectorCsv(report){
  const rows=[['indice','sector','prioridad_revision','latitud','longitud','valor_maximo','pixeles','fecha_escena']];
  for(const kind of ['iron','clay'])for(const z of (report?.zones?.[kind]||[])){
    const priority=report?.decision?.zones?.find(d=>d.kind===kind&&d.number===z.number)?.priority||'No evaluada';
    rows.push([kind==='iron'?'B4/B2':'B11/B12',z.number,priority,
      Number(z.lat).toFixed(6),Number(z.lon).toFixed(6),Number(z.peakRatio).toFixed(4),
      Number(z.pixels),String(report?.scene?.date||'').slice(0,10)]);
  }
  return '\ufeff'+rows.map(row=>row.map(v=>{
    const s=String(v??'');
    // Incluir texto como campo CSV, y neutralizar inyección de fórmulas en Excel.
    const safe=/^[=+@]/.test(s)?"'"+s:s;
    return '"'+safe.replaceAll('"','""')+'"';
  }).join(',')).join('\r\n');
}
