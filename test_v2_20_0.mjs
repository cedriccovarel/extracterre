// ExtracTerre v2.20.0 — affichage en fenêtre étroite ou basse, mini-fenêtre flottante (Document Picture-in-Picture).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.32.1','version');
const html=readFileSync('index.html','utf8'), css=readFileSync('styles.css','utf8'), app=readFileSync('js/app.js','utf8');
// Bouton dans l'en-tête, branché ; infobulle sur chaque entrée du menu (menu en icônes seules quand la fenêtre est étroite).
eq(/id="miniWindowBtn"/.test(html)&&/miniBtn\.onclick=openMiniWindow/.test(app),true,'bouton mini-fenêtre');
const navItems=html.match(/<(?:button|label) class="[^"]*ux-nav-item[^"]*"[^>]*>/g)||[];
eq(navItems.length>10&&navItems.every(t=>/title="[^"]+"/.test(t)),true,'infobulles du menu');
// Mini-fenêtre : Document PiP d'abord, petite fenêtre sinon ; dépôt → addFiles de l'opération active ; rien de stocké.
const mini=app.slice(app.indexOf('var miniWin=null;'),app.indexOf('function updateUxMirrors(){'));
eq(/documentPictureInPicture\.requestWindow/.test(mini)&&/window\.open\(''/.test(mini),true,'PiP puis repli');
eq(/filesFromDrop\(e\.dataTransfer\)/.test(mini)&&/addFiles\(fs\)/.test(mini),true,'dépôt de fichiers');
eq(/localStorage|sessionStorage|indexedDB|fetch\(/.test(mini),false,'aucun stockage ni envoi');
eq(/refreshMiniWindow\(\);/.test(app.split('\n').find(l=>l.startsWith('function updateUxMirrors'))||''),true,'mise à jour avec l’écran principal');
// CSS : tuiles qui tiennent dans 390 px, menu compact en hauteur réduite, menu collant en largeur réduite.
eq(css.includes('minmax(min(250px,100%),1fr)'),true,'tuiles sans débordement');
eq(/@media\(min-width:821px\) and \(max-height:720px\)/.test(css)&&/@media\(max-width:820px\)\{\.ux-sidebar\{position:sticky;top:0/.test(css),true,'menu compact');
console.log(`test_v2_20_0 : ${n}/${n} OK`);
