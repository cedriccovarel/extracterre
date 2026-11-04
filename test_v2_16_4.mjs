// ExtracTerre v2.16.4 — CCTP reconnus à leur en-tête, lignes parasites des CCTP ignorées, délai d'inactivité. Données FICTIVES.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {parseDocument} from './js/parsers.js';
import {normalizeText} from './js/utils.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(v,m)=>{ assert.ok(v,m); n++; };
eq(APP_VERSION,'2.18.1','version');

// En-tête « CCTP 04 - Lot … » répété : CCTP, malgré « existant », « contrat », « DPE », « RE2020 » dans les clauses.
const page='CCTP 04 - Lot Etancheite VILLE FICTIVE - Résidence test\nRénovation thermique du bâtiment existant. Le contrat de l’entreprise. DPE après travaux. RE2020.\n';
eq(classifyDocument('04 - Etanchéité.pdf',[1,2,3,4].map(()=>page).join('')).type,DOC_TYPES.CCTP,'en-tête CCTP répété');
eq(classifyDocument('Lot 13.pdf','Cahier des Clauses Techniques Particulières\nLot 13 Chauffage\nbâtiment existant, contrat, DPE').type,DOC_TYPES.CCTP,'titre en page de garde');
eq(classifyDocument('Etude thermique.pdf','Etude thermique RE2020 Bbio = 55\nLe lot CCTP 04 précise\nCCTP lot 2\n').type,DOC_TYPES.THERMAL,'étude qui cite le CCTP : pas un CCTP');

// Lignes parasites d'un CCTP : sommaire, norme, installation de chantier, local annexe, clause conditionnelle.
const mk=(name,lines)=>{ const ls=lines.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12})); const pg={page:1,text:ls.map(l=>l.text).join('\n'),lines:ls}; return {id:'c',name,type:DOC_TYPES.CCTP,familyMode:'auto',read:{kind:'pdf',pages:[pg],pageCount:1,text:pg.text},buildings:{names:['Bâtiment unique']}}; };
const vals=(doc,f)=>parseDocument(doc).filter(o=>o?.field===f).map(o=>o.value);
eq(vals(mk('12 - Ventilation.pdf',['CCTP 12 - Lot Ventilation','Ventilation mecanique du local poubelles a l\'interieur de l\'immeuble.','Conduit de Ventilation naturelle des locaux velos.']),'ventilation'),[],'ventilation naturelle d’un local annexe');
eq(vals(mk('12 - Ventilation.pdf',['CCTP 12 - Lot Ventilation','Pour les installations solaires collectives de type CESC Chauffe-eau solaire collectif, l\'installateur']),'ecs'),[],'clause conditionnelle « Pour les installations… »');
eq(vals(mk('03 - Gros-Oeuvre.pdf',['CCTP 03 - Lot Gros-Oeuvre','Portillon d\'acces pieton avec ossature metallique avec bardage tole dito, 1,00 x 2,00 ht,']),'wall_structure'),[],'installation de chantier');
eq(vals(mk('07 - Cloisons.pdf',['CCTP 07 - Lot Cloisons','NF DTU 45.11 Isolation thermique de combles par soufflage d\'isolant en vrac (laines minerales ou','ouate de cellulose de papier)']),'roof_insulation'),[],'référence de norme (et sa ligne suivante)');
eq(parseDocument(mk('01 DCE - Démolition.pdf',['CCTP 01 Lot Demolition','Toiture : Tous les ouvrages de support, d\'isolation sous etancheite','Structure metallique des auvents a deposer'])).filter(o=>/structure|insulation|roof/.test(o?.field||'')).length,0,'lot Démolition : rien de l’ouvrage livré');
ok(vals(mk('12 - Ventilation.pdf',['CCTP 12 - Lot Ventilation','Les logements seront equipes d\'une VMC double flux avec recuperation de chaleur.']),'ventilation').includes('VMC double flux'),'clause réelle conservée');

// Délai d'inactivité : relancé à chaque avancée, suspendu pendant l'attente OCR.
const app=fs.readFileSync('./js/app.js','utf8');
ok(/armTimeout\(meta\?\.stage==='ocr-wait'\?0:/.test(app),'délai suspendu en file OCR et relancé à chaque avancée');
console.log(`v2.18.1 — ${n} vérifications OK (données fictives)`);
