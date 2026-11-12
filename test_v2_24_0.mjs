// ExtracTerre v2.24.0 — import massif : correspondance des contrats, filtrage des sous-dossiers, classement, versions,
// chiffrement du registre, espace séparé et écran d'accueil. Données fictives uniquement.
import fs from 'fs';
import {APP_VERSION} from './js/config.js';
import {irContractKey,parseContractList,folderContracts,matchContracts,subfolderFamily,folderFamilyMatch,fileIgnoreReason,
  versionIndex,documentKey,dateIn,rankVersions,classifyImportFile,versionFolderKey} from './js/import-rules.js';
import {classifyDocument} from './js/classifier.js';
import {deriveKeys,encryptJson,decryptJson,hmac,newSalt} from './tools/import/lib/crypto.mjs';
import {ssReasonCategory,ssOperations,ssLoadableFiles,ssOperationName,ssParseContractPaste} from './js/suivi-sources.js';

const cfg=JSON.parse(fs.readFileSync(new URL('./tools/import/import.config.json',import.meta.url),'utf8'));
let n=0; const eq=(a,b,label)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${label}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };

eq(APP_VERSION,'2.30.0','version');

// --- Numéros de contrat
eq(irContractKey(' 0000-5361 '),'00005361','clé : tirets et espaces');
eq(irContractKey('5361'),'00005361','clé : complétée à 8 chiffres');
eq(irContractKey('OPE-1234'),'','clé : pas un numéro');
eq(irContractKey('0153')===irContractKey('01534'),false,'0153 ≠ 01534');
const list=parseContractList('contrat;nom\n00001234;A\n1629\n 0153 \n1629\nabc\n# commentaire\n');
eq(list.keys,['00001234','00001629','00000153'],'CSV : colonne 1, en-tête sauté, doublon retiré');
eq(list.invalid.map(x=>x.value),['abc'],'CSV : ligne illisible');
eq(list.duplicates,['00001629'],'CSV : doublon signalé');
eq(parseContractList('nom,numéro\nX,00004321\n',{column:'Numero'}).keys,['00004321'],'CSV : colonne par nom (accents ignorés)');
eq(parseContractList('00001111\n00002222\n').keys,['00001111','00002222'],'TXT');
eq(folderContracts('00005361 - 70 - VILLERSEXEL - CRECHE').contracts,['00005361'],'dossier simple, département ignoré');
eq(folderContracts('00001629 ET 00001630 - 59 - LINSELLES').contracts,['00001629','00001630'],'deux contrats « ET »');
eq(folderContracts('00001807, 1808, 1806 - 93 - L\'ILE SAINT DENIS').contracts,['00001807','00001808','00001806'],'contrats abrégés');
eq(folderContracts('00002510 + 00002955 - 94 - IVRY').contracts,['00002510','00002955'],'contrats « + »');
eq(folderContracts('95-3991 - BEAUCHAMP - VILLA').contracts,['00003991'],'département puis contrat');
eq(folderContracts('76-008 - 1480 - CP - Fecamp - Rue de Bailly').contracts,['00001480'],'code « 008 » ignoré, contrat 1480');
eq(folderContracts('Annule - 06 - 0709 - Sospel'),{contracts:['00000709'],cancelled:true},'dossier annulé');
eq(folderContracts('00 - Dossier type copie').contracts,[],'dossier type : pas de contrat');
eq(folderContracts('07-011 - 0386 - CP Annule - Annonay').cancelled,true,'« Annule » au milieu du nom');
eq(folderContracts('13-009 - 2117 - Annulée - Roquevaire'),{contracts:['00002117'],cancelled:true},'« Annulée » au milieu du nom');
eq(folderContracts('00005361 - 70 - ANNULY LES BOIS').cancelled,false,'commune « Annuly » non annulée');
eq(folderContracts('00001138 -59 - BAILLEUL - Rue 2024').contracts,['00001138'],'année dans le nom ignorée');
eq(folderContracts(' 00002474 - 83 - LES ARCS').contracts,['00002474'],'espace en tête');
const folders=['00001534 - 75 - PARIS','00015340 - 13 - MARSEILLE','00005555 - A','5555 - B','00001629 ET 00001630 - 59 - X','Annule - 06 - 0709 - Sospel'];
const m=matchContracts(folders,['00000153','00001534','00005555','00001630','00000709','00009999']);
eq(m.found.map(f=>[f.contract,f.folder,f.sharedWith]),[['00001534','00001534 - 75 - PARIS',[]],['00001630','00001629 ET 00001630 - 59 - X',['00001629']]],'trouvés (sans faux positif 15340)');
eq(m.multiple.map(x=>x.contract),['00005555'],'plusieurs dossiers → à vérifier');
eq(m.missing,['00000153','00009999'],'sans dossier');
eq(m.onlyCancelled.map(x=>x.contract),['00000709'],'seulement annulé');
eq(matchContracts(folders,null).found.length,4,'sans liste : tous les contrats non ambigus');

