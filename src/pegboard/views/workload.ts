import { all, now } from '../db'
import type { Placed } from '../tasks/board'
import { capacityPeople } from '../capacity/profiles'
import { range, rounded, spread, type Allocation } from '../capacity/workload'
import { taskCalendars } from '../schedule/availability'
import { availableIntervals, dayNumber } from '../schedule/calendar'
import { workspaceRole, type Actor } from '../workspace/people'

/** The native allocation and working-calendar algorithms, restricted to this filtered task set. */
export async function projectWorkload(db: D1Database, actor: Actor, workspace: string, tasks: Placed[], input: Record<string, any>) {
  const window = range(input), profiles = await capacityPeople(db, actor, workspace)
  const ids = new Set(tasks.map(task => task.id))
  const allocations = (await all<Allocation>(db, 'SELECT a.* FROM peg_effort_allocations a JOIN peg_tasks t ON t.id=a.task_id WHERE t.workspace_id=?', workspace)).filter(row => ids.has(row.task_id))
  const relevant = new Set([...tasks.map(task => task.owner_id), ...allocations.map(row => row.person_id)])
  const people = profiles.filter(profile => relevant.has(profile.id))
  const { calendars } = await taskCalendars(db, people.map(person => ({ id: person.id, owner_id: person.id, workspace_id: workspace })))
  const feeds = await all<{ active: number; fetched_at: number | null; mapping: string; issuer_id: string; from_date: string | null; through_date: string | null }>(db, 'SELECT active,fetched_at,mapping,issuer_id,from_date,through_date FROM peg_capacity_feeds WHERE workspace_id=?', workspace)
  const unknown = new Map<string, (typeof feeds)[number][]>()
  for (const feed of feeds) {
    const role = await workspaceRole(db, feed.issuer_id, workspace)
    if (!feed.active || !feed.fetched_at || now() - feed.fetched_at > 86400000 || !['owner', 'admin'].includes(role ?? '')) feed.fetched_at = null
    for (const id of Object.values(JSON.parse(feed.mapping)) as string[]) if (relevant.has(id)) unknown.set(id, [...unknown.get(id) ?? [], feed])
  }
  const active = tasks.filter(task => task.status !== 'done')
  const result = people.map(person => {
    const calendar = calendars.get(person.id)!, hours = window.dates.map(() => 0)
    let unscheduledHours = 0
    for (const task of active) {
      const explicit = allocations.filter(row => row.task_id === task.id)
      const effort = explicit.length ? explicit.filter(row => row.person_id === person.id).reduce((n, row) => n + row.hours, 0) : task.owner_id === person.id ? task.estimate_hours : 0
      if (!task.start_date && !task.due_date) { unscheduledHours += effort; continue }
      spread(task, effort, calendar, window.dates).forEach((load, index) => { hours[index] += load })
    }
    const days = window.dates.map((date, index) => {
      const availableHours = availableIntervals(dayNumber(date), calendar).reduce((n, [a, b]) => n + b - a, 0) / 3600000
      return { date, hours: rounded(hours[index]), availableHours: rounded(availableHours), overloadHours: rounded(Math.max(0, hours[index] - availableHours)),
        unknown: (unknown.get(person.id) ?? []).some(feed => !feed.fetched_at || !feed.from_date || !feed.through_date || date < feed.from_date || date > feed.through_date) }
    })
    return { id: person.id, name: person.name, zone: person.zone, days, hours: rounded(hours.reduce((a, b) => a + b, 0)), unscheduledHours: rounded(unscheduledHours) }
  })
  return { ...window, people: result, taskIds: tasks.map(task => task.id), completedTaskCount: tasks.length - active.length,
    totals: { taskCount: tasks.length, activeTaskCount: active.length, taskEstimateHours: rounded(tasks.reduce((n, task) => n + task.estimate_hours, 0)),
      participantHours: rounded(active.reduce((n, task) => { const explicit = allocations.filter(row => row.task_id === task.id); return n + (explicit.length ? explicit.reduce((n, row) => n + row.hours, 0) : task.estimate_hours) }, 0)) },
    notice: 'Load includes only the selected permitted open work. Completed work stays in the shared task rows. Other workspace commitments and tentative plans are outside this view.' }
}
