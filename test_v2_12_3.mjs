// ExtracTerre v2.12.3 — tableau d'opérations « Code projet | Nom projet | Maître d’ouvrage | Groupe MOA » (export Salesforce). Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,matchFieldByHeader} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.14.0','version');
eq(['Code projet','Nom projet','Maître d’ouvrage','Groupe MOA'].map(h=>matchFieldByHeader(h)?.key),['internal_code','project','owner_company','owner_main_company'],'en-têtes reconnus');
console.log(`v2.14.0 — ${n} vérifications OK (données fictives)`);
