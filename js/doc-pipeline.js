// ExtracTerre v2.24.0 — étapes communes « document lu → document prêt », partagées par l'appli (glisser-déposer)
// et par l'import massif (tools/import) : même classement, même détection des bâtiments, mêmes parseurs.
import {DOC_TYPES} from './config.js';
import {classifyDocument} from './classifier.js';
import {detectBuildings} from './buildings.js';
import {compactReadForRetention} from './readers.js';
import {parseDocument,DOCUMENT_FAMILIES,resolveDocumentFamilies,autoFamiliesForType} from './parsers.js';

export function classifyForSelectedFamily(doc){
  const auto0=classifyDocument(doc.name,doc.read?.text||'',{kind:doc.read?.kind,re2020:doc.read?.re2020||null});
  const auto=doc.read?.plan?{...auto0,type:DOC_TYPES.PLAN,confidence:.95,planFormat:doc.read.plan.format}:auto0;
  const families=resolveDocumentFamilies({...doc,classification:{...auto,automaticType:auto.type},type:auto.type});
  const forcedManual=doc.familyMode==='manual';
  // Le type affiché suit la famille choisie manuellement ; la détection automatique reste mémorisée pour le contrôle.
  const primary=families.find(f=>f!=='annex');
  const forcedType=forcedManual&&primary&&!autoFamiliesForType(auto.type).includes(primary)?DOCUMENT_FAMILIES[primary]?.type:null;
  return {...auto,automaticType:auto.type,type:forcedType||auto.type,families,familyMode:doc.familyMode||'auto',forcedByUser:!!forcedType};
}

// Après readFile : classement, bâtiments, pré-extraction (cachedOccurrences) puis lecture compactée, comme l'appli.
// Les drapeaux de rattrapage sont posés : le document vient d'être lu par les parseurs actuels.
export function prepareReadDocument(d){
  d.classification=classifyForSelectedFamily(d);
  d.type=d.classification.type;
  d.buildings=detectBuildings(d);
  d.status='ready';
  if(d.read?.ocr?.warnings?.length) d.ocrWarnings=d.read.ocr.warnings;
  try{
    d.cachedOccurrences=d.read?.plan?[]:parseDocument(d); d.analysisCachedAt=Date.now();
    d.rsetAddressRead=true; d.dhZonesRead=true; d.fanRead=2; d.bldRead=1; // lu par les parseurs actuels (cf. engine.analyzeDocuments)
    d.read=compactReadForRetention(d.read);
  }catch(parseErr){ d.cachedOccurrences=null; d.parseError=parseErr?.message||String(parseErr); }
  return d;
}
