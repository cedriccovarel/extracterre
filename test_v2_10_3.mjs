// ExtracTerre v2.10.3 — fiche Évaluation Salesforce : blocs « ILOT_1 : », paires « = », sélection sans en-tête OPE. FICTIF.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {parseFreePaste,freePasteValues,looksLikeSalesforceEvaluation} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.13.1','version');
const page=`Observations générales
Performance thermique
ILOT_1 :
Nombre de logements = 3
Sref = 200
Bbio = 60
Bbiomax = 80
Gain Bbio = 25
DH des zones traversantes = 500
DH des zones non traversantes =
IC Construction max 2025 = 700
Q4 Pa-surf = 0,5

ILOT_2 : (ilot 3 sur ACV)
Nombre de logements = 4
Sref = 300
Bbio = 70
Performance thermique - Notes
ILOT_1 :
Total des surfaces de planchers bas = 148,87
Parois verticales
Murs extérieurs :
- Contre-cloison avec isolant laine de bois épaisseur 100 mm R=2.75 m2.K/W et Plaque BA13
Murs de refend entre logements :
- Isolant laine de roche ép. 45 mm R=1,2
Planchers bas
isolation sous dalle ép. 26 cm R ≥ 6.84
Menuiseries extérieures
Châssis, Vitrages : Châssis en bois lamellé collé,
Fenêtres de toit : Type GGL en bois/aluminium
Occultations :
- Volets roulants extérieurs motorisés
> Lot 03 — Page 17
Chauffage
Générateur / Production :
Pompe à chaleur air/eau FICTIVE 3 kW,
Émetteurs / Radiateurs :
- Radiateurs à eau chaude FICTIFS
Renouvellement d'air
Ventilation Mécanique Contrôlée simple flux Hygroréglable type B
Énergies renouvelables
SO`;
eq(looksLikeSalesforceEvaluation(page),true,'sélection sans OPE reconnue');
const fp=parseFreePaste(page), b=Object.fromEntries(freePasteValues(fp).map(x=>[x.building,x.values]));
eq(Object.keys(b),['','ILOT_1','ILOT_2'],'îlots = bâtiments, notes de section ignorées');
eq([b.ILOT_1.housing_count,b.ILOT_1.shab,b.ILOT_1.bbio_max,b.ILOT_1.dh,b.ILOT_1.cross_ventilated,b.ILOT_1.ic_construction_max,b.ILOT_1.q4pa_surf],[3,200,80,500,'Oui',700,0.5],'libellés « = » de la fiche');
eq([b.ILOT_2.housing_count,b.ILOT_2.shab,b.ILOT_2.bbio],[4,300,70],'ILOT_2 séparé d’ILOT_1');
eq(fp.notes,['ILOT_2 : ilot 3 sur ACV (remarque de la fiche).'],'remarque d’en-tête signalée');
const c=b[''];
// v2.13.1 : une ligne ITI / ITE remplit aussi la colonne générale (comme la lecture des documents) ; le refend (R=1,2) reste ignoré.
eq([c.wall_iti_insulation,c.wall_iti_thickness,c.wall_iti_r,c.wall_insulation_r],['Fibre de bois',100,2.75,2.75],'contre-cloison en ITI, refend ignoré');
eq([c.floor_insulation_thickness,c.floor_insulation_r],[260,6.84],'R ≥');
eq([c.window_material,c.window_shading,c.heating_mode_after,c.ventilation,c.enr],['Bois','Volet roulant','Pompe à chaleur air/eau FICTIVE 3 kW','VMC Hygro B','Non'],'menuiseries hors fenêtres de toit, générateur seul, SO');
eq(fp.unmatched,[],'rien de non reconnu');
console.log(`v2.10.3 — ${n} vérifications OK (données fictives)`);
