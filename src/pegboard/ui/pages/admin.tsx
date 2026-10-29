import type { ownershipPreview } from '../../admin/ownership'
import type { lifecyclePreview } from '../../admin/lifecycle'
import type { listPeople } from '../../admin/settings'
import type { WorkspaceSettings } from '../../workspace/people'
import type { Viewer } from '../../../ui/viewer'
import { Card, Check, Field, Form, Pick, Shell, Submit, levelOptions } from '../shell'

type People = Awaited<ReturnType<typeof listPeople>>
export function AdminPage({ viewer, workspace, settings, people, lifecycle, ownership, actorId }: { viewer: Viewer; actorId: string; workspace: string; settings: WorkspaceSettings; people: People; lifecycle?: Awaited<ReturnType<typeof lifecyclePreview>> | null; ownership?: Awaited<ReturnType<typeof ownershipPreview>> | null }) {
  const here = '/app/admin'
  return <Shell viewer={viewer} current="/app/admin" title="Administration" chip={`${people.length} PEOPLE`} facts={['People, sharing and policy for this workspace']}>
    <Card title="Data and audit"><p><a href="/app/settings">Work settings</a></p><p>Review permanent events, retention and irreversible removal.</p><p><a className="button quiet" href="/app/audit">Permanent audit</a> <a className="button quiet" href="/app/recovery">Archive and trash</a> {viewer.role==='owner'&&<a className="button quiet" href="/app/data">Data settings</a>}</p></Card>
    {lifecycle && <Card title={`Review ${lifecycle.status === 'inactive' ? 'deactivation' : 'reactivation'}`}>
      <p><strong>{lifecycle.person.name}</strong> is currently {lifecycle.person.status}. This changes their account across this installation.</p>
      {lifecycle.status === 'inactive' ? <><p>Cancel personal rules, scheduled authority, queued actions, native API credentials and issued proof links. Pending requests become stale and prior decision authority ends. Work and historical decisions remain.</p><ul className="rows">{Object.entries(lifecycle.counts).map(([key, count]) => <li key={key}><span className="grow">{({ sessions:'Sessions', apiKeys:'API and MCP credentials', analystKeys:'Analyst credentials', proofLinks:'Proof links', personalRules:'Personal rules', recurrences:'Recurring schedules', localRules:'Workflow rules', bundles:'Workflow bundles', templateRules:'Template rules', requests:'Pending requests' } as Record<string,string>)[key]}</span><strong>{count}</strong></li>)}</ul></> : <p>Restore sign-in only. Old sessions, credentials, proof links, personal rules and prior pending decision authority stay invalid. Renew each authority explicitly through its original review.</p>}
      <Form action={`/api/v1/workspaces/${workspace}/people/${lifecycle.person.id}/lifecycle`} next={here} label="Confirm account status">
        <input type="hidden" name="status" value={lifecycle.status} /><input type="hidden" name="token" value={lifecycle.token} />
        <Check name="confirm" label="I reviewed the account change and its cancellations" /><Submit>{lifecycle.status === 'inactive' ? 'Deactivate account' : 'Reactivate account'}</Submit><a href={here}>Cancel review</a>
      </Form>
    </Card>}
    {ownership && <Card title="Review installation ownership">
      <p>{ownership.action === 'promote' ? <>Make <strong>{ownership.person.name}</strong> an installation owner. They are already an active installation administrator. You remain an owner until you separately review relinquishing your ownership.</> : <>Relinquish your installation ownership and remain an administrator. At least one other active owner must remain. Your current sessions and credentials lose their prior authority.</>}</p>
      <ul className="rows" aria-label="Current installation owners">{ownership.owners.map(person => <li key={person.id}>{person.name}</li>)}</ul>
      <Form action={`/api/v1/workspaces/${workspace}/people/${ownership.person.id}/ownership`} next={here} label="Confirm installation ownership">
        <input type="hidden" name="action" value={ownership.action} /><input type="hidden" name="token" value={ownership.token} />
        <Check name="confirm" label="I reviewed this installation ownership change" /><Submit>{ownership.action === 'promote' ? 'Make installation owner' : 'Relinquish my ownership'}</Submit><a href={here}>Cancel review</a>
      </Form>
    </Card>}
    <Card title="People">
      <ul className="rows">{people.map(person => <li key={person.id}><span className="grow"><strong>{person.name}</strong><br /><small>{person.email}</small></span><span className="tagline">{person.role}</span>{person.status !== 'invited' && <a className="button quiet" href={`${here}?person=${person.id}&status=${person.status === 'active' ? 'inactive' : 'active'}`}>{person.status === 'active' ? 'Review deactivation' : 'Review reactivation'}</a>}{person.status==='active'&&person.role!=='owner'&&<a className="button quiet" href={`/app/admin/removal/${person.id}`}>Review removal</a>}{viewer.role === 'owner' && person.status === 'active' && person.role === 'admin' && <a className="button quiet" href={`${here}?ownershipPerson=${person.id}&ownershipAction=promote`}>Review ownership handoff</a>}{viewer.role === 'owner' && person.id === actorId && people.filter(row => row.role === 'owner' && row.status === 'active').length > 1 && <a className="button quiet" href={`${here}?ownershipPerson=${person.id}&ownershipAction=relinquish`}>Review relinquishing ownership</a>}{person.status !== 'active' && <span className="tagline warn">{person.status}</span>}
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
