import { all, batch, bound, forbidden, invalid, now, PegError } from '../db'
import { auditStatement, bumpEpoch } from '../authorization/audit'
import { operatorRow, workspaceRole, type Actor } from '../workspace/people'
import { statusAccess } from './drafts'

export const statusChannels = ['in_app', 'slack', 'teams', 'nook', 'email']
const internalRoles = ['owner', 'admin', 'manager', 'member']

/** A subscription is self-service intent; only the human's exact draft review approves delivery. */
export async function statusSubscription(db: D1Database, actor: Actor, type: string, id: string, input?: Record<string, any>) {
  const { workspace } = await statusAccess(db, actor, type, id)
  if (!internalRoles.includes(await workspaceRole(db, actor.id, workspace) ?? '')) throw forbidden('internal_status_subscription')
  if (input) {
    if (typeof input.enabled !== 'boolean' || !Array.isArray(input.channels) || !input.channels.length || input.channels.some((channel: unknown) => !statusChannels.includes(String(channel)))) throw invalid('status_subscription')
    const channels = [...new Set<string>(input.channels)].sort()
    await batch(db, [bound(db,
      `INSERT INTO peg_status_subscriptions(subject_type,subject_id,operator_id,channels,enabled,updated_at) VALUES (?,?,?,?,?,?)
       ON CONFLICT(subject_type,subject_id,operator_id) DO UPDATE SET channels=excluded.channels,enabled=excluded.enabled,updated_at=excluded.updated_at`,
      [type, id, actor.id, JSON.stringify(channels), input.enabled ? 1 : 0, now()]),
      auditStatement(db, { workspaceId: workspace, actorId: actor.id, action: 'status.subscription_changed', targetType: type, targetId: id }), bumpEpoch(db)])
  }
  const row = await db.prepare('SELECT channels,enabled FROM peg_status_subscriptions WHERE subject_type=? AND subject_id=? AND operator_id=?').bind(type, id, actor.id).first<{channels:string;enabled:number}>()
  return { enabled: row?.enabled === 1, channels: row ? JSON.parse(row.channels) as string[] : ['in_app'] }
}

export async function statusSubscribers(db: D1Database, actor: Actor, type: string, id: string) {
  const { workspace } = await statusAccess(db, actor, type, id, true)
  const rows = await all<{ operator_id: string; channels: string }>(db, 'SELECT operator_id,channels FROM peg_status_subscriptions WHERE subject_type=? AND subject_id=? AND enabled=1 ORDER BY operator_id', type, id)
  const recipients = []
  for (const row of rows) {
    const person = await operatorRow(db, row.operator_id)
    if (!person || person.status !== 'active' || !internalRoles.includes(await workspaceRole(db, person.id, workspace) ?? '')) continue
    const target: Actor = { id: person.id, email: person.email, displayName: person.display_name, baseRole: person.role === 'owner' || person.role === 'admin' ? person.role : 'member' }
    try {
      await statusAccess(db, target, type, id)
      recipients.push({ id: person.id, channels: JSON.parse(row.channels) as string[] })
    } catch (error) { if (!(error instanceof PegError && [403,404].includes(error.status))) throw error }
  }
  return recipients
}
