// Workspace working hours and a person's own time off. Other people's leave is only used inside authorized scheduling.
import { all, batch, bound, first, forbidden, invalid, newId, notFound, now } from '../db'
import { auditStatement } from '../authorization/audit'
import { isAdministrator } from '../authorization/levels'
import { workspaceRole, type Actor } from '../workspace/people'
import { defaultCalendar, dayNumber, instantOf, type TimeOff, type WorkingCalendar, type WorkingHours } from './calendar'

interface CalendarRow { workspace_id: string; zone: string; week: string; revision: number }
interface LeaveRow { id: string; workspace_id: string; operator_id: string; start_date: string; end_date: string; created_at: number; source:string; source_id:string|null; delegate_id:string|null }
interface CalendarTask { id: string; workspace_id: string; owner_id: string }
const time = (value: unknown): number => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) throw invalid('working_hours')
  const [h, m] = value.split(':').map(Number)
  if (h > 23 || m > 59) throw invalid('working_hours')
  return h * 60 + m
}
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
async function member(db: D1Database, actor: Actor, workspace: string) {
  if (!await first(db, 'SELECT id FROM peg_workspaces WHERE id=?', workspace)) throw notFound()
  const role = await workspaceRole(db, actor.id, workspace)
  if (!role) throw notFound()
  if (role === 'guest' || role === 'agent') throw forbidden('member')
  return role
}
export async function workspaceCalendar(db: D1Database, workspace: string): Promise<WorkingCalendar> {
  const row = await first<CalendarRow>(db, 'SELECT * FROM peg_working_calendars WHERE workspace_id=?', workspace)
  return row ? { zone: row.zone, week: JSON.parse(row.week) as (WorkingHours | null)[], timeOff: [] } : defaultCalendar()
}
export async function availabilityView(db: D1Database, actor: Actor, workspace: string) {
  const role = await member(db, actor, workspace)
  const row = await first<CalendarRow>(db, 'SELECT * FROM peg_working_calendars WHERE workspace_id=?', workspace)
  const calendar = row ? { zone: row.zone, week: JSON.parse(row.week) as (WorkingHours | null)[] } : defaultCalendar()
  const workspaceRow = (await first<{ name: string }>(db, 'SELECT name FROM peg_workspaces WHERE id=?', workspace))!
  const own = await all<LeaveRow>(db, 'SELECT * FROM peg_time_off WHERE workspace_id=? AND operator_id=? ORDER BY start_date,id', workspace, actor.id)
  return { workspace: { id: workspace, name: workspaceRow.name }, canConfigure: isAdministrator(role),
    zone: calendar.zone, week: calendar.week, revision: row?.revision ?? 0,
    days: calendar.week.map((hours, weekday) => ({ weekday, start: hours ? clock(hours.start) : '', end: hours ? clock(hours.end) : '' })),
    timeOff: own.filter(l=>l.source==='self').map(leave => ({ id: leave.id, start: leave.start_date, end: leave.end_date,delegateId:leave.delegate_id,source:'self-declared' })) }
}

export async function setWorkingCalendar(db: D1Database, actor: Actor, workspace: string, input: Record<string, unknown>) {
  if (!isAdministrator(await member(db, actor, workspace))) throw forbidden('administer')
  if (typeof input.zone !== 'string' || input.zone.length > 100) throw invalid('timezone')
  let zone: string
  try { zone = new Intl.DateTimeFormat('en-US', { timeZone: input.zone }).resolvedOptions().timeZone } catch { throw invalid('timezone') }
  // Forms carry seven start and end pairs. JSON carries the same weekdays as a seven-slot array.
  const raw = input.week ?? Array.from({ length: 7 }, (_, day) => !input[`day${day}Start`] && !input[`day${day}End`] ? null : { start: input[`day${day}Start`], end: input[`day${day}End`] })
  if (!Array.isArray(raw) || raw.length !== 7) throw invalid('working_hours')
  const week: (WorkingHours | null)[] = raw.map(day => {
    if (day === null) return null
    if (!day || typeof day !== 'object' || Array.isArray(day)) throw invalid('working_hours')
    const start = time(day.start), end = time(day.end)
    if (start < 0 || end > 1439 || start >= end) throw invalid('working_hours')
    return { start, end }
  })
  if (!week.some(Boolean)) throw invalid('working_hours')
  await batch(db, [bound(db, `INSERT INTO peg_working_calendars(workspace_id,zone,week,revision,updated_by,updated_at) VALUES (?,?,?,1,?,?)
    ON CONFLICT(workspace_id) DO UPDATE SET zone=excluded.zone,week=excluded.week,revision=peg_working_calendars.revision+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at`, [workspace, zone, JSON.stringify(week), actor.id, now()]),
    auditStatement(db, { workspaceId: workspace, actorId: actor.id, action: 'calendar.configured', targetType: 'workspace', targetId: workspace, detail: { zone, week } })])
  return availabilityView(db, actor, workspace)
}

