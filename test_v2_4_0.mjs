// ExtracTerre v2.4.0 — parseurs rénovation réécrits. Documents FICTIFS reproduisant la mise en page des éditions réelles
// (Pléiades RT existant multi-bâtiments, fiche RSET Th-C-E ex en lettres espacées, ClimaWin, U48Win, DPE 2021, notices,
// livret d'opération), fusion « Logement N » → « Logements N et M », OCR forcé sur couche texte chiffrée.
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments,applyComparisonBases} from './js/engine.js';
import {normalizeText} from './js/utils.js';
import {shouldOcrPdfPage} from './js/readers.js';
import {dpeClasses} from './js/dpe-3cl.js';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION, '2.7.5','version');
const mk=(name,pages)=>{ const ps=pages.map((ls,k)=>{ const lines=ls.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12,items:[{text:normalizeText(t),x:40}]})); return {page:k+1,text:lines.map(l=>l.text).join('\n'),lines}; });
  const read={kind:'pdf',pages:ps,text:ps.map(p=>p.text).join('\n\f\n'),pageCount:ps.length}; const c=classifyDocument(name,read.text,{kind:'pdf'});
  const d={id:name,name,read,familyMode:'auto',status:'ready',classification:{...c,automaticType:c.type},type:c.type}; d.buildings=detectBuildings(d); d.cachedOccurrences=parseDocument(d); return d; };
const fin=(docs)=>analyzeDocuments(docs,structuredClone(DEFAULT_SOURCE_RULES));
const get=(r,b,f)=>r.finals.filter(o=>o.field===f&&o.building===b).map(o=>o.value);

// 1. Pléiades RT existant, deux bâtiments, colonne « initial » vide pour l'un (« kWh ep/m² 165.126 232.281 165.00 »).
const H='Pleiades, version 6.24.7.4';
const pl=mk('Etude RT ex fictive.pdf',[
  ['Departement : 45 - Loiret (H1 b)','1 Resultats RT Existant suivant la methode THCE - Ex','1.1 Batiment B','Cep Initial Projet Reference Max(CH,ECS,FR)','kWh ep/m² 196.6 82.2 110.1 130.0',
   'Decomposition du Cep (hors prod. ENR) Projet: 82.37 kWhEP/m².an','Chauffage (40.1kWh/m², 49%)','Aux. generation (8.4kWh/m², 10%)','Aux. ventilation (2.2kWh/m², 3%)','ECS (25kWh/m², 30%) Eclairage (6.7kWh/m², 8%)',
   'Conformite au label BBC reno 2009 habitat','Coefficient Cep 82.2 kWh ep/m²','Cep max 104 kWh ep/m²','Energie : Classe equivalente C : 102kWhEP/m²SHAB.an','CO2 : Classe equivalente C : 19kgCO2/m²SHAB.an',
   'Exigence de resultat : Tic','Projet Reference','Groupe - Logements Traversants BAT B 25.61 °C 26.84 °C','Groupe - Logements NON traversants BAT B 25.34 °C 27.15 °C','Detail des consommations (energie finale)',
   'Consommation totale type electrique kWh 5709.3 10526.2 13286.7','dont chauffage electrique kWh 0.0 0.0 0.0','dont chauffage autres sources kWh 224425.4 62949.6 96940.2','dont ECS electrique kWh 0.0 0.0 0.0','dont ECS autres sources kWh 46943.4 39243.8 41830.3',
   'Production d\'electricite a demeure kWh 0.0 0.0',H],
  ['1.2 Batiment C','Cep Initial Projet Reference Max(CH,ECS,FR)','kWh ep/m² 165.126 232.281 165.00','Coefficient Cep 165.126 kWh ep/m²','Exigence de resultat : Tic','Groupe C 27.51 °C 32.9 °C','Detail des consommations (energie finale)',
   'Consommation totale type electrique kWh 77826.828 109478.648','dont chauffage electrique kWh 40397.122 69146.567','dont ECS electrique kWh 33837.321 34161.588',
   '2 Enveloppe thermique du batiment','2.1 Batiment B','Ubat (hiver) W/m2.K 0.951 0.631 0.818','2.2 Batiment C','Ubat (hiver) W/m2.K 0.423 0.598',H],
  ['3 Bibliotheques projet','3.1 Compositions de paroi','11 ME non isole','Type de paroi Paroi verticale','Nature de paroi Mur exterieur','Beton plein (lourd) 16.0 2.000 2450 0.278 12.50 0.08','Total 12.50 0.08',
   'Mur Ext. ITE - R=5.33','Type de paroi Paroi verticale','Nature de paroi Mur exterieur','Laine de bois th39 18.0 0.039 460 0.583 0.22 4.62','Beton plein 17.4 1.750 2300 0.256 10.06 0.10','Total 0.19 5.33',
   'Toiture terrasse - R=7.25','Type de paroi Plancher haut','Nature de paroi Terrasse','IKO enertherm KR ALU 1 16.0 0.022 30 0.4 0.14 7.25','Total 0.13 7.25',
   'P-Fen PVC DV 4.16.4 (Baie)','Type de baie Fenetre','Type de cadre Bois','Nom codifie DV 4/16/4 GC Argon','Type de','protection Motorisee','Protection Volet roulant PVC motorise (ep <',
   '4 Bibliotheque d\'equipements','4.1 Generateurs','Chaudiere gaz a condensation:Varmax 450','Gaz Gaz naturel',H],
  ['5 Caracteristiques du projet','5.1 Environnement','5.2 Batiment B','Annee de construction 1973','Zone Traversante BAT B','Nombre de logements 9','Surface habitable en residentiel ou SHON pour autre','627.87 m²','usage',
   'Zone Non traversante BAT B','Nombre de logements 11','Surface habitableen residentiel ou SHON pour autre usage 604.98 m²','5.3 Batiment C','Annee de construction 1983','Nombre de logements 13',
   '5.4 Systemes de chauffage, ecs et climatisation','Chaudiere Collective - VARMAX (Exterieur ou tampon non dessine)','5.5 Systemes de ventilation','Groupe - Logements Traversants BAT B - HELYS','CONDUIT_9','Surface desservie 78.48',
   'Systeme de ventilation initiale Ventilation naturelle par conduit','Nouveau systeme de ventilation Residentiel: Ventilation hybride',H]]);
