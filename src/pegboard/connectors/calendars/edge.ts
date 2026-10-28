// Official Calendar and Graph schemas. Only a local runtime may select a network schema edge.
// Credentials and raw provider responses never enter the durable mapping or an error message.
import type { Bindings } from '../../../auth.server'
import { PegError, invalid } from '../../db'
import { instantOf } from '../../schedule/calendar'
export type Service = 'google' | 'microsoft'
export interface Event { id: string; etag: string; start: string; end: string; cancelled: boolean; recurring: boolean }
export interface Slot { start: string; end: string }
const origins = { google: 'https://www.googleapis.com', microsoft: 'https://graph.microsoft.com' }
export class CalendarFailure extends PegError {
 constructor(status: number, code: string) { super(status, code) }
}
export function calendarEdge(env: Bindings, service: Service, calendar: string, credential: unknown) {
 if (typeof credential !== 'string' || !credential || credential.length > 4096 || /[\r\n\x00]/.test(credential)) throw invalid('calendar_credential')
 const local = env.AUTH_LOCAL === 'true' && env.PEGBOARD_LOCAL_CALENDAR_ORIGINS ? JSON.parse(env.PEGBOARD_LOCAL_CALENDAR_ORIGINS)[service] : null
 const origin = local ? new URL(local).origin : origins[service]
 let providerZone = 'UTC'
 const base = service === 'google' ? '/calendar/v3/calendars/' + encodeURIComponent(calendar) : '/v1.0/me/calendars/' + encodeURIComponent(calendar)
 async function call(method: string, path: string, body?: unknown, etag?: string, absent = false) {
  let response: Response
  try { response = await fetch(origin + path, { method, headers: { authorization: 'Bearer ' + credential, accept: 'application/json', 'content-type': 'application/json', Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"', ...(etag ? { 'if-match': etag } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(15000) }) }
  catch { throw new CalendarFailure(503, 'calendar_outcome_uncertain') }
  if (absent && (response.status === 404 || response.status === 410)) return null
  if (!response.ok) throw new CalendarFailure(response.status === 401 || response.status === 403 ? 403 : response.status === 412 || response.status === 409 ? 409 : 503,
   response.status === 401 || response.status === 403 ? 'calendar_permission_refused' : response.status === 412 || response.status === 409 ? 'calendar_provider_conflict' : 'calendar_outcome_uncertain')
  if (response.status === 204) return null
  try { return await response.json() as any } catch { throw new CalendarFailure(503, 'calendar_schema_incomplete') }
 }
 const instant = (value: any): string => {
  if (!value || typeof value.dateTime !== 'string') throw new CalendarFailure(409, 'calendar_timed_event_required')
  let at: number
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value.dateTime)) at = Date.parse(value.dateTime)
  else {
   const zone = value.timeZone === 'Eastern Standard Time' ? 'America/New_York' : value.timeZone
   const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(value.dateTime)
   if (!m || !zone) throw new CalendarFailure(409, 'calendar_timezone_unresolved')
   try { at = instantOf(m[1], (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4])) * 1000, zone) } catch { throw new CalendarFailure(409, 'calendar_timezone_unresolved') }
  }
  if (!Number.isFinite(at)) throw new CalendarFailure(503, 'calendar_schema_incomplete')
  return new Date(at).toISOString()
 }
 const event = (row: any): Event => {
  const etag = service === 'google' ? row?.etag : row?.['@odata.etag']
  if (typeof row?.id !== 'string' || typeof etag !== 'string') throw new CalendarFailure(503, 'calendar_schema_incomplete')
  const cancelled = row.status === 'cancelled' || row.isCancelled === true
  return { id: row.id, etag, cancelled, recurring: !!(row.recurringEventId || row.recurrence || row.type && row.type !== 'singleInstance'), start: cancelled ? '' : instant(row.start), end: cancelled ? '' : instant(row.end) }
 }
 const payload = (slot: Slot, zone: string) => service === 'google'
  ? { summary: 'Reserved work', visibility: 'private', transparency: 'opaque', start: { dateTime: slot.start, timeZone: zone }, end: { dateTime: slot.end, timeZone: zone } }
  : { subject: 'Reserved work', sensitivity: 'private', showAs: 'busy', start: { dateTime: slot.start.replace('Z', ''), timeZone: 'UTC' }, end: { dateTime: slot.end.replace('Z', ''), timeZone: 'UTC' } }
 return {
  async permission() {
   const row = await call('GET', service === 'google' ? '/calendar/v3/users/me/calendarList/' + encodeURIComponent(calendar) : base)
   if (service === 'google' ? !['owner', 'writer'].includes(row?.accessRole) : row?.canEdit !== true) throw new CalendarFailure(403, 'calendar_write_permission_required')
   if (typeof row?.id !== 'string' || !row.id) throw new CalendarFailure(503, 'calendar_identity_unresolved')
   if (service === 'google') {
    if (typeof row.timeZone !== 'string' || !row.timeZone) throw new CalendarFailure(503, 'calendar_timezone_unresolved')
    try { providerZone = new Intl.DateTimeFormat('en-US', { timeZone: row.timeZone }).resolvedOptions().timeZone } catch { throw new CalendarFailure(503, 'calendar_timezone_unresolved') }
   }
   return row.id as string
  },
  async busy(start: string, end: string, excluding?: string, zone = 'America/New_York'): Promise<Slot[]> {
   if (service === 'google') {
    const row = await call('POST', '/calendar/v3/freeBusy', { timeMin: start, timeMax: end, items: [{ id: calendar }] }), value = row?.calendars?.[calendar]
    if (!value || value.errors?.length || !Array.isArray(value.busy)) throw new CalendarFailure(403, 'calendar_free_busy_refused')
    // FreeBusy has no event IDs: use the events collection when excluding this task's existing reservation.
    if (!excluding) return value.busy.map((b: any) => ({ start: instant({ dateTime: b.start }), end: instant({ dateTime: b.end }) }))
   }
   const path = service === 'google' ? base + '/events?' + new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: 'true', maxResults: '250' })
    : base + '/calendarView?' + new URLSearchParams({ startDateTime: start, endDateTime: end, '$top': '250' })
   const rows = await call('GET', path), values = service === 'google' ? rows?.items : rows?.value
   if (!Array.isArray(values) || rows.nextPageToken || rows['@odata.nextLink']) throw new CalendarFailure(503, 'calendar_busy_window_incomplete')
   return values.filter((r: any) => r.id !== excluding && r.status !== 'cancelled' && !r.isCancelled && r.transparency !== 'transparent' && r.showAs !== 'free').map((r: any) => {
    // An all-day meeting is locked for its entire local date range.
    const point = (v: any) => v?.date ? new Date(instantOf(v.date, 0, providerZone || zone)).toISOString() : instant(v)
    return { start: point(r.start), end: point(r.end) }
   })
  },
  async read(id: string): Promise<Event | null> { const row = await call('GET', base + '/events/' + encodeURIComponent(id), undefined, undefined, true); return row ? event(row) : null },
  async find(transaction: string): Promise<Event | null> {
   if (service === 'google') return this.read(transaction.replaceAll('-', ''))
   // transactionId is Microsoft's documented create retry identity. Search the returned field without assuming filter support.
   let path = base + '/events?' + new URLSearchParams({ '$top': '250', '$select': 'id,transactionId,start,end,isCancelled,type,recurrence' })
   const found: any[] = []
   for (let page = 0; page < 20; page++) {
    const row = await call('GET', path)
    if (!Array.isArray(row?.value)) throw new CalendarFailure(503, 'calendar_readback_incomplete')
    found.push(...row.value.filter((r: any) => r.transactionId === transaction))
    const next = row['@odata.nextLink']
    if (!next) { if (found.length > 1) throw new CalendarFailure(409, 'calendar_duplicate_events'); return found[0] ? event(found[0]) : null }
    const url = new URL(next)
    if (url.origin !== origin || url.pathname !== base + '/events' || page === 19) throw new CalendarFailure(503, 'calendar_readback_incomplete')
    path = url.pathname + url.search
   }
   throw new CalendarFailure(503, 'calendar_readback_incomplete')
  },
  async create(transaction: string, slot: Slot, zone: string) {
   const identity = service === 'google' ? { id: transaction.replaceAll('-', '') } : { transactionId: transaction }
   return event(await call('POST', base + '/events' + (service === 'google' ? '?sendUpdates=none' : ''), { ...payload(slot, zone), ...identity }))
  },
  async move(id: string, etag: string, slot: Slot, zone: string) { return event(await call('PATCH', base + '/events/' + encodeURIComponent(id) + (service === 'google' ? '?sendUpdates=none' : ''), payload(slot, zone), etag)) },
  async remove(id: string, etag: string) { await call('DELETE', base + '/events/' + encodeURIComponent(id) + (service === 'google' ? '?sendUpdates=none' : ''), undefined, etag, true) },
 }
}
