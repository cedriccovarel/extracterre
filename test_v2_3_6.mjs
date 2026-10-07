// ExtracTerre v2.3.6 — notices BE (documents FICTIFS reproduisant la structure des notices réelles) :
// sortie Pléiades à titres « .N » + « Cible 2028 », notice carbone RE2020 par bâtiment, notice thermique en colonnes,
// notice label biosourcé.
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {mkPage,mkDoc} from './test_fixtures_v2_3_3.mjs';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.9','version');
const rows=(arr,y0=800)=>arr.map((t,i)=>[t,y0-i*10]);
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:'pdf'}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.familyMode='auto'; d.buildings=detectBuildings(d); return d; };
const val=(out,f,b)=>out.find(o=>o.field===f&&(!b||o.building===b))?.value;

// --- 1. Sortie Pléiades récente : « .1 Batiment Est », cibles Ic énergie par période, SRT déclarée nulle -------------
const pl=prep(mkDoc('pl','Sortie fictive.pdf',[
  mkPage(1,rows(['Pleiades, version 6.26.2.4','Departement : 92 - Hauts-de-Seine (H1 a)'])),
  mkPage(2,rows(['1 Resultats RE2020 Energie','.1 Batiment Est','Exigence de resultat : Bbio','Besoins Bioclimatique 56,4 points 72,3 points','Exigence de resultat : Cep',
    'Consommation energie Primaire 82,4 kWh EP/m² 86,8 kWh EP/m²','Exigence de resultat : Cep nr','Consommation energie Primaire non renouvelable 53,2 kWh EP/m² 71,5 kWh EP/m²',
    'Exigence de resultat : Ic Energie','Indice Carbone Energie 250.16 kg eq. CO2 571.71 kg eq. CO2','Cible 2022 571.71 kg eq. CO2','Cible 2025 571.71 kg eq. CO2','Cible 2028 265.44 kg eq. CO2',
    'Exigence de resultat : Degres-Heures','Logements traversants 412,9 °C.h 1250 °C.h','2 Synthese de l\'enveloppe du batiment','.2 Batiment Est'])),
  mkPage(3,rows(['5 Caracteristiques du projet','.18 Environnement','.19 Batiment Est','SRT declaree 0 m²','Nombre de logement 37','Surface utile du groupe (SHAB / SURT) 2000.30 m²','Surface utile du groupe (SHAB / SURT) 521.00 m²','Climatisation Non','.22 Systemes de chauffage, ecs et climatisation']))]));
eq(pl.buildings.names,['Bâtiment EST'],'titres « .N » reconnus, sections non-bâtiment ignorées');
const po=parseDocument(pl);
eq(val(po,'bbio'),56.4); eq(val(po,'cepnr'),53.2); eq(val(po,'ic_energy_max'),571.71); eq(val(po,'ic_energy_max_2028'),265.44,'Cible 2028 → IC énergie Max 2028');
eq(val(po,'shab'),2521.3,'SRT nulle → somme des surfaces utiles des groupes'); eq(val(po,'housing_count'),37); eq(val(po,'dh'),412.9);

