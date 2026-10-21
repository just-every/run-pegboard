import type { previewRequest } from '../../access-requests/decisions'
import type { Viewer } from '../../../ui/viewer'
import { DecisionCard } from './inbox'
import { Shell } from '../shell'

/** The page an email's button opens: the exact request to review. Opening it grants nothing; only its forms decide. */
export function DecisionPage({ viewer, request }: { viewer: Viewer; request: Awaited<ReturnType<typeof previewRequest>> }) {
  return <Shell viewer={viewer} current="/app/inbox" title="Access request" chip={request.status.toUpperCase()} facts={['Review the exact grant, then approve or deny']}><DecisionCard request={request} next="/app/inbox" /></Shell>
}
