// Documents FICTIFS (aucune donnée client) imitant la structure d'une synthèse ClimaWin 2020 et d'un récap BE.
// Les lignes portent une coordonnée y comme celles produites par PDF.js (accents déjà retirés par le moteur).
export const mkPage=(n,rows)=>{ const lines=rows.map(([text,y],index)=>({index,text,y})); return {page:n,text:lines.map(l=>l.text).join('\n'),lines}; };
export const mkDoc=(id,name,pages)=>({id,name,read:{kind:'pdf',pages,pageCount:pages.length,text:pages.map(p=>p.text).join('\n\f\n')}});
const N=(a)=>a.join(' ');
function building(n,name,o){
  const rowsA=[['CLIMAWIN HEADER',800],[`${n}. Batiment ${name}`,780],[`${n}.1. Etude`,770],['Operation Residence Fictive - Etude DCE',760],[`Date ${o.date}`,750],['Logiciel ClimaWin 2020, 2026.6.2.2',740],[`${n}.2. Batiment`,730],
    ['Zone d\'usage logements',720],['TRAVERSANTS',715],[`Logements collectifs (RE2020) - ${o.zA} m² - 12 occ. - ${o.lA} logements (75.0 m² moy.) - Traversante`,710]];
  if(o.zB) rowsA.push([`Logements collectifs (RE2020) - ${o.zB} m² - 6 occ. - ${o.lB} logements (50.0 m² moy.) - Non traversante`,700]);
  rowsA.push([`${n}.3. Performance de l'enveloppe`,690]);
  const env=[['Enveloppe du batiment : parois opaques',680],['Surface Type Nature Isolation Perf. isol. Coef. U Ht Part',672],['m² W/m.K W/(K.m²) W/K %',665],
    ['Mur agglo creux +',655],['STEICOprotect dry (16',651],['ITE laine de bois / 171.85 Mur exterieur Parpaing (ITI) 0.039 0.221 39.93 16.5 %',648],['cm)',644],['ext',641],
    ['Coffre(s) de volet :',629],['5.95 Mur exterieur Coffre - 0.700 4.16 1.7 %',625],['0.70 W/(m².K)',622],
    ['Dallage avec',610],['TMS 120 mm 1200 x1000',606],['plancher chauffant 104.74 Pl. bas sur sol Beton (ITI) 0.021 0.123 12.92 5.3 %',603],['(12 cm)',599],['isole sous chape',596],
    ['Combles - Ouate de',584],['UNIVERCELL Vrac - Sac',580],['cellulose soufflee 76.19 Pl. haut sur LNC ITI 0.039 0.098 7.43 3.1 %',577],['de 12.50KG (39 cm)',573],
    ['Enveloppe du batiment : menuiseries',555],['Surface Type Vitrage Ug Protection Uw (sp/ap) Sw (sp/ap) Tlw Ht Part',545],
    ['F ALU - VR motorise - Lgt DV 4/16/4 1.590 / 0.529 /',530],['1.20 Fenetre Alu. 1.12 Volet moto. 0.656 1.69 0.3 %',527],['004 - Chambre 1 Argon 1.221 0.020',523],
    ['Enveloppe : details par entite (zone, groupe, unite, locaux)',500],[`Batiment ${name} ${o.sref} 543.47 242.28 0.45 60.23 20.00 % 86.17 0.52`,490]];
  const synth=[[`${n}.4. Synthese d'etude RE2020`,470],
    [`BBio (points) ${o.bbio} ${o.bbioMax} -38 %`,460],['DH de Groupe d\'usage - CE1 BR1 Clim. 400.0 1400.0 -71 %',450],[`DH de Groupe d'usage - CE1 BR1 Clim. ${o.dh} ${o.dhMax} -42 %`,440],
    [`Cep,nr (kWhep/(m².an)) ${o.cep} 70.0 -14 %`,430],[`Cep (kWhep/(m².an)) ${o.cep} 80.0 -25 %`,420],['Ic,energie (kg eq.CO /m² sur 50 ans) 70.0 500.0 -86 %',410],
    [`Batiment ${name} 12.00 8.00 2.00 24.00 16.00 10.00 ${o.bbio}`,400],
    [`Batiment ${name} 5.00 8.00 9.00 2.00 0.50 0.00 0.50 25.00 ${o.cep} 80.00 ${o.cep} 70.00`,390],
    [`Batiment ${name} ${o.pv}`,380],
    ['Cef elec-ch 1.8 1.5 0.5 0.1 0 0 0 0 0 0 0.8 1.9 5.0 11.5',370],['Cef elec-fr 0 0 0 0 0 1.9 2.7 2.2 1.4 0.2 0 0 8.0 18.4',366],['Cef elec-ecs 1.1 0.9 0.9 0.7 0.6 0.6 0.5 0.6 0.5 0.7 0.9 0.9 9.0 20.7',362],
    ['Cef elec-ecl 0.2 0.2 0.2 0.1 0.1 0.1 0.1 0.1 0.2 0.2 0.2 0.2 2.0 4.6',358],['Cef elec-vent 0 0 0 0 0 0 0 0 0 0 0 0 0.5 1.2',354],['Cef elec-dist 0 0 0 0 0 0 0 0 0 0 0 0 0.0',350],['Cef elec-depl 0 0 0 0 0 0 0 0 0 0 0 0 0.5 1.2',346],['Cef elec-mobi 2.0 1.8 1.9 1.8 1.8 1.9 1.9 1.9 2.0 2.0 2.0 1.6 22.7 52.2',342]];
  return [...rowsA,...env,...synth];
}
export function climaWinSynthesisDoc(id,name,{date1='10/02/2026 09:00:00',date2='10/02/2026 09:00:01',north={},south={}}={}){
  const N0={date:date1,zA:'300.0',lA:4,zB:'100.0',lB:2,sref:'400.00',bbio:'50.0',bbioMax:'80.0',cep:'60.0',dh:'700.5',dhMax:'1450.0',pv:'5.00 4.50 0.50 90.00 5.00 4.50 90.00 0.00 0.00 0.00',...north};
  const S0={date:date2,zA:'180.6',lA:2,zB:null,sref:'180.60',bbio:'70.0',bbioMax:'85.0',cep:'66.0',dh:'660.0',dhMax:'1400.0',pv:'0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00',...south};
  const sommaire=mkPage(1,[['Sommaire',800],['SYNTHESE D\'ETUDE REALISEE AVEC CLIMAWIN 2020 2',780],['1. Batiment Nord 2',770],['1.1. Etude 2',760],['1.4. Synthese d\'etude RE2020 4',750],['2. Batiment Sud 6',740],['2.1. Etude 6',730],['2.4. Synthese d\'etude RE2020 8',720],['Calculs realises RE2020 RT2012 RTEx Deperditions Apports',700]]);
  return mkDoc(id,name,[sommaire,mkPage(2,building(1,'Nord',N0)),mkPage(3,building(2,'Sud',S0))]);
}
export function beRecapDoc(id,name,lot='Lot 1'){
  return mkDoc(id,name,[
    mkPage(1,[[`Etude realisee pour le ${lot}`,700],['(resultats sur le batiment le plus defavorable)',690],['Preconisations et remarques Thermique',650]]),
    mkPage(2,[['Projet de : Creation de logements',782],['Performance du batiment selon la',692],['RE2020',666],['Bbio projet = 55,40 points Bbiomax = 75,00 points Gain = + 26,13%',609],['Cep nr projet = 63,70 kWhep/m² Cep nr max = 66,70 kWhep/m²Gain = + 4,50%',556],['Cep projet = 63,70 kWhep/m² Cepmax = 81,00 kWhep/m²Gain = + 21,36%',503],['Sref : 775,50 m² Zone climatique H2d Altitude 183 m',454],['*Le classement DPE indique ci-dessus est realise a titre informatif et ne remplacent pas un DPE realise par un professionnel agree.',147],['juridique ou reglementaire et ne remplace en rien le Diagnostic de Performance Energetique reglementaire.',138],['Respect des exigences de moyens',120]]),
    mkPage(5,[['VENTILATION GESTIONNAIRE D\'ENERGIE',669],['Type Simple flux Type /',606],['Hygroreglable type B',591],['CHAUFFAGE EAU CHAUDE SANITAIRE',488],['PAC AIR/EAU Collectives T3 et plus : Ballons thermo.',432],['Reversible : OUI',351],['T2 et moins : Ballons',398],['electriques Zeneo etroit 100L',389],['Nombre : 45 panneaux Type : FLASH Half-Cut White 410 Wc (DUALSUN)',173]]),
    mkPage(7,[['Fenetre ALU + VRE 1,12 W/m².K ALU 1,80 W/m².K Uc 0,70 W/m².K 0,531 0,656 0,02 0',355],['4-16-4 Programables',348]])
  ]);
}
