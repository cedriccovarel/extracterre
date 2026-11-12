// ExtracTerre v2.23.0 — recherches : critère « Rappel de colonne » (valeur retenue par bâtiment + source). FICTIF.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {normalizeGrid,runSearchGrid,searchCellValue,SEARCH_KINDS} from './js/recherches.js';
import {parseDocument} from './js/parsers.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.31.2','version');
eq(SEARCH_KINDS.field,'Rappel de colonne','nouveau type');
const grid=normalizeGrid({id:'t',name:'Test',themes:[{name:'Confort',min:1}],criteria:[
  {id:'dh_zt',theme:'Confort',label:'DH ZT',kind:'field',field:'dh_zt',unit:'°C.h',max:1250},
  {id:'struct',theme:'Confort',label:'Structure',kind:'field',field:'structure'},
  {id:'vide',theme:'Confort',label:'Brasseurs',kind:'field',field:'fan_count'},
  {id:'bad',theme:'Confort',label:'Injection',kind:'field',field:'dh_zt"><script>'},
  {id:'mot',theme:'Confort',label:'Mot-clé',kind:'presence',keywords:['brasseur']}]});
eq(grid.criteria[3].field,'dh_ztscript','nom de colonne nettoyé');
const result={rows:[{building:'Bâtiment A',dh_zt:345.25,structure:'Maçonnerie'},{building:'Bâtiment B',dh_zt:1400}],
  finals:[{building:'Bâtiment A',field:'dh_zt',value:345.25,fileName:'RSET FICTIF.pdf',docId:'d1',page:12,excerpt:'Logements traversants Oui 345,25'},
          {building:'Bâtiment unique',field:'structure',value:'Maçonnerie',fileName:'Notice FICTIVE.pdf',docId:'d2',page:3,excerpt:'Structure principale Maçonnerie'}]};
const doc={id:'d9',name:'CCTP FICTIF.pdf',status:'ready',read:{pages:[{page:1,text:'Fourniture de brasseurs plafonniers'}]}};
const r=runSearchGrid(grid,[doc],{},{},{},result);
const dh=r.criteria.dh_zt;
eq(dh.evidence.length,2,'une ligne par bâtiment renseigné');
eq([dh.evidence[0].doc,dh.evidence[0].page,dh.evidence[0].context],['RSET FICTIF.pdf',12,'Logements traversants Oui 345,25'],'source citée (document, page, extrait)');
eq(dh.evidence[1].doc,'Valeur retenue (sans document)','valeur sans occurrence : signalée');
eq([dh.evidence[0].ok,dh.evidence[1].ok],[true,false],'borne max : 1 400 hors seuil');
eq(dh.found,true,'trouvé si au moins un bâtiment dans la borne');
eq(searchCellValue(grid.criteria[0],dh),'Bâtiment A : 345,25 °C.h ; Bâtiment B : 1 400 °C.h'.replace(/ (?=400)/,' '),'cellule : valeurs par bâtiment');
const st=r.criteria.struct; eq(st.evidence.length,1,'bâtiment sans valeur ignoré'); eq(st.evidence[0].doc,'Notice FICTIVE.pdf','source « Bâtiment unique » reprise');
eq(searchCellValue(grid.criteria[1],st),'Bâtiment A : Maçonnerie','texte rappelé');
eq([r.criteria.vide.found,r.criteria.vide.evidence.length,searchCellValue(grid.criteria[2],r.criteria.vide)],[false,0,''],'colonne vide : rien inventé');
eq(r.criteria.mot.found,true,'les critères texte fonctionnent toujours');
eq(r.fieldHits,3,'compte des rappels');
const single=runSearchGrid(grid,[],{},{},{},{rows:[{building:'Bâtiment unique',structure:'Ossature bois'}],finals:[]});
eq(searchCellValue(grid.criteria[1],single.criteria.struct),'Ossature bois','bâtiment unique : valeur seule');
eq([single.documents.length,single.fieldHits],[0,1],'sans document : le rappel fonctionne');
const none=runSearchGrid(grid,[doc],{},{},{});
eq(none.criteria.dh_zt.evidence.length,0,'sans résultat de projet : aucun rappel');
const manual=runSearchGrid(grid,[doc],{dh_zt:'Non'},{},{},result); eq(searchCellValue(grid.criteria[0],manual.criteria.dh_zt),'Non','décision manuelle prioritaire');
// Lecteurs Refroidissement et Structure : bruit écarté, vraies descriptions gardées (documents FICTIFS).
const mk=(type,name,lines)=>({id:name,name,type,status:'ready',read:{pages:[{page:1,text:lines.join('\n'),lines:lines.map(text=>({text}))}]}});
const vals=(doc,field)=>(parseDocument(doc)||[]).filter(o=>o.field===field).map(o=>o.value);
const one=(type,line,field)=>vals(mk(type,'FICTIF.pdf',[line]),field);
for(const [line,exp,m] of [
  ["l'on retire le systeme de climatisation. Le DH max est de 1250 °C.h pour les groupes",[],'définition du DH'],
  ['Climatisation Non',['Aucun'],'« Climatisation Non » = Aucun (avant : Climatisation active)'],
  ['Besoins de climatisation 0,0 kWh/m²',[],'indicateur de besoins'],
  ['CCTP FICTIF – Lot : Chauffage – ventilation – climatisation Page 3 sur 40',[],'intitulé de lot'],
  ['Programmation de la relance en climatisation',[],'texte de régulation générique'],
  ['Groupe CE1 non climatisé - BR1 - Convecteur électrique',[],'un chauffage n’est pas un refroidissement'],
  ['Composant PCE | Opération FICTIVE - contributors.components - Poêle à granulés climatisation',[],'composant ACV'],
  ['Climatisation Oui',['Climatisation active'],'« Climatisation Oui » gardé'],
  ['Generateurs thermodynamiques electriques : PAC reversible a compression (chauffage et refroidissement)',['PAC réversible'],'PAC réversible gardée']]) eq(one('RSET RE2020',line,'cooling'),exp,m);
const menu=mk('CCTP','Lot 07 Menuiseries FICTIF.pdf',['La fourniture et la pose des joints d’étanchéité et de calfeutrement des menuiseries de façade, en liaison avec les Gros-','Œuvre et ossature bois du bâtiment']);
eq(vals(menu,'structure'),[],'joints de menuiserie « en liaison avec … ossature bois » : pas une structure');
eq(one('CCTP','Semelle isolée de fondation en béton armé sous mur de façade','structure'),[],'fondations écartées');
eq(one('DPE','Murs en béton banché isolation par l’intérieur','structure').length>0,true,'vraie description de mur gardée');
console.log(`test_v2_23_0 : ${n} vérifications OK`);
