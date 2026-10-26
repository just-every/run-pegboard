import {all,conflict} from '../db'
import {openTask,require as need} from '../tasks/access'
import type {TaskRow} from '../model'
import type {Actor} from '../workspace/people'

export async function conversionGraph(db:D1Database,actor:Actor,workspace:string,roots:string[]){
 const tasks:TaskRow[]=[],seen=new Set<string>()
 async function visit(id:string,depth:number){
  if(depth>48||seen.has(id))throw conflict('conversion_cycle_or_depth')
  seen.add(id)
  const {task,access}=await openTask(db,actor,id)
  if(task.workspace_id!==workspace)throw conflict('conversion_scope')
  need(access,'edit');tasks.push(task)
  for(const child of await all<{id:string}>(db,'SELECT id FROM peg_tasks WHERE parent_id=? ORDER BY id',id))await visit(child.id,depth+1)
 }
 for(const id of roots)await visit(id,0)
 return tasks
}
export function conversionIds(value:unknown):string[]{
 if(value===undefined)return []
 if(!Array.isArray(value)||value.some(id=>typeof id!=='string'||!id)||new Set(value).size!==value.length)throw conflict('conversion_selection')
 return [...value].sort()
}
