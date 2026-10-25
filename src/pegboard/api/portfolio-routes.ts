import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door, flag } from './door'
import { addDependency, dependenciesOf, removeDependency } from '../schedule/dependencies'
import { addProject, createPortfolio, listPortfolios, publishStatus, removeProject, saveFilter, setMember, setPolicy } from '../portfolios/portfolios'
import { portfolioDrill, portfolioRollup } from '../portfolios/rollup'
import { invalid } from '../db'

const at = (value: string | null | undefined) => {
  if (!value) return undefined
  const instant = /^\d+$/.test(value) ? Number(value) : Date.parse(value)
  if (!Number.isFinite(instant)) throw invalid('at')
  return instant
}
export function portfolioRoutes(app: Hono<{ Bindings: Bindings }>) {
  const here = (_: unknown, { params }: { params: Record<string, string> }) => `/app/portfolios/${params.id}`
  app.get('/portfolios', door(({ db, actor, workspace, query }) => listPortfolios(db, actor, workspace, query.get('q') ?? '').then(portfolios => ({ portfolios }))))
  app.post('/portfolios', door(({ db, actor, input, workspace }) => createPortfolio(db, actor, { workspaceId: workspace, name: input.name, description: input.description, parentId: input.parentId || null }), { next: result => `/app/portfolios/${result.id}` }))
  app.get('/portfolios/:id', door(({ db, actor, params, query }) => portfolioRollup(db, actor, params.id, { at: at(query.get('at')), filterId: query.get('filter') ?? undefined })))
  app.get('/portfolios/:id/drill', door(({ db, actor, params, query }) => portfolioDrill(db, actor, params.id, { metric: query.get('metric') ?? 'all', projectId: query.get('projectId') ?? undefined, at: at(query.get('at')) })))
  app.post('/portfolios/:id/projects', door(({ db, actor, params, input }) => addProject(db, actor, params.id, input.projectId), { next: here }))
  app.post('/portfolios/:id/projects/:project/remove', door(({ db, actor, params }) => removeProject(db, actor, params.id, params.project), { next: here }))
  app.post('/portfolios/:id/members', door(({ db, actor, params, input }) => setMember(db, actor, params.id, input.operatorId, input.level ?? null), { next: here }))
  app.post('/portfolios/:id/policy', door(({ db, actor, params, input, form }) => setPolicy(db, actor, params.id, { ...input, milestonePastDue: form ? flag(input.milestonePastDue) : input.milestonePastDue, negativeSlack: form ? flag(input.negativeSlack) : input.negativeSlack }), { next: here }))
  app.post('/portfolios/:id/filters', door(({ db, actor, params, input }) => saveFilter(db, actor, params.id, input), { next: here }))
  app.post('/status-updates', door(({ db, actor, input }) => publishStatus(db, actor, { subjectType: input.subjectType, subjectId: input.subjectId, health: input.health, summary: input.summary }), { next: (_result, { input }) => input.subjectType === 'portfolio' ? `/app/portfolios/${input.subjectId}` : `/app/projects/${input.subjectId}` }))
  app.post('/dependencies', door(({ db, actor, input }) => addDependency(db, actor, { predecessor: input.predecessor, successor: input.successor, type: input.type, lag: input.lag === undefined || input.lag === '' ? 0 : Number(input.lag) }), { next: (_result, { input }) => `/app/tasks/${input.successor}` }))
  app.delete('/dependencies/:id', door(({ db, actor, params }) => removeDependency(db, actor, params.id)))
  app.get('/tasks/:id/dependencies', door(({ db, actor, params }) => dependenciesOf(db, actor, params.id).then(dependencies => ({ dependencies }))))
}
