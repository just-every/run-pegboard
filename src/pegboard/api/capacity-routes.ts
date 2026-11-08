import { portfolioCapacity,comparePortfolioCapacity,applyPortfolioCapacity,portfolioCapacityUndoPreview,undoPortfolioCapacity,saveCapacityCommitment } from '../capacity/portfolio-plans'
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { workloadView, addResourcePlan } from '../capacity/workload'
import { saveCapacityProfile } from '../capacity/profiles'
import { applyStaffing, staffingScenario, capacityPlan } from '../capacity/scenarios'
import { applyEffort, effortPreview } from '../capacity/allocations'
import { configureFeed, refreshFeed, revokeFeed, feedSettings } from '../capacity/feeds'

export function capacityRoutes(app:Hono<{Bindings:Bindings}>) {
 app.get('/portfolios/:id/capacity',door(({db,actor,params,query})=>portfolioCapacity(db,actor,params.id,Object.fromEntries(query))))
 app.post('/portfolios/:id/capacity/compare',door(({db,actor,params,input})=>comparePortfolioCapacity(db,actor,params.id,input)))
 app.post('/portfolios/:id/capacity/apply',door(({db,actor,params,input})=>applyPortfolioCapacity(db,actor,params.id,input),{next:(_,d)=>'/app/portfolios/'+d.params.id+'/capacity'}))
 app.get('/portfolios/:id/capacity/:operation/undo-preview',door(({db,actor,params})=>portfolioCapacityUndoPreview(db,actor,params.id,params.operation)))
 app.post('/portfolios/:id/capacity/:operation/undo',door(({db,actor,params,input})=>undoPortfolioCapacity(db,actor,params.id,params.operation,input),{next:(_,d)=>'/app/portfolios/'+d.params.id+'/capacity'}))
 app.post('/tasks/:id/capacity-commitment',door(({db,actor,params,input})=>saveCapacityCommitment(db,actor,params.id,input)))
 const next=(_:unknown,{params}:{params:Record<string,string>})=>'/app/workload?workspace='+encodeURIComponent(params.id)
 app.get('/workspaces/:id/workload',door(({db,actor,params,query})=>workloadView(db,actor,params.id,Object.fromEntries(query))))
 app.get('/workspaces/:id/capacity-plan',door(({db,actor,params,query})=>capacityPlan(db,actor,params.id,Object.fromEntries(query))))
 app.post('/workspaces/:id/capacity-profile',door(({db,actor,params,input})=>saveCapacityProfile(db,actor,params.id,input),{next:()=>'/app/account/availability'}))
 app.post('/workspaces/:id/resource-plans',door(({db,actor,params,input})=>addResourcePlan(db,actor,params.id,input),{next}))
 app.post('/workspaces/:id/staffing/preview',door(({db,actor,params,input})=>staffingScenario(db,actor,params.id,input)))
 app.post('/workspaces/:id/staffing/apply',door(({db,actor,params,input})=>applyStaffing(db,actor,params.id,input),{next}))
 app.post('/tasks/:id/effort/preview',door(({db,actor,params,input})=>effortPreview(db,actor,params.id,input)))
 app.post('/tasks/:id/effort/apply',door(({db,actor,params,input})=>applyEffort(db,actor,params.id,input),{next:(_,d)=>'/app/workload'}))
 app.get('/workspaces/:id/capacity-feeds',door(({db,actor,params})=>feedSettings(db,actor,params.id)))
 app.post('/workspaces/:id/capacity-feeds',door(({db,actor,params,input})=>configureFeed(db,actor,params.id,input),{next:()=>'/app/settings/capacity'}))
 app.post('/workspaces/:id/capacity-feeds/:feed/refresh',door(({env,db,actor,params,input})=>refreshFeed(env,db,actor,params.id,params.feed,input),{next:()=>'/app/settings/capacity'}))
 app.post('/workspaces/:id/capacity-feeds/:feed/revoke',door(({db,actor,params})=>revokeFeed(db,actor,params.id,params.feed),{next:()=>'/app/settings/capacity'}))
}
