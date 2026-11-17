// v2.39.1 — nettoyage des noms de bâtiments, recoupement par résultats (Tic / DH / Ic), bâtiments sans résultat écartés.
import assert from 'node:assert/strict';
import {repairBuildingName,detectBuildings} from './js/buildings.js';
import {buildingResultMerges,dropResultlessBuildings} from './js/engine.js';
const eq=(a,b,m)=>assert.deepStrictEqual(a,b,m);

// 1. Intitulés de RSET / RT lus comme des noms → faux bâtiment ('')
for(const n of ['Bâtiment A USAGE','Bâtiment REGLEMENTAIRE','Bâtiment ENTIEREMENT CHAUFFEE EXTERIEURE','Bâtiment SRTZ CONSOMMATIONS ET PRODUCTIONS ANNUELLES DU BATIMENT (PAR ZONES) PAR',
  'Bâtiment LIVRE SANS SYSTEME DE CHAUFFAGE','Bâtiment ZONES GROUPES','Bâtiment EN CAS DE MESURE GLOBALE','Bâtiment BATIMENT','Bâtiment 257 KW.','Bâtiment CONDITIONS DE BASE',
  'Bâtiment T1 T2 T3 T4 T5 TOTAL','Bâtiment (RESIDENCE','Bâtiment BKWH ENERGIE FINALE/M2 SREF']) eq(repairBuildingName(n),'',n);
// 2. Suffixes qui éclatent un même bâtiment
eq(repairBuildingName('Bâtiment Q CALICOTS - 08-02-2020'),'Bâtiment Q CALICOTS');
eq(repairBuildingName('Bâtiment Q CALICOTS - UBAT - 08-02-2020 - PAGE 116 / 135 -'),'Bâtiment Q CALICOTS');
eq(repairBuildingName('Bâtiment COLLECTIF - BATIMENT NEUF CONSOMMATIONS'),'Bâtiment COLLECTIF');
eq(repairBuildingName('Bâtiment B - RT2012'),'Bâtiment B');
eq(repairBuildingName('Bâtiment (BATIMENT AB'),'Bâtiment AB');
eq(repairBuildingName('Bâtiment CBATIMENT C'),'Bâtiment C');
eq(repairBuildingName('Bâtiment B...................................73'),'Bâtiment B');
eq(repairBuildingName('Bâtiment SUD REGLEMENTAIRE'),'Bâtiment SUD');
// 3. Vrais noms (Salesforce) intacts
for(const n of ['Bâtiment A','Bâtiment 1','Bâtiment COLLECTIF','Bâtiment SOCIAL','Bâtiment MAISONS 1 ET 3','Bâtiment M1 IDEM M2','Bâtiment MAISONS 1/2-5/6-16/17 (LE PLUS DEFAVORABLE)',
  'Bâtiment D (87 LOGEMENTS)','Bâtiment SUR RUE','Bâtiment G CAGE B (16 LGTS)','Bâtiment CATALPA']) eq(repairBuildingName(n),n,n);
// 4. Détection : un document dont le seul « bâtiment » est un intitulé redevient « Bâtiment unique »
{ const page={page:1,text:'Batiment a usage\nBatiment a usage',lines:[{index:0,text:'Batiment a usage'},{index:1,text:'Batiment a usage'}]};
  const r=detectBuildings({name:'rset.pdf',type:'RSET RE2020',read:{pages:[page],text:page.text}}); eq(r.names,['Bâtiment unique']); }

// 5. Recoupement : 2 résultats identiques (≠ 0) et aucun différent → un seul bâtiment ; un seul en commun → distincts
const F=(b,field,value)=>({building:b,field,value,status:'retenu'});
{ const c={finals:[F('Bâtiment 1','tic',27.4),F('Bâtiment 1','ic_construction',652.3),F('Bâtiment 1','bbio',40),F('Bâtiment A','tic',27.4),F('Bâtiment A','ic_construction',652.3),
    F('Bâtiment B','tic',27.4),F('Bâtiment B','ic_construction',610.1)]};
  eq(buildingResultMerges(c,{authoritative:['Bâtiment 1']}),{'Bâtiment A':'Bâtiment 1'}); }
{ const c={finals:[F('Bâtiment A','tic',27.4),F('Bâtiment A','dh',0),F('Bâtiment B','tic',27.4),F('Bâtiment B','dh',0)]};
  eq(buildingResultMerges(c,{}),{},'DH = 0 ne compte pas, un Tic seul ne suffit pas (jumeaux)'); }
{ const c={finals:[F('Bâtiment A','tic',27.4),F('Bâtiment A','ic_energy',150),F('Bâtiment B','tic',27.4),F('Bâtiment B','ic_energy',150)]};
  eq(buildingResultMerges(c,{},{'Bâtiment B':'Bâtiment B'}),null,'regroupement manuel : jamais touché'); }

// 6. Bâtiment sans aucun résultat écarté ; si aucun bâtiment n'a de résultat, rien n'est écarté
{ const c={rows:[{building:'Bâtiment A'},{building:'Bâtiment ZZ'}],buildings:['Bâtiment A','Bâtiment ZZ'],finals:[F('Bâtiment A','cep',60),F('Bâtiment ZZ','wall_insulation','Laine de verre')],detailed:[F('Bâtiment ZZ','wall_insulation','Laine de verre')]};
  eq(dropResultlessBuildings(c),['Bâtiment ZZ']); eq(c.rows.map(r=>r.building),['Bâtiment A']); eq(c.finals.length,1); eq(c.detailed[0].status,'rejeté'); }
{ const c={rows:[{building:'Bâtiment A'},{building:'Bâtiment B'}],finals:[F('Bâtiment A','wall_insulation','PSE')]}; eq(dropResultlessBuildings(c),[]); }
console.log('test_v2_39_1 OK');
