import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {decisionPreview,decideTask} from '../decisions/tasks'
import {previewRecurrence,createRecurrence,recurrenceView,listRecurrences,runRecurrence,stopRecurrence} from '../recurrence/recurrence'
export function recurrenceRoutes(app:Hono<{Bindings:Bindings}>) {
  app.get('/tasks/:id/decision-preview',door(({db,actor,params})=>decisionPreview(db,actor,params.id)))
  app.post('/tasks/:id/decision',door(({db,actor,params,input})=>decideTask(db,actor,params.id,input)))
  app.post('/recurrences/preview',door(({db,actor,input})=>previewRecurrence(db,actor,input)))
  app.post('/recurrences',door(({db,actor,input})=>createRecurrence(db,actor,input)))
  app.get('/recurrences',door(async({db,actor,workspace})=>({recurrences:await listRecurrences(db,actor,workspace)})))
  app.get('/recurrences/:id',door(({db,actor,params})=>recurrenceView(db,actor,params.id)))
  app.post('/recurrences/:id/run',door(({db,actor,params})=>runRecurrence(db,actor,params.id)))
  app.post('/recurrences/:id/stop',door(({db,actor,params})=>stopRecurrence(db,actor,params.id)))
}
