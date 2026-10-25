// Portfolios: nested groups of projects. A portfolio gives its members a view of rollups, never a way into a project: what a
// person sees through it is exactly what their own project and task access already lets them read.
import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { auditStatement } from '../authorization/audit'
import { projectEffective } from '../authorization/effective'
import { loadProject } from '../authorization/grants'
import { isAdministrator, sharesWithWorkspace } from '../authorization/levels'
import { openProject } from '../workspace/projects'
import { workspaceRole, type Actor } from '../workspace/people'
import { defaultPolicy, policyInput, type Policy } from './risk'

export interface PortfolioRow { id: string; workspace_id: string; parent_id: string | null; name: string; description: string; owner_id: string; created_by: string; created_at: number }
export type PortfolioLevel = 'admin' | 'viewer'
const text = (value: unknown, max: number, code: string) => { if (typeof value !== 'string' || !value.trim() || value.length > max) throw invalid(code); return value.trim() }
export const loadPortfolio = (db: D1Database, id: string) => first<PortfolioRow>(db, 'SELECT * FROM peg_portfolios WHERE id=?', id)
const maxDepth = 5

/** A person's level on a portfolio: workspace administrators, owners and admins of it or of an ancestor, or a member of either, who may read. */
export async function portfolioLevel(db: D1Database, actor: Actor, portfolio: PortfolioRow): Promise<PortfolioLevel | null> {
  const role = await workspaceRole(db, actor.id, portfolio.workspace_id)
  if (!role || !sharesWithWorkspace(role)) return null
  if (isAdministrator(role)) return 'admin'
  let level: PortfolioLevel | null = null, current: PortfolioRow | null = portfolio
  for (let depth = 0; current && depth <= maxDepth; depth++) {
    if (current.owner_id === actor.id) return 'admin'
    const member = await first<{ level: PortfolioLevel }>(db, 'SELECT level FROM peg_portfolio_members WHERE portfolio_id=? AND operator_id=?', current.id, actor.id)
    // An owner or admin of an ancestor administers every portfolio beneath it; a viewer reads them.
    if (member?.level === 'admin') return 'admin'
    if (member) level = 'viewer'
    current = current.parent_id ? await loadPortfolio(db, current.parent_id) : null
  }
  return level
}
/** A portfolio the person can read, or not found: a refusal never says whether it exists. */
export async function openPortfolio(db: D1Database, actor: Actor, id: string) {
  const portfolio = await loadPortfolio(db, id)
  if (!portfolio) throw notFound()
  const level = await portfolioLevel(db, actor, portfolio)
  if (!level) throw notFound()
  return { portfolio, level }
}
const manage = async (db: D1Database, actor: Actor, id: string) => {
  const opened = await openPortfolio(db, actor, id)
  if (opened.level !== 'admin') throw forbidden('manage_portfolio')
  return opened.portfolio
}

export async function createPortfolio(db: D1Database, actor: Actor, input: { workspaceId: string; name: string; description?: string; parentId?: string | null }) {
  const role = await workspaceRole(db, actor.id, input.workspaceId)
  if (!role) throw notFound()
  if (!(isAdministrator(role) || role === 'manager' || role === 'member')) throw forbidden('create_portfolio')
  let depth = 0
  if (input.parentId) {
    const parent = await manage(db, actor, input.parentId)
    if (parent.workspace_id !== input.workspaceId) throw invalid('parent')
    for (let current: PortfolioRow | null = parent; current; current = current.parent_id ? await loadPortfolio(db, current.parent_id) : null) depth++
    if (depth >= maxDepth) throw invalid('portfolio_depth')
  }
  const id = newId('pf'), at = now(), name = text(input.name, 120, 'name')
  await batch(db, [
    bound(db, 'INSERT INTO peg_portfolios(id,workspace_id,parent_id,name,description,owner_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)', [id, input.workspaceId, input.parentId ?? null, name, (input.description ?? '').slice(0, 4000), actor.id, actor.id, at]),
    bound(db, 'INSERT INTO peg_portfolio_policies(portfolio_id,version,policy,changed_by,changed_at) VALUES (?,1,?,?,?)', [id, JSON.stringify(defaultPolicy), actor.id, at]),
    auditStatement(db, { workspaceId: input.workspaceId, actorId: actor.id, action: 'portfolio.created', targetType: 'portfolio', targetId: id, detail: { parentId: input.parentId ?? null } }),
  ])
  return (await loadPortfolio(db, id))!
}