const leaveDate = (value: unknown): string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z)?$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value.length === 10 ? value + 'T00:00:00Z' : value).toISOString().replace('.000Z', 'Z') !== (value.length === 10 ? value + 'T00:00:00Z' : value)) throw invalid('time_off_dates')
  return value
}
export async function addTimeOff(db: D1Database, actor: Actor, workspace: string, input: Record<string, unknown>) {
  await member(db, actor, workspace)
  // There is deliberately no reason field, and no way to write another person's leave.
  if (Object.keys(input).some(key => !['start', 'end', '_next', 'workspaceId','localStart','localEnd','zone','delegateId'].includes(key))) throw invalid('time_off_field')
  let zone:string;try{zone=new Intl.DateTimeFormat('en-US',{timeZone:typeof input.zone==='string'?input.zone:(await workspaceCalendar(db,workspace)).zone}).resolvedOptions().timeZone}catch{throw invalid('timezone')}
  const local=(value:unknown)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||Number.isNaN(Date.parse(value)))throw invalid('time_off_dates');const [h,m]=value.slice(11).split(':').map(Number);return new Date(instantOf(value.slice(0,10),(h*60+m)*60000,zone)).toISOString().replace('.000Z','Z')}
  const start = leaveDate(input.localStart?local(input.localStart):input.start), end = leaveDate(input.localEnd?local(input.localEnd):input.end)
  if (start.length !== end.length || (start.length === 10 ? start > end : Date.parse(start) >= Date.parse(end)) || dayNumber(end) - dayNumber(start) > 3660) throw invalid('time_off_dates')
  const id = newId('leave')
  const delegate=typeof input.delegateId==='string'&&input.delegateId?input.delegateId:null
  if(delegate&&(!await workspaceRole(db,delegate,workspace)||delegate===actor.id))throw invalid('delegate')
  await batch(db, [bound(db, 'INSERT INTO peg_time_off(id,workspace_id,operator_id,start_date,end_date,created_at,delegate_id) VALUES (?,?,?,?,?,?,?)', [id, workspace, actor.id, start, end, now(),delegate]),
    bound(db,'INSERT INTO peg_availability_history VALUES(?,?,?,?,?,?,?,?,?)',[newId('availability'),workspace,actor.id,id,actor.id,'declared',start,end,now()]),
    auditStatement(db, { workspaceId: null, actorId: actor.id, action: 'calendar.time_off_added', targetType: 'availability', targetId: id })])
  return { id, start, end }
}
export async function removeTimeOff(db: D1Database, actor: Actor, workspace: string, id: string) {
  await member(db, actor, workspace)
  const row = await first<LeaveRow>(db, "SELECT * FROM peg_time_off WHERE id=? AND workspace_id=? AND operator_id=? AND source='self'", id, workspace, actor.id)
  if (!row) throw notFound()
  await batch(db, [bound(db,'INSERT INTO peg_availability_history VALUES(?,?,?,?,?,?,?,?,?)',[newId('availability'),workspace,actor.id,id,actor.id,'cancelled',row.start_date,row.end_date,now()]),bound(db, 'DELETE FROM peg_time_off WHERE id=? AND workspace_id=? AND operator_id=?', [id, workspace, actor.id]),
    auditStatement(db, { workspaceId: null, actorId: actor.id, action: 'calendar.time_off_removed', targetType: 'availability', targetId: id })])
  return { id, removed: true }
}

