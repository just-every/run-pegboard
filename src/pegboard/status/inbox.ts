import { all, PegError } from '../db'
import type { Actor } from '../workspace/people'
import { readRevision } from './drafts'
import { revisionComments } from './comments'
import { discussionNotices, discussionPreference } from './discussion'

/** Inbox and digest read the same current authorized revisions, never cached message bodies. */
export async function statusInbox(db: D1Database, actor: Actor) {
  const receipts = await all<{ revision_id: string }>(db,
    `SELECT r.revision_id FROM peg_status_receipts r JOIN peg_status_updates s ON s.id=r.revision_id
     WHERE r.recipient_id=? AND r.channel='in_app' ORDER BY s.published_at DESC,r.revision_id`, actor.id)
  const updates = []
  for (const receipt of receipts) {
    try {
      const revision = await readRevision(db, actor, receipt.revision_id)
      const comments = await revisionComments(db, actor, receipt.revision_id)
      updates.push({ ...revision, ...comments,
        preferences: await discussionPreference(db, actor, receipt.revision_id),
        href: `/app/inbox#status-${receipt.revision_id}` })
    } catch (error) {
      if (!(error instanceof PegError && [403, 404].includes(error.status))) throw error
    }
  }
  const { notices } = await discussionNotices(db, actor)
  return { updates, notices: notices.map(notice => ({ ...notice,
    href: `/app/inbox#status-${notice.revisionId}` })) }
}
