import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { addTimeOff, availabilityView, removeTimeOff, setWorkingCalendar } from '../schedule/availability'
import { door } from './door'

export function availabilityRoutes(app: Hono<{ Bindings: Bindings }>) {
  const next = (_: unknown, { params }: { params: Record<string, string> }) => `/app/settings/availability?workspace=${encodeURIComponent(params.id)}`
  app.get('/workspaces/:id/availability', door(({ db, actor, params }) => availabilityView(db, actor, params.id)))
  app.post('/workspaces/:id/working-calendar', door(({ db, actor, params, input }) => setWorkingCalendar(db, actor, params.id, input), { next }))
  app.post('/workspaces/:id/time-off', door(({ db, actor, params, input }) => addTimeOff(db, actor, params.id, input), { next }))
  app.delete('/workspaces/:id/time-off/:leaveId', door(({ db, actor, params }) => removeTimeOff(db, actor, params.id, params.leaveId)))
  app.post('/workspaces/:id/time-off/:leaveId/remove', door(({ db, actor, params }) => removeTimeOff(db, actor, params.id, params.leaveId), { next }))
}
