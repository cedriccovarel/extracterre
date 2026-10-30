// ExtracTerre v2.10.7 — fiche Évaluation Salesforce : en-têtes « BAT AB / Nbre logts = 14 / Q4 = 0,72 », paires séparées par « - »,
// « Gain » rattaché à la valeur précédente, DH par zone et typologie, lignes d'enveloppe « BAT C / … » par bâtiment. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {parseFreePaste,freePasteValues} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.14.2','version');
const page=`Performance thermique
BAT AB / Nbre logts = 10 / Q4 = 0,7
BBio = 60 - Bbiomax = 70 - Gain = 14,3
DH ZT - T3 = 600,5 - T2 = 800,2
DH ZNT - T2 = 650
IC Construction = 640,1 - IC Energie = 80

BAT C / Nbre logts = 4 / Q4 = 0,9
Cep = 50 - Cepmax = 80 - Gain = 37,5
DH ZT = 570
Performance thermique - Notes
ℹ️ BAT AB / 5* T2
Planchers hauts
Toiture inacc. tech. : Efigreen Duo+ 10cm - R ≥ 4,55
BAT A & B / Combles : GR32 nu 40cm - R ≥ 12,5
BAT C / Combles : GR32 nu 20cm - R ≥ 6,25
Chauffage
- Logements : PAC FICTIVE - Ca=⚠️
Renouvellement d'air
VMC SF Hygro B`;
const r=parseFreePaste(page), all=freePasteValues(r), v=all.filter(x=>x.building);
eq(all.map(x=>x.building),['','Bâtiment AB','Bâtiment C'],'valeurs communes puis deux bâtiments');
eq([all[0].values.roof_insulation,all[0].values.ventilation],['PUR','VMC Hygro B'],'toiture et ventilation communes');
eq(v[0].values.housing_count,10,'logements de l’en-tête'); eq(v[0].values.q4pa_surf,0.7,'Q4 de l’en-tête');
eq([v[0].values.bbio,v[0].values.bbio_max,v[0].values.bbio_gain],[60,70,14.3],'« - » entre les paires, Gain rattaché');
eq(v[0].values.dh,800.2,'DH : zone et typologie la plus défavorable');
eq([v[0].values.ic_construction,v[0].values.ic_energy],[640.1,80],'IC séparés par « - »');
eq([v[1].values.cep,v[1].values.cep_max,v[1].values.cep_gain,v[1].values.dh],[50,80,37.5,570],'bloc C');
eq([v[0].values.roof_insulation,v[0].values.roof_insulation_thickness,v[0].values.roof_insulation_r],['Laine de verre',400,12.5],'combles A & B dans le bâtiment AB');
eq([v[1].values.roof_insulation_thickness,v[1].values.roof_insulation_r],[200,6.25],'combles C dans le bâtiment C');
eq(all[0].values.heating_mode_after,'Logements : PAC FICTIVE','émoji et « Ca= » sans valeur retirés');
eq(r.unmatched.length,0,'rien d’ignoré');
console.log(`v2.14.2 : ${n}/${n} OK`);
