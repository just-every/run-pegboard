import { all, bound, conflict, first, forbidden, invalid, newId, now, PegError } from '../db'
import { openTask } from '../tasks/access'
import { openProject, need } from '../workspace/projects'
import { displayNames, workspaceRole, type Actor } from '../workspace/people'
import { localDay, dayNumber } from '../tasks/personal'
import { historyStatement } from '../tasks/history'
import { auditStatement } from '../authorization/audit'
import { digest, guarded, revision } from '../decisions/revision'
import type { TaskRow, ProjectRow, SectionRow, TaskProjectRow, FieldRow } from '../model'
interface Config { mode:'calendar'|'completion'; unit:'day'|'week'|'month'; interval:number; timezone:string; start:string; end:string|null; count:number; exceptions:string[] }
export interface Snapshot { type:'task'|'project'; sourceId:string; project:ProjectRow|null; tasks:(TaskRow & {approval:boolean})[]; sections:SectionRow[]; homes:TaskProjectRow[]; fields:FieldRow[]; values:{task_id:string;field_id:string;value:string}[] }
import { activeGrants } from '../authorization/effective'
import { isAdministrator } from '../authorization/levels'
import { grantStatements } from '../authorization/grants'
import { reviewAudience, audienceChoices, unreachable, type Audience } from './audience'
interface Schedule {audience:string|null;held:number;attempted_at:number;id:string;template_id:string;workspace_id:string;created_by:string;config:string;next_date:string;last_object_id:string;generated:number;active:number;last_error:string|null}
interface Template {id:string;source_type:string;source_id:string;snapshot:string;workspace_id:string;version:number}
function date(value:unknown) { const d=String(value??'');dayNumber(d);return d }
function config(input:Record<string,any>):Config {
  const timezone=String(input.timezone??'America/New_York')
  try{new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format()}catch{throw invalid('timezone')}
  const interval=Number(input.interval??1),count=Number(input.count??52)
  if(!Number.isInteger(interval)||interval<1||interval>365||!Number.isInteger(count)||count<1||count>1000)throw invalid('recurrence_limits')
  const mode=input.mode??'calendar',unit=input.unit??'week'
  if(!['calendar','completion'].includes(mode)||!['day','week','month'].includes(unit))throw invalid('recurrence_schedule')
  const start=date(input.start),end=input.end?date(input.end):null
  if(end&&end<start)throw invalid('end_date')
  const raw=Array.isArray(input.exceptions)?input.exceptions:String(input.exceptions??'').split(',').filter(Boolean)
  if(raw.length>1000)throw invalid('exceptions')
  return {mode,unit,interval,timezone,start,end,count,exceptions:[...new Set(raw.map((d:unknown)=>date(String(d).trim())))] as string[]}
}
function advance(day:string,c:Config) {
  const d=new Date(day+'T12:00:00Z')
  if(c.unit==='month'){
    const requested=c.mode==='calendar'?Number(c.start.slice(-2)):d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+c.interval)
    const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(requested,last))
  }else d.setUTCDate(d.getUTCDate()+c.interval*(c.unit==='week'?7:1))
  return d.toISOString().slice(0,10)
}
function dates(c:Config,start=c.start,max=12) {
  const out:string[]=[];let d=start
  for(let n=0;n<2000&&out.length<Math.min(c.count,max);n++){
    if(c.end&&d>c.end)break
    if(!c.exceptions.includes(d))out.push(d)
    d=advance(d,c)
  }
  return out
}
async function snapshot(db:D1Database,actor:Actor,type:unknown,id:string):Promise<Snapshot> {
  let project:ProjectRow|null=null,roots:string[],sections:SectionRow[]=[],homes:TaskProjectRow[]=[]
  if(type==='project'){
    const opened=await openProject(db,actor,id);need(opened.effective,'manage_templates');project=opened.project
    roots=(await all<{task_id:string}>(db,'SELECT task_id FROM peg_task_projects WHERE project_id=?',id)).map(r=>r.task_id)
    sections=await all<SectionRow>(db,'SELECT * FROM peg_sections WHERE project_id=? ORDER BY position,id',id)
  }else if(type==='task'){
    const opened=await openTask(db,actor,id)
    if(opened.access.personal){if(opened.task.owner_id!==actor.id)throw forbidden('owner')}
    else if(![...opened.access.contexts.values()].every(a=>a.capabilities.has('manage_templates')))throw forbidden('manage_templates')
    // A recurring root keeps every project membership; hidden memberships cannot be copied.
    homes=await all<TaskProjectRow>(db,'SELECT * FROM peg_task_projects WHERE task_id=? ORDER BY project_id',opened.task.id)
    if(homes.some(h=>!opened.access.contexts.has(h.project_id)))throw forbidden('all_project_authority')
    if(opened.task.parent_id)throw invalid('recurring_root_required')
    roots=[opened.task.id]
  }else throw invalid('source_type')
  const tasks:Snapshot['tasks']=[],seen=new Set<string>(),queue=[...roots]
  while(queue.length){
    const taskId=queue.shift()!;if(seen.has(taskId))continue;seen.add(taskId)
    const {task,access}=await openTask(db,actor,taskId)
    if(access.role==='agent'||access.role==='guest')throw forbidden('human_template_authority')
    tasks.push({...task,approval:!!await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',task.id)})
    queue.push(...(await all<{id:string}>(db,'SELECT id FROM peg_tasks WHERE parent_id=? ORDER BY id',taskId)).map(t=>t.id))
    if(tasks.length>500)throw invalid('template_task_limit')
  }
  if(type==='project')homes=await all<TaskProjectRow>(db,'SELECT * FROM peg_task_projects WHERE project_id=? ORDER BY position,task_id',id)
  const workspace=project?.workspace_id??tasks[0]?.workspace_id
  if(!workspace||['agent','guest','analyst'].includes((await workspaceRole(db,actor.id,workspace))??''))throw forbidden('human_template_authority')
  const fields:FieldRow[]=[],values:{task_id:string;field_id:string;value:string}[]=[]
  for(const projectId of new Set(homes.map(h=>h.project_id))){
    const opened=await openProject(db,actor,projectId);need(opened.effective,'manage_fields')
    for(const field of await all<FieldRow>(db,'SELECT f.* FROM peg_field_definitions f JOIN peg_project_fields p ON p.field_id=f.id WHERE p.project_id=? ORDER BY f.id',projectId)){
      if(fields.some(f=>f.id===field.id))continue
      fields.push(field)
      for(const task of tasks){const value=await first<{task_id:string;field_id:string;value:string}>(db,'SELECT * FROM peg_field_values WHERE task_id=? AND field_id=?',task.id,field.id);if(value)values.push(value)}
    }
  }
  return {type:type as Snapshot['type'],sourceId:id,project,tasks,sections,homes,fields,values}
}
const selection=(input:Record<string,any>):string[]=>Array.isArray(input.grantIds)?input.grantIds.map(String):[]
export async function previewRecurrence(db:D1Database,actor:Actor,input:Record<string,any>) {
  const rev=await revision(db),plan=config(input),source=await snapshot(db,actor,input.sourceType,String(input.sourceId??''))
  const audience=await reviewAudience(db,actor,source,selection(input)),unreachableAssignees=await unreachable(db,actor,source,audience)
  return {config:plan,source,rev,audience,choices:await audienceChoices(db,actor,source),unreachableAssignees,token:await digest([source,plan,rev,audience]),occurrences:dates(plan),notice:'Review the standing internal audience for every occurrence. Guests, approve-only shares and external links are excluded and need a fresh reviewed share. Assignment never grants access. Decisions, time, comments and files are not copied.'}
}
export async function createRecurrence(db:D1Database,actor:Actor,input:Record<string,any>) {
  const view=await previewRecurrence(db,actor,input)
  if(input.revision!==view.token)throw conflict('recurrence_preview_changed')
  const id=newId('recurrence'),templateId=newId('template'),workspace=view.source.project?.workspace_id??view.source.tasks[0].workspace_id,at=now()
  await guarded(db,view.rev,[
    bound(db,'INSERT INTO peg_work_templates VALUES(?,?,?,?,?,?,?,?)',[templateId,workspace,view.source.type,view.source.sourceId,1,JSON.stringify(view.source),actor.id,at]),
    bound(db,'INSERT INTO peg_recurrences(id,template_id,workspace_id,created_by,config,next_date,last_object_id,created_at,audience) VALUES(?,?,?,?,?,?,?,?,?)',[id,templateId,workspace,actor.id,JSON.stringify(view.config),view.config.start,view.source.sourceId,at,JSON.stringify(view.audience)]),
    auditStatement(db,{workspaceId:workspace,actorId:actor.id,action:'recurrence.activated',targetType:view.source.type,targetId:view.source.sourceId,detail:{id,templateId,config:view.config,audience:view.audience}}),
  ])
  return {id,templateId}
}
async function load(db:D1Database,actor:Actor,id:string) {
  const schedule=await first<Schedule>(db,'SELECT * FROM peg_recurrences WHERE id=?',id)
  if(!schedule)throw forbidden('recurrence_owner')
  const template=(await first<Template>(db,'SELECT * FROM peg_work_templates WHERE id=?',schedule.template_id))!
  const source=JSON.parse(template.snapshot) as Snapshot,role=await workspaceRole(db,actor.id,schedule.workspace_id)
  let oversight=isAdministrator(role)
  if(role&&!['agent','guest','analyst'].includes(role))for(const projectId of new Set(source.project?[source.project.id]:source.homes.map(h=>h.project_id))){
    try{if((await openProject(db,actor,projectId)).effective.capabilities.has('manage_templates'))oversight=true}catch{}
  }
  if(!role||actor.id!==schedule.created_by&&!oversight)throw forbidden('recurrence_owner')
  return {schedule,template,source,plan:JSON.parse(schedule.config) as Config,oversight}
}
export async function recurrenceView(db:D1Database,actor:Actor,id:string) {
  const {schedule,source,plan}=await load(db,actor,id)
  let full=false
  try{await snapshot(db,actor,source.type,source.sourceId);full=true}catch{}
  const names=await displayNames(db,[schedule.created_by])
  const occurrences=await all<{local_date:string;object_id:string}>(db,'SELECT * FROM peg_occurrences WHERE schedule_id=? ORDER BY local_date',id)
  const reviews=[]
  for(const occurrence of occurrences){
    let canRead=false
    try{if(source.project)await openProject(db,actor,occurrence.object_id);else await openTask(db,actor,occurrence.object_id);canRead=true}catch{}
    const review=full||canRead?await first<{audience:string;unreachable:string}>(db,'SELECT * FROM peg_occurrence_reviews WHERE schedule_id=? AND local_date=?',id,occurrence.local_date):null
    reviews.push({...occurrence,...(review?{audience:JSON.parse(review.audience),unreachableAssignees:JSON.parse(review.unreachable)}:{})})
  }
  const {audience:stored,...metadata}=schedule
  return {objectType:source.type,schedule:metadata,title:full?(source.project?.name??source.tasks[0]?.title??'Recurring work'):'Recurring work',owner:names.get(schedule.created_by)??'Unavailable activator',canRun:actor.id===schedule.created_by,canReview:full&&actor.id===schedule.created_by,audience:full&&stored?JSON.parse(stored) as Audience:null,plan,occurrences:reviews,next:dates(plan,schedule.next_date)}
}
export async function listRecurrences(db:D1Database,actor:Actor,workspace:string) {
  if(!await workspaceRole(db,actor.id,workspace))throw forbidden()
  const out=[]
  for(const row of await all<{id:string}>(db,'SELECT id FROM peg_recurrences WHERE workspace_id=? ORDER BY created_at,id',workspace)){
    try{out.push(await recurrenceView(db,actor,row.id))}catch{}
  }
  return out
}
export async function rereviewRecurrence(db:D1Database,actor:Actor,id:string,input:Record<string,any>,commit=false) {
  const rev=await revision(db),{schedule,source}=await load(db,actor,id)
  if(schedule.created_by!==actor.id)throw forbidden('recurrence_owner')
  await snapshot(db,actor,source.type,source.sourceId)
  if(source.type==='task')for(const home of source.homes)need((await openProject(db,actor,home.project_id)).effective,'manage_templates')
  const audience=await reviewAudience(db,actor,source,selection(input)),token=await digest([id,rev,audience])
  const view={audience,token,choices:await audienceChoices(db,actor,source),unreachableAssignees:await unreachable(db,actor,source,audience)}
  if(commit){
    if(input.revision!==token)throw conflict('recurrence_preview_changed')
    await guarded(db,rev,[bound(db,'UPDATE peg_recurrences SET audience=?,held=0,last_error=NULL WHERE id=?',[JSON.stringify(audience),id]),auditStatement(db,{workspaceId:schedule.workspace_id,actorId:actor.id,action:'recurrence.audience_reviewed',targetType:'recurrence',targetId:id,detail:{audience}})])
  }
  return view
}
function shifted(value:string|null,from:string,to:string) {
  if(!value)return null
  const delta=(dayNumber(to)-dayNumber(from))*86400000
  return new Date(Date.parse(value.length===10?value+'T00:00:00Z':value)+delta).toISOString().slice(0,value.length===10?10:24)
}
async function generate(db:D1Database,actor:Actor,id:string) {
  const rev=await revision(db),{schedule:s,template,source,plan:c}=await load(db,actor,id)
  if(s.created_by!==actor.id)throw forbidden('recurrence_owner')
  if(!s.active||s.generated>=c.count)return {state:'finished'}
  if(s.held)return {state:'held',cause:s.last_error,ownerId:s.created_by}
  await snapshot(db,actor,template.source_type,template.source_id)
  const audience=await reviewAudience(db,actor,source,s.audience?(JSON.parse(s.audience) as Audience).grants.map(g=>g.id):[])
  if(source.project&&(!s.audience||audience.revision!==(JSON.parse(s.audience) as Audience).revision))throw conflict('audience_changed_review_required')
  const unreachableAssignees=await unreachable(db,actor,source,audience)
  let due=s.next_date
  if(c.mode==='completion'){
    const previous=source.type==='task'?await first<{status:string;completed_at:number|null}>(db,'SELECT status,completed_at FROM peg_tasks WHERE id=?',s.last_object_id):await first<{status:string;completed_at:number|null}>(db,'SELECT p.status,c.at completed_at FROM peg_projects p LEFT JOIN peg_project_completion c ON c.project_id=p.id WHERE p.id=?',s.last_object_id)
    if(!previous||!['done','completed'].includes(previous.status))return {state:'awaiting_completion'}
    if(previous.completed_at)due=advance(localDay(previous.completed_at,c.timezone),c)
  }
  while(c.exceptions.includes(due))due=advance(due,c)
  if(c.end&&due>c.end){await guarded(db,rev,[bound(db,'UPDATE peg_recurrences SET active=0 WHERE id=?',[id])]);return {state:'finished'}}
  if(due>localDay(now(),c.timezone))return {state:'waiting',date:due}
  const prior=await first<{object_id:string}>(db,'SELECT object_id FROM peg_occurrences WHERE schedule_id=? AND local_date=?',id,due)
  if(prior)return {state:'generated',id:prior.object_id}
  // The pinned template is what gets written, so authority is rechecked on every project it will land in, not only on the live source's.
  if(source.type==='task')for(const projectId of new Set(source.homes.map(h=>h.project_id)))need((await openProject(db,actor,projectId)).effective,'manage_templates')
  const at=now(),target=source.type==='project'?newId('prj'):newId('tsk'),taskIds=new Map(source.tasks.map(t=>[t.id,source.type==='task'&&t.id===source.sourceId?target:newId('tsk')])),sectionIds=new Map(source.sections.map(s=>[s.id,newId('sec')]))
  const statements:D1PreparedStatement[]=[bound(db,'INSERT INTO peg_occurrences VALUES(?,?,?,?,?)',[id,due,target,at,template.id]),bound(db,'INSERT INTO peg_occurrence_reviews VALUES(?,?,?,?)',[id,due,JSON.stringify(audience),JSON.stringify(unreachableAssignees.map(a=>({...a,taskId:taskIds.get(a.taskId)})))])]
  if(source.project){
    const p=source.project,a=audience.project!
    statements.push(bound(db,'INSERT INTO peg_projects(id,workspace_id,name,description,owner_id,visibility,team_id,team_level,workspace_level,start_date,due_date,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[target,p.workspace_id,`${p.name} · ${due}`,p.description,actor.id,a.visibility,a.team_id,a.team_level,a.workspace_level,shifted(p.start_date,c.start,due),shifted(p.due_date,c.start,due),actor.id,at]))
    for(const g of audience.grants){
      const grant=grantStatements(db,actor.id,p.workspace_id,{objectType:'project',objectId:target,granteeType:g.grantee_type,granteeId:g.grantee_id,level:g.level,scope:g.scope,scopes:g.scopes?.split(','),expiresAt:g.expires_at},{source:'direct',at})
      statements.push(...grant.statements,bound(db,'INSERT INTO peg_recurring_grants VALUES(?)',[grant.id]))
    }
  }
  for(const section of source.sections)statements.push(bound(db,'INSERT INTO peg_sections VALUES(?,?,?,?,?)',[sectionIds.get(section.id)!,target,section.name,section.position,section.maps_to]))
  for(const task of source.tasks){
    if(!await workspaceRole(db,task.owner_id,task.workspace_id))throw conflict('template_owner_unavailable')
    const taskId=taskIds.get(task.id)!
    statements.push(bound(db,'INSERT INTO peg_tasks(id,workspace_id,title,description,kind,parent_id,status,priority,start_date,due_date,owner_id,creator_id,estimate_hours,internal_only,internal_notes,created_at,updated_at) VALUES(?,?,?,?,?,?,\'todo\',?,?,?,?,?,?,?,?,?,?)',[taskId,task.workspace_id,task.title,task.description,task.kind,task.parent_id?taskIds.get(task.parent_id)??null:null,task.priority,shifted(task.start_date,c.start,due),shifted(task.due_date,c.start,due),task.owner_id,actor.id,task.estimate_hours,task.internal_only,task.internal_notes,at,at]),historyStatement(db,taskId,null,actor.id,'created',{templateId:template.id,sourceId:task.id,occurrence:due}),bound(db,'INSERT INTO peg_template_origins VALUES(?,?,?,?)',['task',taskId,template.id,task.id]))
    if(task.approval)statements.push(bound(db,'INSERT INTO peg_approval_tasks VALUES(?,?,?)',[taskId,actor.id,at]))
  }
  // Adopt the same library definitions. Forking them would split reports and later reviewed changes.
  // The immutable template may only be interpreted against the exact definitions it pinned.
  for(const field of source.fields){
    const live=await first<FieldRow>(db,'SELECT * FROM peg_field_definitions WHERE id=?',field.id)
    if(!live||live.version!==field.version)throw conflict('template_definition_changed')
    if(source.type==='project')statements.push(bound(db,'INSERT INTO peg_project_fields VALUES(?,?,?)',[target,field.key,field.id]))
  }
  for(const value of source.values){
    const field=source.fields.find(f=>f.id===value.field_id)!
    let input=JSON.parse(value.value)
    if(field.type==='rollup'&&Array.isArray(input))input=input.map(id=>taskIds.get(String(id))??id)
    statements.push(bound(db,'INSERT INTO peg_field_values VALUES(?,?,?)',[taskIds.get(value.task_id)!,value.field_id,JSON.stringify(input)]))
  }
  for(const home of source.homes)statements.push(bound(db,'INSERT INTO peg_task_projects(task_id,project_id,section_id,position,added_by,added_at) VALUES(?,?,?,?,?,?)',[taskIds.get(home.task_id)!,source.type==='project'?target:home.project_id,source.type==='project'?sectionIds.get(home.section_id??'')??null:home.section_id,home.position,actor.id,at]))
  if(source.type==='project')statements.push(bound(db,'INSERT INTO peg_template_origins VALUES(?,?,?,?)',['project',target,template.id,source.sourceId]))
  statements.push(bound(db,'UPDATE peg_recurrences SET next_date=?,last_object_id=?,generated=generated+1,active=?,held=0,last_error=NULL WHERE id=?',[advance(due,c),target,s.generated+1>=c.count?0:1,id]))
  await guarded(db,rev,statements)
  return {state:'generated',id:target,date:due,templateId:template.id,unreachableAssignees}
}
export async function stopRecurrence(db:D1Database,actor:Actor,id:string) {
  const rev=await revision(db);await load(db,actor,id)
  await guarded(db,rev,[bound(db,'UPDATE peg_recurrences SET active=0 WHERE id=?',[id])]);return {id,active:false}
}

/** Authorization failures become durable held work, visible even when the activator loses the source. */
export async function runRecurrence(db:D1Database,actor:Actor,id:string) {
  const {schedule}=await load(db,actor,id)
  if(schedule.created_by!==actor.id)throw forbidden('recurrence_owner')
  try{return await generate(db,actor,id)}catch(error){
    if(!(error instanceof PegError)||error.code==='review_changed')throw error
    const cause=error.code==='not_found'||error.code==='forbidden'?'source_or_target_authority_lost':error.code
    await db.prepare('UPDATE peg_recurrences SET held=1,last_error=?,attempted_at=? WHERE id=?').bind(cause,now(),id).run()
    return {state:'held',cause,ownerId:schedule.created_by}
  }
}
/** Fair retries: held work leaves the automatic queue, and waiting work goes behind untouched work. */
export async function processRecurrences(db:D1Database) {
  const pending=await all<Schedule>(db,'SELECT * FROM peg_recurrences WHERE active=1 AND held=0 ORDER BY attempted_at,next_date,id LIMIT 100')
  for(const s of pending){
    const actor:Actor={id:s.created_by,email:'',displayName:'',baseRole:'member'}
    try{await runRecurrence(db,actor,s.id)}catch{
      await db.prepare('UPDATE peg_recurrences SET held=1,last_error=? WHERE id=?').bind('generation_failed_review_required',s.id).run()
    }
    await db.prepare('UPDATE peg_recurrences SET attempted_at=? WHERE id=?').bind(now(),s.id).run()
  }
}
