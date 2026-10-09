// ExtracTerre v2.3.17 — XML RSEE E+C- FICTIF (RT2012 + RSEnv 2017-2020) : données générales imbriquées sous RSET,
// indicateurs Eges / Eges PCE et seuils C1 / C2, contributeurs rapportés à la SDP, enveloppe RT2012, réseau de chaleur.
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {readXmlText} from './js/readers.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.17','version');

// SDP 2000 m² : PCE 600 + énergie 250 + eau 40 + chantier 10 = Eges 900 kg éq. CO2/m² SDP.
const ind=(ref,nom,v)=>`<indicateurs_performance ref="${ref}"><valeur>${v}</valeur><nom>${nom}</nom><unite>kg éq. CO2</unite></indicateurs_performance>`;
const contrib=(ref,v)=>`<contributeur ref="${ref}"><indicateurs_collection><indicateur ref="1"><valeur>${v}</valeur><nom>Potentiel de réchauffement climatique (GWP)</nom><unite>kg éq. CO2</unite></indicateur></indicateurs_collection></contributeur>`;
const po=(t,nat,name,ep,r,s)=>`<parois_opaques type_paroi="${t}"><nature>${nat}</nature><name>${name}</name><epaisseur_isolant>${ep}</epaisseur_isolant><resistance_thermique_isolant>${r}</resistance_thermique_isolant><U_paroi>0.2</U_paroi><surface_totale>${s}</surface_totale></parois_opaques>`;
const xml=`<?xml version="1.0" encoding="utf-8"?>
<projet num_PEBN="X" referentiel_ec="2" version="1.1.0.3">
<RSET>
 <Datas_Comp>
  <donnees_generales>
   <maitre_ouvrage><nom>PROMOTEUR FICTIF</nom><adresse><ligne>1 rue des Essais</ligne><code_postal>69003</code_postal><ville>LYON</ville></adresse></maitre_ouvrage>
   <BET><nom/><date_etude>2020-03-01</date_etude><editeur_logiciel>Éditeur Fictif</editeur_logiciel><nom_logiciel>ThermoTest</nom_logiciel><version_logiciel>1.0</version_logiciel></BET>
   <operation><num_permis>en cours</num_permis><name>RESIDENCE LES ESSAIS</name><adresse><ligne>Lot B</ligne><code_postal>69003</code_postal><ville>LYON</ville></adresse></operation>
  </donnees_generales>
  <batiment_collection><batiment><Index>1</Index><enveloppe>
   ${po(1,1,'MEXT-BETON-ITE',16,5.0,800)}${po(1,1,'MEXT-MOB',20,6.2,300)}${po(2,5,'PLB/PARKING',10,3.1,400)}${po(3,1,'TERRASSE',20,8.9,380)}${po(4,5,'Porte palière',0,0,20)}
   <parois_vitrees orientation="S"><name>Baie</name><type_vitrage>DV 4/16/4 PE Argon</type_vitrage><surface_totale>200</surface_totale></parois_vitrees>
  </enveloppe><zone_collection><zone><ventilation_mecanique_collection><ventilation_mecanique><grp_SF_hygro_A>0</grp_SF_hygro_A><grp_SF_hygro_B>1</grp_SF_hygro_B></ventilation_mecanique></ventilation_mecanique_collection></zone></zone_collection></batiment></batiment_collection>
 </Datas_Comp>
 <Entree_Projet><Batiment_Collection><Batiment><Index>1</Index><Name>Batiment 1</Name><Zone_Collection><Zone><NB_logement>30</NB_logement><Groupe_Collection><Groupe><SHAB>1800</SHAB></Groupe></Groupe_Collection></Zone></Zone_Collection></Batiment></Batiment_Collection></Entree_Projet>
 <Sortie_Projet><Departement>69</Departement>
  <Sortie_Batiment_B_Collection><Sortie_Batiment_B><Index>1</Index><O_Bbio_pts_annuel>40</O_Bbio_pts_annuel><O_Bbio_Max>60</O_Bbio_Max></Sortie_Batiment_B></Sortie_Batiment_B_Collection>
  <Sortie_Batiment_C_Collection><Sortie_Batiment_C><Index>1</Index><O_Cep_annuel>45</O_Cep_annuel><O_Cep_Max>60</O_Cep_Max>
   <O_Cef_elec_imp_ecs_annuel>2</O_Cef_elec_imp_ecs_annuel><O_Cef_reseau_chaleur_imp_ch_annuel>20</O_Cef_reseau_chaleur_imp_ch_annuel><O_Cef_reseau_chaleur_imp_ecs_annuel>8</O_Cef_reseau_chaleur_imp_ecs_annuel>
  </Sortie_Batiment_C></Sortie_Batiment_C_Collection>
 </Sortie_Projet>
</RSET>
<RSEnv>
 <entree_projet><batiment><index>1</index><nom>Batiment 1</nom></batiment></entree_projet>
 <sortie_projet><batiment><index>1</index>
  ${contrib(1,1250000)}${contrib(2,500000)}${contrib(3,80000)}${contrib(4,20000)}
  <indicateurs_performance_collection>${ind(1,'Eges',900)}${ind(2,'Egesmax1',1500)}${ind(3,'Egesmax2',950)}${ind(4,'EgesPCE',600)}${ind(5,'EgesPCE,max1',800)}${ind(6,'EgesPCE,max2',700)}</indicateurs_performance_collection>
 </batiment></sortie_projet>
 <data_comp><donnees_generales><maitre_ouvrage><nom>PROMOTEUR FICTIF</nom></maitre_ouvrage><logiciel><editeur>Éditeur Fictif</editeur><nom>ACVTest</nom><version>1</version></logiciel>
  <operation><nom>RESIDENCE LES ESSAIS</nom><zone_climatique>H1c</zone_climatique></operation></donnees_generales>
  <batiment><index>1</index><sdp>2000</sdp><srt>2100</srt><shab>1800</shab></batiment></data_comp>
</RSEnv>
</projet>`;

