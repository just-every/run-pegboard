import { all, bound, first, newId, now, PegError } from '../db'
import { guarded, revision } from '../decisions/revision'
import { approvalFollowupContext, routeView, type Route } from '../approvals/routing'
import { operatorRow, type Actor } from '../workspace/people'
import { availableStamp, instantOf, readStamp, dayString, type WorkingCalendar } from '../schedule/calendar'
import { approvalPreferences } from './preferences'
import { currentFollowupPolicy, requireFollowupOwner, type FollowupPolicy } from './approval-policy'

interface Episode { id: string; route_id: string; version: string; policy_id: string; workspace_id: string; state: string; cause: string | null; created_at: number; next_at: number | null; round: number }
interface Event { id: string; episode_id: string; ordinal: number; kind: string; state: string; cause: string | null; next_at: number | null; queued_at: number }
interface Delivery { id: string; event_id: string; recipient_id: string; recipient_version: number; state: string; cause: string | null; next_at: number | null; visible_at: number | null }
const actor = (id: string) => ({ id } as Actor)
const list = (text: string): string[] => JSON.parse(text)
const eligibleAt = (at: number, policy: FollowupPolicy) => {
  const calendar: WorkingCalendar = JSON.parse(policy.calendar), next = availableStamp(readStamp(new Date(at).toISOString(), calendar.zone), calendar)
  return Math.max(at, instantOf(dayString(next.day), next.wallMs!, calendar.zone))
}
async function current(db: D1Database, episode: Episode): Promise<{ cause: string | null; policy?: FollowupPolicy; route?: Route; reviewers?: string[] }> {
  const policy = await currentFollowupPolicy(db, episode.workspace_id)
  const route = await first<Route & { followup_invalidated_at: number | null }>(db, 'SELECT * FROM peg_approval_routes WHERE id=?', episode.route_id)
  if (!policy || policy.id !== episode.policy_id || !policy.enabled) return { cause: 'policy_inactive' }
  const owner = await operatorRow(db, policy.approved_by)
  if (!owner || owner.status !== 'active' || owner.role !== 'owner' || owner.version !== policy.approver_version) return { cause: 'policy_authority_lost' }
  if (!route || route.withdrawn_at) return { cause: 'route_withdrawn' }
  if (route.followup_invalidated_at || route.version !== episode.version) return { cause: 'material_changed' }
  const homes = await all<{ project_id: string }>(db, 'SELECT project_id FROM peg_task_projects WHERE task_id=?', route.task_id)
  if (!homes.some(home => list(policy.projects).includes(home.project_id))) return { cause: 'outside_reviewed_scope' }
  try {
    const context = await approvalFollowupContext(db, route)
    return { ...context, policy, route }
  } catch (error) {
    if (error instanceof PegError && [403, 404].includes(error.status)) return { cause: 'routing_authority_lost' }
    throw error
  }
}
async function end(db: D1Database, episode: Episode, cause: string, rev: Awaited<ReturnType<typeof revision>>) {
  await guarded(db, rev, [bound(db, "UPDATE peg_approval_followup_episodes SET state=?,cause=?,next_at=NULL WHERE id=? AND state='active'", [cause === 'person_responded' ? 'responded' : 'cancelled', cause, episode.id])])
}
async function attempt(work: () => Promise<void>) {
  try { await work() } catch (error) { if (!(error instanceof PegError && error.status === 409)) throw error }
}

