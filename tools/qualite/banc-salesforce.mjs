#!/usr/bin/env node
// ExtracTerre — banc de vérité Salesforce. Les valeurs Salesforce sont vérifiées par les évaluateurs (celles qui ont servi
// à la certification) : on mesure, sur toutes les opérations présentes à la fois dans l'export Salesforce et dans l'import
// massif, si la lecture des documents retrouve la même valeur. Rien n'est envoyé : tout est lu et écrit sur ce poste.
//
//   node tools/qualite/banc-salesforce.mjs --export "~/Downloads/Opérations ….xlsx" [--dossier-travail ~/ExtracTerre-import] [--relecture-legere]
//
// Sorties (dossier de travail, jamais versionnées) : qualite/<date>/detail.csv, par-champ.csv, par-methode.csv,
// par-type.csv, resume.txt, et calibration.json (statistiques par méthode de lecture, sans donnée d'opération).
import '../import/lib/runtime.mjs';
import '../import/lib/extract.mjs'; // packs d'amélioration chargés comme dans l'import massif
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import os from 'node:os';
import {createRequire} from 'node:module';
import {analyzeDocuments} from '../../js/engine.js';
import {DEFAULT_SOURCE_RULES,FIELD_MAP} from '../../js/config.js';
import {sfxParseHtmlTable,sfxColumns,sfxFiche,sfxHeaderRow} from '../../js/sf-export.js';
import {parseFreePaste,freePasteValues} from '../../js/collage-libre.js';
import {sfPerimeterMap} from '../../js/sf-perimeter.js';
import {canonicalBuilding} from '../../js/buildings.js';
import {compareToReference,reliabilityTable,RELIABILITY} from '../../js/qualite.js';

const require=createRequire(new URL('../import/package.json',import.meta.url));
const args={}; for(let i=2;i<process.argv.length;i++){ const a=process.argv[i]; if(a.startsWith('--')){ const k=a.slice(2); const v=process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[++i]:true; args[k]=v; } }
const home=p=>String(p||'').replace(/^~(?=\/|$)/,os.homedir());
if(!args.export){ console.log('Usage : node tools/qualite/banc-salesforce.mjs --export <export Salesforce .xlsx/.xls> [--dossier-travail <dossier>] [--contrats a,b]'); process.exit(1); }
const W=home(args['dossier-travail']||'~/ExtracTerre-import');

// 1. Export Salesforce → fiches par contrat
function readTable(file){
  const buf=fs.readFileSync(file); const head=buf.subarray(0,600).toString('latin1');
  if(/<table|<html|<head/i.test(head)) return sfxParseHtmlTable(buf.toString(/charset=(iso-8859-1|windows-1252|latin)/i.test(head)?'latin1':'utf8'));
  const XLSX=require('xlsx'); const wb=XLSX.read(buf,{type:'buffer'}); const ws=wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''}).map(r=>r.map(v=>String(v??'')));
}
const table0=readTable(home(args.export)); const hi=sfxHeaderRow(table0); const cols=sfxColumns(table0[hi]);
const sf=new Map();
for(const row of table0.slice(hi+1)){ const f=sfxFiche(row,cols); if(!f.contract||!f.hasTechnical) continue;
  const vals=freePasteValues(parseFreePaste(f.text)).filter(v=>Object.keys(v.values||{}).length); if(vals.length) sf.set(f.contract,{vals,status:f.evaluationStatus}); }

// 2. Import massif → consolidation des documents seuls (sans Salesforce ni saisie)
const reg=JSON.parse(fs.readFileSync(path.join(W,'registre.json'),'utf8'));
const byC={}; for(const f of Object.values(reg.files)) if(f.isCurrent&&!f.missing&&f.resultFile&&f.status!=='ignoré'&&fs.existsSync(path.join(W,f.resultFile))) (byC[f.contract]=byC[f.contract]||[]).push(f);
const only=args.contrats?new Set(String(args.contrats).split(',').map(s=>s.trim().replace(/^0+/,'').padStart(8,'0'))):null;
const contracts=Object.keys(byC).filter(c=>sf.has(c)&&(!only||only.has(c))).sort();
console.log(`Export Salesforce : ${sf.size} fiche(s) avec données techniques · import massif : ${Object.keys(byC).length} opération(s) · communes : ${contracts.length}`);

