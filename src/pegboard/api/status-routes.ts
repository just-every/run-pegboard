import {generateStatusDraft} from '../status/model'
import { createRightsRequest, listRightsRequests, readRightsRequest, actOnRightsRequest } from '../status/rights'
import { discussionNotices, discussionPreference } from '../status/discussion'
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door, flag } from './door'
import { statusInbox } from '../status/inbox'
import { statusSubscription } from '../status/subscriptions'
import { saveDraft, readDraft, rejectDraft, reviewDraft, publishDraft, readRevision, statusHistory } from '../status/drafts'
import { revisionComments, addRevisionComment, changeRevisionComment } from '../status/comments'
const compose = (input: Record<string,any>, form: boolean) => form ? { ...input, sourceIds: input.sourceIds ?? [], recipients: (input.recipientIds ?? []).map((id:string)=>({id,channels:input.channels ?? []})), includeSubscribers: flag(input.includeSubscribers) } : input
const draftPage = (result:any) => `/app/${result.subjectType === 'project' ? 'projects' : 'portfolios'}/${result.subjectId}/status?draft=${result.id}`
export function statusRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/status-rights-requests', door(({db,actor,workspace,query}) => listRightsRequests(db,actor,workspace,query.has('at') ? Date.parse(query.get('at')!) : undefined)))
  app.post('/status-rights-requests', door(({db,actor,workspace,input}) => createRightsRequest(db,actor,workspace,input)))
  app.get('/status-rights-requests/:id', door(({db,actor,params,query}) => readRightsRequest(db,actor,params.id,query.has('at') ? Date.parse(query.get('at')!) : undefined)))
  app.post('/status-rights-requests/:id/actions', door(({db,actor,params,input}) => actOnRightsRequest(db,actor,params.id,input)))
  app.get('/status-subscriptions/:type/:id', door(({ db, actor, params }) => statusSubscription(db, actor, params.type, params.id)))
  app.post('/status-subscriptions/:type/:id', door(({ db, actor, params, input, form }) => statusSubscription(db, actor, params.type, params.id, form ? { ...input, enabled: flag(input.enabled), channels: input.channels ?? ['in_app'] } : input)))
  app.get('/status-inbox', door(({ db, actor }) => statusInbox(db, actor)))
  app.get('/status-digest', door(({ db, actor }) => statusInbox(db, actor)))
  app.get('/status-notices', door(({ db, actor }) => discussionNotices(db,actor)))
  app.get('/status-revisions/:id/preferences', door(({ db, actor, params }) => discussionPreference(db,actor,params.id)))
  app.post('/status-revisions/:id/preferences', door(({ db, actor, params, input, form }) => discussionPreference(db,actor,params.id,form ? { following: flag(input.following), muted: flag(input.muted) } : input)))
  app.post('/status-drafts/generate', door(({db,actor,env,input,form})=>generateStatusDraft(db,actor,env,form ? {...input,sourceIds:input.sourceIds ?? [],modelConsent:flag(input.modelConsent)} : input),{next:draftPage}))
  app.post('/status-drafts', door(({ db, actor, input, form }) => saveDraft(db, actor, compose(input,form)), {next:draftPage}))
  app.post('/status-drafts/:id/save', door(({db,actor,params,input,form})=>saveDraft(db,actor,compose(input,form),params.id),{next:draftPage}))
  app.get('/status-drafts/:id', door(({ db, actor, params }) => readDraft(db, actor, params.id)))
  app.patch('/status-drafts/:id', door(({ db, actor, params, input }) => saveDraft(db, actor, input, params.id)))
  app.post('/status-drafts/:id/reject', door(({ db, actor, params, input }) => rejectDraft(db, actor, params.id, input)))
  app.post('/status-drafts/:id/review', door(({ db, actor, params }) => reviewDraft(db, actor, params.id)))
  app.post('/status-drafts/:id/publish', door(({ db, actor, params, input }) => publishDraft(db, actor, params.id, input.token)))
  app.get('/status-revisions/:id', door(({ db, actor, params }) => readRevision(db, actor, params.id)))
  app.get('/status-revisions/:id/comments', door(({ db, actor, params }) => revisionComments(db, actor, params.id)))
  app.post('/status-revisions/:id/comments', door(({ db, actor, params, input, form }) => addRevisionComment(db, actor, params.id, form ? { ...input, internalOnly: flag(input.internalOnly) } : input)))
  app.patch('/status-revisions/:id/comments/:comment', door(({ db, actor, params, input }) => changeRevisionComment(db, actor, params.id, params.comment, input)))
  app.post('/status-revisions/:id/comments/:comment', door(({ db, actor, params, input, form }) => changeRevisionComment(db, actor, params.id, params.comment, form ? { ...input, delete: flag(input.delete) } : input)))
  app.get('/status-history/:type/:id', door(({ db, actor, params }) => statusHistory(db, actor, params.type, params.id)))
}