// --- 2. Notice carbone RE2020 (+ BBCA) : une section par bâtiment, seuils 2028 --------------------------------------
const lots=(o)=>['1.VRD (Voirie et Reseaux Divers) 1','2.1. Fondations 24','2.2. Murs et structures enterres 31','3. Superstructure - Maconnerie '+o.l3,'4. Couverture - Etancheite 18','5. Cloisonnement 49','6. Facades et menuiseries exterieures 48','7. Revetements des sols 52','8. CVC (Chauffage – Ventilation) 47','9. Plomberie-sanitaire 50','10. Reseaux d\'energie (courant fort) 48','11. Reseaux de communication (courant faible) 2','12. Appareils elevateurs 6','13. Equipements de production locale d\'electricite 0',`Ic Composants = ${o.comp}`,'Ic Chantier = 19',`Ic Construction = ${o.comp+19}`];
const sect=(k,name,o)=>[`${k} EVALUATION DU BILAN CARBONE – BATIMENT`,`${name} (CAGE ${k})`,'Seuil IC Construction',`max ${o.comp+19} ${o.smax} -8%`,'Seuil IC Energie max',`${o.ie} ${o.iemax} -25%`,...lots(o),'2. Exploitation Maitrisee','Chauffage 114','Refroidissement 0','ECS 65','Auxiliaires de distribution 6','Auxiliaires de ventilation 5','Deplacements des occupants a l\'interieur du batiment 18','Ic Energie = 213,0'];
const nc=prep(mkDoc('nc','Notice carbone fictive.pdf',[mkPage(1,rows(['SOMMAIRE','2 EVALUATION DU BILAN CARBONE – BATIMENT NORD ........ 8','Ce projet vise la reglementation RE2020 seuil 2028, ainsi qu\'une labelisation BBCA niveau Standard.','Ic-Construction'])),
  mkPage(2,rows(sect(2,'NORD',{l3:124,comp:500,smax:565,ie:214,iemax:284}))),mkPage(3,rows(sect(3,'SUD',{l3:131,comp:507,smax:546,ie:220,iemax:294})))]));
eq(nc.type,DOC_TYPES.CARBON,'classée Étude carbone (et non RSET)'); eq(nc.buildings.names,['Bâtiment NORD','Bâtiment SUD'],'sommaire ignoré, « (CAGE n) » retiré');
const co=parseDocument(nc);
eq(val(co,'ic_construction','Bâtiment NORD'),519); eq(val(co,'ic_construction_max_2028','Bâtiment NORD'),565,'seuil 2028 déclaré par la notice');
ok(!co.some(o=>o.field==='ic_construction_max'),'pas de seuil « courant » inventé'); eq(val(co,'ic_energy','Bâtiment SUD'),220); eq(val(co,'ic_energy_max_2028','Bâtiment SUD'),294);
eq(val(co,'ic_components','Bâtiment NORD'),500); eq(val(co,'ic_site','Bâtiment NORD'),19);
eq(val(co,'ic_lot_2','Bâtiment NORD'),55,'lot 2 = 2.1 + 2.2'); eq(val(co,'ic_lot_3','Bâtiment SUD'),131);
ok(co.find(o=>o.field==='ic_lot_3'&&o.building==='Bâtiment NORD').confidence>=0.95,'Σ lots = Ic composants');
eq(val(co,'ic_energy_heating','Bâtiment NORD'),114); eq(val(co,'ic_energy_mobility','Bâtiment NORD'),18);
eq(val(co,'mention_bbca'),'Oui');

