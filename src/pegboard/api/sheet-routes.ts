import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { configureSheet, reconcileSheet, reviewSheet, revokeSheet, sendSheet, sheetReview, sheetSettings } from '../sheets/exports'
import { door } from './door'
const here = '/app/settings/sheets'
const redirect = (id: string) => new Response(null, { status: 303, headers: { location: here + '?review=' + encodeURIComponent(id), 'cache-control': 'no-store' } })
export function sheetRoutes(app: Hono<{ Bindings: Bindings }>) {
 app.get('/sheets', door(({ db, actor, workspace }) => sheetSettings(db, actor, workspace)))
 app.post('/sheets', door(({ env, db, actor, workspace, input }) => configureSheet(env, db, actor, workspace, input), { next: () => here }))
 app.post('/sheets/:id/reviews', door(async ({ env, db, actor, params, input, form }) => { const r = await reviewSheet(env, db, actor, params.id, input); return form ? redirect(r.id) : r }))
 app.get('/sheet-reviews/:id', door(({ db, actor, params }) => sheetReview(db, actor, params.id)))
 app.post('/sheet-reviews/:id/send', door(async ({ env, db, actor, params, input, form }) => { const r = await sendSheet(env, db, actor, params.id, input); return form ? redirect(r.id) : r }))
 app.post('/sheet-reviews/:id/reconcile', door(async ({ env, db, actor, params, input, form }) => { const r = await reconcileSheet(env, db, actor, params.id, input); return form ? redirect(r.id) : r }))
 app.post('/sheets/:id/revoke', door(({ db, actor, params }) => revokeSheet(db, actor, params.id), { next: () => here }))
}
