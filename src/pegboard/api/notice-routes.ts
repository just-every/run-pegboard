import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { muteReadinessTask, readinessNotices, readinessPreferences, saveReadinessPreferences } from '../notices'

export function noticeRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/notices/readiness', door(({ db, actor, workspace }) => readinessNotices(db, actor, workspace)))
  app.post('/notices/readiness/dispatch', door(({ db, actor, workspace }) => readinessNotices(db, actor, workspace), { next: () => '/app/inbox' }))
  app.get('/notices/readiness/preferences', door(({ db, actor, workspace }) => readinessPreferences(db, actor, workspace)))
  app.post('/notices/readiness/preferences', door(({ db, actor, workspace, input }) => saveReadinessPreferences(db, actor, workspace, input), { next: () => '/app/inbox' }))
  app.post('/tasks/:id/readiness-preferences', door(({ db, actor, params, input }) => muteReadinessTask(db, actor, params.id, input), { next: () => '/app/inbox' }))
}
