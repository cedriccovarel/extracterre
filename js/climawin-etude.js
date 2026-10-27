// v2.4.0 — ClimaWin (BBS Slama) en rénovation, deux éditions :
//  • « Étude » RT existant (Clima-Win 4.x / ClimaWin 2020) : parois, menuiseries et générateurs du projet, puis par bâtiment
//    « N. <bâtiment> - Ubat », « - RT pour l'existant » (BBC Effinergie, « Résultats du Th-C-E Ex » : Cepinit / Cepproj /
//    Cepref / Cep_p / Cepmax, UBat, Tic, consommations en énergie primaire par poste) ;
//  • rapport de saisie « Rapport détaillé » d'une étude RT existante (parois « … av » / « … ap », systèmes du projet), sans
//    résultat réglementaire : seules les compositions et les équipements du projet sont repris.
// Les parois portent leur état dans le nom (« 1re.Mur ITE » rénovée, « 1ex.PLB » existante, « Mur ext av / ap ») et dans
// « Paroi renovee Renove / Non renove ». Épaisseurs en mm (convention ExtracTerre), R en m².K/W.
import {parseFrAddress} from './geocode.js';
import {normalizeText,parseFrNumber,normalizeGlazingType} from './utils.js';
import {insulationName} from './donnees-techniques.js';

const cw_t=l=>normalizeText(l?.text||'').replace(/\s+/g,' ').trim();
function cw_lines(doc){ const out=[]; for(const page of doc.read?.pages||[]) (page.lines||[]).forEach(line=>out.push({page,line,t:cw_t(line)})); return out; }
const cw_nums=s=>(String(s||'').match(/-?\d+(?:[.,]\d+)?/g)||[]).map(parseFrNumber).filter(v=>v!==null);

export function isClimaWinRtexStudy(doc){
  const t=String(doc?.read?.text||'').slice(0,600000);
  return /Clima-?Win/i.test(t)&&/RT\s+pour\s+l.existant/i.test(t)&&/Resultats\s+du\s+Th-C-E\s+Ex/i.test(t);
}
// Rapport de saisie d'une étude RT existante (ou note de BE suivie du rapport de saisie).
export function isClimaWinRtexInput(doc){
  const t=String(doc?.read?.text||'').slice(0,800000);
  return /ClimaWin/i.test(t)&&/rapport\s+detaille/i.test(t)&&/\b3\.\s*Parois\b/i.test(t)&&/RT\s+existante?|Th-?C-?E[- ]?ex|RTEx/i.test(t)&&!isClimaWinRtexStudy(doc);
}
export function climaWinStudyBuildingNames(doc){
  const names=[]; for(const x of cw_lines(doc)){ const m=x.t.match(/^\d{1,2}\.\s+(.+?)\s+-\s+RT\s+pour\s+l.existant$/i); if(m) names.push(m[1].trim()); }
  return [...new Set(names)];
}
const cw_name=n=>{ const s=String(n||'').replace(/^\d*re\.?(?=Batiment\b)/i,'').replace(/^re\./i,'').trim(); return /^batiment$/i.test(s)||!s?'Bâtiment unique':s; };

const CW_KIND=s=>/^Mur\b/i.test(s)?'wall':/^(?:Plafond|Rampant|Toiture|Comble)/i.test(s)?'roof':/^Plancher/i.test(s)?'floor':null;
const CW_F={wall:['wall_insulation','wall_insulation_thickness','wall_insulation_r','wall_structure'],roof:['roof_insulation','roof_insulation_thickness','roof_insulation_r','roof_structure'],floor:['floor_insulation','floor_insulation_thickness','floor_insulation_r','floor_structure']};
const cw_ins=s=>insulationName(s)||(/xtherm|polyplac|fibra|knauf\s+therm|th\s?38|nextherm/i.test(s)?'PSE':/foamglass|verre\s+cellulaire/i.test(s)?'Verre cellulaire':/flocage/i.test(s)?'Laine minérale':null);
const cw_struct=s=>/beton\s+cellulaire/i.test(s)?'Béton cellulaire':/parpaing|bloc|agglo/i.test(s)?'Bloc béton / parpaing':/beton/i.test(s)?'Béton armé':/brique/i.test(s)?'Brique terre cuite':/pierre|moellon/i.test(s)?'Pierre':/bois/i.test(s)?'Ossature bois':null;