// --- 3. Notice thermique en colonnes ---------------------------------------------------------------------------------------
const th=prep(mkDoc('th','Notice thermique fictive.pdf',[mkPage(1,rows(['NOTE THERMIQUE RE2020 LOGEMENTS','Caracteristiques generales des batiments :','BATIMENT HABITATION COLLECTIVE CENTRAL NORD','Nombre total des logements 37 14','Surface habitable totale (Sref) 2521,3 m² 896,3 m²'])),
  mkPage(2,rows(['Titre III – chapitre 12 - Art 29','lorsque le chauffage est assure par un plancher chauffant a eau chaude','Ventilation mecanique controlee, hygroreglable type B','Localisation : tous les logements collectifs batiment Central',
    'BESOINS BIOCLIMATIQUES DU PROJET (BBIO)','POSTE','BATIMENT CENTRAL BATIMENT NORD','BBIO 56,40 59,00','BBIO_MAX 72,30 78,00','GAIN 22,00 % 24,40 %',
    'CONSOMMATIONS D\'ENERGIE PRIMAIRE','(CEP EN KWEP/M²SREF.AN)','POSTE BATIMENT CENTRAL BATIMENT NORD','ECLAIRAGE 4,40 4,40','ASCENSEUR/PARKING 18,60 16,10','CEP 82,40 73,60','CEP_MAX 86,80 92,90','GAIN 5,10 % 20,80 %'])),
  mkPage(3,rows(['CONSOMMATIONS D\'ENERGIE PRIMAIRE NON RENOUVELABLES (CEP,NR EN KWEP/M²SREF.AN)','POSTE BATIMENT CENTRAL BATIMENT NORD','ECLAIRAGE 9,99 9,99','CEP,NR 53,20 49,20','CEP,NR_MAX 71,50 76,50','GAIN 25,60 % 35,70 %',
    'BATIMENT CENTRAL','DH (°C.H)','GROUPE DH DH_MAX','GROUPE CHAUFFE 412,90 1250 ✓','BATIMENT NORD','DH (°C.H)','GROUPE DH DH_MAX','GROUPE CHAUFFE 415,30 1250 ✓',
    'IMPACT SUR LE CHANGEMENT CLIMATIQUE DES CONSOMMATIONS D\'ENERGIE (ICENERGIE EN KGEQCO2/M²SREF)','BATIMENT CENTRAL BATIMENT NORD','ICENERGIE 250,20 214,80','ICENERGIE_MAX 571,70 612,30']))]));
eq(th.type,DOC_TYPES.THERMAL,'classée Étude thermique (et non DPE)'); eq(th.buildings.names,['Bâtiment CENTRAL','Bâtiment NORD']);
const to=parseDocument(th);
eq(val(to,'bbio','Bâtiment NORD'),59); eq(val(to,'bbio_gain','Bâtiment CENTRAL'),22); eq(val(to,'cep_max','Bâtiment NORD'),92.9); eq(val(to,'cep_gain','Bâtiment NORD'),20.8,'GAIN rattaché au tableau Cep');
eq(val(to,'cepnr','Bâtiment CENTRAL'),53.2); eq(val(to,'cepnr_gain','Bâtiment NORD'),35.7); eq(val(to,'cep_lighting','Bâtiment CENTRAL'),4.4,'poste Cep (pas Cep,nr)');
eq(val(to,'cep_mobility','Bâtiment NORD'),16.1); eq(val(to,'ic_energy_max','Bâtiment NORD'),612.3);
eq(val(to,'housing_count','Bâtiment NORD'),14); eq(val(to,'shab','Bâtiment CENTRAL'),2521.3); eq(val(to,'dh','Bâtiment NORD'),415.3); eq(val(to,'dh_max','Bâtiment NORD'),1250);
eq(val(to,'ventilation','Bâtiment CENTRAL'),'VMC Hygro B');
ok(!to.some(o=>o.field==='heating_mode_after'&&o.confidence>=0.9),'articles de l’arrêté jamais retenus comme description du projet');

// --- 4. Notice label biosourcé ----------------------------------------------------------------------------------------------
const bio=prep(mkDoc('bio','Notice biosource fictive.pdf',[mkPage(1,rows(['ID FDES 32398 41787 41787','Batiment nordID FDES 32398 41787 41787 41787 30446 41806','Masse matiere biosourcee projet','Estimation quantite de matieres biosourcees pour Label Batiment Biosource Conditions particulieres :- atteindre 35 kg de matiere biosourcee/m² de SDP equivalent au niveau 3 du label 2012']))]));
eq(bio.buildings.names,['Bâtiment unique'],'pas de faux bâtiment « NORDID FDES … »');
const bo=parseDocument(bio);
eq(val(bo,'mention_biosourced_building'),'Oui'); eq(val(bo,'biosourced_2013'),'Niveau 3'); eq(bo.length,2,'rien d’autre n’est extrait des tableaux FDES');
console.log(`v2.3.6 — ${n} vérifications OK (documents fictifs)`);
