// ExtracTerre v2.3.12 — documents FICTIFS reproduisant les cas du pack d'amélioration (signalements bêta, emplacements
// surlignés, décisions ✓/✕) : OCR « toujours » ciblé, fusion PDF+OCR sans doublons, garde-fous numériques,
// sorties logiciel Perrenoud / CYPE / Pléiades RT2012, hiérarchie des sources apprise.
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {parseDocument} from './js/parsers.js';
import {shouldOcrPdfPage,isCleanDenseTextLayer,significantImageInOps,mergePdfAndOcrLines} from './js/readers.js';
import {numberOnlyGlued,sanitizeOccurrence} from './js/sanity.js';
import {normalizeText} from './js/utils.js';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.17','version');
const doc=(name,type,pages)=>{ const ps=pages.map((ls,k)=>{ const lines=ls.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12})); return {page:k+1,text:lines.map(l=>l.text).join('\n'),lines}; });
  return {id:'d',name,type,familyMode:'auto',read:{kind:'pdf',pages:ps,pageCount:ps.length,text:ps.map(p=>p.text).join('\n\f\n')},buildings:{names:['Bâtiment unique']}}; };
const vals=(out,f,b)=>out.filter(o=>o.field===f&&(!b||o.building===b)).map(o=>o.value);
const val=(out,f,b)=>vals(out,f,b)[0];

// --- 1. OCR « toujours » : une page propre, dense et sans image n'est plus OCRisée ---------------------------------------------
const clean=Array.from({length:30},(_,i)=>`Ligne ${i} du rapport : coefficient Bbio 45,2 points, Cep 62,1 kWhEP/m², isolant laine de bois`).join('\n');
const items=Array.from({length:40},()=>({str:'x'}));
ok(isCleanDenseTextLayer(clean,items),'couche texte propre et dense');
eq(shouldOcrPdfPage(clean,items,'always',{hasImages:false}),false,'mode toujours : page propre sans image → pas d’OCR');
eq(shouldOcrPdfPage(clean,items,'always',{hasImages:true}),true,'… mais une image significative (tableau scanné) → OCR');
eq(shouldOcrPdfPage(clean,items,'max',{hasImages:false}),true,'mode max : toujours OCR');
const OPS={save:1,restore:2,transform:3,paintImageXObject:4,paintFormXObjectBegin:5,paintFormXObjectEnd:6};
eq(significantImageInOps([1,3,4,2],[null,[60,0,0,30,20,780],null,null],OPS,595*842),false,'logo d’en-tête (60×30) ignoré');
eq(significantImageInOps([1,3,4,2],[null,[500,0,0,400,40,200],null,null],OPS,595*842),true,'capture pleine largeur détectée');
// Fusion : les doublons approximatifs de l'OCR ne sont plus ajoutés à une couche PDF de bonne qualité.
const pdfLines=[{text:'Ic energie projet 372,2 kgCO2/m²',y:700},{text:'Ic construction projet 640,5',y:688},{text:'Lot 6 Facades 84',y:676}];
const ocrLines=[{text:'Ic energie projet 3722 kgCO2/m²',y:701},{text:'Ic construction projet 6405',y:689},{text:'Tableau scanne : Bbio 51,3',y:300}];
const merged=mergePdfAndOcrLines(pdfLines,ocrLines,{score:0.9},{score:0.7});
ok(!merged.lines.some(l=>/3722|6405/.test(l.text)),'doublons OCR approximatifs écartés'); ok(merged.lines.some(l=>/Tableau scanne/.test(l.text)),'ligne OCR hors texte PDF conservée');

