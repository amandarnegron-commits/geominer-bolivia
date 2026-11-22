/** Evidencia documental declarada por el operador, aplicable a cualquier zona GPS. */
export const USER_EVIDENCE_TYPES=Object.freeze(['mapa_geologico','registro_muestra','observacion','informe_tercero']);
export function sanitizeUserEvidence(value){
  if(!Array.isArray(value))return [];
  const result=[];
  for(const row of value.slice(0,12)){
    if(!row||typeof row!=='object'||!USER_EVIDENCE_TYPES.includes(row.type))continue;
    if(typeof row.description!=='string'||typeof row.source!=='string')continue;
    const description=row.description.trim().slice(0,450), source=row.source.trim().slice(0,220);
    if(description.length<12||source.length<5)continue;
    const number=Number(row.sector);
    const sector=Number.isInteger(number)&&number>=1&&number<=25?number:null;
    result.push({type:row.type,description,source,sector,verification:'DOCUMENTO DECLARADO POR OPERADOR, NO AUDITADO NI VALIDADO'});
  }
  return result;
}
