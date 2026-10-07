// v2.3.8 — Tableau « Données techniques (du bâtiment) » des RSET / RSEE (fiche CSTB) et des éditions Pléiades :
// libellés normalisés RE2020 (« Type de structure porteuse », « Nature de l'isolation des toitures »…), soit sur
// une ligne (« Libellé valeur », éventuellement deux couples par ligne en OCR), soit coupés autour de la valeur
// (« Nature de l'isolation des » / « Laine de bois » / « parois verticales exterieures »).
// Les valeurs sont traduites dans le vocabulaire ExtracTerre ; une valeur non reconnue n'est pas reprise.

const DT_LABELS=[
  ['structureType',["type de structure principale","type de structure porteuse"]],
  ['material',["materiau principal de la structure","materiau principal"]],
  ['wallIns',["nature de l'isolation des parois verticales exterieures"]],
  ['floorIns',["nature de l'isolation des planchers bas","nature de l'isolation des plancher bas","nature de l'isolation des planchers"]],
  ['roofIns',["nature de l'isolation des toitures"]],
  ['floorType',["type principal de plancher","type de plancher"]],
  ['roofType',["type principal de toiture","type de toiture"]],
  ['windows',["type de menuiseries"]],
  ['shading',["type de protections mobiles des menuiseries"]]
];
// Libellés voisins (non exploités) : servent à couper une ligne qui porte deux couples « libellé valeur ».
const DT_OTHER=["elements prefabriques","materiau principal de remplissage de la facade","materiaux de remplissage de facade","mode d'isolation des parois verticales exterieures","revetement exterieur des parois verticales exterieures","types de fondations","type de fondation","mode d'isolation des planchers bas","mode d'isolation des plancher bas","nature de l'espace sous plancher","mode d'isolation des toitures","la toiture est-t-elle vegetalisee ?","type de couverture de la toiture","systeme d'eclairage artificiel"];
const dt_norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const DT_ALL=[...DT_LABELS.flatMap(([k,ls])=>ls.map(l=>({k,l}))),...DT_OTHER.map(l=>({k:null,l}))].sort((a,b)=>b.l.length-a.l.length);

function dt_cutValue(rest){
  // La valeur s'arrête au prochain libellé connu de la même ligne.
  const low=dt_norm(rest); let end=low.length;
  for(const {l} of DT_ALL){ const i=low.indexOf(l); if(i>0&&i<end) end=i; }
  return rest.slice(0,end).replace(/[|]/g,' ').replace(/\s*:\s*$/,'').trim();
}

export function readTechnicalData(lines){
  // lines : [{t, ...}] dans l'ordre du document (une section bâtiment).
  const found={}; const low=lines.map(x=>dt_norm(x.t));
  for(let i=0;i<lines.length;i++){
    const l=low[i];
    for(const {k,l:lab} of DT_ALL){
      const at=l.indexOf(lab); if(at<0) continue;
      if(!k) continue; if(found[k]) continue;
      const after=lines[i].t.slice(lines[i].t.length-(l.length-at-lab.length)).trim();
      const v=dt_cutValue(after);
      if(v&&!/^[:\-–]?$/.test(v)){ found[k]={value:v,at:lines[i]}; continue; }
    }
    // Libellé coupé : préfixe sur la ligne i, valeur sur i+1, fin du libellé sur i+2.
    for(const [k,labs] of DT_LABELS){
      if(found[k]) continue;
      for(const lab of labs){
        if(!(lab.startsWith(l+' ')&&i+2<lines.length)) continue;
        const rest=lab.slice(l.length+1);
        if(low[i+2]===rest||low[i+2].startsWith(rest)){ const v=lines[i+1].t.trim(); if(v) found[k]={value:v,at:lines[i+1]}; break; }
      }
    }
  }
  return found;
}

