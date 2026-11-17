// ExtracTerre v2.27.0 — périmètre Salesforce : les bâtiments de la fiche (ou de l'export) Salesforce sont la seule référence.
// Chaque bâtiment trouvé dans les documents est rapproché d'un bâtiment Salesforce ; ce qui ne correspond à rien n'est pas retenu.
// Règles automatiques, dans l'ordre (une correction faite dans la table l'emporte toujours) :
//   1. même nom (écritures neutralisées : « Bât A » = « BATIMENT A » = « Bât. A ») ;
//   2. même identifiant (« Bât A Est », « Bâtiment A aile nord » → « Bât A ») ;
//   3. chiffre ↔ lettre quand Salesforce n'utilise que l'un des deux (« Bât 1 » → « Bât A », « Bât B » → « Bât 2 ») ;
//   4. « Bâtiment unique » → le bâtiment Salesforce s'il n'y en a qu'un.
import {canonicalBuilding,buildingMergeKey,buildingCoreId,isGarbageBuildingName} from './buildings.js';

const SFP_SINGLE=/^(?:[a-z]{1,3}\d{0,3}|\d{1,4})$/;
// Clé de rapprochement : sans mention du nombre de logements/lots, ni parenthèses ; plages « 3 a 7 » = « 3-7 ».
const normLowerSfp=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function sfp_key(name){
  return buildingMergeKey(String(name||'').replace(/\([^)]*\)/g,' ').replace(/\s+-\s+\d+\s*(?:logements?|lgts?|lots?|lgt)\b.*$/i,' ').replace(/\b(\d+)\s+(?:a|à)\s+(\d+)\b/gi,'$1-$2'))
    .replace(/\b(\d+) (\d+)\b/g,'$1-$2').trim();
}
// Clé souple : « I »/« l » collé à un nombre = 1, pluriels et lettres doublées neutralisés, séparateurs de nombres ignorés.
function sfp_loose(name){
  const t=sfp_key(name).replace(/-/g,' ').split(' ').filter(w=>w&&!/^(?:batiment|bat)$/.test(w));
  return t.map((w,i)=>/^[il]$/.test(w)&&(/^\d+$/.test(t[i+1]||'')||/^\d+$/.test(t[i-1]||''))?'1':w)
    .map(w=>/^\d+$/.test(w)?String(parseInt(w,10)):w.length>=4?w.replace(/([a-z])\1+/g,'$1').replace(/(?<=..)(?:e?s|x)$/,''):w).join(' ');
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
    // v2.36.4 — écritures voisines, un seul candidat : « MAISON I-01 » ↔ « MAISON 1-01 », « MAISONS 01 & 02 » ↔ « MAISON 01&02 »,
    // « COLECTIF A » ↔ « COLLECTIF A », « ACCESSION » ↔ « C - BATIMENT ACCESSION » (code devant le nom).
    const lk=sfp_loose(d); const loose=lk.length>=4?S.filter(s=>{ const q=sfp_loose(s); return q===lk||(/^[a-z]{1,2}\d{0,2} /.test(q)&&q.slice(q.indexOf(' ')+1)===lk&&lk.length>=5); }):[];
    if(loose.length===1&&!/\b(?:et|ou)\b|,/.test(normLowerSfp(d))){ map[raw]=loose[0]; modes[raw]='prefix'; continue; }
    map[raw]=null; modes[raw]='none';
  }
  // Un seul bâtiment Salesforce : les noms courts restés seuls (« 1 », « N°1 », « BATIMENT ») le désignent.
  if(S.length===1){ for(const raw of Object.keys(map)) if(map[raw]===null&&modes[raw]==='none'&&!Object.prototype.hasOwnProperty.call(manual||{},raw)){ const k=sfp_key(canonicalBuilding(raw)); if(/^(?:n ?)?(?:[a-z]|\d{1,2}|bat|batiment|ensemble|projet)$/.test(k)){ map[raw]=S[0]; modes[raw]='unique'; } } }
  return {sf:S,map,modes};
}

