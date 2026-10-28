import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { workloadView, addResourcePlan } from '../capacity/workload'
import { saveCapacityProfile } from '../capacity/profiles'
import { applyStaffing, staffingScenario, capacityPlan } from '../capacity/scenarios'
import { applyEffort, effortPreview } from '../capacity/allocations'

export function capacityRoutes(app:Hono<{Bindings:Bindings}>) {
 const next=(_:unknown,{params}:{params:Record<string,string>})=>'/app/workload?workspace='+encodeURIComponent(params.id)
 app.get('/workspaces/:id/workload',door(({db,actor,params,query})=>workloadView(db,actor,params.id,Object.fromEntries(query))))
 app.get('/workspaces/:id/capacity-plan',door(({db,actor,params,query})=>capacityPlan(db,actor,params.id,Object.fromEntries(query))))
 app.post('/workspaces/:id/capacity-profile',door(({db,actor,params,input})=>saveCapacityProfile(db,actor,params.id,input),{next:()=>'/app/account/availability'}))
 app.post('/workspaces/:id/resource-plans',door(({db,actor,params,input})=>addResourcePlan(db,actor,params.id,input),{next}))
 app.post('/workspaces/:id/staffing/preview',door(({db,actor,params,input})=>staffingScenario(db,actor,params.id,input)))
 app.post('/workspaces/:id/staffing/apply',door(({db,actor,params,input})=>applyStaffing(db,actor,params.id,input),{next}))
 app.post('/tasks/:id/effort/preview',door(({db,actor,params,input})=>effortPreview(db,actor,params.id,input)))
 app.post('/tasks/:id/effort/apply',door(({db,actor,params,input})=>applyEffort(db,actor,params.id,input),{next:(_,d)=>'/app/workload'}))
}
