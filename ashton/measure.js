// Géométrie du métré, sans dépendance au navigateur (testée par test_measure.mjs).
// Toutes les coordonnées sont en points PDF de la page (échelle 1, axe y vers le bas).
export const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
export const pathLength=(pts,closed=false)=>{ let s=0; for(let i=1;i<pts.length;i++) s+=dist(pts[i-1],pts[i]); if(closed&&pts.length>2) s+=dist(pts[pts.length-1],pts[0]); return s; };
export const polygonArea=pts=>{ let s=0; for(let i=0;i<pts.length;i++){ const a=pts[i],b=pts[(i+1)%pts.length]; s+=a.x*b.y-b.x*a.y; } return Math.abs(s)/2; };
export const centroid=pts=>{ let a=0,cx=0,cy=0; for(let i=0;i<pts.length;i++){ const p=pts[i],q=pts[(i+1)%pts.length],f=p.x*q.y-q.x*p.y; a+=f; cx+=(p.x+q.x)*f; cy+=(p.y+q.y)*f; }
  if(Math.abs(a)<1e-9) return {x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length}; return {x:cx/(3*a),y:cy/(3*a)}; };

// Étalonnage : mètres par point PDF, à partir d'une longueur connue.
export const scaleFromCalibration=(a,b,meters)=>{ const d=dist(a,b); return d>0&&meters>0?meters/d:null; };
// Échelle papier équivalente (1 pt = 1/72 pouce) : 1:100 → 100.
export const paperRatio=k=>k/(0.0254/72);
// « 12,5 » / « 12.5 m » / « 1250 cm » / « 12 500 mm » → mètres ; null si illisible.
export function parseLength(s){ const m=String(s||'').replace(/[\s ]/g,'').replace(',','.').match(/^(\d+(?:\.\d+)?|\.\d+)(mm|cm|m)?$/i);
  if(!m) return null; const v=parseFloat(m[1]); if(!(v>0)) return null; return v/({mm:1000,cm:100,m:1}[(m[2]||'m').toLowerCase()]); }
export const fmt=(v,d=2)=>v==null||!isFinite(v)?'—':v.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});

// Contrainte orthogonale (Maj) : angle ramené au multiple de 45° le plus proche.
export function ortho(prev,p){ const d=dist(prev,p), a=Math.round(Math.atan2(p.y-prev.y,p.x-prev.x)/(Math.PI/4))*(Math.PI/4); return {x:prev.x+d*Math.cos(a),y:prev.y+d*Math.sin(a)}; }

