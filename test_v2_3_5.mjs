// ExtracTerre v2.3.5 — nouveaux formats (documents FICTIFS reproduisant leur structure) :
// sortie Pléiades « partie thermique », fiche RSET / RSEE CSTB (thermique + environnement, y compris OCR),
// STD confort d'été, couche texte brouillée, nouvelles colonnes IC et colonne « Tags » de l'export.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,FIELD_DEFS,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {isGarbledTextLayer,pdfTextQuality,shouldOcrPdfPage} from './js/readers.js';
import {mkPage,mkDoc} from './test_fixtures_v2_3_3.mjs';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.12','version');
const rows=(arr,y0=800)=>arr.map((t,i)=>[t,y0-i*10]);
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:'pdf'}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.familyMode='auto'; d.buildings=detectBuildings(d); return d; };
const val=(out,f,b)=>out.find(o=>o.field===f&&(!b||o.building===b))?.value;

// --- 1. Schéma : 5 colonnes IC ajoutées à la fin, dans l'ordre demandé ------------------------------
eq(FIELD_DEFS.length,185,'185 champs');
eq(FIELD_DEFS.slice(168,173).map(f=>f.key),['ic_construction','ic_construction_max','ic_construction_max_2028','ic_energy_max','ic_energy_max_2028'],'nouvelles colonnes en fin de schéma');
ok(DEFAULT_SOURCE_RULES.ic_energy_max.main.includes('RSET RE2020'),'Ic énergie max publié aussi par les RSET');

// --- 2. Sortie Pléiades (partie thermique), deux bâtiments --------------------------------------------
const sec=(k,name,o)=>[`1.${k} ${name}`,'Exigence de resultat : Bbio',`Besoins Bioclimatique ${o.bbio} points ${o.bbioMax} points`,'Exigence de resultat : Cep',
  'Consommations de climatisation 1,5 kWh EP/m²',"Consommations d'eclairage 5 kWh EP/m²",'Consommations des auxiliaires de ventilation 4 kWh EP/m²','Consommations des auxiliaires hydrauliques 0,5 kWh EP/m²','Consommations de mobilite interne 3 kWh EP/m²',
  `Consommation energie Primaire ${o.cep} kWh EP/m² ${o.cepMax} kWh EP/m²`,'Exigence de resultat : Cep nr','Consommations de climatisation 1,5 kWh EP/m²',
  `Consommation energie Primaire non renouvelable ${o.cepnr} kWh EP/m² ${o.cepnrMax} kWh EP/m²`,'Exigence de resultat : Ic Energie','IC chauffage 30.5 kg eq. CO2','IC ECS 20 kg eq. CO2',
  `Indice Carbone Energie ${o.ic} kg eq. CO2 ${o.icMax} kg eq. CO2`,'Exigence de resultat : Degres-Heures','Projet Reference',`Groupe A ${o.dhA} °C.h 1250 °C.h`,`Groupe B ${o.dhB} °C.h 1150 °C.h`,'Exigences de moyens','19 a texte Conforme'];
const sortie=prep(mkDoc('pl','Sortie logiciel fictive.pdf',[
  mkPage(1,rows(['Residence Fictive','Pleiades, version 6.25.0'])),
  mkPage(2,rows(['Operation','Departement : 69 - Rhone (H1 c)','Pleiades, version 6.25.0'])),
  mkPage(3,rows(['1 Resultats RE2020 Energie',...sec(1,'Batiment Est',{bbio:'50,1',bbioMax:'70',cep:'60,2',cepMax:'80',cepnr:'40,5',cepnrMax:'65,1',ic:'90.5',icMax:'500.2',dhA:'300,5',dhB:'800'}),'Pleiades, version 6.25.0'])),
  mkPage(4,rows([...sec(2,'Batiment Ouest',{bbio:'61',bbioMax:'72,4',cep:'70',cepMax:'85',cepnr:'45',cepnrMax:'66',ic:'95',icMax:'480',dhA:'700,2',dhB:'100'}),'2 Synthese de l\'enveloppe du batiment'])),
  mkPage(5,rows(['5 Caracteristiques du projet','5.1 Environnement','5.2 Batiment Est','SRT declaree 1200.50 m²','Nombre de logement 18','Climatisation Non','5.3 Batiment Ouest','SRT declaree 800.00 m²','Nombre de logement 10','Climatisation Non','Climatisation Oui']))
]));
eq(sortie.buildings.names,['Bâtiment EST','Bâtiment OUEST'],'bâtiments = titres 1.N');
const so=parseDocument(sortie);
eq(val(so,'bbio','Bâtiment EST'),50.1); eq(val(so,'bbio_max','Bâtiment EST'),70);
eq(val(so,'cep','Bâtiment EST'),60.2); eq(val(so,'cepnr','Bâtiment EST'),40.5,'Cep,nr ≠ Cep'); eq(val(so,'cepnr_max','Bâtiment EST'),65.1);
eq(val(so,'ic_energy','Bâtiment EST'),90.5); eq(val(so,'ic_energy_max','Bâtiment EST'),500.2,'Ic énergie max');
eq(val(so,'ic_energy_heating','Bâtiment EST'),30.5); eq(val(so,'cep_lighting','Bâtiment EST'),5);
eq(val(so,'dh','Bâtiment EST'),800,'DH du groupe le plus défavorable'); eq(val(so,'dh_max','Bâtiment EST'),1150,'DH max du même groupe');
eq(val(so,'dh','Bâtiment OUEST'),700.2); eq(val(so,'dh_max','Bâtiment OUEST'),1250);
eq(val(so,'shab','Bâtiment OUEST'),800); eq(val(so,'housing_count','Bâtiment EST'),18);
eq(val(so,'cooling','Bâtiment EST'),'Aucun'); eq(val(so,'cooling','Bâtiment OUEST'),'Climatisation active');
eq(val(so,'department'),'69');

