// ExtracTerre v2.22.3 — format « libellé = valeur » RE2020 (prompt de mise en forme) et fiche Salesforce du favori. FICTIF.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {parseFreePaste,freePasteValues} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.32.1','version');
// 1. Texte au format du prompt : enveloppe par paroi, alias ICC / ICE / Perméabilité, menuiseries.
const txt=`BATIMENT A :
Nombre de logements = 32
IC Construction = 640
ICC max 2025 = 740
ICE max 2025 = 260
Perméabilité Q4Pa-surf = 0,8
Murs extérieurs après travaux = Béton 18 cm + laine de bois FICTIVE 140 mm
R isolant murs extérieurs après travaux = 3,70
Murs sur LNC après travaux = Parpaing + PSE 100 mm
R isolant murs sur LNC après travaux = 3,15
Plancher bas sur terre-plein après travaux = Dalle béton + PSE 100 mm
R isolant plancher bas sur terre-plein après travaux = 3,15
Plancher haut combles après travaux = LdV soufflée 400 mm
R isolant plancher haut combles après travaux = 10
Toiture terrasse après travaux = PU 160 mm
R isolant toiture terrasse après travaux = 7,25
Menuiseries après travaux = PVC

BATIMENT B :
Murs extérieurs après travaux = Brique 20 cm + LDB 140 mm λ 0,038 (ITE)
Rampants après travaux = PU 160 mm`;
const p=parseFreePaste(txt), v=Object.fromEntries(freePasteValues(p).map(x=>[x.building,x.values])), A=v['Bâtiment A'], B=v['Bâtiment B'];
eq([A.ic_construction_max,A.ic_energy_max,A.q4pa_surf,A.window_material],[740,260,0.8,'PVC'],'alias ICC / ICE max 2025, perméabilité, menuiseries');
eq([A.wall_structure,A.wall_insulation,A.wall_insulation_thickness,A.wall_insulation_r],['Béton 18 cm','Fibre de bois',140,3.7],'murs extérieurs : structure + isolant + épaisseur + R');
eq([A.floor_insulation,A.floor_insulation_r],['PSE',3.15],'plancher bas');
eq([A.roof_insulation,A.roof_insulation_thickness,A.roof_insulation_r],['Laine de verre',400,10],'une paroi par famille : la première (combles), la toiture terrasse ne l’écrase pas');
eq([B.wall_insulation,B.wall_insulation_r,B.wall_ite_insulation,B.wall_ite_r,B.roof_insulation],['Fibre de bois',3.7,'Fibre de bois',3.7,'PUR'],'LDB, R = e / λ arrondi à 0,05, ITE, PU');
eq(p.unmatched.map(u=>u.label),[],'rien de non reconnu (paroi secondaire ignorée)');
// 2. Fiche Salesforce : « 6 MI », DH de maison, vecteurs, notes.
const page=`Observations générales
Récupérateur de chaleur sur eaux grises FICTIF prévu
Performance thermique
BAT A / 6 MI - SHAB = 600
DH = 450
Bbio = 50

BAT B / 32 logts - SHAB = 2000
Bbio = 35
Bbiomax = 60
Gain Bbio = 41,5
Parois verticales
Murs extérieurs : Isolant LDB 140 mm λ 0,038
Chauffage
Chaudière gaz murale à condensation FICTIVE
Eau chaude sanitaire
Chauffe-eau thermodynamique FICTIF
Planchers bas
Plancher sur vide sanitaire PS à justifier en EXE`;
const fp=parseFreePaste(page), b=Object.fromEntries(freePasteValues(fp).map(x=>[x.building,x.values])), c=b[''];
eq([b['Bâtiment A'].housing_count,b['Bâtiment A'].dh_zt,b['Bâtiment A'].cross_ventilated,b['Bâtiment A'].dh_znt],[6,450,'Oui',undefined],'6 MI = 6 logements ; DH unique de maison = zones traversantes');
eq([b['Bâtiment B'].housing_count,b['Bâtiment B'].dh_zt],[32,undefined],'collectif : DH non déduit');
eq([c.heating_vector_after,c.ecs_vector_after,c.heating_mode_after],['Gaz','Électricité','Chaudière gaz murale à condensation FICTIVE'],'vecteurs après travaux ; mode inchangé');
eq([c.wall_insulation,c.wall_insulation_thickness,c.wall_insulation_r],['Fibre de bois',140,3.7],'LDB et R calculé dans la fiche');
const notes=fp.notes.join('\n');
for(const [re,m] of [[/BAT B : Gain Bbio 41,5/,'écart de gain > 0,1 point'],[/BAT B : Bbio 35 inférieur à 40/,'Bbio atypique en collectif'],[/R calculé = épaisseur \/ λ = 3,7/,'R calculé signalé'],
  [/eaux grises/,'eaux grises signalées'],[/Chaudière murale de logement dans un collectif/,'chaudière murale en collectif'],[/NC \/ PS \/ à justifier non reprises : .*PS à justifier en EXE/,'mentions PS / à justifier']]) eq(re.test(notes),true,m);
console.log(`test_v2_22_3 : ${n} vérifications OK`);
