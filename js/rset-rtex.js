// v2.3.13 — « Fichier standardisé des caractéristiques thermiques d'une construction Existante » (RSET RT existant,
// feuille de style XSL commune aux logiciels : BatiAudit / U48Win de Perrenoud, ClimaWin, Pléiades…).
//  • FEUILLET BATIMENT (N) — « Identifiant Batiment FULTON - (2) », « Surface utile ou habitable (m2) 905 »,
//    « Annee de la construction 1948 », « Nombre de logements 11 »,
//    « Coefficient Cep 168.79 95.23 -73.56 -43.58% 81.12 … » (Initial (a), Projet (b), écarts, Référence (c)),
//    « Ubat(hiver) 1.37 0.56 -0.81 0.77 … », Tic « Nouveau 001 °C 24.15 28.52 -4.37 », parois et menuiseries ;
//  • FEUILLET EQUIPEMENT (-ID : n) — rattaché au bâtiment par sa surface : ventilation (initiale / projet),
//    tableaux « Type d'energie » oui/non (colonnes Initial / Projet) du chauffage et de l'ECS ;
//  • FEUILLET GENERATION (N) — générateurs de l'état initial et du projet.
// Un « - » dans une colonne signifie « non renseigné » : aucune valeur n'est déduite.
import {normalizeText,parseFrNumber} from './utils.js';

const rx_lt=l=>normalizeText(l?.text||'').replace(/\s+/g,' ').trim();
const rx_tok=s=>String(s||'').trim().split(/\s+/).map(t=>/^-?\d+(?:[.,]\d+)?%?$/.test(t)?(t.endsWith('%')?null:parseFrNumber(t)):(t==='-'||t==='--'?null:t));

export function isRtexStandardFiche(doc){
  const t=String(doc?.read?.text||'').slice(0,20000);
  return /Fichier\s+standardise\s+des\s+caracteristiques\s+thermiques\s+d.une\s+construction\s+Existante/i.test(t);
}
function rx_lines(doc){ const out=[]; for(const page of doc.read?.pages||[]) (page.lines||[]).forEach(line=>out.push({page,line,t:rx_lt(line)})); return out; }
function rx_sections(lines){
  const secs=[]; lines.forEach((x,i)=>{ let m;
    if((m=x.t.match(/^FEUILLET\s+BATIMENT\s*\((\d+)\)/i))) secs.push({kind:'bat',id:m[1],i});
    else if((m=x.t.match(/^FEUILLET\s+EQUIPEMENT\s*\(\s*-?\s*ID\s*:\s*(\d+)\)/i))) secs.push({kind:'equip',id:m[1],i});
    else if((m=x.t.match(/^FEUILLET\s+GENERATION\s*\((\d+)\)/i))) secs.push({kind:'gen',id:m[1],i}); });
  return secs.map((s,k)=>({...s,lines:lines.slice(s.i,k+1<secs.length?secs[k+1].i:lines.length)}));
}
function rx_buildingName(sec){
  const id=sec.lines.find(x=>/^Identifiant\s+Batiment\b/i.test(x.t)); const m=id?.t.match(/^Identifiant\s+Batiment\s+(.*?)\s*-\s*\(\d+\)\s*$/i);
  const name=(m?.[1]||'').trim(); return `Batiment ${name&&!/^-?$/.test(name)?name:sec.id}`;
}
export function rtexStandardBuildingNames(doc){ return rx_sections(rx_lines(doc)).filter(s=>s.kind==='bat').map(rx_buildingName); }

const RX_VECT=[[/^electrique\s+a\s+effet\s+joule\b/i,'Électricité'],[/^electrique\s+thermodynamique\b/i,'Électricité'],[/^gaz\b/i,'Gaz'],[/^fioul\b/i,'Fioul'],[/^solaire\b/i,'Solaire'],[/^reseaux?\s+(?:de\s+)?chaleur\b/i,'Réseau de chaleur urbain'],[/^bois\b/i,'Bois / biomasse']];
// Tableau « Type d'energie : / Initial Projet / gaz oui non … » → vecteurs initial / projet (oui uniquement).
function rx_energyTable(lines,start){
  const res={before:[],after:[],at:null};
  for(const x of lines.slice(start+1,start+12)){
    const v=RX_VECT.find(([re])=>re.test(x.t)); if(!v){ if(/^Initial\s+Projet$/i.test(x.t)) continue; if(res.at) break; continue; }
    const rest=x.t.replace(v[0],'').trim().split(/\s+/).filter(Boolean); res.at=res.at||x;
    if(/^oui$/i.test(rest[0]||'')) res.before.push({v:v[1],x}); if(/^oui$/i.test(rest[1]||'')) res.after.push({v:v[1],x});
  }
  return res;
}

