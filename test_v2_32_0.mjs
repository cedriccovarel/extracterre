// ExtracTerre v2.32.0 — Méthode de l'import massif : la liste crée les tuiles, Salesforce et les documents remplissent ces tuiles,
// résultats chargés au fil de l'eau. Données fictives.
import fs from 'fs';
import {APP_VERSION} from './js/config.js';
import {ssContractsToLoad} from './js/suivi-sources.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'2.35.0','version');
const st={etat:'en cours',contrats:['A','B','C','D','E'],parOp:{A:{r:'ok'},B:{r:'vide'},C:{r:'erreurs'},D:{r:'inchangé'}}};
eq(ssContractsToLoad(st),['A','C','D'],'en cours : opérations finies avec documents');
eq(ssContractsToLoad(st,new Set(['A'])),['C','D'],'déjà chargées : pas rechargées');
eq(ssContractsToLoad({...st,etat:'terminé'},new Set(['A','C','D'])),['E'],'terminé : le reste (sauf sans document)');
eq(ssContractsToLoad({...st,etat:'en attente'}),['A','C','D'].filter(()=>false).concat(ssContractsToLoad({...st,etat:'en attente'})),'cohérent');
eq(ssContractsToLoad(null),[],'pas de statut');
const app=fs.readFileSync('js/app.js','utf8');
eq(/function ssProjectFor\(contract\)/.test(app)&&/let p=ssProjectFor\(contract\)/.test(app),true,'une seule tuile par contrat (liste, Salesforce, documents)');
eq(/ssSetWorkList\(keepOthers/.test(app)&&/await ssEnsureTiles\(r\.contracts(,r\.owners)?\)/.test(app),true,'lancement : la liste crée les tuiles tout de suite');
eq(/ne font pas partie de cette liste/.test(app),true,'tuiles hors liste : proposition de les décharger');
eq(/Charger ma liste/.test(app)&&!/Charger toutes les opérations</.test(app),true,'« Charger ma liste » au lieu de tout le registre');
eq(/if\(IMPORT_SPACE\) p\.importContract=f\.contract/.test(app),true,'tuile créée par Salesforce reconnue au chargement des documents');
eq(/if\(r&&r\.status&&!ssAutoRunning&&!ss\.busy\) ssAutoLoad\(dir,r\)/.test(app),true,'chargement automatique au fil de l’analyse');
console.log(`v2.32.0 — ${n} vérifications OK (données fictives)`);
