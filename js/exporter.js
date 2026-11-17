import {APP_VERSION,FIELD_DEFS,FIELD_MAP,MIN_RETAINED_CONFIDENCE} from './config.js';
import {analyzeEconomicData,ECONOMIC_FIELDS,COST_CATEGORIES} from './economics.js';
import {runSearchGrid,searchCellValue,STAT_KEYS} from './recherches.js';
import {reliabilityTable,RELIABILITY} from './qualite.js';
import {INSULATION_LIBRARY_VERSION,INSULATION_LIBRARY_VARIANT_COUNT,CORE_INSULATION_VARIANT_COUNT} from './insulation-library.js';

// Résultats de la recherche confort d'été, dans l'ordre de la fiche.
const CONFORT_KEYS=['dh_zt','dh_znt','dh_max','tic','tic_ref','cross_ventilated','non_cross_ventilated','fan_presence','fan_count','fan_type','cooling','cooling_active'];
// Système constructif, mêmes catégories et mêmes règles que la carte TotalRecoll (recoll.js confortOf) : structure des murs
// (sinon « Structure »), puis ITE / ITI (colonne Oui / Non, sinon isolant ITE / ITI lu, sinon mention dans le type d'isolant).
// Rien de deviné : catégorie vide quand la structure ou l'isolation ne permet pas de trancher, la raison va dans « précision ».
const CONSTRUCTIVE_KEYS=['wall_structure','wall_ite','wall_iti','wall_insulation'];
export const SYSTEMS={iti:'Béton ou brique + isolation intérieure ou isolation répartie',ite:'Béton ou brique + isolation extérieure',bois:'Ossature bois'};
const ntx=v=>String(v??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const RE_BOIS=/ossature\s*bois|\bmob\b|\bcob\b|\bclt\b|bois\s*massif|colombage|pans?\s*de\s*bois/;
const RE_MASS=/beton|brique|parpaing|\bblocs?\b|pierre|meuliere|moellon|maconn|porotherm|monomur|banche|prefabriqu|\bvoiles?\b|terre\s*cuite|agglo/;
const RE_REPART=/monomur|beton\s*cellulaire|isolation\s*repartie|thermo\s*brique|brique\s*isolante/;
const blankV=v=>v===undefined||v===null||String(v).trim()==='';
export function constructiveSystem(row){
  const yn=v=>{ const s=ntx(v); return /^oui\b/.test(s)?true:/^non\b/.test(s)?false:null; };
  const cands=[row.wall_structure,row.structure].filter(v=>!blankV(v)), raw=cands.find(v=>RE_BOIS.test(ntx(v))||RE_MASS.test(ntx(v)))??cands[0], struct=ntx(raw);
  const ins=ntx(row.wall_insulation), side=(k,iso,re)=>yn(row[k])??(!blankV(row[iso])||re.test(ins)?true:null);
  const ite=side('wall_ite','wall_ite_insulation',/\bite\b|exterieur|isofacade/), iti=side('wall_iti','wall_iti_insulation',/\biti\b|interieur|doublage|doublissimo|complexe isolant/);
  if(RE_BOIS.test(struct)) return {system:SYSTEMS.bois,note:''};
  if(RE_MASS.test(struct)){
    if(ite&&iti) return {system:'',note:'ITE et ITI : à trancher'};
    if(ite) return {system:SYSTEMS.ite,note:''};
    if(iti||RE_REPART.test(struct)) return {system:SYSTEMS.iti,note:''};
    return {system:'',note:'isolation des murs non précisée'}; }
  if(struct) return {system:'',note:`structure hors catégories : ${raw}`};
  return {system:'',note:ite||iti?'structure non renseignée':''};
}
function aoaSheet(rows){ return XLSX.utils.aoa_to_sheet(rows); }
function autoWidth(ws,max=42){ const range=XLSX.utils.decode_range(ws['!ref']||'A1:A1'); const widths=[]; for(let c=range.s.c;c<=range.e.c;c++){ let m=10; for(let r=range.s.r;r<=Math.min(range.e.r,250);r++){ const cell=ws[XLSX.utils.encode_cell({r,c})]; if(cell?.v!=null) m=Math.max(m,String(cell.v).length+2); } widths.push({wch:Math.min(max,m)}); } ws['!cols']=widths; }
function projectTagsText(p){ return (p?.projectTags||[]).map(t=>t?.label).filter(Boolean).join(' ; '); }
function projectName(p,index){ return (p?.customTitle||p?.operationName||p?.result?.operation||p?.label||`Projet ${index+1}`).trim(); }

// v2.39.1 — export par COLLECTEUR : chaque opération est ajoutée à son tour (add), ses lignes copiées dans les feuilles, puis
// l'appli peut libérer son résultat avant la suivante. 647 opérations faisaient planter la page (tous les résultats en mémoire
// + feuille « Occurrences » de plusieurs millions de lignes, au-delà de la limite Excel d'environ 1 million).
export const EXCEL_OCCURRENCES_MAX_PROJECTS=100;
const cut=(v,n=300)=>{ const s=v==null?'':String(v); return s.length>n?s.slice(0,n)+'…':s; };
export function createExcelCollector(rules,{grids=[],identity=null,withOccurrences=true}={}){
  if(!globalThis.XLSX) throw new Error('SheetJS non chargé.');
  const fields=FIELD_DEFS.filter(f=>!f.hidden); // DH (interne) remplacé par DH ZT / DH ZNT
  const blank=v=>v===undefined||v===null||v===''||v==='non précisé';
  const S={
    data:[[...fields.map(f=>f.label),'Tags']], relData:[[...fields.map(f=>f.label)]],
    tr:[['Projet','Opération','Bâtiment consolidé','Nom bâtiment source','Donnée','Valeur','Fiabilité','Source','Type document','Page','Confiance','Méthode','Origine','Commentaire','Extrait']],
    oc:[['Projet','Bâtiment consolidé','Nom bâtiment source','Donnée','Valeur','Source','Type document','Page','Confiance','Routage','Statut','Motif rejet','Méthode','Origine','Commentaire','Extrait']],
    bg:[['Projet','Nom détecté','Bâtiment consolidé','Mode de regroupement']],
    eco:[], det:[['Code interne','Nom opération','Type','Source','Lot / poste / aide','Catégorie','Porteur','Calcul','Montant (€)','Statut','Commentaire','Document','Page']], ecoAny:false,
    conf:null, grids:(grids||[]).map(g=>({g:null,src:g,rows:[]})), cites:[['Code interne','Nom opération','Contrat','Grille','Thème','Critère','Document','Page','Ligne','Valeurs']],
    n:0, firstName:'', docs:0, buildings:0, finals:0, alerts:0, ocRows:0 };
  const cf=CONFORT_KEYS.filter(k=>FIELD_MAP[k]), ck=CONSTRUCTIVE_KEYS.filter(k=>FIELD_MAP[k]);
  S.conf=[['Code interne','Nom opération','Contrat','Bâtiment','Système constructif','Système constructif — précision',...ck.map(k=>FIELD_MAP[k].label),...cf.map(k=>FIELD_MAP[k].label)]];
  const OC_MAX=1000000;
  return {
    add(p){ if(!p?.result) return false; const idx=S.n++, r=p.result, pname=projectName(p,idx); if(!idx) S.firstName=pname;
      S.docs+=r.documentsCount||0; S.buildings+=r.buildings?.length||0; S.finals+=r.finals?.length||0; S.alerts+=r.alerts?.length||0;
      // Feuille principale : schéma métier strict (colonnes dans l'ordre de référence), puis « Tags ».
      for(const row of r.rows){ S.data.push(fields.map(f=>{ if(f.key==='building') return row.building??''; if(f.key==='project') return row.project??pname; if(f.key==='operation') return row.operation??r.operation??pname; if(f.key==='operation_name') return row.operation_name??p.operationName??r.operation??''; return row[f.key]??''; }).concat([projectTagsText(p)])); }
      // Données économiques (v2.5.0).
      const off=new Set(p.economicExcluded||[]); const e=analyzeEconomicData((p.docs||[]).filter(d=>!off.has(d.id)),r.operation||'',p.manualEconomics||{}); const rows=r.rows||[]; const first=k=>rows.map(x=>x[k]).find(x=>!blank(x));
      const code=first('internal_code')??e.values.fin_operation_code??'', name=first('operation_name')??(p.operationName||r.operation||e.values.fin_operation_label||pname), contract=(identity?identity(p).contract:'')||'';
      if(e.source||Object.keys(e.values).length) S.ecoAny=true;
      S.eco.push([code,name,...ECONOMIC_FIELDS.map(f=>e.values[f.key]??'')]);
      for(const l of e.costs) S.det.push([code,name,'Coût',l.source,l.label,COST_CATEGORIES.find(c=>c.id===l.category)?.label||l.category,'','',l.amount,'',l.comment||'',l.document||'',l.page??'']);
      for(const a of e.aids) S.det.push([code,name,'Aide','',a.label,a.category,a.level,a.calc,a.amount,a.status,a.comment||'',a.document||'',a.page??'']);
      // Fiabilité (v2.34.0) et traçabilité des valeurs retenues.
      const rt=reliabilityTable(r);
      for(const row of r.rows){ const m=rt[row.building]||{}; S.relData.push(fields.map(f=>f.key==='building'?(row.building??''):f.key==='contract_number'?(row.contract_number??''):f.key==='internal_code'?(row.internal_code??''):(m[f.key]?RELIABILITY[m[f.key]].short:''))); }
      for(const o of r.finals) S.tr.push([pname,r.operation||pname,o.building,o.originalBuilding||o.building,FIELD_MAP[o.field]?.label||o.field,o.value,RELIABILITY[rt[o.building]?.[o.field]]?.short||'',o.fileName,o.docType,o.page,o.confidence,o.method,o.origin||'Document',o.provenanceNote||'',cut(o.excerpt)]);
      if(withOccurrences) for(const o of r.detailed||[]){ if(S.ocRows>=OC_MAX) break; S.ocRows++; S.oc.push([pname,o.building,o.originalBuilding||o.building,FIELD_MAP[o.field]?.label||o.field,o.value,o.fileName,o.docType,o.page,o.confidence,o.sourceTier,o.status,o.rejectionReason||'',o.method,o.origin||'Document',o.provenanceNote||'',cut(o.excerpt)]); }
      for(const a of r.buildingAliases||[]) S.bg.push([pname,a.source,a.target,a.mode]);
      // Confort d'été (v2.36.7) et grilles de recherche.
      for(const row of r.rows){ const s=constructiveSystem(row); S.conf.push([code,name,contract,row.building??'',s.system,s.note,...ck.map(k=>row[k]??''),...cf.map(k=>row[k]??'')]); }
      for(const G of S.grids){ const res=runSearchGrid(G.src,p.docs||[],p.searchOverrides?.[G.src.id]||{},p.planTables,p.planChecks,r); if(!G.g) G.g=res.grid; const g=G.g;
        G.rows.push([code,name,contract,...g.themes.flatMap(t=>{ const s=res.themes[t.name]; return [s.applicable===false?'':`${s.found} / ${t.min}`,s.applicable===false?'Non applicable':s.ok?'Oui':'Non']; }),...g.criteria.flatMap(c=>c.kind==='stats'?STAT_KEYS.map(([k])=>res.criteria[c.id].stats?.[k]??''):[searchCellValue(c,res.criteria[c.id])])]);
        for(const c of g.criteria) for(const ev of res.criteria[c.id].evidence) S.cites.push([code,name,contract,g.name,c.theme,c.label,ev.doc,ev.page,ev.line,(ev.values||[]).join(' ; ')]); }
      return true; },
    write(){
      if(!S.n) throw new Error('Aucun projet analysé à exporter.');
      const wb=XLSX.utils.book_new(), used=new Set();
      const put=(rows,name)=>{ const ws=aoaSheet(rows); autoWidth(ws); const b=String(name).replace(/[\\/?*[\]:]/g,' ').slice(0,31); let s=b,i=2; while(used.has(s)) s=`${b.slice(0,28)} ${i++}`; used.add(s); XLSX.utils.book_append_sheet(wb,ws,s); };
      put(S.data,'Données par bâtiment'); S.data=null;
      if(S.ecoAny){ put([['Code interne','Nom opération',...ECONOMIC_FIELDS.map(f=>f.label)],...S.eco],'Données économiques'); if(S.det.length>1) put(S.det,'Lignes financières'); }
      put(S.relData,'Fiabilité par bâtiment'); put(S.tr,'Traçabilité');
      if(withOccurrences) put(S.oc,'Occurrences');
      put(S.bg,'Regroupement bâtiments'); put(S.conf,'Confort d’été');
      for(const G of S.grids){ if(!G.g) continue; const g=G.g;
        const head=['Code interne','Nom opération','Contrat',...g.themes.flatMap(t=>[`${t.name} — critères trouvés`,`${t.name} — indices suffisants`]),...g.criteria.flatMap(c=>c.kind==='stats'?STAT_KEYS.map(([,l])=>`${c.theme} — ${c.label} — ${l}`):[`${c.theme} — ${c.label}`])];
        put([head,...G.rows],g.name); }
      if(S.cites.length>1) put(S.cites,'Recherches — citations');
      const rr=[['Donnée','Sources principales','Sources secondaires','Sources interdites']];
      for(const f of FIELD_DEFS){ const r=rules[f.key]; rr.push([f.label,(r?.main||[]).join(' ; '),(r?.secondary||[]).join(' ; '),(r?.forbidden||[]).join(' ; ')]); }
      put(rr,'Règles sources');
    const info=[['Clé','Valeur'],['Application','ExtracTerre'],['Version',APP_VERSION],['Date export',new Date().toLocaleString('fr-FR')],['Projets',S.n],['Documents',S.docs],['Bâtiments consolidés',S.buildings],['Valeurs finales',S.finals],['Seuil de confiance',`${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`],['Bibliothèque isolants',`${INSULATION_LIBRARY_VARIANT_COUNT} variantes produit/épaisseur/R, dont ${CORE_INSULATION_VARIANT_COUNT} dans les familles cœur demandées`],['Version bibliothèque isolants',INSULATION_LIBRARY_VERSION],['Règle bibliothèque','Valeurs documentaires directes prioritaires ; bibliothèque uniquement en secours avec provenance explicite'],['Alertes',S.alerts],['Regroupement bâtiments','Variantes évidentes fusionnées automatiquement ; rapprochements ambigus uniquement après validation manuelle'],['Principe','Extraction déterministe locale sans IA'],
        ['Feuille Occurrences',withOccurrences?(S.ocRows>=OC_MAX?`Tronquée à ${OC_MAX} lignes (limite Excel)`:'Complète'):`Non incluse au-delà de ${EXCEL_OCCURRENCES_MAX_PROJECTS} opérations (valeurs retenues dans « Traçabilité »)`]];
      put(info,'Informations');
      const safe=(S.n===1?S.firstName:'Multi_projets').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80); XLSX.writeFile(wb,`ExtracTerre_${safe}.xlsx`);
    } };
}
export function exportProjectsExcel(projects,rules,{grids=[],identity=null}={}){
  const usable=(projects||[]).filter(p=>p?.result);
  if(!usable.length) throw new Error('Aucun projet analysé à exporter.');
  const c=createExcelCollector(rules,{grids,identity,withOccurrences:usable.length<=EXCEL_OCCURRENCES_MAX_PROJECTS});
  for(const p of usable) c.add(p); c.write();
}

export function exportExcel(result,rules,economic=null){ return exportProjectsExcel([{result,economic,operationName:result?.operation||''}],rules); }
