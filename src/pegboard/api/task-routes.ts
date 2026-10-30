import {projectParticipants,taskParticipants} from '../tasks/participants'
import {openTask} from '../tasks/access'
import { visibilityPreview, sharePersonal, saveSettings, section, place, addRule, activateRule, undoMove, personalMeta } from '../tasks/personal'
// /api/v1: tasks, their projects, fields, comments and files, and the lists a person starts from.
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { invalid } from '../db'
import { myTasks } from '../tasks/board'
import { addToProject, createTask, moveToProject, removeFromProject, setProjectFields, setSection, updateTask } from '../tasks/tasks'
import { addAttachment, addComment, readAttachment, viewTask } from '../tasks/view'
import { door, flag } from './door'

type App = Hono<{ Bindings: Bindings }>
const task = (id: string) => `/app/tasks/${id}`
/** A form's fields are strings: carry only what was filled in, and read the one checkbox. */
const filled = (input: Record<string, any>) => Object.fromEntries(Object.entries(input).filter(([key, value]) => !key.startsWith('_') && value !== '' && value !== undefined))

export function taskRoutes(app: App) {
  app.get('/projects/:id/participants', door(async ({actor,db,params}) => ({participants:await projectParticipants(db,actor,params.id)})))
  app.get('/tasks/:id/participants', door(async ({actor,db,params}) => {const {access}=await openTask(db,actor,params.id);if(!access.capabilities.has('edit'))return {participants:[]};return {participants:await taskParticipants(db,actor,access)}}))
  app.post('/tasks', door(async ({ actor, db, workspace, input, form }) => {
    const created = await createTask(db, actor, { ...filled(input), workspaceId: workspace, estimateHours: input.estimateHours === undefined || input.estimateHours === '' ? undefined : Number(input.estimateHours), internalOnly: form ? flag(input.internalOnly) : input.internalOnly } as never)
    return { id: created.id, status: created.status }
  }, { next: (result, { input }) => input._next ? String(input._next) : task(result.id) }))
  app.get('/tasks/:id', door(({ actor, db, params }) => viewTask(db, actor, params.id)))
  app.get('/refs/:ref', door(({ actor, db, params }) => viewTask(db, actor, params.ref)))
  app.patch('/tasks/:id', door(async ({ actor, db, params, input }) => { const updated = await updateTask(db, actor, params.id, input); return { id: updated.id, status: updated.status } }))
  app.post('/tasks/:id/update', door(async ({ actor, db, params, input }) => {
    const patch = filled(input) as Record<string, any>
    if (patch.estimateHours !== undefined) patch.estimateHours = Number(patch.estimateHours)
    if ('internalOnly_present' in input) patch.internalOnly = flag(input.internalOnly)
    if (input.dueDate === '' ) patch.dueDate = null
    else if(input.dueDateKind==='instant'&&typeof patch.dueDate==='string'){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(patch.dueDate)||Number.isNaN(Date.parse(patch.dueDate+'Z'))||new Date(patch.dueDate+'Z').toISOString().slice(0,10)!==patch.dueDate.slice(0,10))throw invalid('due_date');patch.dueDate=new Date(patch.dueDate+'Z').toISOString()}
    if (typeof patch.collaborators === 'string') patch.collaborators = patch.collaborators.split(',').map((part: string) => part.trim()).filter(Boolean)
    const updated = await updateTask(db, actor, params.id, patch); return { id: updated.id }
  }, { next: (_, { params }) => task(params.id) }))
  app.post('/tasks/:id/complete', door(async ({ actor, db, params, input }) => { await updateTask(db, actor, params.id, { status: input.reopen ? 'todo' : 'done' }); return { ok: true } }, { next: (_, { params }) => task(params.id) }))
  app.post('/tasks/:id/projects', door(({ actor, db, params, input }) => addToProject(db, actor, params.id, input as never), { next: (_, { params }) => task(params.id) }))
  app.post('/tasks/:id/move', door(({ actor, db, params, input }) => moveToProject(db, actor, params.id, input as never), { next: (_, { params }) => task(params.id) }))
  app.delete('/tasks/:id/projects/:project', door(async ({ actor, db, params }) => { await removeFromProject(db, actor, params.id, params.project) }))
  app.post('/tasks/:id/projects/:project/remove', door(async ({ actor, db, params }) => { await removeFromProject(db, actor, params.id, params.project) }, { next: (_, { params }) => task(params.id) }))
  app.post('/tasks/:id/section', door(async ({ actor, db, params, input }) => { await setSection(db, actor, params.id, input.projectId, input.sectionId) }, { next: (_, { params }) => task(params.id) }))
  app.post('/tasks/:id/fields', door(async ({ actor, db, params, input, form }) => {
    const values = form ? Object.fromEntries(Object.entries(input).filter(([key]) => key.startsWith('field:')).map(([key, value]) => [key.slice(6), value as string])) : input.values
    if (!values || typeof values !== 'object') throw invalid('values')
    await setProjectFields(db, actor, params.id, input.projectId, values)
  }, { next: (_, { params }) => task(params.id) }))
  app.post('/tasks/:id/comments', door(async ({ actor, db, params, input }) => {
    let body=input.body
    if(input.mentionId){const view=await viewTask(db,actor,params.id),choice=view.mentionChoices.find(c=>c.value===input.mentionId);if(!choice)throw invalid('mention_participant');body='@'+choice.label.split(' · ')[0]+' '+String(body??'')}
    return addComment(db, actor, params.id, body, flag(input.internalOnly))
  }, { next: (_, { params }) => task(params.id) }))
  app.post('/tasks/:id/attachments', door(async ({ actor, db, params, request, query }) => {
    const type = request.headers.get('content-type') ?? ''
    if (type.includes('multipart/form-data')) {
      const data = await request.formData(), file = data.get('file')
      if (!(file instanceof File)) throw invalid('file')
      return addAttachment(db, actor, params.id, { projectId: String(data.get('projectId') ?? '') || undefined, name: file.name, contentType: file.type, bytes: await file.arrayBuffer() })
    }
    return addAttachment(db, actor, params.id, { projectId: query.get('projectId') ?? undefined, name: query.get('name') ?? 'file', contentType: type, bytes: await request.arrayBuffer() })
  }, { raw: true }))
  app.get('/attachments/:id', door(async ({ actor, db, params }) => {
    const file = await readAttachment(db, actor, params.id)
    return new Response(file.bytes, { headers: { 'content-type': file.contentType, 'content-disposition': `attachment; filename="${file.name}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } })
  }))
  app.get('/my-tasks', door(async ({ actor, db, query }) => ({ tasks: await myTasks(db, actor, query.get('on')??undefined), ...await personalMeta(db,actor) })))
  app.post('/my-tasks/settings',door(({actor,db,input})=>saveSettings(db,actor,input)))
  app.post('/my-tasks/sections',door(({actor,db,input})=>section(db,actor,input as never)))
  app.post('/my-tasks/:id/layout',door(({actor,db,params,input,form})=>place(db,actor,params.id,{...input,...('today' in input?{today:form?flag(input.today):input.today}:{})})))
  app.post('/my-tasks/rules',door(({actor,db,input})=>addRule(db,actor,input as never)))
  app.post('/my-tasks/rules/:id/activate',door(({actor,db,params,input})=>activateRule(db,actor,params.id,input.confirm),{next:()=>'/app/my-tasks'}))
  app.post('/my-tasks/moves/:id/undo',door(({actor,db,params})=>undoMove(db,actor,params.id)))
  app.get('/tasks/:id/visibility-preview',door(({actor,db,params,query})=>visibilityPreview(db,actor,params.id,query.get('projectId')??'')))
  app.post('/tasks/:id/share-personal',door(({actor,db,params,input})=>sharePersonal(db,actor,params.id,input as never),{next:(_, {params})=>task(params.id)}))
}
