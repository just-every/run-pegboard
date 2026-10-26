import {all,bound,conflict,first,forbidden,newId,notFound,now} from '../db'
import {openTask,require} from '../tasks/access'
import {openProject,need} from '../workspace/projects'
import {taskAccess} from '../authorization/effective'
import {workspaceRole,type Actor} from '../workspace/people'
import {prepareTask} from '../tasks/tasks'
import {historyStatement,reopenGuard} from '../tasks/history'
import {tagCatalogue} from '../tags/tags'
import type {TaskRow} from '../model'
import {workActions,type WorkAction} from './action-config'
export interface WorkEffect {effectId:string;taskId:string;kind:WorkAction['kind'];targetId:string;before:Record<string,unknown>;after:Record<string,unknown>;generation:number;historyId:number;taskDecisions:number;proofDecisions:number}
interface Stored {id:string;task_id:string;kind:WorkAction['kind'];target_id:string;before_value:string;after_value:string;generation:number;history_id:number;task_decisions:number;proof_decisions:number}
export async function workEffectRows(db:D1Database,operationId:string):Promise<WorkEffect[]>{
 return (await all<Stored>(db,'SELECT * FROM peg_rule_work_effects WHERE operation_id=? ORDER BY id',operationId)).map(e=>({effectId:e.id,taskId:e.task_id,kind:e.kind,targetId:e.target_id,before:JSON.parse(e.before_value),after:JSON.parse(e.after_value),generation:e.generation,historyId:e.history_id,taskDecisions:e.task_decisions,proofDecisions:e.proof_decisions}))
}
const generation=(db:D1Database,kind:string,taskId:string,targetId:string)=>first<{generation:number}>(db,'SELECT generation FROM peg_rule_link_generations WHERE kind=? AND task_id=? AND target_id=?',kind,taskId,targetId).then(row=>row?.generation??0)
export async function prepareWorkActions(db:D1Database,actor:Actor,task:TaskRow,projectId:string,value:unknown){
 const actions=workActions(value),mutations:D1PreparedStatement[]=[],effects:Omit<WorkEffect,'generation'|'historyId'|'taskDecisions'|'proofDecisions'>[]=[]
 const opened=await openTask(db,actor,task.id);require(opened.access,'edit')
 const record=(action:WorkAction,targetId:string,before:Record<string,unknown>,after:Record<string,unknown>)=>effects.push({effectId:newId('effect'),taskId:task.id,kind:action.kind,targetId,before,after})
 for(const action of actions){
  const target=action.value??task.id
  if(action.kind==='complete'){
   if(await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',task.id))throw conflict('approval_decision_required')
   if(task.status==='done')continue
   const at=now();mutations.push(bound(db,"UPDATE peg_tasks SET status='done',completed_at=?,updated_at=? WHERE id=?",[at,at,task.id]))
   record(action,task.id,{status:task.status,completedAt:task.completed_at},{status:'done',completedAt:at})
  }else if(action.kind==='comment'){
   require(opened.access,'comment');const id=newId('cmt')
   mutations.push(reopenGuard(db,task.id,actor.id,'rule_comment'),bound(db,'INSERT INTO peg_comments(id,task_id,project_id,author_id,body,created_at) VALUES(?,?,?,?,?,?)',[id,task.id,projectId,actor.id,target,now()]))
   record(action,id,{}, {body:target,author:actor.id})
  }else if(action.kind==='collaborator'){
   const role=await workspaceRole(db,target,task.workspace_id),access=await taskAccess(db,{...actor,id:target},task)
   if(!role||['agent','guest'].includes(role)||!access.capabilities.has('read'))throw forbidden('collaborator_existing_access')
   if(await first(db,'SELECT 1 FROM peg_task_collaborators WHERE task_id=? AND operator_id=?',task.id,target))continue
   mutations.push(reopenGuard(db,task.id,actor.id,'rule_collaborator'),bound(db,'INSERT INTO peg_task_collaborators VALUES(?,?)',[task.id,target]));record(action,target,{}, {})
  }else if(action.kind==='project'){
   if(task.parent_id)throw conflict('subtask_follows_parent')
   const destination=await openProject(db,actor,target);need(destination.effective,'manage_rules')
   if(destination.project.workspace_id!==task.workspace_id)throw notFound()
   if(await first(db,'SELECT 1 FROM peg_task_projects WHERE task_id=? AND project_id=?',task.id,target))continue
   const section=await first<{id:string}>(db,'SELECT id FROM peg_sections WHERE project_id=? ORDER BY position LIMIT 1',target)
   mutations.push(reopenGuard(db,task.id,actor.id,'rule_project'),bound(db,'INSERT INTO peg_task_projects(task_id,project_id,section_id,position,added_by,added_at) VALUES(?,?,?,(SELECT COALESCE(MAX(position),0)+1 FROM peg_task_projects WHERE project_id=?),?,?)',[task.id,target,section?.id??null,target,actor.id,now()]));record(action,target,{}, {})
  }else if(action.kind==='tag'){
   const tag=(await tagCatalogue(db,actor,task.workspace_id)).find(t=>t.id===target)
   if(!tag||tag.archived)throw notFound()
   if(tag.owner_id||!await first(db,'SELECT 1 FROM peg_tag_projects WHERE tag_id=? AND project_id=?',target,projectId))throw forbidden('rule_project_tag')
   if(await first(db,'SELECT 1 FROM peg_task_tags WHERE task_id=? AND tag_id=?',task.id,target))continue
   mutations.push(reopenGuard(db,task.id,actor.id,'rule_tag'),bound(db,'INSERT INTO peg_task_tags VALUES(?,?)',[task.id,target]));record(action,target,{}, {})
  }else{
   const child=await prepareTask(db,actor,{parentId:task.id,projectId,title:target},{queueRules:false});mutations.push(...child.statements);record(action,child.id,{}, {})
  }
  mutations.push(historyStatement(db,task.id,projectId,actor.id,'rule.action_applied',{action:action.kind}))
 }
 return {effects,statements:mutations,record:(operationId:string)=>effects.map(e=>bound(db,`INSERT INTO peg_rule_work_effects VALUES(?,?,?,?,?,?,?,CASE WHEN ? IN('subtask','complete') THEN COALESCE((SELECT generation FROM peg_rule_mutation_generations WHERE task_id=? AND kind=?),0) ELSE COALESCE((SELECT generation FROM peg_rule_link_generations WHERE kind=? AND task_id=? AND target_id=?),0) END,(SELECT COALESCE(MAX(id),0) FROM peg_history WHERE task_id=?),(SELECT COUNT(*) FROM peg_task_decisions WHERE task_id=?),(SELECT COUNT(*) FROM peg_proof_decisions d JOIN peg_proofs p ON p.id=d.proof_id WHERE p.task_id=?))`,[e.effectId,operationId,e.taskId,e.kind,e.targetId,JSON.stringify(e.before),JSON.stringify(e.after),e.kind,e.kind==='subtask'?e.targetId:e.taskId,e.kind==='complete'?'status':'task',e.kind,e.taskId,e.targetId,e.kind==='subtask'?e.targetId:e.taskId,e.taskId,e.taskId]))}
}
export async function workUndoPreview(db:D1Database,actor:Actor,operationId:string){
 const effects=await workEffectRows(db,operationId),restored:WorkEffect[]=[],conflicts:{effectId:string;taskId:string;field:string;reason:string}[]=[]
 for(const effect of effects){
  const {task}=await openTask(db,actor,effect.taskId);let reason:string|null=null
  const decisions=await first<{tasks:number;proofs:number}>(db,'SELECT (SELECT COUNT(*) FROM peg_task_decisions WHERE task_id=?) tasks,(SELECT COUNT(*) FROM peg_proof_decisions d JOIN peg_proofs p ON p.id=d.proof_id WHERE p.task_id=?) proofs',task.id,task.id)
  if(decisions!.tasks!==effect.taskDecisions||decisions!.proofs!==effect.proofDecisions)reason='later_human_decision'
  else if(effect.kind==='complete'){
   if(effect.generation!==((await first<{generation:number}>(db,"SELECT generation FROM peg_rule_mutation_generations WHERE task_id=? AND kind='status'",task.id))?.generation??0)||task.status!=='done'||task.completed_at!==effect.after.completedAt||await first(db,"SELECT 1 FROM peg_history WHERE task_id=? AND id>? AND (json_type(detail,'$.status') IS NOT NULL OR kind='status.changed')",task.id,effect.historyId))reason='later_status_edit'
  }else if(effect.kind==='comment'){
   const comment=await first<{body:string;author_id:string}>(db,'SELECT body,author_id FROM peg_comments WHERE id=? AND task_id=?',effect.targetId,task.id)
   if(!comment||comment.body!==effect.after.body||comment.author_id!==effect.after.author)reason='later_comment_change'
  }else if(effect.kind==='subtask'){
   const child=await first<TaskRow>(db,'SELECT * FROM peg_tasks WHERE id=? AND parent_id=?',effect.targetId,task.id)
   if(!child)reason='created_work_unavailable'
   else if(!await taskAccess(db,actor,child).then(a=>a.capabilities.has('edit')))reason='created_work_unavailable'
   else if(effect.generation!==((await first<{generation:number}>(db,"SELECT generation FROM peg_rule_mutation_generations WHERE task_id=? AND kind='task'",child.id))?.generation??0))reason='later_created_work'
   else if(await first(db,`SELECT 1 WHERE EXISTS(SELECT 1 FROM peg_history WHERE task_id=? AND id>?) OR EXISTS(SELECT 1 FROM peg_comments WHERE task_id=?) OR EXISTS(SELECT 1 FROM peg_attachments WHERE task_id=?) OR EXISTS(SELECT 1 FROM peg_time_entries WHERE task_id=?) OR EXISTS(SELECT 1 FROM peg_tasks WHERE parent_id=?) OR EXISTS(SELECT 1 FROM peg_field_values WHERE task_id=?) OR EXISTS(SELECT 1 FROM peg_task_tags WHERE task_id=?) OR EXISTS(SELECT 1 FROM peg_task_collaborators WHERE task_id=?) OR EXISTS(SELECT 1 FROM peg_recovery WHERE object_type='task' AND object_id=? AND restored_at IS NULL) OR EXISTS(SELECT 1 FROM peg_dependencies WHERE predecessor_id=? OR successor_id=?)`,child.id,effect.historyId,child.id,child.id,child.id,child.id,child.id,child.id,child.id,child.id,child.id,child.id))reason='later_created_work'
  }else{
   if(await generation(db,effect.kind,task.id,effect.targetId)!==effect.generation)reason='later_relationship_change'
   if(!reason&&effect.kind==='project'){
    const project=await openProject(db,actor,effect.targetId).catch(()=>null)
    if(!project?.effective.capabilities.has('edit'))reason='project_authority_changed'
    else if((await first<{n:number}>(db,'SELECT COUNT(*) n FROM peg_task_projects WHERE task_id=?',task.id))!.n<2)reason='last_project'
    else if(await first(db,'SELECT 1 FROM peg_history WHERE task_id=? AND id>?',task.id,effect.historyId))reason='later_project_work'
   }
  }
  if(reason)conflicts.push({effectId:effect.effectId,taskId:task.id,field:effect.kind,reason});else restored.push(effect)
 }
 return {restored,conflicts}
}
export function workUndoStatements(db:D1Database,actor:Actor,effects:WorkEffect[],workspace:string){
 const statements:D1PreparedStatement[]=[]
 for(const e of effects){
  if(e.kind==='complete')statements.push(bound(db,'UPDATE peg_tasks SET status=?,completed_at=?,updated_at=? WHERE id=?',[e.before.status as string,e.before.completedAt as number|null,now(),e.taskId]))
  else if(e.kind==='comment')statements.push(reopenGuard(db,e.taskId,actor.id,'rule_comment_undo'),bound(db,'DELETE FROM peg_comments WHERE id=? AND task_id=?',[e.targetId,e.taskId]))
  else if(e.kind==='subtask')statements.push(bound(db,"INSERT INTO peg_recovery(object_type,object_id,workspace_id,actor_id,removed_at,restored_at,restored_by) VALUES('task',?,?,?,?,NULL,NULL) ON CONFLICT(object_type,object_id) DO UPDATE SET actor_id=excluded.actor_id,removed_at=excluded.removed_at,restored_at=NULL,restored_by=NULL",[e.targetId,workspace,actor.id,now()]))
  else {const table=e.kind==='collaborator'?'peg_task_collaborators':e.kind==='project'?'peg_task_projects':'peg_task_tags',column=e.kind==='collaborator'?'operator_id':e.kind==='project'?'project_id':'tag_id';statements.push(reopenGuard(db,e.taskId,actor.id,'rule_undo'),bound(db,`DELETE FROM ${table} WHERE task_id=? AND ${column}=?`,[e.taskId,e.targetId]))}
  statements.push(historyStatement(db,e.taskId,null,actor.id,'rule.action_undone',{effectId:e.effectId,action:e.kind}))
 }
 return statements
}
