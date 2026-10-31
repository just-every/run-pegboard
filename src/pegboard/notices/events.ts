import { all, bound, first, forbidden, now } from '../db'
import { auditStatement } from '../authorization/audit'
import { guarded, revision } from '../decisions/revision'
import { workspaceRole, operatorRow, type Actor } from '../workspace/people'

/** A policy is approved by the installation owner for member Inbox delivery only. */
export async function internalNoticePolicy(db: D1Database, actor: Actor, workspace: string) {
  if (!await workspaceRole(db, actor.id, workspace)) throw forbidden()
  const row = await first<{ enabled: number; generation: number }>(db, `SELECT p.enabled,p.generation FROM peg_notice_policy p
    JOIN oa_operators o ON o.id=p.owner_id AND o.status='active' AND o.role='owner' AND o.version=p.owner_version
    WHERE p.workspace_id=?`, workspace)
  return { enabled: !!row?.enabled, generation: row?.generation ?? 0, canApprove: (await operatorRow(db, actor.id))?.role === 'owner' }
}
export async function saveInternalNoticePolicy(db: D1Database, actor: Actor, workspace: string, enabled: boolean) {
  const rev = await revision(db), owner = await operatorRow(db, actor.id)
  if (!owner || owner.status !== 'active' || owner.role !== 'owner') throw forbidden('owner')
  await guarded(db, rev, [bound(db, `INSERT INTO peg_notice_policy VALUES(?,?,1,?,?,?)
    ON CONFLICT(workspace_id) DO UPDATE SET enabled=excluded.enabled,generation=CASE WHEN enabled=excluded.enabled AND owner_id=excluded.owner_id AND owner_version=excluded.owner_version THEN generation ELSE generation+1 END,
    owner_id=excluded.owner_id,owner_version=excluded.owner_version,approved_at=excluded.approved_at`,
  [workspace, Number(enabled), actor.id, owner.version, now()]), auditStatement(db, { workspaceId: workspace, actorId: actor.id,
    action: 'notices.policy_reviewed', targetType: 'workspace', targetId: workspace, detail: { enabled, channel: 'native_inbox', audience: 'members' } })])
  return internalNoticePolicy(db, actor, workspace)
}

/** These statements join the task or comment transaction. No text or display-name parsing identifies a recipient. */
export function noticeEventStatements(db: D1Database, actor: Actor, event: { id: string; taskId: string; kind: 'assignment' | 'comment' | 'approval'; commentId?: string; mentionId?: string }) {
  if(actor.apiScope)return []
  return [bound(db, `INSERT INTO peg_notice_events(id,workspace_id,task_id,comment_id,kind,actor_id,policy_generation,created_at)
    SELECT ?,t.workspace_id,t.id,?,?,?,p.generation,? FROM peg_tasks t JOIN peg_notice_policy p ON p.workspace_id=t.workspace_id AND p.enabled=1
    JOIN oa_operators o ON o.id=p.owner_id AND o.status='active' AND o.role='owner' AND o.version=p.owner_version
    JOIN oa_operators human ON human.id=? AND human.status='active'
    WHERE t.id=? AND (human.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM peg_workspace_members m
      WHERE m.workspace_id=t.workspace_id AND m.operator_id=human.id AND m.role NOT IN ('guest','agent')))`,
  [event.id, event.commentId ?? null, event.kind, actor.id, now(), actor.id, event.taskId]),
  bound(db, `INSERT OR IGNORE INTO peg_notice_targets(event_id,recipient_id,recipient_version,reason)
    SELECT e.id,o.id,o.version,CASE WHEN e.kind='approval' THEN 'approval' WHEN e.kind='assignment' THEN 'assignment' WHEN o.id=? THEN 'mention' ELSE 'comment' END
    FROM peg_notice_events e JOIN peg_tasks t ON t.id=e.task_id JOIN oa_operators o ON o.status='active'
    LEFT JOIN peg_notice_preferences p ON p.workspace_id=e.workspace_id AND p.operator_id=o.id
    LEFT JOIN peg_readiness_task_preferences mute ON mute.task_id=t.id AND mute.operator_id=o.id
    WHERE e.id=? AND (o.id<>e.actor_id OR e.kind='approval') AND COALESCE(p.muted,0)=0 AND COALESCE(mute.muted,0)=0
    AND (o.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM peg_workspace_members m WHERE m.workspace_id=e.workspace_id AND m.operator_id=o.id AND m.role NOT IN ('guest','agent')))
    AND ((e.kind='assignment' AND o.id=t.owner_id) OR (e.kind='approval' AND o.role IN ('owner','admin') AND o.id<>t.owner_id)
      OR (e.kind='comment' AND (o.id=? OR o.id=t.owner_id OR EXISTS(SELECT 1 FROM peg_task_collaborators c WHERE c.task_id=t.id AND c.operator_id=o.id)
      OR EXISTS(SELECT 1 FROM peg_notice_follows f WHERE f.task_id=t.id AND f.operator_id=o.id AND f.following=1))))`,
  [event.mentionId ?? null, event.id, event.mentionId ?? null])]
}

export async function pendingNoticeRows(db: D1Database, recipient: string, workspace: string) {
  return all<{ id: string; task_id: string; comment_id: string | null; kind: 'assignment' | 'comment' | 'approval'; reason: string; state: string;
    created_at: number; visible_at: number | null; read_at: number | null; snoozed_until: number | null }>(db,
  `SELECT e.*,r.reason,r.state,r.visible_at,r.read_at,r.snoozed_until FROM peg_notice_events e JOIN peg_notice_targets r ON r.event_id=e.id
    JOIN oa_operators recipient ON recipient.id=r.recipient_id AND recipient.status='active' AND recipient.version=r.recipient_version
    JOIN peg_notice_policy p ON p.workspace_id=e.workspace_id AND p.enabled=1 AND p.generation=e.policy_generation
    JOIN oa_operators o ON o.id=p.owner_id AND o.status='active' AND o.role='owner' AND o.version=p.owner_version
    WHERE r.recipient_id=? AND e.workspace_id=? AND r.state<>'suppressed' ORDER BY e.created_at DESC,e.id`, recipient, workspace)
}
