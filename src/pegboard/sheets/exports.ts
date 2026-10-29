import type { Bindings } from '../../auth.server'
import { all, bound, conflict, first, forbidden, invalid, newId, now, run } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { auditStatement } from '../authorization/audit'
import { openProject } from '../workspace/projects'
import { displayNames, operatorRow, workspaceRole, workspaceSettings, type Actor } from '../workspace/people'
import { rank } from '../authorization/levels'
import { exportRows } from '../tasks/board'
import { openTask, require } from '../tasks/access'
import { fieldReport } from '../fields/report'
import { sheetsEdge, SheetsFailure, type Audience } from '../connectors/sheets/edge'
export const sheetFields: Record<string, string> = { title: 'Title', status: 'Status', priority: 'Priority', due: 'Due date', owner: 'Owner', estimate_hours: 'Estimate hours' }
interface Export { id: string; workspace_id: string; owner_id: string; owner_version: number; spreadsheet_id: string; sheet_id: number; tab_title: string; projects: string; fields: string; active: number; version: number; watermark: string | null; last_review: string | null }
interface Review { id: string; export_id: string; export_version: number; packet: string | null; source_digest: string; destination_digest: string; state: string; expires_at: number }
interface Mapping { task_id: string; row_number: number }
interface Packet { columns: string[]; values: string[][]; mapping: Mapping[]; watermark: string; audience: Audience; destinationName: string; destinationUrl: string; existing: boolean }
const parseList = (value: unknown, name: string, limit: number): string[] => {
 if (!Array.isArray(value) || !value.length || value.length > limit || value.some(v => typeof v !== 'string') || new Set(value).size !== value.length) throw invalid(name)
 return value
}
async function owner(db: D1Database, actor: Actor, workspace: string, allowDisabled = false) {
 if (actor.apiScope || await workspaceRole(db, actor.id, workspace) !== 'owner') throw forbidden('installation_owner')
 if (!allowDisabled && !(await workspaceSettings(db, workspace)).integrationsEnabled) throw forbidden('integrations_disabled')
}
async function ownExport(db: D1Database, actor: Actor, id: string, inactive = false) {
 const row = await first<Export>(db, 'SELECT * FROM peg_sheet_exports WHERE id=? AND owner_id=?', id, actor.id)
 if (!row) throw forbidden('sheets_owner')
 await owner(db, actor, row.workspace_id, inactive)
 const person = await operatorRow(db, actor.id)
 if (person?.version !== row.owner_version || !inactive && !row.active) throw conflict('sheets_grant_revoked')
 return row
}
async function source(db: D1Database, actor: Actor, workspace: string, projects: string[], fields: string[]) {
 await owner(db, actor, workspace)
 const settings = await workspaceSettings(db, workspace), tasks = new Map<string, { projects: string[]; values: Record<string, string> }>(), labels: Record<string, string> = { ...sheetFields }
 for (const id of projects) {
  const { project, effective } = await openProject(db, actor, id)
  if (project.workspace_id !== workspace || !effective.capabilities.has('export') || rank(effective.level) < rank(settings.exportMinLevel)) throw forbidden('export')
  const report = await fieldReport(db, actor, id)
  for (const field of report.fields) labels[id + ':' + field.id] = project.name + ': ' + field.label
  for (const row of await exportRows(db, actor, workspace, id)) {
   const opened = await openTask(db, actor, String(row.id)); require(opened.access, 'export')
   if (!opened.access.contexts.has(id)) continue
   let item = tasks.get(String(row.id))
   if (!item) { item = { projects: [], values: {} }; tasks.set(String(row.id), item) }
   item.projects.push(id)
   const task = opened.task
   const names = fields.includes('owner') ? await displayNames(db, [task.owner_id]) : null
   Object.assign(item.values, { title: task.title, status: task.status, priority: task.priority, due: task.due_date ?? '', owner: names?.get(task.owner_id) ?? 'Former member', estimate_hours: String(task.estimate_hours) })
   const custom = report.rows.find(r => r.id === row.id)
   for (const f of custom?.fields ?? []) {
    if (!fields.includes(id + ':' + f.id)) continue
    if (f.error) throw conflict('sheets_field_value_unavailable')
    item.values[id + ':' + f.id] = f.value === null ? '' : Array.isArray(f.value) ? f.value.join('; ') : String(f.value)
   }
  }
 }
 if (fields.some(f => !(f in labels) || f.includes(':') && !projects.includes(f.split(':')[0]))) throw forbidden('sheets_field_not_readable')
 const rows = [...tasks].sort(([a], [b]) => a.localeCompare(b)).map(([id, item]) => ({ id, projects: item.projects.sort(), values: fields.map(f => item.values[f] ?? '') }))
 return { columns: ['Task ID', 'Project IDs', 'Record state', ...fields.map(f => labels[f])], rows }
}
const mappings = (db: D1Database, id: string) => all<Mapping>(db, 'SELECT task_id,row_number FROM peg_sheet_rows WHERE export_id=? ORDER BY row_number', id)
async function observed(edge: ReturnType<typeof sheetsEdge>, cfg: Export, rows: number, columns: number) {
 const destination = await edge.destination(), tab = destination.tabs.find(t => t.id === cfg.sheet_id)
 if (tab && (!Number.isInteger(tab.rows) || !Number.isInteger(tab.columns) || tab.rows < 1 || tab.columns < 1)) throw conflict('sheets_grid_unavailable')
 if (tab && tab.title !== cfg.tab_title || !tab && destination.tabs.some(t => t.title === cfg.tab_title)) throw conflict('sheets_tab_identity_changed')
 const values = tab ? await edge.read(cfg.tab_title, rows, columns) : null
 return { destination, values, fingerprint: await digest({ id: destination.id, name: destination.name, audience: destination.audience, tab: tab ?? null, values }) }
}
export async function configureSheet(env: Bindings, db: D1Database, actor: Actor, workspace: string, input: Record<string, any>) {
 await owner(db, actor, workspace)
 if (input.consent !== true && input.consent !== 'on') throw invalid('sheets_consent_required')
 const projects = parseList(input.projects, 'sheets_projects', 30).sort(), fields = parseList(input.fields, 'sheets_fields', 30)
 if (typeof input.spreadsheetId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(input.spreadsheetId)) throw invalid('sheets_destination_id')
 const rev = await revision(db)
 await source(db, actor, workspace, projects, fields)
 await sheetsEdge(env, input.spreadsheetId, input.credential).destination()
 await owner(db, actor, workspace)
 const id = newId('sheetexport'), person = (await operatorRow(db, actor.id))!, sheetId = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff
 await guarded(db, rev, [bound(db, 'INSERT INTO peg_sheet_exports(id,workspace_id,owner_id,owner_version,spreadsheet_id,sheet_id,tab_title,projects,fields,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [id, workspace, actor.id, person.version, input.spreadsheetId, sheetId, 'Pegboard ' + id, JSON.stringify(projects), JSON.stringify(fields), now()]), auditStatement(db, { workspaceId: null, actorId: actor.id, action: 'sheets.configured', targetType: 'sheet_export', targetId: id })])
 return { id }
}
export async function reviewSheet(env: Bindings, db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
 const cfg = await ownExport(db, actor, id)
 if (await first(db, "SELECT 1 FROM peg_sheet_reviews WHERE export_id=? AND state='pending'", id)) throw conflict('sheets_reconcile_before_review')
 const rev = await revision(db), current = await source(db, actor, cfg.workspace_id, JSON.parse(cfg.projects), JSON.parse(cfg.fields)), mapping = await mappings(db, id)
 let next = Math.max(2, ...mapping.map(m => m.row_number)) + 1
 for (const row of current.rows) if (!mapping.some(m => m.task_id === row.id)) mapping.push({ task_id: row.id, row_number: next++ })
 const review = newId('sheetreview'), watermark = new Date().toISOString()
 const values = [Array.from({ length: current.columns.length }, (_, i) => ['Pegboard read-only export', id, review, watermark][i] ?? ''), current.columns,
  ...mapping.map(m => { const row = current.rows.find(r => r.id === m.task_id); return row ? [row.id, row.projects.join(', '), 'active', ...row.values] : [m.task_id, '', 'deleted', ...JSON.parse(cfg.fields).map(() => '')] })]
 const edge = sheetsEdge(env, cfg.spreadsheet_id, input.credential), at = await observed(edge, cfg, values.length, current.columns.length)
 const packet: Packet = { columns: current.columns, values, mapping, watermark, audience: at.destination.audience, destinationName: at.destination.name, destinationUrl: at.destination.url, existing: at.values !== null }
 await guarded(db, rev, [bound(db, "INSERT INTO peg_sheet_reviews(id,export_id,export_version,packet,source_digest,destination_digest,state,expires_at,created_at) VALUES(?,?,?,?,?,?,'review',?,?)", [review, id, cfg.version, JSON.stringify(packet), await digest(current), at.fingerprint, now() + 15 * 60000, now()])])
 return { id: review, exportId: id, ...packet }
}
async function reviewed(db: D1Database, actor: Actor, id: string, readback = false) {
 const review = await first<Review>(db, 'SELECT * FROM peg_sheet_reviews WHERE id=?', id)
 if (!review) throw invalid('sheets_review')
 const cfg = await ownExport(db, actor, review.export_id)
 if (cfg.version !== review.export_version || review.state === 'invalidated') throw conflict('sheets_review_changed')
 const current = await source(db, actor, cfg.workspace_id, JSON.parse(cfg.projects), JSON.parse(cfg.fields))
 if (!readback && review.state !== 'confirmed' && (await digest(current) !== review.source_digest || review.state === 'review' && review.expires_at <= now())) throw conflict('sheets_review_changed')
 return { review, cfg, packet: review.packet ? JSON.parse(review.packet) as Packet : null }
}
export async function sheetReview(db: D1Database, actor: Actor, id: string) {
 const { review, cfg, packet } = await reviewed(db, actor, id, true)
 if (review.state === 'pending') return { id, exportId: cfg.id, state: review.state, ...({} as Partial<Packet>) }
 await reviewed(db, actor, id)
 return { id, exportId: cfg.id, state: review.state, ...packet }
}
async function acknowledge(db: D1Database, actor: Actor, cfg: Export, review: Review, packet: Packet) {
 await guarded(db, await revision(db), [bound(db, "UPDATE peg_sheet_reviews SET state='confirmed',packet=NULL WHERE id=? AND state='pending'", [review.id]), bound(db, 'UPDATE peg_sheet_exports SET watermark=? WHERE id=?', [packet.watermark, cfg.id]), auditStatement(db, { workspaceId: null, actorId: actor.id, action: 'sheets.export_confirmed', targetType: 'sheet_export', targetId: cfg.id })])
 return { id: review.id, state: 'confirmed', watermark: packet.watermark }
}
export async function sendSheet(env: Bindings, db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
 const rev = await revision(db), { review, cfg, packet } = await reviewed(db, actor, id)
 if (review.state === 'confirmed') return { id, state: 'confirmed', watermark: cfg.watermark }
 if (!packet || !['review', 'pending'].includes(review.state)) throw conflict('sheets_review_again')
 if (review.state === 'pending') return reconcileSheet(env, db, actor, id, input)
 if (input.confirm !== true && input.confirm !== 'on') throw invalid('sheets_exact_review_required')
 const edge = sheetsEdge(env, cfg.spreadsheet_id, input.credential), at = await observed(edge, cfg, packet.values.length, packet.columns.length)
 if (at.fingerprint !== review.destination_digest) throw conflict('sheets_destination_or_audience_changed')
 // Recheck source and grant after provider reads, before claiming the sole outbound attempt.
 await reviewed(db, actor, id)
 await guarded(db, rev, [bound(db, "UPDATE peg_sheet_reviews SET state='pending' WHERE id=? AND state='review'", [id]), bound(db, 'UPDATE peg_sheet_exports SET last_review=? WHERE id=?', [id, cfg.id]), ...packet.mapping.map(m => bound(db, 'INSERT OR IGNORE INTO peg_sheet_rows VALUES(?,?,?)', [cfg.id, m.task_id, m.row_number])), auditStatement(db, { workspaceId: null, actorId: actor.id, action: 'sheets.send_reviewed', targetType: 'sheet_export', targetId: cfg.id })])
 try {
  await edge.write(cfg.sheet_id, cfg.tab_title, at.destination.tabs.find(t => t.id === cfg.sheet_id) ?? null, packet.values)
  return await reconcileSheet(env, db, actor, id, input)
 } catch (error) {
  if (error instanceof SheetsFailure && error.status === 403) await revokeSheet(db, actor, cfg.id)
  throw error
 }
}
export async function reconcileSheet(env: Bindings, db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
 const { review, cfg, packet } = await reviewed(db, actor, id, true)
 if (review.state === 'confirmed') return { id, state: 'confirmed', watermark: cfg.watermark }
 if (!packet || review.state !== 'pending') throw conflict('sheets_no_uncertain_send')
 const edge = sheetsEdge(env, cfg.spreadsheet_id, input.credential), at = await observed(edge, cfg, packet.values.length, packet.columns.length)
 if (await digest(at.destination.audience) !== await digest(packet.audience) || at.destination.name !== packet.destinationName) throw conflict('sheets_destination_or_audience_changed')
 await reviewed(db, actor, id, true)
 if (at.values && await digest(at.values) === await digest(packet.values)) return acknowledge(db, actor, cfg, review, packet)
 const state = at.fingerprint === review.destination_digest ? 'not_applied' : 'conflict'
 await run(db, 'UPDATE peg_sheet_reviews SET state=?,packet=NULL WHERE id=?', state, id)
 return { id, state, needsNewReview: true }
}
export async function revokeSheet(db: D1Database, actor: Actor, id: string) {
 const cfg = await ownExport(db, actor, id, true)
 await guarded(db, await revision(db), [bound(db, 'UPDATE peg_sheet_exports SET active=0,version=version+1 WHERE id=?', [id]), bound(db, "UPDATE peg_sheet_reviews SET packet=NULL,state='invalidated' WHERE export_id=? AND state<>'confirmed'", [id]), auditStatement(db, { workspaceId: null, actorId: actor.id, action: 'sheets.grant_revoked', targetType: 'sheet_export', targetId: cfg.id })])
 return { id, active: false, externalCopies: 'Previously exported copies remain with Google and their recipients.' }
}
export async function sheetSettings(db: D1Database, actor: Actor, workspace: string) {
 await owner(db, actor, workspace, true)
 await run(db, "UPDATE peg_sheet_reviews SET packet=NULL,state='invalidated' WHERE state='review' AND expires_at<=?", now())
 const projects = [], fields: { value: string; label: string }[] = Object.entries(sheetFields).map(([value, label]) => ({ value, label }))
 for (const p of await all<{ id: string; name: string }>(db, 'SELECT id,name FROM peg_projects WHERE workspace_id=? ORDER BY name,id', workspace)) {
  try { await source(db, actor, workspace, [p.id], ['title']); projects.push(p); const report = await fieldReport(db, actor, p.id); for (const f of report.fields) fields.push({ value: p.id + ':' + f.id, label: p.name + ': ' + f.label }) } catch {}
 }
 const exports = await all<Export>(db, 'SELECT * FROM peg_sheet_exports WHERE workspace_id=? AND owner_id=? ORDER BY created_at,id', workspace, actor.id)
 return { projects, fields, exports: await Promise.all(exports.map(async e => ({ ...e, projects: JSON.parse(e.projects) as string[], fields: JSON.parse(e.fields) as string[], pending: await first<{ id: string; state: string }>(db, "SELECT id,state FROM peg_sheet_reviews WHERE export_id=? AND state='pending'", e.id) }))) }
}
