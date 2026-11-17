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
import {analyzeDocuments,ENGINE_OPTIONS} from '../../js/engine.js';
import {LEARNED_RANKING} from '../../js/classement-appris.js';
import {DEFAULT_SOURCE_RULES,FIELD_MAP} from '../../js/config.js';
import {obsoleteFolderOf} from '../../js/import-rules.js';
import {sfxParseHtmlTable,sfxColumns,sfxFiche,sfxHeaderRow} from '../../js/sf-export.js';
import {parseFreePaste,freePasteValues} from '../../js/collage-libre.js';
import {sfPerimeterMap,sfPerimeter,sfSplitGroup} from '../../js/sf-perimeter.js';
import {canonicalBuilding} from '../../js/buildings.js';
import {compareToReference,reliabilityTable,RELIABILITY,recoupement,sfReliability,SF_RELIABILITY} from '../../js/qualite.js';
import {oddValue} from '../../js/sanity.js';

const require=createRequire(new URL('../import/package.json',import.meta.url));
const args={}; for(let i=2;i<process.argv.length;i++){ const a=process.argv[i]; if(a.startsWith('--')){ const k=a.slice(2); const v=process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[++i]:true; args[k]=v; } }
const home=p=>String(p||'').replace(/^~(?=\/|$)/,os.homedir());
if(!args.export){ console.log('Usage : node tools/qualite/banc-salesforce.mjs --export <export Salesforce .xlsx/.xls> [--dossier-travail <dossier>] [--contrats a,b] [--sans-version-fichier] [--avec-perimes]'); process.exit(1); }
const W=home(args['dossier-travail']||'~/ExtracTerre-import');
// v3.0.2 — --classement <table.json> : table de classement appris injectée (mesure en validation croisée : table apprise sur l'autre moitié).
if(args.classement){ Object.assign(LEARNED_RANKING,JSON.parse(fs.readFileSync(home(args.classement),'utf8'))); console.log(`Classement appris : ${Object.keys(LEARNED_RANKING.keys||{}).length} clés, ${Object.keys(LEARNED_RANKING.fill||{}).length} remplissages`); }
if(args['sans-version-fichier']) ENGINE_OPTIONS.versionByFileDate=false; // comparaison : sans la règle « fichier le plus récemment ajouté »

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
const byC={}; for(const f of Object.values(reg.files)) if(f.isCurrent&&!f.missing&&f.resultFile&&f.status!=='ignoré'&&(args['avec-perimes']||!obsoleteFolderOf(f.relDir))&&fs.existsSync(path.join(W,f.resultFile))) (byC[f.contract]=byC[f.contract]||[]).push(f);
// v3.0.2 — --perimetre-v3 [--suivi <export Suivi tous contrats>] : bâtiments comme dans l'appli v3 (noms Salesforce, sinon « Total
// bâtiments », 1 bâtiment = tout fusionné) ; une valeur sans bâtiment ou d'une liste « A et B » compte pour chacun de ces bâtiments.
const TOTALS={};
if(args.suivi){ const XLSX=require('xlsx'); const wb=XLSX.read(fs.readFileSync(home(args.suivi)),{type:'buffer'}); const tb=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:''});
  const hi=tb.findIndex(r=>r.some(x=>/num[ée]ro du contrat/i.test(String(x)))&&r.some(x=>/^(?:total|nombre de) b[âa]timents$/i.test(String(x).trim()))); if(hi>=0){ const h=tb[hi]; const ci=h.findIndex(x=>/num[ée]ro du contrat/i.test(String(x))), ti=h.findIndex(x=>/^(?:total|nombre de) b[âa]timents$/i.test(String(x).trim()));
    for(const r of tb.slice(hi+1)){ const c=String(r[ci]||'').replace(/\s/g,''); if(/^\d{1,8}$/.test(c)){ const n=Math.floor(Number(String(r[ti]).replace(',','.'))); TOTALS[c.padStart(8,'0')]=n>0?n:1; } } }
  console.log(`Suivi : ${Object.keys(TOTALS).length} total(aux) de bâtiments`); }
