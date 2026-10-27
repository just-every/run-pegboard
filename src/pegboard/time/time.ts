import {
  all,
  batch,
  bound,
  conflict,
  first,
  forbidden,
  invalid,
  newId,
  notFound,
  now,
} from '../db'
import type { Actor } from '../workspace/people'
import { workspaceRole, displayNames } from '../workspace/people'
import { isAdministrator } from '../authorization/levels'
import { teamEffective } from '../authorization/effective'
import type { ProjectRow, TeamRow } from '../model'
import { openTask, require } from '../tasks/access'
import { currentRef } from '../references/refs'
import { settings, localDay, dayNumber } from '../tasks/personal'
import { auditStatement } from '../authorization/audit'
import { toCsv } from '../tasks/board'
export interface Sheet {
  id: string
  operator_id: string
  workspace_id: string
  start_date: string
  end_date: string
  status: 'draft' | 'returned' | 'submitted' | 'approved'
  version: number
  reason: string
  decided_by: string | null
  decided_at: number | null
  created_at: number
}
export interface Entry {
  id: string
  sheet_id: string
  person_id: string
  task_id: string
  project_id: string | null
  work_date: string
  seconds: number | null
  start_ms: number | null
  end_ms: number | null
  source: 'manual' | 'timer' | 'adjustment'
  timezone: string
  notes: string
  adjustment_of: string | null
  operation_key: string
  created_at: number
  withdrawn_at: number | null
}
const revision = async (db: D1Database) =>
  (await first<{ value: number }>(
    db,
    'SELECT value FROM peg_personal_revision WHERE id=1',
  ))!.value
const stamp = async (value: unknown) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(value)),
      ),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
const text = (value: unknown, max: number, code: string) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw invalid(code)
  return value.trim()
}
const duration = (value: unknown, adjustment = false) => {
  const n = Number(value)
  if (
    !Number.isSafeInteger(n) ||
    Math.abs(n) > 366 * 86400 ||
    (!adjustment && n <= 0) ||
    (adjustment && n === 0)
  )
    throw invalid('duration_seconds')
  return n
}
const note = (value: unknown) => String(value ?? '').slice(0, 5000)
const rows = (db: D1Database, id: string) =>
  all<Entry>(
    db,
    'SELECT * FROM peg_time_entries WHERE sheet_id=? AND withdrawn_at IS NULL ORDER BY work_date,created_at,id',
    id,
  )
