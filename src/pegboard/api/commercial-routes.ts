import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door, describe, json } from './door'
import { authorizePortal, revokePortal, commercialSettings, receiveHubspot, reviewAdoption, adoptHandoff, declineHandoff, reviewReturn, sendReturn, reconcileReturn } from '../commercial/handoffs'
const next = '/app/settings/commercial'
export function commercialRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.post('/commercial/hubspot/events', async c => {
    try { return json(await receiveHubspot(c.req.raw, c.env)) }
    catch (error) { const e = describe(error); return json({ error: e.code }, e.status) }
  })
  app.get('/commercial', door(d => commercialSettings(d.db, d.actor, d.workspace)))
  app.post('/commercial/portals', door(d => authorizePortal(d.db, d.env, d.actor, d.workspace, d.input), { next: () => next }))
  app.post('/commercial/portals/:id/revoke', door(d => revokePortal(d.db, d.actor, d.workspace, d.params.id), { next: () => next }))
  app.post('/commercial/:id/reviews', door(d => reviewAdoption(d.db, d.env, d.actor, d.workspace, d.params.id, d.input), { next: r => next + '?review=' + r.id }))
  app.post('/commercial/reviews/:id/adopt', door(d => adoptHandoff(d.db, d.env, d.actor, d.workspace, d.params.id, d.input), { next: () => next }))
  app.post('/commercial/:id/decline', door(d => declineHandoff(d.db, d.actor, d.workspace, d.params.id, d.input), { next: () => next }))
  app.post('/commercial/:id/returns', door(d => reviewReturn(d.db, d.env, d.actor, d.workspace, d.params.id, d.input), { next: r => next + '?review=' + r.id }))
  app.post('/commercial/reviews/:id/send', door(d => sendReturn(d.db, d.env, d.actor, d.workspace, d.params.id, d.input), { next: () => next }))
  app.post('/commercial/reviews/:id/reconcile', door(d => reconcileReturn(d.db, d.env, d.actor, d.workspace, d.params.id, d.input), { next: () => next }))
}
