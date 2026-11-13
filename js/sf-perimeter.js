// ExtracTerre v2.27.0 — périmètre Salesforce : les bâtiments de la fiche (ou de l'export) Salesforce sont la seule référence.
// Chaque bâtiment trouvé dans les documents est rapproché d'un bâtiment Salesforce ; ce qui ne correspond à rien n'est pas retenu.
// Règles automatiques, dans l'ordre (une correction faite dans la table l'emporte toujours) :
//   1. même nom (écritures neutralisées : « Bât A » = « BATIMENT A » = « Bât. A ») ;
//   2. même identifiant (« Bât A Est », « Bâtiment A aile nord » → « Bât A ») ;
//   3. chiffre ↔ lettre quand Salesforce n'utilise que l'un des deux (« Bât 1 » → « Bât A », « Bât B » → « Bât 2 ») ;
//   4. « Bâtiment unique » → le bâtiment Salesforce s'il n'y en a qu'un.
import {canonicalBuilding,buildingMergeKey,buildingCoreId} from './buildings.js';

const SFP_SINGLE=/^(?:[a-z]{1,3}\d{0,3}|\d{1,4})$/;
// Clé de rapprochement : sans mention du nombre de logements/lots, ni parenthèses ; plages « 3 a 7 » = « 3-7 ».
const normLowerSfp=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function sfp_key(name){
  return buildingMergeKey(String(name||'').replace(/\([^)]*\)/g,' ').replace(/\s+-\s+\d+\s*(?:logements?|lgts?|lots?|lgt)\b.*$/i,' ').replace(/\b(\d+)\s+(?:a|à)\s+(\d+)\b/gi,'$1-$2'))
    .replace(/\b(\d+) (\d+)\b/g,'$1-$2').trim();
}
export const SFP_MODES={exact:'même nom',core:'même identifiant',letter:'chiffre ↔ lettre',unique:'bâtiment unique',manual:'correction manuelle',none:'non retenu',sf:'bâtiment Salesforce'};

// sfNames : bâtiments Salesforce ; detected : noms lus dans les documents ; manual : {nom: bâtiment Salesforce | '' (non retenu)}.
export function sfPerimeterMap(sfNames,detected,manual={}){
  const S=[...new Set((sfNames||[]).map(canonicalBuilding))];
  const byKey=new Map(S.map(s=>[buildingMergeKey(s),s]));
  const cores=S.map(s=>({s,core:buildingCoreId(s)}));
  const allLetters=cores.length&&cores.every(c=>/^[a-z]$/.test(c.core)), allNumbers=cores.length&&cores.every(c=>/^\d{1,3}$/.test(c.core));
  const map={},modes={};
  for(const raw of [...new Set(detected||[])]){
    if(!raw) continue;
    const d=canonicalBuilding(raw);
    if(Object.prototype.hasOwnProperty.call(manual||{},raw)||Object.prototype.hasOwnProperty.call(manual||{},d)){
      const t=manual[raw]??manual[d]; map[raw]=t&&S.includes(canonicalBuilding(t))?canonicalBuilding(t):null; modes[raw]=map[raw]?'manual':'none'; continue; }
    if(S.includes(d)){ map[raw]=d; modes[raw]=d===raw?'sf':'exact'; continue; }
    if(d==='Bâtiment unique'){ map[raw]=S.length===1?S[0]:null; modes[raw]=S.length===1?'unique':'none'; continue; }
    const k=buildingMergeKey(d); if(byKey.has(k)){ map[raw]=byKey.get(k); modes[raw]='exact'; continue; }
    const first=(k.split(' ')[0]||''), core=SFP_SINGLE.test(first)?buildingCoreId(first):'';
    // Une liste (« A et B », « 1 2 ») n'est pas un bâtiment : jamais rattachée automatiquement.
    const isList=/\b(?:et|a|à)\b/.test(k.split(' ').slice(1).join(' '))||k.split(' ').slice(1).some(t=>SFP_SINGLE.test(t)&&t.length<=3&&!/^(?:est|nord|sud|rue|cour)$/.test(t));
    const hit=core&&!isList?cores.filter(c=>c.core===core):[];
    if(hit.length===1){ map[raw]=hit[0].s; modes[raw]='core'; continue; }
    if(core&&!isList&&hit.length===0){
      let alt='';
      if(allLetters&&/^\d{1,2}$/.test(core)&&Number(core)>=1&&Number(core)<=26) alt=String.fromCharCode(96+Number(core));
      if(allNumbers&&/^[a-z]$/.test(core)) alt=String(core.charCodeAt(0)-96);
      const h2=alt?cores.filter(c=>c.core===alt):[];
      if(h2.length===1){ map[raw]=h2[0].s; modes[raw]='letter'; continue; }
    }
    // v2.35.0 — même bâtiment, nom plus ou moins détaillé : « BASSON I » ↔ « BASSON I - 40 LGTS », « LOGEMENT 5 » ↔
    // « LOGEMENT 5 - 1 LOT (T3) », « BEG-3-7 » ↔ « BEG-3 A 7 », « EHPAD » ↔ « EHPAD SAINTE-MONIQUE RENOVE » (début de nom, un seul candidat).
    const pk=sfp_key(d); const pre=pk.length>=3?S.filter(s=>{ const q=sfp_key(s); return q&&(q===pk||q.startsWith(pk+' ')||pk.startsWith(q+' ')); }):[];
    if(pre.length===1&&!/\b(?:et|ou)\b|,/.test(normLowerSfp(d))){ map[raw]=pre[0]; modes[raw]='prefix'; continue; }
    map[raw]=null; modes[raw]='none';
  }
  // Un seul bâtiment Salesforce : les noms courts restés seuls (« 1 », « N°1 », « BATIMENT ») le désignent.
  if(S.length===1){ for(const raw of Object.keys(map)) if(map[raw]===null&&modes[raw]==='none'&&!Object.prototype.hasOwnProperty.call(manual||{},raw)){ const k=sfp_key(canonicalBuilding(raw)); if(/^(?:n ?)?(?:[a-z]|\d{1,2}|bat|batiment|ensemble|projet)$/.test(k)){ map[raw]=S[0]; modes[raw]='unique'; } } }
  return {sf:S,map,modes};
}
