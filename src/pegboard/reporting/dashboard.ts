import { all, batch, bound, conflict, first, forbidden, invalid, newId, now, PegError } from '../db'
import { dataRevision } from '../data/settings'
import { guarded, revision as authorityRevision, type Revision } from '../decisions/revision'
import { rank } from '../authorization/levels'
import { openTask } from '../tasks/access'
import { openProject } from '../workspace/projects'
import { workspaceSettings, type Actor } from '../workspace/people'
import { definition, localDay, midnight, nextDay, type Definition, type Measure } from './definition'
import { captureMetrics, isBusinessMeasure, metricWidget, recheckMetrics, type MetricRow } from './metrics'

interface Dashboard { id:string; workspace_id:string; owner_id:string; name:string; definition:string; created_at:number }
export interface Event { seq:number; task_id:string; at:number; kind:string; status:string; effort:number; due:string|null; due_known:number; projects:string[] }
export interface Source { id:string; title:string; due:string|null; events:Event[] }
export interface Value { label:string; value:number|null; sourceIds:string[]; eventIds:number[]; metricIds?:string[]; scope?:number|null }
export interface Report { id:string; dashboardId:string; name:string; capturedAt:number; definition:Definition; sources:Source[]; metrics?:MetricRow[]; widgets:{kind:string;measure:Measure;group:string;basis?:string;values:Value[]}[]; window:{startAt:number;endAt:number}; unknown:string[] }
async function scope(db:D1Database,actor:Actor,workspace:string,def:Definition) {
 const settings=await workspaceSettings(db,workspace)
 for(const id of def.projects){const p=await openProject(db,actor,id);if(p.project.workspace_id!==workspace)throw forbidden();if(!p.effective.capabilities.has('export')||rank(p.effective.level)<rank(settings.exportMinLevel))throw forbidden('export')}
}
export async function dashboards(db:D1Database,actor:Actor,workspace:string) {
 return all<Dashboard>(db,'SELECT * FROM peg_report_dashboards WHERE owner_id=? AND workspace_id=? ORDER BY created_at,id',actor.id,workspace)
}
export async function createDashboard(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
 const def=definition(input),name=String(input.name??'').trim();if(!name||name.length>120)throw invalid('report_name')
 await scope(db,actor,workspace,def)
 const id=newId('dashboard')
 await batch(db,[bound(db,'INSERT INTO peg_report_dashboards VALUES(?,?,?,?,?,?)',[id,workspace,actor.id,name,JSON.stringify(def),now()])])
 return {id}
}
export async function ownDashboard(db:D1Database,actor:Actor,workspace:string,id:string) {
 const row=await first<Dashboard>(db,'SELECT * FROM peg_report_dashboards WHERE id=? AND owner_id=? AND workspace_id=?',id,actor.id,workspace)
 if(!row)throw new PegError(404,'not_found')
 const def=definition(JSON.parse(row.definition));await scope(db,actor,workspace,def);return {row,def}
}
const stateAt=(source:Source,at:number)=>source.events.filter(e=>e.at<=at).at(-1)
const included=(e:Event|undefined,def:Definition)=>!!e&&e.projects.some(p=>def.projects.includes(p))&&(def.status==='all'||e.status===def.status)
const amount=(e:Event,measure:Measure)=>measure==='effort'?e.effort:1
function value(label:string,records:{source:Source;event:Event;value:number;refs?:number[];unknown?:boolean}[],unknown=false):Value {
 return {label,value:unknown||records.some(r=>r.unknown)?null:records.reduce((n,r)=>n+r.value,0),sourceIds:records.map(r=>r.source.id),eventIds:[...new Set(records.flatMap(r=>r.refs??[r.event.seq]))]}
}
export function calculate(sources:Source[],def:Definition,at:number,metrics:MetricRow[]=[]) {
 const startAt=midnight(def.start,def.timezone),endAt=midnight(nextDay(def.end),def.timezone)
 const lastAt=Math.min(endAt-1,at), unknown=sources.filter(s=>s.events[0]?.kind==='baseline'&&s.events[0].at>startAt).map(s=>s.id)
 const widgets=def.widgets.map(widget=>{
  if(isBusinessMeasure(widget.measure))return metricWidget(widget.kind,widget.measure,metrics,sources,def,at)
  const trend=['line','burn-up','burn-down'].includes(widget.kind), daily:Value[]=[]
  const records=(cutoff:number,before:number)=>sources.flatMap(source=>{
   if(widget.measure==='throughput'){
    const completions=source.events.filter((v,i)=>v.at>=before&&v.at<=cutoff&&i>0&&v.kind!=='baseline'&&v.status==='done'&&source.events[i-1].status!=='done'&&included(v,def))
    return completions.length?[{source,event:completions.at(-1)!,value:completions.length,refs:completions.map(e=>e.seq)}]:[]
   }
   const event=stateAt(source,cutoff);if(!included(event,def))return []
   const e=event!,measure=widget.measure
   let n=amount(e,measure)
   if(measure==='completed')n=Number(e.status==='done')
   if(measure==='overdue'){if(!e.due_known)return [{source,event:e,value:0,unknown:true}];n=Number(e.status!=='done'&&!!e.due&&(e.due.includes('T')?Date.parse(e.due)<=cutoff:e.due<localDay(cutoff,def.timezone)))}
   if(measure==='status-age-hours'||measure==='cycle-hours'){
    let index=source.events.indexOf(e)
    while(index>0&&source.events[index-1].status===e.status)index--
    if(measure==='cycle-hours'&&e.status!=='done')return []
    if(source.events[index].kind==='baseline')return [{source,event:e,value:0,unknown:true}]
    if(measure==='status-age-hours')n=(cutoff-source.events[index].at)/3600000
    else {
     let begun=index-1
     while(begun>=0&&source.events[begun].status!=='doing')begun--
     while(begun>0&&source.events[begun-1].status==='doing')begun--
     if(begun<0||source.events[begun].kind==='baseline')return [{source,event:e,value:0,unknown:true}]
     n=(source.events[index].at-source.events[begun].at)/3600000
    }
   }
   return [{source,event:e,value:n}]
  })
  if(trend){for(let day=def.start;day<=def.end;day=nextDay(day)){
   const cutoff=Math.min(midnight(nextDay(day),def.timezone)-1,at), earlier=midnight(day,def.timezone)
   if(earlier>at){daily.push(value(day,[],true));continue}
   const unknownDay=sources.some(s=>s.events[0]?.kind==='baseline'&&s.events[0].at>cutoff)
   let rs=records(cutoff,earlier)
   if(widget.kind==='burn-up')rs=rs.map(r=>({...r,value:r.event.status==='done'?amount(r.event,widget.measure):0}))
   if(widget.kind==='burn-down')rs=rs.map(r=>({...r,value:r.event.status!=='done'?amount(r.event,widget.measure):0}))
   daily.push({...value(day,rs,unknownDay),...(['burn-up','burn-down'].includes(widget.kind)?{scope:unknownDay?null:records(cutoff,earlier).reduce((n,r)=>n+amount(r.event,widget.measure),0)}:{})})
  }}
  const rs=records(lastAt,startAt),unobserved=sources.filter(s=>s.events[0]?.kind==='baseline'&&s.events[0].at>lastAt)
  const values=trend?daily:widget.kind==='single-number'?[value('Total',rs,unobserved.length>0)]:widget.kind==='table'?[...rs.map(r=>value(r.source.title,[r])),...unobserved.map(source=>value(source.title,[{source,event:source.events[0],value:0,unknown:true}]))]:['todo','doing','done'].map(status=>value(status,rs.filter(r=>r.event.status===status),unobserved.length>0))
  return {...widget,group:trend?'local day':widget.kind==='table'?'task':widget.kind==='single-number'?'total':'status',values}
 })
 return {widgets,unknown,window:{startAt,endAt}}
}
async function guard(db:D1Database,actor:Actor,rev:number,statements:D1PreparedStatement[]=[],authority?:Revision) {
 try{await guarded(db,authority??await authorityRevision(db),[bound(db,'INSERT INTO peg_report_guards VALUES(?,?,?)',[newId('guard'),rev,actor.id]),...statements])}catch(e){if(String(e).includes('report_source_changed'))throw conflict('report_source_changed');throw e}
}
export async function captureReport(db:D1Database,actor:Actor,workspace:string,id:string):Promise<Report> {
 const authority=await authorityRevision(db),rev=await dataRevision(db),{row,def}=await ownDashboard(db,actor,workspace,id),sources:Source[]=[]
 const raw=await all<Omit<Event,'projects'>&{projects:string}>(db,'SELECT * FROM peg_report_events ORDER BY at,seq')
 const grouped=new Map<string,Event[]>()
 for(const e of raw){const events=grouped.get(e.task_id)??[];events.push({...e,projects:JSON.parse(e.projects)});grouped.set(e.task_id,events)}
 for(const [taskId,events] of grouped){
  if(!events.some(e=>e.projects.some(p=>def.projects.includes(p))))continue
  const opened=await openTask(db,actor,taskId).catch(()=>null)
  if(!opened||opened.task.workspace_id!==workspace||!opened.access.capabilities.has('export'))continue
  // Historical scope is restricted to projects explicitly selected and currently authorized.
  const visible:Event[]=[]
  for(const event of events){
   const projected={...event,projects:event.projects.filter(p=>def.projects.includes(p))}
   const previous=visible.at(-1)
   // A membership change outside the selected scope reveals neither an event nor its instant.
   if(event.kind.startsWith('scope_')&&JSON.stringify(projected.projects)===JSON.stringify(previous?.projects??[]))continue
   visible.push(projected)
  }
  sources.push({id:taskId,title:opened.task.title,due:opened.task.due_date,events:visible})
 }
 const metrics=def.widgets.some(w=>isBusinessMeasure(w.measure))?await captureMetrics(db,actor,workspace,def,sources):[]
 const capturedAt=now(),snapshot=newId('report'),report:Report={id:snapshot,dashboardId:id,name:row.name,capturedAt,definition:def,sources,metrics,...calculate(sources,def,capturedAt,metrics)}
 await guard(db,actor,rev,[bound(db,'DELETE FROM peg_report_snapshots WHERE captured_at<?',[capturedAt-86400000]),bound(db,'INSERT INTO peg_report_snapshots VALUES(?,?,?,?,?,?)',[snapshot,id,actor.id,capturedAt,rev,JSON.stringify(report)])],authority)
 return report
}
export async function readSnapshot(db:D1Database,actor:Actor,workspace:string,dashboardId:string,id:string):Promise<Report> {
 const authority=await authorityRevision(db),rev=await dataRevision(db);await ownDashboard(db,actor,workspace,dashboardId)
 const row=await first<{body:string;captured_at:number}>(db,'SELECT body,captured_at FROM peg_report_snapshots WHERE id=? AND dashboard_id=? AND owner_id=?',id,dashboardId,actor.id)
 if(!row||row.captured_at+86400000<=now())throw new PegError(410,'report_unavailable_refresh_required')
 const report=JSON.parse(row.body) as Report
 for(const source of report.sources){const opened=await openTask(db,actor,source.id).catch(()=>null);if(!opened?.access.capabilities.has('export'))throw new PegError(410,'report_scope_changed_refresh_required')}
 await recheckMetrics(db,actor,workspace,report.definition,report.metrics??[])
 // Expiring grants must still be live at the final read barrier.
 if(authority.until!==null&&authority.until<=now())throw conflict('report_authority_changed')
 await guard(db,actor,rev,[],authority)
 return report
}
