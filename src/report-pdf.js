/** PDF generado localmente en el navegador; nunca requiere clave API. */
import { jsPDF } from 'jspdf';

const readable = value => value===null||value===undefined?'s/d':String(value);
export function downloadReportPdf(report,{aiText='',heatmapUrl=null}={}){
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
  heading('2. Metricas espectrales');
  row('Cuadricula',report.grid.width+' x '+report.grid.height+' (muestreo, no resolucion nativa)');
  row('Pixeles validos',report.grid.validPixels+' / '+report.grid.totalPixels+' ('+readable(report.grid.usablePct)+' %)');
  for(const [label,entry] of [['Respuesta ferrica B4/B2',report.indices.iron],['Respuesta SWIR B11/B12',report.indices.clay]]){
    row(label,'P50 '+readable(entry.p50)+' | P75 '+readable(entry.p75)+' | P90 '+readable(entry.p90));
  }
  if(heatmapUrl){
    heading('3. Vista de indicadores relativos');
    try{
      if(y+75>limit)page();pdf.addImage(heatmapUrl,'PNG',M,y,64,64);y+=67;
      para('Imagen de indicadores relativos sobre pixeles del area. Sin fotografia de base. Solo representa valores internos de esta escena.',{size:9,color:muted});
    }catch{para('No fue posible incrustar la imagen de indicadores.',{color:muted,size:9});}
  }
  heading('4. Metodologia y limites');
  for(const item of report.methods)para('- '+item,{size:9,after:2});
  heading(aiText?'5. Interpretacion asistida por OpenAI':'5. Interpretacion pendiente');
  if(aiText)para(aiText,{size:10,after:3});
  else para('Este informe contiene datos calculados automaticamente. No se genero una interpretacion con IA ni se realizo validacion por profesional geologo.',{size:10});
  heading('Advertencia tecnica');
  para(report.disclaimer,{size:10,bold:true,color:[148,63,44],after:4});
  para('Se recomienda inspeccion de campo, cartografia geologica y analisis de laboratorio antes de tomar decisiones de inversion.',{size:9,color:muted});
  const pages=pdf.getNumberOfPages();
  for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setFontSize(8);pdf.setTextColor(132,150,155);pdf.text('GeoMiner Bolivia v0.4 | Estudio preliminar | Pag. '+i+' / '+pages,M,288);}
  pdf.save('GeoMiner_Informe_'+(report.scene.date||'escena').slice(0,10)+'.pdf');
}
