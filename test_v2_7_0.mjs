// ExtracTerre v2.7.0 — collage libre prioritaire, colonne Q4Pa-surf, export JSON de session, observatoire des recherches.
// Données FICTIVES au format d'une note de bureau d'études.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,FIELD_DEFS,FIELD_MAP,matchFieldByHeader} from './js/config.js';
import {parseFreePaste,freePasteValues,freePastePrompt,applyFreePasteAi,looksLikeFreeText,matchFreeLabel} from './js/collage-libre.js';
import {sanitizeOccurrence} from './js/sanity.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(v,m)=>{ assert.ok(v,m); n++; };
eq(APP_VERSION,'2.7.0','version');
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
eq(p.unmatched.map(u=>u.line),['Remarque libre sans valeur','Commentaire : vérifié le 12/03'],'lignes non reconnues gardées pour l’IA ou la saisie');
eq(v[0].sources.cep,'Cep = 40,0','ligne source conservée (traçabilité)');
// IA : la colonne doit exister, la valeur est relue dans la ligne (jamais celle inventée par l'IA)
const q=parseFreePaste('Bâtiment Z :\nPerméabilité mesurée Q4 0,6 m3/h.m2\nTruc = 5');
ok(/q4pa_surf/.test(freePastePrompt(q.unmatched).system)&&/Perméabilité/.test(freePastePrompt(q.unmatched).user),'prompt : colonnes + lignes collées seulement');
const added=applyFreePasteAi(q,{lines:[{n:1,field:'q4pa_surf',value:'0,6'},{n:2,field:'champ_invente',value:'5'},{n:2,field:'cep',value:'999'}]});
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
console.log(`v2.7.0 — ${n} vérifications OK (données fictives)`);
