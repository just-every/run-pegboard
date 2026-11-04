import { all, first, invalid, notFound, now } from '../db'
import { workspaceRole, type Actor } from '../workspace/people'
import { calendarDate, capacityMember, capacityPeople } from './profiles'
import { sharesWithWorkspace } from '../authorization/levels'
import { availableIntervals, dayNumber, dayString, readStamp, type WorkingCalendar } from '../schedule/calendar'

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

/** Working capacity only: no workload, hidden-work aggregate, source identity or private reason. */
export async function profileAvailability(db: D1Database, actor: Actor, workspace: string, personId: string, input: Record<string, string>) {
 if (!await first(db, 'SELECT 1 FROM peg_workspaces WHERE id=?', workspace)
   || !sharesWithWorkspace(await workspaceRole(db, actor.id, workspace))
   || await first(db, 'SELECT 1 FROM peg_erased_people WHERE operator_id=?', actor.id)) throw notFound()
 const person = (await capacityPeople(db, actor, workspace)).find(person => person.id === personId)
 if (!person) throw notFound()
 const from = calendarDate(input.from ?? new Date().toISOString().slice(0, 10)), count = Number(input.days ?? 7)
 if (!Number.isInteger(count) || count < 1 || count > 31) throw invalid('capacity_days')
 const feeds = await all<{id:string;active:number;fetched_at:number|null;mapping:string;issuer_id:string;from_date:string|null;through_date:string|null}>(db, 'SELECT * FROM peg_capacity_feeds WHERE workspace_id=?', workspace)
 const mapped: (typeof feeds[number] & {current:boolean})[] = []
 for (const feed of feeds) {
  if (!Object.values(JSON.parse(feed.mapping)).includes(person.id)) continue
  const role = await workspaceRole(db, feed.issuer_id, workspace)
  mapped.push({ ...feed, current: !!feed.active && !!feed.fetched_at && now() - feed.fetched_at <= 86400000 && (role === 'owner' || role === 'admin') })
 }
 const leave = await all<{start_date:string;end_date:string;source:string;source_id:string|null}>(db, 'SELECT start_date,end_date,source,source_id FROM peg_time_off WHERE workspace_id=? AND operator_id=?', workspace, person.id)
 const days = Array.from({length:count}, (_, i) => {
  const date = dayString(dayNumber(from) + i)
  const known = mapped.filter(feed => feed.current && feed.from_date && feed.through_date && date >= feed.from_date && date <= feed.through_date)
  const calendar: WorkingCalendar = { zone: person.zone, week: person.week, timeOff: leave.filter(row => row.source === 'self' || known.some(feed => feed.id === row.source_id)).map(row => ({start:row.start_date,end:row.end_date})) }
  const hours = availableIntervals(dayNumber(date), calendar).reduce((sum, [start, end]) => sum + (end - start) / 3600000, 0)
  const unknown = known.length !== mapped.length
  return { date, availableHours: unknown ? null : Math.round(hours * 10000) / 10000, freshness: unknown ? 'unknown' : 'current' }
 })
 return { zone: person.zone, from, days }
}
