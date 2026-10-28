import type { Bindings } from '../../auth.server'
import { all, bound, conflict, first, invalid, newId, now, run } from '../db'
import { guarded, revision } from '../decisions/revision'
import { auditStatement } from '../authorization/audit'
import { openProject } from '../workspace/projects'
import { openTask, require } from '../tasks/access'
import type { Actor } from '../workspace/people'
import { taskCalendars } from '../schedule/availability'
import { dayNumber, dayString, freeTimeSlots, instantOf, type WorkingCalendar } from '../schedule/calendar'
import { calendarEdge, CalendarFailure, type Event, type Slot } from '../connectors/calendars/edge'
import { calendarAdmin, calendarSettings, connectionFor, taskFingerprint, type Connection } from './connections'
export interface Block { id: string; connection_id: string; task_id: string; transaction_id: string; event_id: string | null; etag: string | null; start_at: string; end_at: string; zone: string; task_revision: string; state: 'pending' | 'scheduled' | 'conflict' | 'cancelled'; cause: string | null; revision: number }
interface Preview { id: string; connection_id: string; task_id: string; owner_id: string; task_revision: string; connection_revision: number; block_id: string | null; block_revision: number | null; observed_etag: string | null; slots: string; zone: string; expires_at: number; applied_block: string | null }
const activeBlock = (db: D1Database, connection: string, task: string) => first<Block>(db, "SELECT * FROM peg_calendar_blocks WHERE connection_id=? AND task_id=? AND state<>'cancelled'", connection, task)
async function work(db: D1Database, actor: Actor, id: string, connection: Connection) {
 const { task, access } = await openTask(db, actor, id)
 require(access, 'edit')
 if (task.workspace_id !== connection.workspace_id) throw invalid('calendar_workspace')
 return task
}
async function edgeFor(env: Bindings, db: D1Database, actor: Actor, connection: Connection, credential: unknown) {
 const edge = calendarEdge(env, connection.service, connection.calendar_id, credential)
 try { if (await edge.permission() !== connection.calendar_id) throw new CalendarFailure(403, 'calendar_identity_changed') } catch (e) {
  if (e instanceof CalendarFailure && e.status === 403) await run(db, 'UPDATE peg_calendar_connections SET active=0,revision=revision+1 WHERE id=?', connection.id)
  throw e
 }
 await connectionFor(db, actor, connection.id)
 return edge
}
async function changed(db: D1Database, id: string, cause: string) {
 await run(db, "UPDATE peg_calendar_blocks SET state='conflict',cause=?,revision=revision+1 WHERE id=? AND state<>'cancelled'", cause, id)
 throw conflict(cause)
}
const endBeforeDeadline = (due: string | null, zone: string, end: string) => !due || Date.parse(end) <= (due.length === 10 ? instantOf(dayString(dayNumber(due) + 1), 0, zone) : Date.parse(due))
async function free(db: D1Database, task: Awaited<ReturnType<typeof work>>, date: string, minutes: number, edge: ReturnType<typeof calendarEdge>, excluding?: string) {
 const calendar = (await taskCalendars(db, [task])).calendars.get(task.id) as WorkingCalendar
 const start = new Date(instantOf(date, 0, calendar.zone)).toISOString(), end = new Date(instantOf(dayString(dayNumber(date) + 1), 0, calendar.zone)).toISOString()
 const busy = await edge.busy(start, end, excluding, calendar.zone)
 const slots = freeTimeSlots(date, calendar, busy, minutes).filter(slot => endBeforeDeadline(task.due_date, calendar.zone, slot.end))
 return { slots, zone: calendar.zone }
}
export async function previewBlock(env: Bindings, db: D1Database, actor: Actor, taskId: string, input: Record<string, any>) {
 const connection = await connectionFor(db, actor, String(input.connectionId)), task = await work(db, actor, taskId, connection)
 const date = String(input.date), minutes = Number(input.minutes)
 if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || !Number.isInteger(minutes) || minutes < 15 || minutes > 480) throw invalid('calendar_window')
 const block = await activeBlock(db, connection.id, task.id), rev = await revision(db)
 const edge = await edgeFor(env, db, actor, connection, input.credential), observed = block ? block.event_id ? await edge.read(block.event_id) : await edge.find(block.transaction_id) : null
 if (observed?.recurring) throw conflict('calendar_recurring_exception_review_required')
 const result = await free(db, task, date, minutes, edge, observed?.id), id = newId('calendarpreview')
 await guarded(db, rev, [bound(db, 'INSERT INTO peg_calendar_previews(id,connection_id,task_id,owner_id,task_revision,connection_revision,block_id,block_revision,observed_etag,slots,zone,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [id, connection.id, task.id, actor.id, await taskFingerprint(task), connection.revision, block?.id ?? null, block?.revision ?? null, observed?.etag ?? null, JSON.stringify(result.slots), result.zone, now() + 15 * 60000])])
 return { id, ...result, deadline: task.due_date, replacing: observed }
}
export async function blockPreview(db: D1Database, actor: Actor, id: string) {
 const preview = await first<Preview>(db, 'SELECT * FROM peg_calendar_previews WHERE id=? AND owner_id=?', id, actor.id)
 if (!preview) throw invalid('calendar_preview')
 const connection = await connectionFor(db, actor, preview.connection_id), task = await work(db, actor, preview.task_id, connection)
 return { ...preview, slots: JSON.parse(preview.slots) as Slot[], taskTitle: task.title, deadline: task.due_date, service: connection.service }
}
async function acknowledge(db: D1Database, block: Block, event: Event | null, fingerprint: string) {
 const cancelled = !event || event.cancelled
 await run(db, 'UPDATE peg_calendar_blocks SET event_id=?,etag=?,start_at=?,end_at=?,task_revision=?,state=?,cause=NULL,revision=revision+1 WHERE id=?', event?.id ?? block.event_id, event?.etag ?? block.etag, cancelled ? block.start_at : event.start, cancelled ? block.end_at : event.end, fingerprint, cancelled ? 'cancelled' : 'scheduled', block.id)
 return (await first<Block>(db, 'SELECT * FROM peg_calendar_blocks WHERE id=?', block.id))!
}
export async function applyBlock(env: Bindings, db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
 const preview = await first<Preview>(db, 'SELECT * FROM peg_calendar_previews WHERE id=? AND owner_id=?', id, actor.id)
 if (!preview) throw invalid('calendar_preview')
 const connection = await connectionFor(db, actor, preview.connection_id), task = await work(db, actor, preview.task_id, connection), fingerprint = await taskFingerprint(task)
 if (preview.applied_block) {
  const applied = (await first<Block>(db, 'SELECT * FROM peg_calendar_blocks WHERE id=?', preview.applied_block))!
  if (applied.state === 'scheduled' || applied.state === 'cancelled') return applied
  return syncBlock(env, db, actor, applied.id, input)
 }
 if (preview.expires_at <= now() || preview.connection_revision !== connection.revision || preview.task_revision !== fingerprint) throw conflict('calendar_review_changed')
 const slots: Slot[] = JSON.parse(preview.slots), slot = slots[Number(input.slot)]
 if (!slot || !Number.isInteger(Number(input.slot))) throw invalid('calendar_slot')
 let block = await activeBlock(db, connection.id, task.id)
 if ((block?.id ?? null) !== preview.block_id || (block?.revision ?? null) !== preview.block_revision) throw conflict('calendar_review_changed')
 const edge = await edgeFor(env, db, actor, connection, input.credential), observed = block ? block.event_id ? await edge.read(block.event_id) : await edge.find(block.transaction_id) : null
 if ((observed?.etag ?? null) !== preview.observed_etag) { if (block) return changed(db, block.id, 'calendar_provider_conflict'); throw conflict('calendar_provider_conflict') }
 const date = new Intl.DateTimeFormat('en-CA', { timeZone: preview.zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(slot.start))
 const available = await free(db, task, date, (Date.parse(slot.end) - Date.parse(slot.start)) / 60000, edge, observed?.id)
 if (!available.slots.some(s => s.start === slot.start && s.end === slot.end)) throw conflict('calendar_time_no_longer_free')
 const freshTask = await work(db, actor, task.id, await connectionFor(db, actor, connection.id))
 if (await taskFingerprint(freshTask) !== fingerprint) throw conflict('calendar_review_changed')
 const rev = await revision(db), blockId = block?.id ?? newId('block'), transaction = block?.transaction_id ?? crypto.randomUUID()
 await guarded(db, rev, [block ? bound(db, "UPDATE peg_calendar_blocks SET start_at=?,end_at=?,zone=?,task_revision=?,state='pending',cause=NULL,revision=revision+1 WHERE id=?", [slot.start, slot.end, preview.zone, fingerprint, blockId])
  : bound(db, "INSERT INTO peg_calendar_blocks(id,connection_id,task_id,transaction_id,start_at,end_at,zone,task_revision,state) VALUES(?,?,?,?,?,?,?,?,'pending')", [blockId, connection.id, task.id, transaction, slot.start, slot.end, preview.zone, fingerprint]),
  bound(db, 'UPDATE peg_calendar_previews SET applied_block=? WHERE id=?', [blockId, id]),
  auditStatement(db, { workspaceId: null, actorId: actor.id, action: 'calendar.block_reviewed', targetType: 'calendar_block', targetId: blockId })])
 block = (await first<Block>(db, 'SELECT * FROM peg_calendar_blocks WHERE id=?', blockId))!
 try {
  const event = observed ? await edge.move(observed.id, observed.etag, slot, preview.zone) : await edge.create(transaction, slot, preview.zone)
  // A concurrent task edit never changes its deadline or silently adopts a provider move.
  if (await taskFingerprint(await work(db, actor, task.id, await connectionFor(db, actor, connection.id))) !== fingerprint) return changed(db, blockId, 'calendar_task_changed')
  if (event.recurring || event.cancelled || event.start !== slot.start || event.end !== slot.end) return changed(db, blockId, 'calendar_provider_conflict')
  return acknowledge(db, block, event, fingerprint)
 } catch (error) { if (error instanceof CalendarFailure) { await run(db, 'UPDATE peg_calendar_blocks SET cause=? WHERE id=?', error.code, blockId); if (error.status === 403) await run(db, 'UPDATE peg_calendar_connections SET active=0,revision=revision+1 WHERE id=?', connection.id) } throw error }
}
async function blockFor(db: D1Database, actor: Actor, id: string) {
 const block = await first<Block>(db, 'SELECT * FROM peg_calendar_blocks WHERE id=?', id)
 if (!block) throw invalid('calendar_block')
 const connection = await connectionFor(db, actor, block.connection_id), task = await work(db, actor, block.task_id, connection)
 return { block, connection, task }
}
export async function syncBlock(env: Bindings, db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
 const { block, connection, task } = await blockFor(db, actor, id)
 if (block.state === 'cancelled') return block
 const fingerprint = await taskFingerprint(task)
 if (fingerprint !== block.task_revision) return changed(db, id, 'calendar_task_changed')
 const edge = await edgeFor(env, db, actor, connection, input.credential), event = block.event_id ? await edge.read(block.event_id) : await edge.find(block.transaction_id)
 if (!event && block.state === 'pending') throw conflict('calendar_readback_absent_review_again')
 if (event?.recurring || event && !event.cancelled && (!endBeforeDeadline(task.due_date, block.zone, event.end) || Date.parse(event.end) <= Date.parse(event.start))) return changed(db, id, 'calendar_provider_conflict')
 if (event && !event.cancelled) {
  if (block.state === 'pending' && (event.start !== block.start_at || event.end !== block.end_at)) return changed(db, id, 'calendar_provider_conflict')
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: block.zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(event.start))
  const available = await free(db, task, date, (Date.parse(event.end) - Date.parse(event.start)) / 60000, edge, event.id)
  if (!available.slots.some(s => s.start === event.start && s.end === event.end)) return changed(db, id, 'calendar_time_no_longer_free')
 }
 if (await taskFingerprint(await work(db, actor, task.id, await connectionFor(db, actor, connection.id))) !== fingerprint) return changed(db, id, 'calendar_task_changed')
 return acknowledge(db, block, event, fingerprint)
}
export async function deleteBlock(env: Bindings, db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
 const { block, connection, task } = await blockFor(db, actor, id)
 if (block.state === 'cancelled') return block
 if (Number(input.revision) !== block.revision || await taskFingerprint(task) !== block.task_revision) return changed(db, id, 'calendar_task_changed')
 const edge = await edgeFor(env, db, actor, connection, input.credential), event = block.event_id ? await edge.read(block.event_id) : await edge.find(block.transaction_id)
 if (event && (event.recurring || block.etag && event.etag !== block.etag)) return changed(db, id, 'calendar_provider_conflict')
 if (await taskFingerprint(await work(db, actor, task.id, await connectionFor(db, actor, connection.id))) !== block.task_revision) return changed(db, id, 'calendar_task_changed')
 if (event && !event.cancelled) await edge.remove(event.id, event.etag)
 if (await taskFingerprint(await work(db, actor, task.id, await connectionFor(db, actor, connection.id))) !== block.task_revision) return changed(db, id, 'calendar_task_changed')
 return acknowledge(db, block, null, block.task_revision)
}
export async function projectBlocks(db: D1Database, actor: Actor, projectId: string) {
 await openProject(db, actor, projectId)
 const rows = await all<Block>(db, `SELECT b.* FROM peg_calendar_blocks b JOIN peg_calendar_connections c ON c.id=b.connection_id JOIN peg_task_projects p ON p.task_id=b.task_id WHERE p.project_id=? AND c.owner_id=? ORDER BY b.start_at,b.id`, projectId, actor.id)
 const out: (Block & { service: string; title: string })[] = []
 for (const row of rows) { try { const connection = await connectionFor(db, actor, row.connection_id, true), task = await work(db, actor, row.task_id, connection); out.push({ ...row, service: connection.service, title: task.title }) } catch {} }
 return out
}
export async function calendarChoices(db: D1Database, actor: Actor, workspace: string) {
 try { await calendarAdmin(db, actor, workspace); return (await calendarSettings(db, actor, workspace)).connections.filter(c => c.active) } catch { return [] }
}
