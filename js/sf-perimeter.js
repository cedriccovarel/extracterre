// ExtracTerre v2.27.0 — périmètre Salesforce : les bâtiments de la fiche (ou de l'export) Salesforce sont la seule référence.
// Chaque bâtiment trouvé dans les documents est rapproché d'un bâtiment Salesforce ; ce qui ne correspond à rien n'est pas retenu.
// Règles automatiques, dans l'ordre (une correction faite dans la table l'emporte toujours) :
//   1. même nom (écritures neutralisées : « Bât A » = « BATIMENT A » = « Bât. A ») ;
//   2. même identifiant (« Bât A Est », « Bâtiment A aile nord » → « Bât A ») ;
//   3. chiffre ↔ lettre quand Salesforce n'utilise que l'un des deux (« Bât 1 » → « Bât A », « Bât B » → « Bât 2 ») ;
//   4. « Bâtiment unique » → le bâtiment Salesforce s'il n'y en a qu'un.
import {canonicalBuilding,buildingMergeKey,buildingCoreId} from './buildings.js';

const SFP_SINGLE=/^(?:[a-z]{1,3}\d{0,3}|\d{1,4})$/;
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
    map[raw]=null; modes[raw]='none';
  }
  return {sf:S,map,modes};
}
