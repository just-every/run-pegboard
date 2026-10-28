import { assertStatusReuse } from './rights'
import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now, PegError, type Param } from '../db'
import { auditStatement, epoch } from '../authorization/audit'
import { openProject, need } from '../workspace/projects'
import { openPortfolio } from '../portfolios/portfolios'
import { operatorRow, workspaceRole, type Actor } from '../workspace/people'
import { openTask } from '../tasks/access'
import { rootOf } from '../authorization/effective'
import { healths } from '../portfolios/portfolios'
import { statusSubscribers } from './subscriptions'

type Content = { health: string; summary: string; highlights: string; risks: string; decisions: string; nextSteps: string; from: string; to: string }
type Source = { id: string; title: string; description: string; status: string; updatedAt: number; internalOnly: number; projectIds: string[]; membership: string }
type Recipient = { id: string; channels: string[] }
interface Draft { id: string; workspace_id: string; subject_type: string; subject_id: string; version: number; content: string; sources: string; recipients: string; corrects_id: string | null; created_by: string; updated_at: number; subscriptions: string | null }
interface Revision { id: string; draft_id: string; draft_version: number; content: string; sources: string; recipients: string; corrects_id: string | null; reviewed_by: string; review_token: string; workspace_id: string; subject_type: string; subject_id: string; published_at: number }
const text = (value: unknown, max = 4000) => { if (typeof value !== 'string' || value.length > max) throw invalid('status_content'); return value.trim() }
const date = (value: unknown) => { const out = text(value, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(out) || !Number.isFinite(Date.parse(out)) || new Date(out).toISOString().slice(0, 10) !== out) throw invalid('status_window'); return out }
export async function statusAccess(db: D1Database, actor: Actor, type: string, id: string, manage = false) {
  if (type === 'project') {
    const { project, effective } = await openProject(db, actor, id)
    if (manage) need(effective, 'manage_settings')
    return { workspace: project.workspace_id, comment: effective.capabilities.has('comment') }
  }
  if (type !== 'portfolio') throw invalid('subject')
  const { portfolio, level } = await openPortfolio(db, actor, id)
  if (manage && level !== 'admin') throw forbidden('manage_portfolio')
  return { workspace: portfolio.workspace_id, comment: level === 'admin' }
}
async function human(db: D1Database, actor: Actor, workspace: string) {
  if (!['owner', 'admin', 'manager', 'member'].includes(await workspaceRole(db, actor.id, workspace) ?? '')) throw forbidden('human_publisher')
}
async function draft(db: D1Database, actor: Actor, id: string) {
  const row = await first<Draft>(db, 'SELECT * FROM peg_status_drafts WHERE id=?', id)
  if (!row) throw notFound()
  await statusAccess(db, actor, row.subject_type, row.subject_id, true)
  await assertStatusReuse(db,'draft',id)
  return row
}
export async function statusSource(db: D1Database, actor: Actor, id: string, workspace: string): Promise<Source> {
  const { task, access } = await openTask(db, actor, id)
  if (task.workspace_id !== workspace) throw invalid('status_source')
  return { id: task.id, title: task.title, description: task.description, status: task.status, updatedAt: task.updated_at, internalOnly: task.internal_only,
    projectIds: [...access.contexts.keys()].sort(), membership: JSON.stringify(await all<{project_id:string}>(db, 'SELECT project_id FROM peg_task_projects WHERE task_id=? ORDER BY project_id', (await rootOf(db,task)).id)) }
}
export async function statusSources(db: D1Database, actor: Actor, type: string, id: string, ids: unknown) {
  const {workspace} = await statusAccess(db,actor,type,id,true)
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some(value=>typeof value !== 'string')) throw invalid('status_sources')
  const sources = await Promise.all([...new Set<string>(ids)].map(sourceId=>statusSource(db,actor,sourceId,workspace)))
  const allowedProjects = type === 'project' ? [id] : (await all<{ project_id: string }>(db, `WITH RECURSIVE family(id) AS (SELECT ? UNION ALL SELECT p.id FROM peg_portfolios p JOIN family f ON p.parent_id=f.id) SELECT DISTINCT project_id FROM peg_portfolio_projects WHERE portfolio_id IN (SELECT id FROM family)`, id)).map(p=>p.project_id)
  if(sources.some(source=>!source.projectIds.some(project=>allowedProjects.includes(project)))) throw invalid('status_source_scope')
  return sources
}
const hash = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(n => n.toString(16).padStart(2, '0')).join('')
const decode = (row: Draft) => ({ id: row.id, version: row.version, subjectType: row.subject_type, subjectId: row.subject_id, content: JSON.parse(row.content) as Content, sources: JSON.parse(row.sources) as Source[], recipients: JSON.parse(row.recipients) as Recipient[], correctsId: row.corrects_id, includeSubscribers: row.subscriptions !== null })

