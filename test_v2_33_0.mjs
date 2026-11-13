// v2.33.0 — maître d'ouvrage collé avec la liste, en-tête des exports .xlsx, géolocalisation fiable, couleurs des valeurs,
// tableau de synthèse, « Retirer » / « Relancer » dans À vérifier.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ssParseContractPaste} from './js/suivi-sources.js';
import {sfxHeaderRow,sfxColumns} from './js/sf-export.js';
import {communeVerdict,throttledFetch} from './js/geocode.js';

// 1. Liste collée avec code interne et maître d'ouvrage (groupe principal)
const paste="Contrat: Numéro du contrat\tCode interne\tMaître d'ouvrage: Groupe principal Nom\n00004464\tOPE-004029\tKAUFMAN & BROAD SA\n00006030\tOPE-005868\tACTION LOGEMENT\n";
const r=ssParseContractPaste(paste);
assert.deepEqual(r.contracts,['00004464','00006030']);
assert.deepEqual(r.owners,{'00004464':'KAUFMAN & BROAD SA','00006030':'ACTION LOGEMENT'});
// sans en-tête : la colonne de texte est prise pour le maître d'ouvrage, pas le code OPE
const r2=ssParseContractPaste("4464\tOPE-004029\tKAUFMAN & BROAD SA\n6030\tOPE-005868\tACTION LOGEMENT");
assert.equal(r2.owners['00006030'],'ACTION LOGEMENT');
assert.deepEqual(ssParseContractPaste('00005361\n00004918').owners,{});

// 2. Export .xlsx avec lignes de titre au-dessus de l'en-tête
const t=[['Opérations Toutes'],[''],['','Contrat: Numéro du contrat','','Code interne','Évaluation: Chauffage','Rue','Ville',"Code postal de l'opération (texte)"],['','00004464','','OPE-1','x','1 rue A','Antibes','06600']];
assert.equal(sfxHeaderRow(t),2); const c=sfxColumns(t[2]); assert.deepEqual([c.contract,c.street,c.city,c.postcode],[1,5,6,7]);

// 3. Commune : « ST » → Saint, code postal, Corse
const feat=(label,context,postcode)=>({properties:{type:'municipality',label,context,citycode:'1',postcode},geometry:{coordinates:[2,48]}});
assert.ok(communeVerdict({features:[feat('Saint-Denis','93, Seine-Saint-Denis','93200')]},{department:'93',city:'ST DENIS',postcode:'93200',source:'Salesforce'}).ok);
assert.match(communeVerdict({features:[feat('Saint-Denis','93, X','93200')]},{department:'93',city:'ST DENIS',source:'Salesforce'}).precision,/Salesforce/);
assert.ok(communeVerdict({features:[feat('Ajaccio','2A, Corse-du-Sud','20000')]},{department:'20',city:'AJACCIO',postcode:'20000'}).ok);
assert.ok(communeVerdict({features:[feat('Montreuil','93, X','93100')]},{department:'93',city:'MONTREUIL SOUS BOIS',postcode:'93100'}).ok);
assert.equal(communeVerdict({features:[feat('Lyon','69, X')]},{department:'75',city:'Lyon'}).ok,false);

// 4. File d'appels IGN : un à la fois, nouvel essai après 429
let calls=0; const fake=async()=>{ calls++; return calls===1?{ok:false,status:429}:{ok:true,status:200,json:async()=>({})}; };
const f=throttledFetch(fake,{gap:0,sleep:async()=>{}}); const res=await f('u'); assert.equal(res.status,200); assert.equal(calls,2);

// 5. Appli : couleurs, synthèse, géolocalisation attendue avant export, À vérifier
const app=fs.readFileSync('js/app.js','utf8'), css=fs.readFileSync('styles.css','utf8'), cli=fs.readFileSync('tools/import/extracterre-import.mjs','utf8');
assert.match(app,/return k==='sf'\?'v-sf':odd\?'odd':k==='doc'\?'v-doc':''/);
assert.match(css,/\.summary-value\.v-sf/); assert.match(css,/\.summary-value\.v-doc/);
assert.match(app,/data-synth-open/); assert.match(app,/function synthLine\(p\)/);
assert.match(app,/await geocodeProjects\(state\.projects\.filter\(p=>ids\.has\(p\.id\)\)/);
assert.match(app,/if\(touched\.size\) geocodeProjects/);
assert.match(app,/ssEnsureTiles\(r\.contracts,r\.owners\)/);
assert.match(app,/data-ss-act="ignore"[^>]*>\$\{dec\.ignore\?'Retiré':'Retirer'\}/);
assert.match(app,/await ssRequestReread\(/);
assert.match(cli,/consumeReprocess\(decisionsFile,reread\)/);
assert.equal(fs.readFileSync('VERSION','utf8').trim(),'2.33.0');
console.log('test_v2_33_0 ok');
