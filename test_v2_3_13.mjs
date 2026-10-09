// ExtracTerre v2.3.13 — document FICTIF reproduisant le « Fichier standardisé des caractéristiques thermiques d'une
// construction Existante » (RSET RT existant, feuille XSL commune aux logiciels) : deux feuillets bâtiment, feuillets
// équipement rattachés par la surface, feuillet génération.
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {normalizeText} from './js/utils.js';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.17','version');
const P=ls=>ls.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12}));
const pages=[
 ['Reglementation Thermique Existante',"Fichier standardise des caracteristiques thermiques d'une construction Existante (en vue",'FEUILLET(S) BATIMENT(S) :',"Batiment : '1'","Batiment ou zones du batiment desservies -",'Correspond a des donnees obligatoires 95'],
 ["MAITRE D'OUVRAGE",'Nom ou raison sociale : BAILLEUR FICTIF (75000) - 12','FEUILLET BATIMENT (1)','Identifiant Batiment - (1)','Surface utile ou habitable (m2) 800','Annee de la construction 1955','Nombre de logements 10',
  'Coefficient Cep 170.50 90.10 -80.4 -47.16% 82.00 8.10 9.88%',"Ubat(hiver) 1.30 0.52 -0.78 0.75 -0.23 0",'Partie de batiment de type CE1 Unite Tic (a) Tic Ref (b) (a-b)','Nouveau 001 °C 24.50 28.90 -4.40',
  'Coefficient Cep kWh-ep/m2SHON 90.0 80.0 10.0','art 43 Isolation minimale des coffres de volets roulants Verifie','Parois opaques :','Mur en beton banche','mur exterieur Ep 20cm non isole + 0 5 290.84 1.43','Fenetre sans 0.00 Th-U 33.28 - 1.4 0 - -'],
 ['FEUILLET BATIMENT (2)','Identifiant Batiment TOUR - (2)','Surface utile ou habitable (m2) 1200.5','Annee de la construction 1948','Nombre de logements 18','Coefficient Cep 195.20 - -','Ubat(hiver) 1.45 - - - - 0','Parois opaques :','Mur en pierre dure','Fenetre 0.00 PVC Th-U 42.08 3 - 0 - -','Fenetre 0.00 PVC Th-U 32.66 3 - 0 - -'],
 ['FEUILLET EQUIPEMENT ( -ID : 1)','Surface totale utile de la zone (m2) 800','Naturelle par conduit m2 2000','Les travaux de renovation thermique ont-ils porte sur la ventilation ? oui',"Type de centrale de traitement d'air - Centrale simpleflux ou extracteur (SF)",
  '2 - DONNEESSURLESEQUIPEMENTSDECHAUFFAGE()',"Type d'energie :",'Initial Projet','electrique a effet joule non non','electrique thermodynamique non non','gaz oui non','fioul non non','solaire non non','Reseaux chaleur non oui','bois non non',
  "4 - DONNEESSURL'EAUCHAUDESANITAIRE()","Type d'energie :",'Initial Projet','electrique a effet joule non non','gaz oui oui','solaire non non'],
 ['FEUILLET EQUIPEMENT ( -ID : 2)','Surface totale utile de la zone (m2) 1200.5','Naturelle par conduit m2 1400','Les travaux de renovation thermique ont-ils porte sur la ventilation ? non',
  'FEUILLET GENERATION (2)','1 - ETATINITIAL: GENERATEURSAFFECTESAUCHAUFFAGEETALAPRODUCTIONSANITAIRE','Type d\'energie - Gaz','Mode de production (chauf/ECS/mixte) - Chauffage seul',
  '3 - PROJET: NOUVEAUXGENERATEURSMISENPLACEAFFECTESAUCHAUFFAGEETALAPRODUCTIONSANITAIRE','Type d\'energie - Gaz','Mode de production (chauf/ECS/mixte) - Chauffage seul','Type de generateur - reseau de chaleur']
].map((ls,k)=>{ const lines=P(ls); return {page:k+1,text:lines.map(l=>l.text).join('\n'),lines}; });
const d={id:'r',name:'RTRENO fictif.pdf',familyMode:'auto',read:{kind:'pdf',pages,pageCount:pages.length,text:pages.map(p=>p.text).join('\n\f\n')}};
const c=classifyDocument(d.name,d.read.text,{kind:'pdf'}); d.type=c.type; d.classification={...c,automaticType:c.type}; d.buildings=detectBuildings(d);
eq(d.type,DOC_TYPES.RT_EXISTING); eq(d.buildings.names,['Bâtiment 1','Bâtiment TOUR'],'pas de faux bâtiment « ou zones du bâtiment desservies »');
const o=parseDocument(d); const v=(f,b)=>o.find(x=>x.field===f&&x.building===b)?.value; const B1='Bâtiment 1', B2='Bâtiment TOUR';
eq(v('shab',B1),800); eq(v('construction_year',B1),1955); eq(v('housing_count',B2),18);
eq(v('cep_before',B1),170.5); eq(v('cep_after_final',B1),90.1,'colonne Projet (b)'); eq(v('ubat_before',B1),1.3); eq(v('ubat_after',B1),0.52); eq(v('tic',B1),24.5); eq(v('tic_ref',B1),28.9);
eq(v('cep_before',B2),195.2); eq(v('cep_after_final',B2),undefined,'« - » = non renseigné'); eq(v('ubat_after',B2),undefined);
eq(v('wall_structure',B1),'Béton banché'); eq(v('wall_structure',B2),'Pierre'); eq(v('window_material',B2),'PVC');
eq(v('ventilation',B1),'VMC simple flux'); eq(v('ventilation',B2),'Ventilation naturelle','travaux sans ventilation : naturelle par conduit');
eq(v('heating_vector_before',B1),'Gaz'); eq(v('heating_vector_after',B1),'Réseau de chaleur urbain','colonne Projet du tableau oui/non'); eq(v('ecs_vector_after',B1),'Gaz');
eq(v('heating_vector_before',B2),'Gaz'); eq(v('heating_vector_after',B2),'Réseau de chaleur urbain','générateur du projet'); eq(v('ecs_vector_after',B2),undefined,'« Chauffage seul » : pas d’ECS déduite');
ok(!o.some(x=>x.field==='window_shading'),'« coffres de volets roulants » (article) ≠ occultation'); ok(!o.some(x=>/vector/.test(x.field)&&x.value==='Solaire'),'« solaire non » ≠ vecteur solaire');
console.log(`v2.3.13 — ${n} vérifications OK (document fictif)`);
