// ExtracTerre v2.3.11 — documents FICTIFS reproduisant : colonnes Eges, fiche de synthèse BBCA Rénovation reproduite dans
// une notice ACV (deux bâtiments, lignes de lots coupées), notice thermique RT existant, rapport Pléiades Th-C-E ex,
// plan de repérage des isolants, noms « Bâtiment sur cour » / « Immeuble cour » / « bat. Cour ».
import assert from 'node:assert/strict';
import {APP_VERSION,FIELD_DEFS,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings,canonicalBuilding,buildingMergeKey} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {mkPage,mkDoc} from './test_fixtures_v2_3_3.mjs';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.12','version');
const rows=(arr,y0=800)=>arr.map((t,i)=>[t,y0-i*10]);
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:'pdf'}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.familyMode='auto'; d.buildings=detectBuildings(d); return d; };
const val=(out,f,b)=>out.find(o=>o.field===f&&(!b||o.building===b))?.value;

// --- 1. Schéma : 12 colonnes Eges en fin d'export ------------------------------------------------------------------------------
eq(FIELD_DEFS.length,185);
eq(FIELD_DEFS.slice(-12).map(f=>f.key),['eges_pce','eges_pcena','eges_energy','eges_site','eges_water','eges_total','eges_pce_max','eges_pcena_max','eges_energy_max','eges_site_max','eges_water_max','eges_total_max']);
ok(FIELD_DEFS.slice(-12).every(f=>f.family==='Carbone'),'onglet Carbone');
ok(DEFAULT_SOURCE_RULES.eges_pce.main.includes('Étude carbone / ACV'),'Eges : étude carbone en source principale');
ok(DEFAULT_SOURCE_RULES.wall_insulation.main.includes('RT Existant'),'enveloppe : étude RT existant autorisée');

// --- 2. Noms de bâtiments ------------------------------------------------------------------------------------------------------
eq(canonicalBuilding('Batiment sur cour'),'Bâtiment COUR'); eq(canonicalBuilding('Immeuble rue'),'Bâtiment RUE'); eq(canonicalBuilding('bat. Cour'),'Bâtiment COUR');
eq(buildingMergeKey('Bâtiment SUR COUR'),buildingMergeKey('Bâtiment COUR'));

// --- 3. Notice ACV BBCA Rénovation (fiche de synthèse en annexe, deux bâtiments) ---------------------------------------------
const bloc=(nom,sdp,lots,eg)=>['Batiment sur '+nom+' :','Label BBCA Renovation : BBCA Excellent','Respect des condition Eges PCE et Eges energie : Oui',
  'Nom du projet Ville Fictive · bat. '+nom,'Typologie de renovation Renovation lourde','Typologie du batiment Logements collectifs',`Surface de plancher (m² SDP) ${sdp}`,
  'Perimetre de la renovation','renoves)↓ lot renove↓ comptabilise ?',
  `Lot 1. VRD Oui ${lots[0]} Oui`,`Lot 2. Fondations et infrastructure Non ${lots[1]} Oui`,`Lot3. Superstructure-Maconnerie Oui ${lots[2]} Oui`,`Lot 4. Couverture Oui ${lots[3]} Oui`,
  'Lot 5. Cloisonnement-Doublage-Plafonds suspendus-',`Oui ${lots[4]} Oui`,'Menuiseries interieures',
  `Lot 6. Facades et menuiseries exterieures Oui ${lots[5]} Oui`,`Lot 7. Revetements Oui ${lots[6]} Oui`,`Lot 8. CVC Oui ${lots[7]} Oui`,`Lot 9.Installations sanitaires Oui ${lots[8]} Oui`,
  `Lot 10. Reseau d'energie (courant fort) Oui ${lots[9]} Oui`,`Lot 11. Reseau de communication (courant faible) Oui ${lots[10]} Oui`,`Lot 12. Appareils elevateurs Non ${lots[11]} Oui`,
  'Indicateurs BBCA reno ↓ A renseigner↓',`Eges PCE (kg CO2 eq/m²SDP) ${eg[0]}`,'EgesPCENA (kg CO2 eq/m²SDP) 0',`Eges energie(kg CO2 eq/m²SDP) ${eg[1]}`,'Eges chantier(kg CO2 eq/m²SDP) 9','Eges eau(kg CO2 eq/m²SDP) 50',`Eges(kg CO2 eq/m²SDP) ${eg[2]}`,
  'Calcul des seuils BBCA reno','Eges PCE max (kg CO2 eq/m²SDP) 480','Eges energie max (kg CO2 eq/m²SDP) 1 250','Egeschantier max(kg CO2 eq/m²SDP) 17','Eges max (kg CO2 eq/m²SDP) 1 890'];
