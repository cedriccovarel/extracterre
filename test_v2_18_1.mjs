// ExtracTerre v2.18.1 — fiche Évaluation Salesforce : en-têtes « * BAT 8 : (= bat E Rset) : x11 lgts collectifs : social LLS »,
// « SRT / SHAB : 913 / 728 », lignes d'enveloppe propres à certains bâtiments (« MUR / EXT bat 9 : … »). Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {salesforceEvaluationToPaste,parseFreePaste,looksLikeSalesforceEvaluation} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.20.2','version');

const FICHE=`OPE-009001
Résidence Fictive des Essais
4 allée du Test
59000 VILLE-FICTIVE
Performance thermique
* BAT 1 : (= bat E Rset) : x10 lgts collectifs : : social LLS :
Bbio : 50 / 70 / -28,6 %
Cep : 52 / 70 / -25,7 %
Tic : 26,5 / 30, °C
SRT / SHAB : 900 / 720 m2 (x1,25)
Q4 : 0,8

* BAT 2 : (= bat F) : x15 lgts collectifs : social LLS
Bbio : 46 / 70 / -34,3 %
Cep : 55 / 70 / -21,4 %
Tic : 27 / 31
SRT / SHAB : 1150 / 900 (x1,28)
Q4 : 1

* BAT 10 : (= bat G) : x20 lgts collectifs : social LLS
Bbio : 60 / 72 / -16,7 %
Cep : 56 / 70 / -20 %
Tic : 26 / 31
SRT / SHAB : 1300 / 1000 (x1,3)
Q4 : 1
Performance thermique - Notes
* Q4 bat 1 = 0,8 > ES
Planchers hauts
* TERRASSE INACC bat 2 10 : Efigreen Duo + 12 cm R=5,45 §2411 p8 CCTP Etanchéité

* TERRASSE ACC bat 1 : Efigreen Duo+ 12 cm R=5,45 §2411 p8 CCTP Etanchéité

* COMBLES : Comblissimo 300 mm R=7 §24211 p15 CCTP Doublage
Planchers hauts - Notes
ok
Parois verticales
* MUR / EXT suivants BET structure bat 1 2 10 : Beton
+ Doublage PREGYMAX 120+13 mm R=3,75 §2122 p7 CCTP Doublage

* MUR / EXT bat 2 : Brique Porotherm GF R20 R=1,01 §213 p37 CCTP GO
+ Doublage PREGYMAX 100+13 mm R=3,15 §2123 p8 CCTP Doublage
Parois verticales - Notes
ok
Planchers bas
* PB / EXT et LNC (débords bat 10) : ROCKFEU 14 cm R=3,95 §241 p9 CCTP Revêtement façade
Planchers bas - Notes
ok
Chauffage
* Chaudières gaz indiv
Chauffage - Notes
ok`;

