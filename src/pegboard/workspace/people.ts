// Who is acting: Base's operator, and the part they play in a workspace.
import type { Session } from '../../modules/operator-auth/index.mjs'
import branding from '../../branding.json'
import { all, first, placeholders, run, type Param } from '../db'
import { isAdministrator, type WorkspaceRole } from '../authorization/levels'

export interface Actor { preparedBy?: { agent: {id: string; name: string}; for: {id: string; name: string}; label: string; operationId: string; idempotencyKey: string | null };  apiScope?: { projects: string[]; personal: boolean }; id: string; email: string; displayName: string; baseRole: 'owner' | 'admin' | 'member' }
export const actorOf = (session: Session): Actor => ({ id: session.operator.id, email: session.operator.email, displayName: session.operator.displayName, baseRole: session.operator.role })

export const defaultWorkspaceId = 'ws_main'
export interface WorkspaceSettings {
  /** Who may invite people: owner, admin or manager. */
  invitePolicy: 'owner' | 'admin' | 'manager'
  /** Whether a project may be shared with the whole workspace. */
  workspaceSharing: boolean
  guestsAllowed: boolean
  /** The lowest level that may export. */
  exportMinLevel: 'viewer' | 'commenter' | 'editor' | 'admin'
  integrationsEnabled: boolean
  requestExpiryDays: number
  /** How long decided and expired access requests stay listed; the audit rows stay. */
  requestRetentionDays: number
}
export const defaultSettings: WorkspaceSettings = { invitePolicy: 'admin', workspaceSharing: true, guestsAllowed: true, exportMinLevel: 'viewer', integrationsEnabled: true, requestExpiryDays: 7, requestRetentionDays: 365 }
export const settingBounds = { requestExpiryDays: [1, 30], requestRetentionDays: [30, 3650] } as const

let ensured = false
export async function ensureDefaultWorkspace(db: D1Database) {
  if (ensured) return
  await run(db, 'INSERT OR IGNORE INTO peg_workspaces(id,name,settings,created_at) VALUES (?,?,?,?)', defaultWorkspaceId, branding.name, '{}', Date.now())
  ensured = true
}
export async function workspaceSettings(db: D1Database, workspaceId: string): Promise<WorkspaceSettings> {
  const row = await first<{ settings: string }>(db, 'SELECT settings FROM peg_workspaces WHERE id=?', workspaceId)
  return { ...defaultSettings, ...(row ? JSON.parse(row.settings) : {}) }
}

interface OperatorRow { id: string; status: string; role: string; version: number; email: string; display_name: string }
export const operatorRow = (db: D1Database, id: string) => first<OperatorRow>(db, 'SELECT id,status,role,version,email,display_name FROM oa_operators WHERE id=?', id)

/** The part this person plays in the workspace, or null when they are inactive or not a member at all. */
export async function workspaceRole(db: D1Database, operatorId: string, workspaceId: string): Promise<WorkspaceRole | null> {
  const operator = await operatorRow(db, operatorId)
  if (!operator || operator.status !== 'active') return null
  if (operator.role === 'owner' || operator.role === 'admin') return operator.role
  const member = await first<{ role: WorkspaceRole }>(db, 'SELECT role FROM peg_workspace_members WHERE workspace_id=? AND operator_id=?', workspaceId, operatorId)
  return member?.role ?? null
}
export const workspacesOf = async (db: D1Database, actor: Actor): Promise<string[]> => {
  if (actor.baseRole !== 'member') return (await all<{ id: string }>(db, 'SELECT id FROM peg_workspaces ORDER BY created_at')).map(row => row.id)
  return (await all<{ workspace_id: string }>(db, 'SELECT workspace_id FROM peg_workspace_members WHERE operator_id=?', actor.id)).map(row => row.workspace_id)
}
export const administers = async (db: D1Database, actor: Actor, workspaceId: string) => isAdministrator(await workspaceRole(db, actor.id, workspaceId))

export async function displayNames(db: D1Database, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map([['','Unassigned']])
  const rows = await all<{ id: string; display_name: string }>(db, `SELECT id,display_name FROM oa_operators WHERE id IN (${placeholders(unique)})`, ...(unique as Param[]))
  return new Map([['','Unassigned'], ...rows.map(row => [row.id, row.display_name] as [string,string])])
}
