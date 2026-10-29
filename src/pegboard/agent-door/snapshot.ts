import {type ToolContext} from '../../modules/agent-door/index.ts'
import {digest} from '../decisions/revision.ts'
import {all,PegError} from '../db.ts'
import {openTask} from '../tasks/access.ts'
import {access} from './access.ts'

/** Content-free synchronization token, scoped through the native task reader. */
export async function snapshot(ctx: ToolContext) {
 const {key,actor}=await access(ctx), tasks=[]
 for(const row of await all<{id:string}>(ctx.db,'SELECT id FROM peg_tasks ORDER BY id')) {
  try {
   const {task,access:grant}=await openTask(ctx.db,actor,row.id)
   const {internal_notes,internal_only,...visible}=task
   const comments=(await all<{id:string;project_id:string|null;internal_only:number}>(ctx.db,'SELECT id,project_id,internal_only FROM peg_comments WHERE task_id=? ORDER BY id',task.id))
    .filter(comment=>(grant.role!=='guest'||!comment.internal_only)&&(comment.project_id===null||grant.contexts.has(comment.project_id))).map(comment=>comment.id)
   tasks.push([visible,...(grant.role==='guest'?[]:[internal_notes,internal_only]),comments])
  }catch(error){if(!(error instanceof PegError)||error.status!==404)throw error}
 }
 const sections=!key||key.personal?await all(ctx.db,'SELECT id,name,position FROM peg_personal_sections WHERE operator_id=? ORDER BY id',actor.id):[]
 const layout=!key||key.personal?await all(ctx.db,'SELECT task_id,section_id,position,today FROM peg_personal_layout WHERE operator_id=? ORDER BY task_id',actor.id):[]
 return {revision:await digest([tasks,sections,layout])}
}