// v2.43.0 — Salesforce ne nomme pas les bâtiments mais en donne le nombre (« Total bâtiments » ; 0 ou vide = 1).
// Les documents ne créent jamais de bâtiment : on garde au plus N noms lus dans les documents, les mieux renseignés
// (nombre de résultats Bbio, Cep, DH, Tic, Ic…), un seul par identifiant (« Bât A » = « BATIMENT A » = « Bâtiment 1 »).
// Titres de tableau, sous-ensembles (zone, étage, cage, groupe, lot…) et listes (« A et B ») ne sont jamais des bâtiments.
// detected : [{name, results}]. Renvoie les noms retenus (ordre naturel). N = 1 : le nom lu s'il n'y en a qu'un, sinon « Bâtiment unique ».
const SFC_NOT_BUILDING=/\b(?:zone|zones|etage|cage|niveau|r\s?\+\s?\d|t[1-6]|groupe|lot|lots|tranche|facade|synthese|generalites?|exigences?|bbio|cep|puissance|verification|essai|repartition|deperditions?|informations|total|consommations?|etude|notice|sommaire|resultats?|tableau|compteur|circuit|observations?|commentaires?|indicateurs?|page|reglementaire|gain|cctp|methode|chauffee|logements?\s+collectifs?|collectifs?|individuels?|neuf|existant)\b|\d+[.,]\d{2}|m2\b|m²|\.{4,}|\d{2}\/\d{2}\/\d{4}/;
export function sfIsList(name){
  const k=buildingMergeKey(canonicalBuilding(name)); const t=k.split(' ');
  return /[,;&\/]/.test(String(name).replace(/^B[aâ]timents?\s*/i,''))||/\b(?:et|a|à)\b/.test(t.slice(1).join(' '))||t.slice(1).some(x=>SFP_SINGLE.test(x)&&x.length<=3&&!/^(?:est|nord|sud|rue|cour)$/.test(x));
}
// Noms lus classés : d'abord les noms nets (identifiant, nom de bâtiment), puis les noms douteux (titre, sous-ensemble, liste),
// chacun du mieux renseigné au moins renseigné ; un seul par identifiant. Un groupe de maisons (« MAISONS 2/3 », « MI 1 A 3 »)
// est un bâtiment (Salesforce compte un bâtiment par groupe de maisons accolées), pas une liste.
const SFC_HOUSES=/\b(?:maisons?|mi|villas?|individuels?|pavillons?|logts?|logements?|ilot)\b|ilot_/;
export function sfRankNames(detected,{strictOnly=false}={}){
  const equiv=c=>/^[a-z]$/.test(c)?String(c.charCodeAt(0)-96):/^\d{1,2}$/.test(c)&&+c>=1&&+c<=26?String.fromCharCode(96+ +c):'';
  const sure=[],doubt=[];
  for(const {name,results} of [...(detected||[])].sort((a,b)=>(b.results||0)-(a.results||0))){
    const d=canonicalBuilding(name); if(!d||d==='Bâtiment unique') continue;
    const t=normLowerSfp(d.replace(/^B[aâ]timent\s+/i,'')), houses=SFC_HOUSES.test(t);
    const key=buildingMergeKey(d), single=!key.includes(' '), core=single?buildingCoreId(d):'';
    const all=[...sure,...doubt];
    if(all.some(c=>c.key===key||(core&&c.core&&(c.core===core||(equiv(core)&&c.core===equiv(core)))))) continue;
    const bad=isGarbageBuildingName(d)||(!houses&&sfIsList(d))||(SFC_NOT_BUILDING.test(t)&&!houses);
    (bad?doubt:sure).push({name:d,key,core});
  }
  return (strictOnly?sure:[...sure,...doubt]).map(c=>c.name);
}
export function sfCountNames(total,detected){
  const N=Math.max(1,Math.floor(Number(total))||1), ranked=sfRankNames(detected);
  if(N===1){ const sure=sfRankNames(detected,{strictOnly:true}); return [sure.length===1?sure[0]:'Bâtiment unique']; }
  return ranked.slice(0,N).sort((a,b)=>a.localeCompare(b,'fr',{numeric:true}));
}
// Libellé groupé de la fiche Salesforce (« Bât 2 & 3 », « Bât A et B ») = plusieurs bâtiments qui partagent les valeurs.
// « Bât AB » reste UN bâtiment : « Total bâtiments » le compte pour un (mesuré sur les 647 opérations).
export function sfSplitGroup(name){
  const body=String(name||'').replace(/^\s*B[aâ]t(?:iment)?s?\.?\s*/i,'').trim();
  let parts=body.split(/\s*(?:,|;|&|\+|\/|\bet\b)\s*/i).filter(Boolean);
  return parts.length>1&&parts.every(x=>/^[A-Za-z]{1,2}\d{0,3}$|^\d{1,3}$/.test(x))?parts.map(x=>'Bâtiment '+x):[name];
}
// Périmètre complet : noms Salesforce (fiche Évaluation) sinon nombre Salesforce. Avec un seul bâtiment, tout nom lu s'y rattache
// (sauf correction manuelle « non retenu »).
export function sfPerimeter({names,total,detected,manual={}}){
  const byName=Array.isArray(names)&&names.length, hasTotal=total!==null&&total!==''&&total!==undefined&&Number.isFinite(Number(total));
  if(!byName&&!hasTotal) return null;
  const N=hasTotal?Math.max(1,Math.floor(Number(total))||1):null;
  let S=byName?[...new Set(names.flatMap(sfSplitGroup).map(canonicalBuilding))]:sfCountNames(total,detected);
  // v2.43.0 — jamais plus de bâtiments que le « Total bâtiments » Salesforce : noms de la fiche en surnombre → rattachés comme des
  // noms de documents ; noms en nombre insuffisant → complétés par les noms des documents les mieux renseignés, jusqu'à N.
  let sfExtra=[];
  if(byName&&N!==null&&S.length>N){ sfExtra=S.slice(N); S=S.slice(0,N); }
  if(byName&&N!==null&&S.length<N){ const tk=sfPerimeterMap(S,(detected||[]).map(x=>x.name),manual), taken=x=>tk.map[x]&&tk.modes[x]!=='unique';
    S=[...S,...sfRankNames((detected||[]).filter(x=>!taken(x.name))).filter(x=>!S.includes(x)).slice(0,N-S.length)]; }
  const m=sfPerimeterMap(S,[...(detected||[]).map(x=>x.name),...sfExtra],manual);
  if(m.sf.length===1) for(const raw of Object.keys(m.map)) if(m.map[raw]===null&&!Object.prototype.hasOwnProperty.call(manual||{},raw)){ m.map[raw]=m.sf[0]; m.modes[raw]='unique'; }
  m.source=byName?'noms':'nombre'; m.total=N??S.length; m.sfExtra=sfExtra;
  return m;
}