async function write(
  db: D1Database,
  actor: Actor,
  sheet: Sheet,
  rev: number,
  action: string,
  statements: D1PreparedStatement[],
  detail: Record<string, unknown> = {},
  notAfter: number | null = null,
) {
  try {
    await batch(db, [
      bound(db, 'INSERT INTO peg_personal_guards VALUES(?,?)', [newId('guard'), rev]),
      bound(db, 'INSERT INTO peg_time_authority_guards(id,not_after) VALUES(?,?)', [newId('guard'), notAfter]),
      ...statements,
      bound(
        db,
        'INSERT INTO peg_time_history(sheet_id,actor_id,at,action,detail) VALUES(?,?,?,?,?)',
        [sheet.id, actor.id, now(), action, JSON.stringify(detail)],
      ),
      auditStatement(db, {
        workspaceId:
          sheet.status === 'draft' || sheet.status === 'returned'
            ? null
            : sheet.workspace_id,
        actorId: actor.id,
        action: `time.${action}`,
        targetType: 'timesheet',
        targetId: sheet.id,
        detail,
      }),
    ])
  } catch (error) {
    if (
      /expired_time_authority|stale_personal_preview|timesheet_locked|peg_time_running|UNIQUE constraint/.test(
        String(error),
      )
    )
      throw conflict('time_changed_or_timer_running')
    throw error
  }
}
// Review covers the whole sheet. A role never grants access to hidden work.
async function reviewer(db: D1Database, actor: Actor, sheet: Sheet) {
  const role = await workspaceRole(db, actor.id, sheet.workspace_id)
  if (!role || role === 'agent' || sheet.operator_id === actor.id) return false
  const entries = await rows(db, sheet.id)
  if (!entries.length) return false
  for (const e of entries) {
    if (!e.project_id) return false
    const opened = await openTask(db, actor, e.task_id).catch(() => null)
    const access = opened?.access.contexts.get(e.project_id)
    if (!access) return false
    if (isAdministrator(role) || role === 'manager' || access.capabilities.has('delegate_admin')) continue
    const project = await first<ProjectRow>(db, 'SELECT * FROM peg_projects WHERE id=?', e.project_id)
    const team = project?.team_id ? await first<TeamRow>(db, 'SELECT * FROM peg_teams WHERE id=?', project.team_id) : null
    if (!team || !(await teamEffective(db, actor, team)).capabilities.has('delegate_admin')) return false
  }
  return true
}
async function loggerAccess(db: D1Database, sheet: Sheet) {
  const role = await workspaceRole(db, sheet.operator_id, sheet.workspace_id)
  if (!role || role === 'agent') return false
  const person: Actor = { id: sheet.operator_id, email: '', displayName: '', baseRole: 'member' }
  for (const e of await rows(db, sheet.id)) {
    const opened = await openTask(db, person, e.task_id).catch(() => null)
    if (!e.project_id || !opened?.access.contexts.get(e.project_id)?.capabilities.has('edit')) return false
    if (role === 'guest' && opened.task.owner_id !== person.id && !await first(db, 'SELECT 1 FROM peg_task_collaborators WHERE task_id=? AND operator_id=?', opened.task.id, person.id)) return false
  }
  return true
}
async function load(
  db: D1Database,
  actor: Actor,
  id: string,
  own = false,
): Promise<Sheet> {
  const sheet = await first<Sheet>(
    db,
    'SELECT * FROM peg_timesheets WHERE id=?',
    id,
  )
  if (!sheet || !(await workspaceRole(db, actor.id, sheet.workspace_id)))
    throw notFound()
  if (sheet.operator_id !== actor.id) {
    if (own || !['submitted', 'approved'].includes(sheet.status) || !(await reviewer(db, actor, sheet))) throw notFound()
  }
  return sheet
}
function editable(sheet: Sheet, actor: Actor) {
  if (sheet.operator_id !== actor.id) throw forbidden('own_timesheet')
  if (!['draft', 'returned'].includes(sheet.status))
    throw conflict('timesheet_locked')
}
export async function createSheet(
  db: D1Database,
  actor: Actor,
  workspaceId: string,
  input: Record<string, any>,
) {
  const role = await workspaceRole(db, actor.id, workspaceId)
  if (!role || role === 'agent') throw forbidden('record_time')
  const start = text(input.startDate, 10, 'start_date'),
    end = text(input.endDate, 10, 'end_date')
  if (
    dayNumber(end) < dayNumber(start) ||
    dayNumber(end) - dayNumber(start) > 31
  )
    throw invalid('timesheet_period')
  const id = newId('sheet')
  await batch(db, [
    bound(
      db,
      'INSERT INTO peg_timesheets(id,operator_id,workspace_id,start_date,end_date,created_at) VALUES(?,?,?,?,?,?)',
      [id, actor.id, workspaceId, start, end, now()],
    ),
  ])
  return { id }
}
async function taskFor(
  db: D1Database,
  actor: Actor,
  sheet: Sheet,
  input: Record<string, any>,
) {
  const opened = await openTask(db, actor, input.taskId)
  require(opened.access, 'edit')
  if (opened.access.role === 'guest' && opened.task.owner_id !== actor.id && !await first(db, 'SELECT 1 FROM peg_task_collaborators WHERE task_id=? AND operator_id=?', opened.task.id, actor.id)) throw forbidden('assigned_task')
  if (opened.task.workspace_id !== sheet.workspace_id) throw invalid('task')
  const projectId = opened.access.personal
    ? null
    : input.projectId
      ? String(input.projectId)
      : ([...opened.access.contexts].find(([, standing]) =>
          standing.capabilities.has('edit'),
        )?.[0] ?? null)
  if (
    projectId &&
    !opened.access.contexts.get(projectId)?.capabilities.has('edit')
  )
    throw forbidden('edit')
  return { taskId: opened.task.id, projectId }
}
export async function addEntry(
  db: D1Database,
  actor: Actor,
  sheetId: string,
  input: Record<string, any>,
  timer = false,
) {
  const rev = await revision(db),
    sheet = await load(db, actor, sheetId, true)
  editable(sheet, actor)
  const { taskId, projectId } = await taskFor(db, actor, sheet, input),
    key = text(input.key, 120, 'operation_key'),
    at = now(),
    timezone = (await settings(db, actor)).timezone,
    workDate = timer
      ? localDay(at, timezone)
      : text(input.date, 10, 'work_date')
  dayNumber(workDate)
  const seconds = timer ? null : duration(input.seconds),
    notes = note(input.notes)
  const duplicate = await first<Entry>(
    db,
    'SELECT * FROM peg_time_entries WHERE person_id=? AND operation_key=?',
    actor.id,
    key,
  )
  if (duplicate) {
    if (
      duplicate.task_id !== taskId ||
      duplicate.sheet_id !== sheetId ||
      duplicate.project_id !== projectId ||
      (!timer && duplicate.work_date !== workDate) ||
      duplicate.source !== (timer ? 'timer' : 'manual') ||
      (!timer && duplicate.seconds !== seconds) ||
      duplicate.notes !== notes
    )
      throw conflict('operation_key_reused')
    return { id: duplicate.id }
  }
  const id = newId('time')
  await write(
    db,
    actor,
    sheet,
    rev,
    timer ? 'timer_started' : 'entry_added',
    [
      bound(
        db,
        'INSERT INTO peg_time_entries(id,sheet_id,person_id,task_id,project_id,work_date,seconds,start_ms,end_ms,source,notes,operation_key,created_at,timezone) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          id,
          sheetId,
          actor.id,
          taskId,
          projectId,
          workDate,
          seconds,
          timer ? at : null,
          null,
          timer ? 'timer' : 'manual',
          notes,
          key,
          at,
          timezone,
        ],
      ),
    ],
    { entryId: id },
  )
  return { id }
}
export async function stopTimer(db: D1Database, actor: Actor, id: string) {
  const rev = await revision(db),
    entry = await first<Entry>(
      db,
      "SELECT * FROM peg_time_entries WHERE id=? AND person_id=? AND source='timer'",
      id,
      actor.id,
    )
  if (!entry) throw notFound()
  const sheet = await load(db, actor, entry.sheet_id, true)
  editable(sheet, actor)
  if (entry.end_ms !== null) return { id, seconds: entry.seconds }
  const at = now(),
    seconds = Math.max(0, Math.floor((at - entry.start_ms!) / 1000))
  await write(
    db,
    actor,
    sheet,
    rev,
    'timer_stopped',
    [
      bound(
        db,
        'UPDATE peg_time_entries SET seconds=?,end_ms=? WHERE id=? AND end_ms IS NULL',
        [seconds, at, id],
      ),
    ],
    { entryId: id, seconds },
  )
  return { id, seconds }
}
export async function editEntry(
  db: D1Database,
  actor: Actor,
  id: string,
  input: Record<string, any>,
) {
  const rev = await revision(db),
    entry = await first<Entry>(
      db,
      'SELECT * FROM peg_time_entries WHERE id=? AND person_id=?',
      id,
      actor.id,
    )
  if (!entry) throw notFound()
  const sheet = await load(db, actor, entry.sheet_id, true)
  editable(sheet, actor)
  if (entry.withdrawn_at) throw conflict('entry_withdrawn')
  if (entry.source !== 'manual') throw conflict('use_attributed_adjustment')
  await openTask(db, actor, entry.task_id)
  const seconds = duration(input.seconds),
    notes = note(input.notes)
  await write(
    db,
    actor,
    sheet,
    rev,
    'entry_corrected',
    [
      bound(db, 'UPDATE peg_time_entries SET seconds=?,notes=? WHERE id=?', [
        seconds,
        notes,
        id,
      ]),
    ],
    {
      entryId: id,
      from: { seconds: entry.seconds, notes: entry.notes },
      to: { seconds, notes },
    },
  )
  return { id }
}
export async function withdrawEntry(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  const entry = await first<Entry>(db, 'SELECT * FROM peg_time_entries WHERE id=? AND person_id=?', id, actor.id)
  if (!entry) throw notFound()
  const view = await sheetView(db, actor, entry.sheet_id)
  if (input.revision !== view.token) throw conflict('timesheet_preview_changed')
  editable(view.sheet, actor)
  if (view.sheet.status !== 'returned') throw conflict('returned_timesheet_required')
  if (entry.withdrawn_at) return { id }
  const shown = view.entries.find(e => e.id === id)
  if (shown?.available) throw conflict('withdraw_unreachable_entry_only')
  if (entry.source === 'timer' && entry.end_ms === null) throw conflict('stop_timer_first')
  await write(db, actor, view.sheet, view.revision, 'entry_withdrawn', [
    bound(db, 'UPDATE peg_time_entries SET withdrawn_at=?,withdrawn_by=? WHERE id=? AND withdrawn_at IS NULL', [now(), actor.id, id]),
  ], { entryId: id }, view.authorityUntil)
  return { id }
}
export async function sheetView(db: D1Database, actor: Actor, id: string) {
  const rev = await revision(db),
    authorityUntil = (await first<{ deadline: number | null }>(db, 'SELECT MIN(expires_at) deadline FROM peg_grants WHERE revoked_at IS NULL AND expires_at>?', now()))?.deadline ?? null,
    sheet = await load(db, actor, id),
    entries = await rows(db, id),
    names = await displayNames(db, [
      sheet.operator_id,
      ...(sheet.decided_by ? [sheet.decided_by] : []),
    ])
  const shown = []
  for (const e of entries) {
    const opened = await openTask(db, actor, e.task_id).catch(() => null)
    const project =
      e.project_id && opened?.access.contexts.has(e.project_id)
        ? await first<{ name: string }>(
            db,
            'SELECT name FROM peg_projects WHERE id=?',
            e.project_id,
          )
        : null
    const available = !!opened && (!e.project_id || opened.access.contexts.has(e.project_id))
    shown.push({
      ...e,
      task_id: available ? e.task_id : null,
      project_id: available ? e.project_id : null,
      notes: available ? e.notes : '',
      estimateHours: available ? opened?.task.estimate_hours ?? null : null,
      task: available ? opened!.task.title : 'Work no longer available',
      ref: available ? await currentRef(db, e.task_id) : null,
      project: project
        ? project.name
        : e.project_id
          ? 'Project no longer available'
          : 'Personal work',
      available,
    })
  }
  const history = await all<{
    actor_id: string
    at: number
    action: string
    detail: string
  }>(
    db,
    'SELECT actor_id,at,action,detail FROM peg_time_history WHERE sheet_id=? ORDER BY id',
    id,
  )
  const historyNames = await displayNames(
    db,
    history.map((h) => h.actor_id),
  )
  const estimates = new Map(
    shown
      .filter((e) => e.estimateHours !== null)
      .map((e) => [e.task_id, e.estimateHours!]),
  )
  const visibleEntries = new Set(shown.filter(e => e.available).map(e => e.id))
  return {
    estimateHours: [...estimates.values()].reduce((a, b) => a + b, 0),
    actorId: actor.id,
    sheet,
    person: names.get(sheet.operator_id) ?? 'Former member',
    decidedBy: sheet.decided_by ? names.get(sheet.decided_by) : null,
    entries: shown,
    totalSeconds: entries.reduce((n, e) => n + (e.seconds ?? 0), 0),
    running: entries.some((e) => e.source === 'timer' && e.end_ms === null),
    canReview: await reviewer(db, actor, sheet),
    loggerCanSubmit: await loggerAccess(db, sheet),
    authorityUntil,
    token: await stamp([sheet, entries, rev, authorityUntil]),
    revision: rev,
    history: history.map((h) => ({
      ...h,
      actor: historyNames.get(h.actor_id) ?? 'Former member',
      detail: (() => {
        const detail = JSON.parse(h.detail)
        return sheet.operator_id !== actor.id ? {} : detail.entryId && !visibleEntries.has(detail.entryId)
          ? { entryId: detail.entryId } : detail
      })(),
    })),
  }
}
export async function listSheets(
  db: D1Database,
  actor: Actor,
  workspaceId: string,
) {
  if (!(await workspaceRole(db, actor.id, workspaceId))) throw notFound()
  const out = []
  for (const s of await all<Sheet>(
    db,
    'SELECT * FROM peg_timesheets WHERE workspace_id=? ORDER BY created_at DESC,id',
    workspaceId,
  ))
    if (await load(db, actor, s.id).catch(() => null)) out.push(s)
  return out
}
export async function decide(
  db: D1Database,
  actor: Actor,
  id: string,
  input: Record<string, any>,
) {
  const view = await sheetView(db, actor, id),
    { sheet } = view
  if (input.revision !== view.token) throw conflict('timesheet_preview_changed')
  const action = input.action,
    reason = note(input.reason)
  let status: Sheet['status']
  if (action === 'submit') {
    editable(sheet, actor)
    if (!view.entries.length || view.running)
      throw conflict('stop_timers_and_add_entries')
    if (!view.loggerCanSubmit || view.entries.some((e) => !e.project_id || !e.available))
      throw conflict('review_project_visibility_before_submission')
    status = 'submitted'
  } else {
    if (!view.canReview) throw forbidden('different_authorized_reviewer')
    if (sheet.status !== 'submitted') throw conflict('timesheet_not_submitted')
    if (action === 'return') {
      if (!reason.trim()) throw invalid('return_reason')
      status = 'returned'
    } else if (action === 'approve') {
      if (!view.loggerCanSubmit) throw conflict('logger_authority_changed')
      status = 'approved'
    }
    else throw invalid('decision')
  }
  await write(
    db,
    actor,
    sheet,
    view.revision,
    action,
    [
      bound(
        db,
        'UPDATE peg_timesheets SET status=?,reason=?,decided_by=?,decided_at=?,version=version+1 WHERE id=?',
        [
          status,
          reason,
          action === 'submit' ? null : actor.id,
          action === 'submit' ? null : now(),
          id,
        ],
      ),
    ],
    { status, reason, version: sheet.version },
    view.authorityUntil,
  )
  return { id, status }
}
export async function adjust(
  db: D1Database,
  actor: Actor,
  id: string,
  input: Record<string, any>,
) {
  const rev = await revision(db),
    original = await first<Entry>(
      db,
      'SELECT * FROM peg_time_entries WHERE id=? AND person_id=?',
      id,
      actor.id,
    )
  if (!original) throw notFound()
  const oldSheet = await load(db, actor, original.sheet_id, true)
  if (oldSheet.status !== 'approved' || original.source === 'adjustment')
    throw conflict('approved_original_required')
  const sheet = await load(db, actor, input.sheetId, true)
  editable(sheet, actor)
  await taskFor(db, actor, sheet, {
    taskId: original.task_id,
    projectId: original.project_id,
  })
  const seconds = duration(input.seconds, true),
    reason = text(input.reason, 5000, 'adjustment_reason'),
    key = text(input.key, 120, 'operation_key')
  const dup = await first<Entry>(
    db,
    'SELECT * FROM peg_time_entries WHERE person_id=? AND operation_key=?',
    actor.id,
    key,
  )
  if (dup) {
    if (
      dup.adjustment_of !== id ||
      dup.seconds !== seconds ||
      dup.notes !== reason ||
      dup.sheet_id !== sheet.id
    )
      throw conflict('operation_key_reused')
    return { id: dup.id }
  }
  const prior = (await first<{ n: number }>(
    db,
    'SELECT COALESCE(SUM(seconds),0) n FROM peg_time_entries WHERE adjustment_of=?',
    id,
  ))!.n
  if ((original.seconds ?? 0) + prior + seconds < 0)
    throw invalid('adjustment_below_zero')
  const entryId = newId('time'),
    date = text(input.date, 10, 'work_date')
  dayNumber(date)
  await write(
    db,
    actor,
    sheet,
    rev,
    'adjustment_added',
    [
      bound(
        db,
        "INSERT INTO peg_time_entries(id,sheet_id,person_id,task_id,project_id,work_date,seconds,source,notes,adjustment_of,operation_key,created_at,timezone) VALUES(?,?,?,?,?,?,?,'adjustment',?,?,?,?,?)",
        [
          entryId,
          sheet.id,
          actor.id,
          original.task_id,
          original.project_id,
          date,
          seconds,
          reason,
          id,
          key,
          now(),
          (await settings(db, actor)).timezone,
        ],
      ),
    ],
    { entryId, adjustmentOf: id, seconds, reason },
  )
  return { id: entryId }
}
export async function exportSheet(db: D1Database, actor: Actor, id: string) {
  const view = await sheetView(db, actor, id)
  if (view.sheet.status !== 'approved')
    throw conflict('approved_timesheet_required')
  if (view.entries.some((e) => !e.available))
    throw forbidden('current_task_access')
  const records = view.entries.map((e) => ({
    external_id: e.id,
    person_id: e.person_id,
    project_id: e.project_id,
    task_id: e.task_id,
    task_reference: e.ref,
    date: e.work_date,
    timezone: e.timezone,
    seconds: e.seconds,
    notes: e.notes,
    source: e.source,
    adjustment_of: e.adjustment_of,
  }))
  await batch(db, [
    auditStatement(db, {
      workspaceId: view.sheet.workspace_id,
      actorId: actor.id,
      action: 'time.csv_exported',
      targetType: 'timesheet',
      targetId: id,
      detail: {
        entryIds: records.map((r) => r.external_id),
        seconds: view.totalSeconds,
      },
    }),
  ])
  return { csv: toCsv(records), totalSeconds: view.totalSeconds }
}

export async function timeTaskOptions(
  db: D1Database,
  actor: Actor,
  workspaceId: string,
) {
  const out = []
  for (const row of await all<{ id: string }>(
    db,
    'SELECT id FROM peg_tasks WHERE workspace_id=? ORDER BY title,id',
    workspaceId,
  )) {
    const opened = await openTask(db, actor, row.id).catch(() => null)
    if (opened?.access.capabilities.has('edit'))
      out.push({ value: opened.task.id, label: opened.task.title })
  }
  return out
}
