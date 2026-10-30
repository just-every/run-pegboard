import { all, first, PegError } from '../db'
import { openTask } from '../tasks/access'
import { sheetView } from '../time/time'
import { capacityMember, capacityPeople } from '../capacity/profiles'
import { spread, workloadView } from '../capacity/workload'
import { decisionPreview } from '../decisions/tasks'
import { routeFor, routeView } from '../approvals/routing'
import { proofView } from '../records/custody'
import type { Actor } from '../workspace/people'
import { businessMeasures, localDay, nextDay, type BusinessMeasure, type Definition } from './definition'
import type { Source, Value } from './dashboard'

export interface MetricRow {
 id:string; measure:BusinessMeasure; taskId:string; value:number|null; day:string|null; status:string
 projectId?:string; sheetId?:string; subjectKind?:'task'|'proof'; subjectId?:string; state?:string
 taskIds?:string[]; personId?:string; label?:string
}
export const isBusinessMeasure = (measure:string):measure is BusinessMeasure => businessMeasures.includes(measure as BusinessMeasure)
const unavailable=()=>new PegError(410,'report_scope_changed_refresh_required')
const selected=(opened:Awaited<ReturnType<typeof openTask>>,def:Definition)=>def.projects.some(id=>opened.access.contexts.get(id)?.capabilities.has('export'))

