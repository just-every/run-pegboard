import {guarded, type Revision} from '../decisions/revision'
// Private layout and explicit, revision-bound visibility decisions.
import {
  all,
  batch,
  bound,
  conflict,
  first,
  invalid,
  newId,
  notFound,
  now,
} from '../db'
import type { Actor } from '../workspace/people'
import { workspaceRole, displayNames } from '../workspace/people'
import { openTask } from './access'
import { historyStatement } from './history'
import { openProject, need } from '../workspace/projects'
import { projectEffective } from '../authorization/effective'
import { auditStatement, bumpEpoch } from '../authorization/audit'
import type { TaskRow } from '../model'

export const groups = ['Overdue', 'Today', 'Upcoming', 'Later'] as const
export type Group = (typeof groups)[number]
export const localDay = (at: number, timezone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at))
export function dayNumber(day: string) {
  const at = Date.parse(day + 'T00:00:00Z')
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(at) ||
    new Date(at).toISOString().slice(0, 10) !== day
  )
    throw invalid('day')
  return at / 86400000
}

export function taskGroup(
  due: string | null,
  today: boolean,
  day: string,
  timezone: string,
): Group {
  const dueDay = due
    ? due.length === 10
      ? due
      : localDay(Date.parse(due), timezone)
    : null
  if (dueDay && dueDay < day) return 'Overdue'
  if (dueDay === day || today) return 'Today'
  if (dueDay && dayNumber(dueDay) - dayNumber(day) <= 7) return 'Upcoming'
  return 'Later'
}
// Resolve a local day's end from the timezone itself, including 23/25-hour DST days.
export function dueOrder(due: string | null, timezone: string): number {
  if (!due) return Infinity
  if (due.length !== 10) return Date.parse(due)
  const target = dayNumber(due),
    noon = Date.parse(due + 'T12:00:00Z')
  let low = noon - 36 * 3600000,
    high = noon + 36 * 3600000
  while (high - low > 1) {
    const mid = Math.floor((high + low) / 2)
    if (dayNumber(localDay(mid, timezone)) <= target) low = mid
    else high = mid
  }
  return high - 1
}
export async function settings(db: D1Database, actor: Actor) {
  return (
    (await first<{ timezone: string; sort: 'default' | 'manual' }>(
      db,
      'SELECT timezone,sort FROM peg_personal_settings WHERE operator_id=?',
      actor.id,
    )) ?? { timezone: 'America/New_York', sort: 'default' as const }
  )
}
export async function saveSettings(
  db: D1Database,
  actor: Actor,
  input: { timezone?: string; sort?: string },
) {
  const old = await settings(db, actor),
    timezone = input.timezone ?? old.timezone,
    sort = input.sort ?? old.sort
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format()
  } catch {
    throw invalid('timezone')
  }
  if (!['default', 'manual'].includes(sort)) throw invalid('sort')
  await batch(db, [
    bound(
      db,
      'INSERT INTO peg_personal_settings(operator_id,timezone,sort) VALUES(?,?,?) ON CONFLICT(operator_id) DO UPDATE SET timezone=excluded.timezone,sort=excluded.sort',
      [actor.id, timezone, sort],
    ),
  ])
}
export const sections = (db: D1Database, actor: Actor) =>
  all<{ id: string; name: string; position: number }>(
    db,
    'SELECT id,name,position FROM peg_personal_sections WHERE operator_id=? ORDER BY position,id',
    actor.id,
  )
