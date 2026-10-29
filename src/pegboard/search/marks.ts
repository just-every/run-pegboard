import {all,bound,first,invalid,now,PegError} from '../db'
import {openTask} from '../tasks/access'
import {viewTask} from '../tasks/view'
import {workspaceRole,type Actor} from '../workspace/people'
import {canonicalTask} from '../merge/canonical'

export async function markWork(db:D1Database,actor:Actor,workspace:string,id:string,kind:'favorite'|'visit',value:unknown=true){
 const {task}=await openTask(db,actor,id)
 if(task.workspace_id!==workspace)throw invalid('work_scope')
 const favorite=value===true||value==='1'||value==='on'
 if(kind==='favorite'&&!favorite)for(const row of await all<{task_id:string}>(db,'SELECT task_id FROM peg_work_marks WHERE person_id=? AND workspace_id=?',actor.id,workspace))if(await canonicalTask(db,row.task_id)===task.id)await db.batch([bound(db,'UPDATE peg_work_marks SET favorite=0 WHERE person_id=? AND task_id=?',[actor.id,row.task_id])])
 await db.batch([bound(db,kind==='favorite'?'INSERT INTO peg_work_marks VALUES(?,?,?,?,NULL) ON CONFLICT(person_id,task_id) DO UPDATE SET favorite=excluded.favorite':'INSERT INTO peg_work_marks VALUES(?,?,?,0,?) ON CONFLICT(person_id,task_id) DO UPDATE SET visited_at=excluded.visited_at',[workspace,actor.id,task.id,kind==='favorite'?Number(favorite):now()])])
 return {id:task.id}
}
export async function workMarks(db:D1Database,actor:Actor,workspace:string){
 if(!await workspaceRole(db,actor.id,workspace))return {favorites:[],recent:[]}
 const items=new Map<string,{id:string;title:string;href:string;favorite:boolean;visitedAt:number}>()
 for(const row of await all<{task_id:string;favorite:number;visited_at:number|null}>(db,'SELECT * FROM peg_work_marks WHERE workspace_id=? AND person_id=? ORDER BY visited_at DESC,task_id',workspace,actor.id))try{
  const task=await viewTask(db,actor,row.task_id),item={id:task.id,title:task.title,href:`/app/tasks/${task.id}`}
  const prior=items.get(task.id)
  items.set(task.id,{...item,favorite:!!row.favorite||!!prior?.favorite,visitedAt:Math.max(row.visited_at??0,prior?.visitedAt??0)})
 }catch(error){if(!(error instanceof PegError&&[403,404].includes(error.status)))throw error}
 const visible=[...items.values()],item=({id,title,href}:{id:string;title:string;href:string})=>({id,title,href})
 return {favorites:visible.filter(r=>r.favorite).sort((a,b)=>a.title.localeCompare(b.title)).map(item),recent:visible.filter(r=>r.visitedAt).sort((a,b)=>b.visitedAt-a.visitedAt||a.id.localeCompare(b.id)).slice(0,20).map(item)}
}
