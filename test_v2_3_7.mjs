// ExtracTerre v2.3.7 — documents FICTIFS reproduisant la structure de : RSEnv 2024 (tableaux de seuils par période),
// rapport ACV Pléiades, synthèse des prestations Pléiades, synthèse des déperditions ; vitrage ≠ numéro de version ;
// conservation des valeurs d'un document retiré.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,DOC_TYPES,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {mkPage,mkDoc} from './test_fixtures_v2_3_3.mjs';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.15','version');
const rows=(arr,y0=800)=>arr.map((t,i)=>[t,y0-i*10]);
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:'pdf'}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.familyMode='auto'; d.buildings=detectBuildings(d); return d; };
const val=(out,f,b)=>out.find(o=>o.field===f&&(!b||o.building===b))?.value;

// --- 1. RSEnv 2024 : seuils par période (Icconstruction_max_2028, Icenergie_max_2028) + données bâtiment ------------
const seuils=(b,c,e)=>[`Respect des exigences de l'arrete pour le batiment : ${b} Conformite a la RE2020`,'Respect des Icconstruction_max',
  'Icconstruction Icconstruction_max Icconstruction_max_2022 Icconstruction_max_2025 Icconstruction_max_2028 Icconstruction_max_2031',c,'Respect des Icenergie_max',
  'Icenergie Icenergie_max Icenergie_max_2022 Icenergie_max_2025 Icenergie_max_2028',e];
const rsenv=prep(mkDoc('re','RSENV fictif.pdf',[mkPage(1,rows(['REGLEMENTATION ENVIRONNEMENTALE 2020','Recapitulatif Standardise Energie Environnement','Partie « Etude Environnementale »'])),
  mkPage(2,rows(['Donnees techniques, niveau batiment et zone','Nom du batiment Batiment 1','Surface de Reference [m2] 2 144,21','ZONE 1 Usage logement collectif','Surface de reference [m2] 2 144,21','Nombre de logement 36',
    'Nom du batiment Batiment 2','Surface de Reference [m2] 1 755,07','Nombre de logement 20','Nombre de logement 9','Chapitre 3 : Exigences de performance environnementale',
    ...seuils('Batiment 1','532,362 801,88 801,88 714,54 646,608 559,267','84,843 588,877 588,877 273,407 273,407')])),
  mkPage(3,rows(seuils('Batiment 2','585,031 849,241 849,241 760,04 690,52 601,953','79,687 586,961 586,961 272,517 272,517'))),
  mkPage(4,rows(["Indicateurs principaux, a l'echelle du batiment 1","Indicateur d'impact sur le changement climatique (contributionconstruction) - [kgeq.CO2/m²] 532,36 max",'Ic_construction 801,88','Composant-Ic_composant [kgeq.CO2/m²] 530,52','Chantier-Ic_chantier [kgeq.CO2/m²] 1,85']))]));
eq(rsenv.buildings.names,['Bâtiment 1','Bâtiment 2']);
const ro=parseDocument(rsenv);
eq(val(ro,'ic_construction','Bâtiment 1'),532.362); eq(val(ro,'ic_construction_max','Bâtiment 1'),801.88); eq(val(ro,'ic_construction_max_2028','Bâtiment 1'),646.608,'colonne _2028, pas _2031');
eq(val(ro,'ic_energy_max_2028','Bâtiment 1'),273.407); eq(val(ro,'ic_construction_max_2028','Bâtiment 2'),690.52,'seuils du bon bâtiment'); eq(val(ro,'ic_energy','Bâtiment 2'),79.687);
eq(val(ro,'shab','Bâtiment 1'),2144.21); eq(val(ro,'housing_count','Bâtiment 2'),29,'logements = Σ zones');
eq(val(ro,'ic_components','Bâtiment 1'),530.52); eq(ro.filter(o=>o.field==='ic_construction'&&o.building==='Bâtiment 1').length,1,'pas de doublon Ic construction');

