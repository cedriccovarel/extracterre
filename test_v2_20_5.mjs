// ExtracTerre v2.20.5 — import Salesforce : la fenêtre ouverte par le favori (relay.html) affiche le contrôle des données.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.23.3','version');
const app=readFileSync('js/app.js','utf8'), relay=readFileSync('relay.html','utf8');
// Onglet ExtracTerre : accusé de réception « check », envoi du contrôle à chaque changement, actions reçues, fin signalée.
eq(/bc\.postMessage\(\{type:'ack',id:m\.id,check:true\}\); relayImportId=/.test(app),true,'accusé de réception avec contrôle');
eq(/m\?\.type==='action'&&m\.id&&m\.id===relayImportId\)\{ miniCheckAction\(/.test(app),true,'actions de la fenêtre d’import (même import seulement)');
eq(/relayBc\.postMessage\(\{type:'check',id:relayImportId,html,/.test(app)&&/relayBc\.postMessage\(\{type:'done',id:relayImportId,outcome:/.test(app),true,'contrôle et fin envoyés');
eq(/function refreshMiniWindow\(\)\{\n  pushRelayCheck\(\);/.test(app),true,'contrôle à jour même sans mini-fenêtre');
eq(/→ Projet : <b>\$\{escapeHtml\(projectTitle\(activeProject\(\)\)\)\}<\/b>/.test(app),true,'projet cible affiché');
eq(/popup,width=440,height=700/.test(app),true,'nouveau favori : fenêtre plus grande');
// Fenêtre d'import : agrandie si besoin (ancien favori), actions renvoyées, fermeture après intégration ; ancien onglet → ancien message.
eq(/window\.resizeTo\(/.test(relay)&&/type:'action',id,kind,ref,value/.test(relay),true,'agrandie, actions renvoyées');
eq(/if\(!d\.check\)\{ m\.innerHTML='<p><b>✓ Envoyé<\/b>/.test(relay),true,'compatibilité avec un onglet d’avant');
eq(/d\.type==='done'/.test(relay)&&/window\.close\(\),1800/.test(relay),true,'fermeture après intégration');
eq(/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest/.test(relay),false,'rien stocké ni envoyé');
console.log(`test_v2_20_5 : ${n}/${n} OK`);
