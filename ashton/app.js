import {dist,pathLength,polygonArea,centroid,scaleFromCalibration,paperRatio,parseLength,fmt,ortho,extractGeometry,SnapIndex,
  parseLabelText,isDwelling,summarize,DEFAULT_ELEMENTS,autoZone,roomsInLasso,ringsOf,holesOf,areaOf,correspondence} from './measure.js';

const pdfjsLib=globalThis.pdfjsLib;
const $=id=>document.getElementById(id);
const view=$('view'), stage=$('stage'), base=$('base'), hires=$('hires'), over=$('over');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS={zone:'#2b8a3e',len:'#d9480f',area:'#2b8a3e',cal:'#7048e8',count:'#1971c2',label:'#0b7285',ocr:'#0b7285'};
const TYPES={len:'Longueurs',area:'Surfaces',count:'Comptages',label:'Étiquettes'};
const ONE={len:'Longueur',area:'Surface',count:'Comptage',label:'Étiquette'};
const SNAP_PX=10, ACCESS='Accès hall';
const HINTS={
  pan:'Glissez pour vous déplacer, molette pour zoomer. Cliquez une mesure pour la modifier, Maj + clic pour en sélectionner plusieurs et les grouper.',
  cal:'Cliquez les deux extrémités d’une longueur connue, par exemple une cote.',
  len:'Cliquez chaque point. Double-clic ou Entrée pour terminer, Retour arrière retire le dernier point, Échap annule.',
  area:'Cliquez chaque sommet. Cliquez le premier point, double-cliquez ou Entrée pour fermer la surface.',
  zone:'Cliquez dans une pièce, ou maintenez le clic pour entourer plusieurs pièces (une zone par pièce). Maj : ajouter à la zone, Option : en retirer.',
  edit:'Faites glisser un sommet d’une mesure pour le déplacer (accroche active, Alt pour la suspendre). Cliquez une mesure pour la sélectionner.',
  access:'Un clic sur chaque accès du hall (porte donnant sur l’extérieur ou sur une autre circulation). Entrée ou double-clic pour enregistrer : un seul accès = hall non traversant.',
  count:'Un clic par élément à compter. Entrée ou double-clic pour enregistrer le comptage, Retour arrière retire le dernier.',
  label:'Cliquez où placer l’étiquette, puis saisissez son texte, sa typologie et sa surface.',
  ocr:'Encadrez un texte du plan (glisser) : il devient une étiquette, typologie et surface reconnues.'};
const DRAW_TOOLS=['cal','len','area','count','access'];

// Coordonnées en points PDF de la page (y vers le bas). Écran = page × zoom + (ox, oy).
const S={pdf:null,name:'',key:'',pageNum:1,page:null,vp:null,baseScale:1,zoom:1,ox:0,oy:0,tool:'pan',draft:[],cursor:null,snap:null,snapOn:true,
  snaps:{},texts:{},meas:[],scales:{},groups:[],renaming:null,sel:null,multi:new Set(),folded:new Set((()=>{ try{ return JSON.parse(localStorage.getItem('ashton.folded')||'[]'); }catch{ return []; } })()),nextId:1,token:0,hiresToken:0,ctx:{lot:'',typo:'',cat:'',role:'longueur'},rect:null,pendingLabel:null};
globalThis.Ashton=S; // accès console pour le diagnostic de la bêta
// Intégré à ExtracTerre (iframe ?embed) : le plan arrive par message, la table de correspondance repart vers ExtracTerre.
const EMBED=new URLSearchParams(location.search).has('embed')&&window.parent!==window;
const XT={docId:'',quantities:[]};
if(EMBED) document.body.classList.add('embed');

if(!pdfjsLib) document.addEventListener('DOMContentLoaded',()=>toast('PDF.js n’a pas pu être chargé. Vérifiez la connexion puis rechargez la page.','error'));
else pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const pref=(k,v)=>{ try{ if(v===undefined) return localStorage.getItem('ashton.'+k); localStorage.setItem('ashton.'+k,v); }catch{} return null; };

/* ---------- Ouverture ---------- */
function toast(msg,kind=''){ const t=document.createElement('div'); t.className='toast '+kind; t.textContent=msg; $('toasts').append(t); setTimeout(()=>t.remove(),kind==='error'?7000:3500); }
const busy=text=>{ $('busy').hidden=!text; $('busyText').textContent=text||''; };

