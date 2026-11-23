// ExtracTerre v3.0.5 — grille Sécurité, règles v4 (validées le 19/11/2026) : portes d'escalier, sas, porte piétonne. Documents fictifs.
import {APP_VERSION} from './js/config.js';
import {SECURITY_GRID,normalizeGrid,runSearchGrid} from './js/recherches.js';
let n=0; const eq=(a,b,m)=>{ if(a!==b) throw new Error(`${m} : ${a} ≠ ${b}`); n++; };
eq(APP_VERSION>='3.0.5',true,'version'); eq(SECURITY_GRID.rulesVersion,4,'règles v4');
const doc=t=>[{id:'d',name:'CCTP Lot 08.pdf',type:'CCTP',status:'ready',read:{pages:[{page:1,text:t}]}}];
const st=(t,id)=>{ const x=runSearchGrid(SECURITY_GRID,doc(t)).criteria[id]; return x.partial?'pa':x.found?'oui':x.contrary?'non':''; };
// Escaliers
eq(st("Les portes d'acces aux escaliers seront equipees d'un lecteur de badges Vigik.",'etage_escaliers'),'oui','badge');
eq(st("- Porte de l'escalier d'acces au parking (x1) au RDC : Avec\ncondamnation sur organigramme logements.",'etage_escaliers'),'oui','organigramme, phrase sur 2 lignes');
eq(st("Serrure sur organigramme pour :\nPorte d'acces a la cage d'escalier en R+4.",'etage_escaliers'),'oui','liste annoncée par « : »');
eq(st("Portes des cages d'escaliers : PF 1/2H - Sans condamnation.",'etage_escaliers'),'non','sans condamnation = contraire');
eq(st("Fixation par platines rondes chevillees sur marches escalier.",'etage_escaliers'),'','platine de fixation');
eq(st("Telecommande : par coup de poing verre a briser, au niveau de l'acces de l'escalier",'etage_escaliers'),'','désenfumage');
eq(st("Mesures conservatoires au droit des portes d'acces aux escaliers pour lecteurs de badges",'etage_escaliers'),'','mesure conservatoire');
eq(st("Les portes des escaliers a R.d.C. debattent a 180°.\n10.3.2 SERRURE DE SURETE",'etage_escaliers'),'','titre suivant hors phrase');
// Sas
eq(st("La porte interieure du sas d'entree sera controlee par lecteur de badge type Vigik.",'hall_sas'),'oui','sas badge');
eq(st("Platine Vigik et lecteur.\nLocalisation : Sas d'entree.",'hall_sas'),'','localisation seule');
eq(st("3.4.4 Ensembles vitres du sas halls d'entree.................. 39",'hall_sas'),'','sommaire');
// Porte piétonne
eq(st("• 1 lecteur sur le portillon d'acces au parking",'parking_pieton'),'oui','lecteur portillon');
eq(st("Organigramme : portillons d'entree et sortie parking, toutes les cles seront reperees",'parking_pieton'),'','clés');
// Migration : un terme ajouté par l'utilisateur est gardé.
const v3=JSON.parse(JSON.stringify(SECURITY_GRID)); v3.rulesVersion=3; const c=v3.criteria.find(x=>x.id==='etage_escaliers'); c.context=['badge','monterme']; delete c.contextMode;
const g=normalizeGrid(v3), m=g.criteria.find(x=>x.id==='etage_escaliers'); eq(g.rulesVersion,4,'migration v4'); eq(m.contextMode,'phrase','phrase'); eq(m.context.includes('monterme'),true,'terme utilisateur gardé');
console.log(`v3.0.5 — ${n} vérifications OK (documents fictifs)`);
