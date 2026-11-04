import { PDFDocument } from 'pdf-lib'
import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now, placeholders } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { internalProof, proofFile } from '../records/custody'
import { displayNames, type Actor } from '../workspace/people'
import { permanentEvent } from '../audit/search'

interface Feedback {
  id:string;proof_id:string;version_id:string;attachment_id:string;digest:string;page:number;x:number;y:number;
  author_id:string;body:string;state:'open'|'resolved';revision:number;operation_key:string;created_at:number;updated_at:number
}
interface History {id:string;feedback_id:string;proof_id:string;version_id:string;actor_id:string;body:string;state:string;revision:number;at:number}
const text=(value:unknown,max:number,code:string)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw invalid(code);return value.trim()}
async function pdfVersion(db:D1Database,actor:Actor,id:string,versionId:string){
  const source=await proofFile(db,actor,id,versionId)
  if(source.file.contentType!=='application/pdf')throw invalid('pdf_required')
  let document:PDFDocument
  try{document=await PDFDocument.load(source.file.bytes,{updateMetadata:false,throwOnInvalidObject:true})}catch{throw invalid('pdf_unavailable')}
  const pages=document.getPages().map(page=>({width:page.getWidth(),height:page.getHeight()}))
  if(!pages.length)throw invalid('pdf_unavailable')
  return {...source,pages}
}
export async function feedbackView(db:D1Database,actor:Actor,id:string,left?:string,right?:string){
  const rev=await revision(db),context=await internalProof(db,actor,id)
  const selected=[...new Set([left||context.proof.current_version||'',right].filter((v):v is string=>!!v))]
  const documents:Array<Awaited<ReturnType<typeof pdfVersion>>['version'] & {pages:{width:number;height:number}[]}>=[]
  for(const versionId of selected){const v=await pdfVersion(db,actor,id,versionId);documents.push({...v.version,pages:v.pages})}
  const feedback=await all<Feedback>(db,`SELECT * FROM peg_proof_feedback WHERE proof_id=? AND version_id IN (${placeholders(selected)}) ORDER BY created_at,id`,id,...selected)
  const history=await all<History>(db,`SELECT * FROM peg_proof_feedback_history WHERE proof_id=? AND version_id IN (${placeholders(selected)}) ORDER BY revision,id`,id,...selected)
  const names=Object.fromEntries(await displayNames(db,[...feedback.map(f=>f.author_id),...history.map(h=>h.actor_id)]))
  const tokens=Object.fromEntries(await Promise.all(documents.map(async d=>[d.id,await digest([actor.id,rev,context.proof,[d],feedback.filter(f=>f.version_id===d.id)])])))
  return {id,taskId:context.task.id,title:context.task.title,currentVersion:context.versions.some(v=>v.id===context.proof.current_version)?context.proof.current_version:null,
    versions:context.versions.filter(v=>v.contentType==='application/pdf'),documents,
    feedback:feedback.map(({operation_key,...f})=>({...f,canEdit:f.author_id===actor.id&&documents.some(d=>d.id===f.version_id&&d.canComment)})),history,names,
    token:await digest([actor.id,rev,context.proof,documents,feedback]),tokens,rev}
}
export async function createFeedback(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
  const versionId=text(input.versionId,100,'feedback_version'),view=await feedbackView(db,actor,id,versionId),document=view.documents[0]
  if(!document.canComment)throw forbidden('comment')
  const key=text(input.key,100,'feedback_key'),body=text(input.body,5000,'feedback_body')
  const page=Number(input.page),x=Number(input.x),y=Number(input.y)
  if(!Number.isInteger(page)||page<1||page>document.pages.length||input.x===undefined||input.y===undefined||input.x===''||input.y===''||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)throw invalid('feedback_position')
  const prior=await first<Feedback>(db,'SELECT * FROM peg_proof_feedback WHERE author_id=? AND operation_key=?',actor.id,key)
  if(prior){
    const original=await first<History>(db,'SELECT * FROM peg_proof_feedback_history WHERE feedback_id=? AND revision=1',prior.id)
    if(prior.proof_id!==id||prior.version_id!==versionId||prior.page!==page||prior.x!==x||prior.y!==y||original?.body!==body)throw conflict('feedback_key_changed')
    return {id:prior.id,versionId,replayed:true}
  }
  if(input.token!==view.token)throw conflict('stale_feedback')
  const feedbackId=newId('feedback'),at=now()
  await guarded(db,view.rev,[bound(db,'INSERT INTO peg_proof_feedback VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[feedbackId,id,versionId,document.attachment_id,document.digest,page,x,y,actor.id,body,'open',1,key,at,at]),
    bound(db,'INSERT INTO peg_proof_feedback_history VALUES(?,?,?,?,?,?,?,?,?)',[newId('feedbackevent'),feedbackId,id,versionId,actor.id,body,'open',1,at]),
    permanentEvent(db,{workspace:(await internalProof(db,actor,id)).task.workspace_id,actor:actor.id,action:'proof.feedback_created',type:'proof',id,metadata:{id:feedbackId,sourceId:versionId,version:1}})])
  return {id:feedbackId,versionId,replayed:false}
}
export async function updateFeedback(db:D1Database,actor:Actor,id:string,feedbackId:string,input:Record<string,any>){
  const view=await feedbackView(db,actor,id,text(input.versionId,100,'feedback_version')),pin=view.feedback.find(f=>f.id===feedbackId)
  if(!pin)throw notFound()
  if(!pin.canEdit)throw forbidden('feedback_author')
  const body=text(input.body,5000,'feedback_body'),state=input.state
  if(state!=='open'&&state!=='resolved')throw invalid('feedback_state')
  if(Number(input.revision)!==pin.revision||input.token!==view.token)throw conflict('stale_feedback')
  const next=pin.revision+1,at=now()
  await guarded(db,view.rev,[bound(db,'UPDATE peg_proof_feedback SET body=?,state=?,revision=?,updated_at=? WHERE id=?',[body,state,next,at,pin.id]),
    bound(db,'INSERT INTO peg_proof_feedback_history VALUES(?,?,?,?,?,?,?,?,?)',[newId('feedbackevent'),pin.id,id,pin.version_id,actor.id,body,state,next,at]),
    permanentEvent(db,{workspace:(await internalProof(db,actor,id)).task.workspace_id,actor:actor.id,action:'proof.feedback_changed',type:'proof',id,metadata:{id:pin.id,sourceId:pin.version_id,version:next}})])
  return {id:pin.id,versionId:pin.version_id,revision:next,state}
}
