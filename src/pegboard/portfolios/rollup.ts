import {recordCitations} from '../register/citations'
import {registerView} from '../register/records'
// A portfolio read as one person may read it. Every figure is computed from the projects and tasks that person can already
// open, so totals never include hidden work and a hidden project leaves no name, count or gap. A task hung in several
// projects is counted once in every total above them.
import { all, first, invalid } from '../db'
import { projectEffective } from '../authorization/effective'
import { loadProject } from '../authorization/grants'
import { fieldReadable } from '../workspace/projects'
import { definitions } from '../fields/definitions'
import { readableTasks, type Placed } from '../tasks/board'
import { currentRef } from '../references/refs'
import { edgesAmong } from '../schedule/dependencies'
import { slack as slackOf, type Edge } from '../schedule/graph'
import { displayNames, type Actor } from '../workspace/people'
import type { ProjectRow } from '../model'
import { currentPolicy, filtersOf, loadPortfolio, openPortfolio, policyHistory, portfolioLevel, type Filter, type PortfolioRow } from './portfolios'
import { evaluate, isOverdue, type Evidence, type Flag, type Policy } from './risk'

const subtree = async (db: D1Database, root: PortfolioRow) => {
  const out = [root], queue = [root]
  while (queue.length) for (const child of await all<PortfolioRow>(db, 'SELECT * FROM peg_portfolios WHERE parent_id=? ORDER BY name', queue.shift()!.id)) { out.push(child); queue.push(child) }
  return out
}
const latestStatus = (db: D1Database, type: string, id: string, at: number) =>
  first<{ id: string; health: string; summary: string; author_id: string; published_at: number }>(db, 'SELECT id,health,summary,author_id,published_at FROM peg_status_updates WHERE subject_type=? AND subject_id=? AND published_at<=? ORDER BY published_at DESC LIMIT 1', type, id, at)

interface TaskInfo { id: string; ref: string | null; title: string; kind: string; status: string; start: string | null; due: string | null; owner: string; ownerId: string; estimate: number; overdue: boolean; projects: string[] }
const taskLink = (id: string) => `/app/tasks/${id}`
const taskRow = (t: TaskInfo, name: (projectId: string) => string) => ({ id: t.id, ref: t.ref, title: t.title, kind: t.kind, status: t.status, start: t.start, due: t.due, owner: t.owner, overdue: t.overdue, link: taskLink(t.id), projects: t.projects.map(projectId => ({ id: projectId, name: name(projectId) })) })