const RESF=new Set(['bbio','cep','cepnr','dh','dh_zt','dh_znt','tic','ic_construction','ic_energy','ubat_after','shab','housing_count']);
const only=args.contrats?new Set(String(args.contrats).split(',').map(s=>s.trim().replace(/^0+/,'').padStart(8,'0'))):null;
const contracts=Object.keys(byC).filter(c=>sf.has(c)&&(!only||only.has(c))).sort();
console.log(`Export Salesforce : ${sf.size} fiche(s) avec données techniques · import massif : ${Object.keys(byC).length} opération(s) · communes : ${contracts.length}`);

const DUMP=args['dump-candidats']?home(args['dump-candidats']):null; const PM={}; const detail=[]; const T=()=>({juste:0,faux:0,manquant:0,incomparable:0});
const byField={}, byMethod={}, byType={}; let ops=0; const perOp=[]; const candObs=[]; const oracle={}, oracleTot={};
const bump=(o,k,r)=>{ (o[k]=o[k]||T())[r]++; };
// v2.36.9 — fiabilité Prestaterre (fiable / non fiable, par catégorie), voir sfReliability dans js/qualite.js.
const relCat={}, relByField={}, calMethods={};
for(const c of contracts){
  // --relecture-legere : les lecteurs actuels sont relancés sur le texte conservé (sans relire le PDF ni refaire l'OCR).
  const docs=byC[c].map(f=>{ const d={...JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(W,f.resultFile))).toString('utf8')).doc,status:'ready',file:null}; if(args['relecture-legere']&&d.read&&(!args['relecture-types']||String(args['relecture-types']).split(',').includes(d.type))) d.cachedOccurrences=null; return d; });
  // v2.44.3 — les documents relus depuis l'import n'ont pas d'identifiant : on reprend celui de leurs lectures (règle B « indice »).
  for(const d of docs) if(!d.id) d.id=(d.cachedOccurrences||[]).find(o=>o.docId)?.docId||d.name;
  // v2.44.3 — --ancrage : comme dans l'appli, le Bbio et le Cep Salesforce de chaque bâtiment sont fournis (valeurs définitives,
  // bâtiments des documents rapprochés des bâtiments Salesforce) ; Bbio et Cep sont alors exclus du score (justes par construction).
  let overrides={}, extra=[];
  if(args.ancrage){ const v0=sf.get(c).vals, com=v0.find(v=>!v.building)?.values||{}, nm=v0.filter(v=>v.building);
    const sfN=nm.map(v=>canonicalBuilding(v.building)), detected=[...new Set(docs.flatMap(d=>[...(d.buildings?.names||[]),...(d.cachedOccurrences||[]).map(o=>o.building).filter(Boolean)]))];
    if(args['perimetre-v3']){ const res0=new Map(); for(const d of docs) for(const o of d.cachedOccurrences||[]) if(o?.building&&RESF.has(o.field)) (res0.get(o.building)||res0.set(o.building,new Set()).get(o.building)).add(o.field);
      const pm=sfPerimeter({names:sfN,total:TOTALS[c]??null,detected:detected.map(n=>({name:n,results:res0.get(n)?.size||0}))});
      if(pm){ PM[c]=pm; for(const [k,t] of Object.entries(pm.map)) if(t&&k!=='Bâtiment unique') overrides[k]=t; } }
    else if(sfN.length){ const mp=sfPerimeterMap(sfN,detected).map; for(const [k,t] of Object.entries(mp)) if(t&&k!=='Bâtiment unique') overrides[k]=t; }
    for(const b of (nm.length?nm:[{building:'',values:com}])) for(const f of ['bbio','cep']){ const v={...com,...b.values}[f]; if(v===undefined||v==='') continue;
      extra.push({field:f,value:v,building:b.building?canonicalBuilding(b.building):'Bâtiment unique',docId:'sf-ancrage',fileName:'Salesforce',docType:'Entrée manuelle',userValidated:true,manualDefinitive:true,page:'',confidence:.995,method:'manual:free-paste',unit:''}); } }
  let res; try{ res=analyzeDocuments(docs,DEFAULT_SOURCE_RULES,'',overrides,extra); }catch(e){ console.warn(`  ⚠ ${c} : ${e.message}`); continue; }
  ops++; const comps=[];
  const {vals,status}=sf.get(c);
  const common=vals.find(v=>!v.building)?.values||{}; const named=vals.filter(v=>v.building);
  const sfB=named.length?named.map(v=>({name:canonicalBuilding(v.building),values:{...common,...v.values}})):[{name:'',values:common}];
  perOp.push({c,res,comps,sfB,named:named.length>0,docs});
  const rows=res.rows||[]; const map=named.length?sfPerimeterMap(sfB.map(b=>b.name),rows.map(r=>r.building)).map:{};
  for(const b of sfB){
    let mine=named.length?rows.filter(r=>map[r.building]===b.name):rows;
    if(args['perimetre-v3']&&named.length){ const share=rows.filter(r=>!mine.includes(r)&&(r.building==='Bâtiment unique'||(sfSplitGroup(r.building).length>1&&sfSplitGroup(r.building).some(x=>map[x]===b.name||canonicalBuilding(x)===b.name))));
      mine=[...mine,...share.map(r=>({...Object.fromEntries(Object.entries(r).filter(([k])=>!mine.some(m=>m[k]!==undefined&&m[k]!==null&&m[k]!==''))),building:r.building}))]; }
    for(const [field,sv] of Object.entries(b.values)){
      if(!FIELD_MAP[field]||['building','contract_number','internal_code','evaluation_status','address','postcode','city','department'].includes(field)) continue;
      if(args.ancrage&&['bbio','cep'].includes(field)) continue;
      const cands=mine.filter(r=>r[field]!==undefined&&r[field]!==null&&r[field]!=='');
      let result='manquant', hit=null;
      if(cands.length){ const res2=cands.map(r=>[r,compareToReference(field,r[field],sv)]); const best=res2.find(x=>x[1]==='juste')||res2.find(x=>x[1]==='faux')||res2[0]; hit=best[0]; result=best[1]; }
      const o=hit?(res.finals||[]).find(x=>x.field===field&&(x.building===hit.building||x.building==='Bâtiment unique')):null;
      const method=o?.method||'', type=o?.docType||'';
      { const names=new Set([...mine.map(r=>r.building),'Bâtiment unique']); const seenF=new Set();
        for(const d of (res.detailed||[])){ if(d.field!==field||!(names.has(d.building)||names.has(d.originalBuilding))||/^(?:manual:|geocode:|derive:|coherence:)/.test(String(d.method||''))) continue;
          const key=`${d.method}|${d.fileName}|${String(d.value)}`; if(seenF.has(key)) continue; seenF.add(key);
          const rr=compareToReference(field,d.value,sv); if(rr==='incomparable') continue; candObs.push({c,key:`${d.method}|${field}`,result:rr}); } }
      // Potentiel : la bonne valeur est-elle parmi TOUTES les lectures des documents (retenues ou non) pour ce bâtiment ?
      // v3.0.2 — --dump-candidats <fichier.jsonl> : toutes les lectures du bâtiment pour la donnée (apprentissage du classement / des sources).
      if(DUMP){ const names=new Set([...mine.map(r=>r.building),'Bâtiment unique']); const seenD=new Set(), cl=[];
        for(const d of (res.detailed||[])){ if(d.field!==field||!(names.has(d.building)||names.has(d.originalBuilding))||/^(?:manual:|geocode:|derive:|coherence:)/.test(String(d.method||''))) continue;
          const k=`${d.method}|${d.docId}|${String(d.value)}|${d.building}`; if(seenD.has(k)) continue; seenD.add(k);
          cl.push({v:d.value,m:d.method||'',t:d.docType||'',st:d.status||'',tier:d.sourceTier||'',conf:d.confidence??null,doc:d.docId||'',b:d.building,g:d._globalCandidate?1:0,r:compareToReference(field,d.value,sv)}); }
        fs.appendFileSync(DUMP,JSON.stringify({c,b:b.name,f:field,sv,res:result,hv:hit?hit[field]:null,hm:o?.method||'',ht:o?.docType||'',cands:cl})+'\n'); }
      let present=false, goodDiag='';
      if(result!=='juste'&&result!=='incomparable'){ const names=new Set([...mine.map(r=>r.building),'Bâtiment unique']);
        const pool=(res.detailed||[]).filter(d=>d.field===field&&(names.has(d.building)||names.has(d.originalBuilding)));
        present=pool.some(d=>compareToReference(field,d.value,sv)==='juste');
        // v2.39.0 — diagnostic : la bonne lecture, et pourquoi elle n'a pas été retenue (statut, motif, source).
        { const g=pool.find(d=>compareToReference(field,d.value,sv)==='juste'); if(g) goodDiag=[g.status||'',g.rejectionReason||'',g.sourceTier||'',g.docType||'',g.method||'',g.fileName||'',g.building||'',g.confidence??''].join(' | ');
          // Lue, mais pour un autre bâtiment de l'opération (rattachement) ?
          else { const o2=(res.detailed||[]).find(d=>d.field===field&&compareToReference(field,d.value,sv)==='juste'); if(o2) goodDiag=['AUTRE BÂTIMENT',o2.status||'',o2.sourceTier||'',o2.docType||'',o2.method||'',o2.fileName||'',`${o2.building||''} (Salesforce : ${b.name||'opération'})`,o2.confidence??''].join(' | '); } }
        const k=present?(result==='faux'?'faux · bonne valeur présente':'manquant · bonne valeur présente'):(result==='faux'?'faux · absente des lectures':'manquant · aucune lecture juste');
        (oracle[field]=oracle[field]||{})[k]=((oracle[field]||{})[k]||0)+1; oracleTot[k]=(oracleTot[k]||0)+1; }
      bump(byField,field,result); if(result==='juste'||result==='faux'){ bump(byMethod,method||'(inconnue)',result); bump(byType,type||'(inconnu)',result); }
      const rel=sfReliability(field,sv,hit?hit[field]:'',result,{goodValuePresent:present,oddValue});
      // v2.37.0 — calibration des niveaux de fiabilité sur la définition Prestaterre : une lecture « fiable » (juste, écart
      // mineur, autre version, notion différente, saisie Salesforce aberrante) compte comme juste ; écart majeur / aberrante = faux.
      if((result==='juste'||result==='faux')&&hit){ const calRes=rel?(rel.fiable?'juste':'faux'):result; comps.push({b:hit.building,field,result:calRes,method}); bump(calMethods,method||'(inconnue)',calRes); }
      if(rel){ relCat[rel.cat]=(relCat[rel.cat]||0)+1; const f=relByField[field]=relByField[field]||{fiable:0,non:0}; f[rel.fiable?'fiable':'non']++; }
      detail.push([c,status,b.name||'(opération)',FIELD_MAP[field].label,field,sv,hit?hit[field]:'',result,rel?(rel.fiable?'fiable':'non fiable'):'',rel?SF_RELIABILITY[rel.cat]:'',goodDiag,o?.fileName||'',o?.page??'',method,type,o?.confidence??'']);
    }
  }
}

