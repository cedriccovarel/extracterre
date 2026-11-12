// Chiffrement du registre : rien de lisible n'est envoyé à Supabase.
// Phrase secrète → PBKDF2-SHA256 (310 000 tours, sel aléatoire stocké) → 64 octets :
//   32 pour AES-256-GCM (contenu), 32 pour HMAC-SHA256 (identifiants : contrat, chemin, empreinte).
// Sans la phrase secrète, ni Supabase ni la clé de service ne permettent de relire les données.
import crypto from 'crypto';

export const KDF_ITERATIONS=310000;
export const CHECK_PLAIN='extracterre-import-ok';

export function newSalt(){ return crypto.randomBytes(16).toString('base64'); }

export function deriveKeys(passphrase,saltB64,iterations=KDF_ITERATIONS){
  if(!passphrase||String(passphrase).length<12) throw new Error('Phrase secrète trop courte (12 caractères minimum).');
  const raw=crypto.pbkdf2Sync(String(passphrase).normalize('NFC'),Buffer.from(saltB64,'base64'),iterations,64,'sha256');
  return {enc:raw.subarray(0,32),mac:raw.subarray(32,64)};
}

export function hmac(keys,text){ return crypto.createHmac('sha256',keys.mac).update(String(text)).digest('hex'); }

// Format : base64( iv[12] | tag[16] | chiffré ).
export function encryptJson(keys,obj){
  const iv=crypto.randomBytes(12);
  const c=crypto.createCipheriv('aes-256-gcm',keys.enc,iv);
  const body=Buffer.concat([c.update(Buffer.from(JSON.stringify(obj),'utf8')),c.final()]);
  return Buffer.concat([iv,c.getAuthTag(),body]).toString('base64');
}
export function decryptJson(keys,b64){
  const buf=Buffer.from(String(b64),'base64');
  const d=crypto.createDecipheriv('aes-256-gcm',keys.enc,buf.subarray(0,12));
  d.setAuthTag(buf.subarray(12,28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)),d.final()]).toString('utf8'));
}

export function sha256File(abs){
  return new Promise((resolve,reject)=>{
    const h=crypto.createHash('sha256');
    import('fs').then(fs=>fs.createReadStream(abs).on('data',d=>h.update(d)).on('error',reject).on('end',()=>resolve(h.digest('hex'))));
  });
}
export function sha256Buffer(buf){ return crypto.createHash('sha256').update(buf).digest('hex'); }
