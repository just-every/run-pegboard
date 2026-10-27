import {approvalMail} from '../approvals/mail.mjs'
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import {previewRoute,configureRoute,routeView,decideRoute,changeRoute,shareRoute,reviewLink,revokeLink,proofMaterial,dispatchReminders} from '../approvals/routing'
export function approvalRoutes(app:Hono<{Bindings:Bindings}>){
 app.post('/approval-routing/:kind/:id/preview',door(({db,actor,params,input})=>previewRoute(db,actor,params.kind,params.id,input)))
 app.post('/approval-routing/:kind/:id',door(({db,actor,params,input})=>configureRoute(db,actor,params.kind,params.id,input),{next:r=>'/app/approvals/'+r.id}))
 app.get('/approvals/:id',door(({db,actor,params})=>routeView(db,actor,params.id)))
 app.post('/approvals/:id/decision',door(({db,actor,params,input})=>decideRoute(db,actor,params.id,input),{next:(_,d)=>'/app/approvals/'+d.params.id}))
 app.post('/approvals/:id/change',door(({db,actor,params,input})=>changeRoute(db,actor,params.id,input),{next:r=>'/app/approvals/'+r.id}))
 app.post('/approvals/:id/share',door(({db,actor,params,input})=>shareRoute(db,actor,params.id,input),{next:(_,d)=>'/app/approvals/'+d.params.id}))
 app.post('/approvals/:id/reminders',door(({db,actor,params,delivery,env})=>dispatchReminders(db,actor,params.id,{...delivery,mail:approvalMail(env)})))
 app.get('/proof-reviews/:id',door(({db,actor,params})=>reviewLink(db,actor,params.id)))
 app.get('/proof-reviews/:id/material',door(({db,actor,params})=>proofMaterial(db,actor,params.id)))
 app.post('/proof-reviews/:id/revoke',door(({db,actor,params})=>revokeLink(db,actor,params.id)))
 app.post('/proof-reviews/:id/decision',door(async({db,actor,params,input})=>{const view=await reviewLink(db,actor,params.id);return decideRoute(db,actor,view.id,input)},{next:(_,d)=>'/app/proof-reviews/'+d.params.id}))
}
