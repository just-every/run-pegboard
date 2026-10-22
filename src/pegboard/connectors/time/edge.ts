// The only code that calls Harvest or QuickBooks Time, in their official request and response schemas. A credential
// lives for one reviewed send's calls; it is never stored, logged or returned.
import type { Bindings } from '../../../auth.server'
import { invalid } from '../../db'

export type Service = 'harvest' | 'quickbooks-time'
export type Outcome =
  | { state: 'acknowledged'; providerId: number; seconds: number; differs?: string | null }
  | { state: 'rejected' | 'uncertain'; status: number | null; reason: string; stop?: boolean }
export type Found = { state: 'found'; providerId: number; seconds: number; differs: string | null } | { state: 'absent' } | { state: 'unclear'; reason: string }
export type Request = Record<string, any>

const official: Record<Service, string> = { harvest: 'https://api.harvestapp.com', 'quickbooks-time': 'https://rest.tsheets.com' }
/** Provider calls one send may make; anything left waits, unclaimed, for the next reviewed send. */
export const callBudget = 40
export class BudgetSpent extends Error {}

/** Deployed installations always use the official origin; only a local runtime may name a schema-fake origin. */
export function serviceOrigin(env: Bindings, service: Service) {
  const local = env.AUTH_LOCAL === 'true' && env.PEGBOARD_LOCAL_TIME_SERVICE_ORIGINS ? JSON.parse(env.PEGBOARD_LOCAL_TIME_SERVICE_ORIGINS)[service] : undefined
  return typeof local === 'string' ? new URL(local).origin : official[service]
}

const id = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null
const words = (...values: unknown[]) => values.filter(v => typeof v === 'string' && v).join(': ').slice(0, 300)
export const marker = (entryId: string) => `[Pegboard:${entryId}]`
const refused = (status: number | null) => status === 401
const near = (a: number, b: number) => Math.abs(a - b) < 0.000001
// An acknowledgment reconciles only when the provider's own record carries the reviewed person, work, date and duration.
const harvestDiffers = (e: any, r: Request) => ('project_id' in r ? e.user?.id === r.user_id && e.project?.id === r.project_id && e.task?.id === r.task_id && e.spent_date === r.spent_date && e.external_reference?.id === r.external_reference?.id && e.is_running === false : true)
  && near(e.hours * 3600, r.hours * 3600) ? null : 'provider_fields_differ'
const qbtDiffers = (e: any, r: Request) => ('jobcode_id' in r ? e.user_id === r.user_id && e.jobcode_id === r.jobcode_id && e.date === r.date && e.type === 'manual' && e.notes === r.notes : true)
  && e.duration === r.duration ? null : 'provider_fields_differ'
// Only an explicit refusal proves nothing was written; throttling, server errors and lost responses stay uncertain.
const failed = (status: number | null, reason: string): Outcome => status === 401
  ? { state: 'rejected', status, reason: 'time_service_credential_refused', stop: true }
  : status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429
    ? { state: 'rejected', status, reason: reason || `HTTP ${status}` }
    : { state: 'uncertain', status, reason: status === null ? 'response_lost' : `HTTP ${status}` }