// 2 bis. Recoupement entre documents, évalué en validation croisée (poids appris sur l'autre moitié des opérations).
const SKIPF=['building','contract_number','internal_code','evaluation_status','address','postcode','city','department'];
function compareOp(res,sfB,named){
  const out=[]; const rows=res.rows||[]; const map=named?sfPerimeterMap(sfB.map(b=>b.name),rows.map(r=>r.building)).map:{};
  for(const b of sfB){ const mine=named?rows.filter(r=>map[r.building]===b.name):rows;
    for(const [field,sv] of Object.entries(b.values)){ if(!FIELD_MAP[field]||SKIPF.includes(field)) continue;
      const cands=mine.filter(r=>r[field]!==undefined&&r[field]!==null&&r[field]!=='');
      let result='manquant', hit=null;
      if(cands.length){ const r2=cands.map(r=>[r,compareToReference(field,r[field],sv)]); const best=r2.find(x=>x[1]==='juste')||r2.find(x=>x[1]==='faux')||r2[0]; hit=best[0]; result=best[1]; }
      const o=hit?(res.finals||[]).find(x=>x.field===field&&(x.building===hit.building||x.building==='Bâtiment unique')):null;
      out.push({b:hit?.building||'',field,result,method:o?.method||'',agree:o?.agreeFiles||0,recoupe:!!o?.recoupe}); } }
  return out;
}
const reco=T(), recoByField={}; let recoReplaced=0, recoFilled=0; const recoComps=[];
for(const fold of [0,1]){
  const pairs={}, methods={}, cands={};
  for(const k of candObs) if(parseInt(k.c,10)%2!==fold){ const u=cands[k.key]=cands[k.key]||{juste:0,faux:0}; u[k.result]++; }
  for(const o of perOp.filter(x=>parseInt(x.c,10)%2!==fold)) for(const k of o.comps){ const u=pairs[`${k.method}|${k.field}`]=pairs[`${k.method}|${k.field}`]||{juste:0,faux:0}; u[k.result]++; const v=methods[k.method]=methods[k.method]||{juste:0,faux:0}; v[k.result]++; }
  for(const o of perOp.filter(x=>parseInt(x.c,10)%2===fold)){
    let r2; try{ r2=analyzeDocuments(o.docs.map(d=>({...d})),DEFAULT_SOURCE_RULES,''); }catch{ continue; }
    const st=recoupement(r2,{calib:{pairs,methods,cands}}); recoReplaced+=st.replaced; recoFilled+=st.filled;
    for(const k of compareOp(r2,o.sfB,o.named)){ reco[k.result]++; (recoByField[k.field]=recoByField[k.field]||T())[k.result]++; if(k.result==='juste'||k.result==='faux') recoComps.push({...k,c:o.c}); } }
}

