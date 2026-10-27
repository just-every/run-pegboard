import { all, batch, bound, conflict, first, forbidden, invalid, notFound, now } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import { openProject } from '../workspace/projects'
import { openTask } from '../tasks/access'
import { prepareTask, updateTask } from '../tasks/tasks'
import { addComment, viewTask } from '../tasks/view'
import { readableTasks, rollup, myTasks } from '../tasks/board'
import type { Actor } from '../workspace/people'
import type { ApiKey } from './credentials'

export interface Access { key: ApiKey; actor: Actor }
const projectScope = async (db: D1Database, access: Access, id: string) => {
 if (!(JSON.parse(access.key.projects) as string[]).includes(id)) throw notFound()
 return openProject(db, access.actor, id)
}
async function taskScope(db: D1Database, access: Access, id: string) {
 const opened = await openTask(db, access.actor, id)
 if (opened.access.personal ? !access.key.personal : ![...opened.access.contexts.keys()].some(id => JSON.parse(access.key.projects).includes(id))) throw notFound()
 return opened
}
async function readTask(db: D1Database, access: Access, id: string) {
 await taskScope(db, access, id)
 const rev = await revision(db)
 const task = await viewTask(db, access.actor, id)
 // Restrict project-specific fields and history even when the sponsor has a broader human grant.
 const projects: string[] = JSON.parse(access.key.projects), visible = new Set(projects)
 return { ...task, projects: task.projects.filter(p => visible.has(p.id)),
  history: task.history.filter(h => !h.projectId || visible.has(h.projectId)),
  attachments: task.attachments.filter(a => !a.projectId || visible.has(a.projectId)),
  revision: await digest([task.id, rev]) }
}
const writable = (access: Access) => { if (!access.key.writable) throw forbidden('read_only_key') }
const intent = (input: Record<string, any>) => { if (typeof input.intent !== 'string' || !/^[\w.-]{1,120}$/.test(input.intent)) throw invalid('idempotency_key_required'); return input.intent }
async function once(db: D1Database, access: Access, name: string, input: Record<string, any>, perform: () => Promise<unknown>) {
 const id = intent(input), fingerprint = await digest([name, input])
 const existing = await first<{ fingerprint: string; response: string | null }>(db, 'SELECT fingerprint,response FROM peg_api_intents WHERE key_id=? AND intent=?', access.key.id, id)
 if (existing) {
  if (existing.fingerprint !== fingerprint) throw conflict('idempotency_key_reused')
  if (!existing.response) throw conflict('intent_in_progress')
  return JSON.parse(existing.response)
 }
 try { await batch(db, [bound(db, 'INSERT INTO peg_api_intents VALUES(?,?,?,NULL)', [access.key.id, id, fingerprint])]) }
 catch { throw conflict('intent_in_progress') }
 // A lost response never authorizes a second execution. An interrupted intent remains fenced for review.
 const result = await perform()
 await batch(db, [bound(db, 'UPDATE peg_api_intents SET response=? WHERE key_id=? AND intent=?', [JSON.stringify(result), access.key.id, id])])
 return result
}
async function signature(secret: string, value: unknown) {
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
 return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify(value))))].map(n => n.toString(16).padStart(2, '0')).join('')
}
export async function execute(db: D1Database, access: Access, name: string, input: Record<string, any>) {
 const { actor, key } = access
 if (name === 'task_read') return readTask(db, access, String(input.taskId))
 if (name === 'task_approve') { await taskScope(db, access, String(input.taskId)); throw forbidden('human_approval_required') }
 if (name === 'task_create') {
  writable(access)
  if (input.projectId) await projectScope(db, access, input.projectId)
  else if (!key.personal) throw notFound()
  if (!['task', 'approval', undefined].includes(input.kind)) throw invalid('kind')
  return once(db, access, name, input, async () => {
   const rev = await revision(db)
   const created = await prepareTask(db, actor, { title: input.title, description: input.description, projectId: input.projectId, estimateHours: input.estimateHours, kind: input.kind }, { queueRules: false })
   await guarded(db, rev, created.statements)
   return { id: created.id }
  })
 }
 if (name === 'task_update' || name === 'task_comment') {
  writable(access); await taskScope(db, access, String(input.taskId))
  return once(db, access, name, input, async () => {
   const fence = await revision(db)
   if (name === 'task_comment') return addComment(db, actor, input.taskId, input.body, false, fence)
   const current = await readTask(db, access, input.taskId)
   if (input.revision !== current.revision) throw conflict('task_revision_changed')
   const patch = input.patch
   if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(k => !['title','description','status','priority','estimateHours'].includes(k))) throw invalid('patch')
   // Recheck the preview and permissions in the same transaction as the common editor's writes.
   const updated = await updateTask(db, actor, input.taskId, patch, fence)
   return { id: updated.id, status: updated.status }
  })
 }
 if (name === 'project_tasks' || name === 'project_report') {
  await projectScope(db, access, String(input.projectId))
  if (name === 'project_report') return rollup(db, actor, [input.projectId])
  const limit = Number(input.limit ?? 50), cursor = String(input.cursor ?? '')
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw invalid('page_limit')
  const tasks = (await readableTasks(db, actor, input.projectId)).sort((a, b) => a.id.localeCompare(b.id)).filter(t => t.id > cursor)
  const page = tasks.slice(0, limit)
  return { tasks: await Promise.all(page.map(t => readTask(db, access, t.id))), next: tasks.length > limit ? page.at(-1)!.id : null }
 }
 if (name === 'personal_tasks') {
  if (!key.personal) throw notFound()
  return { tasks: (await myTasks(db, actor)).filter(t => t.personal) }
 }
 if (name === 'events_list') {
  const cursor = Number(input.cursor ?? 0), limit = Number(input.limit ?? 50)
  if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw invalid('event_page')
  const events = []
  // Scan a bounded page; cursor advances even over inaccessible rows, whose identifiers and counts are never returned.
  const rows = await all<{ id: number; task_id: string; kind: string; at: number }>(db, 'SELECT * FROM peg_api_events WHERE id>? ORDER BY id LIMIT ?', cursor, limit)
  for (const row of rows) {
   if (!await taskScope(db, access, row.task_id).catch(() => null)) continue
   const envelope = { id: row.id, taskId: row.task_id, type: row.kind, at: row.at, audience: key.id }
   events.push({ envelope, signature: await signature(key.token_hash, envelope) })
  }
  return { events, next: rows.length ? rows.at(-1)!.id : null, signing: 'HMAC-SHA256 using SHA256 of the JSON encoded bearer credential' }
 }
 if (name === 'event_receive') {
  const envelope = input.envelope
  if (!envelope || envelope.audience !== key.id || !Number.isSafeInteger(envelope.id) || typeof input.signature !== 'string') throw forbidden('event_signature')
  const expected = await signature(key.token_hash, envelope)
  // Compare the fixed-size authenticators without a prefix timing signal.
  let different = expected.length ^ input.signature.length
  for (let i = 0; i < expected.length; i++) different |= expected.charCodeAt(i) ^ (input.signature.charCodeAt(i) || 0)
  if (different) throw forbidden('event_signature')
  await taskScope(db, access, envelope.taskId)
  const result = await batch(db, [bound(db, 'INSERT OR IGNORE INTO peg_api_receipts VALUES(?,?,?)', [key.id, envelope.id, now()])])
  return { id: envelope.id, applied: result[0].meta.changes === 1 }
 }
 throw invalid('unknown_tool')
}
