// ExtracTerre v2.3.20 — lecture des nombres et rapport U48Win (Perrenoud, RT existant globale, moteur Th-C-E ex).
// Documents FICTIFS reproduisant la mise en page d'un rapport réel de 148 pages (4 bâtiments) : saisies de l'état
// initial (« BATIMENT : A/B »), bilans par usage, résumé de l'étude (« Batiment n° 01 : A/B ») et état projet.
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {normalizeText,parseFrNumber} from './js/utils.js';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION, '2.7.1','version');

// ---------- 1. Nombres : le premier nombre seulement, jamais les chiffres de l'unité ----------
for(const [s,v] of [['57,3 kWh/m2',57.3],['12,5 / 15',12.5],['0,25 W/m².K',0.25],['1 663,5',1663.5],['1 663,5',1663.5],['−4,6',-4.6],
  ['-4,6',-4.6],['130,00',130],['R=3,5',3.5],['Bâtiment - 12',12],['1.250.000',null],['1.234,5',null],['abc',null]]) eq(parseFrNumber(s),v,`parseFrNumber(${JSON.stringify(s)})`);

// ---------- 2. Rapport U48Win ----------
const P=ls=>ls.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12}));
const remplissage=Array.from({length:2600},(_,i)=>`Detail du calcul du U : U calcule : ${(1+i%9/10).toFixed(3).replace('.',',')} W/m².°C paroi ${i}`);
const pages=[
  ['28/09/2020','ETUDE FICTIVE U48','Maitre d\'ouvrage :','Bailleur fictif'],
  remplissage, // le résumé arrive au-delà des 120 000 premiers caractères, comme dans le rapport réel
  ['ETAT INITIAL','BATIMENT : A/B','1] BATIMENT','1-1] Generalites','Surface Shon : 1167,00 m²','Annee de construction : Avant 1948','2] ZONE : Cage A et B',
   'Nombre de logements : 17','Zone traversante : Oui','3-01-b] Emission : Radiateur hydraulique','Surface : 707,00 m²','Type de Chauffage : Gaz',
   'Lie a la generation : Chaufferie collective gaz','3-01-c] Emission : Convecteur electrique','Surface : 213,43 m²','Type de Chauffage : Electrique',
   '3-01-d] Ventilation : Ventilation naturelle','Type de ventilation : Ventil.Ouv.de fenetre','Type d\'ECS : Electrique'],
  ['BATIMENT : C/D','1] BATIMENT','Annee de construction : Entre 1948 et 1974','2] ZONE : Cage C et D','Nombre de logements : 22','Zone traversante : Non',
   'Type de Chauffage : Gaz'],
  ['RESULTATS DE L\'ETAT INITIAL','Batiment n° 1 : A/B','Details Initial','Ubat du batiment 1,938','Coefficient Cep (kWh energie primaire / m²) 264,69',
   'CHAUFFAGE','Gaz 179172,9','Total Energie primaire (kwh EP /m²) 153,53','ECS','Electrique 45801,97','Total Energie primaire (kwh EP /m²) 101,26',
   'RESULTATS DE L\'ETAT INITIAL','Batiment n° 2 : C/D','Details Initial','Ubat du batiment 2,227','Coefficient Cep (kWh energie primaire / m²) 287,45',
   'CHAUFFAGE','Gaz 195383,67','Total Energie primaire (kwh EP /m²) 147,68','ECS','Electrique 52518,0','Gaz 37101,23','Total Energie primaire (kwh EP /m²) 130,46'],
  ['RESUME de L\'ETUDE','Calculs realises avec le logiciel U48Win, Moteur ThCEx V.1.0.3 concu par le CSTB le 05-02-2009','Batiment n° 01 : A/B',
   'CAGE A ET B Logement collectif 972,00','Groupe Refroidissement Categorie Tic Tic Ref.','Cage A et B Groupe non refroidi CE1 25,01 29,80',
   'Ubat Base Ubat Max Gain en %','Respect Ubat Max 0,723 0,904 28,25','C\'ep CepMax Gain en %','Respect Cep Max 122,17 130,00 6,03',
   'Resultat Projet Reference Gain en % Initial Gain en %','Ubat 0,649 0,723 10,31 1,938 66,53','C 134,59 165,02 18,44 264,69 49,15',
   'Batiment n° 02 : C/D','CAGE C ET D Logement collectif 1103,00','Groupe Refroidissement Categorie Tic Tic Ref.','Cage C et D Groupe non refroidi CE1 24,98 31,58',
   'Respect Cep Max 143,17 130,00 -10,13','Resultat Projet Reference Gain en % Initial Gain en %','Ubat 0,754 0,820 7,96 2,227 66,12','C 154,77 175,35 11,74 287,45 46,16'],
  ['ETAT PROJET','BATIMENT : A/B','Etat de l\'emission Emission inchangee'],
  ['3-01-d] Ventilation : VMC hygroreglable A','Etat de la ventilation Ventilation renovee ou remplacee','Type de ventilation Ventil.mecanique Simple Flux'],
  ['RESULTATS DE L\'ETAT PROJET','Batiment n° 1 : A/B','Details Projet Reference Ecart % Etat initial Ecart %','Ubat du batiment 0,649 0,723 10,31 1,938 66,53',
   'Coefficient Cep (kWh energie primaire / m²) 134,59 165,02 18,44 264,695 49,15','CHAUFFAGE','Gaz 39441,97 68043,83 42,03 179172,9 77,99',
   'Total Energie primaire (kwh EP /m²) 33,8 58,31 42,03 153,53 77,99','REFROIDISSEMENT','ECS','Electrique 39971,09 41022,86 2,56 45801,97 12,73',
   'Total Energie primaire (kwh EP /m²) 88,37 90,69 2,56 101,26 12,73','ECLAIRAGE','Electrique 3024,34 3280,01 7,79 3028,88 0,15',
   'Total Energie primaire (kwh EP /m²) 6,69 7,25 7,79 6,7 0,15','AUXILIAIRES','Electrique 318,13 752,11 57,70 1450,56 78,07',
   'Ventilateurs (Electrique) 2277,6 3213,0 29,11 0,0 0,00','Total Energie primaire (kwh EP /m²) ,7 1,66 57,70 3,21 78,07',
   'Vent - Total Energie primaire (kwh EP /m²) 5,04 7,1 29,11 0,0 0,00'],
];
const name='I3F_FICTIF_DCE_ETUDE THERMIQUE_Rapport final.pdf';
const ps=pages.map((ls,k)=>{ const lines=P(ls); return {page:k+1,text:lines.map(l=>l.text).join('\n'),lines}; });
const read={kind:'pdf',pages:ps,text:ps.map(p=>p.text).join('\n\f\n'),pageCount:ps.length};
ok(read.text.indexOf('U48Win')>120000,'signature au-delà de la fenêtre de classement');
const c=classifyDocument(name,read.text,{kind:'pdf'});
eq(c.type,'RT Existant','signature U48Win / Th-C-E ex cherchée dans tout le texte');
const d={id:'u48',name,read,familyMode:'auto',status:'ready',classification:{...c,automaticType:c.type},type:c.type}; d.buildings=detectBuildings(d);
const occ=parseDocument(d); d.cachedOccurrences=occ;
ok(!occ.some(o=>/^renovation:|^generic:/.test(o.method||'')),'heuristiques à fenêtre glissante écartées pour U48Win');
const res=analyzeDocuments([d],structuredClone(DEFAULT_SOURCE_RULES));
const fin=(f,b)=>res.finals.filter(o=>o.field===f&&o.building===b).map(o=>o.value);
const AB='Bâtiment A/B', CD='Bâtiment C/D';
// Résumé : Projet / Référence / Gain / Initial.
eq(fin('cep',AB),[134.59],'Cep = C projet'); eq(fin('cep_max',AB),[264.69],'Cep Ref = C initial (rénovation, état initial calculé)');
eq(fin('cep_gain',AB),[49.2],'gain sur l’état initial = (264,69 − 134,59) / 264,69 (le gain imprimé 18,44 % est relatif à la référence)'); eq(fin('cep_before',AB),[264.69],'Cep initial');
eq(fin('ubat_after',AB),[0.649],'Ubat projet'); eq(fin('ubat_before',AB),[1.938],'Ubat initial, jamais l\'Ubat de base 0,723');
eq(fin('cep',CD),[154.77],'deuxième bâtiment'); eq(fin('ubat_before',CD),[2.227],'Ubat initial du deuxième bâtiment');
eq(fin('tic',AB),[25.01],'Tic'); eq(fin('tic_ref',AB),[29.8],'Tic réf');
// Saisies : « BATIMENT : A/B » rattache au même bâtiment que « Batiment n° 01 : A/B ».
eq(fin('built_before_1948',AB),['Oui'],'construit avant 1948'); eq(fin('built_after_1948',CD),['Oui'],'construit après 1948');
eq(fin('cross_ventilated',AB),['Oui'],'zone traversante'); eq(fin('non_cross_ventilated',CD),['Oui'],'zone non traversante');
eq(fin('housing_count',AB),[17],'logements'); eq(fin('housing_count',CD),[22],'logements du deuxième bâtiment');
// Bilans : vecteurs par énergie majoritaire (le convecteur électrique saisi ne compte pas : seul le gaz est consommé).
eq(fin('heating_vector_before',AB),['Gaz'],'chauffage initial = énergie consommée, pas l\'émetteur'); eq(fin('ecs_vector_before',AB),['Électricité'],'ECS initiale');
eq(fin('ecs_vector_before',CD),['Électricité'],'ECS mixte : énergie majoritaire (59 %)'); eq(fin('heating_vector_after',AB),['Gaz'],'chauffage projet');
eq(fin('cep_lighting',AB),[6.69],'Cep éclairage'); eq(fin('cep_aux_dist',AB),[0.7],'« ,7 » = 0,7'); eq(fin('cep_aux_vent',AB),[5.04],'Cep ventilateurs');
eq(fin('cep_gas',AB),[33.8],'Cep gaz'); eq(fin('cep_electricity',AB),[100.8],'Cep électricité = ECS + éclairage + auxiliaires + ventilateurs');
// Ventilation : le champ décrit l'état après travaux ; la phase « ETAT PROJET » vaut pour les pages suivantes.
eq(fin('ventilation',AB),['VMC Hygro A'],'ventilation de l\'état projet');