async function openFile(file){
  if(!file) return;
  if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf') return toast(`« ${file.name} » n’est pas un PDF.`,'error');
  busy(`Ouverture de « ${file.name} »…`);
  try{
    const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    S.pdf?.destroy(); Object.assign(S,{pdf,name:file.name,key:`ashton:${file.name}:${file.size}`,snaps:{},texts:{},draft:[],sel:null}); load();
    $('docName').textContent=file.name; $('pageSel').innerHTML=Array.from({length:pdf.numPages},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
    $('pageCount').textContent=`sur ${pdf.numPages}`; $('pagesWrap').hidden=pdf.numPages<2; $('empty').hidden=true; $('tableBtn').disabled=false; view.classList.remove('no-doc');
    await showPage(1);
  }catch(e){ busy(''); toast(`Impossible de lire « ${file.name} » : ${e.message}`,'error'); }
}
async function showPage(n){
  const token=++S.token; S.pageNum=n; S.draft=[]; S.sel=null; $('pageSel').value=n;
  busy('Rendu du plan…'); hires.hidden=true;
  const page=await S.pdf.getPage(n); if(token!==S.token) return;
  S.page=page; S.vp=page.getViewport({scale:1});
  // Image de fond nette jusqu'à ~5000 px : déplacement et zoom instantanés, puis rendu net de la zone visible.
  S.baseScale=Math.min(4,5000/Math.max(S.vp.width,S.vp.height));
  const v=page.getViewport({scale:S.baseScale}); base.width=Math.round(v.width); base.height=Math.round(v.height);
  base.style.width=base.width+'px'; base.style.height=base.height+'px';
  fit(); renderPanel();
  try{ await page.render({canvasContext:base.getContext('2d'),viewport:v}).promise; }catch(e){ if(token===S.token) toast('Rendu du plan interrompu : '+e.message,'error'); }
  if(token!==S.token) return; busy(''); scheduleHires(); buildSnap(n,token);
}
async function buildSnap(n,token){
  if(S.snaps[n]) return showSnapInfo();
  $('snapInfo').textContent='Accroche : lecture des tracés…';
  try{ const ol=await S.page.getOperatorList(); if(token!==S.token) return;
    const g=extractGeometry(ol.fnArray,ol.argsArray,pdfjsLib.OPS,S.vp.transform); S.snaps[n]=new SnapIndex(g); S.snaps[n].count=g.points.length/2; }
  catch{ S.snaps[n]={query:()=>null,count:0}; }
  showSnapInfo();
}
function showSnapInfo(){ const ix=S.snaps[S.pageNum]; $('snapInfo').textContent=!S.snapOn?'Accroche désactivée':!ix?'Accroche : lecture des tracés…':ix.count?`Accroche : ${ix.count.toLocaleString('fr-FR')} points du dessin`:'Accroche : aucun tracé vectoriel (plan scanné ?)'; }

/* ---------- Vue ---------- */
function fit(){ if(!S.vp) return; const w=view.clientWidth, h=view.clientHeight, z=Math.min((w-48)/S.vp.width,(h-48)/S.vp.height);
  S.zoom=z; S.ox=(w-S.vp.width*z)/2; S.oy=(h-S.vp.height*z)/2; viewChanged(); }
function applyTransform(){ stage.style.transform=`translate(${S.ox}px,${S.oy}px) scale(${S.zoom/S.baseScale})`; $('zoomInfo').textContent=S.vp?`Zoom ${Math.round(S.zoom*100)} %`:''; }
function zoomAt(sx,sy,f){ const z=Math.min(60,Math.max(0.02,S.zoom*f)); f=z/S.zoom; S.ox=sx-(sx-S.ox)*f; S.oy=sy-(sy-S.oy)*f; S.zoom=z; viewChanged(); }
function viewChanged(){ applyTransform(); hires.hidden=true; S.hiresTask?.cancel(); scheduleHires(); draw(); }
function scheduleHires(){ clearTimeout(S.hiresTimer); S.hiresTimer=setTimeout(renderHires,260); }
async function renderHires(){
  const dpr=devicePixelRatio||1; if(!S.page||S.zoom*dpr<=S.baseScale*1.05) return;
  const w=view.clientWidth, h=view.clientHeight, token=++S.hiresToken;
  const c=document.createElement('canvas'); c.width=Math.round(w*dpr); c.height=Math.round(h*dpr); const ctx=c.getContext('2d');
  const task=S.page.render({canvasContext:ctx,viewport:S.page.getViewport({scale:S.zoom*dpr}),transform:[1,0,0,1,S.ox*dpr,S.oy*dpr]}); S.hiresTask=task;
  try{ await task.promise; }catch{ return; }
  if(token!==S.hiresToken) return; hires.width=c.width; hires.height=c.height; hires.style.width=w+'px'; hires.style.height=h+'px';
  // Seul le rectangle de la page est recopié (PDF.js peint du blanc partout). Ne pas découper avant le rendu : certains PDF n'affichent alors plus rien.
  const hc=hires.getContext('2d'), x=Math.max(0,S.ox*dpr), y=Math.max(0,S.oy*dpr), rw=Math.min(c.width,(S.ox+S.vp.width*S.zoom)*dpr)-x, rh=Math.min(c.height,(S.oy+S.vp.height*S.zoom)*dpr)-y;
  hc.clearRect(0,0,c.width,c.height); if(rw>0&&rh>0) hc.drawImage(c,x,y,rw,rh,x,y,rw,rh); hires.hidden=false;
}
new ResizeObserver(()=>{ const dpr=devicePixelRatio||1; over.width=view.clientWidth*dpr; over.height=view.clientHeight*dpr; over.style.width=view.clientWidth+'px'; over.style.height=view.clientHeight+'px'; if(S.vp) viewChanged(); }).observe(view);

/* ---------- Mesures ---------- */
const k=()=>S.scales[S.pageNum]?.k||null;
const pageMeas=()=>S.meas.filter(m=>m.page===S.pageNum);
function valueOf(m){ const kk=S.scales[m.page]?.k;
  if(m.type==='len') return {v:kk?pathLength(m.pts)*kk:null,u:'m'};
  if(m.type==='area') return {v:kk?areaOf(m)*kk*kk:null,u:'m²',p:kk?[...ringsOf(m),...holesOf(m)].reduce((a,r)=>a+pathLength(r,true),0)*kk:null};
  if(m.type==='count') return {v:m.pts.length,u:'u',d:0};
  return {v:m.surface??null,u:'m²',label:true}; }
const valText=m=>{ const {v,u,d,label}=valueOf(m); return v==null?(label?'':'non étalonné'):`${fmt(v,d??2)} ${u}`; };
const metaText=m=>[m.type==='len'&&m.role?m.role[0].toUpperCase()+m.role.slice(1):'',m.cat,m.typo,m.lot,m.group?'Groupe '+m.group:''].filter(Boolean).join(' · ');
const toScreen=p=>({x:S.ox+p.x*S.zoom,y:S.oy+p.y*S.zoom});
const toPage=e=>{ const r=view.getBoundingClientRect(); return {x:(e.clientX-r.left-S.ox)/S.zoom,y:(e.clientY-r.top-S.oy)/S.zoom}; };
function pointFromEvent(e){ let p=toPage(e); S.snap=null;
  const last=S.draft[S.draft.length-1];
  if(e.shiftKey&&last) return ortho(last,p);
  if(!S.snapOn||e.altKey||!DRAW_TOOLS.includes(S.tool)&&!S.vdrag) return p;
  const rad=SNAP_PX/S.zoom; let best=null, bd=rad;
  // Les sommets des mesures existantes passent avant le dessin.
  for(const ring of [...pageMeas().filter(m=>m.type==='len'||m.type==='area').flatMap(m=>[...ringsOf(m),...holesOf(m)]),S.draft]) for(const q of ring){ if(q===S.vdrag?.cur) continue; const d=dist(p,q); if(d<=bd){ bd=d; best={x:q.x,y:q.y,kind:'vertex'}; } }
  best=best||S.snaps[S.pageNum]?.query(p.x,p.y,rad)||null; S.snap=best; return best?{x:best.x,y:best.y}:p; }

function addPoint(p){
  if(S.tool==='area'&&S.draft.length>=3&&dist(p,S.draft[0])*S.zoom<=SNAP_PX) return finish();
  S.draft.push(p);
  if(S.tool==='cal'&&S.draft.length===2) openCal();
  draw();
}
function create(type,pts,extra={}){
  const n=S.meas.filter(m=>m.type===type).length+1, c=S.ctx;
  const m={id:S.nextId++,type,page:S.pageNum,pts,name:extra.name||(c.cat?`${c.cat} ${n}`:`${ONE[type]} ${n}`),cat:c.cat,typo:c.typo,lot:c.lot,...(type==='len'?{role:c.role}:{}),...extra};
  S.meas.push(m); S.sel=m.id; save(); renderPanel(); draw(); return m; }

/* ---------- Zone automatique ---------- */
const gapM=()=>{ const v=parseFloat(String($('ctxGap').value).replace(',','.')); return v>0&&v<5?v:0.9; };
const inRing=(p,pts)=>{ let inside=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i], b=pts[j]; if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside; } return inside; };
const inShape=(p,m)=>ringsOf(m).some(r=>inRing(p,r))&&!holesOf(m).some(h=>inRing(p,h));
// mode : 'new' (clic), 'add' (Maj), 'sub' (Option) ; la zone garde ses clics pour être recalculée.
function zoneAt(p,mode){
  const kk=k(), ix=S.snaps[S.pageNum];
  if(!kk) return toast('Étalonnez d’abord la page : la largeur des portes à fermer est en mètres.','error');
  if(!ix?.segmentsIn) return toast(ix?'Ce plan n’a pas de tracés vectoriels (plan scanné) : tracez la surface à la main.':'Les traits du plan sont encore en lecture, réessayez dans un instant.','error');
  const sel=S.meas.find(m=>m.id===S.sel), target=mode==='new'?null:(sel?.auto&&sel.page===S.pageNum?sel:[...pageMeas()].reverse().find(m=>m.auto));
  if(mode==='sub'&&!target) return toast('Option + clic retire une partie d’une zone automatique : créez ou sélectionnez d’abord une zone.','error');
  if(mode==='sub'&&!inShape(p,target)) return toast('Cliquez à l’intérieur de la zone pour en retirer une partie.','error');
  if(mode==='add'&&!target) toast('Maj + clic ajoute à une zone automatique : aucune sur cette page, une nouvelle zone est créée.');
  if(mode==='add'&&target&&inShape(p,target)) return toast('Ce point est déjà dans la zone.');
  const seeds=target?(mode==='add'?[...target.seeds,p]:target.seeds):[p], minus=target?(mode==='sub'?[...(target.minus||[]),p]:target.minus||[]):[];
  busy('Calcul de la zone…');
  setTimeout(()=>{ let z; try{ z=autoZone(ix,seeds,{gap:(target?.gap||gapM())/kk,minus}); }catch(e){ z={error:'fail',msg:e.message}; } busy('');
    const msg={wall:'Cliquez dans une pièce, pas sur un trait du plan.',narrow:'Espace trop étroit ou ouvert à cet endroit : cliquez plus au centre de la pièce.',
      open:`La zone ne se ferme pas : une ouverture dépasse ${fmt(gapM())} m ou le contour du plan n’est pas fermé. Augmentez la largeur à fermer ou tracez la surface à la main.`,
      minus:'Impossible de délimiter la partie à retirer à cet endroit.',fail:'Calcul de la zone impossible : '+z.msg}[z.error];
    if(z.error==='empty'&&target){ remove(target.id); return toast('Toute la zone a été retirée : elle est supprimée.'); }
    if(z.error||!z.rings?.length) return toast(msg||'Aucune zone trouvée à cet endroit.','error');
    const rings=[...z.rings].sort((a,b)=>polygonArea(b)-polygonArea(a));
    if(target){ Object.assign(target,{pts:rings[0],more:rings.slice(1),holes:z.holes,seeds,minus}); S.sel=target.id; save(); renderPanel(); draw(); }
    else create('area',rings[0],{more:rings.slice(1),holes:z.holes,seeds,minus:[],auto:true,gap:gapM()});
  },30); }
