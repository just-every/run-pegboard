import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { invalid } from '../db'
import { saveMessage, readMessageDraft, reviewMessage, publishMessage, readMessage, listMessages, messageParticipants, replyMessage, changeMessageReply, messagePreference, messageInbox } from '../messages/messages'
// Browser forms and JSON use the same services, with explicit conversion at the form boundary.
function formInput(input:Record<string,any>,form:boolean) {
 if(!form)return input
 const out={...input}
 for(const key of ['version','revision'])if(key in out){if(!/^[1-9][0-9]*$/.test(out[key])||!Number.isSafeInteger(Number(out[key])))throw invalid('message_version');out[key]=Number(out[key])}
 for(const key of ['confirm','following','muted'])if(key in out){if(!['true','false'].includes(out[key]))throw invalid('message_boolean');out[key]=out[key]==='true'}
 if('subject' in out){out.recipients??=[];out.linkIds??=[]}
 return out
}
export function messageRoutes(app:Hono<{Bindings:Bindings}>) {
 app.get('/message-notices',door(({db,actor})=>messageInbox(db,actor)))
 app.get('/projects/:id/messages/participants',door(({db,actor,params})=>messageParticipants(db,actor,params.id)))
 app.get('/projects/:id/messages',door(({db,actor,params})=>listMessages(db,actor,params.id)))
 app.post('/projects/:id/messages',door(({db,actor,params,input,form})=>saveMessage(db,actor,params.id,formInput(input,form)),{next:r=>'/app/message-drafts/'+r.id}))
 app.get('/message-drafts/:id',door(({db,actor,params})=>readMessageDraft(db,actor,params.id)))
 app.post('/message-drafts/:id/save',door(async({db,actor,params,input,form})=>{const d=await readMessageDraft(db,actor,params.id);return saveMessage(db,actor,d.project_id,formInput(input,form),params.id)},{next:r=>'/app/message-drafts/'+r.id}))
 app.post('/message-drafts/:id/review',door(({db,actor,params})=>reviewMessage(db,actor,params.id),{next:r=>'/app/message-drafts/'+r.id+'?review=true'}))
 app.post('/message-drafts/:id/publish',door(({db,actor,params,input,form})=>publishMessage(db,actor,params.id,formInput(input,form)),{next:r=>'/app/messages/'+r.id}))
 app.get('/messages/:id',door(({db,actor,params})=>readMessage(db,actor,params.id)))
 app.post('/messages/:id/replies',door(({db,actor,params,input,form})=>replyMessage(db,actor,params.id,formInput(input,form)),{next:(_,d)=>'/app/messages/'+d.params.id}))
 app.post('/messages/:id/replies/:comment',door(({db,actor,params,input,form})=>changeMessageReply(db,actor,params.id,params.comment,formInput(input,form)),{next:(_,d)=>'/app/messages/'+d.params.id+'#'+d.params.comment}))
 app.post('/messages/:id/preferences',door(({db,actor,params,input,form})=>messagePreference(db,actor,params.id,formInput(input,form)),{next:(_,d)=>'/app/messages/'+d.params.id}))
}
