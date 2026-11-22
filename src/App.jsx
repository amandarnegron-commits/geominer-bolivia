import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { squareFromCenter, bboxGeoJSON, bboxKml } from './geo.js';
import { analyseScene } from './cog-analysis.js';
import { INDICATORS, statsFor, rasterRGBA, exportTopPoints } from './indices.js';
import {
  Satellite, MapPinned, Layers3, Map, Search, Compass, Mountain, Waves,
  Crosshair, ScanLine, Database, FileText, ChevronDown, ExternalLink,
  Cloud, CalendarDays, RefreshCcw, BookmarkPlus, Trash2, CheckCircle2,
  AlertTriangle, Info, ArrowUpRight, LoaderCircle, Navigation, X, Menu, Download, LocateFixed, Image as ImageIcon
} from 'lucide-react';

const CITIES = [
  { name: 'Potosí', coords: [-65.753, -19.572], zoom: 10 },
  { name: 'Oruro', coords: [-67.121, -17.968], zoom: 10 },
  { name: 'La Paz', coords: [-68.120, -16.495], zoom: 10 },
  { name: 'Uyuni', coords: [-66.825, -20.461], zoom: 10 },
  { name: 'Sucre', coords: [-65.263, -19.047], zoom: 10 }
];
const EMPTY = { type: 'FeatureCollection', features: [] };
const fmt = n => Number(n).toLocaleString('es-BO', { maximumFractionDigits: 2 });
const dateStr = v => v ? new Date(v).toLocaleDateString('es-BO', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—';
function areaOf(b) {
  if (!b) return 0;
  const [w,s,e,n] = b;
  return Math.abs((n-s)*111.32*(e-w)*111.32*Math.cos((n+s)*Math.PI/360));
}
function shapeOf(bbox) {
  if (!bbox) return EMPTY;
  const [w,s,e,n]=bbox;
  return {type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]},properties:{}}]};
}
function readSaved() {
  try { const v=JSON.parse(localStorage.getItem('geominer-areas-v01')||'[]'); return Array.isArray(v)?v:[]; } catch { return []; }
}

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const firstCorner = useRef(null);
  const [bbox, setBbox] = useState(null);
  const [startPoint, setStartPoint] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [city, setCity] = useState('Potosí');
  const [baseLayer, setBaseLayer] = useState('streets');
  const [gpsLat, setGpsLat] = useState('-19.572');
  const [gpsLon, setGpsLon] = useState('-65.753');
  const [gpsSide, setGpsSide] = useState('5');
  const [cloudMax, setCloudMax] = useState('100');
  const [scenes, setScenes] = useState(null);
  const [analysisScenes, setAnalysisScenes] = useState(null);
  const [analysisScene, setAnalysisScene] = useState(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [indicator, setIndicator] = useState('iron');
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const abortAnalysis = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(readSaved);
  const [activeTab, setActiveTab] = useState('scenes');
  const [mobilePanel, setMobilePanel] = useState(false);
  const area = useMemo(() => areaOf(bbox), [bbox]);
  const visibleScenes = useMemo(() => (scenes?.scenes || []).filter(s => s.cloud !== null && s.cloud <= Number(cloudMax)), [scenes, cloudMax]);
  const analysisStats = useMemo(() => analysisResult ? statsFor(analysisResult[indicator]) : null,[analysisResult,indicator]);
  function clearSpectral() {
    abortAnalysis.current?.abort();
    setAnalysisResult(null);setHeatmapUrl(null);setAnalysisScenes(null);setAnalysisScene(null);
    setAnalysisError('');setAnalysisMessage('');
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const instance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': { type:'raster', tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize:256, attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>', maxzoom:19 },
          'satellite-2016': { type:'raster', tiles:['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'], tileSize:256, maxzoom:13, attribution:'Sentinel-2 cloudless 2016 — EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), CC BY 4.0' }
        },
        layers: [
          { id:'base', type:'raster', source:'osm' },
          { id:'satellite-2016-layer', type:'raster', source:'satellite-2016', layout:{visibility:'none'} }
        ]
      },
      center: [-65.753,-19.572],
      zoom: 9,
      maxZoom: 17
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    instance.on('load', () => {
      instance.addSource('selected-area', { type: 'geojson', data: EMPTY });
      instance.addLayer({ id:'area-fill', type:'fill', source:'selected-area',
        paint:{ 'fill-color':'#0a9d8b', 'fill-opacity':.15 } });
      instance.addLayer({ id:'area-border', type:'line', source:'selected-area',
        paint:{ 'line-color':'#087e72', 'line-width':3, 'line-dasharray':[2,1] } });
    });
    instance.on('click', (event) => {
      const point = [Number(event.lngLat.lng.toFixed(6)), Number(event.lngLat.lat.toFixed(6))];
      if (!firstCorner.current) {
        firstCorner.current = point;
        setStartPoint(point);
        setBbox(null);
        setScenes(null);
        clearSpectral();
        setError('');
      } else {
        const a=firstCorner.current;
        firstCorner.current=null;
        setStartPoint(null);
        setBbox([Math.min(a[0],point[0]),Math.min(a[1],point[1]),Math.max(a[0],point[0]),Math.max(a[1],point[1])]);
        setScenes(null);
        clearSpectral();
        setError('');
      }
    });
    instance.on('mousemove', e => setCursor([e.lngLat.lat.toFixed(4), e.lngLat.lng.toFixed(4)]));
    return () => { instance.remove(); map.current=null; };
  }, []);

  useEffect(() => {
    const instance=map.current;
    if (!instance) return;
    const update=()=>instance.getSource('selected-area')?.setData(shapeOf(bbox));
    if (instance.isStyleLoaded()) update(); else instance.once('load',update);
  }, [bbox]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const change = () => {
      if (!instance.getLayer('base') || !instance.getLayer('satellite-2016-layer')) return;
      instance.setLayoutProperty('base','visibility','visible');
      instance.setLayoutProperty('satellite-2016-layer','visibility',baseLayer==='historical'?'visible':'none');
    };
    if (instance.isStyleLoaded()) change(); else instance.once('load', change);
  }, [baseLayer]);

  // Geo-referenciamos exactamente la cuadrícula del análisis en el terreno elegido.
  useEffect(() => {
    const instance=map.current;
    if(!instance)return;
    const apply=()=>{
      if(instance.getLayer('spectral-overlay')) instance.removeLayer('spectral-overlay');
      if(instance.getSource('spectral-overlay')) instance.removeSource('spectral-overlay');
      if(!heatmapUrl||!bbox||!instance.getLayer('area-border'))return;
      const [w,s,e,n]=bbox;
      instance.addSource('spectral-overlay',{
        type:'image',url:heatmapUrl,
        coordinates:[[w,n],[e,n],[e,s],[w,s]]
      });
      instance.addLayer({id:'spectral-overlay',type:'raster',source:'spectral-overlay',paint:{'raster-opacity':0.9}},'area-border');
    };
    if(instance.isStyleLoaded())apply();else instance.once('load',apply);
  },[heatmapUrl,bbox]);

  useEffect(()=>{
    if(!analysisResult)return;
    const selected=analysisResult[indicator];
    const stats=statsFor(selected);
    const canvas=document.createElement('canvas');
    canvas.width=analysisResult.width;canvas.height=analysisResult.height;
    const ctx=canvas.getContext('2d');
    ctx.putImageData(new ImageData(rasterRGBA(selected,stats,indicator),canvas.width,canvas.height),0,0);
    setHeatmapUrl(canvas.toDataURL('image/png'));
  },[analysisResult,indicator]);

  async function findAnalysisScenes() {
    if(!bbox||area>25.01||area<0.01){setAnalysisError('Para el análisis selecciona una zona de 0,01 a 25 km².');return;}
    setAnalysisBusy(true);setAnalysisError('');setAnalysisScenes(null);setAnalysisScene(null);
    setAnalysisResult(null);setHeatmapUrl(null);
    setAnalysisMessage('Buscando escenas públicas con bandas B2, B4, B8, B11 y B12…');
    setActiveTab('analysis');
    try {
      const res=await fetch('/api/analysis-scenes?bbox='+encodeURIComponent(bbox.join(',')));
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'No se encontraron escenas para análisis.');
      setAnalysisScenes(data);
      setAnalysisScene(data.scenes[0]||null);
      setAnalysisMessage(data.scenes.length?'Selecciona la escena y procesa las bandas.':'No hay escenas disponibles; prueba otro terreno.');
    }catch(err){setAnalysisError(err?.message||'Error de conexión con Earth Search.');}
    finally{setAnalysisBusy(false);}
  }

  async function processAnalysis() {
    if(!bbox||!analysisScene)return;
    const controller=new AbortController();abortAnalysis.current=controller;
    setAnalysisBusy(true);setAnalysisError('');setAnalysisResult(null);setHeatmapUrl(null);
    try {
      const result=await analyseScene(analysisScene,bbox,{onProgress:setAnalysisMessage,signal:controller.signal});
      if(result.valid===0)throw new Error('No hay píxeles de suelo aptos después de excluir nubes, agua y vegetación. Prueba otra fecha o terreno.');
      setAnalysisResult(result);
      setAnalysisMessage('Análisis calculado con datos de la escena seleccionada.');
    }catch(err){if(!controller.signal.aborted)setAnalysisError(err?.message||'Error procesando bandas.');}
    finally{if(abortAnalysis.current===controller)abortAnalysis.current=null;setAnalysisBusy(false);}
  }
  function downloadIndicators() {
    if(!analysisResult||!bbox)return;
    const data=exportTopPoints(analysisResult,bbox,indicator);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/geo+json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='geominer-indicadores-'+indicator+'.geojson';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function useGPS() {
    try {
      const b = squareFromCenter(gpsLon,gpsLat,gpsSide);
      firstCorner.current=null; setStartPoint(null); clearSpectral(); setBbox(b); setScenes(null); setError('');
      map.current?.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:80,maxZoom:14,duration:650});
      setMobilePanel(false);
    } catch (err) { setError(err.message); setActiveTab('scenes'); }
  }
  function downloadArea(type) {
    if (!bbox) return;
    const content = type==='kml' ? bboxKml(bbox) : JSON.stringify(bboxGeoJSON(bbox),null,2);
    const mime = type==='kml' ? 'application/vnd.google-earth.kml+xml' : 'application/geo+json';
    const blob=new Blob([content],{type:mime+';charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='geominer-area.'+(type==='kml'?'kml':'geojson');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function goCity(c) {
    setCity(c.name);
    map.current?.flyTo({center:c.coords,zoom:c.zoom,essential:true});
  }
  function reset() {
    firstCorner.current=null; setStartPoint(null); clearSpectral(); setBbox(null); setScenes(null); setError('');
  }
  function restore(item) {
    reset();
    setBbox(item.bbox);
    const [w,s,e,n]=item.bbox;
    map.current?.fitBounds([[w,s],[e,n]],{padding:85,maxZoom:13,duration:650});
  }
  function saveArea() {
    if (!bbox) return;
    const entry={id:Date.now(),name:'Área '+city+' · '+new Date().toLocaleDateString('es-BO'),
      bbox,area:Math.round(area*100)/100};
    const all=[entry,...saved].slice(0,25);
    setSaved(all); localStorage.setItem('geominer-areas-v01',JSON.stringify(all));
    setActiveTab('saved');
  }
  function deleteArea(id) {
    const all=saved.filter(x=>x.id!==id);setSaved(all);
    localStorage.setItem('geominer-areas-v01',JSON.stringify(all));
  }
  async function searchScenes() {
    if (!bbox || area < .01 || area > 2500) {
      setError('Selecciona un área válida de entre 0,01 y 2.500 km².');return;
    }
    setBusy(true);setError('');setScenes(null);setActiveTab('scenes');
    try {
      const res=await fetch('/api/sentinel?bbox='+encodeURIComponent(bbox.join(',')));
      const data=await res.json();
      if (!res.ok) throw new Error(data.error||'No se pudo consultar Copernicus.');
      setScenes(data);
    }catch(err){setError(err.message||'No hay conexión con el catálogo.');}
    finally {setBusy(false);}
  }

  return (
    <div className="app-shell">
      <aside className={'sidebar '+(mobilePanel?'open':'')}>
        <div className="logo-block">
          <div className="logo-mark"><Mountain size={23}/></div>
          <div><strong>GeoMiner <em>Bolivia</em></strong><small>INTELIGENCIA GEOLÓGICA</small></div>
          <button className="icon-button mobile-close" aria-label="Cerrar menú" onClick={()=>setMobilePanel(false)}><X size={18}/></button>
        </div>
        <div className="sidebar-content">
          <div className="section-cap">PLATAFORMA</div>
          <div className="nav-active"><MapPinned size={18}/><span>Explorador satelital</span><span className="nav-dot"/></div>
          <button type="button" className="nav-active spectral-nav" onClick={()=>{setActiveTab('analysis');setMobilePanel(false);}}><Layers3 size={18}/><span>Índices espectrales</span><span className="nav-dot"/></button>
          <div className="nav-disabled"><FileText size={18}/><span>Informes con IA</span><small>Próximo</small></div>
          <div className="sidebar-divider"/>
          <div className="section-cap">ZONA DE TRABAJO</div>
          <div className="sidebar-card">
            <div className="caption-label"><Crosshair size={15}/> Elegir región</div>
            <div className="city-picker">
              <select aria-label="Región" value={city} onChange={e=>{const c=CITIES.find(x=>x.name===e.target.value);if(c)goCity(c);}}>
                {CITIES.map(c=><option key={c.name}>{c.name}</option>)}
              </select>
              <ChevronDown size={17}/>
            </div>
            <div className="help-steps">
              <div><span>1</span>Haz clic en la primera esquina del terreno.</div>
              <div><span>2</span>Haz clic en la esquina opuesta.</div>
              <div><span>3</span>Consulta escenas satelitales reales.</div>
            </div>
          </div>
          <div className="sidebar-card gps-card">
            <div className="caption-label"><LocateFixed size={15}/> Seleccionar por GPS</div>
            <div className="gps-fields">
              <label>Latitud <input type="number" step="any" value={gpsLat} onChange={e=>setGpsLat(e.target.value)} /></label>
              <label>Longitud <input type="number" step="any" value={gpsLon} onChange={e=>setGpsLon(e.target.value)} /></label>
            </div>
            <div className="gps-actions"><label>Lado del terreno
              <select value={gpsSide} onChange={e=>setGpsSide(e.target.value)}><option value="1">1 km</option><option value="5">5 km</option><option value="10">10 km</option><option value="20">20 km</option><option value="40">40 km</option></select>
            </label><button onClick={useGPS}><LocateFixed size={15}/> Aplicar</button></div>
          </div>
          <div className="sidebar-card faint">
            <div className="caption-label"><ScanLine size={15}/> Área seleccionada</div>
            <div className="area-value">{bbox?fmt(area):'0'} <span>km²</span></div>
            <div className="area-sub">{startPoint?'Primera esquina marcada: selecciona la segunda.':bbox?'Terreno delimitado correctamente.':'Sin área seleccionada'}</div>
            {bbox&&<div className="coords-mini">{bbox.map(n=>n.toFixed(4)).join(' · ')}</div>}
            {bbox&&<div className="export-actions"><button onClick={()=>downloadArea('geojson')}><Download size={14}/> GeoJSON</button><button onClick={()=>downloadArea('kml')}><Download size={14}/> KML</button></div>}
            <div className="actions-inline">
              <button onClick={reset} className="ghost-btn" disabled={!bbox&&!startPoint}><RefreshCcw size={14}/> Limpiar</button>
              <button onClick={saveArea} className="ghost-btn" disabled={!bbox}><BookmarkPlus size={14}/> Guardar</button>
            </div>
          </div>
          <button onClick={searchScenes} className="run-btn" disabled={busy||!bbox||area<.01||area>2500}>
            {busy?<LoaderCircle className="spin" size={18}/>:<Satellite size={18}/>}
            {busy?'Buscando imágenes…':'Buscar imágenes Sentinel-2'}
          </button>
          <button type="button" className="run-btn analysis-run" onClick={findAnalysisScenes} disabled={analysisBusy||!bbox||area<0.01||area>25.01}>
            <Layers3 size={17}/> Buscar datos para análisis
          </button>
          <div className="limit-note"><Info size={14}/><span>Hasta 25 km² para análisis multiespectral gratuito. Los índices no identifican yacimientos.</span></div>
        </div>
        <div className="sidebar-foot"><span className="live-dot"/> GeoMiner v0.3 <span className="foot-right">PROTOTIPO</span></div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-toggle" aria-label="Abrir menú" onClick={()=>setMobilePanel(true)}><Menu size={20}/></button>
            <div><div className="top-eyebrow">INICIO / EXPLORADOR</div><h1>Exploración satelital</h1></div>
          </div>
          <div className="topbar-meta">
            <span className="state-pill"><span className="live-dot"/> Catálogo Copernicus</span>
            <span className="v-tag">Beta 0.3</span>
          </div>
        </header>
        <section className="work-area">
          <div className="map-column">
            <div className="map-title"><div><strong>Mapa de exploración</strong><span>Bolivia · Cartografía, Sentinel-2 histórico e índices espectrales</span></div>
              <div className="map-tools"><div className="layer-switch"><button className={baseLayer==='streets'?'active':''} onClick={()=>setBaseLayer('streets')}><Map size={14}/> Mapa</button><button className={baseLayer==='historical'?'active':''} onClick={()=>setBaseLayer('historical')}><Satellite size={14}/> Satélite 2016</button></div><button className="small-square" title="Volver a Potosí" onClick={()=>goCity(CITIES[0])}><Navigation size={17}/></button></div>
            </div>
            <div className="map-wrap">
              <div ref={mapContainer} className="map"/>
              <div className="map-tip"><Crosshair size={16}/><span>{startPoint?'Selecciona la segunda esquina':bbox?'Área delimitada · puedes consultar escenas':'Dos clics para delimitar tu terreno'}</span></div>
              <div className="map-legend"><span className="legend-swatch"/> Área seleccionada</div>
              {baseLayer==='historical'&&<div className="map-history-warning">Mosaico Sentinel-2 de 2016 · Imagen de referencia histórica.</div>}
              {analysisResult&&<div className="map-spectral-warning">{indicator==='iron'?'B4/B2':'B11/B12'} · Respuesta relativa de superficie · {dateStr(analysisScene?.date)} · NO es mineral confirmado.</div>}
              {cursor&&<div className="coordinates">LAT {cursor[0]} · LON {cursor[1]}</div>}
            </div>
            <div className="map-bottom">
              <div><Info size={16}/><span>Los límites dibujados son aproximados; no equivalen a derechos mineros ni catastros oficiales.</span></div>
              <span>{baseLayer==='historical'?'Sentinel-2 2016 © EOX, CC BY 4.0':'OpenStreetMap'}</span>
            </div>
          </div>
          <div className="inspector">
            <div className="inspector-top">
              <div><div className="panel-eyebrow">CENTRO DE ANÁLISIS</div><h2>Resultados del terreno</h2></div>
              <div className="inspector-icon"><Satellite size={20}/></div>
            </div>
            <div className="inspector-tabs">
              <button onClick={()=>setActiveTab('scenes')} className={activeTab==='scenes'?'selected':''}>Imágenes</button>
              <button onClick={()=>setActiveTab('analysis')} className={activeTab==='analysis'?'selected':''}>Análisis</button>
              <button onClick={()=>setActiveTab('saved')} className={activeTab==='saved'?'selected':''}>Mis áreas <span>{saved.length}</span></button>
            </div>
            {activeTab==='analysis' ? (
              <div className="panel-inner spectral-panel">
                <div className="spectral-intro"><Layers3 size={19}/><div><strong>Prospección espectral preliminar</strong><p>Sentinel-2 L2A · bandas reales B2, B4, B8, B11 y B12 · clasificación de terreno SCL.</p></div></div>
                {!bbox&&<div className="empty-state compact"><Crosshair size={31} className="muted"/><strong>Selecciona tu terreno</strong><p>Delimita un terreno con GPS o dos clics en el mapa. Después busca escenas para analizar.</p></div>}
                {bbox&&area>25.01&&<div className="error-box"><Info size={17}/> Elige 5 × 5 km o menos para el procesamiento inicial. Área actual: {fmt(area)} km².</div>}
                {bbox&&area<=25.01&&<div className="spectral-step"><strong>1. Buscar imágenes multiespectrales</strong><button type="button" onClick={findAnalysisScenes} disabled={analysisBusy}>Consultar escenas gratuitas</button></div>}
                {analysisError&&<div className="error-box"><AlertTriangle size={17}/>{analysisError}</div>}
                {analysisBusy&&<div className="spectral-loading"><LoaderCircle className="spin" size={17}/>{analysisMessage}</div>}
                {analysisScenes&&<div className="spectral-scene-box"><small>Catálogo Earth Search · {analysisScenes.examined} escenas examinadas</small><label htmlFor="analysis-scene-select">Escena para procesar</label>
                  {analysisScenes.scenes.length ? <select id="analysis-scene-select" value={analysisScene?.id||''} onChange={e=>{setAnalysisScene(analysisScenes.scenes.find(s=>s.id===e.target.value)||null);setAnalysisResult(null);setHeatmapUrl(null);}}>
                    {analysisScenes.scenes.map(scene=><option value={scene.id} key={scene.id}>{dateStr(scene.date)} · Nubes {scene.cloud}% · {scene.platform}</option>)}
                  </select>:<p>No se encontraron escenas completas con las bandas requeridas.</p>}
                  <p>La nubosidad corresponde a toda la escena, no necesariamente a tu terreno.</p>
                  <button className="run-btn spectral-process" onClick={processAnalysis} disabled={analysisBusy||!analysisScene}><ScanLine size={17}/> 2. Procesar bandas de la escena</button>
                </div>}
                {analysisResult&&analysisStats&&<div className="spectral-output">
                  <strong>Resultados de índices relativos</strong>
                  <div className="spectral-mode">
                    {Object.entries(INDICATORS).map(([id,meta])=><button key={id} className={indicator===id?'active':''} onClick={()=>setIndicator(id)}>{id==='iron'?'B4/B2 · Hierro':'B11/B12 · SWIR'}</button>)}
                  </div>
                  <div className="spectral-stat-grid"><div><small>Píxeles útiles</small><strong>{fmt(analysisResult.valid)} / {fmt(analysisResult.total)}</strong></div><div><small>Percentil 90</small><strong>{analysisStats.p90?.toFixed(3)??'s/d'}</strong></div></div>
                  <p className="spectral-explain">{INDICATORS[indicator].label}. El mapa resalta valores superiores al percentil 75 <strong>dentro de este terreno</strong>; no equivale a una concentración o yacimiento confirmado.</p>
                  <button onClick={downloadIndicators} className="spectral-export"><Download size={15}/> Descargar puntos de respuesta alta (GeoJSON)</button>
                </div>}
                <div className="spectral-footnote">El análisis se ejecuta en tu navegador usando COGs públicos. Puede consumir varios MB y requerir conexión estable. Los resultados deben validarse con geólogos y muestreo.</div>
              </div>
            ) : activeTab==='scenes' ? (
              <div className="panel-inner">
                {error&&<div className="error-box"><AlertTriangle size={17}/>{error}</div>}
                {!scenes && !busy && <div className="empty-state"><div className="empty-illustration"><Satellite size={38}/><span/></div><strong>Tu investigación comienza aquí</strong><p>Selecciona dos puntos en el mapa y consulta las escenas Sentinel-2 disponibles en Copernicus.</p><div className="empty-source"><Database size={16}/> Datos oficiales, no simulados</div></div>}
                {busy&&<div className="empty-state"><LoaderCircle size={36} className="spin muted"/><strong>Consultando Copernicus</strong><p>Buscando escenas satelitales reales del último año para tu selección.</p></div>}
                {scenes&&<div className="scene-results">
                  <div className="result-head"><CheckCircle2 size={20}/><div><strong>{scenes.scenes.length} escenas candidatas</strong><small>Se revisaron {scenes.examined} registros del catálogo</small></div></div>
                  <div className="result-stats"><div><small>Superficie</small><strong>{fmt(scenes.areaKm2)} km²</strong></div><div><small>Período</small><strong>Últimos 12 meses</strong></div></div>
                  <p className="result-note">{scenes.note}</p>
                  <div className="cloud-filter"><label htmlFor="cloudMax">Nubosidad máxima de la escena</label><select id="cloudMax" value={cloudMax} onChange={e=>setCloudMax(e.target.value)}><option value="100">Todas (con dato)</option><option value="10">Hasta 10%</option><option value="20">Hasta 20%</option><option value="40">Hasta 40%</option><option value="70">Hasta 70%</option></select></div>
                  {visibleScenes.length===0?<p className="no-results">No se encontraron escenas con el filtro indicado. Prueba otro porcentaje de nubosidad.</p>:(
                    <div className="scene-list">{visibleScenes.map((scene,index)=><div className="scene" key={scene.id||index}>
                      <div className="scene-icon"><Satellite size={17}/></div><div className="scene-text"><strong>{dateStr(scene.date)}</strong><small>{scene.platform} · L2A</small></div>
                      <div className="cloud-label"><Cloud size={14}/>{scene.cloud===null?'s/d':scene.cloud+'%'}</div>
                    </div>)}</div>
                  )}
                  <a className="source-link" href="https://browser.dataspace.copernicus.eu/" target="_blank" rel="noreferrer">Examinar imagen original en Copernicus <ExternalLink size={14}/></a>
                </div>}
              </div>
            ):(
              <div className="panel-inner">
                {saved.length===0?<div className="empty-state compact"><BookmarkPlus size={35} className="muted"/><strong>Sin áreas guardadas</strong><p>Delimita un terreno y pulsa «Guardar» para conservarlo en este navegador.</p></div>:
                <div className="saved-list">{saved.map(x=><div className="saved-item" key={x.id}><button className="saved-title" onClick={()=>{restore(x);setActiveTab('scenes');}}><MapPinned size={17}/><span><strong>{x.name}</strong><small>{fmt(x.area)} km² · Abrir en mapa</small></span></button><button className="icon-button delete-btn" aria-label="Eliminar área" onClick={()=>deleteArea(x.id)}><Trash2 size={16}/></button></div>)}</div>}
              </div>
            )}
            <div className="inspector-foot">
              <div className="next-heading"><span className="future-dot"/><strong>Próxima etapa</strong></div>
              <div className="next-feature"><div><Layers3 size={19}/></div><p><strong>Índices espectrales</strong><span>Disponible en pestaña Análisis (experimental).</span></p></div>
              <div className="next-feature"><div><FileText size={19}/></div><p><strong>Informe con OpenAI</strong><span>Interpretación con advertencias geológicas y PDF.</span></p></div>
            </div>
          </div>
        </section>
        <footer className="page-footer"><span>GeoMiner Bolivia · Plataforma en desarrollo</span><span>Prospección preliminar · No sustituye estudios geológicos de campo</span></footer>
      </main>
    </div>
  );
}