// Lasso : chaque pièce entourée devient une zone ; Maj les ajoute à la zone sélectionnée, Option les en retire.
function lassoZones(poly,mode){
  const kk=k(), ix=S.snaps[S.pageNum];
  if(!kk) return toast('Étalonnez d’abord la page : la largeur des portes à fermer est en mètres.','error');
  if(!ix?.segmentsIn) return toast('Les traits du plan ne sont pas disponibles pour la zone automatique.','error');
  const sel=S.meas.find(m=>m.id===S.sel), target=mode==='new'?null:(sel?.auto&&sel.page===S.pageNum?sel:[...pageMeas()].reverse().find(m=>m.auto));
  if(mode!=='new'&&!target) return toast(`${mode==='add'?'Maj':'Option'} + lasso agit sur une zone automatique : créez ou sélectionnez d’abord une zone.`,'error');
  busy('Recherche des pièces dans le lasso…');
  setTimeout(()=>{ const gap=(target?.gap||gapM())/kk; let groups=roomsInLasso(ix,poly,{gap,thin:0.045/kk});
    const areas=pageMeas().filter(m=>m.type==='area');
    // Un groupe = une pièce et ses meubles collés aux murs ; on ignore ceux déjà mesurés (ou, pour Option, hors de la zone).
    groups=groups.map(g=>g.filter(p=>mode==='sub'?inShape(p,target):!areas.some(m=>inShape(p,m)))).filter(g=>g.length);
    let seeds=groups.flat();
    if(!seeds.length){ busy(''); return toast(mode==='sub'?'Aucune pièce de la zone dans le lasso.':'Aucune nouvelle pièce dans le lasso (les pièces déjà mesurées sont ignorées).'); }
    if(target){ const z=autoZone(ix,mode==='add'?[...target.seeds,...seeds]:target.seeds,{gap,minus:mode==='sub'?[...(target.minus||[]),...seeds]:target.minus||[]}); busy('');
      if(z.error==='empty'){ remove(target.id); return toast('Toute la zone a été retirée : elle est supprimée.'); }
      if(z.error) return toast('Calcul de la zone impossible avec ces pièces.','error');
      const rings=[...z.rings].sort((a,b)=>polygonArea(b)-polygonArea(a));
      Object.assign(target,{pts:rings[0],more:rings.slice(1),holes:z.holes,seeds:mode==='add'?[...target.seeds,...seeds]:target.seeds,minus:mode==='sub'?[...(target.minus||[]),...seeds]:target.minus||[]});
      S.sel=target.id; save(); renderPanel(); draw(); return toast(`${seeds.length} pièce${seeds.length>1?'s':''} ${mode==='add'?'ajoutée':'retirée'}${seeds.length>1?'s':''}.`); }
    let made=0, fail=0, i=0;
    const next=()=>{ if(i>=groups.length){ busy(''); return toast(`${made} zone${made>1?'s':''} créée${made>1?'s':''}`+(fail?`, ${fail} pièce${fail>1?'s':''} non fermée${fail>1?'s':''}.`:'.'),made?'success':'error'); }
      busy(`Zones : ${i+1} sur ${groups.length}…`); const g=groups[i++];
      setTimeout(()=>{ if(!S.meas.some(m=>m.page===S.pageNum&&m.type==='area'&&inShape(g[0],m))){ const z=autoZone(ix,g,{gap});
          if(z.rings?.length){ const rings=[...z.rings].sort((a,b)=>polygonArea(b)-polygonArea(a)); create('area',rings[0],{more:rings.slice(1),holes:z.holes,seeds:g,minus:[],auto:true,gap:gapM()}); made++; } else fail++; }
        next(); },10); };
    next(); },30); }
function finish(){
  // Outil Accès : un comptage « Accès hall », relu par ExtracTerre pour l'exigence de hall non traversant.
  const acc=S.tool==='access', t=acc?'count':S.tool, minPts={len:2,area:3,count:1}[t];
  const pts=t==='count'?S.draft:S.draft.filter((p,i,a)=>!i||dist(p,a[i-1])>1e-6); S.draft=[];
  if(minPts&&pts.length>=minPts) create(t,pts,acc?{cat:ACCESS,ref:ACCESS,name:`${ACCESS} ${S.meas.filter(m=>m.cat===ACCESS).length+1}`}:{}); else draw();
}
function setTool(t){ S.tool=t; S.draft=[]; S.rect=null; view.dataset.mode=t; document.querySelectorAll('.tool[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t)));
  $('hint').textContent=HINTS[t]; $('ctxRole').hidden=t!=='len'; $('ctxGapWrap').hidden=t!=='zone'; draw(); }
// Maj + clic : ajoute ou retire de la sélection multiple ; clic simple : une seule mesure.
function pick(m,toggle){
  if(toggle&&m){ if(S.sel&&!S.multi.size) S.multi.add(S.sel); S.multi.has(m.id)?S.multi.delete(m.id):S.multi.add(m.id); S.sel=S.multi.size===1?[...S.multi][0]:S.multi.size?m.id:null; if(S.multi.size===1) S.multi.clear(); }
  else { S.multi.clear(); S.sel=m?.id??null; }
  renderPanel(); draw(); }
const isSel=id=>id===S.sel||S.multi.has(id);
function remove(id){ S.meas=S.meas.filter(m=>m.id!==id); S.multi.delete(id); if(S.sel===id) S.sel=null; save(); renderPanel(); draw(); }
function hit(p){ const tol=6/S.zoom; let found=null;
  for(const m of pageMeas().reverse()){ const pts=m.pts;
    if(m.type==='count'&&pts.some(q=>dist(p,q)<=tol*1.6)) return m;
    if(m.type==='label'){ const b=m._box, sx=p.x*S.zoom+S.ox, sy=p.y*S.zoom+S.oy; if(b&&sx>=b.x&&sx<=b.x+b.w&&sy>=b.y&&sy<=b.y+b.h) return m; continue; }
    if(m.type!=='len'&&m.type!=='area') continue; const closed=m.type==='area';
    for(const pts of [...ringsOf(m),...holesOf(m)]){
    for(let i=0;i<pts.length-(closed?0:1);i++){ const a=pts[i], b=pts[(i+1)%pts.length], dx=b.x-a.x, dy=b.y-a.y, L=dx*dx+dy*dy, t=L?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/L)):0;
      if(Math.hypot(a.x+t*dx-p.x,a.y+t*dy-p.y)<=tol) return m; }
    if(closed&&inShape(p,m)) found=found||m; } }
  return found; }

/* ---------- Flèche : déplacement des sommets ---------- */
const handlesOf=m=>m.type==='area'?[...ringsOf(m),...holesOf(m)]:[m.pts];
function handleAt(e){ const p=toPage(e), tol=8/S.zoom, sel=S.meas.find(m=>m.id===S.sel&&m.page===S.pageNum);
  for(const m of [sel,...[...pageMeas()].reverse()].filter(Boolean)) for(const arr of handlesOf(m)) for(let i=0;i<arr.length;i++) if(dist(p,arr[i])<=tol) return {m,arr,i,cur:arr[i]};
  return null; }
function endDrag(){ const {m}=S.vdrag; S.vdrag=null; view.style.cursor='';
  // Une zone retouchée à la main ne peut plus être recalculée depuis ses clics sans perdre la retouche.
  if(m.auto){ delete m.auto; delete m.seeds; delete m.minus; toast('Zone retouchée : elle devient une surface dessinée (Maj et Option ne la recalculent plus).'); }
  save(); renderPanel(); draw(); }

/* ---------- Étalonnage ---------- */
$('calUnit').value=pref('unit')||'m';
$('ctxGap').value=(pref('gap')||'0,90'); $('ctxGap').addEventListener('change',()=>{ $('ctxGap').value=String(gapM()).replace('.',','); pref('gap',$('ctxGap').value); });
function openCal(){ const [a,b]=S.draft, n=pageMeas().filter(m=>m.type==='len'||m.type==='area').length, cal=S.scales[S.pageNum];
  $('calInfo').textContent=`Segment de ${fmt(dist(a,b),1)} pt sur le plan.`+(n?` Les ${n} mesure${n>1?'s':''} de cette page seront recalculées.`:'');
  const f={m:1,cm:100,mm:1000}[$('calUnit').value];
  $('calInput').value=cal?.meters?String(Math.round(cal.meters*f*1000)/1000).replace('.',','):''; $('calErr').hidden=true; $('calDlg').returnValue=''; $('calDlg').showModal(); $('calInput').select(); }
$('calForm').addEventListener('submit',e=>{
  if(e.submitter&&e.submitter.value!=='ok') return;
  // Une unité tapée dans le champ (« 450 cm ») l'emporte sur le menu.
  const raw=$('calInput').value.trim(), meters=parseLength(/[a-z]\s*$/i.test(raw)?raw:raw+$('calUnit').value), [a,b]=S.draft, kk=meters&&scaleFromCalibration(a,b,meters);
  if(!kk){ e.preventDefault(); $('calErr').hidden=false; return; }
  pref('unit',$('calUnit').value); S.scales[S.pageNum]={k:kk,meters,pts:[a,b]}; save(); toast(`Échelle appliquée : environ 1:${Math.round(paperRatio(kk))}.`,'success');
});
$('calCancel').addEventListener('click',()=>$('calDlg').close('cancel'));
$('calDlg').addEventListener('close',()=>{ const ok=$('calDlg').returnValue==='ok'&&S.scales[S.pageNum]; S.draft=[]; if(ok) setTool('len'); renderPanel(); draw(); });