// Points et segments des tracés vectoriels d'une page (liste d'opérations PDF.js), dédoublonnés.
// vt = viewport.transform à l'échelle 1 (points PDF → page, y vers le bas).
export function extractGeometry(fnArray,argsArray,OPS,vt){
  const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  let g={m:vt.slice(),sw:false,fw:false,sl:0,fl:0}; const stack=[]; const pts=[], segs=[], light=[], seenP=new Set(), seenS=new Set();
  const q=v=>Math.round(v*4); // dédoublonnage au quart de point
  const addP=(x,y)=>{ const k=q(x)+','+q(y); if(!seenP.has(k)){ seenP.add(k); pts.push(x,y); } };
  const addS=(x1,y1,x2,y2,l)=>{ if(Math.abs(x2-x1)+Math.abs(y2-y1)<0.5) return; let a=q(x1)+','+q(y1), b=q(x2)+','+q(y2); if(a>b) [a,b]=[b,a]; const k=a+'|'+b; if(!seenS.has(k)){ seenS.add(k); segs.push(x1,y1,x2,y2); light.push(l); } };
  // Trait clair (gris de projection, couleur pâle) : luminosité ≥ 100 sur 255.
  const luma=a=>typeof a?.[0]==='string'?(n=>0.3*(n>>16&255)+0.59*(n>>8&255)+0.11*(n&255))(parseInt(a[0].replace('#',''),16)):a?.length>=3?0.3*a[0]+0.59*a[1]+0.11*a[2]:0;
  const white=a=>typeof a?.[0]==='string'?/^#?f{6}$/i.test(a[0]):a?.length>=3&&a[0]>=250&&a[1]>=250&&a[2]>=250;
  const STROKE=new Set([OPS.stroke,OPS.closeStroke]), FILL=new Set([OPS.fill,OPS.eoFill]), BOTH=new Set([OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke]);
  // Le tracé n'est retenu qu'au moment où il est peint : les découpes (endPath) et le blanc sur blanc sont invisibles.
  let path=null;
  for(let i=0;i<fnArray.length;i++){ const f=fnArray[i], a=argsArray[i];
    if(f===OPS.save) stack.push({...g}); else if(f===OPS.restore) g=stack.pop()||g; else if(f===OPS.transform) g.m=mul(g.m,a);
    else if(f===OPS.paintFormXObjectBegin){ stack.push({...g}); if(a&&a[0]) g.m=mul(g.m,a[0]); } else if(f===OPS.paintFormXObjectEnd) g=stack.pop()||g;
    else if(f===OPS.setStrokeRGBColor){ g.sw=white(a); g.sl=luma(a)>=100; } else if(f===OPS.setFillRGBColor){ g.fw=white(a); g.fl=luma(a)>=100; }
    else if(f===OPS.setStrokeGray){ g.sw=a?.[0]>=0.98; g.sl=a?.[0]>=0.4; } else if(f===OPS.setFillGray){ g.fw=a?.[0]>=0.98; g.fl=a?.[0]>=0.4; }
    else if(f===OPS.constructPath){ const [ops,args]=a; let k=0; const m=g.m, T=(x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
      // Le point courant se poursuit d'une instruction à l'autre du même tracé ; sans point courant, pas de segment.
      path=path||{p:[],s:[],cx:null,cy:null,sx:null,sy:null}; const P=path;
      const line=(x,y)=>{ if(P.cx!==null) P.s.push(P.cx,P.cy,x,y); P.p.push(x,y); P.cx=x; P.cy=y; };
      for(const op of ops){
        if(op===OPS.moveTo){ [P.cx,P.cy]=T(args[k],args[k+1]); P.sx=P.cx; P.sy=P.cy; P.p.push(P.cx,P.cy); k+=2; }
        else if(op===OPS.lineTo){ line(...T(args[k],args[k+1])); k+=2; }
        else if(op===OPS.rectangle){ const [x,y,w,h]=args.slice(k,k+4), c=[T(x,y),T(x+w,y),T(x+w,y+h),T(x,y+h)]; c.forEach((q,j)=>{ P.p.push(q[0],q[1]); const n=c[(j+1)%4]; P.s.push(q[0],q[1],n[0],n[1]); }); [P.cx,P.cy]=c[0]; P.sx=P.cx; P.sy=P.cy; k+=4; }
        else if(op===OPS.curveTo){ [P.cx,P.cy]=T(args[k+4],args[k+5]); P.p.push(P.cx,P.cy); k+=6; }
        else if(op===OPS.curveTo2||op===OPS.curveTo3){ [P.cx,P.cy]=T(args[k+2],args[k+3]); P.p.push(P.cx,P.cy); k+=4; }
        else if(op===OPS.closePath){ if(P.sx!==null&&P.cx!==null) P.s.push(P.cx,P.cy,P.sx,P.sy); P.cx=P.sx; P.cy=P.sy; } } }
    else if(path&&(STROKE.has(f)||FILL.has(f)||BOTH.has(f)||f===OPS.endPath)){
      const visible=STROKE.has(f)?!g.sw:FILL.has(f)?!g.fw:BOTH.has(f)?!(g.sw&&g.fw):false;
      const l=(STROKE.has(f)||BOTH.has(f)?g.sl:g.fl)?1:0;
      if(visible){ for(let j=0;j<path.p.length;j+=2) addP(path.p[j],path.p[j+1]); for(let j=0;j<path.s.length;j+=4) addS(path.s[j],path.s[j+1],path.s[j+2],path.s[j+3],l); }
      path=null; } }
  return {points:Float32Array.from(pts),segments:Float32Array.from(segs),light:Uint8Array.from(light)};
}

// Grille d'accroche : sommets prioritaires, puis point le plus proche sur un segment.
export class SnapIndex{
  constructor({points,segments,light},cell=6){ this.p=points; this.s=segments; this.light=light||new Uint8Array(segments.length/4); this.cell=cell;
    this.pc=this.#grid(points.length/2,(i,add)=>add(points[2*i],points[2*i+1]));
    this.sc=this.#grid(segments.length/4,(i,add)=>{ const x1=segments[4*i],y1=segments[4*i+1],x2=segments[4*i+2],y2=segments[4*i+3], n=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/(cell/2)));
      for(let t=0;t<=n;t++) add(x1+(x2-x1)*t/n,y1+(y2-y1)*t/n); }); }
  #key(x,y){ return Math.floor(x/this.cell)*73856093^Math.floor(y/this.cell)*19349663; }
  // Liste compacte cellule → éléments (deux passes : comptage puis remplissage).
  #grid(n,visit){ const count=new Map(); for(let i=0;i<n;i++){ let last=null; visit(i,(x,y)=>{ const k=this.#key(x,y); if(k!==last){ count.set(k,(count.get(k)||0)+1); last=k; } }); }
    const start=new Map(); let off=0; for(const [k,c] of count){ start.set(k,off); off+=c; } const items=new Int32Array(off), fill=new Map();
    for(let i=0;i<n;i++){ let last=null; visit(i,(x,y)=>{ const k=this.#key(x,y); if(k!==last){ const f=fill.get(k)||0; items[start.get(k)+f]=i; fill.set(k,f+1); last=k; } }); }
    return {start,count,items}; }
  *#near(g,x,y,r){ const c=this.cell; for(let gx=Math.floor((x-r)/c);gx<=Math.floor((x+r)/c);gx++) for(let gy=Math.floor((y-r)/c);gy<=Math.floor((y+r)/c);gy++){ const k=gx*73856093^gy*19349663, s=g.start.get(k); if(s===undefined) continue; for(let j=0;j<g.count.get(k);j++) yield g.items[s+j]; } }
  // Segments dont la cellule recoupe le rectangle (doublons possibles, filtrés par l'appelant).
  segmentsIn(x0,y0,x1,y1){ const out=new Set(), c=this.cell; for(let gx=Math.floor(x0/c);gx<=Math.floor(x1/c);gx++) for(let gy=Math.floor(y0/c);gy<=Math.floor(y1/c);gy++){ const k=gx*73856093^gy*19349663, st=this.sc.start.get(k); if(st===undefined) continue; for(let j=0;j<this.sc.count.get(k);j++) out.add(this.sc.items[st+j]); } return out; }
  vertexNear(x,y,r){ let best=null, bd=r; for(const i of this.#near(this.pc,x,y,r)){ const d=Math.hypot(this.p[2*i]-x,this.p[2*i+1]-y); if(d<=bd){ bd=d; best={x:this.p[2*i],y:this.p[2*i+1]}; } } return best; }
  query(x,y,r){ let best=null, bd=r;
    for(const i of this.#near(this.pc,x,y,r)){ const d=Math.hypot(this.p[2*i]-x,this.p[2*i+1]-y); if(d<=bd){ bd=d; best={x:this.p[2*i],y:this.p[2*i+1],kind:'vertex'}; } }
    if(best) return best; bd=r*0.7;
    for(const i of this.#near(this.sc,x,y,bd)){ const s=this.s, x1=s[4*i],y1=s[4*i+1],dx=s[4*i+2]-x1,dy=s[4*i+3]-y1, L=dx*dx+dy*dy; if(!L) continue;
      const t=Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/L)), px=x1+t*dx, py=y1+t*dy, d=Math.hypot(px-x,py-y); if(d<=bd){ bd=d; best={x:px,y:py,kind:'edge'}; } }
    return best; }
}

// ---------- Étiquettes ----------
const ROOMS=['Séjour','Cuisine','Chambre','Salle de bain','Salle d’eau','WC','Entrée','Dégagement','Rangement','Placard','Cellier','Buanderie','Garage','Bureau','Balcon','Terrasse','Palier','Cave','Loggia','Jardin'];
const ROOM_RE=[[/s[ée]jour|salon/i,'Séjour'],[/cuisine/i,'Cuisine'],[/chambre/i,'Chambre'],[/salle\s+de\s+bains?|\bsdb\b/i,'Salle de bain'],[/salle\s+d.eau|\bsde\b/i,'Salle d’eau'],[/\bwc\b/i,'WC'],
  [/entr[ée]e/i,'Entrée'],[/d[ée]gagement|\bdgt\b/i,'Dégagement'],[/rangement|\brgt\b/i,'Rangement'],[/placard|\bplac?\b/i,'Placard'],[/cellier/i,'Cellier'],[/buanderie/i,'Buanderie'],[/garage/i,'Garage'],
  [/bureau/i,'Bureau'],[/balcon/i,'Balcon'],[/terrasse/i,'Terrasse'],[/palier/i,'Palier'],[/\bcave\b/i,'Cave'],[/loggia/i,'Loggia'],[/jardin/i,'Jardin'],[/logement|\blgt\b|appartement|maison|villa/i,'Logement']];
export const DEFAULT_ELEMENTS=['Logement',...ROOMS];
// Texte d'un plan (« Chambre 2 14.26 m² », « Logement 3 - T3 - 65,2 m² ») → nom, élément, typologie, surface.
export function parseLabelText(text){
  const t=String(text||'').replace(/\s+/g,' ').trim();
  const s=t.match(/(\d+(?:[.,]\d+)?)\s*m\s*(?:²|2)(?![\d])/i), ty=t.match(/\b(?:T|F)\s?(\d{1,2})(\s?bis)?\b|\btype\s+(\d)\b/i);
  const cat=(ROOM_RE.find(([re])=>re.test(t))||[])[1]||'';
  const name=t.replace(s?s[0]:'','').replace(/\s*[-–·|,;]\s*$/,'').replace(/^\s*[-–·|,;]\s*/,'').trim();
  return {name:name||t,cat:cat||(ty?'Logement':''),typo:ty?`T${ty[1]||ty[3]}${ty[2]?' bis':''}`:'',surface:s?parseFloat(s[1].replace(',','.')):null};
}
// Étiquette de logement : sans élément ou d'élément « Logement » ; les autres étiquettes portent la surface d'une pièce.
// Une surface peut avoir plusieurs contours (zone automatique étendue avec Maj).
export const ringsOf=m=>[m.pts,...(m.more||[])];
export const holesOf=m=>m.holes||[];
export const areaOf=m=>ringsOf(m).reduce((a,r)=>a+polygonArea(r),0)-holesOf(m).reduce((a,r)=>a+polygonArea(r),0);
export const isDwelling=m=>m.type==='label'&&(!m.cat||/logement/i.test(m.cat));

// ---------- Tableau de surfaces ----------
export function stats(values){ const v=values.filter(x=>x!=null&&isFinite(x)); if(!v.length) return {n:0}; const sum=v.reduce((a,b)=>a+b,0); return {n:v.length,min:Math.min(...v),avg:sum/v.length,max:Math.max(...v),sum}; }
const natural=(a,b)=>a.localeCompare(b,'fr',{numeric:true,sensitivity:'base'});
// scaleOf(page) → mètres par point, ou null si la page n'est pas étalonnée (ses longueurs et surfaces dessinées sont alors ignorées).
export function summarize(meas,scaleOf){
  const typo=m=>(m.typo||'').trim()||'Sans typologie', cat=m=>(m.cat||'').trim()||'Sans élément';
  const dw=new Map(), el=new Map(), ct=new Map(), gr=new Map();
  const get=(map,key,init)=>map.get(key)||map.set(key,init()).get(key);
  for(const m of meas){ const k=scaleOf(m.page);
    // Groupes : totaux par groupe nommé, tous types confondus (surfaces dessinées ou étiquetées, longueurs, comptages).
    if((m.group||'').trim()){ const g=get(gr,m.group.trim(),()=>({group:m.group.trim(),area:[],len:[],count:0,n:0})); g.n++;
      if(m.type==='area'&&k) g.area.push(areaOf(m)*k*k); else if(m.type==='label'&&m.surface!=null) g.area.push(m.surface); else if(m.type==='len'&&k) g.len.push(pathLength(m.pts)*k); else if(m.type==='count') g.count+=m.pts.length; }
    if(isDwelling(m)){ get(dw,typo(m),()=>({typo:typo(m),n:0,s:[]})).n++; get(dw,typo(m)).s.push(m.surface); continue; }
    if(m.type==='count'){ const r=get(ct,cat(m)+'|'+typo(m),()=>({cat:cat(m),typo:typo(m),n:0})); r.n+=m.pts.length; continue; }
    const r=get(el,typo(m)+'|'+cat(m),()=>({typo:typo(m),cat:cat(m),area:[],len:[],wid:[],other:[]}));
    if(m.type==='label') r.area.push(m.surface);
    else if(m.type==='area'&&k) r.area.push(areaOf(m)*k*k);
    else if(m.type==='len'&&k) r[m.role==='largeur'?'wid':m.role==='longueur'?'len':'other'].push(pathLength(m.pts)*k); }
  return {
    dwellings:[...dw.values()].sort((a,b)=>natural(a.typo,b.typo)).map(r=>({typo:r.typo,n:r.n,surface:stats(r.s)})),
    elements:[...el.values()].sort((a,b)=>natural(a.typo,b.typo)||natural(a.cat,b.cat)).map(r=>({typo:r.typo,cat:r.cat,area:stats(r.area),len:stats(r.len),wid:stats(r.wid),other:stats(r.other)})),
    counts:[...ct.values()].sort((a,b)=>natural(a.cat,b.cat)||natural(a.typo,b.typo)),
    groups:[...gr.values()].sort((a,b)=>natural(a.group,b.group)).map(g=>({group:g.group,n:g.n,area:stats(g.area),len:stats(g.len),count:g.count}))};
}

// ---------- Correspondance ExtracTerre ----------
// Une ligne par type de cote (longueur, largeur, surface, quantité) et référence : la référence choisie (m.ref, ou la
// colonne ExtracTerre m.field pour une quantité), sinon l'élément et la typologie, sinon le groupe. Longueurs, largeurs et
// surfaces : min / moy / max des mesures ; quantité : total des éléments comptés. Pages non étalonnées : mesures écartées.
export const CORR_KINDS=['longueur','largeur','surface','quantite'];
export function correspondence(meas,scaleOf){
  const rows=new Map();
  for(const m of meas){ const k=scaleOf(m.page);
    const kind=m.type==='count'?'quantite':m.type==='area'||m.type==='label'?'surface':m.type==='len'?(m.role==='largeur'?'largeur':'longueur'):null; if(!kind) continue;
    const v=m.type==='count'?m.pts.length:m.type==='label'?m.surface:!k?null:m.type==='area'?areaOf(m)*k*k:pathLength(m.pts)*k;
    if(v==null||!isFinite(v)) continue;
    const auto=[isDwelling(m)?'Logement':(m.cat||'').trim(),(m.typo||'').trim()].filter(Boolean).join(' ')||(m.group||'').trim()||(m.type==='count'?m.name:'Sans élément');
    const ref=(m.ref||'').trim()||auto, field=kind==='quantite'?(m.field||''):'';
    const key=`${kind}|${field||ref.toLowerCase()}`;
    const r=rows.get(key)||rows.set(key,{key,kind,ref,field,values:[],ids:[],pages:new Set()}).get(key);
    r.values.push(v); r.ids.push(m.id); r.pages.add(m.page); }
  return [...rows.values()].sort((a,b)=>CORR_KINDS.indexOf(a.kind)-CORR_KINDS.indexOf(b.kind)||natural(a.ref,b.ref)).map(({values,pages,...r})=>{ const st=stats(values);
    return {...r,n:values.length,pages:[...pages].sort((a,b)=>a-b),...(r.kind==='quantite'?{total:st.sum}:{min:st.min,avg:st.avg,max:st.max})}; });
}

// ---------- Zone automatique ----------
// Remplissage depuis un clic, borné par les traits du plan. Les ouvertures plus étroites que « gap » (portes) sont fermées
// d'un trait droit au nu des murs : l'espace libre est « ouvert » par un carré de côté gap (érosion puis dilatation).
// Les traits isolés (pointillés, projections) ne bornent pas la zone. Coordonnées en points PDF, gap en points.
export function autoZone(index,seeds,opts={}){
  // Les traits clairs (projections, lucarnes) ne bornent pas la zone ; si elle fuit sans eux, on les reprend.
  const z=zoneOnce(index,seeds,{...opts,skipLight:true}); return z.error==='open'&&index.light.some(Boolean)?zoneOnce(index,seeds,{...opts,skipLight:false}):z; }
function zoneOnce(index,seeds,{gap,minus=[],furn=gap*2.9,maxHalf=1600,maxPixels=9e6,debug=null,skipLight}){
  if(!seeds.length) return {error:'seed'};
  const all=[...seeds,...minus], bx0=Math.min(...all.map(p=>p.x)), bx1=Math.max(...all.map(p=>p.x)), by0=Math.min(...all.map(p=>p.y)), by1=Math.max(...all.map(p=>p.y));
  for(let half=Math.max(150,gap*6);;half*=2){
    const x0=bx0-half, y0=by0-half, wPt=bx1-bx0+2*half, hPt=by1-by0+2*half, res=Math.min(4,Math.sqrt(maxPixels/(wPt*hPt)));
    const W=Math.ceil(wPt*res), H=Math.ceil(hPt*res), N=W*H, r=Math.max(1,Math.round(gap*res/2));
    // Cœurs : l'espace libre où tient le carré. Chaque cœur est une pièce ; le clic choisit les siennes.
    const ctx=f=>{ const obs=new Uint8Array(N); rasterize(index,x0,y0,x0+wPt,y0+hPt,res,W,H,obs,f,skipLight); const blk=dilate(obs,W,H,r); return {obs,core:label(blk,W,H),freeLab:null}; };
    const region=(pts,C)=>{ const {obs,core}=C, mine=new Set(), small=[];
      for(const s of pts){ const sx=Math.floor((s.x-x0)*res), sy=Math.floor((s.y-y0)*res), si=sy*W+sx;
        if(obs[si]) return {error:'wall'};
        // Clic près d'un mur (hors du cœur) : la pièce dont le cœur est le plus proche.
        let l=core.lab[si]; for(let d=1;!l&&d<=r+1;d++) for(let k=-d;k<=d&&!l;k++) for(const [px,py] of [[sx+k,sy-d],[sx+k,sy+d],[sx-d,sy+k],[sx+d,sy+k]]) if(!l&&px>=0&&py>=0&&px<W&&py<H) l=core.lab[py*W+px];
        // Espace trop étroit pour le carré (intérieur d'un meuble, d'un placard) : remplissage simple s'il est fermé.
        if(!l){ const freeLab=C.freeLab=C.freeLab||label(obs,W,H); const f=freeLab.lab[si]; if(freeLab.border[f]) return {error:'narrow'}; small.push(f); continue; }
        mine.add(l); }
      if(!mine.size&&!small.length) return {error:'narrow'};
      if([...mine].some(l=>core.border[l])) return {leak:true};
      // Corps de chaque pièce choisie (son cœur élargi du carré), numérotés pour ne pas annexer le passage entre deux d'entre elles.
      const list=[...mine].slice(0,30), body=new Uint8Array(N), R=new Uint8Array(N), others=new Uint8Array(N);
      for(let i=0;i<N;i++){ const l=core.lab[i]; if(l&&!mine.has(l)) others[i]=1; }
      list.forEach((l,k)=>{ const m=new Uint8Array(N); for(let i=0;i<N;i++) if(core.lab[i]===l) m[i]=1; const d=dilate(m,W,H,r); for(let i=0;i<N;i++) if(d[i]&&!obs[i]&&!body[i]){ body[i]=k+1; R[i]=1; } });
      if(small.length){ const k=Math.min(list.length,30); for(let i=0;i<N;i++) if(small.includes(C.freeLab.lab[i])){ R[i]=1; if(!body[i]) body[i]=k+1; } }
      const ob=dilate(others,W,H,r); for(let i=0;i<N;i++) if(R[i]||obs[i]) ob[i]=0;
      // Espaces étroits restants : rattachés à la pièce s'ils ne touchent qu'elle (entre un meuble et un mur) ;
      // s'ils touchent une autre pièce ou le bord, ce sont des passages (portes) : exclus, d'où une limite droite au nu du mur.
      const rest=new Uint8Array(N); for(let i=0;i<N;i++) rest[i]=obs[i]||R[i]||ob[i]?1:0;
      const left=label(rest,W,H), toMine=new Int32Array(left.n+1), toOther=new Uint8Array(left.n+1);
      for(let i=0;i<N;i++){ const l=left.lab[i]; if(!l) continue; const x=i%W;
        for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,i>=W?i-W:-1,i<N-W?i+W:-1]){ if(j<0) continue; if(body[j]) toMine[l]|=1<<(body[j]-1); if(ob[j]) toOther[l]=1; } }
      for(let i=0;i<N;i++){ const l=left.lab[i]; if(l&&toMine[l]&&!toOther[l]&&!left.border[l]) R[i]=1; }
      // Espaces fermés contre la pièce, séparés d'elle par un seul trait (plan de travail, placard contre un mur) : rattachés
      // s'ils sont à moins de 3 px de la pièce et loin de toute autre pièce (l'intérieur d'un mur touche aussi la pièce voisine).
      const foreign=new Uint8Array(N); for(let i=0;i<N;i++){ const l=left.lab[i]; if(ob[i]||(l&&!R[i]&&(toOther[l]||left.border[l]))) foreign[i]=1; }
      const nearR=dilate(R,W,H,3), nearF=dilate(foreign,W,H,3), hitR=new Uint8Array(left.n+1), hitF=new Uint8Array(left.n+1);
      for(let i=0;i<N;i++){ const l=left.lab[i]; if(!l||toMine[l]||toOther[l]||left.border[l]) continue; if(nearR[i]) hitR[l]=1; if(nearF[i]) hitF[l]=1; }
      for(let i=0;i<N;i++){ const l=left.lab[i]; if(l&&hitR[l]&&!hitF[l]) R[i]=1; }
      const Z=erode(dilate(R,W,H,2),W,H,2); // referme les fissures d'un trait (battant de porte, lit contre un mur)
      fillHoles(Z,W,H); return {Z}; };
    // Option : les parties retirées sont calculées comme une zone puis ôtées (elles peuvent laisser un trou) ;
    // le mobilier y compte comme limite, pour pouvoir retirer une table ou un meuble.
    const B=minus.length?region(minus,ctx(0)):null; if(B?.error) return {error:'minus'};
    if(B?.leak){ if(half*2>maxHalf) return {error:'open'}; continue; }
    // Un clic d'ajout tombé dans une partie retirée est abandonné (la pièce part avec son seuil de porte).
    const kept=B?seeds.filter(s=>!B.Z[Math.floor((s.y-y0)*res)*W+Math.floor((s.x-x0)*res)]):seeds; if(!kept.length) return {error:'empty'};
    const C=ctx(furn), A=region(kept,C); if(A.error) return A;
    if(A.leak){ if(half*2>maxHalf) return {error:'open'}; continue; }
    const Z=A.Z; if(B) for(let i=0;i<N;i++) if(B.Z[i]) Z[i]=0;
    if(debug) Object.assign(debug,{W,H,x0,y0,res,obs:C.obs,core:C.core.lab,R:Z});
    const hole=new Uint8Array(N); for(let i=0;i<N;i++) hole[i]=Z[i]?0:1; const outside=new Uint8Array(N); outside.set(Z); fillHoles(outside,W,H);
    for(let i=0;i<N;i++) hole[i]=hole[i]&&outside[i]?1:0; // trous : hors zone mais entourés par elle
    const toPt=ring=>dedupe(simplify(ring,0.75).map(([X,Y])=>{ const p={x:x0+X/res,y:y0+Y/res}; return index.vertexNear(p.x,p.y,2.5/res)||p; }));
    const rings=contours(Z,W,H).map(toPt).filter(r=>r.length>=3), holes=B?contours(hole,W,H).map(toPt).filter(r=>r.length>=3):[];
    if(!rings.length) return {error:'empty'};
    return {rings,holes,res};
  }
}
// Lasso : un point de départ par pièce dont le cœur est au moins pour moitié dans le polygone dessiné.
export function roomsInLasso(index,lasso,{gap,thin=gap/20,furn=gap*2.9,maxPixels=9e6,skipLight=true}={}){
  if(lasso.length<3) return [];
  const m=Math.max(150,gap*6), x0=Math.min(...lasso.map(p=>p.x))-m, y0=Math.min(...lasso.map(p=>p.y))-m, wPt=Math.max(...lasso.map(p=>p.x))+m-x0, hPt=Math.max(...lasso.map(p=>p.y))+m-y0;
  const res=Math.min(4,Math.sqrt(maxPixels/(wPt*hPt))), W=Math.ceil(wPt*res), H=Math.ceil(hPt*res), N=W*H, r=Math.max(1,Math.round(gap*res/2));
  const obs=new Uint8Array(N); rasterize(index,x0,y0,x0+wPt,y0+hPt,res,W,H,obs,furn,skipLight);
  const core=label(dilate(obs,W,H,r),W,H), inside=polyMask(lasso.map(p=>({x:(p.x-x0)*res,y:(p.y-y0)*res})),W,H);
  const tot=new Int32Array(core.n+1), inn=new Int32Array(core.n+1), sx=new Float64Array(core.n+1), sy=new Float64Array(core.n+1);
  for(let i=0;i<N;i++){ const l=core.lab[i]; if(!l) continue; tot[l]++; if(inside[i]){ inn[l]++; sx[l]+=i%W; sy[l]+=(i/W|0); } }
  const best=new Map();
  for(let l=1;l<=core.n;l++) if(!core.border[l]&&inn[l]>=tot[l]/2) best.set(l,{cx:sx[l]/inn[l],cy:sy[l]/inn[l],d:Infinity,i:-1});
  // Point de départ : le pixel du cœur, dans le lasso, le plus proche du centre de sa partie intérieure.
  for(let i=0;i<N;i++){ const b=best.get(core.lab[i]); if(!b||!inside[i]) continue; const d=(i%W-b.cx)**2+((i/W|0)-b.cy)**2; if(d<b.d){ b.d=d; b.i=i; } }
  const seed=b=>({x:x0+(b.i%W+0.5)/res,y:y0+((b.i/W|0)+0.5)/res});
  // Meuble contre un mur (lit) : son cœur n'est séparé d'une pièce plus grande que par un trait fin (< thin) sur une
  // bonne longueur ; il rejoint cette pièce au lieu de faire sa propre zone. Une cloison est plus épaisse que thin.
  const body=new Int32Array(N), q=[]; for(let i=0;i<N;i++) if(best.has(core.lab[i])){ body[i]=core.lab[i]; q.push(i); }
  for(let step=0;step<r&&q.length;step++){ const nq=[]; for(const i of q){ const x=i%W, y=i/W|0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const X=x+dx, Y=y+dy, j=Y*W+X; if(X<0||Y<0||X>=W||Y>=H||body[j]||obs[j]) continue; body[j]=body[i]; nq.push(j); } }
    q.length=0; q.push(...nq); }
  const t=Math.max(1,Math.ceil(thin*res)), pair=new Map();
  for(let i=0;i<N;i++){ const a=body[i]; if(!a) continue; const x=i%W, y=i/W|0; if(!(obs[i+1]||obs[i-1]||obs[i+W]||obs[i-W])) continue;
    for(let dy=-t-1;dy<=t+1;dy++) for(let dx=-t-1;dx<=t+1;dx++){ const X=x+dx, Y=y+dy; if(X<0||Y<0||X>=W||Y>=H) continue; const b=body[Y*W+X]; if(b&&b>a){ const k=a+'|'+b; pair.set(k,(pair.get(k)||0)+1); dx=dy=t+2; } } }
  const parent=new Map([...best.keys()].map(l=>[l,l])), find=l=>{ while(parent.get(l)!==l) l=parent.get(l); return l; };
  for(const [k,c] of pair){ if(c<gap*0.5*res) continue; const [a,b]=k.split('|').map(Number), A=find(a), B=find(b); if(A===B) continue; tot[A]>=tot[B]?parent.set(B,A):parent.set(A,B); }
  const groups=new Map(); for(const [l,b] of best){ const g=find(l); (groups.get(g)||groups.set(g,[]).get(g)).push(l===g?0:1,seed(b)); }
  // Chaque groupe : la pièce principale d'abord, puis les meubles rattachés.
  return [...groups.entries()].map(([g,list])=>{ const main=[], rest=[]; for(let i=0;i<list.length;i+=2) (list[i]?rest:main).push(list[i+1]); return [...main,...rest]; });
}
function polyMask(poly,W,H){ const out=new Uint8Array(W*H);
  for(let y=0;y<H;y++){ const yc=y+0.5, xs=[];
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i], b=poly[j]; if((a.y>yc)!==(b.y>yc)) xs.push(a.x+(yc-a.y)*(b.x-a.x)/(b.y-a.y)); }
    xs.sort((a,b)=>a-b); for(let k=0;k+1<xs.length;k+=2){ for(let x=Math.max(0,Math.ceil(xs[k]-0.5));x<=Math.min(W-1,Math.floor(xs[k+1]-0.5));x++) out[y*W+x]=1; } }
  return out; }
