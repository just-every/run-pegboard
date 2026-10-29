import type { Bindings } from '../../auth.server'
import { all, bound, conflict, first, invalid, newId, now, PegError } from '../db'
import type { Actor } from '../workspace/people'
import { digest, guarded, revision } from '../decisions/revision'
import { auditStatement } from '../authorization/audit'
import { calendarDate, capacityAdmin, capacityPeople } from './profiles'

interface Feed {id:string;workspace_id:string;service:'willow'|'bamboohr';origin:string;account:string;mapping:string;active:number;revision:number;issuer_id:string}
const publicOrigin=(value:unknown)=>{
 let url:URL;try{url=new URL(String(value))}catch{throw invalid('capacity_feed_origin')}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!url.hostname.includes('.')||/^[\d.]+$/.test(url.hostname)||url.hostname.endsWith('.local')||url.hostname.endsWith('.localhost')||url.hostname.includes(':'))throw invalid('capacity_feed_origin')
 return url.origin
}
export async function configureFeed(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
 await capacityAdmin(db,actor,workspace)
 if(!['willow','bamboohr'].includes(input.service))throw invalid('capacity_feed_service')
 let mapping=input.mapping;if(typeof mapping==='string'){try{mapping=JSON.parse(mapping)}catch{throw invalid('capacity_feed_mapping')}}
 const people=await capacityPeople(db,actor,workspace)
 if(!mapping||Array.isArray(mapping)||typeof mapping!=='object'||!Object.keys(mapping).length||Object.keys(mapping).length>500||Object.entries(mapping).some(([source,id])=>!/^[A-Za-z0-9_-]{1,200}$/.test(source)||typeof id!=='string'||!people.some(p=>p.id===id)))throw invalid('capacity_feed_mapping')
 const account=String(input.account??'');if(input.service==='bamboohr'&&!/^[a-zA-Z0-9-]{1,80}$/.test(account))throw invalid('capacity_feed_account')
 const id=newId('feed'),origin=input.service==='willow'?publicOrigin(input.origin):'https://api.bamboohr.com'
 await guarded(db,await revision(db),[bound(db,'INSERT INTO peg_capacity_feeds(id,workspace_id,service,origin,account,mapping,issuer_id) VALUES(?,?,?,?,?,?,?)',[id,workspace,input.service,origin,account,JSON.stringify(mapping),actor.id]),auditStatement(db,{workspaceId:workspace,actorId:actor.id,action:'capacity.feed_configured',targetType:'capacity_feed',targetId:id})])
 return {id,service:input.service,freshness:'unknown'}
}
async function feedFor(db:D1Database,actor:Actor,workspace:string,id:string) {
 await capacityAdmin(db,actor,workspace)
 const feed=await first<Feed>(db,'SELECT * FROM peg_capacity_feeds WHERE id=? AND workspace_id=?',id,workspace)
 if(!feed||!feed.active)throw conflict('capacity_feed_inactive')
 return feed
}
/** Official read schemas only. Raw records, reasons and the one-invocation credential are never persisted. */
export async function refreshFeed(env:Bindings,db:D1Database,actor:Actor,workspace:string,id:string,input:Record<string,any>) {
 const feed=await feedFor(db,actor,workspace,id),rev=await revision(db),mapping=JSON.parse(feed.mapping)
 const credential=input.credential;if(typeof credential!=='string'||!credential||credential.length>4096||/[\r\n]/.test(credential))throw invalid('capacity_feed_credential')
 const from=calendarDate(input.from),through=calendarDate(input.through);if(from>through)throw invalid('capacity_feed_dates')
 const local=env.AUTH_LOCAL==='true'&&env.PEGBOARD_LOCAL_CAPACITY_ORIGINS?JSON.parse(env.PEGBOARD_LOCAL_CAPACITY_ORIGINS)[feed.service]:null
 const origin=local?new URL(local).origin:feed.origin
 const leave:{key:string;person:string;start:string;end:string}[]=[],seen=new Set<string>();let cursor=''
 const headers={accept:'application/json',authorization:feed.service==='bamboohr'?'Basic '+btoa(credential+':x'):'Bearer '+credential}
 try {
  for(let page=0;page<20;page++) {
   const path=feed.service==='bamboohr'?'/api/gateway.php/'+encodeURIComponent(feed.account)+'/v1/time_off/requests?start='+from+'&end='+through:'/api/willow/v1/calendar?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):'')
   let response:Response;try{response=await fetch(origin+path,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)})}catch{throw new PegError(503,'capacity_feed_unavailable')}
   if(response.status===401||response.status===403)throw new PegError(403,'capacity_feed_refused')
   if(!response.ok)throw new PegError(503,'capacity_feed_unavailable')
   let body:any;try{body=await response.json()}catch{throw invalid('capacity_feed_schema')}
   const records=feed.service==='bamboohr'?body:body.data
   if(!Array.isArray(records)||(feed.service==='willow'&&body.apiVersion!=='1'))throw invalid('capacity_feed_schema')
   for(const row of records) {
    const approved=feed.service==='bamboohr'?row.status?.status==='approved':row.status==='approved'
    if(!approved)continue
    const sourcePerson=String(feed.service==='bamboohr'?row.employeeId:row.personId),person=mapping[sourcePerson]
    if(await first(db,'SELECT 1 FROM peg_capacity_erased_sources WHERE feed_id=? AND source_person=?',id,sourcePerson))continue
    // Company calendars also contain people outside this workspace's explicit mapping.
    if(!person)continue
    if(!(await capacityPeople(db,actor,workspace)).some(p=>p.id===person))throw conflict('capacity_feed_person_ended')
    const start=calendarDate(feed.service==='bamboohr'?row.start:row.startDate),end=calendarDate(feed.service==='bamboohr'?row.end:row.endDate)
    if(start>end||typeof row.id!=='string'&&typeof row.id!=='number')throw invalid('capacity_feed_schema')
    // An aggregate half-day without placement cannot establish an interval union. Hold it for an explicit source repair.
    if(feed.service==='bamboohr'&&((row.amount?.unit&&row.amount.unit!=='days')||Object.values(row.dates??{}).some(v=>Number(v)!==1)))throw conflict('capacity_feed_partial_interval_required')
    const key=String(row.id);if(seen.has('row:'+key))throw invalid('capacity_feed_duplicate');seen.add('row:'+key)
    leave.push({key,person,start,end})
   }
   const next=feed.service==='willow'?body.nextCursor:null
   if(!next)break
   if(typeof next!=='string'||seen.has('cursor:'+next)||page===19)throw invalid('capacity_feed_pagination')
   seen.add('cursor:'+next);cursor=next
  }
  await capacityAdmin(db,actor,workspace)
  await guarded(db,rev,[bound(db,'DELETE FROM peg_time_off WHERE source_id=?',[id]),...await Promise.all(leave.map(async l=>bound(db,'INSERT INTO peg_time_off(id,workspace_id,operator_id,start_date,end_date,created_at,source,source_id) VALUES(?,?,?,?,?,?,?,?)',['leave_'+(await digest([id,l.key])).slice(0,20),workspace,l.person,l.start,l.end,now(),feed.service,id]))),bound(db,'UPDATE peg_capacity_feeds SET fetched_at=?,from_date=?,through_date=?,issuer_id=?,revision=revision+1 WHERE id=?',[now(),from,through,actor.id,id]),auditStatement(db,{workspaceId:workspace,actorId:actor.id,action:'capacity.feed_refreshed',targetType:'capacity_feed',targetId:id,detail:{count:leave.length}})])
  return {id,approvedIntervals:leave.length,freshness:'current',schema:feed.service}
 }catch(error){
  // A failed read establishes no current availability. Never silently serve the last successful snapshot as current.
  await capacityAdmin(db,actor,workspace)
  await guarded(db,rev,[bound(db,'UPDATE peg_capacity_feeds SET fetched_at=NULL,revision=revision+1 WHERE id=?',[id])])
  throw error
 }
}
export async function revokeFeed(db:D1Database,actor:Actor,workspace:string,id:string) {
 await feedFor(db,actor,workspace,id)
 await guarded(db,await revision(db),[bound(db,'UPDATE peg_capacity_feeds SET active=0,fetched_at=NULL,revision=revision+1 WHERE id=?',[id]),bound(db,'DELETE FROM peg_time_off WHERE source_id=?',[id]),auditStatement(db,{workspaceId:workspace,actorId:actor.id,action:'capacity.feed_revoked',targetType:'capacity_feed',targetId:id})])
 return {id,revoked:true}
}
export async function feedSettings(db:D1Database,actor:Actor,workspace:string) {
 await capacityAdmin(db,actor,workspace)
 return all<{id:string;service:string;origin:string;account:string;active:number;fetched_at:number|null}>(db,'SELECT id,service,origin,account,active,fetched_at FROM peg_capacity_feeds WHERE workspace_id=? ORDER BY id',workspace)
}