eq(looksLikeSalesforceEvaluation(FICHE),true,'fiche reconnue');
const conv=salesforceEvaluationToPaste(FICHE);
const blocks=conv.text.split(/\n\n/).map(b=>b.split('\n')), common=blocks[0], by=name=>blocks.find(b=>b[0]===`${name} :`)||[];
const has=(lines,l)=>lines.includes(l);
// Trois blocs, en-tête « BAT n : » suivi de remarques.
eq(blocks.slice(1).map(b=>b[0]),['BAT 1 :','BAT 2 :','BAT 10 :'],'trois bâtiments');
eq(has(by('BAT 1'),'Nombre de logements = 10')&&has(by('BAT 2'),'Nombre de logements = 15')&&has(by('BAT 10'),'Nombre de logements = 20'),true,'logements « x10 lgts »');
// « SRT / SHAB » : la SHAB.
eq([by('BAT 1'),by('BAT 2'),by('BAT 10')].map(b=>b.find(l=>/^Surface bâtiment/.test(l))),['Surface bâtiment (SHAB / Sref / SU / SURT / SRT) = 720','Surface bâtiment (SHAB / Sref / SU / SURT / SRT) = 900','Surface bâtiment (SHAB / Sref / SU / SURT / SRT) = 1000'],'SHAB retenue');
// Valeur / max / gain de chaque bloc (gain positif sous le max), plus de mélange entre BAT 2 et l'opération.
eq(['Bbio = 50','Bbio Max = 70','Gain Bbio = 28,6','Cep = 52','Tic = 26,5','Tic ref = 30','Q4Pa-surf (m³/h.m²) = 0,8'].every(l=>has(by('BAT 1'),l)),true,'BAT 1 complet');
eq(['Bbio = 60','Bbio Max = 72','Cep = 56','Tic ref = 31'].every(l=>has(by('BAT 10'),l)),true,'BAT 10 complet');
eq(common.some(l=>/^(?:Bbio|Cep|Tic)\b/.test(l)),false,'aucune valeur de bloc remontée dans l\'opération');
// Logements collectifs de l'opération : somme des blocs « collectifs », relue par le collage.
eq(has(common,'Nombre logements collectifs = 45')&&has(common,'Nombre bâtiments collectifs = 3'),true,'logements collectifs');
// Enveloppe : « bat 2 10 », « bat 1 » → blocs nommés ; « bat 1 2 10 » → tous les blocs et l'opération ; « + Doublage » suit sa ligne.
eq(['Planchers hauts isolant = PUR','Planchers hauts épaisseur isolant = 120','Planchers hauts R isolant = 5,45'].every(l=>[1,2,10].every(k=>has(by('BAT '+k),l))),true,'terrasses par bâtiment');
eq(has(common,'Planchers hauts isolant = Laine de verre')&&has(common,'Planchers hauts épaisseur isolant = 300')&&has(common,'Planchers hauts R isolant = 7'),true,'combles (Comblissimo = laine de verre) pour l\'opération');
eq(has(common,'Parois verticales structure = Béton armé')&&[1,2,10].every(k=>has(by('BAT '+k),'Parois verticales structure = Béton armé')),true,'« MUR … : Beton » = béton armé, tous les bâtiments');
eq(has(common,'Parois verticales épaisseur isolant = 120')&&has(by('BAT 2'),'Parois verticales épaisseur isolant = 120'),true,'doublage de la ligne « bat 1 2 10 » (ligne « + »)');
eq(by('BAT 1').some(l=>/Brique/.test(l))||common.some(l=>/Brique/.test(l)),false,'brique du bat 2 jamais appliquée aux autres');
// « bat 10 » ne désigne pas « BAT 1 » ; parenthèses ignorées (« débords bat 10 »).
eq(by('BAT 1').some(l=>/^Planchers bas/.test(l)),false,'« bat 10 » ≠ BAT 1');
eq(conv.notes.filter(x=>/remarque de la fiche/.test(x)).length,3,'remarques des en-têtes gardées');
// Le collage libre relit tout : trois bâtiments + l'opération, aucune ligne non reconnue.
const fp=parseFreePaste(FICHE);
eq(fp.buildings.map(b=>b.name).filter(Boolean),['Bâtiment 1','Bâtiment 2','Bâtiment 10'],'bâtiments du collage');
eq(fp.unmatched.length,0,'tout est reconnu');
// Une ligne « Bât A : Bbio = 50 » reste une valeur, pas un en-tête de remarques.
{ const t=salesforceEvaluationToPaste(`OPE-009002\nFictif\n59000 VILLE\nPerformance thermique\nBât A / 12 logts\nBbio = 40\nBât B : Bbio = 41\nPlanchers hauts\nok`).text;
  eq(/Bât B :\nBbio = 41/.test(t)&&!/remarque/.test(t),true,'« Bât B : Bbio = 41 » : bloc avec sa valeur, pas un en-tête de remarques'); }
console.log(`test_v2_18_1 : ${n}/${n} OK`);
