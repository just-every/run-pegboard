import type { TeamListing } from '../../workspace/teams'
import type { Viewer } from '../../../ui/viewer'
import { Card, Shell, Submit } from '../shell'

/** A team that is discoverable but not yet the person's: join it, or ask to. Nothing of its work shows. */
export function TeamGate({ viewer, team }: { viewer: Viewer; team: TeamListing }) {
  const join = team.action === 'join'
  return <Shell viewer={viewer} current="/app/teams" title={team.name} chip={join ? 'PUBLIC' : 'BY REQUEST'} facts={[team.description || 'A team in this workspace']}
    crumbs={[{ label: 'Teams', href: '/app/teams' }, { label: team.name, href: `/app/teams/${team.id}`, current: true }]}>
    <Card title={join ? 'Join this team' : 'Request to join'}>
      {join ? <form method="post" action={`/api/v1/teams/${team.id}/join`} className="stack"><input type="hidden" name="_next" value={`/app/teams/${team.id}`} /><Submit>Join as {team.defaultLevel}</Submit></form>
        : <form method="post" action="/api/v1/access-requests" className="stack"><input type="hidden" name="_next" value={`/app/link/${team.id}?asked=1`} /><input type="hidden" name="targetId" value={team.id} />
          <label className="field">Message (optional)<textarea className="input" name="message" rows={3} /></label><Submit>Request to join</Submit></form>}
    </Card>
  </Shell>
}
