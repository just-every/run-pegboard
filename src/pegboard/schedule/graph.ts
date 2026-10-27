// The schedule algorithm every door shares: dependency constraints in working days, shifts that keep durations, cycle
// detection, slack and the critical path. Pure: it reads dated nodes and edges and never touches permissions or storage.
import { addWorking, addWorkingTime, availableStamp, compareStamp, onOrAfter, readStamp, workingBetween, workingTimeBetween, withoutTimeOff, writeStamp, type Stamp, type WorkingCalendar } from './calendar'

export const dependencyTypes = ['fs', 'ss', 'ff', 'sf'] as const
export type DependencyType = typeof dependencyTypes[number]
export interface Node { id: string; start: string | null; due: string | null; done: boolean; calendar?: WorkingCalendar }
export interface Edge { id: string; predecessor: string; successor: string; type: DependencyType; lag: number }
export interface Dates { start: Stamp | null; due: Stamp | null }

const dates = (node: Node): Dates => {
  const start = node.start ?? node.due, due = node.due ?? node.start
  return { start: start ? readStamp(start, node.calendar?.zone) : null, due: due ? readStamp(due, node.calendar?.zone) : null }
}
const duration = (d: Dates, calendar?: WorkingCalendar) => d.start && d.due ? Math.max(0, workingBetween(onOrAfter(d.start.day, calendar), d.due.day, calendar)) : 0

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

/** A requested range keeps productive duration even when its new placement meets time off. */
function place(d: Dates, start: Stamp, calendar: WorkingCalendar): Dates {
  if (!d.start || !d.due) return d
  const base = withoutTimeOff(calendar)
  if (d.start.wallMs !== null && d.due.wallMs !== null) {
    // A same-day request expresses its intended length even when it starts before opening hours.
    const length = d.start.day === d.due.day ? Math.max(0, d.due.wallMs - d.start.wallMs) : workingTimeBetween(d.start, d.due, base)
    const from = availableStamp(start, calendar, length === 0)
    return { start: from, due: addWorkingTime(from, Math.max(0, length), calendar) }
  }
  const from = availableStamp(start, calendar), length = duration(d, base)
  const due = { day: addWorking(from.day, length, calendar), wallMs: d.due.wallMs }
  return { start: from, due: availableStamp(due, calendar, true) }
}
function finishAt(d: Dates, due: Stamp, calendar: WorkingCalendar): Dates {
  if (!d.start || !d.due) return d
  const to = availableStamp(due, calendar, true), base = withoutTimeOff(calendar)
  if (d.start.wallMs !== null && d.due.wallMs !== null) {
    const length = d.start.day === d.due.day ? Math.max(0, d.due.wallMs - d.start.wallMs) : workingTimeBetween(d.start, d.due, base)
    return { start: addWorkingTime(to, -Math.max(0, length), calendar), due: to }
  }
  return { start: availableStamp({ day: addWorking(to.day, -duration(d, base), calendar), wallMs: d.start.wallMs }, calendar), due: to }
}
const differs = (a: Dates, b: Dates) => a.start?.day !== b.start?.day || a.due?.day !== b.due?.day || a.start?.wallMs !== b.start?.wallMs || a.due?.wallMs !== b.due?.wallMs

