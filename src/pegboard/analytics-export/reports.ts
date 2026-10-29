import { all, bound, first, forbidden, invalid, now, PegError, run } from '../db'
import { dataRevision } from '../data/settings'
import { permanentEvent } from '../audit/search'
import { administers, type Actor } from '../workspace/people'
import { capture, feed, guard, load } from './snapshots'
import { standing, type AnalystKey } from './keys'
import { datasets, type Dataset, type Fields } from './schema'

export interface Schedule { key_id: string; hours: number; next_at: number; last_snapshot: string | null; stopped_at: number | null }
export async function ownKey(db: D1Database, actor: Actor, workspace: string, id: string) {
  if (!await administers(db, actor, workspace)) throw forbidden('administrator_required')
  const key = await first<AnalystKey>(db, 'SELECT * FROM peg_analytics_keys WHERE id=? AND owner_id=? AND workspace_id=?', id, actor.id, workspace)
  if (!key) throw forbidden('analyst_key')
  await standing(db, key)
  return key
}
export async function readReport(db: D1Database, key: AnalystKey, snapshotId: string) {
  const snapshot = await load(db, key, snapshotId), fields: Fields = JSON.parse(key.fields), data: Partial<Record<Dataset, Record<string, any>[]>> = {}
  const rev = await dataRevision(db)
  for (const dataset of datasets.filter(name => fields[name])) {
    const rows: Record<string, any>[] = []
    let path: string | undefined = `https://analytics.invalid/${dataset}?snapshot=${encodeURIComponent(snapshotId)}`
    while (path) {
      const page = await feed(db, key, dataset, new Request(path), 'https://analytics.invalid')
      rows.push(...page.value); path = '@odata.nextLink' in page ? page['@odata.nextLink'] : undefined
    }
    data[dataset] = rows
  }
  await standing(db, key)
  await guard(db, key, rev)
  return { definition: 'pegboard.analytics.v1', snapshot: snapshot.id, capturedAt: snapshot.captured_at,
    sourceRevision: snapshot.source_revision, stale: snapshot.source_revision !== rev, expiresAt: snapshot.expires_at,
    counts: Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows!.length])),
    estimateHours: fields.Tasks?.includes('estimateHours') ? data.Tasks!.reduce((n, row) => n + row.estimateHours, 0) : null,
    approvedSeconds: fields.TimeEntries?.includes('seconds') ? data.TimeEntries!.reduce((n, row) => n + row.seconds, 0) : null, data }
}
export async function createReport(db: D1Database, key: AnalystKey) {
  const snapshot = await capture(db, key)
  return readReport(db, key, snapshot.id)
}
export function reportCsv(report: Awaited<ReturnType<typeof readReport>>, dataset: Dataset, fields: Fields) {
  if (!fields[dataset]) throw new PegError(404, 'dataset_unavailable')
  const names = fields[dataset]!, cell = (value: unknown) => {
    let text = value === null || value === undefined ? '' : String(value)
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = "'" + text
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
  }
  return [names.join(','), ...report.data[dataset]!.map(row => names.map(name => cell(row[name])).join(','))].join('\r\n') + '\r\n'
}
export async function saveSchedule(db: D1Database, key: AnalystKey, input: Record<string, any>) {
  const hours = Number(input.hours)
  if (![24, 168].includes(hours) || input.consent !== true) throw invalid('analyst_report_consent')
  const rev = await dataRevision(db)
  await standing(db, key)
  await guard(db, key, rev, [bound(db, `INSERT INTO peg_analytics_schedules VALUES(?,?,?,NULL,NULL)
    ON CONFLICT(key_id) DO UPDATE SET hours=excluded.hours,next_at=excluded.next_at,stopped_at=NULL`, [key.id, hours, now()]),
    permanentEvent(db, { workspace: key.workspace_id, actor: key.owner_id, action: 'analytics.report_scheduled', type: 'analyst_key', id: key.id, metadata: { hours } })])
  return { scheduled: true }
}
export async function stopSchedule(db: D1Database, key: AnalystKey) {
  await run(db, 'UPDATE peg_analytics_schedules SET stopped_at=COALESCE(stopped_at,?) WHERE key_id=?', now(), key.id)
  return { stopped: true }
}
/** Local materialization only: no mail, external delivery or product mutation. */
export async function processReports(db: D1Database, ownerId?: string, workspace?: string) {
  const due = await all<Schedule & AnalystKey>(db, `SELECT k.*,s.hours,s.next_at,s.key_id FROM peg_analytics_schedules s JOIN peg_analytics_keys k ON k.id=s.key_id
    WHERE s.stopped_at IS NULL AND s.next_at<=? ${ownerId ? 'AND k.owner_id=? AND k.workspace_id=?' : ''} ORDER BY s.next_at,k.id LIMIT 20`, now(), ...(ownerId ? [ownerId, workspace!] : []))
  const results = []
  for (const key of due) {
    try {
      await standing(db, key)
      const snapshot = await capture(db, key), rev = await dataRevision(db)
      await guard(db, key, rev, [bound(db, 'INSERT INTO peg_analytics_runs VALUES(?,?,?)', [key.id, key.next_at, snapshot.id]),
        bound(db, 'UPDATE peg_analytics_schedules SET next_at=?,last_snapshot=? WHERE key_id=? AND next_at=? AND stopped_at IS NULL', [now() + key.hours * 3600000, snapshot.id, key.id, key.next_at]),
        permanentEvent(db, { workspace: key.workspace_id, actor: key.owner_id, action: 'analytics.report_captured', type: 'analyst_key', id: key.id })])
      results.push({ keyId: key.id, snapshot: snapshot.id, status: 'captured' })
    } catch (error) {
      if (error instanceof PegError && [400, 401, 403, 404].includes(error.status)) {
        await stopSchedule(db, key)
        results.push({ keyId: key.id, status: 'authority_ended' })
      } else if (/UNIQUE constraint failed: peg_analytics_runs/.test(String(error))) results.push({ keyId: key.id, status: 'already_captured' })
      else throw error
    }
  }
  return { results }
}
