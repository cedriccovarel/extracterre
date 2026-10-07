// ExtracTerre v2.3.3 — synthèse ClimaWin multi-bâtiments, récap BE, versions multiples : documents FICTIFS.
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {isClimaWinSynthesis,isBeActRecap,isClimaWinInputReport,climaWinEnvelopeLines} from './js/climawin.js';
import {climaWinSynthesisDoc,beRecapDoc,mkDoc,mkPage} from './test_fixtures_v2_3_3.mjs';

let n=0; const ok=(c,m)=>{ assert.ok(c,m); n++; }; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
const rules=()=>structuredClone(DEFAULT_SOURCE_RULES);
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:'pdf'}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.buildings=detectBuildings(d); d.status='ready'; return d; };
eq(APP_VERSION,'2.3.12','version');

// ---------- 1. Classification ----------
const cw=prep(climaWinSynthesisDoc('cw1','Lot_X_-_Resultats_RE2020.pdf'));
eq(cw.type,DOC_TYPES.RSET_RE2020,'synthèse ClimaWin → RSET RE2020 (« RTEx » n’est pas RT Existant)');
ok(isClimaWinSynthesis(cw),'signature synthèse ClimaWin');
const recap=prep(beRecapDoc('rc1','Recap_ETH_Lot_1.pdf'));
eq(recap.type,DOC_TYPES.THERMAL,'récap BE → Étude thermique (la mention « DPE » est informative)');
ok(isBeActRecap(recap),'signature récap BE');
const rtex=classifyDocument('Etude_RT_existant.pdf','Réglementation thermique existante — état initial\nUbat avant travaux',{});
eq(rtex.type,DOC_TYPES.RT_EXISTING,'un vrai document RT Existant reste classé RT Existant');
const input=mkDoc('in1','Saisie.pdf',[mkPage(1,[['ClimaWin 2020 2026.6.2.2 - licence : BE ACT',800],['Etude DCE - Rapport detaille 4',780],['3. Parois 5',770],['3.1. Mur : ---------- Batiment 1 ---------- 5',760]])]);
prep(input); ok(isClimaWinInputReport(input),'rapport de saisie détecté'); eq(parseDocument(input),[],'saisie détaillée non exploitée (aucune valeur parasite)'); eq(input.buildings.names,['Bâtiment unique'],'saisie : aucun faux bâtiment');

// ---------- 2. Bâtiments ----------
eq(cw.buildings.names,['Bâtiment NORD','Bâtiment SUD'],'bâtiments = titres de section (ni sommaire, ni lignes de tableau)');

// ---------- 3. Indicateurs par bâtiment ----------
const o=parseDocument(cw); const v=(f,b)=>o.find(x=>x.field===f&&x.building===b)?.value;
const N='Bâtiment NORD', S='Bâtiment SUD';
eq(v('bbio',N),50,'Bbio Nord'); eq(v('bbio_max',N),80,'Bbio max Nord'); eq(v('bbio_gain',N),37.5,'gain Bbio calculé'); eq(v('bbio',S),70,'Bbio Sud');
eq(v('cep',N),60,'Cep Nord'); eq(v('cepnr_max',S),70,'Cep,nr max Sud'); eq(v('ic_energy',N),70,'Ic énergie');
eq(v('dh',N),700.5,'DH = groupe le plus défavorable'); eq(v('dh_max',N),1450,'DH max du même groupe');
eq(v('shab',N),400,'Sref Nord (tableau par entité)'); eq(v('shab',S),180.6,'Sref Sud');
eq(v('housing_count',N),6,'logements Nord = Σ zones (4+2)'); eq(v('housing_count',S),2,'logements Sud');
eq(v('cross_ventilated',N),'Oui','traversant'); eq(v('non_cross_ventilated',N),'Oui','non traversant'); eq(v('non_cross_ventilated',S),undefined,'pas de non-traversant au Sud');
eq(v('enr',N),'Oui','PV Nord'); eq(v('enr_type',N),'Photovoltaïque','type PV'); eq(v('enr',S),'Non','PV absent Sud (valeur nulle)'); eq(v('enr_type',S),'Aucun','type ENR Sud');
eq(v('cep_cooling',N),18.4,'Cep refroidissement = Tot EP'); eq(v('cep_lighting',N),4.6,'Cep éclairage'); eq(v('cep_aux_vent',N),1.2,'Cep aux. ventilation'); eq(v('cep_aux_dist',N),undefined,'aucun Tot EP → pas de valeur inventée'); eq(v('cep_mobility',N),1.2,'Cep déplacements');
eq(v('heating_vector_after',N),'Électricité','vecteur chauffage'); eq(v('ecs_vector_after',N),'Électricité','vecteur ECS');
ok(!o.some(x=>/^Bâtiment (?:NORD|SUD) \d/.test(x.building)),'aucune ligne de tableau prise pour un bâtiment');
ok(o.every(x=>x.value!==52.2),'mobilier (Cef elec-mobi) jamais repris');

