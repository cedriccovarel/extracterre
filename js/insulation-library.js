/*
 * Bibliothèque isolants Prestaterre Extract v1.0.4
 * 173 variantes produit / épaisseur / R, dont 150 variantes cœur dans les familles demandées, issues de certificats fabricants/ACERMI.
 * Les performances de cette bibliothèque ne sont utilisées qu'en secours lorsque
 * le produit ET une épaisseur compatible sont identifiés dans le document.
 */

function libNorm(s=''){
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
}
function compact(s=''){ return libNorm(s).replace(/\s+/g,''); }
function levenshtein(a,b){
  a=String(a); b=String(b); const row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){ let prev=row[0]; row[0]=i; for(let j=1;j<=b.length;j++){ const old=row[j]; row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1)); prev=old; } }
  return row[b.length];
}
function approxContains(textCompact,aliasCompact){
  if(!aliasCompact||aliasCompact.length<5) return false;
  if(textCompact.includes(aliasCompact)) return true;
  const maxDist=aliasCompact.length>=11?2:1;
  for(let len=Math.max(4,aliasCompact.length-maxDist);len<=aliasCompact.length+maxDist;len++){
    for(let i=0;i+len<=textCompact.length;i++) if(levenshtein(textCompact.slice(i,i+len),aliasCompact)<=maxDist) return true;
  }
  return false;
}

const family=(brand,product,material,lambda,applications,aliases,variants,source)=>({brand,product,material,lambda,applications,aliases,variants:variants.map(([thickness,r])=>({thickness,r})),source});

