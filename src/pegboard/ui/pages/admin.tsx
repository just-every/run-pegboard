import type { listPeople } from '../../admin/settings'
import type { WorkspaceSettings } from '../../workspace/people'
import type { Viewer } from '../../../ui/viewer'
import { Card, Check, Field, Form, Pick, Shell, Submit, levelOptions } from '../shell'

type People = Awaited<ReturnType<typeof listPeople>>
export function AdminPage({ viewer, workspace, settings, people }: { viewer: Viewer; workspace: string; settings: WorkspaceSettings; people: People }) {
  const here = '/app/admin'
  return <Shell viewer={viewer} current="/app/admin" title="Administration" chip={`${people.length} PEOPLE`} facts={['People, sharing and policy for this workspace']}>
    <Card title="Data and audit"><p>Review permanent events, retention and irreversible removal.</p><p><a className="button quiet" href="/app/audit">Permanent audit</a> <a className="button quiet" href="/app/recovery">Archive and trash</a> {viewer.role==='owner'&&<a className="button quiet" href="/app/data">Data settings</a>}</p></Card>
    <Card title="People">
      <ul className="rows">{people.map(person => <li key={person.id}><span className="grow"><strong>{person.name}</strong><br /><small>{person.email}</small></span><span className="tagline">{person.role}</span>{person.status==='active'&&person.role!=='owner'&&<a className="button quiet" href={`/app/admin/removal/${person.id}`}>Review removal</a>}{person.status !== 'active' && <span className="tagline warn">{person.status}</span>}
        {person.role !== 'owner' && person.role !== 'admin' && <form method="post" action={`/api/v1/workspaces/${workspace}/people/${person.id}/role`}><input type="hidden" name="_next" value={here} /><select className="select" name="role" defaultValue={person.role ?? 'member'} aria-label={`Role for ${person.name}`}>{['manager', 'member', 'analyst', 'guest', 'agent'].map(role => <option key={role} value={role}>{role}</option>)}</select><button className="button quiet" type="submit">Change role</button></form>}</li>)}</ul>
      <Form action={`/api/v1/workspaces/${workspace}/people`} next={here} label="Invite a person">
        <div className="inline"><Field label="Email" name="email" type="email" required /><Field label="Name" name="displayName" /><Pick label="Role" name="role" value="member" options={['manager', 'member', 'analyst', 'guest', 'agent'].map(role => ({ value: role, label: role }))} /><Submit>Invite</Submit></div>
      </Form>
    </Card>
    <Card title="Policy">
      <Form action={`/api/v1/workspaces/${workspace}/settings`} next={here} label="Workspace policy">
        <input type="hidden" name="workspaceSharing_present" value="1" /><input type="hidden" name="guestsAllowed_present" value="1" /><input type="hidden" name="integrationsEnabled_present" value="1" />
        <Pick label="Who may invite people" name="invitePolicy" value={settings.invitePolicy} options={[{ value: 'owner', label: 'Owners only' }, { value: 'admin', label: 'Owners and administrators' }]} />
        <Check label="Projects may be shared with the whole workspace (never with guests)" name="workspaceSharing" checked={settings.workspaceSharing} />
        <Check label="Guests may be invited" name="guestsAllowed" checked={settings.guestsAllowed} />
        <Check label="Integrations and webhooks may be registered" name="integrationsEnabled" checked={settings.integrationsEnabled} />
        <Pick label="Lowest level that may export" name="exportMinLevel" value={settings.exportMinLevel} options={levelOptions()} />
        <div className="inline"><Field label="Access requests expire after (days)" name="requestExpiryDays" type="number" value={settings.requestExpiryDays} /><Field label="Keep decided requests listed (days)" name="requestRetentionDays" type="number" value={settings.requestRetentionDays} /></div>
        <Submit>Save policy</Submit>
      </Form>
    </Card>
  </Shell>
}