// Traits du rectangle en pixels ; un trait dont aucune extrémité ne touche un autre trait (tiret, hachure isolée) est ignoré.
function rasterize(index,x0,y0,x1,y1,res,W,H,obs,furn,skipLight){
  const s=index.s, ids=[...index.segmentsIn(x0,y0,x1,y1)].filter(i=>!skipLight||!index.light[i]), tol=0.35, cell=3, grid=new Map(), key=(x,y)=>Math.floor(x/cell)+','+Math.floor(y/cell);
  for(const i of ids){ const ax=s[4*i],ay=s[4*i+1],bx=s[4*i+2],by=s[4*i+3], n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/cell));
    const seen=new Set(); for(let t=0;t<=n;t++){ const k=key(ax+(bx-ax)*t/n,ay+(by-ay)*t/n); if(!seen.has(k)){ seen.add(k); (grid.get(k)||grid.set(k,[]).get(k)).push(i); } } }
  // Ensembles de traits reliés entre eux ; un ensemble plus petit que « furn » et détaché des murs est du mobilier (table, lit, sanitaire).
  const parent=new Map(ids.map(i=>[i,i])), find=i=>{ while(parent.get(i)!==i){ parent.set(i,parent.get(parent.get(i))); i=parent.get(i); } return i; };
  const linked=new Set();
  for(const i of ids) for(const [x,y] of [[s[4*i],s[4*i+1]],[s[4*i+2],s[4*i+3]]]) for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) for(const j of grid.get((Math.floor(x/cell)+dx)+','+(Math.floor(y/cell)+dy))||[]){
    if(j===i||!parent.has(j)) continue; const ax=s[4*j],ay=s[4*j+1],ex=s[4*j+2]-ax,ey=s[4*j+3]-ay,L=ex*ex+ey*ey, t=L?Math.max(0,Math.min(1,((x-ax)*ex+(y-ay)*ey)/L)):0;
    if(Math.hypot(ax+t*ex-x,ay+t*ey-y)<=tol){ linked.add(i); const a=find(i), b=find(j); if(a!==b) parent.set(a,b); } }
  const box=new Map(); for(const i of ids){ const r=find(i), b=box.get(r)||[1e9,1e9,-1e9,-1e9]; b[0]=Math.min(b[0],s[4*i],s[4*i+2]); b[1]=Math.min(b[1],s[4*i+1],s[4*i+3]); b[2]=Math.max(b[2],s[4*i],s[4*i+2]); b[3]=Math.max(b[3],s[4*i+1],s[4*i+3]); box.set(r,b); }
  for(const i of ids){ const ax=s[4*i],ay=s[4*i+1],bx=s[4*i+2],by=s[4*i+3], b=box.get(find(i));
    if(!linked.has(i)||Math.max(b[2]-b[0],b[3]-b[1])<furn) continue;
    let px=Math.floor((ax-x0)*res), py=Math.floor((ay-y0)*res); const n=Math.ceil(Math.hypot(bx-ax,by-ay)*res*2)+1;
    for(let t=0;t<=n;t++){ const qx=Math.floor((ax+(bx-ax)*t/n-x0)*res), qy=Math.floor((ay+(by-ay)*t/n-y0)*res);
      if(qx!==px&&qy!==py&&qx>=0&&qx<W&&py>=0&&py<H) obs[py*W+qx]=1; // pas de passage en diagonale entre deux pixels du trait
      if(qx>=0&&qx<W&&qy>=0&&qy<H) obs[qy*W+qx]=1; px=qx; py=qy; } }
}
// Dilatation par un carré de demi-côté r (deux passes séparables par sommes cumulées).
function dilate(a,W,H,r){ const tmp=new Uint8Array(W*H), out=new Uint8Array(W*H), c=new Int32Array(Math.max(W,H)+1);
  for(let y=0;y<H;y++){ c[0]=0; for(let x=0;x<W;x++) c[x+1]=c[x]+a[y*W+x]; for(let x=0;x<W;x++) tmp[y*W+x]=c[Math.min(W,x+r+1)]-c[Math.max(0,x-r)]>0?1:0; }
  for(let x=0;x<W;x++){ c[0]=0; for(let y=0;y<H;y++) c[y+1]=c[y]+tmp[y*W+x]; for(let y=0;y<H;y++) out[y*W+x]=c[Math.min(H,y+r+1)]-c[Math.max(0,y-r)]>0?1:0; }
  return out; }