/** Enqueue only. The unique route episode and ordinal fence survive replay and process restarts. */
export async function scheduleApprovalFollowups(db: D1Database, workspace?: string, at = now()) {
  const routes = await all<Route & { workspace_id: string }>(db, `SELECT r.*,t.workspace_id FROM peg_approval_routes r JOIN peg_tasks t ON t.id=r.task_id
    WHERE r.kind='task' AND r.due_at IS NOT NULL AND r.due_at<=? AND r.withdrawn_at IS NULL AND r.followup_invalidated_at IS NULL AND NOT EXISTS(SELECT 1 FROM peg_approval_followup_episodes p WHERE p.route_id=r.id)
    ${workspace ? 'AND t.workspace_id=?' : ''} ORDER BY r.due_at,r.id LIMIT 200`, at, ...(workspace ? [workspace] : []))
  for (const route of routes) await attempt(async () => {
    const rev = await revision(db), policy = await currentFollowupPolicy(db, route.workspace_id)
    if (!policy?.enabled) return
    const owner = await operatorRow(db, policy.approved_by)
    if (!owner || owner.status !== 'active' || owner.role !== 'owner' || owner.version !== policy.approver_version) return
    const homes = await all<{ project_id: string }>(db, 'SELECT project_id FROM peg_task_projects WHERE task_id=?', route.task_id)
    if (!homes.some(home => list(policy.projects).includes(home.project_id))) return
    await guarded(db, rev, [bound(db, `INSERT OR IGNORE INTO peg_approval_followup_episodes(id,route_id,version,policy_id,workspace_id,state,created_at,next_at,round)
      VALUES(?,?,?,?,?,'active',?,?,0)`, [newId('followup'), route.id, route.version, policy.id, route.workspace_id, at, route.due_at])])
  })
  for (const episode of await all<Episode>(db, `SELECT * FROM peg_approval_followup_episodes WHERE state='active' ${workspace ? 'AND workspace_id=?' : ''} ORDER BY next_at IS NULL,next_at,created_at,id LIMIT 200`, ...(workspace ? [workspace] : []))) await attempt(async () => {
    const rev = await revision(db), context = await current(db, episode)
    if (context.cause) return end(db, episode, context.cause, rev)
    const policy = context.policy!
    if (await first(db, "SELECT 1 FROM peg_approval_followup_events WHERE episode_id=? AND state IN ('queued','deferred')", episode.id)) return
    if (episode.round >= policy.max_rounds || episode.next_at === null || episode.next_at > at) return
    const ordinal = episode.round + 1, event = newId('followupevent'), escalation = ordinal === policy.max_rounds && list(policy.escalation).length > 0
    const allowed = list(escalation ? policy.escalation : policy.recipients)
    const recipients = context.reviewers!.filter(id => allowed.includes(id))
    const statements = [bound(db, `INSERT INTO peg_approval_followup_events VALUES(?,?,?,?,'queued','overdue',?,?)`, [event, episode.id, ordinal, escalation ? 'escalation' : 'reminder', episode.next_at, at]),
      bound(db, 'UPDATE peg_approval_followup_episodes SET round=?,next_at=NULL WHERE id=? AND round=?', [ordinal, episode.id, episode.round])]
    for (const recipient of recipients) {
      const person = (await operatorRow(db, recipient))!
      statements.push(bound(db, `INSERT INTO peg_approval_followup_deliveries VALUES(?,?,?,?,'queued','overdue',?,NULL)`, [newId('followupnotice'), event, recipient, person.version, episode.next_at]))
    }
    await guarded(db, rev, statements)
  })
}

