// One history per task. An entry names the project it belongs to (or none, for the task's own shared record), so
// a person reading it sees only the entries of projects they may read.
import { all, bound, now } from '../db'

export const historyStatement = (db: D1Database, taskId: string, projectId: string | null, actorId: string, kind: string, detail: Record<string, unknown> = {}) =>
  bound(db, 'INSERT INTO peg_history(task_id,project_id,at,actor_id,kind,detail) VALUES (?,?,?,?,?,?)', [taskId, projectId, now(), actorId, kind, JSON.stringify(detail)])

export interface HistoryEntry { id: number; at: number; actor_id: string; kind: string; project_id: string | null; detail: Record<string, unknown> }
export async function historyOf(db: D1Database, taskId: string, readable: Set<string>): Promise<HistoryEntry[]> {
  const rows = await all<Omit<HistoryEntry, 'detail'> & { detail: string }>(db, 'SELECT id,at,actor_id,kind,project_id,detail FROM peg_history WHERE task_id=? ORDER BY id', taskId)
  return rows.filter(row => row.project_id === null || readable.has(row.project_id)).map(row => ({ ...row, detail: JSON.parse(row.detail) }))
}
