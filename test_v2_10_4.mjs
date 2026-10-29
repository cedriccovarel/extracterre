// ExtracTerre v2.10.4 — fiche Évaluation Salesforce : en-têtes à puce « * BEG-1/2 : x2 lgts indiv : », valeurs
// « valeur / maximum / gain », DH sur deux zones. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {parseFreePaste,freePasteValues} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.12.2','version');
const page=`Opération
OPE-009002
Évaluateur
Performance thermique
* BEG-1/2 : x2 lgts indiv :
Bbio :84,4 / 91,8 / -8,1 %
Cep : 52, / 87,5 / -40,6 %
DH : 713,9 et 625
SHAB : 118,6 m2
ICconstruction : 767,85 / 780,02
* M1 : x1 lgt indiv :
Bbio : 79,6 / 79,8 / -0,3 %
Cepnr : 650 / 77,4 / -22,5 %
Performance thermique - Notes
* RSET : gain bbio -0,3 % >NC
Parois verticales
* Mur / EXT : Brique FICTIVE R=1,5 §A CCTP GO
+ PSE Fictistyrene 120+10 mm R=4,1 §06 CCTP Platrerie
* Mur entre logements : KNAUF FICTIF suivant ETH
Chauffage
* PAC air/eau indiv FICTIVE AI 5 (250L) §B p25 CCTP CVPB :
- Radiateur eau
- Sèche serviette mixte FICTIVE
Menuiseries extérieures
* PVC :
- VR manuel lgt locatif
Énergies renouvelables
ras
OPE-009002
Résidence Fictive
1 rue des Tests
59000 LILLE
Performance :
Niveau Cep RE 2020 - 5%`;
const fp=parseFreePaste(page), b=Object.fromEntries(freePasteValues(fp).map(x=>[x.building,x.values]));
eq(Object.keys(b),['','BEG-1/2','M1'],'en-têtes à puce');
const g=b['BEG-1/2'];
eq([g.housing_count,g.bbio,g.bbio_max,g.bbio_gain,g.cep,g.cep_max,g.cep_gain,g.dh,g.shab,g.ic_construction,g.ic_construction_max],[2,84.4,91.8,8.1,52,87.5,40.6,713.9,118.6,767.85,780.02],'valeur / max / gain, DH le plus défavorable');
eq(b.M1.housing_count,1,'x1 lgt');
eq(fp.notes.length,1,'Cepnr 650 incohérent signalé');
const c=b[''];
eq([c.internal_code,c.operation_name,c.postcode,c.cep_level],['OPE-009002','Résidence Fictive','59000','RE 2020 - 5%'],'en-tête : le bloc OPE suivi de l’adresse, pas « Évaluateur »');
eq([c.wall_insulation,c.wall_insulation_thickness,c.wall_insulation_r],['PSE',120,4.1],'R de la brique non pris pour l’isolant ; 120+10 mm = 120 mm d’isolant');
eq([c.heating_mode_after,c.window_shading],['PAC air/eau indiv FICTIVE AI 5 (250L)','Volet roulant'],'générateur sans émetteurs ; VR manuel');
eq(fp.unmatched,[],'rien de non reconnu');
console.log(`v2.12.2 — ${n} vérifications OK (données fictives)`);
