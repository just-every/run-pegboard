// One history per task. An entry names the project it belongs to (or none, for the task's own shared record), so
// a person reading it sees only the entries of projects they may read.
import { all, bound, now, type Param } from '../db'

export const historyStatement = (db: D1Database, taskId: string, projectId: string | null, actorId: string, kind: string, detail: Record<string, unknown> = {}) =>
  bound(db, 'INSERT INTO peg_history(task_id,project_id,at,actor_id,kind,detail) VALUES (?,?,?,?,?,?)', [taskId, projectId, now(), actorId, kind, JSON.stringify(detail)])

export interface HistoryEntry { id: number; at: number; actor_id: string; kind: string; project_id: string | null; detail: Record<string, unknown> }
export async function historyOf(db: D1Database, taskId: string, readable: Set<string>): Promise<HistoryEntry[]> {
  const rows = await all<Omit<HistoryEntry, 'detail'> & { detail: string }>(db, 'SELECT id,at,actor_id,kind,project_id,detail FROM peg_history WHERE task_id=? ORDER BY id', taskId)
  return rows.filter(row => row.project_id === null || readable.has(row.project_id)).map(row => ({ ...row, detail: JSON.parse(row.detail) }))
}

/** A one-shot actor guard consumed by the database only if this write actually reopens sign-off. */
export const reopenGuard=(db:D1Database,taskId:string,actorId:string,cause:string,condition='1',args:Param[]=[])=>
  bound(db,`INSERT INTO peg_approval_reopen_guards(task_id,actor_id,cause,at) SELECT t.id,?,?,? FROM peg_tasks t WHERE t.id=? AND t.status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks a WHERE a.task_id=t.id) AND (${condition}) ON CONFLICT(task_id) DO UPDATE SET actor_id=excluded.actor_id,cause=excluded.cause,at=excluded.at`,[actorId,cause,now(),taskId,...args])
export const reopenFieldGuards=(db:D1Database,fieldId:string,actorId:string)=>
  bound(db,`INSERT INTO peg_approval_reopen_guards(task_id,actor_id,cause,at) SELECT t.id,?,'field_definition',? FROM peg_tasks t WHERE t.status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks a WHERE a.task_id=t.id) AND (t.id IN(SELECT task_id FROM peg_field_values WHERE field_id=?) OR t.id IN(SELECT tp.task_id FROM peg_task_projects tp JOIN peg_project_fields f ON f.project_id=tp.project_id WHERE f.field_id=?)) ON CONFLICT(task_id) DO UPDATE SET actor_id=excluded.actor_id,cause=excluded.cause,at=excluded.at`,[actorId,now(),fieldId,fieldId])