export interface Shift { id: string; from: Dates; to: Dates; days: number; reason: { predecessor: string; type: DependencyType; lag: number } | null; completed: boolean; calendarAdjusted?: boolean }
/** Apply requested dates and push dependants only as far as needed, preserving their productive duration. */
export function propose(nodes: Node[], edges: Edge[], moves: Record<string, { start?: string | null; due?: string | null }>): { shifts: Shift[]; cyclic: string[] } {
  const byId = new Map(nodes.map(node => [node.id, node]))
  const current = new Map<string, Dates>(nodes.map(node => [node.id, dates(node)])), original = new Map(current)
  const reason = new Map<string, Shift['reason']>(), adjusted = new Set<string>()
  const affected = new Set(Object.keys(moves).length ? Object.keys(moves) : nodes.map(node=>node.id))
  let added = true
  while (added) { added = false; for (const edge of edges) if (affected.has(edge.predecessor) && !affected.has(edge.successor)) { affected.add(edge.successor); added = true } }
  for (const [id, move] of Object.entries(moves)) {
    const node = byId.get(id); if (!node) continue
    const wanted = dates({ ...node, start: move.start === undefined ? node.start : move.start, due: move.due === undefined ? node.due : move.due })
    const placed = node.calendar && wanted.start ? place(wanted, wanted.start, node.calendar) : wanted
    if (differs(wanted, placed)) adjusted.add(id)
    current.set(id, placed)
  }
  const { sorted, cyclic } = order(nodes.map(node => node.id), edges)
  for (const id of sorted) {
    if (moves[id] || !affected.has(id)) continue
    const node = byId.get(id)!, initial = current.get(id)!, calendar = node.calendar
    if (!initial.start || !initial.due) continue
    let here = calendar ? place(initial, initial.start, calendar) : initial, why: Shift['reason'] = null
    if (differs(initial, here)) adjusted.add(id)
    for (const edge of edges.filter(edge => edge.successor === id)) {
      const pred = current.get(edge.predecessor)
      if (!pred?.start || !pred.due) continue
      const finish = edge.type === 'ff' || edge.type === 'sf'
      const source = edge.type === 'fs' || edge.type === 'ff' ? pred.due : pred.start
      const limitDay = addWorking(source.day, edge.lag + (edge.type === 'fs' ? 1 : 0), calendar ? withoutTimeOff(calendar) : undefined)
      if (calendar) {
        const endpoint = finish ? here.due! : here.start!
        const limit = { day: limitDay, wallMs: endpoint.wallMs === null ? null : edge.type === 'fs' ? endpoint.wallMs : source.wallMs ?? endpoint.wallMs }
        const candidate = finish ? finishAt(initial, limit, calendar) : place(initial, limit, calendar)
        if (candidate.start && (compareStamp(candidate.start, here.start!) > 0 || (compareStamp(candidate.start, here.start!) === 0 && candidate.due && compareStamp(candidate.due, here.due!) > 0))) {
          const placedEndpoint = finish ? candidate.due! : candidate.start
          if (compareStamp(placedEndpoint, limit) > 0) adjusted.add(id)
          here = candidate; why = { predecessor: edge.predecessor, type: edge.type, lag: edge.lag } }
      } else {
        const endpoint = finish ? here.due! : here.start!
        if (endpoint.day < limitDay) {
          const shift = workingBetween(onOrAfter(endpoint.day), limitDay), start = addWorking(here.start!.day, shift)
          here = { start: { day: start, wallMs: here.start!.wallMs }, due: { day: addWorking(start, duration(initial)), wallMs: here.due!.wallMs } }
          why = { predecessor: edge.predecessor, type: edge.type, lag: edge.lag }
        }
      }
    }
    if (differs(initial, here)) {
      reason.set(id, why)
      if (!node.done) current.set(id, here)
    }
  }
  const shifts: Shift[] = []
  for (const node of nodes) {
    const from = original.get(node.id)!, to = current.get(node.id)!
    const move = moves[node.id], shapeChanged = !!move && ((move.start !== undefined && move.start !== node.start) || (move.due !== undefined && move.due !== node.due))
    if ((!move && !reason.has(node.id)) || (!shapeChanged && !differs(from, to) && !reason.has(node.id))) continue
    const completed = node.done && reason.has(node.id) && !moves[node.id]
    shifts.push({ id: node.id, from, to: completed ? from : to,
      days: from.start && to.start ? workingBetween(onOrAfter(from.start.day, node.calendar), to.start.day, node.calendar) : 0,
      reason: reason.get(node.id) ?? null, completed, calendarAdjusted: adjusted.has(node.id) })
  }
  return { shifts, cyclic }
}
export const stamp = (value: Stamp | null, zone?: string) => value ? writeStamp(value, zone) : null

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
  const lastOf = (id: string) => end ? readStamp(end, nodes.find(node => node.id === id)?.calendar?.zone).day : chainEnd.get(find(id))!
  const lf = new Map<string, number>(), ls = new Map<string, number>()
  for (const id of [...sorted].reverse()) {
    const own = d.get(id)!, calendar = nodes.find(node => node.id === id)?.calendar, length = duration(own, calendar)
    let limit = Infinity
    const outgoing = usable.filter(e => e.predecessor === id)
    if (!outgoing.length) limit = lastOf(id)
    for (const e of outgoing) {
      if (!lf.has(e.successor)) continue
      const sLF = lf.get(e.successor)!, sLS = ls.get(e.successor)!
      if (e.type === 'fs') limit = Math.min(limit, addWorking(sLS, -(e.lag + 1), calendar))
      else if (e.type === 'ff') limit = Math.min(limit, addWorking(sLF, -e.lag, calendar))
      else { const latestStart = addWorking(e.type === 'ss' ? sLS : sLF, -e.lag, calendar); limit = Math.min(limit, addWorking(latestStart, length, calendar)) }
    }
    if (!Number.isFinite(limit)) limit = lastOf(id)
    lf.set(id, limit); ls.set(id, addWorking(limit, -length, calendar))
  }
  const out = nodes.map(node => ({ id: node.id, slack: live.has(node.id) && lf.has(node.id) ? workingBetween(finish(node.id), lf.get(node.id)!, node.calendar) : null as number | null, critical: false }))
  // A chain's critical tasks are those with its least slack.
  const least = new Map<string, number>()
  for (const row of out) if (row.slack !== null && !nodes.find(n => n.id === row.id)!.done) { const r = find(row.id); least.set(r, Math.min(least.get(r) ?? Infinity, row.slack)) }
  for (const row of out) if (row.slack !== null && !nodes.find(n => n.id === row.id)!.done && usable.some(e => e.predecessor === row.id || e.successor === row.id)) row.critical = row.slack === least.get(find(row.id))
  return out
}
