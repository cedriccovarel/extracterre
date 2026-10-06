import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
const js=fs.readFileSync('js/app.js','utf8');
const checks=[
 ['prev button',html.includes('id="betaPrevPage"')],
 ['next button',html.includes('id="betaNextPage"')],
 ['page select kept',html.includes('id="betaLearningPage"')],
 ['prev binding',js.includes("betaPrev.onclick=()=>changeBetaLearningPage(-1)")],
 ['next binding',js.includes("betaNext.onclick=()=>changeBetaLearningPage(1)")],
 ['nav state',js.includes('function updateBetaPageNavState()')],
 ['viewport height',css.includes('height:calc(100dvh - 20px)!important')],
 ['shell grid',css.includes('grid-template-rows:auto minmax(0,1fr) auto')]
];
for(const [name,ok] of checks){if(!ok){console.error('FAIL',name);process.exitCode=1;}else console.log('OK',name)}
