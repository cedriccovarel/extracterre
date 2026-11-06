// ExtracTerre v2.20.6 — fichiers .csv ; export CSV d'étude carbone RE2020 par composant (Windows-1252, « ; »). Données FICTIVES.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {readCsv} from './js/readers.js';
import {classifyDocument} from './js/classifier.js';
import {parseDocument} from './js/parsers.js';
import {detectBuildings} from './js/buildings.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.20.6','version');
const H='Designation;Valx;DetailsGES;NumFiche;Quantite;Unite;dureeVie;TypeFiche;CO2Inies;StockC;Element;Commentaire';
const sec=(t,rows,tot)=>[`${t};;EGES;Num Fiche;Quantité;Unité;Durée de vie;Type de fiche;CO2 Inies;StockC;Element;Commentaire`,...rows,`;. Total  : ;${tot};;;;;;;;;`,';;;;;;;;;;;'];
const lots=Array.from({length:13},(_,i)=>sec(`${i+1}-Lot fictif ${i+1}`,[`${i+1}.1 Sous-lot;;;;;;;;;;;`,`Produit fictif ${i+1} - DONNEE ENVIRONNEMENTALE PAR DEFAUT;;${i===12?'0':(10+i)+',5'};1000${i};1,00;m²;50;3;12,3;0;Élément;`],i===12?'0,000':`${10+i},500`)).flat();
const total=Array.from({length:12},(_,i)=>10.5+i).reduce((a,b)=>a+b,0);
const csv=[H,'Composants;;;;;;;;;;;',';;;;;;;;;;;',...lots,`; Total contributeur : ;${String(total.toFixed(3)).replace('.',',')};;;;;;;;;`,';;;;;;;;;;;','Energie (CE);;;;;;;;;;;',';;;;;;;;;;;',
  ...sec('Chauffage',['1.1 Chauffage;;;;;;;;;;;','Électricité fictive;;20,000;1;1;kWh;50;4;0,1;0;;'],'20,000'),...sec('Ecs',['2.1 Ecs;;;;;;;;;;;'],'15,000'),...sec('Eclairage',['4.1 Eclairage;;;;;;;;;;;'],'4,000'),
  '; Total contributeur : ;39,000;;;;;;;;;',';;;;;;;;;;;','Eau (CRE);;;;;;;;;;;',...sec('Eau potable',['1.1 Eau;;;;;;;;;;;'],'9,000'),'; Total contributeur : ;9,000;;;;;;;;;',
  'Chantier (Cha);;;;;;;;;;;',...sec('Energie',['1.1 Electricité;;;;;;;;;;;'],'0,000'),'; Total contributeur : ;0,000;;;;;;;;;'].join('\r\n');
// Encodage Windows-1252 (accents sur un octet) + octets nuls parasites, comme les exports réels.
const bytes=Uint8Array.from([...csv].map(c=>{ const k=c.charCodeAt(0); return k<256?k:63; })); const withNul=new Uint8Array([...bytes.slice(0,200),0,...bytes.slice(200)]);
const read=await readCsv(new File([withNul],'BATIMENT Z.csv'));
eq(read.kind==='spreadsheet'&&read.csv,true,'lu comme un tableau');
eq(read.pages[0].lines[0].cells.slice(0,4),['Designation','Valx','DetailsGES','NumFiche'],'séparateur « ; »');
eq(read.pages[0].lines.some(l=>l.cells[0]==='Électricité fictive'),true,'accents Windows-1252 décodés');
const cls=classifyDocument('BATIMENT Z.csv',read.text,{kind:read.kind}); eq(cls.type,DOC_TYPES.CARBON,'type : étude carbone');
const doc={id:'z',name:'BATIMENT Z.csv',read,type:cls.type,status:'ready'}; doc.buildings=detectBuildings(doc); eq(doc.buildings.names,['Bâtiment Z'],'bâtiment du nom de fichier');
const o=parseDocument(doc), v=f=>o.find(x=>x.field===f)?.value;
eq(Array.from({length:13},(_,i)=>v(`ic_lot_${i+1}`)),[...Array.from({length:12},(_,i)=>10.5+i),0],'13 lots');
eq(v('ic_components'),Number(total.toFixed(3)),'Ic composants');
eq(o.find(x=>x.field==='ic_components').confidence,0.95,'Σ lots = total : fiable');
eq([v('ic_energy'),v('ic_energy_heating'),v('ic_energy_ecs'),v('ic_energy_cooling')],[39,20,15,undefined],'Ic énergie et postes écrits seulement');
eq(v('ic_site'),undefined,'chantier non renseigné (tout à 0) : rien');
eq(o.every(x=>x.building==='Bâtiment Z'&&x.unit==='kgCO2e/m²'),true,'bâtiment et unité');
eq(o.length,13+1+3,'pas de lecture générique des lignes de produits');
// Fichiers .csv acceptés partout.
const app=readFileSync('js/app.js','utf8'), html=readFileSync('index.html','utf8');
eq(/allowed=\/\\\.\(pdf\|xml\|xlsx\?\|xls\|csv\|json\)\$\/i/.test(app)&&(html.match(/accept="\.pdf,\.xml,\.xlsx,\.xls,\.csv,\.json,\.zip"/g)||[]).length,2,'dépôt et sélection de fichiers');
console.log(`test_v2_20_6 : ${n}/${n} OK`);
