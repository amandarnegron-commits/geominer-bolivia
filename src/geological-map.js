/** Mapa de gabinete: dibuja SOLO polígonos GeoJSON WGS84 declarados por el usuario. */
const palette=['#d9bdb1','#dbac67','#d3ce79','#95b6a3','#a4accf','#dc929c','#aca0ba','#c6b9a2','#9dc9c0'];
function unitName(feature){
 const p=feature?.properties||{};
 for(const key of ['geominerUnidad','UNIDAD','unidad','unit','Unit','FORMACION','formacion','nombre','name','codigo','simbolo']){
  const v=p[key];if(typeof v==='string'&&v.trim())return v.trim().slice(0,46);
 }
 return 'Unidad no especificada';
}
export function geologyPalette(features){
 const names=[...new Set((features||[]).map(unitName))];
 return names.map((name,i)=>({name,color:palette[i%palette.length]}));
}
/**
 * Browser-only canvas. Graticule is a schematic WGS84 map, not a surveyed map.
 * Missing GeoJSON -> no map (never simulate geology from satellite data).
 */
export function createGeologyMapImage(geojson,bbox,sectorMatches=[],{origin='imported'}={}){
 if(!geojson?.features?.length||!Array.isArray(bbox)||bbox.length!==4)return null;
 const [w,s,e,n]=bbox;if(!(e>w&&n>s))return null;
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=740;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.fillStyle='#f7f4ec';ctx.fillRect(0,0,1200,740);
 const ox=78,oy=62,pw=880,ph=590;
 const project=([lon,lat])=>[ox+(lon-w)/(e-w)*pw,oy+(n-lat)/(n-s)*ph];
 ctx.fillStyle='#f0ede7';ctx.fillRect(ox,oy,pw,ph);
 ctx.save();ctx.beginPath();ctx.rect(ox,oy,pw,ph);ctx.clip();
 ctx.strokeStyle='#c1bdaf';ctx.lineWidth=1;
 for(let i=0;i<=4;i++){
  const x=ox+pw*i/4,y=oy+ph*i/4;
  ctx.beginPath();ctx.moveTo(x,oy);ctx.lineTo(x,oy+ph);ctx.stroke();
  ctx.beginPath();ctx.moveTo(ox,y);ctx.lineTo(ox+pw,y);ctx.stroke();
 }
 const legend=geologyPalette(geojson.features);
 const colors=new Map(legend.map(x=>[x.name,x.color]));
 for(const feature of geojson.features){
  const g=feature.geometry;if(!g)continue;
  const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  ctx.fillStyle=colors.get(unitName(feature))||'#b1b7aa';ctx.strokeStyle='#645f64';ctx.lineWidth=1.25;
  for(const polygon of polys){
   ctx.beginPath();
   for(const ring of polygon){
    ring.forEach((coord,i)=>{const [x,y]=project(coord);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.closePath();
   }
   ctx.fill('evenodd');ctx.stroke();
  }
 }
 for(const item of sectorMatches.slice(0,48)){
  const lon=Number(item.lon),lat=Number(item.lat);if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
  if(lon<w||lon>e||lat<s||lat>n)continue;
  const [x,y]=project([lon,lat]);
  ctx.fillStyle='#193b47';ctx.strokeStyle='white';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(x,y,8,0,2*Math.PI);ctx.fill();ctx.stroke();
 }
 ctx.restore();ctx.strokeStyle='#3b4850';ctx.lineWidth=3;ctx.strokeRect(ox,oy,pw,ph);
 ctx.fillStyle='#173442';ctx.font='bold 24px sans-serif';ctx.fillText(origin==='public'?'CARTA GEOLOGICA - GEOBOLIVIA':'CARTA GEOLOGICA - CAPA IMPORTADA',ox,35);
 ctx.font='16px sans-serif';ctx.fillText('N',ox+pw-24,49);
 ctx.textAlign='center';ctx.font='14px sans-serif';
 for(let i=0;i<=4;i++)ctx.fillText((w+(e-w)*i/4).toFixed(4)+'°',ox+pw*i/4,oy+ph+24);
 ctx.textAlign='right';
 for(let i=0;i<=4;i++)ctx.fillText((n-(n-s)*i/4).toFixed(4)+'°',ox-10,oy+ph*i/4+5);
 ctx.fillStyle='#f7f4ec';ctx.fillRect(979,56,205,638);
 ctx.fillStyle='#193b47';ctx.textAlign='left';ctx.font='bold 18px sans-serif';ctx.fillText(origin==='public'?'Unidades publicas':'Unidades declaradas',985,83);
 ctx.font='14px sans-serif';
 for(const [i,entry] of legend.slice(0,13).entries()){
  const y=105+i*40;ctx.fillStyle=entry.color;ctx.fillRect(987,y,25,23);
  ctx.fillStyle='#193b47';ctx.fillText(entry.name.slice(0,23),1021,y+16);
 }
 if(legend.length>13){ctx.fillStyle='#647b83';ctx.fillText(`y ${legend.length-13} más`,990,645);}
 ctx.fillStyle='#4b6270';ctx.font='13px sans-serif';ctx.fillText('EPSG:4326, WGS84',985,685);
 ctx.fillText(origin==='public'?'Escala cartografica regional':'Precisión no verificada',985,705);
 return canvas.toDataURL('image/png');
}
