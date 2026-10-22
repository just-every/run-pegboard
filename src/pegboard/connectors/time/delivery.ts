// Reviewed time delivery (PEG-042). A workspace owner or administrator sends an approved timesheet's exact reviewed
// packet to Harvest or QuickBooks Time. Each entry has one durable row per receiver account, claimed before its request,
// so replays, lost responses and repaired mappings never write a second provider entry. Approved adjustments become
// read-before-write corrections of the acknowledged entry. Nothing here touches invoices, rates or payroll.
import type { Bindings } from '../../../auth.server'
import { all, batch, bound, conflict, first, forbidden, invalid, now, placeholders } from '../../db'
import { auditStatement } from '../../authorization/audit'
import { isAdministrator } from '../../authorization/levels'
import { workspaceRole, type Actor } from '../../workspace/people'
import { sheetView } from '../../time/time'
import { timePacket } from './packets'
import { BudgetSpent, timeService, type Outcome, type Request, type Service } from './edge'

export interface DeliveryRow {
  service: Service; account: string; entry_id: string; sheet_id: string; kind: 'entry' | 'correction'; target_entry_id: string
  state: 'sending' | 'uncertain' | 'acknowledged' | 'rejected'; provider_id: number | null; seconds: number; provider_seconds: number | null
  request: string; status_code: number | null; reason: string | null; attempts: number; actor_id: string; updated_at: number
}
/** A claim older than this outlived its request's timeout: it is read back before anything is resent. */
const lease = 120_000
const correction = 'adjustment_requires_reviewed_provider_correction'
const same = (a: number, b: number) => Math.abs(a - b) < 0.000001
const shape = (r: DeliveryRow) => ({
  service: r.service, account: r.account, externalId: r.entry_id, kind: r.kind, correctionOf: r.kind === 'correction' ? r.target_entry_id : null,
  state: r.state, providerId: r.provider_id, seconds: r.seconds, providerSeconds: r.provider_seconds, statusCode: r.status_code, reason: r.reason,
  attempts: r.attempts, updatedAt: r.updated_at,
})
async function sends(db: D1Database, actor: Actor, workspaceId: string) {
  return isAdministrator(await workspaceRole(db, actor.id, workspaceId))
}

