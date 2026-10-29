import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { beginCapture,cancelCapture,captureOptions,captureView,confirmCapture,reviewCapture } from '../capture/browser'
import { door } from './door'
export function captureRoutes(app:Hono<{Bindings:Bindings}>) {
 app.get('/capture-options',door(({db,actor,workspace,query})=>captureOptions(db,actor,workspace,query.get('projectId')??undefined)))
 app.post('/captures',door(({db,actor,session,input})=>beginCapture(db,actor,session.id,input)))
 app.get('/captures/:id',door(({db,actor,session,params})=>captureView(db,actor,session.id,params.id)))
 app.post('/captures/:id/review',door(({db,actor,session,params,input})=>reviewCapture(db,actor,session.id,params.id,input),{next:(_,d)=>'/app/capture/'+d.params.id}))
 app.post('/captures/:id/confirm',door(({db,actor,session,params,input})=>confirmCapture(db,actor,session.id,params.id,input),{next:r=>'/app/tasks/'+r.id}))
 app.post('/captures/:id/cancel',door(({db,actor,session,params})=>cancelCapture(db,actor,session.id,params.id),{next:()=>'/app/capture?cancelled=1'}))
}
