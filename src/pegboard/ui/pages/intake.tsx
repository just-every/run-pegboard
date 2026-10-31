import { AppBar } from '../../../ui/bar'
import { Heading } from '../../../ui/heading'
import type { Viewer } from '../../../ui/viewer'
import type { safeForm, reviewForm, projectForms } from '../../intake/forms'
import type { triageQueue } from '../../intake/triage'
import { Area, Card, Check, Field, Form, Pick, Shell, Submit, when } from '../shell'
type Safe=ReturnType<typeof safeForm>
export function IntakeForm({form,action}:{form:Safe;action:string}) {
 return <Card title={form.name}><p>Submit a text request. Attachments are not supported here. Submitting grants no access to workspace work.</p>
  <form className="stack intake-form" method="post" action={action} aria-label="Submit request">
   <input type="hidden" name="version" value={form.version}/><input type="hidden" name="requestKey" value={crypto.randomUUID()}/>
   {form.fields.map(f=><label className="field" key={f.id} data-branch-field={f.when?.field} data-branch-value={f.when?.equals} hidden={!!f.when}>{f.label}{f.required?' (required)':''}{f.choices?<select className="select" name={'answer.'+f.id} aria-label={f.label} required={f.required} disabled={!!f.when}><option value="">Choose one</option>{f.choices.map(c=><option key={c}>{c}</option>)}</select>:<input className="input" name={'answer.'+f.id} aria-label={f.label} required={f.required} disabled={!!f.when} maxLength={4000}/>}</label>)}
   <noscript><p>This branching form needs JavaScript. No submission is sent until its required fields can be shown.</p></noscript><Submit>Submit request</Submit>
  </form></Card>
}
export function IntakeScreen({viewer,form,receipt}:{viewer?:Viewer;form:Safe;receipt?:{receipt:string;deadline:number;acknowledgment:string}|null}) {
 const body=<>{receipt&&<Card title={receipt.acknowledgment}><p role="status">Receipt <code>{receipt.receipt}</code></p><p>Triage deadline: {when(receipt.deadline)}. The triage clock counts published working hours and US federal holidays; it has no manual pause.</p></Card>}<IntakeForm form={form} action={viewer?`/api/v1/intake/forms/${form.id}/submit`:''}/></>
 return viewer?<Shell viewer={viewer} current="/app/projects" title="Request intake">{body}</Shell>:<><AppBar/><main className="board" id="main"><Heading title="Request intake" facts={[]}/><section className="page">{body}</section></main></>
}
export function PublicIntakeScreen({form,action,receipt}:{form:Safe;action:string;receipt?:{receipt:string;deadline:number;acknowledgment:string}}) {
 return <><AppBar/><main className="board" id="main"><Heading title="Request intake" facts={[]}/><section className="page">{receipt?<Card title={receipt.acknowledgment}><p role="status">Receipt <code>{receipt.receipt}</code></p><p>Triage deadline: {when(receipt.deadline)}</p><p>This receipt grants no workspace access. No email has been sent.</p></Card>:<IntakeForm form={form} action={action}/>}</section></main></>
}
export function PublishedIntakeScreen({capability,back}:{capability:string;back:string}) {
 const link='/intake/'+capability
 return <><AppBar/><main className="board" id="main"><Heading title="Request intake" facts={[]}/><section className="page"><Card title="Public form published"><p>Copy this submission-only link now. It is not shown again.</p><p><a href={link}>Open public form</a></p><label className="field">Public form link<input className="input" aria-label="Public form link" readOnly value={link}/></label><p><a href={back}>Return to intake settings</a></p></Card></section></main></>
}
export function IntakeSettings({viewer,project,list,review,people,capability}:{viewer:Viewer;project:{id:string;name:string};list:Awaited<ReturnType<typeof projectForms>>;review:Awaited<ReturnType<typeof reviewForm>>|null;people:{value:string;label:string}[];capability?:string|null}) {
 const here=`/app/projects/${project.id}/settings/intake`
 return <Shell viewer={viewer} current="/app/settings" title="Intake settings" crumbs={[{label:project.name,href:`/app/projects/${project.id}`},{label:'Settings',href:`/app/projects/${project.id}/settings`},{label:'Intake',href:here,current:true}]}>
  {capability&&<Card title="Public form link"><p>Copy this capability link now. It permits only submission to this form and is not shown again.</p><a href={'/intake/'+capability}>Open public form</a><input className="input" aria-label="Public form link" readOnly value={'/intake/'+capability}/></Card>}
  <Card title="New text form"><Form action={`/api/v1/projects/${project.id}/intake/forms`} next={here} label="Create intake form">
   <Field label="Form name" name="name" required/><Field label="Request title prompt" name="titleLabel" value="Request title" required/>
   <Field label="Request details prompt" name="detailLabel" value="Request details" required/>
   <Field label="Branch question" name="branchLabel" value="Request type" required/><Field label="Choices, separated by commas" name="choices" value="Design,Other" required/>
   <Field label="Show required details for this choice" name="branchValue" value="Design" required/>
   <Pick label="Fixed task owner" name="ownerId" options={people}/><Pick label="Fixed task priority" name="priority" options={['low','normal','high','urgent'].map(value=>({value,label:value}))} value="normal"/>
   <Field label="Triage deadline in business hours" name="hours" type="number" value={8} required/><Submit>Create draft</Submit>
  </Form></Card>
  {review&&<Card title="Review exact publication"><p>Form: {review.name} · version {review.version}. Destination: {review.project.name}.</p><p>Title maps from {review.definition.fields.find(f=>f.id===review.definition.mapping.title)?.label}. Description maps from {review.definition.mapping.description.map(id=>review.definition.fields.find(f=>f.id===id)?.label).join(', ')}. Owner: {people.find(p=>p.value===review.definition.mapping.ownerId)?.label??'Unassigned'}. Priority: {review.definition.mapping.priority}.</p><p>Triage: {review.definition.hours} working hours in {review.calendar.zone}, excluding US federal holidays. No manual pause. Overdue requests require project administrator attention.</p><ul>{review.definition.fields.map(f=><li key={f.id}>{f.label} · {f.required?'Required':'Optional'}{f.when?` · shown when ${f.when.field} is ${f.when.equals}`:''}</li>)}</ul><p>Public respondents see only the form prompts and an acknowledgment. They receive no membership, task details or member identity. Publishing is restricted to a current workspace owner or administrator.</p>
   {review.custodyBlocked?<p role="status">Publication remains inactive after erasure. A valid replacement draft needs an explicitly selected owner and its own publication review.</p>:<Form action={`/api/v1/intake/forms/${review.id}/publish`} next={here} label="Publish intake form"><input type="hidden" name="version" value={review.version}/><input type="hidden" name="review" value={review.review}/><Pick label="Audience" name="audience" options={[{value:'internal',label:'Internal members with edit access'},{value:'public',label:'Anyone with this submission link'}]}/><Check name="consent" label="I approve these exact prompts, task mappings and audience"/><Submit>Publish reviewed form</Submit></Form>}
  </Card>}
  <Card title="Forms"><ul className="rows">{list.map(f=><li key={f.id}><span className="grow">{f.name} · version {f.version} · {f.published_version===f.version&&!f.revoked_at?'Published':'Draft or revoked'}<br/><a href={here+'?review='+f.id}>Review publication</a> · <a href={'/app/intake/'+f.id}>Open internal form</a></span><Form action={`/api/v1/intake/forms/${f.id}/revoke`} next={here} label={'Revoke '+f.name}><Submit quiet>Revoke publication</Submit></Form></li>)}</ul><a href={`/app/projects/${project.id}/intake`}>Open triage queue</a></Card>
 </Shell>
}
export function IntakeQueue({viewer,view}:{viewer:Viewer;view:Awaited<ReturnType<typeof triageQueue>>}) {
 const here=`/app/projects/${view.project.id}/intake`
 return <Shell viewer={viewer} current="/app/projects" title="Request triage" crumbs={[{label:view.project.name,href:`/app/projects/${view.project.id}`},{label:'Intake',href:here,current:true}]}><Card title="Requests">{view.items.length?<ul className="rows">{view.items.map(item=><li key={item.id} data-submission={item.id}><span className="grow"><a href={'/app/tasks/'+item.taskId}>{item.title}</a><br/>{item.owner} · {item.priority} · {item.state}<br/>Triage deadline: {when(item.deadline)}{item.escalation&&<p role="status">Overdue · {item.escalation}</p>}</span>{item.state!=='triaged'&&<Form action={`/api/v1/intake/submissions/${item.id}/triage`} next={here} label={'Triage '+item.title}><Submit quiet>Mark triaged</Submit></Form>}</li>)}</ul>:<p>No requests.</p>}<p>The deadline counts the working calendar recorded when the request arrived. The clock has no manual pause. Escalation is visible here; no mail delivery is claimed.</p></Card></Shell>
}
