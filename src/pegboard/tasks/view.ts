import { isRecoveryHidden } from '../recovery/visibility'
import {registerView} from '../register/records'
import {taskFields} from '../fields/values'
import {taskTags} from '../tags/tags'
// What a person sees of a task: its own shared record, and of each project it hangs in only the ones they may read,
// with the values, files and history those projects keep. Nothing of an unreadable project leaves this module.
import { all, batch, bound, first, invalid, newId, notFound, now } from '../db'
import type { FieldRow, SectionRow, TaskProjectRow, TaskRow } from '../model'
import { rootOf, taskAccess } from '../authorization/effective'
import { currentRef, aliases } from '../references/refs'
import { fieldReadable } from '../workspace/projects'
import { displayNames, type Actor } from '../workspace/people'
import { openTask, require } from './access'
import { historyOf, historyStatement, reopenGuard } from './history'

export const attachmentTypes = ['image/png', 'image/jpeg', 'application/pdf', 'text/plain']
export const attachmentLimit = 512 * 1024

export async function viewTask(db: D1Database, actor: Actor, idOrRef: string) {
  const { task, access } = await openTask(db, actor, idOrRef)
  const readable = new Set(access.contexts.keys())
  const homes = await all<TaskProjectRow & { name: string }>(db, 'SELECT tp.*,p.name FROM peg_task_projects tp JOIN peg_projects p ON p.id=tp.project_id WHERE tp.task_id=? ORDER BY tp.added_at', (await rootOf(db, task)).id)
  const projects = []
  for (const home of homes) {
    const context = access.contexts.get(home.project_id)
    if (!context) continue
    const section = home.section_id ? await first<SectionRow>(db, 'SELECT * FROM peg_sections WHERE id=?', home.section_id) : null
    projects.push({id:home.project_id,name:home.name,section:section?{id:section.id,name:section.name}:null,level:context.level,fields:await taskFields(db,actor,task.id,home.project_id)})
  }
  const history = await historyOf(db, task.id, readable)
  const comments = await all<{ id: string; author_id: string; body: string; created_at: number }>(db, 'SELECT id,author_id,body,created_at FROM peg_comments WHERE task_id=? ORDER BY created_at', task.id)
  const files = await all<{ id: string; project_id: string | null; name: string; content_type: string; size: number; created_by: string; created_at: number }>(db, `SELECT id,project_id,name,content_type,size,created_by,created_at FROM peg_attachments WHERE task_id=? AND NOT EXISTS(SELECT 1 FROM peg_recovery r WHERE r.object_type='attachment' AND r.object_id=peg_attachments.id AND r.restored_at IS NULL) AND NOT EXISTS(SELECT 1 FROM peg_proof_versions v JOIN peg_recovery r ON r.object_type='proof_version' AND r.object_id=v.id AND r.restored_at IS NULL WHERE v.attachment_id=peg_attachments.id) ORDER BY created_at`, task.id)
  const collaborators = (await all<{ operator_id: string }>(db, 'SELECT operator_id FROM peg_task_collaborators WHERE task_id=?', task.id)).map(row => row.operator_id)
  const subtasks = []
  for (const child of await all<TaskRow>(db, 'SELECT * FROM peg_tasks WHERE parent_id=? ORDER BY created_at', task.id)) {
    if ((await taskAccess(db, actor, child)).capabilities.has('read')) subtasks.push({ id: child.id, ref: await currentRef(db, child.id), title: child.title, status: child.status })
  }
  const names = await displayNames(db, [task.owner_id, ...collaborators, ...history.map(entry => entry.actor_id), ...comments.map(comment => comment.author_id), ...files.map(file => file.created_by)])
  const name = (id: string) => names.get(id) ?? 'Former member'
  const internal = access.role !== 'guest'
  return {
    id: task.id, ref: await currentRef(db, task.id), aliases: await aliases(db, task.id), title: task.title, description: task.description, kind: await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',task.id) ? 'approval' : task.kind, parentId: task.parent_id,
    status: task.status, priority: task.priority, startDate: task.start_date, dueDate: task.due_date, estimateHours: task.estimate_hours,
    owner: { id: task.owner_id, name: name(task.owner_id) }, collaborators: collaborators.map(id => ({ id, name: name(id) })), personal: access.personal,
    ...(internal ? { internalOnly: !!task.internal_only, internalNotes: task.internal_notes } : {}),
    // An assigned-work grant opens this task, without opening the project's delivery register.
    deliveryRecords:(await Promise.all(projects.filter(p=>access.contexts.get(p.id)!.paths.some(path=>path.scope!=='assignee'&&path.capabilities.includes('read'))).map(async p=>(await registerView(db,actor,p.id)).records.filter(r=>r.task_id===task.id).map(r=>({id:r.id,title:r.title,link:`/app/projects/${p.id}/register#${r.id}`}))))).flat(),
    tags:await taskTags(db,actor,task.id), capabilities: [...access.capabilities], level: access.level, projects, subtasks,
    meetingCitations: await all<{meetingId:string;segmentIndex:number}>(db,`SELECT m.id AS meetingId,p.segment_index AS segmentIndex FROM peg_meeting_proposals p JOIN peg_meetings m ON m.id=p.meeting_id JOIN oa_operators o ON o.id=m.created_by WHERE p.task_id=? AND m.created_by=? AND m.revoked_at IS NULL AND o.status='active' AND o.role IN ('owner','admin')`,task.id,actor.id),
    history: history.filter(entry => internal || entry.kind !== 'internal.changed').map(entry => ({ id: entry.id, at: entry.at, actor: name(entry.actor_id), kind: entry.kind, projectId: entry.project_id, detail: entry.kind==='fields.changed'?{}:shareHistory(entry.detail, readable) })),
    comments: comments.map(comment => ({ id: comment.id, author: name(comment.author_id), body: comment.body, at: comment.created_at })),
    attachments: files.filter(file => file.project_id === null ? task.owner_id === actor.id : readable.has(file.project_id)).map(file => ({ id: file.id, projectId: file.project_id, name: file.name, contentType: file.content_type, size: file.size, by: name(file.created_by), at: file.created_at })),
    createdAt: task.created_at, updatedAt: task.updated_at, completedAt: task.completed_at,
  }
}
/** A history detail names another project only when the reader may read that one too. */
function shareHistory(detail: Record<string, unknown>, readable: Set<string>) {
  const out = { ...detail }
  if (typeof out.movedFrom === 'string' && !readable.has(out.movedFrom)) delete out.movedFrom
  else if (typeof out.movedFrom === 'string') out.movedFrom = { id: out.movedFrom }
  return out
}

