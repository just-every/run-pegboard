import { all, batch, bound, forbidden, invalid, notFound } from '../db'
import { workspaceRole, type Actor } from '../workspace/people'
import { isAdministrator } from '../authorization/levels'
import { workspaceCalendar } from '../schedule/availability'
import type { WorkingHours } from '../schedule/calendar'

export async function capacityMember(db:D1Database,actor:Actor,workspace:string,write=false) {
 const role=await workspaceRole(db,actor.id,workspace)
 if(!role)throw notFound()
 if(role==='guest'||(write&&role==='agent'))throw forbidden('member')
 return role
}
export async function capacityAdmin(db:D1Database,actor:Actor,workspace:string) {
 if(!isAdministrator(await capacityMember(db,actor,workspace,true)))throw forbidden('administer')
}
export function calendarDate(value:unknown) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw invalid('capacity_date')
 return value
}
export function effortHours(value:unknown) {
 const n=Number(value);if(!Number.isFinite(n)||n<0||n>100000)throw invalid('effort_hours');return n
}
export interface Profile {id:string;name:string;zone:string;week:(WorkingHours|null)[];skills:string}
export async function capacityPeople(db:D1Database,actor:Actor,workspace:string):Promise<Profile[]> {
 await capacityMember(db,actor,workspace)
 const base=await workspaceCalendar(db,workspace)
 const rows=await all<{id:string;display_name:string;zone:string|null;week:string|null;skills:string|null}>(db,`SELECT DISTINCT o.id,o.display_name,p.zone,p.week,p.skills FROM oa_operators o
 LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=?
 LEFT JOIN peg_capacity_profiles p ON p.person_id=o.id AND p.workspace_id=?
 WHERE o.status='active' AND (o.role IN ('owner','admin') OR m.role NOT IN ('guest','agent')) ORDER BY o.display_name,o.id`,workspace,workspace)
 return rows.map(r=>({id:r.id,name:r.display_name,zone:r.zone??base.zone,week:r.week?JSON.parse(r.week):base.week,skills:r.skills??''}))
}
export async function saveCapacityProfile(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
 await capacityMember(db,actor,workspace,true)
 const person=String(input.personId||actor.id)
 if(person!==actor.id)await capacityAdmin(db,actor,workspace)
 if(!(await capacityPeople(db,actor,workspace)).some(p=>p.id===person))throw invalid('capacity_person')
 let zone:string;try{zone=new Intl.DateTimeFormat('en-US',{timeZone:input.zone}).resolvedOptions().timeZone}catch{throw invalid('timezone')}
 if(!input.zone)throw invalid('timezone')
 const raw=input.week??Array.from({length:7},(_,n)=>input['day'+n+'Start']&&input['day'+n+'End']?{start:input['day'+n+'Start'],end:input['day'+n+'End']}:null)
 const minute=(v:unknown)=>{if(typeof v==='number')return v;if(typeof v!=='string'||!/^\d{2}:\d{2}$/.test(v))throw invalid('working_hours');const [h,m]=v.split(':').map(Number);if(h>23||m>59)throw invalid('working_hours');return h*60+m}
 if(!Array.isArray(raw)||raw.length!==7)throw invalid('working_hours')
 const week=raw.map(v=>{if(v===null)return null;const start=minute(v?.start),end=minute(v?.end);if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>1439||start>=end)throw invalid('working_hours');return {start,end}})
 await batch(db,[bound(db,`INSERT INTO peg_capacity_profiles VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,person_id) DO UPDATE SET zone=excluded.zone,week=excluded.week,skills=excluded.skills`,[workspace,person,zone,JSON.stringify(week),String(input.skills??'').slice(0,300)])])
 return {personId:person,zone,week}
}