// --- 2. Rapport ACV Pléiades : lignes « libellé kg eq CO2/m² valeur », blocs zone ignorés ---------------------------------
const ind=(c)=>['Indicateurs de performance',`Ic construction kg eq CO2/m² ${c}`,'Ic construction max kg eq CO2/m² 791.88','Ic construction max 2025 kg eq CO2/m² 698.28','Ic construction max 2028 kg eq CO2/m² 624.37','Ic construction max 2031 kg eq CO2/m² 535.79','Ic energie kg eq CO2/m² 78.39','Ic energie max kg eq CO2/m² 587.25','Ic energie max 2028 kg eq CO2/m² 272.65','Ic composant kg eq CO2/m² 524.37','Ic chantier kg eq CO2/m² 1.73','Stock c batiment kg eq CO2/m² 69.21'];
const acv=prep(mkDoc('acv','Rapport ACV fictif.pdf',[mkPage(1,rows(['Recapitulatif du calcul reglementaire / Partie Environnement'])),mkPage(2,rows(['Donnees generales Batiment 2',...ind('526.10')])),mkPage(3,rows(['Zone Zone 2','Donnees generales',...ind('999.99')]))]));
eq(acv.buildings.names,['Bâtiment 2']); const ao=parseDocument(acv);
eq(val(ao,'ic_construction'),526.1,'valeur bâtiment, pas zone'); eq(val(ao,'ic_construction_max'),791.88); eq(val(ao,'ic_construction_max_2028'),624.37); eq(val(ao,'ic_energy_max_2028'),272.65);
eq(val(ao,'ic_components'),524.37); eq(val(ao,'stock_c_per_m2'),69.21); eq(ao.filter(o=>o.field==='ic_construction').length,1);

// --- 3. Synthèse des prestations : tableau Résultats + systèmes -------------------------------------------------------------
const pr=prep(mkDoc('pr','Synthese prestations fictive.pdf',[mkPage(1,rows(['Tableau de synthese des prestations thermiques','Pleiades, version 6.24.4.2','Systemes','Production de Chauffage et ECS','Chaudiere biomasse Chauffage et ECS Puissance = 2x 200 kW',
  'Resultats','Nom Bbio / Bbio max Cep / Cep max Cep nr / Cep nr max Ic energie / Ic energie max','62,2 / 71,5 points 83,9 / 89,4 kWh EP/m² 16,1 / 73,6 kWh EP/m² 82.75 / 588.8 kg eq. CO2','Batiment 1 Conforme Conforme Conforme Conforme',
  '58 / 71,5 points 76,6 / 89,2 kWh EP/m² 16,4 / 73,5 kWh EP/m² 75.83 / 587.77 kg eq. CO2','Batiment 3 Conforme Conforme Conforme Conforme']))]));
eq(pr.type,DOC_TYPES.THERMAL,'synthèse ≠ RSET'); eq(pr.buildings.names,['Bâtiment 1','Bâtiment 3']); const po=parseDocument(pr);
eq(val(po,'bbio','Bâtiment 1'),62.2); eq(val(po,'cepnr_max','Bâtiment 3'),73.5); eq(val(po,'ic_energy_max','Bâtiment 1'),588.8); eq(val(po,'heating_mode_after'),'Chaudière biomasse');
ok(!po.some(o=>o.field==='window_glazing'),'« version 6.24.4 » n’est pas un vitrage');

// --- 4. Synthèse des déperditions : aucune valeur parasite -------------------------------------------------------------------
const dp=prep(mkDoc('dp','Deperditions fictives.pdf',[mkPage(1,rows(['Deperditions suivant la norme 12831','Pleiades, version 6.24.4.2','Bureau d\'etude thermique','Batiment Saint Exupery II','76000 Rouen','Departement : 27 - Eure (H1 a)','Batiment Batiment 1','T4 A001-Sejour-Cuisine 19 °C 35,56 m² 88,9 m3 1.27 kW']))]));
eq(dp.buildings.names,['Bâtiment 1'],'pas de bâtiment « Saint Exupéry » (adresse du BET)'); const dpo=parseDocument(dp); eq(dpo.map(o=>o.field),['department']);

// --- 5. Règles : Ic énergie max — le RSEnv prime sur les sorties thermiques ------------------------------------------------------
const r=DEFAULT_SOURCE_RULES.ic_energy_max.main; ok(r.indexOf('RSENV / RSNV')<r.indexOf('RSET RE2020'),'RSEnv avant RSET');

// --- 6. Suppression d'un document : données extraites conservées --------------------------------------------------------------
const app=fs.readFileSync('./js/app.js','utf8');
ok(/function retainRemovedDocument\(project,doc\)/.test(app),'conservation des valeurs du document retiré');
ok(!/remove-file'\)\.forEach\(b=>b\.onclick=async\(\)=>\{ const id=b\.dataset\.id; state\.docs=state\.docs\.filter\(d=>d\.id!==id\); state\.result=null;/.test(app),'plus de remise à zéro du résultat');
ok(/const out=\[\.\.\.retainedOccurrences\(project\)\]/.test(app),'valeurs conservées réinjectées dans chaque consolidation');
ok(/retainedOccurrences:safeJsonClone\(project\.retainedOccurrences,\[\]\)/.test(fs.readFileSync('./js/persistence.js','utf8')),'conservées dans la sauvegarde locale');
console.log(`v2.3.7 — ${n} vérifications OK (documents fictifs)`);
