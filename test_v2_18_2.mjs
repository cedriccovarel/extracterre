// ExtracTerre v2.18.2 — « Vecteur ECS » : « solaire » qui ne désigne pas une installation (négation RSET / DPE, intitulé, critère,
// clause, norme) n'est plus lu comme vecteur ni comme mode solaire ; les vraies installations solaires restent lues. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {parseDocument} from './js/parsers.js';
import {normalizeText} from './js/utils.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.19.1','version');
const mk=(name,type,lines)=>{ const ls=lines.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12})); const pg={page:1,text:ls.map(l=>l.text).join('\n'),lines:ls};
  return {id:'d',name,type,familyMode:'auto',read:{kind:'pdf',pages:[pg],text:pg.text},buildings:{names:['Bâtiment unique']}}; };
const vals=(doc,f)=>[...new Set(parseDocument(doc).filter(o=>o?.field===f).map(o=>o.value))];
const SOL=v=>v.some(x=>/solaire/i.test(x));

// Fausses pistes relevées dans les sessions : jamais « Solaire ».
const NOISE=[
  ['Notice thermique.pdf',DOC_TYPES.THERMAL,['Projet neuf – après travaux','3 Fonctions Chauffage et ECS','4 Presence composante solaire Sans composante solaire']],
  ['Notice thermique.pdf',DOC_TYPES.THERMAL,['Projet neuf – après travaux','16 a Production d\'eau chaude sanitaire a partir d\'un systeme de production d\'eau chaude sanitaire solaire thermique, Conforme']],
  ['13 - CVC.pdf',DOC_TYPES.CCTP,['CCTP 13 - Lot CVC','Essais de chauffage et de production d\'eau chaude sanitaire solaire validant la conformite et le bon fonctionnement']],
  ['13 - CVC.pdf',DOC_TYPES.CCTP,['CCTP 13 - Lot CVC','Ballon ECS : NF P50-103 (aout 1988) : Energie solaire - Ballons d\'eau chaude a chauffage par liquide caloporteur']],
  ['DPE.pdf',DOC_TYPES.DPE,['Eau chaude sanitaire','Presence ECS solaire mesure/observe non']],
  ['DPE.pdf',DOC_TYPES.DPE,['Eau chaude sanitaire','8.3. Stockage et Systeme solaire : Stockage ECS #01']]];
for(const [name,type,lines] of NOISE){ const d=mk(name,type,lines);
  eq(SOL([...vals(d,'ecs_vector_after'),...vals(d,'ecs_vector_before'),...vals(d,'ecs')]),false,`pas de solaire : ${lines.at(-1).slice(0,60)}`); }
// La même ligne garde ses autres énergies.
{ const d=mk('Notice thermique.pdf',DOC_TYPES.THERMAL,['Projet neuf – après travaux','Production ECS : chaudiere gaz, presence composante solaire : Sans composante solaire']);
  eq(vals(d,'ecs_vector_after'),['Gaz'],'gaz gardé'); }
// Vraies installations solaires : toujours lues.
{ const d=mk('13 - CVC.pdf',DOC_TYPES.CCTP,['CCTP 13 - Lot CVC','Production d\'eau chaude sanitaire par chauffe-eau solaire individuel (CESI)']);
  eq(SOL(vals(d,'ecs')),true,'CESI lu'); }
{ const d=mk('Notice thermique.pdf',DOC_TYPES.THERMAL,['Projet neuf – après travaux','Presence composante solaire Avec composante solaire','Production ECS solaire thermique']);
  eq(SOL([...vals(d,'ecs'),...vals(d,'ecs_vector_after')]),true,'« avec composante solaire » lu'); }
console.log(`test_v2_18_2 : ${n}/${n} OK`);
