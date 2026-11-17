// ExtracTerre v3.0.2 — classement appris sur le banc Salesforce (validation croisée par contrat) : précision mesurée de chaque
// lecture (donnée × méthode × type de document). Utilisé par engine.consolidate pour départager les candidats d'un bâtiment :
// la lecture la plus précise remplace celle choisie par la hiérarchie seulement si l'écart de précision est net (GAP) et mesuré
// sur assez de cas (MINN). Sources non autorisées : seulement les clés listées dans UNROUTED (précision mesurée suffisante).
// Table générée par le script d'apprentissage ; vide = aucun effet.
export const LEARNED_RANKING={version:0,minN:30,gap:0.20,keys:{},unrouted:{},fill:{}};
export function learnedPrecision(field,o,T=LEARNED_RANKING){
  const k=T.keys; if(!k) return null;
  for(const key of [`${field}|${o.method||''}|${o.docType||''}`,`${field}|${o.method||''}|*`,`${field}|*|${o.docType||''}`]){ const v=k[key]; if(v&&v[1]>=T.minN) return v[0]; }
  return null;
}
export function learnedPick(field,chosen,cands,T=LEARNED_RANKING){
  if(!T.keys||!Object.keys(T.keys).length||!chosen) return null;
  // précision de la valeur retenue = meilleure précision parmi les lectures qui donnent cette même valeur (banc : sinon trop de changements).
  let pc=learnedPrecision(field,chosen,T)??0; for(const o of cands) if(String(o.value)===String(chosen.value)){ const q=learnedPrecision(field,o,T); if(q!==null&&q>pc) pc=q; }
  let best=null,pb=-1;
  for(const o of cands){ if(o===chosen||String(o.value)===String(chosen.value)) continue; const p=learnedPrecision(field,o,T); if(p!==null&&p>pb){ pb=p; best=o; } }
  return best&&pb-pc>=T.gap?best:null;
}
// v3.0.2 — levier 4 : donnée sans lecture retenue (confiance < 90 %) ; une lecture d'une source autorisée dont la précision
// mesurée (donnée × méthode × type × niveau de source) atteint le seuil de la table est retenue. Jamais une source non autorisée.
export function learnedFill(field,cands,T=LEARNED_RANKING){
  const F=T.fill||{}; let best=null,pb=-1;
  for(const o of cands){ if(o.sourceTier!=='main'&&o.sourceTier!=='secondary') continue; const v=F[`${field}|${o.method||''}|${o.docType||''}|${o.sourceTier}`]; if(v&&v[0]>pb){ pb=v[0]; best=o; } }
  return best;
}