// --- Sous-dossiers
eq(subfolderFamily('CCTP',cfg),'cctp','CCTP');
eq(subfolderFamily('03 - Études Thermiques',cfg),'thermique','numérotation, accents, pluriel');
eq(subfolderFamily('3_THERMIQUE',cfg),'thermique','numérotation collée');
eq(subfolderFamily('Étude Thermique',cfg),'thermique','Étude Thermique');
eq(subfolderFamily('RE2020',cfg),'thermique','RE2020');
eq(subfolderFamily('ACV dynamique',cfg),'carbone','ACV');
eq(subfolderFamily('RSEE',cfg),'carbone','RSEE');
eq(subfolderFamily('Notes techniques',cfg),'thermique','notes techniques');
eq(subfolderFamily('Plans',cfg),null,'Plans ignoré');
eq(subfolderFamily('Dossier source',cfg),null,'Dossier source ignoré');
eq(subfolderFamily('wetransfer_dce-0-bb_18',cfg),null,'DCE non retenu');
eq(folderFamilyMatch('Evaluation thermique',cfg),{family:'thermique',container:true},'conteneur : fichiers directs seulement');
eq(folderFamilyMatch('Évaluation',cfg),{family:null,container:true},'Évaluation : conteneur');
eq(subfolderFamily('Suivi environnemental',cfg),null,'suivi environnemental non retenu');
const {isSkippedFolder}=await import('./js/import-rules.js');
eq(['Dossier source','Autres','Exécution','Photos de visite','CCTP'].map(x=>isSkippedFolder(x,cfg)),[true,true,true,true,false],'dossiers jamais parcourus');

// --- Fichiers ignorés
eq(fileIgnoreReason('photo.JPG',cfg),'extension ignorée (.jpg)','image');
eq(fileIgnoreReason('~$CCTP.docx',cfg),'fichier temporaire','temporaire');
eq(fileIgnoreReason('.DS_Store',cfg),'fichier système','DS_Store');
eq(fileIgnoreReason('plan.dwg',cfg),'extension ignorée (.dwg)','DWG');
eq(fileIgnoreReason('RSET.xml',cfg),null,'XML lu');
eq(fileIgnoreReason('note.PDF',cfg),null,'PDF lu');
eq(fileIgnoreReason('fichier.pages',cfg),'format non lu par ExtracTerre (.pages)','format inconnu');
eq(['Mail modif DCE V2.pdf','Retour NC sur OPE 000770.pdf','PV 11-A-572.pdf','Catalogue options (1).pdf','Messagerie PRESTATERRE.pdf'].map(n=>!!fileIgnoreReason(n,cfg)),[true,true,true,true,true],'v2.30.0 : correspondance et annexes écartées par le nom');
eq(['Note thermique.pdf','PC16_Attestation Thermique.pdf','Réponses Fluidys pour certification.pdf','RE Dossier BD.pdf'].map(n=>fileIgnoreReason(n,cfg)),[null,null,null,null],'v2.30.0 : documents techniques gardés');

