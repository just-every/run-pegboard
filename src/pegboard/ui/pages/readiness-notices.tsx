import type { readinessNotices } from '../../notices'
import { Card, Check, Field, Form, Submit, when } from '../shell'

type ReadinessInbox = Awaited<ReturnType<typeof readinessNotices>>
const dateValue = (at: number | null) => at ? new Date(at).toISOString().slice(0, 16) : ''

/** Reuses the Inbox's existing hung cards, rows and ordinary same-origin forms. */
export function ReadinessNotices({ readiness }: { readiness: ReadinessInbox }) {
  return <>
    {readiness.notices.length > 0 && <Card title="Ready to start">
      <ul className="rows">{readiness.notices.map(notice => <li key={notice.id}>
        <span className="grow"><a href={notice.href}>{notice.title}</a><br /><small>This task is ready to start. {when(notice.visibleAt)}</small></span>
        <Form action={`/api/v1/tasks/${notice.taskId}/readiness-preferences`} next="/app/inbox" label={`Mute readiness for ${notice.title}`}>
          <input type="hidden" name="muted" value="true" /><Submit quiet>Mute this task</Submit>
        </Form>
      </li>)}</ul>
    </Card>}
    {readiness.deferred.length > 0 && <Card title="Readiness notices held for you">
      <ul className="rows">{readiness.deferred.map(notice => <li key={notice.taskId}>
        <span className="grow"><a href={notice.href}>{notice.title}</a><br /><small>{notice.reason === 'quiet_hours' ? 'Quiet hours' : 'Digest preference'} · Eligible {when(notice.nextEligibleAt)}</small></span>
      </li>)}</ul>
    </Card>}
    <p><a href="/app/settings/readiness">Readiness notice settings</a></p>
  </>
}

export function ReadinessPreferences({readiness}:{readiness:ReadinessInbox}){return <>
    <Card title="Readiness preferences">
      <p className="muted">Receive a notice when your waiting task becomes ready to start.</p>
      <Form action="/api/v1/notices/readiness/preferences" next="/app/settings/readiness" label="Readiness preferences">
        <input type="hidden" name="enabled" value="false" /><Check label="Ready to start notices" name="enabled" checked={readiness.preferences.enabled} value="true" />
        <input type="hidden" name="muted" value="false" /><Check label="Mute readiness notices" name="muted" checked={readiness.preferences.muted} value="true" />
        <input type="hidden" name="inboxEnabled" value="false" /><Check label="Show readiness in Inbox" name="inboxEnabled" checked={readiness.preferences.inboxEnabled} value="true" />
        <Field label="Quiet until (UTC)" name="dndUntil" type="datetime-local" value={dateValue(readiness.preferences.dndUntil)} />
        <Field label="Hold for digest until (UTC)" name="digestUntil" type="datetime-local" value={dateValue(readiness.preferences.digestUntil)} />
        <Submit quiet>Save preferences</Submit>
      </Form>
    </Card>
</>}