eq(pl.buildings.names,['Bâtiment B','Bâtiment C'],'Pléiades : un bâtiment par section « 1.N »');
const pr=fin([pl]); const B='Bâtiment B', C='Bâtiment C';
eq([get(pr,B,'cep_before')[0],get(pr,B,'cep_after_final')[0],get(pr,B,'cep_max')[0],get(pr,B,'cep_gain')[0]],[196.6,82.2,196.6,58.2],'Cep initial / projet ; Cep Ref = Cep initial, gain sur l’état initial');
eq([get(pr,C,'cep_before').length,get(pr,C,'cep_after_final')[0],get(pr,C,'cep_max')[0]],[0,165.126,232.281],'colonne initiale absente : rien en avant travaux, projet et référence décalés');
eq([get(pr,B,'tic')[0],get(pr,B,'tic_ref')[0]],[25.61,26.84],'Tic du groupe le plus chaud');
eq([get(pr,B,'cep_lighting')[0],get(pr,B,'cep_aux_dist')[0],get(pr,B,'cep_gas')[0],get(pr,B,'cep_electricity')[0]],[6.7,8.4,65.1,17.3],'deux postes sur une ligne, Cep par énergie');
eq([get(pr,B,'heating_vector_after')[0],get(pr,B,'heating_mode_after')[0],get(pr,C,'heating_vector_after')[0]],['Gaz','Chaudière condensation','Électricité'],'énergie par bâtiment');
eq([get(pr,B,'ubat_before')[0],get(pr,B,'ubat_after')[0],get(pr,C,'ubat_after')[0],get(pr,C,'ubat_before').length],[0.951,0.631,0.423,0],'Ubat : deux colonnes = projet / référence');
eq([get(pr,B,'housing_count')[0],get(pr,B,'shab')[0],get(pr,B,'cross_ventilated')[0],get(pr,B,'non_cross_ventilated')[0],get(pr,C,'construction_year')[0]],[20,1232.85,9,11,1983],'zones : logements, surfaces, traversants');
eq([get(pr,B,'wall_insulation')[0],get(pr,B,'wall_insulation_thickness')[0],get(pr,B,'wall_structure')[0],get(pr,B,'roof_insulation')[0]],['Fibre de bois',180,'Béton armé','PUR'],'paroi rénovée (le mur non isolé est écarté), marque IKO enertherm = PUR');
eq([get(pr,B,'window_material')[0],get(pr,B,'window_shading')[0],get(pr,B,'ventilation')[0]],['PVC','Volet roulant','Ventilation hybride'],'baie (titre PVC), « protection Motorisee » ignorée, ventilation du groupe');
eq(get(pr,B,'ventilation_before')[0],'Ventilation naturelle','ventilation initiale du groupe (colonne « Ventilation avant travaux »)');
eq([get(pr,B,'ubat_before')[0],get(pr,B,'ubat_after')[0],get(pr,B,'ubat_ref')[0],get(pr,B,'ubat_gain')[0]],[0.951,0.631,0.951,33.6],'Ubat Ref = Ubat initial, gain sur l’état initial');
eq(get(pr,B,'ges')[0],19,'GES projet (étiquette CO2 en kgCO2/m²SHAB.an)');
// Référence de comparaison : initial s'il est calculé, sinon référence du document ; une saisie manuelle n'est jamais remplacée.
{ const fz=(field,value,extra={})=>({field,value,building:'B1',docId:'d',fileName:'t.pdf',docType:'RT Existant',page:1,excerpt:'',confidence:0.95,method:'test',status:'retenu',...extra});
  const mkR=(row,fields)=>({rows:[{building:'B1',...row}],finals:fields.map(([f,v,x])=>fz(f,v,x)),detailed:[]});
  const r1=applyComparisonBases(mkR({cep_before:200,cep:80,cep_max:110,cep_gain:27.3},[['cep_before',200],['cep',80],['cep_max',110],['cep_gain',27.3]]));
  eq([r1.rows[0].cep_max,r1.rows[0].cep_gain],[200,60],'réno : Cep Ref = Cep initial, gain recalculé');
  ok(/référence du document : 110/.test(r1.finals.find(o=>o.field==='cep_max').provenanceNote),'la référence du document reste en note');
  const r2=applyComparisonBases(mkR({cep:80,cep_max:110,ubat_after:0.79,ubat_ref:0.967},[['cep',80],['cep_max',110],['ubat_after',0.79],['ubat_ref',0.967]]));
  eq([r2.rows[0].cep_max,r2.rows[0].ubat_ref,r2.rows[0].cep_gain],[110,0.967,undefined],'initial non calculé : la référence du document est conservée');
  const r3=applyComparisonBases(mkR({cep_before:200,cep:80,cep_max:120},[['cep_before',200],['cep',80],['cep_max',120,{method:'manual:override',docType:'Correction manuelle'}]]));
  eq(r3.rows[0].cep_max,120,'Cep Ref saisi à la main : jamais remplacé');
  const r4=applyComparisonBases(mkR({ges_before:50,ges:19},[['ges_before',50],['ges',19]]));
  eq([r4.rows[0].ges_ref,r4.rows[0].ges_gain],[50,62],'GES Ref = GES initial, gain GES'); }

