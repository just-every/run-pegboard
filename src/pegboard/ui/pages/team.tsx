import type { Viewer } from '../../../ui/viewer'
import { Area, Card, Field, Form, Pick, Shell, Submit, levelLabel, levelOptions } from '../shell'

export interface TeamData { id: string; name: string; description: string; privacy: 'public' | 'request' | 'private'; defaultLevel: string; fallbackId: string | null; level: string | null; capabilities: string[]; paths: { via: string; level: string }[]; members: { grantId: string; operatorId: string; name: string; level: string; source: string }[]; approvers: string[] }
const privacyLabel = { public: 'Public to workspace', request: 'Membership by request', private: 'Private' }

export function TeamPage({ viewer, team, people }: { viewer: Viewer; team: TeamData; people: { value: string; label: string }[] }) {
  const can = (capability: string) => team.capabilities.includes(capability), here = `/app/teams/${team.id}`
  return <Shell viewer={viewer} current="/app/teams" title={team.name} chip={levelLabel(team.level).toUpperCase()} facts={[privacyLabel[team.privacy], `New members join as ${levelLabel(team.defaultLevel)}`, `${team.members.length} members`]}
    crumbs={[{ label: 'Teams', href: '/app/teams' }, { label: team.name, href: here, current: true }]}>
    <Card title="About"><p>{team.description || 'No description yet.'}</p>
      <ul className="rows">{team.paths.map((path, i) => <li key={i}><span className="grow">{path.via}</span><span className="tagline">{levelLabel(path.level)}</span></li>)}</ul></Card>
    <Card title="Members"><ul className="rows">{team.members.map(member => <li key={member.grantId}><span className="grow">{member.name}</span><span className="tagline">{levelLabel(member.level)}</span><small>{member.source === 'join' ? 'Joined' : member.source === 'request' ? 'Approved request' : 'Added'}</small>
      {can('manage_shares') && <form method="post" action={`/api/v1/grants/${member.grantId}/revoke`}><input type="hidden" name="_next" value={here} /><button className="button quiet" type="submit">Remove</button></form>}</li>)}</ul>
      {can('manage_shares') && <Form action="/api/v1/grants" next={here} label="Add a member"><input type="hidden" name="objectType" value="team" /><input type="hidden" name="objectId" value={team.id} />
        <div className="inline"><Pick label="Person" name="granteeId" options={people} blank="Choose a person" /><Pick label="Level" name="level" value="viewer" options={levelOptions()} /><Submit>Add to team</Submit></div></Form>}</Card>
    {can('manage_settings') && <Card title="Team settings">
      <Form action={`/api/v1/teams/${team.id}/settings`} next={here} label="Team settings">
        <Field label="Name" name="name" value={team.name} required /><Area label="Description" name="description" value={team.description} />
        <div className="inline"><Pick label="Privacy" name="privacy" value={team.privacy} options={[{ value: 'public', label: 'Public to workspace' }, { value: 'request', label: 'Membership by request' }, { value: 'private', label: 'Private' }]} /><Pick label="Default level on joining" name="defaultLevel" value={team.defaultLevel} options={levelOptions(['viewer', 'commenter', 'editor'])} /></div>
        <Pick label="Responsible fallback" name="fallbackId" value={team.fallbackId} blank="None" options={people} />
        <p className="muted">Changing the team's privacy never changes the sharing of any project.</p>
        <Submit>Save team settings</Submit>
      </Form>
      <Form action={`/api/v1/teams/${team.id}/settings`} next={here} label="Request approvers">
        <p className="muted">Approvers decide requests to join. With none chosen, the team's Admins do.</p>
        <label className="field">Approvers<select className="select" name="approvers[]" multiple size={Math.min(6, Math.max(3, people.length))} defaultValue={team.approvers}>{people.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <Submit quiet>Save approvers</Submit>
      </Form>
    </Card>}
  </Shell>
}