const read=readXmlText(xml);
ok(read.re2020,'RSEE E+C- lu comme XML structuré');
eq(read.re2020.general.referential,'E+C-','référentiel E+C- reconnu');
eq(read.re2020.general.operation,'RESIDENCE LES ESSAIS','nom d\'opération (Datas_Comp sous RSET, balise « name »)');
eq(read.re2020.general.owner,'PROMOTEUR FICTIF','maître d\'ouvrage');
eq(read.re2020.general.software.name,'ThermoTest','logiciel (bloc BET)');
ok(/RSEE E\+C-/.test(read.text),'synthèse lisible titrée E+C-');
const d={id:'ec1',name:'Essais_RSEE_EC.xml',read,familyMode:'auto',status:'ready'};
const c=classifyDocument(d.name,read.text,{kind:'xml',re2020:read.re2020}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.buildings=detectBuildings(d);
const occ=parseDocument(d); const v=f=>occ.find(o=>o.field===f)?.value;
eq([v('eges_total'),v('eges_total_max'),v('eges_pce'),v('eges_pce_max')],[900,1500,600,800],'Eges, Eges PCE et seuils C1');
eq([v('eges_energy'),v('eges_water'),v('eges_site')],[250,40,10],'contributeurs énergie / eau / chantier rapportés à la SDP');
ok(occ.find(o=>o.field==='eges_total').provenanceNote.includes('C2'),'niveau carbone C2 indiqué dans la provenance');
eq(v('mention_ec'),'Carbone C2 (calcul RSEE)','niveau carbone proposé');
ok(occ.find(o=>o.field==='mention_ec').confidence<0.9,'… à vérifier (pas une mention de label)');
eq([v('bbio'),v('cep'),v('housing_count')],[40,45,30],'thermique RT2012 conservée');
eq(v('heating_vector_after'),'Réseau de chaleur urbain','chauffage : O_Cef_reseau_chaleur_imp (RT2012)');
eq(v('ecs_vector_after'),'Réseau de chaleur urbain','ECS : réseau 8 / électricité 2');
eq([v('wall_insulation_thickness'),v('wall_insulation_r'),v('wall_structure')],[160,5,'Béton'],'mur dominant (type_paroi 1)');
eq([v('roof_insulation_thickness'),v('roof_insulation_r'),v('roof_structure')],[200,8.9,'Toiture terrasse'],'toiture (type_paroi 3)');
eq([v('floor_insulation_thickness'),v('floor_insulation_r')],[100,3.1],'plancher bas (type_paroi 2)');
ok(!occ.some(o=>o.field==='wall_insulation_thickness'&&o.value===0),'parois sur local non chauffé (type 4) ignorées');
eq([v('window_glazing'),v('ventilation')],['4.16.4 Ar','VMC Hygro B'],'vitrage et ventilation');

// Contrôle de cohérence : si la somme des contributeurs ne redonne pas l'Eges, rien n'est rapporté à la SDP.
const bad=readXmlText(xml.replace('<sdp>2000</sdp>','<sdp>1500</sdp>'));
eq(bad.re2020.buildings[0].ec.energy,undefined,'contributeurs non rapportés si la SDP ne boucle pas');

const r=analyzeDocuments([{...d,cachedOccurrences:occ}],structuredClone(DEFAULT_SOURCE_RULES),'T');
const row=r.rows.find(x=>x.eges_total)||{};
for(const [f,val] of [['eges_total',900],['eges_pce',600],['eges_energy',250],['eges_total_max',1500],['operation_name','RESIDENCE LES ESSAIS'],['heating_vector_after','Réseau de chaleur urbain']]) eq(row[f],val,`retenu à l'export : ${f}`);

console.log(`v2.3.17 — ${n} vérifications OK (document fictif)`);
