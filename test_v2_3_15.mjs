// ExtracTerre v2.3.15 — XML RE2020 FICTIF : enveloppe, structure, vitrage et ventilation lus dans Datas_Comp.
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {readXmlText} from './js/readers.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.16','version');

const po=(type,nature,name,s,ep,r)=>`<parois_opaques type_paroi="${type}"><nature>${nature}</nature><name>${name}</name><surface_totale>${s}</surface_totale><U_paroi>0.2</U_paroi><epaisseur_isolant>${ep}</epaisseur_isolant><resistance_thermique_isolant>${r}</resistance_thermique_isolant></parois_opaques>`;
const pv=(name,t,s)=>`<parois_vitrees orientation="S"><name>${name}</name><type_vitrage>${t}</type_vitrage><surface_totale>${s}</surface_totale></parois_vitrees>`;
const xml=`<?xml version="1.0" encoding="utf-8"?>
<projet version="2022.D1E3C2">
<Datas_Comp><donnees_generales>
<maitre_ouvrage><nom>BAILLEUR FICTIF</nom></maitre_ouvrage>
<logiciel><date_etude>2026-02-01</date_etude><editeur>Éditeur Fictif</editeur><nom>ThermoTest</nom><version>1.0</version></logiciel>
<operation><nom>Les Glycines</nom><adresse><postcode>75011</postcode><city>Paris</city></adresse><zone_climatique>Zone H1a</zone_climatique></operation>
</donnees_generales>
<batiment_collection><batiment><Index>1</Index><O_SREF>500</O_SREF><enveloppe>
${po(100,101,'MOB 220 + fibre de bois',120,26,7.2)}${po(100,101,'MOB 220 + fibre de bois',140,26,7.2)}${po(100,101,'Voile béton 18 + PSE',60,14,4.4)}
${po(300,301,'Toiture terrasse végétalisée PU',90,30,11.0)}${po(300,306,'Combles laine soufflée',20,40,10)}
${po(400,401,'Dalle béton sur LNC + PU',110,12,5.4)}${po(100,106,'Porte palière',30,0,0)}
${pv('Fenêtre bois DV',"DV 4_16_4 PE Argon",70)}${pv('Fenêtre bois DV',"DV 4_16_4 PE Argon",30)}${pv('Châssis alu',"TV 4_12_4_12_4 Argon",15)}
</enveloppe><zone_collection><zone><Index>1</Index><Usage>2</Usage><ventilation_mecanique_collection><ventilation_mecanique><Index>1</Index><grp_SF_hygro_A>0</grp_SF_hygro_A><grp_SF_hygro_B>1</grp_SF_hygro_B></ventilation_mecanique></ventilation_mecanique_collection></zone></zone_collection></batiment></batiment_collection>
</Datas_Comp>
<RSET><Entree_Projet><Batiment_Collection><Batiment><Index>1</Index><Name>Batiment 1</Name><Zone_Collection><Zone><NB_logement>8</NB_logement><Groupe_Collection><Groupe><SHAB>480</SHAB><Is_Climatise>0</Is_Climatise></Groupe></Groupe_Collection></Zone></Zone_Collection></Batiment></Batiment_Collection></Entree_Projet>
<Sortie_Projet><Departement>75</Departement>
<Sortie_Batiment_B_Collection><Sortie_Batiment_B><Index>1</Index><O_Bbio_pts_annuel>50</O_Bbio_pts_annuel><O_Bbio_Max>70</O_Bbio_Max></Sortie_Batiment_B></Sortie_Batiment_B_Collection>
<Sortie_Batiment_C_Collection><Sortie_Batiment_C><Index>1</Index><O_SREF>500</O_SREF><O_Cep_annuel>60</O_Cep_annuel><O_Cep_Max>85</O_Cep_Max></Sortie_Batiment_C></Sortie_Batiment_C_Collection>
</Sortie_Projet></RSET>
</projet>`;

const read=readXmlText(xml);
eq(read.xmlFormat,'re2020','XML reconnu comme RE2020');
const d={id:'g1',name:'Glycines_RSEE.xml',read,familyMode:'auto',status:'ready'};
const c=classifyDocument(d.name,read.text,{kind:'xml',re2020:read.re2020}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.buildings=detectBuildings(d);
const occ=parseDocument(d);
const v=f=>occ.find(o=>o.field===f)?.value;
eq(v('operation_name'),'Les Glycines','nom du projet');
// Mur dominant par surface cumulée (2 orientations MOB = 260 m² > voile béton 60 m²).
eq(v('wall_insulation_thickness'),260,'épaisseur isolant mur (cm → mm)');
eq(v('wall_insulation_r'),7.2,'R isolant mur');
eq(v('wall_structure'),'Ossature bois','structure murs MOB');
eq(v('structure'),'Ossature bois','structure principale');
eq(v('roof_insulation_thickness'),300,'épaisseur toiture dominante');
eq(v('roof_insulation_r'),11,'R toiture');
eq(v('roof_structure'),'Toiture terrasse végétalisée','toiture terrasse végétalisée');
// type_paroi 400 / nature 401 : plancher bas, jamais un mur.
eq(v('floor_insulation_thickness'),120,'épaisseur plancher bas');
eq(v('floor_insulation_r'),5.4,'R plancher bas');
eq(v('floor_structure'),'Dalle béton','plancher dalle béton');
ok(!occ.some(o=>o.field==='wall_insulation_thickness'&&o.value===120),'plancher 401 non pris pour un mur');
ok(!occ.some(o=>o.field==='wall_insulation_thickness'&&o.value===0),'porte palière ignorée');
eq(v('window_glazing'),'4.16.4 Ar','vitrage majoritaire');
eq(v('window_material'),'Bois','menuiserie bois');
eq(v('ventilation'),'VMC Hygro B','VMC hygro B');
ok(occ.filter(o=>/^xml:re2020:dc-/.test(o.method)).every(o=>o.structuredXml),'valeurs Datas_Comp structurées');

const r=analyzeDocuments([d],structuredClone(DEFAULT_SOURCE_RULES),'T');
const row=r.rows.find(x=>x.ventilation)||{};
for(const [f,val] of [['wall_insulation_thickness',260],['roof_structure','Toiture terrasse végétalisée'],['window_glazing','4.16.4 Ar'],['ventilation','VMC Hygro B'],['floor_structure','Dalle béton']]) eq(row[f],val,`retenu à l'export : ${f}`);
ok(r.rows.some(x=>x.operation_name==='Les Glycines'),'nom du projet retenu à l\'export');

console.log(`test_v2_3_15 : ${n} assertions OK`);