// Parois « N.k. Mur: <nom> » : contact, état (rénovée ou non), couches « Isolant <désignation> … ep(m) λ R … ».
function cw_walls(L){
  const out=[]; let cur=null;
  L.forEach((x,i)=>{ let m;
    if((m=x.t.match(/^\d{1,2}\.\d{1,2}\.\s+(Mur|Plafond|Plancher|Rampant|Toiture):\s*(.+)$/i))&&!/\.{4,}|\s\d{1,3}$/.test(x.t)){ cur={kind:CW_KIND(m[1]),name:m[2].trim(),x,contact:'',renov:null,layers:[]}; out.push(cur); return; }
    if(!cur) return;
    if(/^\d{1,2}\.\s+\S/.test(x.t)&&!/^\d{1,2}\.\d/.test(x.t)) { cur=null; return; }
    if((m=x.t.match(/^\d+\s+Contact\s+(.+)$/i))) cur.contact=m[1];
    if((m=x.t.match(/^\d+\s+Paroi\s+renovee\s+(Renove|Non\s+renove)\b/i))) cur.renov=/^renove$/i.test(m[1]);
    if((m=x.t.match(/^(Isolant|Beton|Brique|Bois|Pierre|Divers|Metal|Lame\s+d.air|Platre|Bloc|Parpaing)\s+(.*?)\s*(\d+\.\d{3})\s+(\d+(?:\.\d{1,3})?)\s+(\d+\.\d{3})\b/i))){
      const [, nat, des, ep, lam, R]=m; cur.layers.push({x,nat,des:des||nat,e:Number(ep),lambda:Number(lam),R:Number(R)}); }
  });
  return out.filter(p=>p.kind);
}
// État après travaux d'une paroi : rénovée (« re. », « ap », « Renove »), ou existante conservée (« Non renove »).
const cw_after=p=>p.renov===true||/(?:^|\s|\d)re\.|\bap\b|renov/i.test(p.name)?2:p.renov===false?1:/\bav\b|(?:^|\d)ex\./i.test(p.name)?0:1;

