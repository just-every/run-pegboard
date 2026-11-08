import type { Viewer } from '../../../ui/viewer'
import type { approvalFollowupInbox, approvalFollowupLog } from '../../notices/approval-followup'
import type { followupSettings, previewFollowupPolicy } from '../../notices/approval-policy'
import type { ApprovalPreferences } from '../../notices/preferences'
import { Card, Check, Field, Form, Pick, Shell, Submit, when } from '../shell'

type Inbox = Awaited<ReturnType<typeof approvalFollowupInbox>>
type Settings = Awaited<ReturnType<typeof followupSettings>>
type Preview = Awaited<ReturnType<typeof previewFollowupPolicy>>
const here = '/app/settings/approval-followup'
export function ApprovalFollowupNotices({ inbox }: { inbox: Inbox | null }) {
  if (!inbox) return null
  return <>
    {inbox.notices.length > 0 && <Card title="Approval follow-up"><ul className="rows">{inbox.notices.map(notice => <li key={notice.id} data-notice-id={notice.id} data-event-id={notice.eventId} data-recipient-id={notice.recipientId} data-route-id={notice.routeId}>
      <span className="grow"><a href={notice.href}>{notice.title}</a><br /><span>{notice.kind === 'escalation' ? 'Final reminder' : 'Overdue review'} · {when(notice.visibleAt)}</span></span>
      <a className="button quiet" href={notice.href}>Review approval</a>
    </li>)}</ul><p>Opening a reminder records no decision. A human decision ends this follow-up episode.</p></Card>}
    {inbox.deferred.length > 0 && <Card title="Approval notices deferred"><ul className="rows">{inbox.deferred.map(notice => <li key={notice.id} data-event-id={notice.eventId} data-recipient-id={notice.recipientId}><span className="grow">{notice.title}<br />{notice.cause?.replaceAll('_', ' ')} · Eligible {when(notice.nextEligibleAt)}</span></li>)}</ul></Card>}
    <p><a href={here}>Approval notice settings</a></p>
  </>
}
const names = (ids: string[], people: { id: string; name: string }[]) => ids.map(id => people.find(p => p.id === id)?.name ?? 'Unavailable recipient').join(', ')
const Multi = ({ label, name, options, value }: { label: string; name: string; options: { id: string; name: string }[]; value: string[] }) => <label className="field">{label}<select className="select" aria-label={label} multiple name={name + '[]'} defaultValue={value}>{options.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
export function ApprovalFollowupSettings({ viewer, preferences, settings, preview, input, log }: { viewer: Viewer; preferences: ApprovalPreferences; settings: Settings | null; preview: Preview | null; input: Record<string, any>; log: Awaited<ReturnType<typeof approvalFollowupLog>> }) {
  const policy = settings?.policy, config = preview ?? (policy ? { projects: JSON.parse(policy.projects), recipients: JSON.parse(policy.recipients), escalation: JSON.parse(policy.escalation), calendar: JSON.parse(policy.calendar), repeatMinutes: policy.repeat_minutes, maxRounds: policy.max_rounds, enabled: !!policy.enabled } : null)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const hours = config?.calendar.week.find((day: any) => day !== null)
  const clock = (n: number) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')
  return <Shell viewer={viewer} current="/auth/settings/identity" title="Approval notice settings">
    <Card title="Your approval notices"><Form action="/api/v1/notices/approval-followup/preferences" next={here} label="Approval notice preferences">
      <input type="hidden" name="enabled" value="false" /><Check label="Show internal approval reminders" name="enabled" value="true" checked={preferences.enabled} />
      <input type="hidden" name="muted" value="false" /><Check label="Mute approval reminders" name="muted" value="true" checked={preferences.muted} />
      <Field label="Do not disturb until (UTC)" name="dndUntil" type="datetime-local" value={preferences.dndUntil ? new Date(preferences.dndUntil).toISOString().slice(0, 16) : ''} />
      <Submit quiet>Save approval preferences</Submit>
    </Form></Card>
    {settings && <>
      <Card title="Internal follow-up policy"><p>{policy?.enabled ? 'Owner-approved policy active.' : 'Follow-up is off until the owner reviews a policy.'} Native Inbox only. No external messages are sent.</p><p>Only named, currently independent routed reviewers may receive reminders. The first human decision ends the episode even when more approvals remain. Withdrawal, changed material or authority loss cancels obsolete work. A new review requires a fresh route.</p>
        <form method="get" action={here} className="stack" aria-label="Review follow-up policy"><input type="hidden" name="preview" value="1" />
          <Pick label="Follow-up" name="enabled" value={config?.enabled ? 'true' : 'false'} options={[{ value: 'false', label: 'Off' }, { value: 'true', label: 'Internal Inbox only' }]} />
          <Multi label="Reviewed projects" name="projects" options={settings.projects} value={config?.projects ?? []} />
          <Multi label="Authorized named recipients" name="recipients" options={settings.people} value={config?.recipients ?? []} />
          <Multi label="Final escalation recipients" name="escalation" options={settings.people} value={config?.escalation ?? []} />
          <Field label="Working timezone" name="zone" value={config?.calendar.zone ?? 'America/New_York'} required />
          <Multi label="Working days" name="days" options={dayNames.map((name, n) => ({ id: String(n), name }))} value={config ? config.calendar.week.flatMap((day: any, n: number) => day ? [String(n)] : []) : ['1', '2', '3', '4', '5']} />
          <div className="inline"><Field label="Working day starts" name="start" type="time" value={clock(hours?.start ?? 540)} required /><Field label="Working day ends" name="end" type="time" value={clock(hours?.end ?? 1020)} required /></div>
          <div className="inline"><Field label="Minutes between rounds" name="repeatMinutes" type="number" value={config?.repeatMinutes ?? 1440} required /><Field label="Maximum rounds (1 to 5)" name="maxRounds" type="number" value={config?.maxRounds ?? 2} required /></div>
          <Submit quiet>Preview follow-up policy</Submit>
        </form>
      </Card>
      {preview && <Card title="Confirm exact follow-up policy"><p>Scope: {names(preview.projects, settings.projects)}.</p><p>Recipients: {names(preview.recipients, settings.people)}. Final escalation: {names(preview.escalation, settings.people) || 'None'}. Escalation never adds someone to the approval route.</p><p>{preview.calendar.zone} · {preview.calendar.week.flatMap((day, n) => day ? [dayNames[n] + ' ' + clock(day.start) + '–' + clock(day.end)] : []).join(', ')}. US federal holidays excluded.</p><p>At most {preview.maxRounds} rounds, {preview.repeatMinutes} minutes apart, beginning when a routed task approval is overdue. The first human decision stops follow-up. Status: {preview.enabled ? 'Enabled' : 'Off'}.</p>
        <Form action="/api/v1/notices/approval-followup/policy" next={here} label="Approve follow-up policy">
          {Object.entries(input).filter(([key]) => !['preview', 'token', 'consent'].includes(key)).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map((v, i) => <input key={key + i} type="hidden" name={key + (Array.isArray(value) ? '[]' : '')} value={String(v)} />))}
          <input type="hidden" name="token" value={preview.token} /><Check label="I approve this exact internal scope and stop policy" name="consent" value="true" />
          <Submit>Approve reviewed policy</Submit>
        </Form>
      </Card>}
      <Card title="Follow-up outcomes"><p>Queued and deferred records are not visible delivery. Provider acceptance and human response are never inferred.</p><ul className="rows">{log.map(episode => <li key={episode.id} data-episode-id={episode.id}><span className="grow"><a href={'/app/approvals/' + episode.route_id}>Open reviewed approval</a><br />{episode.state} · {episode.cause?.replaceAll('_', ' ')} · Next {when(episode.next_at)}<ul>{episode.events.map(event => <li key={event.id} data-event-id={event.id}>{event.kind} {event.ordinal} · {event.state} · {event.cause?.replaceAll('_', ' ')} · Eligible {when(event.next_at)}{episode.deliveries.filter(d => d.event_id === event.id).map(d => <p key={d.id} data-recipient-id={d.recipient_id}>{settings.people.find(p => p.id === d.recipient_id)?.name ?? 'Unavailable recipient'} · {d.state} · {d.cause?.replaceAll('_', ' ')} · {when(d.visible_at ?? d.next_at)}</p>)}</li>)}</ul></span></li>)}</ul></Card>
    </>}
  </Shell>
}
