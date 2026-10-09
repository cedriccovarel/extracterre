// ExtracTerre v2.3.16 — documents FICTIFS : notice thermique RT existant en chapitres « État existant / État projeté »,
// fiche standardisée RT existant lue par OCR (variante Pléiades), suppression de projet et bandeau compact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {normalizeText} from './js/utils.js';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.16','version');
const P=ls=>ls.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12}));
const mk=(name,pages)=>{ const ps=pages.map((ls,k)=>{ const lines=P(ls); return {page:k+1,text:lines.map(l=>l.text).join('\n'),lines}; });
  const read={kind:'pdf',pages:ps,text:ps.map(p=>p.text).join('\n\f\n'),pageCount:ps.length};
  const d={id:name,name,read,familyMode:'auto',status:'ready'}; const c=classifyDocument(name,read.text,{kind:'pdf'}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.buildings=detectBuildings(d); return d; };

// ---------- 1. Notice thermique RT existant en chapitres (fictive) ----------
const notice=mk('Les_Acacias_Notice_thermique.pdf',[
  ['NOTICE THERMIQUE / RT EXISTANT','Rehabilitation d\'un immeuble de 9 logements','SOMMAIRE','3. Etat existant – Recapitulatif de la saisie.............................6','5. Etat projete – Recapitulatif de la saisie..............................12',
   'L\'etude thermique a ete realisee via le moteur de calculs Th C Ex.','L\'immeuble compte 9 logements du T2 au T4.'],
  ['3. Etat existant – Recapitulatif de la saisie','3.2.1 Descriptif des parois','DESIGNATION COMPOSITION EPAISSEUR RESISTANCE','Brique pleine 0,9 30','Mur exterieur 0,45','Tableau 3 : parois existantes',
   'Chauffage – Generation','Mode Chauffage','Type Chaudiere collective','Combustible Fioul','Puissance 120 kW','Tableau 7 : production existante',
   'L\'ECS est assuree pour 6 logements par la chaudiere collective et par des ballons electriques pour 3 logements.',
   '4.3 Consommations theoriques CEP','Cep (kWh/(m²SRT.an) 412,50','Chauffage (kWh/(m²SRT.an) 350,10',
   '380 kWhEP/m²SHAB.an et une emission de 95 kgeqCO2/m²SHAB.an, correspondant respectivement a des','etiquettes de niveau F.'],
  ['5. Etat projete – Recapitulatif de la saisie','> Mise en œuvre d\'une ventilation simple flux hygroreglable type B.','5.1.1 Descriptif des parois','DESIGNATION COMPOSITION EPAISSEUR RESISTANCE',
   'Laine de roche 0,035 18','Mur exterieur ITE Brique pleine 0,9 30 5,15','Ouate de cellulose 0,040 32','Combles perdus 8,00','Tableau 11 : parois projetees',
   '5.1.2 Descriptif des menuiseries','Menuiseries double vitrage','Cadre PVC 1,3 0,55 0,5','4/20/4','Tableau 12 : menuiseries',
   '5.1.3 Occultations','> Volets roulants (cote rue) ;','> BSO (cote cour).',
   'Chauffage – Generation','Mode Chauffage + ECS','Type Pompe a chaleur air/eau collective','Combustible Electricite','Tableau 15 : production projetee',
   'Ventilation Simple Flux','Regulation Hygro B'],
  ['6. Etat projete – Resultats de la saisie','6.3 Consommations theoriques CEP','Cep (kWh/(m²SRT.an) 110,20',
   '105 kWhEP/m²SHAB.an et une emission de 4 kgeqCO2/m²SHAB.an, correspondant a une etiquette B :']
]);
eq(notice.buildings.names,['Bâtiment unique'],'notice : bâtiment unique (pas de bâtiment parasite)');
const no=parseDocument(notice); const nv=f=>no.filter(o=>o.field===f).map(o=>o.value);
ok(no.length&&no.filter(o=>!/^(?:operation_name|owner_company|department)$/.test(o.field)).every(o=>/^notice-rtex-phases:/.test(o.method)),'parseur dédié aux notices en chapitres');
eq(nv('cep_before'),[412.5],'Cep état existant');
eq(nv('cep_after_final'),[110.2],'Cep état projeté');
eq(nv('cep_gain'),[73.3],'gain Cep');
eq([nv('dpe_energy_before')[0],nv('dpe_ges_before')[0]],['F','F'],'étiquettes existantes « respectivement »');
eq([nv('dpe_energy_after')[0],nv('dpe_ges_after')[0]],['B','A'],'étiquette projet B, GES déduit de 4 kg (A)');
eq(nv('wall_structure'),['Brique'],'structure des murs');
eq([nv('wall_insulation')[0],nv('wall_insulation_thickness')[0],nv('wall_insulation_r')[0]],['Laine de roche',180,5.15],'ITE : isolant, épaisseur (cm → mm), R');
eq([nv('roof_insulation')[0],nv('roof_insulation_thickness')[0],nv('roof_insulation_r')[0]],['Ouate de cellulose',320,8],'combles : isolant, épaisseur, R');
eq(nv('window_material'),['PVC'],'menuiseries PVC');
eq(nv('window_glazing'),['4.20.4'],'vitrage 4/20/4');
eq(nv('window_shading'),['BSO / Volets roulants'],'occultations');
eq(nv('heating_vector_before'),['Fioul'],'chauffage existant');
eq(nv('heating_vector_after'),['Électricité'],'chauffage projeté');
eq(nv('heating_mode_after'),['PAC'],'générateur projeté');
eq(nv('ecs_vector_after'),['Électricité'],'ECS projetée (générateur mixte)');
eq(nv('ecs_vector_before'),['Fioul'],'ECS existante : vecteur majoritaire (6 logements sur 9)');
ok(no.find(o=>o.field==='ecs_vector_before').confidence<0.9,'ECS existante mixte → à vérifier');
eq(nv('ventilation'),['VMC Hygro B'],'ventilation projetée');
eq(nv('housing_count'),[9],'logements');

// ---------- 2. Fiche standardisée RT existant imprimée en image (OCR, variante Pléiades) ----------
const fiche=mk('Fiche_RTex.pdf',[
  ['Reglementation Thermique Existante','Fichier standardise des caracteristiques thermiques d\'une construction Existante','Pleiades, version 6.25'],
  ['DONNEES ADMINISTRATIVES','MAITRE D\'OUVRAGE','Nom ou raison sociale : Bailleur Fictif','Departement : 69','FEUILLET BATIMENT (Batiment 1)','Identifiant Batiment 1 - (Batiment 1)',
   'Surface utile ou habitable (m?) 640.5','Annee de la construction 1962','Nombre de logements 9',
   'Coefficient Cep 412.50 110.20 -302.30 -73.28% 180.00 -69.80 -38.8%','Partie de batiment de type CE1 Unite Tic (a) Tic Ref (b) (a-b)','Groupe 1 °c 25.10 29.40 -4.30',
   'Ubat (hiver) 1.42 0.48 -0.94 0.75 -0.27','BP Parois opaques :','v Re autre 0_Mur Brique 30 cm + 18 5.15 poste 400.2 1.9 0.18','Fenetre sans 0 PVC technique ou 30.1 - 13'],
  ['FEUILLET EQUIPEMENT (Batiment 1 -ID: 1)','1 - DONNEES SUR LES EQUIPEMENTS DE VENTILATION (BATIMENT 1)','Type de centrale de traitement d\'air - Centrale simple flux ou extracteur (SF)',
   '2 - DONNEES SUR LES EQUIPEMENTS DE CHAUFFAGE (BATIMENT 1)','> Type d\'energie :','Projet','electrique a effet joule non oui','gaz non non'],
  ['FEUILLET GENERATION (Batiment 1)','1 - ETAT INITIAL : GENERATEURS AFFECTES AU CHAUFFAGE ET A LA PRODUCTION SANITAIRE','Type d\'energie - Fioul Electrique','Nombre de generateurs identiques - 1 3','Puissance nominale unitaire KW 120 2',
   '3 - PROJET : NOUVEAUX GENERATEURS MIS EN PLACE AFFECTES AU CHAUFFAGE ET A LA PRODUCTION SANITAIRE','Type d\'energie - Electrique Gaz','Nombre de generateurs identiques - 2 1','Puissance nominale unitaire kW 40 10']
]);
eq(fiche.buildings.names,['Bâtiment 1'],'fiche : feuillet « (Batiment 1) »');
const fo=parseDocument(fiche); const fv=f=>[...new Set(fo.filter(o=>o.field===f).map(o=>o.value))];
eq([fv('shab')[0],fv('construction_year')[0],fv('housing_count')[0]],[640.5,1962,9],'surface « (m?) », année, logements');
eq([fv('cep_before')[0],fv('cep_after_final')[0]],[412.5,110.2],'Cep initial / projet');
eq([fv('ubat_before')[0],fv('ubat_after')[0]],[1.42,0.48],'Ubat initial / projet (puce OCR)');
eq([fv('tic')[0],fv('tic_ref')[0]],[25.1,29.4],'Tic en « °c »');
eq(fv('wall_structure'),['Brique'],'paroi principale « 0_Mur Brique »');
eq(fv('window_material'),['PVC'],'menuiseries');
eq(fv('ventilation'),['VMC simple flux'],'ventilation projet');
eq(fv('heating_vector_before'),['Fioul'],'générateurs initiaux : 120 kW fioul vs 6 kW électriques');
eq(fv('heating_vector_after'),['Électricité'],'générateurs projet : 80 kW électriques vs 10 kW gaz');
ok(!fo.some(o=>o.field==='heating_vector_after'&&o.value==='Gaz'),'pas de vecteur minoritaire');
ok(fo.filter(o=>/chauffage-energie/.test(o.method)).every(o=>o.confidence<0.9),'tableau d\'énergie incomplet (OCR) → à vérifier');
eq(fv('department'),['69'],'département');

// ---------- 3. Fiche + notice : « VMC simple flux » précisée par « VMC Hygro B » ----------
const r=analyzeDocuments([{...notice,cachedOccurrences:no},{...fiche,cachedOccurrences:fo}],structuredClone(DEFAULT_SOURCE_RULES),'T');
const row=r.rows.find(x=>x.ventilation)||{};
eq(row.ventilation,'VMC Hygro B','valeur compatible plus précise retenue');

// ---------- 4. Interface : suppression de projet et bandeau compact ----------
const app=fs.readFileSync('./js/app.js','utf8'), css=fs.readFileSync('./styles.css','utf8');
ok(/async function deleteProject\(id\)/.test(app)&&/deleteDocumentCheckpoint\(d\.id\)/.test(app),'suppression de projet (checkpoints compris)');
ok(/data-result-project-delete/.test(app)&&/data-overview-delete/.test(app)&&/data-project-delete/.test(app),'boutons Supprimer : liste, synthèse, en-tête');
ok(/\.ux-header,\.ux-header-clean\{height:60px/.test(css),'bandeau de 60 px');

console.log(`v2.3.16 — ${n} vérifications OK (documents fictifs)`);