// 2. Fiche RSET Th-C-E ex (édition Pléiades, lettres espacées).
const rs=mk('Fiche RSET fictive.pdf',[
  ['Reglementation Thermique Existante','Fichier standardise des caracteristiques thermiques d\'une construction Existante','De pa rte m ent : 45','FEUILLET BATIMENT (Collectif)','Ide ntifia nt Collectif - (Collectif)',
   'Surfa ce utile ou habitable (m2) 222.02','SHO N re no ve e (m2) 315.37','Anne e de la co nstructio n 1975','Nom bre de lo ge m e nts 4','Coefficient Cep 445.24 93.94 -351.31 -78.9% 175.7 -81.76 -46.54%',
   'C onso m m atio n to tale e le ctrique 2221.434 11482.597 9261.16 416.90% 21476.833 -9994.236 -46.53%','dont chauffage a utre s so urce s 97677.041 0 -97677.04 -100.00% 0 0 -','dont e cla ira ge 836.02 808.477 -27.54 -3.29% 752.126 56.351 7.49%',
   'Partie de batiment de type CE1 Unite Tic (a) Tic Ref (b) (a-b)','Groupe collectif °C 24.41 28.77 -4.36','Nive a u de pe rfo rm a nce : BBC reno 2009 habitat','Coefficient Cep k W h-e p/m2SHO N 93.94 104 -10.06',
   'Ubat (hive r) 1.19 0.6 -0.59 0.64 -0.038','Parois opaques :','Pa ro is Ma rqua ge C E','m ur e x te rie ur e x te rie urs P SE 19 6.16 90.85 - 0.15 7.12 0.36 -0.21','ve rticale s syste m e 1+',
   'Fene tre a ve c 1.1 PVC 10.44 - 1.7 9.27 1.8 -0.1'],
  ['FEUILLET EQUIPEMENT (Collectif - ID : 2)','Surfa ce to tale utile de la zone','(m2) 222.02','2 - DЉЈЈШϿИ ИЏК ІϿИ (CЉІІϿϽУГЕ)','Type d\'energie :','Initial Projet','e le ctrique a e ffe t jo ule no n no n','e le ctrique the rm odyna m ique no n o ui','gaz o ui no n','fioul no n no n','so la ire no n no n','R ese a ux cha leur no n no n','bois no n no n',
   '4 - DЉЈЈШϿИ ИЏК І\'ϿϻЏ (CЉІІϿϽУГЕ)','Type d\'energie :','Initial Projet','e le ctrique a e ffe t jo ule no n oui','e le ctrique the rm odyna m ique no n no n','gaz o ui no n','fioul no n no n','so la ire no n no n','R ese a ux cha leur no n no n','bois no n no n',
   'FEUILLET GENERATION (Collectif)','3 - PКЉЄϿУ : NЉЏАϿϻЏВ','Type d\'e ne rgie - Electrique Electrique','Type de ge ne ra te ur - thermodynamique','C ate go rie ge ne ra te ur the rm odyna m ique - Compression electrique','[Exterieur] A ir exterieur - [Interieur]','Eau VCV']]);