export function parseClimaWinRenovation(doc,occ,canonical=(s)=>s){
  const out=[]; const L=cw_lines(doc); const study=isClimaWinRtexStudy(doc); const origin=study?'ClimaWin — étude RT existant (Th-C-E ex)':'ClimaWin — rapport de saisie (RT existant)';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value))) return; const o=occ(doc,x.page,x.line,field,value,`climawin-etude:${method}`,conf,unit,{building:canonical(b),structuredPdf:true,origin,dedicatedRank:6,...extra}); if(o) out.push(o); };
  const names=study?climaWinStudyBuildingNames(doc).map(cw_name):[]; const targets=names.length?names:['Bâtiment unique'];
  const all=L.map(x=>x.t).join('\n');
  // Surfaces des parois et des menuiseries (« Detail des parois / des menuiserie ») pour pondérer les choix.
  const surf={}; { let sec=''; for(const x of L){ if(/^Detail\s+des\s+parois/i.test(x.t)) sec='p'; else if(/^Detail\s+des\s+menuiserie/i.test(x.t)) sec='m'; else if(/^Detail\s+des\s+ponts|^Total\b/i.test(x.t)) sec=sec&&/^Total/i.test(x.t)?sec:'';
      if(!sec) continue; const m=sec==='p'?x.t.match(/^(.+?)\s+([\d.]+)\s*m²\s+[\d.]+\s*W\/m²\.K/i):x.t.match(/^(.+?)\s+\d+\s+([\d.]+)\s*m²\s+[\d.]+\s*W\/m²\.K/i); if(m) surf[normalizeText(m[1]).toLowerCase()]=(surf[normalizeText(m[1]).toLowerCase()]||0)+Number(m[2]); } }
  // Rapport de saisie : chapitres « N. Batiment » (projet) et « N. Batiment existant » ; les menuiseries / parois citées dans
  // le chapitre du projet (contrôle de la saisie, local par local) donnent leur poids quand les surfaces ne sont pas éditées.
  const chapIdx=re=>L.findIndex(x=>re.test(x.t)&&!/\s\d{1,4}$/.test(x.t));
  const aI=chapIdx(/^\d{1,2}\.\s+Batiment$/i), bI=chapIdx(/^\d{1,2}\.\s+Batiment\s+existant$/i);
  const projSpan=aI>=0?L.slice(aI,bI>aI?bI:L.length):[]; const projText=projSpan.map(x=>x.t).join('\n');
  const cites=n=>{ if(!projText) return 0; const k=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return (projText.match(new RegExp(`(?:^|\\s)${k}(?=\\s|$)`,'gm'))||[]).length; };
  const sOf=n=>surf[normalizeText(n).toLowerCase()]||cites(n)||0;
  if(projSpan.length){ const y=projSpan.find(x=>/^\d+\s+Annee\s+construction\s+\d{4}$/i.test(x.t)); if(y) for(const t of targets) emit(y,t,'construction_year',Number(y.t.match(/(\d{4})$/)[1]),'annee',0.9);
    const lg=projSpan.find(x=>/^\d+\s+Nombre\s+de\s+logements\s+\d+$/i.test(x.t)); if(lg) for(const t of targets) emit(lg,t,'housing_count',Number(lg.t.match(/(\d+)$/)[1]),'logements',0.96); }
  // 1. Parois du projet.
  const walls=cw_walls(L);
  for(const kind of ['wall','roof','floor']){
    const cand=walls.filter(p=>p.kind===kind&&cw_after(p)>0&&p.layers.length).map(p=>{ const ins=p.layers.filter(l=>/^Isolant$/i.test(l.nat)||l.lambda<=0.06).sort((a,b)=>b.R-a.R)[0]; return {p,ins,ext:/exterieur/i.test(p.contact)?1:0}; }).filter(z=>z.ins);
    const z=cand.sort((a,b)=>cw_after(b.p)-cw_after(a.p)||b.ext-a.ext||sOf(b.p.name)-sOf(a.p.name))[0]; if(!z) continue;
    const name=cw_ins(z.ins.des); const f=CW_F[kind]; const note={provenanceNote:`Paroi « ${z.p.name} »${z.p.contact?` (contact ${z.p.contact.toLowerCase()})`:''} : ${z.ins.des} ${Math.round(z.ins.e*1000)} mm, λ ${z.ins.lambda}, R = ${z.ins.R}.`};
    const st=z.p.layers.filter(l=>l!==z.ins&&l.lambda>0.1).sort((a,b)=>b.e-a.e).map(l=>cw_struct(`${l.nat} ${l.des}`)).find(Boolean);
    for(const b of targets){ if(name) emit(z.ins.x,b,f[0],name,`${kind}-isolant`,0.93,'',note); emit(z.ins.x,b,f[1],Math.round(z.ins.e*1000),`${kind}-epaisseur`,0.92,'mm',note); emit(z.ins.x,b,f[2],z.ins.R,`${kind}-r`,0.93,'m².K/W',note);
      if(st) emit(z.ins.x,b,f[3],st,`${kind}-structure`,0.88,'',{provenanceNote:`Couche porteuse de « ${z.p.name} ».`}); if(kind==='wall'&&st) emit(z.ins.x,b,'structure',st,'structure',0.85); } }
  // 2. Menuiseries : fenêtres et portes-fenêtres, pondérées par surface (ou nombre de dimensions saisies).
  { const men=[]; let cur=null;
    L.forEach(x=>{ let m; if((m=x.t.match(/^\d{1,2}\.\d{1,2}\.\s+Menuiserie:\s*(.+)$/i))&&!/\s\d{1,3}$/.test(x.t)){ cur={name:m[1].trim(),x,dims:0}; men.push(cur); return; } if(!cur) return;
      if(/^\d{1,2}\.\d{1,2}\.\d{1,2}\.\s+Dimension/i.test(x.t)) cur.dims++;
      if((m=x.t.match(/^Type\s+(Fenetre(?:\s+de\s+toit)?|Porte(?:-fenetre)?|Porte\s+fenetre|Baie|Chassis)\b/i))) cur.type=m[1];
      if((m=x.t.match(/^Structure\s+Menuiserie\s+en\s+(\S+)/i))) cur.mat=m[1];
      if((m=x.t.match(/^Vitrage\s+(Simple|Double|Triple)\s+vitrage(?:\s+Reference\s+(.+))?$/i))){ cur.vit=m[1]; cur.ref=m[2]||''; cur.vx=x; }
      if((m=x.t.match(/^Protection\s+(\S+)/i))) cur.prot=/^Volet|^VR/i.test(m[1])?(/battant/i.test(x.t)?'Volet battant':'Volet roulant'):/^Store/i.test(m[1])?'Store extérieur':/^Persienne/i.test(m[1])?'Persienne':/^Brise|^BSO/i.test(m[1])?'BSO':/^Coffre$/i.test(m[1])?'Sans occultation':null; });
    const win=men.filter(w=>/^Fenetre$|porte.?fenetre/i.test(w.type||'')&&cw_after({name:w.name,renov:null})>0);
    const w8=w=>sOf(w.name)||w.dims||1;
    const pick=get=>{ const c={}; for(const w of win){ const v=get(w); if(v) (c[v]=c[v]||{s:0,w}), c[v].s+=w8(w); } return Object.entries(c).sort((a,b)=>b[1].s-a[1].s)[0]; };
    const matV=s=>/pvc/i.test(s)?'PVC':/alu|metal/i.test(s)?'Aluminium':/bois/i.test(s)?'Bois':null;
    const mt=pick(w=>matV(w.mat||'')), gl=pick(w=>{ const g=w.ref&&/\d+-\d+-\d+/.test(w.ref)?normalizeGlazingType(w.ref.match(/\d+-\d+-\d+/)[0].replace(/-/g,'/')):null; return g||(w.vit?`${w.vit[0].toUpperCase()}${w.vit.slice(1).toLowerCase()} vitrage`:null); }), pr=pick(w=>w.prot);
    const note=r=>({provenanceNote:`Menuiseries du projet : « ${r[1].w.name} » (${win.length} fenêtre(s) décrite(s)).`});
    for(const b of targets){ if(mt) emit(mt[1].w.x,b,'window_material',mt[0],'menuiserie',0.92,'',note(mt)); if(gl) emit(gl[1].w.vx||gl[1].w.x,b,'window_glazing',gl[0],'vitrage',0.9,'',note(gl)); if(pr) emit(pr[1].w.x,b,'window_shading',pr[0],'protection',0.88,'',note(pr)); } }
  // 3. Générateurs du projet.
  { const a=L.findIndex(x=>/^\d{1,2}\.\s+(?:Generateurs\s+du\s+projet|Systemes)$/i.test(x.t)), b=L.findIndex((x,k)=>k>a&&/^\d{1,2}\.\s+\S/.test(x.t)&&!/^\d{1,2}\.\d/.test(x.t)&&!/Systemes|Generateurs/i.test(x.t));
    const G=a>=0?L.slice(a,b>a?b:L.length):[]; const gt=G.map(x=>x.t).join(' ');
    if(G.length){ const x=G.find(y=>/condensation|pompe|PAC|chaudiere|thermodynamique|Combustible|Type\s+d.energie/i.test(y.t))||G[0];
      const pac=/pompe\s+a\s+chaleur|Type\s+de\s+PAC\s+(?:Air|Eau|Sol)|Famille\s+(?:Pompes?\s+a\s+chaleur|Generateurs?\s+thermodynamiques?)/i.test(gt)&&!/condensation/i.test(gt);
      const energy=/Combustible\s+Gaz|Type\s+d.energie\s+Gaz|\bGaz\b/i.test(gt)?'Gaz':/fioul/i.test(gt)?'Fioul':/bois|granul/i.test(gt)?'Bois / biomasse':/reseau\s+de\s+chaleur|sous-station/i.test(gt)?'Réseau de chaleur urbain':pac||/electrique|effet\s+joule/i.test(gt)?'Électricité':null;
      const mode=pac?(/air\s*\/\s*eau|air\s+eau/i.test(gt)?'PAC air/eau':'PAC'):/condensation/i.test(gt)?'Chaudière condensation':energy==='Gaz'?'Chaudière gaz':null;
      const mixte=/Chauffage\s+et\b[\s\S]{0,80}?\bECS\b/i.test(gt);
      for(const t of targets){ if(energy) emit(x,t,'heating_vector_after',energy,'generateur-energie',0.9,'',{provenanceNote:'Générateur du projet (ClimaWin).'}); if(mode) emit(x,t,'heating_mode_after',mode,'generateur',0.9,'',{provenanceNote:'Générateur du projet (ClimaWin).'});
        if(mixte&&energy){ emit(x,t,'ecs_vector_after',energy,'generateur-ecs',0.88,'',{provenanceNote:'Générateur « Chauffage et ECS ».'}); emit(x,t,'ecs',pac?'PAC':'Chaudière','generateur-ecs',0.86); } } } }
  // 4. Ventilation (« Centrale simple flux ou extracteur (SF) », « Hygroreglable B »).
  { const x=L.find(y=>/hygro\w*\s*(?:reglable\s+)?(?:type\s+)?[AB]\b|double\s+flux|Centrale\s+simple\s+flux|ventilation\s+hybride|ventilation\s+naturelle\s+par\s+conduit/i.test(y.t)&&!/Recouvrement|Ventilation\s+naturelle$/i.test(y.t));
    if(x){ const s=x.t; const v=/double\s+flux/i.test(s)?'VMC double flux':/hygro\w*\s*(?:reglable\s+)?(?:type\s+)?B\b/i.test(s)?'VMC Hygro B':/hygro\w*\s*(?:reglable\s+)?(?:type\s+)?A\b/i.test(s)?'VMC Hygro A':/hybride/i.test(s)?'Ventilation hybride':/simple\s+flux/i.test(s)?'VMC simple flux':/naturelle/i.test(s)?'Ventilation naturelle':null;
      if(v) for(const t of targets) emit(x,t,'ventilation',v,'ventilation',0.88,'',{provenanceNote:`Système de ventilation : ${s}.`}); } }
  { const i=L.findIndex(x=>/^\d\.\d\.\s+Donnees\s+administratives\s+du\s+projet$/i.test(x.t)); const a=i>=0?L.slice(i,i+8).find(x=>/^Adresse\s.*\b\d{5}\b/i.test(x.t)):null;
    if(a){ const cp=a.t.match(/\b(\d{5})\b/)[1]; const d=/^97/.test(cp)?cp.slice(0,3):/^20/.test(cp)?(Number(cp)<20200?'2A':'2B'):cp.slice(0,2); emit(a,'Bâtiment unique','department',d,'departement-cp',0.95,'',{secondarySourceOk:true,provenanceNote:`Code postal de l’opération : ${cp}.`});
      const ad=parseFrAddress(a.t.replace(/^Adresse\s*:?\s*/i,'')); for(const f of ['address','postcode','city']) emit(a,'Bâtiment unique',f,ad[f],'adresse',0.9,'',{secondarySourceOk:true}); } }
  if(!study) return out;
  // 5. Résultats par bâtiment.
  const secs=[]; L.forEach((x,i)=>{ const m=x.t.match(/^\d{1,2}\.\s+(.+?)\s+-\s+(Ubat|Deperditions|RT\s+pour\s+l.existant|Thermique)$/i); if(m) secs.push({name:cw_name(m[1]),kind:m[2],i}); });
  secs.forEach((s,k)=>{ s.end=k+1<secs.length?secs[k+1].i:L.length; });
  for(const s of secs.filter(z=>/existant/i.test(z.kind))){
    const B=s.name; const R=L.slice(s.i,s.end); const after=(re,n=3)=>{ const i=R.findIndex(x=>re.test(x.t)); return i<0?null:R.slice(i+1,i+1+n).find(x=>/\d/.test(x.t))||null; };
    // « Cepinit Cepproj Cepref Cep_p Cepmax » puis « … OUI - 77.90 159.35 69.45 130.00 » (« - » = non calculé).
    { const i=R.findIndex(x=>/Cepinit.*Cepproj.*Cepref/i.test(x.t)); const x=i>=0?R[i+1]:null;
      if(x){ const tok=x.t.split(/\s+/).filter(t=>/^-$|^-?\d+(?:[.,]\d+)?$/.test(t)).slice(-5).map(t=>t==='-'?null:parseFrNumber(t)); if(tok.length===5){ const [ci,cp,cr,,cm]=tok; const note={provenanceNote:'Tableau « Cepinit / Cepproj / Cepref / Cep_p / Cepmax » des résultats Th-C-E ex.'};
        if(ci!==null) emit(x,B,'cep_before',ci,'cep-initial',0.95,'kWhEP/m².an',note); if(cp!==null){ emit(x,B,'cep_after_final',cp,'cep-projet',0.96,'kWhEP/m².an',note); emit(x,B,'cep',cp,'cep-projet',0.93,'kWhEP/m².an',note); } s.cp=cp; s.cmRt=cm; s.cref=cr; s.cx=x; } } }
    // Cep max : Cepref (exigence de la RT existant globale) ; CeprefBBC (label) et Cepmax restent en note.
    { const x=after(/Cep\s+Cep\s+corrige\s+CeprefBBC/i,2); const v=x?cw_nums(x.t):[]; const bbc=v.length>=3?v[2]:null; const cm=s.cref??bbc;
      if(cm){ emit(s.cx||x,B,'cep_max',cm,'cep-ref',0.93,'kWhEP/m².an',{provenanceNote:`Cepref de la RT existant${s.cmRt?` ; Cepmax ${s.cmRt}`:''}${bbc?` ; CeprefBBC (label) ${bbc}`:''}.`});
        if(s.cp) emit(s.cx||x,B,'cep_gain',Math.round((cm-s.cp)/cm*1000)/10,'cep-gain',0.92,'%',{provenanceNote:`Gain = (Cep ref − Cep projet) / Cep ref = (${cm} − ${s.cp}) / ${cm}.`}); } }
    // UBat init / proj / ref.
    { const i=R.findIndex(x=>/UBatinit.*UBatproj/i.test(x.t)); const x=i>=0?R.slice(i+1,i+4).find(y=>/\d\.\d{3}/.test(y.t)):null;
      if(x){ const tok=x.t.split(/\s+/).filter(t=>/^-$|^\d+\.\d+$/.test(t)).map(t=>t==='-'?null:Number(t)); if(tok.length>=3){ if(tok[0]!==null) emit(x,B,'ubat_before',tok[0],'ubat-initial',0.94,'W/m².K'); if(tok[1]!==null) emit(x,B,'ubat_after',tok[1],'ubat-projet',0.95,'W/m².K');
        const ref=tok[2]??tok[3]; if(ref!=null) emit(x,B,'ubat_ref',ref,'ubat-ref',0.94,'W/m².K',{provenanceNote:`UBatref du tableau Th-C-E ex${tok[2]==null?' (UBatbase, UBatref non calculé)':''}.`}); } } }
    // « Usage Consommation (kWhep/m²) Emissions CO2 (kgCO2/m²) … » : somme des usages du projet.
    { const i=R.findIndex(x=>/^Usage\s+Consommation\s*\(kWhep\/m.\)\s+Emissions\s+CO2/i.test(x.t)); if(i>=0){ const rows=[]; for(const y of R.slice(i+1,i+10)){ if(!/^(?:Chauffage|Refroidissement|Production\s+d.eau\s+chaude|Ventilateurs|Eclairage|Auxiliaires)\b/i.test(y.t)) break; const v=cw_nums(y.t); if(v.length>=2) rows.push(v[v.length-2]); }
      if(rows.length>=3) emit(R[i],B,'ges',Math.round(rows.reduce((a,v)=>a+v,0)*100)/100,'ges-usages',0.9,'kgCO2/m².an',{provenanceNote:`Somme des émissions de CO2 par usage du projet (${rows.length} usages).`}); } }
    // Consommations en énergie primaire par poste (ligne « Projet »).
    { const i=R.findIndex(x=>/^Comparatif\s+des\s+consommations\s+en\s+energie\s+primaire/i.test(x.t)); const p=i>=0?R.slice(i,i+6).find(x=>/^Projet\s+[\d.]/i.test(x.t)):null;
      const p2=p||L.slice(s.end,s.end+60).find(x=>/^Projet\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+/i.test(x.t));
      if(p2){ const v=cw_nums(p2.t); if(v.length>=7){ const [ch,fr,ecs,ve,aux,ecl]=v; const note={provenanceNote:'Consommations en énergie primaire du projet (kWhep/m²) par poste.'};
        emit(p2,B,'cep_cooling',fr,'cep-refroidissement',0.93,'kWhEP/m².an',note); emit(p2,B,'cep_aux_vent',ve,'cep-aux-ventilation',0.93,'kWhEP/m².an',note); emit(p2,B,'cep_aux_dist',aux,'cep-aux',0.9,'kWhEP/m².an',note); emit(p2,B,'cep_lighting',ecl,'cep-eclairage',0.93,'kWhEP/m².an',note);
        emit(p2,B,'cooling',fr>0?'Climatisation active':'Aucun','refroidissement',0.85);
        const vect=out.find(o=>o.field==='heating_vector_after')?.value; const elec=(ve||0)+(aux||0)+(ecl||0)+(fr||0); const r2=n=>Math.round(n*100)/100;
        if(vect==='Électricité') emit(p2,B,'cep_electricity',r2(elec+ch+ecs),'cep-electricite',0.88,'kWhEP/m².an',note);
        else if(vect){ emit(p2,B,'cep_electricity',r2(elec),'cep-electricite',0.88,'kWhEP/m².an',{provenanceNote:'Ventilateurs + auxiliaires + éclairage + refroidissement (électriques).'}); const f={'Gaz':'cep_gas','Réseau de chaleur urbain':'cep_district','Bois / biomasse':'cep_biomass'}[vect]; if(f) emit(p2,B,f,r2(ch+ecs),'cep-energie',0.88,'kWhEP/m².an',{provenanceNote:`Chauffage + ECS (${vect.toLowerCase()}).`}); } } } }
    // Tic : « Ticinitial Ticprojet Ticref » puis « <groupe> - 25.85 31.70 ».
    { const i=L.findIndex((x,k)=>k>=s.i&&k<s.end+60&&/Ticinitial.*Ticprojet.*Ticref/i.test(x.t)); const g=i>=0?L.slice(i+1,i+6).map(x=>({x,m:x.t.match(/(?:-|\d+(?:\.\d+)?)\s+(\d{2}(?:\.\d+)?)\s+(\d{2}(?:\.\d+)?)$/)})).filter(z=>z.m):[];
      const top=g.sort((a,b)=>Number(b.m[1])-Number(a.m[1]))[0]; if(top){ emit(top.x,B,'tic',Number(top.m[1]),'tic',0.95,'°C'); emit(top.x,B,'tic_ref',Number(top.m[2]),'tic-ref',0.95,'°C'); } }
  }
  // Surface habitable (récapitulatif du Ubat) et SHON.
  for(const s of secs.filter(z=>/^Ubat$/i.test(z.kind))){ const R=L.slice(s.i,s.end); const i=R.findIndex(x=>/^Surface\s+habitable\s+Volume\s+habitable/i.test(x.t)); const x=i>=0?R.slice(i+1,i+4).find(y=>/m²/.test(y.t)):null; if(x){ const v=cw_nums(x.t)[0]; if(v>0) emit(x,s.name,'shab',v,'shab',0.94,'m²'); } }
  const dep=L.find(x=>/departement\s*:?\s*(\d{2,3}|2[AB])\b/i.test(x.t)); if(dep) emit(dep,'Bâtiment unique','department',dep.t.match(/departement\s*:?\s*(\d{2,3}|2[AB])\b/i)[1],'departement',0.85,'',{secondarySourceOk:true});
  void all; return out;
}
