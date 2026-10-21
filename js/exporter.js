import {APP_VERSION,FIELD_DEFS,FIELD_MAP,MIN_RETAINED_CONFIDENCE} from './config.js';
import {analyzeEconomicData,ECONOMIC_FIELDS,COST_CATEGORIES} from './economics.js';
import {INSULATION_LIBRARY_VERSION,INSULATION_LIBRARY_VARIANT_COUNT,CORE_INSULATION_VARIANT_COUNT} from './insulation-library.js';

function aoaSheet(rows){ return XLSX.utils.aoa_to_sheet(rows); }
function autoWidth(ws,max=42){ const range=XLSX.utils.decode_range(ws['!ref']||'A1:A1'); const widths=[]; for(let c=range.s.c;c<=range.e.c;c++){ let m=10; for(let r=range.s.r;r<=Math.min(range.e.r,250);r++){ const cell=ws[XLSX.utils.encode_cell({r,c})]; if(cell?.v!=null) m=Math.max(m,String(cell.v).length+2); } widths.push({wch:Math.min(max,m)}); } ws['!cols']=widths; }
function projectTagsText(p){ return (p?.projectTags||[]).map(t=>t?.label).filter(Boolean).join(' ; '); }
function projectName(p,index){ return (p?.customTitle||p?.operationName||p?.result?.operation||p?.label||`Projet ${index+1}`).trim(); }