// --- 3. Fiche RSET CSTB (partie thermique) ------------------------------------------------------------
const cstbHead=['REGLEMENTATION ENVIRONNEMENTALE 2020','Recapitulatif Standardise Energie Environnement','Partie « Etude Thermique »'];
const bat=(name,o)=>[`Batiment : ${name}`,`SRef/ usage principal ${o.sref} m2/ Logement collectif`,`Nombre de logements ${o.lgt}`,'Donnees techniques du batiment',`"${name}"`,
  `Coef\u0000cient Bbio ${o.bbio} ${o.bbioMax} 20,1`,`Coef cients Cep / Cepmax- Cep,nr / Cep,nrmax ${o.cep} ${o.cepMax} ${o.cepnr} ${o.cepnrMax} 5,2 40,3`,
  'Zone(s) non traversante(s)',`Non 300,5 ${o.dh1} 120 80 50 Conforme`,`Partie Haute Non 200,1 ${o.dh2} 242 178 134 Conforme`,
  "Le DH max est de 1250 °C.h pour les groupes Categorie de contrainte exterieur 1 et 1850",'Exigences de moyens et caracteristiques thermiques','Chapitres et articles Respect des caracteristiques',
  'Les planchers chauffants doivent respecter la puissance maximale Conforme'];
const rset=prep(mkDoc('cs','RSET fictif.pdf',[mkPage(1,rows([...cstbHead,'Chapitre 1'])),mkPage(2,rows(bat('Batiment A',{sref:'1 250,5',lgt:12,bbio:'55,2',bbioMax:'70,1',cep:'80,1',cepMax:'90',cepnr:'20,2',cepnrMax:'70',dh1:'400,2',dh2:'631'}))),
  mkPage(3,rows(bat('Batiment B',{sref:'300',lgt:4,bbio:'60',bbioMax:'72',cep:'82',cepMax:'95',cepnr:'25',cepnrMax:'75',dh1:'520',dh2:'210'})))]));
eq(rset.buildings.names,['Bâtiment A','Bâtiment B'],'pas de faux bâtiment issu des lignes de tableau');
const ro=parseDocument(rset);
eq(val(ro,'bbio','Bâtiment A'),55.2,'« Coef\\0cient » (ligature) reconnu'); eq(val(ro,'bbio_max','Bâtiment A'),70.1);
eq(val(ro,'cep','Bâtiment A'),80.1); eq(val(ro,'cepnr','Bâtiment A'),20.2,'Cep,nr lu dans sa colonne'); eq(val(ro,'cepnr_max','Bâtiment A'),70);
eq(val(ro,'shab','Bâtiment A'),1250.5,'SRef avec séparateur de milliers'); eq(val(ro,'housing_count','Bâtiment B'),4);
eq(val(ro,'dh','Bâtiment A'),631,'« 631 242 178 » = trois nombres'); eq(val(ro,'dh','Bâtiment B'),520);
ok(ro.find(o=>o.field==='dh_max').confidence>=0.9,'v2.3.11 : DH max catégorie 1 (1250) retenu pour un bâtiment d’habitation');
ok(!ro.some(o=>o.field==='heating_mode_after'&&/plancher/i.test(o.value)),'texte des exigences de moyens ignoré');

// --- 4. Fiche RSEE CSTB (partie environnementale) issue d'un OCR -----------------------------------------
const envPage=(p,txt)=>{ const pg=mkPage(p,rows(txt)); pg.textSource='ocr'; return pg; };
const rsee=prep(mkDoc('env','RSEE fictif.pdf',[envPage(1,['RÉGLEMENTATION ENVIRONNEMENTALE 2020','Récapitulatif Standardisé Energie Environnement','Partie « Etude Environnementale »']),
  envPage(2,['Nom du bâtiment Bâtiment 1','Surface de Référence [m?] 1 200,50']),
  envPage(3,["Chapitre 5 : Sorties de l'analyse de cycle de vie environnementale (ACV),",'niveau bâtiment',"Indicateurs principaux, à l'échelle du bâtiment 1",'Indicateur de stockage Carbone [kec] 55,5',
    "Indicateur d'impact sur le changement climatique (contribution construction) - 2 max",'Ic_construction [kgeq. CO2/m°] 700,10 950,00',
    "Indicateur d'impact sur le changement climatique (contribution énergie) - /c_energie [kgéq. CO2/m?] 150,20 27,60",
    'Composant - /c_composant [kGég. CO2/m°] 690,00','Chantier - /c_chantier [kGéc. CO2/m°] 10,10',
    "Indicateur d'impact sur le changement climatique par occupant sur toute la zone [kGeg. CO2/occ] 8042,89"]),
  envPage(4,["Chapitre 6 : niveau zones de bâtiment","Indicateurs principaux, à l'échelle de la zone : Zone 1",'Composant - /c_composant [kGég. CO2/m°] 400,00'])]));
