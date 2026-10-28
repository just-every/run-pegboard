// Google Calendar v3 and Microsoft Graph event schemas at the HTTP edge; no application state is substituted.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
export async function startCalendarServices() {
 const state = Object.fromEntries(['google', 'microsoft'].map(service => [service, { events: new Map(), calls: [], denied: false, readOnly: false, freeBusyDenied: false, loseNextCreate: false, beforeWrite: null, locked: [{ start: '2026-03-06T14:00:00.000Z', end: '2026-03-06T15:00:00.000Z' }] }]))
 const servers = [], origins = {}
 for (const service of ['google', 'microsoft']) {
  const data = state[service], google = service === 'google'
  const server = createServer(async (req, res) => {
   const url = new URL(req.url, 'http://localhost'), chunks = []; for await (const c of req) chunks.push(c)
   const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null
   data.calls.push({ method: req.method, path: url.pathname, body })
   const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(value === undefined ? '' : JSON.stringify(value)) }
   try {
    if (data.denied || req.headers.authorization !== 'Bearer synthetic-pegboard-251') return send(401, { error: 'refused' })
    const base = google ? '/calendar/v3/calendars/synthetic-pegboard-250' : '/v1.0/me/calendars/synthetic-pegboard-250'
    if (req.method === 'GET' && url.pathname === (google ? '/calendar/v3/users/me/calendarList/synthetic-pegboard-250' : base)) return send(200, google ? { id: 'synthetic-pegboard-250', timeZone: 'America/New_York', accessRole: data.readOnly ? 'freeBusyReader' : 'owner' } : { id: 'synthetic-pegboard-250', canEdit: !data.readOnly })
    const tag = row => google ? row.etag : row['@odata.etag']
    const stamp = value => google ? value.dateTime : value.dateTime + (value.dateTime.endsWith('Z') ? '' : 'Z')
    const current = [...data.events.values()].filter(r => !r.isCancelled && r.status !== 'cancelled')
    if (req.method === 'POST' && google && url.pathname === '/calendar/v3/freeBusy') {
     assert.deepEqual(body.items, [{ id: 'synthetic-pegboard-250' }])
     return send(200, { calendars: { 'synthetic-pegboard-250': data.freeBusyDenied ? { errors: [{ reason: 'forbidden' }] } : { busy: [...data.locked, ...current.filter(r => r.id !== data.excludeBusy).map(r => ({ start: stamp(r.start), end: stamp(r.end) }))] } } })
    }
    if (req.method === 'GET' && (url.pathname === base + '/calendarView' || url.pathname === base + '/events')) {
     const records = [...data.events.values()]
     if (url.searchParams.has('startDateTime') || url.searchParams.has('timeMin')) for (const [i, busy] of data.locked.entries()) records.push(google ? { id: 'locked' + i, etag: 'locked', start: { dateTime: busy.start }, end: { dateTime: busy.end }, transparency: 'opaque' } : { id: 'locked' + i, '@odata.etag': 'locked', start: { dateTime: busy.start.replace('Z', ''), timeZone: 'UTC' }, end: { dateTime: busy.end.replace('Z', ''), timeZone: 'UTC' }, showAs: 'busy', type: 'singleInstance' })
     return send(200, google ? { items: records } : { value: records })
    }
    if (req.method === 'POST' && url.pathname === base + '/events') {
     assert.equal(google ? body.summary : body.subject, 'Reserved work')
     assert.equal(google ? body.visibility : body.sensitivity, 'private')
     assert.ok(!('attendees' in body) && !('description' in body) && !('body' in body))
     if (google) assert.equal(url.searchParams.get('sendUpdates'), 'none')
     const existing = google ? data.events.get(body.id) : [...data.events.values()].find(r => r.transactionId === body.transactionId)
     if (existing) return send(google ? 409 : 201, existing)
     if (data.beforeWrite) { const fn = data.beforeWrite; data.beforeWrite = null; await fn() }
     const id = google ? body.id : 'event-' + body.transactionId, row = { ...body, id, ...(google ? { etag: '"1"', status: 'confirmed' } : { '@odata.etag': '"1"', type: 'singleInstance', isCancelled: false }) }
     data.events.set(id, row)
     if (data.loseNextCreate) { data.loseNextCreate = false; return send(503, { error: 'synthetic uncertain response' }) }
     return send(201, row)
    }
    const id = decodeURIComponent(url.pathname.slice((base + '/events/').length)), row = data.events.get(id)
    if (url.pathname.startsWith(base + '/events/')) {
     if (!row) return send(404, { error: 'absent' })
     if (req.method === 'GET') return send(200, row)
     if (req.headers['if-match'] !== tag(row)) return send(412, { error: 'changed' })
     if (data.beforeWrite) { const fn = data.beforeWrite; data.beforeWrite = null; await fn() }
     if (req.method === 'DELETE') { data.events.delete(id); return send(204) }
     if (req.method === 'PATCH') { Object.assign(row, body, google ? { etag: '"' + (Number(tag(row).replaceAll('"', '')) + 1) + '"' } : { '@odata.etag': '"' + (Number(tag(row).replaceAll('"', '')) + 1) + '"' }); return send(200, row) }
    }
    return send(404, { error: 'unexpected schema edge' })
   } catch (error) { data.error = error; return send(500, { error: String(error) }) }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origins[service] = `http://127.0.0.1:${server.address().port}`; servers.push(server)
 }
 return { state, origins: JSON.stringify(origins), move(service, id, start, end) { const d = state[service], row = d.events.get(id); row.start = { dateTime: service === 'google' ? start : start.replace('Z', ''), timeZone: service === 'google' ? 'America/New_York' : 'UTC' }; row.end = { dateTime: service === 'google' ? end : end.replace('Z', ''), timeZone: service === 'google' ? 'America/New_York' : 'UTC' }; row[service === 'google' ? 'etag' : '@odata.etag'] = '"99"' }, async stop() { for (const s of servers) await new Promise(resolve => s.close(resolve)) } }
}
