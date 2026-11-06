import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now, PegError } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { openProject, need } from '../workspace/projects'
import { operatorRow, workspaceRole, type Actor } from '../workspace/people'
import { projectParticipants } from '../tasks/participants'
import { projectEffective, rootOf } from '../authorization/effective'
import { openTask } from '../tasks/access'
import { permanentEvent } from '../audit/search'

interface Draft { id:string; project_id:string; author_id:string; version:number; subject:string; body:string; links:string; recipients:string; corrects_id:string|null; created_at:number; updated_at:number; inactive:number }
interface Publication { id:string; root_id:string; draft_id:string; draft_version:number; project_id:string; author_id:string; subject:string; body:string; links:string; recipients:string; corrects_id:string|null; published_at:number; inactive:number }
interface Comment { id:string; root_id:string; publication_id:string; parent_id:string|null; author_id:string; body:string; revision:number; deleted_at:number|null; created_at:number; updated_at:number; operation_key:string }
const text=(value:unknown,max:number)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw invalid('message_text');return value.trim()}
const ids=(value:unknown,max:number)=>{if(!Array.isArray(value)||value.length>max||value.some(v=>typeof v!=='string'||!v||v.length>100)||new Set(value).size!==value.length)throw invalid('message_selection');return [...value].sort() as string[]}
const denied=(e:unknown)=>e instanceof PegError&&[403,404].includes(e.status)
async function human(db:D1Database,actor:Actor,workspace:string) {
 if(!['owner','admin','manager','member'].includes(await workspaceRole(db,actor.id,workspace)??''))throw forbidden('active_internal_human')
}
async function publisher(db:D1Database,actor:Actor,projectId:string) {
 const opened=await openProject(db,actor,projectId);await human(db,actor,opened.project.workspace_id);need(opened.effective,'manage_settings');return opened
}
async function person(db:D1Database,id:string):Promise<Actor> {
 const row=await operatorRow(db,id);if(!row||row.status!=='active')throw notFound()
 return {id,email:row.email,displayName:row.display_name,baseRole:row.role==='owner'||row.role==='admin'?row.role:'member'}
}
/** Administrative custody alone never adds a person to the announcement directory. */
export async function messageParticipants(db:D1Database,actor:Actor,projectId:string) {
 const {project}=await publisher(db,actor,projectId), people=[]
 for(const option of await projectParticipants(db,actor,projectId))if(['owner','admin','manager','member'].includes(await workspaceRole(db,option.value,project.workspace_id)??''))people.push(option)
 return people
}
async function eligible(db:D1Database,actor:Actor,projectId:string) {
 const {project,effective}=await openProject(db,actor,projectId);await human(db,actor,project.workspace_id)
 if(!effective.paths.some(p=>p.source!=='role'&&p.capabilities.includes('read')))throw notFound()
 return {project,effective}
}
async function link(db:D1Database,actor:Actor,projectId:string,id:string) {
 const {task,access}=await openTask(db,actor,id)
 if(!access.contexts.has(projectId))throw notFound()
 const root=await rootOf(db,task)
 return {id:task.id,title:task.title,updatedAt:task.updated_at,internalOnly:task.internal_only,membership:await all(db,'SELECT project_id FROM peg_task_projects WHERE task_id=? ORDER BY project_id',root.id)}
}
async function readable(db:D1Database,actor:Actor,row:Pick<Publication,'project_id'|'links'>) {
 const opened=await eligible(db,actor,row.project_id)
 for(const saved of JSON.parse(row.links))await link(db,actor,row.project_id,saved.id)
 return opened
}
const decode=(row:Draft)=>({...row,links:JSON.parse(row.links),recipients:JSON.parse(row.recipients) as string[]})
async function draft(db:D1Database,actor:Actor,id:string) {
 const row=await first<Draft>(db,'SELECT * FROM peg_message_drafts WHERE id=?',id)
 if(!row||row.inactive)throw notFound()
 await publisher(db,actor,row.project_id)
 if(row.author_id!==actor.id)throw forbidden('message_author')
 return row
}
export async function saveMessage(db:D1Database,actor:Actor,projectId:string,input:Record<string,any>,id?:string) {
 const rev=await revision(db), {project}=await publisher(db,actor,projectId), previous=id?await draft(db,actor,id):null
 if(previous&&(previous.project_id!==projectId||input.version!==previous.version))throw conflict('stale_message_draft')
 if(previous&&await first(db,'SELECT 1 FROM peg_message_publications WHERE draft_id=?',id!))throw conflict('message_already_published')
 const subject=text(input.subject,180), body=text(input.body,10000), linked=ids(input.linkIds??[],20), recipients=ids(input.recipients,100)
 if(!recipients.length)throw invalid('message_audience_required')
 const choices=new Set((await messageParticipants(db,actor,projectId)).map(p=>p.value))
 if(recipients.some(p=>!choices.has(p)))throw forbidden('project_participant_required')
 const links=[];for(const taskId of linked)links.push(await link(db,actor,projectId,taskId))
 const corrects=previous?.corrects_id??input.correctsId??null
 if(corrects){
  const original=await openMessage(db,actor,corrects)
  if(original.row.project_id!==projectId||JSON.stringify(recipients)!==original.row.recipients)throw invalid('message_correction_audience')
  if(original.latest.id!==corrects)throw conflict('stale_message_correction')
 }
 const nextId=previous?.id??newId('message'),at=now(),version=(previous?.version??0)+1
 await guarded(db,rev,[previous?
  bound(db,'UPDATE peg_message_drafts SET subject=?,body=?,links=?,recipients=?,version=version+1,updated_at=? WHERE id=? AND version=?',[subject,body,JSON.stringify(links),JSON.stringify(recipients),at,nextId,previous.version]):
  bound(db,'INSERT INTO peg_message_drafts VALUES(?,?,?,?,?,?,?,?,?,?,?,0)',[nextId,projectId,actor.id,version,subject,body,JSON.stringify(links),JSON.stringify(recipients),corrects,at,at]),
  permanentEvent(db,{workspace:project.workspace_id,actor:actor.id,action:'message.draft_saved',type:'project',id:projectId,metadata:{id:nextId,version}})])
 return readMessageDraft(db,actor,nextId)
}
export async function readMessageDraft(db:D1Database,actor:Actor,id:string) {
 const row=await draft(db,actor,id);await readable(db,actor,row)
 return decode(row)
}
async function reviewed(db:D1Database,actor:Actor,id:string) {
 const rev=await revision(db), row=await draft(db,actor,id), view=decode(row)
 if(await first(db,'SELECT 1 FROM peg_message_publications WHERE draft_id=?',id))throw conflict('message_already_published')
 const choices=new Map((await messageParticipants(db,actor,row.project_id)).map(p=>[p.value,p.label]))
 const names=[]
 for(const recipient of view.recipients){
  if(!choices.has(recipient))throw forbidden('project_participant_required')
  await readable(db,await person(db,recipient),row)
  names.push({id:recipient,name:choices.get(recipient)!})
 }
 for(const saved of view.links)if(JSON.stringify(saved)!==JSON.stringify(await link(db,actor,row.project_id,saved.id)))throw conflict('stale_message_work')
 let root:string|null=null
 if(row.corrects_id){const prior=await openMessage(db,actor,row.corrects_id);if(prior.latest.id!==row.corrects_id)throw conflict('stale_message_correction');root=prior.row.root_id}
 return {row,rev,root,names,token:await digest([actor.id,row,rev])}
}
export async function reviewMessage(db:D1Database,actor:Actor,id:string) {
 const {row,names,token}=await reviewed(db,actor,id)
 return {...decode(row),audience:names,token}
}
const event=(db:D1Database,workspace:string,actor:Actor,action:string,id:string,version?:number)=>permanentEvent(db,{workspace,actor:actor.id,action,type:'message',id,metadata:{version}})
function notice(db:D1Database,root:string,publication:string,eventId:string,recipient:string,kind:string,at:number) {
 return bound(db,"INSERT INTO peg_message_notices VALUES(?,?,?,?,?,?,?,'active')",[newId('notice'),root,publication,eventId,recipient,kind,at])
}
export async function publishMessage(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const {row,rev,root,token}=await reviewed(db,actor,id)
 if(input.token!==token||input.confirm!==true)throw conflict('message_review_required')
 const publication=newId('publication'),thread=root??publication,at=now(),{project}=await publisher(db,actor,row.project_id)
 const notices=[]
 for(const recipient of JSON.parse(row.recipients) as string[]){
  const pref=root?await preference(db,root,recipient):{following:true,muted:false}
  if(!pref.muted&&pref.following)notices.push(notice(db,thread,publication,publication,recipient,'publication',at))
 }
 await guarded(db,rev,[bound(db,'INSERT INTO peg_message_publications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0)',[publication,thread,id,row.version,row.project_id,actor.id,row.subject,row.body,row.links,row.recipients,row.corrects_id,at]),...notices,event(db,project.workspace_id,actor,'message.published',publication,row.version)])
 return {id:publication,rootId:thread}
}
async function preference(db:D1Database,root:string,operator:string) {
 const p=await first<{following:number;muted:number}>(db,'SELECT following,muted FROM peg_message_preferences WHERE root_id=? AND operator_id=?',root,operator)
 return {following:p?p.following===1:true,muted:p?p.muted===1:false}
}
export async function openMessage(db:D1Database,actor:Actor,id:string) {
 const row=await first<Publication>(db,'SELECT * FROM peg_message_publications WHERE id=?',id)
 if(!row||row.inactive)throw notFound()
 const {project,effective}=await readable(db,actor,row)
 if(row.author_id!==actor.id&&!(JSON.parse(row.recipients) as string[]).includes(actor.id))throw notFound()
 const publications=await all<Publication>(db,'SELECT * FROM peg_message_publications WHERE root_id=? ORDER BY published_at,id',row.root_id)
 for(const publication of publications){if(publication.inactive)throw notFound();await readable(db,actor,publication)}
 const latest=publications.find(p=>!publications.some(c=>c.corrects_id===p.id))!
 return {row,project,effective,publications,latest}
}
export async function readMessage(db:D1Database,actor:Actor,id:string) {
 const rev=await revision(db), opened=await openMessage(db,actor,id),{row,publications,effective}=opened
 const comments=await all<Comment>(db,'SELECT * FROM peg_message_comments WHERE root_id=? ORDER BY created_at,id',row.root_id)
 const history=await all<{comment_id:string;revision:number;body:string;deleted_at:number|null;author_id:string;at:number}>(db,'SELECT h.* FROM peg_message_comment_history h JOIN peg_message_comments c ON c.id=h.comment_id WHERE c.root_id=? ORDER BY h.at,h.id',row.root_id)
 return {id:row.root_id,projectId:row.project_id,projectName:opened.project.name,latestId:opened.latest.id,
  publications:publications.map(p=>({...p,links:JSON.parse(p.links).map((s:any)=>({id:s.id,title:s.title,href:'/app/tasks/'+s.id})),recipients:JSON.parse(p.recipients)})),
  comments:comments.map(c=>({...c,body:c.deleted_at?'':c.body,editable:c.author_id===actor.id&&!c.deleted_at})),history,
  preferences:await preference(db,row.root_id,actor.id),canReply:effective.capabilities.has('comment'),canPublish:effective.capabilities.has('manage_settings'),token:await digest([actor.id,row.root_id,rev])}
}
async function threadWrite(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const rev=await revision(db),opened=await openMessage(db,actor,id)
 if(input.token!==await digest([actor.id,opened.row.root_id,rev]))throw conflict('stale_message_thread')
 return {...opened,rev}
}
export async function messagePreference(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const {row,rev}=await threadWrite(db,actor,id,input)
 if(typeof input.following!=='boolean'||typeof input.muted!=='boolean')throw invalid('message_preferences')
 await guarded(db,rev,[bound(db,'INSERT INTO peg_message_preferences VALUES(?,?,?,?) ON CONFLICT(root_id,operator_id) DO UPDATE SET following=excluded.following,muted=excluded.muted',[row.root_id,actor.id,Number(input.following),Number(input.muted)])])
 return preference(db,row.root_id,actor.id)
}
export async function replyMessage(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const {row,rev,effective,project}=await threadWrite(db,actor,id,input);need(effective,'comment')
 const body=text(input.body,10000),key=text(input.key,100),mentions=ids(input.mentions??[],20)
 const audience=JSON.parse(row.recipients) as string[]
 if(mentions.some(id=>!audience.includes(id)))throw forbidden('reviewed_recipient_required')
 if(await first(db,'SELECT 1 FROM peg_message_comments WHERE author_id=? AND operation_key=?',actor.id,key))throw conflict('message_reply_replayed')
 const parent=input.parentId||null
 if(parent&&!await first(db,'SELECT 1 FROM peg_message_comments WHERE id=? AND root_id=? AND deleted_at IS NULL',parent,row.root_id))throw invalid('message_parent')
 const comment=newId('reply'),at=now(),notices=[]
 for(const recipient of new Set([...audience,row.author_id]))if(recipient!==actor.id){
  try{const target=await person(db,recipient);await openMessage(db,target,id);const pref=await preference(db,row.root_id,recipient);if(pref.following&&!pref.muted)notices.push(notice(db,row.root_id,id,comment,recipient,'reply',at))}catch(e){if(!denied(e))throw e}
 }
 await guarded(db,rev,[bound(db,'INSERT INTO peg_message_comments VALUES(?,?,?,?,?,?,1,NULL,?,?,?)',[comment,row.root_id,id,parent,actor.id,body,at,at,key]),bound(db,'INSERT INTO peg_message_comment_history VALUES(?,?,?,?,?,NULL,?)',[newId('revision'),comment,actor.id,1,body,at]),...notices,event(db,project.workspace_id,actor,'message.replied',comment,1)])
 return {id:comment,revision:1,publicationId:id,rootId:row.root_id}
}
export async function changeMessageReply(db:D1Database,actor:Actor,id:string,commentId:string,input:Record<string,any>) {
 const {row,rev,effective,project}=await threadWrite(db,actor,id,input);need(effective,'comment')
 const c=await first<Comment>(db,'SELECT * FROM peg_message_comments WHERE id=? AND root_id=?',commentId,row.root_id)
 if(!c)throw notFound()
 if(c.author_id!==actor.id)throw forbidden('message_reply_author')
 if(c.revision!==input.revision||c.deleted_at)throw conflict('stale_message_reply')
 if(!['edit','delete'].includes(input.action))throw invalid('message_reply_action')
 const at=now(),body=input.action==='delete'?'':text(input.body,10000),deleted=input.action==='delete'?at:null
 await guarded(db,rev,[bound(db,'UPDATE peg_message_comments SET body=?,deleted_at=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',[body,deleted,at,c.id,c.revision]),bound(db,'INSERT INTO peg_message_comment_history VALUES(?,?,?,?,?,?,?)',[newId('revision'),c.id,actor.id,c.revision+1,body,deleted,at]),event(db,project.workspace_id,actor,'message.reply_'+input.action,c.id,c.revision+1)])
 return {id:c.id,revision:c.revision+1}
}
export async function listMessages(db:D1Database,actor:Actor,projectId:string) {
 const {project}=await eligible(db,actor,projectId), publications=[]
 for(const r of await all<{id:string}>(db,'SELECT id FROM peg_message_publications WHERE project_id=? AND id=root_id ORDER BY published_at DESC,id',projectId))try{const view=await readMessage(db,actor,r.id);publications.push({id:view.id,subject:view.publications.find(p=>p.id===view.latestId)!.subject})}catch(e){if(!denied(e))throw e}
 let canPublish=false
 try{await publisher(db,actor,projectId);canPublish=true}catch(e){if(!denied(e))throw e}
 const drafts=canPublish?await all<{id:string;subject:string}>(db,'SELECT id,subject FROM peg_message_drafts d WHERE project_id=? AND author_id=? AND inactive=0 AND NOT EXISTS(SELECT 1 FROM peg_message_publications p WHERE p.draft_id=d.id) ORDER BY updated_at DESC,id',projectId,actor.id):[]
 return {projectId,projectName:project.name,canPublish,publications,drafts}
}
export async function messageInbox(db:D1Database,actor:Actor) {
 const rows=await all<{id:string;root_id:string;publication_id:string;event_id:string;recipient_id:string;kind:string;created_at:number}>(db,"SELECT * FROM peg_message_notices WHERE recipient_id=? AND state='active' ORDER BY created_at DESC,id",actor.id),notices=[]
 for(const n of rows)try{
  const view=await readMessage(db,actor,n.publication_id)
  if(view.preferences.muted||!view.preferences.following)continue
  const publication=view.publications.find(p=>p.id===n.publication_id)!,reply=n.kind==='reply'?view.comments.find(c=>c.id===n.event_id):null
  if(n.kind==='reply'&&(!reply||reply.deleted_at))continue
  notices.push({id:n.id,rootId:n.root_id,publicationId:n.publication_id,eventId:n.event_id,recipientId:actor.id,kind:n.kind,subject:publication.subject,body:reply?.body??publication.body,authorId:reply?.author_id??publication.author_id,createdAt:n.created_at,href:'/app/messages/'+n.publication_id+(reply?'#'+reply.id:'')})
 }catch(e){if(!denied(e))throw e;await bound(db,"UPDATE peg_message_notices SET state='cancelled' WHERE id=?",[n.id]).run()}
 return {notices}
}
