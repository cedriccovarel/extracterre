import {DEFAULT_SOURCE_RULES,FIELD_MAP} from './config.js';

const KEY='prestaterreExtract.sourceRules.v2';
export function loadSourceRules(){
  try{ const s=JSON.parse(localStorage.getItem(KEY)); return s&&typeof s==='object'?mergeRules(s):structuredClone(DEFAULT_SOURCE_RULES); }catch{return structuredClone(DEFAULT_SOURCE_RULES);}
}
export function saveSourceRules(rules){ localStorage.setItem(KEY,JSON.stringify(rules)); }
export function resetSourceRules(){ localStorage.removeItem(KEY); return structuredClone(DEFAULT_SOURCE_RULES); }
function mergeRules(custom){ const out=structuredClone(DEFAULT_SOURCE_RULES); for(const [k,v] of Object.entries(custom||{})){ if(FIELD_MAP[k]&&v) out[k]={main:Array.isArray(v.main)?v.main:out[k].main,secondary:Array.isArray(v.secondary)?v.secondary:out[k].secondary,forbidden:Array.isArray(v.forbidden)?v.forbidden:out[k].forbidden}; } return out; }
export function sourceTier(field,docType,rules){ const r=rules[field]||DEFAULT_SOURCE_RULES[field]; if(!r) return 'main'; if(r.forbidden.includes(docType)) return 'forbidden'; if(r.main.includes(docType)) return 'main'; if(r.secondary.includes(docType)) return 'secondary'; return 'unrouted'; }
export function sourceRank(field,docType,rules){ const r=rules[field]||DEFAULT_SOURCE_RULES[field]; if(!r) return 999; const mi=r.main.indexOf(docType); if(mi>=0) return mi; const si=r.secondary.indexOf(docType); if(si>=0) return 100+si; if(r.forbidden.includes(docType)) return 10000; return 1000; }