// --- Versions
eq(versionIndex('CCTP lot 2 indA.pdf',cfg),{scheme:'lettre',rank:1,label:'ind A'},'indA');
eq(versionIndex('CCTP_ind_C.pdf',cfg)?.rank,3,'ind_C');
eq(versionIndex('CCTP-C.pdf',cfg)?.rank,3,'-C final');
eq(versionIndex('CCTP Bat B.pdf',cfg),null,'« Bat B » n’est pas un indice');
eq(versionIndex('Note thermique V3.pdf',cfg)?.rank,3,'V3');
eq(versionIndex('RSET rev2.xml',cfg)?.rank,2,'rev2');
eq(versionIndex('RE2020.pdf',cfg),null,'RE2020 n’est pas une version');
eq(dateIn('Etude 2025-03-14 finale'),'2025-03-14','date AAAA-MM-JJ');
eq(dateIn('Etude_20250314'),'2025-03-14','date AAAAMMJJ');
eq(dateIn('Etude 14-03-2025'),'2025-03-14','date JJ-MM-AAAA');
eq(dateIn('12 11 2025'),'2025-11-12','dossier daté JJ MM AAAA');
eq(dateIn('Lot 13 2025'),null,'pas une date');
eq(dateIn('14 11 25'),'2025-11-14','dossier daté JJ MM AA');
eq(dateIn('Évaluation/CCTP/14 11 25'),'2025-11-14','dossier daté dans un chemin');
eq(dateIn('251111 - DET v2 (avec PV)'),'2025-11-11','préfixe AAMMJJ');
eq(dateIn('C318 CCTP LOT 01 GROS OEUVRE'),null,'C318 n’est pas une date');
eq(dateIn('Lot 02 03 04'),null,'suite de lots non datée');
eq(versionFolderKey('CCTP/14 11 25',cfg),versionFolderKey('CCTP',cfg),'dossier JJ MM AA = même dossier');
eq(documentKey('CCTP Lot 02 indB - copie (1).pdf',cfg),'cctp lot 02','clé de famille');
eq(documentKey('Etude thermique V2 2025-03-14 DEF.pdf',cfg),documentKey('Etude thermique.pdf',cfg),'clé : version, date et « DEF » retirés');
eq(versionFolderKey('Étude Thermique/12 11 2025',cfg),versionFolderKey('Étude Thermique',cfg),'dossier daté = même dossier');
eq(versionFolderKey('CCTP/Bât A',cfg)===versionFolderKey('CCTP/Bât B',cfg),false,'Bât A ≠ Bât B');
const vs=rankVersions([
  {id:'a',family:'cctp',relDir:'CCTP',name:'CCTP lot2 indA.pdf',mtimeMs:3},
  {id:'b',family:'cctp',relDir:'CCTP',name:'CCTP lot2 indC.pdf',mtimeMs:1},
  {id:'c',family:'cctp',relDir:'CCTP',name:'CCTP lot2 indB.pdf',mtimeMs:2},
  {id:'d',family:'cctp',relDir:'CCTP/Archives',name:'CCTP lot2 indD.pdf',mtimeMs:9},
  {id:'e',family:'thermique',relDir:'Thermique/01 03 2025',name:'Note.pdf',mtimeMs:5},
  {id:'f',family:'thermique',relDir:'Thermique/12 11 2025',name:'Note.pdf',mtimeMs:4},
  {id:'g',family:'carbone',relDir:'ACV',name:'RSEE V2.xml',mtimeMs:1},
  {id:'h',family:'carbone',relDir:'ACV',name:'RSEE.xml',mtimeMs:2},
],cfg);
eq(['a','b','c','d'].map(k=>vs.get(k).current),[false,true,false,false],'indice le plus élevé (l’archive passe après)');
eq(vs.get('b').rank,1,'rang 1');
eq(vs.get('f').current,true,'date du dossier daté prime sur la date de modification');
eq([vs.get('g').ambiguous,vs.get('h').ambiguous],[true,true],'indice d’un côté seulement, fichier sans indice plus récent → ambigu');
const vs2=rankVersions([{id:'x',family:'cctp',relDir:'CCTP',name:'Lot 10_CVP_V3.pdf',mtimeMs:5},{id:'y',family:'cctp',relDir:'CCTP',name:'Lot 10_CVP.pdf',mtimeMs:2}],cfg);
eq([vs2.get('x').current,vs2.get('x').ambiguous],[true,false],'v2.30.0 : indice d’un côté, plus récent → courant sans doute');
eq(vs.get('e').ambiguous,false,'dates comparables → pas ambigu');

