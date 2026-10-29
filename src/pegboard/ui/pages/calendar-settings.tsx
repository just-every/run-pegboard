import type { Viewer } from '../../../ui/viewer'
import type { calendarSettings } from '../../calendars/connections'
import { Card, Check, Field, Form, Pick, Shell, Submit } from '../shell'
export function CalendarSettingsPage({ viewer, view }: { viewer: Viewer; view: Awaited<ReturnType<typeof calendarSettings>> }) {
 const here = '/app/settings/calendars'
 return <Shell viewer={viewer} current="/app/settings" title="Calendar connections" crumbs={[{ label: 'Settings', href: '/app/settings' }, { label: 'Calendars', href: here, current: true }]}>
  <Card title="Reviewed calendar access"><p>Connect your own Google or Microsoft calendar with an authorized credential. The credential is used for this action and never saved. Each later read or write asks for it again. Only the current installation owner can use these connections.</p><p>Events contain only “Reserved work”, the reserved times and a private visibility flag. Task titles, deadlines, notes, participants and fields are never sent. No invitations are sent. Configure working hours and time off under <a href="/app/settings/availability">Working calendar</a>.</p>
   <Form action="/api/v1/workspaces/ws_main/calendars" next={here} label="Connect calendar">
    <Pick label="Provider" name="service" options={[{ value: 'google', label: 'Google Calendar' }, { value: 'microsoft', label: 'Microsoft Outlook' }]} />
    <Field label="Calendar ID" name="calendarId" required /><Field label="One-use credential" name="credential" type="password" required />
    <Check name="consent" label="I authorize only these reviewed reservation fields on this calendar" /><Submit>Connect calendar</Submit>
   </Form>
  </Card>
  <Card title="My connections">{view.connections.length ? <ul className="rows">{view.connections.map(c => <li key={c.id}><span className="grow">{c.service === 'google' ? 'Google Calendar' : 'Microsoft Outlook'} · {c.active ? 'Connected' : 'Disconnected'}<br/>{c.calendar_id}</span>{!!c.active && <Form action={`/api/v1/calendars/${c.id}/disconnect`} next={here} label={`Disconnect ${c.service}`}><Submit quiet>Disconnect</Submit></Form>}</li>)}</ul> : <p>No connected calendars.</p>}<p>Disconnect stops further reads and writes here. It does not delete provider events. Reconnecting the same calendar retains its mappings for explicit reconciliation; it never creates events automatically.</p></Card>
 </Shell>
}