export function timeService(env: Bindings, service: Service, credential: string, account: string | null) {
  const origin = serviceOrigin(env, service)
  let calls = 0
  async function call(method: string, path: string, body?: unknown): Promise<{ status: number | null; body: any }> {
    if (++calls > callBudget) throw new BudgetSpent()
    const headers: Record<string, string> = { authorization: `Bearer ${credential}`, accept: 'application/json' }
    if (service === 'harvest') Object.assign(headers, { 'harvest-account-id': account!, 'user-agent': `Pegboard (${new URL(env.AUTH_ORIGIN).origin})` })
    if (body !== undefined) headers['content-type'] = 'application/json'
    try {
      const response = await fetch(origin + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(20_000) })
      return { status: response.status, body: (response.headers.get('content-type') ?? '').includes('json') ? await response.json().catch(() => null) : null }
    } catch {
      return { status: null, body: null }
    }
  }
  const qbtItem = (item: any, request: Request): Outcome => {
    const code = Number(item?._status_code)
    if ((code === 200 || code === 201) && id(item.id) && Number.isFinite(item.duration)) return { state: 'acknowledged', providerId: item.id, seconds: item.duration, differs: qbtDiffers(item, request) }
    return code >= 400 && code < 500 ? { state: 'rejected', status: code, reason: words(item._status_message, item._status_extra) } : { state: 'uncertain', status: code || null, reason: 'acknowledgment_incomplete' }
  }
  const harvestEntry = (status: number | null, body: any, ok: number, request: Request): Outcome =>
    status === ok && id(body?.id) && Number.isFinite(body.hours) ? { state: 'acknowledged', providerId: body.id, seconds: body.hours * 3600, differs: harvestDiffers(body, request) } : status === ok ? { state: 'uncertain', status, reason: 'acknowledgment_incomplete' } : failed(status, words(body?.message, body?.error_description))
  return {
    left: () => callBudget - calls,
    /** The authenticated receiver: the Harvest account the credential opens, or QuickBooks Time's company. */
    async receiver(): Promise<{ account: string; name: string }> {
      if (service === 'harvest') {
        const me = await call('GET', '/v2/users/me')
        if (me.status !== 200 || !id(me.body?.id)) throw invalid(refused(me.status) || me.status === 403 ? 'time_service_credential_refused' : 'time_service_unavailable')
        return { account: account!, name: `Harvest account ${account}` }
      }
      const me = await call('GET', '/api/v1/current_user'), user: any = Object.values(me.body?.results?.users ?? {})[0]
      if (me.status !== 200 || typeof user?.client_url !== 'string' || !user.client_url) throw invalid(refused(me.status) ? 'time_service_credential_refused' : 'time_service_unavailable')
      return { account: user.client_url, name: words(user.company_name) || user.client_url }
    },
    async create(requests: Request[]): Promise<Outcome[]> {
      if (service === 'harvest') {
        const out: Outcome[] = []
        for (const request of requests) {
          const r = await call('POST', '/v2/time_entries', request), outcome = harvestEntry(r.status, r.body, 201, request)
          out.push(outcome)
          if ('stop' in outcome && outcome.stop) break
        }
        return out
      }
      const r = await call('POST', '/api/v1/timesheets', { data: requests })
      if (r.status !== 200) return requests.map(() => failed(r.status, words(r.body?.error?.message)))
      return requests.map((request, i) => qbtItem(r.body?.results?.timesheets?.[String(i + 1)], request))
    },
    /** Read back the one entry a lost or uncertain request may have written, by its Pegboard identity. */
    async find(entryId: string, request: Request): Promise<Found> {
      if (service === 'harvest') {
        const q = new URLSearchParams({ external_reference_id: entryId, user_id: String(request.user_id), from: request.spent_date, to: request.spent_date })
        const r = await call('GET', `/v2/time_entries?${q}`)
        if (r.status !== 200 || !Array.isArray(r.body?.time_entries) || r.body.next_page !== null) return { state: 'unclear', reason: 'readback_incomplete' }
        const rows = r.body.time_entries.filter((e: any) => e?.external_reference?.id === entryId)
        return rows.length === 0 ? { state: 'absent' } : rows.length === 1 && id(rows[0].id) && Number.isFinite(rows[0].hours) ? { state: 'found', providerId: rows[0].id, seconds: rows[0].hours * 3600, differs: harvestDiffers(rows[0], request) } : { state: 'unclear', reason: 'duplicate_provider_entries' }
      }
      const q = new URLSearchParams({ start_date: request.date, end_date: request.date, user_ids: String(request.user_id), jobcode_ids: String(request.jobcode_id), on_the_clock: 'both', limit: '200' })
      const r = await call('GET', `/api/v1/timesheets?${q}`)
      const sheets = r.body?.results?.timesheets
      if (r.status !== 200 || !sheets || typeof sheets !== 'object' || r.body.more !== false) return { state: 'unclear', reason: 'readback_incomplete' }
      const rows = Object.values(sheets).filter((e: any) => typeof e?.notes === 'string' && e.notes.startsWith(marker(entryId) + ' ')) as any[]
      return rows.length === 0 ? { state: 'absent' } : rows.length === 1 && id(rows[0].id) && Number.isFinite(rows[0].duration) ? { state: 'found', providerId: rows[0].id, seconds: rows[0].duration, differs: qbtDiffers(rows[0], request) } : { state: 'unclear', reason: 'duplicate_provider_entries' }
    },
    /** The provider's current duration for one entry, in seconds, or null when it cannot be read. */
    async seconds(providerId: number): Promise<number | null> {
      if (service === 'harvest') {
        const r = await call('GET', `/v2/time_entries/${providerId}`)
        return r.status === 200 && r.body?.id === providerId && Number.isFinite(r.body.hours) ? r.body.hours * 3600 : null
      }
      const r = await call('GET', `/api/v1/timesheets?${new URLSearchParams({ ids: String(providerId), on_the_clock: 'both' })}`), row = r.body?.results?.timesheets?.[String(providerId)]
      return r.status === 200 && row?.id === providerId && Number.isFinite(row.duration) ? row.duration : null
    },
    /** Set one acknowledged entry's duration; the correction never deletes or duplicates the provider entry. */
    async correct(providerId: number, seconds: number): Promise<Outcome> {
      if (service === 'harvest') {
        const request = { hours: seconds / 3600 }, r = await call('PATCH', `/v2/time_entries/${providerId}`, request)
        return harvestEntry(r.status, r.body, 200, request)
      }
      const request = { id: providerId, duration: seconds }, r = await call('PUT', '/api/v1/timesheets', { data: [request] })
      return r.status === 200 ? qbtItem(r.body?.results?.timesheets?.['1'], request) : failed(r.status, words(r.body?.error?.message))
    },
  }
}
