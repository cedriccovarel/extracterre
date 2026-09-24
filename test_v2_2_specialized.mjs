import fs from 'fs';
const app=fs.readFileSync('./js/app.js','utf8'); const parsers=fs.readFileSync('./js/parsers.js','utf8'); const html=fs.readFileSync('./index.html','utf8');
const families=['rset','rt2012','thcex','rsenv','cctp','dpgf','3cl','dpe','acv','annex'];
for(const f of families){ if(!html.includes(`data-family="${f}"`)) throw new Error(`dropzone absente ${f}`); }
if(!app.includes('classifyForSelectedFamily')) throw new Error('routage spécialisé absent');
if(!parsers.includes('parseSpecializedDocument')) throw new Error('parseur spécialisé absent');
if(!app.includes('SPECIALIZED_EXPECTED')) throw new Error('contrôle complétude absent');
console.log('v2.2 specialized tests: OK');
