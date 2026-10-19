// v2.4.0 — Rapport U48Win (Perrenoud) RT existant, moteur Th-C-E ex : mise en page fixe, réutilisée en annexe de notices.
//  • « CATALOGUE DES PAROIS DE L'ETAT INITIAL / PROJET » puis « DETAILS des PAROIS » : « Paroi 01 / Mur exterieur »,
//    « Type : Mur exterieur (A1) », couches « GR 32 Roule Revetu Kraft 12 cm 12,0 3,750 100 ACERMI » (ép. cm, [λ], R) ;
//  • « CATALOGUE DES VITRAGES … PROJET » : vitrage (« Double +15mm »), fermeture (« Vol. Roul. PVC », « Vol. Bat. Bois ») ;
//  • « ETAT INITIAL » / « ETAT PRESSENTI » : saisies (année, logements, zone traversante, émission, ventilation, ECS,
//    générateurs) — colonnes « Projet / Reference » : la première valeur est celle du projet ;
//  • « RESULTATS DE L'ETAT INITIAL / PROJET » + « Batiment n° 1 : <nom> » : Ubat, « Coefficient Cep », énergie par usage
//    (« CHAUFFAGE / Electrique 3397,53 … / Fioul 0,0 … ») et « Total Energie primaire » par poste ;
//  • « RESUME de L'ETUDE » (Tic, C'ep / CepMax), « CONTROLE LABELS » (« Cep = 85,1 <= Cepref HPE = 150,0 »).
import {normalizeText,parseFrNumber} from './utils.js';
import {insulationName} from './donnees-techniques.js';

const uw_t=l=>normalizeText(l?.text||'').replace(/\s+/g,' ').trim();
function uw_lines(doc){ const out=[]; for(const page of doc.read?.pages||[]) (page.lines||[]).forEach(line=>out.push({page,line,t:uw_t(line)})); return out; }
const uw_n=s=>parseFrNumber(String(s||'').replace(/^,/,'0,'));
const uw_nums=s=>(String(s||'').match(/-?\d*,?\d+(?:,\d+)?/g)||[]).map(uw_n).filter(v=>v!==null);

