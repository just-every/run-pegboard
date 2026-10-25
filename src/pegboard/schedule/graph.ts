// The schedule algorithm every door shares: dependency constraints in working days, shifts that keep durations, cycle
// detection, slack and the critical path. Pure: it reads dated nodes and edges and never touches permissions or storage.
import { addWorking, onOrAfter, readStamp, workingBetween, writeStamp, type Stamp } from './calendar'

export const dependencyTypes = ['fs', 'ss', 'ff', 'sf'] as const
export type DependencyType = typeof dependencyTypes[number]
export interface Node { id: string; start: string | null; due: string | null; done: boolean }
export interface Edge { id: string; predecessor: string; successor: string; type: DependencyType; lag: number }
export interface Dates { start: Stamp | null; due: Stamp | null }

const dates = (node: Node): Dates => {
  const start = node.start ?? node.due, due = node.due ?? node.start
  return { start: start ? readStamp(start) : null, due: due ? readStamp(due) : null }
}
const duration = (d: Dates) => d.start && d.due ? Math.max(0, workingBetween(onOrAfter(d.start.day), d.due.day)) : 0

/** The edges in a cycle through `edge` if it were added, as task ids from the successor back to the predecessor; null when it is safe. */
export function cycleThrough(edges: Edge[], edge: Pick<Edge, 'predecessor' | 'successor'>): string[] | null {
  const next = new Map<string, string[]>()
  for (const e of edges) next.set(e.predecessor, [...(next.get(e.predecessor) ?? []), e.successor])
  const path: string[] = [], seen = new Set<string>()
  const walk = (id: string): boolean => {
    path.push(id)
    if (id === edge.predecessor) return true
    if (!seen.has(id)) { seen.add(id); for (const n of next.get(id) ?? []) if (walk(n)) return true }
    path.pop(); return false
  }
  return walk(edge.successor) ? [...path, edge.successor] : null
}

/** Topological order of the nodes that edges touch, or the ids left over in a cycle. */
export function order(ids: string[], edges: Edge[]): { sorted: string[]; cyclic: string[] } {
  const indegree = new Map(ids.map(id => [id, 0])), next = new Map<string, string[]>()
  for (const e of edges) { if (!indegree.has(e.predecessor) || !indegree.has(e.successor)) continue; indegree.set(e.successor, indegree.get(e.successor)! + 1); next.set(e.predecessor, [...(next.get(e.predecessor) ?? []), e.successor]) }
  const queue = ids.filter(id => indegree.get(id) === 0), sorted: string[] = []
  while (queue.length) { const id = queue.shift()!; sorted.push(id); for (const n of next.get(id) ?? []) { indegree.set(n, indegree.get(n)! - 1); if (indegree.get(n) === 0) queue.push(n) } }
  return { sorted, cyclic: ids.filter(id => !sorted.includes(id)) }
}

/** The earliest start (and finish) a constraint allows the successor, in day numbers. */
function bound(e: Edge, pred: Dates, succ: Dates): { start?: number; due?: number } {
  if (!pred.start || !pred.due) return {}
  if (e.type === 'fs') return { start: addWorking(pred.due.day, e.lag + 1) }
  if (e.type === 'ss') return { start: addWorking(pred.start.day, e.lag) }
  if (e.type === 'ff') return { due: addWorking(pred.due.day, e.lag) }
  void succ
  return { due: addWorking(pred.start.day, e.lag) }
}

export interface Shift { id: string; from: Dates; to: Dates; days: number; reason: { predecessor: string; type: DependencyType; lag: number } | null; completed: boolean }
/**
 * Apply proposed new dates to some tasks and push every dependant later only as far as its constraints require,
 * keeping each task's length in working days. A completed dependant is reported and never moved.
 */
