import type {internalNotices} from '../../notices/dispatch'
import type {readinessNotices} from '../../notices'
import {ReadinessNotices} from './readiness-notices'
import type { previewRequest } from '../../access-requests/decisions'
import type { myRequests } from '../../access-requests/requests'
import type { Viewer } from '../../../ui/viewer'
import { Card, Check, Field, Form, Pick, Shell, Submit, levelLabel, levelOptions, when } from '../shell'

type Preview = Awaited<ReturnType<typeof previewRequest>>
type Mine = Awaited<ReturnType<typeof myRequests>>[number]
const state: Record<string, string> = { pending: 'Waiting', approved: 'Approved', denied: 'Denied', expired: 'Expired', stale: 'No longer applies' }

/** One request to decide, previewed exactly: who asked, for what, and the grant that approval would make. */
export function DecisionCard({ request, next }: { request: Preview; next: string }) {
  return <Card title={`${request.requester.name ?? 'Someone'} asks for ${levelLabel(request.level)} access`} id={`request-${request.id}`}>
    <ul className="rows">
      <li><span className="grow">Requester</span><span>{request.requester.name}{'email' in request.requester && request.requester.email ? ` (${request.requester.email})` : ''}</span></li>
      <li><span className="grow">Asking for</span><span>{request.targetName ?? `${request.targetType} (administrative request)`}</span></li>
      {request.targetType === 'portfolio' && <li><span className="grow">Scope</span><span>Portfolio membership only; no project access</span></li>}
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

export function InboxPage({ viewer, toDecide, mine,readiness,notifications }: { notifications:Awaited<ReturnType<typeof internalNotices>>|null; viewer: Viewer; toDecide: Preview[]; mine: Mine[];readiness:Awaited<ReturnType<typeof readinessNotices>> }) {
  return <Shell viewer={viewer} current="/app/inbox" title="Inbox" chip={toDecide.length ? `${toDecide.length} TO DECIDE` : notifications?.unread ? `${notifications.unread} UNREAD` : readiness.notices.length ? `${readiness.notices.length} READY` : 'CLEAR'} facts={[`${toDecide.length} request${toDecide.length === 1 ? '' : 's'} waiting for you`, `${mine.length} you asked`]}>
    {notifications&&<MemberNotices view={notifications}/>}
    <ReadinessNotices readiness={readiness}/>
    {toDecide.map(request => <DecisionCard key={request.id} request={request} next="/app/inbox" />)}
    {toDecide.length === 0 && <Card title="Nothing waiting"><p className="muted">Access requests that need your decision arrive here, and by email.</p></Card>}
    <Card title="Requests you made">
      <ul className="rows">{mine.map(request => <li key={request.id}><span className="grow">{levelLabel(request.level)} access to <code>{request.targetId}</code><br /><small>Asked {when(request.createdAt)}{request.reason ? ` · ${request.reason}` : ''}</small></span><span className={request.status === 'approved' ? 'tagline on' : 'tagline'}>{state[request.status]}{request.grantedLevel ? `: ${levelLabel(request.grantedLevel)}` : ''}</span></li>)}
        {mine.length === 0 && <li>You have not asked for anything.</li>}</ul>
    </Card>
  </Shell>
}


type Notices = Awaited<ReturnType<typeof internalNotices>>
export function MemberNotices({view}:{view:Notices}) {
  return <Card title="Work notifications">
    <p><a href="/app/settings/notices">Notification settings</a></p>
    {!view.policy.enabled&&<p>Internal notices are off until the owner approves the member Inbox policy.</p>}
    {view.deferred&&<p role="status">Do not disturb is active. Your work notices wait until {when(view.preferences.dndUntil!)}.</p>}
    <p role="status" aria-label="Unread work notifications">{view.unread} unread work notifications.</p>
    <ul className="rows" aria-label="Work notifications">{view.items.map(item=><li key={item.id} id={`notice-${item.id}`} data-notice={item.id} data-recipient={item.recipientId} data-task={item.taskId} data-comment={item.commentId??undefined}>
      <span className="grow"><a href={item.href}>{item.title}</a><br/><span>{item.explanation} · {item.read?'Read':'Unread'}</span></span>
      <Form action={`/api/v1/notices/${item.id}/state`} next={`/app/inbox#notice-${item.id}`} label={`Mark ${item.title} ${item.read?'unread':'read'}`}><input type="hidden" name="read" value={String(!item.read)}/><Submit quiet>Mark {item.read?'unread':'read'}</Submit></Form>
      <Form action={`/api/v1/notices/${item.id}/state`} next={`/app/inbox#notice-${item.id}`} label={`Snooze ${item.title}`}><input type="hidden" name="snoozedUntil" value={Date.now()+60*60*1000}/><Submit quiet>Snooze one hour</Submit></Form>
    </li>)}</ul>
    {!view.items.length&&<p>No work notifications.</p>}
    {view.snoozed.length>0&&<><h3>Snoozed work</h3><ul className="rows" aria-label="Snoozed work">{view.snoozed.map(item=><li key={item.id} id={`notice-${item.id}`} data-notice={item.id} data-recipient={item.recipientId}>
      <span className="grow"><a href={item.href}>{item.kind==='approval'?'Review approval: ':''}{item.title}</a><br/>Returns {when(item.snoozedUntil!)}</span>
      <Form action={`/api/v1/notices/${item.id}/state`} next={`/app/inbox#notice-${item.id}`} label={`Release ${item.title}`}><input type="hidden" name="snoozedUntil" value=""/><Submit quiet>Return to Inbox</Submit></Form>
    </li>)}</ul></>}
  </Card>
}
export function InternalNoticeSettings({view}:{view:Notices}) {
  return <>
    <Card title="Internal notice policy">
      <p>Assignment, comment, mention and approval notices go only to current members in the native Inbox. Current task and comment access and personal preferences apply. Following grants no access. This policy authorizes no email, push or guest delivery.</p>
      <p role="status">Policy {view.policy.enabled?'approved':'off'}.</p>
      {view.policy.canApprove&&<Form action="/api/v1/notices/policy" next="/app/settings/notices" label="Approve internal notice policy">
        <input type="hidden" name="enabled" value="false"/><Check label="I approve this internal member Inbox policy" name="enabled" checked={view.policy.enabled} value="true"/><Submit quiet>Save notice policy</Submit>
      </Form>}
    </Card>
    <Card title="My work notifications"><Form action="/api/v1/notices/preferences" next="/app/settings/notices" label="Work notification preferences">
      <input type="hidden" name="muted" value="false"/><Check label="Mute work notifications" name="muted" checked={view.preferences.muted} value="true"/>
      <Field label="Do not disturb until (UTC)" name="dndUntil" type="datetime-local" value={view.preferences.dndUntil?new Date(view.preferences.dndUntil).toISOString().slice(0,16):''}/>
      <Submit quiet>Save work preferences</Submit>
    </Form></Card>
  </>
}
