import { all, first, invalid } from '../db'
import { goalView, type Goal } from '../goals/goals'
import { openPortfolio, type PortfolioRow } from '../portfolios/portfolios'
import { openTask } from '../tasks/access'
import { type Actor } from '../workspace/people'

export interface Scopes { portfolios: string[]; goals: string[] }
export function scopeInput(input: Record<string, any>): Scopes {
  const read = (name: string) => {
    const ids = input[name] ?? []
    if (!Array.isArray(ids) || ids.length > 50 || ids.some(id => typeof id !== 'string')) throw invalid('analyst_object_scope')
    return [...new Set(ids as string[])].sort()
  }
  return { portfolios: read('portfolios'), goals: read('goals') }
}
export async function portfolioProjects(db: D1Database, id: string) {
  return all<{ project_id: string }>(db, `WITH RECURSIVE tree(id) AS (
    SELECT id FROM peg_portfolios WHERE id=? UNION SELECT p.id FROM peg_portfolios p JOIN tree t ON p.parent_id=t.id)
    SELECT DISTINCT project_id FROM peg_portfolio_projects WHERE portfolio_id IN (SELECT id FROM tree) ORDER BY project_id`, id)
}
/** Explicit object consent never expands the separately reviewed project scope. */
export async function checkScopes(db: D1Database, actor: Actor, workspace: string, projects: string[], scopes: Scopes, present = false) {
  const selected = new Set(projects)
  for (const id of scopes.portfolios ?? []) {
    const exists = await first<PortfolioRow>(db, 'SELECT * FROM peg_portfolios WHERE id=?', id)
    if (!exists && !present) continue
    const { portfolio } = await openPortfolio(db, actor, id)
    if (portfolio.workspace_id !== workspace || (await portfolioProjects(db, id)).some(row => !selected.has(row.project_id))) throw invalid('analyst_portfolio_scope')
  }
  for (const id of scopes.goals ?? []) {
    const exists = await first<Goal>(db, 'SELECT * FROM peg_goals WHERE id=?', id)
    if (!exists && !present) continue
    const { goal } = await goalView(db, actor, id)
    if (goal.workspace_id !== workspace || goal.scope === 'personal') throw invalid('analyst_goal_scope')
    for (const link of await all<{ source_type: string; source_id: string }>(db, 'SELECT source_type,source_id FROM peg_goal_links WHERE goal_id=?', id)) {
      if (link.source_type === 'goal') {
        if (!scopes.goals.includes(link.source_id)) throw invalid('analyst_goal_scope')
      } else if (link.source_type === 'project') {
        if (!selected.has(link.source_id)) throw invalid('analyst_goal_scope')
      } else {
        const opened = await openTask(db, actor, link.source_id)
        if (![...opened.access.contexts].some(([project, access]) => selected.has(project) && access.capabilities.has('export'))) throw invalid('analyst_goal_scope')
      }
    }
  }
}
export async function scopeOptions(db: D1Database, actor: Actor, workspace: string) {
  const portfolios: { id: string; name: string }[] = [], goals: { id: string; title: string }[] = []
  for (const row of await all<{ id: string }>(db, 'SELECT id FROM peg_portfolios WHERE workspace_id=? ORDER BY name,id', workspace)) {
    const opened = await openPortfolio(db, actor, row.id).catch(() => null)
    if (opened) portfolios.push({ id: row.id, name: opened.portfolio.name })
  }
  for (const row of await all<{ id: string; title: string }>(db, "SELECT id,title FROM peg_goals WHERE workspace_id=? AND scope<>'personal' ORDER BY title,id", workspace)) {
    if (await goalView(db, actor, row.id).catch(() => null)) goals.push(row)
  }
  return { portfolios, goals }
}
