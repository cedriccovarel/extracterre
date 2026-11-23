// v3.3.0 — parcours protégé : lance scan-child.mjs et le tue s'il reste sans signe de vie plus de `silenceMs`
// (un listage Box figé). Renvoie {ok:true,scan} ou {ok:false,blocked:true,error}.
import {spawn} from 'child_process';
import path from 'path';
import {fileURLToPath} from 'url';
const CHILD=path.join(path.dirname(fileURLToPath(import.meta.url)),'scan-child.mjs');
export function guardedScan(opDir,cfgPath,{allSubfolders=false,silenceMs=120000,nodePath=process.execPath}={}){
  return new Promise(resolve=>{
    let out='', err='', last=Date.now(), done=false;
    const child=spawn(nodePath,[CHILD,opDir,cfgPath,allSubfolders?'1':'0'],{stdio:['ignore','pipe','pipe']});
    const finish=r=>{ if(done) return; done=true; clearInterval(timer); resolve(r); };
    const timer=setInterval(()=>{ if(Date.now()-last>silenceMs){ try{ child.kill('SIGKILL'); }catch{} finish({ok:false,blocked:true,error:`Box ne répond plus depuis ${Math.round(silenceMs/1000)} s`}); } },Math.min(5000,silenceMs/4));
    child.stdout.on('data',d=>{ out+=d; last=Date.now(); });
    child.stderr.on('data',d=>{ const t=String(d); if(t.replace(/\./g,'').trim()) err+=t; last=Date.now(); });
    child.on('error',e=>finish({ok:false,blocked:false,error:e.message}));
    child.on('exit',code=>{ if(done) return; if(code===0){ try{ return finish({ok:true,scan:JSON.parse(out)}); }catch(e){ return finish({ok:false,blocked:false,error:`réponse illisible (${e.message})`}); } }
      finish({ok:false,blocked:false,error:err.trim().split('\n').pop()||`code ${code}`}); });
  });
}