// Σ lots RUE = 2+0+0+10+30+80+60+50+30+40+8+0 = 310 = Eges PCE
const acv=prep(mkDoc('acv','Notice ACV fictive.pdf',[mkPage(1,rows(['NOTICE ANALYSE DE CYCLE DE VIE LABEL BBCA-RENOVATION','Vis-a-vis du niveau Carbone, le niveau BBCA-Renovation est recherche.'])),
  mkPage(2,rows(['Resultats de l\'ACV du batiment sur rue','Indicateurs Eges','PCE 480 310 -35 %','Energie 1250 450 -64 %','Total 1885 820 -56 %'])),
  mkPage(3,rows(bloc('rue',350,[2,0,0,10,30,80,60,50,30,40,8,0],[310,450,820]))),mkPage(4,rows(bloc('cour',230,[1,0,15,9,25,100,55,55,40,45,6,0],[351,470,880])))]));
eq(acv.type,'Étude carbone / ACV','notice ACV BBCA Rénovation classée étude carbone'); eq(acv.buildings.names,['Bâtiment RUE','Bâtiment COUR']);
const ao=parseDocument(acv);
eq(val(ao,'eges_pce','Bâtiment RUE'),310); eq(val(ao,'eges_pce','Bâtiment COUR'),351); eq(val(ao,'eges_energy','Bâtiment COUR'),470); eq(val(ao,'eges_pcena','Bâtiment RUE'),0);
eq(val(ao,'eges_total','Bâtiment RUE'),820); eq(val(ao,'eges_energy_max','Bâtiment RUE'),1250,'« 1 250 »'); eq(val(ao,'eges_site_max','Bâtiment RUE'),17,'« Egeschantier max(kg »'); eq(val(ao,'eges_total_max','Bâtiment COUR'),1890);
eq(val(ao,'ic_lot_5','Bâtiment RUE'),30,'ligne de lot coupée'); eq(val(ao,'ic_lot_3','Bâtiment COUR'),15,'« Lot3. »'); eq(val(ao,'ic_lot_9','Bâtiment RUE'),30,'« Lot 9.Installations »');
ok(/≈ Eges PCE 310/.test(ao.find(o=>o.field==='ic_lot_1'&&o.building==='Bâtiment RUE').provenanceNote),'Σ lots = Eges PCE');
eq(val(ao,'shab','Bâtiment COUR'),230); eq(val(ao,'renovation','Bâtiment RUE'),'Rénovation lourde','accent rétabli'); eq(val(ao,'operation_name'),'Ville Fictive');
ok(!ao.some(o=>/^ic_(?:components|site|energy)$/.test(o.field)),'Eges non recopiés dans les colonnes IC (méthode différente)');