export const INSULATION_LIBRARY_VERSION='2026-09-07';
export const INSULATION_FAMILIES=[
  family('Isover','GR 32 revêtu kraft','Laine de verre',0.032,['wall','roof'],['isover gr 32','gr 32 kraft','gr32 kraft','gr 32','gr32'],[[45,1.40],[60,1.85],[75,2.35],[85,2.65],[100,3.15],[120,3.75],[140,4.35],[160,5.00],[180,5.60]],'ACERMI / Isover GR 32'),
  family('Isover','GR 32 roulé','Laine de verre',0.032,['wall','roof'],['gr 32 roule','gr32 roule','gr 32 roule kraft','gr32 roule kraft'],[[60,1.85],[75,2.35],[85,2.65],[100,3.15],[120,3.75],[140,4.35],[160,5.00]],'ACERMI / Isover GR 32'),
  family('Isover','Isoconfort 32','Laine de verre',0.032,['wall','roof'],['isover isoconfort 32','isoconfort 32','isoconfort32','isomob 32r'],[[60,1.85],[80,2.50],[100,3.10],[120,3.75],[130,4.05],[140,4.35],[150,4.65],[160,5.00]],'ACERMI 08/018/540/19 et 05/018/384/16'),
  family('Isover','Isoconfort 35 Kraft','Laine de verre',0.035,['roof'],['isover isoconfort 35','isoconfort 35 kraft','isoconfort35 kraft','isoconfort 35'],[[160,4.55],[180,5.10],[200,5.70],[220,6.25],[240,6.85],[260,7.40],[280,8.00],[300,8.55]],'ACERMI / Isover Isoconfort 35'),
  family('URSA','Hometec 32','Laine de verre',0.032,['wall','roof','floor'],['ursa hometec 32','hometec 32','e hometec 32','f hometec 32','hometec32','ursa facade 32p','thermocoustic 32'],[[60,1.85],[80,2.50],[101,3.15],[120,3.75],[140,4.35],[160,5.00],[200,6.25]],'ACERMI 03/058/169/22 et 02/020/036/22'),
  family('Isover','GR 30','Laine de verre',0.030,['wall'],['isover gr 30','gr 30 kraft','gr30 kraft','gr 30','gr30'],[[90,3.00],[111,3.70],[130,4.30],[150,5.00]],'ACERMI / Isover GR 30'),

  family('Isonat','Flex 55','Fibre de bois',0.036,['wall','roof','floor'],['isonat flex 55','flex 55 plus h','flex55 plus h','isonat flex55','flex 55','flex55'],[[40,1.10],[45,1.25],[50,1.35],[60,1.65],[70,1.90],[80,2.20],[100,2.75],[120,3.30],[130,3.60],[140,3.85],[145,4.00],[160,4.40],[180,5.00],[200,5.55],[220,6.10],[240,6.65]],'ACERMI 15/018/984/11'),
  family('STEICO','STEICOflex 036','Fibre de bois',0.036,['wall','roof','floor'],['steicoflex 036','steico flex 036','steicoflex036','steicoflex','steico flex'],[[40,1.10],[50,1.35],[60,1.65],[80,2.20],[100,2.75],[120,3.30],[140,3.85],[145,4.00],[160,4.40],[180,5.00],[200,5.55],[220,6.10],[240,6.65]],'ACERMI / STEICOflex 036'),
  family('PAVATEX / SOPREMA','PAVAFLEX CONFORT','Fibre de bois',0.038,['wall','roof','floor'],['pavaflex confort','pavaflex comfort','pavaflex','pavatex pavaflex'],[[40,1.05],[45,1.15],[50,1.30],[60,1.55],[80,2.10],[100,2.60],[120,3.15],[140,3.65],[145,3.80],[160,4.20],[180,4.70],[200,5.25],[220,5.75],[240,6.30]],'ACERMI 17/006/1259/10'),

  family('Biofib','Biofib Trio','Biosourcé chanvre/lin/coton',0.038,['wall','roof','floor'],['biofib trio','biofib\'trio','bio fib trio','trio biofib'],[[45,1.15],[60,1.55],[80,2.10],[100,2.60],[120,3.15],[145,3.80],[160,4.20],[180,4.70],[200,5.25],[220,5.75]],'ACERMI 14/130/962/11'),
  family('Biofib','Biofib Chanvre','Chanvre',0.040,['wall','roof'],['biofib chanvre','biofib\'chanvre','bio fib chanvre','chanvre biofib'],[[80,2.00],[100,2.50],[120,3.00],[140,3.50],[160,4.00],[200,5.00]],'ACERMI / Biofib Chanvre'),
  family('Le Relais Métisse','Métisse RT / Coton Pro P/R','Coton recyclé',0.039,['wall','roof','floor'],['metisse rt','métisse rt','coton pro p r','coton pro pr','metisse coton pro','métisse coton pro'],[[45,1.15],[50,1.25],[60,1.50],[80,2.05],[100,2.55],[120,3.05],[145,3.70],[160,4.10],[180,4.60],[200,5.10]],'ACERMI 14/179/918/9'),

  family('Knauf','XTherm ITEx Sun+','PSE graphité',0.031,['wall'],['knauf xtherm itex sun','xtherm itex sun','xtherm sun','xtherm itex'],[[70,2.25],[80,2.55],[90,2.90],[100,3.20],[110,3.50],[120,3.85],[140,4.50]],'ACERMI 07/007/494/23'),
  family('Knauf','NEXTherm ITEx','PSE graphité',0.031,['wall'],['knauf nextherm itex','nextherm itex','next therm itex','nextherm'],[[60,1.90],[80,2.55],[100,3.20],[120,3.85],[140,4.50],[160,5.15],[200,6.45]],'ACERMI 20/007/1506/5'),
  family('Knauf','Therm Chape Th 38','PSE',0.038,['floor'],['knauf therm chape th 38','therm chape th38','therm chape th 38','knauf th38'],[[20,0.50],[25,0.65],[30,0.75],[35,0.90],[40,1.05],[45,1.15],[50,1.30],[55,1.40],[60,1.55],[65,1.70],[70,1.80],[75,1.95],[80,2.10],[85,2.20],[90,2.35],[95,2.50],[100,2.60],[105,2.75],[110,2.85],[115,3.00],[120,3.15],[125,3.25],[130,3.40],[140,3.65]],'ACERMI 03/007/172/16'),

  family('SOPREMA','TMS','PUR',0.022,['wall','roof','floor'],['soprema tms','tms mf si','tms gf si','tms isolant','tms'],[[25,1.00],[30,1.30],[40,1.85],[48,2.20],[52,2.40],[56,2.60],[61,2.80],[68,3.15],[75,3.45],[80,3.70],[87,4.00],[100,4.65],[110,5.10],[120,5.55],[130,6.00],[140,6.50],[160,7.40]],'ACERMI 08/006/481/32'),
  family('Unilin','Utherm Floor K','PUR/PIR',0.022,['floor'],['utherm floor k','floor pir k','floor k fra','unilin floor k','utherm floor'],[[40,1.85],[56,2.60],[80,3.70],[100,4.65],[120,5.55],[160,7.40]],'ACERMI 11/121/684/29')
];

export const INSULATION_PRODUCT_VARIANTS=INSULATION_FAMILIES.flatMap(f=>f.variants.map(v=>({brand:f.brand,product:f.product,material:f.material,lambda:f.lambda,applications:f.applications,source:f.source,...v})));
export const INSULATION_LIBRARY_VARIANT_COUNT=INSULATION_PRODUCT_VARIANTS.length;
export const CORE_INSULATION_VARIANT_COUNT=INSULATION_PRODUCT_VARIANTS.filter(v=>!/^PUR(?:\/PIR)?$/.test(v.material)).length;