export async function addComment(db: D1Database, actor: Actor, idOrRef: string, body: unknown) {
  const { task, access } = await openTask(db, actor, idOrRef)
  require(access, 'comment')
  if (typeof body !== 'string' || !body.trim() || body.length > 10000) throw invalid('body')
  const via = [...access.contexts].filter(([, effective]) => effective.capabilities.has('comment')).sort((a, b) => b[1].paths.length - a[1].paths.length)[0]?.[0] ?? null
  const id = newId('cmt')
  await batch(db, [reopenGuard(db,task.id,actor.id,'comment'),bound(db, 'INSERT INTO peg_comments(id,task_id,project_id,author_id,body,created_at) VALUES (?,?,?,?,?,?)', [id, task.id, via, actor.id, body.trim(), now()]), historyStatement(db, task.id, null, actor.id, 'comment.added', {})])
  return { id }
}

export async function addAttachment(db: D1Database, actor: Actor, idOrRef: string, input: { projectId?: string; name: string; contentType: string; bytes: ArrayBuffer }) {
  const { task, access } = await openTask(db, actor, idOrRef)
  require(access, 'comment')
  const contentType = input.contentType.split(';')[0].trim().toLowerCase()
  if (!attachmentTypes.includes(contentType)) throw invalid('attachment_type')
  if (!input.bytes.byteLength || input.bytes.byteLength > attachmentLimit) throw invalid('attachment_size')
  const name = input.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'file'
  let projectId: string | null = null
  if (!access.personal) {
    const context = input.projectId ? access.contexts.get(input.projectId) : [...access.contexts.values()][0]
    projectId = input.projectId ?? [...access.contexts.keys()][0]
    if (!context) throw notFound()
    require({ ...access, capabilities: context.capabilities }, 'comment')
  }
  const id = newId('att')
  await batch(db, [reopenGuard(db,task.id,actor.id,'attachment'),bound(db, 'INSERT INTO peg_attachments(id,task_id,project_id,name,content_type,size,data,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)', [id, task.id, projectId, name, contentType, input.bytes.byteLength, Array.from(new Uint8Array(input.bytes)) as never, actor.id, now()]),
    historyStatement(db, task.id, projectId, actor.id, 'attachment.added', { name })])
  return { id, name, contentType }
}
export async function readAttachment(db: D1Database, actor: Actor, id: string) {
  const file = await first<{ id: string; task_id: string; project_id: string | null; name: string; content_type: string; data: ArrayBuffer | number[] }>(db, 'SELECT * FROM peg_attachments WHERE id=?', id)
  if (!file||await isRecoveryHidden(db,'attachment',id)) throw notFound()
  const version=await first<{id:string}>(db,'SELECT id FROM peg_proof_versions WHERE attachment_id=?',id)
  if(version&&await isRecoveryHidden(db,'proof_version',version.id))throw notFound()
  const { task, access } = await openTask(db, actor, file.task_id)
  if (file.project_id === null ? task.owner_id !== actor.id : !access.contexts.has(file.project_id)) throw notFound()
  return { name: file.name, contentType: file.content_type, bytes: file.data instanceof ArrayBuffer ? file.data : new Uint8Array(file.data).buffer }
}