const rr=fin([rs]); const K='Bâtiment COLLECTIF';
eq([get(rr,K,'shab')[0],get(rr,K,'construction_year')[0],get(rr,K,'housing_count')[0]],[222.02,1975,4],'libellés en lettres espacées');
eq([get(rr,K,'cep_before')[0],get(rr,K,'cep_after_final')[0],get(rr,K,'cep_max')[0],get(rr,K,'cep_gain')[0]],[445.24,93.94,445.24,78.9],'Cep (a) / (b) ; Cep Ref = Cep initial (a), gain sur l’état initial');
eq([get(rr,K,'cep_lighting')[0],get(rr,K,'tic')[0],get(rr,K,'ubat_after')[0]],[6.61,24.41,0.6],'éclairage recalculé (kWh × 2,58 / SHON), Tic, Ubat');
eq([get(rr,K,'heating_vector_before')[0],get(rr,K,'heating_vector_after')[0],get(rr,K,'ecs_vector_after')[0],get(rr,K,'ecs')[0],get(rr,K,'heating_mode_after')[0]],['Gaz','Électricité','Électricité','Ballon électrique','PAC air/eau'],'tableaux « oui / non » espacés, PAC air / eau');
eq([get(rr,K,'wall_insulation')[0],get(rr,K,'wall_insulation_r')[0],get(rr,K,'window_material')[0]],['PSE',6.16,'PVC'],'parois espacées');

