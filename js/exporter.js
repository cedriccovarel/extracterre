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

export function exportProjectsExcel(projects,rules,{grids=[],identity=null}={}){
  if(!globalThis.XLSX) throw new Error('SheetJS non chargé.');
  const usable=(projects||[]).filter(p=>p?.result);
  if(!usable.length) throw new Error('Aucun projet analysé à exporter.');
  const wb=XLSX.utils.book_new();
  const fields=FIELD_DEFS.filter(f=>!f.hidden); // DH (interne) remplacé par DH ZT / DH ZNT

  // La feuille principale respecte strictement le schéma métier : 192 colonnes dans l'ordre de référence
  // (les nouvelles colonnes sont toujours ajoutées à la fin), puis la colonne « Tags » du projet.
  const data=[[...fields.map(f=>f.label),'Tags']];
  usable.forEach((p,idx)=>{ const r=p.result, pname=projectName(p,idx); for(const row of r.rows){ data.push(fields.map(f=>{ if(f.key==='building') return row.building??''; if(f.key==='project') return row.project??pname; if(f.key==='operation') return row.operation??r.operation??pname; if(f.key==='operation_name') return row.operation_name??p.operationName??r.operation??''; return row[f.key]??''; }).concat([projectTagsText(p)])); } });
  const ws1=aoaSheet(data); autoWidth(ws1); XLSX.utils.book_append_sheet(wb,ws1,'Données par bâtiment');


  // v2.5.0 — 2e feuille : nomenclature économique (une ligne par opération), identifiant du projet en tête.
  const blank=v=>v===undefined||v===null||v===''||v==='non précisé';
  const eco=usable.map((p,idx)=>{ const off=new Set(p.economicExcluded||[]); const e=analyzeEconomicData((p.docs||[]).filter(d=>!off.has(d.id)),p.result?.operation||'',p.manualEconomics||{}); const rows=p.result?.rows||[]; const first=k=>rows.map(r=>r[k]).find(x=>!blank(x));
    return {p,e,code:first('internal_code')??e.values.fin_operation_code??'',name:first('operation_name')??(p.operationName||p.result?.operation||e.values.fin_operation_label||projectName(p,idx))}; });
  if(eco.some(x=>x.e.source||Object.keys(x.e.values).length)){
    const sheet=[['Code interne','Nom opération',...ECONOMIC_FIELDS.map(f=>f.label)],...eco.map(x=>[x.code,x.name,...ECONOMIC_FIELDS.map(f=>x.e.values[f.key]??'')])];
    const wsE=aoaSheet(sheet); autoWidth(wsE); XLSX.utils.book_append_sheet(wb,wsE,'Données économiques');
    const det=[['Code interne','Nom opération','Type','Source','Lot / poste / aide','Catégorie','Porteur','Calcul','Montant (€)','Statut','Commentaire','Document','Page']];
    for(const x of eco){ for(const l of x.e.costs) det.push([x.code,x.name,'Coût',l.source,l.label,COST_CATEGORIES.find(c=>c.id===l.category)?.label||l.category,'','',l.amount,'',l.comment||'',l.document||'',l.page??'']);
      for(const a of x.e.aids) det.push([x.code,x.name,'Aide','',a.label,a.category,a.level,a.calc,a.amount,a.status,a.comment||'',a.document||'',a.page??'']); }
    if(det.length>1){ const wsD=aoaSheet(det); autoWidth(wsD); XLSX.utils.book_append_sheet(wb,wsD,'Lignes financières'); }
  }

  // v2.34.0 — même grille, niveau de fiabilité de chaque valeur (Certifiée / Sûre / Probable / À vérifier) ; lue par TotalRecoll.
  const relData=[[...fields.map(f=>f.label)]];
  usable.forEach(p=>{ const t=reliabilityTable(p.result); for(const row of p.result.rows){ const m=t[row.building]||{}; relData.push(fields.map(f=>f.key==='building'?(row.building??''):f.key==='contract_number'?(row.contract_number??''):f.key==='internal_code'?(row.internal_code??''):(m[f.key]?RELIABILITY[m[f.key]].short:''))); } });
  const wsR=aoaSheet(relData); autoWidth(wsR); XLSX.utils.book_append_sheet(wb,wsR,'Fiabilité par bâtiment');
  const tr=[['Projet','Opération','Bâtiment consolidé','Nom bâtiment source','Donnée','Valeur','Fiabilité','Source','Type document','Page','Confiance','Méthode','Origine','Commentaire','Extrait']];
  usable.forEach((p,idx)=>{ const r=p.result,pname=projectName(p,idx),rt=reliabilityTable(r); for(const o of r.finals) tr.push([pname,r.operation||pname,o.building,o.originalBuilding||o.building,FIELD_MAP[o.field]?.label||o.field,o.value,RELIABILITY[rt[o.building]?.[o.field]]?.short||'',o.fileName,o.docType,o.page,o.confidence,o.method,o.origin||'Document',o.provenanceNote||'',o.excerpt]); });
  const ws2=aoaSheet(tr); autoWidth(ws2); XLSX.utils.book_append_sheet(wb,ws2,'Traçabilité');

  const oc=[['Projet','Bâtiment consolidé','Nom bâtiment source','Donnée','Valeur','Source','Type document','Page','Confiance','Routage','Statut','Motif rejet','Méthode','Origine','Commentaire','Extrait']];
  usable.forEach((p,idx)=>{ const pname=projectName(p,idx); for(const o of p.result.detailed) oc.push([pname,o.building,o.originalBuilding||o.building,FIELD_MAP[o.field]?.label||o.field,o.value,o.fileName,o.docType,o.page,o.confidence,o.sourceTier,o.status,o.rejectionReason||'',o.method,o.origin||'Document',o.provenanceNote||'',o.excerpt]); });
  const ws3=aoaSheet(oc); autoWidth(ws3); XLSX.utils.book_append_sheet(wb,ws3,'Occurrences');

  const bg=[['Projet','Nom détecté','Bâtiment consolidé','Mode de regroupement']];
  usable.forEach((p,idx)=>{ const pname=projectName(p,idx); for(const a of p.result.buildingAliases||[]) bg.push([pname,a.source,a.target,a.mode]); });
  const wsBg=aoaSheet(bg); autoWidth(wsBg); XLSX.utils.book_append_sheet(wb,wsBg,'Regroupement bâtiments');

  // v2.36.7 — une feuille par recherche, toujours présente : « Confort d'été » (une ligne par bâtiment, une colonne par résultat),
  // puis chaque grille de recherche (« Sécurité des logements »…), même sans résultat trouvé.
  const contract=x=>(identity?identity(x.p).contract:'')||'', used=new Set(wb.SheetNames);
  const sheetName=n=>{ const b=String(n).replace(/[\\/?*[\]:]/g,' ').slice(0,31); let s=b,i=2; while(used.has(s)) s=`${b.slice(0,28)} ${i++}`; used.add(s); return s; };
  const cf=CONFORT_KEYS.filter(k=>FIELD_MAP[k]);
  const ck=CONSTRUCTIVE_KEYS.filter(k=>FIELD_MAP[k]);
  const conf=[['Code interne','Nom opération','Contrat','Bâtiment','Système constructif','Système constructif — précision',...ck.map(k=>FIELD_MAP[k].label),...cf.map(k=>FIELD_MAP[k].label)]];
  for(const x of eco) for(const row of x.p.result.rows){ const s=constructiveSystem(row);
    conf.push([x.code,x.name,contract(x),row.building??'',s.system,s.note,...ck.map(k=>row[k]??''),...cf.map(k=>row[k]??'')]); }
  { const ws=aoaSheet(conf); autoWidth(ws); XLSX.utils.book_append_sheet(wb,ws,sheetName('Confort d’été')); }
  const cites=[['Code interne','Nom opération','Contrat','Grille','Thème','Critère','Document','Page','Ligne','Valeurs']];
  for(const grid of grids||[]){
    const res=eco.map(x=>({x,r:runSearchGrid(grid,x.p.docs||[],x.p.searchOverrides?.[grid.id]||{},x.p.planTables,x.p.planChecks,x.p.result)}));
    const g=res[0].r.grid;
    const head=['Code interne','Nom opération','Contrat',...g.themes.flatMap(t=>[`${t.name} — critères trouvés`,`${t.name} — indices suffisants`]),...g.criteria.flatMap(c=>c.kind==='stats'?STAT_KEYS.map(([,l])=>`${c.theme} — ${c.label} — ${l}`):[`${c.theme} — ${c.label}`])];
    const sheet=[head,...res.map(({x,r})=>[x.code,x.name,contract(x),...g.themes.flatMap(t=>{ const s=r.themes[t.name]; return [s.applicable===false?'':`${s.found} / ${t.min}`,s.applicable===false?'Non applicable':s.ok?'Oui':'Non']; }),...g.criteria.flatMap(c=>c.kind==='stats'?STAT_KEYS.map(([k])=>r.criteria[c.id].stats?.[k]??''):[searchCellValue(c,r.criteria[c.id])])])];
    const ws=aoaSheet(sheet); autoWidth(ws); XLSX.utils.book_append_sheet(wb,ws,sheetName(g.name));
    for(const {x,r} of res) for(const c of g.criteria) for(const ev of r.criteria[c.id].evidence) cites.push([x.code,x.name,contract(x),g.name,c.theme,c.label,ev.doc,ev.page,ev.line,(ev.values||[]).join(' ; ')]);
  }
  if(cites.length>1){ const ws=aoaSheet(cites); autoWidth(ws); XLSX.utils.book_append_sheet(wb,ws,'Recherches — citations'); }

  const rr=[['Donnée','Sources principales','Sources secondaires','Sources interdites']];
  for(const f of FIELD_DEFS){ const r=rules[f.key]; rr.push([f.label,(r?.main||[]).join(' ; '),(r?.secondary||[]).join(' ; '),(r?.forbidden||[]).join(' ; ')]); }
  const ws4=aoaSheet(rr); autoWidth(ws4); XLSX.utils.book_append_sheet(wb,ws4,'Règles sources');

  const totalDocs=usable.reduce((n,p)=>n+(p.result?.documentsCount||0),0), totalBuildings=usable.reduce((n,p)=>n+(p.result?.buildings?.length||0),0), totalFinals=usable.reduce((n,p)=>n+(p.result?.finals?.length||0),0), totalAlerts=usable.reduce((n,p)=>n+(p.result?.alerts?.length||0),0);
  const info=[['Clé','Valeur'],['Application','ExtracTerre'],['Version',APP_VERSION],['Date export',new Date().toLocaleString('fr-FR')],['Projets',usable.length],['Documents',totalDocs],['Bâtiments consolidés',totalBuildings],['Valeurs finales',totalFinals],['Seuil de confiance',`${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`],['Bibliothèque isolants',`${INSULATION_LIBRARY_VARIANT_COUNT} variantes produit/épaisseur/R, dont ${CORE_INSULATION_VARIANT_COUNT} dans les familles cœur demandées`],['Version bibliothèque isolants',INSULATION_LIBRARY_VERSION],['Règle bibliothèque','Valeurs documentaires directes prioritaires ; bibliothèque uniquement en secours avec provenance explicite'],['Alertes',totalAlerts],['Regroupement bâtiments','Variantes évidentes fusionnées automatiquement ; rapprochements ambigus uniquement après validation manuelle'],['Principe','Extraction déterministe locale sans IA']];
  const ws5=aoaSheet(info); autoWidth(ws5); XLSX.utils.book_append_sheet(wb,ws5,'Informations');
  const safe=(usable.length===1?projectName(usable[0],0):'Multi_projets').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80); XLSX.writeFile(wb,`ExtracTerre_${safe}.xlsx`);
}

export function exportExcel(result,rules,economic=null){ return exportProjectsExcel([{result,economic,operationName:result?.operation||''}],rules); }
