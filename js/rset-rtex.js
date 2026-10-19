// v2.3.13 — « Fichier standardisé des caractéristiques thermiques d'une construction Existante » (RSET RT existant,
// feuille de style XSL commune aux logiciels : BatiAudit / U48Win de Perrenoud, ClimaWin, Pléiades…).
//  • FEUILLET BATIMENT (N) — surface, année, logements, Cep (Initial (a), Projet (b), écarts, Référence (c)), Ubat,
//    Tic par groupe, consommations en énergie finale, label visé, parois opaques et vitrées les plus représentatives ;
//  • FEUILLET EQUIPEMENT (-ID : n) — ventilation (initiale / projet), tableaux « Type d'energie » oui/non (colonnes
//    Initial / Projet) du chauffage et de l'ECS ;
//  • FEUILLET GENERATION (N) — générateurs de l'état initial (1 -) et du projet (3 -).
// Un « - » dans une colonne signifie « non renseigné » : aucune valeur n'est déduite.
// v2.3.16 — fiche imprimée en image (OCR) : puces OCR retirées, « (m?) » lu comme (m2), Tic en « °c », générateurs sur
// plusieurs colonnes pondérés par nombre × puissance unitaire.
// v2.4.0 — réécriture : libellés comparés sans espaces (l'édition Pléiades imprime « Nom bre de lo ge m e nts 2 » et des
// titres de chapitre dans une police sans table Unicode), « --non calcule-- » lu comme colonne vide, label visé (Cep max),
// postes du Cep recalculés depuis l'énergie finale (kWh × coefficient / SHON), isolants et vitrages des tableaux de parois,
// type de PAC, chaudière à condensation, ECS, ventilation initiale.
import {normalizeText,parseFrNumber} from './utils.js';

const rx_lt=l=>normalizeText(l?.text||'').replace(/\s+/g,' ').trim()
  .replace(/^(?:[>»—=©«•|]+\s*|(?:BP|B>|P>|P)\s+(?=[A-Z]))/,'').replace(/\(m\s*[?°*²]\)/gi,'(m2)').trim();
// Forme compacte (minuscules, sans espaces) pour reconnaître les libellés quelle que soit l'espacement des lettres.
const rx_c=s=>normalizeText(s).toLowerCase().replace(/\s+/g,'');
const RX_VAL=/^(?:[-+]?\d+(?:[.,]\d+)?(?:E[-+]?\d+)?%?|-|--|NC|NaN|Infinity%?|-Infinity%?)$/i;
const rx_num=t=>/^[-+]?\d+(?:[.,]\d+)?(?:E[-+]?\d+)?%?$/i.test(t)?parseFrNumber(t.replace(/%$/,'')):null;
// Colonnes de valeurs en fin de ligne (« - », « -- », « --non calcule-- » = vide).
function rx_tail(t){
  const toks=String(t||'').replace(/-{1,2}\s*non\s*calcule\s*-{1,2}/gi,' NC ').trim().split(/\s+/); const out=[];
  for(let i=toks.length-1;i>=0;i--){ if(!RX_VAL.test(toks[i])) break; out.unshift(rx_num(toks[i])); }
  return out;
}
// Anciennes colonnes « à la suite du libellé » (gardées pour les lignes « Coefficient Cep 195.20 - - »).
const rx_tok=s=>String(s||'').replace(/-{1,2}\s*non\s*calcule\s*-{1,2}/gi,' -- ').trim().split(/\s+/).map(t=>/^-?\d+(?:[.,]\d+)?%?$/.test(t)?(t.endsWith('%')?null:parseFrNumber(t)):(t==='-'||t==='--'?null:t));