/** Every portfolio the person can open, matching a search, and nothing else. */
export async function listPortfolios(db: D1Database, actor: Actor, workspaceId: string, query = '') {
  const role = await workspaceRole(db, actor.id, workspaceId)
  if (!role) throw notFound()
  const q = query.trim().toLowerCase(), out = []
  for (const row of await all<PortfolioRow>(db, 'SELECT * FROM peg_portfolios WHERE workspace_id=? ORDER BY name', workspaceId)) {
    if (q && !row.name.toLowerCase().includes(q) && !row.description.toLowerCase().includes(q)) continue
    const level = await portfolioLevel(db, actor, row)
    if (level) out.push({ id: row.id, name: row.name, parentId: row.parent_id, level, ownerId: row.owner_id })
  }
  // A child whose parent the person cannot open is listed as a top-level entry for them.
  const open = new Set(out.map(p => p.id))
  return out.map(p => ({ ...p, parentId: p.parentId && open.has(p.parentId) ? p.parentId : null }))
}

export async function addProject(db: D1Database, actor: Actor, id: string, projectId: unknown) {
  const portfolio = await manage(db, actor, id)
  if (typeof projectId !== 'string') throw invalid('project')
  const { project } = await openProject(db, actor, projectId)
  if (project.workspace_id !== portfolio.workspace_id) throw invalid('project')
  if (await first(db, 'SELECT 1 FROM peg_portfolio_projects WHERE portfolio_id=? AND project_id=?', id, project.id)) throw conflict('project_in_portfolio')
  await batch(db, [bound(db, 'INSERT INTO peg_portfolio_projects(portfolio_id,project_id,added_by,added_at) VALUES (?,?,?,?)', [id, project.id, actor.id, now()]), auditStatement(db, { workspaceId: portfolio.workspace_id, actorId: actor.id, action: 'portfolio.project_added', targetType: 'portfolio', targetId: id, subjectId: project.id })])
  return { portfolioId: id, projectId: project.id }
}
export async function removeProject(db: D1Database, actor: Actor, id: string, projectId: string) {
  const portfolio = await manage(db, actor, id)
  await batch(db, [bound(db, 'DELETE FROM peg_portfolio_projects WHERE portfolio_id=? AND project_id=?', [id, projectId]), auditStatement(db, { workspaceId: portfolio.workspace_id, actorId: actor.id, action: 'portfolio.project_removed', targetType: 'portfolio', targetId: id, subjectId: projectId })])
  return { portfolioId: id, projectId }
}

/** Members read the portfolio and everything beneath it; only workspace members who share the workspace may be named. */
export async function setMember(db: D1Database, actor: Actor, id: string, operatorId: unknown, level: unknown) {
  const portfolio = await manage(db, actor, id)
  if (typeof operatorId !== 'string') throw invalid('member')
  if (level === null || level === '' || level === 'none') {
    await batch(db, [bound(db, 'DELETE FROM peg_portfolio_members WHERE portfolio_id=? AND operator_id=?', [id, operatorId]), auditStatement(db, { workspaceId: portfolio.workspace_id, actorId: actor.id, action: 'portfolio.member_removed', targetType: 'portfolio', targetId: id, subjectId: operatorId })])
    return { portfolioId: id, operatorId, level: null }
  }
  if (level !== 'viewer' && level !== 'admin') throw invalid('level')
  if (!sharesWithWorkspace(await workspaceRole(db, operatorId, portfolio.workspace_id))) throw invalid('member')
  await batch(db, [bound(db, 'INSERT INTO peg_portfolio_members(portfolio_id,operator_id,level,added_by,added_at) VALUES (?,?,?,?,?) ON CONFLICT(portfolio_id,operator_id) DO UPDATE SET level=excluded.level', [id, operatorId, level, actor.id, now()]), auditStatement(db, { workspaceId: portfolio.workspace_id, actorId: actor.id, action: 'portfolio.member_set', targetType: 'portfolio', targetId: id, subjectId: operatorId, detail: { level } })])
  return { portfolioId: id, operatorId, level }
}

