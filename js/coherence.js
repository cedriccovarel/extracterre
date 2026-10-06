// ExtracTerre v2.3 — contrôles de cohérence métier après consolidation.
// Principe : une valeur cohérente avec ses voisines est confirmée ; une valeur incohérente quitte le
// tableau final et rejoint la file « À vérifier » avec la raison. Les valeurs issues d'un XML structuré
// ou validées par l'utilisateur ne sont jamais retirées : l'incohérence est alors seulement signalée.
import {FIELD_MAP} from './config.js';

export const PLAUSIBLE_RANGES=Object.freeze({
  bbio:[5,300], bbio_max:[5,300], cep:[5,700], cep_max:[5,700], cepnr:[5,700], cepnr_max:[5,700],
  dh:[0,5000], dh_max:[0,5000], tic:[15,45], tic_ref:[15,45], ubat_before:[0.05,5], ubat_after:[0.05,5],
  cep_before:[5,1500], cep_after_final:[5,1500], shab:[8,500000], housing_count:[1,5000],
  ic_components:[100,2500], ic_site:[0,250], ic_energy:[0,2000], stock_c_per_m2:[0,400],
  bbio_gain:[-100,100], cep_gain:[-100,100], cepnr_gain:[-100,100], construction_year:[1700,2035]
});
const LOTS=Array.from({length:13},(_,i)=>`ic_lot_${i+1}`);
const ENERGY_POSTS=['ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility'];
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const label=f=>FIELD_MAP[f]?.label||f;
function protectedFinal(f){ return !!(f?.userValidated||f?.structuredXml||/^manual:|^xml:/.test(String(f?.method||''))||f?.docType==='Entrée manuelle'); }

