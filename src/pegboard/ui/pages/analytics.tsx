import type { Viewer } from '../../../ui/viewer'
import type { analystSettings } from '../../analytics-export/keys'
import { datasets, schema } from '../../analytics-export/schema'
import { Card, Check, Field, Form, Pick, Shell, Submit, when } from '../shell'

type Data = Awaited<ReturnType<typeof analystSettings>>
const labels: Record<string, string> = { Portfolios: 'Portfolios', PortfolioProjects: 'Portfolio projects', Goals: 'Goals', GoalLinks: 'Goal sources', Requests: 'Requests', Approvals: 'Approvals', parentId: 'Parent portfolio ID', taskCount: 'Task count', doneCount: 'Completed count', portfolioId: 'Portfolio ID', goalId: 'Goal ID', sourceType: 'Source type', sourceId: 'Source ID', weight: 'Weight', kind: 'Kind', mode: 'Calculation mode', unit: 'Unit', progressPercent: 'Progress percent', state: 'State', observedAt: 'Observed milliseconds UTC', createdAt: 'Created milliseconds UTC', subjectId: 'Subject ID', version: 'Reviewed version', Projects: 'Projects', Tasks: 'Tasks', TaskProjects: 'Task placements', TimeEntries: 'Approved time', id: 'Stable ID', name: 'Name', status: 'Status', title: 'Title', estimateHours: 'Estimate hours', taskId: 'Task ID', projectId: 'Project ID', sheetId: 'Timesheet ID', seconds: 'Duration seconds', adjustmentOf: 'Adjustment reference' }
export function AnalyticsPage({ viewer, workspace, data }: { viewer: Viewer; workspace: string; data: Data }) {
  const here = '/app/settings/analytics', projectName = (id: string) => data.projects.find(p => p.id === id)?.name ?? 'Unavailable project'
  return <Shell viewer={viewer} current="/auth/settings/identity" title="Analyst access" facts={['Settings · Read-only exports · Your credentials only']}>
    <Card title="Authorize selected data">
      <p><a href="/app/settings">Work settings</a> · <a href="/app/audit?action=analytics.key_authorized">Authorization audit</a></p>
      <p>Choose the projects and fields you consent to export. Keys use your current authority and cannot write work or send data. Only you can manage your keys; another administrator cannot recover them.</p>
      <p>This is a limited OData read subset. Tableau and Power BI connections remain unqualified. Saved fetch links last at most 24 hours; downloaded copies cannot be recalled.</p>
      {!data.enabled ? <p>Integrations are disabled. Existing keys cannot fetch data.</p> : !data.projects.length ? <p>No projects currently permit export.</p> : <>
        <Form action="/api/v1/analytics/keys" next={here} label="Authorize analyst key">
          <input type="hidden" name="workspaceId" value={workspace} />
          <Field label="Credential name" name="name" required />
          <fieldset><legend>Projects to export</legend><div className="stack">{data.projects.map(p => <Check key={p.id} label={p.name} name="projects[]" value={p.id} />)}</div></fieldset>
          <fieldset><legend>Additional reviewed scope</legend><p>Portfolios and goals require their own consent. Include every linked project and goal in this review. Personal goals are excluded.</p>
            <div className="stack">{data.portfolios.map(p => <Check key={p.id} label={`Portfolio: ${p.name}`} name="portfolios[]" value={p.id} />)}{data.goals.map(g => <Check key={g.id} label={`Goal: ${g.title}`} name="goals[]" value={g.id} />)}</div>
          </fieldset>
          <fieldset><legend>Datasets and fields</legend><p>Only selected datasets are readable. Each includes its stable ID.</p><div className="grid">{datasets.map(dataset => <section key={dataset}><h3>{labels[dataset]}</h3><div className="stack">{Object.keys(schema[dataset]).map(field => <Check key={field} label={`${labels[dataset]}: ${labels[field]}`} name="fields[]" value={`${dataset}.${field}`} />)}</div></section>)}</div></fieldset>
          <Pick label="Credential lifetime" name="expiryDays" value="7" options={[{ value: '1', label: '1 day' }, { value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} />
          <Check label="I consent to read-only export of exactly these projects and fields, recorded in the audit" name="consent" />
          <Submit>Authorize analyst key</Submit>
        </Form>
        <p id="analytics-error" role="alert" hidden />
        <noscript><p>Enable JavaScript to issue a credential once without storing it in browser history.</p></noscript>
      </>}
    </Card>
    <section id="analytics-credential" hidden aria-label="New analyst credential" tabIndex={-1}>
      <Card title="Save this credential now">
        <p>It is never shown again. Save it in your analyst client's credential store. Do not put the secret in a URL, workbook or shared script.</p>
        <dl><dt>Key ID</dt><dd><code data-analytics-key /></dd><dt>Secret</dt><dd><code data-analytics-secret /></dd><dt>Service URL</dt><dd><code data-analytics-service /></dd><dt>Expires</dt><dd data-analytics-expiry /></dl>
        <p>Use Basic authentication with the key ID as username and the secret as password, or a Bearer credential. Each fetch rechecks your current authority.</p>
        <a className="button quiet" href={here}>I saved it; hide credential</a>
      </Card>
    </section>
    <Card title="Your analyst keys">
      <p>Expiry or revocation immediately refuses new reads, including saved page and refresh links.</p>
      <Form action="/api/v1/analytics/reports/run-due" next={here} label="Capture due local reports"><input type="hidden" name="workspaceId" value={workspace} /><Submit quiet>Capture due reports</Submit></Form>
      {!data.keys.length ? <p>No analyst keys issued by you.</p> : <ul className="rows" aria-label="Your analyst keys">{data.keys.map(key => <li key={key.id} data-analyst-key={key.id}>
        <div className="grow"><strong>{key.name}</strong> <span className="tagline">{key.status}</span><p>Created {when(key.created_at)} · Expires {when(key.expires_at)}</p>
          <p>Projects: {key.projects.map(projectName).join(', ')}</p><p>Additional scope: {[...(key.scopes.portfolios ?? []).map(id => data.portfolios.find(p => p.id === id)?.name ?? 'Unavailable portfolio'), ...(key.scopes.goals ?? []).map(id => data.goals.find(g => g.id === id)?.title ?? 'Unavailable goal')].join(', ') || 'None'}</p><p>Fields: {Object.entries(key.fields).map(([dataset, fields]) => `${labels[dataset]}: ${fields.map(field => labels[field]).join(', ')}`).join(' · ')}</p>
          <details><summary>Connection details</summary><p>Key ID: <code>{key.id}</code></p><p>Service path: <code>{`/api/v1/analytics/odata/${key.id}`}</code></p><p>The secret cannot be recovered. Issue a replacement, then revoke the old key.</p></details>
        </div>
        <details><summary>Local reports</summary><p>Reports use exactly these fields and current authority. No email or external delivery is authorized. Captured results expire within 24 hours.</p>
          {key.status === 'Active' && <>
            <Form action={`/api/v1/analytics/keys/${key.id}/reports`} next="" label={`Capture report ${key.name}`}><input type="hidden" name="workspaceId" value={workspace} /><Submit quiet>Capture report</Submit></Form>
            <Form action={`/api/v1/analytics/keys/${key.id}/schedule`} next={here} label={`Schedule report ${key.name}`}><input type="hidden" name="workspaceId" value={workspace} /><Pick label="Report frequency" name="hours" value="24" options={[{ value: '24', label: 'Daily' }, { value: '168', label: 'Weekly' }]} /><Check label="I authorize local report snapshots under this key" name="consent" /><Submit quiet>Schedule local report</Submit></Form>
            {key.schedule && !key.schedule.stopped_at && <Form action={`/api/v1/analytics/keys/${key.id}/schedule/stop`} next={here} label={`Stop report ${key.name}`}><input type="hidden" name="workspaceId" value={workspace} /><Submit quiet>Stop schedule</Submit></Form>}
          </>}
          {key.schedule && <p>{key.schedule.stopped_at ? 'Schedule stopped' : `Every ${key.schedule.hours} hours`}</p>}
          {key.schedule?.last_snapshot && key.status === 'Active' && <a href={`${here}/${key.id}?snapshot=${key.schedule.last_snapshot}`}>Open latest report</a>}
        </details>
        {key.revoked_at === null && <Form action={`/api/v1/analytics/keys/${key.id}/revoke`} next={here} label={`Revoke ${key.name}`}><input type="hidden" name="workspaceId" value={workspace} /><Submit quiet>Revoke key</Submit></Form>}
      </li>)}</ul>}
    </Card>
  </Shell>
}