export function isU48WinRtexReport(doc){
  const t=String(doc?.read?.text||'').slice(0,800000);
  return /CATALOGUE\s+DES\s+PAROIS\s+DE\s+L.ETAT\s+(?:INITIAL|PROJET)/i.test(t)&&/RESULTATS\s+DE\s+L.ETAT\s+(?:INITIAL|PROJET)|Batiment\s+n°\s*\d+\s*:/i.test(t)&&/ThCEx|Th-C-E\s*ex|U48Win|Shon\/Srt/i.test(t);
}
const UW_GENERIC=/^(?:batiment(?:\s+n°\s*\d+)?|batiment\s+\d+\s+logements?|batiment\s+renove(?:\s+en\s+\d+\s+logements?)?)$/i;
function uw_results(L){
  const res=[]; L.forEach((x,i)=>{ const m=x.t.match(/^RESULTATS\s+DE\s+L.ETAT\s+(INITIAL|PROJET)$/i); if(m){ const b=L[i+1]?.t.match(/^Batiment\s+n°\s*(\d+)\s*:\s*(.+)$/i); res.push({phase:/INITIAL/i.test(m[1])?'before':'after',n:b?Number(b[1]):1,name:b?b[2].trim():'',i}); } });
  // Ancienne édition : « ETAT INITIAL » / « Projet » puis « Batiment n° 1 : A » et « TOTAL kWhEP/m².an : 151,88 ».
  if(!res.length) L.forEach((x,i)=>{ const b=x.t.match(/^Batiment\s+n°\s*(\d+)\s*:\s*(.+)$/i); if(!b) return; const ctx=L.slice(Math.max(0,i-3),i).map(z=>z.t).join(' ');
    const phase=/ETAT\s+INITIAL/i.test(ctx)?'before':/\bProjet\b|Modification/i.test(ctx)?'after':null; if(phase&&L.slice(i,i+30).some(z=>/TOTAL\s+kWhEP/i.test(z.t))) res.push({phase,n:Number(b[1]),name:b[2].trim(),i,old:true}); });
  return res;
}
export function u48WinBuildingNames(doc){
  const r=uw_results(uw_lines(doc)); const byN={}; for(const z of r) if(z.phase==='after'||!byN[z.n]) byN[z.n]=z.name;
  const names=Object.values(byN); if(names.length<=1) return names.length&&!UW_GENERIC.test(normalizeText(names[0]))?[`Batiment ${names[0].replace(/^Batiment\s+/i,'')}`]:['Bâtiment unique'];
  return names.map(n=>`Batiment ${n.replace(/^Batiment\s+/i,'')}`);
}
const UW_ENERGY=s=>/electri/i.test(s)?'Électricité':/gaz|propane/i.test(s)?'Gaz':/fioul|fuel/i.test(s)?'Fioul':/bois|granul/i.test(s)?'Bois / biomasse':/reseau|chaleur\s+urbain/i.test(s)?'Réseau de chaleur urbain':null;
const UW_KIND=s=>/^Mur\s+exterieur|^Mur\s+sur|^Mur\s+interieur/i.test(s)?'wall':/^Plafond|^Toiture|^Terrasse/i.test(s)?'roof':/^Plancher/i.test(s)?'floor':null;
const UW_F={wall:['wall_insulation','wall_insulation_thickness','wall_insulation_r','wall_structure'],roof:['roof_insulation','roof_insulation_thickness','roof_insulation_r','roof_structure'],floor:['floor_insulation','floor_insulation_thickness','floor_insulation_r','floor_structure']};
const uw_ins=s=>insulationName(s)||(/fibra\s*ultra|fibrastyr|polystyr/i.test(s)?'PSE':/\bGR\s?3\d\b|\bIBR\b|isover|isoconfort/i.test(s)?'Laine de verre':/flocage|floque/i.test(s)?'Laine minérale':null);
const uw_struct=s=>/beton\s+cellulaire/i.test(s)?'Béton cellulaire':/parpaing|bloc|agglo|aggloméré/i.test(s)?'Bloc béton / parpaing':/brique/i.test(s)?'Brique terre cuite':/poutrelle|hourdis/i.test(s)?'Poutrelles-hourdis':/beton|dalle/i.test(s)?'Béton armé':/pierre|moellon|meuliere/i.test(s)?'Pierre':/bois/i.test(s)?'Ossature bois':null;

