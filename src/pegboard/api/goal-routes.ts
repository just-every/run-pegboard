import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {createGoal,listGoals,goalView,linkGoal,numericEvent,checkIn} from '../goals/goals'
export function goalRoutes(app:Hono<{Bindings:Bindings}>) {
  app.post('/goals',door(({db,actor,workspace,input})=>createGoal(db,actor,workspace,input)))
  app.get('/goals',door(async({db,actor,workspace})=>({goals:await listGoals(db,actor,workspace)})))
  app.get('/goals/:id',door(({db,actor,params})=>goalView(db,actor,params.id)))
  app.post('/goals/:id/links',door(({db,actor,params,input})=>linkGoal(db,actor,params.id,input)))
  app.post('/goals/:id/numeric-events',door(({db,actor,params,input})=>numericEvent(db,actor,params.id,input)))
  app.post('/goals/:id/checkins',door(({db,actor,params,input})=>checkIn(db,actor,params.id,input)))
}
