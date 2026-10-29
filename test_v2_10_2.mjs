// ExtracTerre v2.10.2 — fiche Évaluation Salesforce (favori) convertie en collage libre par bâtiment. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {parseFreePaste,freePasteValues,looksLikeSalesforceEvaluation} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.12.1','version');
const page=`Opération
OPE-009001
Prévisualiser
Données techniques
Performance thermique
Maison 1 =
Bbio : 60
Bbio max :  80
Gain Bbio : -25 %
Cepmax : 90
Cep : 81
Gain Cep : -10 %
SHAB : 90 m2
Q4 : 0,5 (rset)
ICconstruction : 700
Maisons 2/3 =
Bbio : 50
Bbio max : 80
Gain Bbio : -37,5 %
Cepnr : 47
Cepnrmax : 52,8
Gain Cepnr : -25,2 %
Planchers hauts: COMBLES : Laine de verre 300 mm R=7,5 §0642 p 16 CCTP Platrerie
Parois verticales :
* Mur EXT : Porotherm ep:20 cm R non défini §454 CCTP GO
+ Doublage ITI FICTIMAX ep: 120 mm R=3,8 §0642 CCTP Doublage
Planchers bas - Notes
* Rset : Bois > NC
Menuiseries extérieures
* PVC :
- Occultation : volets roulants
Chauffage
* Pompe à chaleur air/eau FICTIVE 6 kW §411 CCTP
Chauffage - Notes
* Rset : chaudière gaz > NC
Renouvellement d'air
* SF hygro B
Informations système
OPE-009001
Résidence Fictive
12 rue des Essais
69003 LYON
Statut du contrat 00009001 : En cours
Référentiel BEE Logement Neuf - Version du 25/09/2024
Individuel groupé : 3 logement(s) - 2 bâtiment(s)
Mentions :
BEE+
Profil spécifique :
Performance :
Niveau Cep,nr RE 2020 -10%
Maître d'ouvrage : BAILLEUR FICTIF`;
eq(looksLikeSalesforceEvaluation(page),true,'détection');
eq(looksLikeSalesforceEvaluation('Numéro du contrat\n00009001\nOPE-009001'),false,'autre page Salesforce : collage libre habituel');
const fp=parseFreePaste(page), v=freePasteValues(fp), b=Object.fromEntries(v.map(x=>[x.building,x.values]));
eq(Object.keys(b),['','Maison 1','Maisons 2/3'],'opération + 2 bâtiments');
eq(fp.unmatched,[],'toutes les lignes reconnues');
const c=b[''];
eq([c.internal_code,c.contract_number,c.operation_name,c.address,c.postcode,c.city,c.department,c.reference_name,c.owner_company,c.housing_total,c.building_total,c.mention_bee_plus,c.cepnr_level],
  ['OPE-009001','00009001','Résidence Fictive','12 rue des Essais','69003','LYON','69','BEE Logement Neuf','BAILLEUR FICTIF',3,2,'Oui','RE 2020 -10%'],'en-tête');
eq([c.roof_insulation,c.roof_insulation_thickness,c.roof_insulation_r,c.wall_structure,c.wall_iti_insulation,c.wall_iti_thickness,c.wall_iti_r],['Laine de verre',300,7.5,'Brique terre cuite','FICTIMAX',120,3.8],'enveloppe, doublage en ITI');
eq([c.window_material,c.window_shading,c.ventilation,c.heating_mode_after],['PVC','Volet roulant','VMC Hygro B','Pompe à chaleur air/eau FICTIVE 6 kW'],'systèmes, notes ignorées');
eq([b['Maison 1'].housing_count,b['Maison 1'].bbio_gain,b['Maison 1'].cep_max,b['Maison 1'].cep_gain,b['Maison 1'].shab,b['Maison 1'].q4pa_surf,b['Maison 1'].ic_construction],[1,25,90,10,90,0.5,700],'bâtiment : alias Salesforce, gains positifs');
eq(b['Maisons 2/3'].housing_count,2,'« Maisons 2/3 » = 2 logements');
eq(fp.notes.length,1,'gain incohérent signalé');
console.log(`v2.10.2 — ${n} vérifications OK (données fictives)`);
