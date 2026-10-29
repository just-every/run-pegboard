import { requireAdministrator } from '../admin/settings'
import { all, batch, bound, first, forbidden, invalid, newId, now, PegError } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import { openProject } from '../workspace/projects'
import { operatorRow, workspaceRole, workspaceSettings, type Actor } from '../workspace/people'

export interface ApiKey {
 id: string; owner_id: string; owner_version: number; token_hash: string; name: string
 projects: string; personal: number; writable: number; expires_at: number; revoked_at: number | null
}
export async function issueKey(db: D1Database, actor: Actor, input: Record<string, any>) {
 const rev = await revision(db), person = await operatorRow(db, actor.id)
 if (!person || person.status !== 'active' || !await workspaceRole(db, actor.id, 'ws_main')) throw forbidden()
 if ((await workspaceRole(db, actor.id, 'ws_main')) === 'agent') throw forbidden('human_authorization_required')
 if (input.consent !== true) throw invalid('explicit_consent_required')
 const projects: string[] = Array.isArray(input.projects) ? [...new Set(input.projects)] : []
 const expiresAt = Number(input.expiresAt), name = String(input.name ?? '').trim()
 if (!name || name.length > 120 || projects.length > 50 || projects.some(id => typeof id !== 'string') ||
  (!projects.length && input.personal !== true) || !Number.isSafeInteger(expiresAt) || expiresAt <= now() || expiresAt > now() + 30 * 86400000) throw invalid('scope_and_expiry')
 for (const id of projects) {
  const { project } = await openProject(db, actor, id)
  if (project.workspace_id !== 'ws_main') throw invalid('workspace')
 }
 if (!(await workspaceSettings(db, 'ws_main')).integrationsEnabled) throw forbidden('integrations_disabled')
 const id = newId('apikey'), secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('')
 await guarded(db, rev, [bound(db, 'INSERT INTO peg_api_keys VALUES(?,?,?,?,?,?,?,?,?,NULL,?)',
  [id, actor.id, person.version, await digest(secret), name, JSON.stringify(projects.sort()), input.personal === true ? 1 : 0, input.writable === true ? 1 : 0, expiresAt, now()]),
  permanentEvent(db, { workspace: null, actor: actor.id, action: 'api.key_authorized', type: 'api_key', id, metadata: { consent: true } })])
 return { id, secret, expiresAt, notice: 'Save this credential now. It is never shown again.' }
}
export async function listKeys(db: D1Database, actor: Actor) {
 return all(db, 'SELECT id,name,projects,personal,writable,expires_at,revoked_at FROM peg_api_keys WHERE owner_id=? ORDER BY created_at,id', actor.id)
}
export async function revokeKey(db: D1Database, actor: Actor, id: string) {
 if (!await first(db, 'SELECT 1 FROM peg_api_keys WHERE id=? AND owner_id=?', id, actor.id)) throw forbidden()
 await batch(db, [bound(db, 'UPDATE peg_api_keys SET revoked_at=COALESCE(revoked_at,?) WHERE id=?', [now(), id]),
  permanentEvent(db, { workspace: null, actor: actor.id, action: 'api.key_revoked', type: 'api_key', id })])
 return { revoked: true }
}
export async function authenticate(db: D1Database, request: Request) {
 const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
 const key = token ? await first<ApiKey>(db, 'SELECT * FROM peg_api_keys WHERE token_hash=?', await digest(token)) : null
 const person = key ? await operatorRow(db, key.owner_id) : null
 if (!key || key.revoked_at !== null || key.expires_at <= now() || !person || person.status !== 'active' || person.version !== key.owner_version ||
  !await workspaceRole(db, person.id, 'ws_main') || !(await workspaceSettings(db, 'ws_main')).integrationsEnabled) throw new PegError(401, 'api_key_unavailable')
 const actor: Actor = { id: person.id, email: person.email, displayName: person.display_name, baseRole: person.role as Actor['baseRole'], apiScope: { projects: JSON.parse(key.projects), personal: !!key.personal } }
 // A bearer key delegates scoped work; it never proves a human's presence at a decision door.
 return { key, actor }
}

/** Native access reviews describe credential state, never token material or private scope names. */
export async function credentialReview(db: D1Database, actor: Actor, workspace: string) {
 await requireAdministrator(db, actor, workspace)
 return all<{ id: string; ownerId: string; expiresAt: number; revokedAt: number | null; active: number }>(db, `SELECT k.id,k.owner_id ownerId,k.expires_at expiresAt,k.revoked_at revokedAt,
  CASE WHEN k.revoked_at IS NULL AND k.expires_at>? AND o.status='active' AND k.owner_version=o.version THEN 1 ELSE 0 END active
  FROM peg_api_keys k JOIN oa_operators o ON o.id=k.owner_id
  WHERE o.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM peg_workspace_members m WHERE m.workspace_id=? AND m.operator_id=o.id)
  ORDER BY k.created_at DESC,k.id LIMIT 100`, now(), workspace)
}