/* ---------- Étiquettes ---------- */
function openLabel(at,parsed,info){
  S.pendingLabel={at,rect:S.rect};
  $('lblTitle').textContent=parsed?'Étiquette OCR':'Étiquette libre'; $('lblInfo').textContent=info||'';
  $('lblName').value=parsed?.name??S.ctx.lot; $('lblTypo').value=parsed?.typo||S.ctx.typo; $('lblCat').value=parsed?(parsed.cat||''):(S.ctx.cat||'Logement');
  $('lblSurf').value=parsed?.surface!=null?String(parsed.surface).replace('.',','):'';
  $('lblDlg').returnValue=''; $('lblDlg').showModal(); $('lblName').select();
}
$('lblCancel').addEventListener('click',()=>$('lblDlg').close('cancel'));
$('lblDlg').addEventListener('close',()=>{ const p=S.pendingLabel; S.pendingLabel=null; S.rect=null;
  if($('lblDlg').returnValue!=='ok'||!p) return draw();
  const surf=parseFloat($('lblSurf').value.replace(/\s/g,'').replace(',','.')), cat=$('lblCat').value.trim(), typo=$('lblTypo').value.trim(), name=$('lblName').value.trim()||ONE.label;
  const m=create('label',[p.at],{name,cat,typo,surface:isFinite(surf)&&surf>0?surf:null,...(p.rect?{rect:p.rect}:{})});
  // Une étiquette de logement devient le contexte des mesures suivantes.
  if(isDwelling(m)){ S.ctx.lot=name; S.ctx.typo=typo; syncCtx(); save(); }
  refreshLists(); });

