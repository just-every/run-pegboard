import { first, forbidden, invalid, run } from '../db'
import { openTask } from '../tasks/access'
import { workspaceRole, type Actor } from '../workspace/people'

export interface ReadinessPreferences {
  enabled: boolean; muted: boolean; inboxEnabled: boolean; dndUntil: number | null; digestUntil: number | null
}
interface PreferenceRow { enabled: number; muted: number; inbox_enabled: number; dnd_until: number | null; digest_until: number | null }

export async function requireNoticeMember(db: D1Database, actor: Actor, workspace: string) {
  if (!await workspaceRole(db, actor.id, workspace)) throw forbidden()
}
export async function readinessPreferences(db: D1Database, actor: Actor, workspace: string): Promise<ReadinessPreferences> {
  await requireNoticeMember(db, actor, workspace)
  const row = await first<PreferenceRow>(db, 'SELECT * FROM peg_readiness_preferences WHERE workspace_id=? AND operator_id=?', workspace, actor.id)
  return { enabled: row ? !!row.enabled : true, muted: !!row?.muted, inboxEnabled: row ? !!row.inbox_enabled : true, dndUntil: row?.dnd_until ?? null, digestUntil: row?.digest_until ?? null }
}
const boolean = (value: unknown) => {
  if ([true, 1, '1', 'true', 'on'].includes(value as never)) return true
  if ([false, 0, '0', 'false', 'off', ''].includes(value as never)) return false
  throw invalid('notice_preference')
}
const timestamp = (value: unknown) => {
  if (value === null || value === '') return null
  const text = String(value)
  const at = typeof value === 'number' ? value : /^\d+$/.test(text) ? Number(text) : Date.parse(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(text) ? text + ':00Z' : text)
  if (!Number.isSafeInteger(at) || at < 0) throw invalid('notice_time')
  return at
}
export async function saveReadinessPreferences(db: D1Database, actor: Actor, workspace: string, input: Record<string, unknown>) {
  const current = await readinessPreferences(db, actor, workspace)
  const next: ReadinessPreferences = {
    enabled: input.enabled === undefined ? current.enabled : boolean(input.enabled),
    muted: input.muted === undefined ? current.muted : boolean(input.muted),
    inboxEnabled: input.inboxEnabled === undefined ? current.inboxEnabled : boolean(input.inboxEnabled),
    dndUntil: input.dndUntil === undefined ? current.dndUntil : timestamp(input.dndUntil),
    digestUntil: input.digestUntil === undefined ? current.digestUntil : timestamp(input.digestUntil),
  }
  await run(db, `INSERT INTO peg_readiness_preferences(workspace_id,operator_id,enabled,muted,inbox_enabled,dnd_until,digest_until)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(workspace_id,operator_id) DO UPDATE SET enabled=excluded.enabled,muted=excluded.muted,
    inbox_enabled=excluded.inbox_enabled,dnd_until=excluded.dnd_until,digest_until=excluded.digest_until`,
  workspace, actor.id, Number(next.enabled), Number(next.muted), Number(next.inboxEnabled), next.dndUntil, next.digestUntil)
  return next
}
export async function muteReadinessTask(db: D1Database, actor: Actor, taskId: string, input: Record<string, unknown>) {
  const { task } = await openTask(db, actor, taskId), muted = boolean(input.muted)
  await run(db, `INSERT INTO peg_readiness_task_preferences(task_id,operator_id,muted) VALUES(?,?,?)
    ON CONFLICT(task_id,operator_id) DO UPDATE SET muted=excluded.muted`, task.id, actor.id, Number(muted))
  return { taskId: task.id, muted }
}