// v2.3.18 — variante ClimaWin imprimée depuis le navigateur : « Cadre standard de présentation du Récapitulatif
// Standardisé d'Étude Thermique » (Réglementation Thermique Existante), feuillets dont le titre est coupé sur deux lignes,
// état initial « non calculé » (colonnes « -- » / « NaN »).
export function isRtexStandardFiche(doc){
  const t=String(doc?.read?.text||'').slice(0,20000);
  return /Fichier\s+standardise\s+des\s+caracteristiques\s+thermiques\s+d.une\s+construction\s+Existante/i.test(t)
    ||(/Recapitulatif\s+Standardise\s+d.Etude\b/i.test(t)&&/Reglementation\s+Thermique\s+Existante/i.test(t)&&/FEUILLET\s+BATIMENT/i.test(String(doc?.read?.text||'')));
}
function rx_lines(doc){
  const out=[]; for(const page of doc.read?.pages||[]) (page.lines||[]).forEach(line=>{ const t=rx_lt(line); out.push({page,line,t,c:rx_c(t)}); });
  // Titre de feuillet coupé : « FEUILLET BATIMENT (Batiment … SOLUTION » + « PAC) ».
  for(let i=0;i<out.length-1;i++){ const x=out[i]; if(/^FEUILLET\s+(?:BATIMENT|EQUIPEMENT|GENERATION)\s*\(/i.test(x.t)&&!/\)/.test(x.t)&&/^[^()]*\)/.test(out[i+1].t)){ x.t=`${x.t} ${out[i+1].t.match(/^[^()]*\)/)[0]}`; x.c=rx_c(x.t); } }
  return out;
}
const rx_clean=s=>String(s||'').replace(/^re\.?(?=Batiment\b)/i,'').replace(/^Bat(?:iment)?\.?\s*/i,'').replace(/\s*-?\s*(?:apres|avant)\s+travaux\b.*$/i,'').replace(/\s*-?\s*(?:SOLUTION|OPTION|VARIANTE|SCENARIO)\b.*$/i,'').trim();
function rx_sections(lines){
  const secs=[]; lines.forEach((x,i)=>{ let m;
    if((m=x.t.match(/^FEUILLET\s+BATIMENT\s*\(\s*(?:Bat(?:iment)?\.?\s+)?([^)]+?)\s*\)/i))) secs.push({kind:'bat',id:m[1],i});
    else if((m=x.t.match(/^FEUILLET\s+EQUIPEMENT\s*\(\s*(?:(?:Bat(?:iment)?\.?\s+)?([^)]*?)\s*)?-?\s*ID\s*:\s*(\d+)\s*\)/i))) secs.push({kind:'equip',id:m[2],bat:m[1]||null,i});
    else if((m=x.t.match(/^FEUILLET\s+GENERATION\s*\(\s*(?:Bat(?:iment)?\.?\s+)?([^)]+?)\s*\)/i))) secs.push({kind:'gen',id:m[1],i}); });
  return secs.map((s,k)=>({...s,lines:lines.slice(s.i,k+1<secs.length?secs[k+1].i:lines.length)}));
}
function rx_buildingName(sec){
  const id=sec.lines.find(x=>/^identifiant/.test(x.c)); const m=id?.t.match(/^Ide\s*ntifi\s*a\s*nt\s+(?:Batiment\s+)?(.*?)\s*-\s*\((?:Batiment\s+)?[^)]*\)\s*$/i);
  const name=rx_clean(m?.[1]||''); const fromId=rx_clean(sec.id);
  return `Batiment ${name&&!/^-?$/.test(name)?name:(fromId||sec.id)}`.replace(/^Batiment\s+$/,'Batiment');
}
export function rtexStandardBuildingNames(doc){ return rx_sections(rx_lines(doc)).filter(s=>s.kind==='bat').map(rx_buildingName); }

const RX_VECT=[[/^electriqueaeffetjoule/,'Électricité'],[/^electriquethermodynamique/,'Électricité'],[/^gaz/,'Gaz'],[/^fioul/,'Fioul'],[/^solaire/,'Solaire'],[/^reseaux?(?:de)?chaleur/,'Réseau de chaleur urbain'],[/^bois/,'Bois / biomasse']];
const RX_ENERGY=s=>/gaz/i.test(s)?'Gaz':/elec/i.test(s)?'Électricité':/fioul/i.test(s)?'Fioul':/bois/i.test(s)?'Bois / biomasse':/solaire/i.test(s)?'Solaire':/reseau|chaleur/i.test(s)?'Réseau de chaleur urbain':null;
// Tableau « Type d'energie : / Initial Projet / gaz oui non … » → vecteurs initial / projet (oui uniquement).
function rx_energyTable(lines,start,noInit=false){
  const res={before:[],after:[],at:null,rows:0,thermo:false,joule:false};
  for(const x of lines.slice(start+1,start+12)){
    const v=RX_VECT.find(([re])=>re.test(x.c)); if(!v){ if(/^(?:initial)?projet$/.test(x.c)) continue; if(res.at) break; continue; }
    const rest=(x.c.replace(v[0],'').replace(/^[a-z]*?(?=(?:oui|non)+$)/,'').match(/oui|non/g))||[]; res.at=res.at||x; res.rows++;
    // État initial « non calculé » : une seule colonne renseignée, celle du projet.
    const [bv,av]=(noInit||rest.length===1)&&rest.length===1?[null,rest[0]]:[rest[0],rest[1]];
    if(bv==='oui') res.before.push({v:v[1],x}); if(av==='oui'){ res.after.push({v:v[1],x}); if(/thermodynamique/.test(x.c)) res.thermo=true; if(/effetjoule/.test(x.c)) res.joule=true; }
  }
  return res;
}
// Isolants nommés dans des libellés compactés (« murexterieurpse19 », « lainedeverre »).
const RX_INS=[[/fibredebois|lainedebois/,'Fibre de bois'],[/lainedeverre|isover/,'Laine de verre'],[/lainederoche|ecorock|rockwool|rockmur|fibraroc/,'Laine de roche'],[/polyurethane|\bpu[ri]\b|pu[ri](?=r?=|\d)|efigreen|efisol|utherm|enertherm|eurotoit|thane/,'PUR'],
  [/extrude|xps|styrodur/,'XPS'],[/polystyrene|pse|fibrastyroc/,'PSE'],[/ouate|cellulose/,'Ouate de cellulose'],[/chanvre|coton|\blin\b/,'Biosourcé chanvre/lin/coton'],[/liege/,'Liège'],[/laineminerale|lm\d/,'Laine minérale']];
const rx_ins=c=>RX_INS.find(([re])=>re.test(c))?.[1]||null;

