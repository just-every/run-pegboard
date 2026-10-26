import {all} from '../db'
/** Only physically absent task endpoints qualify; retained or hidden work is never detached. */
export const missingDependencyRepairs=(db:D1Database,taskId:string)=>all<{id:string}>(db,`SELECT d.id FROM peg_dependencies d LEFT JOIN peg_tasks a ON a.id=d.predecessor_id LEFT JOIN peg_tasks b ON b.id=d.successor_id WHERE (d.predecessor_id=? OR d.successor_id=?) AND (a.id IS NULL OR b.id IS NULL) ORDER BY d.id`,taskId,taskId)
