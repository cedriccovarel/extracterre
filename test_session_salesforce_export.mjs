import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sfConfront} from './js/confrontation.js';
import {hydrateProjectFull,serializeProjectFullParts} from './js/persistence.js';
import {reliabilityTable} from './js/qualite.js';

// Données et références fictives.
const building = 'Bâtiment A';
const excluded = 'Bâtiment B';
const field = 'dh';
const key = `${building}|${field}`;
const manualValue = '215,0';
const salesforce = Object.freeze({
  building, field, value: manualValue, fileName: 'Salesforce — exemple fictif.xlsx',
  docType: 'Correction manuelle', page: '', confidence: 1, method: 'manual:free-paste',
  excerpt: 'DH = 215,0', sourceTier: 'manual',
  documentValue: 482.7, documentFile: 'RSET fictif.pdf', documentPage: 5
});
const otherFinal = {building, field: 'fan_count', value: 0, method: 'comfort:fan-count'};
const documentary = {
  building, field, value: 482.7, fileName: 'RSET fictif.pdf', docType: 'RSET',
  page: 5, studyDate: '2026-09-03', confidence: 0.98, status: 'retenu'
};
const rows = Object.freeze([Object.freeze({building, dh: manualValue, fan_count: 0})]);
const docs = [{type: 'RSET', status: 'ready'}];
const rules = {dh: {main: ['RSET']}, tic: {main: ['RSET']}};
const sfChecks = sfConfront({
  sf: [salesforce, {building, field: 'tic', value: 25}],
  detailed: [documentary, {...documentary, building: excluded, value: 700}],
  docs, rules, differs: (field, left, right) => left !== right
});
const project = {
  id: 'projet-fictif',
  sfBuildings: Object.freeze([building]),
  manualValues: Object.freeze({[key]: manualValue}),
  manualSources: {[key]: {fileName: salesforce.fileName, excerpt: salesforce.excerpt}},
  result: {rows, finals: [salesforce, otherFinal], sfChecks}
};
// Exécute la construction d'une opération sans démarrer l'interface navigateur.
const appSource = readFileSync(new URL('./js/app.js', import.meta.url), 'utf8');
const operationSource = appSource.match(/^function sessionOperation\(.*?^}/ms)?.[0];
assert.ok(operationSource);
const sessionOperation = new Function(
  'reliabilityTable', 'projectIdentity', 'projectTitle', 'projectCompletion', 'projectProfile', 'feedSearches',
  `${operationSource}\nreturn sessionOperation;`
)(reliabilityTable, () => ({}), () => 'Projet fictif', () => ({}), () => ({}), () => ({}));
const serialize = p => JSON.parse(JSON.stringify(sessionOperation(p, [], true)));
const exported = serialize(project);

assert.deepEqual(exported.sfChecks[key], {
  status: 'DIVERGENCE_DOCUMENTAIRE',
  label: 'Divergence documentaire',
  sfValue: manualValue,
  docValue: 482.7,
  docFile: 'RSET fictif.pdf',
  docPage: 5,
  docDate: '2026-09-03',
  documentsExamined: 1
});
assert.equal(exported.sfChecks[`${building}|tic`].status, 'NON_RETROUVEE');
assert.equal(Object.hasOwn(exported.sfChecks[`${building}|tic`], 'docValue'), false);
assert.deepEqual(exported.rows, rows);
assert.deepEqual(exported.finals[0], {
  building, field, value: manualValue, fileName: salesforce.fileName,
  docType: salesforce.docType, page: '', confidence: 1, method: salesforce.method,
  excerpt: salesforce.excerpt, documentValue: 482.7, documentFile: 'RSET fictif.pdf',
  documentPage: 5
});
assert.deepEqual(exported.finals[1], otherFinal);
assert.equal(exported.reliability[building][field], 'certifiee');
assert.deepEqual(exported.manualValues, {[key]: manualValue});
assert.deepEqual(exported.rows.map(row => row.building), [building]);
assert.equal(JSON.stringify(exported).includes(excluded), false);
assert.deepEqual(serialize(project), exported);
const {rows: emptyRows, reliability, finals, sfChecks: emptyChecks} = serialize({...project, result: null});
assert.deepEqual({emptyRows, reliability, finals, emptyChecks}, {emptyRows: [], reliability: {}, finals: [], emptyChecks: {}});
assert.deepEqual(serialize({...project, result: {rows, finals: [otherFinal]}}).sfChecks, {});
const compact = sessionOperation(project, [], false);
assert.equal(Object.hasOwn(compact, 'sfChecks'), false);
assert.equal(Object.hasOwn(compact, 'finals'), false);

const workspace = JSON.parse([...serializeProjectFullParts(project)].join(''));
const restored = hydrateProjectFull(workspace);
assert.deepEqual(restored.sfBuildings, [building]);
assert.deepEqual(restored.manualValues, {[key]: manualValue});
assert.deepEqual(restored.manualSources, project.manualSources);
assert.equal(restored.result, null, 'Le résultat est recalculé lors de la restauration.');

console.log('Export de session Salesforce : divergences, provenance et périmètre vérifiés.');