// --- Classement (règles a → e)
const T=cfg.types;
eq(classifyImportFile({family:'cctp',name:'Notes.pdf'},classifyDocument,cfg),{type:'CCTP',method:'sous-dossier',status:'à traiter',doubt:'',note:'',steps:['a:CCTP']},'a : sous-dossier seul');
eq(classifyImportFile({family:'thermique',name:'x.xml',xml:{re2020:'RSEE'}},classifyDocument,cfg).type,T.rsee,'b : XML RSEE');
eq(classifyImportFile({family:'thermique',name:'x.xml',xml:{re2020:null,dpe:false}},classifyDocument,cfg).status,'à vérifier','b : XML non reconnu');
eq(classifyImportFile({family:'thermique',name:'Entree.xml',xml:{other:'thcex'}},classifyDocument,cfg).type,'RT Existant','b : entrée ThCEx reconnue');
eq(classifyImportFile({family:'thermique',name:'XML.xml',xml:{other:'controle'}},classifyDocument,cfg).status,'à traiter','b : dossier de contrôle reconnu');
eq(classifyImportFile({family:'thermique',name:'1248826.xml',xml:{other:'dce'}},classifyDocument,cfg).note,'index de DCE : liste de documents, rien à lire','b : index de DCE');
eq(classifyImportFile({family:'thermique',name:'Sorties.xml',xml:{re2020:null},appType:'RT Existant'},classifyDocument,cfg).status,'à traiter','b : XML tranché par la lecture complète');
eq(classifyImportFile({family:'cctp',name:'DPGF lot 02.pdf'},classifyDocument,cfg).type,'DPGF','c : nom compatible');
eq(classifyImportFile({family:'cctp',name:'scan.pdf',text:''},classifyDocument,cfg).doubt,'PDF sans texte (scan) : OCR nécessaire','scan');
const contra=classifyImportFile({family:'thermique',name:'Note.pdf',text:'CAHIER DES CLAUSES TECHNIQUES PARTICULIERES\nLot 02',appType:'Permis / pièce administrative'},classifyDocument,cfg);
eq([contra.status,contra.type],['à vérifier','CCTP'],'d : indices sans majorité → à vérifier');
eq(classifyImportFile({family:'thermique',name:'Note.pdf',text:'CAHIER DES CLAUSES TECHNIQUES PARTICULIERES\nLot 02',appType:'CCTP'},classifyDocument,cfg).note,'rangé dans « Note ou étude thermique » mais lu comme CCTP','v2.30.0 : 1re page et document entier d’accord → accepté avec une note');
eq(classifyImportFile({family:'cctp',name:'LOT 18 - DEMOLITION - DESCRIPTIF.pdf',text:'Analyse de cycle de vie ACV',appType:'RSET RE2020'},classifyDocument,cfg).status,'à traiter','v2.30.0 : nom de lot dans le dossier CCTP');
eq(classifyImportFile({family:'thermique',name:'Etude.pdf',text:'Cahier des clauses techniques particulières',appType:'RT Existant'},classifyDocument,cfg),{type:'RT Existant',method:'lecture complète (appli)',status:'à traiter',doubt:'',note:'',steps:['a:Étude thermique','d:CCTP','e:RT Existant']},'v2.30.0 : sous-dossier + document entier suffisent');
eq(classifyImportFile({family:'thermique',name:'Etude.pdf',text:'Étude thermique réglementaire RE2020'},classifyDocument,cfg).status,'à traiter','d : contenu confirmé');
eq(classifyImportFile({family:null,name:'xyz.pdf'},classifyDocument,cfg).status,'à vérifier','aucun indice');

