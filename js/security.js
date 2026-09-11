/* ExtracTerre access gate — no plaintext credential is stored in this file. */
(function(){
  'use strict';
  const ACCESS_KEY='extracterre-access-session-v1';
  const ITERATIONS=240000;
  const SALT_B64='lMgP07FrgdapvtTWllD+Sg==';
  const VERIFIER_B64='FodG7COv45atXfTqQ/IwFNGYTwohsmVTmdnq8b/JuZI=';
  const encoder=new TextEncoder();
  const decoder=new TextDecoder();
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const b64ToBytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  const bytesToB64=bytes=>{
    let s='';
    for(const b of bytes) s+=String.fromCharCode(b);
    return btoa(s);
  };
  function timingSafeEqual(a,b){
    if(a.length!==b.length) return false;
    let diff=0;
    for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i);
    return diff===0;
  }
  async function deriveVerifier(candidate){
    if(!globalThis.crypto?.subtle) throw new Error('La vérification sécurisée du mot de passe n’est pas disponible dans ce navigateur.');
    const material=await crypto.subtle.importKey('raw',encoder.encode(candidate),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:b64ToBytes(SALT_B64),iterations:ITERATIONS},material,256);
    return bytesToB64(new Uint8Array(bits));
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
  function unlockUi(gate){
    sessionStorage.setItem(ACCESS_KEY,'1');
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
    if(sessionStorage.getItem(ACCESS_KEY)==='1'){
      document.body.classList.remove('auth-locked');
      document.body.classList.add('auth-unlocked');
      if(shell){ shell.removeAttribute('inert'); shell.removeAttribute('aria-hidden'); }
      resolve(true);
      return;
    }
    const gate=makeGate();
    const form=gate.querySelector('#accessForm');
    const input=gate.querySelector('#accessPassword');
    const error=gate.querySelector('#accessError');
    const submit=gate.querySelector('#accessSubmit');
    const toggle=gate.querySelector('#accessPasswordToggle');
    let failures=0;
    toggle.onclick=()=>{
      const showing=input.type==='text';
      input.type=showing?'password':'text';
      toggle.setAttribute('aria-label',showing?'Afficher le mot de passe':'Masquer le mot de passe');
      input.focus();
    };
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const candidate=input.value;
      if(!candidate) return;
      submit.disabled=true;
      error.textContent='Vérification…';
      try{
        const verifier=await deriveVerifier(candidate);
        if(timingSafeEqual(verifier,VERIFIER_B64)){
          input.value='';
          error.textContent='';
          unlockUi(gate);
          resolve(true);
          return;
        }
        failures+=1;
        input.value='';
        error.textContent='Mot de passe incorrect.';
        gate.querySelector('.auth-card')?.classList.add('auth-shake');
        setTimeout(()=>gate.querySelector('.auth-card')?.classList.remove('auth-shake'),360);
        await sleep(Math.min(4000,350*failures));
      }catch(err){
        error.textContent=err?.message||'Vérification impossible.';
      }finally{
        submit.disabled=false;
        input.focus();
      }
    });
    setTimeout(()=>input.focus(),80);
  }
  globalThis.__extracterreAccessPromise=new Promise(resolve=>{
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>initializeGate(resolve),{once:true});
    else initializeGate(resolve);
  });
  globalThis.__lockExtracterre=()=>{
    try{ sessionStorage.removeItem(ACCESS_KEY); }catch{}
    location.reload();
  };
})();
