// ExtracTerre v2.21.1 — patchs d'amélioration : réécriture du texte collé (données manuelles) avant lecture.
// Exemple : synthèse RE2020 par plot « PLOT A : BAT A1 : 1 MI » / « Bbio : 78 / Bbiomax 78,8 (gain 1 %) ». Données FICTIVES.
import assert from 'node:assert/strict';
globalThis.localStorage={_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=String(v)}};
const {APP_VERSION}=await import('./js/config.js');
const {importImprovementPatchObject,applyPasteRewrites}=await import('./js/patches.js');
const {parseFreePaste,freePasteValues}=await import('./js/collage-libre.js');
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.30.0','version');

const raw=`PLOT A : BAT A1 : 1 MI
Bbio : 70 / Bbiomax 80 (gain 12,5 %)
Cep : 50 / Cepmax : 80 (gain 37,5 %)
Cep nr : 50 / Cep nr max 60 (gain 16,7 %)
DH ZNT : 700
Ic construction : 600,5 / 700 max
Ic énergie : 60 / 180 max

PLOT B+C : BAT A2 à A5 : 4 MI accolées
Bbio : 71 / Bbiomax 81 (gain 12,3 %)
Cep : 51 / Cepmax : 81 (gain 37 %)
DH ZNT : 650
Ic énergie : 61 / 181 max`;
// Sans patch : une seule section, les maxima perdus.
const before=freePasteValues(parseFreePaste(raw));
eq(before.length,1,'sans patch : pas de plot'); eq(before[0].values.bbio_max,undefined,'sans patch : pas de max');

const patch={schema:'extracterre-improvement-patch/v1',id:'t-plots',version:'1.0.0',minAppVersion:'2.21.1',title:'test',pasteRewrites:[
  {id:'acc',find:String.raw`^[ \t]*PLOTS?[ \t]+([^:\n]+?)[ \t]*:[ \t]*B[AÂ]T(?:IMENTS?|S)?\.?[ \t]+([^:\n]+?)[ \t]*:[ \t]*(\d+)[ \t]*MI[ \t]+accol[ée]es?[ \t]*$`,replace:'Plot $1 (Bât $2) :\nIndividuel groupé (nombre de logements) = $3'},
  {id:'mi',find:String.raw`^[ \t]*PLOTS?[ \t]+([^:\n]+?)[ \t]*:[ \t]*B[AÂ]T(?:IMENTS?|S)?\.?[ \t]+([^:\n]+?)[ \t]*:[ \t]*(\d+)[ \t]*MI[ \t]*$`,replace:'Plot $1 (Bât $2) :\nMaison individuelle = $3'},
  {id:'ind',find:String.raw`^[ \t]*(Bbio|Cep[ \t]*nr|Cep)[ \t]*:[ \t]*([\d.,]+)[ \t]*\/[ \t]*\1[ \t]*max[ \t]*:?[ \t]*([\d.,]+)[ \t]*(?:\([ \t]*gain[ \t]*:?[ \t]*(-?[\d.,]+)[ \t]*%?[ \t]*\))?[ \t]*$`,replace:'$1 = $2\n$1 max = $3\nGain $1 = $4'},
  {id:'ic',find:String.raw`^[ \t]*(Ic[ \t]+construction|Ic[ \t]+[ée]nergie)[ \t]*:[ \t]*([\d.,]+)[ \t]*\/[ \t]*([\d.,]+)[ \t]*max[ \t]*$`,replace:'$1 = $2\n$1 max = $3'}]};
importImprovementPatchObject(patch);
const pr=parseFreePaste(raw); eq(pr.unmatched,[],'tout est reconnu'); eq(pr.patchRewrites.length,4,'4 règles appliquées');
const v=freePasteValues(pr);
eq(v.map(b=>b.building),['Plot A (Bât A1)','Plot B+C (Bât A2 à A5)'],'un bâtiment par plot');
const a=v[0].values, b=v[1].values;
eq([a.housing_individual_scattered,a.bbio,a.bbio_max,a.bbio_gain,a.cep,a.cep_max,a.cep_gain,a.cepnr,a.cepnr_max,a.cepnr_gain,a.dh_znt,a.ic_construction,a.ic_construction_max,a.ic_energy,a.ic_energy_max],
   [1,70,80,12.5,50,80,37.5,50,60,16.7,700,600.5,700,60,180],'plot A complet');
eq([b.housing_grouped_units,b.bbio,b.bbio_max,b.cep_max,b.dh_znt,b.ic_energy_max,b.cepnr],[4,71,81,81,650,181,undefined],'plot B+C, rien d’inventé');
// Texte sans plot : inchangé.
eq(applyPasteRewrites('Bbio = 70\nCep = 50').applied,[],'texte ordinaire intact');
// Patch invalide refusé.
assert.throws(()=>importImprovementPatchObject({...patch,id:'bad',pasteRewrites:[{find:'('}]})); n++;
assert.throws(()=>importImprovementPatchObject({...patch,id:'bad2',pasteRewrites:[{find:'a',flags:'gx'}]})); n++;
console.log(`v2.21.1 — ${n} vérifications OK (données fictives)`);
