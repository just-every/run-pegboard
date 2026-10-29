import {bound,conflict,first,now,notFound} from '../db'
import {revision,guarded,digest} from '../decisions/revision'
import {mergeTask} from './authority'
import {openTask} from '../tasks/access'
import {historyStatement} from '../tasks/history'
import type {Actor} from '../workspace/people'
export async function duplicatePreview(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>){
 const rev=await revision(db),source=(await mergeTask(db,actor,workspace,String(input.sourceId??''))).task,target=(await mergeTask(db,actor,workspace,String(input.survivorId??''))).task
 if(source.id===target.id)throw conflict('duplicate_distinct_tasks')
 const plan={source:{id:source.id,title:source.title},target:{id:target.id,title:target.title},remove:input.remove===true||input.remove==='1'}
 return {...plan,rev,token:await digest(['duplicate',actor.id,rev,plan])}
}
export async function markDuplicate(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>){
 const preview=await duplicatePreview(db,actor,workspace,input)
 if(input.token!==preview.token)throw conflict('duplicate_review_changed')
 await guarded(db,preview.rev,[bound(db,'DELETE FROM peg_task_duplicates WHERE source_id=?',[preview.source.id]),...preview.remove?[]:[bound(db,'INSERT INTO peg_task_duplicates VALUES(?,?,?,?)',[preview.source.id,preview.target.id,actor.id,now()])],historyStatement(db,preview.source.id,null,actor.id,'task.duplicate_marked',{})])
 return {id:preview.source.id}
}
export async function duplicateOf(db:D1Database,actor:Actor,id:string){
 const row=await first<{target_id:string}>(db,'SELECT target_id FROM peg_task_duplicates WHERE source_id=?',id)
 if(!row)return null
 try{const {task}=await openTask(db,actor,row.target_id);return {id:task.id,title:task.title}}catch(error){if(error&&typeof error==='object'&&'status' in error&&[403,404].includes(Number(error.status)))return null;throw error}
}
