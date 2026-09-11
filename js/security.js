/* ExtracTerre access gate — no plaintext credential is stored in this file. */
(function(){
  'use strict';
  const ACCESS_KEY='extracterre-access-session-v2';
  const ROLE_KEY='extracterre-access-role-v2';
  const JOURNAL_PROOF_KEY='extracterre-journal-proof-v1';
  const ITERATIONS=240000;
  const CREDENTIALS=Object.freeze([
    Object.freeze({role:'owner',salt:'k8mYrXRkF9Tc93CZ4XE/Ww==',verifier:'K2nrhIK4SR4yzGSTAlauJ0EDpUBjgiIqKuc3sKZEi7E='}),
    Object.freeze({role:'team',salt:'pw2aqn9y0gHwI2Tn1gSFvQ==',verifier:'7HEmO9bQyuDnUEUspohQOEo0hGIrp6BNO3Odb1JWd5o='}),
    // Alias volontaire : les deux orthographes du mot de passe équipe reçues lors de la spécification
    // sont acceptées, sans qu'aucune ne soit stockée en clair.
    Object.freeze({role:'team',salt:'mvE7LcJiPkgGvxBxe7KJkg==',verifier:'KLJDdDxkKjie3qAwbJw1C5vTfz57uus38k3Z0yqMenk='})
  ]);
  const PACK_CREDENTIAL=Object.freeze({salt:'CFrYdaflTTZO9t7IYt22IA==',verifier:'OG5ERIlZjXgfbE1KmouWWkE7hB7oirj1GBAKM0YeGxc='});
  const PACK_PROOF_HASH='d9fed6b3e652370176955b01d2244e8e17c573ed7211f9be97fc9361c3486d80';
  const encoder=new TextEncoder();
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const b64ToBytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  const bytesToB64=bytes=>{ let s=''; for(const b of bytes) s+=String.fromCharCode(b); return btoa(s); };
  const bytesToHex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  function timingSafeEqual(a,b){
    if(a.length!==b.length) return false;
    let diff=0;
    for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i);
    return diff===0;
  }
  async function deriveVerifier(candidate,saltB64){
    if(!globalThis.crypto?.subtle) throw new Error('La vérification sécurisée du mot de passe n’est pas disponible dans ce navigateur.');
    const material=await crypto.subtle.importKey('raw',encoder.encode(candidate),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:b64ToBytes(saltB64),iterations:ITERATIONS},material,256);
    return bytesToB64(new Uint8Array(bits));
  }
  async function sha256Hex(text){
    const digest=await crypto.subtle.digest('SHA-256',encoder.encode(text));
    return bytesToHex(new Uint8Array(digest));
  }
  async function journalProof(candidate){ return sha256Hex(`extracterre-journal-v1:${candidate}`); }
  async function packJournalProof(candidate){ return sha256Hex(`extracterre-pack-journal-v1:${candidate}`); }
  function currentStoredContext(){
    try{
      if(sessionStorage.getItem(ACCESS_KEY)!=='1') return null;
      const role=sessionStorage.getItem(ROLE_KEY)||'';
      const proof=sessionStorage.getItem(JOURNAL_PROOF_KEY)||'';
      if(!['owner','team'].includes(role)||!/^[a-f0-9]{64}$/i.test(proof)) return null;
      return {role,journalProof:proof};
    }catch{return null;}
  }
  function makeGate(){
    const gate=document.createElement('div');
    gate.id='accessGate';
    gate.className='auth-gate';
    gate.setAttribute('role','dialog');
    gate.setAttribute('aria-modal','true');
    gate.setAttribute('aria-labelledby','accessGateTitle');
    gate.innerHTML=`
      <div class="auth-backdrop-shape auth-shape-one"></div>
      <div class="auth-backdrop-shape auth-shape-two"></div>
      <section class="auth-card">
        <div class="auth-brand-block">
          <img src="assets/extracterre-mark.png" alt="Logo ExtracTerre" class="auth-logo">
          <div class="auth-brand-name">Extrac<span>Terre</span></div>
          <div class="auth-brand-subtitle">Analyse documentaire bâtiment</div>
        </div>
        <div class="auth-divider"></div>
        <form id="accessForm" class="auth-form" autocomplete="off">
          <span class="auth-eyebrow">Accès sécurisé</span>
          <h1 id="accessGateTitle">Bienvenue</h1>
          <p>Entrez votre mot de passe pour ouvrir l’espace de travail ExtracTerre.</p>
          <label for="accessPassword">Mot de passe</label>
          <div class="auth-password-wrap">
            <input id="accessPassword" name="extracterre-access" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required>
            <button id="accessPasswordToggle" class="auth-toggle" type="button" aria-label="Afficher le mot de passe" title="Afficher / masquer">◉</button>
          </div>
          <div id="accessError" class="auth-error" aria-live="polite"></div>
          <button id="accessSubmit" class="auth-submit" type="submit">Accéder à ExtracTerre</button>
          <small>Accès valable pour cette session du navigateur.</small>
        </form>
      </section>`;
    document.body.prepend(gate);
    return gate;
  }
  function unlockUi(gate,context){
    sessionStorage.setItem(ACCESS_KEY,'1');
    sessionStorage.setItem(ROLE_KEY,context.role);
    sessionStorage.setItem(JOURNAL_PROOF_KEY,context.journalProof);
    document.body.classList.remove('auth-locked');
    document.body.classList.add('auth-unlocked');
    const shell=document.querySelector('.app-shell');
    if(shell){ shell.removeAttribute('inert'); shell.removeAttribute('aria-hidden'); }
    gate?.classList.add('auth-gate-leaving');
    setTimeout(()=>gate?.remove(),260);
  }
  function initializeGate(resolve){
    const shell=document.querySelector('.app-shell');
    if(shell){ shell.setAttribute('inert',''); shell.setAttribute('aria-hidden','true'); }
    const stored=currentStoredContext();
    if(stored){
      document.body.classList.remove('auth-locked');
      document.body.classList.add('auth-unlocked');
      if(shell){ shell.removeAttribute('inert'); shell.removeAttribute('aria-hidden'); }
      resolve(stored);
      return;
    }
    try{ sessionStorage.removeItem(ACCESS_KEY); sessionStorage.removeItem(ROLE_KEY); sessionStorage.removeItem(JOURNAL_PROOF_KEY); }catch{}
    const gate=makeGate();
    const form=gate.querySelector('#accessForm');
    const input=gate.querySelector('#accessPassword');
    const error=gate.querySelector('#accessError');
    const submit=gate.querySelector('#accessSubmit');
    const toggle=gate.querySelector('#accessPasswordToggle');
    let failures=0;
    toggle.onclick=()=>{
      const showing=input.type==='text'; input.type=showing?'password':'text';
      toggle.setAttribute('aria-label',showing?'Afficher le mot de passe':'Masquer le mot de passe'); input.focus();
    };
    form.addEventListener('submit',async event=>{
      event.preventDefault(); const candidate=input.value; if(!candidate) return;
      submit.disabled=true; error.textContent='Vérification…';
      try{
        let match=null;
        for(const credential of CREDENTIALS){
          const verifier=await deriveVerifier(candidate,credential.salt);
          if(timingSafeEqual(verifier,credential.verifier)){ match=credential; break; }
        }
        if(match){
          const context={role:match.role,journalProof:await journalProof(candidate)};
          input.value=''; error.textContent=''; unlockUi(gate,context); resolve(context); return;
        }
        failures+=1; input.value=''; error.textContent='Mot de passe incorrect.';
        gate.querySelector('.auth-card')?.classList.add('auth-shake');
        setTimeout(()=>gate.querySelector('.auth-card')?.classList.remove('auth-shake'),360);
        await sleep(Math.min(4000,350*failures));
      }catch(err){ error.textContent=err?.message||'Vérification impossible.'; }
      finally{ submit.disabled=false; input.focus(); }
    });
    setTimeout(()=>input.focus(),80);
  }
  globalThis.__extracterreAccessPromise=new Promise(resolve=>{
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>initializeGate(resolve),{once:true});
    else initializeGate(resolve);
  });
  globalThis.__extracterreGetAccessContext=()=>currentStoredContext();
  globalThis.__extracterreVerifyPackPassword=async candidate=>{
    if(!candidate) return {ok:false,proof:''};
    const verifier=await deriveVerifier(candidate,PACK_CREDENTIAL.salt);
    if(!timingSafeEqual(verifier,PACK_CREDENTIAL.verifier)) return {ok:false,proof:''};
    return {ok:true,proof:await packJournalProof(candidate)};
  };
  globalThis.__extracterreAuthorizePackProof=async proof=>!!proof&&timingSafeEqual(await sha256Hex(String(proof)),PACK_PROOF_HASH);
  globalThis.__lockExtracterre=()=>{
    try{ sessionStorage.removeItem(ACCESS_KEY); sessionStorage.removeItem(ROLE_KEY); sessionStorage.removeItem(JOURNAL_PROOF_KEY); }catch{}
    location.reload();
  };
})();
