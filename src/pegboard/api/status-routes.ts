import { discussionNotices, discussionPreference } from '../status/discussion'
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door, flag } from './door'
import { statusInbox } from '../status/inbox'
import { statusSubscription } from '../status/subscriptions'
import { saveDraft, readDraft, rejectDraft, reviewDraft, publishDraft, readRevision, statusHistory } from '../status/drafts'
import { revisionComments, addRevisionComment, changeRevisionComment } from '../status/comments'
export function statusRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/status-subscriptions/:type/:id', door(({ db, actor, params }) => statusSubscription(db, actor, params.type, params.id)))
  app.post('/status-subscriptions/:type/:id', door(({ db, actor, params, input, form }) => statusSubscription(db, actor, params.type, params.id, form ? { ...input, enabled: flag(input.enabled), channels: input.channels ?? ['in_app'] } : input)))
  app.get('/status-inbox', door(({ db, actor }) => statusInbox(db, actor)))
  app.get('/status-digest', door(({ db, actor }) => statusInbox(db, actor)))
  app.get('/status-notices', door(({ db, actor }) => discussionNotices(db,actor)))
  app.get('/status-revisions/:id/preferences', door(({ db, actor, params }) => discussionPreference(db,actor,params.id)))
  app.post('/status-revisions/:id/preferences', door(({ db, actor, params, input, form }) => discussionPreference(db,actor,params.id,form ? { following: flag(input.following), muted: flag(input.muted) } : input)))
  app.post('/status-drafts', door(({ db, actor, input }) => saveDraft(db, actor, input)))
  app.get('/status-drafts/:id', door(({ db, actor, params }) => readDraft(db, actor, params.id)))
  app.patch('/status-drafts/:id', door(({ db, actor, params, input }) => saveDraft(db, actor, input, params.id)))
  app.post('/status-drafts/:id/reject', door(({ db, actor, params, input }) => rejectDraft(db, actor, params.id, input)))
  app.post('/status-drafts/:id/review', door(({ db, actor, params }) => reviewDraft(db, actor, params.id)))
  app.post('/status-drafts/:id/publish', door(({ db, actor, params, input }) => publishDraft(db, actor, params.id, input.token)))
  app.get('/status-revisions/:id', door(({ db, actor, params }) => readRevision(db, actor, params.id)))
  app.get('/status-revisions/:id/comments', door(({ db, actor, params }) => revisionComments(db, actor, params.id)))
  app.post('/status-revisions/:id/comments', door(({ db, actor, params, input, form }) => addRevisionComment(db, actor, params.id, form ? { ...input, internalOnly: flag(input.internalOnly) } : input)))
  app.patch('/status-revisions/:id/comments/:comment', door(({ db, actor, params, input }) => changeRevisionComment(db, actor, params.id, params.comment, input)))
  app.get('/status-history/:type/:id', door(({ db, actor, params }) => statusHistory(db, actor, params.type, params.id)))
}
