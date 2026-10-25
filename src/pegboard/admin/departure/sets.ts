import { all } from '../../db'

// Only responsibility moves are listed here; historical authors and completed decisions never move.
export const sets = [
  { key: 'tasks', label: 'Assigned work', table: 'peg_tasks', column: 'owner_id', where: 'owner_id=? AND EXISTS(SELECT 1 FROM peg_task_projects p WHERE p.task_id=peg_tasks.id) AND NOT EXISTS(SELECT 1 FROM peg_approval_tasks a WHERE a.task_id=peg_tasks.id)', title: 'title', mode: 'transfer' },
  { key: 'taskApprovals', label: 'Pending task approvals', table: 'peg_tasks', column: 'owner_id', where: "owner_id=? AND EXISTS(SELECT 1 FROM peg_approval_tasks a WHERE a.task_id=peg_tasks.id) AND EXISTS(SELECT 1 FROM peg_task_projects p WHERE p.task_id=peg_tasks.id)", title: 'title', mode: 'transfer' },
  { key: 'personal', label: 'Private personal work', table: 'peg_tasks', column: 'owner_id', where: 'owner_id=? AND NOT EXISTS(SELECT 1 FROM peg_task_projects p WHERE p.task_id=peg_tasks.id)', title: "'Private personal work'", mode: 'unassign' },
  { key: 'projects', label: 'Projects', table: 'peg_projects', column: 'owner_id', where: 'owner_id=?', title: 'name', mode: 'transfer' },
  { key: 'portfolios', label: 'Portfolios', table: 'peg_portfolios', column: 'owner_id', where: 'owner_id=?', title: 'name', mode: 'transfer' },
  { key: 'goals', label: 'Shared goals', table: 'peg_goals', column: 'owner_id', where: "owner_id=? AND scope<>'personal'", title: 'title', mode: 'transfer' },
  { key: 'personalGoals', label: 'Private personal goals', table: 'peg_goals', column: 'owner_id', where: "owner_id=? AND scope='personal'", title: "'Private personal goal'", mode: 'unassign' },
  { key: 'register', label: 'Delivery responsibilities', table: 'peg_delivery_records', column: 'owner_id', where: 'owner_id=?', title: 'title', mode: 'transfer' },
  { key: 'deliveryApprovals', label: 'Pending delivery approvals', table: 'peg_delivery_records', column: 'approver_id', where: "approver_id=? AND status='pending'", title: 'title', mode: 'transfer' },
  { key: 'scheduleApprovals', label: 'Pending schedule approvals', table: 'peg_schedule_sets', column: 'approver_id', where: "approver_id=? AND status='pending'", title: "'Schedule review'", mode: 'transfer' },
  { key: 'approvers', label: 'Access approval responsibility', table: 'peg_approvers', column: 'operator_id', where: 'operator_id=?', title: "'Access approver'", mode: 'stop' },
  { key: 'recurrences', label: 'Recurring schedules', table: 'peg_recurrences', column: 'created_by', where: 'created_by=? AND active=1', title: "'Recurring work schedule'", mode: 'stop' },
  { key: 'personalRules', label: 'Personal routing rules', table: 'peg_personal_rules', column: 'operator_id', where: 'operator_id=?', title: "'Personal routing rule'", mode: 'stop' },
  { key: 'scheduleProposals', label: 'Unapplied schedule proposals', table: 'peg_schedule_sets', column: 'initiator_id', where: "initiator_id=? AND status='pending'", title: "'Unapplied schedule proposal'", mode: 'stop' },
  { key: 'rules', label: 'Activated workflow rules', table: 'peg_bundle_adoptions', column: 'activated_by', where: 'activated_by=? AND enabled=1', title: "'Activated workflow bundle'", mode: 'stop' },
  { key: 'queued', label: 'Queued workflow actions', table: 'peg_bundle_jobs', column: 'actor_id', where: "actor_id=? AND status='queued'", title: "'Queued workflow action'", mode: 'stop' },
  { key: 'stages', label: 'Ongoing approval stages', table: 'peg_bundle_runs', column: 'owner_id', where: 'owner_id=?', title: "'Approval stage run'", mode: 'transfer' },
  { key: 'proposals', label: 'Unadopted meeting assignments', table: 'peg_meeting_proposals', column: 'owner_id', where: 'owner_id=? AND task_id IS NULL', title: "'Unadopted meeting assignment'", mode: 'unassign' },
  { key: 'tags', label: 'Tag stewardship', table: 'peg_tags', column: 'owner_id', where: 'owner_id=?', title: 'name', mode: 'transfer' },
  { key: 'engineering', label: 'Engineering connector custody', table: 'peg_engineering_links', column: 'created_by', where: 'created_by=? AND revoked_at IS NULL', title: "'Engineering connection'", mode: 'stop' },
  { key: 'meetings', label: 'Meeting source custody', table: 'peg_meetings', column: 'created_by', where: 'created_by=? AND revoked_at IS NULL', title: "'Meeting source'", mode: 'stop' },
  { key: 'webhooks', label: 'Outbound webhook custody', table: 'peg_webhooks', column: 'created_by', where: 'created_by=? AND revoked_at IS NULL', title: "'Webhook'", mode: 'stop' },
  { key: 'agents', label: 'Delegated agent grants', table: 'peg_grants', column: 'created_by', where: "created_by=? AND revoked_at IS NULL AND grantee_id IN(SELECT operator_id FROM peg_workspace_members WHERE role='agent')", title: "'Delegated agent grant'", mode: 'stop' },
] as const
export async function affectedSets(db: D1Database, person: string) {
  return Promise.all(sets.map(async set => ({ key: set.key, label: set.label, mode: set.mode,
    rows: await all<{ id: string; label: string }>(db, `SELECT rowid id,${set.title} label FROM ${set.table} WHERE ${set.where} ORDER BY rowid`, person) })))
}
