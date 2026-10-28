import { all } from '../db'
import { workspaceRole, type Actor } from '../workspace/people'
import { capacityMember, capacityPeople } from './profiles'
import { readStamp } from '../schedule/calendar'

export async function accountAvailability(db:D1Database,actor:Actor,workspace:string) {
 await capacityMember(db,actor,workspace,true)
 const people=await capacityPeople(db,actor,workspace),profile=people.find(p=>p.id===actor.id)!
 const leave=await all<{id:string;start_date:string;end_date:string;delegate_id:string|null}>(db,"SELECT * FROM peg_time_off WHERE workspace_id=? AND operator_id=? AND source='self' ORDER BY start_date,id",workspace,actor.id)
 const history=await all<{id:string;leave_id:string;actor_id:string;action:string;start_date:string;end_date:string;at:number}>(db,'SELECT * FROM peg_availability_history WHERE workspace_id=? AND person_id=? ORDER BY at DESC,id',workspace,actor.id)
 return {workspace,profile,people,leave:leave.map(l=>({id:l.id,start:l.start_date,end:l.end_date,delegateId:l.delegate_id})),history:history.map(h=>({...h,actor:people.find(p=>p.id===h.actor_id)?.name??'Former member'}))}
}
export async function availabilityChoices(db:D1Database,actor:Actor,workspace:string,choices:{value:string;label:string}[],from:string|null=null,through:string|null=null) {
 const role=await workspaceRole(db,actor.id,workspace)
 if(!role||role==='guest')return choices
 const people=await capacityPeople(db,actor,workspace)
 const rows=await all<{operator_id:string;start_date:string;end_date:string;source:string;source_id:string|null}>(db,'SELECT * FROM peg_time_off WHERE workspace_id=?',workspace)
 const feeds=await all<{id:string;mapping:string;active:number;fetched_at:number|null;issuer_id:string}>(db,'SELECT * FROM peg_capacity_feeds WHERE workspace_id=?',workspace)
 const live=new Set<string>()
 for(const f of feeds){const r=await workspaceRole(db,f.issuer_id,workspace);if(f.active&&f.fetched_at&&Date.now()-f.fetched_at<=86400000&&(r==='owner'||r==='admin'))live.add(f.id)}
 return choices.map(c=>{const p=people.find(p=>p.id===c.value);if(!p)return c
  const start=readStamp(from??through??new Date().toISOString(),p.zone).day,end=readStamp(through??from??new Date().toISOString(),p.zone).day
  const absent=rows.filter(l=>l.operator_id===p.id&&(l.source==='self'||l.source_id&&live.has(l.source_id))&&readStamp(l.start_date,p.zone).day<=end&&readStamp(l.end_date,p.zone).day>=start)
  const unknown=feeds.some(f=>Object.values(JSON.parse(f.mapping)).includes(p.id)&&!live.has(f.id))
  return {...c,label:c.label+(absent.length?' · Unavailable during planned work'+(absent.some(l=>l.source==='self')?' (self-declared)':' (approved leave)'):unknown?' · Availability unknown':'')}
 })
}
