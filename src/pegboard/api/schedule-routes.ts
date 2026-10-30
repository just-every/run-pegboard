import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { applyChange, approveChange, submittedChange, pendingChange, pendingSets, rejectChange, undoChange } from '../schedule/changes'
import { moveInput, planChange } from '../schedule/plan'
import { createBaseline, scheduleView } from '../schedule/timeline'

/** Moves arrive as JSON, or from a form as one task with a start and due. */
const movesOf = (input: Record<string, any>) => Array.isArray(input.moves) ? input.moves : [{ taskId: input.taskId, ...(input.start !== undefined ? { start: input.start } : {}), ...(input.due !== undefined ? { due: input.due } : {}) }]
export function scheduleRoutes(app: Hono<{ Bindings: Bindings }>) {
  const back = (_: unknown, { input }: { input: Record<string, any> }) => String(input.projectId ? `/app/projects/${input.projectId}/timeline` : '/app')
  app.get('/projects/:id/schedule', door(({ db, actor, params, query }) => scheduleView(db, actor, params.id, { baselineId: query.get('baseline') ?? undefined })))
  app.post('/projects/:id/baselines', door(({ db, actor, params, input }) => createBaseline(db, actor, params.id, input.name), { next: (_r, { params }) => `/app/projects/${params.id}/timeline` }))
  app.post('/schedule/preview', door(async ({ db, actor, input }) => planChange(db, actor, moveInput(movesOf(input))).then(({ all, ...plan }) => plan)))
  app.post('/schedule/apply', door(({ db, actor, input }) => applyChange(db, actor, { moves: movesOf(input), revision: input.revision, approverId: input.approverId || undefined }), { next: back }))
  app.get('/schedule/pending', door(({ db, actor, workspace }) => pendingSets(db, actor, workspace).then(pending => ({ pending }))))
  app.get('/schedule/sets/:id/status', door(({ db, actor, params }) => submittedChange(db, actor, params.id)))
  app.get('/schedule/sets/:id', door(({ db, actor, params }) => pendingChange(db, actor, params.id)))
  app.post('/schedule/sets/:id/approve', door(({ db, actor, params, input }) => approveChange(db, actor, params.id, { revision: input.revision }), { next: back }))
  app.post('/schedule/sets/:id/reject', door(({ db, actor, params }) => rejectChange(db, actor, params.id), { next: back }))
  app.post('/schedule/sets/:id/undo', door(({ db, actor, params }) => undoChange(db, actor, params.id), { next: back }))
}