// 3. DPE 2021 : classes recalculées, double seuil.
eq(dpeClasses(262.3,55.1),{energy:'E',ges:'E',energyOnly:'E'},'262 kWh / 55 kg → E / E'); eq(dpeClasses(69.9,13.5),{energy:'C',ges:'C',energyOnly:'A'},'étiquette = classe la plus défavorable');
const dp=mk('31_DPE fictif.pdf',[['diagnostic de performance n° :2445E0000000X','DPE energetique (logement) valable jusqu\'au :23/04/2034','mission : Residence fictive Maison n°30-T5','annee de construction : Entre 1974 et 1977','surface habitable : 97,00 m²','Ce logement emet5343kg de CO₂ par an, soit'],
  ['Montants et consommations annuels d\'energie','chauffage gaz naturel 20845 (20845 e.f.) entre1330€et1810€','eau chaude','gaz naturel 2421 (2421 e.f.) entre150€et210€','sanitaire','energie totale pour les 25443 kWh entre1710€et2340€'],
  ['Diverses solutions existent :','chauffage au bois','Les travaux essentiels','Mur exterieur ITE PSE 160mm R=5.10m²K/W ;']]);
const dr=fin([dp]); const L30='Bâtiment LOGEMENT 30';
eq([get(dr,L30,'dpe_energy_before')[0],get(dr,L30,'dpe_ges_before')[0],get(dr,L30,'heating_vector_before')[0],get(dr,L30,'ecs_vector_before')[0]],['E','E','Gaz','Gaz'],'DPE : état visité, énergies du tableau des consommations');
ok(!dp.cachedOccurrences.some(o=>/wall_insulation/.test(o.field)),'recommandations de travaux non lues');

// 4. Fusion : « Logement 30 » (DPE) rejoint « Logements 30 et 31 » (étude).
const grp=mk('Etude fictive 2.pdf',[['1 Resultats RT Existant suivant la methode THCE - Ex','1.1 Logements 30 et 31','Cep Initial Projet Reference Max(CH,ECS,FR)','kWh ep/m² 61.3 180.1 195.0','Coefficient Cep 61.3 kWh ep/m²',H]]);
const jr=fin([grp,dp]); const G='Bâtiment LOGEMENTS 30 ET 31';
eq([get(jr,G,'cep_after_final')[0],get(jr,G,'dpe_energy_before')[0],get(jr,G,'heating_vector_before')[0]],[61.3,'E','Gaz'],'logement isolé fusionné dans son groupe');

// 5. Notice de BE : tableau de synthèse, prose, chaudière existante remplacée.
const no=mk('Note thermique fictive.pdf',[['Calcul thermique selon methode THCEex','Rehabilitation fictive','1. SYNTHESE DES RESULTATS','Batiment A Batiment B','Cep Initial 196.8 196.7','Cep Projet 82.2 82.0','Ubat projet 0.631 0.631','Consommation equivalente DPE Initial','230 E 231 E','(kWh ep/m²SHAB)','Emission de gaz a effet de serre Initial','50 E 51 E'],
  ['3. HYPOTHESES DE CALCUL','3. 1. Isolation des murs','• Murs exterieurs facade & pignons : complexe ITE 18 cm de panneaux de fibre de bois','type Pavawall Smart λ=0.039 W/m²/K ou equivalent, R=4.6m².K/W.',
   '• Murs exterieurs Isolation reduit pour loggia : complexe ITE 10 cm de fibre de bois λ=0.039 W/m²/K','3. 2. Isolation des planchers','• Toitures terrasses : 16cm de polyurethane type Efigreen Duo+ λ=0.022 W/m²/K, ou equivalent R=7.27m².K/W.',
   '3. 4. Generation de chaleur chauffage et ECS','Remplacement de la chaudiere gaz existante par une chaudiere gaz a condensation type','Atlantic Varmax 450. La chaudiere produira le chauffage et l\'eau chaude sanitaire.',
   '3. 6. Ventilation','Mise en place d\'une VMC hygroreglable de type B.','(Bois non isolante) (Circulation chauffee)']]);