// ---------- 3. Rapport de bureau d'études Th-C-E ex (CYPE « moteur THCEX ») : bilans en kWh EF, Cep Existant / Projet / Réf. ----------
const be=[
  ['ETUDE ENERGETIQUE FICTIVE','Ce rapport est une etude thermique ThCex de l\'operation.','Arrete du 8 aout 2008 : publication de la methode TH-CE ex'],
  ['6. RESULTATS DU BATIMENT','Les calculs ont ete effectues a l\'aide du logiciel CYPE :','CYPECAD MEP v2019.f avec le moteur THCEX v 1.0.3 du CSTB'],
  ['6.1. ETAT EXISTANT','6.1.1. Resultats de l\'Etat existant','Etat Existant Batiment','Ubat du batiment 1,580','Coefficient Cep Existant (kWh energie primaire / m² Shon) 198,0',
   'CHAUFFAGE','Gaz (kWh EF) 657 739,6','Total Energie primaire (kWh EP /m²Shon) 110,9','REFROIDISSEMENT','Sans objet','ECS','Gaz (kWh EF) 241 485,5',
   'Total Energie primaire (kWh EP /m²Shon) 40,7','ECLAIRAGE','Electricite (kWh EF) 56 516,6','Total Energie primaire (kWh EP /m²Shon) 24,6',
   'Consommation energetique','Valeur en kWhEP/m² de Shon','≤50 A','151 a 230 D 198','231 a330 E','Emission de gaz a effet de serre','≤5 A','36 a55 E 43','56 a80 F'],
  ['6.2. ETAT PROJETE','6.2.1. Resultats de l\'Etat Projete : Scenario 2','Etat Scenario 2 Batiment','Ubat du batiment 0,660','Ubat max du batiment 1,060',
   'Coefficient Cep Projet (kWh energie primaire / m² Shon) 97,7','Coefficient Cep Ref. (kWh energie primaire / m² Shon) 157,7','Coefficient Cep Gain(%) 38,0',
   'CHAUFFAGE','Gaz (kWh EF) 175 124,4','Total Energie primaire (kwh EP /m²Shon) 29,5','ECS','Gaz (kWh EF) 195 702,9','Total Energie primaire (kwh EP /m²Shon) 33,0',
   'ECLAIRAGE','Electricite (kWh EF) 63 929,6','Total Energie primaire (kwh EP /m²Shon) 27,8','AUXILIAIRES','Electricite (kWh EF) 5 218,7',
   'Ventilateurs (Electrique) (kWh EF) 11 682,9','Total Energie primaire (kwh EP /m²Shon) 2,3','Vent - Total Energie primaire (kwh EP /m²Shon) 5,1',
   'Consommation energetique Emission de gaz a effet de','Valeur en kWhEP/m² de Shon serre Valeur en kgeqCO2/m².an','91 a 150 C 98 11 a20 C 18','151 a 230 D 198 21 a 35 D','36 a55 E 43'],
];
const bps=be.map((ls,k)=>{ const lines=P(ls); return {page:k+1,text:lines.map(l=>l.text).join('\n'),lines}; });
const bread={kind:'pdf',pages:bps,text:bps.map(p=>p.text).join('\n\f\n'),pageCount:bps.length}; const bname='Rapport Etude thermique BE fictif.pdf';
const bc=classifyDocument(bname,bread.text,{kind:'pdf'}); eq(bc.type,'RT Existant','« moteur THCEX » : étude RT existant globale');
const bd={id:'be',name:bname,read:bread,familyMode:'auto',status:'ready',classification:{...bc,automaticType:bc.type},type:bc.type}; bd.buildings=detectBuildings(bd);
const bocc=parseDocument(bd); const bres=analyzeDocuments([{...bd,cachedOccurrences:bocc}],structuredClone(DEFAULT_SOURCE_RULES));
const bf=f=>bres.finals.filter(o=>o.field===f).map(o=>o.value); const bo=f=>bocc.filter(o=>o.field===f).map(o=>o.value);
eq(bf('cep_before'),[198],'Cep existant'); eq(bf('cep'),[97.7],'Cep projet'); eq(bf('cep_max'),[198],'Cep Ref = Cep existant (rénovation)'); eq(bf('cep_gain'),[50.7],'gain sur l’état initial'); eq(bo('cep_max'),[157.7],'Cep réf. du document lu (reste proposé)');
eq(bf('ubat_before'),[1.58],'Ubat existant'); eq(bf('ubat_after'),[0.66],'Ubat seul d\'une page « Etat projeté » = après travaux');
eq(bf('heating_vector_before'),['Gaz'],'« Gaz (kWh EF) 657 739,6 » : un seul nombre'); eq(bf('ecs_vector_after'),['Gaz'],'ECS projet');
eq(bf('cep_gas'),[62.5],'Cep gaz = 29,5 + 33,0'); eq(bf('cep_electricity'),[35.2],'Cep électricité = 27,8 + 2,3 + 5,1'); eq(bf('cep_aux_vent'),[5.1],'ventilateurs');
eq(bo('dpe_energy_before'),['D'],'étiquette énergie initiale'); eq(bo('dpe_ges_before'),['E'],'étiquette GES initiale');
eq(bo('dpe_energy_after'),['C'],'étiquette projet = valeur égale au Cep projet, pas le rappel 198'); eq(bo('dpe_ges_after'),['C'],'GES projet, pas le rappel 43');

// ---------- 4. Une période n'est pas une année ----------
import {sanitizeOccurrence} from './js/sanity.js';
for(const [ex,keep] of [['Annee de construction : Avant 1948',false],['Année de construction : entre 1948 et 1974',false],['Année de construction : 1965',true]])
  eq(!!sanitizeOccurrence({field:'construction_year',value:Number(ex.match(/\d{4}(?!.*\d{4})/)[0]),excerpt:ex,method:'tags:label-value'}),keep,`construction_year « ${ex} »`);
// ---------- 5. Ligne de tableau : les colonnes chiffrées ne font pas partie du nom du bâtiment ----------
import {canonicalBuilding} from './js/buildings.js';
eq(canonicalBuilding('Batiment R1 - R2 0 0 7 14 7 28 2184'),'Bâtiment R1 - R2','typologies + SHAB retirées'); eq(canonicalBuilding('Bâtiment A 12'),'Bâtiment A 12','un seul nombre : partie du nom');
console.log(`v2.3.20 — ${n} vérifications OK (documents fictifs)`);
