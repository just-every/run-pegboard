import type { scheduleView } from '../../schedule/timeline'
import type { Plan } from '../../schedule/plan'
import type { Viewer } from '../../../ui/viewer'
import { Card, Field, Form, Pick, Shell, Submit, when } from '../shell'

type View = Awaited<ReturnType<typeof scheduleView>>
type Preview = { plan: Omit<Plan, 'all'>; move: { taskId: string; start?: string; due?: string } } | { error: string } | null
const typeLabel = (type: string) => ({ fs: 'finish to start', ss: 'start to start', ff: 'finish to finish', sf: 'start to finish' } as Record<string, string>)[type] ?? type
const day = (value: string | null) => value ? value.slice(0, 10) : '—'
const errors: Record<string, string> = { dependency_cycle: 'That change would make a dependency loop, so nothing was changed.', not_found: 'That task is not available.', dates_order: 'The start must not be after the due date.', personal_task: 'Personal tasks have no dependencies.' }

export function TimelinePage({ viewer, view, preview, people, input }: { viewer: Viewer; view: View; preview: Preview; people: { value: string; label: string }[]; input: Record<string, string> }) {
  const here = `/app/projects/${view.project.id}/timeline`, titles = new Map(view.tasks.map(t => [t.id, t.title]))
  const dated = view.tasks.filter(t => t.start || t.due), stamps = dated.flatMap(t => [t.start, t.due]).filter((d): d is string => !!d).map(d => Date.parse(d.slice(0, 10) + 'T00:00:00Z')), low = Math.min(...stamps), span = Math.max(Math.max(...stamps) - low, 86400000)
  const place = (t: View['tasks'][number]) => { const a = Date.parse((t.start ?? t.due!).slice(0, 10) + 'T00:00:00Z'), b = Date.parse((t.due ?? t.start!).slice(0, 10) + 'T00:00:00Z'); return { left: `${((a - low) * 100) / span}%`, width: `${Math.max(((b - a) * 100) / span, 1.5)}%` } }
  const plan = preview && 'plan' in preview ? preview.plan : null, move = preview && 'move' in preview ? preview.move : null
  return <Shell viewer={viewer} current="/app/projects" title={`${view.project.name}: timeline`} chip={view.criticalPath.length ? 'CRITICAL PATH' : 'NO CHAIN'} facts={[`${view.tasks.length} tasks`, `${view.dependencies.length} dependency links`, view.baseline ? `Against baseline ${view.baseline.name}` : 'No baseline chosen']}
    crumbs={[{ label: 'Projects', href: '/app/projects' }, { label: view.project.name, href: `/app/projects/${view.project.id}` }, { label: 'Timeline', href: here, current: true }]}>
    <Card title="Schedule">
      {dated.length === 0 ? <p className="muted">No dated tasks yet.</p> : <ul className="rows timeline">{view.tasks.map(t => <li key={t.id}><span className="grow"><a href={t.link}>{t.title}</a>{!t.inProject && <> <span className="tagline">Other project</span></>}<br /><small>{t.owner} · {day(t.start)} to {day(t.due)}{t.slack !== null ? ` · slack ${t.slack} working day${Math.abs(t.slack) === 1 ? '' : 's'}` : ''}{t.baseline ? ` · baseline due ${day(t.baseline.due)}${t.baseline.varianceDays === null ? '' : ` (${t.baseline.varianceDays > 0 ? '+' : ''}${t.baseline.varianceDays} working days)`}` : ''}</small>
        {(t.start || t.due) && <span className="track" aria-hidden="true"><span className="fill timeline-bar" style={{ ...place(t), marginLeft: place(t).left, display: 'block' }} /></span>}</span>
        {t.critical && <span className="tagline warn">Critical path</span>}{t.slack !== null && t.slack < 0 && <span className="tagline warn">Negative slack</span>}{t.kind === 'milestone' && <span className="tagline">Milestone</span>}</li>)}</ul>}
    </Card>
    {view.pending.length > 0 && <Card title="Waiting for approval">
      <ul className="rows">{view.pending.map(p => <li key={p.id}><span className="grow"><strong>{p.shifts.length} date move{p.shifts.length === 1 ? '' : 's'}</strong> proposed {p.initiatorKind === 'agent' ? 'by an agent' : 'by a person'}<br /><small>{p.shifts.map(s => `${s.title}: ${day(s.from.due)} to ${day(s.to.due)}`).join(' · ')}</small></span>
        {p.canApprove && <Form action={`/api/v1/schedule/sets/${p.id}/approve`} next={here} label="Approve change set"><input type="hidden" name="projectId" value={view.project.id} /><input type="hidden" name="revision" value={p.revision} /><Submit>Approve this exact set</Submit></Form>}
        <Form action={`/api/v1/schedule/sets/${p.id}/reject`} next={here} label="Reject change set"><input type="hidden" name="projectId" value={view.project.id} /><Submit quiet>Reject</Submit></Form></li>)}</ul>
    </Card>}
    {view.project.canEdit && <Card title="Move a task">
      <form method="get" action={here} className="stack" aria-label="Preview a date change">
        <Pick label="Task to move" name="taskId" value={input.taskId} options={view.tasks.filter(t => t.inProject).map(t => ({ value: t.id, label: t.title }))} />
        <div className="inline"><Field label="New start" name="start" type="date" value={input.start ?? ''} /><Field label="New due" name="due" type="date" value={input.due ?? ''} /></div>
        <button type="submit" className="button quiet">Preview knock-on changes</button>
      </form>
      {preview && 'error' in preview && <p role="alert" className="notice">{errors[preview.error] ?? 'That change cannot be previewed.'}</p>}
      {plan && <><h3>Knock-on preview</h3>
        {plan.shifts.length === 0 ? <p className="muted">Nothing changes.</p> : <ul className="rows">{plan.shifts.map(s => <li key={s.id}><span className="grow"><a href={s.link}>{s.title}</a><br /><small>{day(s.from.start)} – {day(s.from.due)} to {day(s.to.start)} – {day(s.to.due)}{s.reason ? ` · because ${s.reason.predecessorTitle ?? 'earlier work'} (${typeLabel(s.reason.type)}${s.reason.lag ? `, ${s.reason.lag > 0 ? 'lag' : 'lead'} ${Math.abs(s.reason.lag)}` : ''})` : ' · the change you asked for'}{s.crossed.length ? ` · skips ${s.crossed.map(h => h.name).join(', ')}` : ''}{s.dst ? ' · crosses a daylight-saving change, local time kept' : ''}{s.completed ? ' · already complete, cannot move' : ''}</small></span></li>)}</ul>}
        {plan.blocked && <p role="alert" className="notice">A completed task would have to move, so this set cannot be applied.</p>}
        {plan.waits && <p role="status" className="notice">Some affected work is outside your access. Applying sends the whole set to an approver and changes nothing until then.</p>}
        {!plan.blocked && plan.shifts.length > 0 && <Form action="/api/v1/schedule/apply" next={here} label="Apply change set"><input type="hidden" name="projectId" value={view.project.id} /><input type="hidden" name="taskId" value={move!.taskId} />{move!.start && <input type="hidden" name="start" value={move!.start} />}{move!.due && <input type="hidden" name="due" value={move!.due} />}<input type="hidden" name="revision" value={plan.stamp} />
          {plan.waits && <Pick label="Approver" name="approverId" blank="Any person who can edit all of it" options={people} />}<Submit>{plan.waits ? 'Send for approval' : 'Apply this change set'}</Submit></Form>}</>}
    </Card>}
    <Card title="Dependencies">
      {view.dependencies.length === 0 ? <p className="muted">No dependency links yet.</p> : <ul className="rows">{view.dependencies.map(d => <li key={d.id}><span className="grow">{titles.get(d.predecessor) ?? 'Task'} → {titles.get(d.successor) ?? 'Task'}<br /><small>{typeLabel(d.type)}{d.lag ? `, ${d.lag > 0 ? 'lag' : 'lead'} ${Math.abs(d.lag)} working day${Math.abs(d.lag) === 1 ? '' : 's'}` : ''}{d.crossProject ? ' · across projects' : ''}</small></span></li>)}</ul>}
      {view.project.canEdit && <Form action="/api/v1/dependencies" next={here} label="Link tasks"><input type="hidden" name="projectId" value={view.project.id} /><Pick label="Predecessor" name="predecessor" options={view.tasks.map(t => ({ value: t.id, label: t.title }))} /><Pick label="Dependant" name="successor" options={view.tasks.filter(t => t.inProject).map(t => ({ value: t.id, label: t.title }))} /><Pick label="Link type" name="type" options={['fs', 'ss', 'ff', 'sf'].map(value => ({ value, label: typeLabel(value) }))} /><Field label="Lag in working days (negative for a lead)" name="lag" type="number" value="0" step="1" /><Submit>Link tasks</Submit></Form>}
    </Card>
    <Card title="Baselines">
      <form method="get" action={here} className="inline" aria-label="Choose a baseline"><Pick label="Compare with baseline" name="baseline" blank="No baseline" value={view.baseline?.id ?? ''} options={view.baselines.map(b => ({ value: b.id, label: `${b.name} · ${when(b.createdAt)}` }))} /><button type="submit" className="button quiet">Show variance</button></form>
      {view.project.canBaseline && <Form action={`/api/v1/projects/${view.project.id}/baselines`} next={here} label="Save baseline"><Field label="Baseline name" name="name" required /><Submit>Save current dates as a baseline</Submit></Form>}
      <p className="muted">A baseline is a saved copy of the dates. It never changes when the schedule does.</p>
    </Card>
    {view.recent.length > 0 && <Card title="Recent date changes"><ul className="rows">{view.recent.map(r => <li key={r.id}><span className="grow">{r.tasks} date{r.tasks === 1 ? '' : 's'} moved by {r.by} · {when(r.at)}</span>{r.canUndo && <Form action={`/api/v1/schedule/sets/${r.id}/undo`} next={here} label="Undo date change"><input type="hidden" name="projectId" value={view.project.id} /><Submit quiet>Undo this change set</Submit></Form>}</li>)}</ul></Card>}
  </Shell>
}
