// A project's schedule as one person may read it: tasks with slack and the critical path, their dependency links (cross-project
// ones included), the chosen baseline's variance, and the change sets they may undo or decide. Baselines are immutable snapshots.
import { all, batch, bound, invalid, newId, now } from '../db'
import { auditStatement } from '../authorization/audit'
import { readableTasks } from '../tasks/board'
import { openTask } from '../tasks/access'
import { currentRef } from '../references/refs'
import { need, openProject } from '../workspace/projects'
import { displayNames, type Actor } from '../workspace/people'
import { readStamp, workingBetween } from './calendar'
import { toEdge } from './dependencies'
import { slack as slackOf, type Edge } from './graph'
import { pendingSets } from './changes'
import type { TaskRow } from '../model'

export async function createBaseline(db: D1Database, actor: Actor, projectId: string, name: unknown) {
  const { project, effective } = await openProject(db, actor, projectId)
  need(effective, 'manage_settings')
  if (typeof name !== 'string' || !name.trim() || name.length > 80) throw invalid('name')
  const tasks = await readableTasks(db, actor, projectId), id = newId('base'), at = now()
  await batch(db, [bound(db, 'INSERT INTO peg_baselines(id,project_id,name,created_by,created_at) VALUES (?,?,?,?,?)', [id, projectId, name.trim(), actor.id, at]),
    ...tasks.map(task => bound(db, 'INSERT INTO peg_baseline_tasks(baseline_id,task_id,start_date,due_date) VALUES (?,?,?,?)', [id, task.id, task.start_date, task.due_date])),
    auditStatement(db, { workspaceId: project.workspace_id, actorId: actor.id, action: 'baseline.saved', targetType: 'project', targetId: projectId, subjectId: id, detail: { tasks: tasks.length } })])
  return { id, name: name.trim(), tasks: tasks.length, createdAt: at }
}

export async function scheduleView(db: D1Database, actor: Actor, projectId: string, options: { baselineId?: string } = {}) {
  const { project, effective } = await openProject(db, actor, projectId)
  const own = await readableTasks(db, actor, projectId), ids = new Set(own.map(t => t.id)), tasks = new Map<string, TaskRow>(own.map(t => [t.id, t]))
  const marks = [...ids].map(() => '?').join(',') || 'NULL'
  const rows = await all<Parameters<typeof toEdge>[0]>(db, `SELECT * FROM peg_dependencies WHERE predecessor_id IN (${marks}) OR successor_id IN (${marks})`, ...ids, ...ids)
  const edges: Edge[] = [], links = []
  for (const row of rows) {
    const other = ids.has(row.predecessor_id) ? row.successor_id : row.predecessor_id
    if (!tasks.has(other)) { const opened = await openTask(db, actor, other).catch(() => null); if (!opened) continue; tasks.set(other, opened.task) }
    edges.push(toEdge(row)); links.push(row)
  }
  const nodes = [...tasks.values()].map(t => ({ id: t.id, start: t.start_date, due: t.due_date, done: t.status === 'done' }))
  const slacks = new Map(slackOf(nodes, edges, project.due_date).map(s => [s.id, s]))
  const baselines = await all<{ id: string; name: string; created_by: string; created_at: number }>(db, 'SELECT * FROM peg_baselines WHERE project_id=? ORDER BY created_at DESC', projectId)
  const chosen = options.baselineId ? baselines.find(b => b.id === options.baselineId) : undefined
  if (options.baselineId && !chosen) throw invalid('baseline')
  const base = new Map((chosen ? await all<{ task_id: string; start_date: string | null; due_date: string | null }>(db, 'SELECT * FROM peg_baseline_tasks WHERE baseline_id=?', chosen.id) : []).map(r => [r.task_id, r]))
  const names = await displayNames(db, [...tasks.values()].map(t => t.owner_id).concat(baselines.map(b => b.created_by)))
  const view = await Promise.all([...tasks.values()].map(async task => {
    const s = slacks.get(task.id), b = base.get(task.id)
    const variance = b?.due_date && task.due_date ? workingBetween(readStamp(b.due_date).day, readStamp(task.due_date).day) : null
    return { id: task.id, ref: await currentRef(db, task.id), title: task.title, kind: task.kind, status: task.status, start: task.start_date, due: task.due_date, owner: names.get(task.owner_id) ?? 'Former member', inProject: ids.has(task.id), slack: s?.slack ?? null, critical: !!s?.critical,
      baseline: b ? { start: b.start_date, due: b.due_date, varianceDays: variance } : null, link: `/app/tasks/${task.id}` }
  }))
  view.sort((a, b) => (a.start ?? a.due ?? '9').localeCompare(b.start ?? b.due ?? '9') || a.title.localeCompare(b.title))
  const undoable = await all<{ id: string; decided_by: string; decided_at: number; n: number }>(db, `SELECT s.id,s.decided_by,s.decided_at,COUNT(*) n FROM peg_schedule_sets s JOIN peg_schedule_changes c ON c.set_id=s.id WHERE s.status='applied' AND s.id IN (SELECT set_id FROM peg_schedule_changes WHERE task_id IN (${marks})) GROUP BY s.id ORDER BY s.decided_at DESC LIMIT 10`, ...ids)
  const by = await displayNames(db, undoable.map(u => u.decided_by))
  return {
    project: { id: project.id, name: project.name, due: project.due_date, canEdit: effective.capabilities.has('edit'), canBaseline: effective.capabilities.has('manage_settings') },
    tasks: view,
    dependencies: links.map(r => ({ id: r.id, predecessor: r.predecessor_id, successor: r.successor_id, type: r.type, lag: r.lag_days, crossProject: !ids.has(r.predecessor_id) || !ids.has(r.successor_id) })),
    criticalPath: view.filter(t => t.critical && t.inProject).map(t => t.id),
    baselines: baselines.map(b => ({ id: b.id, name: b.name, by: names.get(b.created_by) ?? 'Former member', createdAt: b.created_at })), baseline: chosen ? { id: chosen.id, name: chosen.name } : null,
    recent: undoable.map(u => ({ id: u.id, by: by.get(u.decided_by) ?? 'Former member', at: u.decided_at, tasks: u.n, canUndo: u.decided_by === actor.id })),
    pending: (await pendingSets(db, actor, project.workspace_id)).filter(p => p.shifts.some(s => ids.has(s.id))),
  }
}