// 3. Sorties
const stamp=new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
const out=path.join(W,'qualite',stamp); fs.mkdirSync(out,{recursive:true});
const csv=(rows)=>'﻿'+rows.map(r=>r.map(v=>{ const s=String(v??''); return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }).join(';')).join('\r\n');
const pct=x=>x===null?'':`${Math.round(x*1000)/10} %`;
const stat=(k,t)=>{ const n=t.juste+t.faux; return [k,t.juste,t.faux,t.manquant,t.incomparable,pct(n?t.juste/n:null),pct((t.juste+t.faux+t.manquant)?(t.juste+t.faux)/(t.juste+t.faux+t.manquant):null)]; };
const head=['clé','justes','faux','manquants','non comparables','exactitude (justes / lus)','couverture (lus / Salesforce)'];
fs.writeFileSync(path.join(out,'detail.csv'),csv([['contrat','statut évaluation','bâtiment Salesforce','champ','clé','valeur Salesforce','valeur documents','résultat','fiabilité','catégorie','bonne lecture non retenue (statut | motif | niveau | type | méthode | fichier | bâtiment | confiance)','document','page','méthode','type de document','confiance'],...detail]));
const sorted=o=>Object.entries(o).sort((a,b)=>(b[1].juste+b[1].faux+b[1].manquant)-(a[1].juste+a[1].faux+a[1].manquant));
fs.writeFileSync(path.join(out,'par-champ.csv'),csv([head,...sorted(byField).map(([k,t])=>stat(`${FIELD_MAP[k]?.label||k} (${k})`,t))]));
fs.writeFileSync(path.join(out,'par-methode.csv'),csv([head,...sorted(byMethod).map(([k,t])=>stat(k,t))]));
fs.writeFileSync(path.join(out,'par-type.csv'),csv([head,...sorted(byType).map(([k,t])=>stat(k,t))]));
const tot=Object.values(byField).reduce((a,t)=>({juste:a.juste+t.juste,faux:a.faux+t.faux,manquant:a.manquant+t.manquant,incomparable:a.incomparable+t.incomparable}),T());
const pairs={}; for(const o of perOp) for(const k of o.comps){ const u=pairs[`${k.method}|${k.field}`]=pairs[`${k.method}|${k.field}`]||{juste:0,faux:0}; u[k.result]++; }
const candsAll={}; for(const k of candObs){ const u=candsAll[k.key]=candsAll[k.key]||{juste:0,faux:0}; u[k.result]++; }
// v2.37.1 — valeurs contestées (un autre document donne une autre valeur) : part fiable mesurée par donnée.
const contestedStats={};
for(const o of perOp){ const why={}; reliabilityTable(o.res,{calib:null,reasons:why}); for(const k of o.comps){ if(why[k.b]?.[k.field]!=='contestée') continue; for(const key of [k.field,'*']){ const u=contestedStats[key]=contestedStats[key]||{juste:0,faux:0}; u[k.result]++; } } }
const calib={format:'extracterre-calibration',version:3,contested:contestedStats,createdAt:new Date().toISOString(),operations:ops,pairs,cands:candsAll,methods:Object.fromEntries(Object.entries(calMethods).map(([k,t])=>[k,{juste:t.juste,faux:t.faux}])),definition:'prestaterre-fiable-v1',fields:Object.fromEntries(Object.entries(byField).map(([k,t])=>[k,{juste:t.juste,faux:t.faux,manquant:t.manquant}]))};
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
  ...(()=>{ const F=['juste','mineur','version','notion','sfDouteux'], N=['manquant','majeur','aberrant'], nf=F.reduce((a,k)=>a+(relCat[k]||0),0), nn=N.reduce((a,k)=>a+(relCat[k]||0),0), all=Math.max(1,nf+nn);
    return [`FIABILITÉ (valeurs Salesforce comparables : ${nf+nn}) : ${pct(nf/all)} fiables · ${pct(nn/all)} non fiables`,
      ...F.map(k=>`  fiable     · ${SF_RELIABILITY[k].padEnd(32)} ${String(relCat[k]||0).padStart(5)}  (${pct((relCat[k]||0)/all)})`),
      ...N.map(k=>`  non fiable · ${SF_RELIABILITY[k].padEnd(32)} ${String(relCat[k]||0).padStart(5)}  (${pct((relCat[k]||0)/all)})`),'',
      'Champs les moins fiables (≥ 10 valeurs) :',...Object.entries(relByField).filter(([,t])=>t.fiable+t.non>=10).sort((a,b)=>a[1].fiable/(a[1].fiable+a[1].non)-b[1].fiable/(b[1].fiable+b[1].non)).slice(0,15).map(([k,t])=>`  ${pct(t.fiable/(t.fiable+t.non)).padStart(7)}  ${FIELD_MAP[k]?.label||k} (${t.fiable}/${t.fiable+t.non})`),'']; })(),
  'Champs les moins justes (≥ 10 valeurs lues) :',...sorted(byField).filter(([,t])=>t.juste+t.faux>=10).sort((a,b)=>a[1].juste/(a[1].juste+a[1].faux)-b[1].juste/(b[1].juste+b[1].faux)).slice(0,15).map(([k,t])=>`  ${pct(t.juste/(t.juste+t.faux)).padStart(7)}  ${FIELD_MAP[k]?.label||k} (${t.juste}/${t.juste+t.faux})`),'',
  'Méthodes de lecture (≥ 10 valeurs lues) :',...sorted(byMethod).filter(([,t])=>t.juste+t.faux>=10).map(([k,t])=>`  ${pct(t.juste/(t.juste+t.faux)).padStart(7)}  ${k} (${t.juste}/${t.juste+t.faux})`)];
