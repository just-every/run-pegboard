import { previewFocusLock, commitFocusLock, previewRecovery, reviewView, recoveryProject, applyRecovery, reconcileRecovery, previewRecoveryUndo } from '../calendars/focus-recovery'
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { applyBlock, blockPreview, deleteBlock, previewBlock, projectBlocks, syncBlock } from '../calendars/blocks'
import { calendarSettings, connectCalendar, disconnectCalendar } from '../calendars/connections'
import { door, json } from './door'
const focusResult=(r:{id:string},input:Record<string,any>,form:boolean)=>form?new Response(null,{status:303,headers:{location:(typeof input._next==='string'&&/^\/app\/projects\/[a-z0-9_]+\/focus-recovery$/.test(input._next)?input._next:'/app/projects')+'?focusReview='+r.id,'cache-control':'no-store'}}):json(r)
export function calendarRoutes(app: Hono<{ Bindings: Bindings }>) {
 app.post('/calendar-blocks/:id/focus-preview', door(async({env,db,actor,params,input,form})=>focusResult(await previewFocusLock(env,db,actor,params.id,input),input,form)))
 app.post('/focus-reviews/:id/lock', door(({env,db,actor,params,input})=>commitFocusLock(env,db,actor,params.id,input)))
 app.post('/focus-recovery', door(async({env,db,actor,input,form})=>focusResult(await previewRecovery(env,db,actor,input),input,form)))
 app.get('/focus-reviews/:id', door(({db,actor,params})=>reviewView(db,actor,params.id)))
 app.get('/projects/:id/focus-recovery', door(({db,actor,params})=>recoveryProject(db,actor,params.id)))
 app.post('/focus-reviews/:id/apply', door(({env,db,actor,params,input})=>applyRecovery(env,db,actor,params.id,input)))
 app.post('/focus-reviews/:id/reconcile', door(({env,db,actor,params,input})=>reconcileRecovery(env,db,actor,params.id,input)))
 app.post('/focus-reviews/:id/undo-preview', door(async({env,db,actor,params,input,form})=>focusResult(await previewRecoveryUndo(env,db,actor,params.id,input),input,form)))
 app.get('/workspaces/:id/calendars', door(({ db, actor, params }) => calendarSettings(db, actor, params.id)))
 app.post('/workspaces/:id/calendars', door(({ env, db, actor, params, input }) => connectCalendar(env, db, actor, params.id, input), { next: () => '/app/settings/calendars' }))
 app.post('/calendars/:id/disconnect', door(({ db, actor, params }) => disconnectCalendar(db, actor, params.id), { next: () => '/app/settings/calendars' }))
 app.post('/calendar-preview', door(async ({env,db,actor,input,form}) => {const result=await previewBlock(env,db,actor,String(input.taskId),input);const path=typeof input._next==='string'&&/^\/app\/projects\/[a-z0-9_]+\/calendar$/.test(input._next)?input._next:'/app/settings/calendars';return form?new Response(null,{status:303,headers:{location:path+'?calendarPreview='+result.id,'cache-control':'no-store'}}):json(result)}))
 app.post('/tasks/:id/calendar-preview', door(({ env, db, actor, params, input }) => previewBlock(env, db, actor, params.id, input), { next: (r, { input }) => String(input._next ?? '/app/settings/calendars') + '?calendarPreview=' + r.id }))
 app.get('/calendar-previews/:id', door(({ db, actor, params }) => blockPreview(db, actor, params.id)))
 app.post('/calendar-previews/:id/apply', door(({ env, db, actor, params, input }) => applyBlock(env, db, actor, params.id, input)))
 app.post('/calendar-blocks/:id/sync', door(({ env, db, actor, params, input }) => syncBlock(env, db, actor, params.id, input)))
 app.post('/calendar-blocks/:id/delete', door(({ env, db, actor, params, input }) => deleteBlock(env, db, actor, params.id, input)))
 app.get('/projects/:id/calendar-blocks', door(({ db, actor, params }) => projectBlocks(db, actor, params.id)))
}
