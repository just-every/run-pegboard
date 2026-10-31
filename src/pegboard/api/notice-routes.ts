import {flag} from './door'
import {internalNotices,changeInternalNotice} from '../notices/dispatch'
import {internalNoticePolicy,saveInternalNoticePolicy} from '../notices/events'
import {internalPreferences,saveInternalPreferences,saveTaskNoticePreferences} from '../notices/preferences'
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { muteReadinessTask, readinessNotices, readinessPreferences, saveReadinessPreferences } from '../notices'

export function noticeRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/notices', door(({db,actor,workspace})=>internalNotices(db,actor,workspace)))
  app.get('/notices/policy',door(({db,actor,workspace})=>internalNoticePolicy(db,actor,workspace)))
  app.post('/notices/policy',door(({db,actor,workspace,input})=>saveInternalNoticePolicy(db,actor,workspace,flag(input.enabled)),{next:()=>'/app/settings/notices'}))
  app.get('/notices/preferences',door(({db,actor,workspace})=>internalPreferences(db,actor,workspace)))
  app.post('/notices/preferences',door(({db,actor,workspace,input})=>saveInternalPreferences(db,actor,workspace,input),{next:()=>'/app/settings/notices'}))
  app.post('/notices/:id/state',door(({db,actor,workspace,params,input})=>changeInternalNotice(db,actor,workspace,params.id,{
    ...(input.read===undefined?{}:{read:flag(input.read)}),
    ...(input.snoozedUntil===undefined?{}:{snoozedUntil:input.snoozedUntil===''?null:Number(input.snoozedUntil)})
  }),{next:()=>'/app/inbox'}))
  app.post('/tasks/:id/notice-preferences',door(({db,actor,params,input})=>saveTaskNoticePreferences(db,actor,params.id,input),{next:(_, {params})=>`/app/tasks/${params.id}`}))
  app.get('/notices/readiness', door(({ db, actor, workspace }) => readinessNotices(db, actor, workspace)))
  app.post('/notices/readiness/dispatch', door(({ db, actor, workspace }) => readinessNotices(db, actor, workspace), { next: () => '/app/inbox' }))
  app.get('/notices/readiness/preferences', door(({ db, actor, workspace }) => readinessPreferences(db, actor, workspace)))
  app.post('/notices/readiness/preferences', door(({ db, actor, workspace, input }) => saveReadinessPreferences(db, actor, workspace, input), { next: () => '/app/inbox' }))
  app.post('/tasks/:id/readiness-preferences', door(({ db, actor, params, input }) => muteReadinessTask(db, actor, params.id, input), { next: () => '/app/inbox' }))
}
