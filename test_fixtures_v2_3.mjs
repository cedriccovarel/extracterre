// Documents FICTIFS pour les tests v2.3 — aucune donnée client.
export const page=(n,text)=>({page:n,text,lines:text.split(/\n/).map((t,index)=>({text:t,index}))});
export const textDoc=(id,name,type,text,extra={})=>{ const pages=text.split('\f').map((t,i)=>page(i+1,t)); return {id,name,type,read:{kind:'pdf',text:pages.map(p=>p.text).join('\n\f\n'),pages},...extra}; };

const lots=(base)=>Array.from({length:13},(_,i)=>`<lot ref="${i+1}"><stock_c>0</stock_c><udd>0.5</udd><ic>${(base[i]??0).toFixed(6)}</ic><ic_ded>0</ic_ded></lot>`).join('');
const dyn=(v)=>`<indicateur_co2_dynamique><valeur_phase_acv ref="A1-A3">0</valeur_phase_acv><valeur_phase_acv ref="B">${v}</valeur_phase_acv><valeur_phase_acv ref="C">0</valeur_phase_acv></indicateur_co2_dynamique>`;
const energie=(posts)=>Object.entries(posts).map(([ref,v])=>`<sous_contributeur ref="${ref}"><indicateurs_acv_collection/>${dyn(v)}</sous_contributeur>`).join('');

