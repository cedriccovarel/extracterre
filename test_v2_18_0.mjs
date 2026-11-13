// ExtracTerre v2.18.0 — « Plan » choisi à la main dans la liste des pièces (non analysé, ouvert dans Ashton) ; outils Ashton
// dédiés aux lignes de la recherche Sécurité, réponse Oui / Non reprise par la recherche. Données FICTIVES.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION} from './js/config.js';
import {DOCUMENT_FAMILIES,normalizeFamilyKey} from './js/parsers.js';
import {DOC_TYPES} from './js/config.js';
import {SECURITY_GRID,runSearchGrid,searchCellValue,ASHTON_CHECKS,hasAshtonCheck} from './js/recherches.js';
import {CHECKS,evaluateCheck} from './ashton/measure.js';
import {textDoc} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.32.2','version');

// 1. Famille « Plan »
eq(normalizeFamilyKey('plan'),'plan','famille plan reconnue');
eq(DOCUMENT_FAMILIES.plan.type,DOC_TYPES.PLAN,'famille plan → type Plan architectural');
const app=fs.readFileSync('js/app.js','utf8'), readers=fs.readFileSync('js/readers.js','utf8');
eq(/\['plan','📐 Plan — non analysé, ouvert dans Ashton'\]/.test(app),true,'option « Plan » dans le menu des pièces');
eq(app.includes("forcePlan:d.familyMode==='manual'&&(d.families||[]).includes('plan')"),true,'lecture : plan forcé quand « Plan » est choisi');
eq(readers.includes("(opts.forcePlan?'choisi manuellement':null)"),true,'plan forcé quel que soit le format');
eq(app.includes("FAMILY_CHOICES.filter(([v])=>v!=='plan')"),true,'« Plan » proposé seulement pour un PDF');

// 2. Lignes vérifiables dans Ashton : les 7 demandées, mêmes identifiants des deux côtés
const ids=['abords_observables','abords_separation','abords_renfoncement','abords_cheminement','abords_aveugles','hall_traversant','hall_vitrage'];
eq(Object.keys(ASHTON_CHECKS).sort(),[...ids].sort(),'7 critères avec bouton Ashton');
eq(Object.keys(CHECKS).sort(),[...ids].sort(),'7 outils dédiés dans Ashton');
eq(ids.every(id=>SECURITY_GRID.criteria.some(c=>c.id===id)),true,'chaque critère existe dans la grille Sécurité');
eq(hasAshtonCheck('fen_442'),false,'pas de bouton Ashton sur les autres lignes');

// 3. Verdicts proposés par les outils
const k=()=>0.01, cnt=(cat,c=1,page=1)=>({type:'count',cat,page,pts:Array.from({length:c},()=>({x:0,y:0}))}), len=(cat,pt,page=1)=>({type:'len',cat,page,pts:[{x:0,y:0},{x:pt,y:0}]});
eq(evaluateCheck('abords_observables',[cnt('Accès observable',3),cnt('Accès non observable',2)],k).proposal,'Oui','3 / 5 = 60 % → conforme');
eq(evaluateCheck('abords_observables',[cnt('Accès observable',1),cnt('Accès non observable',2)],k).proposal,'Non','1 / 3 → non conforme');
eq(evaluateCheck('abords_observables',[],k).proposal,'','rien compté → à trancher');
eq(evaluateCheck('abords_separation',[cnt('Communication entre bâtiments')],k).proposal,'Non','une communication → non conforme');
eq(evaluateCheck('abords_aveugles',[cnt('Local aveugle surveillé',2)],k).proposal,'Oui','locaux aveugles tous surveillés');
eq(evaluateCheck('abords_aveugles',[cnt('Local aveugle surveillé'),cnt('Local aveugle non surveillé')],k).proposal,'Non','un local non surveillé');
eq(evaluateCheck('abords_renfoncement',[len('Renfoncement',120),len('Renfoncement',80)],k).proposal,'Oui','1,20 m max → conforme');
eq(evaluateCheck('abords_renfoncement',[len('Renfoncement',121)],k).proposal,'Non','1,21 m → non conforme');
eq(evaluateCheck('abords_cheminement',[len('Cheminement',140),len('Cheminement',200)],k).proposal,'Oui','1,40 m min → conforme');
const unc=evaluateCheck('abords_cheminement',[len('Cheminement',100,2)],p=>p===1?0.01:null);
eq([unc.proposal,unc.uncalibrated],['',1],'page non étalonnée : mesure ignorée et signalée');
eq(evaluateCheck('hall_traversant',[cnt('Accès hall',1)],k).proposal,'Oui','un accès → non traversant');
eq(evaluateCheck('hall_traversant',[cnt('Accès hall',2)],k).proposal,'Non','deux accès → traversant');
const hall={type:'area',cat:'Hall',page:1,pts:[{x:0,y:0},{x:500,y:0},{x:500,y:400},{x:0,y:400}]};
eq(evaluateCheck('hall_vitrage',[hall,len('Menuiserie hall',300)],k).proposal,'Oui','3 m × 2,20 / 20 m² = 33 %');
eq(evaluateCheck('hall_vitrage',[hall,len('Menuiserie hall',200)],k).proposal,'Non','2 m × 2,20 / 20 m² = 22 %');

