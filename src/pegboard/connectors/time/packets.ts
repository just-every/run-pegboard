// Read-only official-schema packets. Nothing in this module contacts a provider or claims a verified receipt.
import { invalid, conflict, forbidden } from '../../db'
import { sheetView } from '../../time/time'
import type { Actor } from '../../workspace/people'

type Service = 'harvest' | 'quickbooks-time'
type Source = { externalId: string; personId: string; projectId: string | null; taskId: string | null; taskReference: string | null; date: string; seconds: number; adjustmentOf: string | null }
type PacketRow = Source & { body: Record<string, any> }
const object = (value: unknown): Record<string, any> => {
  if (typeof value === 'string') {
    if (value.length > 500_000) throw invalid('time_packet_too_large')
    try { value = JSON.parse(value) } catch { throw invalid('time_packet_json') }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('time_packet_object')
  return value as Record<string, any>
}
const externalId = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null
const serviceOf = (value: unknown): Service => {
  if (value !== 'harvest' && value !== 'quickbooks-time') throw invalid('time_service')
  return value
}
const marker = (id: string) => `[Pegboard:${id}]`
export async function timePacket(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  const service = serviceOf(input.service), view = await sheetView(db, actor, id)
  if (view.sheet.status !== 'approved') throw conflict('approved_timesheet_required')
  if (view.entries.some(e => !e.available)) throw forbidden('current_task_access')
  const mapping = object(input.mapping ?? {})
  const rows: PacketRow[] = [], pending: (Source & { reason: string })[] = []
  for (const entry of view.entries) {
    const user = externalId(mapping.people?.[entry.person_id]), project = externalId(mapping.projects?.[entry.project_id!]), task = externalId(mapping.tasks?.[entry.task_id!]), jobcode = externalId(mapping.jobcodes?.[`${entry.project_id}/${entry.task_id}`])
    const reason = entry.adjustment_of ? 'adjustment_requires_reviewed_provider_correction' : !entry.seconds ? 'positive_duration_required' : !user ? 'map_person' : service === 'harvest' && (!project || !task) ? 'map_project_and_task' : service === 'quickbooks-time' && !jobcode ? 'map_project_task_jobcode' : service === 'quickbooks-time' && entry.seconds % 36 !== 0 ? 'provider_rounds_manual_duration' : null
    const source = { externalId: entry.id, personId: entry.person_id, projectId: entry.project_id, taskId: entry.task_id, taskReference: entry.ref, date: entry.work_date, seconds: entry.seconds!, adjustmentOf: entry.adjustment_of }
    if (reason) { pending.push({ ...source, reason }); continue }
    const body = service === 'harvest'
      ? { user_id: user!, project_id: project!, task_id: task!, spent_date: entry.work_date, hours: entry.seconds! / 3600, notes: entry.notes, external_reference: { id: entry.id, group_id: id } }
      : { user_id: user!, jobcode_id: jobcode!, type: 'manual', date: entry.work_date, duration: entry.seconds!, notes: `${marker(entry.id)} ${entry.notes}` }
    rows.push({ ...source, body })
  }
  return {
    service, sheetId: id, revision: view.token, approval: { personId: view.sheet.decided_by, at: view.sheet.decided_at },
    delivery: 'not_sent', receiptAuthority: 'user_supplied_unverified',
    totalSeconds: view.totalSeconds, exportableSeconds: rows.reduce((n, e) => n + e.seconds, 0),
    rows, pending,
    requests: service === 'harvest'
      ? rows.map(row => ({ method: 'POST', url: 'https://api.harvestapp.com/v2/time_entries', body: row.body }))
      : Array.from({ length: Math.ceil(rows.length / 50) }, (_, i) => ({ method: 'POST', url: 'https://rest.tsheets.com/api/v1/timesheets', body: { data: rows.slice(i * 50, i * 50 + 50).map(row => row.body) } })),
  }
}

// Compare a caller-provided complete provider readback with current approved work. A match is not proof of delivery.
export async function reconcileTimePacket(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  const packet = await timePacket(db, actor, id, input)
  if (input.revision !== packet.revision) throw conflict('timesheet_preview_changed')
  const response = object(input.response)
  let received: any[]
  if (packet.service === 'harvest') {
    if (!Array.isArray(response.time_entries) || response.next_page !== null || response.total_pages !== 1 || ('total_entries' in response && response.total_entries !== response.time_entries.length)) throw invalid('complete_harvest_readback_required')
    received = response.time_entries
  } else {
    if (!response.results?.timesheets || typeof response.results.timesheets !== 'object' || Array.isArray(response.results.timesheets) || response.more !== false) throw invalid('complete_quickbooks_time_readback_required')
    received = Object.values(response.results.timesheets)
  }
  if (received.length > 5000 || received.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw invalid('time_readback_rows')
  const used = new Set<any>(), matched = [], issues = []
  for (const row of packet.rows) {
    const candidates = received.filter(receipt => packet.service === 'harvest' ? receipt.external_reference?.id === row.externalId : typeof receipt.notes === 'string' && receipt.notes.startsWith(marker(row.externalId) + ' '))
    if (candidates.length !== 1) { issues.push({ externalId: row.externalId, reason: candidates.length ? 'duplicate_external_id' : 'missing' }); continue }
    const receipt = candidates[0], body = row.body as Record<string, any>
    used.add(receipt)
    const seconds = packet.service === 'harvest' ? receipt.hours * 3600 : receipt.duration
    const durationMatches = typeof (packet.service === 'harvest' ? receipt.hours : receipt.duration) === 'number' && Number.isFinite(seconds) && Math.abs(seconds - row.seconds) < 0.000001
    const matches = externalId(receipt.id) !== null && received.filter(r => r.id === receipt.id).length === 1 && durationMatches && (packet.service === 'harvest'
      ? receipt.user?.id === body.user_id && receipt.project?.id === body.project_id && receipt.task?.id === body.task_id && receipt.spent_date === body.spent_date && receipt.external_reference?.group_id === id && receipt.is_running === false
      : receipt.user_id === body.user_id && receipt.jobcode_id === body.jobcode_id && receipt.date === body.date && receipt.type === 'manual' && (!('_status_code' in receipt) || receipt._status_code === 200))
    if (matches) matched.push({ externalId: row.externalId, providerId: receipt.id, seconds: row.seconds })
    else issues.push({ externalId: row.externalId, reason: 'provider_fields_or_duration_differ' })
  }
  const unexpectedCount = received.filter(row => !used.has(row)).length
  return { service: packet.service, sheetId: id, revision: packet.revision, delivery: packet.delivery, receiptAuthority: packet.receiptAuthority, matched, issues, pending: packet.pending, unexpectedCount, matchedSeconds: matched.reduce((n, row) => n + row.seconds, 0), totalSeconds: packet.totalSeconds, reconciled: !issues.length && !packet.pending.length && !unexpectedCount }
}
