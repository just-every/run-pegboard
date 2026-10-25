// The knock-on preview: the exact set of date moves a proposed edit causes, computed by the one schedule algorithm for
// every door. What a person is shown is limited to tasks they may read; the revision covers everything affected, so work
// they cannot see still makes a plan stale without being disclosed.
import { all, conflict, invalid } from '../db'
import { digest } from '../decisions/revision'
import { taskAccess } from '../authorization/effective'
import { currentRef } from '../references/refs'
import { openTask } from '../tasks/access'
import type { TaskRow } from '../model'
import type { Actor } from '../workspace/people'
import { dstChange, holidaysBetween } from './calendar'
import { toEdge } from './dependencies'
import { propose, stamp, type Node } from './graph'

export interface Move { taskId: string; start?: string | null; due?: string | null }
const dateValue = (value: unknown, code: string): string | null | undefined => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z)?$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value.length === 10 ? value + 'T00:00:00Z' : value).toISOString().slice(0, 10) !== value.slice(0, 10)) throw invalid(code)
  return value
}
export function moveInput(input: unknown): Move[] {
  if (!Array.isArray(input) || !input.length || input.length > 50) throw invalid('moves')
  const seen = new Set<string>()
  return input.map(raw => {
    if (!raw || typeof raw.taskId !== 'string' || seen.has(raw.taskId)) throw invalid('moves')
    seen.add(raw.taskId)
    const move: Move = { taskId: raw.taskId }, start = dateValue(raw.start, 'start_date'), due = dateValue(raw.due, 'due_date')
    if (start !== undefined) move.start = start
    if (due !== undefined) move.due = due
    if (move.start === undefined && move.due === undefined) throw invalid('moves')
    return move
  })
}
const marks = (ids: string[]) => ids.map(() => '?').join(',')

export interface PlanShift { id: string; ref: string | null; title: string; moved: boolean; completed: boolean; from: { start: string | null; due: string | null }; to: { start: string | null; due: string | null }; days: number; reason: { predecessor: string; predecessorTitle: string | null; type: string; lag: number } | null; crossed: { date: string; name: string }[]; dst: boolean; link: string }
export interface Plan {
  moves: Move[]; shifts: PlanShift[]; stamp: string
  /** Every moved task is one the person may edit. */
  editable: boolean
  /** Affected work the person cannot read or edit exists: the set needs its authorized approver and is never partly applied. */
  waits: boolean
  /** A completed dependant would have to move: an impossible constraint, never applied. */
  blocked: 'impossible_constraint' | null
  all: { id: string; start: string | null; due: string | null; to: { start: string | null; due: string | null } }[]
}
export async function planChange(db: D1Database, actor: Actor, moves: Move[]): Promise<Plan> {
  const rows = new Map<string, TaskRow>(), editableMoves: boolean[] = []
  for (const move of moves) {
    const opened = await openTask(db, actor, move.taskId)
    if (opened.access.personal) throw invalid('personal_task')
    rows.set(opened.task.id, opened.task); editableMoves.push(opened.access.capabilities.has('edit'))
    const next = { start: move.start === undefined ? opened.task.start_date : move.start, due: move.due === undefined ? opened.task.due_date : move.due }
    if (next.start && next.due && Date.parse(next.start.length === 10 ? next.start + 'T00:00:00Z' : next.start) > Date.parse(next.due.length === 10 ? next.due + 'T23:59:59Z' : next.due)) throw invalid('dates_order')
  }
  // Every dependant, however far and whether or not the person can see it, then the other predecessors that bound them.
  const closure = new Set(rows.keys()); let frontier = [...closure]
  while (frontier.length) {
    const next = await all<{ successor_id: string }>(db, `SELECT successor_id FROM peg_dependencies WHERE predecessor_id IN (${marks(frontier)})`, ...frontier)
    frontier = next.map(row => row.successor_id).filter(id => !closure.has(id)); for (const id of frontier) closure.add(id)
  }
  const edgeRows = await all<Parameters<typeof toEdge>[0]>(db, `SELECT * FROM peg_dependencies WHERE successor_id IN (${marks([...closure])})`, ...closure)
  const everyone = new Set([...closure, ...edgeRows.map(row => row.predecessor_id)])
  const tasks = new Map<string, TaskRow>()
  for (const row of await all<TaskRow>(db, `SELECT * FROM peg_tasks WHERE id IN (${marks([...everyone])})`, ...everyone)) tasks.set(row.id, row)
  const nodes: Node[] = [...tasks.values()].map(t => ({ id: t.id, start: t.start_date, due: t.due_date, done: t.status === 'done' }))
  const edges = edgeRows.map(toEdge)
  const moveMap = Object.fromEntries(moves.map(m => [m.taskId, { ...(m.start !== undefined ? { start: m.start } : {}), ...(m.due !== undefined ? { due: m.due } : {}) }]))
  const { shifts: raw, cyclic } = propose(nodes, edges, moveMap)
  if (cyclic.length) throw conflict('dependency_cycle')
  let waits = false, blocked: Plan['blocked'] = null
  const shifts: PlanShift[] = [], all2: Plan['all'] = []
  for (const shift of raw) {
    const task = tasks.get(shift.id)!, access = await taskAccess(db, actor, task)
    const to = { start: task.start_date === null ? null : stamp(shift.to.start), due: task.due_date === null ? null : stamp(shift.to.due) }
    const from = { start: task.start_date, due: task.due_date }
    if (shift.completed) blocked = 'impossible_constraint'
    const moved = !!moveMap[shift.id]
    if (!shift.completed) all2.push({ id: shift.id, start: from.start, due: from.due, to })
    if (!access.capabilities.has('read') || (!moved && !access.capabilities.has('edit') && !shift.completed)) { waits = true; if (!access.capabilities.has('read')) continue }
    const pre = shift.reason ? tasks.get(shift.reason.predecessor) : null, preReadable = pre ? (await taskAccess(db, actor, pre)).capabilities.has('read') : false
    shifts.push({ id: task.id, ref: await currentRef(db, task.id), title: task.title, moved, completed: shift.completed, from, to, days: shift.days,
      reason: shift.reason ? { predecessor: shift.reason.predecessor, predecessorTitle: preReadable ? pre!.title : null, type: shift.reason.type, lag: shift.reason.lag } : null,
      crossed: shift.from.start && shift.to.start ? holidaysBetween(shift.from.start.day, shift.to.start.day) : [],
      dst: !!(shift.from.start && shift.to.start && dstChange(shift.from.start, shift.to.start)) || !!(shift.from.due && shift.to.due && dstChange(shift.from.due, shift.to.due)), link: `/app/tasks/${task.id}` })
  }
  const fingerprint = await digest([moves, [...tasks.values()].sort((a, b) => a.id.localeCompare(b.id)).map(t => [t.id, t.start_date, t.due_date, t.status, t.updated_at]), edges.map(e => [e.id, e.type, e.lag])])
  return { moves, shifts, stamp: fingerprint.slice(0, 24), editable: editableMoves.every(Boolean), waits, blocked, all: all2 }
}
