import { discussionRecipients } from './discussion'
import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { auditStatement } from '../authorization/audit'
import { workspaceRole, type Actor } from '../workspace/people'
import { openRevision, statusAccess } from './drafts'
interface Comment { id: string; revision_id: string; parent_id: string | null; author_id: string; body: string; internal_only: number; created_at: number; edited_at: number | null; deleted_at: number | null }
export async function revisionComments(db: D1Database, actor: Actor, id: string) {
  const { workspace } = await openRevision(db, actor, id), guest = await workspaceRole(db, actor.id, workspace) === 'guest'
  const comments = await all<Comment>(db, `SELECT * FROM peg_status_comments WHERE revision_id=?${guest ? ' AND internal_only=0' : ''} ORDER BY created_at,id`, id)
  return { comments: comments.map(c => ({ ...c, body: c.deleted_at ? '' : c.body, link: `/api/v1/status-revisions/${id}/comments#${c.id}` })) }
}
export async function addRevisionComment(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  const { row, workspace } = await openRevision(db, actor, id)
  const access = await statusAccess(db, actor, row.subject_type, row.subject_id)
  if (!access.comment) throw forbidden('comment')
  const guest = await workspaceRole(db, actor.id, workspace) === 'guest', internal = input.internalOnly === true
  if (guest && internal) throw forbidden('internal_comment')
  if (typeof input.body !== 'string' || !input.body.trim() || input.body.length > 4000) throw invalid('comment_body')
  let parent: Comment | null = null
  if (input.parentId) {
    parent = await first<Comment>(db, 'SELECT * FROM peg_status_comments WHERE id=? AND revision_id=?', input.parentId, id)
    if (!parent || parent.deleted_at || (guest && parent.internal_only)) throw notFound()
  }
  const hidden = internal || !!parent?.internal_only
  const recipients = await discussionRecipients(db,actor,id,hidden,input.mentions)
  const commentId = newId('comment'), at = now()
  await batch(db, [bound(db, 'INSERT INTO peg_status_comments(id,revision_id,parent_id,author_id,body,internal_only,created_at) VALUES (?,?,?,?,?,?,?)', [commentId, id, parent?.id ?? null, actor.id, input.body.trim(), internal || parent?.internal_only ? 1 : 0, at]), ...recipients.map(recipient=>bound(db,'INSERT INTO peg_status_discussion_notices(comment_id,recipient_id,kind,created_at) VALUES (?,?,?,?)',[commentId,recipient.id,recipient.kind,at])), auditStatement(db, { workspaceId: workspace, actorId: actor.id, action: 'status.comment_added', targetType: 'status_revision', targetId: id, subjectId: commentId })])
  return { id: commentId, revisionId: id }
}
export async function changeRevisionComment(db: D1Database, actor: Actor, id: string, commentId: string, input: Record<string, any>) {
  const { workspace, row } = await openRevision(db, actor, id)
  if (!(await statusAccess(db, actor, row.subject_type, row.subject_id)).comment) throw forbidden('comment')
  const comment = await first<Comment>(db, 'SELECT * FROM peg_status_comments WHERE id=? AND revision_id=?', commentId, id)
  if (!comment || (comment.internal_only && await workspaceRole(db, actor.id, workspace) === 'guest')) throw notFound()
  if (comment.author_id !== actor.id) throw forbidden('comment_author')
  if (comment.deleted_at || Number(input.version) !== (comment.edited_at ?? comment.created_at)) throw conflict('stale_comment')
  if (input.delete !== true && (typeof input.body !== 'string' || !input.body.trim() || input.body.length > 4000)) throw invalid('comment_body')
  const at = Math.max(now(), (comment.edited_at ?? comment.created_at) + 1)
  const result = await bound(db, 'UPDATE peg_status_comments SET body=?,edited_at=?,deleted_at=? WHERE id=? AND COALESCE(edited_at,created_at)=? AND deleted_at IS NULL', [input.delete === true ? '' : input.body.trim(), at, input.delete === true ? at : null, commentId, Number(input.version)]).run()
  if (!result.meta.changes) throw conflict('stale_comment')
  await batch(db, [auditStatement(db, { workspaceId: workspace, actorId: actor.id, action: input.delete === true ? 'status.comment_deleted' : 'status.comment_edited', targetType: 'status_revision', targetId: id, subjectId: commentId })])
  return { id: commentId, version: at }
}
