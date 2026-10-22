import {bodyLimit} from 'hono/body-limit'
import {publishNumericSource,createNumericSource,listNumericSources,revokeNumericSource,previewNumericCsv,commitNumericCsv} from '../goals/sources'
import {json,describe} from './door'
import {credentialDocument} from '../ui/pages/source-credential'
import {runtimeBindings} from '../../auth.server'
import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {createGoal,listGoals,goalView,linkGoal,numericEvent,checkIn,goalAudiencePreview,updateGoalAudience,goalAudience} from '../goals/goals'
export function goalRoutes(app:Hono<{Bindings:Bindings}>) {
  app.post('/metric-sources/:id/events',bodyLimit({maxSize:8192}),async c=>{
    try{const token=c.req.header('authorization')?.match(/^Bearer (\S+)$/)?.[1]??'',input=await c.req.json().catch(()=>null);return json(await publishNumericSource(runtimeBindings(c.env).DB,c.req.param('id'),token,input))}
    catch(error){const failure=describe(error);return json({error:failure.code,...failure.detail},failure.status)}
  })
  app.post('/goals/:id/sources',door(async({db,actor,params,input,form})=>{const source=await createNumericSource(db,actor,params.id,input);return form&&source.token?credentialDocument(params.id,source):source}))
  app.get('/goals/:id/sources',door(async({db,actor,params})=>({sources:await listNumericSources(db,actor,params.id)})))
  app.post('/metric-sources/:id/revoke',door(({db,actor,params})=>revokeNumericSource(db,actor,params.id)))
  app.post('/metric-sources/:id/csv-preview',door(({db,actor,params,input})=>previewNumericCsv(db,actor,params.id,input)))
  app.post('/metric-sources/:id/csv',door(({db,actor,params,input})=>commitNumericCsv(db,actor,params.id,input)))
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