export async function extendTimeOff(db:D1Database,actor:Actor,workspace:string,id:string,input:Record<string,unknown>) {
 await member(db,actor,workspace)
 const row=await first<LeaveRow>(db,"SELECT * FROM peg_time_off WHERE id=? AND workspace_id=? AND operator_id=? AND source='self'",id,workspace,actor.id)
 if(!row)throw notFound()
 const end=leaveDate(input.end)
 if(end.length!==row.end_date.length||end<=row.end_date||dayNumber(end)-dayNumber(row.start_date)>3660)throw invalid('time_off_dates')
 await batch(db,[bound(db,'UPDATE peg_time_off SET end_date=? WHERE id=?',[end,id]),bound(db,'INSERT INTO peg_availability_history VALUES(?,?,?,?,?,?,?,?,?)',[newId('availability'),workspace,actor.id,id,actor.id,'extended',row.start_date,end,now()])])
 return {id,start:row.start_date,end}
}

/** Only schedule services call this: leave identities and dates never become a colleague directory. */
export async function taskCalendars(db: D1Database, tasks: CalendarTask[]) {
  const calendars = new Map<string, WorkingCalendar>(), fingerprint: unknown[] = []
  for (const workspace of [...new Set(tasks.map(task => task.workspace_id))].sort()) {
    const owners = [...new Set(tasks.filter(task => task.workspace_id === workspace).map(task => task.owner_id))].sort()
    const marks = owners.map(() => '?').join(',') || 'NULL'
    const [config, leave, revisions,profiles] = await Promise.all([
      first<CalendarRow>(db, 'SELECT * FROM peg_working_calendars WHERE workspace_id=?', workspace),
      all<LeaveRow>(db, `SELECT * FROM peg_time_off WHERE workspace_id=? AND operator_id IN (${marks}) ORDER BY id`, workspace, ...owners),
      all<{ operator_id: string; revision: number }>(db, `SELECT operator_id,revision FROM peg_availability_revisions WHERE workspace_id=? AND operator_id IN (${marks}) ORDER BY operator_id`, workspace, ...owners),
      all<{person_id:string;zone:string;week:string}>(db,`SELECT * FROM peg_capacity_profiles WHERE workspace_id=? AND person_id IN (${marks})`,workspace,...owners),
    ])
    const base = config ? { zone: config.zone, week: JSON.parse(config.week) as (WorkingHours | null)[], timeOff: [] as TimeOff[] } : defaultCalendar()
    const feeds=await all<{id:string;active:number;fetched_at:number|null;issuer_id:string}>(db,'SELECT * FROM peg_capacity_feeds WHERE workspace_id=?',workspace),live=new Set<string>()
    for(const f of feeds){const role=await workspaceRole(db,f.issuer_id,workspace);if(f.active&&f.fetched_at&&now()-f.fetched_at<=86400000&&(role==='owner'||role==='admin'))live.add(f.id)}
    for (const task of tasks.filter(task => task.workspace_id === workspace)) {const p=profiles.find(p=>p.person_id===task.owner_id);calendars.set(task.id, { ...base,...(p?{zone:p.zone,week:JSON.parse(p.week)}:{}), timeOff: leave.filter(row => row.operator_id === task.owner_id&&(row.source==='self'||row.source_id&&live.has(row.source_id))).map(row => ({ start: row.start_date, end: row.end_date })) })}
    fingerprint.push([workspace, config ? [config.zone, config.week, config.revision] : null, owners, revisions.map(row => [row.operator_id, row.revision]), leave.map(row => [row.id, row.operator_id, row.start_date, row.end_date]),profiles,[...live]])
  }
  return { calendars, fingerprint }
}
