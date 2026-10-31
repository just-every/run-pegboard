import { all, conflict, first } from '../db'
import type { Slot } from '../connectors/calendars/edge'
export interface FocusLock { block_id:string;owner_id:string;locked:number;start_at:string;end_at:string;revision:number;reviewed_at:number }
export const overlaps = (a:Slot,b:Slot) => Date.parse(a.start)<Date.parse(b.end)&&Date.parse(b.start)<Date.parse(a.end)
export async function blockFence(db:D1Database,id:string|null,connection:string,slot?:Slot,reviewId?:string) {
 if(id&&await first(db,'SELECT 1 FROM peg_focus_locks WHERE block_id=? AND locked=1',id))throw conflict('focus_locked')
 if(id&&await first(db,"SELECT 1 FROM peg_focus_operations o JOIN peg_focus_reviews r ON r.id=o.review_id WHERE o.block_id=? AND r.state IN ('applying','uncertain') AND r.id<>?",id,reviewId??''))throw conflict('focus_reconciliation_required')
 if(slot){
  const locks=await all<FocusLock>(db,'SELECT l.* FROM peg_focus_locks l JOIN peg_calendar_blocks b ON b.id=l.block_id JOIN peg_calendar_connections c ON c.id=b.connection_id WHERE l.locked=1 AND c.owner_id=(SELECT owner_id FROM peg_calendar_connections WHERE id=?)',connection)
  if(locks.some(l=>overlaps(slot,{start:l.start_at,end:l.end_at})))throw conflict('focus_locked_period')
 }
}
export async function scheduleLockFence(db:D1Database,ids:string[]) {
 for(const id of ids)if(await first(db,'SELECT 1 FROM peg_calendar_blocks b JOIN peg_focus_locks l ON l.block_id=b.id WHERE b.task_id=? AND l.locked=1',id))throw conflict('focus_locked')
}
