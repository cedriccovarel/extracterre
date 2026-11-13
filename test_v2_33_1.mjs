// v2.33.1 — import massif = appli : packs d'amélioration chargés par le service, garde-fous « libellé : valeur ».
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as extract from './tools/import/lib/extract.mjs';
import {badLabelStructure} from './js/sanity.js';
import {getImprovementPatches} from './js/patches.js';

// 1. Packs du site chargés dans le service (même classement que l'appli)
const manifest=JSON.parse(fs.readFileSync('data/patches/manifest.json','utf8'));
assert.equal(extract.PATCH_SIG.split(',').length,manifest.patches.length);
const txt='RSEE/RSET - OPERATION FICTIVE\nREGLEMENTATION ENVIRONNEMENTALE 2020\nRecapitulatif Standardise Energie Environnement\nPartie « Etude Thermique »\nLogiciel et version :IZUBA energies, Pleiades, 6.25.6.1\nBbio Cep,nr DH';
assert.equal(getImprovementPatches().length,manifest.patches.length);
// Résultat ancien (sans packs) dont le type ne correspond plus au classement actuel → relu ; déjà aux packs actuels → réutilisé
const old={doc:{name:'Fictif-RSEE.pdf',type:'DPE',read:{kind:'pdf',text:txt,pages:[{page:1,text:txt,lines:[]}]}}};
assert.equal(extract.staleForPatches(old),true);
assert.equal(extract.staleForPatches({...old,patches:extract.PATCH_SIG}),false);

// 2. Garde-fous « libellé : valeur »
const m='tags:label-value';
assert.equal(badLabelStructure({field:'housing_count',value:45,method:m,excerpt:'logements - Avenue de Gien a VILLE FICTIVE (45).'}),true);
assert.equal(badLabelStructure({field:'housing_count',value:45,method:m,excerpt:'Nombre de logements : 45'}),false);
assert.equal(badLabelStructure({field:'structure',value:'• Caisson en tole galvanisee peinte',method:m}),true);
assert.equal(badLabelStructure({field:'structure',value:'Béton armé',method:m}),false);
assert.match(fs.readFileSync('js/engine.js','utf8'),/if\(badLabelStructure\(o\)&&!o\.userValidated\) return null;/);
const cli=fs.readFileSync('tools/import/extracterre-import.mjs','utf8');
assert.match(cli,/unchanged&&!extract\.staleForPatches\(oldRes\)/);
assert.equal(fs.readFileSync('VERSION','utf8').trim(),'2.33.1');
console.log('test_v2_33_1 ok');
