import { processorFollowups,followupStatements } from './processors'
import { createPortability } from '@runeditrun/rer/modules/portability'
import policy from '../portability/policy.mjs'
import { all, bound, conflict, first, invalid, newId, now, placeholders, type Param } from '../db'
import { digest } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import { auditMetadata } from '../audit/metadata'
import { openTask } from '../tasks/access'
import { reopenGuard } from '../tasks/history'
import type { Actor } from '../workspace/people'
import { activeHolds, commitData, dataGuard, dataRevision, externalLimits, requireOwner } from './settings'

type Key=Record<string,string|number|null>
export interface Selection {table:string;keys:Key[]}
const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"'
export async function selectKeys(db:D1Database,table:string,where:string,args:Param[]):Promise<Selection> {
  const columns=await all<{name:string;pk:number}>(db,`PRAGMA table_info(${quote(table)})`)
  const pk=columns.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name)
  if(!pk.length)throw invalid('unregistered_erasure_key')
  return {table,keys:await all<Key>(db,`SELECT ${pk.map(quote).join(',')} FROM ${quote(table)} WHERE ${where} ORDER BY ${pk.map(quote).join(',')}`,...args)}
}
export const deletion=(db:D1Database,selection:Selection)=>selection.keys.map(key=>bound(db,`DELETE FROM ${quote(selection.table)} WHERE ${Object.keys(key).map(k=>quote(k)+' IS ?').join(' AND ')}`,Object.values(key)))
const descendants=(db:D1Database,roots:string[])=>all<{id:string}>(db,`WITH RECURSIVE scope(id) AS (SELECT id FROM peg_tasks WHERE id IN (${placeholders(roots)}) UNION SELECT t.id FROM peg_tasks t JOIN scope s ON t.parent_id=s.id) SELECT id FROM scope ORDER BY id`,...roots)
export async function erasurePlan(db:D1Database,actor:Actor,workspace:string,type:string,id:string) {
  await requireOwner(db,actor,workspace)
  if(!['project','task','person','attachment','proof'].includes(type))throw invalid('erasure_type')
  const revision=await dataRevision(db), selections:Selection[]=[], blockers:string[]=[], retained:Record<string,number>={}
  let tasks:string[]=[],projects:string[]=[],proofs:string[]=[],proofFiles:string[]=[],name=''
  const take=async(table:string,where:string,args:Param[])=>{const selected=await selectKeys(db,table,where,args);if(selected.keys.length){const prior=selections.find(s=>s.table===table);if(prior){const seen=new Set(prior.keys.map(k=>JSON.stringify(k)));prior.keys.push(...selected.keys.filter(k=>!seen.has(JSON.stringify(k))))}else selections.push(selected)}}
  if(type==='project'){
    const project=await first<{name:string}>(db,'SELECT name FROM peg_projects WHERE id=? AND workspace_id=?',id,workspace)
    if(!project)throw invalid('erasure_subject')
    name=project.name;projects=[id]
    const exclusive=await all<{id:string}>(db,'SELECT t.id FROM peg_tasks t JOIN peg_task_projects p ON p.task_id=t.id WHERE p.project_id=? AND (SELECT COUNT(*) FROM peg_task_projects WHERE task_id=t.id)=1 ORDER BY t.id',id)
    tasks=(await descendants(db,exclusive.map(t=>t.id))).map(t=>t.id)
    retained.shared_tasks=(await first<{n:number}>(db,'SELECT COUNT(*) n FROM peg_task_projects WHERE project_id=? AND task_id NOT IN ('+placeholders(tasks)+')',id,...tasks))!.n
  }else if(type==='task'){
    const opened=await openTask(db,actor,id)
    if(opened.task.workspace_id!==workspace)throw invalid('erasure_subject')
    name=opened.task.title;tasks=(await descendants(db,[opened.task.id])).map(t=>t.id)
  }else if(type==='attachment'){
    const file=await first<{task_id:string;name:string}>(db,'SELECT task_id,name FROM peg_attachments WHERE id=?',id)
    if(!file)throw invalid('erasure_subject')
    const opened=await openTask(db,actor,file.task_id)
    if(opened.task.workspace_id!==workspace)throw invalid('erasure_subject')
    name=file.name;await take('peg_attachments','id=?',[id])
    if((await activeHolds(db,workspace)).some(h=>h.target_type==='workspace'||h.target_type==='task'&&h.target_id===file.task_id||h.target_type==='project'&&opened.access.contexts.has(h.target_id)))blockers.push('active_legal_hold')
  }else if(type==='proof'){
    const proof=await first<{task_id:string}>(db,'SELECT task_id FROM peg_proofs WHERE id=?',id);if(!proof)throw invalid('erasure_subject')
    const opened=await openTask(db,actor,proof.task_id);if(opened.task.workspace_id!==workspace)throw invalid('erasure_subject')
    name='Proof on '+opened.task.title;proofs=[id]
  }else{
    const person=await first<{display_name:string;role:string;status:string}>(db,'SELECT display_name,role,status FROM oa_operators WHERE id=?',id)
    if(!person)throw invalid('erasure_subject')
    name=person.display_name
    if(person.role==='owner')blockers.push('owner_requires_explicit_installation_reset_or_replacement')
    if(person.status==='active')blockers.push('deactivate_person_before_erasure')
    if(await first(db,'SELECT 1 FROM peg_tasks WHERE owner_id=? UNION SELECT 1 FROM peg_projects WHERE owner_id=? UNION SELECT 1 FROM peg_goals WHERE owner_id=?',id,id,id))blockers.push('transfer_owned_work_before_erasure')
    if(await first(db,'SELECT 1 FROM peg_recurrences WHERE created_by=? UNION SELECT 1 FROM peg_work_templates WHERE created_by=?',id,id))blockers.push('review_recurring_work_custody_before_erasure')
    if(await first(db,'SELECT 1 FROM peg_proofs WHERE created_by=? UNION SELECT 1 FROM peg_proof_versions WHERE created_by=?',id,id))blockers.push('review_proof_custody_before_erasure')
    if(await first(db,'SELECT 1 FROM peg_time_entries WHERE person_id=?',id))blockers.push('retained_time_records_require_separate_review')
    await take('peg_workspace_members','operator_id=?',[id]);await take('peg_personal_layout','operator_id=?',[id]);await take('peg_personal_moves','operator_id=?',[id]);await take('peg_personal_rules','operator_id=?',[id]);await take('peg_personal_sections','operator_id=?',[id]);await take('peg_personal_settings','operator_id=?',[id])
    await take('peg_grants',"grantee_type='person' AND grantee_id=?",[id]);await take('peg_task_collaborators','operator_id=?',[id]);await take('peg_approvers','operator_id=?',[id]);await take('peg_inbox','operator_id=? OR request_id IN(SELECT id FROM peg_access_requests WHERE requester_id=?)',[id,id]);await take('peg_access_requests','requester_id=?',[id])
    await take('peg_comments','author_id=?',[id]);await take('peg_attachments','created_by=?',[id])
    retained.local_auth_material=(await first<{n:number}>(db,'SELECT (SELECT COUNT(*) FROM oa_sessions WHERE operator_id=?)+(SELECT COUNT(*) FROM oa_tokens WHERE operator_id=?)+(SELECT COUNT(*) FROM oa_credentials WHERE operator_id=?)+(SELECT COUNT(*) FROM oa_external_identities WHERE operator_id=?) n',id,id,id,id))!.n
    retained.legacy_access_activity=(await first<{n:number}>(db,'SELECT COUNT(*) n FROM peg_audit WHERE actor_id=? OR subject_id=?',id,id))!.n
    // Identity values are replaced only after authority is explicitly deactivated. Permanent audit IDs remain opaque.
  }
  if(tasks.length||projects.length||type==='attachment'){
    const affected=await all<{id:string;task_id:string}>(db,`SELECT DISTINCT p.id,p.task_id FROM peg_proofs p JOIN peg_proof_versions v ON v.proof_id=p.id JOIN peg_attachments a ON a.id=v.attachment_id WHERE p.task_id IN (${placeholders(tasks)}) OR a.project_id IN (${placeholders(projects)}) OR a.id=?`,...tasks,...projects,type==='attachment'?id:'')
    proofs=[...new Set([...proofs,...affected.map(p=>p.id)])]
    if(type==='project'&&affected.some(p=>!tasks.includes(p.task_id)))blockers.push('shared_proof_requires_explicit_proof_erasure')
  }
  if(proofs.length){
    proofFiles=(await all<{attachment_id:string}>(db,`SELECT attachment_id FROM peg_proof_versions WHERE proof_id IN (${placeholders(proofs)})`,...proofs)).map(r=>r.attachment_id)
    for(const table of ['peg_proof_decisions','peg_proof_versions'])await take(table,`proof_id IN (${placeholders(proofs)})`,proofs)
    await take('peg_proofs',`id IN (${placeholders(proofs)})`,proofs)
  }
  if(type==='person'){
    await take('peg_agent_retrieval','output_id IN(SELECT id FROM peg_agent_outputs WHERE actor_id=?)',[id]);await take('peg_agent_outputs','actor_id=?',[id])
  }
  if(tasks.length||projects.length){
    if(await first(db,`SELECT 1 FROM peg_time_entries WHERE task_id IN (${placeholders(tasks)}) OR project_id IN (${placeholders(projects)})`,...tasks,...projects))blockers.push('retained_time_records_require_separate_review')
    const sourceIds=[...tasks,...projects]
    if(await first(db,`SELECT 1 FROM peg_work_templates WHERE source_id IN (${placeholders(sourceIds)}) OR ${sourceIds.map(()=>"instr(snapshot,?)>0").join(' OR ')}`,...sourceIds,...sourceIds))blockers.push('review_recurring_snapshot_custody_before_erasure')
    if(projects.length&&await first(db,`SELECT 1 FROM peg_field_definitions f WHERE authority_project IN (${placeholders(projects)}) AND EXISTS(SELECT 1 FROM peg_project_fields p WHERE p.field_id=f.id AND p.project_id NOT IN (${placeholders(projects)}))`,...projects,...projects))blockers.push('transfer_shared_field_authority_before_erasure')
    const scoped=(column:string)=>`${column} IN (${placeholders(tasks)})`, projectScoped=(column:string)=>`${column} IN (${placeholders(projects)})`
    await take('peg_canvas_nodes',`${scoped('task_id')} OR ${projectScoped('project_id')}`,[...tasks,...projects])
    await take('peg_agent_retrieval',`${scoped('task_id')} OR output_id IN(SELECT id FROM peg_agent_outputs WHERE ${projectScoped('project_id')})`,[...tasks,...projects])
    await take('peg_agent_outputs',`${scoped('task_id')} OR ${projectScoped('project_id')}`,[...tasks,...projects])
    await take('peg_search_records',scoped('task_id'),tasks)
    // Child rows first, including all current caches, identity aliases and values.
    for(const table of ['peg_task_tags','peg_personal_layout','peg_personal_moves','peg_approval_reopen_guards','peg_decision_guards','peg_task_decisions','peg_approval_owners','peg_approval_tasks','peg_field_values','peg_task_collaborators','peg_task_refs'])await take(table,scoped('task_id'),tasks)
    for(const table of ['peg_history','peg_comments','peg_attachments'])await take(table,`${scoped('task_id')} OR ${projectScoped('project_id')}`,[...tasks,...projects])
    await take('peg_goal_links',`(source_type='task' AND ${scoped('source_id')}) OR (source_type='project' AND ${projectScoped('source_id')})`,[...tasks,...projects])
    await take('peg_inbox',`request_id IN(SELECT id FROM peg_access_requests WHERE (target_type='task' AND ${scoped('target_id')}) OR (target_type='project' AND ${projectScoped('target_id')}))`,[...tasks,...projects])
    await take('peg_access_requests',`(target_type='task' AND ${scoped('target_id')}) OR (target_type='project' AND ${projectScoped('target_id')})`,[...tasks,...projects])
    await take('peg_recurring_grants',`grant_id IN(SELECT id FROM peg_grants WHERE (object_type='task' AND ${scoped('object_id')}) OR (object_type='project' AND ${projectScoped('object_id')}))`,[...tasks,...projects])
    for(const table of ['peg_grants','peg_approvers','peg_template_origins'])await take(table,`(object_type='task' AND ${scoped('object_id')}) OR (object_type='project' AND ${projectScoped('object_id')})`,[...tasks,...projects])
    await take('peg_task_projects',`${scoped('task_id')} OR ${projectScoped('project_id')}`,[...tasks,...projects])
    await take('peg_tasks',scoped('id'),tasks)
    await take('peg_webhooks',projectScoped('project_id'),projects)
    await take('peg_project_fields',projectScoped('project_id'),projects)
    await take('peg_field_definitions',projectScoped('authority_project'),projects)
    for(const table of ['peg_sections','peg_tag_projects','peg_project_completion','peg_ref_prefixes'])await take(table,projectScoped('project_id'),projects)
    await take('peg_projects',projectScoped('id'),projects)
  }
  if(proofFiles.length)await take('peg_attachments',`id IN (${placeholders(proofFiles)})`,proofFiles)
  const affectedTasks=new Set(tasks)
  if(proofs.length)for(const proof of await all<{task_id:string}>(db,`SELECT task_id FROM peg_proofs WHERE id IN (${placeholders(proofs)})`,...proofs))affectedTasks.add(proof.task_id)
  if(projects.length){const roots=(await all<{task_id:string}>(db,`SELECT task_id FROM peg_task_projects WHERE project_id IN (${placeholders(projects)})`,...projects)).map(t=>t.task_id);for(const t of await descendants(db,roots))affectedTasks.add(t.id)}
  if(type==='attachment'){
    const file=await first<{task_id:string}>(db,'SELECT task_id FROM peg_attachments WHERE id=?',id);if(file)affectedTasks.add(file.task_id)
  }
  if(type==='person'){
    for(const t of await all<{task_id:string}>(db,'SELECT task_id FROM peg_comments WHERE author_id=? UNION SELECT task_id FROM peg_attachments WHERE created_by=? UNION SELECT task_id FROM peg_agent_outputs WHERE actor_id=?',id,id,id))affectedTasks.add(t.task_id)
  }
  const affected=[...affectedTasks], relatedProjects=new Set(projects), relatedPeople=new Set<string>()
  for(const r of await all<{project_id:string}>(db,`SELECT project_id FROM peg_task_projects WHERE task_id IN (${placeholders(affected)})`,...affected))relatedProjects.add(r.project_id)
  for(const r of await all<{person:string}>(db,`SELECT owner_id person FROM peg_tasks WHERE id IN (${placeholders(affected)}) UNION SELECT creator_id person FROM peg_tasks WHERE id IN (${placeholders(affected)}) UNION SELECT author_id person FROM peg_comments WHERE task_id IN (${placeholders(affected)}) UNION SELECT created_by person FROM peg_attachments WHERE task_id IN (${placeholders(affected)})`,...affected,...affected,...affected,...affected))relatedPeople.add(r.person)
  // Person anonymization affects installation identity, so every workspace hold participates.
  const active=type==='person'?(await all<Awaited<ReturnType<typeof activeHolds>>[number]>(db,'SELECT * FROM peg_data_holds WHERE released_at IS NULL AND expires_at>?',now())):await activeHolds(db,workspace)
  const affectedAttachments=selections.find(s=>s.table==='peg_attachments')?.keys.map(k=>k.id)??[]
  const holds=active.filter(h=>h.target_type==='workspace'||h.target_type===type&&h.target_id===id||h.target_type==='task'&&affectedTasks.has(h.target_id)||h.target_type==='project'&&relatedProjects.has(h.target_id)||h.target_type==='person'&&relatedPeople.has(h.target_id)||h.target_type==='attachment'&&affectedAttachments.includes(h.target_id)||h.target_type==='proof'&&proofs.includes(h.target_id))
  if(holds.length)blockers.push('active_legal_hold')
  const remaining=affected.filter(task=>!tasks.includes(task))
  const reopenTasks=(await all<{id:string}>(db,`SELECT id FROM peg_tasks WHERE id IN (${placeholders(remaining)}) AND status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=peg_tasks.id)`,...remaining)).map(t=>t.id)
  if(reopenTasks.length)retained.reopened_signoffs=reopenTasks.length
  const targets=[...new Set([id,...tasks,...selections.flatMap(s=>s.keys.flatMap(k=>typeof k.id==='string'?[k.id]:[]))])]
  const legacy=await all<{detail:string}>(db,`SELECT detail FROM peg_audit WHERE workspace_id=? AND target_id IN (${placeholders(targets)})`,workspace,...targets)
  const unsafeLegacy=legacy.filter(row=>{const raw=JSON.parse(row.detail),safe=auditMetadata(raw);return Object.entries(raw).some(([key,value])=>value!==null&&value!==undefined&&JSON.stringify(safe[key])!==JSON.stringify(value))}).length
  if(unsafeLegacy)retained.legacy_access_activity=Math.max(retained.legacy_access_activity??0,unsafeLegacy)
  if(type==='attachment'){
    const file=await first<{task_id:string}>(db,'SELECT task_id FROM peg_attachments WHERE id=?',id)
    if(file)retained.attachment_activity=(await first<{n:number}>(db,"SELECT COUNT(*) n FROM peg_history WHERE task_id=? AND kind='attachment.added'",file.task_id))!.n
  }
  const counts=Object.fromEntries(selections.map(s=>[s.table,s.keys.length]))
  const processorRequests=await processorFollowups(db,selections)
  const plan={type,id,name,tasks,projects,proofs,processorRequests,reopenTasks,selections,counts,blockers:[...new Set(blockers)],holds:holds.map(h=>({id:h.id,authority:h.authority,expiresAt:h.expires_at})),retained,externalLimits}
  return {...plan,revision,token:await digest([workspace,actor.id,revision,plan])}
}
export async function erase(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
  const plan=await erasurePlan(db,actor,workspace,String(input.type),String(input.id))
  if(input.token!==plan.token||!(input.confirm===true||input.confirm==='yes'))throw conflict('erasure_review_required')
  const id=newId('erasure'),at=now(),blocked=plan.blockers.length>0
  const outcome=blocked?'retained':plan.processorRequests.length>0||plan.type==='person'||plan.retained.legacy_access_activity>0||plan.retained.attachment_activity>0?'partial':'complete'
  const deadline=Math.min(at+300000,...(await activeHolds(db,workspace)).map(h=>h.expires_at))
  const statements=[dataGuard(db,actor,plan.revision,deadline)]
  if(!blocked){
    const service=await createPortability({db,policy})
    statements.push(...followupStatements(db,actor,workspace,plan.processorRequests))
    statements.push(...await service.invalidateTransfersStatements())
    for(const task of plan.reopenTasks)statements.push(reopenGuard(db,task,actor.id,'custody_erasure'),bound(db,"UPDATE peg_tasks SET status='todo',completed_at=NULL,updated_at=? WHERE id=?",[at,task]))
    for(const proof of plan.proofs)statements.push(bound(db,'INSERT INTO peg_data_erasing_proofs VALUES(?)',[proof]))
    for(const selected of plan.selections.filter(s=>s.table==='peg_agent_outputs'))for(const key of selected.keys){const row=await first<{actor_id:string;operation_key:string}>(db,'SELECT actor_id,operation_key FROM peg_agent_outputs WHERE id=?',key.id);if(row)statements.push(bound(db,"INSERT OR IGNORE INTO peg_data_erased_objects VALUES('agent_output_key',?,?)",[await digest([row.actor_id,row.operation_key]),at]))}
    for(const task of plan.tasks)statements.push(bound(db,'INSERT INTO peg_data_erasing_tasks VALUES(?)',[task]))
    for(const selection of plan.selections){
      for(const key of selection.keys)statements.push(...await service.erasureStatements(selection.table,key))
      statements.push(...deletion(db,selection))
    }
    // A redaction checkpoint prevents every older archive, including copied names in historical activity, from returning.
    statements.push(...await service.redactionStatements())
    for(const task of plan.tasks)statements.push(bound(db,"INSERT INTO peg_data_erased_objects VALUES('task',?,?)",[task,at]))
    for(const project of plan.projects)statements.push(bound(db,"INSERT INTO peg_data_erased_objects VALUES('project',?,?)",[project,at]))
    if(plan.type==='person'){
      statements.push(bound(db,'INSERT OR IGNORE INTO peg_erased_people VALUES(?,?)',[plan.id,at]),bound(db,"UPDATE oa_operators SET email=?,display_name='Erased actor',version=version+1 WHERE id=? AND status<>'active' AND role<>'owner'",[`erased-${plan.id}@invalid.example`,plan.id]))
      // Tokens and sessions can no longer authenticate an inactive, version-fenced identity. Their expired bytes use transient cleanup.
    }
    statements.push(bound(db,'DELETE FROM peg_data_erasing_tasks',[]),bound(db,'DELETE FROM peg_data_erasing_proofs',[]))
  }
  statements.push(bound(db,'INSERT INTO peg_data_receipts VALUES(?,?,?,?,?,?,?,?,?,?)',[id,workspace,actor.id,plan.type,plan.id,at,outcome,JSON.stringify(blocked?{}:plan.counts),JSON.stringify({counts:plan.retained,conflicts:plan.blockers,processorRequests:blocked?0:plan.processorRequests.length}),externalLimits]),permanentEvent(db,{workspace,actor:actor.id,action:'data.erasure',type:plan.type,id:plan.id,result:outcome==='complete'?'success':outcome}))
  await commitData(db,statements)
  return {id,outcome,counts:blocked?{}:plan.counts,retained:plan.retained,conflicts:plan.blockers,processorRequests:blocked?0:plan.processorRequests.length,externalLimits}
}
