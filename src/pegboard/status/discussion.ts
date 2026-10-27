import { all, batch, bound, forbidden, invalid, PegError } from '../db'
import { openRevision } from './drafts'
import { revisionComments } from './comments'
import { operatorRow, workspaceRole, type Actor } from '../workspace/people'
interface Preference { following: number; muted: number }
export async function discussionPreference(db: D1Database, actor: Actor, id: string, input?: Record<string, any>) {
  await openRevision(db, actor, id)
  if (input) {
    if (typeof input.following !== 'boolean' || typeof input.muted !== 'boolean') throw invalid('discussion_preferences')
    await batch(db, [bound(db, 'INSERT INTO peg_status_discussion_preferences(revision_id,operator_id,following,muted) VALUES (?,?,?,?) ON CONFLICT(revision_id,operator_id) DO UPDATE SET following=excluded.following,muted=excluded.muted', [id, actor.id, input.following ? 1 : 0, input.muted ? 1 : 0])])
  }
  const row = await db.prepare('SELECT following,muted FROM peg_status_discussion_preferences WHERE revision_id=? AND operator_id=?').bind(id,actor.id).first<Preference>()
  return { following: row ? row.following === 1 : true, muted: row ? row.muted === 1 : false }
}
/** Select ordinary notices only inside the already reviewed recipient set; a mention never adds an audience. */
export async function discussionRecipients(db: D1Database, actor: Actor, revisionId: string, internal: boolean, mentions: unknown) {
  const { row, workspace } = await openRevision(db,actor,revisionId)
  if (mentions !== undefined && (!Array.isArray(mentions) || mentions.length > 20 || mentions.some(id=>typeof id !== 'string'))) throw invalid('status_mentions')
  const named = new Set<string>(Array.isArray(mentions) ? mentions : [])
  const recipients = JSON.parse(row.recipients) as {id:string;channels:string[]}[], notices = []
  if ([...named].some(id=>!recipients.some(r=>r.id===id))) throw forbidden('reviewed_recipient_required')
  for (const recipient of recipients) {
    if (recipient.id === actor.id || !recipient.channels.includes('in_app')) continue
    const person = await operatorRow(db,recipient.id)
    if (!person || person.status !== 'active') continue
    const target: Actor = { id:person.id,email:person.email,displayName:person.display_name,baseRole:person.role==='owner'||person.role==='admin'?person.role:'member' }
    if (internal && await workspaceRole(db,target.id,workspace)==='guest') continue
    try {
      const pref = await discussionPreference(db,target,revisionId)
      if (!pref.muted && (named.has(target.id) || pref.following)) notices.push({ id:target.id,kind:named.has(target.id)?'mention':'comment' })
    } catch(error) { if (!(error instanceof PegError && [403,404].includes(error.status))) throw error }
  }
  return notices
}
export async function discussionNotices(db: D1Database, actor: Actor) {
  const rows = await all<{comment_id:string;revision_id:string;kind:string;created_at:number}>(db, 'SELECT n.comment_id,c.revision_id,n.kind,n.created_at FROM peg_status_discussion_notices n JOIN peg_status_comments c ON c.id=n.comment_id WHERE n.recipient_id=? AND c.deleted_at IS NULL ORDER BY n.created_at DESC,n.comment_id',actor.id), notices = []
  for (const row of rows) try {
    const preferences = await discussionPreference(db,actor,row.revision_id)
    if (preferences.muted || !preferences.following && row.kind!=='mention') continue
    const comment = (await revisionComments(db,actor,row.revision_id)).comments.find(c=>c.id===row.comment_id)
    if (comment) notices.push({revisionId:row.revision_id,commentId:row.comment_id,kind:row.kind,body:comment.body,authorId:comment.author_id,createdAt:row.created_at,href:comment.link})
  } catch(error) { if (!(error instanceof PegError && [403,404].includes(error.status))) throw error }
  return { notices }
}
