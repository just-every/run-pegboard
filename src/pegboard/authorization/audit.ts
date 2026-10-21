// The access audit: one immutable row per authority change, written in the same transaction as the change.
import { all, bound, now, type Param } from '../db'

export interface AuditInput { workspaceId: string | null; actorId: string | null; action: string; targetType?: string; targetId?: string; subjectId?: string; detail?: Record<string, unknown> }
export const auditStatement = (db: D1Database, input: AuditInput) => bound(db,
  'INSERT INTO peg_audit(workspace_id,at,actor_id,action,target_type,target_id,subject_id,detail) VALUES (?,?,?,?,?,?,?,?)',
  [input.workspaceId, now(), input.actorId, input.action, input.targetType ?? null, input.targetId ?? null, input.subjectId ?? null, JSON.stringify(input.detail ?? {})])
/** Every authority change moves the epoch, so a decision made on older authority cannot commit. */
export const bumpEpoch = (db: D1Database) => bound(db, 'UPDATE peg_epoch SET value=value+1 WHERE id=1', [])
export const epoch = async (db: D1Database) => (await db.prepare('SELECT value FROM peg_epoch WHERE id=1').first<{ value: number }>())!.value

export interface AuditRow { id: number; at: number; actor_id: string | null; action: string; target_type: string | null; target_id: string | null; subject_id: string | null; detail: Record<string, unknown> }
export async function auditRows(db: D1Database, workspaceId: string, filter: { action?: string; subjectId?: string; limit?: number } = {}): Promise<AuditRow[]> {
  const args: Param[] = [workspaceId]
  let sql = 'SELECT * FROM peg_audit WHERE workspace_id=?'
  if (filter.action) { sql += ' AND action LIKE ?'; args.push(`${filter.action}%`) }
  if (filter.subjectId) { sql += ' AND subject_id=?'; args.push(filter.subjectId) }
  sql += ' ORDER BY id DESC LIMIT ?'; args.push(Math.min(filter.limit ?? 200, 500))
  return (await all<Omit<AuditRow, 'detail'> & { detail: string }>(db, sql, ...args)).map(row => ({ ...row, detail: JSON.parse(row.detail) }))
}
