import type {readinessNotices} from '../../notices'
import type {statusInbox} from '../../status/inbox'
import {ReadinessNotices} from './readiness-notices'
import type { previewRequest } from '../../access-requests/decisions'
import type { myRequests } from '../../access-requests/requests'
import type { Viewer } from '../../../ui/viewer'
import { Area, Card, Check, Form, Pick, Shell, Submit, levelLabel, levelOptions, when } from '../shell'

type Preview = Awaited<ReturnType<typeof previewRequest>>
type Mine = Awaited<ReturnType<typeof myRequests>>[number]
const state: Record<string, string> = { pending: 'Waiting', approved: 'Approved', denied: 'Denied', expired: 'Expired', stale: 'No longer applies' }

/** One request to decide, previewed exactly: who asked, for what, and the grant that approval would make. */
export function DecisionCard({ request, next }: { request: Preview; next: string }) {
  return <Card title={`${request.requester.name ?? 'Someone'} asks for ${levelLabel(request.level)} access`} id={`request-${request.id}`}>
    <ul className="rows">
      <li><span className="grow">Requester</span><span>{request.requester.name}{'email' in request.requester && request.requester.email ? ` (${request.requester.email})` : ''}</span></li>
      <li><span className="grow">Asking for</span><span>{request.targetName ?? `${request.targetType} (administrative request)`}</span></li>
      <li><span className="grow">Requested level</span><span className="tagline">{levelLabel(request.level)}</span></li>
      {request.message && <li><span className="grow">Message</span><span>{request.message}</span></li>}
      <li><span className="grow">Expires</span><span>{when(request.expiresAt)}</span></li>
      {request.via === 'fallback' && <li><span className="grow">You are asked as the fallback</span><span className="tagline warn">Minimal details</span></li>}
    </ul>
    {request.status === 'pending' ? <>
      <Form action={`/api/v1/access-requests/${request.id}/decision`} next={next} label="Approve">
        <input type="hidden" name="decision" value="approve" /><input type="hidden" name="revision" value={request.revision} />
        <div className="inline"><Pick label="Grant" name="level" value={request.level} options={levelOptions(request.grantable)} />
          {request.scopes.length > 1 && <Pick label="Scope" name="scope" options={request.scopes.map(scope => ({ value: scope.scope, label: scope.label }))} />}
          <Submit>Approve</Submit></div>
      </Form>
      <Form action={`/api/v1/access-requests/${request.id}/decision`} next={next} label="Deny">
        <input type="hidden" name="decision" value="deny" /><input type="hidden" name="revision" value={request.revision} />
        <div className="inline"><label className="field">Reason (optional, the requester sees it)<input className="input" name="reason" maxLength={280} /></label><Submit quiet>Deny</Submit></div>
      </Form>
    </> : <p className="muted">{state[request.status]}.</p>}
  </Card>
}