lines.push(...gradeLines);
{ const n=reco.juste+reco.faux, all=n+reco.manquant;
  lines.push('',`Avec recoupement entre documents (validation croisée) : ${recoReplaced} valeur(s) remplacée(s), ${recoFilled} complétée(s)`,
    `  Exactitude : ${pct(reco.juste/Math.max(1,n))} (${reco.juste}/${n}) · couverture : ${pct(n/Math.max(1,all))}`,
    '  Champs les moins justes après recoupement (≥ 10 lus) :',...Object.entries(recoByField).filter(([,t])=>t.juste+t.faux>=10).sort((a,b)=>a[1].juste/(a[1].juste+a[1].faux)-b[1].juste/(b[1].juste+b[1].faux)).slice(0,20).map(([k,t])=>`    ${pct(t.juste/(t.juste+t.faux)).padStart(7)}  ${FIELD_MAP[k]?.label||k} (${t.juste}/${t.juste+t.faux}) · manquants ${t.manquant}`)); }
lines.push('','Potentiel (la bonne valeur figure-t-elle dans les lectures ?) :',...Object.entries(oracleTot).sort().map(([k,n])=>`  ${k.padEnd(40)} ${n}`),'','Par champ (faux / manquants dont la bonne valeur est lue quelque part) :',...Object.entries(oracle).map(([f,o])=>[f,o,(o['faux · bonne valeur présente']||0)+(o['manquant · bonne valeur présente']||0)]).sort((a,b)=>b[2]-a[2]).slice(0,25).map(([f,o,n])=>`  ${(FIELD_MAP[f]?.label||f).slice(0,40).padEnd(42)} récupérables ${String(n).padStart(4)} · faux non lus ${String(o['faux · absente des lectures']||0).padStart(4)} · manquants non lus ${o['manquant · aucune lecture juste']||0}`));
fs.writeFileSync(path.join(out,'resume.txt'),lines.join('\n'));
console.log(lines.join('\n')); console.log(`\nRapports : ${out}`);
