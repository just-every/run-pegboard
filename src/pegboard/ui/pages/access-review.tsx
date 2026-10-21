import type { accessReview } from '../../admin/review'
import type { Viewer } from '../../../ui/viewer'
import { Card, Shell, levelLabel, when } from '../shell'

type Review = Awaited<ReturnType<typeof accessReview>>
const describe = (action: string, detail: Record<string, any>) => {
  if (action === 'request.approved') return `approved ${levelLabel(detail.grantedLevel)} (asked ${levelLabel(detail.requestedLevel)})`
  if (action === 'request.denied') return `denied ${levelLabel(detail.requestedLevel)}${detail.reason ? `: ${detail.reason}` : ''}`
  if (action === 'request.created') return `asked for ${levelLabel(detail.requestedLevel)}`
  if (action === 'grant.created') return `granted ${levelLabel(detail.level)} (${detail.source})`
  if (action === 'grant.revoked') return `revoked ${levelLabel(detail.level)}`
  if (action === 'request.delivered') return `told by ${detail.route === 'fallback' ? 'fallback' : 'request'}: inbox${detail.email && detail.email !== 'unavailable' ? ' and email' : ''}`
  return action.replace('.', ' ')
}

export function AccessReviewPage({ viewer, review }: { viewer: Viewer; review: Review }) {
  return <Shell viewer={viewer} current="/app/access-review" title="Access review" chip={`${review.grants.length} GRANTS`} facts={[`${review.grants.length} current grants`, `${review.requests.filter(r => r.status === 'pending').length} requests waiting`, 'Personal tasks are never listed']}>
    <Card title="Current grants">
      <ul className="rows" aria-label="Current grants">{review.grants.map(grant => <li key={grant.id} data-grant={grant.id}><span className="grow"><strong>{grant.grantee}</strong> on {grant.objectType} {grant.object}<br /><small>{grant.source === 'request' ? 'Approved request' : grant.source === 'join' ? 'Joined' : 'Granted'} by {grant.by} · {when(grant.at)}</small></span><span className="tagline">{levelLabel(grant.level)}</span>{grant.scope !== 'full' && <span className="tagline">{grant.scope === 'approve' ? 'Approve only' : 'Assigned tasks'}</span>}
        <form method="post" action={`/api/v1/grants/${grant.id}/revoke`}><input type="hidden" name="_next" value="/app/access-review" /><button className="button quiet" type="submit">Revoke</button></form></li>)}
        {review.grants.length === 0 && <li>No grants yet.</li>}</ul>
    </Card>
    <Card title="Access requests">
      <ul className="rows" aria-label="Access requests">{review.requests.map(request => <li key={request.id}><span className="grow">{request.requester} asked for {levelLabel(request.level)} on {request.target_type}<br /><small>{when(request.created_at)}</small></span><span className={request.status === 'approved' ? 'tagline on' : 'tagline'}>{request.status}{request.granted_level ? `: ${levelLabel(request.granted_level)}` : ''}</span></li>)}
        {review.requests.length === 0 && <li>No requests.</li>}</ul>
    </Card>
    <Card title="Audit">
      <ol className="rows history" aria-label="Audit">{review.audit.map(row => <li key={row.id}><span className="grow"><strong>{row.actor}</strong> {describe(row.action, row.detail)}{row.subject ? <> for <strong>{row.subject}</strong></> : null}{row.target ? <> on {row.targetType} {row.target}</> : null}<br /><small>{when(row.at)}</small></span></li>)}</ol>
    </Card>
  </Shell>
}
