import fs from 'fs';
const app=fs.readFileSync(new URL('./js/app.js',import.meta.url),'utf8');
const version=fs.readFileSync(new URL('./VERSION',import.meta.url),'utf8').trim();
const checks=[
  ['version courante', version==='2.3.11'],
  ['manual analysis records parser location learning', /recordLearningEvent\('parser_location_learning',learnPayload,activeProject\(\)\)/.test(app)],
  ['manual analysis reinforces local learning memory', /reinforceLearningLocation\(learnPayload,\{eventId:evt\.id,createdAt:evt\.createdAt,field,docType:loc\.docType,building\}\)/.test(app)],
  ['manual learning carries selection geometry', /normalizedRects:loc\.normalizedRects\|\|\[\],bboxNormalized:loc\.bboxNormalized\|\|null/.test(app)],
  ['manual direct entry is journalized separately', /manual_analysis_direct_value/.test(app)],
  ['learning only reinforces location when document type exists', /else if\(loc\?\.docType\)/.test(app)]
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'OK':'FAIL'} ${name}`); if(!ok) failed++;}
if(failed) process.exit(1);
