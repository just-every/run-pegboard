import type { previewRequest } from '../../access-requests/decisions'
import type { myRequests } from '../../access-requests/requests'
import type { Viewer } from '../../../ui/viewer'
import { Card, Form, Pick, Shell, Submit, levelLabel, levelOptions, when } from '../shell'

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

export function InboxPage({ viewer, toDecide, mine }: { viewer: Viewer; toDecide: Preview[]; mine: Mine[] }) {
  return <Shell viewer={viewer} current="/app/inbox" title="Inbox" chip={toDecide.length ? `${toDecide.length} TO DECIDE` : 'CLEAR'} facts={[`${toDecide.length} request${toDecide.length === 1 ? '' : 's'} waiting for you`, `${mine.length} you asked`]}>
    {toDecide.map(request => <DecisionCard key={request.id} request={request} next="/app/inbox" />)}
    {toDecide.length === 0 && <Card title="Nothing waiting"><p className="muted">Access requests that need your decision arrive here, and by email.</p></Card>}
    <Card title="Requests you made">
      <ul className="rows">{mine.map(request => <li key={request.id}><span className="grow">{levelLabel(request.level)} access to <code>{request.targetId}</code><br /><small>Asked {when(request.createdAt)}{request.reason ? ` · ${request.reason}` : ''}</small></span><span className={request.status === 'approved' ? 'tagline on' : 'tagline'}>{state[request.status]}{request.grantedLevel ? `: ${levelLabel(request.grantedLevel)}` : ''}</span></li>)}
        {mine.length === 0 && <li>You have not asked for anything.</li>}</ul>
    </Card>
  </Shell>
}
