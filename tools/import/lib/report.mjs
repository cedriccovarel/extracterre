// Rapports : CSV (séparateur « ; », UTF-8 avec BOM pour Excel) et affichage écran.
import fs from 'fs';
import path from 'path';

const cell=v=>{ const s=v==null?'':String(v); return /[;"\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
export function writeCsv(file,header,rows){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,'﻿'+[header,...rows].map(r=>r.map(cell).join(';')).join('\r\n')+'\r\n');
  return file;
}

export class Progress{
  constructor(total,label=''){ this.total=Math.max(1,total); this.done=0; this.label=label; this.tty=process.stdout.isTTY; this.last=0; }
  tick(text=''){
    this.done++; const now=Date.now();
    if(!this.tty){ if(now-this.last>5000||this.done===this.total){ this.last=now; console.log(`  ${this.label} ${this.done}/${this.total} ${text}`); } return; }
    const w=28, f=Math.round(w*this.done/this.total);
    process.stdout.write(`\r  ${this.label} [${'█'.repeat(f)}${'░'.repeat(w-f)}] ${this.done}/${this.total} ${String(text).slice(0,60).padEnd(60)}`);
    if(this.done>=this.total) process.stdout.write('\n');
  }
  end(){ if(this.tty&&this.done<this.total) process.stdout.write('\n'); }
}

export function stamp(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