const detail=[]; const T=()=>({juste:0,faux:0,manquant:0,incomparable:0});
const byField={}, byMethod={}, byType={}; let ops=0; const perOp=[];
const bump=(o,k,r)=>{ (o[k]=o[k]||T())[r]++; };
for(const c of contracts){
  // --relecture-legere : les lecteurs actuels sont relancés sur le texte conservé (sans relire le PDF ni refaire l'OCR).
  const docs=byC[c].map(f=>{ const d={...JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(W,f.resultFile))).toString('utf8')).doc,status:'ready',file:null}; if(args['relecture-legere']&&d.read) d.cachedOccurrences=null; return d; });
  let res; try{ res=analyzeDocuments(docs,DEFAULT_SOURCE_RULES,''); }catch(e){ console.warn(`  ⚠ ${c} : ${e.message}`); continue; }
  ops++; const comps=[]; perOp.push({c,res,comps});
  const {vals,status}=sf.get(c);
  const common=vals.find(v=>!v.building)?.values||{}; const named=vals.filter(v=>v.building);
  const sfB=named.length?named.map(v=>({name:canonicalBuilding(v.building),values:{...common,...v.values}})):[{name:'',values:common}];
  const rows=res.rows||[]; const map=named.length?sfPerimeterMap(sfB.map(b=>b.name),rows.map(r=>r.building)).map:{};
  for(const b of sfB){
    const mine=named.length?rows.filter(r=>map[r.building]===b.name):rows;
    for(const [field,sv] of Object.entries(b.values)){
      if(!FIELD_MAP[field]||['building','contract_number','internal_code','evaluation_status','address','postcode','city','department'].includes(field)) continue;
      const cands=mine.filter(r=>r[field]!==undefined&&r[field]!==null&&r[field]!=='');
      let result='manquant', hit=null;
      if(cands.length){ const res2=cands.map(r=>[r,compareToReference(field,r[field],sv)]); const best=res2.find(x=>x[1]==='juste')||res2.find(x=>x[1]==='faux')||res2[0]; hit=best[0]; result=best[1]; }
      const o=hit?(res.finals||[]).find(x=>x.field===field&&(x.building===hit.building||x.building==='Bâtiment unique')):null;
      const method=o?.method||'', type=o?.docType||'';
      if((result==='juste'||result==='faux')&&hit) comps.push({b:hit.building,field,result,method});
      bump(byField,field,result); if(result==='juste'||result==='faux'){ bump(byMethod,method||'(inconnue)',result); bump(byType,type||'(inconnu)',result); }
      detail.push([c,status,b.name||'(opération)',FIELD_MAP[field].label,field,sv,hit?hit[field]:'',result,o?.fileName||'',o?.page??'',method,type,o?.confidence??'']);
    }
  }
}

