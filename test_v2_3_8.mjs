// ExtracTerre v2.3.8 — documents FICTIFS reproduisant : étude environnementale Pléiades (données techniques),
// sortie thermique Pléiades (systèmes par bâtiment), fiche RSET CSTB lue par OCR (séparateurs « | », DH aberrant),
// réglages OCR des pages sans couche texte.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {readTechnicalData,technicalDataFields} from './js/donnees-techniques.js';
import {mkPage,mkDoc} from './test_fixtures_v2_3_3.mjs';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.9','version');
const rows=(arr,y0=800)=>arr.map((t,i)=>[t,y0-i*10]);
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:'pdf'}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.familyMode='auto'; d.buildings=detectBuildings(d); return d; };
const val=(out,f,b)=>out.find(o=>o.field===f&&(!b||o.building===b))?.value;

// --- 1. Lecteur « Données techniques » : libellés coupés et deux couples par ligne ------------------------------------------
const L=a=>a.map(t=>({t}));
const f1=technicalDataFields(readTechnicalData(L(['Type de structure principale Ossature','Materiau principal Bois massif',"Nature de l'isolation des",'Laine de bois','parois verticales exterieures',"Nature de l'isolation des",'Polyurethane (PU)','toitures','Type de toiture Terrasse non accessible'])));
const g=(arr,f)=>arr.find(x=>x.field===f)?.value;
eq(g(f1,'structure'),'Ossature bois'); eq(g(f1,'wall_insulation'),'Fibre de bois','libellé coupé autour de la valeur'); eq(g(f1,'roof_insulation'),'PUR'); eq(g(f1,'roof_structure'),'Toiture terrasse non accessible');
const f2=technicalDataFields(readTechnicalData(L(['Type de structure porteuse Ossature Elements Prefabriques Non',"Nature de l'isolation des planchers Laine de verre (LV) Nature de l'espace sous plancher Parking",'Type de menuiseries PVC','Type de protections mobiles des menuiseries Sans protection mobile','Materiau principal de la structure Bois massif'])));
eq(g(f2,'floor_insulation'),'Laine de verre','valeur coupée au libellé suivant'); eq(g(f2,'window_material'),'PVC'); eq(g(f2,'window_shading'),'Sans occultation'); eq(g(f2,'structure'),'Ossature bois');

// --- 2. Étude environnementale Pléiades : données techniques + indicateurs ----------------------------------------------------
const env=prep(mkDoc('env','Sortie env fictive.pdf',[mkPage(1,rows(['Recapitulatif du calcul reglementaire / Partie Environnement'])),
  mkPage(2,rows(['Donnees generales Batiment B','Donnees techniques','Type de structure principale Ossature','Materiau principal Bois massif',"Nature de l'isolation des",'Laine de bois','parois verticales exterieures',"Nature de l'isolation des",'Laine de verre (LV)','plancher bas','Type de plancher Bois','Indicateurs de performance','Ic construction kg eq CO2/m² 691.50','Ic construction max kg eq CO2/m² 886.26','Ic construction max 2028 kg eq CO2/m² 726.38','Ic energie max 2028 kg eq CO2/m² 274.32']))]));
const eo=parseDocument(env);
eq(val(eo,'ic_construction_max_2028','Bâtiment B'),726.38); eq(val(eo,'wall_insulation','Bâtiment B'),'Fibre de bois'); eq(val(eo,'floor_insulation','Bâtiment B'),'Laine de verre'); eq(val(eo,'floor_structure','Bâtiment B'),'Plancher bois');
ok(DEFAULT_SOURCE_RULES.wall_insulation.main.includes('RSENV / RSNV'),'RSEnv autorisé pour la nature des isolants');
ok(!DEFAULT_SOURCE_RULES.wall_insulation_thickness.main.includes('RSENV / RSNV'),'… mais pas pour les épaisseurs');

