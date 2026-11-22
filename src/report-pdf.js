/** PDF generado localmente en el navegador; nunca requiere clave API. */
import { jsPDF } from 'jspdf';
import { aiBlocks } from './ai-text.js';
import { reportPlateManifest } from './geological-study.js';

const readable = value => value===null||value===undefined?'s/d':String(value);
export function downloadReportPdf(report,{aiText='',heatmapUrl=null,indicator='iron',validation=null,fieldNotes=[],geologyEvidence=[],geoMatches=[],autoResearch=null,autoGeoMatches=[],autoGeologyMapPng=null,studyPlates=[],studyManifest=null,geologyMapPng=null}={}){
  if(!report?.scene?.id)throw new Error('El informe necesita datos espectrales ya procesados.');
  const pdf=new jsPDF({unit:'mm',format:'a4'});
  const dark=[24,48,61],green=[22,132,110],muted=[94,112,119];
  const W=210,M=17,limit=278;let y=20;
  function page(){pdf.addPage();y=20;}
  function lines(text,font=10){pdf.setFontSize(font);return pdf.splitTextToSize(String(text).replaceAll('—','-').replaceAll('≥','>='),W-2*M);}
  function para(text,{size=10,color=dark,bold=false,after=5}={}){
    pdf.setFont('helvetica',bold?'bold':'normal');pdf.setTextColor(...color);
    const ls=lines(text,size);const step=size*.46+1.7;
    for(const line of ls){if(y+step>limit)page();pdf.setFontSize(size);pdf.text(line,M,y);y+=step;}
    y+=after;
  }
  function heading(text){if(y>260)page();pdf.setDrawColor(207,229,220);pdf.line(M,y-2,W-M,y-2);y+=5;para(text,{size:12,bold:true,color:green,after:3});}
  function row(label,value){para(label+': '+readable(value),{size:10,after:1});}
  pdf.setFillColor(17,40,57);pdf.rect(0,0,W,39,'F');
  pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(19);pdf.text('GEOMINER BOLIVIA',M,20);
  pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.text('INFORME DE PROSPECCION SATELITAL PRELIMINAR',M,29);
  y=48;
  para('Documento exploratorio generado con indicadores satelitales. No es estudio de reservas, dictamen geológico ni certificación de mineral.',{size:10,color:muted});
  heading('1. Identificacion del estudio');
  row('Region',report.region);
  row('Fecha del informe',new Date(report.generatedAt).toLocaleString('es-BO'));
  row('Area aproximada',readable(report.areaKm2)+' km2');
  row('Limites geograficos (O, S, E, N)',report.bbox.join(', '));
  row('Escena',report.scene.id);
  row('Adquisicion',report.scene.date);
  row('Plataforma',report.scene.platform);
  row('Nubosidad de escena',readable(report.scene.cloudPct)+' %');
  row('Fuente',report.scene.source);
  const study=studyManifest||reportPlateManifest({plates:studyPlates,geoMatches,evidence:geologyEvidence,fieldNotes});
  row('Anexos geologicos aportados',study.plates.length);
  para('Las laminas del operador son documentacion de gabinete; no son datos generados por Sentinel-2 ni se georreferencian automaticamente.',{size:9,color:muted});
  heading('2. Metricas espectrales');
  row('Cuadricula UTM',report.grid.width+' x '+report.grid.height+' (muestreo reproyectado)');
  row('Celda aproximada',readable(report.grid.cellWidthMeters)+' x '+readable(report.grid.cellHeightMeters)+' m');
  row('Bandas cargadas',(report.grid.bandsRead||[]).join(', '));
  if(report.grid.upsampled20mBands)para('Advertencia: SWIR / red-edge / SCL tienen resolucion original de 20 m, aunque se visualicen en celdas de 10 m.',{size:9,color:muted});
  row('Pixeles validos',report.grid.validPixels+' / '+report.grid.totalPixels+' ('+readable(report.grid.usablePct)+' %)');
  for(const [label,entry] of [['Respuesta ferrica B4/B2',report.indices.iron],['Respuesta SWIR B11/B12',report.indices.clay]]){
    row(label,'P50 '+readable(entry.p50)+' | P75 '+readable(entry.p75)+' | P90 '+readable(entry.p90));
  }
  for(const kind of ['ferrous','rededge']){const item=report.indices?.[kind];if(item?.p50!==null&&item?.p50!==undefined)row('Indice auxiliar '+item.formula, 'P50 '+readable(item.p50)+' | P90 '+readable(item.p90));}
  if(report.decision){
    heading('Dictamen operativo: SI / NO / NO EVALUABLE');
    para('Anomalias espectrales: '+readable(report.decision.spectralAnswer),{size:10,bold:true,color:green,after:4});
    para('Mineral confirmado en sectores: '+readable(report.decision.mineralAnswer),{size:9,after:3});
    para('Potencial economico: '+readable(report.decision.economicAnswer),{size:9,after:3});
    heading('Sectores ordenados para revision, NO por probabilidad');
    for(const z of report.decision.zones.slice(0,12)){
      para((z.kind==='iron'?'F-':'S-')+z.number+' | '+z.priority+' | '+z.lat+', '+z.lon+
        ' | Otro indice: '+z.cooccurrence+' | Segunda fecha: '+z.temporal,{size:9,after:2});
    }
    para('Criterios: '+report.decision.priorityMethod,{size:8,color:muted});
  }
  heading('3. Sectores de respuesta espectral relativa (GPS aproximado)');
  for(const [kind,label] of [['iron','Respuesta ferrica B4/B2'],['clay','Respuesta SWIR B11/B12']]){
    const zones=report.zones?.[kind]||[];
    para(label+': '+zones.length+' grupos contiguos observados, de al menos 3 pixeles sobre P90.',{size:9,bold:true,color:green,after:3});
    if(!zones.length)para('No se localizaron sectores de tamano suficiente con estos criterios. No implica ausencia de mineral.',{size:9,color:muted,after:3});
    for(const z of zones){
      para('Sector '+z.number+'  |  Lat '+readable(z.lat)+'  Lon '+readable(z.lon)+'  |  Max '+readable(z.peakRatio)+'  |  Pixeles '+readable(z.pixels),{size:9,after:1});
    }
  }
  para('Coordenadas del centro del pixel mas alto de cada grupo. Georreferenciacion aproximada; no localizan un deposito comprobado.',{size:9,color:muted,after:4});
  if(heatmapUrl){
    heading('4. Vista de indicadores relativos');
    try{
      if(y+85>limit)page();
      pdf.addImage(heatmapUrl,'PNG',M,y,64,64);
      // Numerar los sectores en sus coordenadas de pixel máximas sobre el mapa de índices.
      const [w,s,e,n]=report.bbox;
      const points=report.zones?.[indicator]||[];
      for(const z of points){
        const rx=(z.lon-w)/(e-w),ry=(n-z.lat)/(n-s);
        if(!Number.isFinite(rx)||!Number.isFinite(ry)||rx<0||rx>1||ry<0||ry>1)continue;
        pdf.setFillColor(29,64,71);pdf.setDrawColor(255,255,255);
        pdf.circle(M+rx*64,y+ry*64,2.7,'FD');
        pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(6);
        pdf.text(String(z.number),M+rx*64,y+ry*64+1.8,{align:'center'});
      }
      y+=68;
      para('Capa calculada: '+({iron:'B4/B2',clay:'B11/B12',ferrous:'B11/B8A',rededge:'B7/B5'}[indicator]||indicator)+'. Los circulos son sectores por encima de P90. El fondo representa bandas procesadas, no verificacion de mineral.',{size:9,color:muted});
    }catch{para('No fue posible incrustar la imagen de indicadores.',{color:muted,size:9});}
  }
  heading('Cartografia geologica y relieve (referencias externas)');
  para('Visores y capas publicas: https://ide.sergeomin.gob.bo/ | WMS GeoBolivia, geologia y fallas regionales. Su escala es demasiado general para confirmar un sector de decenas de metros. No se automatizaron cruces GIS.',{size:9,color:muted});
  if(report.control){
    heading('Comparacion con area vecina (control descriptivo)');
    para('Orientacion '+readable(report.control.direction)+' | Escena usada '+readable(report.control.sceneId)+' | Limites '+(report.control.bbox||[]).join(', '),{size:9});
    for(const kind of ['iron','clay']){const s=report.control.indices?.[kind];if(s)row(kind==='iron'?'B4/B2':'B11/B12','Mediana principal '+readable(s.mainP50)+' | vecino '+readable(s.controlP50)+' | delta '+readable(s.deltaP50));}
    para(report.control.warning||'Comparacion descriptiva, no prueba de minerales.',{size:9,color:muted});
  }
  heading('Comprobaciones del area (no certifican mineral)');
  if(validation){
    row('Escena inicial',readable(validation.firstDate));
    row('Escena secundaria',readable(validation.secondDate));
    row('Celdas comparables',readable(validation.grid.sharedValid)+' / '+readable(validation.grid.total));
    for(const [name,k] of [['Respuesta ferrica','iron'],['Respuesta SWIR','clay']]){
      const m=validation.metrics[k];
      para(name+': coincidencia Jaccard '+(m.jaccard===null?'sin datos suficientes':(100*m.jaccard).toFixed(1)+' %')+', interseccion '+m.overlapPixels+' celdas; union '+m.unionPixels+' celdas.',{size:9,after:2});
    }
    para(validation.warning,{size:9,color:muted});
  }else para('No se proceso una segunda escena; sin contraste temporal.',{size:9,color:muted});
  para('Anotaciones declaradas por operador (sin auditoria independiente): '+fieldNotes.length,{size:9,bold:true,after:2});
  for(const note of fieldNotes.slice(0,15)){
    para('Sector '+readable(note.number)+' ('+readable(note.indicator)+'): '+readable(note.status)+' | '+readable(note.lat)+', '+readable(note.lon)+' | '+readable(note.notes),{size:8,after:2});
  }
  if(geoMatches.length){
    heading('Intersecciones locales con carta GeoJSON (NO AUDITADAS)');
    para('Los polígonos se aportaron por el operador en EPSG:4326. Se verificó la coincidencia con el centro aproximado de cada sector, no la escala ni la procedencia del mapa.',{size:9,color:muted});
    for(const item of geoMatches.slice(0,30))para((item.kind==='iron'?'F-':'S-')+item.number+' | Unidad declarada: '+item.unit+' | Litologia: '+item.lithology+' | Capa: '+item.source,{size:8,after:2});
  }
  if(geologyEvidence.length){
    heading('Antecedentes declarados por operador (SIN VERIFICACION)');
    for(const row of geologyEvidence.slice(0,12)){
      para('Tipo: '+readable(row.type)+' | Referencia: '+readable(row.source)+' | Sector: '+readable(row.sector||'sin asignar'),{size:9,bold:true,after:1});
      para(readable(row.description),{size:9,after:3});
    }
    para('Los antecedentes cargados por el usuario no han sido cotejados ni autentificados por GeoMiner.',{size:9,color:muted});
  }
  if(studyPlates.length || geologyEvidence.length || fieldNotes.length || geoMatches.length){
  heading('ESTUDIO GEOLOGICO DOCUMENTAL - estado de las fuentes');
  para('Estructura de estudio geologico siguiendo la organizacion de mapas geologicos tradicionales. Los capitulos solo pueden describir datos documentados y no se completan a partir de supuestos satelitales.',{size:9,color:muted});
  for(const sec of study.sections){
    para(sec.title+' - '+sec.status,{size:10,bold:true,color:green,after:1});
    para(sec.description,{size:9,after:3});
    for(const source of sec.sources.slice(0,2))para('Fuente aportada: '+source,{size:8,color:muted,after:1});
  }
  }
  if(geologyMapPng){
    heading('Mapa geologico vectorial del area (capa georreferenciada del usuario)');
    if(y+98>limit)page();
    try{pdf.addImage(geologyMapPng,'PNG',M,y,176,104);y+=108;
      para('Poligonos dibujados exclusivamente desde el GeoJSON importado por el operador; simbolos y unidades no verificados, sin base satelital.',{size:9,color:muted});}
    catch{para('No fue posible dibujar la capa geologica importada.',{size:9,color:muted});}
  }
  if(autoGeologyMapPng){
    heading('Carta geologica automaticamente consultada - GeoBolivia');
    if(y+108>limit)page();
    try{pdf.addImage(autoGeologyMapPng,'PNG',M,y,176,104);y+=108;
      para('Mapa generado por GeoMiner con poligonos WFS publicos y coordenadas del terreno. Fuente GeoBolivia / SERGEOTECMIN; escala regional.',{size:9,color:muted});}
    catch{para('No fue posible incluir el mapa publico en PDF.',{size:9,color:muted});}
  }
  if(autoResearch){
    heading('Investigacion automatica por coordenadas - fuentes verificables');
    row('Consulta',autoResearch.queriedAt||'s/d');
    const services=autoResearch.services||{};
    for(const [key,label] of [['geology','Unidades geologicas'],['faults','Fallas'],['anticlines','Anticlinales'],['synclines','Sinclinales'],['enmap','EnMAP (inventario)'],['emit','EMIT (inventario)']]){
      const entry=services[key];row(label,!entry?'Sin consulta':entry.status==='ok'?String(entry.count||0)+' elementos consultados':'Servicio externo no disponible');
    }
    const geol=services.geology;
    if(geol?.status==='ok'){
      para('Fuente: GeoBolivia / SERGEOTECMIN, mapa geologico 2000. No es cartografia nueva obtenida del satelite.',{size:8,color:muted});
      for(const f of geol.features?.features?.slice(0,8)||[])para(Object.entries(f.properties||{}).slice(0,4).map(([k,v])=>k+': '+v).join(' | ')||'Elemento sin atributos', {size:8,after:2});
      if(autoGeoMatches.length)para('Coincidencias aproximadas con sectores: '+autoGeoMatches.length+' (requiere verificar escala).',{size:8});
    }
    const topo=services.relief;
    if(topo?.status==='ok'){
      heading('Perfil del relieve oeste-este (SRTM 90 m)');
      row('Altitudes estimadas',topo.minMeters+' a '+topo.maxMeters+' m');
      if(y+48>limit)page();
      const startY=y,points=topo.points||[],span=Math.max(1,topo.maxMeters-topo.minMeters);
      pdf.setDrawColor(38,136,110);pdf.setLineWidth(.7);
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i];if(a?.elevation==null||b?.elevation==null)continue;
        pdf.line(M+a.position*150,startY+36-(a.elevation-topo.minMeters)/span*32,M+b.position*150,startY+36-(b.elevation-topo.minMeters)/span*32);
      }
      y+=43;para('Perfil topografico, NO corte geologico del subsuelo. API publica usada solo para pruebas; uso comercial requiere servicio propio o licencia.',{size:8,color:muted});
    }
    para('EnMAP/EMIT: el inventario confirma solo metadatos encontrados, no procesamiento mineralogico. Datos sin cobertura quedan como faltantes.',{size:8,color:muted});
  }
  heading('5. Metodologia y limites');
  for(const item of report.methods)para('- '+item,{size:9,after:2});
  heading(aiText?'6. Interpretacion asistida por OpenAI':'6. Interpretacion pendiente');
  if(aiText){
    for(const block of aiBlocks(aiText)){
      const value=block.text.replace(/\*\*/g,'');
      if(block.kind==='heading')heading(value);
      else para(value,{size:10,after:3});
    }
  }
  else para('Este informe contiene datos calculados automaticamente. No se genero una interpretacion con IA ni se realizo validacion por profesional geologo.',{size:10});
  heading('Advertencia tecnica');
  para(report.disclaimer,{size:10,bold:true,color:[148,63,44],after:4});
  para('Se recomienda inspeccion de campo, cartografia geologica y analisis de laboratorio antes de tomar decisiones de inversion.',{size:9,color:muted});
  if(studyPlates.length){
    const labels={mapa:'Mapa geologico',levantamiento:'Levantamientos / travesias',ocurrencias:'Ocurrencias minerales',perfiles:'Perfiles geologicos',estratigrafia:'Columna cronoestratigrafica',simbolos:'Simbologia / leyenda',fotografia:'Otra evidencia'};
    for(const [idx,plate] of studyPlates.slice(0,6).entries()){
      if(typeof plate.imageData!=='string'||!plate.imageData.startsWith('data:image/jpeg;base64,'))continue;
      page();
      heading('ANEXO GEOLOGICO '+(idx+1)+' - '+(labels[plate.kind]||'Documento'));
      row('Titulo',plate.title||'Sin titulo');
      row('Fuente / fecha',plate.source||'No declarada');
      row('Escala indicada por usuario',plate.scale||'No declarada');
      if(plate.notes)para('Observaciones del operador: '+plate.notes,{size:9,after:3});
      const iw=Number(plate.width),ih=Number(plate.height);
      const ratio=(iw>0&&ih>0)?iw/ih:1;
      const maxW=176,maxH=Math.min(200,Math.max(70,limit-y-22));
      let drawW=maxW,drawH=drawW/ratio;
      if(drawH>maxH){drawH=maxH;drawW=drawH*ratio;}
      if(drawH<1||drawW<1)continue;
      try{pdf.addImage(plate.imageData,'JPEG',M+(176-drawW)/2,y,drawW,drawH);y+=drawH+7;
        para('Lamina aportada por el usuario. No georreferenciada automaticamente ni verificada por GeoMiner.',{size:8,color:muted});}
      catch{para('No se pudo incrustar la lamina. Revisa el formato de imagen.',{size:9,color:muted});}
    }
  }
  const pages=pdf.getNumberOfPages();
  for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setFontSize(8);pdf.setTextColor(132,150,155);pdf.text('GeoMiner Bolivia v1.3 | Estudio geologico de gabinete | Pag. '+i+' / '+pages,M,288);}
  pdf.save('GeoMiner_Informe_'+(report.scene.date||'escena').slice(0,10)+'.pdf');
}