/** `at` evaluates the portfolio as of an instant: statuses published later do not count, and overdue is judged at that time. */
export async function portfolioRollup(db: D1Database, actor: Actor, id: string, options: { at?: number; filterId?: string } = {}) {
  const { portfolio, level } = await openPortfolio(db, actor, id)
  const evaluatedAt = options.at ?? Date.now()
  if (!Number.isFinite(evaluatedAt) || evaluatedAt < 0 || evaluatedAt > Date.now() + 366 * 86400000) throw invalid('at')
  const portfolios = await subtree(db, portfolio), policyVersion = await currentPolicy(db, portfolio.id)
  const policy: Policy = policyVersion.policy

  // The projects under it that this person can read, each with the tasks they can read; hidden ones leave no trace.
  const projectPortfolios = new Map<string, Set<string>>()
  for (const p of portfolios) for (const row of await all<{ project_id: string }>(db, 'SELECT project_id FROM peg_portfolio_projects WHERE portfolio_id=?', p.id)) projectPortfolios.set(row.project_id, (projectPortfolios.get(row.project_id) ?? new Set()).add(p.id))
  const projects = new Map<string, { row: ProjectRow; tasks: Placed[]; effective: Awaited<ReturnType<typeof projectEffective>> }>()
  for (const projectId of projectPortfolios.keys()) {
    const row = await loadProject(db, projectId)
    if (!row) continue
    const effective = await projectEffective(db, actor, row)
    if (!effective.capabilities.has('read')) continue
    projects.set(projectId, { row, tasks: await readableTasks(db, actor, projectId), effective })
  }
  const union = new Map<string, Placed>(), homes = new Map<string, Set<string>>()
  for (const [projectId, project] of projects) for (const task of project.tasks) { union.set(task.id, task); homes.set(task.id, (homes.get(task.id) ?? new Set()).add(projectId)) }
  const owners = await displayNames(db, [...new Set([...union.values()].map(task => task.owner_id)), ...[...projects.values()].map(p => p.row.owner_id)])
  const refs = new Map<string, string | null>()
  for (const taskId of union.keys()) refs.set(taskId, await currentRef(db, taskId))
  const info = new Map<string, TaskInfo>()
  for (const task of union.values()) info.set(task.id, { id: task.id, ref: refs.get(task.id) ?? null, title: task.title, kind: task.kind, status: task.status, start: task.start_date, due: task.due_date, owner: owners.get(task.owner_id) ?? 'Former member', ownerId: task.owner_id, estimate: task.estimate_hours, overdue: task.status !== 'done' && !!task.due_date && isOverdue(task.due_date, evaluatedAt), projects: [...homes.get(task.id)!] })

  // Dependency edges among the readable tasks: slack and the critical path are read from what this person can see.
  const edges = await edgesAmong(db, portfolio.workspace_id, [...union.keys()])
  const neighbours = new Map<string, Set<string>>()
  for (const e of edges) { neighbours.set(e.predecessor, (neighbours.get(e.predecessor) ?? new Set()).add(e.successor)); neighbours.set(e.successor, (neighbours.get(e.successor) ?? new Set()).add(e.predecessor)) }

  const perProject = new Map<string, { evidence: Evidence; flags: Flag[]; ratio: number | null; unknown: boolean; status: Awaited<ReturnType<typeof latestStatus>>; criticalPath: { id: string; slack: number }[] }>()
  for (const [projectId, project] of projects) {
    const own = new Set(project.tasks.map(task => task.id)), chain = new Set(own), queue = [...own]
    while (queue.length) for (const next of neighbours.get(queue.shift()!) ?? []) if (!chain.has(next)) { chain.add(next); queue.push(next) }
    const nodes = [...chain].map(taskId => { const t = union.get(taskId)!; return { id: taskId, start: t.start_date, due: t.due_date, done: t.status === 'done' } })
    const used: Edge[] = edges.filter(e => chain.has(e.predecessor) && chain.has(e.successor))
    const slacks = new Map(slackOf(nodes, used, project.row.due_date).map(s => [s.id, s]))
    const status = await latestStatus(db, 'project', projectId, evaluatedAt)
    const author = status ? (await displayNames(db, [status.author_id])).get(status.author_id) ?? 'Former member' : ''
    const tasks = project.tasks.map(task => info.get(task.id)!)
    const evidence: Evidence = {
      milestones: tasks.filter(t => t.kind === 'milestone').map(t => ({ id: t.id, title: t.title, due: t.due, done: t.status === 'done', overdue: !!t.due && isOverdue(t.due, evaluatedAt) })),
      late: tasks.filter(t => t.kind !== 'milestone' && t.status !== 'done' && own.has(t.id)).flatMap(t => { const s = slacks.get(t.id); return s?.critical && s.slack !== null && s.slack < 0 ? [{ id: t.id, title: t.title, slack: s.slack }] : [] }),
      eligible: tasks.filter(t => t.kind !== 'milestone' && t.status !== 'done' && t.due).map(t => ({ id: t.id, title: t.title, overdue: t.overdue, due: t.due! })),
      status: status ? { id: status.id, publishedAt: status.published_at, author } : null,
    }
    const result = evaluate(evidence, policy, policyVersion.version, evaluatedAt)
    perProject.set(projectId, { evidence, ...result, status, criticalPath: [...slacks.values()].filter(s => s.critical && own.has(s.id) && s.slack !== null).map(s => ({ id: s.id, slack: s.slack! })) })
  }

  const fieldIds = new Map<string, { id: string; key: string; label: string; type: string; units: string; projects: Set<string> }>()
  for (const [projectId, project] of projects) for (const field of await definitions(db, projectId)) {
    if (!['number', 'currency'].includes(field.type) || !fieldReadable(field, project.effective)) continue
    const known = fieldIds.get(field.id) ?? { id: field.id, key: field.key, label: field.label, type: field.type, units: field.units, projects: new Set<string>() }
    known.projects.add(projectId); fieldIds.set(field.id, known)
  }
  const values = new Map<string, Map<string, number>>()
  for (const field of fieldIds.values()) {
    const map = new Map<string, number>()
    for (const row of await all<{ task_id: string; value: string }>(db, 'SELECT task_id,value FROM peg_field_values WHERE field_id=?', field.id)) { const n = JSON.parse(row.value); if (typeof n === 'number' && Number.isFinite(n) && [...(homes.get(row.task_id) ?? [])].some(p => field.projects.has(p))) map.set(row.task_id, n) }
    values.set(field.id, map)
  }

  const countable = (ids: Iterable<string>) => [...new Set(ids)].map(taskId => info.get(taskId)!).filter(t => t.kind !== 'milestone')
  /** One portfolio's figures: the distinct readable tasks of every readable project beneath it. */
  const summarize = (projectIds: string[]) => {
    const tasks = countable(projectIds.flatMap(p => projects.get(p)!.tasks.map(t => t.id))), every = [...new Set(projectIds.flatMap(p => projects.get(p)!.tasks.map(t => t.id)))].map(taskId => info.get(taskId)!)
    const milestones = every.filter(t => t.kind === 'milestone'), byStatus = { todo: 0, doing: 0, done: 0 } as Record<string, number>
    for (const t of tasks) byStatus[t.status]++
    const dated = every.flatMap(t => [t.start, t.due]).concat(projectIds.flatMap(p => [projects.get(p)!.row.start_date, projects.get(p)!.row.due_date])).filter((d): d is string => !!d).map(d => d.slice(0, 10)).sort()
    const ownerCounts = new Map<string, { id: string; name: string; tasks: number; open: number }>()
    for (const t of tasks) { const o = ownerCounts.get(t.ownerId) ?? { id: t.ownerId, name: t.owner, tasks: 0, open: 0 }; o.tasks++; if (t.status !== 'done') o.open++; ownerCounts.set(t.ownerId, o) }
    const states = projectIds.map(p => perProject.get(p)!), upcoming = milestones.filter(m => m.status !== 'done' && m.due).sort((x, y) => x.due!.localeCompare(y.due!))[0]
    return {
      projects: projectIds.length, tasks: tasks.length, byStatus, overdue: tasks.filter(t => t.overdue).length, estimateHours: tasks.reduce((sum, t) => sum + t.estimate, 0),
      progress: tasks.length ? Math.round(byStatus.done * 100 / tasks.length) : null,
      startDate: dated[0] ?? null, dueDate: dated.at(-1) ?? null,
      owners: [...ownerCounts.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name)),
      milestones: { total: milestones.length, done: milestones.filter(m => m.status === 'done').length, past: milestones.filter(m => m.status !== 'done' && m.due && isOverdue(m.due, evaluatedAt)).length, next: upcoming ? { id: upcoming.id, title: upcoming.title, due: upcoming.due } : null },
      fields: [...fieldIds.values()].filter(f => projectIds.some(p => f.projects.has(p))).map(f => ({ id: f.id, key: f.key, label: f.label, units: f.units, type: f.type, total: [...values.get(f.id)!].filter(([taskId]) => projectIds.some(p => homes.get(taskId)?.has(p) && f.projects.has(p))).reduce((sum, [, n]) => sum + n, 0) })),
      computed: { state: states.some(s => s.flags.length) ? 'at_risk' : states.length && states.every(s => s.unknown) ? 'unknown' : 'clear', atRisk: states.filter(s => s.flags.length).length, unknown: states.filter(s => s.unknown).length },
    }
  }
  const projectIdsOf = (p: PortfolioRow, all2: PortfolioRow[]) => {
    const ids = new Set<string>(), within = new Set([p.id]); let grew = true
    while (grew) { grew = false; for (const q of all2) if (q.parent_id && within.has(q.parent_id) && !within.has(q.id)) { within.add(q.id); grew = true } }
    for (const [projectId, owning] of projectPortfolios) if (projects.has(projectId) && [...owning].some(x => within.has(x))) ids.add(projectId)
    return [...ids]
  }
  const tree = async (p: PortfolioRow): Promise<any> => ({
    id: p.id, name: p.name, summary: summarize(projectIdsOf(p, portfolios)), manual: await manual('portfolio', p.id),
    children: await Promise.all(portfolios.filter(q => q.parent_id === p.id).map(tree)),
  })
  const manual = async (type: string, subject: string) => { const s = await latestStatus(db, type, subject, evaluatedAt); return s ? { id: s.id, citations:await recordCitations(db,actor,s.id), health: s.health, summary: s.summary, author: (await displayNames(db, [s.author_id])).get(s.author_id) ?? 'Former member', publishedAt: s.published_at } : null }

  const names = new Map(portfolios.map(p => [p.id, p.name]))
  const projectRows = await Promise.all([...projects.keys()].map(async projectId => {
    const project = projects.get(projectId)!, state = perProject.get(projectId)!, own = project.tasks.map(t => info.get(t.id)!)
    return { id: projectId, name: project.row.name, link: `/app/projects/${projectId}`, owner: owners.get(project.row.owner_id) ?? 'Former member', portfolios: [...projectPortfolios.get(projectId)!].map(x => ({ id: x, name: names.get(x)! })),
      startDate: project.row.start_date, dueDate: project.row.due_date, tasks: own.filter(t => t.kind !== 'milestone').length, done: own.filter(t => t.kind !== 'milestone' && t.status === 'done').length, overdue: own.filter(t => t.kind !== 'milestone' && t.overdue).length,
      manual: await manual('project', projectId), flags: state.flags, computed: state.flags.length ? 'at_risk' : state.unknown ? 'unknown' : 'clear', overdueShare: state.ratio, criticalPath: state.criticalPath }
  }))
  projectRows.sort((a, b) => a.name.localeCompare(b.name))

  const saved = await filtersOf(db, portfolio.id), chosen = options.filterId ? saved.find(f => f.id === options.filterId) : undefined
  if (options.filterId && !chosen) throw invalid('filter')
  const keep = (t: TaskInfo, f: Filter | undefined) => !f || ((!f.ownerId || t.ownerId === f.ownerId) && (!f.status || t.status === f.status) && (!f.projectId || t.projects.includes(f.projectId)) && (!f.overdue || t.overdue))
  const shown = [...info.values()].filter(t => keep(t, chosen?.filter))
  const nameOf = (projectId: string) => projects.get(projectId)!.row.name
  const tabs = {
    timeline: {
      projects: projectRows.filter(p => !chosen?.filter.projectId || p.id === chosen.filter.projectId).map(p => ({ id: p.id, name: p.name, link: p.link, start: p.startDate ?? shown.filter(t => t.projects.includes(p.id) && t.start).map(t => t.start!.slice(0, 10)).sort()[0] ?? null, due: p.dueDate ?? shown.filter(t => t.projects.includes(p.id) && t.due).map(t => t.due!.slice(0, 10)).sort().at(-1) ?? null, computed: p.computed })),
      tasks: shown.filter(t => t.start || t.due).sort((a, b) => (a.start ?? a.due!).localeCompare(b.start ?? b.due!) || a.title.localeCompare(b.title)).map(t => taskRow(t, nameOf)),
      dependencies: edges.filter(e => shown.some(t => t.id === e.predecessor) && shown.some(t => t.id === e.successor)).map(e => ({ id: e.id, predecessor: e.predecessor, successor: e.successor, type: e.type, lag: e.lag })),
    },
    workload: { owners: [...shown.filter(t => t.kind !== 'milestone').reduce((map, t) => { const o = map.get(t.ownerId) ?? { id: t.ownerId, name: t.owner, open: 0, done: 0, overdue: 0, openHours: 0, projects: new Set<string>() }; if (t.status === 'done') o.done++; else { o.open++; o.openHours += t.estimate } if (t.overdue) o.overdue++; for (const p of t.projects) o.projects.add(p); return map.set(t.ownerId, o) }, new Map<string, { id: string; name: string; open: number; done: number; overdue: number; openHours: number; projects: Set<string> }>()).values()].map(o => ({ ...o, projects: [...o.projects].map(nameOf).sort() })).sort((a, b) => b.openHours - a.openHours || a.name.localeCompare(b.name)) },
    dashboard: {
      byStatus: ['todo', 'doing', 'done'].map(status => ({ status, tasks: shown.filter(t => t.kind !== 'milestone' && t.status === status).length })),
      computed: { at_risk: projectRows.filter(p => p.computed === 'at_risk').length, unknown: projectRows.filter(p => p.computed === 'unknown').length, clear: projectRows.filter(p => p.computed === 'clear').length },
      manual: { on_track: projectRows.filter(p => p.manual?.health === 'on_track').length, at_risk: projectRows.filter(p => p.manual?.health === 'at_risk').length, off_track: projectRows.filter(p => p.manual?.health === 'off_track').length, missing: projectRows.filter(p => !p.manual).length },
      reasons: Object.entries(projectRows.flatMap(p => p.flags).reduce<Record<string, number>>((m, f) => ({ ...m, [f.code]: (m[f.code] ?? 0) + 1 }), {})).map(([code, projectsAffected]) => ({ code, projects: projectsAffected })),
      projects: projectRows.map(p => ({ id: p.id, name: p.name, link: p.link, tasks: p.tasks, done: p.done, overdue: p.overdue, overdueShare: p.overdueShare })),
    },
  }
  const ancestors: { id: string; name: string }[] = []
  for (let current = portfolio.parent_id ? await loadPortfolio(db, portfolio.parent_id) : null; current; current = current.parent_id ? await loadPortfolio(db, current.parent_id) : null) if (await portfolioLevel(db, actor, current)) ancestors.unshift({ id: current.id, name: current.name })
  return {
    portfolio: { id: portfolio.id, name: portfolio.name, description: portfolio.description, owner: owners.get(portfolio.owner_id) ?? (await displayNames(db, [portfolio.owner_id])).get(portfolio.owner_id) ?? 'Former member', level, ancestors },
    evaluatedAt, policy: { version: policyVersion.version, ...policy, changedAt: policyVersion.changedAt }, history: level === 'admin' ? await policyHistory(db, portfolio.id) : [],
    manual: await manual('portfolio', portfolio.id), summary: summarize(projectIdsOf(portfolio, portfolios)), nested: await tree(portfolio), projects: projectRows,
    deliveryRecords:(await Promise.all([...projects.keys()].map(async id=>(await registerView(db,actor,id)).records.map(r=>({id:r.id,title:r.title}))))).flat(),
    tabs, filters: saved, filter: chosen ?? null, tasks: [...info.values()].sort((a, b) => a.title.localeCompare(b.title)).map(t => taskRow(t, nameOf)),
  }
}

/** Source rows behind one number: the tasks this person may read that make it up. */
export async function portfolioDrill(db: D1Database, actor: Actor, id: string, query: { metric: string; projectId?: string; at?: number }) {
  const view = await portfolioRollup(db, actor, id, { at: query.at })
  const metrics: Record<string, (t: (typeof view.tasks)[number]) => boolean> = { all: () => true, open: t => t.status !== 'done' && t.kind !== 'milestone', done: t => t.status === 'done' && t.kind !== 'milestone', overdue: t => t.overdue && t.kind !== 'milestone', milestones: t => t.kind === 'milestone' }
  if (!metrics[query.metric]) throw invalid('metric')
  return { metric: query.metric, evaluatedAt: view.evaluatedAt, tasks: view.tasks.filter(t => (!query.projectId || t.projects.some(p => p.id === query.projectId)) && metrics[query.metric](t)) }
}
