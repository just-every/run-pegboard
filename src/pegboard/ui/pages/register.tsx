import type { registerView } from '../../register/records'
import { kinds } from '../../register/records'
import type { Viewer } from '../../../ui/viewer'
import { Area, Card, Field, Form, Pick, Shell, Submit, when } from '../shell'
type View=Awaited<ReturnType<typeof registerView>>
type Option={value:string;label:string}
export function RegisterPage({viewer,view,people,tasks}:{viewer:Viewer;view:View;people:Option[];tasks:Option[]}){
 const here=`/app/projects/${view.project.id}/register`
 return <Shell viewer={viewer} current="/app/projects" title={`${view.project.name} · Delivery register`} facts={['Risks, blockers, assumptions and human decisions']}>
 <Card title="Project"><a href={`/app/projects/${view.project.id}`}>Back to project</a></Card>
 {view.canEdit&&<Card title="Raise a delivery record"><Form action={`/api/v1/projects/${view.project.id}/register`} next={here} label="Raise delivery record">
 <Pick label="Record kind" name="kind" options={kinds.map(value=>({value,label:value[0].toUpperCase()+value.slice(1)}))}/><Field label="Title" name="title" required/>
 <Pick label="Accountable owner" name="ownerId" options={people}/><Pick label="Human approver (project administrator)" name="approverId" options={people} value={view.project.ownerId}/>
 <Area label="Impact" name="impact"/><Area label="Next action and mitigation" name="nextAction"/><Field label="Review date" name="reviewDate" type="date" required/>
 <Pick label="Linked task or milestone" name="taskId" options={tasks} blank="No linked work"/><Pick label="Related risk or alternative" name="parentId" options={view.records.map(r=>({value:r.id,label:r.title}))} blank="No related record"/>
 <Field label="Vector issue link" name="vectorUrl" type="url"/><Area label="Proposed scope (change requests)" name="scope"/><Field label="Proposed task due date (change requests)" name="due" type="date"/><Submit>Raise record</Submit>
 </Form></Card>}
 {view.records.map(r=><Card title={r.title} id={r.id} key={r.id}>
 <p>{r.kind} · {r.status} · Owner {r.owner} · Review {r.review_date}</p><p><strong>Impact:</strong> {r.impact}</p><p><strong>Next action:</strong> {r.next_action}</p>
 {r.task&&<p>Linked work: <a href={`/app/tasks/${r.task.id}`}>{r.task.title}</a></p>}{r.parent_id&&<p><a href={`#${r.parent_id}`}>Related risk or alternative</a></p>}{r.vector_url&&<p><a href={r.vector_url} rel="noreferrer">Open Vector issue</a></p>}
 {r.kind==='change'&&<><h3>Exact proposed change</h3><p>{r.proposal.scope||'Scope unchanged'}{r.proposal.due&&` · Due ${r.proposal.due}`}</p><h3>Original baseline</h3><p>{r.baseline.scope||'No original scope description'}</p><ul className="rows">{r.baseline.tasks.map((t:any)=><li key={t.id}><a href={`/app/tasks/${t.id}`}>Affected task</a><span>{t.start||'No start'} · {t.due||'No due date'} → {t.to.start||'No start'} · {t.to.due||'No due date'}</span></li>)}</ul></>}
 <p>Approver: {r.approver}</p>{r.decider&&<p>Decision by {r.decider} · {when(r.decided_at)} · {r.reason}</p>}
 {r.canDecide&&<Form action={`/api/v1/projects/${view.project.id}/register/${r.id}/decision`} next={here} label={`Decide ${r.title}`}><input type="hidden" name="revision" value={r.token}/><Pick label="Decision" name="action" options={[{value:'accept',label:'Accept'},{value:'reject',label:'Reject'}]}/><Area label="Decision reason" name="reason"/><Submit>Record human decision</Submit></Form>}
 </Card>)}
 </Shell>
}