const position = (value: unknown) => {
  const n = Number(value)
  if (!Number.isFinite(n) || Math.abs(n) > 1e9) throw invalid('rank')
  return n
}
export async function section(
  db: D1Database,
  actor: Actor,
  input: { id?: string; name: string; position?: number },
  fence?: Revision,
) {
  if (
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 80
  )
    throw invalid('section')
  if (
    input.id &&
    !(await first(
      db,
      'SELECT 1 FROM peg_personal_sections WHERE id=? AND operator_id=?',
      input.id,
      actor.id,
    ))
  )
    throw notFound()
  const id = input.id ?? newId('psec')
  const statements = [
    bound(
      db,
      'INSERT INTO peg_personal_sections(id,operator_id,name,position) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,position=excluded.position',
      [
        id,
        actor.id,
        input.name.trim(),
        position(input.position ?? (await sections(db, actor)).length),
      ],
    ),
  ]
  if (fence) await guarded(db, fence, statements)
  else await batch(db, statements)
  return { id }
}
export async function place(
  db: D1Database,
  actor: Actor,
  id: string,
  input: { sectionId?: string | null; position?: number; today?: boolean },
  fence?: Revision,
) {
  const { task } = await openTask(db, actor, id)
  if (task.owner_id !== actor.id) throw notFound()
  if (
    input.sectionId &&
    !(await first(
      db,
      'SELECT 1 FROM peg_personal_sections WHERE id=? AND operator_id=?',
      input.sectionId,
      actor.id,
    ))
  )
    throw notFound()
  const old = await first<{
    section_id: string | null
    position: number
    today: number
  }>(
    db,
    'SELECT * FROM peg_personal_layout WHERE operator_id=? AND task_id=?',
    actor.id,
    task.id,
  )
  const statements = [
    bound(
      db,
      'INSERT INTO peg_personal_layout(operator_id,task_id,section_id,position,today) VALUES(?,?,?,?,?) ON CONFLICT(operator_id,task_id) DO UPDATE SET section_id=excluded.section_id,position=excluded.position,today=excluded.today',
      [
        actor.id,
        task.id,
        input.sectionId === undefined
          ? (old?.section_id ?? null)
          : input.sectionId || null,
        position(input.position ?? old?.position ?? 0),
        input.today === undefined ? (old?.today ?? 0) : input.today ? 1 : 0,
      ],
    ),
  ]
  if (fence) await guarded(db, fence, statements)
  else await batch(db, statements)
}
export async function addRule(
  db: D1Database,
  actor: Actor,
  input: { group: string; sectionId: string },
) {
  if (
    !groups.includes(input.group as Group) ||
    !(await first(
      db,
      'SELECT 1 FROM peg_personal_sections WHERE id=? AND operator_id=?',
      input.sectionId,
      actor.id,
    ))
  )
    throw invalid('rule')
  const id = newId('rule')
  await batch(db, [
    bound(db, 'INSERT INTO peg_personal_rules VALUES(?,?,?,?)', [
      id,
      actor.id,
      input.group,
      input.sectionId,
    ]),
  ])
  return { id }
}
export async function undoMove(db: D1Database, actor: Actor, id: string) {
  const move = await first<{
    task_id: string
    before_section: string | null
    after_section: string
    before_position: number
    undone: number
  }>(
    db,
    'SELECT * FROM peg_personal_moves WHERE id=? AND operator_id=?',
    id,
    actor.id,
  )
  if (!move || move.undone) throw conflict('move_unavailable')
  const current = await first<{ section_id: string }>(
    db,
    'SELECT section_id FROM peg_personal_layout WHERE operator_id=? AND task_id=?',
    actor.id,
    move.task_id,
  )
  if (current?.section_id !== move.after_section)
    throw conflict('later_layout_change')
  await openTask(db, actor, move.task_id)
  await batch(db, [
    bound(
      db,
      'UPDATE peg_personal_layout SET section_id=?,position=? WHERE operator_id=? AND task_id=?',
      [move.before_section, move.before_position, actor.id, move.task_id],
    ),
    bound(db, 'UPDATE peg_personal_moves SET undone=1 WHERE id=?', [id]),
  ])
}
export async function personalMeta(db: D1Database, actor: Actor) {
  return {
    settings: await settings(db, actor),
    sections: await sections(db, actor),
    rules: await all<{ id: string; group_name: string; section_id: string }>(
      db,
      'SELECT * FROM peg_personal_rules WHERE operator_id=? ORDER BY id',
      actor.id,
    ),
    moves: await all<{
      id: string
      task_id: string
      local_day: string
      undone: number
    }>(
      db,
      'SELECT * FROM peg_personal_moves WHERE operator_id=? ORDER BY rowid DESC LIMIT 30',
      actor.id,
    ),
  }
}
export async function applyRules(
  db: D1Database,
  actor: Actor,
  task: TaskRow,
  group: Group,
  day: string,
) {
  for (const rule of await all<{ id: string; section_id: string }>(
    db,
    'SELECT * FROM peg_personal_rules WHERE operator_id=? AND group_name=? ORDER BY rowid',
    actor.id,
    group,
  )) {
    if (
      await first(
        db,
        'SELECT 1 FROM peg_personal_moves WHERE operator_id=? AND task_id=? AND rule_id=? AND local_day=?',
        actor.id,
        task.id,
        rule.id,
        day,
      )
    )
      continue
    const old = await first<{ section_id: string | null; position: number }>(
      db,
      'SELECT * FROM peg_personal_layout WHERE operator_id=? AND task_id=?',
      actor.id,
      task.id,
    )
    const id = newId('pmove')
    await batch(db, [
      bound(
        db,
        'INSERT OR IGNORE INTO peg_personal_moves(id,operator_id,task_id,rule_id,local_day,before_section,after_section,before_position) VALUES(?,?,?,?,?,?,?,?)',
        [
          id,
          actor.id,
          task.id,
          rule.id,
          day,
          old?.section_id ?? null,
          rule.section_id,
          old?.position ?? 0,
        ],
      ),
      bound(
        db,
        'INSERT INTO peg_personal_layout(operator_id,task_id,section_id,position) SELECT ?,?,?,0 WHERE EXISTS(SELECT 1 FROM peg_personal_moves WHERE id=?) ON CONFLICT(operator_id,task_id) DO UPDATE SET section_id=excluded.section_id',
        [actor.id, task.id, rule.section_id, id],
      ),
    ])
  }
}
const digest = async (value: unknown) =>
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
export async function visibilityPreview(
  db: D1Database,
  actor: Actor,
  id: string,
  projectId: string,
) {
  const revision = (await first<{ value: number }>(
    db,
    'SELECT value FROM peg_personal_revision WHERE id=1',
  ))!.value
  const { task, access } = await openTask(db, actor, id)
  if (!access.personal || task.owner_id !== actor.id || task.parent_id)
    throw conflict('personal_root_required')
  const { project, effective } = await openProject(db, actor, projectId)
  need(effective, 'edit')
  if (project.workspace_id !== task.workspace_id) throw invalid('project')
  const audience = []
  for (const person of await all<{ id: string }>(
    db,
    "SELECT id FROM oa_operators WHERE status='active' ORDER BY id",
  )) {
    const role = await workspaceRole(db, person.id, task.workspace_id)
    if (!role) continue
    const standing = await projectEffective(
      db,
      { ...actor, id: person.id },
      project,
    )
    if (
      standing.capabilities.has('read') &&
      !(role === 'guest' && task.internal_only)
    )
      audience.push({ id: person.id, level: standing.level })
  }
  const names = await displayNames(
    db,
    audience.map((x) => x.id),
  )
  const content = await all<{ id: string; title: string }>(
    db,
    'WITH RECURSIVE tree(id) AS(SELECT ? UNION ALL SELECT t.id FROM peg_tasks t JOIN tree ON t.parent_id=tree.id) SELECT t.id,t.title FROM peg_tasks t JOIN tree ON t.id=tree.id',
    task.id,
  )
  // Every child must belong to the same owner; no implicit sharing of another person's personal work.
  if (
    await first(
      db,
      'WITH RECURSIVE tree(id) AS(SELECT ? UNION ALL SELECT t.id FROM peg_tasks t JOIN tree ON t.parent_id=tree.id) SELECT 1 FROM peg_tasks t JOIN tree ON t.id=tree.id WHERE t.owner_id<>?',
      task.id,
      actor.id,
    )
  )
    throw conflict('child_owner')
  const token = await digest([actor.id, id, projectId, revision])
  return {
    revision,
    token,
    projectId,
    project: project.name,
    audience: audience.map((x) => ({
      ...x,
      name: names.get(x.id) ?? 'Member',
    })),
    content,
    notice:
      'Task details, conversation and subtask history become readable in this project. Personal files remain private to you. Internal notes remain hidden from guests.',
  }
}
export async function sharePersonal(
  db: D1Database,
  actor: Actor,
  id: string,
  input: { projectId: string; previewRevision?: string },
) {
  const preview = await visibilityPreview(db, actor, id, input.projectId)
  if (input.previewRevision !== preview.token)
    throw conflict('visibility_preview_required')
  try {
    await batch(db, [
      bound(db, 'INSERT INTO peg_personal_guards VALUES(?,?)', [
        newId('guard'),
        preview.revision,
      ]),
      bound(
        db,
        'INSERT INTO peg_task_projects(task_id,project_id,position,added_by,added_at) VALUES(?,?,0,?,?)',
        [id, input.projectId, actor.id, now()],
      ),
      historyStatement(db, id, input.projectId, actor.id, 'personal.shared', {
        project: preview.project,
        audience: preview.audience,
      }),
      auditStatement(db, {
        workspaceId: (await openTask(db, actor, id)).task.workspace_id,
        actorId: actor.id,
        action: 'personal.shared',
        targetType: 'task',
        targetId: id,
        detail: { projectId: input.projectId, audience: preview.audience },
      }),
      bumpEpoch(db),
    ])
  } catch (error) {
    if (String(error).includes('stale_personal_preview'))
      throw conflict('visibility_preview_required')
    throw error
  }
  return { id }
}