/** Current authorized business records, frozen with the same task snapshot. Never infer past planning or approval state. */
export async function captureMetrics(db:D1Database,actor:Actor,workspace:string,def:Definition,sources:Source[]):Promise<MetricRow[]> {
 const wanted=new Set(def.widgets.map(w=>w.measure)),rows:MetricRow[]=[],tasks=new Map<string,Awaited<ReturnType<typeof openTask>>>()
 for(const source of sources){const opened=await openTask(db,actor,source.id);if(selected(opened,def)&&(def.status==='all'||opened.task.status===def.status))tasks.set(source.id,opened)}
 const inWindow=(day:string)=>day>=def.start&&day<=def.end
 if(wanted.has('approved-hours')){
  for(const sheet of await all<{id:string}>(db,"SELECT id FROM peg_timesheets WHERE workspace_id=? AND status='approved' ORDER BY id",workspace)){
   const view=await sheetView(db,actor,sheet.id).catch(e=>{if(e instanceof PegError&&[403,404].includes(e.status))return null;throw e})
   if(!view)continue
   for(const entry of view.entries){
    const opened=entry.task_id?tasks.get(entry.task_id):null
    if(!opened||!entry.available||!entry.project_id||!def.projects.includes(entry.project_id)||!opened.access.contexts.get(entry.project_id)?.capabilities.has('export')||!inWindow(entry.work_date))continue
    rows.push({id:entry.id,measure:'approved-hours',taskId:opened.task.id,value:(entry.seconds??0)/3600,day:entry.work_date,status:opened.task.status,projectId:entry.project_id,sheetId:sheet.id})
   }
  }
 }
 if(['committed-hours','unscheduled-hours','available-hours','overload-hours'].some(m=>wanted.has(m as Definition['widgets'][number]['measure']))){
  const people=await capacityPeople(db,actor,workspace),dates:string[]=[]
  const assignments=new Map<string,Set<string>>(),loads=new Map<string,number[]>()
  for(let day=def.start;day<=def.end;day=nextDay(day))dates.push(day)
  for(const {task} of tasks.values()){
   if(task.status==='done')continue
   const allocations=await all<{person_id:string;hours:number}>(db,'SELECT person_id,hours FROM peg_effort_allocations WHERE task_id=? ORDER BY person_id',task.id)
   const participants=allocations.length?allocations:[{person_id:task.owner_id,hours:task.estimate_hours}]
   for(const participant of participants){const ids=assignments.get(participant.person_id)??new Set<string>();ids.add(task.id);assignments.set(participant.person_id,ids)}
   if(!task.start_date&&!task.due_date){
    if(wanted.has('unscheduled-hours'))rows.push({id:task.id,taskId:task.id,measure:'unscheduled-hours',value:participants.reduce((n,p)=>n+p.hours,0),day:null,status:task.status})
    continue
   }
   if(!['committed-hours','available-hours','overload-hours'].some(m=>wanted.has(m as Definition['widgets'][number]['measure'])))continue
   const known=participants.every(p=>people.some(person=>person.id===p.person_id))
   const totals=dates.map(()=>0)
   for(const participant of participants){
    const person=people.find(p=>p.id===participant.person_id);if(!person)continue
    const values=spread(task,participant.hours,{zone:person.zone,week:person.week,timeOff:[]},dates)
    values.forEach((value,i)=>totals[i]+=value)
    const own=loads.get(person.id)??dates.map(()=>0);values.forEach((value,i)=>own[i]+=value);loads.set(person.id,own)
   }
   if(wanted.has('committed-hours'))for(const [i,day] of dates.entries())if(totals[i]||!known)rows.push({id:task.id+':'+day,taskId:task.id,measure:'committed-hours',value:known?totals[i]:null,day,status:task.status})
  }
  if(wanted.has('available-hours')||wanted.has('overload-hours'))for(let offset=0;offset<dates.length;offset+=31){
   const days=dates.slice(offset,offset+31),native=await workloadView(db,actor,workspace,{from:days[0],days:days.length})
   for(const [personId,ids] of assignments){
    const person=native.people.find(p=>p.id===personId),taskIds=[...ids]
    for(const [i,day] of days.entries())for(const measure of ['available-hours','overload-hours'] as const)if(wanted.has(measure)){
     const available=person&&!person.days[i].unknown?person.days[i].availableHours:null,demand=loads.get(personId)?.[offset+i]??0
     rows.push({id:personId+':'+day,taskId:taskIds[0],taskIds,personId,label:person?.name??'Unavailable participant',measure,value:available===null?null:measure==='available-hours'?available:Math.max(0,demand-available),day,status:'todo'})
    }
   }
  }
 }
 if(wanted.has('requests'))for(const request of await all<{id:string;task_id:string;project_id:string;created_at:number}>(db,'SELECT * FROM peg_rule_requests ORDER BY id')){
  const opened=tasks.get(request.task_id),day=localDay(request.created_at,def.timezone)
  if(opened&&inWindow(day)&&def.projects.includes(request.project_id)&&opened.access.contexts.get(request.project_id)?.capabilities.has('export'))rows.push({id:request.id,taskId:request.task_id,projectId:request.project_id,measure:'requests',value:1,day,status:opened.task.status})
 }
 if(wanted.has('pending-approvals')||wanted.has('approved-approvals')){
  const add=(taskId:string,subjectKind:'task'|'proof',subjectId:string,created:number,state:string,projectId?:string)=>{
   const day=localDay(created,def.timezone);if(!inWindow(day))return
   const measure=state==='approved'?'approved-approvals':['pending','stale','reopened','changes_requested'].includes(state)?'pending-approvals':null
   if(measure&&wanted.has(measure))rows.push({id:subjectKind+':'+subjectId,taskId,subjectKind,subjectId,measure,value:1,day,status:tasks.get(taskId)!.task.status,state,...(projectId?{projectId}:{})})
  }
  for(const [taskId,opened] of tasks){
   const approval=await first<{created_at:number}>(db,'SELECT created_at FROM peg_approval_tasks WHERE task_id=?',taskId)
   if(approval){const route=await routeFor(db,'task',taskId),view=route?await routeView(db,actor,route.id):await decisionPreview(db,actor,taskId);add(taskId,'task',taskId,approval.created_at,view.state)}
   for(const proof of await all<{id:string;current_version:string;created_at:number}>(db,'SELECT * FROM peg_proofs WHERE task_id=?',taskId)){
    const file=await first<{project_id:string|null}>(db,'SELECT a.project_id FROM peg_attachments a JOIN peg_proof_versions v ON v.attachment_id=a.id WHERE v.id=?',proof.current_version)
    if(!file?.project_id||!def.projects.includes(file.project_id)||!opened.access.contexts.get(file.project_id)?.capabilities.has('export'))continue
    const view=await proofView(db,actor,proof.id).catch(e=>{if(e instanceof PegError&&[403,404].includes(e.status))return null;throw e})
    if(view)add(taskId,'proof',proof.id,proof.created_at,({approve:'approved',changes:'changes_requested',reject:'rejected'} as Record<string,string>)[view.state]??view.state,file.project_id)
   }
  }
 }
 return rows
}