function erode(a,W,H,r){ const inv=new Uint8Array(W*H); for(let i=0;i<W*H;i++) inv[i]=a[i]?0:1; const d=dilate(inv,W,H,r); for(let i=0;i<W*H;i++) d[i]=d[i]?0:1; return d; }
// Composantes 4-connexes des pixels à 0 ; border[l] : la composante touche le bord du rectangle.
function label(blocked,W,H){ const N=W*H, lab=new Int32Array(N), border=[0], st=[]; let n=0;
  for(let i=0;i<N;i++){ if(blocked[i]||lab[i]) continue; n++; border[n]=0; lab[i]=n; st.push(i);
    while(st.length){ const k=st.pop(), x=k%W; if(x===0||x===W-1||k<W||k>=N-W) border[n]=1;
      for(const j of [x>0?k-1:-1,x<W-1?k+1:-1,k>=W?k-W:-1,k<N-W?k+W:-1]) if(j>=0&&!blocked[j]&&!lab[j]){ lab[j]=n; st.push(j); } } }
  return {lab,border,n}; }
// Trous intérieurs (mobilier isolé, texte) : tout ce qui n'est pas relié au bord par l'extérieur fait partie de la zone.
function fillHoles(R,W,H){ const out=new Uint8Array(W*H), st=[]; const push=i=>{ if(!R[i]&&!out[i]){ out[i]=1; st.push(i); } };
  for(let x=0;x<W;x++){ push(x); push((H-1)*W+x); } for(let y=0;y<H;y++){ push(y*W); push(y*W+W-1); }
  while(st.length){ const i=st.pop(), x=i%W; if(x>0) push(i-1); if(x<W-1) push(i+1); if(i>=W) push(i-W); if(i<W*(H-1)) push(i+W); }
  for(let i=0;i<W*H;i++) if(!out[i]) R[i]=1; }