// 3. Sorties
const stamp=new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
const out=path.join(W,'qualite',stamp); fs.mkdirSync(out,{recursive:true});
const csv=(rows)=>'﻿'+rows.map(r=>r.map(v=>{ const s=String(v??''); return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }).join(';')).join('\r\n');
const pct=x=>x===null?'':`${Math.round(x*1000)/10} %`;
const stat=(k,t)=>{ const n=t.juste+t.faux; return [k,t.juste,t.faux,t.manquant,t.incomparable,pct(n?t.juste/n:null),pct((t.juste+t.faux+t.manquant)?(t.juste+t.faux)/(t.juste+t.faux+t.manquant):null)]; };
const head=['clé','justes','faux','manquants','non comparables','exactitude (justes / lus)','couverture (lus / Salesforce)'];
fs.writeFileSync(path.join(out,'detail.csv'),csv([['contrat','statut évaluation','bâtiment Salesforce','champ','clé','valeur Salesforce','valeur documents','résultat','document','page','méthode','type de document','confiance'],...detail]));
const sorted=o=>Object.entries(o).sort((a,b)=>(b[1].juste+b[1].faux+b[1].manquant)-(a[1].juste+a[1].faux+a[1].manquant));
fs.writeFileSync(path.join(out,'par-champ.csv'),csv([head,...sorted(byField).map(([k,t])=>stat(`${FIELD_MAP[k]?.label||k} (${k})`,t))]));
fs.writeFileSync(path.join(out,'par-methode.csv'),csv([head,...sorted(byMethod).map(([k,t])=>stat(k,t))]));
fs.writeFileSync(path.join(out,'par-type.csv'),csv([head,...sorted(byType).map(([k,t])=>stat(k,t))]));
const tot=Object.values(byField).reduce((a,t)=>({juste:a.juste+t.juste,faux:a.faux+t.faux,manquant:a.manquant+t.manquant,incomparable:a.incomparable+t.incomparable}),T());
const pairs={}; for(const o of perOp) for(const k of o.comps){ const u=pairs[`${k.method}|${k.field}`]=pairs[`${k.method}|${k.field}`]||{juste:0,faux:0}; u[k.result]++; }
const calib={format:'extracterre-calibration',version:2,createdAt:new Date().toISOString(),operations:ops,pairs,methods:Object.fromEntries(Object.entries(byMethod).map(([k,t])=>[k,{juste:t.juste,faux:t.faux}])),fields:Object.fromEntries(Object.entries(byField).map(([k,t])=>[k,{juste:t.juste,faux:t.faux,manquant:t.manquant}]))};
fs.writeFileSync(path.join(out,'calibration.json'),JSON.stringify(calib,null,1));
// Validation croisée de la note de fiabilité : calibration sur une moitié des opérations, note évaluée sur l'autre.
const byGrade={}, byGradeWhy={}, gradeRows=[]; const half=x=>parseInt(x.c,10)%2;
for(const fold of [0,1]){
  const m={}, pr={}; for(const o of perOp.filter(x=>half(x)!==fold)) for(const k of o.comps){ const t=m[k.method]=m[k.method]||{juste:0,faux:0}; t[k.result]++; const u=pr[`${k.method}|${k.field}`]=pr[`${k.method}|${k.field}`]||{juste:0,faux:0}; u[k.result]++; }
  for(const o of perOp.filter(x=>half(x)===fold)){ const why={}; const rt=reliabilityTable(o.res,{calib:{methods:m,pairs:pr},reasons:why}); for(const k of o.comps){ const g=rt[k.b]?.[k.field]||'(aucune)'; (byGrade[g]=byGrade[g]||T())[k.result]++; const rk=`${g} · ${why[k.b]?.[k.field]||'?'}`; (byGradeWhy[rk]=byGradeWhy[rk]||T())[k.result]++; gradeRows.push([o.c,k.b,k.field,k.method,g,why[k.b]?.[k.field]||'',k.result]); } }
}
const gradeLines=['','Note de fiabilité (validation croisée) — part de valeurs justes par niveau :',...['certifiee','sure','probable','averifier','(aucune)'].filter(g=>byGrade[g]).map(g=>{ const t=byGrade[g], n=t.juste+t.faux; return `  ${(RELIABILITY[g]?.label||g).padEnd(40)} ${pct(t.juste/n).padStart(7)}  (${t.juste}/${n})`; })];
fs.writeFileSync(path.join(out,'niveaux-detail.csv'),csv([['contrat','bâtiment','champ','méthode','niveau','raison','résultat'],...gradeRows]));
gradeLines.push('','Par raison :',...Object.entries(byGradeWhy).sort().map(([k,t])=>`  ${k.padEnd(34)} ${pct(t.juste/(t.juste+t.faux)).padStart(7)}  (${t.juste}/${t.juste+t.faux})`));
fs.writeFileSync(path.join(out,'par-niveau.csv'),csv([head,...Object.entries(byGrade).map(([k,t])=>stat(RELIABILITY[k]?.label||k,t))]));
const lines=[`Banc de vérité Salesforce — ${new Date().toLocaleString('fr-FR')}`,`Opérations comparées : ${ops}`,
  `Valeurs Salesforce : ${tot.juste+tot.faux+tot.manquant+tot.incomparable} · justes ${tot.juste} · fausses ${tot.faux} · non trouvées ${tot.manquant} · non comparables ${tot.incomparable}`,
  `Exactitude (justes / valeurs lues) : ${pct(tot.juste/Math.max(1,tot.juste+tot.faux))} · couverture : ${pct((tot.juste+tot.faux)/Math.max(1,tot.juste+tot.faux+tot.manquant))}`,'',
  'Champs les moins justes (≥ 10 valeurs lues) :',...sorted(byField).filter(([,t])=>t.juste+t.faux>=10).sort((a,b)=>a[1].juste/(a[1].juste+a[1].faux)-b[1].juste/(b[1].juste+b[1].faux)).slice(0,15).map(([k,t])=>`  ${pct(t.juste/(t.juste+t.faux)).padStart(7)}  ${FIELD_MAP[k]?.label||k} (${t.juste}/${t.juste+t.faux})`),'',
  'Méthodes de lecture (≥ 10 valeurs lues) :',...sorted(byMethod).filter(([,t])=>t.juste+t.faux>=10).map(([k,t])=>`  ${pct(t.juste/(t.juste+t.faux)).padStart(7)}  ${k} (${t.juste}/${t.juste+t.faux})`)];
lines.push(...gradeLines);
fs.writeFileSync(path.join(out,'resume.txt'),lines.join('\n'));
console.log(lines.join('\n')); console.log(`\nRapports : ${out}`);
