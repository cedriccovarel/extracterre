// ExtracTerre v2.3 — lecture structurée des XML RE2020 (RSET + RSEnv + Datas_Comp).
// Les valeurs sont lues directement dans les balises normalisées du schéma RE2020 :
// aucune expression régulière sur du texte linéarisé, aucun décalage de colonne possible.
import {canonicalBuilding} from './buildings.js';

// ---------------------------------------------------------------------------
// Parseur XML minimal (secours hors navigateur / tests Node). Dans le navigateur,
// DOMParser est utilisé ; les deux exposent la même mini-API : tagName, children,
// textContent, getAttribute().
// ---------------------------------------------------------------------------
const RE20_ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
function re20Decode(s){
  if(!s||s.indexOf('&')<0) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>{
    if(e[0]==='#') return String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):parseInt(e.slice(1),10));
    return RE20_ENTITIES[e]??m;
  });
}
class Re20Node{
  constructor(tagName,attributes){ this.tagName=tagName; this.attributes=attributes||{}; this.children=[]; this._text=''; }
  getAttribute(n){ return Object.prototype.hasOwnProperty.call(this.attributes,n)?this.attributes[n]:null; }
  get textContent(){ return this.children.length?this._text+this.children.map(c=>c.textContent).join(''):this._text; }
}
export function parseXmlLite(source){
  const text=String(source||'').replace(/^\uFEFF/,'');
  const root=new Re20Node('#document'); const stack=[root];
  const tagRe=/<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s>\/]+)((?:\s+[^\s=>\/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const attrRe=/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let last=0, m;
  while((m=tagRe.exec(text))){
    const between=text.slice(last,m.index); last=tagRe.lastIndex;
    const cur=stack[stack.length-1];
    if(between&&cur!==root&&!cur.children.length) cur._text+=re20Decode(between);
    if(m[1]!==undefined){ cur._text+=m[1]; continue; }
    if(m[2]){ if(stack.length>1) stack.pop(); continue; }
    if(m[3]){
      const attrs={}; let a; attrRe.lastIndex=0; const raw=m[4]||'';
      while((a=attrRe.exec(raw))) attrs[a[1]]=re20Decode(a[2]??a[3]??'');
      const node=new Re20Node(m[3],attrs); cur.children.push(node);
      if(!m[5]) stack.push(node);
    }
  }
  const documentElement=root.children[0]||null;
  return {documentElement,querySelector:()=>null};
}
export function parseXmlDocument(source){
  if(typeof globalThis.DOMParser==='function'){
    const xml=new globalThis.DOMParser().parseFromString(String(source||''),'application/xml');
    if(xml.querySelector('parsererror')) throw new Error('XML illisible ou invalide.');
    return xml;
  }
  const lite=parseXmlLite(source); if(!lite.documentElement) throw new Error('XML illisible ou invalide.');
  return lite;
}

// ---------------------------------------------------------------------------
// Petits accesseurs indépendants de l'implémentation DOM.
// ---------------------------------------------------------------------------
function re20Kids(el){ return el?Array.from(el.children||[]):[]; }
function re20Child(el,name){ if(!el) return null; for(const c of re20Kids(el)) if(c.tagName===name) return c; return null; }
function re20All(el,name){ return re20Kids(el).filter(c=>c.tagName===name); }
function re20Path(el,path){ let cur=el; for(const p of path.split('/')){ cur=re20Child(cur,p); if(!cur) return null; } return cur; }
function re20Text(el){ return el?String(el.textContent||'').replace(/\s+/g,' ').trim():''; }
function re20Num(el){ const t=re20Text(el); if(!t||/^nan$/i.test(t)) return null; const v=Number(t.replace(',','.')); return Number.isFinite(v)?v:null; }
function re20PathNum(el,path){ return re20Num(re20Path(el,path)); }
function re20PathText(el,path){ return re20Text(re20Path(el,path)); }
function re20ByIndex(list,key='Index'){ const m=new Map(); for(const el of list){ const i=re20PathNum(el,key); if(i!==null) m.set(i,el); } return m; }
function re20Round(v,d=2){ if(v==null||!Number.isFinite(v)) return null; const f=10**d; return Math.round(v*f)/f; }
function re20Sum(list){ let s=0,n=0; for(const v of list) if(Number.isFinite(v)){ s+=v; n++; } return n?s:null; }

export function isRe2020XmlDocument(xml){
  const root=xml?.documentElement; if(!root||root.tagName!=='projet') return false;
  return !!(re20Child(root,'RSET')||re20Child(root,'RSEnv'));
}

// Ordre normatif des sous-contributeurs énergie RE2020 (vérifié sur Cef × facteurs).
export const RE2020_ENERGY_SUBCONTRIBUTORS=Object.freeze({1:'ic_energy_heating',2:'ic_energy_ecs',3:'ic_energy_cooling',4:null,5:'ic_energy_aux_vent',6:'ic_energy_aux_dist',7:'ic_energy_mobility'});
const RE20_VECTOR_LABELS=Object.freeze({gaz:'Gaz',elec:'Électricité',bois:'Bois / biomasse',reseau:'Réseau de chaleur urbain',fioul:'Fioul'});
const RE20_EP_FACTOR=Object.freeze({gaz:1,elec:2.3,bois:1,reseau:1,fioul:1});

function re20DynamicSum(el){ const d=re20Child(el,'indicateur_co2_dynamique'); if(!d) return null; return re20Sum(re20All(d,'valeur_phase_acv').map(re20Num)); }

// Parois opaques Datas_Comp : 1xx murs, 2xx planchers bas, 3xx toitures, 4xx parois sur local non chauffé.
function re20EnvelopeTarget(code){
  const n=Number(code); if(!Number.isFinite(n)) return null;
  if([105,106,405].includes(n)) return null; // coffres, portes
  if(n>=100&&n<200) return 'wall'; if(n>=200&&n<300) return 'floor'; if(n>=300&&n<400) return 'roof'; if(n>=400&&n<405) return 'wall_lnc';
  return null;
}
function re20Envelope(bat){
  const env=re20Child(bat,'enveloppe'); if(!env) return null;
  const best={};
  for(const p of re20All(env,'parois_opaques')){
    const target=re20EnvelopeTarget(re20PathText(p,'nature')); if(!target) continue;
    const surface=re20PathNum(p,'surface_totale')||0;
    const item={target,name:re20PathText(p,'name'),surface,u:re20PathNum(p,'U_paroi'),rTotal:re20PathNum(p,'resistance_thermique_isolant'),nature:re20PathText(p,'nature')};
    if(!best[target]||surface>best[target].surface) best[target]=item;
  }
  if(!best.wall&&best.wall_lnc) best.wall=best.wall_lnc;
  delete best.wall_lnc;
  const glazing=new Map(); let windowName='', windowSurface=0;
  for(const p of re20All(env,'parois_vitrees')){
    const s=re20PathNum(p,'surface_totale')||0, t=re20PathText(p,'type_vitrage');
    if(t) glazing.set(t,(glazing.get(t)||0)+s);
    if(s>windowSurface){ windowSurface=s; windowName=re20PathText(p,'name'); }
  }
  const glazingType=[...glazing.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  return {...best,glazingType,windowName};
}

function re20BuildingName(rawNames,index,count){
  const cleaned=rawNames.map(n=>String(n||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  const pick=cleaned.find(n=>/[àâäéèêëîïôöùûüç]/i.test(n))||cleaned[0]||'';
  const generic=!pick||/^b[aâ]t(?:iment)?\.?$/i.test(pick);
  if(count===1&&generic) return 'Bâtiment unique';
  if(generic) return canonicalBuilding(`Bâtiment ${index}`);
  return canonicalBuilding(pick);
}

// Extraction complète → objet JSON compact, conservé dans read.re2020 (persisté).
export function extractRe2020(xml){
  const root=xml?.documentElement; if(!isRe2020XmlDocument(xml)) return null;
  const dc=re20Child(root,'Datas_Comp'), rset=re20Child(root,'RSET'), rsenv=re20Child(root,'RSEnv');
  const gen=re20Path(dc,'donnees_generales');
  const soft=re20Path(gen,'logiciel');
  const op=re20Path(gen,'operation');
  const sortie=re20Path(rset,'Sortie_Projet'), entree=re20Path(rset,'Entree_Projet');
  const general={
    schemaVersion:root.getAttribute?.('version')||'',
    software:soft?{editor:re20PathText(soft,'editeur'),name:re20PathText(soft,'nom'),version:re20PathText(soft,'version'),studyDate:re20PathText(soft,'date_etude')}:null,
    operation:re20PathText(op,'nom'),
    permit:re20PathText(op,'num_permis'),
    address:re20PathText(op,'adresse/label'), postcode:re20PathText(op,'adresse/postcode'), city:re20PathText(op,'adresse/city'),
    climateZone:re20PathText(op,'zone_climatique'),
    owner:re20PathText(gen,'maitre_ouvrage/nom'),
    department:re20PathText(sortie,'Departement')||String(re20PathText(op,'adresse/postcode')).slice(0,2),
    hasRset:!!rset, hasRsenv:!!rsenv
  };
  const bIn=re20ByIndex(re20All(re20Path(entree,'Batiment_Collection'),'Batiment'));
  const bB=re20ByIndex(re20All(re20Path(sortie,'Sortie_Batiment_B_Collection'),'Sortie_Batiment_B'));
  const bC=re20ByIndex(re20All(re20Path(sortie,'Sortie_Batiment_C_Collection'),'Sortie_Batiment_C'));
  const bD=re20ByIndex(re20All(re20Path(sortie,'Sortie_Batiment_D_Collection'),'Sortie_Batiment_D'));
  const envIn=re20ByIndex(re20All(re20Path(rsenv,'entree_projet'),'batiment'),'index');
  const envOut=re20ByIndex(re20All(re20Path(rsenv,'sortie_projet'),'batiment'),'index');
  const dcBat=re20ByIndex(re20All(re20Path(dc,'batiment_collection'),'batiment'));
  const indexes=[...new Set([...bIn.keys(),...bC.keys(),...envOut.keys(),...dcBat.keys()])].sort((a,b)=>a-b);
  const buildings=[];
  for(const index of indexes){
    const ein=bIn.get(index), sB=bB.get(index), sC=bC.get(index), sD=bD.get(index), rin=envIn.get(index), rout=envOut.get(index), d=dcBat.get(index);
    const name=re20BuildingName([re20PathText(rin,'nom'),re20PathText(ein,'Name'),re20PathText(sC,'Name')],index,indexes.length);
    const b={index,name,rawName:re20PathText(ein,'Name')||re20PathText(rin,'nom')||''};
    // --- Programme / surfaces
    const zones=re20All(re20Path(ein,'Zone_Collection'),'Zone');
    b.housing=re20Sum(zones.map(z=>re20PathNum(z,'NB_logement')));
    if(b.housing===null) b.housing=re20Sum(re20All(rin,'zone').map(z=>re20PathNum(z,'nb_logement')));
    const groups=zones.flatMap(z=>re20All(re20Path(z,'Groupe_Collection'),'Groupe'));
    b.shab=re20Sum(groups.map(g=>re20PathNum(g,'SHAB')));
    if(!b.shab) b.shab=re20Sum(re20All(re20Path(sC,'Sortie_Zone_C_Collection'),'Sortie_Zone_C').map(z=>re20PathNum(z,'O_SHAB')));
    b.sref=re20PathNum(sC,'O_SREF')??re20PathNum(rin,'sref')??re20PathNum(d,'O_SREF');
    const trav=zones.map(z=>({t:re20PathNum(z,'Is_Traversant'),n:re20PathNum(z,'NB_logement')||0}));
    b.crossVentilated=trav.some(z=>z.t===1); b.nonCrossVentilated=trav.some(z=>z.t===0);
    b.anyCooled=groups.some(g=>re20PathNum(g,'Is_Climatise')===1); b.groupsKnown=groups.length>0;
    // --- Bbio / Cep / Cepnr
    b.bbio=re20PathNum(sB,'O_Bbio_pts_annuel'); b.bbioMax=re20PathNum(sB,'O_Bbio_Max');
    b.cep=re20PathNum(sC,'O_Cep_annuel'); b.cepMax=re20PathNum(sC,'O_Cep_Max');
    b.cepnr=re20PathNum(sC,'O_Cep_nr_annuel'); b.cepnrMax=re20PathNum(sC,'O_Cep_nr_Max');
    // --- Consommations finales importées par vecteur et par usage
    const vec={}; for(const v of ['gaz','fioul','bois','elec','reseau']) vec[v]=re20PathNum(sC,`O_Cef_${v}_imp_annuel`);
    const use={};
    for(const v of ['gaz','fioul','bois','elec','reseau']) for(const u of ['ch','fr','ecs']) use[`${v}_${u}`]=re20PathNum(sC,`O_Cef_${v}_imp_${u}_annuel`);
    for(const u of ['ecl','auxvent','auxdist','deplacement']) use[`elec_${u}`]=re20PathNum(sC,`O_Cef_elec_imp_${u}_annuel`);
    b.cef={vectors:vec,uses:use};
    // --- DH : groupe le plus défavorable, DHmax lu sur le même groupe.
    let worst=null;
    for(const z of re20All(re20Path(sD,'Sortie_Zone_D_Collection'),'Sortie_Zone_D')) for(const g of re20All(re20Path(z,'Sortie_Groupe_D_Collection'),'Sortie_Groupe_D')){
      const dh=re20PathNum(g,'O_NbDegresHeures'); if(dh===null) continue;
      if(!worst||dh>worst.dh) worst={dh,dhMax:re20PathNum(g,'O_NbDegresHeures_max'),group:re20PathText(g,'Name')};
    }
    b.dh=worst?.dh??null; b.dhMax=worst?.dhMax??null; b.dhGroup=worst?.group||'';
    // --- ACV (RSEnv sortie bâtiment)
    if(rout){
      const perf=re20Child(rout,'indicateur_perf_env');
      b.icConstruction=re20PathNum(perf,'ic_construction'); b.icConstructionMax=re20PathNum(perf,'ic_construction_max');
      b.icEnergy=re20PathNum(perf,'ic_energie'); b.icEnergyMax=re20PathNum(perf,'ic_energie_max');
      b.icComponents=re20PathNum(perf,'ic_composant'); b.icSite=re20PathNum(perf,'ic_chantier');
      b.icBuilding=re20PathNum(perf,'ic_batiment'); b.icWater=re20PathNum(perf,'ic_eau');
      b.stockC=re20PathNum(perf,'stock_c_batiment');
      const comp=re20Path(rout,'contributeur/composant');
      b.lots={}; for(const lot of re20All(comp,'lot')){ const ref=Number(lot.getAttribute('ref')); const v=re20PathNum(lot,'ic'); if(ref>=1&&ref<=13&&v!==null) b.lots[ref]=v; }
      b.energy={}; for(const sc of re20All(re20Path(rout,'contributeur/energie'),'sous_contributeur')){ const ref=Number(sc.getAttribute('ref')); const v=re20DynamicSum(sc); if(Number.isFinite(ref)&&v!==null) b.energy[ref]=re20Round(v,3); }
    }
    b.envelope=re20Envelope(d);
    buildings.push(b);
  }
  return {format:'RE2020-XML',general,buildings};
}

// Texte de synthèse lisible (recherche libre, tags, surlignage) : une page par bâtiment.
export function re2020SummaryPages(data){
  if(!data) return [];
  const g=data.general||{}; const fmt=v=>v==null?'—':String(v);
  const head=[`RSEE RE2020 — Récapitulatif standardisé d'étude énergétique et environnementale (XML)`,
    `Opération : ${fmt(g.operation)}`,`Maître d'ouvrage : ${fmt(g.owner)}`,`Adresse : ${fmt(g.address)} ${fmt(g.postcode)} ${fmt(g.city)}`,
    `Département : ${fmt(g.department)}`,`Zone climatique : ${fmt(g.climateZone)}`,
    g.software?`Logiciel : ${g.software.editor} ${g.software.name} ${g.software.version}`:'',`Nombre de bâtiments : ${data.buildings.length}`].filter(Boolean);
  const pages=[{page:1,text:head.join('\n'),lines:head.map((text,index)=>({index,text}))}];
  data.buildings.forEach((b,i)=>{
    const L=[`Bâtiment ${b.index} : ${b.name}`,`Nombre de logements : ${fmt(b.housing)}`,`SHAB : ${fmt(b.shab)} m²`,`Sref : ${fmt(b.sref)} m²`,
      `Bbio : ${fmt(b.bbio)} / Bbio max : ${fmt(b.bbioMax)}`,`Cep : ${fmt(b.cep)} / Cep max : ${fmt(b.cepMax)} kWhEP/m².an`,`Cep,nr : ${fmt(b.cepnr)} / Cep,nr max : ${fmt(b.cepnrMax)} kWhEP/m².an`,
      `DH : ${fmt(b.dh)} / DH max : ${fmt(b.dhMax)} °C.h`,
      `Ic construction : ${fmt(b.icConstruction)} / max ${fmt(b.icConstructionMax)} kgCO2e/m²`,`Ic composants : ${fmt(b.icComponents)} kgCO2e/m²`,`Ic chantier : ${fmt(b.icSite)} kgCO2e/m²`,
      `Ic énergie : ${fmt(b.icEnergy)} / max ${fmt(b.icEnergyMax)} kgCO2e/m²`,`Stock C : ${fmt(b.stockC)} kgC/m²`,
      ...Object.entries(b.lots||{}).map(([k,v])=>`Ic composants lot ${k} : ${re20Round(v,3)} kgCO2e/m²`),
      b.envelope?.wall?`Mur : ${b.envelope.wall.name}`:'',b.envelope?.floor?`Plancher bas : ${b.envelope.floor.name}`:'',b.envelope?.roof?`Toiture : ${b.envelope.roof.name}`:'',
      b.envelope?.glazingType?`Vitrage : ${b.envelope.glazingType}`:'',b.envelope?.windowName?`Menuiserie : ${b.envelope.windowName}`:''].filter(Boolean);
    pages.push({page:i+2,text:L.join('\n'),lines:L.map((text,index)=>({index,text})),re2020Building:b.index});
  });
  return pages;
}

// Occurrences ExtracTerre à partir de l'objet extrait. `makeOcc` est fourni par parsers.js
// pour rester strictement compatible avec la traçabilité existante (page, extrait, méthode).
export function re2020Occurrences(doc,makeOcc){
  const data=doc?.read?.re2020; if(!data) return [];
  const out=[]; const g=data.general||{};
  const pages=doc.read.pages||[];
  const pageFor=b=>pages.find(p=>p.re2020Building===b.index)||pages[0]||{page:1,lines:[]};
  const lineFor=(page,re)=>(page.lines||[]).find(l=>re.test(l.text))||(page.lines||[])[0]||{index:0,text:''};
  const soft=g.software?`${g.software.editor} ${g.software.name}`.trim():'logiciel non renseigné';
  const add=(b,field,value,tag,unit,re,extra={})=>{
    if(value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value))) return;
    const page=b?pageFor(b):(pages[0]||{page:1,lines:[]}); const line=lineFor(page,re||/./);
    out.push(makeOcc(doc,page,line,field,value,`xml:re2020:${tag}`,extra.confidence??0.999,unit||'',{
      building:b?b.name:'Bâtiment unique',structuredXml:true,
      origin:extra.origin||`XML RE2020 — ${tag.split('-')[0].toUpperCase()}`,
      excerpt:extra.excerpt||`${line.text||''}`.slice(0,420),
      provenanceNote:extra.note||`Valeur lue directement dans la balise normalisée du XML RE2020 (${soft}).`,
      ...(extra.derived?{derivedFromDocument:true}:{})
    }));
  };
  const multi=data.buildings.length>1;
  // Données d'opération : valeurs projet (non spécifiques à un bâtiment).
  add(null,'operation',g.operation,'general-operation','',/Opération/);
  add(null,'project',g.operation,'general-operation','',/Opération/);
  add(null,'department',g.department,'general-department','',/Département/);
  add(null,'owner_company',g.owner,'general-owner','',/Maître/);
  for(const b of data.buildings){
    add(b,'building',b.name,'rset-building','',/^Bâtiment/);
    add(b,'housing_count',b.housing,'rset-housing','',/logements/);
    add(b,'shab',b.shab??b.sref,'rset-surface','m²',/SHAB/,{note:b.shab?'Somme des SHAB des groupes du bâtiment (Entree_Projet).':'Sref du bâtiment (SHAB non renseignée).'});
    add(b,'bbio',b.bbio,'rset-bbio','points',/Bbio/);
    add(b,'bbio_max',b.bbioMax,'rset-bbio','points',/Bbio/);
    add(b,'cep',b.cep,'rset-cep','kWhEP/m².an',/^Cep :/);
    add(b,'cep_max',b.cepMax,'rset-cep','kWhEP/m².an',/^Cep :/);
    add(b,'cepnr',b.cepnr,'rset-cepnr','kWhEP/m².an',/Cep,nr/);
    add(b,'cepnr_max',b.cepnrMax,'rset-cepnr','kWhEP/m².an',/Cep,nr/);
    const gain=(v,max)=>v!=null&&max?re20Round((max-v)/max*100,1):null;
    add(b,'bbio_gain',gain(b.bbio,b.bbioMax),'rset-gain-calc','%',/Bbio/,{confidence:0.995,derived:true,note:'Gain = (Bbio max − Bbio) / Bbio max, calculé à partir des deux valeurs du XML.'});
    add(b,'cep_gain',gain(b.cep,b.cepMax),'rset-gain-calc','%',/^Cep :/,{confidence:0.995,derived:true,note:'Gain = (Cep max − Cep) / Cep max, calculé à partir des deux valeurs du XML.'});
    add(b,'cepnr_gain',gain(b.cepnr,b.cepnrMax),'rset-gain-calc','%',/Cep,nr/,{confidence:0.995,derived:true,note:'Gain = (Cep,nr max − Cep,nr) / Cep,nr max, calculé à partir des deux valeurs du XML.'});
    add(b,'dh',b.dh,'rset-dh','°C.h',/^DH/,{note:`DH du groupe le plus défavorable (${b.dhGroup||'groupe'}) lu dans Sortie_Groupe_D.`});
    add(b,'dh_max',b.dhMax,'rset-dh','°C.h',/^DH/,{note:`DH max lu sur le même groupe que le DH retenu (${b.dhGroup||'groupe'}).`});
    if(b.crossVentilated) add(b,'cross_ventilated','Oui','rset-traversant','',/^Bâtiment/);
    if(b.nonCrossVentilated) add(b,'non_cross_ventilated','Oui','rset-traversant','',/^Bâtiment/);
    if(b.groupsKnown&&!b.anyCooled) add(b,'cooling','Aucun','rset-climatisation','',/^Bâtiment/,{confidence:0.95,note:'Aucun groupe déclaré climatisé (Is_Climatise = 0) dans le XML.'});
    // Cep par poste / par vecteur : Cef importée × coefficient RE2020 (élec 2,3 ; autres 1), contrôlé vs O_Cep_annuel.
    const u=b.cef?.uses||{}, v=b.cef?.vectors||{};
    const ep=(vecKey,val)=>val==null?null:val*RE20_EP_FACTOR[vecKey];
    const usage=k=>re20Sum(['gaz','fioul','bois','elec','reseau'].map(x=>ep(x,u[`${x}_${k}`])));
    const cepCheck=re20Sum(Object.entries(v).map(([k,val])=>ep(k,val)));
    const consistent=cepCheck!=null&&b.cep!=null&&Math.abs(cepCheck-b.cep)<=Math.max(1,b.cep*0.03);
    const calcNote=`Cef importée × coefficient d'énergie primaire RE2020 (électricité 2,3 ; autres vecteurs 1). Contrôle : Σ vecteurs = ${re20Round(cepCheck,1)} pour Cep = ${b.cep}.`;
    if(consistent){
      const d={confidence:0.97,derived:true,note:calcNote};
      add(b,'cep_cooling',re20Round(usage('fr'),2),'rset-cep-poste-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_lighting',re20Round(ep('elec',u.elec_ecl),2),'rset-cep-poste-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_aux_vent',re20Round(ep('elec',u.elec_auxvent),2),'rset-cep-poste-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_aux_dist',re20Round(ep('elec',u.elec_auxdist),2),'rset-cep-poste-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_mobility',re20Round(ep('elec',u.elec_deplacement),2),'rset-cep-poste-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_electricity',re20Round(ep('elec',v.elec),2),'rset-cep-vecteur-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_gas',re20Round(ep('gaz',v.gaz),2),'rset-cep-vecteur-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_district',re20Round(ep('reseau',v.reseau),2),'rset-cep-vecteur-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_biomass',re20Round(ep('bois',v.bois),2),'rset-cep-vecteur-calc','kWhEP/m².an',/^Cep :/,d);
    }
    // Vecteurs principaux : vecteur dont la Cef importée est la plus forte pour l'usage.
    const dominant=k=>{ const rows=['gaz','fioul','bois','elec','reseau'].map(x=>[x,u[`${x}_${k}`]||0]).filter(r=>r[1]>0).sort((a,b2)=>b2[1]-a[1]); if(!rows.length) return null; const total=rows.reduce((s,r)=>s+r[1],0); return rows[0][1]/total>=0.6?RE20_VECTOR_LABELS[rows[0][0]]:'Hybride'; };
    const vecNote=k=>`Vecteur majoritaire des consommations finales importées (${k}) dans Sortie_Batiment_C.`;
    add(b,'heating_vector_after',dominant('ch'),'rset-vecteur-calc','',/^Bâtiment/,{confidence:0.95,derived:true,note:vecNote('chauffage')});
    add(b,'ecs_vector_after',dominant('ecs'),'rset-vecteur-calc','',/^Bâtiment/,{confidence:0.95,derived:true,note:vecNote('ECS')});
    // ACV
    add(b,'ic_components',b.icComponents,'rsenv-ic','kgCO2e/m²',/Ic composants :/);
    add(b,'ic_site',b.icSite,'rsenv-ic','kgCO2e/m²',/Ic chantier/);
    add(b,'ic_energy',b.icEnergy,'rsenv-ic','kgCO2e/m²',/Ic énergie/);
    add(b,'stock_c_per_m2',b.stockC,'rsenv-stock-c','kgC/m²',/Stock C/,{note:'Balise stock_c_batiment (stockage carbone du bâtiment rapporté au m²).'});
    for(const [ref,val] of Object.entries(b.lots||{})) add(b,`ic_lot_${ref}`,re20Round(val,3),'rsenv-lot','kgCO2e/m²',new RegExp(`lot ${ref} :`),{note:`Balise contributeur/composant/lot[ref=${ref}]/ic.`});
    for(const [ref,val] of Object.entries(b.energy||{})){ const f=RE2020_ENERGY_SUBCONTRIBUTORS[ref]; if(f) add(b,f,re20Round(val,2),'rsenv-energie','kgCO2e/m²',/Ic énergie/,{confidence:0.99,derived:true,note:`Somme des phases du sous-contributeur énergie ${ref} (indicateur CO2 dynamique).`}); }
  }
  void multi;
  return out;
}

// Lignes synthétiques d'enveloppe, analysées ensuite par le parseur enveloppe existant
// (matériaux, isolants, épaisseurs, R explicites, bibliothèque isolants).
export function re2020EnvelopeLines(data){
  const out=[];
  for(const b of data?.buildings||[]){
    const e=b.envelope; if(!e) continue;
    const label={wall:'Mur extérieur isolation',floor:'Plancher bas isolation',roof:'Toiture isolation'};
    for(const t of ['wall','floor','roof']) if(e[t]?.name) out.push({building:b.name,index:b.index,text:`${label[t]} : ${e[t].name}`});
    if(e.windowName||e.glazingType) out.push({building:b.name,index:b.index,text:`Menuiserie fenêtre : ${e.windowName||''} — vitrage ${e.glazingType||''}`});
  }
  return out;
}
