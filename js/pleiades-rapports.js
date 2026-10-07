// v2.3.7 — Autres éditions Pléiades (IZUBA) :
//  • « Rapport ACV » / « Récapitulatif du calcul réglementaire — Partie Environnement » : par bâtiment
//    (« Données générales Bâtiment 2 »), lignes « Ic construction max 2028 kg eq CO2/m² 624.37 ».
//    Les blocs « Zone Zone 2 » répètent les mêmes indicateurs à l'échelle de la zone : ignorés.
//  • « Tableau de synthèse des prestations thermiques » : tableau Résultats
//    « 62,2 / 71,5 points 83,9 / 89,4 kWh EP/m² 16,1 / 73,6 kWh EP/m² 82.75 / 588.8 kg eq. CO2 » puis « Bâtiment 1 ».
//  • « Synthèse des déperditions (NF EN 12831) » : calcul de puissance, aucune donnée du référentiel ExtracTerre
//    (seul le département est relevé) — évite les faux bâtiments et valeurs parasites.
import {normalizeText,parseFrNumber} from './utils.js';

const pr_lineText=l=>normalizeText(l?.text||'');
const pr_nums=s=>(String(s||'').match(/[-+]?\d+(?:[.,]\d+)?/g)||[]).map(x=>parseFrNumber(x)).filter(v=>v!==null);
function pr_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:pr_lineText(line)}));
  return out;
}

export function isPleiadesAcvReport(doc){
  const t=String(doc?.read?.text||'').slice(0,300000);
  return /Ic\s+construction\s+max\s+20\d\d\s+kg\s+eq\s+CO2\/m/i.test(t)&&/Donnees\s+generales\s+Batiment|Indicateurs\s+de\s+performance/i.test(t);
}
export function isPleiadesServicesSummary(doc){
  const t=String(doc?.read?.text||'').slice(0,200000);
  return /Tableau\s+de\s+synthese\s+des\s+prestations\s+thermiques/i.test(t);
}
export function isHeatLossReport(doc){
  const t=String(doc?.read?.text||'').slice(0,60000);
  return /deperditions\s+suivant\s+la\s+norme\s+(?:EN\s+)?12831/i.test(t);
}
export function pleiadesReportBuildingNames(doc){
  const names=[];
  for(const x of pr_allLines(doc)){
    let m;
    if(isPleiadesAcvReport(doc)&&(m=x.t.match(/^Donnees\s+generales\s+(Batiment\s+.+)$/i))) names.push(m[1].trim());
    if(isPleiadesServicesSummary(doc)&&(m=x.t.match(/^(Batiment\s+\S+)\s+(?:Conforme|Non\s+conforme)\b/i))) names.push(m[1].trim());
    if(isHeatLossReport(doc)&&(m=x.t.match(/^Batiment\s+(Batiment\s+\S+)\s*$/i))) names.push(m[1].trim());
  }
  return [...new Set(names)];
}

const ACV_LINES=[
  [/^Ic\s+construction\s+max\s+2028\s/i,'ic_construction_max_2028'],[/^Ic\s+construction\s+max\s+kg/i,'ic_construction_max'],[/^Ic\s+construction\s+kg/i,'ic_construction'],
  [/^Ic\s+energie\s+max\s+2028\s/i,'ic_energy_max_2028'],[/^Ic\s+energie\s+max\s+kg/i,'ic_energy_max'],[/^Ic\s+energie\s+kg/i,'ic_energy'],
  [/^Ic\s+composants?\s+kg/i,'ic_components'],[/^Ic\s+chantier\s+kg/i,'ic_site'],[/^Stock\s+c\s+batiment\s+kg/i,'stock_c_per_m2']
];

