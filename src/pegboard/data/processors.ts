import { all,bound,newId,now,type Param } from '../db'
import type { Actor } from '../workspace/people'
import type { Selection } from './erasure'
export async function processorFollowups(db:D1Database,selections:Selection[]) {
  const result:Array<{id:string;processor:string}>=[]
  for(const selection of selections.filter(s=>s.table==='peg_agent_outputs'))for(const key of selection.keys){
    const rows=await all<{id:string;processor:string}>(db,'SELECT id,processor FROM peg_agent_outputs WHERE id=?',key.id)
    result.push(...rows)
  }
  return result
}
export const followupStatements=(db:D1Database,actor:Actor,workspace:string,rows:Array<{id:string;processor:string}>)=>rows.map(row=>bound(db,"INSERT OR IGNORE INTO peg_processor_deletions VALUES(?,?,?,?,'needs_owner_action',?,?)",[newId('deletion'),workspace,row.processor,row.id,actor.id,now()]))
