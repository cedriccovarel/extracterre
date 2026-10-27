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
export const mapLink=(lat,lon)=>`https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=19&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`;