export function parsePleiadesAcvReport(doc,occ,canonical=(s)=>s){
  const out=[]; let building=null, scope='building';
  const origin='Pléiades — rapport ACV (partie environnement)';
  for(const x of pr_allLines(doc)){
    let m;
    if((m=x.t.match(/^Donnees\s+generales\s+(Batiment\s+.+)$/i))){ building=m[1].trim(); scope='building'; continue; }
    if(/^Zone\s+Zone\b|^Quantitatifs\s+saisis\s+Zone\b|^Resultats\s+detailles.*\bZone\b/i.test(x.t)){ scope='zone'; continue; }
    if(!building||scope!=='building') continue;
    for(const [re,field] of ACV_LINES){
      if(!re.test(x.t)) continue;
      const v=pr_nums(x.t.replace(/CO2/gi,'').replace(/m²|m2/gi,'')); const val=v.length?v[v.length-1]:null; if(val===null) break;
      if(out.some(o=>o.field===field&&o.building===canonical(building))) break;
      const o=occ(doc,x.page,x.line,field,val,'pleiades-acv:indicateur',0.99,field==='stock_c_per_m2'?'kgC/m²':'kgCO2e/m²',{building:canonical(building),structuredPdf:true,origin,...(field==='stock_c_per_m2'?{provenanceNote:'« Stock c bâtiment » (stockage carbone, kgC/m² malgré l’unité affichée).'}:{})});
      if(o) out.push(o); break;
    }
  }
  return out;
}

export function parsePleiadesServicesSummary(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=pr_allLines(doc);
  const origin='Pléiades — tableau de synthèse des prestations thermiques';
  const P='([\\d.,]+)\\s*\\/\\s*([\\d.,]+)';
  const re=new RegExp(`^${P}\\s*points\\s+${P}\\s*kWh\\s*EP\\/m²?2?\\s+${P}\\s*kWh\\s*EP\\/m²?2?\\s+${P}\\s*kg`,'i');
  lines.forEach((x,i)=>{
    const m=x.t.match(re); if(!m) return;
    const b=(lines[i+1]?.t.match(/^(Batiment\s+\S+)/i)||[])[1]; if(!b) return;
    const v=m.slice(1).map(s=>parseFrNumber(s)); const B=canonical(b);
    const emit=(field,val,unit)=>{ const o=occ(doc,x.page,x.line,field,val,'pleiades-prestations:resultats',0.99,unit,{building:B,structuredPdf:true,origin}); if(o) out.push(o); };
    emit('bbio',v[0],'points'); emit('bbio_max',v[1],'points'); emit('cep',v[2],'kWhEP/m².an'); emit('cep_max',v[3],'kWhEP/m².an');
    emit('cepnr',v[4],'kWhEP/m².an'); emit('cepnr_max',v[5],'kWhEP/m².an'); emit('ic_energy',v[6],'kgCO2e/m²'); emit('ic_energy_max',v[7],'kgCO2e/m²');
  });
  // Systèmes communs (section « Systèmes ») : production et émetteurs, valables pour tous les bâtiments.
  const sys=lines.findIndex(x=>/^Systemes$/i.test(x.t));
  if(sys>=0){
    const block=lines.slice(sys,sys+20); const common=(field,val,l,conf=0.95)=>{ const o=occ(doc,l.page,l.line,field,val,'pleiades-prestations:systemes',conf,'',{building:'Bâtiment unique',structuredPdf:true,origin}); if(o) out.push(o); };
    const gen=block.find(l=>/chaudiere\s+(?:biomasse|bois|granul)/i.test(l.t)); if(gen){ common('heating_mode_after','Chaudière biomasse',gen); common('heating_vector_after','Bois / biomasse',gen); if(/ECS/i.test(gen.t)){ common('ecs','Chaudière',gen,0.93); common('ecs_vector_after','Bois / biomasse',gen,0.93); } }
    const pac=block.find(l=>/pompe\s+a\s+chaleur|\bPAC\b/i.test(l.t)); if(pac&&!gen) common('heating_mode_after','PAC',pac,0.9);
  }
  return out;
}

export function parseHeatLossReport(doc,occ){
  const x=pr_allLines(doc).find(y=>/^Departement\s*:\s*(\d{2,3}|2A|2B)\s*-/i.test(y.t)); if(!x) return [];
  const o=occ(doc,x.page,x.line,'department',x.t.match(/^Departement\s*:\s*(\d{2,3}|2A|2B)/i)[1].padStart(2,'0'),'deperditions:department',0.97,'',{building:'Bâtiment unique',structuredPdf:true,origin:'Synthèse des déperditions (NF EN 12831)'});
  return o?[o]:[];
}