export function parseRtexStandardFiche(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=rx_lines(doc); const secs=rx_sections(lines); const origin='RSET RT existant (fichier standardisé)';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value))) return; const o=occ(doc,x.page,x.line,field,value,`rset-rtex:${method}`,conf,unit,{building:canonical(b),structuredPdf:true,origin,dedicatedRank:4,...extra}); if(o) out.push(o); };
  const bats=secs.filter(s=>s.kind==='bat').map(s=>({...s,name:rx_buildingName(s)}));
  const noInit=lines.some(x=>/--\s*non\s+calcule/i.test(x.t));
  const surfOf={}, shonOf={}, energy={};
  const r2=v=>Math.round(v*100)/100;
  for(const s of bats){
    const B=s.name; const L=s.lines; const find=re=>L.find(x=>re.test(x.c));
    let x,m,v;
    if((x=find(/^surfaceutileouhabitable\(m2\)[\d.,]+$/))){ v=rx_tail(x.t).pop(); surfOf[B]=v; emit(x,B,'shab',v,'surface',0.97,'m²'); }
    if((x=find(/^shonrenovee\(m2\)[\d.,]+$/))) shonOf[B]=rx_tail(x.t).pop();
    if((x=find(/^anneedelaconstruction\d{4}$/))){ v=rx_tail(x.t).pop(); if(v>=1500&&v<=2100) emit(x,B,'construction_year',v,'annee',0.96); }
    if((x=find(/^nombredelogements\d+$/))) emit(x,B,'housing_count',rx_tail(x.t).pop(),'logements',0.96);
    if((x=find(/^lestravauxsont-ilssoumisalareglementationthermiqueglobale\?(oui|non)/))) emit(x,B,'renovation','Oui','renovation',0.9,'',{provenanceNote:`Rénovation soumise à la RT existant globale : ${/oui$/.test(x.c)?'oui':'non'}.`});
    // Cep du bloc « Résultats du calcul de la consommation conventionnelle » (pas le bloc label « kWh-ep/m2SHON »).
    let cepP=null, cepRef=null;
    if((x=L.find(y=>/^coefficientcep(?!kwh)/.test(y.c)&&!/kwh-?ep\/m2/i.test(y.c)))){
      let t=rx_tail(x.t); if(t.length<2){ t=rx_tok(x.t.replace(/^Coefficient\s+Cep\s+/i,'')); }
      // Initial non calculé : « Coefficient Cep 88.2 -- -- 140.6 … » → seule la colonne Projet (b) est renseignée.
      if(noInit&&Number.isFinite(t[0])&&t[1]===null&&t[2]===null) t=[null,t[0],null,null,t[3]];
      if(Number.isFinite(t[0])) emit(x,B,'cep_before',t[0],'cep-initial',0.97,'kWhEP/m².an',{provenanceNote:'Colonne « Initial (a) » du tableau Cep.'});
      if(Number.isFinite(t[1])){ cepP=t[1]; emit(x,B,'cep_after_final',t[1],'cep-projet',0.97,'kWhEP/m².an',{provenanceNote:'Colonne « Projet (b) » du tableau Cep.'}); emit(x,B,'cep',t[1],'cep-projet',0.92,'kWhEP/m².an'); }
      if(t.length>=5&&Number.isFinite(t[4])) cepRef=t[4];
    }
    // Cep max : Cep de référence (c) — exigence de la RT existant globale ; le label visé reste en note.
    { const lv=find(/^niveaudeperformance:/); const lab=L.find(y=>/^(?:coefficientcep)?kwh-?ep\/m2shon/.test(y.c)); const lt=lab?rx_tail(lab.t):[];
      const label=lv?lv.t.replace(/^.*?:\s*/,'').trim():''; const labV=lab&&lt.length>=2&&Number.isFinite(lt[1])&&lt[1]>0&&!/sans\s*plus/i.test(label)?lt[1]:null;
      if(cepRef!==null&&x){ const note={provenanceNote:`Cep de référence (c) du tableau Cep${labV?` ; objectif du label « ${label} » : ${labV}`:''}.`};
        emit(x,B,'cep_max',cepRef,'cep-ref',0.93,'kWhEP/m².an',note); if(cepP!==null) emit(x,B,'cep_gain',Math.round((cepRef-cepP)/cepRef*1000)/10,'cep-gain',0.92,'%',{provenanceNote:`Gain = (Cep ref − Cep projet) / Cep ref = (${cepRef} − ${cepP}) / ${cepRef}.`}); }
      else if(labV){ emit(lab,B,'cep_max',labV,'cep-max-label',0.85,'kWhEP/m².an',{provenanceNote:`Objectif du label « ${label} » (Cep de référence absent).`,reviewCap:0.85}); } }
    if((x=find(/^ubat\(hiver\)/))){ const t=rx_tail(x.t);
      if(Number.isFinite(t[0])) emit(x,B,'ubat_before',t[0],'ubat-initial',0.97,'W/m².K',{provenanceNote:'Colonne « Initial (a) » de l’Ubat.'});
      if(Number.isFinite(t[1])) emit(x,B,'ubat_after',t[1],'ubat-projet',0.97,'W/m².K',{provenanceNote:'Colonne « Projet (b) » de l’Ubat.'}); }
    // Tic : groupes « <groupe> °C 24.35 29.56 -5.21 » ; le plus chaud fait le Tic du bâtiment.
    { const th=L.findIndex(y=>/tic\(a\)ticref\(b\)/.test(y.c)); const g=[];
      if(th>=0) for(const y of L.slice(th+1,th+12)){ if(/^art\b/i.test(y.t)) break; if((m=y.t.match(/°\s*C\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)(?:\s+-?\d+[.,]\d+)?$/i))) g.push({y,a:parseFrNumber(m[1]),r:parseFrNumber(m[2])}); }
      const top=g.sort((p,q)=>q.a-p.a)[0]; if(top){ const note=g.length>1?{provenanceNote:`Tic du groupe le plus chaud parmi ${g.length}.`}:{}; emit(top.y,B,'tic',top.a,'tic',0.96,'°C',note); emit(top.y,B,'tic_ref',top.r,'tic-ref',0.96,'°C',note); } }
    // Consommations en énergie finale (kWh) : vecteurs et postes du Cep (kWh × coefficient / SHON).
    { const row=re=>{ const y=L.find(z=>re.test(z.c)); if(!y) return null; const t=rx_tail(y.t); return {y,ini:noInit&&t.length<7?null:t[0],proj:noInit&&t.length<7?t[t.length>=6?1:0]:t[1],t}; };
      const R={ch_el:row(/^dontchauffageelectrique/),ch_bo:row(/^dontchauffagebois/),ch_au:row(/^dontchauffageautressources/),ecs_el:row(/^dontecselectrique/),ecs_bo:row(/^dontecsbois/),ecs_au:row(/^dontecsautressources/),
        fr_el:row(/^dontrefroidissementelectrique/),fr_au:row(/^dontrefroidissementautressources/),aux_v:row(/^dontauxiliaires(?:de)?ventilation/),aux_g:row(/^dontauxiliairesdegeneration/),aux_d:row(/^dontauxiliairesdedistribution/),ecl:row(/^donteclairage/),pv:row(/^productiond'electriciteademeure(?!par)/)};
      energy[B]=R; s.R=R; }
    // Parois opaques : « … P SE 19 6.16 90.85 - 0.15 7.12 0.36 -0.21 » (épaisseur cm, R, surface, U initial, U, poids, U réf, écart)
    // ou variante ClimaWin « 14 4.4 Th-U 121.25 … ». Type de paroi lu dans le contexte (murs, planchers hauts / bas).
    const pw={};
    L.forEach((y,k)=>{ let r=y.t.match(/(?:^|\s)(\d{1,2}(?:[.,]\d+)?)\s+(\d{1,2}(?:[.,]\d+)?)\s+Th-U\s+(\d+(?:[.,]\d+)?)\b/)||y.t.match(/(?:^|\s)(\d{1,2}(?:[.,]\d+)?)\s+(\d{1,2}(?:[.,]\d{1,2})?)\s+(\d+(?:[.,]\d+)?)\s+(?:-|\d+(?:[.,]\d+)?)\s+\d+(?:[.,]\d+)?\s+\d+(?:[.,]\d+)?\s+\d+(?:[.,]\d+)?\s+-?\d+(?:[.,]\d+)?$/);
      if(!r) return;
      const near=L.slice(Math.max(0,k-3),k+3);
      // Cellules du tableau coupées autour de la ligne chiffrée : la ligne elle-même, puis ses voisines immédiates.
      const KIND=c=>/plancherbas|planchersbas|terreplein|caves|videsanitaire|soussol|surtp\b|plancherssurlocal|\bplb/.test(c)?'floor':/toiture|terrasse|plancher(?:s)?hauts?|rampant|comble/.test(c)?'roof':/parois?mur|paroisverticales|murexterieur|mur(?:de)?facade|pignon/.test(c)?'wall':null;
      const kind=/\badj\b/i.test(y.t)?(L.slice(k,k+16).some(z=>/comble/i.test(z.t))?'roof':null)
        :KIND(y.c.replace(/\d.*$/,''))||KIND((L[k-1]?.c||'')+(L[k+1]?.c||''))||KIND(L[k-1]?.c||'')||KIND((L[k-2]?.c||'')+(L[k+2]?.c||''))||KIND(rx_c(near.map(z=>z.t).join(' ')));
      if(!kind) return; const e=parseFrNumber(r[1]), R=parseFrNumber(r[2]), sf=parseFrNumber(r[3]); if(!(e>0&&R>0)) return;
      const key=`${kind}|${e}|${R}`; const g=pw[key]||(pw[key]={kind,e,R,s:0,y,ins:null,seen:new Set()}); if(g.seen.has(sf)) return; g.seen.add(sf); g.s+=sf; g.ins=g.ins||rx_ins(rx_c(near.map(z=>z===y?z.t.replace(/\d+(?:[.,]\d+)?\s+\d+(?:[.,]\d+)?\s+.*$/,''):z.t.replace(/[-\d.,%\s]+$/,'')).join(' '))); });
    for(const kind of ['wall','roof','floor']){ const g=Object.values(pw).filter(z=>z.kind===kind).sort((a,b)=>b.s-a.s)[0]; if(!g) continue;
      const f={wall:['wall_insulation','wall_insulation_thickness','wall_insulation_r'],roof:['roof_insulation','roof_insulation_thickness','roof_insulation_r'],floor:['floor_insulation','floor_insulation_thickness','floor_insulation_r']}[kind];
      const note={provenanceNote:`Paroi la plus représentative (${Math.round(g.s*100)/100} m²) du tableau des parois opaques : ${g.ins?`${g.ins}, `:''}isolant ${g.e} cm, R = ${g.R}.`};
      if(g.ins) emit(g.y,B,f[0],g.ins,`${kind}-isolant`,0.9,'',note);
      emit(g.y,B,f[1],Math.round(g.e*10),`${kind}-epaisseur`,0.93,'mm',note); emit(g.y,B,f[2],g.R,`${kind}-r`,0.93,'m².K/W',note); }
    // Parois opaques : libellé du mur principal (« Mur en beton banche », « 0_Mur Brique »).
    const op=L.findIndex(y=>/^paroisopaques/.test(y.c));
    if(op>=0){ const w=L.slice(op,op+20).find(y=>/^Mur\s+en\s+/i.test(y.t)||/(?:^|[\s_])Mur\s+(?:en\s+)?(?:beton|pierre|brique|parpaing|agglo|bois)\b/i.test(y.t)); if(w){ const s2=w.t.toLowerCase(); const v2=/beton\s+banche/.test(s2)?'Béton banché':/beton/.test(s2)?'Béton':/pierre/.test(s2)?'Pierre':/brique/.test(s2)?'Brique':/parpaing|agglo/.test(s2)?'Parpaing':/bois/.test(s2)?'Ossature bois':null; if(v2) emit(w,B,'wall_structure',v2,'paroi-principale',0.9,'',{provenanceNote:`Libellé de la paroi verticale la plus représentative : ${w.t}.`}); } }
    // Parois vitrées : « Fenetre avec 1.1 PVC 10.44 - 1.7 9.27 1.8 -0.1 » (fermeture, Ug, menuiserie, surface, U initial, U,
    // poids, U réf, écart) ou « Fenetre avec PVC Th-U 502 0 1.3 26 1.8 -0.5 » ; libellé « (avec VR) » = volets roulants.
    { const mats={}, gls={}, shs={}; let tot=0, sansS=0; const wins=L.map((z,k)=>({z,k})).filter(({z})=>/^(?:fenetre|portefenetre|baie)/.test(z.c));
      for(const {z:y,k} of wins){
        const t=rx_tail(y.t); const sf=t[0]>0?t[0]:1, U=t.length>=5?t[2]:null;
        const mat=/\bPVC\b/i.test(y.t)?'PVC':/\balu/i.test(y.t)?'Aluminium':/\bbo\s*is\b/i.test(y.t)?'Bois':null;
        const ug=(y.t.match(/\b(?:a\s*ve\s*c|sa\s*ns)\s+(\d(?:[.,]\d+)?)\s+[A-Za-z]/i)||[])[1]; const u=ug!==undefined&&parseFrNumber(ug)>0?parseFrNumber(ug):U;
        const sans=/\bsa\s*ns\b/i.test(y.t)&&!/\ba\s*ve\s*c\b/i.test(y.t); const lib=[L[k-1]?.t,y.t,L[k+1]?.t].join(' ');
        tot+=sf; if(sans) sansS+=sf;
        const sh=/\(\s*sans\s+VR\s*\)/i.test(lib)?null:/\bVR\b|volets?\s+roulants?/i.test(lib)?'Volet roulant':/persienne/i.test(lib)?'Persienne':/\bBSO\b|brise/i.test(lib)?'BSO':/volets?\s+battants?/i.test(lib)?'Volet battant':null;
        if(mat){ mats[mat]=mats[mat]||{n:0,s:0,y}; mats[mat].n++; mats[mat].s+=sf; }
        if(sh&&!sans){ shs[sh]=shs[sh]||{s:0,y}; shs[sh].s+=sf; }
        if(u>0){ const gl=u<=0.9?'Triple vitrage':u<=3?'Double vitrage':'Simple vitrage'; gls[gl]=gls[gl]||{s:0,y,u}; gls[gl].s+=sf; } }
      const top=o=>Object.entries(o).sort((a,b)=>b[1].s-a[1].s)[0];
      const best=top(mats); if(best) emit(best[1].y,B,'window_material',best[0],'menuiseries',0.92,'',{provenanceNote:`${best[1].n} menuiserie(s) ${best[0]} (${Math.round(best[1].s)} m²) dans le tableau des parois vitrées.`});
      const bg=top(gls); if(bg) emit(bg[1].y,B,'window_glazing',bg[0],'vitrage-u',0.82,'',{provenanceNote:`U ${bg[1].u} W/m².K des parois vitrées majoritaires (déduit : le type de vitrage n’est pas écrit).`,reviewCap:0.85});
      const bs=top(shs); if(bs) emit(bs[1].y,B,'window_shading',bs[0],'fermetures',0.88,'',{provenanceNote:`Fermetures des menuiseries majoritaires (${Math.round(bs[1].s)} m²).`});
      else if(tot>0&&sansS===tot) emit(wins[0].z,B,'window_shading','Sans occultation','fermetures',0.8,'',{provenanceNote:'Parois vitrées toutes « sans » fermeture.'}); }
  }
  // Cep par poste et par énergie (projet) : kWh d'énergie finale × coefficient (2,58 électricité, 1 autres) / SHON.
  const autreOf={}, ecsMode={};
  for(const s of bats){ const B=s.name, R=s.R; const shon=shonOf[B]; if(!R||!(shon>0)) continue;
    const p=k=>R[k]&&Number.isFinite(R[k].proj)?R[k].proj:null; const ep=(k,c=2.58)=>p(k)===null?null:r2(p(k)*c/shon);
    const x=R.ecl?.y||R.aux_v?.y; const note=k=>({provenanceNote:`Calculé : ${k} (kWh énergie finale, projet) × 2,58 / SHON ${shon} m².`});
    if(ep('ecl')!==null) emit(R.ecl.y,B,'cep_lighting',ep('ecl'),'cep-eclairage',0.9,'kWhEP/m².an',note('éclairage'));
    if(ep('aux_v')!==null) emit(R.aux_v.y,B,'cep_aux_vent',ep('aux_v'),'cep-aux-ventilation',0.9,'kWhEP/m².an',note('auxiliaires de ventilation'));
    if(ep('aux_g')!==null||ep('aux_d')!==null) emit((R.aux_g||R.aux_d).y,B,'cep_aux_dist',r2((ep('aux_g')||0)+(ep('aux_d')||0)),'cep-aux-distribution',0.88,'kWhEP/m².an',note('auxiliaires de génération et de distribution'));
    if(p('fr_el')!==null||p('fr_au')!==null) emit((R.fr_el||R.fr_au).y,B,'cep_cooling',r2((ep('fr_el')||0)+(ep('fr_au',1)||0)),'cep-refroidissement',0.88,'kWhEP/m².an',note('refroidissement'));
    s.cepEl=r2(['ch_el','ecs_el','fr_el','aux_v','aux_g','aux_d','ecl'].reduce((a,k)=>a+(ep(k)||0),0)); s.cepAutre=r2(['ch_au','ecs_au','fr_au'].reduce((a,k)=>a+(ep(k,1)||0),0)); s.cepBois=r2(['ch_bo','ecs_bo'].reduce((a,k)=>a+(ep(k,1)||0),0)); s.cx=x; }
  // Feuillets équipement : rattachement par la surface de la zone.
  for(const s of secs.filter(z=>z.kind==='equip')){
    const L=s.lines; const surf=L.find(x=>/^surfacetotaleutiledelazone/.test(x.c)&&/[\d.,]+$/.test(x.t))||L.find((x,k)=>/^surfacetotaleutiledelazone$/.test(x.c)&&/^\(m2\)[\d.,]+$/.test(L[k+1]?.c||'')); const sv=surf?(rx_tail(surf.t).pop()??rx_tail(L[L.indexOf(surf)+1].t).pop()):null;
    const bat=bats.find(b=>sv!==null&&Math.abs((surfOf[b.name]||-1)-sv)<0.6)||(s.bat?bats.find(b=>b.id===s.bat||b.name===`Batiment ${s.bat}`||b.name===`Batiment ${rx_clean(s.bat)}`):null)||bats.find(b=>b.id===s.id)||(bats.length===1?bats[0]:null); if(!bat) continue; const B=bat.name;
    const init=L.find(x=>/^naturelleparconduit|^ventilationnaturelle|^mecaniqueautoreglable|^mecaniquehygro|^ventilationparouverture|^parouverturedesfenetres/.test(x.c));
    const proj=L.find(x=>/^typedecentraledetraitementd'air-\S/.test(x.c));
    const works=L.find(x=>/lestravauxderenovationthermiqueont-ilsportesurlaventilation\?(oui|non)/.test(x.c));
    const posed=L.findIndex(x=>/^typedeventilationmisenplace/.test(x.c)); const posedSys=posed>=0?L.slice(posed+1,posed+6).find(x=>/^mecanique|^ventilation|^naturelle/.test(x.c)&&/m2/.test(x.c)):null;
    if(proj||posedSys){ const s2=normalizeText((proj||posedSys).t).toLowerCase().replace(/\s+/g,''); let v=/doubleflux/.test(s2)?'VMC double flux':/hygro\w*b/.test(s2)?'VMC Hygro B':/hygro\w*a/.test(s2)?'VMC Hygro A':/hybride/.test(s2)?'Ventilation hybride':/simpleflux|extracteur|\(sf\)/.test(s2)?'VMC simple flux':null;
      // Simple flux précisée par le tableau « dont hygroreglable type B » ou « VMC hygro B » du feuillet.
      if(v==='VMC simple flux'){ const h=L.map(y=>y.c).join(' ').match(/hygro\w*?(?:reglable)?(?:type)?([ab])m2/i)||L.map(y=>y.t).join(' ').match(/hygro\w*\s*(?:reglable\s+)?(?:type\s+)?([AB])\b/i); if(h) v=`VMC Hygro ${h[1].toUpperCase()}`; }
      if(v) emit(proj||posedSys,B,'ventilation',v,'ventilation-projet',0.92); }
    const vInit=init?(/hygro\w*b/.test(init.c)?'VMC Hygro B':/hygro\w*a/.test(init.c)?'VMC Hygro A':/mecanique/.test(init.c)?'VMC simple flux autoréglable':'Ventilation naturelle'):null;
    if(vInit) emit(init,B,'ventilation_before',vInit,'ventilation-initiale',0.92);
    if(!(proj||posedSys)&&vInit&&works&&/non$/.test(works.c)) emit(init,B,'ventilation',vInit,'ventilation-inchangee',0.9,'',{provenanceNote:'Ventilation existante ; les travaux ne portent pas sur la ventilation.'});
    // Chapitres numérotés du feuillet : 2 = chauffage, 4 = ECS (titres parfois illisibles, numéros conservés).
    const chap=n=>L.findIndex(x=>new RegExp(`^${n}\\s*-\\s*\\S`).test(x.t)&&!/^\d\s*-\s*\d/.test(x.t));
    const chIdx=chap(2), frIdx=chap(3), ecsIdx=chap(4);
    const typeAfter=(i,j)=>L.findIndex((x,k)=>k>i&&(j<0||k<j)&&/^typed'energie:/.test(x.c));
    let ch=null, ec=null;
    if(chIdx>=0){ const k=typeAfter(chIdx,frIdx>chIdx?frIdx:ecsIdx); if(k>=0){ const r=rx_energyTable(L,k,noInit); ch=r; const c=r.rows>=7?0.94:0.8; if(r.before.length===1) emit(r.before[0].x,B,'heating_vector_before',r.before[0].v,'chauffage-energie-initial',c); if(r.after.length===1) emit(r.after[0].x,B,'heating_vector_after',r.after[0].v,'chauffage-energie-projet',c); } }
    if(ecsIdx>=0){ const k=typeAfter(ecsIdx,-1); if(k>=0){ const r=rx_energyTable(L,k,noInit); ec=r; const c=r.rows>=7?0.94:0.8; if(r.before.length===1) emit(r.before[0].x,B,'ecs_vector_before',r.before[0].v,'ecs-energie-initial',c); if(r.after.length===1) emit(r.after[0].x,B,'ecs_vector_after',r.after[0].v,'ecs-energie-projet',c); } }
    if(ch?.after.length===1&&ch.after[0].v!=='Électricité') autreOf[B]=ch.after[0].v;
    if(ec?.after.length===1){ const v2=ec.after[0].v; ecsMode[B]={v:v2,x:ec.after[0].x,joule:ec.joule,thermo:ec.thermo}; if(v2!=='Électricité') autreOf[B]=autreOf[B]||v2; }
    // Émetteurs projet : panneaux / convecteurs électriques = chauffage électrique direct.
    if(ch?.after.length===1&&ch.after[0].v==='Électricité'&&!ch.thermo){ const em=L.find(x=>/^(?:convecteur|panneaurayonnant|radiateurelect)/.test(x.c)&&/(\d+(?:[.,]\d+)?)m2$/.test(x.c)); if(em) emit(em,B,'heating_mode_after','Chauffage électrique direct','emetteurs',0.88); }
  }
  // Énergies du Cep : électricité, « autres » (nommée par le tableau d'énergie du projet), bois.
  for(const s of bats){ const B=s.name; if(s.cepEl===undefined) continue;
    const autre=autreOf[B]; const F={'Gaz':'cep_gas','Réseau de chaleur urbain':'cep_district','Bois / biomasse':'cep_biomass'};
    emit(s.cx,B,'cep_electricity',s.cepEl,'cep-electricite',0.88,'kWhEP/m².an',{provenanceNote:'Calculé : consommations électriques du projet × 2,58 / SHON.'});
    if(s.cepAutre>0&&F[autre]) emit(s.cx,B,F[autre],s.cepAutre,'cep-autre',0.86,'kWhEP/m².an',{provenanceNote:`Calculé : consommations « autres sources » (${autre}) du projet / SHON.`});
    if(s.cepAutre===0&&s.cepEl>0) emit(s.cx,B,'cep_gas',0,'cep-gaz-nul',0.86,'kWhEP/m².an',{provenanceNote:'Aucune consommation « autres sources » au projet.'});
    if(s.cepBois>0) emit(s.cx,B,'cep_biomass',s.cepBois,'cep-bois',0.86,'kWhEP/m².an',{provenanceNote:'Calculé : consommations bois du projet / SHON.'});
    const R=s.R; const pv=R?.pv; if(pv){ const on=(pv.t||[]).some(z=>z>0); emit(pv.y,B,'enr',on?'Oui':'Non','enr-pv',0.85); if(on) emit(pv.y,B,'enr_type','Photovoltaïque','enr-type',0.85); }
    if(R&&(R.fr_el||R.fr_au)){ const cool=(R.fr_el?.proj||0)+(R.fr_au?.proj||0); emit((R.fr_el||R.fr_au).y,B,'cooling',cool>0?'Climatisation active':'Aucun','refroidissement',0.85); } }
  // Feuillets génération : état initial (1 -) et projet (3 -).
  for(const s of secs.filter(z=>z.kind==='gen')){
    const bat=bats.find(b=>b.id===s.id)||(bats.length===1?bats[0]:null); if(!bat) continue; const B=bat.name; const L=s.lines;
    const pIdx=L.findIndex(x=>/^3-|^3-?projet/.test(x.c)||/PROJET\s*:?\s*NOUVEAUX\s*GENERATEURS/i.test(x.t)); const fIdx=L.findIndex((x,k)=>k>pIdx&&/^4-/.test(x.c));
    const val=(part,re)=>{ const y=part.find(x=>re.test(x.c)); return y?{y,v:y.t.replace(/^.*?\s-\s*/,'').trim()}:null; };
    const vec=(part)=>{ const te=val(part,/^typed'energie-/), tg=val(part,/^typedegenerateur-/), mode=part.find(x=>/^modedeproduction/.test(x.c));
      const g=tg?.v||''; const e=te?.v||'';
      let v=/reseau\s+de\s+chaleur|chauffage\s+urbain|sous-station/i.test(g)?'Réseau de chaleur urbain':/pompe|pac\b|thermodynamique/i.test(g)?'Électricité':RX_ENERGY(e.split(/\s+/)[0]||'');
      // Plusieurs générateurs en colonnes (« Gaz Electrique Electrique ») : vecteur dominant en nombre × puissance unitaire.
      const cols=[...e.matchAll(/\b(gaz|electrique|fioul|bois|solaire|reseaux?(?:\s+de\s+chaleur)?)\b/gi)].map(k=>RX_ENERGY(k[1]));
      let share=null;
      if(cols.length>1&&new Set(cols).size>1){ const nums=re=>{ const l=part.find(x=>re.test(x.c)); return l?(rx_c(l.t).replace(re,'').match(/\d+(?:\.\d+)?/g)||[]).map(Number):[]; };
        const n=(()=>{ const l=part.find(x=>/^nombredegenerateursidentiques/.test(x.c)); return l?rx_tail(l.t).filter(Number.isFinite):[]; })(), pw=(()=>{ const l=part.find(x=>/^puissancenominaleunitairekw/.test(x.c)); return l?rx_tail(l.t).filter(Number.isFinite):[]; })();
        const w={}; cols.forEach((c,k)=>{ w[c]=(w[c]||0)+(n.length===cols.length?n[k]:1)*(pw.length===cols.length?pw[k]:1); });
        const tot=Object.values(w).reduce((a,b)=>a+b,0); const top=Object.entries(w).sort((a,b)=>b[1]-a[1])[0]; v=top?.[0]||null; share=tot>0?top[1]/tot:null; if(share!==null&&share<0.6) v=null; }
      const mt=mode?L.slice(L.indexOf(mode)-1,L.indexOf(mode)+2).map(x=>x.t).join(' ').replace(/Mode\s+de\s+productio\s*n\s*\([^)]*\)\s*-?\s*/i,''):'';
      return {v,share,x:tg&&/reseau|pompe|pac|thermo/i.test(g)?tg.y:te?.y,mixte:/mixte|chauffage\s+et\s+(?:fourniture\s+)?ecs|ecs\s+seul/i.test(mt),g,mt}; };
    const init=vec(pIdx>=0?L.slice(0,pIdx):L), projPart=pIdx>=0?L.slice(pIdx,fIdx>pIdx?fIdx:L.length):[], proj=pIdx>=0?vec(projPart):{v:null};
    const shareNote=r=>r.share!==null&&r.share!==undefined?` Vecteur majoritaire en puissance installée (${Math.round(r.share*100)} %).`:'';
    if(init.v) emit(init.x,B,'heating_vector_before',init.v,'generation-initiale',0.93,'',shareNote(init)?{provenanceNote:`Générateurs de l’état initial.${shareNote(init)}`}:{});
    if(proj.v) emit(proj.x,B,'heating_vector_after',proj.v,'generation-projet',0.9,'',{provenanceNote:`Nouveau générateur du projet${proj.g?` (${proj.g})`:''}.${shareNote(proj)}`});
    if(init.v&&init.mixte) emit(init.x,B,'ecs_vector_before',init.v,'generation-initiale-ecs',0.88);
    if(proj.v&&proj.mixte) emit(proj.x,B,'ecs_vector_after',proj.v,'generation-projet-ecs',0.86);
    // Générateur du projet : pompe à chaleur (« Compression électrique », « [Exterieur] Air … [Interieur] Eau »), chaudière.
    if(projPart.length){ const pt=projPart.map(x=>x.t).join(' '), pc=rx_c(pt);
      if(/\bCompression\b|\[Exterieur\]\s*Air|pompe\s+a\s+chaleur\s+(?:air|eau|geo)|typedegenerateur-thermodynamique/i.test(pt+' '+pc)){ const at=projPart.find(x=>/\bCompression\b|\[Exterieur\]|pompe\s+a\s+chaleur|typedegenerateur-thermodynamique/i.test(x.t+' '+x.c));
        const typ=/\[exterieur\]airexterieur.{0,30}\[interieur\]?(?:-)?(?:\S{0,40}?)?(?:eau)/.test(pc)||/airexterieur-\[interieur\]eau|\[exterieur\]air.*?eau/.test(pc)?'PAC air/eau':/\[exterieur\]air.*?air/.test(pc)?'PAC air/air':/\[exterieur\](?:sol|eau)/.test(pc)?'PAC géothermique':null;
        emit(at,B,'heating_mode_after',typ||'PAC','generation-projet-pac',0.9,'',{provenanceNote:'Nouveau générateur thermodynamique (pompe à chaleur) du projet.'}); }
      else if(/condensation/.test(pc)&&/chaudiere/.test(pc)) emit(projPart.find(x=>/condensation/.test(x.c)),B,'heating_mode_after','Chaudière condensation','generation-projet-chaudiere',0.9,'',{provenanceNote:'Chaudière à condensation du projet.'});
      else if(/chaudiere/.test(pc)) emit(projPart.find(x=>/chaudiere/.test(x.c)),B,'heating_mode_after',proj.v==='Fioul'?'Chaudière gaz':'Chaudière gaz','generation-projet-chaudiere',0.85); }
    // ECS du projet.
    const em=ecsMode[B];
    if(em){ const ecs=em.v==='Électricité'?(em.thermo?'Chauffe-eau thermodynamique':'Ballon électrique'):em.v==='Réseau de chaleur urbain'?'Réseau de chaleur':['Gaz','Fioul','Bois / biomasse'].includes(em.v)?'Chaudière':em.v==='Solaire'?'Solaire thermique':null;
      if(ecs) emit(em.x,B,'ecs',ecs,'ecs-projet',0.88,'',{provenanceNote:'Énergie de l’ECS du projet (tableau « Type d’énergie »).'}); }
  }
  // Données administratives (maître d'ouvrage, logiciel).
  const moa=lines.findIndex(x=>/^maitred'ouvrage$/.test(x.c)); if(moa>=0){ const n=lines[moa+1]; const m=n?.t.match(/^Nom\s+ou\s+ra\s*iso\s*n\s+so\s*cia\s*le\s*:\s*(.+)$/i)||n?.t.match(/^Nom\s+ou\s+raison\s+sociale\s*:\s*(.+)$/i); if(m&&m[1].trim()) emit(n,'Bâtiment unique','owner_company',m[1].replace(/\s*\(\d{5}\)\s*-\s*\d+\s*$/,'').trim(),'maitre-ouvrage',0.94,'',{secondarySourceOk:true}); }
  const dep=lines.find(x=>/^departement:?(\d{2,3}|2[ab])$/.test(x.c)); if(dep) emit(dep,'Bâtiment unique','department',dep.c.match(/(\d{2,3}|2[ab])$/)[1].toUpperCase(),'departement',0.95,'',{secondarySourceOk:true});
  return out;
}
