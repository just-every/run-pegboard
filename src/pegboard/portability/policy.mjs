// One policy for native CLI and the HTTP archive doors. No active source-installation authority travels.
const revoked=1
const importSafety={peg_recurrences:{active:[0],held:[1]},peg_grants:{revoked_at:[revoked]},peg_goal_sources:{token_hash:[null],ended_at:[revoked],ended_cause:['restored_inactive']},peg_processor_policies:{approved:[0],sharing:[0],training:[0]}}
export default {
 product:'runeditrun/foundation',
 includeTables:['oa_operators','oa_bootstrap','oa_external_identities','oa_invitation_cancellations','oa_tokens','oa_auth_settings','oa_auth_audit','oa_domain_rules','oa_logout_events','oc_owner_claims','oc_idp_grants'],
 excludeTables:['rer_dependency_keys','rer_dependency_pending','rer_dependency_codes','peg_webhooks','peg_data_guards','peg_data_erasing_tasks','peg_data_erasing_proofs'],
 requiredConfiguration:['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','MAIL_PROVIDER','MAIL_FROM'],
 async validateStaged({db,tables}){
  const search=tables.peg_search_records,tasks=tables.peg_tasks
  if(search&&tasks){
   const mismatch=await db.prepare(`SELECT 1 FROM "${search}" s LEFT JOIN "${tasks}" t ON t.id=s.task_id WHERE t.id IS NULL OR s.body<>t.title||char(10)||t.description LIMIT 1`).first()
   if(mismatch)return false
  }
  return true
 },
 importSafety,
 importRow(table,row){return importSafety[table]?{...row,...Object.fromEntries(Object.entries(importSafety[table]).map(([key,values])=>[key,values[0]]))}:row},
 exportRow(table,row){
  if(table==='peg_processor_policies')return {...row,approved:0,sharing:0,training:0}
  if(table==='peg_recurrences')return {...row,active:0,held:1}
  if(table==='peg_grants')return {...row,revoked_at:revoked}
  if(table==='peg_goal_sources')return {...row,token_hash:null,ended_at:revoked,ended_cause:'restored_inactive'}
  return row
 },
}