// --- Chiffrement du registre
const salt=newSalt(), k1=deriveKeys('phrase secrète de test 123',salt,1000), k2=deriveKeys('autre phrase secrète 456',salt,1000);
const enc=encryptJson(k1,{contract:'00001234',relPath:'CCTP/a.pdf'});
eq(decryptJson(k1,enc),{contract:'00001234',relPath:'CCTP/a.pdf'},'déchiffrement');
eq(enc.includes('00001234'),false,'contenu illisible sans clé');
let refused=false; try{ decryptJson(k2,enc); }catch{ refused=true; } eq(refused,true,'mauvaise phrase secrète refusée');
eq(hmac(k1,'00001234')===hmac(k2,'00001234'),false,'identifiants HMAC dépendants de la phrase');
eq(/^[0-9a-f]{64}$/.test(hmac(k1,'x')),true,'HMAC hexadécimal');
let short=false; try{ deriveKeys('court',salt,1000); }catch{ short=true; } eq(short,true,'phrase trop courte refusée');

// --- Vue « Suivi des sources »
eq(ssReasonCategory('PDF sans texte (scan) : OCR à faire'),'PDF sans texte (scan)','motif scan');
eq(ssReasonCategory('indices contradictoires : nom → DPGF'),'Indices contradictoires','motif contradiction');
eq(ssReasonCategory('ordre des versions ambigu : …'),'Ordre des versions ambigu','motif version');
eq(ssOperationName('00001234 - 59 - LILLE - LES TILLEULS'),'LILLE - LES TILLEULS','nom d’opération');
eq(ssOperationName('00001629 ET 00001630 - 59 - LINSELLES'),'LINSELLES','nom d’opération (deux contrats)');
const reg={operations:{'00001234':{contract:'00001234',folder:'F'}},files:{
  'a':{contract:'00001234',relPath:'CCTP/a.pdf',status:'traité',isCurrent:true,resultFile:'r/a'},
  'b':{contract:'00001234',relPath:'CCTP/b.pdf',status:'à vérifier',isCurrent:true,resultFile:'r/b'},
  'c':{contract:'00001234',relPath:'CCTP/c.pdf',status:'ignoré',isCurrent:false,versionGroup:'g'},
  'd':{contract:'00001234',relPath:'CCTP/d.pdf',status:'traité',isCurrent:true,resultFile:'r/d',missing:true}}};
eq(ssOperations(reg)[0].counts,{total:3,traite:1,review:1,errors:0,ignored:0,missing:1,history:1,todo:0},'compteurs');
eq(ssLoadableFiles(reg,'00001234',{}).map(f=>f.relPath),['CCTP/a.pdf'],'chargés : traités seulement');
eq(ssLoadableFiles(reg,'00001234',{'00001234|CCTP/b.pdf':{accept:true}}).map(f=>f.relPath),['CCTP/a.pdf','CCTP/b.pdf'],'chargés : + validés tel quel');

