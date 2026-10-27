import {webhookPreview,deliverWebhook,webhookHistory,revokeWebhook} from '../public-api/webhooks'
import {guestPreview} from '../guests/preview'
// /api/v1: grants, the access review, access requests and their one decision door, webhooks.
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { accessReview, explainStanding } from '../admin/review'
import { listWebhooks, registerWebhook } from '../admin/webhooks'
import { decideRequest, decisionNotices, pendingFor, previewRequest } from '../access-requests/decisions'
import { myRequests, submitRequest } from '../access-requests/requests'
import { createGrant, grantsOn, revokeGrant } from '../authorization/grants'
import { invalid } from '../db'
import { door } from './door'

type App = Hono<{ Bindings: Bindings }>
const array = (value: unknown) => Array.isArray(value) ? value : typeof value === 'string' && value ? value.split(',').map(part => part.trim()) : undefined

export function accessRoutes(app: App) {
  app.get('/projects/:id/guest-preview',door(({actor,db,params,query})=>guestPreview(db,actor,params.id,query.get('recipient')??'')))
  app.post('/grants', door(({ actor, db, input }) => createGrant(db, actor, { objectType: input.objectType, objectId: input.objectId, granteeType: input.granteeType ?? 'person', granteeId: input.granteeId, level: input.level, scope: input.scope || undefined, scopes: array(input.scopes), expiresAt: input.expiresAt ? Number(input.expiresAt) : null }),
    { next: (_, { input }) => typeof input.objectType === 'string' ? `/app/${input.objectType}s/${input.objectId}` : '/app' }))
  app.get('/grants', door(async ({ actor, db, query }) => {
    const type = query.get('objectType'), id = query.get('objectId')
    if (!id || (type !== 'team' && type !== 'project' && type !== 'task')) throw invalid('object')
    return { grants: await grantsOn(db, actor, type, id) }
  }))
  app.delete('/grants/:id', door(async ({ actor, db, params }) => { await revokeGrant(db, actor, params.id) }))
  app.post('/grants/:id/revoke', door(async ({ actor, db, params }) => { await revokeGrant(db, actor, params.id) }, { next: (_, { input }) => typeof input._next === 'string' ? input._next : '/app/access-review' }))
  app.get('/standing', door(async ({ actor, db, query }) => {
    const type = query.get('objectType'), id = query.get('objectId'), who = query.get('operatorId')
    if (!id || !who || (type !== 'team' && type !== 'project')) throw invalid('object')
    return explainStanding(db, actor, type, id, who)
  }))
  app.get('/admin/access-review', door(({ actor, db, workspace, query }) => accessReview(db, actor, workspace, { action: query.get('action') ?? undefined, subjectId: query.get('subject') ?? undefined })))

  app.post('/access-requests', door(({ actor, db, delivery, input }) => submitRequest(db, delivery, actor, input), { next: (_, { input }) => `/app/link/${encodeURIComponent(String(input.targetId ?? ''))}?asked=1` }))
  app.get('/access-requests', door(async ({ actor, db }) => ({ mine: await myRequests(db, actor), toDecide: await pendingFor(db, actor), notices: await decisionNotices(db, actor) })))
  app.get('/access-requests/:id', door(({ actor, db, params }) => previewRequest(db, actor, params.id)))
  app.post('/access-requests/:id/decision', door(({ actor, db, params, input }) => decideRequest(db, actor, params.id, input), { next: () => '/app/inbox' }))

  app.get('/webhooks/:id/event-preview', door(({db,actor,params,query}) => webhookPreview(db,actor,params.id,Number(query.get('eventId')))))
  app.post('/webhooks/:id/deliver', door(({db,env,actor,params,input}) => deliverWebhook(db,env,actor,params.id,input)))
  app.get('/webhooks/:id/deliveries', door(({db,actor,params}) => webhookHistory(db,actor,params.id)))
  app.delete('/webhooks/:id', door(({db,actor,params}) => revokeWebhook(db,actor,params.id)))
  app.post('/webhooks', door(({ actor, db, workspace, input }) => registerWebhook(db, actor, { ...input, workspaceId: workspace, url: input.url, events: array(input.events) })))
  app.get('/webhooks', door(async ({ actor, db, workspace }) => ({ webhooks: await listWebhooks(db, actor, workspace) })))
}
