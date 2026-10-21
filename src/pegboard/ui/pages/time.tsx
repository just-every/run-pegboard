import type { Viewer } from '../../../ui/viewer'
import type { listSheets, sheetView } from '../../time/time'
import { Card, Field, Form, Pick, Shell, Submit, when } from '../shell'
import { newId } from '../../db'
const actions: Record<string, string> = {
  timer_started: 'Started timer',
  timer_stopped: 'Stopped timer',
  entry_added: 'Added manual time',
  entry_corrected: 'Corrected manual time',
  submit: 'Submitted exact revision',
  return: 'Returned for correction',
  approve: 'Approved and locked',
  adjustment_added: 'Recorded attributed adjustment',
}
type View = Awaited<ReturnType<typeof sheetView>>
export function TimePage({
  viewer,
  sheets,
  view,
  tasks,
  day,
}: {
  viewer: Viewer
  sheets: Awaited<ReturnType<typeof listSheets>>
  view: View | null
  tasks: { value: string; label: string }[]
  day: string
}) {
  const here = view ? `/app/time/${view.sheet.id}` : '/app/time'
  const editable =
    view &&
    view.sheet.operator_id === view.actorId &&
    ['draft', 'returned'].includes(view.sheet.status)
  return (
    <Shell
      viewer={viewer}
      current="/app/my-tasks"
      title={view ? `${view.person}: timesheet` : 'Timesheets'}
      facts={
        view
          ? [
              `${view.sheet.start_date} – ${view.sheet.end_date}`,
              view.sheet.status,
              `${view.totalSeconds} actual seconds`,
              `${view.estimateHours} estimated hours`,
              view.running ? 'Timer running' : 'No running timer',
            ]
          : ['Task effort and approved time']
      }
    >
      <Card title="Timesheets">
        <p>
          <a href="/app/my-tasks">Back to My tasks</a>
        </p>
        <ul className="rows">
          {sheets.map((s) => (
            <li key={s.id}>
              <a href={`/app/time/${s.id}`}>
                {s.start_date} – {s.end_date} · {s.status}
              </a>
            </li>
          ))}
        </ul>
        <Form
          action="/api/v1/timesheets"
          next="/app/time"
          label="Create timesheet"
        >
          <div className="inline">
            <Field
              label="Period starts"
              name="startDate"
              type="date"
              value={day}
              required
            />
            <Field
              label="Period ends"
              name="endDate"
              type="date"
              value={day}
              required
            />
            <Submit>Create timesheet</Submit>
          </div>
        </Form>
      </Card>
      {view && (
        <>
          <Card title="Recorded time">
            <p>
              A different owner or administrator with access to all linked
              project work reviews submitted time. Personal time remains
              private; sharing a task does not share its recorded personal time.
            </p>
            {view.sheet.reason && <p>Review reason: {view.sheet.reason}</p>}
            <ul className="rows">
              {view.entries.map((e) => (
                <li key={e.id}>
                  <span className="grow">
                    {e.task} · {e.project}
                    <br />
                    <small>
                      {e.work_date} ·{' '}
                      {e.seconds === null ? 'Running' : `${e.seconds} seconds`}{' '}
                      · {e.timezone} · {e.source}
                      {e.adjustment_of ? ' · attributed adjustment' : ''}
                    </small>
                    <p>{e.notes}</p>
                    {editable && e.source === 'timer' && e.end_ms === null && (
                      <Form
                        action={`/api/v1/time/${e.id}/stop`}
                        next={here}
                        label={`Stop ${e.task}`}
                      >
                        <Submit>Stop timer</Submit>
                      </Form>
                    )}
                    {editable && e.source === 'manual' && (
                      <Form
                        action={`/api/v1/time/${e.id}/correct`}
                        next={here}
                        label={`Correct ${e.task}`}
                      >
                        <Field
                          label="Seconds"
                          name="seconds"
                          type="number"
                          value={e.seconds}
                        />
                        <Field label="Notes" name="notes" value={e.notes} />
                        <Submit quiet>Save correction</Submit>
                      </Form>
                    )}
                    {view.sheet.status === 'approved' &&
                      view.sheet.operator_id === view.actorId && (
                        <details>
                          <summary>Record an attributed adjustment</summary>
                          <Form
                            action={`/api/v1/time/${e.id}/adjust`}
                            next="/app/time"
                            label={`Adjust ${e.task}`}
                          >
                            <input
                              type="hidden"
                              name="key"
                              value={newId('op')}
                            />
                            <Pick
                              label="Draft or returned timesheet"
                              name="sheetId"
                              options={sheets
                                .filter(
                                  (s) =>
                                    s.operator_id === view.actorId &&
                                    ['draft', 'returned'].includes(s.status),
                                )
                                .map((s) => ({
                                  value: s.id,
                                  label: `${s.start_date} – ${s.end_date}`,
                                }))}
                            />
                            <Field
                              label="Adjustment date"
                              name="date"
                              type="date"
                              value={day}
                            />
                            <Field
                              label="Adjustment seconds (signed)"
                              name="seconds"
                              type="number"
                              required
                            />
                            <Field label="Reason" name="reason" required />
                            <Submit quiet>Add adjustment</Submit>
                          </Form>
                        </details>
                      )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          {editable && (
            <Card title="Record time">
              <Form
                action={`/api/v1/timesheets/${view.sheet.id}/timer`}
                next={here}
                label="Start timer"
              >
                <input type="hidden" name="key" value={newId('op')} />
                <Pick label="Task" name="taskId" options={tasks} />
                <Field label="Notes" name="notes" />
                <Submit>Start timer</Submit>
              </Form>
              <Form
                action={`/api/v1/timesheets/${view.sheet.id}/entries`}
                next={here}
                label="Manual time"
              >
                <input type="hidden" name="key" value={newId('op')} />
                <Pick label="Task" name="taskId" options={tasks} />
                <Field
                  label="Date worked"
                  name="date"
                  type="date"
                  value={day}
                />
                <Field
                  label="Duration in seconds"
                  name="seconds"
                  type="number"
                  required
                />
                <Field label="Notes" name="notes" />
                <Submit>Add manual time</Submit>
              </Form>
              <Form
                action={`/api/v1/timesheets/${view.sheet.id}/decision`}
                next={here}
                label="Submit timesheet"
              >
                <input type="hidden" name="action" value="submit" />
                <input type="hidden" name="revision" value={view.token} />
                <Submit>Submit exact revision</Submit>
              </Form>
            </Card>
          )}
          {view.sheet.status === 'submitted' && view.canReview && (
            <Card title="Review exact revision">
              <Form
                action={`/api/v1/timesheets/${view.sheet.id}/decision`}
                next="/app/time"
                label="Review timesheet"
              >
                <input type="hidden" name="revision" value={view.token} />
                <Pick
                  label="Decision"
                  name="action"
                  options={[
                    { value: 'approve', label: 'Approve and lock' },
                    { value: 'return', label: 'Return for correction' },
                  ]}
                />
                <Field label="Reason for return" name="reason" />
                <Submit>Apply decision</Submit>
              </Form>
            </Card>
          )}
          {view.sheet.status === 'approved' && (
            <Card title="Approved and locked">
              <p>
                Later corrections are separate attributed adjustments. Original
                entries remain unchanged.
              </p>
              <a
                className="button quiet"
                href={`/api/v1/timesheets/${view.sheet.id}/export.csv`}
              >
                Download approved CSV
              </a>
              <p>
                Gauge, Harvest and QuickBooks Time exports are not available.
              </p>
            </Card>
          )}
          <Card title="Time history">
            <ol className="rows">
              {view.history.map((h, i) => (
                <li key={i}>
                  {h.actor} · {actions[h.action] ?? 'Updated time'} ·{' '}
                  {when(h.at)}
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </Shell>
  )
}