export function parseRtexStandardFiche(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=rx_lines(doc); const secs=rx_sections(lines); const origin='RSET RT existant (fichier standardisé)';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,field,value,`rset-rtex:${method}`,conf,unit,{building:canonical(b),structuredPdf:true,origin,dedicatedRank:4,...extra}); if(o) out.push(o); };
  const bats=secs.filter(s=>s.kind==='bat').map(s=>({...s,name:rx_buildingName(s)}));
  const surfOf={};
  for(const s of bats){
    const B=s.name; const L=s.lines; const find=re=>L.find(x=>re.test(x.t));
    let x,m;
    if((x=find(/^Surface\s+utile\s+ou\s+habitable\s*\(m2?\)\s*[\d.,]+$/i))){ const v=parseFrNumber(x.t.match(/([\d.,]+)$/)[1]); surfOf[B]=v; emit(x,B,'shab',v,'surface',0.97,'m²'); }
    if((x=find(/^Annee\s+de\s+la\s+construction\s+\d{4}$/i))) emit(x,B,'construction_year',Number(x.t.match(/(\d{4})$/)[1]),'annee',0.96);
    if((x=find(/^Nombre\s+de\s+logements\s+\d+$/i))) emit(x,B,'housing_count',Number(x.t.match(/(\d+)$/)[1]),'logements',0.96);
    // Cep du bloc « Résultats du calcul de la consommation conventionnelle » (pas le bloc label « kWh-ep/m2SHON »).
    if((x=L.find(y=>/^Coefficient\s+Cep\s+(?!kWh)/i.test(y.t)))){ const t=rx_tok(x.t.replace(/^Coefficient\s+Cep\s+/i,''));
      if(Number.isFinite(t[0])) emit(x,B,'cep_before',t[0],'cep-initial',0.97,'kWhEP/m².an',{provenanceNote:'Colonne « Initial (a) » du tableau Cep.'});
      if(Number.isFinite(t[1])){ emit(x,B,'cep_after_final',t[1],'cep-projet',0.97,'kWhEP/m².an',{provenanceNote:'Colonne « Projet (b) » du tableau Cep.'}); emit(x,B,'cep',t[1],'cep-projet',0.92,'kWhEP/m².an'); }
      if(Number.isFinite(t[1])&&Number.isFinite(t[1]-t[0])&&Number.isFinite(t[0])&&t[0]>0) emit(x,B,'cep_gain',Math.round((t[0]-t[1])/t[0]*1000)/10,'cep-gain',0.88,'%',{provenanceNote:'Gain Cep projet / état initial (colonne (b-a)/a).'}); }
    if((x=find(/^Ubat\s*\(hiver\)\s/i))){ const t=rx_tok(x.t.replace(/^Ubat\s*\(hiver\)\s*/i,''));
      if(Number.isFinite(t[0])) emit(x,B,'ubat_before',t[0],'ubat-initial',0.97,'W/m².K',{provenanceNote:'Colonne « Initial (a) » de l’Ubat.'});
      if(Number.isFinite(t[1])) emit(x,B,'ubat_after',t[1],'ubat-projet',0.97,'W/m².K',{provenanceNote:'Colonne « Projet (b) » de l’Ubat.'}); }
    const th=L.findIndex(y=>/Tic\s*\(a\)\s*Tic\s*Ref\s*\(b\)/i.test(y.t));
    if(th>=0) for(const y of L.slice(th+1,th+4)){ if((m=y.t.match(/°C\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+-?\d+[.,]\d+$/))){ emit(y,B,'tic',parseFrNumber(m[1]),'tic',0.96,'°C'); emit(y,B,'tic_ref',parseFrNumber(m[2]),'tic-ref',0.96,'°C'); break; } }
    // Parois : libellé du mur principal (« Mur en beton banche », « Mur en pierre dure »), menuiseries (« Fenetre … PVC Th-U »).
    const op=L.findIndex(y=>/^Parois\s+opaques\s*:/i.test(y.t));
    if(op>=0){ const w=L.slice(op,op+20).find(y=>/^Mur\s+en\s+/i.test(y.t)); if(w){ const s2=w.t.toLowerCase(); const v=/beton\s+banche/.test(s2)?'Béton banché':/beton/.test(s2)?'Béton':/pierre/.test(s2)?'Pierre':/brique/.test(s2)?'Brique':/parpaing|agglo/.test(s2)?'Parpaing':/bois/.test(s2)?'Ossature bois':null; if(v) emit(w,B,'wall_structure',v,'paroi-principale',0.9,'',{provenanceNote:`Libellé de la paroi verticale la plus représentative : ${w.t}.`}); } }
    const fen=L.filter(y=>/^Fenetre\b/i.test(y.t)); const mats={}; for(const y of fen){ const v=/\bPVC\b/i.test(y.t)?'PVC':/\balu/i.test(y.t)?'Aluminium':/\bbois\b/i.test(y.t)?'Bois':null; if(v) mats[v]=(mats[v]||{n:0,y}), mats[v].n++; }
    const best=Object.entries(mats).sort((a,b)=>b[1].n-a[1].n)[0]; if(best) emit(best[1].y,B,'window_material',best[0],'menuiseries',0.92,'',{provenanceNote:`${best[1].n} menuiserie(s) ${best[0]} dans le tableau des parois vitrées.`});
  }
  // Feuillets équipement : rattachement par la surface de la zone.
  for(const s of secs.filter(z=>z.kind==='equip')){
    const L=s.lines; const surf=L.find(x=>/^Surface\s+totale\s+utile\s+de\s+la\s+zone\s*\(m2?\)\s*[\d.,]+$/i.test(x.t)); const sv=surf?parseFrNumber(surf.t.match(/([\d.,]+)$/)[1]):null;
    const bat=bats.find(b=>sv!==null&&Math.abs((surfOf[b.name]||-1)-sv)<0.6)||bats.find(b=>b.id===s.id); if(!bat) continue; const B=bat.name;
    const init=L.find(x=>/^Naturelle\s+par\s+conduit\b|^Ventilation\s+naturelle\b/i.test(x.t));
    const proj=L.find(x=>/^Type\s+de\s+centrale\s+de\s+traitement\s+d.air\s*-\s*\S/i.test(x.t));
    const works=L.find(x=>/travaux\s+de\s+renovation\s+thermique\s+ont-ils\s+porte\s+sur\s+la\s+ventilation\s*\?\s*(oui|non)/i.test(x.t));
    if(proj){ const s2=proj.t.toLowerCase(); const v=/double\s*flux/.test(s2)?'VMC double flux':/hygro\w*\s*b/.test(s2)?'VMC Hygro B':/hygro\w*\s*a/.test(s2)?'VMC Hygro A':/simple\s*flux|extracteur|\(sf\)/.test(s2)?'VMC simple flux':null; if(v) emit(proj,B,'ventilation',v,'ventilation-projet',0.92); }
    else if(init&&works&&/non\s*$/i.test(works.t)) emit(init,B,'ventilation','Ventilation naturelle','ventilation-inchangee',0.9,'',{provenanceNote:'Ventilation naturelle par conduit ; les travaux ne portent pas sur la ventilation.'});
    const chIdx=L.findIndex(x=>/DONNEES\s*SUR\s*LES\s*EQUIPEMENTS\s*DE\s*CHAUFFAGE/i.test(x.t.replace(/\s+/g,' '))||/^2\s*-\s*DONNEESSURLESEQUIPEMENTSDECHAUFFAGE/i.test(x.t));
    const ecsIdx=L.findIndex(x=>/^4\s*-\s*DONNEESSURL.EAUCHAUDESANITAIRE/i.test(x.t)||/DONNEES\s*SUR\s*L.EAU\s*CHAUDE\s*SANITAIRE/i.test(x.t));
    const typeAfter=i=>L.findIndex((x,k)=>k>i&&/^Type\s+d.energie\s*:/i.test(x.t));
    if(chIdx>=0){ const k=typeAfter(chIdx); if(k>=0&&(ecsIdx<0||k<ecsIdx)){ const r=rx_energyTable(L,k); if(r.before.length===1) emit(r.before[0].x,B,'heating_vector_before',r.before[0].v,'chauffage-energie-initial',0.94); if(r.after.length===1) emit(r.after[0].x,B,'heating_vector_after',r.after[0].v,'chauffage-energie-projet',0.94); } }
    if(ecsIdx>=0){ const k=typeAfter(ecsIdx); if(k>=0){ const r=rx_energyTable(L,k); if(r.before.length===1) emit(r.before[0].x,B,'ecs_vector_before',r.before[0].v,'ecs-energie-initial',0.94); if(r.after.length===1) emit(r.after[0].x,B,'ecs_vector_after',r.after[0].v,'ecs-energie-projet',0.94); } }
  }
  // Feuillets génération : état initial et projet.
  for(const s of secs.filter(z=>z.kind==='gen')){
    const bat=bats.find(b=>b.id===s.id); if(!bat) continue; const B=bat.name; const L=s.lines;
    const pIdx=L.findIndex(x=>/PROJET\s*:?\s*NOUVEAUX\s*GENERATEURS|^3\s*-\s*PROJET/i.test(x.t.replace(/\s+/g,'')?x.t:x.t));
    const vec=(part)=>{ const te=part.find(x=>/^Type\s+d.energie\s*-\s*\S/i.test(x.t)), tg=part.find(x=>/^Type\s+de\s+generateur\s*-\s*\S/i.test(x.t)), mode=part.find(x=>/^Mode\s+de\s+production/i.test(x.t));
      const g=tg?.t.replace(/^Type\s+de\s+generateur\s*-\s*/i,'')||''; const e=te?.t.replace(/^Type\s+d.energie\s*-\s*/i,'')||'';
      const v=/reseau\s+de\s+chaleur|chauffage\s+urbain|sous-station/i.test(g)?'Réseau de chaleur urbain':/pompe|pac\b|thermodynamique/i.test(g)?'Électricité':RX_VECT.find(([re])=>re.test(e.toLowerCase()))?.[1]||null;
      return {v,x:tg&&/reseau|pompe|pac/i.test(g)?tg:te,mixte:/mixte|chauffage\s+et\s+(?:fourniture\s+)?ecs|ecs\s+seul/i.test((mode?.t||'').replace(/^Mode\s+de\s+production\s*\([^)]*\)\s*-?\s*/i,'')),g}; };
    const init=vec(pIdx>=0?L.slice(0,pIdx):L), proj=pIdx>=0?vec(L.slice(pIdx)):{v:null};
    if(init.v) emit(init.x,B,'heating_vector_before',init.v,'generation-initiale',0.93);
    if(proj.v) emit(proj.x,B,'heating_vector_after',proj.v,'generation-projet',0.9,'',{provenanceNote:`Nouveau générateur du projet${proj.g?` (${proj.g})`:''}.`});
    if(init.v&&init.mixte) emit(init.x,B,'ecs_vector_before',init.v,'generation-initiale-ecs',0.88);
    if(proj.v&&proj.mixte) emit(proj.x,B,'ecs_vector_after',proj.v,'generation-projet-ecs',0.86);
  }
  // Données administratives (maître d'ouvrage, logiciel).
  const moa=lines.findIndex(x=>/^MAITRE\s+D.OUVRAGE$/i.test(x.t)); if(moa>=0){ const n=lines[moa+1]; const m=n?.t.match(/^Nom\s+ou\s+raison\s+sociale\s*:\s*(.+)$/i); if(m&&m[1].trim()) emit(n,'Bâtiment unique','owner_company',m[1].replace(/\s*\(\d{5}\)\s*-\s*\d+\s*$/,'').trim(),'maitre-ouvrage',0.9,'',{secondarySourceOk:true}); }
  return out;
}
