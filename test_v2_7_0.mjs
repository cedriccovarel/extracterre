// ExtracTerre v2.7.0 — collage libre prioritaire, colonne Q4Pa-surf, export JSON de session, observatoire des recherches.
// Données FICTIVES au format d'une note de bureau d'études.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,FIELD_DEFS,FIELD_MAP,matchFieldByHeader} from './js/config.js';
import {parseFreePaste,freePasteValues,freePastePrompt,applyFreePasteAi,looksLikeFreeText,matchFreeLabel} from './js/collage-libre.js';
import {sanitizeOccurrence} from './js/sanity.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(v,m)=>{ assert.ok(v,m); n++; };
eq(APP_VERSION, '2.7.1','version');
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
eq(v[0].values,{housing_count:30,shab:2000.5,bbio:60.1,bbio_max:70.2,bbio_gain:14.4,cep:40,cep_max:80,cep_gain:50,cepnr:40,cepnr_max:70,cepnr_gain:42.9,dh:800.8,cross_ventilated:'Oui',non_cross_ventilated:'Oui',ic_construction:700.25,ic_energy:45.5,q4pa_surf:0.8},'toutes les lignes rangées (DH = zone la plus défavorable)');
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
eq([FIELD_DEFS.length,FIELD_DEFS.at(-1).key,FIELD_MAP.q4pa_surf.type],[193,'q4pa_surf','number'],'193e colonne Q4Pa-surf');
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
console.log(`v2.7.1 — ${n} vérifications OK (données fictives)`);
