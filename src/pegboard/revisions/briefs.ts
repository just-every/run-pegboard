import { all, bound, conflict, first, forbidden, invalid, notFound, now } from '../db'
import { guarded, revision } from '../decisions/revision'
import { openProject } from '../workspace/projects'
import { displayNames, type Actor } from '../workspace/people'
import { permanentEvent } from '../audit/search'

interface VersionRow {project_id:string;version:number;text:string;actor_id:string;created_at:number;restored_from:number|null}
export interface BriefVersion {version:number;text:string;actorId:string;actor:string;createdAt:number;restoredFrom:number|null}
export interface BriefView {
 project:{id:string;name:string};version:number;text:string;canEdit:boolean;versions:BriefVersion[];
 comparison:{from:BriefVersion;to:BriefVersion;changed:boolean}|null
}
export interface BriefInput {text?:unknown;version?:unknown;fromVersion?:unknown}
export interface BriefComparison {fromVersion?:unknown;toVersion?:unknown}
const versionNumber=(value:unknown,zero=false)=>{
 if(typeof value!=='number'&&typeof value!=='string')throw invalid('brief_version')
 if(value==='')throw invalid('brief_version')
 const number=Number(value)
 if(!Number.isSafeInteger(number)||number<(zero?0:1))throw invalid('brief_version')
 return number
}
async function authority(db:D1Database,actor:Actor,id:string,write=false) {
 const opened=await openProject(db,actor,id)
 if(await first(db,"SELECT 1 FROM peg_data_erased_objects WHERE object_type='project' AND object_id=?",id))throw notFound()
 const canEdit=opened.effective.capabilities.has('edit')&&opened.effective.role!=='agent'
 if(write&&!canEdit)throw forbidden('brief_edit')
 return {...opened,canEdit}
}
export async function briefView(db:D1Database,actor:Actor,id:string,comparison:BriefComparison={}):Promise<BriefView> {
 const {project,canEdit}=await authority(db,actor,id)
 const rows=await all<VersionRow>(db,'SELECT * FROM peg_brief_versions WHERE project_id=? ORDER BY version DESC',id)
 const names=await displayNames(db,rows.map(row=>row.actor_id))
 const versions:BriefVersion[]=rows.map(row=>({version:row.version,text:row.text,actorId:row.actor_id,actor:names.get(row.actor_id)??'Former member',createdAt:row.created_at,restoredFrom:row.restored_from}))
 let selected:BriefView['comparison']=null
 const supplied=comparison.fromVersion!==undefined||comparison.toVersion!==undefined
 if(supplied){
  const from=versions.find(row=>row.version===versionNumber(comparison.fromVersion)),to=versions.find(row=>row.version===versionNumber(comparison.toVersion))
  if(!from||!to)throw notFound()
  selected={from,to,changed:from.text!==to.text}
 }
 return {project:{id:project.id,name:project.name},version:versions[0]?.version??0,text:versions[0]?.text??'',canEdit,versions,comparison:selected}
}
async function append(db:D1Database,actor:Actor,id:string,input:BriefInput,restore:boolean):Promise<BriefVersion> {
 const rev=await revision(db)
 await authority(db,actor,id,true)
 const current=await first<{version:number}>(db,'SELECT MAX(version) version FROM peg_brief_versions WHERE project_id=?',id)
 const expected=versionNumber(input.version,true)
 if(expected!==(current?.version??0))throw conflict('brief_revision_changed')
 let text:string,restoredFrom:number|null=null
 if(restore){
  restoredFrom=versionNumber(input.fromVersion)
  const source=await first<VersionRow>(db,'SELECT * FROM peg_brief_versions WHERE project_id=? AND version=?',id,restoredFrom)
  if(!source)throw notFound()
  text=source.text
 }else{
  if(typeof input.text!=='string'||input.text.length>100000)throw invalid('brief_text')
  text=input.text
 }
 const version=expected+1,at=now()
 await guarded(db,rev,[bound(db,'INSERT INTO peg_brief_versions VALUES(?,?,?,?,?,?)',[id,version,text,actor.id,at,restoredFrom]),permanentEvent(db,{workspace:(await openProject(db,actor,id)).project.workspace_id,actor:actor.id,action:restore?'brief.restored':'brief.revised',type:'project',id})])
 const names=await displayNames(db,[actor.id])
 return {version,text,actorId:actor.id,actor:names.get(actor.id)??'Former member',createdAt:at,restoredFrom}
}
export const saveBrief=(db:D1Database,actor:Actor,id:string,input:BriefInput)=>append(db,actor,id,input,false)
export const restoreBrief=(db:D1Database,actor:Actor,id:string,input:BriefInput)=>append(db,actor,id,input,true)
