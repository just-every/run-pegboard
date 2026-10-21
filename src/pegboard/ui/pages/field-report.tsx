import type { fieldReport } from '../../fields/report'
import type { Viewer } from '../../../ui/viewer'
import { Card, Shell } from '../shell'
export function FieldReportPage({
  viewer,
  data,
}: {
  viewer: Viewer
  data: Awaited<ReturnType<typeof fieldReport>>
}) {
  return (
    <Shell
      viewer={viewer}
      current="/app/projects"
      title={`${data.project.name}: fields`}
      facts={[`${data.rows.length} tasks`]}
      crumbs={[
        { label: data.project.name, href: `/app/projects/${data.project.id}` },
        {
          label: 'Field report',
          href: `/app/projects/${data.project.id}/field-report`,
          current: true,
        },
      ]}
    >
      <Card title="Field report">
        <p>
          Live values use the same permission checks and calculations as each
          task. An error is shown without replacing it with zero.
        </p>
        <ul className="rows">
          {data.rows.map((row) => (
            <li key={row.id}>
              <span className="grow">
                <a href={`/app/tasks/${row.id}`}>{row.title}</a>
                <dl>
                  {row.fields.map((f) => (
                    <div key={f.id}>
                      <dt>
                        {f.label} {f.units}
                      </dt>
                      <dd>
                        {f.error
                          ? `Error: ${f.error}`
                          : Array.isArray(f.value)
                            ? f.value.join(', ')
                            : String(f.value ?? 'No value')}
                      </dd>
                    </div>
                  ))}
                </dl>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  )
}