export interface PolicyVersion { version: number; policy: Policy; changedBy: string; changedAt: number }
export async function currentPolicy(db: D1Database, portfolioId: string): Promise<PolicyVersion> {
  const row = (await first<{ version: number; policy: string; changed_by: string; changed_at: number }>(db, 'SELECT * FROM peg_portfolio_policies WHERE portfolio_id=? ORDER BY version DESC LIMIT 1', portfolioId))!
  return { version: row.version, policy: { ...defaultPolicy, ...JSON.parse(row.policy) }, changedBy: row.changed_by, changedAt: row.changed_at }
}
export async function policyHistory(db: D1Database, portfolioId: string): Promise<PolicyVersion[]> {
  return (await all<{ version: number; policy: string; changed_by: string; changed_at: number }>(db, 'SELECT * FROM peg_portfolio_policies WHERE portfolio_id=? ORDER BY version DESC', portfolioId)).map(row => ({ version: row.version, policy: { ...defaultPolicy, ...JSON.parse(row.policy) }, changedBy: row.changed_by, changedAt: row.changed_at }))
}
/** The owner or an admin of the portfolio adjusts the thresholds; each change is a new version and the old ones stay readable. */
export async function setPolicy(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  const portfolio = await manage(db, actor, id)
  const before = await currentPolicy(db, id), next = policyInput(input, before.policy)
  if (JSON.stringify(next) === JSON.stringify(before.policy)) return before
  const version = before.version + 1
  await batch(db, [bound(db, 'INSERT INTO peg_portfolio_policies(portfolio_id,version,policy,changed_by,changed_at) VALUES (?,?,?,?,?)', [id, version, JSON.stringify(next), actor.id, now()]), auditStatement(db, { workspaceId: portfolio.workspace_id, actorId: actor.id, action: 'portfolio.policy_changed', targetType: 'portfolio', targetId: id, detail: { from: before.policy, to: next, version } })])
  return currentPolicy(db, id)
}

export const healths = ['on_track', 'at_risk', 'off_track'] as const
/** A person publishes a status for a project they administer or a portfolio they administer; agents never do. */
export async function publishStatus(db: D1Database, actor: Actor, input: { subjectType: string; subjectId: string; health: string; summary: string }) {
  if (!healths.includes(input.health as typeof healths[number])) throw invalid('health')
  const summary = text(input.summary, 4000, 'summary')
  let workspaceId: string
  if (input.subjectType === 'project') {
    const project = await loadProject(db, input.subjectId)
    if (!project) throw notFound()
    const effective = await projectEffective(db, actor, project)
    if (!effective.capabilities.has('read')) throw notFound()
    if (!effective.capabilities.has('manage_settings')) throw forbidden('manage_settings')
    workspaceId = project.workspace_id
  } else if (input.subjectType === 'portfolio') workspaceId = (await manage(db, actor, input.subjectId)).workspace_id
  else throw invalid('subject')
  if (await workspaceRole(db, actor.id, workspaceId) === 'agent') throw forbidden('human_publisher')
  const id = newId('status'), at = now()
  await batch(db, [bound(db, 'INSERT INTO peg_status_updates(id,workspace_id,subject_type,subject_id,health,summary,author_id,published_at) VALUES (?,?,?,?,?,?,?,?)', [id, workspaceId, input.subjectType, input.subjectId, input.health, summary, actor.id, at]),
    auditStatement(db, { workspaceId, actorId: actor.id, action: 'status.published', targetType: input.subjectType, targetId: input.subjectId, detail: { health: input.health } })])
  return { id, subjectType: input.subjectType, subjectId: input.subjectId, health: input.health, publishedAt: at }
}

export interface Filter { ownerId?: string; status?: string; projectId?: string; overdue?: boolean }
export async function saveFilter(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  const portfolio = await manage(db, actor, id), filter: Filter = {}
  if (input.ownerId) filter.ownerId = String(input.ownerId)
  if (input.status) { if (!['todo', 'doing', 'done'].includes(String(input.status))) throw invalid('status'); filter.status = String(input.status) }
  if (input.projectId) filter.projectId = String(input.projectId)
  if (input.overdue === true || input.overdue === 'true' || input.overdue === 'on') filter.overdue = true
  const filterId = newId('pff')
  await batch(db, [bound(db, 'INSERT INTO peg_portfolio_filters(id,portfolio_id,name,filter,created_by,created_at) VALUES (?,?,?,?,?,?)', [filterId, id, text(input.name, 80, 'name'), JSON.stringify(filter), actor.id, now()]), auditStatement(db, { workspaceId: portfolio.workspace_id, actorId: actor.id, action: 'portfolio.filter_saved', targetType: 'portfolio', targetId: id, subjectId: filterId })])
  return { id: filterId, name: String(input.name).trim(), filter }
}
export async function filtersOf(db: D1Database, portfolioId: string) {
  return (await all<{ id: string; name: string; filter: string }>(db, 'SELECT id,name,filter FROM peg_portfolio_filters WHERE portfolio_id=? ORDER BY created_at', portfolioId)).map(row => ({ id: row.id, name: row.name, filter: JSON.parse(row.filter) as Filter }))
}
