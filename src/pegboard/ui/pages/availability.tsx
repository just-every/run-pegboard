import type { Viewer } from '../../../ui/viewer'
import type { availabilityView } from '../../schedule/availability'
import { Card, Field, Form, Shell, Submit } from '../shell'

type View = Awaited<ReturnType<typeof availabilityView>>
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const display = (value: string, zone: string) => value.length === 10 ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value + 'T12:00:00Z')) : new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function AvailabilityPage({ viewer, view }: { viewer: Viewer; view: View }) {
  const here = `/app/settings/availability?workspace=${encodeURIComponent(view.workspace.id)}`, api = `/api/v1/workspaces/${view.workspace.id}`
  return <Shell viewer={viewer} current="/app/settings" title="Working calendar" facts={[view.workspace.name, view.zone]} crumbs={[{ label: 'Settings', href: '/app/settings' }, { label: 'Working calendar', href: here, current: true }]}>
    <Card title="Working hours">
      <p>Schedule previews use these local hours, observed US federal holidays and each owner's time off. Changes take effect in the next preview; existing task dates stay in place until a person applies a date change.</p>
      {view.canConfigure ? <Form action={`${api}/working-calendar`} next={here} label="Configure working hours">
        <Field label="Business timezone" name="zone" value={view.zone} required placeholder="America/New_York" />
        <p className="muted">Leave both times empty for a closed day. Hours use the business timezone.</p>
        {view.days.map(day => <div key={day.weekday} role="group" aria-label={days[day.weekday]}><h3>{days[day.weekday]}</h3><div className="inline"><Field label={`${days[day.weekday]} opens`} name={`day${day.weekday}Start`} type="time" value={day.start} /><Field label={`${days[day.weekday]} closes`} name={`day${day.weekday}End`} type="time" value={day.end} /></div></div>)}
        <Submit>Save working hours</Submit>
      </Form> : <><p className="muted">A workspace owner or administrator can change working hours.</p><ul className="rows">{view.days.map(day => <li key={day.weekday}><span className="grow">{days[day.weekday]}</span><span>{day.start ? `${day.start} – ${day.end}` : 'Closed'}</span></li>)}</ul></>}
    </Card>
    <Card title="My time off">
      <p>These dates are unavailable for your work. For full days off, the end date is included. Colleagues see the scheduling impact on work they can already access; no private reason is collected.</p>
      {view.timeOff.length ? <ul className="rows">{view.timeOff.map(leave => <li key={leave.id}><span className="grow">{display(leave.start, view.zone)} – {display(leave.end, view.zone)}{leave.start.length > 10 ? ` · ${view.zone}` : ''}</span><Form action={`${api}/time-off/${leave.id}/remove`} next={here} label={`Remove time off ${leave.start}`}><Submit quiet>Remove time off</Submit></Form></li>)}</ul> : <p className="muted">No time off recorded.</p>}
      <Form action={`${api}/time-off`} next={here} label="Add my time off"><div className="inline"><Field label="First day off" name="start" type="date" required /><Field label="Last day off" name="end" type="date" required /></div><Submit>Add time off</Submit></Form>
    </Card>
  </Shell>
}
