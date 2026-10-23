// Permanent metadata is a closed vocabulary, never a copy of input, provider responses or activity bodies.
const enums = new Set(['owner','admin','manager','member','analyst','guest','agent','viewer','commenter','editor','full','approve','assignee','direct','join','request','public','private','team','workspace','personal','company','restricted','default','numeric','task','project','manual','timer','adjustment','draft','returned','submitted','approved','denied','pending','expired','stale','active','inactive','suspended','revoked','api','csv','harvest','quickbooks-time','inbox','email','sent','failed','suppressed','disabled','unavailable','uncertain','acknowledged','rejected','success','blocked','complete','retained'])
const enumKeys = new Set(['role','from','to','level','scope','source','requestedLevel','grantedLevel','privacy','defaultLevel','visibility','mode','kind','service','route','email','status','result'])
const idKeys = new Set(['requestId','grantId','sourceId','templateId','id','decisionId','webhookId','teamId','fallbackId','grantObject','grantee'])
const numberKeys = new Set(['expiresAt','added','replayed','acknowledged','rejected','uncertain','remaining','inProgress','version','count','rows'])
const boolKeys = new Set(['inbox','invited','renamed','consent','held'])
export function auditMetadata(detail: Record<string, unknown> = {}) {
  const clean: Record<string, unknown> = {}
  for (const [key,value] of Object.entries(detail)) {
    if (enumKeys.has(key) && typeof value === 'string' && enums.has(value)) clean[key]=value
    else if (idKeys.has(key) && typeof value === 'string' && /^(?:(?:person|team|project|task):)?(?:[a-z]+_[a-f0-9]{20}|[a-f0-9-]{36})$/.test(value)) clean[key]=value
    else if(numberKeys.has(key) && typeof value==='number' && Number.isFinite(value)) clean[key]=value
    else if(boolKeys.has(key) && typeof value==='boolean') clean[key]=value
  }
  return clean
}