export function applyCoherenceChecks(result){
  const alerts=[], demoted=[], checks=[];
  if(!result?.rows?.length) return {alerts,demoted,checks};
  const finalsByKey=new Map(); for(const f of result.finals||[]) finalsByKey.set(`${f.building}|${f.field}`,f);
  for(const row of result.rows){
    const b=row.building; const get=f=>num(row[f]); const fin=f=>finalsByKey.get(`${b}|${f}`);
    const toDemote=new Map();
    const record=(check,status,detail,fields=[],level='warning')=>{
      checks.push({building:b,check,status,detail,fields});
      if(status!=='fail') return;
      const removable=fields.filter(f=>fin(f)&&!protectedFinal(fin(f)));
      const locked=fields.filter(f=>fin(f)&&protectedFinal(fin(f)));
      for(const f of removable) if(!toDemote.has(f)) toDemote.set(f,`${check} : ${detail}`);
      alerts.push({level:locked.length&&!removable.length?'error':level,building:b,message:`Cohérence ${b} — ${check} : ${detail}${removable.length?` → ${removable.map(label).join(', ')} renvoyé(s) en vérification.`:locked.length?' (valeur issue d’une source structurée ou validée : conservée, à contrôler).':''}`});
    };
    // 1. Plages plausibles
    for(const [f,[lo,hi]] of Object.entries(PLAUSIBLE_RANGES)){ const v=get(f); if(v===null) continue; if(v<lo||v>hi) record('Plage plausible','fail',`${label(f)} = ${v} hors de [${lo} ; ${hi}]`,[f]); }
    for(const f of LOTS){ const v=get(f); if(v!==null&&(v<-100||v>1500)) record('Plage plausible','fail',`${label(f)} = ${v} hors de [-100 ; 1500]`,[f]); }
    // 2. Σ lots ≈ IC composants
    const lots=LOTS.map(get); const known=lots.filter(v=>v!==null); const icc=get('ic_components');
    if(icc!==null&&known.length===13){
      const sum=known.reduce((a,v)=>a+v,0); const tol=Math.max(2,Math.abs(icc)*0.03);
      if(Math.abs(sum-icc)<=tol) record('Σ lots 1–13 = IC composants','ok',`${sum.toFixed(1)} ≈ ${icc}`);
      else record('Σ lots 1–13 = IC composants','fail',`Σ lots = ${sum.toFixed(1)} pour IC composants = ${icc} (écart ${(sum-icc).toFixed(1)})`,[...LOTS,'ic_components']);
    }
    // 3. Σ postes énergie ≤ IC énergie (l'éclairage n'a pas de colonne : la somme peut être inférieure)
    const ice=get('ic_energy'); const posts=ENERGY_POSTS.map(get).filter(v=>v!==null);
    if(ice!==null&&posts.length>=3){
      const sum=posts.reduce((a,v)=>a+v,0);
      if(sum<=ice*1.03+1) record('Σ postes énergie ≤ IC énergie','ok',`${sum.toFixed(1)} ≤ ${ice}`);
      else record('Σ postes énergie ≤ IC énergie','fail',`Σ postes = ${sum.toFixed(1)} > IC énergie = ${ice}`,[...ENERGY_POSTS,'ic_energy']);
    }
    // 4. Cep,nr ≤ Cep
    const cep=get('cep'), cepnr=get('cepnr');
    if(cep!==null&&cepnr!==null){ if(cepnr<=cep+0.5) record('Cep,nr ≤ Cep','ok',`${cepnr} ≤ ${cep}`); else record('Cep,nr ≤ Cep','fail',`Cep,nr = ${cepnr} > Cep = ${cep}`,['cep','cepnr']); }
    // 5. Gains recalculés
    for(const [v,m,g] of [['bbio','bbio_max','bbio_gain'],['cep','cep_max','cep_gain'],['cepnr','cepnr_max','cepnr_gain']]){
      const a=get(v), mx=get(m), gain=get(g); if(a===null||!mx) continue;
      const calc=Math.round((mx-a)/mx*1000)/10;
      if(gain===null){
        const src=fin(v)||fin(m)||{};
        const derived={field:g,value:calc,building:b,docId:src.docId||'coherence',fileName:src.fileName||'Calcul de cohérence',docType:src.docType||'',page:src.page||'',excerpt:`${label(m)} = ${mx} ; ${label(v)} = ${a} → gain = (max − valeur) / max = ${calc} %`,confidence:0.995,method:'coherence:gain-calc',unit:'%',status:'retenu',derivedFromDocument:true,origin:'Calcul de cohérence ExtracTerre',provenanceNote:'Gain calculé à partir des deux valeurs retenues du même bâtiment.'};
        row[g]=calc; result.finals.push(derived); finalsByKey.set(`${b}|${g}`,derived);
        record(`Gain ${label(v)}`,'ok',`calculé : ${calc} %`);
      } else {
        const asPct=Math.abs(gain)<=1&&Math.abs(calc)>1?gain*100:gain;
        if(Math.abs(asPct-calc)<=1.5) record(`Gain ${label(v)}`,'ok',`${gain} ≈ ${calc} %`);
        else record(`Gain ${label(v)}`,'fail',`gain lu = ${gain} ; recalculé = ${calc} % (${label(v)} ${a} / max ${mx})`,[g]);
      }
    }
    // 6. Dépassements de seuils réglementaires : informatifs, jamais de retrait.
    for(const [v,m] of [['bbio','bbio_max'],['cep','cep_max'],['cepnr','cepnr_max'],['dh','dh_max']]){ const a=get(v), mx=get(m); if(a!==null&&mx!==null&&a>mx*1.0001) alerts.push({level:'warning',building:b,message:`Cohérence ${b} — ${label(v)} = ${a} dépasse ${label(m)} = ${mx} : non-conformité déclarée ou valeur à contrôler.`}); }
    const tic=get('tic'), ticRef=get('tic_ref'); if(tic!==null&&ticRef!==null&&tic>ticRef+0.05) alerts.push({level:'warning',building:b,message:`Cohérence ${b} — Tic = ${tic} > Tic réf = ${ticRef}.`});
    // Retrait effectif des valeurs incohérentes non protégées.
    for(const [f,reason] of toDemote){
      const final=fin(f); if(!final) continue;
      delete row[f]; finalsByKey.delete(`${b}|${f}`);
      result.finals=result.finals.filter(x=>x!==final);
      demoted.push({...final,status:'à vérifier',coherenceReason:reason,confidence:Math.min(Number(final.confidence)||0.89,0.89)});
      for(const d of result.detailed||[]) if(d.field===f&&d.building===b&&d.status==='retenu'){ d.status='rejeté'; d.rejectionReason=`Incohérence métier : ${reason}`; }
    }
  }
  return {alerts,demoted,checks};
}
