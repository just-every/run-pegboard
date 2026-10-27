import {validateTool} from './schema'
import { all, batch, bound, conflict, first, forbidden, invalid, notFound, now, newId } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { openProject, need } from '../workspace/projects'
import { openTask, require } from '../tasks/access'
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
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const intent = (input: Record<string, any>) => { if (typeof input.intent !== 'string' || !/^[\w.-]{1,120}$/.test(input.intent)) throw invalid('idempotency_key_required'); return input.intent }
async function once(db: D1Database, access: Access, name: string, input: Record<string, any>, perform: () => Promise<unknown>) {
 const id = intent(input), fingerprint = await digest(canonical([name, input]))
 const existing = await first<{ fingerprint: string; response: string | null }>(db, 'SELECT fingerprint,response FROM peg_api_intents WHERE key_id=? AND intent=?', access.key.id, id)
 if (existing) {
  if (existing.fingerprint !== fingerprint) throw conflict('idempotency_key_reused')
  if (!existing.response) throw conflict('intent_in_progress')
  const result = JSON.parse(existing.response)
  if (name === 'task_create') await taskScope(db,access,String(result.id))
  return result
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
 const problem = validateTool(name,input)
 if (problem) throw invalid(problem)
 const { actor, key } = access
 if (name === 'task_read') return readTask(db, access, String(input.taskId))
 if (name === 'task_approve') { await taskScope(db, access, String(input.taskId)); throw forbidden('human_approval_required') }
 if (name === 'task_create') {
  writable(access)
  if (input.projectId) need((await projectScope(db, access, input.projectId)).effective,'edit')
  else if (!key.personal) throw notFound()
  if (!['task', 'approval', undefined].includes(input.kind)) throw invalid('kind')
  return once(db, access, name, input, async () => {
   const rev = {...await revision(db),apiKeyId:key.id}
   const created = await prepareTask(db, actor, { title: input.title, description: input.description, projectId: input.projectId, estimateHours: input.estimateHours, kind: input.kind }, { queueRules: false })
   await guarded(db, rev, created.statements)
   return { id: created.id }
  })
 }
 if (name === 'task_update' || name === 'task_comment') {
  writable(access)
  const opened = await taskScope(db, access, String(input.taskId))
  require(opened.access,name === 'task_comment' ? 'comment' : 'edit')
  return once(db, access, name, input, async () => {
   const fence = {...await revision(db),apiKeyId:key.id}
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
  const limit = Number(input.limit ?? 50)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw invalid('event_page')
  const cursor = input.cursor ? await first<{after_id:number}>(db,'SELECT after_id FROM peg_api_cursors WHERE id=? AND key_id=?',String(input.cursor),key.id) : {after_id:0}
  if (!cursor) throw invalid('event_cursor')
  const events = [], visible = []
  const rows = await all<{ id: number; public_id: string; task_id: string; kind: string; at: number }>(db, 'SELECT * FROM peg_api_events WHERE id>? ORDER BY id', cursor.after_id)
  for (const row of rows) {
   if (!await taskScope(db, access, row.task_id).catch(() => null)) continue
   visible.push(row)
   if (visible.length > limit) break
  }
  for (const row of visible.slice(0,limit)) {
   const envelope = { id: row.public_id, taskId: row.task_id, type: row.kind, at: row.at, audience: key.id }
   events.push({ envelope, signature: await signature(key.token_hash, envelope) })
  }
  let next: string|null = null
  if (visible.length > limit) {
   next = newId('cursor')
   await batch(db,[bound(db,'INSERT INTO peg_api_cursors VALUES(?,?,?)',[next,key.id,visible[limit-1].id])])
  }
  return { events, next, signing: 'HMAC-SHA256 using SHA256 of the JSON encoded bearer credential' }
 }
 if (name === 'event_receive') {
  const envelope = input.envelope
  if (!envelope || envelope.audience !== key.id || typeof envelope.id !== 'string' || !/^evt_[a-f0-9]{20}$/.test(envelope.id) || typeof input.signature !== 'string') throw forbidden('event_signature')
  const expected = await signature(key.token_hash, envelope)
  // Compare the fixed-size authenticators without a prefix timing signal.
  let different = expected.length ^ input.signature.length
  for (let i = 0; i < expected.length; i++) different |= expected.charCodeAt(i) ^ (input.signature.charCodeAt(i) || 0)
  if (different) throw forbidden('event_signature')
  await taskScope(db, access, envelope.taskId)
  if (!await first(db,'SELECT 1 FROM peg_api_events WHERE public_id=? AND task_id=? AND kind=? AND at=?',envelope.id,envelope.taskId,envelope.type,envelope.at)) throw forbidden('event_signature')
  const result = await batch(db, [bound(db, 'INSERT OR IGNORE INTO peg_api_receipts VALUES(?,?,?)', [key.id, envelope.id, now()])])
  return { id: envelope.id, applied: result[0].meta.changes === 1 }
 }
 throw invalid('unknown_tool')
}
