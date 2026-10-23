import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { backlinkEngineering, engineeringView, linkEngineering, refreshEngineering, revokeEngineering, updateEngineering } from '../engineering-links/links'
export function engineeringRoutes(app: Hono<{Bindings:Bindings}>) {
  app.get('/tasks/:id/engineering',door(d=>engineeringView(d.db,d.actor,d.params.id)))
  app.post('/tasks/:id/engineering',door(d=>linkEngineering(d.db,d.env,d.actor,d.params.id,d.input),{next:(_,d)=>`/app/engineering/${d.params.id}`}))
  app.post('/engineering/:id/backlink',door(d=>backlinkEngineering(d.db,d.env,d.actor,d.params.id,d.input)))
  app.post('/engineering/:id/refresh',door(d=>refreshEngineering(d.db,d.env,d.actor,d.params.id,d.input)))
  app.post('/engineering/:id/revoke',door(d=>revokeEngineering(d.db,d.actor,d.params.id)))
  app.post('/engineering/:id/update',door(d=>updateEngineering(d.db,d.env,d.actor,d.params.id,d.input)))
}
