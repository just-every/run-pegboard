import type { portfolioRollup } from '../../portfolios/rollup'
import type { Viewer } from '../../../ui/viewer'
import { Card, Check, Field, Form, Pick, Shell, Submit, Area, when } from '../shell'

type View = Awaited<ReturnType<typeof portfolioRollup>>
type Option = { value: string; label: string }
export const tabs = ['summary', 'timeline', 'workload', 'dashboard'] as const
const label = (code: string) => ({ milestone_past_due: 'Milestone past due', negative_slack: 'Negative slack on the critical path', overdue_share: 'Overdue share', status_stale: 'Status out of date' } as Record<string, string>)[code] ?? code
const health = (value: string | undefined) => value === 'on_track' ? 'On track' : value === 'at_risk' ? 'At risk' : value === 'off_track' ? 'Off track' : 'Not published'
const computedLabel = (state: string) => state === 'at_risk' ? 'At risk' : state === 'unknown' ? 'Unknown: no published status' : 'No computed flags'
const bar = (part: number, whole: number) => <span className="track" aria-hidden="true"><span className={`fill pct-${whole ? Math.min(20, Math.round(part * 20 / whole)) * 5 : 0}`} /></span>

export function PortfolioPage({ viewer, view, tab, drill, atInput, projectOptions, people }: { viewer: Viewer; view: View; tab: string; drill: { metric: string; tasks: View['tasks'] } | null; atInput: string | null; projectOptions: Option[]; people: Option[] }) {
  const here = `/app/portfolios/${view.portfolio.id}`, admin = view.portfolio.level === 'admin', keep = `${atInput ? `&at=${encodeURIComponent(atInput)}` : ''}${view.filter ? `&filter=${view.filter.id}` : ''}`
  const s = view.summary, evaluated = when(view.evaluatedAt)
  const flags = view.projects.flatMap(p => p.flags.map(f => ({ ...f, project: p })))
  return <Shell viewer={viewer} current="/app/portfolios" title={view.portfolio.name} chip={s.computed.state === 'at_risk' ? 'AT RISK' : s.computed.state === 'unknown' ? 'UNKNOWN' : 'CLEAR'} facts={[`Owner: ${view.portfolio.owner}`, `${s.projects} project${s.projects === 1 ? '' : 's'} you can read`, `Evaluated ${evaluated}`]}>
    <Card title="Views">
      <nav className="inline" aria-label="Portfolio tabs">{tabs.map(name => <a key={name} className={name === tab ? 'button primary' : 'button quiet'} aria-current={name === tab ? 'page' : undefined} href={`${here}?tab=${name}${keep}`}>{name[0].toUpperCase() + name.slice(1)}</a>)}</nav>
      <form method="get" action={here} className="inline" aria-label="Evaluate as of"><input type="hidden" name="tab" value={tab} />
        <Field label="Evaluate as of (UTC)" name="at" type="datetime-local" value={atInput ?? ''} />
        {view.filters.length > 0 && <Pick label="Saved filter" name="filter" blank="No filter" value={view.filter?.id ?? ''} options={view.filters.map(f => ({ value: f.id, label: f.name }))} />}
        <button type="submit" className="button quiet">Show</button></form>
      {view.portfolio.ancestors.length > 0 && <p className="muted">Inside {view.portfolio.ancestors.map(a => a.name).join(' › ')}</p>}
    </Card>

    {tab === 'summary' && <>
      <Card title="Health">
        <div className="grid">
          <div><h3>Manual health (published by a person)</h3>{view.manual ? <><p role="status"><span className={view.manual.health === 'on_track' ? 'tagline on' : 'tagline warn'}>{health(view.manual.health)}</span></p><p>{view.manual.summary}</p><ul className="plain">{view.manual.citations.map(c=><li key={c.id}><a href={c.link}>{c.title}</a></li>)}</ul><small className="muted">{view.manual.author} · {when(view.manual.publishedAt)}</small></> : <p className="muted">No status published for this portfolio.</p>}</div>
          <div><h3>Computed from the work</h3><p role="status"><span className={s.computed.state === 'at_risk' ? 'tagline warn' : s.computed.state === 'unknown' ? 'tagline' : 'tagline on'}>{computedLabel(s.computed.state)}</span></p><p>{s.computed.atRisk} of {s.projects} projects at risk · {s.computed.unknown} without a published status</p></div>
          <div><h3>Risk policy · version {view.policy.version}</h3><ul className="plain"><li>{view.policy.milestonePastDue ? 'Flag' : 'Ignore'} incomplete milestones past due</li><li>{view.policy.negativeSlack ? 'Flag' : 'Ignore'} critical-path tasks with negative slack</li><li>At risk at {view.policy.overdueShare}% of incomplete due-dated tasks overdue</li><li>At risk when the last published status is over {view.policy.staleDays} days old</li></ul></div>
        </div>
      </Card>
      <Card title="Why projects are at risk">
        {flags.length === 0 ? <p className="muted">No project is flagged at {evaluated}.</p> : <ul className="rows">{flags.map(f => <li key={f.project.id + f.code}><span className="grow"><strong>{f.project.name}</strong> · {label(f.code)}<br /><small>{f.reason}. Evaluated {when(f.evaluatedAt)} under policy version {f.policyVersion}.</small>
          <ul className="plain">{f.sources.map(src => <li key={src.id}>{src.kind === 'task' ? <a href={`/app/tasks/${src.id}`}>{src.title}</a> : src.title} · {src.detail}</li>)}</ul></span></li>)}</ul>}
      </Card>
      <Card title="Rollup">
        <ul className="rows">
          <li><span className="grow">Progress</span><span>{s.progress === null ? 'No tasks' : `${s.progress}% done`}</span>{bar(s.byStatus.done, s.tasks)}</li>
          <li><span className="grow"><a href={`${here}?tab=summary&drill=all${keep}`}>Tasks</a></span><span>{s.tasks} · {s.byStatus.todo} to do · {s.byStatus.doing} doing · {s.byStatus.done} done</span></li>
          <li><span className="grow"><a href={`${here}?tab=summary&drill=overdue${keep}`}>Overdue</a></span><span>{s.overdue}</span></li>
          <li><span className="grow"><a href={`${here}?tab=summary&drill=milestones${keep}`}>Milestones</a></span><span>{s.milestones.done} of {s.milestones.total} done · {s.milestones.past} past due{s.milestones.next ? ` · next ${s.milestones.next.title}, ${s.milestones.next.due}` : ''}</span></li>
          <li><span className="grow">Dates</span><span>{s.startDate ?? '—'} to {s.dueDate ?? '—'}</span></li>
          <li><span className="grow">Estimated effort</span><span>{s.estimateHours} hours</span></li>
          <li><span className="grow">Owners</span><span>{s.owners.map(o => `${o.name} (${o.open} open)`).join(' · ') || '—'}</span></li>
          {s.fields.map(f => <li key={f.id}><span className="grow">{f.label}</span><span>{f.total}{f.units ? ` ${f.units}` : ''}</span></li>)}
        </ul>
        {drill && <><h3>Source rows: {drill.metric}</h3>{drill.tasks.length === 0 ? <p className="muted">No tasks you can read match.</p> : <ul className="rows">{drill.tasks.map(t => <li key={t.id}><span className="grow"><a href={t.link}>{t.title}</a><br /><small>{t.ref ? `${t.ref} · ` : ''}{t.projects.map(p => p.name).join(', ')} · {t.owner}</small></span><span>{t.status}{t.due ? ` · due ${t.due.slice(0, 10)}` : ''}</span></li>)}</ul>}</>}
      </Card>
      <Card title="Projects">
        {view.projects.length === 0 ? <p className="muted">No project you can read hangs here yet.</p> : <ul className="rows">{view.projects.map(p => <li key={p.id}><span className="grow"><a href={p.link}>{p.name}</a><br /><small>{p.owner} · {p.done} of {p.tasks} done · {p.overdue} overdue{p.manual ? ` · manual: ${health(p.manual.health)}` : ' · manual: not published'}</small></span><span className={p.computed === 'at_risk' ? 'tagline warn' : p.computed === 'unknown' ? 'tagline' : 'tagline on'}>{computedLabel(p.computed)}</span></li>)}</ul>}
      </Card>
      <Card title="Nested portfolios">
        {(function show(node: View['nested'], depth: number): React.ReactNode { return <ul className="rows" key={node.id}>{depth > 0 && <li style={{ paddingLeft: (depth - 1) * 20 }}><span className="grow"><a href={`/app/portfolios/${node.id}`}>{node.name}</a></span><span>{node.summary.projects} projects · {node.summary.tasks} tasks · {node.summary.progress ?? 0}% done · {node.summary.computed.atRisk} at risk</span></li>}{node.children.map((c: View['nested']) => show(c, depth + 1))}</ul> })(view.nested, 0)}
      </Card>
    </>}

    {tab === 'timeline' && <>
      <Card title="Project timeline">
        <ul className="rows">{view.tabs.timeline.projects.map(p => <li key={p.id}><span className="grow"><a href={p.link}>{p.name}</a></span><span>{p.start ?? '—'} to {p.due ?? '—'}</span><span className={p.computed === 'at_risk' ? 'tagline warn' : 'tagline'}>{computedLabel(p.computed)}</span></li>)}</ul>
      </Card>
      <Card title="Task timeline across projects">
        {view.tabs.timeline.tasks.length === 0 ? <p className="muted">No dated tasks.</p> : <ul className="rows">{view.tabs.timeline.tasks.map(t => <li key={t.id}><span className="grow"><a href={t.link}>{t.title}</a><br /><small>{t.projects.map(p => p.name).join(' · ')} · {t.owner}</small></span><span>{(t.start ?? t.due ?? '').slice(0, 10)} to {(t.due ?? t.start ?? '').slice(0, 10)}</span><span className={t.overdue ? 'tagline warn' : 'tagline'}>{t.kind === 'milestone' ? 'Milestone' : t.status}</span></li>)}</ul>}
        {view.tabs.timeline.dependencies.length > 0 && <p className="muted">{view.tabs.timeline.dependencies.length} dependency link{view.tabs.timeline.dependencies.length === 1 ? '' : 's'} among these tasks.</p>}
      </Card>
    </>}

    {tab === 'workload' && <Card title="Workload by person">
      {view.tabs.workload.owners.length === 0 ? <p className="muted">No tasks you can read.</p> : <ul className="rows">{view.tabs.workload.owners.map(o => <li key={o.id}><span className="grow"><strong>{o.name}</strong><br /><small>{o.projects.join(' · ')}</small></span><span>{o.open} open · {o.overdue} overdue · {o.openHours} h</span>{bar(o.openHours, Math.max(...view.tabs.workload.owners.map(x => x.openHours), 1))}</li>)}</ul>}
    </Card>}

    {tab === 'dashboard' && <>
      <Card title="Task status"><ul className="rows">{view.tabs.dashboard.byStatus.map(row => <li key={row.status}><span className="grow">{row.status}</span><span>{row.tasks}</span>{bar(row.tasks, Math.max(...view.tabs.dashboard.byStatus.map(r => r.tasks), 1))}</li>)}</ul></Card>
      <Card title="Computed health and manual health"><div className="grid">
        <div><h3>Computed</h3><p>{view.tabs.dashboard.computed.at_risk} at risk · {view.tabs.dashboard.computed.unknown} unknown · {view.tabs.dashboard.computed.clear} clear</p></div>
        <div><h3>Manual</h3><p>{view.tabs.dashboard.manual.on_track} on track · {view.tabs.dashboard.manual.at_risk} at risk · {view.tabs.dashboard.manual.off_track} off track · {view.tabs.dashboard.manual.missing} not published</p></div>
      </div>{view.tabs.dashboard.reasons.length > 0 && <ul className="rows">{view.tabs.dashboard.reasons.map(r => <li key={r.code}><span className="grow">{label(r.code)}</span><span>{r.projects} project{r.projects === 1 ? '' : 's'}</span></li>)}</ul>}</Card>
      <Card title="Overdue by project"><ul className="rows">{view.tabs.dashboard.projects.map(p => <li key={p.id}><span className="grow"><a href={p.link}>{p.name}</a></span><span>{p.overdue} of {p.tasks} overdue{p.overdueShare === null ? ' · no due-dated open tasks' : ` · ${Math.round(p.overdueShare * 100)}% of due-dated open work`}</span>{bar(p.overdue, Math.max(p.tasks, 1))}</li>)}</ul></Card>
    </>}

    {admin && <Card title="Manage this portfolio">
      <Form action={`/api/v1/portfolios/${view.portfolio.id}/projects`} next={here} label="Add a project"><Pick label="Project to add" name="projectId" options={projectOptions} /><Submit>Add project</Submit></Form>
      <Form action="/api/v1/status-updates" next={here} label="Publish portfolio status"><input type="hidden" name="subjectType" value="portfolio" /><input type="hidden" name="subjectId" value={view.portfolio.id} /><Pick label="Health" name="health" options={[{ value: 'on_track', label: 'On track' }, { value: 'at_risk', label: 'At risk' }, { value: 'off_track', label: 'Off track' }]} /><Area label="Status summary" name="summary" /><Pick label="Delivery record to cite" name="recordIds" options={view.deliveryRecords.map(r=>({value:r.id,label:r.title}))} blank="No citation"/><Submit>Publish status</Submit></Form>
      <Form action={`/api/v1/portfolios/${view.portfolio.id}/policy`} next={here} label="Change risk policy"><Field label="Overdue share percent" name="overdueShare" type="number" value={view.policy.overdueShare} step="any" /><Field label="Stale status days" name="staleDays" type="number" value={view.policy.staleDays} step="any" /><Check label="Flag milestones past due" name="milestonePastDue" checked={view.policy.milestonePastDue} /><Check label="Flag negative slack on the critical path" name="negativeSlack" checked={view.policy.negativeSlack} /><Submit>Save policy version</Submit></Form>
      <Form action={`/api/v1/portfolios/${view.portfolio.id}/members`} next={here} label="Name a portfolio member"><Pick label="Person" name="operatorId" options={people} /><Pick label="Access to rollups" name="level" options={[{ value: 'viewer', label: 'Viewer' }, { value: 'admin', label: 'Admin' }]} /><Submit>Save member</Submit></Form>
      <Form action={`/api/v1/portfolios/${view.portfolio.id}/filters`} next={here} label="Save a filter"><Field label="Filter name" name="name" required /><Pick label="Owner" name="ownerId" blank="Anyone" options={people} /><Pick label="Status" name="status" blank="Any status" options={[{ value: 'todo', label: 'To do' }, { value: 'doing', label: 'Doing' }, { value: 'done', label: 'Done' }]} /><Check label="Overdue only" name="overdue" /><Submit>Save filter</Submit></Form>
      {view.history.length > 0 && <><h3>Policy versions</h3><ul className="rows">{view.history.map(h => <li key={h.version}><span className="grow">Version {h.version}</span><span>{h.policy.overdueShare}% · {h.policy.staleDays} days · {when(h.changedAt)}</span></li>)}</ul></>}
    </Card>}
  </Shell>
}
