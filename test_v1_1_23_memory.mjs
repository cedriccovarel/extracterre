import {__learningMemoryTestProfile,__learningMemoryTestSimilarity} from './js/learning-memory.js';
function assert(name,ok,detail=''){if(!ok){console.error('FAIL',name,detail);process.exitCode=1;}else console.log('OK',name);}
const p2=__learningMemoryTestProfile(2,0),p3=__learningMemoryTestProfile(3,0),p5=__learningMemoryTestProfile(5,0),bad=__learningMemoryTestProfile(5,8);
assert('2 confirmations => bonus faible positif',p2.boost>0&&p2.boost<p3.boost,JSON.stringify(p2));
assert('3 confirmations => bonus supérieur',p3.boost>p2.boost&&p3.boost<p5.boost,JSON.stringify(p3));
assert('5 confirmations => bonus significatif plafonné',p5.boost>=.03&&p5.boost<=.08,JSON.stringify(p5));
assert('contre-exemples font baisser fortement le bonus',bad.boost<p5.boost/2,JSON.stringify(bad));
const same=__learningMemoryTestSimilarity({field:'cep',docType:'RSET RE2020',anchor:'chapitre exigences cep maximum consommation energie',page:5,lineRatio:.4},{...p5});
const other=__learningMemoryTestSimilarity({field:'cep',docType:'RSET RE2020',anchor:'menuiseries vitrage facteur solaire',page:28,lineRatio:.9},{...p5});
assert('contexte structurel proche mieux noté',same>other,`${same} vs ${other}`);
const wrongDoc=__learningMemoryTestSimilarity({field:'cep',docType:'CCTP',anchor:'chapitre exigences cep maximum consommation energie',page:5,lineRatio:.4},{...p5});
assert('aucun transfert entre familles documentaires',wrongDoc===0,String(wrongDoc));