eq(no.buildings.names,['Bâtiment A','Bâtiment B'],'bâtiments de l\'en-tête du tableau de synthèse');
const nr=fin([no]); const A='Bâtiment A';
eq([get(nr,A,'cep_before')[0],get(nr,'Bâtiment B','cep_after_final')[0],get(nr,A,'dpe_energy_before')[0],get(nr,'Bâtiment B','dpe_ges_before')[0]],[196.8,82,'E','E'],'tableau de synthèse par bâtiment (valeurs « 230 E » à la ligne)');
const occ=no.cachedOccurrences; const ov=f=>[...new Set(occ.filter(o=>o.field===f).map(o=>o.value))];
eq([ov('wall_insulation')[0],ov('wall_insulation_thickness')[0],ov('wall_insulation_r')[0],ov('roof_insulation')[0],ov('roof_insulation_r')[0]],['Fibre de bois',180,4.6,'PUR',7.27],'prose : paroi courante (pas la loggia), R donné');
eq([ov('heating_vector_before')[0],ov('heating_mode_after')[0],ov('ecs_vector_after')[0],ov('ventilation')[0]],['Gaz','Chaudière condensation','Gaz','VMC Hygro B'],'générateur remplacé, production mixte, ventilation');
ok(!ov('heating_vector_after').includes('Bois / biomasse'),'légende « Bois non isolante » sans effet');

// 6. Livret d'opération Prestaterre (page de garde).
const lv=mk('Livret operation fictif.pdf',[['Prestaterre Certifications','LIVRET D\'OPERATION','MAITRE D\'OUVRAGE : BAILLEUR FICTIF','N° DE CONTRAT / OPERATION : 00009999 / OPE-009999','NOM DE L\'OPERATION : Rue Fictive','ADRESSE DE L\'OPERATION : 1 rue Fictive','78500 VILLE',
  'OUVRAGE : Logement collectif : 50 logement(s) - 1 batiment(s)','REFERENTIEL : BEE Logement Renovation – Version du 06/03/2023','MENTION(S) : Label BBC Effinergie Renovation (Version du 01/10/2021)','PROFIL SPECIFIQUE : Aucun'],
  ['Commentaire : Il est prevu au CCTP la mise en oeuvre d\'une VMC simple flux et d\'un ballon electrique.']]);
eq(lv.type,'Livret d\'opération','livret Prestaterre (et non étude RT existant)');
const lr=fin([lv]); const U='Bâtiment unique';
eq([get(lr,U,'internal_code')[0],get(lr,U,'housing_total')[0],get(lr,U,'department')[0],get(lr,U,'reference_name')[0],get(lr,U,'mention_effinergie')[0]],['OPE-009999',50,'78','BEE Logement Renovation','Oui'],'données administratives');
ok(!lv.cachedOccurrences.some(o=>o.field==='ventilation'||o.field==='ecs'),'remarques d\'évaluation non lues');

// 7. Couche texte chiffrée (police sans table Unicode) : OCR.
{ const g=['234567689:9;<8=>?6@7;AB6=CD;E9:896','FGHIGJKLMNOPQOKQGMRLQJMLHOKOHNRKGMNGSTJMLNIJKUGSTJMLQVTPJLHWPMNKTHNGWPLCD;E9:896','XJPLYTJLQJLZOLM[PNI\\MJLQVRNTQJLNIJKUGSTJ]LQTLHWPNK^ZJLJNLQTLQGO_PWMNGHLQJ','`JKaWKUOPHJLRPJK_RNGSTJb',
  'FGHIJL_RPRKRJLMJZWPLZJLMHIRUOLYJKMGWPLcLdefLgLJNLZOLaJTGZZJLQJLMN[ZJLYJKMGWPLcLfehij','~WPPRJMLOQUGPGMNKONGYJM','~WPPRJML_RPRKOZJMLMTKLZJLNGUJPN','~WPPRJMLMTKLZVJPYJZW``JLNIJKUGSTJ','~WPPRJMLMTKLZJML`OKWGML`KGPHG`OZJM'].join('\n');
  ok(shouldOcrPdfPage(g,Array.from({length:30},()=>({str:'x'})),'auto'),'couche « chiffrée » → OCR'); }
console.log(`v2.4.0 — ${n} vérifications OK (documents fictifs)`);