/** Saves only a draft. Changing it invalidates every earlier review, without altering a publication. */
export async function saveDraft(db: D1Database, actor: Actor, input: Record<string, any>, id?: string) {
  const previous = id ? await draft(db, actor, id) : null
  const type = previous?.subject_type ?? input.subjectType, subjectId = previous?.subject_id ?? input.subjectId
  const { workspace } = await statusAccess(db, actor, type, subjectId, true)
  await human(db, actor, workspace)
  if (previous && Number(input.version) !== previous.version) throw conflict('stale_status_draft')
  const content: Content = { health: input.health, summary: text(input.summary), highlights: text(input.highlights ?? ''), risks: text(input.risks ?? ''), decisions: text(input.decisions ?? ''), nextSteps: text(input.nextSteps ?? ''), from: date(input.from), to: date(input.to) }
  if (!healths.includes(content.health as typeof healths[number]) || !content.summary || content.to < content.from) throw invalid('status_content')
  const sources = await statusSources(db,actor,type,subjectId,input.sourceIds)
  if (!Array.isArray(input.recipients) || input.recipients.length > 100) throw invalid('status_recipients')
  const recipients: Recipient[] = []
  for (const recipient of input.recipients) {
    if (!recipient || typeof recipient.id !== 'string' || !Array.isArray(recipient.channels) || !recipient.channels.length || recipient.channels.some((c: unknown) => !['in_app', 'slack', 'teams', 'nook', 'email'].includes(String(c))) || recipients.some(r => r.id === recipient.id)) throw invalid('status_recipients')
    if (!await workspaceRole(db, recipient.id, workspace)) throw invalid('status_recipient')
    recipients.push({ id: recipient.id, channels: [...new Set<string>(recipient.channels)] })
  }
  const subscriptions = input.includeSubscribers === true ? await statusSubscribers(db, actor, type, subjectId) : null
  for (const subscriber of subscriptions ?? []) {
    const existing = recipients.find(recipient => recipient.id === subscriber.id)
    if (existing) existing.channels = [...new Set([...existing.channels, ...subscriber.channels])]
    else recipients.push(subscriber)
  }
  if (recipients.length > 100) throw invalid('status_recipients')
  const correctsId = previous?.corrects_id ?? input.correctsId ?? null
  if (correctsId) {
    const corrected = await first<{ subject_type: string; subject_id: string }>(db, 'SELECT subject_type,subject_id FROM peg_status_updates WHERE id=?', correctsId)
    if (!corrected || corrected.subject_type !== type || corrected.subject_id !== subjectId) throw invalid('status_correction')
  }
  const nextId = previous?.id ?? newId('draft'), version = (previous?.version ?? 0) + 1
  const args: Param[] = [JSON.stringify(content), JSON.stringify(sources), JSON.stringify(recipients), now()]
  if (previous) {
    const result = await bound(db, 'UPDATE peg_status_drafts SET content=?,sources=?,recipients=?,updated_at=?,subscriptions=?,version=version+1 WHERE id=? AND version=?', [...args, subscriptions === null ? null : JSON.stringify(subscriptions), nextId, previous.version]).run()
    if (!result.meta.changes) throw conflict('stale_status_draft')
  } else await batch(db, [bound(db, 'INSERT INTO peg_status_drafts(id,workspace_id,subject_type,subject_id,version,content,sources,recipients,corrects_id,created_by,updated_at,subscriptions) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [nextId, workspace, type, subjectId, version, args[0], args[1], args[2], correctsId, actor.id, args[3], subscriptions === null ? null : JSON.stringify(subscriptions)])])
  return readDraft(db,actor,nextId)
}
export async function readDraft(db: D1Database, actor: Actor, id: string) {
  const row = await draft(db,actor,id)
  const rejection = await first<{rejected_by:string;reason:string;created_at:number}>(db,'SELECT rejected_by,reason,created_at FROM peg_status_draft_rejections WHERE draft_id=? AND version=?',id,row.version)
  const view=decode(row)
  return {...view,sources:await publicSources(db,actor,row.workspace_id,view.sources),rejection,generation:await first<{version:number;model:string;processor:string;assertions:string;usage:string}>(db,'SELECT version,model,processor,assertions,usage FROM peg_status_model_drafts WHERE draft_id=?',id)}
}
export async function rejectDraft(db: D1Database, actor: Actor, id: string, input: Record<string,any>) {
  const seen=await epoch(db), row=await draft(db,actor,id)
  await human(db,actor,row.workspace_id)
  if(Number(input.version)!==row.version)throw conflict('stale_status_draft')
  const reason=text(input.reason,1000)
  if(!reason)throw invalid('rejection_reason')
  if(await first(db,'SELECT 1 FROM peg_status_revisions WHERE draft_id=? AND draft_version=?',id,row.version))throw conflict('status_already_published')
  if(await first(db,'SELECT 1 FROM peg_status_draft_rejections WHERE draft_id=? AND version=?',id,row.version))throw conflict('status_draft_rejected')
  try {
    await batch(db,[
      bound(db,'INSERT INTO peg_status_review_guards(id,valid) VALUES (?,COALESCE((SELECT CASE WHEN version=? AND (SELECT value FROM peg_epoch WHERE id=1)=? AND NOT EXISTS(SELECT 1 FROM peg_status_revisions WHERE draft_id=? AND draft_version=?) THEN 1 ELSE 0 END FROM peg_status_drafts WHERE id=?),0))',[newId('review'),row.version,seen,id,row.version,id]),
      bound(db,'INSERT INTO peg_status_draft_rejections(draft_id,version,rejected_by,reason,created_at) VALUES (?,?,?,?,?)',[id,row.version,actor.id,reason,now()]),
      auditStatement(db,{workspaceId:row.workspace_id,actorId:actor.id,action:'status.draft_rejected',targetType:row.subject_type,targetId:row.subject_id,subjectId:id,detail:{version:row.version}}),
      bound(db,'DELETE FROM peg_status_review_guards',[]),
    ])
  } catch(error) { if(/CHECK constraint|UNIQUE constraint/.test(String(error)))throw conflict('stale_status_draft');throw error }
  return readDraft(db,actor,id)
}
async function recipientActor(db: D1Database, id: string): Promise<Actor> {
  const person = await operatorRow(db, id)
  if (!person || person.status !== 'active') throw notFound()
  return { id, email: person.email, displayName: person.display_name, baseRole: person.role === 'owner' || person.role === 'admin' ? person.role : 'member' }
}
async function readable(db: D1Database, actor: Actor, type: string, id: string, sources: Source[]) {
  const workspace = type === 'portfolio' ? (await first<{workspace_id:string}>(db,'SELECT workspace_id FROM peg_portfolios WHERE id=?',id))?.workspace_id : (await statusAccess(db,actor,type,id)).workspace
  if(!workspace) throw notFound()
  const guest = await workspaceRole(db,actor.id,workspace) === 'guest'
  // A reviewed client version uses existing project shares, never access to portfolio rollups.
  if(!(type === 'portfolio' && guest && sources.length)) await statusAccess(db, actor, type, id)
  for (const s of sources) {
    const current = await statusSource(db, actor, s.id, workspace)
    // Historical source text is never disclosed after a source's visibility becomes narrower.
    if ((current.internalOnly || s.internalOnly) && guest) throw notFound()
  }
}
async function reviewedDraft(db: D1Database, actor: Actor, id: string) {
  const row = await draft(db, actor, id), view = decode(row), seen = await epoch(db)
  await human(db, actor, row.workspace_id)
  if (row.subscriptions !== null && row.subscriptions !== JSON.stringify(await statusSubscribers(db, actor, row.subject_type, row.subject_id))) throw conflict('stale_status_subscriptions')
  if(await first(db,'SELECT 1 FROM peg_status_draft_rejections WHERE draft_id=? AND version=?',id,row.version))throw conflict('status_draft_rejected')
  for (const saved of view.sources) if (JSON.stringify(saved) !== JSON.stringify(await statusSource(db, actor, saved.id, row.workspace_id))) throw conflict('stale_status_source')
  for (const recipient of view.recipients) await readable(db, await recipientActor(db, recipient.id), row.subject_type, row.subject_id, view.sources)
  return { ...view, reviewedBy: actor.id, token: await hash({ row, actor: actor.id, epoch: seen }), epoch: seen }
}
async function publicSources(db:D1Database,actor:Actor,workspace:string,sources:Source[]) {
  const visible=[]
  for(const saved of sources){const {membership:_membership,...fields}=saved;visible.push({...fields,projectIds:(await statusSource(db,actor,saved.id,workspace)).projectIds})}
  return visible
}
export async function reviewDraft(db:D1Database,actor:Actor,id:string) {
  const view=await reviewedDraft(db,actor,id)
  const {workspace}=await statusAccess(db,actor,view.subjectType,view.subjectId,true)
  return {...view,sources:await publicSources(db,actor,workspace,view.sources)}
}
export async function publishDraft(db: D1Database, actor: Actor, id: string, token: unknown) {
  const row = await draft(db, actor, id), review = await reviewedDraft(db, actor, id)
  if (row.version !== review.version || typeof token !== 'string' || token !== review.token) throw conflict('stale_status_review')
  const existing = await first<{ id: string }>(db, 'SELECT id FROM peg_status_revisions WHERE draft_id=? AND draft_version=?', id, row.version)
  if (existing) return { id: existing.id, replay: true }
  const revisionId = newId('status'), at = now(), guard = newId('review')
  const checks = [bound(db, 'INSERT INTO peg_status_review_guards(id,valid) VALUES (?,(SELECT CASE WHEN version=? AND (SELECT value FROM peg_epoch WHERE id=1)=? AND NOT EXISTS(SELECT 1 FROM peg_status_draft_rejections WHERE draft_id=? AND version=?) THEN 1 ELSE 0 END FROM peg_status_drafts WHERE id=?))', [guard, row.version, review.epoch, id, row.version, id])]
  for (const s of review.sources) {
    const root = await rootOf(db, (await openTask(db,actor,s.id)).task)
    checks.push(bound(db, 'INSERT INTO peg_status_review_guards(id,valid) VALUES (?,CASE WHEN (SELECT COALESCE(json_group_array(json_object(?,project_id)),?) FROM (SELECT project_id FROM peg_task_projects WHERE task_id=? ORDER BY project_id))=? THEN 1 ELSE 0 END)', [newId('review'), 'project_id', '[]', root.id, s.membership]))
    checks.push(bound(db, 'INSERT INTO peg_status_review_guards(id,valid) VALUES (?,COALESCE((SELECT CASE WHEN title=? AND description=? AND status=? AND updated_at=? AND internal_only=? THEN 1 ELSE 0 END FROM peg_tasks WHERE id=?),0))', [newId('review'), s.title, s.description, s.status, s.updatedAt, s.internalOnly, s.id]))
  }
  try {
    await batch(db, [...checks,
      bound(db, 'INSERT INTO peg_status_updates(id,workspace_id,subject_type,subject_id,health,summary,author_id,published_at) VALUES (?,?,?,?,?,?,?,?)', [revisionId, row.workspace_id, row.subject_type, row.subject_id, review.content.health, review.content.summary, actor.id, at]),
      bound(db, 'INSERT INTO peg_status_revisions(id,draft_id,draft_version,content,sources,recipients,corrects_id,reviewed_by,review_token) VALUES (?,?,?,?,?,?,?,?,?)', [revisionId, id, row.version, row.content, row.sources, row.recipients, row.corrects_id, actor.id, review.token]),
      ...review.recipients.flatMap(r => r.channels.map(channel => bound(db, 'INSERT INTO peg_status_receipts(revision_id,recipient_id,channel,state,reason,created_at) VALUES (?,?,?,?,?,?)', [revisionId, r.id, channel, channel === 'in_app' ? 'available' : 'blocked', channel === 'in_app' ? null : 'connector_not_implemented', at]))),
      auditStatement(db, { workspaceId: row.workspace_id, actorId: actor.id, action: 'status.reviewed_publication', targetType: row.subject_type, targetId: row.subject_id, subjectId: revisionId, detail: { draftId: id, version: row.version, correctsId: row.corrects_id } }),
      bound(db, 'DELETE FROM peg_status_review_guards', []),
    ])
  } catch (error) {
    const won = await first<{ id: string }>(db, 'SELECT id FROM peg_status_revisions WHERE draft_id=? AND draft_version=?', id, row.version)
    if (won) return { id: won.id, replay: true }
    if (String(error).includes('CHECK constraint')) throw conflict('stale_status_review')
    throw error
  }
  return { id: revisionId, replay: false }
}
export async function openRevision(db: D1Database, actor: Actor, id: string) {
  const row = await first<Revision>(db, 'SELECT r.*,s.workspace_id,s.subject_type,s.subject_id,s.published_at FROM peg_status_revisions r JOIN peg_status_updates s ON s.id=r.id WHERE r.id=?', id)
  if (!row) throw notFound()
  const workspace = row.workspace_id
  const recipients = JSON.parse(row.recipients) as Recipient[]
  let manager = false
  try { await statusAccess(db, actor, row.subject_type, row.subject_id, true); manager = ['owner','admin','manager','member'].includes(await workspaceRole(db,actor.id,workspace) ?? '') } catch (error) { if (!(error instanceof PegError && [403,404].includes(error.status))) throw error }
  if (!manager && !recipients.some(r => r.id === actor.id)) throw notFound()
  await readable(db, actor, row.subject_type, row.subject_id, JSON.parse(row.sources))
  await assertStatusReuse(db,'revision',id)
  return { row, workspace, manager }
}
export async function revisionCanComment(db:D1Database,actor:Actor,id:string) {
  const {row,workspace,manager}=await openRevision(db,actor,id)
  if(row.subject_type === 'project') return (await statusAccess(db,actor,row.subject_type,row.subject_id)).comment
  if(manager) return true
  if(await workspaceRole(db,actor.id,workspace) !== 'guest') return false
  const sources=JSON.parse(row.sources) as Source[]
  for(const source of sources) if(!(await openTask(db,actor,source.id)).access.capabilities.has('comment')) return false
  return sources.length > 0
}
export async function readRevision(db: D1Database, actor: Actor, id: string) {
  const { row, manager, workspace } = await openRevision(db, actor, id)
  const receipts = await all<{ recipient_id: string; channel: string; state: string; reason: string | null }>(db, `SELECT recipient_id,channel,state,reason FROM peg_status_receipts WHERE revision_id=?${manager ? '' : ' AND recipient_id=?'}`, id, ...(manager ? [] : [actor.id]))
  // Re-evaluate authority on every read, including an old receipt after revocation.
  for (const receipt of receipts) try { await readable(db, await recipientActor(db, receipt.recipient_id), row.subject_type, row.subject_id, JSON.parse(row.sources)) } catch (error) { if (!(error instanceof PegError && [403,404].includes(error.status))) throw error; receipt.state = 'revoked'; receipt.reason = 'access_revoked' }
  const sources = []
  for (const saved of JSON.parse(row.sources) as Source[]) { const {membership: _membership, ...visible} = saved; sources.push({ ...visible, projectIds: (await statusSource(db, actor, saved.id, workspace)).projectIds, link: `/app/tasks/${saved.id}` }) }
  return { id: row.id, subjectType: row.subject_type, subjectId: row.subject_id, content: JSON.parse(row.content), sources, correctsId: row.corrects_id, publishedAt: row.published_at, reviewedBy: row.reviewed_by, receipts }
}
export async function statusHistory(db: D1Database, actor: Actor, type: string, id: string) {
  await statusAccess(db, actor, type, id)
  const rows = await all<{ id: string }>(db, 'SELECT r.id FROM peg_status_revisions r JOIN peg_status_updates s ON s.id=r.id WHERE s.subject_type=? AND s.subject_id=? ORDER BY s.published_at,r.id', type, id), revisions = []
  for (const row of rows) try { revisions.push(await readRevision(db, actor, row.id)) } catch (error) { if (!(error instanceof PegError && ([403,404].includes(error.status) || error.code === 'status_rights_custody_review'))) throw error }
  return { revisions }
}
