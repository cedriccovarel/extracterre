// Nouvel essai sur les erreurs passagères de Box (sans charger pdf.js).
// Box (File Provider) : un fichier pas encore téléchargé peut renvoyer « Unknown system error -11 » (EDEADLK) le temps du
// téléchargement. On réessaie avec une attente croissante (2, 4, 8, 16, 30 s).
export async function withRetry(fn,tries=6){
  for(let i=1;;i++){
    try{ return await fn(); }
    catch(err){ const transient=err?.errno===-11||/EDEADLK|EAGAIN|ETIMEDOUT|system error -11|Resource deadlock/i.test(String(err?.code||'')+' '+String(err?.message||''));
      if(!transient||i>=tries) throw err; await new Promise(r=>setTimeout(r,Math.min(30000,2000*2**(i-1)))); }
  }
}
