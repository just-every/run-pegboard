// One policy for native CLI and the HTTP archive doors. No active source-installation authority travels.
const revoked=1
const importSafety={peg_message_drafts:{inactive:[1]},peg_message_publications:{inactive:[1]},peg_message_notices:{state:['cancelled']},peg_approval_followup_policies:{enabled:[0]},peg_approval_followup_episodes:{state:['cancelled'],cause:['restored_inactive'],next_at:[null]},peg_approval_followup_events:{state:['cancelled'],cause:['restored_inactive'],next_at:[null]},peg_approval_followup_deliveries:{state:['cancelled'],cause:['restored_inactive'],next_at:[null]},peg_intake_forms:{publisher_id:[null],publisher_version:[null],published_version:[null],public_hash:[null],revoked_at:[1]},peg_capacity_feeds:{active:[0],fetched_at:[null]},peg_local_rules:{enabled:[0],activation_id:[null],activated_by:[null]},peg_approval_routes:{withdrawn_at:[revoked]},peg_approval_links:{revoked_at:[revoked]},peg_status_rights_requests:{handler_until:[0]},peg_template_rules:{enabled:[0],activation_id:[null]},peg_bundle_adoptions:{enabled:[0]},peg_meetings:{revoked_at:[revoked],segments:['[]']},peg_meeting_proposals:{title:[''],owner_id:[null],due_date:[null],date_resolved:[0]},peg_engineering_links:{revoked_at:[revoked],source_status:[null],source_owner:[null],mapped_owner:[null],source_version:[null],indicator:[null],pending_status:[null],state:['stale'],cause:['restored_inactive']},peg_recurrences:{active:[0],held:[1]},peg_grants:{revoked_at:[revoked]},peg_goal_sources:{token_hash:[null],ended_at:[revoked],ended_cause:['restored_inactive']},peg_processor_policies:{approved:[0],sharing:[0],training:[0]}}
export default {
 product:'runeditrun/foundation',
 includeTables:['oa_operators','oa_bootstrap','oa_external_identities','oa_invitation_cancellations','oa_tokens','oa_auth_settings','oa_auth_audit','oa_domain_rules','oa_logout_events','oc_owner_claims','oc_idp_grants'],
 excludeTables:['peg_time_diagnostic_expiry','peg_data_erasing_feedback','peg_intake_guards','peg_intake_limits','peg_report_snapshots','peg_report_guards','peg_project_request_intake','peg_analytics_dependencies','peg_analytics_schedules','peg_analytics_runs','peg_calendar_connections','peg_calendar_blocks','peg_calendar_previews','peg_status_rights_guards','peg_status_review_guards','peg_api_cursors','peg_api_guards','peg_webhook_deliveries','peg_api_keys','peg_api_intents','peg_api_events','peg_api_receipts','peg_template_rule_execution_guards','peg_departure_guards','peg_canvas_guards','peg_analytics_keys','peg_analytics_snapshots','peg_analytics_rows','peg_analytics_guards','peg_meeting_guards','rer_dependency_keys','rer_dependency_pending','rer_dependency_codes','peg_webhooks','peg_data_guards','peg_data_erasing_tasks','peg_data_erasing_proofs'],
 requiredConfiguration:['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','MAIL_PROVIDER','MAIL_FROM'],
 async validateStaged({db,tables}){
  const publications=tables.peg_message_publications, drafts=tables.peg_message_drafts, comments=tables.peg_message_comments, messageHistory=tables.peg_message_comment_history, notices=tables.peg_message_notices
  if(publications){
   if(!drafts||!comments||!messageHistory||!notices)return false
   if(await db.prepare(`SELECT 1 FROM "${publications}" p LEFT JOIN "${drafts}" d ON d.id=p.draft_id LEFT JOIN "${publications}" root ON root.id=p.root_id WHERE d.id IS NULL OR root.id IS NULL OR root.project_id<>p.project_id OR root.recipients<>p.recipients OR d.project_id<>p.project_id OR d.version<>p.draft_version LIMIT 1`).first())return false
   if(await db.prepare(`SELECT 1 FROM "${comments}" c LEFT JOIN "${publications}" p ON p.id=c.publication_id WHERE p.id IS NULL OR p.root_id<>c.root_id OR NOT EXISTS(SELECT 1 FROM "${messageHistory}" h WHERE h.comment_id=c.id AND h.revision=c.revision AND h.body=c.body AND h.deleted_at IS c.deleted_at AND h.author_id=c.author_id) LIMIT 1`).first())return false
   if(await db.prepare(`SELECT 1 FROM "${notices}" n LEFT JOIN "${publications}" p ON p.id=n.publication_id WHERE p.id IS NULL OR p.root_id<>n.root_id LIMIT 1`).first())return false
  }

  const search=tables.peg_search_records,tasks=tables.peg_tasks
  const feedback=tables.peg_proof_feedback,history=tables.peg_proof_feedback_history,versions=tables.peg_proof_versions
  if(feedback){
   if(!versions||!history)return false
   if(await db.prepare(`SELECT 1 FROM "${feedback}" f LEFT JOIN "${versions}" v ON v.id=f.version_id WHERE v.id IS NULL OR v.proof_id<>f.proof_id OR v.attachment_id<>f.attachment_id OR v.digest<>f.digest OR NOT EXISTS(SELECT 1 FROM "${history}" h WHERE h.feedback_id=f.id AND h.revision=f.revision AND h.body=f.body AND h.state=f.state AND h.actor_id=f.author_id) LIMIT 1`).first())return false
   if(await db.prepare(`SELECT 1 FROM "${history}" h LEFT JOIN "${feedback}" f ON f.id=h.feedback_id WHERE f.id IS NULL OR f.proof_id<>h.proof_id OR f.version_id<>h.version_id OR f.author_id<>h.actor_id LIMIT 1`).first())return false
  }
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
 importRow(table,row){if(table==='peg_guest_share_reviews'&&row.status==='pending')return {...row,status:'cancelled',review_until:0};if(table==='peg_local_rule_runs'&&row.status==='queued')return {...row,status:'pending',activation_id:null,outcome:'restored_inactive'};if(table==='peg_template_rule_runs'&&row.status==='queued')return {...row,status:'pending',activation_id:null,outcome:'restored_inactive'};if(table==='peg_bundle_jobs'&&row.status==='queued')return {...row,status:'cancelled',finished_at:1};return importSafety[table]?{...row,...Object.fromEntries(Object.entries(importSafety[table]).map(([key,values])=>[key,values[0]]))}:row},
 exportRow(table,row){
  if(table.startsWith('peg_message_')&&importSafety[table])return {...row,...Object.fromEntries(Object.entries(importSafety[table]).map(([key,values])=>[key,values[0]]))}

  if(table.startsWith('peg_approval_followup_')&&importSafety[table])return {...row,...Object.fromEntries(Object.entries(importSafety[table]).map(([key,values])=>[key,values[0]]))}
  if(table==='peg_guest_share_reviews'&&row.status==='pending')return {...row,status:'cancelled',review_until:0}
  if(table==='peg_intake_forms')return {...row,...Object.fromEntries(Object.entries(importSafety.peg_intake_forms).map(([key,values])=>[key,values[0]]))}
  if(table==='peg_capacity_feeds')return {...row,active:0,fetched_at:null}
  if(table==='peg_status_rights_requests')return {...row,handler_until:0}
  if(table==='peg_approval_routes')return {...row,withdrawn_at:revoked}
  if(table==='peg_approval_links')return {...row,revoked_at:revoked}
  if(table==='peg_local_rules')return {...row,enabled:0,activation_id:null,activated_by:null}
  if(table==='peg_local_rule_runs'&&row.status==='queued')return {...row,status:'pending',activation_id:null,outcome:'restored_inactive'}
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