// --- 2. Garde-fous numériques (signalements bêta) -----------------------------------------------------------------------------
ok(numberOnlyGlued(2012,'Tic Projet TIC Max RT2012 A = n'),'RT2012 → 2012 refusé'); ok(numberOnlyGlued(2,'Ic chantier kgCO2e/m² 14,0'),'m² → 2 refusé'); ok(numberOnlyGlued(3,'Bbio par batiment (Groupe T3 T3)'),'T3 → 3 refusé');
ok(!numberOnlyGlued(14,'Ic chantier kgCO2e/m² 14,0'),'14,0 propre accepté'); ok(!numberOnlyGlued(22.94,'Elec ECS 722,94'),'fragment d’un autre nombre ignoré');
const so=(field,value,excerpt,extra={})=>sanitizeOccurrence({field,value,excerpt,method:'generic:regulatory-label',docType:'Étude thermique',confidence:0.91,...extra});
eq(so('cep_after_final',0.904,'Ecart 0,723 Cep 0,904'),null,'ratio Cep/Cepréf refusé'); eq(so('tic',9,'9 Groupe non refroidi CE1 24,76 30,92'),null,'numéro de groupe refusé');
eq(so('roof_insulation_thickness',88160,'Surface totale 88.16 m²'),null,'épaisseur aberrante refusée'); eq(so('cep_electricity',39971.09,'77,99 39971,09 88,37'),null,'kWh annuels refusés');
eq(so('department','77 Altitude : 100 m','Numero de departement : 77 Altitude : 100 m').value,'77','département nettoyé');
eq(so('ventilation','CTA','Ventil.Ouv.de fenetre | Liens vers la CTA'),null,'« Liens vers la CTA » ≠ CTA');
eq(so('ubat_before',6,'1.6.1.- Coefficient moyen de deperdition … batiment, Ubat 6'),null,'numéro de chapitre ≠ Ubat');
eq(so('cep',45,'Justification du calcul .............. 45'),null,'numéro de page de sommaire refusé');
eq(sanitizeOccurrence({field:'enr',value:'Oui',method:'tags:presence',docType:'Contrat',confidence:0.8}),null,'« ENR » par présence dans un contrat : jamais proposé (0/34)');
eq(sanitizeOccurrence({field:'mention_bbca',value:'Oui',method:'tags:presence',docType:'CCTP',confidence:0.8}),null,'mention par présence dans un CCTP écartée');
ok(sanitizeOccurrence({field:'mention_bbca',value:'Oui',method:'tags:presence',docType:'Contrat',confidence:0.9}),'mention dans un contrat conservée');
eq(so('cep',780,'Cep 780',{method:'xml:re2020:cep'}).value,780,'valeur XML jamais filtrée');

// --- 3. Moteur générique : libellé séparé de la valeur, phase tirée du seul nom de fichier ------------------------------------------
const lp=parseDocument(doc('Etude fictive Rapport final.pdf',DOC_TYPES.THERMAL,[['28,25 %','CepMax','Ecart','122,17','Ch+Ref+Ecs','Respect CepMax','Tic Ref.','31,58']]));
ok(!vals(lp,'cep_max').includes(122.17)&&!vals(lp,'cep_max').includes(31.58),'« CepMax | Ecart | 122,17 » ne donne pas un Cep max');
const ph=parseDocument(doc('Etude fictive Rapport final.pdf',DOC_TYPES.THERMAL,[['L9','L10','COEFFICIENT UBAT = 1,938']]));
ok(!ph.some(o=>o.field==='ubat_after'&&o.value===1.938&&o.confidence>=0.9),'phase « final » du nom de fichier : pas d’Ubat après travaux automatique');

// --- 4. Perrenoud U-Win (RT existant, plusieurs bâtiments) ---------------------------------------------------------------------------
const pe=parseDocument(doc('Rapport RT reno fictif.pdf',DOC_TYPES.RT_EXISTING,[
  ['ETAT INITIAL','Bâtiment : Bâtiment n°5','Surface du bâtiment : 4100,0 m² (shon)','COEFFICIENT UBAT = 1,129','Type de Chauffage : Gaz','3-01-c] Ventilation : Auto-réglable','Type de ventilation : Ventil. mécanique Simple Flux','Année de construction Entre 1948 et 1975'],
  ['SYNTHESE ETAT INITIAL','Bâtiment n° 2 : Bâtiment n°5','Ubat du bâtiment 1,150','Coefficient Cep (kWh énergie primaire / m²) 186,85','Total Energie primaire (kwh EP /m²) 153,8'],
  ['ETAT PROJET','Bâtiment : Bâtiment n°5','Ubat du batiment 0,990 1,175 15,79 4,111 10,88','Coefficient Cep (kWh énergie primaire / m²) 87,49 106,04 17,49 204,286 57,17','TIC=23,9 - TICRéf = 32,3','Bâtiment : Bâtiment n°7','TIC=24,0 - TICRéf = 32,2','Surface utile : 3358,22 m² Surface Shon : 4098,56 m²']]));