// ---------- 4. Enveloppe (rangées de tableau éclatées) ----------
const env=climaWinEnvelopeLines(cw).filter(l=>l.building===N); const cat=c=>env.find(l=>l.category===c);
ok(/STEICOprotect dry/.test(cat('wall').text)&&/160 mm/.test(cat('wall').text),'mur dominant : STEICOprotect 160 mm (épaisseur lue malgré « (16 / cm) » coupé)');
ok(!/Coffre/i.test(cat('wall').text),'coffres de volets exclus');
ok(/TMS/.test(cat('floor').text)&&/120 mm/.test(cat('floor').text),'plancher bas : TMS 120 mm'); ok(/UNIVERCELL/i.test(cat('roof').text)&&/390 mm/.test(cat('roof').text),'combles : UNIVERCELL 390 mm');
eq(v('wall_insulation',N),'Fibre de bois','isolant mur normalisé'); eq(v('wall_insulation_thickness',N),160,'épaisseur mur (mm)'); eq(v('roof_insulation',N),'Ouate de cellulose','isolant combles'); eq(v('floor_insulation_thickness',N),120,'épaisseur plancher');
const rd=o.find(x=>x.field==='wall_insulation_r'&&x.building===N); ok(rd&&rd.value===4.1&&rd.confidence<0.9&&rd.derivedFromDocument,'R dérivé (e/λ) proposé à validation, jamais retenu seul');
eq(v('window_material',N),'Aluminium','menuiserie'); eq(v('window_shading',N),'Volet roulant','protection');

// ---------- 5. Récap BE : valeurs de lot, systèmes ----------
const r=parseDocument(recap); const rv=f=>r.find(x=>x.field===f)?.value;
eq(rv('bbio'),55.4,'récap Bbio'); eq(rv('bbio_gain'),26.13,'récap gain lu tel quel'); eq(rv('cep_max'),81,'récap Cep max'); eq(rv('cepnr_gain'),4.5,'récap gain Cep,nr');
eq(rv('heating_mode_after'),'PAC air/eau','mode de chauffage'); eq(rv('cooling'),'PAC réversible','PAC réversible'); eq(rv('enr_type'),'Photovoltaïque','PV du récap'); eq(rv('ventilation'),'VMC Hygro B','ventilation');
eq(r.filter(x=>x.field==='ecs').map(x=>x.value).sort(),['Ballon électrique','Chauffe-eau thermodynamique'],'ECS : deux types déclarés (T3+ / T2-)');
ok(r.every(x=>!/^dpe_/.test(x.field)),'jamais de classe DPE tirée d’un classement informatif'); ok(r.every(x=>!/^(?:wall|roof|floor)_/.test(x.field)),'légende des parois du récap non lue au hasard');

// ---------- 6. Consolidation : lot + récap + versions multiples ----------
const old=prep(climaWinSynthesisDoc('cw0','Lot_X_-_Resultats_ancienne_version.pdf',{date1:'05/01/2026 08:00:00',date2:'05/01/2026 08:00:01',north:{bbio:'51.0',dh:'705.0'},south:{dh:'661.0'}}));
const res=analyzeDocuments([prep(climaWinSynthesisDoc('cw1','Lot_X_-_Resultats_RE2020.pdf')),old,prep(beRecapDoc('rc1','Recap_ETH_Lot_1.pdf'))],rules(),'');
eq(res.rows.map(x=>x.building),['Bâtiment NORD','Bâtiment SUD'],'2 lignes seulement (aucun bâtiment parasite)');
const row=b=>res.rows.find(x=>x.building===b);
eq(row(N).bbio,50,'version la plus récente retenue (Bbio)'); eq(row(N).dh,700.5,'DH de la version récente, pas le plus élevé toutes versions'); eq(row(S).dh,660,'DH Sud récent');
ok(res.alerts.some(a=>/Plusieurs versions d'étude pour Bâtiment NORD/.test(a.message)),'alerte de versions multiples');
eq(row(S).enr,'Non','le PV du récap (niveau lot) ne s’applique pas au bâtiment sans PV'); eq(row(N).enr,'Oui','PV Nord');
ok(!res.uncertain.some(u=>u.building==='Bâtiment unique'&&['bbio','cep','cepnr'].includes(u.field)),'valeurs de niveau lot redondantes : pas de bruit dans « À vérifier »');
ok(row(N).heating_mode_after==='PAC air/eau'&&row(S).ventilation==='VMC Hygro B','descriptifs de lot appliqués aux bâtiments qui n’ont pas de valeur propre');
eq(row(N).cooling,'PAC réversible','refroidissement');

// ---------- 7. Récap seul (aucun détail par bâtiment) : valeurs de lot proposées en revue, pas recopiées ----------
const alone=analyzeDocuments([prep(beRecapDoc('rc2','Recap_seul.pdf'))],rules(),'');
eq(alone.rows.length,1,'récap seul : 1 ligne'); eq(alone.rows[0].bbio,55.4,'récap seul : valeur retenue (un seul bâtiment possible)');

console.log(`v2.3.3 — ${n} vérifications OK (documents fictifs)`);
