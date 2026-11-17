// ExtracTerre v2.44.0 — confrontation Salesforce (prompt maître §2.1-2.4) : chaque valeur Salesforce d'un bâtiment est
// comparée aux valeurs lues dans les documents, sans jamais la modifier. Statuts :
//   CONFIRMÉE               un document donne la même valeur
//   DIVERGENCE_DOCUMENTAIRE les documents donnent une valeur comparable différente
//   NON_COMPARABLE          les documents donnent une valeur d'une autre nature (texte ↔ nombre)
//   NON_RETROUVÉE           des documents pertinents ont été lus, la valeur n'y est pas
//   VÉRIFICATION_IMPOSSIBLE aucun document pertinent pour cette donnée dans l'opération
//   NON_VÉRIFIÉE            des documents pertinents ne sont pas encore lus
// « Pertinent » = type de document en source principale ou secondaire de la donnée (règles de sources).
export const SF_CHECK_LABELS={CONFIRMEE:'Confirmée par les documents',DIVERGENCE_DOCUMENTAIRE:'Divergence documentaire',NON_COMPARABLE:'Non comparable',
  NON_RETROUVEE:'Non retrouvée dans les documents',VERIFICATION_IMPOSSIBLE:'Vérification impossible (aucun document pertinent)',NON_VERIFIEE:'Non vérifiée (documents en cours de lecture)'};
const cf_num=v=>{ const m=String(v??'').replace(/\s/g,'').replace(',','.'); return /^-?\d+(?:\.\d+)?$/.test(m)?Number(m):null; };
const cf_isManual=o=>o?.sourceTier==='manual'||/^manual:/.test(String(o?.method||''))||/^(?:Correction|Entrée) manuelle$/.test(o?.docType||'');
// sf : [{building, field, value}] ; detailed : occurrences ; docs : [{type, status}] ; differs(field,a,b) : vrai si différentes.
export function sfConfront({sf=[],detailed=[],docs=[],rules={},differs}){
  const out={};
  for(const s of sf){
    const r=rules[s.field]; const relevantTypes=new Set([...(r?.main||[]),...(r?.secondary||[])]);
    const relevant=docs.filter(d=>relevantTypes.has(d.type)), pending=relevant.filter(d=>d.status!=='ready');
    const cands=detailed.filter(o=>o.field===s.field&&(o.building===s.building||o.building==='Bâtiment unique')&&!cf_isManual(o)&&o.sourceTier!=='forbidden'&&o.value!==undefined&&o.value!==null&&o.value!=='');
    let status, ref=null;
    if(cands.length){
      const sfNum=cf_num(s.value)!==null, comparable=cands.filter(o=>(cf_num(o.value)!==null)===sfNum);
      // Salesforce arrondit souvent (Cep 52 ↔ 52,1) : la valeur du document arrondie à la précision de Salesforce suffit.
      const dec=String(s.value).replace(',','.').split('.')[1]?.length||0, rounded=v=>{ const x=cf_num(v); return x===null?v:Number(x.toFixed(dec)); };
      const same=comparable.find(o=>!differs(s.field,s.value,o.value))||(sfNum?comparable.find(o=>rounded(o.value)===cf_num(s.value)):null);
      if(same){ status='CONFIRMEE'; ref=same; }
      else if(comparable.length){ status='DIVERGENCE_DOCUMENTAIRE'; ref=comparable.find(o=>o.status==='retenu')||comparable.slice().sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0]; }
      else { status='NON_COMPARABLE'; ref=cands[0]; }
    } else status=!relevant.length?'VERIFICATION_IMPOSSIBLE':pending.length?'NON_VERIFIEE':'NON_RETROUVEE';
    out[`${s.building}|${s.field}`]={status,label:SF_CHECK_LABELS[status],sfValue:s.value,...(ref?{docValue:ref.value,docFile:ref.fileName||'',docPage:ref.page||'',docDate:ref.studyDate||''}:{}),documentsExamined:relevant.length-pending.length};
  }
  return out;
}
export function sfCheckCounts(checks){ const c={}; for(const v of Object.values(checks||{})) c[v.status]=(c[v.status]||0)+1; return c; }
