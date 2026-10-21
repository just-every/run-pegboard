import type { TeamListing } from '../../workspace/teams'
import type { Viewer } from '../../../ui/viewer'
import { Area, Card, Field, Form, Pick, Shell, Submit, levelLabel, levelOptions } from '../shell'

const privacyLabel = { public: 'Public to workspace', request: 'Membership by request', private: 'Private' }
export function TeamsPage({ viewer, teams, query, canCreate, workspace }: { viewer: Viewer; teams: TeamListing[]; query: string; canCreate: boolean; workspace: string }) {
  return <Shell viewer={viewer} current="/app/teams" title="Teams" chip={`${teams.length} LISTED`} facts={[query ? `Matching “${query}”` : 'Teams you can find or belong to']}>
    <Card title="Find a team">
      <form method="get" action="/app/teams" className="inline" role="search"><label className="field">Search teams<input className="input" name="q" defaultValue={query} /></label><button className="button quiet" type="submit">Search</button></form>
      <ul className="rows">{teams.map(team => <li key={team.id}><span className="grow"><a href={`/app/teams/${team.id}`}>{team.name}</a>{team.description && <><br /><small>{team.description}</small></>}</span><span className="tagline">{privacyLabel[team.privacy]}</span>
        {team.member ? <span className="tagline on">{levelLabel(team.memberLevel)}</span> : team.action === 'join' ? <form method="post" action={`/api/v1/teams/${team.id}/join`}><input type="hidden" name="_next" value={`/app/teams/${team.id}`} /><button className="button primary" type="submit">Join as {levelLabel(team.defaultLevel)}</button></form> : team.action === 'request' ? <a className="button quiet" href={`/app/teams/${team.id}`}>Request to join</a> : null}</li>)}
        {teams.length === 0 && <li>No teams match.</li>}</ul>
    </Card>
    {canCreate && <Card title="Start a team">
      <Form action="/api/v1/teams" next="/app/teams" label="Start a team">
        <input type="hidden" name="workspaceId" value={workspace} />
        <Field label="Team name" name="name" required /><Area label="Description" name="description" />
        <div className="inline"><Pick label="Privacy" name="privacy" value="request" options={[{ value: 'public', label: 'Public to workspace' }, { value: 'request', label: 'Membership by request' }, { value: 'private', label: 'Private' }]} /><Pick label="Default level when someone joins" name="defaultLevel" value="viewer" options={levelOptions(['viewer', 'commenter', 'editor'])} /></div>
        <Submit>Create team</Submit>
      </Form>
    </Card>}
  </Shell>
}
