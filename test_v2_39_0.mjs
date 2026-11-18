// v2.39.x — complexe d'isolation (valeurs FICTIVES) : ITE + ITI pour les murs ; ITE repérée dans le texte.
import assert from 'node:assert/strict';
import {APP_VERSION,FIELD_MAP} from './js/config.js';
import {insulationPosition} from './js/parsers.js';
import {envelopeLabelLayers} from './js/utils.js';
assert.equal(APP_VERSION,'3.0.3');
assert.equal(FIELD_MAP.roof_top_thickness,undefined,'v2.39.1 : cases plancher haut retirées (sans apport au banc)');
assert.equal(insulationPosition('wall','Isolation thermique par l’extérieur : laine de roche 120 mm sous bardage'),'wall_ite');
assert.equal(insulationPosition('wall','Doublage collé 10+80 PSE'),null,'ITI non repérée (doublages)');
assert.equal(insulationPosition('wall','Murs : laine de verre 100 mm'),null);
assert.equal(insulationPosition('wall','Isolant 140 mm',"facade"),'wall_ite');
assert.equal(insulationPosition('roof','Toiture terrasse : PUR 120 mm sous étanchéité'),null);
assert.deepEqual(envelopeLabelLayers('ITE 120 mm + ITI 10 mm'),{principal:120,total:120,multi:true},'10 mm (≤ 15) n’est pas compté comme isolant');
assert.equal(envelopeLabelLayers('LDV 120mm + PU 60mm').total,180);
// Moteur : ITE 120 + ITI 30 = 150 mm ; R 3,5 + 0,9 = 4,4.
const {applyComparisonBases}=await import('./js/engine.js');
const fin=(field,value)=>({building:'Bât A',field,value,method:'envelope:thickness-context',docId:'d',fileName:'CCTP.pdf',confidence:0.9});
const row={building:'Bât A',wall_ite_thickness:120,wall_iti_thickness:30,wall_ite_r:3.5,wall_iti_r:0.9,wall_insulation_thickness:120};
const r={rows:[row],finals:Object.entries(row).filter(([k])=>k!=='building').map(([k,v])=>fin(k,v))};
applyComparisonBases(r);
assert.equal(r.rows[0].wall_insulation_thickness,150); assert.equal(r.rows[0].wall_insulation_r,4.4);
assert.ok(r.finals.some(o=>o.field==='wall_insulation_thickness'&&o.method==='derive:complexe-isolant'&&o.value===150));
assert.equal(r.finals.filter(o=>o.field==='wall_insulation_thickness').length,1,'une seule valeur retenue');
console.log('test_v2_39_0 OK');

// v2.39.0 — import massif : plantage natif de l'OCR rattrapé (relance tant que l'analyse avance, puis sans OCR, puis mise de côté),
// registre enregistré tous les 10 documents, rapport iMessage de fin (numéro hors dépôt).
{ const fs2=await import('fs'); const w=fs2.readFileSync('tools/import/watch.mjs','utf8'), cli=fs2.readFileSync('tools/import/extracterre-import.mjs','utf8'), reg=fs2.readFileSync('tools/import/lib/registry.mjs','utf8'), pkg=JSON.parse(fs2.readFileSync('tools/import/package.json','utf8'));
  const ok=/function crashPlan/.test(w)&&/sansOcr\.push\(op\)/.test(w)&&/exclus\.push\(op\)/.test(w)&&/notif\.json/.test(w)&&!/\+33\d/.test(w)
    &&/--sans-ocr-contrats/.test(cli)&&/excluded\.has\(contract\)/.test(cli)&&/\+\+sinceFlush>=10/.test(cli)
    &&/const dirtyFiles=\[\.\.\.this\.dirtyFiles\]/.test(reg)&&pkg.dependencies['@napi-rs/canvas']!=='0.1.65';
  if(!ok){ console.error('ÉCHEC import massif robuste'); process.exit(1); } console.log('v2.39.0 — import massif robuste OK'); }

// v2.39.0 — import massif : les lots de CCTP d'enveloppe (isolants, parois) sont toujours lus quand les lots sont filtrés.
{ const {withEnvelopeLots}=await import('./js/recherches.js'); const {cctpLotDecision}=await import('./js/import-rules.js');
  const lots=withEnvelopeLots(['menuiserie','electricite']);
  const read=n=>cctpLotDecision(n,lots).read;
  const ok=withEnvelopeLots([]).length===0&&read('CCTP LOT 05 - ISOLATION.pdf')&&read('Lot 08 Plâtrerie - Doublages.pdf')&&read('CCTP Lot 3 Façades ITE.pdf')&&read('LOT 04 CHARPENTE COUVERTURE.pdf')&&read('Lot 02 Etanchéité.pdf')&&read('Lot 10 Chapes.pdf')&&read('LOT 01 GROS OEUVRE.pdf')&&!read('LOT 12 PEINTURE.pdf')&&!read('Lot 15 Ascenseur.pdf');
  if(!ok){ console.error('ÉCHEC lots enveloppe'); process.exit(1); } console.log('v2.39.0 — lots CCTP enveloppe OK'); }

// Garde-fou (panne du 16/11/2026) : tout module js/ doit être dans le bundle (build_bundle.py), sinon l'appli en ligne plante au démarrage.
{ const fs2=await import('fs'); const order=fs2.readFileSync('build_bundle.py','utf8').match(/order=\[(.*?)\]/s)[1];
  const SEPARATE=new Set(['security.js','app.bundle.js','cloud-config.js','journal-config.js']);
  const miss=fs2.readdirSync('js').filter(f=>f.endsWith('.js')&&!SEPARATE.has(f)&&!order.includes(`'${f}'`));
  if(miss.length){ console.error('ÉCHEC modules hors bundle :',miss.join(', ')); process.exit(1); } console.log('v2.39.0 — bundle complet OK'); }
