// ExtracTerre v2.9.0 — adresse de l'opération et géolocalisation IGN. Données FICTIVES (réponses IGN simulées).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,FIELD_MAP,matchFieldByHeader,DEFAULT_SOURCE_RULES,DOC_TYPES} from './js/config.js';
import {parseFrAddress,geocodeQuery,geocodeVerdict,geocodeAddress,GEOCODE_URL} from './js/geocode.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {detectBuildings} from './js/buildings.js';
import {textDoc} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(v,m)=>{ assert.ok(v,m); n++; };
eq(APP_VERSION,'2.10.1','version');

// Découpage d'adresse.
eq(parseFrAddress('12 rue des Lilas, 69003 LYON CEDEX 03'),{address:'12 rue des Lilas',postcode:'69003',city:'LYON'},'adresse + CEDEX');
eq(parseFrAddress('Lot 4 – ZAC des Prés 2A100 ?'),{address:'Lot 4 – ZAC des Prés 2A100 ?',postcode:'',city:''},'pas de code postal : rien n’est inventé');
eq(parseFrAddress('Chemin du Moulin 97410 Saint-Pierre'),{address:'Chemin du Moulin',postcode:'97410',city:'Saint-Pierre'},'outre-mer');
eq([geocodeQuery({address:'12 rue des Lilas',postcode:'69003'}),geocodeQuery({address:'12',postcode:'69003'}),geocodeQuery({address:'rue X'})],['12 rue des Lilas 69003','',''],'requête : voie + CP ou commune');

// Libellés des colonnes (identiques au tableau Tous contrats) et règles de sources.
eq(['Adresse','Code postal','Ville','Commune','Code INSEE','Latitude','Longitude'].map(h=>matchFieldByHeader(h)?.key),['address','postcode','city','city','insee_code','latitude','longitude'],'en-têtes');
eq(FIELD_MAP.latitude.type,'number','latitude numérique');
ok(DEFAULT_SOURCE_RULES.address.main.includes(DOC_TYPES.OPERATION_BOOKLET)&&DEFAULT_SOURCE_RULES.address.secondary.includes(DOC_TYPES.CCTP),'règles adresse');

// Verdict IGN : seul le numéro ou la voie, dans le code postal lu, donne une position.
const feat=(type,score,postcode,lon=4.85,lat=45.75)=>({features:[{geometry:{coordinates:[lon,lat]},properties:{type,score,postcode,citycode:'69383',label:`12 Rue des Lilas ${postcode} Lyon`}}]});
eq(geocodeVerdict(feat('housenumber',0.93,'69003'),{postcode:'69003'}),{ok:true,lat:45.75,lon:4.85,insee:'69383',precision:'Adresse exacte (numéro)',label:'12 Rue des Lilas 69003 Lyon',score:0.93},'numéro trouvé');
eq(geocodeVerdict(feat('street',0.7,'69003'),{postcode:'69003'}).precision,'Voie (sans numéro)','voie');
ok(!geocodeVerdict(feat('municipality',0.9,'69003'),{postcode:'69003'}).ok,'commune seule refusée');
ok(!geocodeVerdict(feat('housenumber',0.3,'69003'),{postcode:'69003'}).ok,'score faible refusé');
ok(/code postal différent/.test(geocodeVerdict(feat('housenumber',0.9,'69008'),{postcode:'69003'}).reason),'autre code postal refusé');
ok(!geocodeVerdict({features:[]}).ok,'introuvable');
let called=''; const v=await geocodeAddress('12 rue des Lilas 69003 Lyon',{postcode:'69003'},async u=>{ called=u; return {ok:true,json:async()=>feat('housenumber',0.95,'69003')}; });
ok(called.startsWith(GEOCODE_URL)&&/postcode=69003/.test(called)&&/index=address/.test(called)&&v.ok,'appel IGN filtré par code postal');

// Extraction : libellé explicite seulement, jamais l'adresse d'un intervenant.
const doc=textDoc('d1','Notice architecturale.pdf',DOC_TYPES.NOTICE,'Architecte : Cabinet Fictif, 3 place du Marché 69002 Lyon\nAdresse de l’opération :\n12 rue des Lilas\n69003 Lyon\nSurface 1200 m²');
const occ=parseDocument(doc).filter(o=>['address','postcode','city'].includes(o.field));
eq(occ.map(o=>[o.field,o.value]),[['address','12 rue des Lilas'],['postcode','69003'],['city','Lyon']],'adresse de l’opération sur deux lignes');
eq(parseDocument(textDoc('d2','CCTP.pdf',DOC_TYPES.CCTP,'Maître d’œuvre : 3 place du Marché 69002 Lyon')).filter(o=>o.field==='postcode').length,0,'adresse d’intervenant ignorée');
const d3={...doc,status:'ready',classification:{type:DOC_TYPES.NOTICE,automaticType:DOC_TYPES.NOTICE}}; d3.buildings=detectBuildings(d3);
const res=analyzeDocuments([d3],DEFAULT_SOURCE_RULES,'Op test');
eq([res.rows[0].address,res.rows[0].postcode,res.rows[0].city],['12 rue des Lilas','69003','Lyon'],'retenue dans la synthèse');

// Câblage : application à chaque consolidation, sans écraser une saisie ; cache sauvegardé ; module dans le bundle.
const app=fs.readFileSync('js/app.js','utf8');
ok(/applyGeocodes\(project\);\s*applyComparisonBases/.test(app),'géocodage appliqué après les données manuelles');
ok(/taken=f=>Object\.prototype\.hasOwnProperty\.call\(project\.manualValues/.test(app),'valeur saisie jamais remplacée');
ok(/geocodes:safeJsonClone/.test(fs.readFileSync('js/persistence.js','utf8')),'cache sauvegardé');
ok(/'utils\.js','geocode\.js'/.test(fs.readFileSync('build_bundle.py','utf8')),'bundle');
console.log(`v2.9.0 — ${n} vérifications OK (données fictives)`);
