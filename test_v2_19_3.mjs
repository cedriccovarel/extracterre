// ExtracTerre v2.19.2 — « ExtracTerre ne répond pas » : rattrapages une seule fois par document, diagnostics sans relecture
// du texte, normalisation mémoïsée. Données FICTIVES.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION,DOC_TYPES,DEFAULT_SOURCE_RULES} from './js/config.js';
import {normalizeText} from './js/utils.js';
import {analyzeDocuments,catchUpDocument} from './js/engine.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.24.4','version');
// Normalisation mémoïsée : mêmes résultats, petits et grands textes.
eq(normalizeText('  Été  “isolé”  R=3,75 '),'Ete “isole” R=3,75','normalisation');
eq(normalizeText('  Été  “isolé”  R=3,75 '),'Ete “isole” R=3,75','normalisation (cache)');
const big='Bâtiment  A\n'.repeat(500); eq(normalizeText(big),normalizeText(big),'grand texte'); eq(normalizeText(big).startsWith('Batiment A Batiment A'),true,'grand texte normalisé');
eq(normalizeText(big+'x').endsWith('Batiment A x'),true,'grand texte suivant');
// Rattrapages : une seule fois, marques enregistrées.
const occ=(f,v)=>({field:f,value:v,building:'Bâtiment A',docId:'d',fileName:'f.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'',confidence:0.95,method:'t',unit:''});
let reads=0; const pages=[{page:1,text:'Notice fictive',lines:[{index:0,text:'Notice fictive'}]}];
const doc={id:'d',name:'f.pdf',status:'ready',type:DOC_TYPES.CCTP,cachedOccurrences:[occ('bbio',40)],buildings:{names:['Bâtiment A']},get read(){ reads++; return {kind:'pdf',pages,text:'Notice fictive'}; }};
catchUpDocument(doc); eq([doc.rsetAddressRead,reads],[true,0],'adresse RSET : document non RSET marqué sans lire son texte');
analyzeDocuments([doc],DEFAULT_SOURCE_RULES,''); const r1=reads; analyzeDocuments([doc],DEFAULT_SOURCE_RULES,'');
eq(reads-r1,0,'2e recalcul : texte du document jamais relu (détections enregistrées sur le document)');
const per=readFileSync('js/persistence.js','utf8');
eq(/rsetAddressRead:!!doc\.rsetAddressRead/.test(per)&&/dhZonesRead:!!doc\.dhZonesRead/.test(per)&&/lowText:/.test(per),true,'marques enregistrées');
const app=readFileSync('js/app.js','utf8');
eq(/pendingDocCheckpoints\.push/.test(app)&&/catchUpDocument\(d(?:,[^)]*)?\); await new Promise/.test(app),true,'document modifié sauvegardé ; rattrapages un document à la fois');
console.log(`test_v2_19_3 : ${n}/${n} OK`);
