// ExtracTerre v2.15.0 — plans repérés à la lecture et mesurés dans Ashton ; pack du 02/11/2026. Données FICTIVES.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,DOC_TYPES,DEFAULT_SOURCE_RULES} from './js/config.js';
import {planFormatOf} from './js/readers.js';
import {planFieldFor,planOccurrences,planRowField,defaultPlanBuilding,isPlanDoc} from './js/plans.js';
import {analyzeDocuments,applyComparisonBases} from './js/engine.js';
import {parseDocument} from './js/parsers.js';
import {parseFreePaste,freePasteValues} from './js/collage-libre.js';
import {normalizeText} from './js/utils.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(v,m)=>{ assert.ok(v,m); n++; };
eq(APP_VERSION,'2.20.3','version');

// Plan : A2 et plus, ou A3 nommé comme un plan ; une pièce écrite n'en est jamais un.
eq(planFormatOf('P02 - Plan généraux.pdf',3370,2384),'A0','A0');
eq(planFormatOf('Lot A - indice C.pdf',2384,1684),'A1','A1 sans nom de plan');
eq(planFormatOf('Plan RDC Bat A.pdf',1191,842),'A3','A3 nommé « Plan RDC »');
eq(planFormatOf('Façades Nord Sud.pdf',842,1191),'A3','A3 portrait, façades');
eq(planFormatOf('Tableau de surfaces.pdf',1191,842),null,'A3 sans nom de plan');
eq(planFormatOf('Plan masse.pdf',842,595),null,'A4 : jamais un plan');
eq(planFormatOf('CCTP Lot 02 - plans annexés.pdf',2384,1684),null,'CCTP grand format');
eq(planFormatOf('RSET Bâtiment A.pdf',1684,1191),null,'RSET');
ok(isPlanDoc({type:DOC_TYPES.PLAN,name:'x.pdf'})&&!isPlanDoc({type:DOC_TYPES.CCTP,name:'x.pdf'}),'isPlanDoc');

// Mot-clé → colonne de quantité (libellé, synonymes, colonne Oui / Non associée).
eq(['Brasseur d’air','brasseurs d\'air','Nombre de brasseurs d’air','Logements','Fenêtres',''].map(planFieldFor),['fan_count','fan_count','fan_count','housing_count','',''],'mots-clés');

// Table reçue de Ashton → occurrences ; Brasseur d'air = Oui dans les autres onglets.
const table={docName:'Plan RDC.pdf',building:'Bâtiment A',refs:{},rows:[
  {key:'surface|chambre t3',kind:'surface',ref:'Chambre T3',field:'',n:2,pages:[1],min:10.5,avg:11.2,max:11.9},
  {key:'quantite|fan_count',kind:'quantite',ref:'Brasseur d’air',field:'fan_count',n:2,pages:[1,2],total:6},
  {key:'quantite|prise',kind:'quantite',ref:'Prise',field:'',n:1,pages:[1],total:14}]};
const proj={planTables:{'doc-plan':table}};
const occ=planOccurrences(proj);
eq(occ.map(o=>[o.field,o.value,o.building,o.docType,o.method]),[['fan_count',6,'Bâtiment A',DOC_TYPES.PLAN,'ashton:quantity']],'seules les quantités reliées à une colonne');
table.refs={'quantite|prise':'Logements'}; eq(planRowField(table,table.rows[2]),'housing_count','mot-clé saisi dans ExtracTerre');
table.refs={'quantite|fan_count':'Prise'}; eq(planOccurrences(proj).map(o=>o.field),[],'mot-clé modifié : la colonne suit le mot-clé');
table.refs={};
const res=analyzeDocuments([],structuredClone(DEFAULT_SOURCE_RULES),'Op',{},planOccurrences(proj)); applyComparisonBases(res);
const row=res.rows.find(r=>r.building==='Bâtiment A');
eq([row?.fan_count,row?.fan_presence],[6,'Oui'],'Nombre de brasseurs d’air et Brasseur d’air concordants');
eq([defaultPlanBuilding({buildings:{names:['Bâtiment B']}}),defaultPlanBuilding({buildings:{names:['Bâtiment A','Bâtiment B']}}),defaultPlanBuilding({})],['Bâtiment B','Bâtiment unique','Bâtiment unique'],'bâtiment par défaut');

// Pack du 02/11/2026.
const fp=t=>freePasteValues(parseFreePaste(t))[0]?.values||{};
eq(fp('Tic = 46165\nCep = 52,1').tic,undefined,'Tic = 46165 (date Excel) : hors plage, non reporté');
eq(fp('Tic = 27,4').tic,27.4,'Tic plausible gardé');
eq(fp('Profil = Visite\nCep = 52,1').selected_profile,undefined,'« Visite » n’est pas un profil');
const mk=(type,lines,name='doc.pdf')=>{ const ls=lines.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12})); const pg={page:1,text:ls.map(l=>l.text).join('\n'),lines:ls}; return {id:'b',name,type,familyMode:'auto',read:{kind:'pdf',pages:[pg],pageCount:1,text:pg.text},buildings:{names:['Bâtiment unique']}}; };
const f=(doc,field)=>parseDocument(doc).filter(o=>o?.field===field).map(o=>o.value);
eq(f(mk(DOC_TYPES.CCTP,['Mise en place d\'un tunnel de protection provisoire en pied de facade au droit des halls d\'entree afin','d\'assurer la securite des occupants pendant les travaux,','structure métallique'],'CCTP Lot 05 facades.pdf'),'wall_structure'),[],'ouvrage provisoire de chantier : pas une structure de mur');
eq(f(mk(DOC_TYPES.CCTP,['Le présent lot comprend des travaux de Chauffage, Ventilation, Climatisation et Desenfumage (CVCD) et de plomberie'],'CCTP lot 08.pdf'),'cooling'),[],'intitulé de lot CVCD : pas une climatisation');
const rule=JSON.parse(fs.readFileSync('data/patches/ExtracTerre_PATCH_PLEIADES_RE2020_RSET_ETUDE_v1.json','utf8')).extractionRules.find(r=>r.id==='re20-rset-roof-insulation');
const roof=t=>new RegExp(rule.regex,'im').exec(t)?.[1];
eq([roof('Nature de l\'isolation des toitures Autre vegetalisee ? Non'),roof('Nature de l\'isolation des toitures Autre La toiture est-t-elle Non'),roof('Nature de l\'isolation des toitures Laine de verre soufflée')],['Autre','Autre','Laine de verre soufflée'],'nature de l’isolation des toitures sans la question suivante');
console.log(`v2.20.3 — ${n} vérifications OK (données fictives)`);
