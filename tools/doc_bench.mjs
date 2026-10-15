// Banc d'essai sur documents complets : lit de vrais PDF comme l'application (pdf.js + regroupement des lignes),
// les classe et les analyse avec le moteur, puis compare aux valeurs vérifiées à la main dans un pack d'amélioration.
// Aucune donnée n'est stockée dans le dépôt.
// Usage : PDFJS=<dossier pdfjs-dist 3.11.174> node tools/doc_bench.mjs <dossier_du_pack|-> <fichier.pdf>... [--json rapport.json] [-v]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const [packDir, ...files] = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '--json');
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pdfjsDir = process.env.PDFJS;
if (!pdfjsDir || !files.length) { console.error('Usage : PDFJS=<pdfjs-dist> node tools/doc_bench.mjs <pack|-> <fichier.pdf>...'); process.exit(2); }

const pdfjs = createRequire(path.join(pdfjsDir, 'x.js'))('pdfjs-dist/legacy/build/pdf.js');
const { groupItemsIntoLines } = await import(repo + '/js/readers.js');
const { classifyDocument } = await import(repo + '/js/classifier.js');
const { parseDocument, resolveDocumentFamilies } = await import(repo + '/js/parsers.js');
const { detectBuildings } = await import(repo + '/js/buildings.js');
const { analyzeDocuments } = await import(repo + '/js/engine.js');
const { DEFAULT_SOURCE_RULES } = await import(repo + '/js/config.js');
const { normalizeText } = await import(repo + '/js/utils.js');

async function readPdf(file) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent({ includeMarkedContent: true });
    const lines = groupItemsIntoLines(content.items);
    pages.push({ page: p, text: lines.map((l) => l.text).join('\n'), lines, textSource: 'pdf' });
  }
  return { kind: 'pdf', pages, text: pages.map((p) => p.text).join('\n\f\n'), pageCount: pdf.numPages };
}

// Valeurs vérifiées : corrections manuelles et emplacements surlignés, par document.
function attendus(nom) {
  if (!packDir || packDir === '-') return [];
  const lire = (f) => { try { return JSON.parse(fs.readFileSync(path.join(packDir, f))); } catch { return []; } };
  const source = (p) => { const s = p.source; if (s && typeof s === 'object') return s; try { return JSON.parse(String(s).replace(/'/g, '"').replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false')) || {}; } catch { return {}; } };
  const out = new Map();
  for (const e of lire('corrections_manuelles.json')) {
    const p = e.payload || {}; if ((source(p).fileName || '') !== nom || p.newValue === undefined || p.newValue === '') continue;
    out.set(`${p.field}|${p.building || ''}`, { field: p.field, building: p.building || '', value: p.newValue, origine: 'correction' });
  }
  for (const e of lire('apprentissage_emplacements.json')) {
    const p = e.payload || {}; if ((p.document || '') !== nom || p.correctedValue === undefined || p.correctedValue === null || p.correctedValue === '') continue;
    const k = `${p.field}|${p.building || ''}`; if (!out.has(k)) out.set(k, { field: p.field, building: p.building || '', value: p.correctedValue, origine: 'emplacement', page: p.page });
  }
  return [...out.values()];
}

const same = (a, b) => {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const na = Number(String(a).replace(',', '.')), nb = Number(String(b).replace(',', '.'));
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) <= 1e-6 * Math.max(1, Math.abs(nb));
  return normalizeText(String(a)).toLowerCase() === normalizeText(String(b)).toLowerCase();
};
// Même sens, autre formulation : les corrections manuelles reprennent souvent le libellé du document
// (« Electrique », « Avant 1948 », 17 logements traversants) là où le moteur range une valeur normalisée.
const sans = (v) => normalizeText(String(v)).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const CLASSES = [[/electri|elec\b|effet joule|convecteur/, 'electricite'], [/\bgaz\b/, 'gaz'], [/fioul|fuel/, 'fioul'], [/bois|granul|biomasse/, 'bois'],
  [/reseau de chaleur|chauffage urbain/, 'rcu'], [/naturelle|ouv\w*\.?\s*de\s*fen|tirage/, 'ventilation naturelle']];
const classe = (v) => { const t = sans(v); return (CLASSES.find(([re]) => re.test(t)) || [])[1] || t; };
function equivalent(field, obtenu, attendu) {
  if (same(obtenu, attendu)) return true;
  if (/^(?:built_before_1948|built_after_1948|cross_ventilated|non_cross_ventilated)$/.test(field) && sans(obtenu) === 'oui')
    return /^(?:avant 1948|oui)$/.test(sans(attendu)) || Number(attendu) > 0 || /apres 1948|entre 19/.test(sans(attendu));
  return typeof obtenu === 'string' && classe(obtenu) === classe(attendu);
}

const rapport = [];
for (const file of files) {
  const name = path.basename(file);
  const read = await readPdf(file);
  const auto = classifyDocument(name, read.text, { kind: 'pdf' });
  const doc = { id: 'd1', name, familyMode: 'auto', read, status: 'ready', classification: { ...auto, automaticType: auto.type }, type: auto.type };
  doc.families = resolveDocumentFamilies(doc);
  doc.buildings = detectBuildings(doc);
  const t0 = Date.now();
  const occ = parseDocument(doc).filter(Boolean);
  const res = analyzeDocuments([{ ...doc, cachedOccurrences: occ }], structuredClone(DEFAULT_SOURCE_RULES));
  const finals = res.finals || [];
  const exp = attendus(name);
  const lignes = exp.map((x) => {
    const brut = occ.some((o) => o.field === x.field && same(o.value, x.value));
    const final = finals.filter((f) => f.field === x.field && (!x.building || !f.building || normalizeText(f.building) === normalizeText(x.building) || finals.filter((g) => g.field === x.field).length === 1));
    const retenu = final.some((f) => same(f.value, x.value));
    const equiv = !retenu && final.some((f) => equivalent(x.field, f.value, x.value));
    return { ...x, brut, retenu, equiv, obtenu: final.map((f) => f.value) };
  });
  const r = { fichier: name, type: auto.type, familles: doc.families, pages: read.pageCount, occurrences: occ.length, champs: new Set(occ.map((o) => o.field)).size,
    ms: Date.now() - t0, attendus: exp.length, retenus: lignes.filter((l) => l.retenu).length, equivalents: lignes.filter((l) => l.equiv).length,
    trouvesBruts: lignes.filter((l) => l.brut).length, lignes };
  rapport.push(r);
  console.log(`${name} — ${auto.type} [${doc.families.join('+')}] ${read.pageCount} p. : ${r.occurrences} occurrences, ${r.champs} champs, ${r.ms} ms` +
    (exp.length ? ` | vérifiés : ${r.retenus}/${exp.length} identiques, +${r.equivalents} équivalents (même sens), ${r.trouvesBruts}/${exp.length} trouvés` : ''));
  if (verbose) {
    for (const l of lignes.filter((x) => !x.retenu)) console.log(`   ${l.equiv ? 'équivalent' : l.obtenu.length ? 'DIFFÉRENT ' : 'MANQUANT  '} ${l.field} [${l.building}] attendu ${JSON.stringify(l.value)} obtenu ${JSON.stringify(l.obtenu)}`);
  }
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rapport, null, 1));
