import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { invalid } from '../db'
import { door } from './door'
import { workView } from '../views/service'
import { deleteView, listWorkViews, saveView, setViewDefault, updateView } from '../views/store'
import { editViewTask } from '../views/edits'

export function viewRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/projects/:id/work-views', door(({ db, actor, params }) => listWorkViews(db, actor, params.id)))
  app.get('/projects/:id/work-view', door(({ db, actor, params, query }) => {
    const allowed = new Set(['view', 'savedView', 'mode', 'status', 'groupBy', 'limit', 'offset', 'from', 'days', 'workspace'])
    if ([...query.keys()].some(key => !allowed.has(key))) throw invalid('view_query')
    return workView(db, actor, params.id, { viewId: query.get('view') ?? query.get('savedView') ?? undefined,
      mode: query.get('mode') ?? undefined, status: query.get('status') ?? undefined, groupBy: query.get('groupBy') ?? undefined,
      limit: query.get('limit') ?? undefined, offset: query.get('offset') ?? undefined, from: query.get('from') ?? undefined, days: query.get('days') ?? undefined })
  }))
  const back = (_: unknown, data: { params: Record<string, string> }) => `/app/projects/${data.params.id}/settings/views`
  app.post('/projects/:id/work-views', door(({ db, actor, params, input }) => saveView(db, actor, params.id, input), { next: back }))
  app.post('/work-views/:id', door(({ db, actor, params, input }) => updateView(db, actor, params.id, input)))
  app.post('/work-views/:id/delete', door(({ db, actor, params, input }) => deleteView(db, actor, params.id, input)))
  app.post('/projects/:id/work-view-defaults', door(({ db, actor, params, input }) => setViewDefault(db, actor, params.id, input), { next: back }))
  app.post('/work-view-tasks/:id/edit', door(({ db, actor, params, input }) => editViewTask(db, actor, params.id, input)))
  app.post('/work-view-tasks/:id/move', door(({ db, actor, params, input }) => editViewTask(db, actor, params.id, input, true)))
}