export function parseU48WinRtex(doc,occ,canonical=(s)=>s){
  const out=[]; const L=uw_lines(doc); const origin='U48Win (Perrenoud) — RT existant Th-C-E ex';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value))) return; const o=occ(doc,x.page,x.line,field,value,`u48win-rtex:${method}`,conf,unit,{building:canonical(b),structuredPdf:true,origin,dedicatedRank:5,...extra}); if(o) out.push(o); };
  const res=uw_results(L); const names=u48WinBuildingNames(doc); const nOf={}; { const byN=[...new Set(res.map(r=>r.n))].sort((a,b)=>a-b); byN.forEach((n,k)=>{ nOf[n]=names.length===1?names[0]:names[k]||`Batiment ${n}`; }); }
  const all=names.length?names:['Bâtiment unique'];
  // 1. Résultats par bâtiment.
  for(const r of res){ const B=nOf[r.n]||all[0]; const R=L.slice(r.i,r.i+(r.old?30:40)); const find=re=>R.find(x=>re.test(x.t));
    if(r.old){ const tot=find(/^TOTAL\s+kWhEP\/m².an\s*:/i); if(tot){ const v=uw_n(tot.t.match(/kWhEP\/m².an\s*:\s*([\d,.]+(?:\s\d{3})*)/i)[1].replace(/\s/g,'')); emit(tot,B,r.phase==='before'?'cep_before':'cep_after_final',v,`cep-${r.phase}`,0.94,'kWhEP/m².an'); if(r.phase==='after') emit(tot,B,'cep',v,'cep',0.9,'kWhEP/m².an'); } }
    const ub=find(/^Ubat\s+du\s+batiment\s+[\d,]/i); if(ub) emit(ub,B,r.phase==='before'?'ubat_before':'ubat_after',uw_nums(ub.t)[0],`ubat-${r.phase}`,0.95,'W/m².K');
    const cp=find(/^Coefficient\s+Cep\b/i); if(cp){ const v=uw_nums(cp.t.replace(/^.*?m²\)/i,''))[0]; if(r.phase==='before') emit(cp,B,'cep_before',v,'cep-initial',0.96,'kWhEP/m².an'); else { emit(cp,B,'cep_after_final',v,'cep-projet',0.96,'kWhEP/m².an'); emit(cp,B,'cep',v,'cep-projet',0.93,'kWhEP/m².an'); }
      // Ubat / Cep initiaux repris dans la colonne « Etat initial » des résultats du projet.
      if(r.phase==='after'){ const t=uw_nums(cp.t.replace(/^.*?m²\)/i,'')); if(t.length>=4&&!res.some(z=>z.phase==='before'&&z.n===r.n)) emit(cp,B,'cep_before',t[3],'cep-initial-colonne',0.92,'kWhEP/m².an'); } }
    // Énergies par usage : la première énergie dont la consommation (1re colonne) est non nulle.
    const usage=u=>{ const k=R.findIndex(x=>new RegExp(`^${u}$`,'i').test(x.t)); if(k<0) return null; const rows=[]; for(const y of R.slice(k+1,k+8)){ if(/^(?:CHAUFFAGE|REFROIDISSEMENT|ECS|ECLAIRAGE|AUXILIAIRES|AUTRES\s+USAGES|TOTAL)$/i.test(y.t)) break; rows.push(y); } return rows; };
    const P={};
    for(const [u,fb,fa] of [['CHAUFFAGE','heating_vector_before','heating_vector_after'],['ECS','ecs_vector_before','ecs_vector_after']]){ const rows=usage(u)||[];
      const e=rows.map(y=>({y,e:UW_ENERGY(y.t.replace(/[-\d,.\s%]+$/,'')),v:uw_nums(y.t)[0]})).filter(z=>z.e&&z.v>0).sort((a,b)=>b.v-a.v)[0];
      if(e) emit(e.y,B,r.phase==='before'?fb:fa,e.e,`${u.toLowerCase()}-energie`,0.93,'',{provenanceNote:`Consommation ${u.toLowerCase()} ${r.phase==='before'?'de l’état initial':'du projet'} : ${e.y.t}.`});
      const tot=rows.find(y=>/^Total\s+Energie\s+primaire/i.test(y.t)); if(tot) P[u]={v:uw_nums(tot.t.replace(/^.*?m²\)/i,''))[0],e:e?.e}; }
    for(const u of ['ECLAIRAGE','AUXILIAIRES','REFROIDISSEMENT']){ const rows=usage(u)||[]; const tot=rows.find(y=>/^Total\s+Energie\s+primaire/i.test(y.t)); const ven=rows.find(y=>/^Vent\s*-\s*Total\s+Energie\s+primaire/i.test(y.t)); P[u]={v:tot?uw_nums(tot.t.replace(/^.*?m²\)/i,''))[0]:0,x:tot||rows[0]}; if(ven) P.VENT={v:uw_nums(ven.t.replace(/^.*?m²\)/i,''))[0],x:ven}; }
    if(r.phase==='after'&&!r.old){ const x=find(/^ECLAIRAGE$/i)||cp; const note={provenanceNote:'Résultats de l’état projet : « Total Energie primaire » du poste.'};
      if(P.ECLAIRAGE) emit(P.ECLAIRAGE.x||x,B,'cep_lighting',P.ECLAIRAGE.v,'cep-eclairage',0.93,'kWhEP/m².an',note);
      if(P.AUXILIAIRES) emit(P.AUXILIAIRES.x||x,B,'cep_aux_dist',P.AUXILIAIRES.v,'cep-auxiliaires',0.9,'kWhEP/m².an',note);
      if(P.VENT) emit(P.VENT.x,B,'cep_aux_vent',P.VENT.v,'cep-ventilateurs',0.93,'kWhEP/m².an',note);
      emit(P.REFROIDISSEMENT?.x||x,B,'cep_cooling',P.REFROIDISSEMENT?.v||0,'cep-refroidissement',0.9,'kWhEP/m².an',note); emit(x,B,'cooling',(P.REFROIDISSEMENT?.v||0)>0?'Climatisation active':'Aucun','refroidissement',0.85);
      const elec=(P.ECLAIRAGE?.v||0)+(P.AUXILIAIRES?.v||0)+(P.VENT?.v||0)+(P.REFROIDISSEMENT?.v||0); const by={}; for(const u of ['CHAUFFAGE','ECS']) if(P[u]?.e) by[P[u].e]=(by[P[u].e]||0)+(P[u].v||0);
      const r2=v=>Math.round(v*100)/100; by['Électricité']=(by['Électricité']||0)+elec;
      for(const [e,f] of [['Électricité','cep_electricity'],['Gaz','cep_gas'],['Réseau de chaleur urbain','cep_district'],['Bois / biomasse','cep_biomass']]) emit(x,B,f,r2(by[e]||0),'cep-energie',0.88,'kWhEP/m².an',{provenanceNote:by[e]?`Postes du Cep projet au ${e.toLowerCase()}.`:`Aucun poste du Cep projet au ${e.toLowerCase()}.`}); }
  }
  // 2. Résumé par bâtiment (« RESUME de L'ETUDE » / « Batiment n° 01 : A/B ») : Tic, Cep de référence (exigence de la RT
  // existant globale « Cep ≤ Cepref ») et gain imprimé ; le label visé et le CepMax (Ch + Ref + ECS) restent en note.
  { const rs=[]; let inR=false; L.forEach((x,i)=>{ if(/^RESUME\s+de\s+L.ETUDE$/i.test(x.t)) inR=true; else if(/^(?:CATALOGUE|RESULTATS|ETAT\s|DETAILS|RECAPITULATIF|CONTROLE|VERIFICATION|ECO-PRET)/i.test(x.t)) inR=false;
      const m=x.t.match(/^Batiment\s+n°\s*(\d+)\s*:\s*(.+)$/i); if(m&&inR) rs.push({n:Number(m[1]),i}); });
    const lab=L.find(x=>/^Cep\s*=\s*[\d,]+\s*kWh\/m²\s*<=\s*Cepref\s+\S+\s*=\s*[\d,]+/i.test(x.t));
    const one=(B,R)=>{ const tic=R.find(x=>/\bCE[12]\s+\d+,\d+\s+\d+,\d+$/i.test(x.t))||R.find(x=>/^TIC\s*=\s*[\d,]+\s*-\s*TICRef\s*=\s*[\d,]+/i.test(x.t));
      if(tic){ const v=uw_nums(tic.t).slice(-2); emit(tic,B,'tic',v[0],'tic',0.94,'°C'); emit(tic,B,'tic_ref',v[1],'tic-ref',0.94,'°C'); }
      const cmx=R.find(x=>/^Respect\s+Cep\s*Max\s+[\d,]+\s+[\d,]+/i.test(x.t)); const c=R.find(x=>/^C\s+[\d,]+\s+[\d,]+\s+-?[\d,]+/.test(x.t));
      if(c){ const [cp,cr,g]=uw_nums(c.t); const note={provenanceNote:`Cep de référence (exigence Cep ≤ Cepref de la RT existant globale) ; gain imprimé ${g} %.${cmx?` CepMax (Ch+Ref+ECS) ${uw_nums(cmx.t)[1]}.`:''}${lab?` Label : ${lab.t}.`:''}`};
        emit(c,B,'cep_max',cr,'cep-ref',0.93,'kWhEP/m².an',note); if(Number.isFinite(g)) emit(c,B,'cep_gain',g,'cep-gain',0.93,'%',note);
        if(!out.some(o=>o.field==='cep_after_final'&&o.building===canonical(B))){ emit(c,B,'cep_after_final',cp,'cep-projet-resume',0.93,'kWhEP/m².an'); emit(c,B,'cep',cp,'cep-projet-resume',0.9,'kWhEP/m².an'); } } };
    if(rs.length) rs.forEach((r,k)=>one(nOf[r.n]||all[Math.min(k,all.length-1)],L.slice(r.i,k+1<rs.length?rs[k+1].i:r.i+30)));
    else if(all.length===1) one(all[0],L); }
  // 3. Parois du projet (« DETAILS des PAROIS » après le catalogue de l'état projet).
  const pj=L.findIndex(x=>/^CATALOGUE\s+DES\s+PAROIS\s+DE\s+L.ETAT\s+PROJET/i.test(x.t)||/^Modification\s+n°\s*\d+\s*:\s*(?:CATALOGUE|DETAILS)\s+des\s+PAROIS/i.test(x.t));
  if(pj>=0){ const end=L.findIndex((x,k)=>k>pj&&/^(?:Modification\s+n°\s*\d+\s*:\s*)?(?:CATALOGUE\s+DES\s+VITRAGES|CATALOGUE\s+des\s+PONTS|DETAILS\s+des\s+PONTS)/i.test(x.t)); const P=L.slice(pj,end>pj?end:L.length);
    const parois=[]; let cur=null;
    for(const x of P){ let m;
      if((m=x.t.match(/^Parois?\s+(\d+)\s*\/\s*(.+)$/i))){ cur={code:m[1],name:m[2].trim(),x,type:'',layers:[],renov:null}; parois.push(cur); continue; }
      if((m=x.t.match(/^Type\s+de\s+paroi\s*:\s*(.+)$/i))) cur.renov=/neuve|renovee/i.test(m[1])&&!/non\s+renovee/i.test(m[1]);
      if(!cur) continue;
      if((m=x.t.match(/^Type\s*:\s*(.+?)\s*\(A\d\)/i))) cur.type=m[1];
      // Couche : « désignation ép. [λ] R proportion origine » (λ absent quand la résistance est donnée directement).
      if((m=x.t.match(/^(.+?)\s+(\d{1,3},\d)\s+(?:(\d,\d{3})\s+)?(\d{1,2},\d{2,3})\s+(\d{1,3})\s+(ACERMI|ThU|Th-U|Autre|Fabricant|Avis\s+technique|\d+)\b/i))){ cur.layers.push({x,des:m[1],e:uw_n(m[2]),lambda:m[3]?uw_n(m[3]):null,R:uw_n(m[4]),acermi:/ACERMI/i.test(m[6])||(/^\d+$/.test(m[6])&&uw_n(m[4])>=0.5&&!m[3])}); }
    }
    for(const kind of ['wall','roof','floor']){
      const cand=parois.filter(p=>(UW_KIND(p.type)||UW_KIND(p.name))===kind&&!(kind==='wall'&&/interieur|mitoyen/i.test(p.type))).map(p=>({p,ins:p.layers.filter(l=>l.acermi||uw_ins(l.des)).sort((a,b)=>b.R-a.R)[0]})).filter(z=>z.ins);
      const z=cand.sort((a,b)=>(b.p.renov?1:0)-(a.p.renov?1:0))[0]; if(!z) continue; const name=uw_ins(z.ins.des); const f=UW_F[kind]; const note={provenanceNote:`Paroi « ${z.p.name} » de l’état projet : ${z.ins.des}, ${z.ins.e} cm, R = ${z.ins.R}.`};
      const st=z.p.layers.filter(l=>l!==z.ins&&!l.acermi).sort((a,b)=>b.e-a.e).map(l=>uw_struct(l.des)).find(Boolean);
      for(const b of all){ if(name) emit(z.ins.x,b,f[0],name,`${kind}-isolant`,0.92,'',note); emit(z.ins.x,b,f[1],Math.round(z.ins.e*10),`${kind}-epaisseur`,0.92,'mm',note); emit(z.ins.x,b,f[2],z.ins.R,`${kind}-r`,0.93,'m².K/W',note);
        if(st) emit(z.ins.x,b,f[3],st,`${kind}-structure`,0.86,'',{provenanceNote:`Couche porteuse de « ${z.p.name} ».`}); if(kind==='wall'&&st) emit(z.ins.x,b,'structure',st,'structure',0.84); } } }
  // 4. Vitrages et fermetures du projet.
  { const vi=L.findIndex(x=>/^CATALOGUE\s+DES\s+VITRAGES\s+DE\s+L.ETAT\s+PROJET/i.test(x.t)||/^Modification\s+n°\s*\d+\s*:\s*CATALOGUE\s+DES\s+VITRAGES/i.test(x.t)); if(vi>=0){ const end=L.findIndex((x,k)=>k>vi&&/^CARACTERISTIQUES\s+THERMIQUES|^CATALOGUE\s+DES\s+LINEIQUES/i.test(x.t)); const V=L.slice(vi,end>vi?end:vi+120).map(x=>x.t).join(' ');
      const c={VR:(V.match(/Vol\.\s*Roul/gi)||[]).length,VB:(V.match(/Vol\.\s*Bat/gi)||[]).length,Sans:(V.match(/Sans\s+fermeture/gi)||[]).length,Pers:(V.match(/Persienne/gi)||[]).length};
      const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0]; const sh={VR:'Volet roulant',VB:'Volet battant',Sans:'Sans occultation',Pers:'Persienne'}[top[0]];
      const dv=V.match(/\bDV\s+(\d{1,2})\/(\d{1,2})\/(\d{1,2})(\s+Argon)?/i); const gl=dv?`${dv[1]}.${dv[2]}.${dv[3]}${dv[4]?' Ar':''}`:(V.match(/\bTriple\b/gi)||[]).length>(V.match(/\bDouble\b/gi)||[]).length?'Triple vitrage':(V.match(/\bDouble\b/gi)||[]).length?'Double vitrage':/\bSimple\b/i.test(V)?'Simple vitrage':null;
      const mat=/Battantes?\s+PVC|Coulissantes?\s+PVC|\bPVC\s+Uf=/i.test(V)?'PVC':/Battantes?\s+Alu|\bAlu\w*\s+Uf=/i.test(V)?'Aluminium':/Battantes?\s+Bois|\bBois\s+Uf=/i.test(V)?'Bois':/\bOuvrant\b/i.test(V)&&/\b(?:PVC|Alu|Bois)\s+(?:Double|Simple|Triple)\b/i.test(V)?(()=>{ const m=[...V.matchAll(/\b(PVC|Alu\w*|Bois)\s+(?:Double|Simple|Triple)\b/gi)].map(z=>z[1].toLowerCase()); const cc={}; m.forEach(k=>cc[k]=(cc[k]||0)+1); const t=Object.entries(cc).sort((a,b)=>b[1]-a[1])[0]?.[0]; return t?/pvc/.test(t)?'PVC':/alu/.test(t)?'Aluminium':'Bois':null; })():null;
      const x=L[vi];
      for(const b of all){ if(top[1]>0) emit(x,b,'window_shading',sh,'fermetures',0.86,'',{provenanceNote:`Fermetures des baies de l’état projet (${top[1]} sur ${Object.values(c).reduce((a,v)=>a+v,0)}).`}); if(gl) emit(x,b,'window_glazing',gl,'vitrage',0.86,'',{provenanceNote:'Type de vitre des baies de l’état projet.'}); if(mat) emit(x,b,'window_material',mat,'menuiserie',0.86); } } }
  // 5. Saisies de l'état initial et de l'état pressenti (projet) : une section par « BATIMENT : X ».
  const blocks=[]; { let phase=null; L.forEach((x,i)=>{ const p=x.t.match(/^ETAT\s+(INITIAL|PRESSENTI|PROJET)$/i)||x.t.match(/^Variante\s+\d+\s*:\s*(Projet)$/i); if(p) phase=/INITIAL/i.test(p[1])?'before':'after'; else if(/^(?:RESULTATS|CATALOGUE|RESUME|ETAT\s+(?:INITIAL|PROJET)\s*:)/i.test(x.t)) phase=null;
      const b=x.t.match(/^BATIMENT\s*:\s*(.+)$/i); if(b&&phase) blocks.push({phase,name:b[1].trim(),i}); });
    blocks.forEach((bk,k)=>{ bk.end=k+1<blocks.length?blocks[k+1].i:Math.min(L.length,bk.i+260); }); }
  const bByName=n=>{ const k=normalizeText(n).toLowerCase(); const r=res.find(z=>normalizeText(z.name).toLowerCase()===k); return r?nOf[r.n]:null; };
  const order={before:0,after:0};
  for(const bk of blocks){ const S=L.slice(bk.i,Math.min(bk.end,bk.i+260)); const val=re=>{ const y=S.find(x=>re.test(x.t)); return y?{y,v:y.t.replace(re,'').replace(/^\s*:\s*/,'').trim()}:null; };
    const B=all.length===1?all[0]:(bByName(bk.name)||all[Math.min(order[bk.phase],all.length-1)]); order[bk.phase]++;
    const yr=val(/^Annee\s+de\s+construction\b/i); if(yr){ const m=yr.v.match(/(\d{4})(?:\s+et\s+(\d{4}))?/);
      if(/avant\s+1948/i.test(yr.v)) emit(yr.y,B,'built_before_1948','Oui','periode-construction',0.95,'',{provenanceNote:`Année de construction : ${yr.v}.`,secondarySourceOk:true});
      else if(m&&!m[2]) emit(yr.y,B,'construction_year',Number(m[1]),'annee',0.9); else if(m) emit(yr.y,B,Number(m[1])>=1948?'built_after_1948':'built_before_1948','Oui','periode-construction',0.95,'',{provenanceNote:`Année de construction : ${yr.v}.`,secondarySourceOk:true}); }
    { const ven=val(/^Systeme\s+de\s+ventilation\b/i), vt=val(/^Type\s+de\s+ventilation\b/i); const vs=`${vt?.v||''} ${ven?.v||''}`;
      const vv=/double\s+flux/i.test(vt?.v||'')?'VMC double flux':/hygro\w*\s*B\b/i.test(ven?.v||'')?'VMC Hygro B':/hygro\w*\s*A\b/i.test(ven?.v||'')?'VMC Hygro A':/hybride/i.test(vs)?'Ventilation hybride':/Ouv\.?\s*de\s*fenetre|naturelle/i.test(vt?.v||'')?'Ventilation naturelle':/autoreglable/i.test((ven?.v||'').split(/\s(?=Autoreglable)/)[0])?'VMC simple flux autoréglable':/simple\s+flux/i.test(vt?.v||'')?'VMC simple flux':null;
      if(vv) emit((ven||vt).y,B,bk.phase==='after'?'ventilation':'ventilation_before',vv,'ventilation',0.92,'',{provenanceNote:`Ventilation ${bk.phase==='after'?'du projet':'de l’état initial'} : ${vs.trim()}.`}); }
    if(bk.phase==='after'){
      const lg=val(/^Nombre\s+de\s+logements\b/i); const nl=lg&&/^\d+/.test(lg.v)?Number(lg.v.match(/^\d+/)[0]):null; if(nl) emit(lg.y,B,'housing_count',nl,'logements',0.96);
      // Zone traversante : tous les logements de la zone le sont (convention ExtracTerre : nombre de logements).
      const tr=val(/^Zone\s+traversante\b/i); if(tr&&/^oui/i.test(tr.v)) emit(tr.y,B,'cross_ventilated',nl||'Oui','zone-traversante',0.9,'',{provenanceNote:`Zone traversante : oui${nl?` (${nl} logements)`:''}.`});
      const st=S.find(x=>/^Type\s+de\s+stockage\b/i.test(x.t)), te=val(/^Type\s+d.ECS\b/i);
      const ecs=/thermodynamique/i.test(st?.t||'')?'Chauffe-eau thermodynamique':/elec/i.test(st?.t||'')||/^electrique/i.test(te?.v||'')?'Ballon électrique':/lie\s+au\s+chauffage/i.test(te?.v||'')?'Chaudière':/solaire/i.test(te?.v||'')?'Solaire thermique':null;
      if(ecs) emit((st||te).y,B,'ecs',ecs,'ecs',0.88);
      const gen=S.filter(x=>/^\d-\d{2}-\d{2}\]\s+Generateur\s*:|^Type\s+de\s+generateur\b|^Type\s+de\s+machine\b|^Mode\s+de\s+production\b|^presence\s+de\s+ventilateur/i.test(x.t)).map(x=>x.t).join(' ');
      const em=val(/^Type\s+de\s+Chauffage\b/i);
      const mode=/Compression\s+electrique|pompe\s+a\s+chaleur|Systeme\s+thermo/i.test(gen)?(/Air\s+Exterieur\s*-\s*Interieur\s*:\s*Eau/i.test(gen)?'PAC air/eau':/Air\s+Exterieur\s*-\s*Interieur\s*:\s*Air/i.test(gen)?'PAC air/air':/Sol|Nappe|Eau\s+de\s+nappe/i.test(gen)?'PAC géothermique':'PAC'):/condensation/i.test(gen)?'Chaudière condensation':/chaudiere/i.test(gen)?'Chaudière gaz':/effet\s+joule|convecteur|panneau/i.test(`${gen} ${em?.v||''}`)?'Chauffage électrique direct':null;
      if(mode) emit(S.find(x=>/Generateur\s*:/i.test(x.t))||em?.y||S[0],B,'heating_mode_after',mode,'generateur',0.9,'',{provenanceNote:/PAC/.test(mode)&&/condensation/i.test(gen)?'Génération mixte : pompe à chaleur en base et chaudière gaz à condensation en appoint.':'Générateur du projet.'}); }
    else { const em=val(/^Type\s+de\s+Chauffage\b/i); const e=em?UW_ENERGY(em.v):null; if(e&&!out.some(o=>o.field==='heating_vector_before'&&o.building===canonical(B))) emit(em.y,B,'heating_vector_before',e,'emission-initiale',0.88); }
  }
  // Ubat par bâtiment : « ETAT INITIAL : CALCUL du COEFFICIENT UBAT : A » / « Projet - Batiment : A » … « COEFFICIENT UBAT = 0,607 ».
  L.forEach((x,i)=>{ let m=x.t.match(/^ETAT\s+INITIAL\s*:\s*CALCUL\s+du\s+COEFFICIENT\s+UBAT\s*:\s*(.+)$/i), ph='before';
    if(!m&&/CALCUL\s+du\s+COEFFICIENT\s+UBAT$/i.test(x.t)&&/^Projet\s*-\s*Batiment\s*:/i.test(L[i+1]?.t||'')){ m=L[i+1].t.match(/:\s*(.+)$/); ph='after'; }
    if(!m) return; const B=all.length===1?all[0]:(bByName(m[1].trim())||null); if(!B) return; const u=L.slice(i,i+260).find(y=>/^COEFFICIENT\s+UBAT\s*=\s*[\d,]+$/i.test(y.t)); if(u) emit(u,B,ph==='before'?'ubat_before':'ubat_after',uw_nums(u.t)[0],`ubat-${ph}-calcul`,0.94,'W/m².K');
    const r=L.slice(i,i+260).find(y=>/^COEFFICIENT\s+UBAT\s+REF\s*=\s*[\d,]+$/i.test(y.t)); if(r) emit(r,B,'ubat_ref',uw_nums(r.t)[0],'ubat-ref-calcul',0.93,'W/m².K',{provenanceNote:'Ubat du bâtiment de référence (« COEFFICIENT UBAT REF »).'}); });
  // 6. Données générales.
  { const d=L.find(x=>/^Numero\s+de\s+departement\s*:\s*(\d{2,3}|2[AB])\b/i.test(x.t)); if(d) emit(d,'Bâtiment unique','department',d.t.match(/:\s*(\d{2,3}|2[AB])\b/i)[1],'departement',0.95,'',{secondarySourceOk:true});
    // Surface utile du récapitulatif RT rénovation de chaque bâtiment (« Batiment: X » quelques lignes plus bas).
    const sus=L.map((x,i)=>({x,i})).filter(({x})=>/^Surface\s+utile\s*:\s*[\d\s,]+m²/i.test(x.t));
    sus.forEach(({x,i},k)=>{ const bl=L.slice(i,i+12).find(y=>/^Batiment\s*:\s*\S/i.test(y.t)); const nm=bl?bl.t.replace(/^Batiment\s*:\s*/i,'').trim():null;
      const B=all.length===1?all[0]:(nm?bByName(nm):null)||all[Math.min(k,all.length-1)]; emit(x,B,'shab',uw_n(x.t.match(/:\s*([\d\s,]+?)\s*m²/)[1].replace(/\s/g,'')),'surface-utile',0.92,'m²',{provenanceNote:`Surface utile du récapitulatif RT rénovation${nm?` (${nm})`:''}.`}); }); }
  return out;
}