/** Dispatch reselects the current routed reviewers, then commits preferences and authority under one fence. */
export async function dispatchApprovalFollowups(db: D1Database, workspace?: string, at = now()) {
  const pending = await all<Event & { workspace_id: string }>(db, `SELECT e.*,p.workspace_id FROM peg_approval_followup_events e JOIN peg_approval_followup_episodes p ON p.id=e.episode_id
    WHERE p.state='active' AND e.state IN ('queued','deferred') ${workspace ? 'AND p.workspace_id=?' : ''} ORDER BY COALESCE(e.next_at,e.queued_at),e.queued_at,e.id LIMIT 200`, ...(workspace ? [workspace] : []))
  for (const event of pending) await attempt(async () => {
    const rev = await revision(db), episode = (await first<Episode>(db, 'SELECT * FROM peg_approval_followup_episodes WHERE id=?', event.episode_id))!, context = await current(db, episode)
    if (context.cause) return end(db, episode, context.cause, rev)
    const policy = context.policy!, allowed = list(event.kind === 'escalation' ? policy.escalation : policy.recipients)
    const recipients = context.reviewers!.filter(id => allowed.includes(id))
    const old = await all<Delivery>(db, 'SELECT * FROM peg_approval_followup_deliveries WHERE event_id=?', event.id)
    const statements: D1PreparedStatement[] = []
    for (const row of old) if (!recipients.includes(row.recipient_id)) statements.push(bound(db, "UPDATE peg_approval_followup_deliveries SET state='cancelled',cause='reviewer_no_longer_authorized',next_at=NULL WHERE id=? AND state IN ('queued','deferred','visible')", [row.id]))
    let deferred: number | null = null, visible = 0
    for (const recipient of recipients) {
      const person = (await operatorRow(db, recipient))!, previous = old.find(row => row.recipient_id === recipient)
      if (await first(db, 'SELECT 1 FROM peg_approval_followup_exclusions WHERE episode_id=? AND recipient_id=?', episode.id, recipient)) continue
      if (previous && (!['queued', 'deferred'].includes(previous.state) || previous.recipient_version !== person.version)) { if (previous.state === 'visible') visible++; continue }
      const preferences = await approvalPreferences(db, actor(recipient), episode.workspace_id)
      const next = eligibleAt(Math.max(at, context.route!.due_at ?? 0, preferences.dndUntil ?? 0), policy)
      const state = !preferences.enabled || preferences.muted ? 'cancelled' : next > at ? 'deferred' : 'visible'
      const cause = state === 'cancelled' ? 'recipient_muted' : state === 'deferred' ? (preferences.dndUntil ?? 0) > at ? 'do_not_disturb' : 'working_hours' : 'inbox_visible'
      if (state === 'deferred') deferred = Math.min(deferred ?? Infinity, next)
      if (state === 'visible') visible++
      statements.push(bound(db, `INSERT OR IGNORE INTO peg_approval_followup_deliveries VALUES(?,?,?,?,'queued','overdue',?,NULL)`, [newId('followupnotice'), event.id, recipient, person.version, at]),
        bound(db, `UPDATE peg_approval_followup_deliveries SET state=?,cause=?,next_at=?,visible_at=? WHERE event_id=? AND recipient_id=? AND state IN ('queued','deferred')`, [state, cause, state === 'deferred' ? next : null, state === 'visible' ? at : null, event.id, recipient]))
      if (state === 'cancelled') statements.push(bound(db, 'INSERT OR IGNORE INTO peg_approval_followup_exclusions VALUES(?,?,?)', [episode.id, recipient, cause]))
    }
    const state = deferred !== null ? 'deferred' : visible ? 'visible' : 'blocked', cause = state === 'deferred' ? 'recipient_or_working_hours' : visible ? 'inbox_visible' : 'no_authorized_deliverable_reviewer'
    statements.push(bound(db, "UPDATE peg_approval_followup_events SET state=?,cause=?,next_at=? WHERE id=? AND state IN ('queued','deferred')", [state, cause, deferred, event.id]))
    if (deferred === null) statements.push(bound(db, "UPDATE peg_approval_followup_episodes SET state=?,cause=?,next_at=? WHERE id=? AND state='active'", [state === 'blocked' ? 'blocked' : episode.round >= policy.max_rounds ? 'exhausted' : 'active', state === 'blocked' ? cause : episode.round >= policy.max_rounds ? 'repeat_limit' : null, state === 'blocked' || episode.round >= policy.max_rounds ? null : eligibleAt(at + policy.repeat_minutes * 60000, policy), episode.id]))
    await guarded(db, rev, statements)
  })
}
export async function processApprovalFollowups(db: D1Database, workspace?: string, at = now()) {
  await scheduleApprovalFollowups(db, workspace, at)
  await dispatchApprovalFollowups(db, workspace, at)
}
export interface ApprovalNotice { id: string; eventId: string; episodeId: string; routeId: string; version: string; recipientId: string; title: string; href: string; kind: string; state: string; cause: string | null; nextEligibleAt: number | null; visibleAt: number | null }
export async function approvalFollowupInbox(db: D1Database, person: Actor, workspace: string) {
  const rev = await revision(db)
  const preferences = await approvalPreferences(db, person, workspace), notices: ApprovalNotice[] = [], deferred: ApprovalNotice[] = []
  if (!preferences.enabled || preferences.muted) return { notices, deferred, preferences }
  const rows = await all<Delivery & { episode_id: string; kind: string }>(db, `SELECT d.*,e.episode_id,e.kind FROM peg_approval_followup_deliveries d JOIN peg_approval_followup_events e ON e.id=d.event_id JOIN peg_approval_followup_episodes p ON p.id=e.episode_id
    WHERE p.workspace_id=? AND p.state IN ('active','exhausted') AND d.recipient_id=? AND d.state IN ('visible','deferred') ORDER BY e.queued_at DESC,e.id`, workspace, person.id)
  for (const row of rows) {
    const episode = (await first<Episode>(db, 'SELECT * FROM peg_approval_followup_episodes WHERE id=?', row.episode_id))!, context = await current(db, episode)
    if (context.cause || !context.reviewers!.includes(person.id) || !list(context.policy!.recipients).includes(person.id)) continue
    if ((await operatorRow(db, person.id))?.version !== row.recipient_version) continue
    const view = await routeView(db, person, episode.route_id)
    if (!view.canDecide) continue
    const notice = { id: row.id, eventId: row.event_id, episodeId: episode.id, routeId: episode.route_id, version: episode.version, recipientId: person.id, title: view.task!.title, href: '/app/approvals/' + episode.route_id, kind: row.kind, state: row.state, cause: row.cause, nextEligibleAt: row.next_at, visibleAt: row.visible_at }
    if (row.state === 'visible' && (preferences.dndUntil ?? 0) <= now()) notices.push(notice)
    else if (row.state === 'deferred') deferred.push(notice)
  }
  // If authority changed during a read, return no content from the earlier snapshot.
  if ((await revision(db)).value !== rev.value || (rev.until !== null && rev.until <= now())) return { notices: [], deferred: [], preferences }
  return { notices, deferred, preferences }
}
export async function approvalFollowupLog(db: D1Database, person: Actor, workspace: string) {
  await requireFollowupOwner(db, person, workspace)
  const episodes = await all<Episode>(db, 'SELECT * FROM peg_approval_followup_episodes WHERE workspace_id=? ORDER BY created_at DESC,id LIMIT 200', workspace), result = []
  for (const episode of episodes) {
    try { await routeView(db, person, episode.route_id) } catch (error) { if (error instanceof PegError && [403, 404].includes(error.status)) continue; throw error }
    const events = await all<Event>(db, 'SELECT * FROM peg_approval_followup_events WHERE episode_id=? ORDER BY ordinal', episode.id)
    const deliveries = await all<Delivery>(db, 'SELECT d.* FROM peg_approval_followup_deliveries d JOIN peg_approval_followup_events e ON e.id=d.event_id WHERE e.episode_id=? ORDER BY e.ordinal,d.recipient_id', episode.id)
    const outcomes = await all(db, 'SELECT o.* FROM peg_approval_followup_outcomes o JOIN peg_approval_followup_events e ON e.id=o.event_id WHERE e.episode_id=? ORDER BY o.id', episode.id)
    result.push({ ...episode, events, deliveries, outcomes })
  }
  return result
}
export async function runFollowupDoor(db: D1Database, person: Actor, workspace: string, dispatch = false) {
  await requireFollowupOwner(db, person, workspace)
  if (dispatch) await dispatchApprovalFollowups(db, workspace)
  else await scheduleApprovalFollowups(db, workspace)
  return approvalFollowupLog(db, person, workspace)
}
