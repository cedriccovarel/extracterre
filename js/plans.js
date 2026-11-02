// v2.15.0 — plans mesurés dans Ashton : la table de correspondance reçue (par document) devient, pour les quantités
// reliées à une colonne, des occurrences de type Plan. Longueurs, largeurs et surfaces restent dans l'onglet Plans.
import {DOC_TYPES,FIELD_DEFS,FIELD_MAP} from './config.js';
import {normLower} from './utils.js';

export const isPlanDoc=d=>d?.type===DOC_TYPES.PLAN&&/\.pdf$/i.test(d.name||'');
export const PLAN_QUANTITY_FIELDS=FIELD_DEFS.filter(f=>f.type==='number'&&!f.hidden&&/_count$|_units$|_buildings$/.test(f.key));
export const PLAN_KIND={longueur:'Longueur',largeur:'Largeur',surface:'Surface',quantite:'Quantité'};
const pl_words=s=>[...new Set(normLower(String(s||'')).replace(/[’']/g,' ').replace(/^(?:nombre|nb)\s+(?:de\s+|d\s+)?/,'').split(/[^a-z0-9]+/).map(w=>w.replace(/s$/,'')).filter(w=>w.length>1&&!['de','du','des','la','le','les','nombre','nb'].includes(w)))].sort().join(' ');
// Mot-clé → colonne de quantité : libellé, synonymes, et ceux de la colonne Oui / Non associée (« Brasseur d'air »).
export function planFieldFor(keyword){ const k=pl_words(keyword); if(!k) return '';
  const partner={fan_count:'fan_presence'};
  return PLAN_QUANTITY_FIELDS.find(f=>[f.label,...(f.tags||[]),...(FIELD_MAP[partner[f.key]]?.tags||[])].some(t=>pl_words(t)===k))?.key||''; }
export const planRowField=(t,r)=>{ if(r.kind!=='quantite') return ''; const ref=t.refs?.[r.key]; return ref!==undefined?planFieldFor(ref):(r.field||planFieldFor(r.ref)); };
export function planOccurrences(project){ const out=[];
  for(const [docId,t] of Object.entries(project.planTables||{})) for(const r of t.rows||[]){ const field=planRowField(t,r); if(!FIELD_MAP[field]||!Number.isFinite(r.total)) continue;
    const ref=t.refs?.[r.key]??r.ref, building=t.building||'Bâtiment unique';
    out.push({field,value:r.total,building,docId,fileName:t.docName||'Plan',docType:DOC_TYPES.PLAN,userValidated:true,page:(r.pages||[])[0]||'',pinnedBuilding:building!=='Bâtiment unique',
      excerpt:`Ashton : ${ref} = ${r.total} (${r.n} comptage(s), page(s) ${(r.pages||[]).join(', ')})`,confidence:.99,method:'ashton:quantity',unit:'',origin:'Ashton — comptage sur plan',provenanceNote:'Quantité comptée sur le plan dans Ashton.'}); }
  return out; }
// Bâtiment par défaut : celui du plan s'il n'en nomme qu'un, sinon toute l'opération.
export function defaultPlanBuilding(d){ const bs=(d?.buildings?.names||[]).filter(b=>b&&b!=='Bâtiment unique'); return bs.length===1?bs[0]:'Bâtiment unique'; }
