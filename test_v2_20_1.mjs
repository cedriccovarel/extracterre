// ExtracTerre v2.20.1 — contrôle de l'import Salesforce dans la mini-fenêtre.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.27.0','version');
const app=readFileSync('js/app.js','utf8');
const block=app.slice(app.indexOf('function miniCheckHtml()'),app.indexOf('function wireMiniWindow('));
// Affiché seulement quand un import attend dans « Données manuelles » ; rafraîchi après l'ouverture de la fenêtre de dialogue.
eq(/if\(!fp\|\|!\$\('#manualDataDialog'\)\?\.open\) return '';/.test(block),true,'condition d’affichage');
eq(/dlg\.showModal\(\); refreshMiniWindow\(\);/.test(app),true,'rafraîchi après réception');
eq(/addEventListener\('close',\(\)=>refreshMiniWindow\(\)\)/.test(app),true,'masqué à la fermeture');
// Les actions passent par l'aperçu de la page (mêmes règles) : sélecteurs data-fp-*, bouton Intégrer de la page.
eq(/data-fp-u=/.test(block)&&/data-fp-b=/.test(block)&&/dispatchEvent\(new Event\('change'/.test(block),true,'colonne changée via l’aperçu');
eq(/\$\('#manualDataApply'\)\?\.click\(\)/.test(block),true,'Intégrer = bouton de la page');
eq(/localStorage|sessionStorage|indexedDB|fetch\(/.test(block),false,'aucun stockage ni envoi');
// Échappement des textes de la fiche.
eq((block.match(/escapeHtml\(/g)||[]).length>=6,true,'textes échappés');
console.log(`test_v2_20_1 : ${n}/${n} OK`);