const eo=parseDocument(rsee); const g=f=>eo.find(o=>o.field===f);
eq(g('ic_construction')?.value,700.1,'Ic construction (valeur sur la ligne suivant le libellé)'); eq(g('ic_construction_max')?.value,950);
ok(g('ic_construction').confidence>=0.97,'cohérence Ic construction = composant + chantier');
eq(g('ic_energy')?.value,150.2); ok(g('ic_energy').confidence<0.9,'max OCR incohérent (27,60 < 150,20) → à vérifier');
eq(g('ic_components')?.value,690,'valeur bâtiment, pas celle de la zone'); eq(eo.filter(o=>o.field==='ic_components').length,1);
eq(g('ic_site')?.value,10.1); eq(g('stock_c_per_m2')?.value,55.5);

// --- 5. Couche texte brouillée (polices sans table Unicode) → OCR -----------------------------------------
const garbled="%&'()*+,+-(./*+-01)'200*3*0(&4*+5 6789:;<=>?@\"#A :BCD:ED8F;GBDCB>?HIJIKJHKHL ".repeat(8)+" DEFGHIJ KLMNOP QRSTU VWXYZ abcdef ghijk lmnop ".repeat(6);
ok(isGarbledTextLayer(garbled),'texte brouillé détecté'); ok(pdfTextQuality(garbled).garbled,'qualité = brouillée');
ok(shouldOcrPdfPage(garbled,new Array(200).fill({str:'x'}),'auto'),'OCR déclenché');
const clean=fs.readFileSync('./CHANGELOG.md','utf8').slice(0,3000);
ok(!isGarbledTextLayer(clean),'texte français normal non signalé');

// --- 6. STD : variantes de rafraîchissement jamais reprises -----------------------------------------------
const std=prep(mkDoc('std','STD fictive.pdf',[mkPage(1,rows(['Rapport de Simulation thermique dynamique (STD)','Etude du confort d\'ete','Les triples vitrages ont pour caracteristique leur faible captation solaire.',
  "systemes passifs, il n'est pas envisage de rafraichir les espaces avec des systemes de rafraichissement actifs.",'La CTA permet la ventilation nocturne.'])),
  mkPage(2,rows(['4.3 VARIANTES ETUDIEES','4.3.1 V0 : VARIANTE DE BASE','Protection solaire par brise soleil orientable au niveau du N0','4.3.4 V3 : VARIANTE AVEC RAFRAICHISSEMENT ADIABATIQUE','Climatisation par detente directe']))]));
const st=parseDocument(std);
eq(val(st,'cooling'),'Aucun','pas de climatisation issue d’une variante'); eq(val(st,'window_shading'),'BSO'); eq(val(st,'window_glazing'),'Triple vitrage');
ok(st.every(o=>o.field!=='cooling'||o.value==='Aucun'),'aucune « Climatisation active »');

// --- 7. Export : colonne « Tags » après les 185 colonnes ----------------------------------------------------
const sheets={}; globalThis.XLSX={utils:{book_new:()=>({}),aoa_to_sheet:aoa=>({aoa,'!ref':'A1:A1'}),book_append_sheet:(wb,ws,name)=>{ sheets[name]=ws.aoa; },decode_range:()=>({s:{c:0,r:0},e:{c:0,r:0}}),encode_cell:()=>'A1'},writeFile:()=>{}};
const {exportProjectsExcel}=await import('./js/exporter.js');
const res=analyzeDocuments([sortie],DEFAULT_SOURCE_RULES,'Projet test');
exportProjectsExcel([{result:res,projectTags:[{label:'Géothermie'},{label:'BEPOS'}],operationName:'Projet test'}],DEFAULT_SOURCE_RULES);
const main=sheets['Données par bâtiment'];
eq(main[0].length,186,'185 colonnes + Tags'); eq(main[0].slice(168,173),['IC construction','IC construction Max','IC construction Max 2028','IC énergie Max','IC énergie Max 2028']); eq(main[0].slice(-2),['Eges total Max','Tags']);
eq(main[1].at(-1),'Géothermie ; BEPOS','tags du projet sur chaque ligne');
eq(main[1][main[0].indexOf('IC énergie Max')],500.2,'Ic énergie max exporté');
console.log(`v2.3.5 — ${n} vérifications OK (documents fictifs)`);
