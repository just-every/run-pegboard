import { all, bound, conflict, first, forbidden, invalid, newId, now } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { workspaceRole, operatorRow, type Actor } from '../workspace/people'
import { listProjects } from '../workspace/projects'
import type { WorkingCalendar } from '../schedule/calendar'

export interface FollowupPolicy {
  id: string; workspace_id: string; projects: string; recipients: string; escalation: string; calendar: string
  repeat_minutes: number; max_rounds: number; approved_by: string; approver_version: number; approved_at: number; enabled: number
}
export async function requireFollowupOwner(db: D1Database, actor: Actor, workspace: string) {
  if (await workspaceRole(db, actor.id, workspace) !== 'owner') throw forbidden('owner_review')
}
export const currentFollowupPolicy = (db: D1Database, workspace: string) => first<FollowupPolicy>(db,
  'SELECT p.* FROM peg_approval_followup_policies p JOIN peg_approval_followup_settings s ON s.policy_id=p.id WHERE s.workspace_id=?', workspace)
const ids = (value: unknown) => {
  if (!Array.isArray(value) || value.length > 50 || value.some(id => typeof id !== 'string')) throw invalid('named_followup_scope')
  return [...new Set(value as string[])].sort()
}
export async function previewFollowupPolicy(db: D1Database, actor: Actor, workspace: string, input: Record<string, any>) {
  await requireFollowupOwner(db, actor, workspace)
  const rev = await revision(db), owner = (await operatorRow(db, actor.id))!
  const projects = ids(input.projects ?? []), recipients = ids(input.recipients ?? []), escalation = ids(input.escalation ?? [])
  const enabled = input.enabled === true || input.enabled === 'true'
  const repeatMinutes = Number(input.repeatMinutes), maxRounds = Number(input.maxRounds)
  if (!projects.length || !recipients.length || !Number.isInteger(repeatMinutes) || repeatMinutes < 1 || repeatMinutes > 10080 || !Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 5) throw invalid('bounded_followup_policy')
  for (const id of projects) if (!await first(db, 'SELECT 1 FROM peg_projects WHERE id=? AND workspace_id=?', id, workspace)) throw invalid('followup_project')
  for (const id of recipients) if (!['owner', 'admin', 'manager', 'member'].includes(await workspaceRole(db, id, workspace) ?? '')) throw invalid('internal_followup_recipient')
  if (escalation.some(id => !recipients.includes(id))) throw invalid('named_escalation_recipient')
  const zone = String(input.zone ?? '')
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format() } catch { throw invalid('followup_timezone') }
  const clock = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d\d:\d\d$/.test(value)) throw invalid('followup_hours')
    const [h, m] = value.split(':').map(Number)
    if (h > 23 || m > 59) throw invalid('followup_hours')
    return h * 60 + m
  }
  const start = clock(input.start), end = clock(input.end), days = ids(input.days ?? [])
  if (start >= end || !days.length || days.some(day => !/^[0-6]$/.test(day))) throw invalid('followup_hours')
  const calendar: WorkingCalendar = { zone, week: Array.from({ length: 7 }, (_, n) => days.includes(String(n)) ? { start, end } : null), timeOff: [] }
  const config = { enabled, projects, recipients, escalation, repeatMinutes, maxRounds, calendar }
  return { ...config, rev, token: await digest([actor.id, owner.version, workspace, config, rev]) }
}
export async function approveFollowupPolicy(db: D1Database, actor: Actor, workspace: string, input: Record<string, any>) {
  if (![true, 'true', 'on'].includes(input.consent)) throw invalid('explicit_followup_consent')
  const p = await previewFollowupPolicy(db, actor, workspace, input)
  if (p.token !== input.token) throw conflict('followup_review_changed')
  const owner = (await operatorRow(db, actor.id))!, id = newId('followuppolicy')
  await guarded(db, p.rev, [bound(db, 'INSERT INTO peg_approval_followup_policies VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, workspace, JSON.stringify(p.projects), JSON.stringify(p.recipients), JSON.stringify(p.escalation), JSON.stringify(p.calendar), p.repeatMinutes, p.maxRounds, actor.id, owner.version, now(), Number(p.enabled), 'first_decision']),
    bound(db, 'INSERT INTO peg_approval_followup_settings VALUES(?,?) ON CONFLICT(workspace_id) DO UPDATE SET policy_id=excluded.policy_id', [workspace, id])])
  return { id }
}
export async function followupSettings(db: D1Database, actor: Actor, workspace: string) {
  await requireFollowupOwner(db, actor, workspace)
  const people = await all<{ id: string; name: string }>(db, `SELECT o.id,o.display_name name FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=?
    WHERE o.status='active' AND (o.role IN ('owner','admin') OR m.role IN ('manager','member')) ORDER BY o.display_name,o.id`, workspace)
  return { policy: await currentFollowupPolicy(db, workspace), projects: await listProjects(db, actor, workspace), people }
}
