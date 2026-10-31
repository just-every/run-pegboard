import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { auditStatement } from '../authorization/audit'
import { openProject, need } from '../workspace/projects'
import { operatorRow, workspaceRole, type Actor } from '../workspace/people'
import { workspaceCalendar } from '../schedule/availability'

export interface IntakeField { id: string; label: string; required: boolean; choices?: string[]; when?: { field: string; equals: string } }
export interface Definition { fields: IntakeField[]; mapping: { title: string; description: string[]; ownerId: string | null; priority: string }; hours: number }
export interface FormRow { erased_custody: number; id: string; project_id: string; version: number; name: string; definition: string; publisher_id: string | null; publisher_version: number | null; published_version: number | null; published_calendar: string | null; public_hash: string | null; revoked_at: number | null }
export const text = (v: unknown, max = 200): string => { if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) throw invalid('intake_input'); return v.trim() }
export async function administer(db: D1Database, actor: Actor, projectId: string) {
 const opened = await openProject(db, actor, projectId)
 need(opened.effective, 'manage_settings')
 if (!['owner','admin'].includes(opened.effective.role ?? '') || actor.apiScope) throw forbidden('intake_admin')
 return opened
}
export async function formRow(db: D1Database, id: string) { const row = await first<FormRow>(db,'SELECT * FROM peg_intake_forms WHERE id=?',id); if (!row) throw notFound(); return row }
export async function checkedDefinition(db: D1Database, actor: Actor, projectId: string, input: Record<string,any>): Promise<Definition> {
 const {project} = await administer(db,actor,projectId)
 const fields = input.fields
 if (!Array.isArray(fields) || fields.length < 1 || fields.length > 12) throw invalid('intake_fields')
 const known = new Map<string,IntakeField>()
 const clean: IntakeField[] = fields.map((field:any) => {
  const id = text(field?.id,40), label = text(field?.label,120)
  if (!/^[a-z][a-z0-9_]*$/.test(id) || known.has(id) || typeof field.required !== 'boolean') throw invalid('intake_fields')
  const choices = field.choices === undefined ? undefined : field.choices
  if (choices !== undefined && (!Array.isArray(choices) || choices.length < 2 || choices.length > 12 || choices.some(v=>typeof v!=='string') || new Set(choices).size !== choices.length)) throw invalid('intake_choices')
  const result:IntakeField = {id,label,required:field.required,...(choices?{choices:choices.map((v:string)=>text(v,100))}:{})}
  if (field.when !== undefined) {
   const parent = known.get(field.when?.field)
   if (!parent?.choices?.includes(field.when?.equals)) throw invalid('intake_branch')
   result.when={field:parent.id,equals:field.when.equals}
  }
  known.set(id,result); return result
 })
 const m=input.mapping
 if (!m || !known.get(m.title)?.required || known.get(m.title)?.when || !Array.isArray(m.description) || m.description.some((v:unknown)=>typeof v!=='string'||!known.has(v)) || new Set(m.description).size!==m.description.length) throw invalid('intake_mapping')
 const mapped=new Set<string>([m.title,...m.description])
 if(clean.some(field=>!mapped.has(field.id)))throw invalid('intake_unmapped_answer')
 if (!['low','normal','high','urgent'].includes(m.priority)) throw invalid('intake_priority')
 const role=await workspaceRole(db,text(m.ownerId,100),project.workspace_id)
 if (!role || ['guest','agent'].includes(role)) throw invalid('intake_owner')
 const hours=Number(input.hours)
 if (!Number.isInteger(hours)||hours<1||hours>80) throw invalid('intake_hours')
 return {fields:clean,mapping:{title:m.title,description:m.description,ownerId:m.ownerId,priority:m.priority},hours}
}
export async function saveForm(db:D1Database,actor:Actor,projectId:string,input:Record<string,any>,id?:string) {
 const rev=await revision(db), {project}=await administer(db,actor,projectId)
 const definition=await checkedDefinition(db,actor,projectId,input), name=text(input.name,120)
 const previous=id?await formRow(db,id):null
 if(previous && (previous.project_id!==projectId||Number(input.version)!==previous.version))throw conflict('intake_version')
 const formId=previous?.id??newId('form'),version=(previous?.version??0)+1
 await guarded(db,rev,[previous?bound(db,'UPDATE peg_intake_forms SET version=?,name=?,definition=?,publisher_id=NULL,publisher_version=NULL,published_version=NULL,public_hash=NULL,revoked_at=NULL,erased_custody=0 WHERE id=?',[version,name,JSON.stringify(definition),formId]):bound(db,'INSERT INTO peg_intake_forms(id,project_id,version,name,definition,created_by,created_at) VALUES(?,?,?,?,?,?,?)',[formId,projectId,version,name,JSON.stringify(definition),actor.id,now()]),auditStatement(db,{workspaceId:project.workspace_id,actorId:actor.id,action:'intake.draft_saved',targetType:'form',targetId:formId,detail:{version}})])
 return {id:formId,version}
}
export async function reviewForm(db:D1Database,actor:Actor,id:string) {
 const row=await formRow(db,id),{project}=await administer(db,actor,row.project_id),rev=await revision(db)
 const definition=JSON.parse(row.definition) as Definition,calendar=await workspaceCalendar(db,project.workspace_id)
 return {id:row.id,name:row.name,version:row.version,custodyBlocked:!!row.erased_custody,project:{id:project.id,name:project.name},definition,calendar,published:row.published_version===row.version&&!row.revoked_at,public:!!row.public_hash,review:await digest([row.id,row.version,row.definition,calendar,rev.value,actor.id])}
}
export async function publishForm(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const rev=await revision(db),row=await formRow(db,id),review=await reviewForm(db,actor,id)
 if(row.erased_custody)throw conflict('intake_custody_review_required')
 if(input.review!==review.review||Number(input.version)!==row.version||!['internal','public'].includes(input.audience)||!(input.consent===true||input.consent==='on'))throw conflict('intake_review_required')
 await checkedDefinition(db,actor,row.project_id,{...review.definition})
 const publisher=await operatorRow(db,actor.id),capability=input.audience==='public'?newId('intake')+newId('cap'):null
 await guarded(db,rev,[bound(db,'UPDATE peg_intake_forms SET publisher_id=?,publisher_version=?,published_version=version,published_calendar=?,public_hash=?,revoked_at=NULL WHERE id=?',[actor.id,publisher!.version,JSON.stringify(review.calendar),capability?await digest(capability):null,id]),auditStatement(db,{workspaceId:(await administer(db,actor,row.project_id)).project.workspace_id,actorId:actor.id,action:'intake.published',targetType:'form',targetId:id,detail:{version:row.version,public:!!capability}})])
 return {id,version:row.version,capability}
}
export async function revokeForm(db:D1Database,actor:Actor,id:string) {
 const row=await formRow(db,id);await administer(db,actor,row.project_id)
 await batch(db,[bound(db,'UPDATE peg_intake_forms SET revoked_at=?,public_hash=NULL WHERE id=?',[now(),id])]);return {ok:true}
}
export async function published(db:D1Database,row:FormRow) {
 if(row.erased_custody||row.revoked_at||row.published_version!==row.version||!row.publisher_id)throw notFound()
 const person=await operatorRow(db,row.publisher_id)
 if(!person||person.version!==row.publisher_version||person.status!=='active')throw notFound()
 const actor:Actor={id:person.id,email:person.email,displayName:person.display_name,baseRole:person.role as Actor['baseRole']}
 await administer(db,actor,row.project_id)
 const definition=JSON.parse(row.definition) as Definition
 const {project}=await openProject(db,actor,row.project_id)
 if(!definition.mapping.ownerId)throw notFound()
 const role=await workspaceRole(db,definition.mapping.ownerId,project.workspace_id)
 if(!role||['guest','agent'].includes(role))throw notFound()
 return {actor,definition,project}
}
export async function publicForm(db:D1Database,cap:string) {
 if(!/^intake_[a-f0-9]{20}cap_[a-f0-9]{20}$/.test(cap))throw notFound()
 const row=await first<FormRow>(db,'SELECT * FROM peg_intake_forms WHERE public_hash=?',await digest(cap))
 if(!row)throw notFound();await published(db,row);return row
}
export const safeForm=(row:FormRow)=>({id:row.id,name:row.name,version:row.version,fields:(JSON.parse(row.definition) as Definition).fields,attachments:false})
export async function internalForm(db:D1Database,actor:Actor,id:string) {
 const row=await formRow(db,id),{effective}=await openProject(db,actor,row.project_id);need(effective,'edit')
 if(['guest','agent'].includes(effective.role??''))throw forbidden('intake_member')
 await published(db,row);return row
}
export async function projectForms(db:D1Database,actor:Actor,projectId:string) {
 await administer(db,actor,projectId)
 return all<Pick<FormRow,'id'|'name'|'version'|'published_version'|'public_hash'|'revoked_at'>>(db,'SELECT id,name,version,published_version,(public_hash IS NOT NULL) public_hash,revoked_at FROM peg_intake_forms WHERE project_id=? ORDER BY created_at',projectId)
}

