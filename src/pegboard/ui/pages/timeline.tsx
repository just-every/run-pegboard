import {ScheduleEditor} from '../schedule-editor'
import type { scheduleView } from '../../schedule/timeline'
import type { Viewer } from '../../../ui/viewer'
import { Card, Field, Form, Pick, Shell, Submit, when } from '../shell'

type View = Awaited<ReturnType<typeof scheduleView>>
type Preview = import('../schedule-editor').SchedulePreview
const typeLabel = (type: string) => ({ fs: 'finish to start', ss: 'start to start', ff: 'finish to finish', sf: 'start to finish' } as Record<string, string>)[type] ?? type
const day = (value: string | null) => value ? value.slice(0, 10) : '—'

export function TimelinePage({ viewer, view, preview, people, input }: { viewer: Viewer; view: View; preview: Preview; people: { value: string; label: string }[]; input: Record<string, string> }) {
  const here = `/app/projects/${view.project.id}/timeline`, titles = new Map(view.tasks.map(t => [t.id, t.title]))
  const dated = view.tasks.filter(t => t.start || t.due), stamps = dated.flatMap(t => [t.start, t.due]).filter((d): d is string => !!d).map(d => Date.parse(d.slice(0, 10) + 'T00:00:00Z')), low = Math.min(...stamps), span = Math.max(Math.max(...stamps) - low, 86400000)
  const place = (t: View['tasks'][number]) => { const a = Date.parse((t.start ?? t.due!).slice(0, 10) + 'T00:00:00Z'), b = Date.parse((t.due ?? t.start!).slice(0, 10) + 'T00:00:00Z'), left = Math.min(19, Math.round(((a - low) * 20) / span)), width = Math.max(1, Math.min(20 - left, Math.round(((b - a) * 20) / span))); return `fill pct-${width * 5} off-${left * 5}` }
  return <Shell viewer={viewer} current="/app/projects" title={`${view.project.name}: timeline`} chip={view.criticalPath.length ? 'CRITICAL PATH' : 'NO CHAIN'} facts={[`${view.tasks.length} tasks`, `${view.dependencies.length} dependency links`, view.baseline ? `Against baseline ${view.baseline.name}` : 'No baseline chosen']}
    crumbs={[{ label: 'Projects', href: '/app/projects' }, { label: view.project.name, href: `/app/projects/${view.project.id}` }, { label: 'Timeline', href: here, current: true }]}>
    <Card title="Schedule">
      {view.project.canEdit&&<p>Drag dates horizontally and keep holding to inspect the knock-on preview before releasing. With the keyboard, use arrow keys to preview and Enter to confirm; Escape cancels.</p>}
      {dated.length === 0 ? <p className="muted">No dated tasks yet.</p> : <ul className="rows timeline">{view.tasks.map(t => <li key={t.id}><span className="grow"><a href={t.link}>{t.title}</a>{!t.inProject && <> <span className="tagline">Other project</span></>}<br /><small>{t.owner} · {day(t.start)} to {day(t.due)}{t.slack !== null ? ` · slack ${t.slack} working day${Math.abs(t.slack) === 1 ? '' : 's'}` : ''}{t.baseline ? ` · baseline due ${day(t.baseline.due)}${t.baseline.varianceDays === null ? '' : ` (${t.baseline.varianceDays > 0 ? '+' : ''}${t.baseline.varianceDays} working days)`}` : ''}</small>
        {(t.start || t.due) && <span className="track" aria-hidden="true"><span className={place(t)} /></span>}</span>
        {view.project.canEdit&&t.inProject&&(t.start||t.due)&&<button type="button" className="button quiet" data-schedule-drag data-task-id={t.id} data-start={t.start??''} data-due={t.due??''} aria-label={`Drag ${t.title}`}>Drag dates</button>}
        {t.critical && <span className="tagline warn">Critical path</span>}{t.slack !== null && t.slack < 0 && <span className="tagline warn">Negative slack</span>}{t.kind === 'milestone' && <span className="tagline">Milestone</span>}</li>)}</ul>}
    </Card>
    {view.pending.length > 0 && <Card title="Waiting for approval">
      <ul className="rows">{view.pending.map(p => <li key={p.id}><span className="grow"><strong>{p.shifts.length} date move{p.shifts.length === 1 ? '' : 's'}</strong> proposed {p.initiatorKind === 'agent' ? 'by an agent' : 'by a person'}<br /><small>{p.shifts.map(s => `${s.title}: ${day(s.from.due)} to ${day(s.to.due)}`).join(' · ')}</small></span>
        {p.canApprove && <Form action={`/api/v1/schedule/sets/${p.id}/approve`} next={here} label="Approve change set"><input type="hidden" name="projectId" value={view.project.id} /><input type="hidden" name="revision" value={p.revision} /><Submit>Approve this exact set</Submit></Form>}
        <Form action={`/api/v1/schedule/sets/${p.id}/reject`} next={here} label="Reject change set"><input type="hidden" name="projectId" value={view.project.id} /><Submit quiet>Reject</Submit></Form></li>)}</ul>
    </Card>}
    {view.project.canEdit&&<ScheduleEditor here={here} projectId={view.project.id} tasks={view.tasks.filter(t=>t.inProject).map(t=>({value:t.id,label:t.title}))} people={people} input={input} preview={preview}/>}
    <section className="card panel" aria-label="Drag knock-on preview" data-drag-preview hidden><h2>Knock-on preview</h2><p data-drag-status role="status"/><ul className="rows" data-drag-shifts/><p>Keep holding while you review. Release to confirm this exact set. Escape cancels.</p></section>
    <script src="/look/schedule-drag.js" defer/>
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
