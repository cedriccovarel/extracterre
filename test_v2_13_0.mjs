// ExtracTerre v2.13.0 — DPE 3CL d'immeuble rangés par bâtiment : rapport « 3CL non réglementaire » (classes recalculées),
// XML DPE ADEME (classes lues), état initial « - EI » et après travaux sans mention. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {analyzeDocuments} from './js/engine.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {readXmlText} from './js/readers.js';
import {dpePhaseOf,dpeBuildingOf} from './js/dpe-3cl.js';
import {textDoc} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.14.0','version');
eq([dpePhaseOf('état initial 3CL/Bâtiment Z - EI.pdf'),dpePhaseOf('Bâtiment Z.pdf'),dpePhaseOf('Bâtiment Z - après travaux.pdf'),dpePhaseOf('Projet Les Fictifs.pdf')],['before',null,'after',null],'phase du chemin');
eq([dpeBuildingOf('état initial 3CL/Bâtiment Z - EI.pdf'),dpeBuildingOf('Bat. 12.pdf'),dpeBuildingOf('Batiments.pdf'),dpeBuildingOf('Bâtiment Z.pdf'.normalize('NFD'))],['Bâtiment Z','Bâtiment 12','','Bâtiment Z'],'bâtiment du nom de fichier (macOS : NFD)');
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:d.read.kind}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.buildings=detectBuildings(d); d.status='ready'; return d; };
const report=(ep,kg,surf)=>`PERFORMANCE ENERGETIQUE\nNON REGLEMENTAIRE\nSELON METHODE DPE 3CL\f3CL non reglementaire (batiment d'habitation collectif)\ntype de bien : immeuble collectif\nsurface de reference : ${surf} m²\nbatiment extremement peu performant\nCe batiment emet ${kg} kg de CO2 par an,\nMontants et consommations annuels d'energie\nenergie totale pour les ${ep} kWh entre 1000€ et 2000€`;
const ei=prep(textDoc('d1','Bâtiment Z - EI.pdf',null,report(250000,40000,2000),{relativePath:'état initial 3CL/Bâtiment Z - EI.pdf'}));
const ap=prep(textDoc('d2','Bâtiment Z.pdf',null,report(160000,9000,2000),{relativePath:'Bâtiment Z.pdf'}));
eq([ei.buildings.names,ap.buildings.names],[['Bâtiment Z'],['Bâtiment Z']],'bâtiment Z, pas « extrêmement peu performant »');
let r=analyzeDocuments([ei,ap],structuredClone(DEFAULT_SOURCE_RULES),'Op').rows;
eq(r.map(x=>[x.building,x.dpe_energy_before,x.dpe_ges_before,x.dpe_energy_after,x.dpe_ges_after]),[['Bâtiment Z','C','C','B','A']],'125 / 20 → C C ; 80 / 4,5 → B A, passé en après');
r=analyzeDocuments([ap],structuredClone(DEFAULT_SOURCE_RULES),'Op').rows;
eq([r[0].dpe_energy_before,r[0].dpe_energy_after],['B',undefined],'seul et sans mention : état existant présumé');
// Valeur au seuil : 6,1 kgCO₂ (affiché « 6 ») → classe GES non retenue d'office.
const edge=prep(textDoc('d3','Bâtiment Z.pdf',null,report(160000,12200,2000),{relativePath:'Bâtiment Z.pdf'}));
const res=analyzeDocuments([ei,edge],structuredClone(DEFAULT_SOURCE_RULES),'Op');
eq([res.rows[0].dpe_energy_after,res.rows[0].dpe_ges_after],['B',undefined],'GES au seuil A/B : à vérifier');
// XML DPE ADEME.
const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<dpe version="8.0.2">\n<administratif>\n<reference_interne_projet>FICTIF - DIAG - INITIAL - Bâtiment Y</reference_interne_projet>\n<date_etablissement_dpe>2025-01-01</date_etablissement_dpe>\n</administratif>\n<logement><caracteristique_generale><annee_construction>1970</annee_construction><nombre_appartement>12</nombre_appartement><surface_habitable_immeuble>900</surface_habitable_immeuble></caracteristique_generale>\n<sortie><ep_conso><ep_conso_5_usages_m2>190</ep_conso_5_usages_m2><classe_bilan_dpe>D</classe_bilan_dpe></ep_conso><emission_ges><emission_ges_5_usages_m2>35.5</emission_ges_5_usages_m2><classe_emission_ges>D</classe_emission_ges></emission_ges></sortie></logement></dpe>`;
const x=prep({id:'x1',name:'DPE fictif.xml',read:readXmlText(xml)});
eq([x.read.xmlFormat,x.buildings.names],['dpe',['Bâtiment Y']],'XML DPE : bâtiment de la référence');
const ax=analyzeDocuments([x],structuredClone(DEFAULT_SOURCE_RULES),'Op'), rx=ax.rows[0];
eq([rx.dpe_energy_before,rx.dpe_ges_before,ax.uncertain.find(u=>u.field==='construction_year')?.value],['D','D',1970],'XML DPE : classes lues, état initial (référence « INITIAL »)');
// En-têtes de tableau et légendes : pas des bâtiments.
const t=prep(textDoc('t1','Notice thermique FICTIVE.pdf',null,'Notice thermique\nBatiment J L M N O P Q Total\nbatiment de la valeur du batiment\nbatiment Conforme\nBatiment Etiquette DPE\nBatiment J\nUbat projet 0.47'));
eq(t.buildings.names.filter(b=>/Total|valeur|Conforme|Etiquette/i.test(b)),[],'noms parasites écartés');
console.log(`v2.14.0 — ${n} vérifications OK (données fictives)`);
