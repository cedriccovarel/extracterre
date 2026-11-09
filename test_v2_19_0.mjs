// ExtracTerre v2.18.3 — vecteur hybride (principal d'abord) et regroupement « Bâtiment 1 Est » → « Bâtiment 1 ». Données FICTIVES.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
import {detectVector,vectorFromShares,hybridLabel} from './js/vecteurs.js';
import {buildBuildingGrouping} from './js/engine.js';
import {buildingQualifiedCore} from './js/buildings.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.22.2','version');
// Hybride écrit dans le document : vecteur principal d'abord, le générateur « d'appoint » / « en relève » ensuite.
eq(detectVector('PAC hybride air/eau + chaudière gaz à condensation'),'Hybride Électricité/Gaz','PAC hybride + gaz');
eq(detectVector('Chaudière gaz condensation + PAC air/eau en relève'),'Hybride Gaz/Électricité','gaz principal, PAC en relève');
eq(detectVector('Système bi-énergie : PAC en appoint, chaudière gaz'),'Hybride Gaz/Électricité','PAC en appoint = second');
eq(detectVector('Chaudière bois bivalente avec appoint fioul'),'Hybride Bois/Fioul','libellés courts');
// Pas de fourre-tout : sans mention d'hybride, le vecteur principal seul.
eq(detectVector('Chaudière gaz collective ; sèche-serviettes électriques en salle de bains'),'Gaz','sèche-serviettes');
eq(detectVector('Chaudière gaz | VMC hybride'),'Gaz','ventilation hybride ≠ chauffage hybride');
eq(detectVector('PAC hybride'),'Hybride','second vecteur non nommé : rien d’inventé');
eq(detectVector('Réseau de chaleur urbain'),'Réseau de chaleur urbain','inchangé');
// Calcul par consommations : hybride si le second vecteur fait au moins 30 %.
eq(vectorFromShares([['Gaz',70],['Électricité',30]]),'Hybride Gaz/Électricité','30 %');
eq(vectorFromShares([['Gaz',75],['Électricité',25]]),'Gaz','25 % : principal seul');
eq(vectorFromShares([['Électricité',50],['Gaz',40],['Bois / biomasse',10]]),'Hybride Électricité/Gaz','deux vecteurs au plus');
eq(hybridLabel('Réseau de chaleur urbain','Gaz'),'Hybride RCU/Gaz','RCU');
// Bâtiments : « Bâtiment 1 Est » rejoint « Bâtiment 1 » ; une liste « 1 2 10 » ou « B C » jamais.
const g=names=>Object.fromEntries(buildBuildingGrouping([],names.map(b=>({building:b}))).aliases.map(a=>[a.source,a.target]));
eq(g(['Bâtiment 1','Bâtiment 1 Est','Bâtiment 2'])['Bâtiment 1 Est'],'Bâtiment 1','1 Est → 1');
eq(g(['Bâtiment A','Bâtiment A aile nord','Bâtiment A1'])['Bâtiment A aile nord'],'Bâtiment A','aile nord');
eq(g(['Bâtiment A','Bâtiment A aile nord','Bâtiment A1'])['Bâtiment A1'],'Bâtiment A1','A1 reste distinct');
eq(g(['Bâtiment 1','Bâtiment 1 2 10'])['Bâtiment 1 2 10'],'Bâtiment 1 2 10','liste d’identifiants');
eq(buildingQualifiedCore('Bâtiment B C'),'','B C');
{ const r=buildBuildingGrouping([],['Bâtiment 1 Est','Bâtiment 1 Ouest'].map(b=>({building:b})));
  eq(r.aliases.every(a=>a.source===a.target),true,'sans « Bâtiment 1 » seul : pas de fusion automatique');
  eq(r.suggestions.map(s=>[s.a,s.b]),[['Bâtiment 1 Est','Bâtiment 1 Ouest']],'mais rapprochement proposé'); }
// Recherche manuelle dans l'écran des bâtiments.
const app=readFileSync('js/app.js','utf8');
eq(/id="buildingSearch"/.test(app)&&/id="selectFoundBuildings"/.test(app)&&/data-building-row=/.test(app),true,'barre de recherche');
console.log(`test_v2_19_0 : ${n}/${n} OK`);
