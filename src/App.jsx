import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { squareFromCenter, bboxGeoJSON, bboxKml } from './geo.js';
import { analyseScene } from './cog-analysis.js';
import { INDICATORS, statsFor, rasterRGBA, exportTopPoints } from './indices.js';
import { prepareReport } from './report-data.js';
import { detectAnomalyZones, zonesToGeoJSON } from './anomaly-zones.js';
import { downloadReportPdf } from './report-pdf.js';
import { USER_EVIDENCE_TYPES } from './geological-evidence.js';
import { aiBlocks } from './ai-text.js';
import { validateGeologyGeoJSON, matchGeologyToSectors } from './geology-overlay.js';
import { parseGpsPair, sectorCsv } from './coordinates.js';
import { compareSpectralResults, FIELD_STATUSES, noteKey, normalizeFieldNote, exportValidationBundle } from './pilot-validation.js';
import { neighbouringBbox, controlAreaComparison } from './control-area.js';
import { falseColorRGBA } from './false-color.js';
import { minimumGroupPixels } from './resolution.js';
import { GEO_PLATE_TYPES, reportPlateManifest } from './geological-study.js';
import { createGeologyMapImage } from './geological-map.js';
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
function renderBold(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((part,i)=>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2,-2)}</strong> : part
  );
}
function readFieldLog() {
  try { const items=JSON.parse(localStorage.getItem('geominer-field-log-v07')||'[]');return Array.isArray(items)?items.slice(0,100):[]; }catch{return [];}
}
function readGeologyEvidence() {
  try {const v=JSON.parse(localStorage.getItem('geominer-geology-sources-v10')||'[]');return Array.isArray(v)?v.slice(0,40):[];}catch{return [];}
}
function areaEvidenceKey(b) {return b?JSON.stringify(b.map(x=>Number(x.toFixed(5)))):'';}
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
  const [city, setCity] = useState('Área GPS');
  const [baseLayer, setBaseLayer] = useState('streets');
  const [gpsLat, setGpsLat] = useState('');
  const [gpsLon, setGpsLon] = useState('');
  const [gpsSide, setGpsSide] = useState('5');
  const [gpsPairText,setGpsPairText] = useState('');
  const [cloudMax, setCloudMax] = useState('100');
  const [scenes, setScenes] = useState(null);
  const [analysisScenes, setAnalysisScenes] = useState(null);
  const [analysisScene, setAnalysisScene] = useState(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [aiText, setAiText] = useState('');
  const [aiUsage, setAiUsage] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [aiPreview,setAiPreview] = useState(false);
  const [geologyPlates,setGeologyPlates] = useState([]);
  const [autoResearch,setAutoResearch] = useState(null);
  const [researchBusy,setResearchBusy] = useState(false);
  const [researchError,setResearchError] = useState('');
  const [plateError,setPlateError] = useState('');
  const [geologistQuestion,setGeologistQuestion] = useState('');
  const [geologyEvidence,setGeologyEvidence] = useState(readGeologyEvidence);
  const [geoEvidenceType,setGeoEvidenceType] = useState('mapa_geologico');
  const [geoEvidenceSource,setGeoEvidenceSource] = useState('');
  const [geoEvidenceDescription,setGeoEvidenceDescription] = useState('');
  const [geoEvidenceSector,setGeoEvidenceSector] = useState('');
  const [geoEvidenceError,setGeoEvidenceError] = useState('');
  const [importedGeoMap,setImportedGeoMap] = useState(null);
  const [importedGeoAreaKey,setImportedGeoAreaKey] = useState('');
  const [importedGeoSource,setImportedGeoSource] = useState('');
  const [importGeoError,setImportGeoError] = useState('');
  const [indicator, setIndicator] = useState('iron');
  const [resolutionMeters,setResolutionMeters] = useState(20);
  const [spectralView,setSpectralView] = useState('indices');
  const [showGeology,setShowGeology] = useState(false);
  const [showFaults,setShowFaults] = useState(false);
  const [showRelief,setShowRelief] = useState(false);
  const [controlDirection,setControlDirection] = useState('W');
  const [controlResult,setControlResult] = useState(null);
  const [controlBusy,setControlBusy] = useState(false);
  const [controlError,setControlError] = useState('');
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [compareSceneId,setCompareSceneId] = useState('');
  const [compareOutput,setCompareOutput] = useState(null);
  const [compareLoading,setCompareLoading] = useState(false);
  const [compareError,setCompareError] = useState('');
  const [fieldLog,setFieldLog] = useState(readFieldLog);
  const [noteStatus,setNoteStatus] = useState('sin_verificar');
  const [noteText,setNoteText] = useState('');
  const [showZoneMarkers, setShowZoneMarkers] = useState(true);
  const [heatOpacity, setHeatOpacity] = useState(0.72);
  const zoneMarkers = useRef([]);
  const abortAnalysis = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(readSaved);
  const [activeTab, setActiveTab] = useState('analysis');
  const [mobilePanel, setMobilePanel] = useState(false);
  const area = useMemo(() => areaOf(bbox), [bbox]);
  const activeGeologyEvidence = useMemo(() => geologyEvidence.filter(x=>x.areaKey===areaEvidenceKey(bbox)),[geologyEvidence,bbox]);
  const activePlates=useMemo(()=>geologyPlates.filter(p=>p.areaKey===areaEvidenceKey(bbox)),[geologyPlates,bbox]);
  const visibleScenes = useMemo(() => (scenes?.scenes || []).filter(s => s.cloud !== null && s.cloud <= Number(cloudMax)), [scenes, cloudMax]);
  const temporalComparison=useMemo(()=>analysisResult&&compareOutput?.result ? compareSpectralResults(analysisResult,compareOutput.result):null,[analysisResult,compareOutput]);
  const activeAreaNotes=useMemo(()=>{
    if(!bbox||!analysisScene)return [];
    const areaId=JSON.stringify(bbox.map(x=>Number(x.toFixed(5))));
    return fieldLog.filter(x=>{try{const k=JSON.parse(x.key);return Array.isArray(k)&&JSON.stringify(k[0])===areaId&&x.sceneId===analysisScene.id;}catch{return false;}});
  },[fieldLog,bbox,analysisScene]);
  const analysisStats = useMemo(() => analysisResult ? statsFor(analysisResult[indicator]) : null,[analysisResult,indicator]);
  const zones = useMemo(() => detectAnomalyZones(analysisResult,bbox,indicator,{minPixels:minimumGroupPixels(analysisResult),limit:12}),[analysisResult,bbox,indicator]);
  const controlSummary=useMemo(()=>analysisResult&&controlResult?.result?controlAreaComparison(analysisResult,controlResult.result,controlResult.direction):null,[analysisResult,controlResult]);
  const selectedZone = useMemo(()=>zones.find(z=>z.id===selectedZoneId)||null,[zones,selectedZoneId]);
  const preparedReport = useMemo(() => analysisResult && bbox && analysisScene ? prepareReport({
    bbox,region:city,scene:analysisScene,result:analysisResult,
    temporal: temporalComparison&&compareOutput?.scene ? {
      secondSceneId:compareOutput.scene.id, secondDate:compareOutput.scene.date,
      grid:temporalComparison.grid,metrics:temporalComparison.metrics
    }:null,
    control:controlSummary&&controlResult?{...controlSummary,bbox:controlResult.bbox,date:analysisScene.date,sceneId:analysisScene.id}:null,
    secondResult:compareOutput?.result||null
  }):null,[analysisResult,bbox,analysisScene,city,temporalComparison,compareOutput,controlSummary,controlResult]);
  const activeGeoMap=useMemo(()=>importedGeoAreaKey===areaEvidenceKey(bbox)?importedGeoMap:null,[importedGeoMap,importedGeoAreaKey,bbox]);
  const autoGeoMap=autoResearch?.services?.geology?.status==='ok'?autoResearch.services.geology.features:null;
  const autoGeoMatches=useMemo(()=>autoGeoMap&&preparedReport?.zones?matchGeologyToSectors(autoGeoMap,preparedReport.zones,'GeoBolivia/SERGEOTECMIN, mapa nacional 2000'):[],[autoGeoMap,preparedReport]);
  const geoMatches=useMemo(()=>activeGeoMap&&preparedReport?.zones?
    matchGeologyToSectors(activeGeoMap,preparedReport.zones,importedGeoSource):[],[activeGeoMap,preparedReport,importedGeoSource]);
  const studyManifest=useMemo(()=>reportPlateManifest({plates:activePlates,geoMatches,evidence:activeGeologyEvidence,fieldNotes:activeAreaNotes}),[activePlates,geoMatches,activeGeologyEvidence,activeAreaNotes]);
  async function uploadGeologyGeoJSON(event){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    setImportGeoError('');
    if(file.size>3*1024*1024){setImportGeoError('El GeoJSON debe pesar como máximo 3 MB. Recorta al sector en QGIS.');return;}
    try{const parsed=JSON.parse(await file.text());const validated=validateGeologyGeoJSON(parsed);
      setImportedGeoMap(validated);setImportedGeoAreaKey(areaEvidenceKey(bbox));setImportedGeoSource(file.name.slice(0,170));setAiText('');setAiUsage(null);
    }catch(e){setImportGeoError(e?.message||'GeoJSON inválido.');}
  }
  useEffect(()=>{
    const instance=map.current;if(!instance)return;
    const sync=()=>{
      if(!instance.isStyleLoaded())return;
      if(!instance.getSource('local-geology')){
        instance.addSource('local-geology',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        instance.addLayer({id:'local-geology-fill',type:'fill',source:'local-geology',paint:{'fill-color':'#d98452','fill-opacity':0.23,'fill-outline-color':'#984c41'}});
        instance.addLayer({id:'local-geology-border',type:'line',source:'local-geology',paint:{'line-color':'#834e51','line-width':1.3}});
      }
      instance.getSource('local-geology').setData(activeGeoMap||{type:'FeatureCollection',features:[]});
    };
    if(instance.isStyleLoaded())sync();else instance.once('load',sync);
  },[activeGeoMap]);
  async function investigateArea(){
    if(!bbox||area<0.01||area>25.02){setResearchError('Selecciona un área GPS de hasta 25 km².');return;}
    if(!adminCode.trim()){setResearchError('Ingresa tu código privado de GeoMiner para consultar los servicios.');return;}
    setResearchBusy(true);setResearchError('');setAutoResearch(null);
    try{
      const response=await fetch('/api/auto-research?bbox='+encodeURIComponent(bbox.join(',')),{headers:{'x-geominer-admin-code':adminCode}});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Los servicios geológicos no respondieron.');
      setAutoResearch(payload);setAiText('');setAiUsage(null);
    }catch(err){setResearchError(err.message||'Error consultando fuentes geológicas');}
    finally{setResearchBusy(false);}
  }
  function clearSpectral() {
    abortAnalysis.current?.abort();
    setGeologistQuestion('');setAutoResearch(null);setResearchBusy(false);setResearchError('');
    setCompareOutput(null);setCompareSceneId('');setCompareError('');setCompareLoading(false);setNoteText('');
    setControlResult(null);setControlBusy(false);setControlError('');setSpectralView('indices');
    setAnalysisResult(null);setHeatmapUrl(null);setAnalysisScenes(null);setAnalysisScene(null);setSelectedZoneId(null);
    setAnalysisError('');setAnalysisMessage('');setAiText('');setAiUsage(null);setAiError('');
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const instance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': { type:'raster', tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize:256, attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>', maxzoom:19 },
          'satellite-2016': { type:'raster', tiles:['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'], tileSize:256, maxzoom:13, attribution:'Sentinel-2 cloudless 2016 — EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), CC BY 4.0' },
          'terrain-mapzen': { type:'raster-dem', tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding:'terrarium',tileSize:256,maxzoom:14,attribution:'Relieve DEM Mapzen / AWS Open Data; créditos a fuentes de elevación originales' },
          'geology-geobolivia': {type:'raster',tiles:['https://geo.gob.bo/geoserver/sergeotecmin/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=sergeotecmin%3AGeologia&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=true&SRS=EPSG%3A3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],tileSize:256,attribution:'Mapa geológico nacional © SERGEOMIN / GeoBolivia (escala general; consultar fuente)'},
          'faults-geobolivia': {type:'raster',tiles:['https://geo.gob.bo/geoserver/sergeotecmin/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=sergeotecmin%3AFallas&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=true&SRS=EPSG%3A3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],tileSize:256,attribution:'Fallas regionales © SERGEOMIN / GeoBolivia (escala general)'}
        },
        layers: [
          { id:'base', type:'raster', source:'osm' },
          { id:'satellite-2016-layer', type:'raster', source:'satellite-2016', layout:{visibility:'none'} },
          { id:'terrain-hillshade',type:'hillshade',source:'terrain-mapzen',layout:{visibility:'none'},paint:{'hillshade-exaggeration':0.35} },
          { id:'geology-map-layer',type:'raster',source:'geology-geobolivia',layout:{visibility:'none'},paint:{'raster-opacity':0.68} },
          { id:'faults-map-layer',type:'raster',source:'faults-geobolivia',layout:{visibility:'none'},paint:{'raster-opacity':0.90} }
        ]
      },
      center: [-64.7,-16.7],
      zoom: 5,
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
        setCity('Área en mapa');setScenes(null);
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

  useEffect(()=>{
    const instance=map.current;if(!instance)return;
    const display=()=>{
      for(const [layer,visible] of [['terrain-hillshade',showRelief],['geology-map-layer',showGeology],['faults-map-layer',showFaults]]){
        if(instance.getLayer(layer))instance.setLayoutProperty(layer,'visibility',visible?'visible':'none');
      }
    };
    if(instance.isStyleLoaded())display();else instance.once('load',display);
  },[showRelief,showGeology,showFaults]);

  // Capas vectoriales oficiales consultadas para este terreno; no se crean unidades artificiales.
  useEffect(()=>{
    const instance=map.current;if(!instance)return;
    const update=()=>{
      const shapes=[
        ['auto-geo-units','geology','fill','#b88649'],
        ['auto-geo-faults','faults','line','#d82c38'],
        ['auto-geo-anticlines','anticlines','line','#4b68a2'],
        ['auto-geo-synclines','synclines','line','#7953a3']
      ];
      for(const [id,key,type,color] of shapes){
        const data=autoResearch?.services?.[key]?.features||{type:'FeatureCollection',features:[]};
        if(!instance.getSource(id)){
          instance.addSource(id,{type:'geojson',data});
          instance.addLayer({id,type,source:id,paint:type==='fill'?{'fill-color':['coalesce',['get','geominerColor'],color],'fill-opacity':0.43,'fill-outline-color':color}:{'line-color':color,'line-width':2.2,'line-opacity':0.85}},instance.getLayer('area-border')?'area-border':undefined);
        }else instance.getSource(id).setData(data);
      }
    };
    if(instance.isStyleLoaded())update();else instance.once('load',update);
  },[autoResearch]);

  // Geo-referenciamos aproximadamente la cuadrícula del análisis en el terreno elegido.
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
      instance.addLayer({id:'spectral-overlay',type:'raster',source:'spectral-overlay',paint:{'raster-opacity':heatOpacity}},'area-border');
    };
    if(instance.isStyleLoaded())apply();else instance.once('load',apply);
  },[heatmapUrl,bbox]);

  useEffect(()=>{
    const instance=map.current;
    if(instance?.getLayer('spectral-overlay')) instance.setPaintProperty('spectral-overlay','raster-opacity',heatOpacity);
  },[heatOpacity,heatmapUrl]);

  useEffect(()=>{
    if(!analysisResult)return;
    const selected=analysisResult[indicator];
    const stats=statsFor(selected);
    const canvas=document.createElement('canvas');
    canvas.width=analysisResult.width;canvas.height=analysisResult.height;
    const ctx=canvas.getContext('2d');
    const pixels=spectralView==='falsecolor'?falseColorRGBA(analysisResult):rasterRGBA(selected,stats,indicator);
    ctx.putImageData(new ImageData(pixels,canvas.width,canvas.height),0,0);
    setHeatmapUrl(canvas.toDataURL('image/png'));
  },[analysisResult,indicator,spectralView]);

  // Marcadores interactivos para grupos CONTIGUOS de respuesta >=P90.
  // No se infiere un yacimiento; el punto corresponde al centro del píxel de índice máximo.
  useEffect(()=>{
    const instance=map.current;
    if(!instance)return;
    const clean=()=>{zoneMarkers.current.forEach(marker=>marker.remove());zoneMarkers.current=[];};
    clean();
    if(!showZoneMarkers || !zones.length || !analysisResult)return clean;
    for(const zone of zones){
      const button=document.createElement('button');
      button.type='button';
      const check=preparedReport?.decision?.zones?.find(z=>z.kind===indicator&&z.number===zone.number);
      button.className='anomaly-map-marker '+(indicator==='iron'?'iron':'swir')+(zone.id===selectedZoneId?' chosen':'')+(check?.priority==='Alta'?' evidence-high':'');
      button.textContent=String(zone.number);
      button.title='Sector '+zone.number+' · índice '+zone.peakRatio+' · Lat '+zone.lat+', Lon '+zone.lon;
      button.setAttribute('aria-label',button.title);
      button.addEventListener('click',e=>{
        e.stopPropagation();
        setSelectedZoneId(zone.id);setActiveTab('anomalies');
        instance.flyTo({center:[zone.lon,zone.lat],zoom:Math.max(instance.getZoom(),12.5),duration:500});
      });
      zoneMarkers.current.push(new maplibregl.Marker({element:button,anchor:'center'}).setLngLat([zone.lon,zone.lat]).addTo(instance));
    }
    return clean;
  },[zones,indicator,selectedZoneId,showZoneMarkers,analysisResult,preparedReport]);

  function focusZone(zone){
    setSelectedZoneId(zone.id);setActiveTab('anomalies');
    map.current?.flyTo({center:[zone.lon,zone.lat],zoom:Math.max(map.current.getZoom(),12.5),duration:500});
  }
  function downloadZones(){
    if(!analysisResult||!bbox)return;
    const content=JSON.stringify(zonesToGeoJSON(zones,{sceneId:analysisScene?.id||'',kind:indicator}),null,2);
    const blob=new Blob([content],{type:'application/geo+json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='geominer-sectores-'+indicator+'.geojson';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function copyZone(zone){
    if(!navigator.clipboard){setAnalysisError('El navegador no permite copiar aquí. Selecciona las coordenadas mostradas.');return;}
    navigator.clipboard.writeText(zone.lat+', '+zone.lon).catch(()=>setAnalysisError('No se pudieron copiar las coordenadas.'));
  }

  async function findAnalysisScenes() {
    if(!bbox||area>25.01||area<0.01){setAnalysisError('Para el análisis selecciona una zona de 0,01 a 25 km².');return;}
    setAnalysisBusy(true);setAnalysisError('');setAnalysisScenes(null);setAnalysisScene(null);setSelectedZoneId(null);setAiText('');setAiUsage(null);setAiError('');
    setAnalysisResult(null);setHeatmapUrl(null);setSelectedZoneId(null);setCompareOutput(null);setCompareSceneId('');setCompareError('');setControlResult(null);setControlError('');
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
    setAnalysisBusy(true);setAnalysisError('');setAnalysisResult(null);setHeatmapUrl(null);setSelectedZoneId(null);setCompareOutput(null);setCompareError('');setAiText('');setAiUsage(null);setAiError('');
    try {
      const result=await analyseScene(analysisScene,bbox,{resolutionMeters,onProgress:setAnalysisMessage,signal:controller.signal});
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

  async function processSecondScene(){
    if(!analysisResult||!analysisScene||!bbox||!analysisScenes?.scenes?.length)return;
    const second=analysisScenes.scenes.find(x=>x.id===compareSceneId);
    if(!second||second.id===analysisScene.id){setCompareError('Selecciona una escena distinta a la primera.');return;}
    setCompareLoading(true);setCompareError('');setCompareOutput(null);
    const controller=new AbortController();abortAnalysis.current=controller;
    try {
      const result=await analyseScene(second,bbox,{resolutionMeters,signal:controller.signal,onProgress:setAnalysisMessage});
      if(result.valid<10)throw new Error('La segunda escena tiene menos de 10 píxeles útiles. Prueba otra fecha.');
      setCompareOutput({scene:second,result});
    }catch(err){setCompareError(err?.message||'Error leyendo segunda escena.');}
    finally{if(abortAnalysis.current===controller)abortAnalysis.current=null;setCompareLoading(false);}
  }
  async function processControlArea(){
    if(!analysisResult||!analysisScene||!bbox||controlBusy)return;
    setControlBusy(true);setControlError('');setControlResult(null);setAiText('');
    const testBbox=neighbouringBbox(bbox,controlDirection);
    const controller=new AbortController();abortAnalysis.current=controller;
    try{
      const result=await analyseScene(analysisScene,testBbox,{resolutionMeters,signal:controller.signal,onProgress:setAnalysisMessage});
      if(result.valid<10)throw new Error('El área vecina no tiene suficientes píxeles útiles en este COG. Prueba otra dirección o escena.');
      setControlResult({direction:controlDirection,bbox:testBbox,result});
    }catch(err){setControlError(err?.message||'No se pudo procesar el área de comparación.');}
    finally{if(abortAnalysis.current===controller)abortAnalysis.current=null;setControlBusy(false);}
  }
  function saveFieldObservation(){
    if(!selectedZone||!analysisScene||!bbox)return;
    try{
      const item=normalizeFieldNote({bbox,sceneId:analysisScene.id,indicator,zone:selectedZone,status:noteStatus,notes:noteText});
      const next=[item,...fieldLog.filter(x=>x.key!==item.key)].slice(0,100);
      localStorage.setItem('geominer-field-log-v07',JSON.stringify(next));setFieldLog(next);setNoteText('');
    }catch(err){setCompareError(err?.message||'No se pudo registrar la anotación.');}
  }
  function exportPilotEvidence(){
    if(!bbox||!analysisScene)return;
    const data=exportValidationBundle({bbox,sceneId:analysisScene.id,comparison:temporalComparison?{
      firstScene:analysisScene.id,secondScene:compareOutput.scene.id,
      acquired1:analysisScene.date,acquired2:compareOutput.scene.date,...temporalComparison
    }:null,notes:activeAreaNotes});
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='GeoMiner_evidencia_area_GPS.json';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function makeAiThumbnail(){
    if(!analysisResult?.spectral)return null;
    const source=document.createElement('canvas');source.width=analysisResult.width;source.height=analysisResult.height;
    source.getContext('2d').putImageData(new ImageData(falseColorRGBA(analysisResult),source.width,source.height),0,0);
    const thumb=document.createElement('canvas');thumb.width=128;thumb.height=128;
    const ctx=thumb.getContext('2d');ctx.fillStyle='#101e28';ctx.fillRect(0,0,128,128);ctx.drawImage(source,0,0,128,128);
    const preview=thumb.toDataURL('image/jpeg',0.68);
    if(preview.length>80000)throw new Error('Miniatura demasiado grande; prueba sin imagen.');
    return preview;
  }
  async function uploadStudyPlates(event){
    const files=Array.from(event.target.files||[]);event.target.value='';setPlateError('');
    if(!bbox){setPlateError('Selecciona primero el área GPS de estas láminas.');return;}
    if(files.length+activePlates.length>6){setPlateError('Máximo 6 láminas por área. Elimina alguna antes de agregar otras.');return;}
    const imported=[];
    try{
      for(const file of files){
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)
          throw new Error('Utiliza imágenes PNG/JPEG/WebP de hasta 8 MB cada una.');
        const src=URL.createObjectURL(file);
        try{
          const im=await new Promise((resolve,reject)=>{const image=new window.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('No se pudo leer '+file.name));image.src=src;});
          const canvas=document.createElement('canvas');const scale=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight));
          canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));
          canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);
          const imageData=canvas.toDataURL('image/jpeg',0.82);
          const preview=document.createElement('canvas');const factor=Math.min(1,700/Math.max(im.naturalWidth,im.naturalHeight));
          preview.width=Math.max(1,Math.round(im.naturalWidth*factor));preview.height=Math.max(1,Math.round(im.naturalHeight*factor));
          preview.getContext('2d').drawImage(im,0,0,preview.width,preview.height);
          let aiImageData=preview.toDataURL('image/jpeg',0.55);
          if(aiImageData.length>110000){
            const tiny=document.createElement('canvas');const t=Math.min(1,480/Math.max(im.naturalWidth,im.naturalHeight));
            tiny.width=Math.max(1,Math.round(im.naturalWidth*t));tiny.height=Math.max(1,Math.round(im.naturalHeight*t));
            tiny.getContext('2d').drawImage(im,0,0,tiny.width,tiny.height);aiImageData=tiny.toDataURL('image/jpeg',0.48);
          }
          imported.push({id:Date.now()+'-'+Math.random().toString(36).slice(2,8),areaKey:areaEvidenceKey(bbox),
            kind:'mapa',title:file.name.slice(0,130),source:'',scale:'',notes:'',imageData,aiImageData,
            width:canvas.width,height:canvas.height,selectedForAi:false});
        }finally{URL.revokeObjectURL(src);}
      }
      setGeologyPlates(prev=>[...prev,...imported]);setAiText('');
    }catch(err){setPlateError(err.message||'No se pudieron cargar las láminas.');}
  }
  function changePlate(id,patch){
    if(patch.selectedForAi===true&&activePlates.filter(p=>p.selectedForAi).length>=2){setPlateError('Selecciona como máximo dos láminas para OpenAI. Desmarca una antes de continuar.');return;}
    setPlateError('');setGeologyPlates(prev=>prev.map(p=>p.id===id?{...p,...patch}:p));setAiText('');
  }
  function removePlate(id){setGeologyPlates(prev=>prev.filter(p=>p.id!==id));setAiText('');}
  function addGeologyEvidence(){
    setGeoEvidenceError('');
    if(!bbox){setGeoEvidenceError('Selecciona antes el terreno del documento.');return;}
    if(geoEvidenceDescription.trim().length<12||geoEvidenceSource.trim().length<5){
      setGeoEvidenceError('Escribe un antecedente de al menos 12 caracteres y su fuente identificable.');return;
    }
    const entry={id:Date.now()+'-'+Math.random().toString(36).slice(2,6),areaKey:areaEvidenceKey(bbox),
      type:geoEvidenceType,description:geoEvidenceDescription.trim().slice(0,450),source:geoEvidenceSource.trim().slice(0,220),
      sector:geoEvidenceSector?Number(geoEvidenceSector):null,createdAt:new Date().toISOString()};
    const next=[entry,...geologyEvidence].slice(0,40);
    try{localStorage.setItem('geominer-geology-sources-v10',JSON.stringify(next));setGeologyEvidence(next);
      setGeoEvidenceDescription('');setGeoEvidenceSource('');setGeoEvidenceSector('');setAiText('');setAiUsage(null);
    }catch{setGeoEvidenceError('No fue posible guardar en este navegador.');}
  }
  function removeGeologyEvidence(id){
    const next=geologyEvidence.filter(x=>x.id!==id);
    try{localStorage.setItem('geominer-geology-sources-v10',JSON.stringify(next));setGeologyEvidence(next);setAiText('');setAiUsage(null);}catch{setGeoEvidenceError('No se pudo actualizar el registro.');}
  }
  async function generateAiReport() {
    if (!preparedReport || aiBusy) return;
    if (!adminCode.trim()) {setAiError('Ingresa el código privado de GeoMiner configurado en Vercel.');return;}
    setAiBusy(true);setAiError('');setAiText('');setAiUsage(null);
    try {
      const response=await fetch('/api/ai-report',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-geominer-admin-code':adminCode},
        body:JSON.stringify({report:preparedReport,autoResearch:autoResearch?{services:Object.fromEntries(Object.entries(autoResearch.services).map(([k,v])=>[k,{status:v.status,count:v.count,items:v.items,properties:v.features?.features?.slice(0,12).map(f=>f.properties)}])),queriedAt:autoResearch.queriedAt}:null,preview:aiPreview?makeAiThumbnail():null,question:geologistQuestion.trim(),userEvidence:activeGeologyEvidence,geoMatches,geologyPlates:studyManifest.plates,geologyImages:activePlates.filter(p=>p.selectedForAi).slice(0,2).map(p=>({kind:p.kind,title:p.title,source:p.source,image:p.aiImageData}))})
      });
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Error conectando con OpenAI.');
      setAiText(payload.text||'');setAiUsage(payload.usage||null);
    }catch(err){setAiError(err?.message||'No se pudo generar la interpretación.');}
    finally{setAiBusy(false);setAdminCode('');}
  }
  function downloadPdf() {
    if(!preparedReport)return;
    try{downloadReportPdf(preparedReport,{aiText,heatmapUrl,indicator,validation:temporalComparison?{firstDate:analysisScene?.date,secondDate:compareOutput?.scene?.date,...temporalComparison}:null,fieldNotes:activeAreaNotes,geologyEvidence:activeGeologyEvidence,geoMatches,autoResearch,autoGeoMatches,studyPlates:activePlates,studyManifest,geologyMapPng:activeGeoMap?createGeologyMapImage(activeGeoMap,bbox,geoMatches):null,autoGeologyMapPng:autoGeoMap?.features?.length?createGeologyMapImage(autoGeoMap,bbox,autoGeoMatches,{origin:'public'}):null});setAiError('');}
    catch(err){setAiError('No se pudo generar el PDF: '+(err?.message||'error desconocido'));}
  }
  function useGPS() {
    try {
      if(!gpsLat.trim() || !gpsLon.trim())throw new Error('Escribe latitud y longitud antes de seleccionar el terreno.');
      const b = squareFromCenter(gpsLon,gpsLat,gpsSide);
      firstCorner.current=null; setStartPoint(null); clearSpectral(); setBbox(b); setScenes(null); setError('');
      setCity('Área GPS');setActiveTab('analysis');
      map.current?.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:80,maxZoom:14,duration:650});
      setMobilePanel(false);
    } catch (err) { setError(err.message); setActiveTab('analysis'); }
  }
  function downloadSectorCsv(){
    if(!preparedReport)return;
    const csv=sectorCsv(preparedReport);
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='GeoMiner_sectores_coordenadas.csv';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
    reset();
    setCity(c.name);
    map.current?.flyTo({center:c.coords,zoom:c.zoom,essential:true});
  }
  function reset() {
    firstCorner.current=null; setStartPoint(null); clearSpectral(); setBbox(null); setScenes(null); setError('');
  }
  function restore(item) {
    reset();
    setCity('Área GPS');
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
          <div className="section-cap">COORDENADAS DEL ESTUDIO</div>

          <div className="sidebar-card gps-card">
            <div className="caption-label"><LocateFixed size={15}/> Buscar área por coordenadas</div>
            <label className="gps-paste">Pega latitud, longitud (WGS84)
              <input type="text" value={gpsPairText} onChange={e=>{const v=e.target.value;setGpsPairText(v);setError('');try{const {lat,lon}=parseGpsPair(v);setGpsLat(String(lat));setGpsLon(String(lon));}catch{if(v.trim()){setGpsLat('');setGpsLon('');}}}} placeholder="Ej.: -17.7800, -63.1800"/>
            </label>
            <div className="gps-fields">
              <label>Latitud <input type="number" step="any" value={gpsLat} onChange={e=>setGpsLat(e.target.value)} /></label>
              <label>Longitud <input type="number" step="any" value={gpsLon} onChange={e=>setGpsLon(e.target.value)} /></label>
            </div>
            <div className="gps-actions"><label>Lado del terreno
              <select value={gpsSide} onChange={e=>setGpsSide(e.target.value)}><option value="1">1 km</option><option value="2">2 km</option><option value="3">3 km</option><option value="5">5 km</option></select>
            </label><button onClick={useGPS}><LocateFixed size={15}/> Ubicar área</button></div>
            {error&&<div role="alert" className="gps-error">{error}</div>}
          </div>
          <div className="sidebar-card faint">
            <div className="caption-label"><ScanLine size={15}/> Área seleccionada</div>
            <div className="area-value">{bbox?fmt(area):'0'} <span>km²</span></div>
            <div className="area-sub">{startPoint?'Primera esquina marcada: selecciona la segunda.':bbox?'Terreno delimitado correctamente.':'Sin área seleccionada'}</div>
            {bbox&&<div className="coords-mini">{bbox.map(n=>n.toFixed(4)).join(' · ')}</div>}
            <details className="secondary-tools"><summary>Opciones de área</summary>
              {bbox&&<div className="export-actions"><button onClick={()=>downloadArea('geojson')}><Download size={14}/> GeoJSON</button><button onClick={()=>downloadArea('kml')}><Download size={14}/> KML</button></div>}
              <div className="actions-inline"><button onClick={reset} className="ghost-btn" disabled={!bbox&&!startPoint}><RefreshCcw size={14}/> Limpiar</button><button onClick={saveArea} className="ghost-btn" disabled={!bbox}><BookmarkPlus size={14}/> Guardar</button></div>
              <button type="button" className="ghost-btn secondary-full" onClick={()=>{setActiveTab('saved');setMobilePanel(false);}}>Áreas guardadas ({saved.length})</button>
            </details>
          </div>
          <div className="limit-note"><Info size={14}/><span>Hasta 25 km² para análisis multiespectral gratuito. Los índices no identifican yacimientos.</span></div>
        </div>
        <div className="sidebar-foot"><span className="live-dot"/> GeoMiner v1.3 <span className="foot-right">PROTOTIPO</span></div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-toggle" aria-label="Abrir menú" onClick={()=>setMobilePanel(true)}><Menu size={20}/></button>
            <div><div className="top-eyebrow">INICIO / EXPLORADOR</div><h1>Exploración satelital</h1></div>
          </div>
          <div className="topbar-meta">
            <span className="state-pill"><span className="live-dot"/> Catálogo Copernicus</span>
            <span className="v-tag">Beta 1.2</span>
          </div>
        </header>
        <section className="work-area">
          <div className="map-column">
            <div className="map-title"><div><strong>Mapa de exploración</strong><span>Bolivia · Cartografía, Sentinel-2 histórico e índices espectrales · Área GPS elegida por ti</span></div>
              <div className="map-tools"><div className="layer-switch"><button className={baseLayer==='streets'?'active':''} onClick={()=>setBaseLayer('streets')}><Map size={14}/> Mapa</button><button className={baseLayer==='historical'?'active':''} onClick={()=>setBaseLayer('historical')}><Satellite size={14}/> Satélite 2016</button></div><button className="small-square" title="Vista general de Bolivia" onClick={()=>map.current?.flyTo({center:[-64.7,-16.7],zoom:5,essential:true})}><Navigation size={17}/></button></div>
            </div>
            <div className="map-wrap">
              <div ref={mapContainer} className="map"/>
              <div className="map-tip"><Crosshair size={16}/><span>{startPoint?'Selecciona la segunda esquina':bbox?'Área delimitada · puedes consultar escenas':'Dos clics para delimitar tu terreno'}</span></div>
              <div className="map-legend"><span className="legend-swatch"/> Área seleccionada</div>
              {baseLayer==='historical'&&<div className="map-history-warning">Mosaico Sentinel-2 de 2016 · Imagen de referencia histórica.</div>}
              {analysisResult&&<div className="map-spectral-warning">{spectralView==='falsecolor'?'Falso color B11/B8/B4':INDICATORS[indicator].formula} · Respuesta relativa de superficie · {dateStr(analysisScene?.date)} · NO es mineral confirmado.</div>}
              {analysisResult&&zones.length>0&&<div className="anomaly-map-count">{zones.length} sectores P90+ · {INDICATORS[indicator].formula} · <button type="button" onClick={()=>setActiveTab('anomalies')}>Inspeccionar</button></div>}
              {cursor&&<div className="coordinates">LAT {cursor[0]} · LON {cursor[1]}</div>}
            </div>
            <details className="map-layer-controls secondary-tools"><summary>Capas de referencia (relieve, geología y fallas)</summary><label><input type="checkbox" checked={showRelief} onChange={e=>setShowRelief(e.target.checked)}/> Relieve DEM</label><label><input type="checkbox" checked={showGeology} onChange={e=>setShowGeology(e.target.checked)}/> Geología (WMS)</label><label><input type="checkbox" checked={showFaults} onChange={e=>setShowFaults(e.target.checked)}/> Fallas regionales</label><small>Capas cartográficas externas, no validadas por GeoMiner. Si el servidor WMS falla, desactívalas. Geología nacional a escala general.</small></details>
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
              <button onClick={()=>setActiveTab('analysis')} className={activeTab==='analysis'?'selected':''}>Análisis</button>
              <button onClick={()=>setActiveTab('geology')} className={activeTab==='geology'?'selected':''}>Estudio geológico</button>
              <button onClick={()=>setActiveTab('anomalies')} className={activeTab==='anomalies'?'selected':''}>Sectores</button>
              <button onClick={()=>setActiveTab('report')} className={activeTab==='report'?'selected':''}>Informe</button>
            </div>
            <details className="inspector-secondary secondary-tools"><summary>Herramientas adicionales</summary>
              <button type="button" onClick={()=>setActiveTab('validation')}>Comparar fechas y terreno vecino</button>
              <button type="button" onClick={()=>setActiveTab('saved')}>Áreas guardadas ({saved.length})</button>
            </details>
            {activeTab==='geology' ? (
              <div className="panel-inner pilot-geology">
                <div className="pilot-heading"><Mountain size={22}/><div><strong>Geología de la ubicación seleccionada</strong><p>Cualquier región de Bolivia: coordenadas, bandas espectrales y mapas que incorpores</p></div></div>
                <div className="pilot-context-status">{bbox?`Zona de trabajo (O, S, E, N): ${bbox.map(v=>v.toFixed(5)).join(', ')}`:'Primero ingresa coordenadas GPS o delimita un área en el mapa.'}</div>
                <p>GeoMiner permite explorar respuestas superficiales por coordenadas, contrastar dos fechas y estudiar la litología de cada sector cuando exista cartografía georreferenciada. <strong>No necesita estar cerca de una mina conocida.</strong></p>
                <div className="auto-investigation">
                  <h3>Investigación automática por coordenadas</h3>
                  <p>Consulta unidades geológicas, fallas, pliegues, relieve y disponibilidad de EnMAP/EMIT en fuentes públicas. Sin documentos que tengas que subir.</p>
                  <label htmlFor="geo-research-code">Código privado de acceso</label><input id="geo-research-code" type="password" autoComplete="off" value={adminCode} onChange={e=>setAdminCode(e.target.value)} placeholder="El mismo código de los informes IA"/>
                  <button type="button" className="run-btn" disabled={!bbox||researchBusy||area>25.02} onClick={investigateArea}>{researchBusy?'Consultando servicios…':'Investigar esta zona automáticamente'}</button>
                  {researchError&&<p className="error-box" role="alert">{researchError}</p>}
                  {autoResearch&&<div className="auto-research-results">
                    <p className="auto-research-date">Consulta: {new Date(autoResearch.queriedAt).toLocaleString('es-BO')}</p>
                    {[['geology','Unidades geológicas'],['faults','Fallas'],['anticlines','Anticlinales'],['synclines','Sinclinales'],['enmap','EnMAP hiperespectral'],['emit','NASA EMIT'],['relief','Perfil topográfico']].map(([key,label])=>{
                      const entry=autoResearch.services[key];return <div key={key} className="auto-source-item"><strong>{label}</strong><span>{entry.status==='ok'?((entry.count??(entry.points?.length||0))+' registros consultados'):'Servicio no disponible'}</span>{entry.error&&<small>{entry.error}</small>}</div>;
                    })}
                    {autoResearch.services.geology?.status==='ok'&&<div className="geologist-import-result"><strong>Mapa geológico público consultado</strong><p>{autoResearch.services.geology.count} entidades devueltas; sus polígonos se muestran sobre el mapa. Fuente: GeoBolivia / SERGEOTECMIN, escala regional.</p>{autoResearch.services.geology.features?.features?.slice(0,12).map((f,i)=><p key={i}>{Object.entries(f.properties||{}).slice(0,4).map(([k,v])=>`${k}: ${v}`).join(' · ')||'Unidad sin atributos descriptivos'}</p>)}{autoGeoMatches.length>0&&<p><strong>{autoGeoMatches.length}</strong> cruces aproximados con sectores calculados; verificar escala y posición.</p>}</div>}
                    {autoResearch.services.relief?.status==='ok'&&<div className="auto-profile"><strong>Perfil topográfico oeste–este (SRTM ≈90 m)</strong><svg viewBox="0 0 340 125" role="img" aria-label="Perfil de elevaciones aproximadas"><path d={(()=>{const pts=autoResearch.services.relief.points;const min=autoResearch.services.relief.minMeters;const range=Math.max(1,autoResearch.services.relief.maxMeters-min);return pts.filter(p=>p.elevation!=null).map((p,i)=>(i===0?'M':'L')+' '+(12+p.position*315).toFixed(2)+' '+(110-(p.elevation-min)/range*92).toFixed(2)).join(' ')})()} fill="none" stroke="#128773" strokeWidth="2.5"/><path d="M 12 110 L 328 110" stroke="#78929b" strokeWidth="1"/></svg><small>Altitud: {autoResearch.services.relief.minMeters}–{autoResearch.services.relief.maxMeters} m. Es un perfil del relieve, no un corte de rocas subterráneas.</small></div>}
                    {autoResearch.services.enmap?.items?.length>0&&<details><summary>Escenas EnMAP encontradas ({autoResearch.services.enmap.count})</summary>{autoResearch.services.enmap.items.map(x=><p key={x.id}>{x.date||'Fecha desconocida'} · {x.id}</p>)}</details>}
                    {autoResearch.services.emit?.items?.length>0&&<details><summary>Escenas EMIT encontradas ({autoResearch.services.emit.count})</summary>{autoResearch.services.emit.items.map(x=><p key={x.id}>{x.date||'Fecha desconocida'} · {x.title}</p>)}</details>}
                    <small>La búsqueda de escenas no implica que ya se hayan descargado o procesado datos hiperespectrales. Una consulta sin resultados tampoco demuestra ausencia de cobertura histórica.</small>
                  </div>}
                </div>
                <details className="secondary-tools"><summary>Documentación adicional (opcional)</summary>
                <p>Solo si tienes información especializada georreferenciada que no aparece en los catálogos públicos, puedes adjuntarla como fuente adicional.</p>
                <div className="study-plates">
                  <h3>Expediente geológico documental</h3>
                  <p>Adjunta hasta 6 láminas del área GPS: mapa, travesías, ocurrencias, perfiles, columna estratigráfica o simbología. Se incluirán como anexos en el PDF. <strong>Las imágenes no se georreferencian automáticamente</strong>; su escala y fuente deben registrarse.</p>
                  <label className="study-upload">Adjuntar láminas JPG / PNG / WebP
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadStudyPlates}/>
                  </label>
                  {plateError&&<p role="alert" className="error-box">{plateError}</p>}
                  {activePlates.map(p=><article className="study-plate-item" key={p.id}>
                    <img src={p.imageData} alt={'Lámina aportada: '+p.title}/>
                    <div className="study-plate-fields">
                      <select aria-label="Tipo de lámina" value={p.kind} onChange={e=>changePlate(p.id,{kind:e.target.value})}>{GEO_PLATE_TYPES.map(t=><option value={t.id} key={t.id}>{t.label}</option>)}</select>
                      <input aria-label="Título" value={p.title} maxLength={130} onChange={e=>changePlate(p.id,{title:e.target.value})} placeholder="Título de la lámina"/>
                      <input aria-label="Fuente de la lámina" value={p.source} maxLength={180} onChange={e=>changePlate(p.id,{source:e.target.value})} placeholder="Fuente / institución / año (obligatorio para citar)"/>
                      <input aria-label="Escala de la lámina" value={p.scale} maxLength={50} onChange={e=>changePlate(p.id,{scale:e.target.value})} placeholder="Escala, p. ej. 1:100.000"/>
                      <textarea aria-label="Observaciones de la lámina" value={p.notes} maxLength={450} rows={2} onChange={e=>changePlate(p.id,{notes:e.target.value})} placeholder="Descripción o unidades visibles; solo datos respaldados por la imagen"/>
                      <label className="study-ai-optin"><input type="checkbox" checked={p.selectedForAi} onChange={e=>changePlate(p.id,{selectedForAi:e.target.checked})}/> Enviar esta lámina a OpenAI (máx. 2, con costo de visión)</label>
                      <button type="button" className="study-remove" onClick={()=>removePlate(p.id)}>Quitar lámina</button>
                    </div>
                  </article>)}
                  <div className="study-progress"><strong>Secciones del expediente</strong>
                    {studyManifest.sections.map(sec=><div key={sec.id}><span>{sec.title}</span><small>{sec.status}</small></div>)}
                  </div>
                  <small>Los archivos permanecen en esta pestaña del navegador y no se guardan en la nube. Solo se remiten a OpenAI las láminas que marques para su revisión visual.</small>
                </div>
                <div className="geologist-geospatial">
                  <h3>Importar carta geológica con polígonos GeoJSON</h3>
                  <p>Exporta desde QGIS o tu fuente autorizada en <strong>WGS84 / EPSG:4326</strong> (longitud, latitud). GeoMiner superpondrá los polígonos en el mapa y los cruzará con el centro de cada sector para leer unidad, formación o litología. Tamaño máximo 3 MB; esta capa no se sincroniza ni se sube al servidor.</p>
                  <input type="file" accept=".geojson,.json,application/geo+json,application/json" aria-label="Cargar GeoJSON geológico local" onChange={uploadGeologyGeoJSON}/>
                  {importGeoError&&<p className="error-box" role="alert">{importGeoError}</p>}
                  {activeGeoMap&&<div className="geologist-import-result"><strong>Capa importada: {importedGeoSource}</strong><p>{activeGeoMap.features.length} polígonos · {geoMatches.length} sectores intersectados en el análisis actual</p><button type="button" className="spectral-export" onClick={()=>{setImportedGeoMap(null);setImportedGeoAreaKey('');setImportedGeoSource('');setAiText('');}}>Quitar capa</button>{geoMatches.slice(0,12).map(m=><p key={m.kind+'-'+m.number}>{m.kind==='iron'?'F':'S'}-{m.number}: <strong>{m.unit}</strong> · {m.lithology}</p>)}<small>Procedencia y precisión no verificadas. Una unidad geológica no equivale a mena.</small></div>}
                </div>
                <details className="geology-evidence-entry secondary-tools"><summary>Registrar observaciones, muestras y referencias documentales</summary>
                  <h3>Añadir antecedentes, observaciones y referencias de muestras</h3>
                  <p>Registra documentos existentes que tú aportas. Quedan guardados solamente en ESTE navegador y se enviarán a OpenAI cuando generes una consulta. No se autentican automáticamente.</p>
                  <label htmlFor="geo-evidence-type">Tipo de antecedente</label>
                  <select id="geo-evidence-type" value={geoEvidenceType} onChange={e=>setGeoEvidenceType(e.target.value)}>{USER_EVIDENCE_TYPES.map(t=><option key={t} value={t}>{({mapa_geologico:'Carta o informe geológico',registro_muestra:'Registro de muestra / laboratorio',observacion:'Observación de superficie',informe_tercero:'Informe técnico de tercero'})[t]}</option>)}</select>
                  <label htmlFor="geo-evidence-sector">Sector aproximado (opcional)</label>
                  <select id="geo-evidence-sector" value={geoEvidenceSector} onChange={e=>setGeoEvidenceSector(e.target.value)}><option value="">Área general, sin sector</option>{Array.from({length:25},(_,i)=>i+1).map(n=><option key={n} value={n}>Sector {n} (referencia; comprobar índice)</option>)}</select>
                  <label htmlFor="geo-evidence-source">Fuente, documento o laboratorio</label>
                  <input id="geo-evidence-source" value={geoEvidenceSource} maxLength={220} onChange={e=>setGeoEvidenceSource(e.target.value)} placeholder="Ej.: Informe técnico 2022, página 15"/>
                  <label htmlFor="geo-evidence-desc">Qué indica realmente el documento</label>
                  <textarea id="geo-evidence-desc" rows={3} maxLength={450} value={geoEvidenceDescription} onChange={e=>setGeoEvidenceDescription(e.target.value)} placeholder="Transcribe el dato relevante, método, resultados y unidad si los tienes. No escribas datos supuestos."/>
                  <button type="button" className="spectral-export" onClick={addGeologyEvidence}><BookmarkPlus size={15}/> Guardar antecedente local</button>
                  {geoEvidenceError&&<p role="alert" className="error-box">{geoEvidenceError}</p>}
                  {activeGeologyEvidence.length>0&&<div className="geologist-evidence-list"><strong>{activeGeologyEvidence.length} antecedentes declarados para esta área</strong>{activeGeologyEvidence.map(item=><article key={item.id} className="geologist-fact"><div><strong>{item.source}</strong><button type="button" className="spectral-export" onClick={()=>removeGeologyEvidence(item.id)}><Trash2 size={14}/> Quitar</button></div><p>{item.description}</p><small>{item.type} · {item.sector?'Sector '+item.sector:'Área general'} · Sin auditoría</small></article>)}</div>}
                </details>
                </details>
                <div className="pilot-source-note">Las capas WFS son mapas regionales históricos. La consulta automática no identifica minerales de laboratorio ni permite reconstruir una columna estratigráfica sin datos de edad y formación.</div>
              </div>
            ) : activeTab==='anomalies' ? (
              <div className="panel-inner anomaly-panel">
                <div className="anomaly-intro"><MapPinned size={20}/><div><strong>Sectores de respuesta espectral alta</strong><p>Grupos de al menos 3 píxeles contiguos sobre el P90 de la escena. Son referencias para verificación, NO depósitos detectados.</p></div></div>
                {!analysisResult ? <div className="empty-state compact"><ScanLine size={35} className="muted"/><strong>Procesa primero una escena</strong><p>Busca imágenes en la pestaña Análisis y ejecuta el procesamiento espectral.</p><button type="button" className="report-link" onClick={()=>setActiveTab('analysis')}>Ir a Análisis</button></div>:
                <div className="anomaly-body">
                  <div className="spectral-mode">{Object.entries(INDICATORS).map(([id,meta])=><button type="button" disabled={id==='ferrous'&&!analysisResult.bandsRead?.includes('nir08')||id==='rededge'&&(!analysisResult.bandsRead?.includes('rededge1')||!analysisResult.bandsRead?.includes('rededge3'))} key={id} className={indicator===id?'active':''} onClick={()=>{setIndicator(id);setSelectedZoneId(null);}}>{meta?.formula||INDICATORS[id].formula}</button>)}</div>
                  <div className="anomaly-summary"><span><strong>{zones.length}</strong> sectores agrupados</span><span>P90 ≥ {analysisStats?.p90?.toFixed(3)??'s/d'}</span></div>
                  <label className="anomaly-toggle"><input type="checkbox" checked={showZoneMarkers} onChange={e=>setShowZoneMarkers(e.target.checked)}/> Mostrar marcadores numerados en el mapa</label>
                  <label className="anomaly-opacity">Transparencia de capa: {Math.round(heatOpacity*100)} %<input type="range" min="0.2" max="1" step="0.1" value={heatOpacity} onChange={e=>setHeatOpacity(Number(e.target.value))}/></label>
                  {!zones.length?<p className="anomaly-empty">No hay grupos de al menos 3 píxeles contiguos que cumplan el umbral en esta escena. No significa ausencia de mineral.</p>:
                    <div className="anomaly-list">{zones.map(z=><button type="button" key={z.id} className={'anomaly-item '+(selectedZoneId===z.id?'chosen':'')} onClick={()=>focusZone(z)}>
                      <span className={'anomaly-rank '+indicator}>{z.number}</span><span className="anomaly-item-text"><strong>Sector {z.number} · Índice {z.peakRatio.toFixed(3)}</strong><small>{z.lat.toFixed(6)}, {z.lon.toFixed(6)}</small><small>{z.pixels} píxeles conectados · área aprox. {z.approxAreaKm2.toFixed(3)} km²</small></span><Navigation size={15}/>
                    </button>)}</div>}
                  {selectedZone&&<div className="anomaly-detail"><strong>Sector {selectedZone.number} · Referencia GPS</strong>{preparedReport?.decision?.zones?.filter(d=>d.kind===indicator&&d.number===selectedZone.number).map(d=><div key={d.kind+d.number} className="evidence-zone-hint">Prioridad de revisión: <strong>{d.priority}</strong> · Índice adicional: {d.cooccurrence==='si'?'sí':d.cooccurrence==='no'?'no detectado':'sin datos'} · Segunda fecha: {d.temporal==='si'?'coincide':d.temporal==='no_evaluado'?'sin evaluar':d.temporal==='no'?'no coincide':'sin datos'}</div>)}<div className="anomaly-gps">Latitud: {selectedZone.lat.toFixed(6)}<br/>Longitud: {selectedZone.lon.toFixed(6)}</div><div className="anomaly-metrics">Máximo: {selectedZone.peakRatio.toFixed(4)} · Media: {selectedZone.meanRatio.toFixed(4)} · Umbral P90: {selectedZone.threshold.toFixed(4)}</div><button type="button" className="spectral-export" onClick={()=>copyZone(selectedZone)}><Crosshair size={15}/> Copiar coordenadas</button><a className="spectral-export sector-location-link" href={`https://www.google.com/maps?q=${encodeURIComponent(selectedZone.lat.toFixed(6)+','+selectedZone.lon.toFixed(6))}`} target="_blank" rel="noopener noreferrer"><MapPinned size={15}/> Ver punto en Google Maps</a><button type="button" className="spectral-export" onClick={()=>setActiveTab('validation')}><CheckCircle2 size={15}/> Registrar revisión del sector</button></div>}
                  <button type="button" className="spectral-export anomaly-download" onClick={downloadZones} disabled={!zones.length}><Download size={15}/> Exportar sectores como GeoJSON</button><button type="button" className="spectral-export anomaly-download" onClick={downloadSectorCsv} disabled={!preparedReport?.zones?.iron?.length&&!preparedReport?.zones?.clay?.length}><Download size={15}/> Descargar coordenadas de todos los sectores (CSV)</button>
                  <p className="spectral-footnote">Los puntos corresponden a centros aproximados de celdas del análisis, no a puntos GPS medidos en el terreno. El orden representa respuestas relativas, no calidad del yacimiento. Los cruces cartográficos importados se muestran en Geología GPS.</p>
                </div>}
              </div>
            ) : activeTab==='validation' ? (
              <div className="panel-inner validation-panel">
                <div className="pilot-heading"><CheckCircle2 size={21}/><div><strong>Validación de cualquier terreno</strong><p>Dos fechas y anotaciones de evidencia, sin confirmaciones automáticas.</p></div></div>
                {!analysisResult?<div className="empty-state compact"><ScanLine size={35} className="muted"/><strong>Primero procesa una escena</strong><p>Ve a Análisis, selecciona un terreno y procesa su primera escena.</p><button type="button" className="report-link" onClick={()=>setActiveTab('analysis')}>Ir a Análisis</button></div>:
                <div className="validation-content">
                  <h3>1. Persistencia entre dos fechas</h3>
                  <p>La segunda escena utiliza <strong>la misma cuadrícula geográfica y resolución</strong>. Comparamos la coincidencia de las celdas superiores a P90 en ambas fechas, sin deducir minerales.</p>
                  <div className="validation-scenes"><div><small>Escena inicial</small><strong>{dateStr(analysisScene?.date)}</strong></div><div><small>Escena de comparación</small><select value={compareSceneId} onChange={e=>{setCompareSceneId(e.target.value);setCompareOutput(null);setCompareError('');}}><option value="">Selecciona otra fecha</option>{(analysisScenes?.scenes||[]).filter(x=>x.id!==analysisScene?.id).map(x=><option value={x.id} key={x.id}>{dateStr(x.date)} · nubes {x.cloud}%</option>)}</select></div></div>
                  <button type="button" className="run-btn" onClick={processSecondScene} disabled={compareLoading||analysisBusy||!compareSceneId||!analysisResult}>{compareLoading?<LoaderCircle size={16} className="spin"/>:<Layers3 size={16}/>} {compareLoading?'Procesando segunda escena…':'Comparar las dos escenas'}</button>
                  {compareError&&<div className="error-box"><AlertTriangle size={16}/>{compareError}</div>}
                  {temporalComparison&&<div className="validation-results">
                    <div className="validation-cov"><small>Celdas válidas en ambas escenas</small><strong>{fmt(temporalComparison.grid.sharedValid)} / {fmt(temporalComparison.grid.total)} ({temporalComparison.grid.sharedPct}%)</strong></div>
                    {Object.entries(temporalComparison.metrics).map(([k,m])=><div className="validation-metric" key={k}><small>{k==='iron'?'B4/B2 · Férrica':'B11/B12 · SWIR'}</small><strong>{m.jaccard===null?'Sin coincidencia evaluable':Math.round(m.jaccard*100)+'% de coincidencia Jaccard'}</strong><span>{m.overlapPixels} celdas P90 compartidas · {m.unionPixels} celdas en la unión</span></div>)}
                    <p><strong>Advertencia:</strong> un valor elevado indica persistencia del patrón, no exactitud de detección minera. La exposición del terreno o la minería activa pueden explicar coincidencias.</p>
                  </div>}
                  <h3>2. Área vecina de control (sin etiqueta de mineral)</h3>
                  <p>Se compara la distribución de índices del terreno seleccionado con un cuadro vecino de igual tamaño en la MISMA escena y con la misma resolución. No supone geología equivalente ni demuestra capacidad predictiva.</p>
                  <label>Dirección del cuadro vecino</label><select value={controlDirection} onChange={e=>{setControlDirection(e.target.value);setControlResult(null);setControlError('');}}><option value="W">Oeste</option><option value="E">Este</option><option value="N">Norte</option><option value="S">Sur</option></select>
                  <button type="button" className="run-btn" onClick={processControlArea} disabled={controlBusy||compareLoading||analysisBusy}>{controlBusy?<LoaderCircle className="spin" size={16}/>:<ScanLine size={16}/>} {controlBusy?'Procesando área vecina…':'Comparar con área vecina'}</button>
                  {controlError&&<div className="error-box"><AlertTriangle size={16}/>{controlError}</div>}
                  {controlSummary&&<div className="validation-results"><strong>Contraste descriptivo — {controlResult.direction}</strong>{Object.entries(controlSummary.indices).map(([k,m])=><div className="validation-metric" key={k}><small>{INDICATORS[k].formula}</small><strong>Mediana zona: {m.mainP50?.toFixed(3)??'s/d'} · control: {m.controlP50?.toFixed(3)??'s/d'}</strong><span>Diferencia de medianas: {m.deltaP50??'s/d'} · píxeles válidos {m.validMain}/{m.validControl}</span></div>)}<p>{controlSummary.warning}</p></div>}
                  <h3>3. Registro de revisión de un sector</h3>
                  <p>Selecciona un sector en la pestaña «Sectores». Los registros se guardan <strong>solo en este navegador</strong>, sin firma ni auditoría externa.</p>
                  <div className="validation-selected">{selectedZone?`Sector ${selectedZone.number} · ${INDICATORS[indicator].formula} · ${selectedZone.lat}, ${selectedZone.lon}`:'Aún no seleccionaste un sector'}</div>
                  <label>Estado de revisión</label><select value={noteStatus} onChange={e=>setNoteStatus(e.target.value)}>{FIELD_STATUSES.map(st=><option value={st.value} key={st.value}>{st.label}</option>)}</select>
                  <label>Notas del operador (máx. 500 caracteres)</label><textarea rows={3} maxLength={500} placeholder="Anota fuente, observación remota, referencia de campo y limitaciones. No introduzcas información sensible." value={noteText} onChange={e=>setNoteText(e.target.value)}/>
                  <button type="button" className="spectral-export" disabled={!selectedZone} onClick={saveFieldObservation}><BookmarkPlus size={15}/> Guardar anotación no auditada</button>
                  <p className="pilot-source-note">Registros guardados para esta área y escena: {activeAreaNotes.length}. No equivalen a validación profesional ni certificación geológica.</p>
                  <button type="button" className="spectral-export" onClick={exportPilotEvidence}><Download size={15}/> Exportar expediente JSON de evidencias</button>
                </div>}
              </div>
            ) : activeTab==='report' ? (
              <div className="panel-inner report-panel">
                <div className="report-intro"><FileText size={22}/><div><strong>Informe geológico preliminar</strong><p>Coordenadas, escena utilizada, estadísticas reales, limitaciones y exportación PDF.</p></div></div>
                {!preparedReport ? <div className="empty-state compact"><FileText size={35} className="muted"/><strong>Aún no hay datos calculados</strong><p>Primero abre Análisis y procesa una escena Sentinel-2. No generaremos informes de supuestos minerales sin datos.</p><button className="report-link" onClick={()=>setActiveTab('analysis')}>Ir a Análisis</button></div> :
                  <div className="report-body">
                    <div className="report-facts">
                      <div><small>Región</small><strong>{preparedReport.region}</strong></div>
                      <div><small>Área</small><strong>{fmt(preparedReport.areaKm2)} km²</strong></div>
                      <div><small>Escena</small><strong>{dateStr(preparedReport.scene.date)}</strong></div>
                      <div><small>Suelo útil</small><strong>{preparedReport.grid.usablePct}%</strong></div>
                    </div>
                    {preparedReport.decision&&<div className="evidence-verdict" aria-label="Dictamen técnico operativo">
                      <strong>Dictamen operativo de los datos</strong>
                      <div className="evidence-answer"><span>¿Hay señales espectrales elevadas?</span><b>{preparedReport.decision.spectralAnswer}</b></div>
                      <div className="evidence-answer"><span>¿Hay mapas o antecedentes incorporados en esta zona?</span><b>{geoMatches.length} cruces con polígonos · {activeGeologyEvidence.length} documentos declarados</b></div>
                      <div className="evidence-answer"><span>¿El satélite confirmó mineral en estos puntos?</span><b>{preparedReport.decision.mineralAnswer}</b></div>
                      <div className="evidence-answer"><span>¿Se conoce su potencial económico?</span><b>{preparedReport.decision.economicAnswer}</b></div>
                      <strong>Sectores priorizados para revisión</strong>
                      <p>Priorización relativa basada en coincidencia de índices y repetición entre escenas. No es una probabilidad de yacimiento ni recomendación de ingreso.</p>
                      <div className="evidence-places">{preparedReport.decision.zones.slice(0,8).map(z=><button type="button" key={z.kind+z.number} onClick={()=>{setIndicator(z.kind);const item=(preparedReport.zones?.[z.kind]||[]).find(p=>p.number===z.number);if(item)focusZone(item);}}>
                        <span className={'evidence-priority '+(z.priority==='Alta'?'major':z.priority==='Media'?'moderate':'base')}>{z.priority}</span>
                        <strong>{z.kind==='iron'?'F':'S'}-{z.number}</strong>
                        <small>{z.lat.toFixed(5)}, {z.lon.toFixed(5)}</small>
                        <small>{z.cooccurrence==='si'?'Ambos índices':'Índice principal'} · {z.temporal==='si'?'repetido en 2 fechas':z.temporal==='no_evaluado'?'sin 2.ª fecha':'sin coincidencia temporal demostrada'}</small>
                      </button>)}</div>
                      {!preparedReport.decision.zones.length&&<p>No se obtuvieron grupos válidos. Revisa la calidad de la escena y los filtros.</p>}
                    </div>}
                    <p className="report-notice">Diagnóstico basado en Sentinel-2, sin validación de mineral en laboratorio. El informe PDF es gratuito y no consume tokens de OpenAI.</p>
                    <div className="report-zone-totals"><span>Respuesta férrica: <strong>{preparedReport.zones?.iron?.length??0} sectores</strong></span><span>Respuesta SWIR: <strong>{preparedReport.zones?.clay?.length??0} sectores</strong></span></div>
                    <div className="report-validation-note">{controlSummary?'Contraste con área vecina procesado. ':'Sin control geográfico todavía. '}{temporalComparison ? `Comparación temporal realizada: ${temporalComparison.grid.sharedPct}% de celdas compartidas. Los resultados se incorporarán al PDF.` : 'Comparación temporal pendiente: disponible en «Validar».'} {activeAreaNotes.length} anotaciones locales.</div>
                    <div className="study-progress"><strong>Estudio geológico · {activePlates.length} láminas</strong>
                      {studyManifest.sections.map(sec=><div key={sec.id}><span>{sec.title}</span><small>{sec.status}</small></div>)}
                      <p>El PDF integra anexos e índices; no inventará perfiles ni unidades donde no exista documentación.</p>
                    </div>
                    <button type="button" className="run-btn pdf-export" onClick={downloadPdf}><Download size={17}/> Descargar informe PDF gratuito</button>
                    <div className="report-ai-section">
                      <div className="caption-label"><Mountain size={17}/> Asistente geológico con OpenAI</div>
                      <p>El asistente analizará las coordenadas seleccionadas, la escena Sentinel-2, los índices y los sectores priorizados. También considerará {geoMatches.length} cruces cartográficos, {activeGeologyEvidence.length} antecedentes y {activePlates.length} láminas del área que hayas cargado. No añadirá automáticamente información de otras zonas.</p>
                      <p className="geologist-docs-note">Antes del informe, pulsa «Investigar esta zona automáticamente» en Estudio geológico. Si responden las fuentes, GeoMiner utilizará unidades y estructuras cartografiadas. Sin respuesta o sin cobertura, el análisis se limita a la evidencia espectral.</p>
                      {geoMatches.length>0&&<p className="geologist-docs-note">Se enviarán a la IA {geoMatches.length} coincidencias sector–polígono con sus atributos y la indicación expresa de que el GeoJSON NO fue auditado. No se enviarán todos los polígonos.</p>}
                      <label htmlFor="geologist-question">¿Qué quieres preguntar al geólogo de IA? (opcional)</label>
                      <textarea id="geologist-question" rows={3} maxLength={700} value={geologistQuestion} onChange={e=>setGeologistQuestion(e.target.value)} placeholder="Ej.: ¿Qué sectores de esta zona tienen mejor evidencia espectral y qué cartografía debo buscar por estas coordenadas?"/>
                      <label className="v08-preview-toggle"><input type="checkbox" checked={aiPreview} onChange={e=>setAiPreview(e.target.checked)}/> Analizar también miniatura de falso color (128×128). Opcional, puede consumir más tokens; la imagen NO demuestra minerales.</label>
                      <label htmlFor="report-admin-code">Código privado de acceso (no es la clave API)</label>
                      <input id="report-admin-code" type="password" autoComplete="off" value={adminCode} onChange={e=>setAdminCode(e.target.value)} placeholder="Código definido en Vercel"/>
                      <button type="button" className="run-btn" onClick={generateAiReport} disabled={aiBusy||!adminCode.trim()}>{aiBusy?<LoaderCircle className="spin" size={17}/>:<FileText size={17}/>} {aiBusy?'Revisando evidencia geológica…':geologistQuestion.trim()?'Consultar al geólogo de IA':'Generar dictamen geológico asistido'}</button>
                      {aiError&&<div role="alert" className="error-box"><AlertTriangle size={17}/>{aiError}</div>}
                      {aiText&&<div className="ai-response"><strong>Interpretación técnica de la zona seleccionada</strong><div className="ai-formatted">{aiBlocks(aiText).map((block,i)=>block.kind==='heading'?<h3 key={i}>{renderBold(block.text)}</h3>:<p key={i}>{renderBold(block.text)}</p>)}</div>{aiUsage&&<small>Consumo: {aiUsage.inputTokens??'s/d'} tokens entrada · {aiUsage.outputTokens??'s/d'} salida</small>}<button type="button" className="spectral-export" onClick={downloadPdf}><Download size={15}/> Descargar PDF con esta interpretación</button></div>}
                    </div>
                  </div>
                }
              </div>
            ) : activeTab==='analysis' ? (
              <div className="panel-inner spectral-panel">
                <div className="spectral-intro"><Layers3 size={19}/><div><strong>Prospección espectral v1.2</strong><p>Sentinel-2 L2A · B2/B3/B4/B8/B11/B12, bandas red-edge opcionales y SCL. No es detección de minerales.</p></div></div>
                {!bbox&&<div className="empty-state compact"><Crosshair size={31} className="muted"/><strong>Selecciona tu terreno</strong><p>Delimita un terreno con GPS o dos clics en el mapa. Después busca escenas para analizar.</p></div>}
                {bbox&&area>25.01&&<div className="error-box"><Info size={17}/> Elige 5 × 5 km o menos para el procesamiento inicial. Área actual: {fmt(area)} km².</div>}
                {bbox&&area<=25.01&&<div className="spectral-step"><strong>1. Buscar imágenes multiespectrales</strong><button type="button" onClick={findAnalysisScenes} disabled={analysisBusy}>Consultar escenas gratuitas</button></div>}
                {analysisError&&<div className="error-box"><AlertTriangle size={17}/>{analysisError}</div>}
                {analysisBusy&&<div className="spectral-loading"><LoaderCircle className="spin" size={17}/>{analysisMessage}</div>}
                {analysisScenes&&<div className="spectral-scene-box"><small>Catálogo Earth Search · {analysisScenes.examined} escenas examinadas</small><label htmlFor="analysis-scene-select">Escena para procesar</label>
                  {analysisScenes.scenes.length ? <select id="analysis-scene-select" value={analysisScene?.id||''} onChange={e=>{setAnalysisScene(analysisScenes.scenes.find(s=>s.id===e.target.value)||null);setAnalysisResult(null);setHeatmapUrl(null);setSelectedZoneId(null);setCompareOutput(null);setCompareSceneId('');setNoteText('');setAiText('');}}>
                    {analysisScenes.scenes.map(scene=><option value={scene.id} key={scene.id}>{dateStr(scene.date)} · Nubes {scene.cloud}% · {scene.platform}</option>)}
                  </select>:<p>No se encontraron escenas completas con las bandas requeridas.</p>}
                  <p>La nubosidad corresponde a toda la escena, no necesariamente a tu terreno.</p>
                  <label htmlFor="analysis-resolution">Resolución de cuadrícula</label><select id="analysis-resolution" value={resolutionMeters} onChange={e=>{setResolutionMeters(Number(e.target.value));setAnalysisResult(null);setHeatmapUrl(null);setCompareOutput(null);setControlResult(null);setAiText('');setSelectedZoneId(null);}}><option value={20}>20 m · recomendado (más rápido)</option><option value={10}>10 m · más detalle, SWIR de 20 m remuestreada</option></select>
                  <p>La opción de 10 m NO crea nuevos detalles en bandas originalmente de 20 m. El procesamiento puede tardar más y consumir memoria/red.</p>
                  <button className="run-btn spectral-process" onClick={processAnalysis} disabled={analysisBusy||!analysisScene}><ScanLine size={17}/> 2. Procesar bandas de la escena</button>
                </div>}
                {analysisResult&&analysisStats&&<div className="spectral-output">
                  <strong>Resultados de índices relativos</strong>
                  <p className="v08-diagnostics">Cuadrícula: {analysisResult.width} × {analysisResult.height} · celda UTM ≈{analysisResult.cellWidthMeters} × {analysisResult.cellHeightMeters} m · {analysisResult.bandsRead?.length||0} bandas descargadas. {analysisResult.upsampled20mBands?'B11/B12, SCL y red-edge remuestreadas desde 20 m.':'Muestreo a aproximadamente 20 m.'}</p>
                  <div className="spectral-mode"><button type="button" className={spectralView==='indices'?'active':''} onClick={()=>setSpectralView('indices')}>Mapa de índices</button><button type="button" className={spectralView==='falsecolor'?'active':''} onClick={()=>setSpectralView('falsecolor')}>Falso color B11/B8/B4</button></div>
                  <div className="spectral-mode">
                    {Object.entries(INDICATORS).map(([id,meta])=><button disabled={id==='ferrous'&&!analysisResult.bandsRead?.includes('nir08')||id==='rededge'&&(!analysisResult.bandsRead?.includes('rededge1')||!analysisResult.bandsRead?.includes('rededge3'))} key={id} className={indicator===id?'active':''} onClick={()=>{setIndicator(id);setSelectedZoneId(null);}}>{meta.formula}</button>)}
                  </div>
                  {analysisStats.count===0&&<p className="spectral-footnote">Este indicador auxiliar no tiene datos válidos en la escena. Prueba otra fecha.</p>}
                  <div className="spectral-stat-grid"><div><small>Píxeles útiles</small><strong>{fmt(analysisResult.valid)} / {fmt(analysisResult.total)}</strong></div><div><small>Percentil 90</small><strong>{analysisStats.p90?.toFixed(3)??'s/d'}</strong></div></div>
                  <p className="spectral-explain">{spectralView==='falsecolor' ? 'Composición de falso color B11/B8/B4. Los colores no representan minerales ni son los colores naturales del suelo.' : `${INDICATORS[indicator].label}. Se resaltan valores a partir del P75 relativo al terreno.`} No demuestra yacimientos ni concentraciones.</p>
                  <button onClick={downloadIndicators} className="spectral-export"><Download size={15}/> Descargar píxeles P90+ (GeoJSON)</button>
                  <button type="button" className="spectral-export" onClick={()=>setActiveTab('anomalies')}><MapPinned size={15}/> Ver {zones.length} sectores agrupados en el mapa</button>
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
                <div className="saved-list">{saved.map(x=><div className="saved-item" key={x.id}><button className="saved-title" onClick={()=>{restore(x);setActiveTab('analysis');}}><MapPinned size={17}/><span><strong>{x.name}</strong><small>{fmt(x.area)} km² · Abrir en mapa</small></span></button><button className="icon-button delete-btn" aria-label="Eliminar área" onClick={()=>deleteArea(x.id)}><Trash2 size={16}/></button></div>)}</div>}
              </div>
            )}
          </div>
        </section>
        <footer className="page-footer"><span>GeoMiner Bolivia · Plataforma en desarrollo</span><span>Prospección preliminar · No sustituye estudios geológicos de campo</span></footer>
      </main>
    </div>
  );
}
