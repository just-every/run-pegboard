import { all, batch, bound, conflict, first, newId, notFound, now } from '../db'
import { guarded, revision } from '../decisions/revision'
import { openProject,need } from '../workspace/projects'
import { openTask,require } from '../tasks/access'
import { displayNames, type Actor } from '../workspace/people'
import { historyStatement } from '../tasks/history'
import type { Submission } from './submissions'
export async function triageQueue(db:D1Database,actor:Actor,projectId:string) {
 const {project,effective}=await openProject(db,actor,projectId);need(effective,'edit')
 const rows=await all<Submission & {title:string;owner_id:string;priority:string;name:string}>(db,'SELECT s.*,t.title,t.owner_id,t.priority,f.name FROM peg_intake_submissions s JOIN peg_intake_forms f ON f.id=s.form_id JOIN peg_tasks t ON t.id=s.task_id WHERE f.project_id=? ORDER BY s.submitted_at,s.id',projectId)
 const visible=[]
 for(const row of rows){const opened=await openTask(db,actor,row.task_id).catch(()=>null);if(!opened?.access.capabilities.has('edit'))continue;visible.push(row)}
 const names=await displayNames(db,visible.map(r=>r.owner_id))
 return {project:{id:project.id,name:project.name},items:visible.map(r=>({id:r.id,taskId:r.task_id,title:r.title,form:r.name,owner:names.get(r.owner_id)??'Unassigned',priority:r.priority,deadline:r.deadline,submittedAt:r.submitted_at,state:r.triaged_at?'triaged':r.deadline<=now()?'overdue':'waiting',escalation:!r.triaged_at&&r.deadline<=now()?'Project administrator attention required':null,escalatedAt:r.escalated_at}))}
}
export async function triageSubmission(db:D1Database,actor:Actor,id:string) {
 const rev=await revision(db),row=await first<Submission>(db,'SELECT * FROM peg_intake_submissions WHERE id=?',id)
 if(!row)throw notFound()
 const opened=await openTask(db,actor,row.task_id);require(opened.access,'edit')
 const form=await first<{project_id:string}>(db,'SELECT project_id FROM peg_intake_forms WHERE id=?',row.form_id);if(!form)throw notFound()
 need((await openProject(db,actor,form.project_id)).effective,'edit')
 if(row.triaged_at)return {ok:true,replayed:true}
 await guarded(db,rev,[bound(db,'UPDATE peg_intake_submissions SET triaged_at=?,triaged_by=? WHERE id=?',[now(),actor.id,id]),historyStatement(db,row.task_id,form.project_id,actor.id,'intake.triaged',{submissionId:id})]);return {ok:true,replayed:false}
}
export async function escalateIntake(db:D1Database) {
 await batch(db,[bound(db,"UPDATE peg_intake_submissions SET escalated_at=? WHERE triaged_at IS NULL AND escalated_at IS NULL AND deadline<=? AND EXISTS(SELECT 1 FROM peg_tasks t WHERE t.id=peg_intake_submissions.task_id)",[now(),now()])])
}
