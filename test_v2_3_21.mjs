// ExtracTerre v2.3.21 — rapport Pléiades « Résultats RT Existant suivant la méthode THCE - Ex » (en-tête « Simulation
// thermique dynamique »). Document FICTIF reproduisant la mise en page de 6 rapports réels (bâtiments d'une résidence).
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {normalizeText} from './js/utils.js';
import {insulationName} from './js/donnees-techniques.js';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION, '2.7.4','version');
eq(insulationName('ECOROCK MONO 134mm pour'),'Laine de roche','marque Rockwool'); eq(insulationName('EFIGREEN DUO+ 100 mm 600x600'),'PUR','marque PIR');

const H='Simulation thermique dynamique -REHABILITATION FICTIVE', V='Pleiades, version 5.23.6.2';
const baie=(type,cadre,code,prot)=>[`${type} (Baie)`,`Type de baie ${type==='Porte placard'?'':type}`.trim(),`Type de cadre ${cadre}`,'Source Uw Calcul Th-Bat',`Nom codifie ${code}`,
  'Ouverture Ouverture coulissante manuelle',`Protection ${prot}`,'Hauteur (m) Largeur (m) Nombre de Deja integre','Baie 1.25 1.65 2 Non'];
const pages=[
  [H,V],
  ['Donnees administratives','Departement : 95 - Val-d\'Oise (H1 a)','Version du moteur RTex : 1.0.3','1 Resultats RT Existant suivant la methode','THCE - Ex','1.1 Batiment ZA',
   'Exigence de resultat : Cep','Cep Initial Projet Reference Max(CH,ECS,FR)','kWh ep/m² 195.307 72.768 111.165 130.00',H,V],
  ['Decomposition du Cep (hors prod. ENR) Projet: 72.77 kWhEP/m².an','Chauffage (32.5kWh/m², 45%)','Aux. generation (2.1kWh/m², 3%)','Aux. ventilation (3.9kWh/m², 5%)',
   'Eclairage (5.8kWh/m², 8%)','ECS (28.5kWh/m², 39%)','Decomposition du Cep (hors prod. ENR) Reference: 111.17 kWhEP/m².an','Chauffage (69.4kWh/m², 62%)',
   'Conformite au label BBC reno 2009 habitat','Coefficient Cep 72.768 kWh ep/m²','Cep max 104 kWh ep/m²',H,V],
  ['Etiquettes Equivalentes','Energie : Classe equivalente C : 85kWhEP/m²SHAB.an','CO2 : Classe equivalente C : 16kgCO2/m²SHAB.an','Exigence de resultat : Tic','Projet Reference',
   '<<iif (groupe.nonexclu)>>','Groupe 1 22.93 °C 33.69 °C','<<endiif>>','Detail des consommations (energie finale)','Consommations unite initial projet reference',
   'dont chauffage electrique kWh 0 0 0','dont chauffage bois kWh 0 0 0','dont chauffage autres sources kWh 267467.198 56359.296 120445.438',
   'dont ECS electrique kWh 0 0 0','dont ECS bois kWh 0 0 0','dont ECS autres sources kWh 49373.381 49373.381 46647.382',H,V],
  ['2.1 Batiment ZA','unite initial Projet Reference','Ubat (hiver) W/m2.K 1.96 0.68 0.939','Ubat-max W/m2.K 1.174',H,V],
  ['Toiture Terrasse -Renovee','Type de paroi Plancher haut','Nature de paroi Terrasse','EFIGREEN DUO+ 100 mm 600x600 10.0 0.022 38 0.333 0.22 4.50','Beton plein (lourd) 20.0 2.000 2450 0.278 10.00 0.10',
   'Plancher bas sur sous sol','Type de paroi Paroi sur locaux non chauffes','Nature de paroi Plancher sur local NC','Laine de roche 10.0 0.041 25 0.256 0.41 2.44',
   'Mur exterieur ITE','Type de paroi Paroi verticale','Nature de paroi Mur exterieur','Ecorock Mono L 1200 x l 600 x ep','13.4 0.036 120 0.286 0.27 3.70','134 (mm) R=3.70',H,V],
  [...baie('Porte placard','Bois','sans objet','Pas de protection mobile'),...baie('Fenetre','PVC','DV 4/16/4 GC Air','Volet roulant PVC (ep < 12mm)- teinte pastel'),
   ...baie('Fenetre','PVC','DV 4/16/4 GC Air','Volet roulant PVC (ep < 12mm)- teinte pastel'),...baie('Porte fenetre','PVC','DV 4/14/4 GC Argon','Volet battant PVC - teinte pastel'),H,V],
  ['4 Bibliotheque d\'equipements','Chaudiere gaz a condensation:UltraGas2 D (2000D)','Fonction Chauffage et ECS','Gaz Gaz naturel','5.2 Batiment ZA','Annee deconstruction 1973',
   'Nombre de logements 20','Surface habitable en residentiel ou SHON pour autre usage 1446.00 m²','Generation 1 (Volume chauffe Batiment ZA)','UltraGas2 D(2000D)',
   'Systeme de ventilation initiale Ventilation par ouverture de fenetres','Nouveau systeme de ventilation Residentiel: Ventilation mecanique simple flux',H,V],
];
const P=ls=>ls.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12}));
const ps=pages.map((ls,k)=>{ const lines=P(ls); return {page:k+1,text:lines.map(l=>l.text).join('\n'),lines}; });
const read={kind:'pdf',pages:ps,text:ps.map(p=>p.text).join('\n\f\n'),pageCount:ps.length}; const name='Etude Thermique -Batiment ZA.pdf';
const c=classifyDocument(name,read.text,{kind:'pdf'}); eq(c.type,'RT Existant','rapport Pléiades Th-C-E ex');
const d={id:'za',name,read,familyMode:'auto',status:'ready',classification:{...c,automaticType:c.type},type:c.type}; d.buildings=detectBuildings(d);
const occ=parseDocument(d); const res=analyzeDocuments([{...d,cachedOccurrences:occ}],structuredClone(DEFAULT_SOURCE_RULES));
const f=k=>res.finals.filter(o=>o.field===k).map(o=>o.value); const o=k=>occ.filter(x=>x.field===k).map(x=>x.value);
// Déjà lus avant la v2.3.21 : ne bougent pas.
eq(f('cep_before'),[195.307],'Cep initial'); eq(f('cep'),[72.768],'Cep projet'); eq(f('cep_max'),[195.307],'Cep Ref = Cep initial (rénovation, état initial calculé)'); eq(f('ubat_before'),[1.96],'Ubat initial'); eq(f('ubat_after'),[0.68],'Ubat projet');
eq(f('housing_count'),[20],'logements'); eq(f('shab'),[1446],'SHAB'); eq(f('ventilation'),['VMC simple flux'],'ventilation projet');
// Nouveaux.
eq(f('tic'),[22.93],'Tic projet'); eq(f('tic_ref'),[33.69],'Tic référence'); eq(f('construction_year'),[1973],'« Annee deconstruction 1973 »');
eq(f('cep_lighting'),[5.8],'Cep éclairage'); eq(f('cep_aux_vent'),[3.9],'Cep auxiliaires ventilation'); eq(f('cep_aux_dist'),[2.1],'Cep auxiliaires de génération');
eq(f('cep_gas'),[61],'Cep gaz = chauffage 32,5 + ECS 28,5'); eq(f('cep_electricity'),[11.8],'Cep électricité = 5,8 + 3,9 + 2,1');
eq(f('heating_vector_after'),['Gaz'],'« autres sources » = gaz du générateur'); eq(f('ecs_vector_after'),['Gaz'],'ECS projet');
eq(o('heating_vector_before'),['Gaz'],'vecteur initial proposé…'); eq(f('heating_vector_before'),[],'…mais à vérifier (générateur initial non décrit)');
eq(f('heating_mode_after'),['Chaudière condensation'],'bibliothèque : chaudière gaz à condensation');
eq(f('window_material'),['PVC'],'fenêtres PVC, pas la porte de placard en bois'); eq(f('window_glazing'),['4.16.4 Air'],'vitrage le plus fréquent'); eq(f('window_shading'),['Volet roulant'],'occultation la plus fréquente');
eq(f('roof_insulation'),['PUR'],'toiture EFIGREEN'); eq(f('roof_insulation_thickness'),[100],'10 cm'); eq(f('floor_insulation'),['Laine de roche'],'plancher sur local non chauffé');
eq(f('floor_insulation_r'),[2.44],'R plancher'); eq(f('wall_insulation'),['Laine de roche'],'mur : nom sur une ligne, valeurs sur la suivante'); eq(f('wall_insulation_thickness'),[134],'13,4 cm'); eq(f('wall_insulation_r'),[3.7],'R mur');
console.log(`v2.3.21 — ${n} vérifications OK (documents fictifs)`);
