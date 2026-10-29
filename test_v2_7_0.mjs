// ExtracTerre v2.7.0 — collage libre prioritaire, colonne Q4Pa-surf, export JSON de session, observatoire des recherches.
// Données FICTIVES au format d'une note de bureau d'études.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,FIELD_DEFS,FIELD_MAP,matchFieldByHeader} from './js/config.js';
import {unstackLabels,parseFreePaste,freePasteValues,freePastePrompt,applyFreePasteAi,looksLikeFreeText,matchFreeLabel} from './js/collage-libre.js';
import {sanitizeOccurrence} from './js/sanity.js';
import {buildBuildingGrouping,analyzeDocuments} from './js/engine.js';
import {DEFAULT_SOURCE_RULES,DOC_TYPES} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(v,m)=>{ assert.ok(v,m); n++; };
eq(APP_VERSION, '2.11.2','version');
const TXT=`Bâtiment X :
Nombre de logements = 30
Sref (ou Srt) = 2000,5
BBio = 60,1
Bbiomax = 70,2
Gain BBio = 14,4%
Cep = 40,0
Cepmax = 80,0
Gain Cep = 50%
Cepnr = 40,0
Cepnrmax = 70,0
Gain Cepnr = 42,9%
DH des zones traversantes (en °C.h) = 500,5
DH des zones non traversantes (en °C.h) = 800,8
IC Construction = 700,25
IC Energie = 45,5
Q4 Pa-surf = 0,8
Remarque libre sans valeur

Bat Y :
Nombre de logements = 12
Cep : 35,2
Commentaire : vérifié le 12/03`;
ok(looksLikeFreeText(TXT)&&!looksLikeFreeText('Code interne\tNom opération\tCep\nOPE-1\tX\t40'),'texte libre ≠ tableau Excel');
const p=parseFreePaste(TXT); const v=freePasteValues(p);
eq(v.map(x=>x.building),['Bâtiment X','Bâtiment Y'],'bâtiments reconnus (« Bat Y » → « Bâtiment Y »)');
eq(v[0].values,{housing_count:30,shab:2000.5,bbio:60.1,bbio_max:70.2,bbio_gain:14.4,cep:40,cep_max:80,cep_gain:50,cepnr:40,cepnr_max:70,cepnr_gain:42.9,dh:800.8,dh_zt:500.5,dh_znt:800.8,cross_ventilated:'Oui',non_cross_ventilated:'Oui',ic_construction:700.25,ic_energy:45.5,q4pa_surf:0.8},'toutes les lignes rangées (DH = zone la plus défavorable)');
eq(v[1].values,{housing_count:12,cep:35.2},'bâtiment Y');
eq(p.unmatched.map(u=>u.line),['Commentaire : vérifié le 12/03'],'ligne avec chiffre non reconnue gardée pour l’IA ; remarque sans chiffre = texte descriptif');
eq(v[0].sources.cep,'Cep = 40,0','ligne source conservée (traçabilité)');
// IA : la colonne doit exister, la valeur est relue dans la ligne (jamais celle inventée par l'IA)
const q=parseFreePaste('Bâtiment Z :\nPerméabilité mesurée Q4 0,6 m3/h.m2\nTruc = 5');
ok(/q4pa_surf/.test(freePastePrompt(q.unmatched).system)&&/Perméabilité/.test(freePastePrompt(q.unmatched).user),'prompt : colonnes + lignes collées seulement');
const ix=re=>q.unmatched.findIndex(x=>re.test(x.line))+1;
const added=applyFreePasteAi(q,{lines:[{n:ix(/Perméabilité/),field:'q4pa_surf',value:'0,6'},{n:ix(/Truc/),field:'champ_invente',value:'5'},{n:ix(/Truc/),field:'cep',value:'999'}]});
eq([added,freePasteValues(q)[0].values],[2,{q4pa_surf:0.6,cep:5}],'colonne inventée refusée ; valeur relue dans la ligne (5, pas 999)');
// Colonne Q4Pa-surf en fin d'export, en-têtes courts
eq([FIELD_DEFS.filter(f=>!f.hidden).findIndex(f=>f.key==='q4pa_surf'),FIELD_MAP.q4pa_surf.type],[193,'number'],'194e colonne d’export Q4Pa-surf (DH ZT / DH ZNT à la place de DH)');
eq(['Sref (ou Srt)','Cepnrmax','Q4 Pa-surf'].map(matchFreeLabel),['shab','cepnr_max','q4pa_surf'],'libellés courts');
eq([sanitizeOccurrence({field:'q4pa_surf',value:45,method:'generic:label',excerpt:'Q4 45'}),sanitizeOccurrence({field:'q4pa_surf',value:0.8,method:'generic:label',excerpt:'Q4Pa-surf 0,8'})?.value],[null,0.8],'Q4 borné');
// Interface : collage libre prioritaire, export JSON, observatoire
const app=fs.readFileSync('./js/app.js','utf8'), html=fs.readFileSync('./index.html','utf8'), obs=fs.readFileSync('./observatoire.html','utf8');
ok(/method:'manual:free-paste'/.test(app)&&/state\.manualValues\[key\]=value/.test(app),'collage libre appliqué comme correction manuelle (prioritaire)');
ok(/function sessionSnapshot\(/.test(app)&&/format:'extracterre-session'/.test(app)&&/id="exportSessionBtn"/.test(html),'export JSON de session');
ok(/id="observatoryBtn"/.test(html)&&/extracterre\.observatoire\.feed/.test(app)&&/extracterre\.observatoire\.feed/.test(obs),'observatoire alimenté par ExtracTerre');
ok(/const esc=/.test(obs)&&!/innerHTML=[^;]*\$\{o\.identity\.name\}/.test(obs),'observatoire : textes échappés');
// v2.7.1 — fiche de synthèse : en-têtes « Maison 1-01 : », partie descriptive (enveloppe, systèmes) pour toutes les maisons.
const FICHE=`Maison 1-01 :
Nombre de logements = 1
Cep = 59,3
DH des zones traversantes = 561,9
DH des zones non traversantes =
Maisons 1-03 1-04 :
Nombre de logements = 2
Cep = 59,1
Performance thermique - Notes
Maison 1-01 :
Nombre total de logements = 1
Total des surfaces de planchers bas = 51
Planchers hauts
-COMBLES PERDUS -
Laine de verre ISOCONFORT 35 - Épaisseur : 380 mm - Performances : R= 10,85 m2.K/W
> Lot 03 — Page 35
Planchers hauts - Notes
R= 10,85 m2.K/W (favorable)
Parois verticales
- MURS SUR EXTERIEUR -
Maçonnerie courante - Épaisseur : 200 mm - Performances : R= 0,30 m2.K/W
DOUBLISSIMO CONFORT - Épaisseur : 153 mm - Performances : R= 4,75 m2.K/W
Planchers bas
Entrevous en hourdis en polystyrène expansé isolant - Épaisseur : 230 mm - Performances : Up= 0,180 W/m2.C
Isolant sous chape TMS SOPREMA - Épaisseur : 56 mm - Performances : R= 2,60 m2.K/W
Menuiseries extérieures
Châssis PVC gris clair RAL 7035 avec vitrage isolant 4+16+4 VIR
- Uf = 1.80 W/m².K.
Volets roulants tablier aluminium double paroi - Performances : Uc= Non précisé
Chauffage
Pompe à chaleur air/eau split inverter avec module hydraulique mural R32 - Marque : ATLANTIC
Renouvellement d'air
Groupe d'extraction hygroréglable suspendu en combles - Marque : ATLANTIC - Modèle : HYGROCOSY BC 2
Énergies renouvelables
Sans Objet`;
const fv=freePasteValues(parseFreePaste(FICHE));
eq(fv.map(x=>x.building),['Maison 1-01','Maisons 1-03 1-04'],'en-têtes « Maison … : » (section répétée fusionnée)');
eq([fv[0].values.cep,fv[0].values.dh,fv[0].values.housing_total,fv[1].values.cep],[59.3,561.9,1,59.1],'valeurs par maison ; « DH … = » vide ignoré');
const env=k=>fv.map(x=>x.values[k]);
eq([env('roof_insulation_r')[1],fv[1].values.roof_insulation_thickness,fv[1].values.wall_insulation,fv[1].values.wall_insulation_r,fv[1].values.wall_structure],[10.85,380,'DOUBLISSIMO CONFORT',4.75,'Maçonnerie courante'],'enveloppe lue dans la fiche, appliquée à chaque maison');
eq([fv[0].values.floor_insulation_thickness,fv[0].values.floor_insulation_r,fv[0].values.structure],[56,2.6,undefined],'plancher bas : ligne de l’isolant (56 mm, R 2,6) ; pas de « Structure » tirée des hourdis');
eq([fv[0].values.window_material,fv[0].values.window_glazing,fv[0].values.window_shading,fv[0].values.heating_mode_after,fv[0].values.ventilation,fv[0].values.enr],['PVC','4.16.4','Volet roulant','PAC air/eau','VMC Hygro B','Non'],'menuiseries, chauffage, ventilation, ENR');
ok(/reportées sur tous les bâtiments de l'analyse/.test(app)&&/if\(ownByTarget\[b\]\?\.has\(field\)\) continue;/.test(app),'« toute l’opération » sur tous les bâtiments, sauf valeur propre au bâtiment');
ok(/const find=k=>groups\.flatMap\(g=>g\.entries\)/.test(app)&&/acceptCandidate\(\{\.\.\.c,field:k,building:B\}\)/.test(app),'revue : validation trouvée dans tous les groupes, appliquée au champ et au bâtiment affichés');
ok(/créé\(s\) : /.test(app)&&/reviewState\.filter='done'/.test(app),'collage : bâtiments créés signalés, revue ouverte sur les champs renseignés');
const grp=buildBuildingGrouping([{type:'RSET RE2020',buildings:{names:['Bâtiment MAISON 1']}}],[{building:'Bâtiment MAISON 1-01',pinnedBuilding:true},{building:'Bâtiment MAISON 1-02',pinnedBuilding:true}],{});
eq(grp.aliases.filter(a=>a.mode==='collage').map(a=>a.target),['Bâtiment MAISON 1-01','Bâtiment MAISON 1-02'],'bâtiments collés créés tels quels, jamais fusionnés automatiquement');
ok(/pinnedBuilding:!!r\.building/.test(app)&&/p\.deletedBuildings=p\.deletedBuildings\.filter/.test(app)&&/if\(state\.homeView\)\{ toast\('Texte libre/.test(app),'collage : bâtiments épinglés, suppression levée, refus depuis l’accueil');
// v2.9.0 — donnée manuelle définitive : un RSET (DH le plus défavorable, rang 1) ne la remplace pas.
const rsetDoc={id:'r',name:'RSET.xml',type:DOC_TYPES.RSET_RE2020,status:'ready',buildings:{names:['Bâtiment A']},cachedOccurrences:[]};
const occ=(value,extra)=>({field:'dh',value,building:'Bâtiment A',docId:'r',fileName:'RSET.xml',docType:DOC_TYPES.RSET_RE2020,page:1,excerpt:'DH',confidence:.99,method:'rset:dh-row',...extra});
const res=analyzeDocuments([{...rsetDoc,cachedOccurrences:[occ(900)]}],DEFAULT_SOURCE_RULES,'Op',{},[occ(300,{docId:'m',fileName:'Excel',docType:DOC_TYPES.MANUAL,method:'manual:excel-paste',userValidated:true,manualDefinitive:true})]);
eq(res.rows.find(r=>r.building==='Bâtiment A')?.dh,300,'collage Excel définitif : prime sur le DH RSET plus défavorable');
ok(/function manualRow\(/.test(app)&&/data-rv-unset/.test(app)&&/function removeManualValue\(/.test(app),'donnée manuelle suivie après fusion, bâtiment recréé, suppression manuelle depuis la revue');
// v2.9.0 — fiche Salesforce (libellé / valeur sur deux lignes), données FICTIVES.
const SF=`Détails\nCode interne\nModifier Code interne\nOPE-009999\nContrat: Numéro du contrat\nC-2026-0042\nNombre de logements\n24\nPropriétaire\nJean Test\nChauffage collectif au gaz`;
const sf=freePasteValues(parseFreePaste(SF))[0]?.values||{};
eq([sf.internal_code,sf.contract_number,sf.housing_count,Object.keys(sf).length],['OPE-009999','C-2026-0042',24,3],'Salesforce : paires libellé/valeur, aide « Modifier » ignorée, rien deviné dans le reste de la page');
eq(unstackLabels(TXT).pairs,0,'texte « libellé = valeur » inchangé');
ok(/function confirmManualChange\(/.test(app)&&(app.match(/confirmManualChange\(/g)||[]).length>=7&&/const keepOld=conflicts\.length>0&&!confirm/.test(app),'modification d’une donnée manuelle : validation demandée partout');
ok(/getDisplayMedia/.test(app)&&/#sf=/.test(app)&&/history\.replaceState/.test(app),'capture OCR et bouton de favoris, texte effacé de l’adresse');
const relay=fs.readFileSync(new URL('./relay.html',import.meta.url),'utf8');
ok(/'relay\.html'/.test(app)&&/new BroadcastChannel\('extracterre-import'\)/.test(app)&&/BroadcastChannel\('extracterre-import'\)/.test(relay)&&/type:'ack'/.test(app),'favori : relais vers l’onglet ExtracTerre déjà ouvert');
ok(/function pickOcrZone\(/.test(app)&&/displaySurface:'browser'/.test(app),'capture OCR : choix de l’onglet puis de la zone');
console.log(`v2.9.0 — ${n} vérifications OK (données fictives)`);