export function insulationName(v=''){
  const s=dt_norm(v);
  if(/laine\s+de\s+bois|fibre\s+de\s+bois/.test(s)) return 'Fibre de bois';
  if(/laine\s+de\s+verre|\(lv\)/.test(s)) return 'Laine de verre';
  if(/laine\s+de\s+roche|\(lr\)/.test(s)) return 'Laine de roche';
  if(/polyurethane|\(pu\)|\bpur\b|\bpir\b/.test(s)) return 'PUR';
  if(/extrude|\bxps\b/.test(s)) return 'XPS';
  if(/polystyrene|\bpse\b/.test(s)) return 'PSE';
  if(/ouate|fibre\s+de\s+cellulose|\bcellulose\b/.test(s)) return 'Ouate de cellulose';
  if(/chanvre|\blin\b|coton/.test(s)) return 'Biosourcé chanvre/lin/coton';
  if(/paille/.test(s)) return 'Paille';
  if(/liege/.test(s)) return 'Liège';
  if(/laine\s+minerale/.test(s)) return 'Laine minérale';
  return null;
}
const dt_cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;

// Traduction en occurrences ExtracTerre : [{field,value,at,note}]
export function technicalDataFields(found){
  const out=[]; const add=(field,value,src,note='')=>{ if(value&&src) out.push({field,value,at:src.at,note}); };
  const mat=found.material?.value||'', typ=found.structureType?.value||'';
  if(mat||typ){
    const m=dt_norm(mat), t=dt_norm(typ);
    const structure=/bois/.test(m)&&/ossature/.test(t)?'Ossature bois':/bois/.test(m)&&/poteaux/.test(t)?'Poteaux-poutres bois':/beton/.test(m)&&/mixte|bois/.test(m)?'Mixte bois-béton':/beton/.test(m)?'Béton armé':/acier|metal/.test(m)?'Métal':/bois/.test(m)?'Bois massif':null;
    if(structure) add('structure',structure,found.material||found.structureType,`Données techniques : ${[typ,mat].filter(Boolean).join(' / ')}.`);
    if(structure==='Ossature bois') add('wall_structure','Ossature bois',found.structureType||found.material);
  }
  if(found.wallIns) add('wall_insulation',insulationName(found.wallIns.value),found.wallIns,`Données techniques : ${found.wallIns.value}.`);
  if(found.floorIns) add('floor_insulation',insulationName(found.floorIns.value),found.floorIns,`Données techniques : ${found.floorIns.value}.`);
  if(found.roofIns) add('roof_insulation',insulationName(found.roofIns.value),found.roofIns,`Données techniques : ${found.roofIns.value}.`);
  if(found.floorType){ const s=dt_norm(found.floorType.value); add('floor_structure',/bois/.test(s)?'Plancher bois':/beton|dalle/.test(s)?'Dalle béton':/acier|metal/.test(s)?'Bac acier':null,found.floorType,`Type principal de plancher : ${found.floorType.value}.`); }
  if(found.roofType){ const s=dt_norm(found.roofType.value); add('roof_structure',/terrasse/.test(s)?(/non\s+accessible/.test(s)?'Toiture terrasse non accessible':'Toiture terrasse'):/pan|pente|comble/.test(s)?dt_cap(found.roofType.value):null,found.roofType); }
  if(found.windows){ const s=dt_norm(found.windows.value); add('window_material',/pvc/.test(s)?'PVC':/bois.*alu|alu.*bois|mixte/.test(s)?'Bois-aluminium':/alu/.test(s)?'Aluminium':/bois/.test(s)?'Bois':null,found.windows); }
  if(found.shading){ const s=dt_norm(found.shading.value); add('window_shading',/sans\s+protection|aucune/.test(s)?'Sans occultation':/volet\s+roulant/.test(s)?'Volet roulant':/brise|bso|venitien/.test(s)?'BSO':/store/.test(s)?'Store':/persienne|battant/.test(s)?'Volet battant':null,found.shading); }
  return out;
}
