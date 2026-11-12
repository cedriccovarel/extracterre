// ExtracTerre v2.25.0 — moins de documents « à vérifier » : vote des indices, correspondance écartée, complétude par
// opération, XML ThCEx / dossier de contrôle / index DCE, OCR des scans ; encart Projet actuel = numéro de contrat.
import fs from 'fs';
import os from 'os';
import path from 'path';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'2.31.3','version');
const ex=await import('./tools/import/lib/extract.mjs');
// Statut d'un document : incomplet ou sans donnée = information, pas « à vérifier ».
const doc=(type,fields)=>({type,read:{pages:[]},cachedOccurrences:fields.map(f=>({field:f})),families:null});
eq(ex.docStatus(doc('RT Existant',['bbio'])).status,'traité','étude partielle : traitée (information)');
eq(/partiel/.test(ex.docStatus(doc('RT Existant',['bbio'])).reason),true,'motif « partiel »');
eq(ex.docStatus(doc('Étude thermique',[])).status,'traité','sans donnée : traité, contrôle par opération');
eq(ex.docStatus(doc('CCTP',[]),{scan:true}).status,'à vérifier','scan non lu : à vérifier');
eq(ex.docStatus({...doc('CCTP',[]),parseError:'x'}).status,'erreur','erreur de parseur');
// XML reconnus par leur structure (fichiers fictifs).
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xt250-')); const w=(n,t)=>{ const p=path.join(dir,n); fs.writeFileSync(p,t); return p; };
eq((await ex.probeXml(w('Entree.xml','<?xml version="1.0"?><Projet><Version>1</Version><Calcul_ThE/></Projet>'))).other,'thcex','entrée ThCEx');
eq((await ex.probeXml(w('XML.xml','<dossier_controle><feuillet_administratif/></dossier_controle>'))).other,'controle','dossier de contrôle');
eq((await ex.probeXml(w('idx.xml','<dce><sous-repertoire/><document/></dce>'))).other,'dce','index de DCE');
eq((await ex.probeXml(w('rsee.xml','<projet><RSET/><RSEnv/></projet>'))).re2020,'RSEE','RSEE toujours reconnu');
// Script : OCR, alertes par opération, statut recalculé pour les fichiers déjà connus.
const cli=fs.readFileSync('tools/import/extracterre-import.mjs','utf8'), rt=fs.readFileSync('tools/import/lib/runtime.mjs','utf8');
eq(/export function enableOcr/.test(rt)&&/@napi-rs\/canvas/.test(rt)&&/tesseract\.js/.test(rt),true,'OCR sous Node (même moteur que l’appli)');
eq(/--sans-ocr/.test(cli)&&/ocrOn&&scanWas\(old\)/.test(cli),true,'scans déjà connus relus avec OCR');
eq(/aucune donnée extraite de \$\{docs\.length\} document\(s\)/.test(cli)&&/counts:c,alerts,/.test(cli),true,'alerte par famille et par opération');
eq(/const j=judge\(res\.doc,res\.meta,old\.sha256\)/.test(cli),true,'règles actuelles appliquées aux fichiers déjà extraits');
// Appli : encart Projet actuel = numéro de contrat ; alertes dans Suivi des sources.
const html=fs.readFileSync('index.html','utf8'), app=fs.readFileSync('js/app.js','utf8'), per=fs.readFileSync('js/persistence.js','utf8');
eq(/N° de contrat\s*<input id="projectContract"/.test(html)&&/<input id="operationName" type="hidden">/.test(html),true,'encart : numéro de contrat (nom de l’opération en coulisse)');
eq(/function syncProjectContract/.test(app)&&/el\.readOnly=!!fromData/.test(app),true,'contrat verrouillé quand il vient des données');
eq(/p\?\.importContract\|\|p\?\.contractNumber/.test(app)&&/contractNumber:project\.contractNumber/.test(per),true,'numéro saisi : identité et sauvegarde');
eq(/⚠ \$\{op\.alerts\.length\} alerte\(s\)/.test(app),true,'alertes affichées dans Suivi des sources');
console.log(`v2.31.0 — ${n} vérifications OK (données fictives)`);
