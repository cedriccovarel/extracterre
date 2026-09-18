import fs from 'node:fs';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
};

globalThis.EXTRACTERRE_CLOUD_CONFIG = {
  supabaseUrl: 'https://example.supabase.co',
  supabasePublishableKey: 'sb_publishable_test',
  autoRemoteMinBytes: 6 * 1024 * 1024,
  maxRemoteBytes: 700 * 1024 * 1024,
};

const { APP_VERSION, FIELD_DEFS, DOC_TYPES } = await import('./js/config.js');
const { shouldUseCloudForFile } = await import('./js/cloud.js');
const { importImprovementPatchObject, parsePatchOccurrences } = await import('./js/patches.js');

assert.equal(APP_VERSION, '2.1.0', 'La version doit être 2.1.0');
assert.equal(FIELD_DEFS.length, 167, 'Le catalogue moteur doit garder 167 champs');

const catalog = JSON.parse(fs.readFileSync('./data/field-catalog.json', 'utf8'));
assert.equal(catalog.count, 167, 'Le catalogue JSON doit garder 167 champs');
assert.deepEqual(catalog.fields.map(x => x.label), FIELD_DEFS.map(x => x.label), 'Le catalogue JSON doit conserver le même ordre');

const masterColumns = fs.readFileSync('./COLONNES_EXTRACTERRE.txt', 'utf8')
  .split(/\t|\r?\n/).map(x => x.trim()).filter(Boolean);
assert.equal(masterColumns.length, 167, 'COLONNES_EXTRACTERRE doit garder exactement 167 lignes');
assert.deepEqual(masterColumns, FIELD_DEFS.map(x => x.label), 'L’ordre d’export maître ne doit pas changer');

assert.equal(shouldUseCloudForFile({name:'leger.pdf', size:2*1024*1024}, 'auto', 'auto'), false);
assert.equal(shouldUseCloudForFile({name:'lourd.pdf', size:7*1024*1024}, 'auto', 'auto'), true);
assert.equal(shouldUseCloudForFile({name:'scan.pdf', size:1000}, 'auto', 'always'), true);
assert.equal(shouldUseCloudForFile({name:'force.pdf', size:1000}, 'remote', 'auto'), true);
assert.equal(shouldUseCloudForFile({name:'force.pdf', size:7*1024*1024}, 'local', 'auto'), false);
assert.equal(shouldUseCloudForFile({name:'tableau.xlsx', size:20*1024*1024}, 'remote', 'auto'), false);

assert.throws(() => importImprovementPatchObject({
  schema: 'extracterre-improvement-patch/v1',
  id: 'future-patch',
  minAppVersion: '99.0.0',
  extractionRules: [],
}), /incompatible/i, 'Un patch demandant une version future doit être refusé');

const u22 = JSON.parse(fs.readFileSync('./data/patches/ExtracTerre_PATCH_U22WIN_PERRENOUD_RE2020_MULTIBUILDING_v1.json', 'utf8'));
importImprovementPatchObject(u22);
const text = [
  "rapport de l'etude",
  'U22Win',
  '1. Bâtiment : TEST',
  'Groupe non refroidi Catégorie 1 1000 1200',
  'Groupe non refroidi Catégorie 1 900 1300',
].join('\n');
const doc = {
  id: 'u22-test', name: 'note-u22.pdf', type: DOC_TYPES.THERMAL,
  read: { text, pages: [{page:1, text, lines:text.split('\n').map((t,i)=>({index:i,text:t,items:[]}))}] }
};
const occ = parsePatchOccurrences(doc);
const dh = occ.find(x => x.field === 'dh');
const dhMax = occ.find(x => x.field === 'dh_max');
assert.equal(dh?.value, 1000, 'Le DH défavorable doit être le maximum');
assert.equal(dhMax?.value, 1200, 'DHmax doit provenir de la même ligne que le DH maximal');

console.log('V2.1 hybrid regression: OK');
console.log('167 champs: OK');
console.log('DH/DHmax même ligne: OK');
console.log('minAppVersion: OK');
console.log('routage hybride: OK');
