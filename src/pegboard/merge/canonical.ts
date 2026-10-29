import {first} from '../db'
/** Follow retained source IDs, refusing erased sources and targets even after replay. */
export async function canonicalTask(db:D1Database,id:string):Promise<string|null>{
 const seen=new Set<string>()
 while(!seen.has(id)&&seen.size<50){
  seen.add(id)
  if(await first(db,"SELECT 1 FROM peg_data_erased_objects WHERE object_type='task' AND object_id=?",id))return null
  const next=await first<{survivor_id:string}>(db,'SELECT survivor_id FROM peg_task_merges WHERE source_id=? AND undone_at IS NULL',id)
  if(!next)return id
  id=next.survivor_id
 }
 return null
}
