import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { openProject, need, listProjects } from '../workspace/projects'
import { projectEffective } from '../authorization/effective'
import { workspaceRole, type Actor } from '../workspace/people'
import { projectParticipants } from '../tasks/participants'
import { openTask } from '../tasks/access'
import { prepareTask } from '../tasks/tasks'
import { historyStatement } from '../tasks/history'

interface Intent {
 id:string;actor_id:string;session_hash:string;source_id:string;source_url:string;title:string;excerpt:string;
 proof_hash:string;payload_hash:string;project_id:string|null;owner_id:string|null;review_revision:number|null;
 review_token:string|null;state:'pending'|'created'|'cancelled'|'erased';task_id:string|null;created_at:number;expires_at:number
}
const text = (value:unknown,max:number,code:string,empty=false) => {
 if(typeof value!=='string'||value.length>max||(!empty&&!value.trim())||value.includes('\0'))throw invalid(code)
 return value
}
export function safeSource(value:unknown) {
 const raw=text(value,2048,'capture_source')
 let url:URL
 try {url=new URL(raw)}catch{throw invalid('capture_source')}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw invalid('capture_source')
 url.search='';url.hash=''
 return url.href
}
async function own(db:D1Database,actor:Actor,session:string,id:string) {
 const intent=await first<Intent>(db,'SELECT * FROM peg_capture_intents WHERE id=? AND actor_id=? AND session_hash=?',id,actor.id,await digest(session))
 if(!intent)throw notFound()
 if(intent.state==='cancelled'||intent.state==='erased'||intent.expires_at<=now())throw conflict('capture_unavailable')
 return intent
}
export async function captureOptions(db:D1Database,actor:Actor,workspace:string,projectId?:string) {
 const role=await workspaceRole(db,actor.id,workspace)
 if(!role||role==='agent')throw forbidden('human_capture')
 const projects=[]
 for(const p of await listProjects(db,actor,workspace)){
  const {effective}=await openProject(db,actor,p.id)
  if(effective.capabilities.has('edit'))projects.push({value:p.id,label:p.name})
 }
 let people=[{value:actor.id,label:actor.displayName}]
 if(projectId){
  const {project,effective}=await openProject(db,actor,projectId);need(effective,'edit')
  if(project.workspace_id!==workspace)throw notFound()
  people=await projectParticipants(db,actor,projectId)
  if(!people.some(p=>p.value===actor.id))people.unshift({value:actor.id,label:actor.displayName})
 }
 return {projects,people}
}
export async function beginCapture(db:D1Database,actor:Actor,session:string,input:Record<string,unknown>) {
 const sourceId=text(input.sourceId,100,'capture_identity'),title=text(input.title,300,'capture_title'),excerpt=text(input.excerpt,12000,'capture_excerpt',true)
 const url=safeSource(input.url),proofHash=text(input.proofHash,64,'capture_proof')
 if(!/^[a-f0-9]{64}$/.test(proofHash))throw invalid('capture_proof')
 if(!await workspaceRole(db,actor.id,'ws_main'))throw forbidden('human_capture')
 if(await workspaceRole(db,actor.id,'ws_main')==='agent')throw forbidden('human_capture')
 const payloadHash=await digest([sourceId,title,excerpt,url,proofHash]),sessionHash=await digest(session)
 const prior=await first<Intent>(db,'SELECT * FROM peg_capture_intents WHERE actor_id=? AND source_id=?',actor.id,sourceId)
 if(prior){
  if(prior.payload_hash!==payloadHash||prior.session_hash!==sessionHash)throw conflict('capture_changed')
  return captureView(db,actor,session,prior.id)
 }
 const id=newId('capture'),at=now()
 await db.prepare('INSERT INTO peg_capture_intents(id,actor_id,session_hash,source_id,source_url,title,excerpt,proof_hash,payload_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,actor.id,sessionHash,sourceId,url,title,excerpt,proofHash,payloadHash,at,at+15*60*1000).run()
 return captureView(db,actor,session,id)
}
async function destination(db:D1Database,actor:Actor,projectId:string|null,ownerId:string) {
 if(!projectId){if(ownerId!==actor.id)throw forbidden('personal_capture_owner');return {name:'My tasks',visibility:'Private: only you',workspace:'ws_main'}}
 const {project,effective}=await openProject(db,actor,projectId);need(effective,'edit')
 const role=await workspaceRole(db,ownerId,project.workspace_id)
 if(!role||role==='agent')throw forbidden('capture_owner')
 const owner=await projectEffective(db,{id:ownerId,email:'',displayName:'',baseRole:'member'},project)
 if(!owner.capabilities.has('read'))throw forbidden('capture_owner')
 if(effective.role==='guest'&&!(await projectParticipants(db,actor,projectId)).some(p=>p.value===ownerId))throw forbidden('capture_owner')
 return {name:project.name,visibility:`Existing ${project.visibility} project audience; no new access`,workspace:project.workspace_id}
}
export async function captureView(db:D1Database,actor:Actor,session:string,id:string) {
 const intent=await own(db,actor,session,id)
 if(intent.task_id)await openTask(db,actor,intent.task_id)
 const target=intent.owner_id?await destination(db,actor,intent.project_id,intent.owner_id):null
 return {id:intent.id,sourceId:intent.source_id,url:intent.source_url,title:intent.title,excerpt:intent.excerpt,state:intent.state,taskId:intent.task_id,projectId:intent.project_id,ownerId:intent.owner_id,reviewToken:intent.review_token,target}
}
export async function reviewCapture(db:D1Database,actor:Actor,session:string,id:string,input:Record<string,unknown>) {
 const intent=await own(db,actor,session,id)
 if(intent.state!=='pending')throw conflict('capture_finished')
 const rev=await revision(db),projectId=typeof input.projectId==='string'&&input.projectId?input.projectId:null,ownerId=String(input.ownerId??actor.id)
 const target=await destination(db,actor,projectId,ownerId),token=await digest([id,rev.value,projectId,ownerId,target])
 await guarded(db,rev,[bound(db,'UPDATE peg_capture_intents SET project_id=?,owner_id=?,review_revision=?,review_token=? WHERE id=?',[projectId,ownerId,rev.value,token,id])])
 return captureView(db,actor,session,id)
}
export async function confirmCapture(db:D1Database,actor:Actor,session:string,id:string,input:Record<string,unknown>) {
 const intent=await own(db,actor,session,id),rev=await revision(db)
 if(intent.state==='created'){
  await destination(db,actor,intent.project_id,intent.owner_id!)
  await openTask(db,actor,intent.task_id!)
  return {id:intent.task_id,replayed:true}
 }
 if(!intent.owner_id||!intent.review_token||input.reviewToken!==intent.review_token||intent.review_revision!==rev.value)throw conflict('capture_review_changed')
 if(typeof input.proof!=='string'||await digest(input.proof)!==intent.proof_hash)throw forbidden('capture_source_permission')
 await destination(db,actor,intent.project_id,intent.owner_id)
 const task=await prepareTask(db,actor,{title:intent.title,description:intent.excerpt,ownerId:intent.owner_id,...(intent.project_id?{projectId:intent.project_id}:{})},{queueRules:false})
 try {
  await guarded(db,rev,[bound(db,'INSERT INTO peg_capture_guards VALUES(?,?)',[id,intent.review_token]),...task.statements,
   bound(db,'INSERT INTO peg_capture_sources VALUES(?,?,?,?,?,?)',[task.id,intent.id,intent.source_id,intent.source_url,actor.id,now()]),
   historyStatement(db,task.id,null,actor.id,'capture.created',{captureId:intent.id,sourceId:intent.source_id}),
   bound(db,"UPDATE peg_capture_intents SET state='created',task_id=?,excerpt='',title='',source_url='',proof_hash='' WHERE id=? AND state='pending'",[task.id,id])])
 }catch(error){
  const latest=await own(db,actor,session,id)
  if(latest.state==='created'&&latest.task_id){await openTask(db,actor,latest.task_id);return {id:latest.task_id,replayed:true}}
  throw error
 }
 return {id:task.id,replayed:false}
}
export async function cancelCapture(db:D1Database,actor:Actor,session:string,id:string) {
 const intent=await own(db,actor,session,id)
 if(intent.state!=='pending')throw conflict('capture_finished')
 await db.prepare("UPDATE peg_capture_intents SET state='cancelled',title='',excerpt='',source_url='',proof_hash='',review_token=NULL WHERE id=? AND state='pending'").bind(id).run()
 return {cancelled:true}
}
export const taskCaptureSources=(db:D1Database,taskId:string)=>all<{captureId:string;sourceId:string;url:string;capturedBy:string;at:number}>(db,'SELECT capture_id AS captureId,source_id AS sourceId,source_url AS url,captured_by AS capturedBy,captured_at AS at FROM peg_capture_sources WHERE task_id=?',taskId)
