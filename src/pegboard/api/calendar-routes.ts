import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { applyBlock, blockPreview, deleteBlock, previewBlock, projectBlocks, syncBlock } from '../calendars/blocks'
import { calendarSettings, connectCalendar, disconnectCalendar } from '../calendars/connections'
import { door, json } from './door'
export function calendarRoutes(app: Hono<{ Bindings: Bindings }>) {
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