// Texte du PDF dans le cadre ; à défaut (plan scanné), OCR Tesseract sur la zone rendue en haute définition.
async function textInRect(r){
  if(!S.texts[S.pageNum]){ const tc=await S.page.getTextContent(); S.texts[S.pageNum]=tc.items.filter(t=>t.str.trim()).map(t=>{ const [x,y]=S.vp.convertToViewportPoint(t.transform[4],t.transform[5]), h=Math.hypot(t.transform[2],t.transform[3])||t.height||8; return {s:t.str,x,y,w:t.width,h}; }); }
  const inside=S.texts[S.pageNum].filter(t=>{ const cx=t.x+t.w/2, cy=t.y-t.h/2; return cx>=r.x&&cx<=r.x+r.w&&cy>=r.y&&cy<=r.y+r.h; }).sort((a,b)=>a.y-b.y||a.x-b.x);
  const lines=[]; for(const t of inside){ const l=lines.find(l=>Math.abs(l.y-t.y)<t.h*0.6); if(l) l.items.push(t); else lines.push({y:t.y,items:[t]}); }
  const txt=lines.map(l=>l.items.sort((a,b)=>a.x-b.x).map(t=>t.s).join(' ')).join(' ').replace(/\s+/g,' ').trim();
  if(txt) return {text:txt,source:'texte du PDF'};
  busy('Reconnaissance du texte (OCR)…');
  try{ if(!globalThis.Tesseract) await new Promise((ok,ko)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js'; s.onload=ok; s.onerror=()=>ko(new Error('Tesseract.js non chargé')); document.head.append(s); });
    S.ocr=S.ocr||await globalThis.Tesseract.createWorker('fra',1);
    const sc=Math.min(8,Math.max(2,1200/Math.max(r.w,r.h))), c=document.createElement('canvas'); c.width=Math.ceil(r.w*sc); c.height=Math.ceil(r.h*sc);
    await S.page.render({canvasContext:c.getContext('2d'),viewport:S.page.getViewport({scale:sc}),transform:[1,0,0,1,-r.x*sc,-r.y*sc]}).promise;
    const {data}=await S.ocr.recognize(c); return {text:(data.text||'').replace(/\s+/g,' ').trim(),source:'OCR'}; }
  finally{ busy(''); }
}
async function ocrRect(r){
  try{ const {text,source}=await textInRect(r);
    if(!text) toast('Aucun texte lisible dans ce cadre : saisissez l’étiquette.','error');
    openLabel({x:r.x+r.w/2,y:r.y+r.h/2},text?parseLabelText(text):{name:'',cat:'',typo:'',surface:null},text?`Lu (${source}) : « ${text} »`:''); }
  catch(e){ S.rect=null; draw(); toast('Lecture du texte impossible : '+e.message,'error'); }
}

/* ---------- Dessin ---------- */
function draw(){ cancelAnimationFrame(S.raf); S.raf=requestAnimationFrame(paint); }
function tag(ctx,lines,x,y,color,anchor='center'){ ctx.font='600 12px "IBM Plex Sans",sans-serif'; const w=Math.max(...lines.map(l=>ctx.measureText(l).width))+12, h=lines.length*15+6;
  const bx=anchor==='center'?x-w/2:x, by=anchor==='center'?y-h/2:y;
  ctx.fillStyle='rgba(255,255,255,.94)'; ctx.strokeStyle=color; ctx.lineWidth=1.2; ctx.beginPath(); ctx.roundRect(bx,by,w,h,5); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#18201d'; ctx.textAlign='left'; ctx.textBaseline='middle'; lines.forEach((l,i)=>{ ctx.font=(i?'400':'600')+' 12px "IBM Plex Sans",sans-serif'; ctx.fillText(l,bx+6,by+3+7.5+i*15); });
  return {x:bx,y:by,w,h}; }
function poly(ctx,pts,closed){ ctx.beginPath(); pts.forEach((p,i)=>{ const s=toScreen(p); i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y); }); if(closed) ctx.closePath(); }
function dots(ctx,pts,color,numbered){ pts.forEach((p,i)=>{ const s=toScreen(p); ctx.beginPath(); ctx.arc(s.x,s.y,numbered?8:3,0,7); ctx.fillStyle=color; ctx.fill();
  if(numbered){ ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke(); ctx.fillStyle='#fff'; ctx.font='700 9px "IBM Plex Sans",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(i+1),s.x,s.y+.5); } }); }
function paint(){
  const dpr=devicePixelRatio||1, ctx=over.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,over.width,over.height); if(!S.vp) return;
  const cal=S.scales[S.pageNum];
  if(cal){ ctx.setLineDash([6,4]); ctx.strokeStyle=COLORS.cal; ctx.lineWidth=2; poly(ctx,cal.pts); ctx.stroke(); ctx.setLineDash([]); const a=toScreen(cal.pts[0]), b=toScreen(cal.pts[1]); tag(ctx,[`Étalon ${fmt(cal.meters)} m`],(a.x+b.x)/2,(a.y+b.y)/2-16,COLORS.cal); }
  for(const m of pageMeas()){ const c=COLORS[m.type], sel=isSel(m.id);
    if(m.type==='count'){ dots(ctx,m.pts,c,true); if(sel){ ctx.strokeStyle=c; ctx.lineWidth=2; m.pts.forEach(p=>{ const s=toScreen(p); ctx.beginPath(); ctx.arc(s.x,s.y,12,0,7); ctx.stroke(); }); }
      const s=toScreen(m.pts[m.pts.length-1]); tag(ctx,[`${m.name} · ${m.pts.length}`],s.x+14,s.y-10,c,'left'); continue; }
    if(m.type==='label'){ if(m.rect){ const a=toScreen(m.rect); ctx.setLineDash([3,3]); ctx.strokeStyle=c; ctx.lineWidth=1; ctx.strokeRect(a.x,a.y,m.rect.w*S.zoom,m.rect.h*S.zoom); ctx.setLineDash([]); }
      const s=toScreen(m.pts[0]), lines=[m.name,[m.typo,m.surface!=null?fmt(m.surface)+' m²':'',m.cat&&!isDwelling(m)?m.cat:''].filter(Boolean).join(' · ')].filter(Boolean);
      m._box=tag(ctx,lines,s.x,s.y,c); if(sel){ ctx.strokeStyle=c; ctx.lineWidth=2.5; ctx.strokeRect(m._box.x-2,m._box.y-2,m._box.w+4,m._box.h+4); } continue; }
    if(m.type==='area'){ ctx.beginPath(); for(const ring of [...ringsOf(m),...holesOf(m)]) ring.forEach((p,i)=>{ const q=toScreen(p); i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y); }), ctx.closePath();
      ctx.fillStyle=sel?'rgba(43,138,62,.28)':'rgba(167,200,87,.22)'; ctx.fill('evenodd'); ctx.strokeStyle=c; ctx.lineWidth=sel?3.5:2; ctx.setLineDash(m.auto?[8,3]:[]); ctx.stroke(); ctx.setLineDash([]); }
    else { poly(ctx,m.pts,false); ctx.strokeStyle=c; ctx.lineWidth=sel?3.5:2; ctx.stroke(); }
    if(sel){ ctx.fillStyle='#fff'; for(const p of [...ringsOf(m),...holesOf(m)].flat()){ const s=toScreen(p); ctx.fillRect(s.x-3.5,s.y-3.5,7,7); ctx.strokeRect(s.x-3.5,s.y-3.5,7,7); } }
    const at=m.type==='area'?toScreen(centroid(m.pts)):(()=>{ const i=Math.floor((m.pts.length-1)/2), a=toScreen(m.pts[i]), b=toScreen(m.pts[i+1]); return {x:(a.x+b.x)/2,y:(a.y+b.y)/2-16}; })();
    tag(ctx,[`${m.name} · ${valText(m)}`],at.x,at.y,c); }
  if(S.lasso?.active){ poly(ctx,S.lasso.pts,true); ctx.fillStyle='rgba(43,138,62,.10)'; ctx.fill(); ctx.setLineDash([6,4]); ctx.strokeStyle=COLORS.zone; ctx.lineWidth=1.5; ctx.stroke(); ctx.setLineDash([]); }
  if(S.rect){ const a=toScreen(S.rect); ctx.setLineDash([5,4]); ctx.strokeStyle=COLORS.ocr; ctx.lineWidth=1.5; ctx.fillStyle='rgba(11,114,133,.08)'; ctx.fillRect(a.x,a.y,S.rect.w*S.zoom,S.rect.h*S.zoom); ctx.strokeRect(a.x,a.y,S.rect.w*S.zoom,S.rect.h*S.zoom); ctx.setLineDash([]); }
  if(S.tool==='count'||S.tool==='access'){ dots(ctx,S.draft,COLORS.count,true); if(S.draft.length){ const s=toScreen(S.draft[S.draft.length-1]); tag(ctx,[`${S.draft.length} élément${S.draft.length>1?'s':''} · Entrée pour enregistrer`],s.x+14,s.y-10,COLORS.count,'left'); } }
  else if(['cal','len','area'].includes(S.tool)&&(S.draft.length||S.cursor)){ const c=COLORS[S.tool], pts=S.cursor?[...S.draft,S.cursor]:S.draft;
    if(pts.length>1){ poly(ctx,pts,S.tool==='area'&&pts.length>2); if(S.tool==='area'&&pts.length>2){ ctx.fillStyle='rgba(167,200,87,.18)'; ctx.fill(); } ctx.strokeStyle=c; ctx.lineWidth=2; ctx.setLineDash(S.tool==='cal'?[6,4]:[]); ctx.stroke(); ctx.setLineDash([]);
      const kk=k(), s=toScreen(pts[pts.length-1]), un=v=>v||'non étalonné';
      const txt=S.tool==='cal'?`${fmt(dist(pts[0],pts[1]),1)} pt`:S.tool==='len'?un(kk&&`${fmt(pathLength(pts)*kk)} m`):pts.length>2?un(kk&&`${fmt(polygonArea(pts)*kk*kk)} m²`):'';
      if(txt) tag(ctx,[txt],s.x+16,s.y+10,c,'left'); }
    dots(ctx,S.draft,c,false); }
  if(S.snap&&(S.cursor&&DRAW_TOOLS.includes(S.tool)||S.vdrag)){ const s=toScreen(S.snap); ctx.strokeStyle='#c2255c'; ctx.lineWidth=2;
    if(S.snap.kind==='vertex') ctx.strokeRect(s.x-6,s.y-6,12,12); else { ctx.beginPath(); ctx.moveTo(s.x-6,s.y-6); ctx.lineTo(s.x+6,s.y+6); ctx.moveTo(s.x+6,s.y-6); ctx.lineTo(s.x-6,s.y+6); ctx.stroke(); } }
}

/* ---------- Panneau ---------- */
function renderPanel(){
  const cal=S.scales[S.pageNum], box=$('scaleBox');
  box.className='scale'+(S.vp&&!cal?' todo':'');
  box.innerHTML=!S.vp?'<h2>Échelle</h2><p>Ouvrez un plan pour commencer.</p>'
    :cal?`<h2>Échelle de la page ${S.pageNum}</h2><p class="ratio">≈ 1:${Math.round(paperRatio(cal.k))}</p><p>Étalon de ${fmt(cal.meters)} m. Les mesures suivent l’échelle si vous la refaites.</p><button class="btn light" type="button" data-act="cal">Refaire l’étalonnage</button>`
    :`<h2>Page ${S.pageNum} non étalonnée</h2><p>Tracez une longueur connue (une cote, une trame) pour convertir les mesures en mètres.</p><button class="btn light" type="button" data-act="cal">Étalonner</button>`;
  const ms=pageMeas(), others=S.meas.length-ms.length, groups=summarize(S.meas,p=>S.scales[p]?.k||null).groups;
  const gtot=g=>[g.area.n?`${g.area.n} surface${g.area.n>1?'s':''}`:'',g.len.n?`${g.len.n} longueur${g.len.n>1?'s':''} · ${fmt(g.len.sum)} m`:'',g.count?`${g.count} u`:''].filter(Boolean).join(' ; ')||`${g.n} mesure${g.n>1?'s':''}`;
  const row=m=>{ const {p}=valueOf(m), meta=metaText(m).replace(/ · Groupe .*$|^Groupe .*$/,''); return `<div class="row ${isSel(m.id)?'sel':''}" data-id="${m.id}"><span class="nm"><b>${esc(m.name)}</b>${meta?`<span class="meta">${esc(meta)}</span>`:''}</span><span class="val">${esc(valText(m))}${p!=null?`<small>périmètre ${fmt(p)} m</small>`:''}</span><button class="del" type="button" title="Supprimer" aria-label="Supprimer ${esc(m.name)}" data-del="${m.id}">×</button></div>`; };
  // Bloc repliable : la flèche réduit ou déplie, l'état est gardé (clé « g:nom » pour un groupe, « t:type » pour un type).
  const fold=(key,title,total,body,extra='')=>{ const open=!S.folded.has(key); return `<div class="group${open?'':' folded'}"><div class="group-head"${extra}><button class="fold" type="button" data-fold="${esc(key)}" aria-expanded="${open}" title="${open?'Réduire':'Déplier'}">${open?'▾':'▸'}</button><h2>${title}</h2><b>${total}</b></div>${open?body:''}</div>`; };
  const typeBlocks=list=>['label','area','len','count'].map(t=>{ const g=list.filter(m=>m.type===t); if(!g.length) return '';
    const tot=t==='label'?null:g.reduce((s,m)=>s+(valueOf(m).v||0),0), u={len:'m',area:'m²',count:'u'}[t];
    return fold('t:'+t,`<i class="sw ${t}"></i>${TYPES[t]} (${g.length})`,tot!=null&&(t==='count'||k())?fmt(tot,t==='count'?0:2)+' '+u:'',g.map(row).join('')); }).join('');
  const names=[...new Set([...S.groups,...groups.map(g=>g.group)])], selN=S.multi.size||(S.sel?1:0);
  const title=g=>S.renaming===g.group?`<input class="grp-rename" data-rename="${esc(g.group)}" value="${esc(g.group)}" aria-label="Nom du groupe">`
    :`<span class="grp-name" data-group="${esc(g.group)}" title="Clic : sélectionner ses mesures ; double-clic : renommer">${esc(g.group)}</span> <small>${esc(g.n?gtot(g):'vide')}</small>`;
  const acts=g=>`<span class="grp-acts"><button type="button" data-gadd="${esc(g.group)}" title="Ajouter la sélection au groupe" ${selN?'':'disabled'}>＋</button><button type="button" data-gren="${esc(g.group)}" title="Renommer">✎</button><button type="button" data-gdel="${esc(g.group)}" title="Supprimer le groupe (les mesures sont gardées)">×</button></span>`;
  $('list').innerHTML=S.vp?(`<div class="list-tools"><button class="btn light" type="button" data-act="newgroup" title="${selN?'Crée un groupe avec la sélection':'Crée un groupe vide'}">+ Nouveau groupe</button></div>`+names.map(name=>{ const g=groups.find(x=>x.group===name)||{group:name,n:0,area:{n:0},len:{n:0},count:0}, mine=ms.filter(m=>m.group===name), away=g.n-mine.length;
      return fold('g:'+name,title(g),(g.area.n?fmt(g.area.sum)+' m²':'')+acts(g),
        `<div class="grp-body">${mine.map(row).join('')}${away?`<p class="none">${away} mesure${away>1?'s':''} du groupe sur d’autres pages.</p>`:''}${g.n?'':'<p class="none">Sélectionnez des mesures puis ＋ pour les ajouter.</p>'}</div>`); }).join('')
    +typeBlocks(ms.filter(m=>!m.group))||'<p class="none">Aucune mesure sur cette page. Choisissez un outil à gauche.</p>')+(others?`<p class="none">${others} mesure${others>1?'s':''} sur d’autres pages.</p>`:''):'';
  $('csvBtn').disabled=!S.meas.length; renderProps(); renderCorr(); if(!$('sheet').hidden) renderSheet();
  const ri=$('list').querySelector('.grp-rename'); if(ri){ ri.focus(); ri.select(); }
}
// Fiche de la mesure sélectionnée : nom et attributs modifiables.
function renderProps(){
  const box=$('props');
  if(S.multi.size>1){ const ms=S.meas.filter(m=>S.multi.has(m.id)), area=ms.filter(m=>m.type==='area'||m.type==='label').reduce((a,m)=>a+(valueOf(m).v||0),0), groups=[...new Set(ms.map(m=>m.group).filter(Boolean))];
    box.hidden=false; box.innerHTML=`<h2>${ms.length} mesures sélectionnées${area?` · ${fmt(area)} m²`:''}</h2><div class="grid"><label class="full">Nom du groupe<input id="groupName" list="dlGroup" autocomplete="off" value="${esc(groups.length===1?groups[0]:'')}" placeholder="ex. Logement 3, Rangements"></label></div>`+
      `<div class="acts"><button class="btn primary" type="button" data-act="group">Grouper</button><button class="btn light" type="button" data-act="ungroup">Retirer du groupe</button><button class="btn danger" type="button" data-act="delmulti">Supprimer</button></div>`; return; }
  const m=S.meas.find(x=>x.id===S.sel); box.hidden=!m; if(!m) return;
  const f=(key,label,cls='',list='')=>`<label class="${cls}">${label}<input data-k="${key}" value="${esc(m[key]??'')}" ${list?`list="${list}"`:''} autocomplete="off"></label>`;
  box.innerHTML=`<h2>${ONE[m.type]} · ${esc(valText(m))}</h2><div class="grid">${f('name','Nom','full')}${f('cat','Élément','','dlCat')}${f('typo','Typologie','','dlTypo')}${f('lot','Logement','','dlLot')}${f('group','Groupe','','dlGroup')}`+
    (m.type==='len'?`<label class="full">Cote<select data-k="role">${[['longueur','Longueur'],['largeur','Largeur'],['','Autre']].map(([v,l])=>`<option value="${v}" ${(m.role||'')===v?'selected':''}>${l}</option>`).join('')}</select></label>`:'')+
    (m.type==='label'?`<label class="full">Surface (m²)<input data-k="surface" inputmode="decimal" value="${m.surface!=null?String(m.surface).replace('.',','):''}" autocomplete="off"></label>`:'')+
    `</div><div class="acts"><button class="btn light" type="button" data-act="ctx" title="Les prochaines mesures prendront cet élément, cette typologie et ce logement">Réutiliser ces attributs</button><button class="btn danger" type="button" data-act="del">Supprimer</button></div>`;
}
$('props').addEventListener('change',e=>{ const m=S.meas.find(x=>x.id===S.sel), key=e.target.dataset.k; if(!m||!key) return;
  const v=e.target.value.trim();
  if(key==='surface'){ const n=parseFloat(v.replace(/\s/g,'').replace(',','.')); m.surface=isFinite(n)&&n>0?n:null; }
  else if(key==='name') m.name=v||m.name; else m[key]=v;
  save(); refreshLists(); renderPanel(); draw(); });
$('props').addEventListener('click',e=>{ const a=e.target.closest('[data-act]')?.dataset.act;
  if(a==='group'||a==='ungroup'){ const name=a==='group'?$('groupName').value.trim():''; if(a==='group'&&!name){ $('groupName').focus(); return toast('Donnez un nom au groupe.','error'); }
    S.meas.forEach(m=>{ if(S.multi.has(m.id)) m.group=name; }); save(); refreshLists(); renderPanel(); draw(); return toast(a==='group'?`${S.multi.size} mesures dans le groupe « ${name} ».`:'Mesures retirées de leur groupe.'); }
  if(a==='delmulti'){ const n=S.multi.size; S.meas=S.meas.filter(m=>!S.multi.has(m.id)); S.multi.clear(); S.sel=null; save(); renderPanel(); draw(); return toast(`${n} mesures supprimées.`); }
  const m=S.meas.find(x=>x.id===S.sel); if(!m) return;
  if(a==='del') remove(m.id);
  if(a==='ctx'){ Object.assign(S.ctx,{lot:isDwelling(m)?m.name:m.lot||'',typo:m.typo||'',cat:isDwelling(m)?'':m.cat||''}); syncCtx(); save(); toast('Attributs repris pour les prochaines mesures.'); } });
$('scaleBox').addEventListener('click',e=>{ if(e.target.closest('[data-act=cal]')) setTool('cal'); });
$('list').addEventListener('click',e=>{ const d=e.target.closest('[data-del]'); if(d) return remove(+d.dataset.del);
  if(e.target.closest('[data-act=newgroup]')){ let n=S.groups.length+1, name; const used=new Set([...S.groups,...S.meas.map(m=>m.group).filter(Boolean)]); do name=`Groupe ${n++}`; while(used.has(name));
    S.groups.push(name); S.meas.forEach(m=>{ if(isSel(m.id)) m.group=name; }); S.folded.delete('g:'+name); S.renaming=name; save(); refreshLists(); return renderPanel(); }
  const ga=e.target.closest('[data-gadd]'); if(ga){ const name=ga.dataset.gadd; let n=0; S.meas.forEach(m=>{ if(isSel(m.id)){ m.group=name; n++; } }); save(); refreshLists(); renderPanel(); draw(); return toast(`${n} mesure${n>1?'s':''} ajoutée${n>1?'s':''} à « ${name} ».`); }
  const gr2=e.target.closest('[data-gren]'); if(gr2){ S.renaming=gr2.dataset.gren; return renderPanel(); }
  const gd=e.target.closest('[data-gdel]'); if(gd){ const name=gd.dataset.gdel, n=S.meas.filter(m=>m.group===name).length; S.meas.forEach(m=>{ if(m.group===name) m.group=''; }); S.groups=S.groups.filter(g=>g!==name); save(); refreshLists(); renderPanel(); draw(); return toast(`Groupe « ${name} » supprimé${n?`, ${n} mesure${n>1?'s':''} gardée${n>1?'s':''} sans groupe`:''}.`); }
  if(e.target.closest('.grp-rename')) return;
  const f=e.target.closest('[data-fold]'); if(f){ const k=f.dataset.fold; S.folded.has(k)?S.folded.delete(k):S.folded.add(k); pref('folded',JSON.stringify([...S.folded])); return renderPanel(); }
  const gr=e.target.closest('[data-group]'); if(gr){ const ids=pageMeas().filter(m=>m.group===gr.dataset.group).map(m=>m.id); S.multi=new Set(ids.length>1?ids:[]); S.sel=ids[0]??null; if(!ids.length) toast('Aucune mesure de ce groupe sur cette page.'); renderPanel(); return draw(); }
  const r=e.target.closest('.row'); if(!r) return;
  if(e.shiftKey||e.metaKey) return pick(S.meas.find(x=>x.id===+r.dataset.id),true);
  S.multi.clear(); S.sel=+r.dataset.id; const m=S.meas.find(x=>x.id===S.sel), c=m.type==='area'?centroid(m.pts):m.pts[0];
  S.ox=view.clientWidth/2-c.x*S.zoom; S.oy=view.clientHeight/2-c.y*S.zoom; viewChanged(); renderPanel(); });

// Renommer : Entrée ou sortie du champ valide, Échap annule ; un nom déjà pris fusionne les deux groupes.
function commitRename(input,ok){ const old=input.dataset.rename, name=input.value.trim(); S.renaming=null;
  if(ok&&name&&name!==old){ const merge=S.groups.includes(name)||S.meas.some(m=>m.group===name); S.meas.forEach(m=>{ if(m.group===old) m.group=name; });
    S.groups=[...new Set(S.groups.map(g=>g===old?name:g))]; if(!S.groups.includes(name)) S.groups.push(name);
    if(S.folded.delete('g:'+old)) S.folded.add('g:'+name); pref('folded',JSON.stringify([...S.folded])); save(); refreshLists(); if(merge) toast(`Groupe fusionné avec « ${name} ».`); }
  renderPanel(); draw(); }
$('list').addEventListener('keydown',e=>{ if(!e.target.matches('.grp-rename')) return; if(e.key==='Enter'){ e.preventDefault(); commitRename(e.target,true); } if(e.key==='Escape'){ e.preventDefault(); commitRename(e.target,false); } });
$('list').addEventListener('focusout',e=>{ if(e.target.matches('.grp-rename')&&S.renaming) commitRename(e.target,true); });
$('list').addEventListener('dblclick',e=>{ const g=e.target.closest('.grp-name'); if(g){ S.renaming=g.dataset.group; renderPanel(); } });

/* ---------- Correspondance ExtracTerre ---------- */
const KIND={longueur:'Longueur',largeur:'Largeur',surface:'Surface',quantite:'Quantité'};
const corrRows=()=>correspondence(S.meas,p=>S.scales[p]?.k||null);
function renderCorr(){ const box=$('corr'); box.hidden=!EMBED||!S.vp; if(box.hidden) return;
  const rows=corrRows(), unit=r=>r.kind==='surface'?'m²':'m';
  box.innerHTML=`<h2>Correspondance ExtracTerre</h2>`+(rows.length?rows.map((r,i)=>`<div class="corr-row" data-corr="${i}"><span class="corr-head"><i class="sw ${r.kind==='quantite'?'count':r.kind==='surface'?'area':'len'}"></i>${KIND[r.kind]}<small>${r.n} mesure${r.n>1?'s':''}</small></span>
    <span class="corr-val">${r.kind==='quantite'?`${fmt(r.total,0)} u`:`moy ${fmt(r.avg)} ${unit(r)}<small>min ${fmt(r.min)} · max ${fmt(r.max)}</small>`}</span>
    ${r.kind==='quantite'?`<label>Colonne ExtracTerre<select data-corr-field>${[['','Aucune (mot-clé seul)'],...XT.quantities.map(q=>[q.key,q.label])].map(([v,l])=>`<option value="${esc(v)}"${v===r.field?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`:''}
    <label>Référence<input data-corr-ref value="${esc(r.ref)}" list="dlCat" autocomplete="off"></label></div>`).join('')
    :'<p class="none">Mesurez des longueurs, largeurs, surfaces ou comptages : ils apparaissent ici, regroupés par élément.</p>');
  $('sendBtn').disabled=!rows.length; }
// Modifier une ligne modifie toutes ses mesures ; une colonne choisie donne aussi son nom à la référence.
$('corr').addEventListener('change',e=>{ const i=e.target.closest('[data-corr]')?.dataset.corr; if(i==null) return; const r=corrRows()[+i], ids=new Set(r.ids), v=e.target.value.trim();
  for(const m of S.meas) if(ids.has(m.id)){ if(e.target.matches('[data-corr-field]')){ m.field=v; if(v) m.ref=XT.quantities.find(q=>q.key===v)?.label||m.ref; } else m.ref=v; }
  save(); renderPanel(); });
$('sendBtn').addEventListener('click',()=>{ const rows=corrRows().map(({ids,...r})=>r);
  const uncal=[...new Set(S.meas.filter(m=>(m.type==='len'||m.type==='area')&&!S.scales[m.page]?.k).map(m=>m.page))];
  window.parent.postMessage({type:'ashton:table',docId:XT.docId,docName:S.name,rows,uncalibratedPages:uncal,sentAt:Date.now()},location.origin);
  toast(`${rows.length} ligne${rows.length>1?'s':''} envoyée${rows.length>1?'s':''} vers ExtracTerre.${uncal.length?` Page${uncal.length>1?'s':''} ${uncal.join(', ')} non étalonnée${uncal.length>1?'s':''} : mesures dessinées non comptées.`:''}`,'success'); });
if(EMBED){ window.addEventListener('message',e=>{ if(e.origin!==location.origin||e.source!==window.parent) return; const d=e.data||{};
    if(d.type==='ashton:open'&&d.file){ XT.docId=String(d.docId||''); XT.quantities=Array.isArray(d.quantities)?d.quantities:[]; openFile(d.file); } });
  window.parent.postMessage({type:'ashton:ready'},location.origin); }

/* ---------- Attributs des nouvelles mesures ---------- */
function syncCtx(){ $('ctxLot').value=S.ctx.lot; $('ctxTypo').value=S.ctx.typo; $('ctxCat').value=S.ctx.cat; const r=document.querySelector(`input[name=role][value="${S.ctx.role||''}"]`); if(r) r.checked=true; }
[['ctxLot','lot'],['ctxTypo','typo'],['ctxCat','cat']].forEach(([id,key])=>$(id).addEventListener('input',e=>{ S.ctx[key]=e.target.value.trim(); save(); }));
document.querySelectorAll('input[name=role]').forEach(r=>r.addEventListener('change',()=>{ S.ctx.role=r.value; save(); }));
function refreshLists(){ const opts=(id,vals)=>{ $(id).innerHTML=[...new Set(vals.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{numeric:true})).map(v=>`<option value="${esc(v)}">`).join(''); };
  opts('dlLot',S.meas.map(m=>m.lot).concat(S.meas.filter(isDwelling).map(m=>m.name)));
  opts('dlTypo',['T1','T2','T3','T4','T5','T6',...S.meas.map(m=>m.typo)]);
  opts('dlCat',[...DEFAULT_ELEMENTS,...S.meas.map(m=>m.cat)]);
  opts('dlGroup',S.meas.map(m=>m.group)); }

/* ---------- Tableau des surfaces ---------- */
const STAT_COLS=['min','moy','max'];
function tables(){ const sum=summarize(S.meas,p=>S.scales[p]?.k||null), f=(s,key)=>s.n?fmt(s[key==='moy'?'avg':key]):'';
  return [
    {title:'Typologies de logement',empty:'Placez une étiquette par logement (outil Étiquette ou Étiquette OCR) avec sa typologie et sa surface.',
      cols:['Typologie','Logements',...STAT_COLS.map(c=>`Surface ${c} (m²)`),'Surface totale (m²)'],
      rows:sum.dwellings.map(d=>[d.typo,d.n,...STAT_COLS.map(c=>f(d.surface,c)),f(d.surface,'sum')])},
    {title:'Pièces et éléments',empty:'Mesurez des surfaces, longueurs ou largeurs avec un élément (Chambre, Rangement…) et une typologie.',
      cols:['Typologie','Élément','Nb surfaces',...STAT_COLS.map(c=>`Surface ${c} (m²)`),'Surface totale (m²)','Nb longueurs',...STAT_COLS.map(c=>`Longueur ${c} (m)`),'Nb largeurs',...STAT_COLS.map(c=>`Largeur ${c} (m)`)],
      rows:sum.elements.filter(e=>e.area.n||e.len.n||e.wid.n).map(e=>[e.typo,e.cat,e.area.n||'',...STAT_COLS.map(c=>f(e.area,c)),f(e.area,'sum'),e.len.n||'',...STAT_COLS.map(c=>f(e.len,c)),e.wid.n||'',...STAT_COLS.map(c=>f(e.wid,c))])},
    {title:'Groupes',empty:'Sélectionnez plusieurs mesures (Maj + clic) puis « Grouper ».',cols:['Groupe','Mesures','Nb surfaces','Surface totale (m²)',...STAT_COLS.map(c=>`Surface ${c} (m²)`),'Nb longueurs','Longueur totale (m)','Comptage'],
      rows:sum.groups.map(g=>[g.group,g.n,g.area.n||'',f(g.area,'sum'),...STAT_COLS.map(c=>f(g.area,c)),g.len.n||'',f(g.len,'sum'),g.count||''])},
    {title:'Comptages',empty:'Utilisez l’outil Comptage, avec un élément (ex. Prise, Fenêtre, Place de parking).',cols:['Élément','Typologie','Quantité'],rows:sum.counts.map(c=>[c.cat,c.typo,c.n])}];
}
function renderSheet(){
  const uncal=[...new Set(S.meas.filter(m=>(m.type==='len'||m.type==='area')&&!S.scales[m.page]?.k).map(m=>m.page))];
  $('sheetBody').innerHTML=(uncal.length?`<p class="none">Page${uncal.length>1?'s':''} ${uncal.join(', ')} non étalonnée${uncal.length>1?'s':''} : leurs longueurs et surfaces dessinées ne sont pas comptées.</p>`:'')+
    tables().map(t=>`<h3>${t.title}</h3>`+(t.rows.length?`<table class="tbl"><thead><tr>${t.cols.map((c,i)=>`<th class="${i<2?'l':''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map((v,i)=>`<td class="${i<2?'l':''}${v===''?' dim':''}">${v===''?'—':esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:`<p class="none">${t.empty}</p>`)).join('');
}
function sheetText(sep){ const q=v=>{ v=String(v??''); return sep===';'&&/[;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v.replace(/\t/g,' '); };
  return tables().flatMap(t=>[t.title,t.cols.map(q).join(sep),...t.rows.map(r=>r.map(q).join(sep)),'']).join('\r\n'); }
function toggleSheet(on){ $('sheet').hidden=!on; $('tableBtn').setAttribute('aria-pressed',String(on)); if(on) renderSheet(); }
$('tableBtn').addEventListener('click',()=>toggleSheet($('sheet').hidden));
$('closeSheet').addEventListener('click',()=>toggleSheet(false));
$('copyTable').addEventListener('click',async()=>{ try{ await navigator.clipboard.writeText(sheetText('\t')); toast('Tableau copié : collez-le dans Excel ou Google Sheets.','success'); }catch{ toast('Copie refusée par le navigateur : utilisez le téléchargement CSV.','error'); } });
const download=(text,name)=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['﻿'+text],{type:'text/csv'})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); };
const baseName=()=>S.name.replace(/\.pdf$/i,'');
$('csvTable').addEventListener('click',()=>download(sheetText(';'),`${baseName()} - tableau des surfaces.csv`));

function exportCsv(){
  const n=(v,d=2)=>v==null?'':String(Math.round(v*10**d)/10**d).replace('.',',');
  const rows=[['Nom','Type','Élément','Typologie','Logement','Groupe','Cote','Page','Valeur','Unité','Périmètre (m)','Échelle']];
  for(const m of [...S.meas].sort((a,b)=>a.page-b.page||a.id-b.id)){ const {v,u,p}=valueOf(m), kk=S.scales[m.page]?.k;
    rows.push([m.name,ONE[m.type],m.cat||'',m.typo||'',m.lot||'',m.group||'',m.type==='len'?m.role||'':'',m.page,n(v,m.type==='count'?0:2),v==null?'':u,m.type==='area'?n(p):'',m.type==='count'||m.type==='label'?'':kk?`1:${Math.round(paperRatio(kk))}`:'non étalonnée']); }
  download(rows.map(r=>r.map(c=>/[;"\n]/.test(String(c))?`"${String(c).replace(/"/g,'""')}"`:c).join(';')).join('\r\n'),`${baseName()} - mesures.csv`);
}
$('csvBtn').addEventListener('click',exportCsv);

// Mesures, échelles et attributs gardés dans ce navigateur, par fichier (nom + taille).
function save(){ if(!S.key) return; try{ localStorage.setItem(S.key,JSON.stringify({meas:S.meas.map(({_box,...m})=>m),scales:S.scales,nextId:S.nextId,ctx:S.ctx,groups:S.groups})); }catch{} }
function load(){ let d=null; try{ d=JSON.parse(localStorage.getItem(S.key)||'null'); }catch{}
  S.meas=Array.isArray(d?.meas)?d.meas:[]; S.scales=d?.scales&&typeof d.scales==='object'?d.scales:{}; S.nextId=d?.nextId||S.meas.reduce((a,m)=>Math.max(a,m.id+1),1);
  S.groups=Array.isArray(d?.groups)?d.groups.filter(g=>typeof g==='string'&&g.trim()):[];
  if(d?.ctx) Object.assign(S.ctx,d.ctx); syncCtx(); refreshLists();
  if(S.meas.length) toast(`${S.meas.length} mesure${S.meas.length>1?'s':''} retrouvée${S.meas.length>1?'s':''} pour ce plan.`); }

/* ---------- Événements ---------- */
let pan=null, space=false, drag=null;
view.addEventListener('pointerdown',e=>{ if(!S.vp||e.target.closest('.empty')) return; view.setPointerCapture(e.pointerId);
  if(S.tool==='edit'&&e.button===0&&!space){ const h=handleAt(e); if(h){ S.vdrag=h; S.sel=h.m.id; renderPanel(); draw(); return; }
    const m=hit(toPage(e)); if(m){ pick(m,e.shiftKey); return; } }
  if(e.button===1||e.button===0&&(S.tool==='pan'||S.tool==='edit'||space)){ pan={x:e.clientX,y:e.clientY,ox:S.ox,oy:S.oy,moved:false}; view.classList.add('panning'); return; }
  if(e.button!==0) return;
  if(S.tool==='ocr'){ drag=toPage(e); S.rect={x:drag.x,y:drag.y,w:0,h:0}; return; }
  if(S.tool==='label') return openLabel(toPage(e));
  // Zone auto : un clic calcule la pièce ; un glisser dessine un lasso (décidé au relâchement).
  if(S.tool==='zone'){ S.lasso={pts:[toPage(e)],x:e.clientX,y:e.clientY,mode:e.shiftKey?'add':e.altKey?'sub':'new',active:false}; return; }
  addPoint(pointFromEvent(e)); });
view.addEventListener('pointermove',e=>{ if(!S.vp) return;
  if(pan){ const dx=e.clientX-pan.x, dy=e.clientY-pan.y; if(Math.abs(dx)+Math.abs(dy)>3) pan.moved=true; S.ox=pan.ox+dx; S.oy=pan.oy+dy; viewChanged(); return; }
  if(S.lasso){ const L=S.lasso; if(!L.active&&Math.hypot(e.clientX-L.x,e.clientY-L.y)>6) L.active=true;
    if(L.active){ const p=toPage(e), q=L.pts[L.pts.length-1]; if(dist(p,q)*S.zoom>3) L.pts.push(p); draw(); } return; }
  if(S.vdrag){ const p=pointFromEvent(e), d=S.vdrag; d.arr[d.i]=d.cur={x:p.x,y:p.y}; S.cursor=null; return draw(); }
  if(S.tool==='edit') view.style.cursor=handleAt(e)?'move':'';
  if(drag){ const p=toPage(e); S.rect={x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),w:Math.abs(p.x-drag.x),h:Math.abs(p.y-drag.y)}; return draw(); }
  S.cursor=DRAW_TOOLS.includes(S.tool)?pointFromEvent(e):null; draw(); });
view.addEventListener('pointerup',e=>{
  if(S.vdrag) return endDrag();
  if(S.lasso){ const L=S.lasso; S.lasso=null; draw(); return L.active&&L.pts.length>=3?lassoZones(L.pts,L.mode):zoneAt(L.pts[0],L.mode); }
  if(drag){ drag=null; const r=S.rect; if(r&&r.w*S.zoom>6&&r.h*S.zoom>6) ocrRect(r); else { S.rect=null; draw(); } return; }
  if(!pan) return; const p=pan; pan=null; view.classList.remove('panning');
  if(!p.moved&&(S.tool==='pan'||S.tool==='edit')){ const m=hit(toPage(e)); if(m||!e.shiftKey) pick(m,e.shiftKey); } });
view.addEventListener('pointerleave',()=>{ S.cursor=null; S.snap=null; draw(); });
// Le double-clic a déjà posé deux points identiques : le comptage retire le doublon.
view.addEventListener('dblclick',e=>{ if(['len','area','count','access'].includes(S.tool)){ e.preventDefault(); if(S.tool==='count'||S.tool==='access') S.draft.pop(); finish(); } });
view.addEventListener('wheel',e=>{ if(!S.vp) return; e.preventDefault(); const r=view.getBoundingClientRect();
  zoomAt(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*(e.ctrlKey?0.01:0.0015))); },{passive:false});
view.addEventListener('contextmenu',e=>{ if(S.draft.length){ e.preventDefault(); finish(); } });
['dragenter','dragover'].forEach(t=>view.addEventListener(t,e=>{ e.preventDefault(); view.classList.add('drag'); }));
['dragleave','drop'].forEach(t=>view.addEventListener(t,e=>{ e.preventDefault(); view.classList.remove('drag'); if(t==='drop') openFile(e.dataTransfer.files[0]); }));
document.querySelectorAll('input[type=file]').forEach(i=>i.addEventListener('change',()=>{ openFile(i.files[0]); i.value=''; }));
$('pageSel').addEventListener('change',e=>showPage(+e.target.value));
document.querySelectorAll('.tool[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('snapBtn').addEventListener('click',()=>{ S.snapOn=!S.snapOn; $('snapBtn').setAttribute('aria-pressed',String(S.snapOn)); showSnapInfo(); draw(); });
$('fitBtn').addEventListener('click',fit);
document.addEventListener('keydown',e=>{
  if(e.target.closest('input,select,textarea,dialog')) return;
  if(e.key===' '){ space=true; e.preventDefault(); return; }
  if(e.metaKey||e.ctrlKey) return;
  const key=e.key.toLowerCase(), tools={v:'pan',e:'edit',k:'cal',l:'len',s:'area',z:'zone',c:'count',h:'access',t:'label',o:'ocr'};
  if(tools[key]&&S.vp) return setTool(tools[key]);
  if(key==='a') return $('snapBtn').click();
  if(key==='f') return fit();
  if(e.key==='Escape'){ if(!$('sheet').hidden) return toggleSheet(false); if(S.draft.length) S.draft=[]; else { S.sel=null; S.multi.clear(); } renderPanel(); return draw(); }
  if(e.key==='Enter') return finish();
  if(e.key==='Backspace'&&S.draft.length){ e.preventDefault(); S.draft.pop(); return draw(); }
  if((e.key==='Delete'||e.key==='Backspace')&&S.multi.size>1){ e.preventDefault(); return $('props').querySelector('[data-act=delmulti]')?.click(); }
  if((e.key==='Delete'||e.key==='Backspace')&&S.sel){ e.preventDefault(); remove(S.sel); }
});
document.addEventListener('keyup',e=>{ if(e.key===' ') space=false; });
view.classList.add('no-doc'); setTool('pan'); syncCtx(); refreshLists(); renderPanel();
