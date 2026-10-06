// Mis à jour en v2.3 : les 11 dropzones sont remplacées par une dropzone unique + famille par fichier.
import fs from 'fs';
const app=fs.readFileSync('./js/app.js','utf8'); const parsers=fs.readFileSync('./js/parsers.js','utf8'); const html=fs.readFileSync('./index.html','utf8');
if((html.match(/id="dropzone"/g)||[]).length!==1) throw new Error('dropzone unique absente');
if(/data-family="/.test(html)) throw new Error('anciennes dropzones spécialisées encore présentes');
for(const f of ['rset','rt2012','thcex','carbone','cctp','dpgf','dpe','annex']) if(!app.includes(`['${f}`)&&!app.includes(`'${f}'`)) throw new Error(`famille absente du sélecteur : ${f}`);
if(!app.includes("['rset+carbone'")) throw new Error('choix RSEE thermique + carbone absent');
if(!app.includes('classifyForSelectedFamily')||!app.includes('changeDocumentFamily')) throw new Error('routage par famille absent');
if(!parsers.includes('parseSpecializedDocument')||!parsers.includes('resolveDocumentFamilies')) throw new Error('parseur spécialisé absent');
if(!app.includes('documentExpectedFields')) throw new Error('contrôle complétude absent');
console.log('v2.3 dropzone unique + familles par fichier: OK');
