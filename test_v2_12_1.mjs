// ExtracTerre v2.12.1 — fiche Évaluation Salesforce : nombres à espace de milliers, gain « (Gain BBio = x %) », libellés de
// plusieurs mots séparés par « / », DH par groupes « … : x ; … : y », isolants sous un sous-titre « Mur extérieur ITI : ». Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {parseFreePaste,freePasteValues} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.12.3','version');
const page=`Contract
00009991 | Contrat
Performance thermique
Bâtiment A :
Nombre de logements = 30
Sref = 1 780,20
BBio = 40,2 / Bbiomax = 57,8 (Gain BBio = 30,4 %)
Cep = 62,7 / Cepmax = 77,8 (Gain Cep = 19,4 %)
DH (Zones traversantes) = Groupe T A élec : 575,60 ; Groupe T A clim : 516,60
DH (Zones non traversantes) = Groupe NT A élec : 1 048,50 ; Groupe NT A clim : 1 175,20
IC Construction = 932,06 / IC Construction 2022 = 1033,1 / IC Construction 2025 = 944,63
IC Energie = 75,55 / IC Energie 2022 = 512,46 / IC Energie 2025 = 237,93

Bâtiment B :
Nombre de logements = 20
DH (Zones traversantes) = Groupe T B clim : 689,70
Performance thermique - Notes
Planchers hauts
Toiture terrasse accessible :
- PU type Efigreen ou techniquement équivalent - 160 mm - R = 7.25 pour les terrasses.
- PU type FICTIF - 60 mm - R = 2.7.
Planchers hauts - Notes
Parois verticales
Mur extérieur ITI :
PSE graphité FICTIF - 100 mm - R = 3.4

Mur extérieur ITE :
LDR type FICTIF - R = 2.6

Murs sur LNC :
PSE FICTIF - 80 mm - R = 2.35
Parois verticales - Notes
Planchers bas
Plancher bas sur parking :
LM projetée en sous face type FICTIF d' EURISOL - 130 mm - R = 3.4
Isolant sur dalle type TMS FICTIF - 40 mm - R = 1.7
Planchers bas - Notes`;
const v=Object.fromEntries(freePasteValues(parseFreePaste(page)).map(x=>[x.building,x.values]));
const A=v['Bâtiment A'], c=v[''];
eq([A.shab,A.bbio_gain,A.cep_gain],[1780.2,30.4,19.4],'espace des milliers, gain « (Gain BBio = …) »');
eq([A.ic_construction,A.ic_construction_max,A.ic_energy,A.ic_energy_max],[932.06,944.63,75.55,237.93],'IC sur une ligne « / », seuil 2025');
eq([A.dh_zt,A.dh_znt,A.dh,v['Bâtiment B'].dh_zt],[575.6,1175.2,1175.2,689.7],'DH : groupe le plus défavorable de chaque type');
eq([c.roof_insulation,c.roof_insulation_thickness,c.roof_insulation_r],['PUR',160,7.25],'toiture : première ligne');
eq([c.wall_iti_insulation,c.wall_iti_r,c.wall_ite_insulation,c.wall_ite_r,c.wall_insulation,c.wall_insulation_r],['PSE graphité',3.4,'Laine de roche',2.6,'PSE graphité',3.4],'ITI / ITE par sous-titre, colonne générale = mur extérieur');
eq([c.floor_insulation,c.floor_insulation_thickness,c.floor_insulation_r],['Laine minérale',130,3.4],'plancher bas : isolant, épaisseur et R de la même ligne');
console.log(`v2.12.3 — ${n} vérifications OK (données fictives)`);
