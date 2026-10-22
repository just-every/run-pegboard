import type { Viewer } from '../../../ui/viewer'
import type { previewRecurrence, recurrenceView, rereviewRecurrence } from '../../recurrence/recurrence'
import { Shell, Card, Field, Form, Pick, Submit, levelLabel } from '../shell'
type Preview=Awaited<ReturnType<typeof previewRecurrence>>
type View=Awaited<ReturnType<typeof recurrenceView>>
type Review=Awaited<ReturnType<typeof rereviewRecurrence>>
const hidden=(input:Record<string,any>)=>Object.entries(input).flatMap(([key,value])=>Array.isArray(value)?value.map(v=><input key={key+v} type="hidden" name={key+'[]'} value={v}/>):<input key={key} type="hidden" name={key} value={String(value)}/>)
export function RecurrencesPage({viewer,items,view,preview,input,review}:{viewer:Viewer;items:View[];view:View|null;preview:Preview|null;input:Record<string,any>;review:Review|null}) {
  const audience=preview?.audience??review?.audience??view?.audience
  const warnings=preview?.unreachableAssignees??review?.unreachableAssignees??[]
  const choices=preview?.choices??review?.choices??[]
  const next=view?`/app/recurrences/${view.schedule.id}`:'/app/recurrences'
  return <Shell viewer={viewer} current="/app/recurrences" title={view?view.title:'Recurring work'} facts={view?[`Accountable owner: ${view.owner}`,view.schedule.active?'Active':'Stopped',view.schedule.held?'Held for review':`Next: ${view.schedule.next_date} · ${view.plan.timezone}`]:['Reviewed audiences', 'Fresh work on a pinned schedule']}>
    {!view&&<Card title="Preview recurring work"><form method="get" action="/app/recurrences" className="stack" aria-label="Preview recurring work">
      <Pick label="Source type" name="sourceType" value={input.sourceType} options={[{value:'project',label:'Project'},{value:'task',label:'Task'}]}/><Field label="Source ID" name="sourceId" value={input.sourceId} required/>
      <Pick label="Schedule" name="mode" value={input.mode} options={[{value:'calendar',label:'Calendar'},{value:'completion',label:'After completion'}]}/>
      <Pick label="Repeat every" name="unit" value={input.unit??'month'} options={['day','week','month'].map(value=>({value,label:value}))}/><Field label="Interval" name="interval" type="number" value={input.interval??1}/>
      <Field label="First date" name="start" type="date" value={input.start} required/><Field label="Timezone" name="timezone" value={input.timezone??'America/New_York'}/><Field label="Occurrences" name="count" type="number" value={input.count??12}/>
      <Field label="End date (optional)" name="end" type="date" value={input.end}/><Field label="Skip dates (comma separated)" name="exceptions" value={input.exceptions}/>
      {choices.map(c=><label className="checkbox" key={c.id}><input type="checkbox" name="grantIds[]" value={c.id} defaultChecked={input.grantIds?.includes(c.id)}/>{c.name} · {levelLabel(c.level)}</label>)}<Submit>Preview occurrences</Submit>
    </form></Card>}
    {view&&<Card title="Schedule accountability"><p>Accountable owner: {view.owner}</p><p role="status">{view.schedule.held?`Held for re-review: ${view.schedule.last_error}`:view.schedule.active?'Ready for the next scheduled occurrence.':'Stopped.'}</p>
      {view.schedule.active&&<><Form action={`/api/v1/recurrences/${view.schedule.id}/stop`} next={next}><Submit quiet>Stop schedule</Submit></Form>{view.canRun&&<Form action={`/api/v1/recurrences/${view.schedule.id}/run`} next={next}><Submit>Run due occurrence</Submit></Form>}</>}
      {view.canReview&&<form method="get" action={next} className="stack" aria-label="Review standing audience"><input type="hidden" name="review" value="1"/>{(review?.choices??view.audience?.labels??[]).map(c=><label key={c.id} className="checkbox"><input type="checkbox" name="grantIds[]" value={c.id} defaultChecked={true}/>{c.name} · {levelLabel(c.level)}</label>)}<Submit quiet>Review current audience</Submit></form>}
    </Card>}
    {audience&&<Card title="Standing occurrence audience"><p>{audience.project?.visibility==='team'?`Source team · ${levelLabel(audience.project.team_level)}`:audience.project?.visibility==='workspace'?`Active internal workspace members · ${levelLabel(audience.project.workspace_level)}`:'Private to the activator, plus chosen grants.'}</p><ul className="rows">{audience.labels.map(g=><li key={g.id}>{g.name} · {levelLabel(g.level)}</li>)}</ul><p>Guests, approve-only shares and external links are excluded. They need a fresh reviewed share on each occurrence. Assignment never grants access.</p>
      {warnings.length>0&&<><h3>Assignees who cannot open their work</h3><ul className="rows">{warnings.map(w=><li key={w.taskId}>{w.name} · {w.title}</li>)}</ul></>}
      {preview&&<><p>{preview.occurrences.join(' · ')} · {preview.config.timezone}</p><Form action="/api/v1/recurrences" next="/app/recurrences" label="Activate reviewed recurrence">{hidden(input)}<input type="hidden" name="revision" value={preview.token}/><Submit>Activate reviewed schedule</Submit></Form></>}
      {review&&view&&<Form action={`/api/v1/recurrences/${view.schedule.id}/audience`} next={next} label="Confirm standing audience">{hidden({grantIds:input.grantIds??[]})}<input type="hidden" name="revision" value={review.token}/><Submit>Confirm reviewed audience</Submit></Form>}
    </Card>}
    {view&&<Card title="Occurrences"><ul className="rows">{view.occurrences.map(o=><li key={o.local_date}><a href={`/app/${view.audience?.project?'projects':'tasks'}/${o.object_id}`}>{o.local_date}</a>{'unreachableAssignees' in o&&o.unreachableAssignees?.length>0&&<><p>Assignees who cannot open their work:</p><ul>{o.unreachableAssignees.map((w:any)=><li key={w.taskId}>{w.name} · {w.title}</li>)}</ul></>}</li>)}</ul></Card>}
    {!view&&<Card title="Schedules you oversee"><ul className="rows">{items.map(i=><li key={i.schedule.id}><a href={`/app/recurrences/${i.schedule.id}`}>{i.title}</a><p>{i.owner} · {i.schedule.held?`Held: ${i.schedule.last_error}`:i.schedule.active?'Active':'Stopped'}</p></li>)}</ul></Card>}
  </Shell>
}
