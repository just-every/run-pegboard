import { approvalFollowupInbox, approvalFollowupLog, runFollowupDoor } from '../notices/approval-followup'
import { approveFollowupPolicy, previewFollowupPolicy, followupSettings } from '../notices/approval-policy'
import { approvalPreferences, saveApprovalPreferences } from '../notices/preferences'
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { muteReadinessTask, readinessNotices, readinessPreferences, saveReadinessPreferences } from '../notices'

export function noticeRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/notices/approval-followup', door(({ db, actor, workspace }) => approvalFollowupInbox(db, actor, workspace)))
  app.get('/notices/approval-followup/log', door(({ db, actor, workspace }) => approvalFollowupLog(db, actor, workspace)))
  app.post('/notices/approval-followup/schedule', door(({ db, actor, workspace }) => runFollowupDoor(db, actor, workspace)))
  app.post('/notices/approval-followup/dispatch', door(({ db, actor, workspace }) => runFollowupDoor(db, actor, workspace, true)))
  app.get('/notices/approval-followup/policy', door(({ db, actor, workspace }) => followupSettings(db, actor, workspace)))
  app.post('/notices/approval-followup/policy/preview', door(({ db, actor, workspace, input }) => previewFollowupPolicy(db, actor, workspace, input)))
  app.post('/notices/approval-followup/policy', door(({ db, actor, workspace, input }) => approveFollowupPolicy(db, actor, workspace, input), { next: () => '/app/settings/approval-followup' }))
  app.get('/notices/approval-followup/preferences', door(({ db, actor, workspace }) => approvalPreferences(db, actor, workspace)))
  app.post('/notices/approval-followup/preferences', door(({ db, actor, workspace, input }) => saveApprovalPreferences(db, actor, workspace, input), { next: () => '/app/settings/approval-followup' }))
  app.get('/notices/readiness', door(({ db, actor, workspace }) => readinessNotices(db, actor, workspace)))
  app.post('/notices/readiness/dispatch', door(({ db, actor, workspace }) => readinessNotices(db, actor, workspace), { next: () => '/app/inbox' }))
  app.get('/notices/readiness/preferences', door(({ db, actor, workspace }) => readinessPreferences(db, actor, workspace)))
  app.post('/notices/readiness/preferences', door(({ db, actor, workspace, input }) => saveReadinessPreferences(db, actor, workspace, input), { next: () => '/app/inbox' }))
  app.post('/tasks/:id/readiness-preferences', door(({ db, actor, params, input }) => muteReadinessTask(db, actor, params.id, input), { next: () => '/app/inbox' }))
}
