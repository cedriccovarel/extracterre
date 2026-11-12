// ExtracTerre v2.20.4 — encart « Compléments » : boutons dans la carte ; colonne de droite lisible en fenêtre moyenne.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.24.5','version');
const css=readFileSync('styles.css','utf8'), tail=css.slice(css.indexOf('/* v2.20.4'));
eq(/\.ux-tools-card \.ux-tool-row \.btn\.ux-manual-btn\{width:auto;max-width:48%;margin:0/.test(tail),true,'bouton à sa taille, plus 100 %');
eq(/\.ux-tools-card \.ux-tool-row>div\{flex:1 1 auto;min-width:0\}/.test(tail),true,'texte qui se replie');
eq(/@media\(max-width:1180px\)\{\.ux-right-rail\.ux-right-rail-clean\{display:flex\}\}/.test(tail),true,'une colonne de cartes ≤ 1180 px');
eq(/@media\(max-width:960px\)\{\.ux-dashboard-grid\.ux-dashboard-grid-clean\{grid-template-columns:minmax\(0,1fr\)\}/.test(tail),true,'cartes sous les résultats ≤ 960 px');
console.log(`test_v2_20_4 : ${n}/${n} OK`);