export async function deliverTime(db: D1Database, env: Bindings, actor: Actor, id: string, input: Record<string, any>) {
  const packet = await timePacket(db, actor, id, input), { service } = packet
  const sheet = (await first<{ workspace_id: string }>(db, 'SELECT workspace_id FROM peg_timesheets WHERE id=?', id))!
  if (!(await sends(db, actor, sheet.workspace_id))) throw forbidden('workspace_administrator_sends_time')
  if (input.revision !== packet.revision) throw conflict('timesheet_preview_changed')
  if (input.confirm !== 'reviewed-exact-packet') throw invalid('review_exact_packet')
  const credential = typeof input.credential === 'string' ? input.credential.trim() : ''
  if (!credential || credential.length > 4096) throw invalid('time_service_credential')
  const harvestAccount = service === 'harvest' ? String(input.account ?? '').trim() : null
  if (harvestAccount !== null && !/^\d{1,20}$/.test(harvestAccount)) throw invalid('harvest_account_id')
  const link = timeService(env, service, credential, harvestAccount), receiver = await link.receiver(), account = receiver.account
  const adjustments = packet.pending.filter(p => p.reason === correction), held: typeof packet.pending = []
  const ids = [...new Set([...packet.rows.map(r => r.externalId), ...adjustments.flatMap(a => [a.externalId, a.adjustmentOf!])])]
  const load = async () => new Map((ids.length ? await all<DeliveryRow>(db, `SELECT * FROM peg_time_deliveries WHERE service=? AND account=? AND entry_id IN (${placeholders(ids)})`, service, account, ...ids) : []).map(r => [r.entry_id, r]))
  // History copies the row this send itself wrote, so a send that lost a race records nothing.
  const trail = (entryId: string, attempt: number, state: string, at: number) =>
    bound(db, 'INSERT INTO peg_time_delivery_history(service,account,entry_id,sheet_id,actor_id,at,state,provider_id,provider_seconds,status_code,reason) SELECT ?,?,?,?,?,?,?,provider_id,provider_seconds,status_code,reason FROM peg_time_deliveries WHERE service=? AND account=? AND entry_id=? AND attempts=? AND state=? AND updated_at=? AND actor_id=?',
      [service, account, entryId, id, actor.id, at, state, service, account, entryId, attempt, state, at, actor.id])
  // A claim either creates the row or advances an unacknowledged row at the attempt this send read; losing a race skips it.
  async function claim(entryId: string, kind: 'entry' | 'correction', target: string, seconds: number, request: Request, existing: DeliveryRow | undefined, providerId: number | null = null) {
    const at = now(), attempt = existing ? existing.attempts + 1 : 1
    // One correction per acknowledged entry at a time, so two sends never compute totals from the same prior value.
    const inFlight = "NOT EXISTS(SELECT 1 FROM peg_time_deliveries o WHERE o.service=? AND o.account=? AND o.target_entry_id=? AND o.kind='correction' AND o.entry_id<>? AND o.state IN ('sending','uncertain'))"
    const guard = kind === 'correction' ? [service, account, target, entryId] : [], only = kind === 'correction' ? ` AND ${inFlight}` : ''
    const [result] = await batch(db, [
      existing
        ? bound(db, `UPDATE peg_time_deliveries SET state='sending',attempts=attempts+1,actor_id=?,updated_at=? WHERE service=? AND account=? AND entry_id=? AND attempts=? AND state<>'acknowledged'${only}`, [actor.id, at, service, account, entryId, existing.attempts, ...guard])
        : bound(db, `INSERT OR IGNORE INTO peg_time_deliveries(service,account,entry_id,sheet_id,kind,target_entry_id,state,provider_id,seconds,request,attempts,actor_id,updated_at) SELECT ?,?,?,?,?,?,'sending',?,?,?,1,?,? WHERE 1${only}`, [service, account, entryId, id, kind, target, providerId, seconds, JSON.stringify(request), actor.id, at, ...guard]),
      trail(entryId, attempt, 'sending', at),
    ])
    return result.meta.changes === 1 ? attempt : null
  }
  async function settle(entryId: string, attempt: number, outcome: Outcome, request: Request) {
    const ack = outcome.state === 'acknowledged', at = now()
    await batch(db, [
      bound(db, "UPDATE peg_time_deliveries SET state=?,provider_id=COALESCE(?,provider_id),provider_seconds=?,request=?,status_code=?,reason=?,actor_id=?,updated_at=? WHERE service=? AND account=? AND entry_id=? AND attempts=? AND state='sending'",
        [outcome.state, ack ? outcome.providerId : null, ack ? outcome.seconds : null, JSON.stringify(request), ack ? null : outcome.status, ack ? outcome.differs ?? null : outcome.reason, actor.id, at, service, account, entryId, attempt]),
      trail(entryId, attempt, outcome.state, at),
    ])
    return 'stop' in outcome && outcome.stop ? outcome.reason : null
  }
  let ledger = await load(), stopped: string | null = null
  const remaining: string[] = [], inProgress: string[] = []
  try {
    // Entries. A row whose last request may have landed is read back by its Pegboard identity before any new request.
    const queued: { entryId: string; attempt: number; request: Request }[] = []
    const flush = async () => {
      const outcomes = queued.length ? await link.create(queued.map(q => q.request)) : []
      for (const [i, q] of queued.entries()) {
        const stop = await settle(q.entryId, q.attempt, outcomes[i] ?? { state: 'uncertain', status: null, reason: 'not_attempted' }, q.request)
        stopped ??= stop
      }
      queued.length = 0
    }
    for (const row of packet.rows) {
      const existing = ledger.get(row.externalId)
      if (existing?.state === 'acknowledged') continue
      if (existing?.state === 'sending' && now() - existing.updated_at < lease) { inProgress.push(row.externalId); continue }
      const unsure = !!existing && existing.state !== 'rejected', need = (unsure ? 1 : 0) + 1
      if (stopped || link.left() < need) { remaining.push(row.externalId); continue }
      const attempt = await claim(row.externalId, 'entry', row.externalId, row.seconds, row.body, existing)
      if (attempt === null) { inProgress.push(row.externalId); continue }
      if (unsure) {
        const prior = JSON.parse(existing!.request), found = await link.find(row.externalId, prior)
        if (found.state === 'found') { await settle(row.externalId, attempt, { state: 'acknowledged', providerId: found.providerId, seconds: found.seconds, differs: found.differs }, prior); continue }
        if (found.state === 'unclear') { await settle(row.externalId, attempt, { state: 'uncertain', status: null, reason: found.reason }, prior); continue }
      }
      queued.push({ entryId: row.externalId, attempt, request: row.body })
      if (service === 'harvest' || queued.length === 50) await flush()
    }
    await flush()
    // Corrections: the provider must still hold exactly the prior total, so a later provider edit is never overwritten.
    ledger = await load()
    for (const adjustment of adjustments) {
      const target = ledger.get(adjustment.adjustmentOf!), existing = ledger.get(adjustment.externalId)
      if (existing?.state === 'acknowledged') continue
      if (!target || target.kind !== 'entry' || target.state !== 'acknowledged') { held.push({ ...adjustment, reason: 'original_not_acknowledged_by_receiver' }); continue }
      if (existing?.state === 'sending' && now() - existing.updated_at < lease) { inProgress.push(adjustment.externalId); continue }
      const applied = (await first<{ n: number }>(db, "SELECT COALESCE(SUM(seconds),0) n FROM peg_time_deliveries WHERE service=? AND account=? AND target_entry_id=? AND kind='correction' AND state='acknowledged'", service, account, target.entry_id))!.n
      const prior = target.seconds + applied, next = prior + adjustment.seconds
      if (next <= 0) { held.push({ ...adjustment, reason: 'provider_total_must_stay_positive' }); continue }
      if (service === 'quickbooks-time' && next % 36 !== 0) { held.push({ ...adjustment, reason: 'provider_rounds_manual_duration' }); continue }
      if (stopped || link.left() < 2) { remaining.push(adjustment.externalId); continue }
      const request = service === 'harvest' ? { hours: next / 3600 } : { id: target.provider_id, duration: next }
      const attempt = await claim(adjustment.externalId, 'correction', target.entry_id, adjustment.seconds, request, existing, target.provider_id)
      if (attempt === null) { inProgress.push(adjustment.externalId); continue }
      const current = await link.seconds(target.provider_id!)
      if (current === null) { await settle(adjustment.externalId, attempt, { state: 'uncertain', status: null, reason: 'readback_incomplete' }, request); continue }
      if (same(current, next)) { await settle(adjustment.externalId, attempt, { state: 'acknowledged', providerId: target.provider_id!, seconds: current }, request); continue }
      if (!same(current, prior)) { await settle(adjustment.externalId, attempt, { state: 'rejected', status: null, reason: 'provider_value_changed' }, request); continue }
      const stop = await settle(adjustment.externalId, attempt, await link.correct(target.provider_id!, next), request)
      stopped ??= stop
    }
  } catch (error) {
    if (!(error instanceof BudgetSpent)) throw error
  }
  ledger = await load()
  const rows = [...packet.rows.map(r => r.externalId), ...adjustments.map(a => a.externalId)].flatMap(entryId => ledger.get(entryId) ?? []).map(shape)
  const count = (state: string) => rows.filter(r => r.state === state).length
  const summary = { service, account, acknowledged: count('acknowledged'), rejected: count('rejected'), uncertain: count('uncertain'), remaining: remaining.length, inProgress: inProgress.length }
  await batch(db, [
    bound(db, 'INSERT INTO peg_time_history(sheet_id,actor_id,at,action,detail) VALUES(?,?,?,?,?)', [id, actor.id, now(), 'provider_delivery', JSON.stringify(summary)]),
    auditStatement(db, { workspaceId: sheet.workspace_id, actorId: actor.id, action: 'time.provider_delivery', targetType: 'timesheet', targetId: id, detail: summary }),
  ])
  const pending = [...packet.pending.filter(p => p.reason !== correction), ...held]
  return {
    service, account, receiver: receiver.name, sheetId: id, revision: packet.revision, delivery: 'reviewed_send', receiptAuthority: 'provider_response',
    rows, pending, remaining, inProgress, stopped, totalSeconds: packet.totalSeconds,
    acknowledgedSeconds: rows.filter(r => r.state === 'acknowledged').reduce((n, r) => n + r.seconds, 0),
    complete: !pending.length && !remaining.length && !inProgress.length && rows.length === packet.rows.length + adjustments.length && rows.every(r => r.state === 'acknowledged' && !r.reason),
  }
}

/** The delivery ledger for the entries a person can currently open on a sheet, and whether they may send it. */
export async function timeDeliveries(db: D1Database, actor: Actor, id: string) {
  const view = await sheetView(db, actor, id), visible = view.entries.filter(e => e.available).map(e => e.id)
  const rows = visible.length ? await all<DeliveryRow>(db, `SELECT * FROM peg_time_deliveries WHERE entry_id IN (${placeholders(visible)}) ORDER BY service,account,updated_at,entry_id`, ...visible) : []
  return {
    sheetId: id, revision: view.token, rows: rows.map(shape),
    canSend: view.sheet.status === 'approved' && view.entries.every(e => e.available) && await sends(db, actor, view.sheet.workspace_id),
  }
}