/** Exact identity references, without copying form prompts or capability material. */
export async function formErasureScope(db:D1Database,person:string) {
 const rows=await all<{id:string;project_id:string;version:number;author:number;publisher:number;mapped_owner:number}>(db,`SELECT id,project_id,version,created_by=? author,publisher_id IS ? publisher,json_extract(definition,'$.mapping.ownerId') IS ? mapped_owner FROM peg_intake_forms WHERE created_by=? OR publisher_id=? OR json_extract(definition,'$.mapping.ownerId')=? ORDER BY id`,person,person,person,person,person,person)
 return rows.map(row=>({id:row.id,projectId:row.project_id,version:row.version,author:!!row.author,publisher:!!row.publisher,mappedOwner:!!row.mapped_owner,publication:'inactive_until_new_draft_review' as const}))
}
export function formErasureStatements(db:D1Database,person:string,forms:Awaited<ReturnType<typeof formErasureScope>>,at:number) {
 return forms.map(form=>bound(db,`UPDATE peg_intake_forms SET created_by=CASE WHEN created_by=? THEN 'erased' ELSE created_by END,publisher_id=CASE WHEN publisher_id=? THEN NULL ELSE publisher_id END,publisher_version=CASE WHEN publisher_id=? THEN NULL ELSE publisher_version END,definition=CASE WHEN json_extract(definition,'$.mapping.ownerId')=? THEN json_set(definition,'$.mapping.ownerId',NULL) ELSE definition END,version=version+1,erased_custody=1,published_version=NULL,public_hash=NULL,revoked_at=? WHERE id=?`,[person,person,person,person,at,form.id]))
}
