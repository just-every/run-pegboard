import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { createRecord, decideRecord, registerView } from '../register/records'
export function registerRoutes(app:Hono<{Bindings:Bindings}>){
 const next=(_:unknown,{params}:{params:Record<string,string>})=>`/app/projects/${params.id}/register`
 app.get('/projects/:id/register',door(({db,actor,params})=>registerView(db,actor,params.id)))
 app.post('/projects/:id/register',door(({db,actor,params,input})=>createRecord(db,actor,params.id,input),{next}))
 app.post('/projects/:id/register/:record/decision',door(({db,actor,params,input})=>decideRecord(db,actor,params.id,params.record,input),{next}))
}
