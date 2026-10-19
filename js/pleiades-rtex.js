// v2.4.0 — Rapport Pléiades « Résultats RT Existant suivant la méthode THCE - Ex » (Pléiades 5.x et 6.x), réécrit pour
// lire chaque bâtiment / zone du rapport. Le rapport est découpé par chapitres (titres, pas numéros : « 1 Vues 3D » les
// décale) puis par sous-sections « N.k <bâtiment> » :
//  • Résultats : Cep initial / projet / référence / Max(CH,ECS,FR) (colonne « initial » parfois vide), « Coefficient Cep »,
//    « Cep max » du label, décomposition du Cep projet, étiquettes équivalentes, Tic par groupe, consommations en énergie
//    finale par usage et par énergie ;
//  • Enveloppe : Ubat (hiver) initial / projet / référence ;
//  • Caractéristiques : SHON, année, logements (somme des zones), surfaces habitables, zones traversantes ;
//  • Systèmes : générations « (Volume chauffe <bâtiment>) », ventilations « <bâtiment> - VMC … » ;
//  • Bibliothèques (communes) : px_compositions de parois, baies, générateurs.
// Les épaisseurs sont en mm (convention ExtracTerre), les R en m².K/W, les Cep en kWhEP/m².an.
import {normalizeText,parseFrNumber,normalizeGlazingType} from './utils.js';
import {insulationName} from './donnees-techniques.js';

const px_tx=l=>normalizeText(l?.text||'').replace(/\s+/g,' ').trim();
function px_allLines(doc){ const out=[]; for(const page of doc.read?.pages||[]) (page.lines||[]).forEach(line=>out.push({page,line,t:px_tx(line)})); return out; }
const px_nums=s=>(String(s||'').match(/[-+]?\d+(?:[.,]\d+)?(?:E[-+]?\d+)?/gi)||[]).map(x=>parseFrNumber(x)).filter(v=>v!==null);
const px_r2=v=>Math.round(v*100)/100;

export function isPleiadesRtexReport(doc){
  return /Resultats\s+RT\s+Existant\s+suivant\s+la\s+methode\s+TH-?C-?E\s*-?\s*Ex/i.test(String(doc?.read?.text||'').slice(0,400000));
}

const px_CHAP=[['res',/^Resultats\s+RT\s+Existant\b/i],['env',/^Enveloppe\s+thermique\b/i],['lib',/^Bibliotheques?\s+projet\b/i],['equip',/^Bibliotheque\s+d.equipements\b/i],['car',/^Caracteristiques\s+du\s+projet\b/i]];
// Chapitres et sous-sections du rapport (les pages ont un pied « Pleiades, version … » qui n'interrompt rien).
export function pleiadesRtexSections(doc){
  const L=px_allLines(doc); const chap={}; const order=[];
  L.forEach((x,i)=>{ const m=x.t.match(/^(\d{1,2})\s+(\S.*)$/); if(!m) return; const c=px_CHAP.find(([,re])=>re.test(m[2])); if(c&&!chap[c[0]]){ chap[c[0]]={n:m[1],i}; order.push(c[0]); } });
  const ends={}; const starts=order.map(k=>chap[k].i).sort((a,b)=>a-b);
  for(const k of order){ const s=chap[k].i; ends[k]=starts.find(v=>v>s)??L.length; }
  const subs=k=>{ const c=chap[k]; if(!c) return []; const out=[]; for(let i=c.i+1;i<ends[k];i++){ const m=L[i].t.match(new RegExp(`^${c.n}\\.(\\d{1,2})\\s+(\\S.{0,80})$`)); if(m&&!/\bCSTB\b|^\d|\d+\.\d+\s+\d/.test(m[2])) out.push({k:Number(m[1]),name:m[2].trim(),i}); }
    return out.map((s,j)=>({...s,end:j+1<out.length?out[j+1].i:ends[k]})); };
  const res=subs('res'); const names=res.map(s=>s.name);
  const pick=(k)=>{ const a=subs(k); const byName={}; for(const s of a) if(names.includes(s.name)&&!byName[s.name]) byName[s.name]=s; return {all:a,byName}; };
  const car=pick('car'); const env=pick('env');
  return {L,chap,ends,res,env:env.byName,car:car.byName,carAll:car.all};
}
function px_fileBuilding(doc){
  const n=normalizeText(String(doc?.name||'')).replace(/[_\-.]+/g,' ');
  const m=n.match(/\b(?:batiments?|bat)\s+(?:sur\s+)?([A-Za-z0-9]+)\b/i); return m&&!/^(?:pdf|rapport)$/i.test(m[1])?`Batiment ${m[1]}`:null;
}
export function pleiadesRtexBuildingNames(doc){
  const names=[...new Set(pleiadesRtexSections(doc).res.map(s=>s.name))]; const fb=px_fileBuilding(doc);
  // Un seul bâtiment numéroté par défaut (« Batiment 1 ») : le nom de fichier (« … batiment cour ») est plus parlant.
  if(names.length<=1&&fb&&(!names.length||/^Batiment\s+1$/i.test(names[0]))) return [fb];
  return names.length?names:(fb?[fb]:[]);
}