const B5='Bâtiment 5', B7='Bâtiment 7';
eq(val(pe,'ubat_before',B5),1.129,'COEFFICIENT UBAT de la page « état initial »'); ok(vals(pe,'ubat_before',B5).includes(1.15),'synthèse initiale (valeur seule)');
eq(val(pe,'ubat_after',B5),0.99,'synthèse projet (valeur suivie des colonnes de référence)'); eq(val(pe,'cep_after_final',B5),87.49); eq(val(pe,'cep_before',B5),186.85);
eq(val(pe,'tic',B5),23.9); eq(val(pe,'tic_ref',B5),32.3); eq(val(pe,'tic',B7),24); eq(val(pe,'shab',B7),3358.22,'surface utile de la fiche du bâtiment 7');
eq(val(pe,'heating_vector_before',B5),'Gaz'); ok(vals(pe,'ventilation',B5).includes('VMC simple flux'),'ventilation mécanique simple flux'); eq(val(pe,'built_after_1948',B5),'Oui','« Entre 1948 et 1975 »');
const opt=parseDocument(doc('Bao.pdf',DOC_TYPES.THERMAL,[['Etat après travaux','Type de chauffage : Autre (Thermodynamique, Gaz, Fioul, Bois, Réseau,...)']]));
ok(!opt.some(o=>o.field==='heating_vector_after'),'liste d’options de formulaire ignorée');

// --- 5. CYPE (rapport complet RT existant) -------------------------------------------------------------------------------------------
const cy=parseDocument(doc('Rapport complet thermique fictif.pdf',DOC_TYPES.RT_EXISTING,[
  ['1.2.1. Coefficient moyen de deperdition par transmission a travers les','0.54 <= 1.25 56.80 %','Ubat: Coefficient moyen de deperdition par transmission a travers les parois',
   '1.2.2. Consommations conventionnelles du batiment','98.20 <= 214.61 54.24 %','Cep: Consommation conventionnelle d energie du batiment pour','Locaux non attribues: Espace chauffe','25.31 <= 27.89 9.25 %','Tic: Temperature interieure conventionnelle d une zone',
   'SHON (m²) 928.87','Cep max = 147.66 kWhe.p./m²/an'],
  ['Mur RDC ITE Surface totale 47.76 m²','Liste des couches:','1 - Enduit 1 cm','2 - Fibre de bois de type flex F 036 de Steico R=3,85 16 cm','3 - Briques pleines 30 cm','Toiture terrasse Surface totale 80 m²','Liste des couches:','1 - Chape exterieure 4 cm','2 - PUR type EFIGREEN DUO SOPREMA - R=6,40 14 cm']]));
eq(val(cy,'ubat_after'),0.54); eq(val(cy,'cep_after_final'),98.2); eq(val(cy,'tic'),25.31); eq(val(cy,'tic_ref'),27.89); eq(val(cy,'shab'),928.87);
ok(cy.some(o=>o.field==='ubat_before'&&o.value===1.25&&o.confidence<0.9),'Ubat de référence proposé en « avant travaux » à vérifier seulement');
eq(val(cy,'wall_insulation'),'Fibre de bois'); eq(val(cy,'wall_insulation_r'),3.85); eq(val(cy,'wall_insulation_thickness'),160); eq(val(cy,'roof_insulation'),'PUR'); eq(val(cy,'roof_insulation_r'),6.4);

// --- 6. Pléiades RSET RT2012 -------------------------------------------------------------------------------------------------------
const pr=parseDocument(doc('RSET fictif.pdf',DOC_TYPES.RT2012,[['Surface utile ou habitable (m2) 948','Coefficient Cep kWh-ep/m2SHON 89.81 104 -14.19','Partie de batiment de type CE1 Unite Tic (a) Tic Ref (b) (a-b)','Groupe 1 °C 25.49 33.16 -7.67','Ubat(hiver) - 0.63 - 0.68 -0.054','Type d\'energie - Gaz Gaz','Coefficient Bbio','Bbio max','52,4','60']]));
eq(val(pr,'shab'),948); eq(val(pr,'cep'),89.81); eq(val(pr,'cep_max'),104); eq(val(pr,'tic'),25.49); eq(val(pr,'tic_ref'),33.16); eq(val(pr,'ubat_after'),0.63); eq(val(pr,'heating_vector_after'),'Gaz');
eq(val(pr,'bbio'),52.4,'tableau vertical Bbio / Bbio max'); eq(val(pr,'bbio_max'),60);
console.log(`v2.3.12 — ${n} vérifications OK (documents fictifs)`);