/** Task export alone never grants a saved timesheet or proof read. Recheck the native doors on every download. */
export async function recheckMetrics(db:D1Database,actor:Actor,workspace:string,def:Definition,rows:MetricRow[]) {
 if(def.widgets.some(w=>['committed-hours','unscheduled-hours','available-hours','overload-hours'].includes(w.measure)))await capacityMember(db,actor,workspace)
 const people=rows.some(r=>r.personId)?await capacityPeople(db,actor,workspace):[]
 const sheets=new Map<string,Awaited<ReturnType<typeof sheetView>>>()
 for(const row of rows){
  const opened=await openTask(db,actor,row.taskId).catch(()=>null)
  if(!opened||!selected(opened,def)||row.projectId&&!opened.access.contexts.get(row.projectId)?.capabilities.has('export'))throw unavailable()
  for(const id of row.taskIds??[]){const task=await openTask(db,actor,id).catch(()=>null);if(!task||!selected(task,def))throw unavailable()}
  if(row.personId&&!people.some(p=>p.id===row.personId))throw unavailable()
  if(row.sheetId){
   if(!sheets.has(row.sheetId)){const view=await sheetView(db,actor,row.sheetId).catch(()=>null);if(!view||view.sheet.status!=='approved')throw unavailable();sheets.set(row.sheetId,view)}
   if(!sheets.get(row.sheetId)!.entries.some(e=>e.id===row.id&&e.task_id===row.taskId&&e.project_id===row.projectId&&e.available))throw unavailable()
  }
  if(row.subjectKind==='proof'&&!await proofView(db,actor,row.subjectId!).catch(()=>null))throw unavailable()
  if(row.subjectKind==='task'){
   const route=await routeFor(db,'task',row.subjectId!),view=route?await routeView(db,actor,route.id).catch(()=>null):await decisionPreview(db,actor,row.subjectId!).catch(()=>null)
   if(!view)throw unavailable()
  }
 }
}
export function metricWidget(kind:string,measure:BusinessMeasure,rows:MetricRow[],sources:Source[],def:Definition,at:number) {
 const selected=rows.filter(r=>r.measure===measure),dates:string[]=[]
 for(let day=def.start;day<=def.end;day=nextDay(day))dates.push(day)
 const total=(label:string,items:MetricRow[],unknown=false):Value=>({label,value:unknown||items.some(r=>r.value===null)?null:items.reduce((n,r)=>n+r.value!,0),sourceIds:[...new Set(items.flatMap(r=>r.taskIds??[r.taskId]))],eventIds:[],metricIds:items.map(r=>r.measure+':'+r.id)})
 const values=kind==='line'?dates.map(day=>total(day,selected.filter(r=>r.day===day),!['committed-hours','available-hours','overload-hours','approved-hours'].includes(measure)&&day>localDay(at,def.timezone))):kind==='single-number'?[total('Total',selected)]:kind==='table'?selected.map(row=>total((row.label??sources.find(s=>s.id===row.taskId)!.title)+(row.day?' · '+row.day:''),[row])):['todo','doing','done'].map(status=>total(status,selected.filter(row=>row.status===status)))
 const basis:Record<BusinessMeasure,string>={
  'approved-hours':'Currently approved, readable timesheet entries, including approved adjustments. The selected days are recorded work dates, never shifted to another timezone.',
  'committed-hours':'Current open-work plan, spread over each participant’s working calendar as in Workload. Participant hours preserve reviewed Split, Sum and per-person allocations. This is a current plan for the selected days, not a historical capacity trend. Leave changes availability, not the scheduled effort distribution.',
  'unscheduled-hours':'Current open-work participant hours with no start or deadline. These have no date bucket and are shown separately from scheduled commitments.',
  'available-hours':'Current native calendar availability for the distinct people assigned to selected open work, once per person and day. Their own local calendars and leave apply. Stale availability is Unknown; private leave reasons are excluded.',
  'overload-hours':'Current selected-project scheduled demand above each assigned person’s native daily availability, summed after each person is compared separately. Other projects and hidden commitments are excluded, so this is not a whole-workspace overload total.',
  requests:'Deduplicated native project requests created during the selected local days, grouped by their current task status. Access requests are not work intake.',
  'pending-approvals':'Current pending, reopened, stale or changes-requested task and proof reviews created during the selected local days. Rejected and withdrawn reviews are excluded; no past decision state is inferred.',
  'approved-approvals':'Currently approved task and proof reviews created during the selected local days. A later capture reflects reopening or a new proof version; the frozen snapshot retains its original state.',
 }
 return {kind,measure,basis:basis[measure],group:kind==='line'?(measure==='approved-hours'?'recorded work day':['committed-hours','available-hours','overload-hours'].includes(measure)?'planned local day':'created local day'):kind==='table'?'source record':kind==='single-number'?'total':'current task status',values}
}