// 4. Réponse Ashton reprise par la recherche : décisive, sauf décision manuelle
const doc={...textDoc('d1','CCTP.pdf','CCTP','Cheminements piétons : largeur 1,20 m\nHall : ensemble vitré feuilleté 44.2'),status:'ready'};
const chk=(id,verdict,detail='mesure fictive')=>({[id]:{verdict,detail,docName:'Plan masse.pdf',page:1,sentAt:1}});
let r=runSearchGrid(SECURITY_GRID,[doc],{},{},chk('abords_cheminement','Oui'));
eq(r.criteria.abords_cheminement.found,true,'Ashton « conforme » l’emporte sur la largeur lue dans le CCTP');
eq(r.criteria.abords_cheminement.evidence[0].line.startsWith('Ashton (outil dédié) : conforme'),true,'citation Ashton en tête');
eq(searchCellValue(SECURITY_GRID.criteria.find(c=>c.id==='abords_cheminement'),r.criteria.abords_cheminement),'Oui (Ashton : mesure fictive)','valeur du tableau');
r=runSearchGrid(SECURITY_GRID,[doc],{abords_cheminement:'Non'},{},chk('abords_cheminement','Oui'));
eq(r.criteria.abords_cheminement.found,false,'décision manuelle prioritaire');
r=runSearchGrid(SECURITY_GRID,[doc],{},{},chk('abords_separation','Non'));
eq([r.criteria.abords_separation.found,r.criteria.abords_separation.contrary],[false,true],'Ashton « non conforme » = indice contraire');
r=runSearchGrid(SECURITY_GRID,[doc],{},{},chk('hall_vitrage','Oui'));
eq(r.criteria.hall_vitrage.found,true,'hall vitré : Ashton conforme + 44.2 trouvé');
r=runSearchGrid(SECURITY_GRID,[{...textDoc('d2','CCTP.pdf','CCTP','Hall : ensemble vitré'),status:'ready'}],{},{},chk('hall_vitrage','Oui'));
eq([r.criteria.hall_vitrage.found,/44.2 non trouvé/.test(r.criteria.hall_vitrage.detail)],[false,true],'hall vitré sans 44.2 : à vérifier');
r=runSearchGrid(SECURITY_GRID,[doc],{},{},{fen_442:{verdict:'Non'}});
eq(r.criteria.fen_442.found,true,'réponse Ashton ignorée hors des 7 critères');
// 5. Sécurité du message : seul le critère ouvert depuis la ligne est accepté, réponse sauvegardée avec le projet
eq(app.includes("m.type==='ashton:check'&&p&&mt.check&&m.criterion===mt.check.id"),true,'réponse acceptée seulement pour le critère ouvert');
eq(fs.readFileSync('js/persistence.js','utf8').includes('planChecks:safeJsonClone(project.planChecks,{})'),true,'réponses Ashton sauvegardées');
const ash=fs.readFileSync('ashton/app.js','utf8');
eq(ash.includes("key:`ashton:${CHECK?`check:${CHECK_ID}:`:''}${file.name}:${file.size}`"),true,'mesures de l’outil dédié gardées à part');
eq(/body\.check-mode \.rail \.tool\[data-tool\]:not\(\[data-tool=pan\]\)/.test(fs.readFileSync('ashton/styles.css','utf8')),true,'outil dédié : les autres outils sont masqués');
console.log(`v2.31.0 : ${n}/${n} OK`);
