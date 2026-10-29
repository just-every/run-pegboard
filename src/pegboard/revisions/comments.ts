import { all, bound, conflict, first, forbidden, invalid, notFound, now } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { openTask, require } from '../tasks/access'
import { historyStatement, reopenGuard } from '../tasks/history'
import type { Actor } from '../workspace/people'

interface CommentRow {id:string;task_id:string;project_id:string|null;author_id:string;body:string;version:number;internal_only:number;deleted_at:number|null}
export async function openComment(db:D1Database,actor:Actor,taskId:string,id:string,write=false) {
 const opened=await openTask(db,actor,taskId)
 const comment=await first<CommentRow>(db,'SELECT * FROM peg_comments WHERE id=? AND task_id=?',id,opened.task.id)
 if(!comment||(comment.internal_only&&opened.access.role==='guest')||(comment.project_id&&!opened.access.contexts.has(comment.project_id)))throw notFound()
 if(write){
  require(opened.access,'comment')
  if(comment.project_id&&!opened.access.contexts.get(comment.project_id)?.capabilities.has('comment'))throw forbidden('comment')
 }
 return {...opened,comment}
}
export async function reviseComment(db:D1Database,actor:Actor,taskId:string,id:string,input:{body?:unknown;version?:unknown;remove?:boolean}) {
 const rev=await revision(db),{comment}=await openComment(db,actor,taskId,id,true)
 if(comment.author_id!==actor.id)throw forbidden('comment_author')
 if(comment.deleted_at!==null||Number(input.version)!==comment.version)throw conflict('comment_revision_changed')
 if(!input.remove&&(typeof input.body!=='string'||!input.body.trim()||input.body.length>10000))throw invalid('body')
 const at=now(),body=input.remove?'':String(input.body).trim(),version=comment.version+1
 await guarded(db,rev,[reopenGuard(db,taskId,actor.id,'comment'),bound(db,'UPDATE peg_comments SET body=?,version=?,deleted_at=? WHERE id=?',[body,version,input.remove?at:null,id]),bound(db,'INSERT INTO peg_comment_versions VALUES(?,?,?,?,?,?)',[id,version,body,actor.id,at,input.remove?1:0]),historyStatement(db,taskId,comment.project_id,actor.id,(comment.internal_only?'internal.':'')+(input.remove?'comment.deleted':'comment.edited'),{commentId:id,version})])
 return {id,version}
}
export async function reactToComment(db:D1Database,actor:Actor,taskId:string,id:string,input:{reaction?:unknown;active?:unknown;key?:unknown}) {
 const rev=await revision(db),{comment}=await openComment(db,actor,taskId,id,true)
 if(comment.deleted_at!==null)throw conflict('comment_deleted')
 if(!['like','celebrate','thanks'].includes(String(input.reaction))||typeof input.active!=='boolean'||typeof input.key!=='string'||!input.key||input.key.length>160)throw invalid('reaction')
 const fingerprint=await digest([id,input.reaction,input.active]),saved=await first<{fingerprint:string;result:string}>(db,'SELECT * FROM peg_collaboration_intents WHERE actor_id=? AND operation_key=?',actor.id,input.key)
 if(saved){if(saved.fingerprint!==fingerprint)throw conflict('intent_changed');return JSON.parse(saved.result)}
 const result={id,reaction:input.reaction,active:input.active}
 await guarded(db,rev,[bound(db,'INSERT INTO peg_comment_reactions VALUES(?,?,?,?,?) ON CONFLICT(comment_id,actor_id,reaction) DO UPDATE SET active=excluded.active,at=excluded.at',[id,actor.id,String(input.reaction),input.active?1:0,now()]),bound(db,'INSERT INTO peg_collaboration_intents VALUES(?,?,?,?,?,?)',[actor.id,input.key,taskId,id,fingerprint,JSON.stringify(result)]),historyStatement(db,taskId,comment.project_id,actor.id,(comment.internal_only?'internal.':'')+'comment.reacted',{commentId:id,reaction:input.reaction,active:input.active})])
 return result
}
export const commentVersions=(db:D1Database,id:string)=>all<{version:number;body:string;actor_id:string;created_at:number;deleted:number}>(db,'SELECT * FROM peg_comment_versions WHERE comment_id=? ORDER BY version',id)