// --- Appli : espace séparé, accueil, module commun
const app=fs.readFileSync(new URL('./js/app.js',import.meta.url),'utf8');
const persistence=fs.readFileSync(new URL('./js/persistence.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const bundle=fs.readFileSync(new URL('./js/app.bundle.js',import.meta.url),'utf8');
eq(/'extracterre-import-workspace':'extracterre-local-workspace'/.test(persistence),true,'base séparée pour l’espace import');
eq(/importContract:project\.importContract/.test(persistence)&&/importKey:doc\.importKey/.test(persistence),true,'champs import sauvegardés');
eq(/id="spaceChooser"/.test(html)&&/data-space="current"/.test(html)&&/data-space="import"/.test(html),true,'écran d’accueil à deux entrées');
eq(/id="sourcesBtn"[^>]*hidden/.test(html),true,'Suivi des sources masqué hors espace import');
eq(/import \{classifyForSelectedFamily\} from '\.\/doc-pipeline\.js'/.test(app)&&!/^function classifyForSelectedFamily/m.test(app),true,'classement partagé avec le script');
eq(/\/\* ---- doc-pipeline\.js ---- \*\//.test(bundle)&&/\/\* ---- suivi-sources\.js ---- \*\//.test(bundle),true,'modules dans le bundle');
eq(/p\.docs=p\.docs\.filter\(d=>!d\.importKey\|\|/.test(app),true,'mise à jour : documents ajoutés à la main conservés');
eq(/SUPABASE_SERVICE_ROLE_KEY|service_role|sb_secret_/.test(app+bundle+html),false,'aucune clé de service côté navigateur');
const sql=fs.readFileSync(new URL('./supabase/migrations/20261112_import_massif.sql',import.meta.url),'utf8');
eq(/enable row level security/.test(sql)&&/revoke all on public\.extracterre_import_files from anon, authenticated/.test(sql),true,'tables fermées aux clés publiques');

// --- v2.24.1 : liste collée depuis Excel, service d'import
eq(ssParseContractPaste('00005361\n4918\n 0000-1234 \n4918\n').contracts,['00005361','00004918','00001234'],'collage une colonne (doublon retiré)');
eq(ssParseContractPaste('N° contrat\tVille\tCP\n00001234\tLille\t59000\n1629\tLinselles\t59126\n').contracts,['00001234','00001629'],'collage : colonne « contrat » choisie, pas le code postal');
eq(ssParseContractPaste('Ville\tNum\nLille\t00001234\nParis\t5361\n').contracts,['00001234','00005361'],'collage sans en-tête « contrat » : colonne des numéros');
eq(ssParseContractPaste('5361\nabc\n123456789\n').invalid,['abc','123456789'],'collage : lignes illisibles signalées');
eq(ssParseContractPaste('').contracts,[],'collage vide');
const cli=fs.readFileSync(new URL('./tools/import/extracterre-import.mjs',import.meta.url),'utf8');
const watch=fs.readFileSync(new URL('./tools/import/watch.mjs',import.meta.url),'utf8');
eq(/--statut/.test(cli)&&/find-generic-password/.test(cli),true,'script : avancement JSON et phrase secrète dans le Trousseau');
eq(/'--dossier-travail',workDir/.test(watch)&&/extracterre-import-request/.test(watch),true,'service : demandes du dossier de travail');
eq(/data-ss-tab="new"/.test(app)&&/ssWriteRequest\(ss\.dir/.test(app),true,'appli : onglet Nouvelle analyse');

// --- v2.24.5 : dossiers d'archive, service autorisé à télécharger les fichiers Box
const arch=matchContracts(['00002125 - 75 - PARIS','00 - Certifications réalisées - Archivage/00001500 - 94 - CHENNEVIÈRES','00 - Certifications réalisées - Archivage/00002125 - 75 - PARIS (ancien)'],['00001500','00002125'],cfg);
eq(arch.found.map(f=>[f.contract,f.folder]),[['00001500','00 - Certifications réalisées - Archivage/00001500 - 94 - CHENNEVIÈRES'],['00002125','00002125 - 75 - PARIS']],'archive cherchée ; la racine prime sur l’archive');
eq(cfg.racinesSupplementaires,['00 - Certifications réalisées - Archivage'],'archive dans la configuration');
eq(ssOperationName('00 - Certifications réalisées - Archivage/00001500 - 94 - CHENNEVIÈRES'),'CHENNEVIÈRES','nom d’opération d’un dossier d’archive');
const inst=fs.readFileSync(new URL('./tools/import/installer-service.mjs',import.meta.url),'utf8');
eq(/MaterializeDatalessFiles<\/key><true\/>/.test(inst)&&!/Background/.test(inst.replace(/\/\/.*$/gm,'')),true,'service autorisé à télécharger les fichiers Box');
eq(/!\(prev\.counts\?\.errors\)/.test(cli),true,'opération avec erreurs reprise au passage suivant');

console.log(`v2.30.0 — ${n} vérifications OK (données fictives)`);
