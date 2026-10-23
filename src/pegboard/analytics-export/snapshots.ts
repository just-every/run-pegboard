import { all, batch, bound, conflict, first, invalid, newId, now, PegError } from '../db'
import { dataRevision } from '../data/settings'
import { digest, revision } from '../decisions/revision'
import { projectTaskIds } from '../fields/definitions'
import { openTask } from '../tasks/access'
import { openProject } from '../workspace/projects'
import { sheetView } from '../time/time'
import { keyActor, standing, type AnalystKey } from './keys'
import { datasets, type Dataset, type Fields } from './schema'

interface Snapshot { id: string; key_id: string; captured_at: number; source_revision: number; expires_at: number }
interface Row { dataset: Dataset; id: string; task_id: string | null; project_id: string | null; body: string | null; hash: string }
export async function guard(db: D1Database, key: AnalystKey, expected: number, statements: D1PreparedStatement[] = []) {
  const deadline = Math.min(key.expires_at, (await revision(db)).until ?? Infinity)
  try { return await batch(db, [bound(db, 'INSERT INTO peg_analytics_guards VALUES(?,?,?,?)', [newId('guard'), key.id, expected, deadline]), ...statements]) }
  catch (error) { if (/analyst_read_changed/.test(String(error))) throw conflict('analyst_read_changed'); throw error }
}
async function capture(db: D1Database, key: AnalystKey) {
  const sourceRevision = await dataRevision(db)
  await standing(db, key)
  const actor = keyActor(key), fields: Fields = JSON.parse(key.fields), projects: string[] = JSON.parse(key.projects)
  const rows: Row[] = [], tasks = new Set<string>()
  const add = async (dataset: Dataset, record: Record<string, unknown>, taskId: string | null, projectId: string | null) => {
    if (!fields[dataset]) return
    const body = JSON.stringify(Object.fromEntries(fields[dataset]!.map(name => [name, record[name] ?? null])))
    rows.push({ dataset, id: String(record.id), task_id: taskId, project_id: projectId, body, hash: await digest(body) })
  }
  for (const projectId of projects) {
    const { project } = await openProject(db, actor, projectId)
    await add('Projects', { id: project.id, name: project.name, status: project.status }, null, projectId)
    for (const taskId of new Set((await projectTaskIds(db, projectId)).map(row => row.task_id))) {
      const opened = await openTask(db, actor, taskId).catch(() => null)
      if (!opened?.access.contexts.get(projectId)?.capabilities.has('export')) continue
      const task = opened.task
      await add('TaskProjects', { id: task.id + ':' + projectId, taskId: task.id, projectId }, task.id, projectId)
      if (tasks.has(task.id)) continue
      tasks.add(task.id)
      await add('Tasks', { id: task.id, title: task.title, status: task.status, estimateHours: task.estimate_hours }, task.id, null)
    }
  }
  if (fields.TimeEntries) {
    for (const sheet of await all<{ id: string }>(db, "SELECT id FROM peg_timesheets WHERE workspace_id=? AND status='approved' ORDER BY id", key.workspace_id)) {
      const view = await sheetView(db, actor, sheet.id).catch(() => null)
      if (!view) continue
      for (const entry of view.entries) {
        if (!entry.available || !entry.task_id || !tasks.has(entry.task_id) || !entry.project_id || !projects.includes(entry.project_id)) continue
        await add('TimeEntries', { id: entry.id, taskId: entry.task_id, projectId: entry.project_id, sheetId: sheet.id, seconds: entry.seconds, adjustmentOf: entry.adjustment_of }, entry.task_id, entry.project_id)
      }
    }
  }
  const capturedAt = now(), id = newId('snapshot'), expiresAt = Math.min(key.expires_at, capturedAt + 86400000)
  await guard(db, key, sourceRevision, [
    bound(db, 'DELETE FROM peg_analytics_snapshots WHERE expires_at<=?', [capturedAt]),
    bound(db, 'INSERT INTO peg_analytics_snapshots VALUES(?,?,?,?,?)', [id, key.id, capturedAt, sourceRevision, expiresAt]),
    ...rows.map(row => bound(db, 'INSERT INTO peg_analytics_rows VALUES(?,?,?,?,?,?,?)', [id, row.dataset, row.id, row.task_id, row.project_id, row.body, row.hash])),
  ])
  return { id, key_id: key.id, captured_at: capturedAt, source_revision: sourceRevision, expires_at: expiresAt }
}
async function load(db: D1Database, key: AnalystKey, id: string) {
  const snapshot = await first<Snapshot>(db, 'SELECT * FROM peg_analytics_snapshots WHERE id=? AND key_id=? AND expires_at>?', id, key.id, now())
  if (!snapshot) throw new PegError(410, 'snapshot_unavailable_refresh_required')
  return snapshot
}
export async function feed(db: D1Database, key: AnalystKey, dataset: Dataset, request: Request, base: string) {
  const query = new URL(request.url).searchParams, fields: Fields = JSON.parse(key.fields)
  if (!datasets.includes(dataset) || !fields[dataset]) throw new PegError(404, 'dataset_unavailable')
  for (const name of query.keys()) if (!['snapshot', 'since', '$skiptoken', '$select', '$count'].includes(name)) throw invalid('unsupported_analytics_query')
  if (query.has('$count') && !['true', 'false'].includes(query.get('$count')!)) throw invalid('analytics_count')
  const selected = query.has('$select') ? query.get('$select')!.split(',') : fields[dataset]!
  if (!selected.length || selected.some(name => !fields[dataset]!.includes(name))) throw invalid('analyst_field_unavailable')
  const previous = query.has('since') ? await load(db, key, query.get('since')!) : null
  if (query.has('$skiptoken') && !query.has('snapshot')) throw invalid('analytics_cursor')
  const snapshot = query.has('snapshot') ? await load(db, key, query.get('snapshot')!) : await capture(db, key)
  const currentRevision = await dataRevision(db)
  await standing(db, key)
  const rows = await all<Row>(db, 'SELECT * FROM peg_analytics_rows WHERE snapshot_id=? AND dataset=? ORDER BY id', snapshot.id, dataset)
  // An erased record invalidates the cached payload. A delta refresh uses only its opaque identity and hash.
  if (rows.some(row => row.body === null)) throw new PegError(410, 'snapshot_erased_refresh_required')
  const currentTasks = new Set<string>(), currentPlacements = new Set<string>()
  for (const project of JSON.parse(key.projects) as string[]) {
    for (const placed of await projectTaskIds(db, project)) {
      const opened = await openTask(db, keyActor(key), placed.task_id).catch(() => null)
      if (opened?.access.contexts.get(project)?.capabilities.has('export')) {
        currentTasks.add(placed.task_id); currentPlacements.add(placed.task_id + ':' + project)
      }
    }
  }
  if (rows.some(row => row.task_id && (!currentTasks.has(row.task_id) || row.project_id && !currentPlacements.has(row.task_id + ':' + row.project_id))))
    throw new PegError(410, 'snapshot_scope_changed_refresh_required')
  let values = rows.map(row => ({ row, removed: false }))
  if (previous) {
    const before = await all<Row>(db, 'SELECT * FROM peg_analytics_rows WHERE snapshot_id=? AND dataset=? ORDER BY id', previous.id, dataset)
    const old = new Map(before.map(row => [row.id, row])), current = new Set(rows.map(row => row.id))
    values = values.filter(({ row }) => old.get(row.id)?.hash !== row.hash)
    values.push(...before.filter(row => !current.has(row.id)).map(row => ({ row, removed: true })))
    values.sort((a, b) => a.row.id.localeCompare(b.row.id))
  }
  const offsetText = query.get('$skiptoken') ?? '0'
  if (!/^\d+$/.test(offsetText)) throw invalid('analytics_cursor')
  const offset = Number(offsetText)
  if (!Number.isSafeInteger(offset) || offset > values.length) throw invalid('analytics_cursor')
  const preference = request.headers.get('prefer')?.match(/(?:^|[, ])odata.maxpagesize=(\d+)(?:$|[, ])/)
  const pageSize = Math.min(100, Math.max(1, Number(preference?.[1] ?? 100)))
  const page = values.slice(offset, offset + pageSize), context = base + '/$metadata'
  const link = (delta: boolean) => {
    const url = new URL(base + '/' + dataset)
    if (delta) url.searchParams.set('since', snapshot.id)
    else { url.searchParams.set('snapshot', snapshot.id); url.searchParams.set('$skiptoken', String(offset + pageSize)); if (previous) url.searchParams.set('since', previous.id) }
    if (query.has('$select')) url.searchParams.set('$select', query.get('$select')!)
    if (query.has('$count')) url.searchParams.set('$count', query.get('$count')!)
    return url.toString()
  }
  const body = {
    '@odata.context': context + '#' + dataset + (previous ? '/$delta' : ''),
    '@pegboard.snapshot': snapshot.id, '@pegboard.capturedAt': new Date(snapshot.captured_at).toISOString(),
    '@pegboard.sourceRevision': snapshot.source_revision, '@pegboard.stale': snapshot.source_revision !== currentRevision,
    ...(query.get('$count') === 'true' ? { '@odata.count': values.length } : {}),
    value: page.map(({ row, removed }) => removed ? { '@odata.context': context + '#$deletedEntity', id: base + '/' + dataset + "('" + row.id + "')", reason: 'deleted' } :
      Object.fromEntries(['id', ...selected].map(name => [name, JSON.parse(row.body!)[name]]))),
    ...(offset + pageSize < values.length ? { '@odata.nextLink': link(false) } : { '@odata.deltaLink': link(true) }),
  }
  await guard(db, key, currentRevision)
  return body
}
