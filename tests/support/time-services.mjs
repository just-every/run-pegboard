// A network-edge fake of Harvest API v2 time entries and QuickBooks Time API v1 timesheets, built from their official
// request, response and error schemas (docs/TIME-SERVICE-PACKETS.md). It holds provider records only; Pegboard's
// domain, permissions and ledger stay real. `loseNext()` applies the next create and drops its response.
import { createServer } from 'node:http'

export async function startTimeServices() {
  const harvest = { account: '7001', token: 'synthetic-pegboard-961', user: 101, project: 201, tasks: [301, 302] }
  const qbt = { token: 'synthetic-pegboard-962', user: 101, jobcodes: [401, 402], client: 'synthetic-agency' }
  const entries = { harvest: [], 'quickbooks-time': [] }, requests = []
  let nextId = 9000, lose = false, misfile = false
  const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)) }
  const stamp = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const harvestEntry = e => ({ id: e.id, spent_date: e.spent_date, hours: e.hours, rounded_hours: Math.round(e.hours * 100) / 100, notes: e.notes ?? null, is_locked: false, is_running: false, is_billed: false, approval_status: 'unsubmitted',
    user: { id: e.user_id, name: 'Synthetic person' }, project: { id: e.project_id, name: 'Synthetic project' }, task: { id: e.task_id, name: 'Synthetic task' },
    external_reference: e.external_reference ? { ...e.external_reference, account_id: null, permalink: null, service: null, service_icon_url: null } : null, created_at: e.created_at, updated_at: e.updated_at })
  const qbtSheet = e => ({ id: e.id, user_id: e.user_id, jobcode_id: e.jobcode_id, start: '', end: '', duration: e.duration, date: e.date, tz: -5, tz_str: 'tsET', type: 'manual', location: '', active: '0', locked: 0, notes: e.notes, customfields: {}, attached_files: [], last_modified: e.last_modified })
  const drop = (req, res) => { lose = false; req.socket.destroy() }
  const server = createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const url = new URL(req.url, 'http://fake'), path = url.pathname, body = raw ? JSON.parse(raw) : null
    requests.push({ method: req.method, path })
    if (path.startsWith('/v2/')) {
      if (!req.headers['user-agent']) return send(res, 400, { message: 'User-Agent header required' })
      if (req.headers.authorization !== `Bearer ${harvest.token}` || req.headers['harvest-account-id'] !== harvest.account) return send(res, 401, { error: 'invalid_token', error_description: 'The access token provided is expired, revoked, malformed or invalid for other reasons.' })
      if (req.method === 'GET' && path === '/v2/users/me') return send(res, 200, { id: harvest.user, first_name: 'Synthetic', last_name: 'Harvester', email: 'harvester@example.com', is_active: true })
      const one = path.match(/^\/v2\/time_entries\/(\d+)$/), found = one && entries.harvest.find(e => e.id === Number(one[1]))
      if (req.method === 'GET' && path === '/v2/time_entries') {
        const rows = entries.harvest.filter(e => (!url.searchParams.get('external_reference_id') || e.external_reference?.id === url.searchParams.get('external_reference_id'))
          && (!url.searchParams.get('user_id') || e.user_id === Number(url.searchParams.get('user_id'))) && (!url.searchParams.get('from') || e.spent_date >= url.searchParams.get('from')) && (!url.searchParams.get('to') || e.spent_date <= url.searchParams.get('to')))
        return send(res, 200, { time_entries: rows.map(harvestEntry), per_page: 2000, total_pages: 1, total_entries: rows.length, next_page: null, previous_page: null, page: 1, links: { first: '', next: null, previous: null, last: '' } })
      }
      if (req.method === 'GET' && one) return found ? send(res, 200, harvestEntry(found)) : send(res, 404, { message: 'Not found' })
      if (req.method === 'POST' && path === '/v2/time_entries') {
        if (!harvest.tasks.includes(body?.task_id) || body?.project_id !== harvest.project) return send(res, 422, { message: 'Task is not assigned to the project.' })
        if (body.user_id !== harvest.user || !/^\d{4}-\d{2}-\d{2}$/.test(body.spent_date ?? '') || !Number.isFinite(body.hours)) return send(res, 422, { message: 'Validation failed.' })
        const entry = { ...body, id: ++nextId, created_at: stamp(), updated_at: stamp() }
        if (misfile) { entry.task_id = harvest.tasks.find(t => t !== body.task_id); misfile = false }
        entries.harvest.push(entry)
        return lose ? drop(req, res) : send(res, 201, harvestEntry(entry))
      }
      if (req.method === 'PATCH' && one) {
        if (!found) return send(res, 404, { message: 'Not found' })
        if (!Number.isFinite(body?.hours)) return send(res, 422, { message: 'Hours is invalid.' })
        Object.assign(found, { hours: body.hours, updated_at: stamp() })
        return lose ? drop(req, res) : send(res, 200, harvestEntry(found))
      }
      return send(res, 404, { message: 'Not found' })
    }
    if (path.startsWith('/api/v1/')) {
      if (req.headers.authorization !== `Bearer ${qbt.token}`) return send(res, 401, { error: { code: 401, message: 'Unauthorized. The access token is invalid.' } })
      if (req.method === 'GET' && path === '/api/v1/current_user') return send(res, 200, { results: { users: { [qbt.user]: { id: qbt.user, first_name: 'Synthetic', last_name: 'Timekeeper', active: true, client_url: qbt.client, company_name: 'Synthetic Agency Company' } } }, more: false, supplemental_data: {} })
      if (req.method === 'GET' && path === '/api/v1/timesheets') {
        const q = name => url.searchParams.get(name), ids = q('ids')?.split(',').map(Number)
        const rows = entries['quickbooks-time'].filter(e => (!ids || ids.includes(e.id)) && (!q('start_date') || e.date >= q('start_date')) && (!q('end_date') || e.date <= q('end_date'))
          && (!q('user_ids') || q('user_ids').split(',').map(Number).includes(e.user_id)) && (!q('jobcode_ids') || q('jobcode_ids').split(',').map(Number).includes(e.jobcode_id)))
        return send(res, 200, { results: { timesheets: Object.fromEntries(rows.map(e => [String(e.id), qbtSheet(e)])) }, more: false, supplemental_data: {} })
      }
      if ((req.method === 'POST' || req.method === 'PUT') && path === '/api/v1/timesheets') {
        if (!Array.isArray(body?.data)) return send(res, 400, { error: { code: 400, message: 'Bad Request' } })
        if (body.data.length > 50) return send(res, 413, { error: { code: 413, message: 'Request entity too large' } })
        const results = {}
        for (const [i, item] of body.data.entries()) {
          if (req.method === 'POST') {
            if (item.type !== 'manual' || item.user_id !== qbt.user || !/^\d{4}-\d{2}-\d{2}$/.test(item.date ?? '') || !Number.isInteger(item.duration)) { results[i + 1] = { _status_code: 417, _status_message: 'Expectation Failed', _status_extra: 'Invalid manual timesheet properties' }; continue }
            if (!qbt.jobcodes.includes(item.jobcode_id)) { results[i + 1] = { _status_code: 417, _status_message: 'Expectation Failed', _status_extra: 'Invalid jobcode_id' }; continue }
            const entry = { ...item, id: ++nextId, last_modified: stamp() }
            entries['quickbooks-time'].push(entry)
            results[i + 1] = { _status_code: 200, _status_message: 'Created', ...qbtSheet(entry) }
          } else {
            const entry = entries['quickbooks-time'].find(e => e.id === item.id)
            if (!entry) { results[i + 1] = { _status_code: 404, _status_message: 'Not Found', _status_extra: 'Timesheet either has never existed or has been deleted' }; continue }
            Object.assign(entry, item.duration === undefined ? {} : { duration: item.duration }, { last_modified: stamp() })
            results[i + 1] = { _status_code: 200, _status_message: 'Updated', ...qbtSheet(entry) }
          }
        }
        return lose ? drop(req, res) : send(res, 200, { results: { timesheets: results }, supplemental_data: {} })
      }
      return send(res, 404, { error: { code: 404, message: 'Not Found' } })
    }
    send(res, 404, { message: 'Not found' })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  return {
    harvest, qbt, requests,
    origins: JSON.stringify({ harvest: origin, 'quickbooks-time': origin }),
    token: service => service === 'harvest' ? harvest.token : qbt.token,
    loseNext() { lose = true },
    /** The next Harvest create is filed under another task, as a provider-side remap would. */
    misfileNext() { misfile = true },
    /** Provider entries carrying one Pegboard entry ID, with their duration in seconds. */
    entries: (service, entryId) => entries[service].filter(e => service === 'harvest' ? e.external_reference?.id === entryId : e.notes?.startsWith(`[Pegboard:${entryId}] `))
      .map(e => ({ id: e.id, seconds: service === 'harvest' ? e.hours * 3600 : e.duration })),
    edit(service, providerId, seconds) { const e = entries[service].find(row => row.id === providerId); if (service === 'harvest') e.hours = seconds / 3600; else e.duration = seconds },
    stop: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve) }),
  }
}