// Opération fictive « Les Tilleuls » : 2 bâtiments, logiciel fictif.
export function fictitiousRe2020Xml(){
  const lotsA=[10,120,150,30,20,60,70,140,40,45,2,0,0]; // Σ = 687
  const lotsB=[8,100,130,25,18,55,60,120,35,40,2,0,0];  // Σ = 593
  const bat=(i,name,shab,lgts,trav,clim,bbio,bbioMax,cep,cepMax,cepnr,cepnrMax,dhs,cef,lotsArr,icc,ice,posts,stock,parois)=>({i,name,shab,lgts,trav,clim,bbio,bbioMax,cep,cepMax,cepnr,cepnrMax,dhs,cef,lotsArr,icc,ice,posts,stock,parois});
  const A=bat(1,'Bâtiment A - Collectif',1500.5,24,1,0,60.2,72.0,57.3,90.0,55.0,70.0,[[410.5,1250],[620.4,1250]],{gaz:{ch:20,ecs:15},elec:{ch:2,fr:0.5,ecs:1,ecl:2,auxvent:1,auxdist:0.2,deplacement:3}},lotsA,687,380,{1:150,2:110,3:2,4:6,5:3,6:1,7:8},6.5,
    [[101,'Béton 18 cm + Laine de verre 120 mm (R=3.75)',900],[201,'Dalle béton + Polyuréthane 100 mm (R=4.55)',500],[301,'Terrasse : dalle béton + Polyuréthane 140 mm (R=6.35)',480]]);
  const B=bat(2,'Bâtiment B - Maisons',380.0,4,0,0,55.0,70.0,48.0,80.0,48.0,60.0,[[540.0,1250]],{elec:{ch:6,fr:0.3,ecs:5,ecl:2,auxvent:1,auxdist:0.1,deplacement:0}},lotsB,593,60,{1:25,2:20,3:1,4:5,5:2,6:0.5,7:0},12.4,
    [[101,'Brique 20 cm + Laine de roche 100 mm (R=3.15)',300],[306,'Combles : laine de verre soufflée 400 mm (R=10)',190]]);
  const cefTags=(c)=>{ const vec={gaz:0,elec:0,bois:0,fioul:0,reseau:0}; let s=''; for(const [v,u] of Object.entries(c)) for(const [k,val] of Object.entries(u)){ vec[v]+=val; s+=`<O_Cef_${v}_imp_${k}_annuel>${val}</O_Cef_${v}_imp_${k}_annuel>`; } for(const [v,val] of Object.entries(vec)) s+=`<O_Cef_${v}_imp_annuel>${Math.round(val*100)/100}</O_Cef_${v}_imp_annuel>`; return s; };
  const xml=`<?xml version="1.0" encoding="utf-8"?>
<projet version="2022.D1E3C2">
<Datas_Comp><donnees_generales>
<maitre_ouvrage><nom>SCCV LES TILLEULS (FICTIF)</nom></maitre_ouvrage>
<logiciel><date_etude>2026-01-15</date_etude><editeur>Éditeur Fictif</editeur><nom>ThermoTest</nom><version>1.0</version></logiciel>
<operation><nom>Résidence Les Tilleuls</nom><num_permis>PC 000 000 26 X0001</num_permis><adresse><label>1 rue des Essais</label><postcode>69001</postcode><city>Lyon</city></adresse><zone_climatique>Zone H1c</zone_climatique></operation>
</donnees_generales>
<batiment_collection>${[A,B].map(b=>`<batiment><Index>${b.i}</Index><O_SREF>${b.shab}</O_SREF><enveloppe>${b.parois.map(([n,name,s])=>`<parois_opaques><nature>${n}</nature><name>${name}</name><surface_totale>${s}</surface_totale><U_paroi>0.25</U_paroi></parois_opaques>`).join('')}<parois_vitrees><name>F1 Fenêtre PVC 2 vantaux</name><type_vitrage>DV 4/16/4 Argon</type_vitrage><surface_totale>120</surface_totale></parois_vitrees><parois_vitrees><name>Porte-fenêtre alu</name><type_vitrage>TV 4/12/4/12/4 Argon</type_vitrage><surface_totale>20</surface_totale></parois_vitrees></enveloppe></batiment>`).join('')}</batiment_collection>
</Datas_Comp>
<RSET><Entree_Projet><Batiment_Collection>${[A,B].map(b=>`<Batiment><Index>${b.i}</Index><Name>${b.name.replace('Bâtiment','Batiment')}</Name><Zone_Collection><Zone><NB_logement>${b.lgts}</NB_logement><Is_Traversant>${b.trav}</Is_Traversant><Groupe_Collection><Groupe><SHAB>${b.shab}</SHAB><Is_Climatise>${b.clim}</Is_Climatise></Groupe></Groupe_Collection></Zone></Zone_Collection></Batiment>`).join('')}</Batiment_Collection></Entree_Projet>
<Sortie_Projet><Departement>69</Departement>
<Sortie_Batiment_B_Collection>${[A,B].map(b=>`<Sortie_Batiment_B><Index>${b.i}</Index><O_Bbio_pts_annuel>${b.bbio}</O_Bbio_pts_annuel><O_Bbio_Max>${b.bbioMax}</O_Bbio_Max></Sortie_Batiment_B>`).join('')}</Sortie_Batiment_B_Collection>
<Sortie_Batiment_C_Collection>${[A,B].map(b=>`<Sortie_Batiment_C><Index>${b.i}</Index><Name>${b.name}</Name><O_SREF>${b.shab}</O_SREF><O_Cep_annuel>${b.cep}</O_Cep_annuel><O_Cep_Max>${b.cepMax}</O_Cep_Max><O_Cep_nr_annuel>${b.cepnr}</O_Cep_nr_annuel><O_Cep_nr_Max>${b.cepnrMax}</O_Cep_nr_Max>${cefTags(b.cef)}</Sortie_Batiment_C>`).join('')}</Sortie_Batiment_C_Collection>
<Sortie_Batiment_D_Collection>${[A,B].map(b=>`<Sortie_Batiment_D><Index>${b.i}</Index><Sortie_Zone_D_Collection><Sortie_Zone_D>${'<Sortie_Groupe_D_Collection>'+b.dhs.map(([dh,mx],k)=>`<Sortie_Groupe_D><Name>Groupe ${k+1}</Name><O_NbDegresHeures>${dh}</O_NbDegresHeures><O_NbDegresHeures_max>${mx}</O_NbDegresHeures_max></Sortie_Groupe_D>`).join('')+'</Sortie_Groupe_D_Collection>'}</Sortie_Zone_D></Sortie_Zone_D_Collection></Sortie_Batiment_D>`).join('')}</Sortie_Batiment_D_Collection>
</Sortie_Projet></RSET>
<RSEnv><entree_projet>${[A,B].map(b=>`<batiment><index>${b.i}</index><nom>${b.name}</nom><sref>${b.shab}</sref></batiment>`).join('')}</entree_projet>
<sortie_projet>${[A,B].map(b=>`<batiment><index>${b.i}</index><contributeur><composant>${lots(b.lotsArr)}</composant><energie>${energie(b.posts)}</energie></contributeur><indicateur_perf_env><ic_construction>${b.icc+5}</ic_construction><ic_construction_max>800</ic_construction_max><ic_energie>${b.ice}</ic_energie><ic_energie_max>560</ic_energie_max><ic_composant>${b.icc}</ic_composant><ic_chantier>5</ic_chantier><stock_c_batiment>${b.stock}</stock_c_batiment></indicateur_perf_env></batiment>`).join('')}</sortie_projet></RSEnv>
</projet>`;
  return {xml,A,B};
}
