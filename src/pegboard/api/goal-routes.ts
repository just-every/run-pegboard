import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {createGoal,listGoals,goalView,linkGoal,numericEvent,checkIn,goalAudiencePreview,updateGoalAudience,goalAudience} from '../goals/goals'
export function goalRoutes(app:Hono<{Bindings:Bindings}>) {
  app.post('/goals',door(async({db,actor,workspace,input,form})=>{const result=await createGoal(db,actor,workspace,input);if(form)input._next=`/app/goals/${result.id}`;return result}))
  app.get('/goals',door(async({db,actor,workspace})=>({goals:await listGoals(db,actor,workspace)})))
  app.get('/goals/:id/audience',door(({db,actor,params})=>goalAudience(db,actor,params.id)))
  app.post('/goals/:id/audience-preview',door(({db,actor,params,input})=>goalAudiencePreview(db,actor,params.id,input)))
  app.post('/goals/:id/audience',door(({db,actor,params,input})=>updateGoalAudience(db,actor,params.id,input)))
  app.get('/goals/:id',door(({db,actor,params})=>goalView(db,actor,params.id)))
  app.post('/goals/:id/links',door(({db,actor,params,input})=>linkGoal(db,actor,params.id,input)))
  app.post('/goals/:id/numeric-events',door(({db,actor,params,input})=>numericEvent(db,actor,params.id,input)))
  app.post('/goals/:id/checkins',door(({db,actor,params,input})=>checkIn(db,actor,params.id,input)))
}
