import type { Viewer } from '../../../ui/viewer'
import type { readReport } from '../../analytics-export/reports'
import { Card, Shell, when } from '../shell'

export function AnalystReportPage({ viewer, keyId, workspace, report }: { viewer: Viewer; keyId: string; workspace: string; report: Awaited<ReturnType<typeof readReport>> }) {
  return <Shell viewer={viewer} current="/auth/settings/identity" title="Analyst report" facts={['Settings · Local snapshot · No external delivery']}>
    <Card title="Snapshot reconciliation">
      <p><a href={`/app/settings/analytics?workspace=${encodeURIComponent(workspace)}`}>Analyst access</a></p>
      <p role="status">{report.stale ? 'Stale snapshot; capture a fresh report to include later changes.' : 'Current snapshot'}</p>
      <p>Captured {when(report.capturedAt)} · Expires {when(report.expiresAt)}</p>
      <p>Source revision {report.sourceRevision} · Definition {report.definition}</p>
      <dl>{Object.entries(report.counts).map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{String(count)} rows</dd></div>)}</dl>
      <p>Task estimate hours: {report.estimateHours ?? 'Field not authorized'} · Approved time seconds: {report.approvedSeconds ?? 'Field not authorized'}</p>
      <p>Tasks count once across projects. Time uses approved entries and signed corrections. Portfolio totals deduplicate their member tasks. Goal progress uses the native calculation and exposes unknown or stale inputs.</p>
    </Card>
    {Object.entries(report.data).map(([dataset, rows]) => <Card key={dataset} title={dataset}>
      <a href={`/api/v1/analytics/keys/${keyId}/reports?workspace=${encodeURIComponent(workspace)}&snapshot=${report.snapshot}&dataset=${dataset}`}>Download {dataset} CSV</a>
      <ul className="rows">{rows!.map(row => <li key={row.id}><dl>{Object.entries(row).map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value === null ? 'Unknown' : String(value)}</dd></div>)}</dl></li>)}</ul>
    </Card>)}
  </Shell>
}
