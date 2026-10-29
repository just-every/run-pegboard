import {all,bound,first,invalid,now,PegError} from '../db'
import {openTask} from '../tasks/access'
import {viewTask} from '../tasks/view'
import {workspaceRole,type Actor} from '../workspace/people'

export async function markWork(db:D1Database,actor:Actor,workspace:string,id:string,kind:'favorite'|'visit',value:unknown=true){
 const {task}=await openTask(db,actor,id)
 if(task.workspace_id!==workspace)throw invalid('work_scope')
 const favorite=value===true||value==='1'||value==='on'
 await db.batch([bound(db,kind==='favorite'?'INSERT INTO peg_work_marks VALUES(?,?,?,?,NULL) ON CONFLICT(person_id,task_id) DO UPDATE SET favorite=excluded.favorite':'INSERT INTO peg_work_marks VALUES(?,?,?,0,?) ON CONFLICT(person_id,task_id) DO UPDATE SET visited_at=excluded.visited_at',[workspace,actor.id,task.id,kind==='favorite'?Number(favorite):now()])])
 return {id:task.id}
}
export async function workMarks(db:D1Database,actor:Actor,workspace:string){
 if(!await workspaceRole(db,actor.id,workspace))return {favorites:[],recent:[]}
 const favorites:{id:string;title:string;href:string}[]=[],recent:{id:string;title:string;href:string}[]=[],seen=new Set<string>()
 for(const row of await all<{task_id:string;favorite:number;visited_at:number|null}>(db,'SELECT * FROM peg_work_marks WHERE workspace_id=? AND person_id=? ORDER BY visited_at DESC,task_id',workspace,actor.id))try{
  const task=await viewTask(db,actor,row.task_id),item={id:task.id,title:task.title,href:`/app/tasks/${task.id}`}
  if(seen.has(task.id))continue
  seen.add(task.id);if(row.favorite)favorites.push(item);if(row.visited_at&&recent.length<20)recent.push(item)
 }catch(error){if(!(error instanceof PegError&&[403,404].includes(error.status)))throw error}
 return {favorites,recent}
}
