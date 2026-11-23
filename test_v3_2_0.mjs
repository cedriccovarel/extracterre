// ExtracTerre v3.2.0 — écart Salesforce ↔ documents : Salesforce reste retenu par défaut ; un choix « documents » par cellule
// garde la valeur lue, il est sauvegardé, exporté (session → TotalRecoll) et la valeur Salesforce reste confrontée.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION} from './js/config.js';
import {serializeProjectFull,hydrateProjectFull} from './js/persistence.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const has=(s,re,m)=>{ assert.match(s,re,m); n++; };
eq(APP_VERSION,'3.4.1','version');
const p=serializeProjectFull({id:'p1',docs:[],sfDocChoice:{'Bâtiment A|cep':'doc'}});
eq(p.sfDocChoice,{'Bâtiment A|cep':'doc'},'choix sauvegardé');
eq(hydrateProjectFull(p).sfDocChoice,{'Bâtiment A|cep':'doc'},'choix relu');
eq(serializeProjectFull({id:'p2',docs:[]}).sfDocChoice,{},'sans choix : Salesforce partout (défaut inchangé)');
const src=fs.readFileSync('./js/app.js','utf8');
has(src,/project\.sfDocChoice\?\.\[`\$\{building\}\|\$\{field\}`\]==='doc'&&SF_SRC\.test/,'seule une valeur Salesforce explicitement basculée cède la place');
has(src,/sfDocDiffers\(field,value,docFinal\.value\)\)\{\s*Object\.assign\(docFinal,\{sfChoice:'doc',sfValue:value/,'valeur Salesforce gardée sur la cellule');
has(src,/sf:\[\.\.\.sfFin,\.\.\.sfKept\]/,'valeur Salesforce toujours confrontée aux documents');
has(src,/sfChoice:'doc',sfValue:o\.sfValue/,'export de session : choix et valeur Salesforce');
has(src,/documentValue:o\.documentValue,documentFile/,'export de session : valeur des documents quand Salesforce est retenu');
console.log(`test_v3_2_0 : ${n} vérifications OK`);