// Contour extérieur de chaque composante (suivi des arêtes entre pixels, intérieur à droite), sommets aux changements de direction.
function contours(R,W,H){ const done=new Uint8Array(W*H), rings=[], at=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&R[y*W+x]===1;
  const DX=[1,0,-1,0], DY=[0,1,0,-1];
  for(let i=0;i<W*H;i++){ if(!R[i]||done[i]) continue; const sx=i%W, sy=(i-sx)/W; if(at(sx,sy-1)) continue;
    let x=sx, y=sy, d=0; const ring=[]; let guard=0;
    do{ // pixels devant, côté droit et côté gauche, selon la direction
      const right=[[x,y],[x-1,y],[x-1,y-1],[x,y-1]][d], left=[[x,y-1],[x,y],[x-1,y],[x-1,y-1]][d];
      let nd=d; if(!at(...right)) nd=(d+1)%4; else if(at(...left)) nd=(d+3)%4;
      if(nd!==d||!ring.length) ring.push([x,y]); d=nd; x+=DX[d]; y+=DY[d];
    }while((x!==sx||y!==sy)&&++guard<4*W*H); // le coin de départ n'appartient qu'à un seul pixel de la composante
    rings.push(ring); markComponent(R,W,H,i,done); }
  return rings; }
function markComponent(R,W,H,start,done){ const st=[start]; done[start]=1; while(st.length){ const i=st.pop(), x=i%W; for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,i-W,i+W]) if(j>=0&&j<W*H&&R[j]&&!done[j]){ done[j]=1; st.push(j); } } }
// Douglas-Peucker sur un contour fermé.
function simplify(ring,tol){ if(ring.length<4) return ring;
  const dp=(pts)=>{ if(pts.length<3) return pts; const [ax,ay]=pts[0], [bx,by]=pts[pts.length-1], L=Math.hypot(bx-ax,by-ay)||1; let md=0, mi=0;
    for(let i=1;i<pts.length-1;i++){ const d=Math.abs((bx-ax)*(ay-pts[i][1])-(ax-pts[i][0])*(by-ay))/L; if(d>md){ md=d; mi=i; } }
    return md>tol?[...dp(pts.slice(0,mi+1)).slice(0,-1),...dp(pts.slice(mi))]:[pts[0],pts[pts.length-1]]; };
  let far=0, fd=0; for(let i=1;i<ring.length;i++){ const d=Math.hypot(ring[i][0]-ring[0][0],ring[i][1]-ring[0][1]); if(d>fd){ fd=d; far=i; } }
  return [...dp(ring.slice(0,far+1)).slice(0,-1),...dp([...ring.slice(far),ring[0]]).slice(0,-1)]; }
function dedupe(r){ return r.filter((p,i)=>{ const q=r[(i+r.length-1)%r.length]; return Math.hypot(p.x-q.x,p.y-q.y)>1e-6; }); }
export const _zoneInternals={contours,simplify,dilate,erode,fillHoles};