export function propose(nodes: Node[], edges: Edge[], moves: Record<string, { start?: string | null; due?: string | null }>): { shifts: Shift[]; cyclic: string[] } {
  const byId = new Map(nodes.map(node => [node.id, node]))
  const current = new Map<string, Dates>(nodes.map(node => [node.id, dates(node)]))
  const original = new Map(current)
  const reason = new Map<string, Shift['reason']>()
  for (const [id, move] of Object.entries(moves)) {
    const node = byId.get(id); if (!node) continue
    current.set(id, dates({ ...node, start: move.start === undefined ? node.start : move.start, due: move.due === undefined ? node.due : move.due }))
  }
  const { sorted, cyclic } = order(nodes.map(node => node.id), edges)
  for (const id of sorted) {
    if (moves[id]) continue
    const node = byId.get(id)!, here = current.get(id)!
    if (!here.start || !here.due) continue
    let shift = 0, why: Shift['reason'] = null
    const length = duration(here)
    for (const e of edges) {
      if (e.successor !== id) continue
      const limit = bound(e, current.get(e.predecessor)!, here)
      let need = 0
      if (limit.start !== undefined && here.start.day < limit.start) need = workingBetween(onOrAfter(here.start.day), limit.start)
      if (limit.due !== undefined && here.due.day < limit.due) need = Math.max(need, workingBetween(here.due.day, limit.due))
      if (need > shift) { shift = need; why = { predecessor: e.predecessor, type: e.type, lag: e.lag } }
    }
    if (shift > 0 && !node.done) {
      const start = addWorking(here.start.day, shift), due = addWorking(start, length)
      current.set(id, { start: { day: start, wallMs: here.start.wallMs }, due: { day: due, wallMs: here.due.wallMs } })
      reason.set(id, why)
    } else if (shift > 0) reason.set(id, why)
  }
  const shifts: Shift[] = []
  for (const node of nodes) {
    const from = original.get(node.id)!, to = current.get(node.id)!
    const moved = !!moves[node.id] || reason.has(node.id)
    if (!moved || !from.start || !to.start) continue
    const changed = from.start.day !== to.start.day || from.due?.day !== to.due?.day || from.start.wallMs !== to.start.wallMs || from.due?.wallMs !== to.due?.wallMs
    if (!changed && !reason.has(node.id)) continue
    const completed = node.done && reason.has(node.id) && !moves[node.id]
    shifts.push({ id: node.id, from, to: completed ? from : to, days: workingBetween(onOrAfter(from.start.day), to.start.day), reason: reason.get(node.id) ?? null, completed })
  }
  return { shifts, cyclic }
}
export const stamp = (value: Stamp | null) => value ? writeStamp(value) : null

export interface Slack { id: string; slack: number | null; critical: boolean }
/**
 * Total slack in working days: how far a task's finish may slip before it forces a successor, or the project's end, to
 * move. Negative slack means a dependency is already broken. The critical path is the tasks with the least slack in a
 * connected chain; undated tasks have none.
 */
export function slack(nodes: Node[], edges: Edge[], end: string | null): Slack[] {
  const d = new Map(nodes.map(node => [node.id, dates(node)])), live = new Set(nodes.filter(node => { const x = d.get(node.id)!; return x.start && x.due }).map(node => node.id))
  const usable = edges.filter(e => live.has(e.predecessor) && live.has(e.successor))
  const { sorted } = order([...live], usable)
  const finish = (id: string) => d.get(id)!.due!.day
  // A chain ends at the project's due date, or with no date at the latest finish within the chain itself.
  const parent = new Map<string, string>(), find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; return r }
  for (const id of live) parent.set(id, id)
  for (const e of usable) parent.set(find(e.predecessor), find(e.successor))
  const chainEnd = new Map<string, number>()
  for (const id of live) chainEnd.set(find(id), Math.max(chainEnd.get(find(id)) ?? 0, finish(id)))
  const lastOf = (id: string) => end ? readStamp(end).day : chainEnd.get(find(id))!
  const lf = new Map<string, number>(), ls = new Map<string, number>()
  for (const id of [...sorted].reverse()) {
    const own = d.get(id)!, length = duration(own)
    let limit = Infinity
    const outgoing = usable.filter(e => e.predecessor === id)
    if (!outgoing.length) limit = lastOf(id)
    for (const e of outgoing) {
      if (!lf.has(e.successor)) continue
      const sLF = lf.get(e.successor)!, sLS = ls.get(e.successor)!
      if (e.type === 'fs') limit = Math.min(limit, addWorking(sLS, -(e.lag + 1)))
      else if (e.type === 'ff') limit = Math.min(limit, addWorking(sLF, -e.lag))
      else { const latestStart = addWorking(e.type === 'ss' ? sLS : sLF, -e.lag); limit = Math.min(limit, addWorking(latestStart, length)) }
    }
    if (!Number.isFinite(limit)) limit = lastOf(id)
    lf.set(id, limit); ls.set(id, addWorking(limit, -length))
  }
  const out = nodes.map(node => ({ id: node.id, slack: live.has(node.id) && lf.has(node.id) ? workingBetween(finish(node.id), lf.get(node.id)!) : null as number | null, critical: false }))
  // A chain's critical tasks are those with its least slack.
  const least = new Map<string, number>()
  for (const row of out) if (row.slack !== null && !nodes.find(n => n.id === row.id)!.done) { const r = find(row.id); least.set(r, Math.min(least.get(r) ?? Infinity, row.slack)) }
  for (const row of out) if (row.slack !== null && !nodes.find(n => n.id === row.id)!.done && usable.some(e => e.predecessor === row.id || e.successor === row.id)) row.critical = row.slack === least.get(find(row.id))
  return out
}