export function exportProjectsExcel(projects,rules){
  if(!globalThis.XLSX) throw new Error('SheetJS non chargé.');
  const usable=(projects||[]).filter(p=>p?.result);
  if(!usable.length) throw new Error('Aucun projet analysé à exporter.');
  const wb=XLSX.utils.book_new();
  const fields=FIELD_DEFS;

  // La feuille principale respecte strictement le schéma métier : 192 colonnes dans l'ordre de référence
  // (les nouvelles colonnes sont toujours ajoutées à la fin), puis la colonne « Tags » du projet.
  const data=[[...fields.map(f=>f.label),'Tags']];
  usable.forEach((p,idx)=>{ const r=p.result, pname=projectName(p,idx); for(const row of r.rows){ data.push(fields.map(f=>{ if(f.key==='building') return row.building??''; if(f.key==='project') return row.project??pname; if(f.key==='operation') return row.operation??r.operation??pname; if(f.key==='operation_name') return row.operation_name??p.operationName??r.operation??''; return row[f.key]??''; }).concat([projectTagsText(p)])); } });
  const ws1=aoaSheet(data); autoWidth(ws1); XLSX.utils.book_append_sheet(wb,ws1,'Données par bâtiment');

  // v2.5.0 — 2e feuille : nomenclature économique (une ligne par opération), identifiant du projet en tête.
  const blank=v=>v===undefined||v===null||v===''||v==='non précisé';
  const eco=usable.map((p,idx)=>{ const e=analyzeEconomicData(p.docs||[],p.result?.operation||'',p.manualEconomics||{}); const rows=p.result?.rows||[]; const first=k=>rows.map(r=>r[k]).find(x=>!blank(x));
    return {p,e,code:first('internal_code')??e.values.fin_operation_code??'',name:first('operation_name')??(p.operationName||p.result?.operation||e.values.fin_operation_label||projectName(p,idx))}; });
  if(eco.some(x=>x.e.source||Object.keys(x.e.values).length)){
    const sheet=[['Code interne','Nom opération',...ECONOMIC_FIELDS.map(f=>f.label)],...eco.map(x=>[x.code,x.name,...ECONOMIC_FIELDS.map(f=>x.e.values[f.key]??'')])];
    const wsE=aoaSheet(sheet); autoWidth(wsE); XLSX.utils.book_append_sheet(wb,wsE,'Données économiques');
    const det=[['Code interne','Nom opération','Type','Source','Lot / poste / aide','Catégorie','Porteur','Calcul','Montant (€)','Statut','Commentaire','Document','Page']];
    for(const x of eco){ for(const l of x.e.costs) det.push([x.code,x.name,'Coût',l.source,l.label,COST_CATEGORIES.find(c=>c.id===l.category)?.label||l.category,'','',l.amount,'',l.comment||'',l.document||'',l.page??'']);
      for(const a of x.e.aids) det.push([x.code,x.name,'Aide','',a.label,a.category,a.level,a.calc,a.amount,a.status,a.comment||'',a.document||'',a.page??'']); }
    if(det.length>1){ const wsD=aoaSheet(det); autoWidth(wsD); XLSX.utils.book_append_sheet(wb,wsD,'Lignes financières'); }
  }

  const tr=[['Projet','Opération','Bâtiment consolidé','Nom bâtiment source','Donnée','Valeur','Source','Type document','Page','Confiance','Méthode','Origine','Commentaire','Extrait']];
  usable.forEach((p,idx)=>{ const r=p.result,pname=projectName(p,idx); for(const o of r.finals) tr.push([pname,r.operation||pname,o.building,o.originalBuilding||o.building,FIELD_MAP[o.field]?.label||o.field,o.value,o.fileName,o.docType,o.page,o.confidence,o.method,o.origin||'Document',o.provenanceNote||'',o.excerpt]); });
  const ws2=aoaSheet(tr); autoWidth(ws2); XLSX.utils.book_append_sheet(wb,ws2,'Traçabilité');

  const oc=[['Projet','Bâtiment consolidé','Nom bâtiment source','Donnée','Valeur','Source','Type document','Page','Confiance','Routage','Statut','Motif rejet','Méthode','Origine','Commentaire','Extrait']];
  usable.forEach((p,idx)=>{ const pname=projectName(p,idx); for(const o of p.result.detailed) oc.push([pname,o.building,o.originalBuilding||o.building,FIELD_MAP[o.field]?.label||o.field,o.value,o.fileName,o.docType,o.page,o.confidence,o.sourceTier,o.status,o.rejectionReason||'',o.method,o.origin||'Document',o.provenanceNote||'',o.excerpt]); });
  const ws3=aoaSheet(oc); autoWidth(ws3); XLSX.utils.book_append_sheet(wb,ws3,'Occurrences');

  const bg=[['Projet','Nom détecté','Bâtiment consolidé','Mode de regroupement']];
  usable.forEach((p,idx)=>{ const pname=projectName(p,idx); for(const a of p.result.buildingAliases||[]) bg.push([pname,a.source,a.target,a.mode]); });
  const wsBg=aoaSheet(bg); autoWidth(wsBg); XLSX.utils.book_append_sheet(wb,wsBg,'Regroupement bâtiments');

  const rr=[['Donnée','Sources principales','Sources secondaires','Sources interdites']];
  for(const f of FIELD_DEFS){ const r=rules[f.key]; rr.push([f.label,(r?.main||[]).join(' ; '),(r?.secondary||[]).join(' ; '),(r?.forbidden||[]).join(' ; ')]); }
  const ws4=aoaSheet(rr); autoWidth(ws4); XLSX.utils.book_append_sheet(wb,ws4,'Règles sources');

  const totalDocs=usable.reduce((n,p)=>n+(p.result?.documentsCount||0),0), totalBuildings=usable.reduce((n,p)=>n+(p.result?.buildings?.length||0),0), totalFinals=usable.reduce((n,p)=>n+(p.result?.finals?.length||0),0), totalAlerts=usable.reduce((n,p)=>n+(p.result?.alerts?.length||0),0);
  const info=[['Clé','Valeur'],['Application','ExtracTerre'],['Version',APP_VERSION],['Date export',new Date().toLocaleString('fr-FR')],['Projets',usable.length],['Documents',totalDocs],['Bâtiments consolidés',totalBuildings],['Valeurs finales',totalFinals],['Seuil de confiance',`${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`],['Bibliothèque isolants',`${INSULATION_LIBRARY_VARIANT_COUNT} variantes produit/épaisseur/R, dont ${CORE_INSULATION_VARIANT_COUNT} dans les familles cœur demandées`],['Version bibliothèque isolants',INSULATION_LIBRARY_VERSION],['Règle bibliothèque','Valeurs documentaires directes prioritaires ; bibliothèque uniquement en secours avec provenance explicite'],['Alertes',totalAlerts],['Regroupement bâtiments','Variantes évidentes fusionnées automatiquement ; rapprochements ambigus uniquement après validation manuelle'],['Principe','Extraction déterministe locale sans IA']];
  const ws5=aoaSheet(info); autoWidth(ws5); XLSX.utils.book_append_sheet(wb,ws5,'Informations');
  const safe=(usable.length===1?projectName(usable[0],0):'Multi_projets').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80); XLSX.writeFile(wb,`ExtracTerre_${safe}.xlsx`);
}

export function exportExcel(result,rules,economic=null){ return exportProjectsExcel([{result,economic,operationName:result?.operation||''}],rules); }
