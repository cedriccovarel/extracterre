// ExtracTerre v2.41.0 — grille Sécurité : règles v2 (faux positifs / faux négatifs relevés sur des opérations réelles) et
// termes contenant une virgule ({0,40}) qui n'étaient plus coupés par l'éditeur.
import assert from 'node:assert/strict';
import {normalizeGrid,runSearchGrid,SECURITY_GRID} from './js/recherches.js';
let n=0; const ok=(c,m)=>{ assert.ok(c,m); n++; };
// 1) virgules dans les expressions : découpe et recollage des grilles déjà abîmées
const broken=normalizeGrid({id:'x',criteria:[{id:'a',label:'A',keywords:['re:serrure[^\\n]{0','40}3\\s*points','re:cr[eé]mone[^\\n]{0','15}3\\s*points[^\\n]{0','40}a2p','autre']}]});
assert.deepEqual(broken.criteria[0].keywords,['re:serrure[^\\n]{0,40}3\\s*points','re:cr[eé]mone[^\\n]{0,15}3\\s*points[^\\n]{0,40}a2p','autre']); n++;
const edited=normalizeGrid({id:'x',criteria:[{id:'a',label:'A',keywords:'re:serrure[^\\n]{0,40}3\\s*points, anti soulevement; blocage'}]});
assert.deepEqual(edited.criteria[0].keywords,['re:serrure[^\\n]{0,40}3\\s*points','anti soulevement','blocage']); n++;
// 2) une grille v1 enregistrée passe en v2 une fois ; une règle modifiée ensuite est gardée
const v1=JSON.parse(JSON.stringify(SECURITY_GRID)); delete v1.rulesVersion; v1.criteria.find(c=>c.id==='abords_aveugles').keywords=['locaux aveugles'];
const g=normalizeGrid(v1); ok(g.rulesVersion>=2&&g.criteria.find(c=>c.id==='abords_aveugles').keywords.length===0,'migration v2');
const mine=normalizeGrid({...g,criteria:g.criteria.map(c=>c.id==='abords_aveugles'?{...c,keywords:['mon terme']}:c)});
ok(mine.criteria.find(c=>c.id==='abords_aveugles').keywords[0]==='mon terme','règle utilisateur gardée');
// 3) cas relevés : texte → critère trouvé ou non
const doc=lines=>[{id:'d',name:'CCTP.pdf',status:'ready',read:{pages:[{page:1,text:lines.join('\n')}]}}];
const found=(id,lines)=>runSearchGrid(g,doc(lines)).criteria[id].found;
const yes=(id,lines)=>ok(found(id,lines)===true,`${id} doit être trouvé : ${lines.join(' / ')}`);
const no=(id,lines)=>ok(found(id,lines)===false,`${id} ne doit pas être trouvé : ${lines.join(' / ')}`);
yes('porte_3pts',['Porte palière','Serrure 3 points A2P* de chez BRICARD ou équivalent.']);
yes('fen_volets',['Volets roulants','Dispositif de blocage automatique et anti-soulèvement pour les volets situés au rez-de-chaussée']);
no('fen_volets',['Tablier de baignoire','Blocage du tablier sous la gorge de la baignoire par vérins']);
yes('fen_442',['Menuiseries du rez-de-chaussée','Vitrage feuilleté 44.2 retardateur d’effraction']);
no('fen_442',['Groupe > Baie > Tli_sp = 0.442']); no('fen_442',['Refend 26/7 Hall d’entrée B 2.44 2.96 W/m².K']);
no('fen_442',['Garde-corps : remplissage vitrage Stadip 44/2 minimum']);
yes('fen_barreaux',['Les grilles de défense sont à prévoir au niveau des salles de bains du RDC']);
no('fen_barreaux',['Remplissage en barreaudage métallique de 15 x 20 mm']); no('fen_barreaux',['Fenêtre avec barreaudage, éclairage, convecteur, prises de courant.']);
yes('abords_portails',['L’ouverture du portail du parking sera assurée par des télécommandes radio.']);
no('abords_portails',['Joint au mastic entre cadre dormant des portes, trappons et portillons']); no('abords_portails',['Pose horizontale vissée dans structures bois (claustra), métal (portail)']);
no('abords_acces_unique',['Cette clôture sera complétée par un portail provisoire largeur 5 ml servant d’accès unique au chantier']);
no('abords_observables',['zone d’expansion des crues maximales observables']);
no('abords_aveugles',['Les interrupteurs installés dans les locaux aveugles seront du type lumineux.']);
no('hall_traversant',['Groupe non traversant']); yes('hall_traversant',['Hall d’entrée non traversant']);
yes('hall_vitrage',['Ensemble de hall','Ouvrants vitrés, simple vitrage 44.2 avec parclose intérieure']);
no('hall_sas',['SAS PAS DE VIGIK ET BP V']); no('hall_sas',['Lecteurs de badges VIGIK aux sas sous-sol']);
yes('hall_sas',['Sas d’entrée : platine visiophone IK10 et lecteur Vigik']); ok(runSearchGrid(g,doc(['Sas d’entrée : platine visiophone et lecteur Vigik'])).criteria.hall_sas.partial===true,'sas partiel sans IK08');
no('hall_ik08',['Éclairage LED 8W – IP54 – IK08']); yes('hall_ik08',['La plaque de rue sera en inox, IP 54 / IK 10']);
no('hall_eclairage',['- 150 lux minimum pour les escaliers']); no('hall_eclairage',['luminosité : 10 à 2000 lux']); yes('hall_eclairage',['Hall d’entrée : 200 lux']);
no('parking_present',['Le projet ne prévoit pas de niveau de sous-sol.']); no('parking_present',['Le collecteur sera positionné sous l’ensemble du sous-sol']);
yes('parking_present',['Parking en sous-sol de 45 places']);
no('parking_portail',['Portail au niveau du parking réhabilité Non prévu']);
no('parking_ascenseur',['Alimentation ascenseur, VMC, contrôle d’accès, sous-sol']); yes('parking_ascenseur',['Ascenseur desservant le sous-sol','accès par lecteur de badge']);
no('parking_eclairage',['100 lux en tout point des circulations intérieures horizontales']); yes('parking_eclairage',['Parc de stationnement : 50 à 80 lux']);
no('etage_escaliers',['DAD escaliers, contrôle d’accès']); yes('etage_escaliers',['L’accès à chaque niveau depuis l’escalier est contrôlé par un lecteur de badge']);
no('etage_ascenseur',['Alimentation pour l’ascenseur et le contrôle d’accès']); yes('etage_ascenseur',['Il sera prévu un lecteur RFID dans chaque cabine ascenseur']);
yes('fen_volets',['- Dispositif de verrouillage ou anti soulèvement au RDC.']); yes('fen_volets',['Verrou automatique, clips anti-tempête et lames finale en alu laqué au RDC.']);
no('fen_volets',['Porte de garage : verrouillage automatique en position fermée interdisant l’ouverture manuelle']);
yes('abords_portails',['Le portail d’accès au hall principal sera contrôlé par des systèmes de clavier codé']); yes('abords_portails',['Il sera prévu un bip pour le portail et la porte d’accès au parking']);
yes('fen_barreaux',['Droit à barreaudage vertical hauteur 0,55 m posé en tableau']);
{ const r=runSearchGrid(g,[{id:'h',name:'11-CCTP ENSEMBLES DE HALLS.pdf',status:'ready',read:{pages:[{page:1,text:'Ouvrants vitrés, simple vitrage 44.2 avec parclose intérieure'}]}}]); ok(r.criteria.hall_vitrage.found,'nom du document = contexte (hall)'); }
{ const x=runSearchGrid(g,doc(['- Halls et circulations communes : 100 lux, - Escaliers : 150 lux,'])).criteria.hall_eclairage; ok(!x.found&&x.contrary&&x.values.join()==='100','hall 100 lux hors seuil, pas les 150 lux des escaliers'); }
{ const x=runSearchGrid(g,doc(['Hall d’entrée** 100 à 150 lux Lampes à ballast'])).criteria.hall_eclairage; ok(x.values.join()==='100','plage : première valeur'); }
{ const x=runSearchGrid(g,doc(['Le niveau d’éclairement doit être compris entre 50 et 80 lux dans les parcs de stationnement couverts.'])).criteria.parking_eclairage; ok(x.found&&x.values.join()==='50','parking 50 lux'); }
no('parking_eclairage',['100 lux en tout point des circulations intérieures horizontales']);
no('etage_ascenseur',['Ascenseur de chantier avec accès par badge']); no('abords_cloture',['Barrière Heras de chantier hauteur 2,00 m']); no('parking_ascenseur',['Monte-charge du sous-sol avec lecteur de badge']);
{ const d=[{id:'m',name:'CCTP Lot 08 MENUISERIES INTERIEURES.pdf',status:'ready',read:{pages:[{page:1,text:'- Serrure de sûreté 3 points A2P* ;'}]}}]; ok(runSearchGrid(g,d).criteria.porte_3pts.found,'serrure 3 points dans un CCTP menuiseries'); }
no('porte_3pts',['Serrure trois points pour les portes fenêtre du Rdc']); no('porte_3pts',['Joint à 3 points de compression, serrure 3 points']);
no('porte_3pts',['Elle intègre 2 trappes de visite intérieures','fermée par une serrure 3 points manœuvrée par clé.']);
yes('porte_3pts',['Blocs portes palières','Serrure multipoints A2P1*, encastrée dans le cadre']);
no('hall_eclairage',['devra être : égal ou supérieur à 20 lux, et 50 lux au droit des accès aux halls d’entrées.']);
no('porte_3pts',['Blocs portes palières','- P26-431 - Quincaillerie - Serrures de bâtiment - Serrures multipoint anti-effraction']);
{ const d=n=>[{id:'m',name:n,status:'ready',read:{pages:[{page:1,text:'- Le vitrage à mettre en œuvre sera un vitrage feuilleté en 44/2 clair'}]}}];
  ok(runSearchGrid(g,d('CCTP 07 MENUISERIES EXTERIEURES.pdf')).criteria.fen_442.found,'44.2 dans un CCTP menuiseries extérieures (option b)');
  ok(!runSearchGrid(g,d('LOT 13 SERRURERIE.pdf')).criteria.fen_442.found,'44.2 en serrurerie sans RDC : non'); }
{ const pa=lines=>runSearchGrid(g,doc(lines)).criteria.porte_a2p;
  for(const L of [['Bloc-portes anti-effraction comprenant :','Une serrure à larder A2P* (1 étoile) de sécurité 3 points'],['Fourniture et pose de blocs-portes palières anti-effraction niveau 1 de type Blocfort','Radial NT+ A2P* de chez VACHETTE'],['Porte palière classe CR2','serrure A2P*']]){
    const x=pa(L); ok(!x.found&&x.partial&&!x.contrary,`équivalent du BP1 = Partiel : ${L.join(' / ')}`); }
  ok(pa(['Bloc-porte palier A2P BP1, serrure 3 points']).found,'A2P BP1 = Oui');
  ok(pa(['Porte palière','Bloc porte BP2 certifié A2P']).found,'BP2 + A2P = Oui (classe supérieure, v2.14)');
  const s1=pa(['Porte palière','Serrure A2P* 1 point']); ok(!s1.found&&!s1.partial,'A2P seul = faux');
  const s2=pa(['Porte palière','Bloc porte BP1']); ok(!s2.found&&!s2.partial,'BP1 seul = faux');
  const s3=pa(['Porte palière','A2P 1* sans BP1, bloc-porte anti-effraction']); ok(!s3.found&&!s3.partial,'sans BP1 = faux'); }
{ const x=runSearchGrid(g,doc(['Porte palière','Serrure A2P* 1 point'])).criteria.porte_a2p; ok(!x.found&&x.contrary,'A2P seul : non conforme'); }
yes('fen_volets',['Volets PVC et/ou aluminium avec frein anti retour ou verrou retardateur d’effraction']);
yes('abords_portails',['Ouverture du portillon et du portail de la résidence via système INTRATONE']);
yes('parking_portail',['Accès parking par portail automatique : ouverture du portillon par vidéophone']);
{ const again=normalizeGrid(g); ok(again.criteria.find(c=>c.id==='porte_a2p').allOf.length===2,'migration A2P stable au rechargement'); }
no('porte_a2p',['Porte palière','• A2P 1* sans BP1 pour l’ensemble des logements des bâtiments.']);
no('porte_a2p',['Blocs portes','− Certification A2P bloc-porte : classement croissant BP1, BP2 et BP3 ;']);
no('abords_portails',['NF P25-362 - Fermetures pour baies libres et portails - fermetures automatiques de garages']);
no('parking_portail',['Parking en sous-sol','2.13 - Porte basculante motorisée d’accès aux véhicules : SO ....']);
console.log(`test_v2_41_0 : ${n}/${n} OK`);
