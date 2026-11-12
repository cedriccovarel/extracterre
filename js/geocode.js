// v2.9.0 — adresse de l'opération et géolocalisation (Géoplateforme IGN, Base Adresse Nationale).
// Rien n'est deviné : une coordonnée n'est retenue que si l'IGN trouve le numéro ou la voie, dans le code postal lu.
export const GEOCODE_URL='https://data.geopf.fr/geocodage/search';
export const GEOCODE_FIELDS=['latitude','longitude','insee_code','geocode_precision'];
const GEO_PRECISION={housenumber:'Adresse exacte (numéro)',street:'Voie (sans numéro)'};
export const GEO_MIN_SCORE=0.5;

const geo_clean=v=>String(v??'').replace(/\s+/g,' ').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g,'').trim();
// « 12 rue de la Paix 75002 Paris » ou « 12 rue de la Paix, 75002 PARIS CEDEX » → {address, postcode, city}.
export function parseFrAddress(text){
  const t=geo_clean(text); const m=t.match(/^(.*?)[\s,–-]*\b((?:0[1-9]|[1-8]\d|9[0-8])\d{3})\b\s*(.*)$/);
  if(!m) return {address:t,postcode:'',city:''};
  const city=geo_clean(m[3].replace(/\bcedex\b.*$/i,'').replace(/\(.*?\)/g,''));
  return {address:geo_clean(m[1]),postcode:m[2],city};
}
// Requête envoyée à l'IGN : il faut une voie et un code postal ou une commune.
export function geocodeQuery(row){
  const a=geo_clean(row?.address), cp=geo_clean(row?.postcode), c=geo_clean(row?.city);
  if(!a||!/[a-zà-ÿ]{3}/i.test(a)||!(cp||c)) return '';
  return [a,cp,c].filter(Boolean).join(' ');
}
// Réponse GeoJSON de l'IGN → résultat retenu {ok:true,…} ou motif de refus {ok:false,reason}.
export function geocodeVerdict(json,row={}){
  const f=json?.features?.[0], p=f?.properties||{}, [lon,lat]=f?.geometry?.coordinates||[];
  if(!f||!Number.isFinite(lat)||!Number.isFinite(lon)) return {ok:false,reason:'adresse introuvable'};
  if(!GEO_PRECISION[p.type]) return {ok:false,reason:`seule la commune est trouvée (${p.label||p.city||''})`};
  if(!(p.score>=GEO_MIN_SCORE)) return {ok:false,reason:`correspondance trop faible (score ${Number(p.score||0).toFixed(2)} : ${p.label})`};
  const cp=geo_clean(row.postcode); if(cp&&p.postcode&&p.postcode!==cp) return {ok:false,reason:`code postal différent (${p.postcode} au lieu de ${cp})`};
  return {ok:true,lat:Math.round(lat*1e6)/1e6,lon:Math.round(lon*1e6)/1e6,insee:p.citycode||'',precision:GEO_PRECISION[p.type],label:p.label||'',score:Math.round(p.score*100)/100};
}
export async function geocodeAddress(query,row={},fetchImpl=fetch){
  const u=new URL(GEOCODE_URL); u.searchParams.set('q',query); u.searchParams.set('limit','1'); u.searchParams.set('index','address');
  const cp=geo_clean(row.postcode); if(/^\d{5}$/.test(cp)) u.searchParams.set('postcode',cp);
  const r=await fetchImpl(u.toString()); if(!r.ok) throw new Error(`Géoplateforme IGN : HTTP ${r.status}`);
  return geocodeVerdict(await r.json(),row);
}
// v2.30.0 — secours quand aucune adresse n'est connue : commune et département lus dans le nom du dossier Box
// (« 00004464 - 06 - ANTIBES - Petit four », « 75 - 1439 - Paris - Monte Cristo », « 95-3991 - BEAUCHAMP - VILLA »).
const geo_norm=s=>String(s??'').replace(/œ/gi,'oe').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/['’]/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
export function folderCommune(folder){
  const name=String(folder??'').split('/').pop().trim();
  const segs=name.split(/\s+[-–]\s*|\s*[-–]\s+/).map(s=>s.trim()).filter(Boolean);
  let dep='',i=0;
  for(;i<segs.length;i++){ const s=segs[i];
    const m=s.match(/^(0[1-9]|[1-8]\d|9[0-5]|2[ab]|97[1-6])(?:-\d+)?$/i); if(m&&!dep){ dep=m[1].toUpperCase(); continue; }
    if(/^[\d\s,;+&et]+$/i.test(s)||/^(?:cp|ap|annul\w*)$/i.test(geo_norm(s))) continue;
    if(dep&&/[a-z]{2}/i.test(s)) break;
  }
  const city=dep&&i<segs.length?segs[i].replace(/\b(?:annul[ée]e?s?|cp|ap)\b/gi,' ').replace(/\s+/g,' ').trim():'';
  return dep&&city?{department:dep,city}:null;
}
export function communeVerdict(json,{department,city}){
  const want=geo_norm(city);
  for(const f of json?.features||[]){ const p=f.properties||{}, [lon,lat]=f.geometry?.coordinates||[];
    if(p.type!=='municipality'||!Number.isFinite(lat)) continue;
    if(!String(p.context||'').toUpperCase().startsWith(department+',')) continue;
    const label=geo_norm(p.label||p.city); if(!label||!(want===label||want.startsWith(label+' '))) continue;
    return {ok:true,lat:Math.round(lat*1e6)/1e6,lon:Math.round(lon*1e6)/1e6,insee:p.citycode||'',label:p.label||'',precision:'Commune (nom du dossier Box) — position approximative'};
  }
  return {ok:false,reason:`commune « ${city} » (${department}) introuvable`};
}
export async function geocodeCommune(fc,fetchImpl=fetch){
  const u=new URL(GEOCODE_URL); u.searchParams.set('q',fc.city); u.searchParams.set('type','municipality'); u.searchParams.set('limit','10');
  const r=await fetchImpl(u.toString()); if(!r.ok) throw new Error(`Géoplateforme IGN : HTTP ${r.status}`);
  const v=communeVerdict(await r.json(),fc); if(v.ok) return v;
  // « Paris Rue des Amandiers » : la ville est suivie d'autre chose → on réessaie avec les premiers mots.
  const words=fc.city.split(/\s+/);
  for(let n=Math.min(words.length-1,4);n>=1;n--){ const city=words.slice(0,n).join(' '); u.searchParams.set('q',city);
    const r2=await fetchImpl(u.toString()); if(!r2.ok) break; const v2=communeVerdict(await r2.json(),{...fc,city}); if(v2.ok) return v2; }
  return v;
}
export const mapLink=(lat,lon)=>`https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=19&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`;
