// ExtracTerre v2.16.3 — archive .zip d'export RSEE (XML à la racine, fiches de composants en sous-dossier). Données FICTIVES.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.22.2','version');
const app=fs.readFileSync('./js/app.js','utf8');
const src=app.slice(app.indexOf('function zipDocEntries('),app.indexOf('async function addQuestionnaireZip('));
const zipDocEntries=new Function(src+';return zipDocEntries;')();
const names=fs=>zipDocEntries(fs.map(name=>({name,dir:name.endsWith('/')}))).map(f=>f.name);
eq(names(['Xml_RSEE_Projet test.xml','Xml_RSEE_Projet test/','Xml_RSEE_Projet test/Chape fictive.xml','Xml_RSEE_Projet test/Occultation fictive.xml']),['Xml_RSEE_Projet test.xml'],'export RSEE : seul le XML racine');
eq(names(['Synthese.pdf','Op_questionnaire.json','DPGF.xml']),['Op_questionnaire.json'],'paquet questionnaire : seul le JSON');
eq(names(['notes.txt','images/plan.png']),[],'rien de lisible');
console.log(`v2.22.2 — ${n} vérifications OK (données fictives)`);