// --- 4. Notice thermique RT existant (bureau d'études) --------------------------------------------------------------------------
const th=prep(mkDoc('th','Notice thermique fictive.pdf',[mkPage(1,rows(['Notice Thermique','Pour la phase PRO, une etude thermique a ete realisee, en s\'appuyant sur la methode RT-Ex.',
  'Afin d\'ameliorer le renouvellement d\'air, nous prevoyons la mise en place d\'une VMC simple flux, type Hygro A par batiment, tel que :',
  'Les besoins de chauffage pour les deux batiments seront assures par radiateurs electriques connectes.','La production d\'eau chaude sanitaire sera assuree par des ballons a accumulation de type Chauffeo.',
  '- cadre bois massif ;','- double vitrage avec lame d\'air de 16 mm ;'])),
  mkPage(2,rows(['> Parois verticales','Immeuble rue','Immeuble rue : facade rue Exterieur Pierre Inconnu Sans Pierre Inconnu Fibre de bois Interieur 0,036 14 3,9 Oui Oui','Immeuble rue : facade cour Exterieur Inconnu Fibre de bois Interieur 0,036 14 3,9 Oui Oui','Immeuble rue : contre cage d\'escalier Escalier Inconnu Fibre de bois Interieur 0,036 10 2,8 Oui Non',
    'Immeuble cour','Immeuble cour : facade grande cour Exterieur Inconnu Fibre de bois Interieur 0,036 12 3,3 Oui Oui',
    '> Toitures','Immeuble rue','Immeuble rue : rampants Exterieur Charpente Fibre de bois Interieur 0,036 20 5,6 Oui Non','Immeuble cour','Combles Solives bois Inconnu 10 cm Solives bois Inconnu Fibre de bois 0,036 40 11,1 Oui Oui',
    '> Planchers bas','Immeuble rue','Plancher R+1 au-dessus du hall Exterieur Inconnu Laine de roche 0,035 10 2,9 Oui Non'])),
  mkPage(3,rows(['Batiment sur rue :','Etat initial Seuils RT existant Seuils BBC Effinergie Resultats projet','Ubat initial Cep initial Ubat max Cep max RT-Ex Cep initial -60% max label BBC Ubat projet Cep projet','W/(m².K) kWhEP/m² W/(m².K) kWhEP/m² kWhEP/m² kWhEP/m² kWhEP/m² kgeqCO2/m².an W/(m².K) kWhEP/m² kgeqCO2/m².an','2,5 480 1,4 165,0 192 104 149,5 20 0,6 140,2 4,0',
    'Batiment sur cour :','Ubat initial Cep initial Ubat max Cep max RT-Ex Cep initial -60% max label BBC Ubat projet Cep projet','2,2 700 0,81 165,0 280 104 149,5 20 0,4 170 4,8']))]));
eq(th.type,'RT Existant'); eq(th.buildings.names,['Bâtiment RUE','Bâtiment COUR']);
const to=parseDocument(th);
eq(val(to,'ubat_before','Bâtiment RUE'),2.5); eq(val(to,'cep_before','Bâtiment RUE'),480); eq(val(to,'ubat_after','Bâtiment RUE'),0.6); eq(val(to,'cep_after_final','Bâtiment RUE'),140.2);
eq(val(to,'cep_after_final','Bâtiment COUR'),170); eq(val(to,'cep_before','Bâtiment COUR'),700);
eq(val(to,'wall_insulation','Bâtiment RUE'),'Fibre de bois'); eq(val(to,'wall_insulation_thickness','Bâtiment RUE'),140,'façades (pas la cage d’escalier), en mm'); eq(val(to,'wall_insulation_r','Bâtiment COUR'),3.3);
eq(val(to,'roof_insulation_thickness','Bâtiment COUR'),400); eq(val(to,'floor_insulation','Bâtiment RUE'),'Laine de roche');
eq(val(to,'ventilation','Bâtiment COUR'),'VMC Hygro A'); eq(val(to,'heating_mode_after','Bâtiment RUE'),'Chauffage électrique direct'); eq(val(to,'ecs','Bâtiment COUR'),'Ballon électrique'); eq(val(to,'window_material','Bâtiment RUE'),'Bois');
ok(!to.some(o=>o.field==='cep_before'&&o.value<5),'plus de « Cep avant » parasite');