// --- 3. Sortie thermique Pléiades : générateur, ECS et ventilation par bâtiment ------------------------------------------------
const th=prep(mkDoc('th','Sortie thermique fictive.pdf',[mkPage(1,rows(['Pleiades, version 6.26.1.2','1 Resultats RE2020 Energie','.1 Batiment B','Exigence de resultat : Bbio','Besoins Bioclimatique 50,6 points 78 points','.2 Batiment E','Exigence de resultat : Bbio','Besoins Bioclimatique 49,9 points 77,5 points','2 Synthese de l\'enveloppe du batiment'])),
  mkPage(2,rows(['5 Caracteristiques du projet','.17 Systemes de chauffage, ecs et climatisation','Chaudiere granules BAT B (Volume chauffe Batiment B)','Detail Production Stockage ECS-Chaudiere granules BAT B - Chauffe-eau a appoint integre','Chaudiere granules BAT E (Volume chauffe Batiment E)',
    '.18 Systemes de ventilation','Ventilations mecaniques','BAT B / - Ventilation - Bat B T4','Nom Atlantic HYGROCOSY BC FLEX PLUS 140 Pa','Type Groupe de ventilation simple flux','Bat E / - Ventilation - BAT E T3','Nom Extracteur autoreglable','Type Groupe de ventilation simple flux','Bouches de ventilation']))]));
const to=parseDocument(th);
eq(val(to,'heating_mode_after','Bâtiment B'),'Chaudière biomasse'); eq(val(to,'heating_vector_after','Bâtiment E'),'Bois / biomasse'); eq(val(to,'ecs','Bâtiment B'),'Chaudière');
eq(val(to,'ventilation','Bâtiment B'),'VMC Hygro B','HYGROCOSY BC = hygroréglable B'); eq(val(to,'ventilation','Bâtiment E'),'VMC simple flux');

// --- 4. Fiche RSET CSTB lue par OCR -----------------------------------------------------------------------------------------------
const ocrPage=(p,t)=>{ const pg=mkPage(p,rows(t)); pg.textSource='ocr'; return pg; };
const rs=prep(mkDoc('rs','RSEE image.pdf',[ocrPage(1,['RÉGLEMENTATION ENVIRONNEMENTALE 2020','Récapitulatif Standardisé Energie Environnement','Partie « Etude Thermique »']),
  ocrPage(2,['Bâtiment : Bâtiment B','Srer / usage principal 1294 m° / Logement collectif','Données techniques du bâtiment','Type de structure porteuse Ossature Elements Préfabriqués Non','Matériau principal de la structure | Bois massif','Type de menuiseries PVC','Exigences de performance énergétique',
    'Coefficient Bbio      50,6      78      35,1','Coefficients Cep / CePmax - Cep,nr / Cep,nrmax   68,6   89,7   10,9   73,9   23,5   85,3',
    'BATB/Bat | Non | 520,9   400,2   233   151   91   Conforme','B-RDC   Non | 457,9   3952   226   149   95   Conforme','BATB / Bat   Non | 315,2   472,7   251   165   118   Conforme'])]));
const ro=parseDocument(rs);
eq(val(ro,'bbio','Bâtiment B'),50.6); eq(val(ro,'cepnr','Bâtiment B'),10.9); eq(val(ro,'cep_max','Bâtiment B'),89.7);
eq(val(ro,'dh','Bâtiment B'),472.7,'« | » ignoré ; « 3952 » (virgule perdue par l’OCR) écarté'); eq(val(ro,'structure','Bâtiment B'),'Ossature bois'); eq(val(ro,'window_material','Bâtiment B'),'PVC');

// --- 5. Réglages OCR ------------------------------------------------------------------------------------------------------------------
const rd=fs.readFileSync('./js/readers.js','utf8');
ok(/tessedit_pageseg_mode:'4'/.test(rd),'segmentation PSM 4 (tableaux conservés)'); ok(/fullPage\?\{\.\.\.opts,scale:Math\.max\(Number\(opts\.scale\)\|\|0,3\.0\)/.test(rd),'rendu ≈ 216 dpi pour les pages sans texte');
console.log(`v2.3.8 — ${n} vérifications OK (documents fictifs)`);
