import type { Bindings } from '../../auth.server'
import { all, batch, bound, conflict, first, forbidden, notFound, now, PegError } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { openTask } from '../tasks/access'
import { rootOf } from '../authorization/effective'
import { openProject, need } from '../workspace/projects'
import { isAdministrator } from '../authorization/levels'
import { workspaceRole, workspaceSettings, type Actor } from '../workspace/people'
import { permanentEvent } from '../audit/search'
interface Subscription { id: string; workspace_id: string; project_id: string | null; events: string; url: string; secret_hash: string; created_by: string; revoked_at: number | null }
async function subscription(db: D1Database, actor: Actor, id: string) {
 const row = await first<Subscription>(db, 'SELECT * FROM peg_webhooks WHERE id=? AND revoked_at IS NULL AND created_by=?', id, actor.id)
 if (!row || !(await workspaceSettings(db, row.workspace_id)).integrationsEnabled) throw notFound()
 if (row.project_id) need((await openProject(db, actor, row.project_id)).effective, 'manage_settings')
 else if (!isAdministrator(await workspaceRole(db, actor.id, row.workspace_id))) throw forbidden('manage_integrations')
 return row
}
export async function webhookPreview(db: D1Database, actor: Actor, id: string, eventId: string) {
 const rev = await revision(db), hook = await subscription(db, actor, id)
 const event = await first<{ id: number; public_id: string; task_id: string; kind: string; at: number }>(db, 'SELECT * FROM peg_api_events WHERE public_id=?', eventId)
 if (!event || !hook.events.split(',').includes(event.kind)) throw notFound()
 const opened = await openTask(db, actor, event.task_id)
 if (opened.access.personal || opened.task.workspace_id !== hook.workspace_id) throw notFound()
 if (hook.project_id && !await first(db, 'SELECT 1 FROM peg_task_projects WHERE task_id=? AND project_id=?', (await rootOf(db, opened.task)).id, hook.project_id)) throw notFound()
 const envelope = { id: event.public_id, type: event.kind, taskId: opened.task.id, at: event.at, subscriptionId: hook.id }
 return { destination: hook.url, envelope, token: await digest([hook, envelope, rev]), rev }
}
export async function deliverWebhook(db: D1Database, env: Bindings, actor: Actor, id: string, input: Record<string, any>) {
 const preview = await webhookPreview(db, actor, id, String(input.eventId)), hook = await subscription(db, actor, id)
 if (input.revision !== preview.token || input.consent !== true) throw conflict('webhook_review_required')
 const hashed = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(input.secret ?? ''))))].map(n => n.toString(16).padStart(2, '0')).join('')
 if (hashed !== hook.secret_hash) throw forbidden('webhook_secret')
 const old = await first<{state:string}>(db, 'SELECT state FROM peg_webhook_deliveries WHERE webhook_id=? AND event_id=?', id, preview.envelope.id)
 if (old) return { eventId: preview.envelope.id, state: old.state, replayed: true }
 // Claim before the network call. An uncertain send is never automatically repeated.
 try { await guarded(db, preview.rev, [bound(db, "INSERT INTO peg_webhook_deliveries VALUES(?,?,'sending',NULL,?)", [id, preview.envelope.id, now()])]) }
 catch { throw conflict('webhook_delivery_changed') }
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
 const body = JSON.stringify(preview.envelope), signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))].map(n => n.toString(16).padStart(2, '0')).join('')
 let destination = hook.url
 // The network edge can use a loopback schema receiver in a local installation only.
 if (env.AUTH_LOCAL === 'true' && env.PEGBOARD_LOCAL_WEBHOOK_ORIGIN && new URL(hook.url).origin === 'https://webhooks.example.com') {
  const local = new URL(env.PEGBOARD_LOCAL_WEBHOOK_ORIGIN)
  if (local.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(local.hostname)) throw new PegError(503, 'webhook_edge_unavailable')
  destination = local.origin + new URL(hook.url).pathname
 }
 let status: number | null = null
 try { status = (await fetch(destination, { method: 'POST', headers: { 'content-type': 'application/json', 'x-pegboard-event-id': String(preview.envelope.id), 'x-pegboard-signature': signature }, body, redirect: 'manual', signal: AbortSignal.timeout(15000) })).status } catch { /* Preserve the uncertain receipt, never a response body. */ }
 const state = status !== null && status >= 200 && status < 300 ? 'acknowledged' : status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429 ? 'rejected' : 'uncertain'
 await batch(db, [bound(db, 'UPDATE peg_webhook_deliveries SET state=?,status=? WHERE webhook_id=? AND event_id=?', [state, status, id, preview.envelope.id]),
  permanentEvent(db, { workspace: hook.workspace_id, actor: actor.id, action: 'webhook.delivered', type: 'webhook', id, result: state === 'acknowledged' ? 'success' : 'failure' })])
 return { eventId: preview.envelope.id, state, status, replayed: false }
}
export async function webhookHistory(db: D1Database, actor: Actor, id: string) {
 await subscription(db, actor, id)
 return { deliveries: await all(db, 'SELECT event_id,state,status,at FROM peg_webhook_deliveries WHERE webhook_id=? ORDER BY event_id', id) }
}
export async function revokeWebhook(db: D1Database, actor: Actor, id: string) {
 const hook = await subscription(db, actor, id)
 await batch(db, [bound(db, 'UPDATE peg_webhooks SET revoked_at=? WHERE id=?', [now(), id]), permanentEvent(db, { workspace: hook.workspace_id, actor: actor.id, action: 'webhook.revoked', type: 'webhook', id })])
 return { revoked: true }
}
