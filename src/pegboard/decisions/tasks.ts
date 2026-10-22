import { all, bound, conflict, first, forbidden, invalid, newId, now } from '../db'
import { isAdministrator } from '../authorization/levels'
import { workspaceRole, type Actor } from '../workspace/people'
import { openTask } from '../tasks/access'
import { historyStatement } from '../tasks/history'
import { digest, guarded, revision } from './revision'

export async function decisionPreview(db: D1Database, actor: Actor, id: string) {
  const rev=await revision(db), {task,access}=await openTask(db,actor,id)
  if(!await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',task.id)) throw invalid('approval_task_required')
  const role=await workspaceRole(db,actor.id,task.workspace_id)
  // Whoever has owned the task since its previous decision (and whoever owned it at that decision) is accountable for the work under review, never its decider.
  const epoch=(await first<{n:number}>(db,'SELECT COUNT(*) n FROM peg_task_decisions WHERE task_id=?',task.id))!.n
  const accountable=new Set((await all<{owner_id:string}>(db,'SELECT DISTINCT owner_id FROM peg_approval_owners WHERE task_id=? AND epoch=?',task.id,epoch)).map(r=>r.owner_id)).add(task.owner_id)
  const eligible=access.personal?[]:(await all<{id:string}>(db,"SELECT id FROM oa_operators WHERE status='active' AND role IN ('owner','admin')")).filter(r=>!accountable.has(r.id))
  const waiting=access.personal?'personal_share_required':accountable.has(actor.id)?'you_own_or_owned_this':!eligible.length?'another_decider_needed':!isAdministrator(role)?'administrator_required':null
  const canDecide=waiting===null
  const decisions=await all<{id:string;actor_id:string;at:number;revision:string;action:string;reason:string}>(db,'SELECT * FROM peg_task_decisions WHERE task_id=? ORDER BY at,id',task.id)
  // The revision includes all current work and access changes. Reading it does not approve anything.
  return {taskId:task.id, title:task.title, canDecide, waiting, anotherDeciderNeeded:!access.personal&&!eligible.length, decisions, rev, token:await digest([task,rev])}
}
export async function decideTask(db: D1Database, actor: Actor, id: string, input: Record<string,any>) {
  const preview=await decisionPreview(db,actor,id)
  if(!preview.canDecide) throw forbidden(preview.waiting??'decision_refused')
  if(input.revision!==preview.token) throw conflict('task_revision_changed')
  if(!['approve','changes','reject'].includes(input.action)) throw invalid('decision')
  if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>5000) throw invalid('decision_reason')
  const decisionId=newId('decision'),at=now()
  await guarded(db,preview.rev,[
    bound(db,'INSERT INTO peg_task_decisions VALUES(?,?,?,?,?,?,?)',[decisionId,preview.taskId,actor.id,at,preview.token,input.action,input.reason.trim()]),
    bound(db,'INSERT INTO peg_decision_guards VALUES(?)',[preview.taskId]),
    bound(db,'UPDATE peg_tasks SET status=?,completed_at=?,updated_at=? WHERE id=?',[input.action==='approve'?'done':'todo',input.action==='approve'?at:null,at,preview.taskId]),
    bound(db,'DELETE FROM peg_decision_guards WHERE task_id=?',[preview.taskId]),
    historyStatement(db,preview.taskId,null,actor.id,`decision.${input.action}`,{decisionId,revision:preview.token,reason:input.reason.trim()}),
  ])
  return {id:decisionId,taskId:preview.taskId,action:input.action}
}