// --- 5. Rapport Pléiades RT existant (Th-C-E ex) --------------------------------------------------------------------------------
const pl=prep(mkDoc('pl','Rapport Pleiades fictif batiment cour.pdf',[mkPage(1,rows(['Departement : 75 - Paris (H1 a)','1 Resultats RT Existant suivant la methode THCE - Ex','1.1 Batiment 1','Exigence de resultat : Cep','Cep Initial Projet Reference Max(CH,ECS,FR)','kWh ep/m² 520.0 171.5 228.4 165.0','Coefficient Cep 171.5 kWh ep/m²',
  'Ubat (hiver) W/m2.K 2.1 0.398 0.598'])),
  mkPage(2,rows(['Combles','Type de paroi Plancher haut','Nature de paroi Sous combles','Fibre de bois 036 40.0 0.036 140 0.583 0.09 11.11','Total 0.09 11.11',
    'Facade','Type de paroi Paroi verticale','Nature de paroi Mur exterieur','Pierre 30.0 1.900 2400 0.222 6.33 0.16','Fibre de bois 036 14.0 0.036 140 0.583 0.26 3.89',
    'Mur mitoyen','Type de paroi Paroi verticale','Nature de paroi Mur exterieur','Pierre 30.0 1.900 2400 0.222 6.33 0.16',
    'Porte palière','Type de cadre Bois','Nom codifie sans objet','Fen bois (Baie)','Type de cadre Bois','Nom codifie DV 4/16/4 PE Argon','Protection Store enroulable exterieur opaque'])),
  mkPage(3,rows(['5.2 Batiment 1','Annee de construction 1850','Nombre de logements 4','Surface habitable en residentiel ou SHON pour autre usage 151.50 m²',
    'Generation 1 (Volume chauffe Batiment 1)','Stockage','Effet Joule','Detail Stockage-Generation 1 - Ballon chauffage sans appoint','Nouveau systeme de ventilation Residentiel: Ventilation mecanique simple flux']))]));
eq(pl.type,'RT Existant'); eq(pl.buildings.names,['Bâtiment COUR'],'« Batiment 1 » remplacé par le nom de fichier');
const po=parseDocument(pl); const C='Bâtiment COUR';
eq(val(po,'cep_after_final',C),171.5); eq(val(po,'cep_before',C),520); eq(val(po,'ubat_after',C),0.398); eq(val(po,'ubat_before',C),2.1);
eq(val(po,'wall_insulation_thickness',C),140); eq(val(po,'roof_insulation',C),'Fibre de bois'); eq(val(po,'roof_insulation_r',C),11.11);
eq(val(po,'window_glazing',C),'4.16.4 Ar','vitrage de la baie, pas « sans objet » de la porte'); eq(val(po,'window_shading',C),'Store');
eq(val(po,'heating_mode_after',C),'Chauffage électrique direct'); eq(val(po,'ecs',C),'Ballon électrique'); eq(val(po,'ventilation',C),'VMC simple flux');
eq(val(po,'construction_year',C),1850); eq(val(po,'housing_count',C),4); eq(val(po,'department'),'75');

// --- 6. Plan de repérage des isolants ----------------------------------------------------------------------------------------------
const plan=prep(mkDoc('pi','Plan reperage isolants fictif.pdf',[mkPage(1,rows(['Plans de principe de reperage des isolants','Isolants verticaux',
  'Isolation par l\'interieur en fibre de bois: e=14 cm ; =0,036 W/(m.K) et R=3,89 (m².K)/W','Isolation par l\'interieur en fibre de bois: e=8 cm ; =0,036 W/(m.K) et R=2,22 (m².K)/W','Isolants horizontaux',
  'Isolation plancher bois en laine de roche: e=10 cm ; =0,035 W/(m.K) et R=2,86 (m².K)/W','Isolation de comble au-dessus du plancher en laine de bois: e=40 cm ; =0,036 W/(m.K) et R=11,11 (m².K)/W']))]));
eq(plan.type,'Étude thermique','plan de repérage classé étude thermique');
const io=parseDocument(plan);
eq(val(io,'wall_insulation'),'Fibre de bois'); eq(val(io,'wall_insulation_thickness'),140,'isolant principal = le plus épais'); eq(val(io,'roof_insulation_thickness'),400); eq(val(io,'floor_insulation'),'Laine de roche');

// --- 7. Consolidation : la sortie logiciel l'emporte sur la description de la notice ------------------------------------------------
const r=analyzeDocuments([th,pl,acv],DEFAULT_SOURCE_RULES,'Test');
const row=b=>r.rows.find(x=>x.building===b)||{};
eq(row('Bâtiment COUR').window_glazing,'4.16.4 Ar','vitrage Pléiades (4.16.4 Ar) plutôt que « Double vitrage » de la notice');
eq(row('Bâtiment COUR').eges_pce,351); eq(row('Bâtiment RUE').cep_after_final,140.2); eq(row('Bâtiment COUR').ventilation,'VMC simple flux');
console.log(`v2.3.11 — ${n} vérifications OK (documents fictifs)`);
