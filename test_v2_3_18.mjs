// ExtracTerre v2.3.18 — documents FICTIFS reproduisant les sorties ClimaWin RT existant : fiche standardisée imprimée
// depuis le navigateur (« Récapitulatif Standardisé d'Étude », feuillets coupés, état initial non calculé) et note
// « Synthèse d'étude RTEx ».
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {normalizeText} from './js/utils.js';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.19','version');
const P=ls=>ls.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12}));
const mk=(name,pages)=>{ const ps=pages.map((ls,k)=>{ const lines=P(ls); return {page:k+1,text:lines.map(l=>l.text).join('\n'),lines}; });
  const read={kind:'pdf',pages:ps,text:ps.map(p=>p.text).join('\n\f\n'),pageCount:ps.length};
  const d={id:name,name,read,familyMode:'auto',status:'ready'}; const c=classifyDocument(name,read.text,{kind:'pdf'}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.buildings=detectBuildings(d); d.cachedOccurrences=parseDocument(d); return d; };
const vals=(d,f)=>[...new Set(d.cachedOccurrences.filter(o=>o.field===f).map(o=>o.value))];

// ---------- 1. Fiche standardisée ClimaWin, état initial calculé (bâtiment collectif) ----------
const fiche=(bat,{init=true}={})=>mk(`Dossier_de_controle_${bat}.pdf`,[
  ['Dossier de controle - RT Existant 40 lgts Fictifs','Reglementation Thermique Existante','Cadre standard de presentation du « Recapitulatif Standardise d\'Etude','Logo Thermique »','Logiciel et version :BBS SLAMA, ClimaWin 2020'],
  ['Maitre d\'ouvrage','Nom ou raison sociale : BAILLEUR FICTIF','Departement : 76',`FEUILLET BATIMENT (Bat ${bat} apres travaux OPTION BBC`,'2030)','Surface utile ou habitable (m2) 812.5','Annee de la construction 1972','Nombre de logements 12',
   ...(init?['Coefficient Cep 210.4 88.2 -122.2 -58.08% 140.6 -52.4 -37.27%']:['--non calcule-','Coefficient Cep 88.2 -- -- 140.6 -52.4 -37.27%','-']),
   'Partie de batiment de type CE1 Unite Tic (a) Tic Ref (b) (a-b)','Groupe d\'usage °C 25.1 32.4 -7.3',
   init?'Ubat (hiver) 1.25 0.61 -0.64 0.92 -0.31':'Ubat (hiver) NaN 0.61 NaN 0.92 -0.31',
   'Parois opaques','Mur exterieur','Parois mur','aps travaux - 16 5 Th-U 300.5 0 0.19 0 0.36 -0.17','verticales exterieur','NE',
   'Mur exterieur','Parois mur','aps travaux - 16 5 Th-U 120 0 0.19 0 0.36 -0.17','verticales exterieur','SO',
   'Toiture','Planchers','terrasse terrasse aps 20 9 Th-U 260 0 0.11 0 0.27 -0.16','hauts','travaux',
   'Plancher bas','Planchers','sous sol sur caves aps 10 3.1 Th-U 255 0 0.3 1 0.27 0.03','bas','travaux',
   'Fenetre avec Menuiseries PVC PVC Th-U 161.5 0 1.35 18 2.1 -0.75'],
  [`FEUILLET EQUIPEMENT (Bat ${bat} apres travaux OPTION BBC 2030 - ID : 1)`,'Surface totale utile de la zone (m2) 812.5','Mecanique simple flux m2 812.5','dont hygroreglable type B m2 812.5',
   'Type de centrale de traitement d\'air - Centrale simple flux ou extracteur (SF)','Donnees sur les equipements de chauffage (Bat X)','Type d\'energie :','Initial Projet',
   ...(init?['electrique a effet joule non non','electrique thermodynamique non oui','gaz oui non','fioul non non','solaire non non','Reseaux chaleur non non','bois non non']
          :['electrique a effet joule non','electrique thermodynamique oui','gaz non','fioul non','solaire non','Reseaux chaleur non','bois non'])],
  [`FEUILLET GENERATION (Bat ${bat} apres travaux OPTION BBC 2030) retour au sommaire`,'1 - Etat initial : Generateurs affectes au chauffage et a la production sanitaire :',init?'Type d\'energie - Gaz Gaz':'Type d\'energie -',
   '3 - Projet : Nouveaux generateurs mis en place affectes au chauffage et a la production sanitaire','Type d\'energie - Electrique Electrique','Compression Compression','electrique electrique','-- fin de la fiche RT-Existant ()--']
]);
const A=fiche('MONET');
eq(A.buildings.names,['Bâtiment MONET'],'bâtiment « Bat MONET apres travaux OPTION BBC 2030 » → Bâtiment MONET');
eq([vals(A,'cep_before')[0],vals(A,'cep_after_final')[0],vals(A,'ubat_before')[0],vals(A,'ubat_after')[0]],[210.4,88.2,1.25,0.61],'Cep / Ubat initial et projet');
eq([vals(A,'shab')[0],vals(A,'housing_count')[0],vals(A,'construction_year')[0]],[812.5,12,1972],'surface, logements, année');
eq([vals(A,'tic')[0],vals(A,'tic_ref')[0]],[25.1,32.4],'Tic');
eq([vals(A,'wall_insulation_thickness')[0],vals(A,'wall_insulation_r')[0]],[160,5],'murs : 16 cm, R 5');
eq([vals(A,'roof_insulation_thickness')[0],vals(A,'roof_insulation_r')[0]],[200,9],'toiture terrasse : 20 cm, R 9');
eq([vals(A,'floor_insulation_thickness')[0],vals(A,'floor_insulation_r')[0]],[100,3.1],'plancher sur caves : 10 cm, R 3,1');
eq(vals(A,'ventilation'),['VMC Hygro B'],'simple flux précisée hygro B');
eq(vals(A,'heating_vector_before'),['Gaz'],'chauffage initial');
eq(vals(A,'heating_vector_after'),['Électricité'],'chauffage projet');
eq(vals(A,'heating_mode_after'),['PAC'],'PAC du projet');
eq(vals(A,'department'),['76'],'département');

// ---------- 2. Même fiche, état initial non calculé ----------
const B=fiche('RENOIR',{init:false});
eq(vals(B,'cep_before'),[],'Cep initial non calculé : rien en avant travaux');
eq(vals(B,'cep_after_final'),[88.2],'Cep projet lu dans la 1re colonne');
eq([vals(B,'ubat_before'),vals(B,'ubat_after')],[[],[0.61]],'Ubat « NaN » initial ignoré');
eq(vals(B,'heating_vector_before'),[],'tableau d\'énergie à une colonne : pas de vecteur initial');
eq(vals(B,'heating_vector_after'),['Électricité'],'… colonne projet');

// ---------- 3. Note ClimaWin « Synthèse d'étude RTEx » ----------
const note=mk('Note_thermique_MONET.pdf',[
  ['ClimaWin 2020 2024.9.1.3','Batiment : Bat MONET apres travaux - OPTION BBC 2030 - Informations thermiques (enveloppe)',
   'APS / COL - Mur','420.5 Mur exterieur Non-rens. Isolant (16 cm) 0.032 0.19 80.1 15 %','exterieur',
   'APS / COL - Toiture (12 cm) /','260.0 Pl. haut sur ext. ITE (Beton) 0.035/0.035 0.11 28.6 5 %','terrasse PU (8 cm)',
   'AVT / COL - Plancher','255.0 Pl. bas sur LNC Non-rens. Reference (10 cm) 0.032 0.30 76.5 14 %',
   'APS / COL - Menuiseries PVC DV 4/16/4','40.2 Fenetre PVC 1.10 Volet manuel 1.40 / 1.30 0.46 / 0.11 0.57 36.33 7.3 %','VR - 120x135 Argon'],
  ['ClimaWin 2020 2024.9.1.3','Batiment : Bat MONET apres travaux - OPTION BBC 2030 - Synthese d\'etude RTEx',
   'Calcul initial - UBatinit (W/m².K) UBatproj (W/m².K) UBatref (W/m².K) UBatbase (W/m².K) UBatmax (W/m².K)','Garde-fous conformes 1.250 0.612 0.920 - -',
   'Cepinit (KWhep/m²) Cepproj (KWhep/m²) Cepref (KWhep/m²) Cep_p (KWhep/m²) Cepmax (KWhep/m²)','Tic conforme OUI 210.40 88.20 140.60 80.00 150.00',
   'Ticinitial (°C) Ticprojet (°C) Ticref (°C)','Groupe d\'usage 26.00 25.10 32.40',
   'Detail des consommations','Chauffage Refroidissement ECS Ventilateurs','Initial projet reference Initial projet reference Initial projet reference Initial projet reference',
   'Electricite 0.00 30.10 40.00 0.00 0.00 0.00 5.00 25.00 30.00 3.00 1.00 3.00','Gaz 180.00 0.00 0.00 0.00 0.00 0.00 20.00 0.00 0.00 0.00 0.00 0.00','Auxiliaires Eclairage Photovoltaique Total']
]);
eq(note.buildings.names,['Bâtiment MONET'],'note : même bâtiment que la fiche');
eq([vals(note,'ubat_before')[0],vals(note,'ubat_after')[0]],[1.25,0.612],'Ubat initial / projet');
eq([vals(note,'cep_before')[0],vals(note,'cep_after_final')[0],vals(note,'cep_max')[0],vals(note,'cep_gain')[0]],[210.4,88.2,150,41.2],'Cep initial / projet / max, gain');
eq([vals(note,'tic')[0],vals(note,'tic_ref')[0]],[25.1,32.4],'Tic projet / référence');
eq([vals(note,'wall_insulation_thickness')[0],vals(note,'roof_insulation_thickness')[0],vals(note,'floor_insulation_thickness')[0]],[160,200,100],'épaisseurs (couches additionnées : 12 + 8 cm)');
eq([vals(note,'window_material')[0],vals(note,'window_glazing')[0],vals(note,'window_shading')[0]],['PVC','4.16.4 Ar','Volet roulant'],'menuiseries');
eq([vals(note,'heating_vector_before')[0],vals(note,'heating_vector_after')[0],vals(note,'ecs_vector_before')[0],vals(note,'ecs_vector_after')[0]],['Gaz','Électricité','Gaz','Électricité'],'vecteurs avant / après (détail des consommations)');

// ---------- 4. Projet : fiche + note du même bâtiment fusionnées, second bâtiment séparé ----------
const r=analyzeDocuments([A,note,B],structuredClone(DEFAULT_SOURCE_RULES),'T');
eq(r.rows.map(x=>x.building).sort(),['Bâtiment MONET','Bâtiment RENOIR'],'deux bâtiments, sans bâtiment parasite');
const monet=r.rows.find(x=>x.building==='Bâtiment MONET');
eq([monet.cep_before,monet.cep_after_final,monet.ventilation,monet.heating_mode_after],[210.4,88.2,'VMC Hygro B','PAC'],'bâtiment MONET complété par les deux documents');
ok(Object.values(monet).filter(v=>v!==''&&v!=null).length>=24,'au moins 24 valeurs pour MONET');

console.log(`v2.3.18 — ${n} vérifications OK (documents fictifs)`);

// ---------- v2.3.19 : sources et sens du « Gain Cep » ----------
{ const {DEFAULT_SOURCE_RULES:R,LEGACY_SOURCE_RULES:LR}=await import('./js/config.js'); const {sourceTier}=await import('./js/routing.js');
  for(const f of ['cep','cep_max','cep_gain']) assert.equal(sourceTier(f,'RT Existant',R),'main',`${f} : RT existant source principale`);
  assert.equal(sourceTier('cep','RSEE RE2020',R),'main'); assert.ok(R.cep.main.indexOf('RSEE RE2020')<R.cep.main.indexOf('RT Existant'),'RSEE prime sur RT existant');
  assert.ok(LR.cep&&LR.cep.secondary.includes('RT Existant'),'ancienne règle mémorisée pour la migration');
  const r2=analyzeDocuments([A,note,B],structuredClone(R),'T'); const m2=r2.rows.find(x=>x.building==='Bâtiment MONET');
  assert.equal(m2.cep,88.2,'Cep retenu (plus en « à vérifier »)'); assert.equal(m2.cep_gain,41.2,'Gain Cep = 1 − Cep / Cep max');
  assert.ok(!vals(A,'cep_gain').length,'pas de gain sur l\'état initial dans la colonne « Gain Cep »');
  assert.ok(!(r2.uncertain||[]).some(u=>u.field==='cep'||u.field==='cep_gain'),'aucun Cep / gain en attente'); }
console.log('v2.3.19 — sources Cep et Gain Cep OK');
