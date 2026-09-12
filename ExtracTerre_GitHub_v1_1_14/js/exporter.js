import {APP_VERSION,FIELD_DEFS,FIELD_MAP,MIN_RETAINED_CONFIDENCE} from './config.js';
import {INSULATION_LIBRARY_VERSION,INSULATION_LIBRARY_VARIANT_COUNT,CORE_INSULATION_VARIANT_COUNT} from './insulation-library.js';

function aoaSheet(rows){ return XLSX.utils.aoa_to_sheet(rows); }
function autoWidth(ws,max=42){ const range=XLSX.utils.decode_range(ws['!ref']||'A1:A1'); const widths=[]; for(let c=range.s.c;c<=range.e.c;c++){ let m=10; for(let r=range.s.r;r<=Math.min(range.e.r,250);r++){ const cell=ws[XLSX.utils.encode_cell({r,c})]; if(cell?.v!=null) m=Math.max(m,String(cell.v).length+2); } widths.push({wch:Math.min(max,m)}); } ws['!cols']=widths; }
function projectName(p,index){ return (p?.customTitle||p?.operationName||p?.result?.operation||p?.label||`Projet ${index+1}`).trim(); }

export function exportProjectsExcel(projects,rules){
  if(!globalThis.XLSX) throw new Error('SheetJS non chargé.');
  const usable=(projects||[]).filter(p=>p?.result);
  if(!usable.length) throw new Error('Aucun projet analysé à exporter.');
  const wb=XLSX.utils.book_new();
  const fields=FIELD_DEFS;

  // La feuille principale respecte strictement le schéma métier demandé : 167 colonnes, mêmes intitulés, même ordre.
  const data=[fields.map(f=>f.label)];
  usable.forEach((p,idx)=>{ const r=p.result, pname=projectName(p,idx); for(const row of r.rows){ data.push(fields.map(f=>{ if(f.key==='building') return row.building??''; if(f.key==='project') return row.project??pname; if(f.key==='operation') return row.operation??r.operation??pname; if(f.key==='operation_name') return row.operation_name??p.operationName??r.operation??''; return row[f.key]??''; })); } });
  const ws1=aoaSheet(data); autoWidth(ws1); XLSX.utils.book_append_sheet(wb,ws1,'Données par bâtiment');

  const tr=[['Projet','Opération','Bâtiment consolidé','Nom bâtiment source','Donnée','Valeur','Source','Type document','Page','Confiance','Méthode','Origine','Commentaire','Extrait']];
  usable.forEach((p,idx)=>{ const r=p.result,pname=projectName(p,idx); for(const o of r.finals) tr.push([pname,r.operation||pname,o.building,o.originalBuilding||o.building,FIELD_MAP[o.field]?.label||o.field,o.value,o.fileName,o.docType,o.page,o.confidence,o.method,o.origin||'Document',o.provenanceNote||'',o.excerpt]); });
  const ws2=aoaSheet(tr); autoWidth(ws2); XLSX.utils.book_append_sheet(wb,ws2,'Traçabilité');

  const oc=[['Projet','Bâtiment consolidé','Nom bâtiment source','Donnée','Valeur','Source','Type document','Page','Confiance','Routage','Statut','Motif rejet','Méthode','Origine','Commentaire','Extrait']];
  usable.forEach((p,idx)=>{ const pname=projectName(p,idx); for(const o of p.result.detailed) oc.push([pname,o.building,o.originalBuilding||o.building,FIELD_MAP[o.field]?.label||o.field,o.value,o.fileName,o.docType,o.page,o.confidence,o.sourceTier,o.status,o.rejectionReason||'',o.method,o.origin||'Document',o.provenanceNote||'',o.excerpt]); });
  const ws3=aoaSheet(oc); autoWidth(ws3); XLSX.utils.book_append_sheet(wb,ws3,'Occurrences');

  const bg=[['Projet','Nom détecté','Bâtiment consolidé','Mode de regroupement']];
  usable.forEach((p,idx)=>{ const pname=projectName(p,idx); for(const a of p.result.buildingAliases||[]) bg.push([pname,a.source,a.target,a.mode]); });
  const wsBg=aoaSheet(bg); autoWidth(wsBg); XLSX.utils.book_append_sheet(wb,wsBg,'Regroupement bâtiments');

  const allLotLabels=[]; const seenLots=new Set();
  usable.forEach(p=>{ for(const lot of p.economic?.lots||[]){ if(!seenLots.has(lot.label)){ seenLots.add(lot.label); allLotLabels.push(lot.label); } } });
  if(allLotLabels.length){
    const econ=[['Projet','Opération',...allLotLabels,'Total HT travaux']];
    usable.forEach((p,idx)=>{ const pname=projectName(p,idx), map=new Map((p.economic?.lots||[]).map(x=>[x.label,x.amount])); econ.push([pname,p.economic?.operation||p.result.operation||pname,...allLotLabels.map(l=>map.get(l)??''),p.economic?.total??'']); });
    const wsEco=aoaSheet(econ); autoWidth(wsEco); XLSX.utils.book_append_sheet(wb,wsEco,'Données économiques');
  }

  const rr=[['Donnée','Sources principales','Sources secondaires','Sources interdites']];
  for(const f of FIELD_DEFS){ const r=rules[f.key]; rr.push([f.label,(r?.main||[]).join(' ; '),(r?.secondary||[]).join(' ; '),(r?.forbidden||[]).join(' ; ')]); }
  const ws4=aoaSheet(rr); autoWidth(ws4); XLSX.utils.book_append_sheet(wb,ws4,'Règles sources');

  const totalDocs=usable.reduce((n,p)=>n+(p.result?.documentsCount||0),0), totalBuildings=usable.reduce((n,p)=>n+(p.result?.buildings?.length||0),0), totalFinals=usable.reduce((n,p)=>n+(p.result?.finals?.length||0),0), totalAlerts=usable.reduce((n,p)=>n+(p.result?.alerts?.length||0),0);
  const info=[['Clé','Valeur'],['Application','ExtracTerre'],['Version',APP_VERSION],['Date export',new Date().toLocaleString('fr-FR')],['Projets',usable.length],['Documents',totalDocs],['Bâtiments consolidés',totalBuildings],['Valeurs finales',totalFinals],['Seuil de confiance',`${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`],['Bibliothèque isolants',`${INSULATION_LIBRARY_VARIANT_COUNT} variantes produit/épaisseur/R, dont ${CORE_INSULATION_VARIANT_COUNT} dans les familles cœur demandées`],['Version bibliothèque isolants',INSULATION_LIBRARY_VERSION],['Règle bibliothèque','Valeurs documentaires directes prioritaires ; bibliothèque uniquement en secours avec provenance explicite'],['Alertes',totalAlerts],['Regroupement bâtiments','Variantes évidentes fusionnées automatiquement ; rapprochements ambigus uniquement après validation manuelle'],['Principe','Extraction déterministe locale sans IA']];
  const ws5=aoaSheet(info); autoWidth(ws5); XLSX.utils.book_append_sheet(wb,ws5,'Informations');
  const safe=(usable.length===1?projectName(usable[0],0):'Multi_projets').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80); XLSX.writeFile(wb,`ExtracTerre_${safe}.xlsx`);
}

export function exportExcel(result,rules,economic=null){ return exportProjectsExcel([{result,economic,operationName:result?.operation||''}],rules); }
