import { all, batch, bound, first, forbidden, invalid, newId, now, PegError } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { listProjects, openProject } from '../workspace/projects'
import { administers, operatorRow, workspaceSettings, type Actor } from '../workspace/people'
import { permanentEvent } from '../audit/search'
import { datasets, schema, type Fields } from './schema'

export interface AnalystKey {
  id: string; workspace_id: string; owner_id: string; owner_version: number; name: string; token_hash: string
  projects: string; fields: string; created_at: number; expires_at: number; revoked_at: number | null
}
export const keyActor = (key: AnalystKey): Actor => ({ id: key.owner_id, email: '', displayName: '', baseRole: 'member' })
export async function standing(db: D1Database, key: AnalystKey) {
  const person = await operatorRow(db, key.owner_id)
  if (key.revoked_at !== null || key.expires_at <= now() || !person || person.version !== key.owner_version ||
      !await administers(db, keyActor(key), key.workspace_id) || !(await workspaceSettings(db, key.workspace_id)).integrationsEnabled)
    throw new PegError(401, 'analyst_key_unavailable')
  for (const id of JSON.parse(key.projects) as string[]) {
    const opened = await openProject(db, keyActor(key), id).catch(() => null)
    if (!opened || opened.project.workspace_id !== key.workspace_id || !opened.effective.capabilities.has('export'))
      throw new PegError(401, 'analyst_key_unavailable')
  }
}
export async function createKey(db: D1Database, actor: Actor, workspace: string, input: Record<string, any>) {
  const rev = await revision(db)
  if (!await administers(db, actor, workspace)) throw forbidden('administrator_required')
  if (input.consent !== true) throw invalid('analyst_consent_required')
  if (!Array.isArray(input.projects)) throw invalid('analyst_scope_and_expiry')
  const projects = [...new Set(input.projects)] as unknown[]
  const name = String(input.name ?? '').trim(), expiresAt = Number(input.expiresAt)
  if (!Array.isArray(input.projects) || !projects.length || projects.length > 50 || projects.some(id => typeof id !== 'string') ||
      !name || name.length > 120 || !Number.isSafeInteger(expiresAt) || expiresAt <= now() || expiresAt > now() + 30 * 86400000)
    throw invalid('analyst_scope_and_expiry')
  if (!input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields) || !Object.keys(input.fields).length) throw invalid('analyst_fields')
  const fields: Fields = {}
  for (const [name, selected] of Object.entries(input.fields)) {
    const dataset = datasets.find(d => d === name)
    if (!dataset || !Array.isArray(selected) || !selected.length || selected.some(field => typeof field !== 'string' || !Object.hasOwn(schema[dataset], field)))
      throw invalid('analyst_fields')
    fields[dataset] = [...new Set(['id', ...selected])].sort()
  }
  const person = (await operatorRow(db, actor.id))!
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('')
  const key: AnalystKey = { id: newId('analyst'), workspace_id: workspace, owner_id: actor.id, owner_version: person.version,
    name, token_hash: await digest(secret), projects: JSON.stringify(projects.sort()), fields: JSON.stringify(fields), created_at: now(), expires_at: expiresAt, revoked_at: null }
  await standing(db, key)
  await guarded(db, rev, [bound(db, 'INSERT INTO peg_analytics_keys VALUES(?,?,?,?,?,?,?,?,?,?,NULL)',
    [key.id, workspace, actor.id, person.version, name, key.token_hash, key.projects, key.fields, key.created_at, expiresAt]),
    permanentEvent(db, { workspace, actor: actor.id, action: 'analytics.key_authorized', type: 'analyst_key', id: key.id, metadata: { consent: true, expiresAt } })])
  return { id: key.id, secret, expiresAt, servicePath: `/api/v1/analytics/odata/${key.id}`, notice: 'Save this credential now. It is never shown again.' }
}
export type ListedKey = Pick<AnalystKey, 'id' | 'name' | 'projects' | 'fields' | 'created_at' | 'expires_at' | 'revoked_at'>
export async function listKeys(db: D1Database, actor: Actor, workspace: string) {
  if (!await administers(db, actor, workspace)) throw forbidden('administrator_required')
  return all<ListedKey>(db, 'SELECT id,name,projects,fields,created_at,expires_at,revoked_at FROM peg_analytics_keys WHERE owner_id=? AND workspace_id=? ORDER BY created_at,id', actor.id, workspace)
}
export async function revokeKey(db: D1Database, actor: Actor, workspace: string, id: string) {
  if (!await administers(db, actor, workspace)) throw forbidden('administrator_required')
  const key = await first<AnalystKey>(db, 'SELECT * FROM peg_analytics_keys WHERE id=? AND owner_id=? AND workspace_id=?', id, actor.id, workspace)
  if (!key) throw forbidden('analyst_key')
  await batch(db, [bound(db, 'UPDATE peg_analytics_keys SET revoked_at=COALESCE(revoked_at,?) WHERE id=?', [now(), id]),
    permanentEvent(db, { workspace, actor: actor.id, action: 'analytics.key_revoked', type: 'analyst_key', id })])
  return { id, revoked: true }
}
export async function authenticate(db: D1Database, id: string, request: Request) {
  const header = request.headers.get('authorization') ?? ''
  let secret = header.match(/^Bearer (\S+)$/)?.[1] ?? ''
  if (header.startsWith('Basic ')) {
    try { const credentials = atob(header.slice(6)), colon = credentials.indexOf(':'); if (credentials.slice(0, colon) === id) secret = credentials.slice(colon + 1) } catch {}
  }
  const key = await first<AnalystKey>(db, 'SELECT * FROM peg_analytics_keys WHERE id=?', id)
  if (!key || !secret || key.token_hash !== await digest(secret)) throw new PegError(401, 'analyst_key_unavailable')
  await standing(db, key)
  return key
}

/** Settings uses the same current export authority as issuance, and never loads a credential hash. */
export async function analystSettings(db: D1Database, actor: Actor, workspace: string) {
  const keys = await listKeys(db, actor, workspace)
  const projects: { id: string; name: string }[] = []
  for (const project of await listProjects(db, actor, workspace)) {
    const opened = await openProject(db, actor, project.id)
    if (opened.effective.capabilities.has('export')) projects.push({ id: project.id, name: project.name })
  }
  const person = (await operatorRow(db, actor.id))!
  const versions = new Map((await all<{ id: string; owner_version: number }>(db, 'SELECT id,owner_version FROM peg_analytics_keys WHERE owner_id=? AND workspace_id=?', actor.id, workspace)).map(key => [key.id, key.owner_version]))
  const enabled = (await workspaceSettings(db, workspace)).integrationsEnabled
  return { projects, enabled, keys: keys.map(key => {
    const selected = JSON.parse(key.projects) as string[]
    const unavailable = !enabled || versions.get(key.id) !== person.version || selected.some(id => !projects.some(p => p.id === id))
    return { ...key, projects: selected, fields: JSON.parse(key.fields) as Fields,
      status: key.revoked_at !== null ? 'Revoked' : key.expires_at <= now() ? 'Expired' : unavailable ? 'Unavailable' : 'Active' }
  }) }
}
