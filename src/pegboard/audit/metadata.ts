// Permanent metadata is a closed vocabulary, never a copy of input, provider responses or activity bodies.
const enums = new Set(['owner','admin','manager','member','analyst','guest','agent','viewer','commenter','editor','full','approve','assignee','direct','join','request','public','private','team','workspace','personal','company','restricted','default','numeric','task','project','manual','timer','adjustment','draft','returned','submitted','approved','denied','pending','expired','stale','active','inactive','suspended','revoked','api','csv','harvest','quickbooks-time','inbox','email','sent','failed','suppressed','disabled','unavailable','uncertain','acknowledged','rejected','success','blocked','complete','retained','queued','applied','noop','source_date_missing','activation_changed','activating_admin_unavailable','source_changed','source_time_requires_review','ai_source_requires_exact_review','dependency_cascade_requires_review','approval_decision_required','share_review_required','target_scope_changed','source_field_changed','collaborator_existing_access','activation_scope_changed'])
const enumKeys = new Set(['role','from','to','level','scope','source','requestedLevel','grantedLevel','privacy','defaultLevel','visibility','mode','kind','service','route','email','status','result','outcome'])
const idKeys = new Set(['requestId','grantId','sourceId','templateId','id','decisionId','webhookId','teamId','fallbackId','grantObject','grantee','ruleId','activationId','runId','operationId','eventId','taskId','triggerActorId','activatedById','previousActivationId'])
const numberKeys = new Set(['expiresAt','added','replayed','acknowledged','rejected','uncertain','remaining','inProgress','version','count','rows','workCount','previousVersion'])
const boolKeys = new Set(['inbox','invited','renamed','consent','held'])
export function auditMetadata(detail: Record<string, unknown> = {}) {
  const clean: Record<string, unknown> = {}
  for (const [key,value] of Object.entries(detail)) {
    if (enumKeys.has(key) && typeof value === 'string' && enums.has(value)) clean[key]=value
    else if (idKeys.has(key) && typeof value === 'string' && /^(?:(?:person|team|project|task):)?(?:[a-z]+_[a-f0-9]{20}|[a-f0-9-]{36})$/.test(value)) clean[key]=value
    else if(numberKeys.has(key) && typeof value==='number' && Number.isFinite(value)) clean[key]=value
    else if(boolKeys.has(key) && typeof value==='boolean') clean[key]=value
    else if(key==='scopeDigest' && typeof value==='string' && /^[a-f0-9]{64}$/.test(value)) clean[key]=value
  }
  return clean
}
