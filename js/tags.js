import {normLower,normalizeText,unique} from './utils.js';

export const PROJECT_TAG_LIBRARY = [
  {label:'Traitement / réemploi des eaux grises',category:'Eau',patterns:[/eaux?\s+grises?/i,/reutilisation\s+des?\s+eaux?\s+usees?/i,/réutilisation\s+des?\s+eaux?\s+usées?/i,/recyclage\s+des?\s+eaux?/i]},
  {label:'Récupération des eaux pluviales',category:'Eau',patterns:[/recuperation\s+des?\s+eaux?\s+pluviales?/i,/récupération\s+des?\s+eaux?\s+pluviales?/i,/cuve\s+eaux?\s+pluviales?/i,/EP\s+reutilisees?/i]},
  {label:'Gestion alternative des eaux pluviales',category:'Eau',patterns:[/noue\s+(?:paysagere|d['’]infiltration)/i,/bassin\s+d['’]infiltration/i,/infiltration\s+(?:a|à)\s+la\s+parcelle/i,/gestion\s+alternative\s+des?\s+eaux?\s+pluviales?/i]},
  {label:'Biodiversité',category:'Biodiversité',patterns:[/biodiversit[eé]/i,/refuge\s+LPO/i,/hotel\s+a\s+insectes/i,/hôtel\s+à\s+insectes/i,/nichoirs?/i,/gites?\s+a\s+chauves?-souris/i,/gîtes?\s+à\s+chauves?-souris/i]},
  {label:'Toiture / façade végétalisée',category:'Biodiversité',patterns:[/toiture\s+vegetalis[eé]e/i,/terrasse\s+vegetalis[eé]e/i,/fa[cç]ade\s+vegetalis[eé]e/i,/mur\s+vegetal/i]},
  {label:'Habitat sénior',category:'Usage',patterns:[/habitat\s+s[eé]nior/i,/r[eé]sidence\s+s[eé]nior/i,/logements?\s+s[eé]niors?/i,/personnes?\s+[aâ]g[eé]es/i,/ehpad/i,/r[eé]sidence\s+autonomie/i]},
  {label:'Habitat intergénérationnel',category:'Usage',patterns:[/interg[eé]n[eé]rationnel/i,/intergenerationnel/i]},
  {label:'Habitat inclusif',category:'Usage',patterns:[/habitat\s+inclusif/i,/logement\s+inclusif/i]},
  {label:'Résidence étudiante',category:'Usage',patterns:[/r[eé]sidence\s+[eé]tudiante/i,/logements?\s+[eé]tudiants?/i]},
  {label:'Qualité de l’air intérieur',category:'Santé',patterns:[/qualit[eé]\s+de\s+l(?:['’]|\s+)air\s+int[eé]rieur/i,/\bQAI\b/i,/capteur\s+CO2/i,/mesure\s+du\s+CO2/i,/faibles?\s+[eé]missions?\s+de\s+COV/i,/classe\s+A\+\s*(?:COV|emission)/i]},
  {label:'Matériaux biosourcés',category:'Carbone',patterns:[/biosourc[eé]/i,/fibre\s+de\s+bois/i,/ouate\s+de\s+cellulose/i,/chanvre/i,/paille/i,/metisse/i,/m[eé]tisse/i,/li[eè]ge\s+expans[eé]/i]},
  {label:'Réemploi / économie circulaire',category:'Carbone',patterns:[/r[eé]emploi/i,/r[eé]utilisation\s+des?\s+mat[eé]riaux/i,/economie\s+circulaire/i,/économie\s+circulaire/i,/mat[eé]riaux\s+de\s+seconde\s+vie/i]},
  {label:'Production photovoltaïque',category:'Énergie',patterns:[/photovoltaique/i,/photovoltaïque/i,/panneaux?\s+PV\b/i,/centrale\s+solaire/i]},
  {label:'Autoconsommation',category:'Énergie',patterns:[/autoconsommation/i,/auto-consommation/i]},
  {label:'Réseau de chaleur',category:'Énergie',patterns:[/r[eé]seau\s+de\s+chaleur/i,/chauffage\s+urbain/i,/sous[- ]station/i]},
  {label:'Géothermie',category:'Énergie',patterns:[/g[eé]otherm/i,/sondes?\s+g[eé]othermiques?/i]},
  {label:'Brasseurs d’air',category:'Confort',patterns:[/brasseurs?\s+d['’]?air/i,/ventilateurs?\s+de\s+plafond/i,/\bHVLS\b/i]},
  {label:'Conception traversante',category:'Confort',patterns:[/logements?\s+traversants?/i,/zone\s+traversante/i,/groupe\s+traversant/i]},
  {label:'Mobilité électrique',category:'Mobilité',patterns:[/IRVE/i,/bornes?\s+de\s+recharge/i,/recharge\s+des?\s+v[eé]hicules?\s+[eé]lectriques?/i]},
  {label:'Stationnement vélo renforcé',category:'Mobilité',patterns:[/local\s+v[eé]lo/i,/stationnement\s+v[eé]lo/i,/abri\s+v[eé]lo/i]},
  {label:'BBCA',category:'Label',patterns:[/\bBBCA\b/i]},
  {label:'Bâtiment biosourcé',category:'Label',patterns:[/label\s+b[aâ]timent\s+biosourc[eé]/i]},
  {label:'Effinergie',category:'Label',patterns:[/effinergie/i]},
  {label:'BEPOS',category:'Label',patterns:[/\bBEPOS\b/i]},
  {label:'BEE+',category:'Label',patterns:[/\bBEE\+\b/i]}
];

function firstEvidence(doc,patterns){
  for(const page of doc.read?.pages||[]){
    for(const line of page.lines||[]){
      const text=normalizeText(line.text||'');
      if(patterns.some(re=>re.test(text))) return {document:doc.name,page:page.page,excerpt:text.slice(0,360)};
    }
  }
  const text=normalizeText(doc.read?.text||'');
  if(patterns.some(re=>re.test(text))) return {document:doc.name,page:'',excerpt:text.slice(0,360)};
  return null;
}

function performanceTags(result){
  const tags=[];
  for(const row of result?.rows||[]){
    let gain=typeof row.cep_gain==='number'?row.cep_gain:null;
    if(gain==null && typeof row.cep==='number' && typeof row.cep_max==='number' && row.cep_max>0) gain=(row.cep_max-row.cep)/row.cep_max*100;
    if(gain!=null && Number.isFinite(gain) && gain>=5){
      const rounded=Math.round(gain*10)/10;
      tags.push({label:`Performance CEP -${String(rounded).replace('.',',')} %`,category:'Performance',source:'calcul RSET',building:row.building,confidence:1,excerpt:`Cep ${row.cep ?? '—'} / Cep max ${row.cep_max ?? '—'}`});
    }
    let bg=typeof row.bbio_gain==='number'?row.bbio_gain:null;
    if(bg==null && typeof row.bbio==='number' && typeof row.bbio_max==='number' && row.bbio_max>0) bg=(row.bbio_max-row.bbio)/row.bbio_max*100;
    if(bg!=null && Number.isFinite(bg) && bg>=10){ const rounded=Math.round(bg*10)/10; tags.push({label:`Performance Bbio -${String(rounded).replace('.',',')} %`,category:'Performance',source:'calcul RSET',building:row.building,confidence:1,excerpt:`Bbio ${row.bbio ?? '—'} / Bbio max ${row.bbio_max ?? '—'}`}); }
  }
  // Pour rester lisible, une même performance numérique n'est affichée qu'une fois.
  const seen=new Set(); return tags.filter(t=>{const k=normLower(t.label); if(seen.has(k)) return false; seen.add(k); return true;}).slice(0,8);
}

export function buildProjectTags(docs,result,manualTags=[]){
  const auto=[];
  for(const def of PROJECT_TAG_LIBRARY){
    let evidence=null;
    for(const doc of docs){ evidence=firstEvidence(doc,def.patterns); if(evidence) break; }
    if(evidence) auto.push({...def,...evidence,source:'document',confidence:.97});
  }
  auto.push(...performanceTags(result));
  const manual=(manualTags||[]).filter(Boolean).map(label=>({label,category:'Manuel',source:'manuel',confidence:1,manual:true}));
  const out=[]; const seen=new Set();
  for(const t of [...manual,...auto]){ const k=normLower(t.label); if(seen.has(k)) continue; seen.add(k); out.push(t); }
  return out;
}
