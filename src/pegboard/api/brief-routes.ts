import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { briefView, restoreBrief, saveBrief } from '../revisions/briefs'

export function briefRoutes(app:Hono<{Bindings:Bindings}>) {
 const next=(_:unknown,{params}:{params:Record<string,string>})=>`/app/projects/${params.id}/brief`
 app.get('/projects/:id/brief',door(({db,actor,params,query})=>briefView(db,actor,params.id,{
  ...(query.has('fromVersion')?{fromVersion:query.get('fromVersion')}:{}),
  ...(query.has('toVersion')?{toVersion:query.get('toVersion')}:{})
 })))
 app.post('/projects/:id/brief',door(({db,actor,params,input})=>saveBrief(db,actor,params.id,input),{next}))
 app.post('/projects/:id/brief/restore',door(({db,actor,params,input})=>restoreBrief(db,actor,params.id,input),{next}))
}