export const INSULATION_ALIAS_CATALOG=[
  'Isover GR32','Isover GR 30','Isover Isoconfort 32','Isover Isoconfort 35','Isover Isomob 32R','Isover IBR',
  'URSA Hometec 32','URSA Façade 32P','URSA Thermocoustic 32','URSA MRK 40','URSA MNU 40','URSA PRK 32','URSA Cladursa 32',
  'Isonat Flex 55','Isonat Multisol','STEICOflex','STEICOprotect','STEICOtherm','STEICOuniversal','PAVAFLEX Confort','PAVAFLEX 36','PAVATHERM','PAVAWALL','ISOLAIR MULTI',
  'Biofib Trio','Biofib Chanvre','Biofib Ouate','Métisse RT','Coton Pro P/R','UniverCell','Pavafloc','Sopracell','Isocell',
  'Knauf XTherm ITEx Sun+','Knauf NEXTherm ITEx','Knauf Therm ITEx','Knauf Therm Chape Th38','Knauf Therm Sol','Knauf Therm Dallage',
  'Soprema TMS','TMS MF SI','TMS GF SI','SopraXPS','Unilin Utherm Floor','Unilin Utherm Wall','Unilin Utherm Roof','Unilin Utherm Sarking',
  'Recticel Eurothane Mur','Recticel Eurothane BR Bio','Recticel Powerwall','Kingspan Kooltherm','Kingspan Therma','Jackodur','Styrodur',
  'Rockwool Rockmur','Rockwool Rockplus','Rockwool Rocksol','Rockwool Rockcomble','Rockwool Rockciel','Rockwool MB Rock','Rockwool Alpharock'
];

function familyScore(text,f,target){
  if(target && !f.applications.includes(target)) return null;
  const n=libNorm(text), c=compact(text); let best=0;
  for(const alias of f.aliases){
    const an=libNorm(alias), ac=compact(alias); if(!ac) continue;
    if(n.includes(an)||c.includes(ac)) best=Math.max(best,1);
    else if(approxContains(c,ac)) best=Math.max(best,0.96);
  }
  if(best===0) return null;
  const brand=compact(f.brand.split('/')[0]); if(brand.length>=4 && c.includes(brand)) best=Math.min(1,best+0.01);
  return best;
}
function thicknessCandidates(text){
  const n=libNorm(text); const values=[];
  for(const m of n.matchAll(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:mm|millimetres?|millimeters?)\b/g)) values.push(Number(m[1].replace(',','.')));
  if(!values.length) for(const m of n.matchAll(/\b(\d{2,3})\b/g)) values.push(Number(m[1]));
  return [...new Set(values.filter(v=>v>=20&&v<=500))];
}
function nearestVariant(f,thickness){
  if(thickness==null||!Number.isFinite(Number(thickness))) return null;
  const t=Number(thickness); const sorted=[...f.variants].sort((a,b)=>Math.abs(a.thickness-t)-Math.abs(b.thickness-t));
  return sorted.length&&Math.abs(sorted[0].thickness-t)<=1.5?sorted[0]:null;
}

export function matchInsulationProduct(text,target=null,explicitThickness=null){
  const matches=[];
  for(const f of INSULATION_FAMILIES){ const score=familyScore(text,f,target); if(score!=null) matches.push({f,score}); }
  if(!matches.length) return null;
  matches.sort((a,b)=>b.score-a.score || Math.max(...b.f.aliases.map(x=>compact(x).length))-Math.max(...a.f.aliases.map(x=>compact(x).length)));
  const {f,score}=matches[0]; let variant=nearestVariant(f,explicitThickness), thicknessEvidence=variant?'explicit':null;
  if(!variant){ const candidates=thicknessCandidates(text).map(t=>({t,v:nearestVariant(f,t)})).filter(x=>x.v); const uniq=[]; const seen=new Set(); for(const x of candidates){ const k=x.v.thickness; if(!seen.has(k)){seen.add(k);uniq.push(x);} } if(uniq.length===1){ variant=uniq[0].v; thicknessEvidence='product-context'; } }
  return {brand:f.brand,product:f.product,material:f.material,lambda:f.lambda,applications:f.applications,source:f.source,score,variant,thicknessEvidence};
}

export function libraryNote(match,kind){
  if(!match?.variant) return '';
  const base=`${match.brand} — ${match.product}, ${match.variant.thickness} mm, R ${String(match.variant.r).replace('.',',')} m².K/W ; source ${match.source}`;
  return kind==='r'
    ? `R issu de la bibliothèque isolants (${base}) car aucune résistance thermique directe exploitable n'a été trouvée dans le document. La valeur documentaire directe reste prioritaire.`
    : `Épaisseur issue de la bibliothèque isolants (${base}) à partir d'une gamme produit reconnue. La valeur documentaire directe reste prioritaire.`;
}
