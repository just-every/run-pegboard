// Webhook registration: who may register one, for what, and the secret shown once. Delivery is PEG-027's; the
// authorization of the registration door is this clause's, so it is enforced here for every later caller.
import { all, batch, bound, forbidden, invalid, newId, notFound, now } from '../db'
import { auditStatement } from '../authorization/audit'
import { isAdministrator } from '../authorization/levels'
import { openProject, need } from '../workspace/projects'
import { workspaceRole, workspaceSettings, type Actor } from '../workspace/people'

const digest = async (text: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, '0')).join('')
export const webhookEvents = ['task.created', 'task.updated', 'task.completed', 'project.updated', 'access.changed']

/** A project's Admin registers for that project; a workspace owner or administrator for the whole workspace. */
export async function registerWebhook(db: D1Database, actor: Actor, input: { workspaceId?: string; projectId?: string; url: unknown; events?: unknown }) {
  let workspaceId = input.workspaceId ?? 'ws_main'
  if (input.projectId) {
    const { project, effective } = await openProject(db, actor, input.projectId)
    workspaceId = project.workspace_id
    need(effective, 'manage_settings')
  } else {
    const role = await workspaceRole(db, actor.id, workspaceId)
    if (!role) throw notFound()
    if (!isAdministrator(role)) throw forbidden('manage_integrations')
  }
  if (!(await workspaceSettings(db, workspaceId)).integrationsEnabled) throw forbidden('integrations_disabled')
  let url: URL
  try { url = new URL(String(input.url)) } catch { throw invalid('url') }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':') || /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname)) throw invalid('url')
  const events = Array.isArray(input.events) && input.events.length ? input.events : webhookEvents
  if (events.some(event => !webhookEvents.includes(event as string))) throw invalid('events')
  const id = newId('whk'), secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`
  await batch(db, [bound(db, 'INSERT INTO peg_webhooks(id,workspace_id,project_id,url,events,secret_hash,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)', [id, workspaceId, input.projectId ?? null, url.href, events.join(','), await digest(secret), actor.id, now()]),
    auditStatement(db, { workspaceId, actorId: actor.id, action: 'webhook.registered', targetType: input.projectId ? 'project' : 'workspace', targetId: input.projectId ?? workspaceId, detail: { webhookId: id, url: url.origin, events } })])
  return { id, url: url.href, events, projectId: input.projectId ?? null, secret, delivery: 'Review an event, then deliver with the once-shown secret.' }
}

export async function listWebhooks(db: D1Database, actor: Actor, workspaceId: string) {
  const role = await workspaceRole(db, actor.id, workspaceId)
  if (!role) throw notFound()
  if (!isAdministrator(role)) throw forbidden('manage_integrations')
  return (await all<{ id: string; project_id: string | null; url: string; events: string; created_at: number }>(db, 'SELECT id,project_id,url,events,created_at FROM peg_webhooks WHERE workspace_id=? AND revoked_at IS NULL ORDER BY created_at', workspaceId))
    .map(row => ({ id: row.id, projectId: row.project_id, url: row.url, events: row.events.split(','), createdAt: row.created_at }))
}
