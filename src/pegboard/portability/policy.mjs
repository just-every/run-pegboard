// One policy for native CLI and the HTTP archive doors. No active source-installation authority travels.
const revoked=1
const importSafety={peg_template_rules:{enabled:[0],activation_id:[null]},peg_bundle_adoptions:{enabled:[0]},peg_meetings:{revoked_at:[revoked],segments:['[]']},peg_meeting_proposals:{title:[''],owner_id:[null],due_date:[null],date_resolved:[0]},peg_engineering_links:{revoked_at:[revoked],source_status:[null],source_owner:[null],mapped_owner:[null],source_version:[null],indicator:[null],pending_status:[null],state:['stale'],cause:['restored_inactive']},peg_recurrences:{active:[0],held:[1]},peg_grants:{revoked_at:[revoked]},peg_goal_sources:{token_hash:[null],ended_at:[revoked],ended_cause:['restored_inactive']},peg_processor_policies:{approved:[0],sharing:[0],training:[0]}}
export default {
 product:'runeditrun/foundation',
 includeTables:['oa_operators','oa_bootstrap','oa_external_identities','oa_invitation_cancellations','oa_tokens','oa_auth_settings','oa_auth_audit','oa_domain_rules','oa_logout_events','oc_owner_claims','oc_idp_grants'],
 excludeTables:['peg_api_cursors','peg_api_guards','peg_webhook_deliveries','peg_api_keys','peg_api_intents','peg_api_events','peg_api_receipts','peg_template_rule_execution_guards','peg_departure_guards','peg_canvas_guards','peg_analytics_keys','peg_analytics_snapshots','peg_analytics_rows','peg_analytics_guards','peg_meeting_guards','rer_dependency_keys','rer_dependency_pending','rer_dependency_codes','peg_webhooks','peg_data_guards','peg_data_erasing_tasks','peg_data_erasing_proofs'],
 requiredConfiguration:['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','MAIL_PROVIDER','MAIL_FROM'],
 async validateStaged({db,tables}){
  const search=tables.peg_search_records,tasks=tables.peg_tasks
  const canvas=tables.peg_canvas_nodes,projects=tables.peg_projects
  if(canvas){
   if(!projects||!tasks)return false
   const invalid=await db.prepare(`SELECT 1 FROM "${canvas}" n LEFT JOIN "${projects}" p ON p.id=n.project_id LEFT JOIN "${tasks}" t ON t.id=n.task_id LEFT JOIN "${canvas}" parent ON parent.id=n.parent_id WHERE p.id IS NULL OR (n.task_id IS NOT NULL AND t.id IS NULL) OR (n.parent_id IS NOT NULL AND (parent.id IS NULL OR parent.project_id<>n.project_id)) LIMIT 1`).first()
   if(invalid)return false
   const cycle=await db.prepare(`WITH RECURSIVE ancestry(start,id) AS (SELECT id,parent_id FROM "${canvas}" WHERE parent_id IS NOT NULL UNION SELECT a.start,n.parent_id FROM ancestry a JOIN "${canvas}" n ON n.id=a.id WHERE n.parent_id IS NOT NULL) SELECT 1 FROM ancestry WHERE start=id LIMIT 1`).first()
   if(cycle)return false
  }
  if(search&&tasks){
   const mismatch=await db.prepare(`SELECT 1 FROM "${search}" s LEFT JOIN "${tasks}" t ON t.id=s.task_id WHERE t.id IS NULL OR s.body<>t.title||char(10)||t.description LIMIT 1`).first()
   if(mismatch)return false
  }
  return true
 },
 importSafety,
 importRow(table,row){if(table==='peg_template_rule_runs'&&row.status==='queued')return {...row,status:'pending',activation_id:null,outcome:'restored_inactive'};if(table==='peg_bundle_jobs'&&row.status==='queued')return {...row,status:'cancelled',finished_at:1};return importSafety[table]?{...row,...Object.fromEntries(Object.entries(importSafety[table]).map(([key,values])=>[key,values[0]]))}:row},
 exportRow(table,row){
  if(table==='peg_template_rules')return {...row,enabled:0,activation_id:null}
  if(table==='peg_template_rule_runs'&&row.status==='queued')return {...row,status:'pending',activation_id:null,outcome:'restored_inactive'}
  if(table==='peg_bundle_adoptions')return {...row,enabled:0}
  if(table==='peg_bundle_jobs'&&row.status==='queued')return {...row,status:'cancelled',finished_at:1}
  if(table==='peg_meetings'||table==='peg_meeting_proposals')return {...row,...Object.fromEntries(Object.entries(importSafety[table]).map(([key,values])=>[key,values[0]]))}
  if(table==='peg_engineering_links')return {...row,...Object.fromEntries(Object.entries(importSafety.peg_engineering_links).map(([key,values])=>[key,values[0]]))}
  if(table==='peg_processor_policies')return {...row,approved:0,sharing:0,training:0}
  if(table==='peg_recurrences')return {...row,active:0,held:1}
  if(table==='peg_grants')return {...row,revoked_at:revoked}
  if(table==='peg_goal_sources')return {...row,token_hash:null,ended_at:revoked,ended_cause:'restored_inactive'}
  return row
 },
}