// Clé courte d'un bâtiment pour le retrouver dans les noms de générations / ventilations (« BAT B », « B1 », « lgt 6 et 7 »).
const px_nameKey=n=>normalizeText(n).replace(/^(?:batiments?|bat\.?|logements?|lgts?|maisons?)\s+/i,'').trim();
const px_mentions=(t,name)=>{ const k=px_nameKey(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'); return k&&new RegExp(`(?:^|[\\s(\\-])(?:bat\\.?\\s*|batiment\\s+|lgts?\\s+|logements?\\s+|zone\\s+)?${k}(?=$|[\\s)\\-])`,'i').test(t); };

const px_VECT={'Électricité':'cep_electricity','Gaz':'cep_gas','Réseau de chaleur urbain':'cep_district','Bois / biomasse':'cep_biomass'};
const px_cadreV=s=>/pvc/i.test(s)?'PVC':/bois.*alu|alu.*bois|mixte/i.test(s)?'Bois/aluminium':/alu/i.test(s)?'Aluminium':/acier/i.test(s)?'Acier':/bois/i.test(s)?'Bois':null;
const px_protV=s=>/volet\s+roulant/i.test(s)?'Volet roulant':/brise|bso|venitien/i.test(s)?'BSO':/store/i.test(s)?'Store extérieur':/persienne/i.test(s)?'Persienne':/battant/i.test(s)?'Volet battant':null;
const px_ventV=s=>/double\s+flux/i.test(s)?'VMC double flux':/hygro\w*\s*(?:type\s*)?B\b/i.test(s)?'VMC Hygro B':/hygro\w*\s*(?:type\s*)?A\b/i.test(s)?'VMC Hygro A':/hybride/i.test(s)?'Ventilation hybride':/autoreglable/i.test(s)?'VMC simple flux autoréglable':/simple\s+flux|mecanique/i.test(s)?'VMC simple flux':/naturelle|ouverture\s+de\s+fenetres|tirage/i.test(s)?'Ventilation naturelle':null;
const px_structV=s=>/beton\s+cellulaire/i.test(s)?'Béton cellulaire':/parpaing|bloc\s+beton|agglo|\bBBM\b|blocs?\s+creux/i.test(s)?'Bloc béton / parpaing':/beton|\bBA\b/i.test(s)?'Béton armé':/brique/i.test(s)?'Brique terre cuite':/meuliere/i.test(s)?'Meulière':/pierre|moellon/i.test(s)?'Pierre':/\bCLT\b|bois\s+massif/i.test(s)?'CLT':/ossature\s+bois/i.test(s)?'Ossature bois':null;
const px_insul=s=>insulationName(s)||(/coton/i.test(s)?'Biosourcé chanvre/lin/coton':/\blaine\s+minerale\b/i.test(s)?'Laine minérale':null);
const px_F={wall:['wall_insulation','wall_insulation_thickness','wall_insulation_r','wall_structure'],roof:['roof_insulation','roof_insulation_thickness','roof_insulation_r','roof_structure'],floor:['floor_insulation','floor_insulation_thickness','floor_insulation_r','floor_structure']};

// Bibliothèque de px_compositions : « <titre> / Type de paroi … / Nature de paroi … / couches « nom ep λ ρ Cs U R » / Total U R ».
export function px_compositions(L,a,b){
  const out=[]; let cur=null;
  const LAYER=/(\d{1,3}(?:\.\d+)?)\s+(\d{1,2}\.\d{2,3})\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s*$/;
  for(let i=a;i<b;i++){ const t=L[i].t; let m;
    if((m=t.match(/^Type\s+de\s+paroi\s+(.+)$/i))){ const kind=/verticale/i.test(m[1])?'wall':/plancher\s+haut|toiture/i.test(m[1])?'roof':/plancher\s+bas/i.test(m[1])?'floor':/locaux\s+non\s+chauffes/i.test(m[1])?'nc':null;
      let ti=i-1; while(ti>a&&/^(?:=====|Pleiades|Bilan\s+thermique|Simulation\s+thermique|\d+$)/i.test(L[ti].t)) ti--; cur={title:L[ti]?.t||'',x:L[i],kind,nature:'',layers:[]}; out.push(cur); continue; }
    if(!cur) continue;
    if((m=t.match(/^Nature\s+de\s+paroi\s+(.*)$/i))){ cur.nature=m[1]; if(cur.kind==='nc') cur.kind=/plancher/i.test(m[1])?'floor':/mur/i.test(m[1])?'wall':null; continue; }
    if((m=t.match(/^Total\s+([\d.]+)\s+([\d.]+)\s*$/i))){ cur.U=Number(m[1]); cur.Rtot=Number(m[2]); cur=null; continue; }
    const q=t.match(new RegExp('^(.*?)\\s*'+LAYER.source)); if(!q) continue;
    let name=q[1]; if(!/[a-z]{3}/i.test(name)){ const p=L[i-1]?.t||''; name=/[a-z]{3}/i.test(p)&&!/^(?:W|\(cm\)|Composante|Type|Nature|Valeur|Origine)/i.test(p)?p:''; }
    cur.layers.push({x:L[i],name,e:Number(q[2]),lambda:Number(q[3]),R:Number(q[4])});
  }
  return out.filter(c=>c.kind&&c.layers.length);
}
// Composition « après travaux » d'un type de paroi : on écarte les parois existantes / non isolées et les parois
// intérieures, puis on retient l'isolant le plus fréquent (à égalité, la paroi la plus résistante).
export function px_projectedComposition(comps,kind){
  const cand=comps.filter(c=>c.kind===kind&&!/existant|non\s+isole|\bNI\b|initial|cloison|intermediaire|interieur|separation|mitoyen/i.test(c.title)&&(kind!=='wall'||/mur\s+exterieur|^$/i.test(c.nature)))
    .map(c=>{ const ins=c.layers.filter(l=>l.lambda<=0.065&&px_insul(l.name)).sort((p,q)=>q.R-p.R)[0]; return ins?{c,ins,name:px_insul(ins.name)}:null; }).filter(Boolean);
  if(!cand.length) return null;
  const starred=cand.filter(z=>/^\d+\*/.test(z.c.title)); const pool=starred.length?starred:cand;
  const cnt={}; pool.forEach(z=>cnt[z.name]=(cnt[z.name]||0)+1);
  return pool.sort((p,q)=>cnt[q.name]-cnt[p.name]||(q.c.Rtot||q.ins.R)-(p.c.Rtot||p.ins.R))[0];
}

export function parsePleiadesRtexReport(doc,occ,canonical=(s)=>s){
  const out=[]; const S=pleiadesRtexSections(doc); const L=S.L; const origin='Pléiades — résultats RT existant (Th-C-E ex)';
  const names=pleiadesRtexBuildingNames(doc); const single=S.res.length<=1;
  const label=n=>canonical(single?(names[0]||'Bâtiment unique'):n);
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value))) return; const o=occ(doc,x.page,x.line,field,value,`pleiades-rtex:${method}`,conf,unit,{building:b,structuredPdf:true,origin,dedicatedRank:6,...extra}); if(o) out.push(o); };
  const seg=(a,b)=>L.slice(a,b);
  const sections=S.res.length?S.res:[{name:names[0]||'Bâtiment unique',i:0,end:L.length}];
  const all=L.map(x=>x.t).join('\n');
  // Énergie « autres sources » : nommée par les générateurs de la bibliothèque d'équipements.
  const eq=S.chap.equip?seg(S.chap.equip.i,S.ends.equip).map(x=>x.t).join(' '):all;
  const autre=/chaudiere\s+gaz|\bgaz\s+naturel\b|\bpropane\b|Gaz\s+Gaz/i.test(eq)?'Gaz':/fioul/i.test(eq)?'Fioul':/reseau\s+de\s+chaleur|sous-?station/i.test(eq)?'Réseau de chaleur urbain':/chaudiere\s+(?:bois|granul)|biomasse/i.test(eq)?'Bois / biomasse':null;
  const pac=/Pac\s+(air|eau|sol)\s*\/\s*(eau|air)|pompe\s+a\s+chaleur|Generateur\s+thermodynamique/i.exec(eq);
  const pacFn=pac?(eq.slice(pac.index,pac.index+600).match(/Fonction\s+(Chauffage\s+et\s+ECS|Chauffage|ECS)/i)||[])[1]||'':'';
  const pacType=pac?(()=>{ const m=eq.match(/Pac\s+(air|eau|sol)\s*\/\s*(eau|air)/i); return m?`PAC ${m[1].toLowerCase()==='sol'?'géothermique':`${m[1].toLowerCase()}/${m[2].toLowerCase()}`}`.replace('PAC géothermique','PAC géothermique'):'PAC air/eau'; })():null;
  const vecteurs={};

  for(const s of sections){
    const B=label(s.name); const R=seg(s.i,s.end); const find=re=>R.find(x=>re.test(x.t));
    // Cep projet : « Coefficient Cep 82.2 kWh ep/m² » (page de conformité au label).
    const coef=find(/^Coefficient\s+Cep\s+[\d.,]+/i); const cepP=coef?px_nums(coef.t)[0]:null;
    const row=R.find(x=>/^kWh\s*ep\/m²?\s+[\d.,]+\s+[\d.,]+/i.test(x.t)); const v=row?px_nums(row.t.replace(/m²|m2/g,'')):[];
    // « kWh ep/m² [initial] projet référence max » : la colonne initiale manque quand l'état initial n'est pas saisi.
    const k=cepP!==null?v.findIndex(z=>Math.abs(z-cepP)<0.06):(v.length>=4?1:0);
    const cep=cepP??(k>=0?v[k]:null);
    let cepBefore=null;
    if(cep!==null){ const x=coef||row; const note={provenanceNote:'« Coefficient Cep » / colonne « Projet » du tableau des résultats.'};
      emit(x,B,'cep_after_final',cep,'cep-projet',0.97,'kWhEP/m².an',note); emit(x,B,'cep',cep,'cep',0.94,'kWhEP/m².an',note); }
    if(row&&k>0){ cepBefore=v[k-1]; emit(row,B,'cep_before',cepBefore,'cep-initial',0.95,'kWhEP/m².an',{provenanceNote:'Colonne « Cep initial » du tableau des résultats.'}); }
    const ref=row&&k>=0&&v.length>k+1?v[k+1]:null, maxCh=row&&k>=0&&v.length>k+2?v[k+2]:null;
    // Cep max : Cep de référence (exigence « Cep ≤ Cep ref » de la RT existant globale), convention des corrections
    // validées ; le Max(CH,ECS,FR) et l'objectif du label visé restent en note.
    const cm=find(/^Cep\s+max\s+[\d.,]+\s*kWh/i); const lab=cm?px_nums(cm.t)[0]:null; const cepMax=ref??lab;
    if(cepMax){ const note={provenanceNote:`Cep de référence (exigence de la RT existant globale)${maxCh?` ; Max(CH,ECS,FR) = ${maxCh}`:''}${lab?` ; objectif du label : ${lab}`:''}.`};
      emit(ref!==null?row:cm,B,'cep_max',cepMax,'cep-ref',0.93,'kWhEP/m².an',note);
      if(cep!==null) emit(ref!==null?row:cm,B,'cep_gain',Math.round((cepMax-cep)/cepMax*1000)/10,'cep-gain',0.92,'%',{provenanceNote:`Gain = (Cep ref − Cep projet) / Cep ref = (${cepMax} − ${cep}) / ${cepMax}.`}); }
    // Étiquettes équivalentes après travaux.
    for(const [re,f,m] of [[/^Energie\s*:\s*Classe\s+equivalente\s+([A-G])\b/i,'dpe_energy_after','etiquette-energie'],[/^CO2\s*:\s*Classe\s+equivalente\s+([A-G])\b/i,'dpe_ges_after','etiquette-co2']]){ const x=find(re); if(x) emit(x,B,f,x.t.match(re)[1].toUpperCase(),m,0.9,'',{provenanceNote:'Étiquette équivalente après travaux (Pléiades).'}); }
    // Tic : lignes « <groupe> 25.61 °C 26.84 °C » (projet, référence) ; le groupe le plus chaud fait le Tic du bâtiment.
    { const a=R.findIndex(x=>/^Exigence\s+de\s+resultat\s*:\s*Tic\b/i.test(x.t)), b=R.findIndex(x=>/^Detail\s+des\s+consommations/i.test(x.t));
      const g=a<0?[]:R.slice(a+1,b>a?b:a+12).map(x=>{ const m=x.t.match(/^(.*?)\s*(\d{2}(?:\.\d+)?)\s*°C\s+(\d{2}(?:\.\d+)?)\s*°C\s*$/); return m?{x,grp:m[1],tic:Number(m[2]),ref:Number(m[3])}:null; }).filter(z=>z&&z.tic>=15&&z.tic<=45);
      const top=g.sort((p,q)=>q.tic-p.tic)[0];
      if(top){ const note={provenanceNote:g.length>1?`Tic du groupe le plus chaud (${top.grp||'groupe'}) parmi ${g.length} groupes.`:'Exigence de résultat Tic (projet / référence).'}; emit(top.x,B,'tic',top.tic,'tic',0.95,'°C',note); emit(top.x,B,'tic_ref',top.ref,'tic-ref',0.95,'°C',note); } }
    // Décomposition du Cep projet : « Eclairage (5.8kWh/m², 8%) ».
    const poste={};
    { const i=R.findIndex(x=>/^Decomposition\s+du\s+Cep\b.*\bProjet\s*:/i.test(x.t));
      if(i>=0) for(const x of R.slice(i+1,i+12)){ if(/^Decomposition|^Conformite/i.test(x.t)) break;
        // Deux postes peuvent partager une ligne : « ECS (20.5kWh/m², 34%) Eclairage (8.7kWh/m², 15%) ».
        for(const m of x.t.matchAll(/(Chauffage|Refroidissement|ECS|Eclairage|Aux\.?\s*(?:generation|distribution|ventilation))\s*\(\s*([\d.]+)\s*kWh/gi)){ const kk=normalizeText(m[1]).toLowerCase(); const key=/generation|distribution/.test(kk)?'aux_dist':/ventilation/.test(kk)?'aux_vent':kk; poste[key]=(poste[key]||0)+Number(m[2]); poste.x??=x; } } }
    if(poste.x){ const note={provenanceNote:'Décomposition du Cep projet (hors production ENR).'};
      emit(poste.x,B,'cep_lighting',px_r2(poste.eclairage||0),'cep-eclairage',0.95,'kWhEP/m².an',note);
      emit(poste.x,B,'cep_aux_vent',px_r2(poste.aux_vent||0),'cep-aux-ventilation',0.95,'kWhEP/m².an',note);
      emit(poste.x,B,'cep_aux_dist',px_r2(poste.aux_dist||0),'cep-aux-generation',0.93,'kWhEP/m².an',{provenanceNote:'Décomposition du Cep projet : auxiliaires de génération et de distribution.'});
      emit(poste.x,B,'cep_cooling',px_r2(poste.refroidissement||0),'cep-refroidissement',0.93,'kWhEP/m².an',note); }
    // Consommations en énergie finale : « dont chauffage electrique kWh [initial] projet reference ».
    const tot=find(/^Consommation\s+totale\s+type\s+electrique\s+kWh/i); const ncol=tot?px_nums(tot.t.replace(/^.*?kWh/i,'')).length:3;
    const col={ini:ncol>=3?0:null,proj:ncol>=3?1:0};
    const conso=(u,src)=>{ const x=R.find(y=>new RegExp(`^dont\\s+${u}\\s+${src}\\s+kWh\\b`,'i').test(y.t)); return x?{x,v:px_nums(x.t.replace(/^.*?kWh/i,''))}:null; };
    const usage={};
    for(const [u,fb,fa] of [['chauffage','heating_vector_before','heating_vector_after'],['ECS','ecs_vector_before','ecs_vector_after']]){
      const E={'Électricité':conso(u,'electrique'),'Bois / biomasse':conso(u,'bois'),autre:conso(u,'autres\\s+sources')};
      for(const [c,f] of [[col.ini,fb],[col.proj,fa]]){ if(c===null) continue;
        const parts=Object.entries(E).filter(([,z])=>z&&z.v[c]>0).sort((p,q)=>q[1].v[c]-p[1].v[c]); if(!parts.length) continue;
        const [kk,z]=parts[0]; const vect=kk==='autre'?autre:kk; if(!vect) continue; if(c===col.proj) usage[u]={vect,seul:parts.length===1};
        const tot2=parts.reduce((a,[,y])=>a+y.v[c],0), part=Math.round(z.v[c]/tot2*100);
        // L'énergie « autres sources » initiale est nommée d'après les générateurs du projet : hypothèse à vérifier
        // quand le projet change d'énergie ou que la bibliothèque n'en décrit qu'une.
        const hyp=kk==='autre'&&c===col.ini;
        emit(z.x,B,f,vect,`${u.toLowerCase()}-energie`,hyp?0.8:0.94,'',{provenanceNote:`Consommations en énergie finale (${c===col.ini?'état initial':'projet'}) : ${part} % « ${kk==='autre'?'autres sources':kk} »${kk==='autre'?` = ${vect} (générateurs décrits dans le rapport)`:''}.${hyp?' Hypothèse : énergie non électrique de l’état initial, à confirmer (DPE, audit).':''}`,...(hyp?{reviewCap:0.8}:{})}); }
    }
    vecteurs[B]=usage;
    // ENR : production d'électricité à demeure (photovoltaïque) et couverture solaire de l'ECS / du chauffage.
    { const pv=find(/^Production\s+d.electricite\s+a\s+demeure\s+kWh/i); const pvOn=pv&&px_nums(pv.t.replace(/^.*?kWh/i,'')).slice(col.proj).some(z=>z>0);
      const sol=R.filter(x=>/^Taux\s+de\s+couverture\s+solaire/i.test(x.t)||/^[\d.]+\s*%$/.test(x.t)).some(x=>px_nums(x.t).some(z=>z>0));
      if(pv){ emit(pv,B,'enr',pvOn||sol?'Oui':'Non','enr',0.85,'',{provenanceNote:'Production d’électricité à demeure et couverture solaire du rapport.'}); if(pvOn) emit(pv,B,'enr_type','Photovoltaïque','enr-type',0.85); else if(sol) emit(pv,B,'enr_type','Solaire thermique','enr-type',0.85); } }
    // Cep par énergie : chauffage et ECS mono-énergie, auxiliaires et éclairage électriques.
    if(poste.x&&usage.chauffage?.seul&&(usage.ECS?.seul||!poste.ecs)){ const parE={}; const add=(e,val)=>{ if(val>0) parE[e]=(parE[e]||0)+val; };
      add(usage.chauffage.vect,poste.chauffage); if(usage.ECS) add(usage.ECS.vect,poste.ecs); add('Électricité',(poste.eclairage||0)+(poste.aux_vent||0)+(poste.aux_dist||0)+(poste.refroidissement||0));
      for(const [e,f] of Object.entries(px_VECT)) emit(poste.x,B,f,px_r2(parE[e]||0),'cep-energie',0.93,'kWhEP/m².an',{provenanceNote:parE[e]?`Somme des postes du Cep projet au ${e.toLowerCase()}.`:`Aucun poste du Cep projet au ${e.toLowerCase()}.`}); }
    // Enveloppe : « Ubat (hiver) W/m2.K [initial] projet référence ».
    const env=S.env[s.name]||(single?{i:S.chap.env?.i??0,end:S.ends.env??L.length}:null);
    if(env){ const ub=seg(env.i,env.end).find(x=>/^Ubat\s*\(hiver\)/i.test(x.t));
      if(ub){ const u=px_nums(ub.t.replace(/W\/m2\.K/i,'')).filter(z=>z<10);
        if(u.length>=2) emit(ub,B,'ubat_after',u[u.length-2],'ubat-projet',0.96,'W/m².K',{provenanceNote:'Ubat projet (avant-dernière colonne, la dernière étant la référence).'});
        if(u.length>=3) emit(ub,B,'ubat_before',u[u.length-3],'ubat-initial',0.94,'W/m².K',{provenanceNote:'Ubat initial (première colonne).'}); } }
    // Caractéristiques du bâtiment.
    const car=S.car[s.name]||(single?(S.chap.car?{i:S.chap.car.i,end:S.ends.car}:{i:0,end:L.length}):null);
    if(car){ const C=seg(car.i,car.end); const f2=re=>C.find(x=>re.test(x.t));
      const yr=f2(/^Annee\s*de\s*construction\s+\d{4}/i); if(yr){ const y=px_nums(yr.t)[0]; if(y>=1500&&y<=2100) emit(yr,B,'construction_year',y,'annee',0.95); }
      // Logements : somme des zones (« Nombre de logements 9 », « Nombre de maisons 2 »), traversants si les zones le disent.
      let lg=0, tr=0, ntr=0, lgx=null, cur='';
      for(const x of C){ if(/^Zone\s+/i.test(x.t)) cur=x.t; const m=x.t.match(/^Nombre\s+de\s+(?:logements|maisons)\s+(\d+)\b/i); if(!m) continue; const n=Number(m[1]); lg+=n; lgx??=x;
        if(/non\s+traversant/i.test(cur)) ntr+=n; else if(/traversant/i.test(cur)) tr+=n; }
      if(lg) emit(lgx,B,'housing_count',lg,'logements',0.96,'',{provenanceNote:'Somme des logements des zones du bâtiment.'});
      if(tr||ntr){ const zx=C.find(x=>/^Zone\s+.*traversant/i.test(x.t)); emit(zx,B,'cross_ventilated',tr,'traversants',0.9,'logements',{provenanceNote:`${tr} logement(s) en zones « traversantes ».`}); emit(zx,B,'non_cross_ventilated',ntr,'non-traversants',0.9,'logements',{provenanceNote:`${ntr} logement(s) en zones « non traversantes ».`}); }
      // Surface habitable : somme des groupes (« Surface habitable en residentiel ou SHON … 627.87 m² », valeur parfois à la ligne).
      let sh=0, shx=null;
      C.forEach((x,i)=>{ if(!/^Surface\s*habitable\s*en\s*residentiel/i.test(x.t)) return; let val=px_nums(x.t.replace(/^.*?usage/i,''))[0]; if(!(val>0)){ const nx=C[i+1]?.t||''; const m=nx.match(/^([\d.,]+)\s*m²/); if(m) val=parseFrNumber(m[1]); } if(val>0){ sh+=val; shx??=x; } });
      const shon=f2(/^SHON\s+[\d.,]+\s*m/i);
      if(sh>0) emit(shx,B,'shab',px_r2(sh),'shab',0.95,'m²',{provenanceNote:'Surface habitable des groupes du bâtiment (étude RT existant).'});
      else if(shon) emit(shon,B,'shab',px_nums(shon.t)[0],'shon',0.85,'m²',{provenanceNote:'SHON du bâtiment (surface habitable non détaillée).',reviewCap:0.85});
      if(f2(/^Travaux\s+de\s+renovation\s+oui/i)) emit(f2(/^Travaux\s+de\s+renovation\s+oui/i),B,'renovation','Oui','renovation',0.9);
    }
  }

  // Systèmes (chapitre Caractéristiques : « Systemes de chauffage, ecs et climatisation », « Systemes de ventilation »).
  const sysSec=S.carAll.find(z=>/^Systemes\s+de\s+chauffage/i.test(z.name))||(S.chap.car?null:{i:0,end:L.length}), venSec=S.carAll.find(z=>/^Systemes\s+de\s+ventilation/i.test(z.name))||(S.chap.car?null:{i:0,end:L.length});
  const targets=sections.map(s=>({name:s.name,B:label(s.name)}));
  const forB=(t)=>{ const hit=targets.filter(z=>px_mentions(t,z.name)); return hit.length?hit:targets; };
  // Générations : blocs « <nom> (Volume chauffe <bâtiment>) » ou communes.
  const gens=[];
  if(sysSec){ const Y=seg(sysSec.i,sysSec.end); let g=null;
    Y.forEach(x=>{ if(/\(Volume\s+chauffe\b|^Chaudiere|^Generation\s+\S|^Production\s+\S|\((?:Exterieur|Tampon)/i.test(x.t)&&!/^Generation\s+de\s+(?:chauffage|ecs)\b/i.test(x.t)){ g={x,head:x.t,body:[]}; gens.push(g); } else if(/^Emetteurs\s+(?:chaud|ECS)/i.test(x.t)) g=null; else if(g) g.body.push(x.t); }); }
  const emitters=sysSec?seg(sysSec.i,sysSec.end).map(x=>x.t).join(' '):'';
  for(const z of targets){
    const u=vecteurs[z.B]||{}; const mine=gens.filter(g=>{ const vm=g.head.match(/\(Volume\s+chauffe\s+(.+?)\)/i); return vm?px_mentions(vm[1],z.name)||(single):true; });
    const blk=mine.map(g=>g.head+' '+g.body.join(' ')).join(' ');
    const x=mine[0]?.x||(sysSec?L[sysSec.i]:null);
    // Mode de chauffage après travaux.
    let mode=null;
    if(u.chauffage?.vect==='Électricité') mode=pac&&/Chauffage/i.test(pacFn)?pacType:/panneaux?\s+rayonnants?\s+electriques|effet\s+joule|convecteur|radiateur\s+electrique|rayonnant/i.test(emitters+' '+eq)?'Chauffage électrique direct':null;
    else if(u.chauffage?.vect==='Gaz') mode=/condensation/i.test(eq+' '+blk)?'Chaudière condensation':'Chaudière gaz';
    else if(u.chauffage?.vect==='Réseau de chaleur urbain') mode='Réseau de chaleur';
    else if(u.chauffage?.vect==='Bois / biomasse') mode='Chaudière biomasse';
    else if(/condensation/i.test(blk)) mode='Chaudière condensation';
    // Sans tableau de consommations : le générateur décrit dans la génération du bâtiment.
    else if(/effet\s+joule|panneau\s+rayonnant/i.test(blk)) mode='Chauffage électrique direct';
    else if(/pompe\s+a\s+chaleur|\bPAC\b/i.test(blk)) mode='PAC';
    if(mode&&x) emit(x,z.B,'heating_mode_after',mode,'generation',0.9,'',{provenanceNote:'Générateur de chauffage du projet (bibliothèque d’équipements et énergie consommée).'});
    if((u.chauffage?.vect==='Électricité'||(!u.chauffage&&/^(?:Chauffage électrique direct|PAC)/.test(mode||'')))&&!out.some(o=>o.building===z.B&&o.field==='heating_vector_after')&&x) emit(x,z.B,'heating_vector_after','Électricité','generation-vecteur',0.9);
    // ECS après travaux.
    let ecs=null;
    if(u.ECS?.vect==='Électricité') ecs=pac&&/ECS/i.test(pacFn)?'Chauffe-eau thermodynamique':/Ballon|Stockage|Chauffe-?eau|Effet\s+Joule/i.test(blk+' '+eq)?'Ballon électrique':null;
    else if(u.ECS?.vect==='Gaz'||u.ECS?.vect==='Fioul'||u.ECS?.vect==='Bois / biomasse') ecs='Chaudière';
    else if(u.ECS?.vect==='Réseau de chaleur urbain') ecs='Réseau de chaleur';
    else if(!u.ECS&&/Ballon|Stockage|Chauffe-?eau/i.test(blk)&&/effet\s+joule/i.test(blk)){ ecs='Ballon électrique'; if(x) emit(x,z.B,'ecs_vector_after','Électricité','ecs-vecteur',0.9); }
    if(ecs&&x) emit(x,z.B,'ecs',ecs,'ecs',0.9,'',{provenanceNote:'Production d’ECS du projet (générateurs et énergie consommée).'});
    // Refroidissement : aucun poste « Refroidissement » au Cep projet = pas de système.
    const cool=out.find(o=>o.building===z.B&&o.field==='cep_cooling');
    if(cool) emit(L.find(y=>y.page===cool.page)||x,z.B,'cooling',cool.value>0?'Climatisation active':'Aucun','refroidissement',0.85,'',{provenanceNote:cool.value>0?'Poste refroidissement présent au Cep projet.':'Pas de poste refroidissement au Cep projet.'});
  }
  // Ventilations : « <bâtiment> - VMC … » / « Groupe - … BAT B - … » puis « Nouveau systeme de ventilation … ».
  if(venSec){ const V=seg(venSec.i,venSec.end); const per={}; let head='';
    V.forEach((x,i)=>{ if(/^Surface\s+desservie\b/i.test(x.t)) head=[V[i-2]?.t,V[i-1]?.t].filter(Boolean).join(' ');
      const m=x.t.match(/^(Nouveau\s+systeme\s+de\s+ventilation|Systeme\s+de\s+ventilation\s+initiale)\s+(.+)$/i); if(!m) return; const v=px_ventV(m[2]); if(!v) return;
      const when=/initiale/i.test(m[1])?'before':'after';
      for(const z of forB(head)){ const key=`${z.B}|${when}`; (per[key]=per[key]||{}); per[key][v]=per[key][v]||{n:0,x}; per[key][v].n++; } });
    for(const z of targets){ const p=per[`${z.B}|after`]||per[`${z.B}|before`]; if(!p) continue; const [v,{x,n}]=Object.entries(p).sort((a,b)=>b[1].n-a[1].n)[0];
      emit(x,z.B,'ventilation',v,'ventilation',0.93,'',{provenanceNote:`${per[`${z.B}|after`]?'Nouveau système de ventilation':'Ventilation existante conservée'} (${n} groupe(s)).`});
      const pb=per[`${z.B}|before`]; if(pb){ const [vb,{x:xb,n:nb}]=Object.entries(pb).sort((a,b)=>b[1].n-a[1].n)[0]; emit(xb,z.B,'ventilation_before',vb,'ventilation-initiale',0.93,'',{provenanceNote:`Système de ventilation initial (${nb} groupe(s)).`}); } } }
  // Compositions de parois (bibliothèque commune aux bâtiments du rapport).
  const lib=S.chap.lib?px_compositions(L,S.chap.lib.i,S.ends.lib):px_compositions(L,0,L.length);
  for(const kind of ['wall','roof','floor']){ const z=px_projectedComposition(lib,kind); if(!z) continue; const f=px_F[kind];
    const note={provenanceNote:`Bibliothèque de parois du projet : « ${z.c.title} » — ${z.name} ${z.ins.e} cm, R = ${z.ins.R}.`};
    const st=z.c.layers.filter(l=>l.lambda>0.1).sort((p,q)=>q.e-p.e).map(l=>px_structV(l.name)).find(Boolean);
    for(const t of targets){ emit(z.ins.x,t.B,f[0],z.name,`${kind}-isolant`,0.93,'',note); emit(z.ins.x,t.B,f[1],Math.round(z.ins.e*10),`${kind}-epaisseur`,0.92,'mm',note); emit(z.ins.x,t.B,f[2],z.ins.R,`${kind}-r`,0.92,'m².K/W',note);
      if(st) emit(z.ins.x,t.B,f[3],st,`${kind}-structure`,0.88,'',{provenanceNote:`Couche porteuse de « ${z.c.title} ».`});
      if(kind==='wall'&&st) emit(z.ins.x,t.B,'structure',st,'structure',0.85,'',{provenanceNote:`Couche porteuse du mur extérieur « ${z.c.title} ».`}); } }
  // Baies : fenêtres et portes-fenêtres (ou baies sans type, hors portes), valeur la plus fréquente.
  { const blocks=[]; const typed=L.some(x=>/^Type\s+de\s+baie\b/i.test(x.t));
    // Éditions sans « Type de baie » : les baies sont les titres « … (Baie) ».
    if(!typed) L.forEach((x,i)=>{ if(/\(Baie\)\s*$/i.test(x.t)&&!/porte(?!\s*-?\s*fenetre)|placard|velux|fenetre\s+de\s+toit/i.test(x.t)) blocks.push({title:x.t,b:L.slice(i+1,i+10)}); });
    L.forEach((x,i)=>{ if(!typed||!/^Type\s+de\s+baie\b/i.test(x.t)) return; const t=x.t.replace(/^Type\s+de\s+baie\s*/i,''); const title=L[i-1]?.t||'';
      if(/porte(?!\s+fenetre)|placard|velux|fenetre\s+de\s+toit|lanterneau|chassis\s+fixe\s+interieur/i.test(t+' '+title)&&!/porte\s+fenetre/i.test(t)) return; blocks.push({title,b:L.slice(i+1,i+10)}); });
    const freq=get=>{ const c=new Map(); for(const bl of blocks){ const r=get(bl); if(r&&r.v){ const e=c.get(r.v)||{x:r.x,n:0}; e.n++; c.set(r.v,e); } } const top=[...c.entries()].sort((a,b)=>b[1].n-a[1].n)[0]; return top?{v:top[0],x:top[1].x,n:top[1].n}:null; };
    const dans=(bl,re)=>bl.b.find(y=>re.test(y.t));
    const note=r=>({provenanceNote:`Valeur la plus fréquente des fenêtres et portes-fenêtres de la bibliothèque (${r.n}/${blocks.length}).`});
    const c=freq(bl=>{ const y=dans(bl,/^Type\s+de\s+cadre\s+\S/i); const fromTitle=px_cadreV(bl.title.replace(/\(Baie\)/i,'')); return y&&{x:y,v:fromTitle||px_cadreV(y.t.replace(/^Type\s+de\s+cadre\s+/i,''))}; });
    const g=freq(bl=>{ const y=dans(bl,/^Nom\s+codifie\s+\S/i); return y&&{x:y,v:normalizeGlazingType(y.t.replace(/^Nom\s+codifie\s+/i,''))}; });
    const pr=freq(bl=>{ const y=bl.b.filter(z=>/^Protection\s+(?!solaire)\S/i.test(z.t)).find(z=>/pas\s+de\s+protection/i.test(z.t)||px_protV(z.t)); return y&&{x:y,v:/pas\s+de\s+protection/i.test(y.t)?'Sans occultation':px_protV(y.t)}; });
    for(const t of targets){ if(c) emit(c.x,t.B,'window_material',c.v,'cadre',0.92,'',note(c)); if(g) emit(g.x,t.B,'window_glazing',g.v,'vitrage',0.92,'',note(g)); if(pr) emit(pr.x,t.B,'window_shading',pr.v,'protection',0.9,'',note(pr)); } }
  // Département (commun).
  const dep=L.find(x=>/^Departement\s*:?\s*(\d{2,3}|2A|2B)\s*-/i.test(x.t)); if(dep) emit(dep,'Bâtiment unique','department',dep.t.match(/(\d{2,3}|2A|2B)\s*-/i)[1].padStart(2,'0'),'departement',0.97);
  return out;
}