export function InboxPage({ viewer, toDecide, mine,readiness,status }: { viewer: Viewer; toDecide: Preview[]; mine: Mine[];readiness:Awaited<ReturnType<typeof readinessNotices>>;status:Awaited<ReturnType<typeof statusInbox>> }) {
  return <Shell viewer={viewer} current="/app/inbox" title="Inbox" chip={toDecide.length ? `${toDecide.length} TO DECIDE` : readiness.notices.length ? `${readiness.notices.length} READY` : status.updates.length ? `${status.updates.length} UPDATES` : 'CLEAR'} facts={[`${toDecide.length} request${toDecide.length === 1 ? '' : 's'} waiting for you`, `${mine.length} you asked`, ...(status.updates.length ? [`${status.updates.length} published updates`] : [])]}>
    <ReadinessNotices readiness={readiness}/>
    {status.notices.length > 0 && <Card title="Status discussion notices"><ul className="rows">{status.notices.map(notice => <li key={notice.commentId}><span className="grow"><a href={notice.href}>{notice.body}</a><br /><small>{notice.kind === 'mention' ? 'Mention' : 'Reply'} · {when(notice.createdAt)}</small></span></li>)}</ul></Card>}
    {status.updates.map(update => <Card key={update.id} id={`status-${update.id}`} title={update.content.summary}>
      <p>{update.subjectType === 'portfolio' ? 'Portfolio' : 'Project'} update · {update.content.health.replaceAll('_', ' ')} · {update.content.from} to {update.content.to}</p>
      <p className="muted">Published {when(update.publishedAt)} · Reviewed by {update.reviewedByName}{update.correctsId ? ' · Correction of an earlier revision' : ''}</p>
      {update.correctsId && status.updates.some(previous => previous.id === update.correctsId) && <p><a href={`#status-${update.correctsId}`}>Earlier published revision</a></p>}
      {(['highlights','risks','decisions','nextSteps'] as const).map(key => update.content[key] && <p key={key}><strong>{({highlights:'Highlights',risks:'Risks',decisions:'Decisions',nextSteps:'Next steps'})[key]}:</strong> {update.content[key]}</p>)}
      <ul className="plain">{update.sources.map(source => <li key={source.id}><a href={source.link}>{source.title}</a></li>)}</ul>
      <ul className="plain">{update.receipts.map(receipt => <li key={receipt.channel}>{({in_app:'In app',slack:'Slack',teams:'Teams',nook:'Nook',email:'Email'} as Record<string,string>)[receipt.channel]} · {receipt.state === 'available' ? 'In Inbox' : receipt.state === 'revoked' ? 'Access revoked' : 'Connection required'}</li>)}</ul>
      <details><summary>Discussion · {update.comments.length} responses</summary>
        <ul className="rows">{update.comments.map(comment => <li key={comment.id} id={comment.id}><span className="grow">{comment.deleted_at ? 'Comment deleted' : comment.body}<br /><small>{comment.authorName} · {when(comment.created_at)}{comment.parent_id ? ' · Reply' : ''}{comment.internal_only ? ' · Internal' : ''}{comment.edited_at ? ' · Edited' : ''}</small>
          {comment.canEdit && <details><summary>Edit your reply</summary><Form action={`/api/v1/status-revisions/${update.id}/comments/${comment.id}`} next={`/app/inbox#status-${update.id}`} label={`Edit reply ${comment.id}`}>
            <input type="hidden" name="version" value={comment.edited_at ?? comment.created_at} /><Area label="Reply text" name="body" value={comment.body} /><div className="inline"><Submit quiet>Save reply edit</Submit><button className="button quiet" type="submit" name="delete" value="true">Delete reply</button></div>
          </Form></details>}
        </span></li>)}</ul>
        {update.canComment && <Form action={`/api/v1/status-revisions/${update.id}/comments`} next={`/app/inbox#status-${update.id}`} label={`Reply to status ${update.id}`}>
          <Area label="Your reply" name="body" /><Pick label="Reply to" name="parentId" blank="This update" options={update.comments.filter(comment => !comment.deleted_at).map(comment => ({value:comment.id,label:comment.body.slice(0,80)}))} />
          {viewer.role !== 'guest' && <Check label="Internal reply" name="internalOnly" />}<Submit>Post reply</Submit>
        </Form>}
        <Form action={`/api/v1/status-revisions/${update.id}/preferences`} next={`/app/inbox#status-${update.id}`} label={`Discussion preferences ${update.id}`}>
          <Check label="Follow discussion" name="following" checked={update.preferences.following} /><Check label="Mute discussion" name="muted" checked={update.preferences.muted} /><Submit quiet>Save discussion preferences</Submit>
        </Form>
      </details>
    </Card>)}
    {toDecide.map(request => <DecisionCard key={request.id} request={request} next="/app/inbox" />)}
    {toDecide.length === 0 && <Card title="Nothing waiting"><p className="muted">Access requests that need your decision arrive here, and by email.</p></Card>}
    <Card title="Requests you made">
      <ul className="rows">{mine.map(request => <li key={request.id}><span className="grow">{levelLabel(request.level)} access to <code>{request.targetId}</code><br /><small>Asked {when(request.createdAt)}{request.reason ? ` · ${request.reason}` : ''}</small></span><span className={request.status === 'approved' ? 'tagline on' : 'tagline'}>{state[request.status]}{request.grantedLevel ? `: ${levelLabel(request.grantedLevel)}` : ''}</span></li>)}
        {mine.length === 0 && <li>You have not asked for anything.</li>}</ul>
    </Card>
  </Shell>
}
