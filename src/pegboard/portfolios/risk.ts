// The delivery-risk policy and its evaluation: pure, so every door and every portfolio level reads the same answer.
import { invalid } from '../db'
import { readStamp } from '../schedule/calendar'

export interface Policy { milestonePastDue: boolean; negativeSlack: boolean; /** Percent of incomplete due-dated tasks that are overdue at which a project is at risk. */ overdueShare: number; staleDays: number }
export const defaultPolicy: Policy = { milestonePastDue: true, negativeSlack: true, overdueShare: 20, staleDays: 7 }
export function policyInput(input: Record<string, any>, base: Policy = defaultPolicy): Policy {
  const flag = (value: unknown, old: boolean) => value === undefined ? old : value === true || value === 'true' || value === 'on' || value === '1' ? true : value === false || value === 'false' || value === '0' || value === '' ? false : (() => { throw invalid('policy') })()
  const number = (value: unknown, old: number, min: number, max: number) => { if (value === undefined || value === '') return old; const n = Number(value); if (!Number.isFinite(n) || n < min || n > max) throw invalid('policy'); return n }
  return { milestonePastDue: flag(input.milestonePastDue, base.milestonePastDue), negativeSlack: flag(input.negativeSlack, base.negativeSlack), overdueShare: number(input.overdueShare, base.overdueShare, 1, 100), staleDays: number(input.staleDays, base.staleDays, 1, 365) }
}

export interface Source { kind: 'task' | 'status'; id: string; title: string; detail: string }
export interface Flag { code: 'milestone_past_due' | 'negative_slack' | 'overdue_share' | 'status_stale'; reason: string; sources: Source[]; evaluatedAt: number; policyVersion: number }
export interface Evidence {
  milestones: { id: string; title: string; due: string | null; done: boolean; overdue: boolean }[]
  /** Incomplete critical-path tasks with negative slack. */
  late: { id: string; title: string; slack: number }[]
  eligible: { id: string; title: string; overdue: boolean; due: string }[]
  status: { id: string; publishedAt: number; author: string } | null
}
/** A due value is overdue once its instant, or for a bare day the end of that day in the workspace zone, has passed. */
export function isOverdue(due: string, at: number): boolean {
  if (due.length !== 10) return Date.parse(due) < at
  return readStamp(due).day < readStamp(new Date(at).toISOString().replace('.000Z', 'Z')).day
}
const days = 86400000
export function evaluate(evidence: Evidence, policy: Policy, version: number, at: number): { flags: Flag[]; ratio: number | null; unknown: boolean } {
  const flags: Flag[] = [], flag = (code: Flag['code'], reason: string, sources: Source[]) => flags.push({ code, reason, sources, evaluatedAt: at, policyVersion: version })
  const past = evidence.milestones.filter(m => !m.done && m.overdue)
  if (policy.milestonePastDue && past.length) flag('milestone_past_due', `${past.length} incomplete milestone${past.length === 1 ? ' is' : 's are'} past due`, past.map(m => ({ kind: 'task', id: m.id, title: m.title, detail: `Due ${m.due}` })))
  if (policy.negativeSlack && evidence.late.length) flag('negative_slack', `${evidence.late.length} critical-path task${evidence.late.length === 1 ? ' has' : 's have'} negative slack`, evidence.late.map(t => ({ kind: 'task', id: t.id, title: t.title, detail: `Slack ${t.slack} working days` })))
  const ratio = evidence.eligible.length ? evidence.eligible.filter(t => t.overdue).length / evidence.eligible.length : null
  const overdue = evidence.eligible.filter(t => t.overdue)
  // At least the policy's share: compared in whole numbers so exactly 20% of five tasks is never lost to rounding.
  if (evidence.eligible.length && overdue.length * 100 >= policy.overdueShare * evidence.eligible.length) flag('overdue_share', `${overdue.length} of ${evidence.eligible.length} incomplete due-dated tasks are overdue (${Math.round(overdue.length * 1000 / evidence.eligible.length) / 10}%, threshold ${policy.overdueShare}%)`, overdue.map(t => ({ kind: 'task', id: t.id, title: t.title, detail: `Due ${t.due}` })))
  if (evidence.status && at - evidence.status.publishedAt > policy.staleDays * days) flag('status_stale', `The last published status is more than ${policy.staleDays} days old`, [{ kind: 'status', id: evidence.status.id, title: 'Last published status', detail: `Published ${new Date(evidence.status.publishedAt).toISOString()} by ${evidence.status.author}` }])
  return { flags, ratio, unknown: !evidence.status }
}
