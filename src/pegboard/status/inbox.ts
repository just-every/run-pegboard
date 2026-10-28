import { all, PegError } from '../db'
import { displayNames, operatorRow, workspaceRole, type Actor } from '../workspace/people'
import { readRevision, openRevision, revisionCanComment } from './drafts'
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
      const canComment = await revisionCanComment(db,actor,revision.id)
      const opened=await openRevision(db,actor,revision.id), guest=await workspaceRole(db,actor.id,opened.workspace)==='guest'
      const mentionIds:string[]=[]
      for(const recipient of JSON.parse(opened.row.recipients) as {id:string}[]) {
        if(recipient.id === actor.id || guest && !comments.comments.some(comment=>comment.author_id===recipient.id && !comment.internal_only)) continue
        const person=await operatorRow(db,recipient.id)
        if(!person || person.status!=='active')continue
        try {await openRevision(db,{id:person.id,email:person.email,displayName:person.display_name,baseRole:person.role==='owner'||person.role==='admin'?person.role:'member'},revision.id);mentionIds.push(person.id)} catch(error) {if(!(error instanceof PegError && ([403,404].includes(error.status)||error.code==='status_rights_custody_review')))throw error}
      }
      const names = await displayNames(db, [revision.reviewedBy, ...comments.comments.map(comment => comment.author_id)])
      const mentionNames=await displayNames(db,mentionIds)
      updates.push({ ...revision, reviewedByName: names.get(revision.reviewedBy) ?? 'Former member', canComment,mentions:mentionIds.map(id=>({id,name:mentionNames.get(id)??'Former member'})),
        comments: comments.comments.map(comment => ({ ...comment,
          authorName: names.get(comment.author_id) ?? 'Former member',
          canEdit: canComment && comment.author_id === actor.id && !comment.deleted_at })),
        receipts: revision.receipts.filter(delivery => delivery.recipient_id === actor.id),
        preferences: await discussionPreference(db, actor, receipt.revision_id),
        href: `/app/inbox#status-${receipt.revision_id}` })
    } catch (error) {
      if (!(error instanceof PegError && ([403, 404].includes(error.status) || error.code === 'status_rights_custody_review'))) throw error
    }
  }
  const { notices } = await discussionNotices(db, actor)
  return { updates, notices: notices.map(notice => ({ ...notice,
    href: `/app/inbox#status-${notice.revisionId}` })) }
}
