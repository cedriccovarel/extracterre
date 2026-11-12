// Parcours en lecture seule : noms de dossiers et métadonnées (taille, date). Aucun fichier n'est ouvert ici.
import fs from 'fs';
import path from 'path';
import {folderFamilyMatch,isSkippedFolder,fileIgnoreReason,folderTokens} from '../../../js/import-rules.js';

export async function listOperationFolders(root){
  const entries=await fs.promises.readdir(root,{withFileTypes:true});
  return entries.filter(e=>e.isDirectory()&&!e.name.startsWith('.')).map(e=>e.name);
}

// Sous-dossiers d'une opération : familles retenues, fichiers (sans lecture), noms de dossiers ignorés.
// allSubfolders : pas de filtrage, tous les fichiers gardent family=null.
export async function scanOperation(opDir,cfg,{allSubfolders=false}={}){
  const retained=[],files=[],ignoredDirs=[],errors=[];
  const maxDepth=cfg.profondeurMax||8;
  async function walk(abs,rel,depth,family,directFamily){
    let entries;
    try{ entries=await fs.promises.readdir(abs,{withFileTypes:true}); }
    catch(err){ errors.push({relDir:rel,error:err.code||err.message}); return; }
    for(const e of entries){
      const childAbs=path.join(abs,e.name), childRel=rel?`${rel}/${e.name}`:e.name;
      if(e.isSymbolicLink()) continue;
      if(e.isDirectory()){
        if(depth>=maxDepth||isSkippedFolder(e.name,cfg)) continue;
        if(allSubfolders||family){ await walk(childAbs,childRel,depth+1,family,null); continue; }
        const m=folderFamilyMatch(e.name,cfg);
        if(m.family&&!m.container){ retained.push({relDir:childRel,family:m.family,container:false}); await walk(childAbs,childRel,depth+1,m.family,null); }
        else {
          if(m.family&&m.container) retained.push({relDir:childRel,family:m.family,container:true});
          else if(!m.container) ignoredDirs.push(e.name);
          await walk(childAbs,childRel,depth+1,null,m.container?m.family:null);
        }
        continue;
      }
      if(!e.isFile()) continue;
      const fam=allSubfolders?(family||directFamily||null):(family||directFamily);
      if(!allSubfolders&&!fam) continue; // fichier hors sous-dossier retenu : ni lu, ni haché
      const reason=fileIgnoreReason(e.name,cfg);
      let st=null; try{ st=await fs.promises.stat(childAbs); }catch(err){ errors.push({relDir:rel,file:e.name,error:err.code||err.message}); continue; }
      files.push({abs:childAbs,relPath:childRel,relDir:rel,name:e.name,family:fam,size:st.size,mtimeMs:Math.round(st.mtimeMs),ignoreReason:reason});
    }
  }
  await walk(opDir,'',0,null,null);
  return {retained,files,ignoredDirs,errors};
}

// Nom affiché d'un sous-dossier ignoré, regroupé : numérotation retirée, minuscules sans accents.
export function ignoredDirLabel(name){ return folderTokens(name).join(' ')||String(name); }
