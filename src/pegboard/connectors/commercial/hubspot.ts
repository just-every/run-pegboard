// HubSpot CRM v3 objects, pipelines, properties and v3 webhook signatures.
// Wire bodies stay at this boundary; only the explicitly permitted projection leaves it.
import type { Bindings } from '../../../auth.server'
import { invalid, PegError } from '../../db'
export const deliveryStatuses = ['in_progress', 'delivered'] as const
export interface Deal {
  portalId: string; dealId: string; revision: string; stage: string; won: boolean
  fields: { dealname: string; closedate: string | null }
  deliveryStatus: string | null; deliveryOperation: string | null; url: string
}
export const sourceIdentity = (value: unknown) => {
  const id = String(value ?? '')
  if (!/^[1-9][0-9]{0,19}$/.test(id)) throw invalid('hubspot_identity')
  return id
}
export function hubspot(env: Bindings, credential: unknown) {
  if (typeof credential !== 'string' || !credential || credential.length > 4096 || /[\r\n]/.test(credential)) throw invalid('hubspot_credential_required')
  const origin = env.AUTH_LOCAL === 'true' && env.PEGBOARD_LOCAL_HUBSPOT_ORIGIN ? new URL(env.PEGBOARD_LOCAL_HUBSPOT_ORIGIN).origin : 'https://api.hubapi.com'
  async function call(method: string, path: string, body?: unknown): Promise<any> {
    let response: Response
    try {
      response = await fetch(origin + path, { method, redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { authorization: 'Bearer ' + credential, 'content-type': 'application/json', accept: 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    } catch { throw new PegError(503, 'hubspot_uncertain') }
    if ([401, 403, 404].includes(response.status)) throw new PegError(403, 'hubspot_source_refused')
    if (!response.ok) throw new PegError(503, 'hubspot_unavailable')
    const value = await response.json().catch(() => null)
    if (!value || typeof value !== 'object') throw new PegError(502, 'hubspot_schema_incomplete')
    return value
  }
  const portal = async () => sourceIdentity((await call('GET', '/account-info/v3/details')).portalId)
  return {
    portal,
    async read(portalId: string, dealId: string): Promise<Deal> {
      if (await portal() !== portalId) throw new PegError(403, 'hubspot_portal_refused')
      const properties = ['dealname', 'dealstage', 'pipeline', 'closedate', 'hs_lastmodifieddate', 'pegboard_delivery_status', 'pegboard_delivery_operation']
      const value = await call('GET', '/crm/v3/objects/deals/' + sourceIdentity(dealId) + '?properties=' + properties.join(','))
      const p = value.properties, pipelines = await call('GET', '/crm/v3/pipelines/deals')
      const stage = pipelines.results?.find((item: any) => item.id === p?.pipeline)?.stages?.find((item: any) => item.id === p?.dealstage)
      if (String(value.id) !== dealId || value.archived !== false || !p || typeof p.dealname !== 'string' || p.dealname.length > 500 || !stage || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) throw new PegError(502, 'hubspot_schema_incomplete')
      if (p.closedate && (typeof p.closedate !== 'string' || !Number.isFinite(Date.parse(p.closedate)))) throw new PegError(502, 'hubspot_schema_incomplete')
      for (const key of ['pegboard_delivery_status', 'pegboard_delivery_operation']) if (p[key] != null && (typeof p[key] !== 'string' || p[key].length > 256)) throw new PegError(502, 'hubspot_schema_incomplete')
      return { portalId, dealId, revision: value.updatedAt, stage: p.dealstage, won: stage.metadata?.isClosed === 'true' && Number(stage.metadata?.probability) === 1, fields: { dealname: p.dealname, closedate: p.closedate || null }, deliveryStatus: p.pegboard_delivery_status || null, deliveryOperation: p.pegboard_delivery_operation || null, url: 'https://app.hubspot.com/contacts/' + portalId + '/record/0-3/' + dealId }
    },
    async returnSchema(status: string) {
      if (!deliveryStatuses.includes(status as typeof deliveryStatuses[number])) throw invalid('commercial_delivery_status')
      const field = await call('GET', '/crm/v3/properties/deals/pegboard_delivery_status')
      const marker = await call('GET', '/crm/v3/properties/deals/pegboard_delivery_operation')
      if (field.name !== 'pegboard_delivery_status' || field.type !== 'enumeration' || !field.options?.some((o: any) => o.value === status && !o.hidden) || field.modificationMetadata?.readOnlyValue || marker.name !== 'pegboard_delivery_operation' || marker.type !== 'string' || marker.modificationMetadata?.readOnlyValue) throw invalid('hubspot_return_properties_required')
    },
    async write(dealId: string, status: string, operation: string) {
      await call('PATCH', '/crm/v3/objects/deals/' + sourceIdentity(dealId), { properties: { pegboard_delivery_status: status, pegboard_delivery_operation: operation } })
    },
  }
}
export async function verifiedHubspotEvents(request: Request, env: Bindings): Promise<any[]> {
  const timestamp = request.headers.get('x-hubspot-request-timestamp') ?? '', supplied = request.headers.get('x-hubspot-signature-v3') ?? ''
  if (!env.PEGBOARD_HUBSPOT_CLIENT_SECRET || !/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300000 || Number(request.headers.get('content-length') ?? 0) > 65536) throw new PegError(401, 'hubspot_signature_refused')
  const body = await request.text()
  if (body.length > 65536) throw invalid('hubspot_event_size')
  // HubSpot's documented URI decoding list; '+' remains literal.
  const uri = request.url.replace(/%(3A|2F|3F|40|21|24|27|28|29|2A|2C|3B)/gi, text => decodeURIComponent(text))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.PEGBOARD_HUBSPOT_CLIENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(request.method + uri + body + timestamp)))
  const expected = btoa(String.fromCharCode(...signed))
  let mismatch = supplied.length ^ expected.length
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0)
  if (mismatch) throw new PegError(401, 'hubspot_signature_refused')
  let events: any
  try { events = JSON.parse(body) } catch { throw invalid('hubspot_event_json') }
  if (!Array.isArray(events) || !events.length || events.length > 100) throw invalid('hubspot_events')
  for (const event of events) {
    sourceIdentity(event.portalId); sourceIdentity(event.objectId); sourceIdentity(event.eventId)
    if (event.subscriptionType !== 'deal.propertyChange' || event.propertyName !== 'dealstage' || typeof event.propertyValue !== 'string' || event.propertyValue.length > 128 || !Number.isSafeInteger(event.occurredAt)) throw invalid('hubspot_event_schema')
  }
  return events
}
