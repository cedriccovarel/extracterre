import {DOC_TYPES} from './config.js';
import {normLower} from './utils.js';
import {patchClassifierScores} from './patches.js';

export function classifyDocument(fileName, text='', meta={}) {
  const n=normLower(fileName), t=normLower(text).slice(0,120000);
  const has=(re)=>re.test(n)||re.test(t);
  const score={}; const add=(k,v)=>score[k]=(score[k]||0)+v;

  const isStdRset=/recapitulatif\s+standardise\s+d['’]?etude\s+thermique|r[eé]capitulatif\s+standardis[eé]\s+d['’]?etude\s+thermique/i.test(t);
  const explicitRT2012=/reglementation\s+thermique\s+2012|r[eé]glementation\s+thermique\s+2012|rset[^\n]{0,80}rt2012|th[- ]?bce\s*2012/i.test(t);
  const explicitRE2020=/reglementation\s+environnementale\s+2020|r[eé]glementation\s+environnementale\s+2020|\bre\s*2020\b|cep\s*,?\s*nr|degres[- ]?heures|\bdh\b/i.test(t);
  const explicitRSEE=/(?:^|[^a-z0-9])rsee(?:[^a-z0-9]|$)|recapitulatif\s+standardise\s+d['’]?etude\s+(?:energetique|[eé]nerg[eé]tique)\s+et\s+environnementale/i.test(n+' '+t);

  // « RSET » désigne le format standardisé, pas nécessairement la RE2020.
  // La réglementation contenue dans le document prime sur le nom du fichier.
  if (/rt\s*2012/i.test(n)) add(DOC_TYPES.RT2012,10);
  if (explicitRT2012) add(DOC_TYPES.RT2012,isStdRset?22:12);
  if (/(?:^|[^a-z0-9])(?:rsenv|rsnv|rsen)(?:[^a-z0-9]|$)|rse[_ -]?env/i.test(n+' '+t)) add(DOC_TYPES.RSENV,18);
  if (explicitRSEE) add(DOC_TYPES.RSEE_RE2020,20);
  if (/(?:^|[^a-z0-9])rset(?:[^a-z0-9]|$)|rse[_ -]?t\b/i.test(n)) {
    if(explicitRT2012&&!explicitRE2020) add(DOC_TYPES.RT2012,12);
    else add(DOC_TYPES.RSET_RE2020,14);
  }
  if (/\.xml$/i.test(fileName)) {
    if(explicitRSEE) add(DOC_TYPES.RSEE_RE2020,14);
    else if(/rset|re2020|resultat.*etude/i.test(t)) add(DOC_TYPES.RSET_RE2020,12);
  }
  if (explicitRE2020) add(DOC_TYPES.RSET_RE2020,12);
  if (/coefficient\s+bbio|coefficients?\s+cep/i.test(t)) { if(explicitRT2012&&!explicitRE2020) add(DOC_TYPES.RT2012,5); else add(DOC_TYPES.RSET_RE2020,8); }
  if (/rt\s*(?:existant|existante|ex|reno)|r[eé]glementation\s+thermique\s+existante|th[- ]?c(?:e|ex)\s*ex|th[- ]?cex|thcex|r[eé]novation\s+thermique/i.test(n+' '+t)) add(DOC_TYPES.RT_EXISTING,/r[eé]glementation\s+thermique\s+existante/i.test(t)?30:18);
  if (/\bcontrat\b|convention\s+(?:de\s+)?certification|march[eé]\s+de\s+certification/i.test(n+' '+t)) add(DOC_TYPES.CONTRACT,/contrat/i.test(n)?17:9);
  if (/livret\s+d['’]?op[eé]ration|livret\s+op[eé]ration|fiche\s+op[eé]ration/i.test(n+' '+t)) add(DOC_TYPES.OPERATION_BOOKLET,17);
  if (/compte\s+rendu.{0,25}conception|\bcr\b.{0,20}conception|revue\s+de\s+conception/i.test(n+' '+t)) add(DOC_TYPES.DESIGN_REPORT,16);
  if (/compte\s+rendu.{0,25}environnement|\bcr\b.{0,20}environnement|revue\s+environnementale/i.test(n+' '+t)) add(DOC_TYPES.ENV_REPORT,17);
  if (/choix\s+des?\s+exigences|exigences?\s+(?:retenues?|choisies?)|grille\s+des?\s+exigences/i.test(n+' '+t)) add(DOC_TYPES.REQUIREMENTS,17);
  if (/descriptif\s+(?:du\s+)?projet|description\s+(?:du\s+)?projet|pr[eé]sentation\s+(?:du\s+)?projet/i.test(n+' '+t)) add(DOC_TYPES.PROJECT_DESCRIPTION,13);
  if (/cctp|cahier des clauses techniques/i.test(n+' '+t)) add(DOC_TYPES.CCTP,12);
  if (/dpgf|decomposition du prix global/i.test(n+' '+t)) add(DOC_TYPES.DPGF,12);
  if (/tableau.*surface|surfaces?\s+(?:habitables|shab|sref)/i.test(n+' '+t)) add(DOC_TYPES.SURFACE,9);
  if (/plan(?:s)?\s+(?:architect|niveau|rdc|etage)|echelle\s*1\s*\//i.test(n+' '+t)) add(DOC_TYPES.PLAN,8);
  if (/notice\s+(?:architect|descriptive)/i.test(n+' '+t)) add(DOC_TYPES.NOTICE,9);
  if (/permis\s+de\s+construire|\bpc\d|cerfa/i.test(n+' '+t)) add(DOC_TYPES.PERMIT,8);
  if (/rapport[^\n]{0,40}(?:perm[eé]abilit[eé]|infiltrom[eé]tr)|(?:perm[eé]abilit[eé]|infiltrom[eé]tr)[^\n]{0,40}rapport|blower\s+door/i.test(n)) add(DOC_TYPES.AIRTIGHTNESS,24); else if (/perm[eé]abilit[eé]\s+(?:a|à)\s+l['’]?air|\bq4pa(?:-?surf)?\b|blower\s+door|infiltrom[eé]tr/i.test(t)) add(DOC_TYPES.AIRTIGHTNESS,4);
  if (/diagnostic\s+de\s+performance\s+energetique|diagnostic\s+de\s+performance\s+[eé]nerg[eé]tique|\bdpe\b/i.test(n+' '+t)) add(DOC_TYPES.DPE,14);
  if (/\bdiagnostic\b|audit\s+(?:thermique|[eé]nerg[eé]tique)|[eé]tat\s+des\s+lieux\s+technique/i.test(n+' '+t)) add(DOC_TYPES.DIAGNOSTIC,8);
  if (/\bacv\b|analyse\s+du\s+cycle\s+de\s+vie|ic\s+construction|ic\s+composants/i.test(n+' '+t)) add(DOC_TYPES.CARBON,10);
  if (/etude\s+(?:thermique|energetique|énergétique)|etude\s+reglementaire|thermique\s+reglementaire|rapport\s+(?:d['’])?etude\s+(?:thermique|energetique|énergétique)/i.test(n+' '+t)) add(DOC_TYPES.THERMAL,/(?:rapport|etude|étude)[^\n]{0,30}(?:thermique|energetique|énergétique)/i.test(n)?20:10);
  if (/bao\s*evolution|bao\s*[eé]volution|catalogue\s+des\s+parois\s+de\s+l['’]?etat\s+initial|calcul\s+du\s+coefficient\s+ubat/i.test(n+' '+t)) add(DOC_TYPES.THERMAL,18);
  if(meta?.kind==='spreadsheet' && /(?:code\s+interne|nom\s+operation|maitre\s+d.?ouvrage|referentiel|total\s+logements|surface\s+batiment|ic\s+composants)/i.test(t)) add(DOC_TYPES.MANUAL,11);

  // Règles documentaires versionnées (patches) : elles renforcent la classification sans exécuter de code arbitraire.
  for(const [k,v] of Object.entries(patchClassifierScores(fileName,text))) add(k,v);

  // Règle anti-faux-positif : Th-BCE 2012 peut être cité dans un RSET RE2020, mais un RSET
  // explicitement titré « Réglementation Thermique 2012 » doit rester classé RT2012.
  if (explicitRE2020&&!explicitRT2012&&(score[DOC_TYPES.RSET_RE2020]||0)>=12) score[DOC_TYPES.RT2012]=(score[DOC_TYPES.RT2012]||0)*0.2;
  if (explicitRT2012&&!explicitRE2020) score[DOC_TYPES.RSET_RE2020]=(score[DOC_TYPES.RSET_RE2020]||0)*0.15;
  const ranked=Object.entries(score).sort((a,b)=>b[1]-a[1]);
  const type=ranked[0]?.[0]||DOC_TYPES.UNKNOWN;
  const confidence=ranked.length ? Math.min(0.99,0.45+(ranked[0][1]/22)) : 0.25;
  return {type,confidence,scores:score,reason:ranked.slice(0,3)};
}
