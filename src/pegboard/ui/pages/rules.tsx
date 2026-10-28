import type {Viewer} from '../../../ui/viewer'
import type {rulesView,rulePreview,Definition} from '../../rules/definitions'
import {Area,Card,Check,Field,Form,Pick,Shell,Submit,when} from '../shell'
type View=Awaited<ReturnType<typeof rulesView>>
type Option={value:string;label:string}
function Mapping({config,people,sections,projects,tags,dateFields}:{config?:Definition;people:Option[];sections:Option[];projects:Option[];tags:Option[];dateFields:Option[]}){
 const action=(kind:string)=>config?.actions.find(a=>a.kind===kind)?.value
 return <>
 <Pick label="Trigger" name="trigger" value={config?.trigger??'status'} options={[{value:'form',label:'Project request form submitted'},{value:'status',label:'Task status changes'},{value:'section',label:'Task moves into section'}]}/>
 <Pick label="Matching status" name="status" value={config?.status??'doing'} options={['todo','doing','done'].map(value=>({value,label:value}))}/>
 <Pick label="Matching section" name="sectionId" value={config?.sectionId} options={sections} blank="Choose for section trigger"/>
 <Pick label="Assign to" name="ownerId" value={config?.ownerId} options={people} blank="Keep current assignee"/>
 <Pick label="Set priority" name="priority" value={config?.priority??'normal'} options={['low','normal','high','urgent'].map(value=>({value,label:value}))}/>
 <Pick label="Due date source" name="source" value={config?.source??'task_due'} options={[{value:'task_due',label:'Triggering task due date'},{value:'task_start',label:'Triggering task start date'},{value:'fixed',label:'Specific date'},{value:'custom',label:'Custom event date field'}]}/>
 <Pick label="Custom event date field" name="sourceField" value={config?.sourceField} options={dateFields} blank="Choose for custom source"/>
 <Field label="Specific date" name="fixedDate" type="date" value={config?.fixedDate}/>
 <Field label="Date offset (negative moves earlier)" name="offset" type="number" step="1" value={config?.offset??0} required/>
 <Pick label="Offset calendar" name="unit" value={config?.unit??'days'} options={[{value:'days',label:'Calendar days'},{value:'weeks',label:'Calendar weeks'},{value:'months',label:'Calendar months · clamp end of month'},{value:'business_days',label:'Business days · US federal holidays'}]}/>
 <details><summary>Additional work actions</summary>
 <Check label="Complete an ordinary task (never an approval)" name="complete" value="yes" checked={config?.actions.some(a=>a.kind==='complete')}/>
 <Area label="Add comment" name="action:comment" value={action('comment')}/>
 <Pick label="Add permitted collaborator" name="action:collaborator" value={action('collaborator')} options={people} blank="No collaborator action"/>
 <Pick label="Add to project with the same reviewed audience" name="action:project" value={action('project')} options={projects} blank="No additional project"/>
 <Field label="Create subtask named" name="action:subtask" value={action('subtask')}/>
 <Pick label="Add project tag" name="action:tag" value={action('tag')} options={tags} blank="No tag action"/>
 </details>
 </>
}
export function RulesPage({viewer,view,people,sections,projects,tags,dateFields,preview}:{viewer:Viewer;view:View;people:Option[];sections:Option[];projects:Option[];tags:Option[];dateFields:Option[];preview:Awaited<ReturnType<typeof rulePreview>>|null}){
 const here=`/app/projects/${view.project.id}/rules`,names=new Map(people.map(p=>[p.value,p.label]))
 return <Shell viewer={viewer} current="/app/projects" title="Work rules" facts={[view.project.name,'Project Admin activation']}>
 <Card title="Project settings"><a href={`/app/projects/${view.project.id}/settings`}>Back to project settings</a><p>Rules act only in this project under the activating Admin’s current authority. Changed definitions need another preview and activation. No rule sends an external message or signs an approval.</p></Card>
 <Card title="Create a conditional rule"><Form action={`/api/v1/projects/${view.project.id}/rules`} next={here} label="Create work rule"><Field label="Rule name" name="name" required/><Mapping people={people} sections={sections} projects={projects} tags={tags} dateFields={dateFields}/><Submit>Save rule draft</Submit></Form></Card>
 {view.rules.map(rule=><Card key={rule.id} title={rule.name}><p>Version {rule.version} · {rule.enabled?'Activated':'Needs activation'} · {rule.config.trigger==='form'?'Project request form submitted':rule.config.trigger==='status'?`Status becomes ${rule.config.status}`:`Move into ${sections.find(s=>s.value===rule.config.sectionId)?.label??'unavailable section'}`}</p>
 <p>Assign {rule.config.ownerId?names.get(rule.config.ownerId)??'unavailable person':'current assignee'} · {rule.config.offset} {rule.config.unit.replaceAll('_',' ')} from {rule.config.source.replaceAll('_',' ')}.</p>
 <form method="get" action={here} className="stack" aria-label={`Preview ${rule.name}`}><input type="hidden" name="review" value={rule.id}/><Field label="Example source date" name="sampleDate" type="date"/><Submit quiet>Preview activation</Submit></form>
 {rule.enabled===1&&<Form action={`/api/v1/rules/${rule.id}/deactivate`} next={here} label={`Deactivate ${rule.name}`}><Submit quiet>Deactivate rule</Submit></Form>}
 <details><summary>Edit rule definition</summary><Form action={`/api/v1/rules/${rule.id}`} next={here} label={`Edit ${rule.name}`}><input type="hidden" name="version" value={rule.version}/><Field label="Rule name" name="name" value={rule.name} required/><Mapping config={rule.config} people={people} sections={sections} projects={projects} tags={tags} dateFields={dateFields}/><Submit quiet>Save new version</Submit></Form></details>
 </Card>)}
 {preview&&<Card title="Review exact activation"><p>{preview.policy}</p><p>{preview.rule.name} · version {preview.rule.version} · project {view.project.name} · activating Admin {viewer.displayName}</p><p>Date source: {preview.config.source==='custom'?dateFields.find(f=>f.value===preview.config.sourceField)?.label??'Unavailable field':preview.config.source==='fixed'?preview.config.fixedDate:preview.config.source.replaceAll('_',' ')} · offset {preview.config.offset} {preview.config.unit.replaceAll('_',' ')}. Example computed due date: {preview.computedDate??'Missing date: no-op'}. Assignee: {names.get(preview.config.ownerId)??'Keep current assignee'}. Priority: {preview.config.priority}.</p><ul>{preview.config.actions.map(a=><li key={a.kind}>{a.kind}: {a.kind==='collaborator'?names.get(a.value!)??'Unavailable person':a.kind==='project'?projects.find(p=>p.value===a.value)?.label??'Unavailable project':a.kind==='tag'?tags.find(t=>t.value===a.value)?.label??'Unavailable tag':a.value??'Ordinary task only'}</li>)}</ul><Form action={`/api/v1/rules/${preview.rule.id}/activate`} next={here} label="Activate work rule"><input type="hidden" name="token" value={preview.token}/><Submit>Activate reviewed version</Submit></Form></Card>}
 <Card title="Rule runs"><Form action={`/api/v1/projects/${view.project.id}/rules/process`} next={here} label="Resume work rules"><Submit quiet>Resume queued runs</Submit></Form><ul className="rows">{view.runs.map(run=><li key={run.id}><span className="grow"><a href={`/app/tasks/${run.task_id}`}>Triggering task</a> · version {run.version} · {run.status}<br/>{run.outcome?.replaceAll('_',' ')} · activated by {run.activated_by?names.get(run.activated_by)??'Former Admin':'Awaiting activation'}<br/>Source event {run.source.customDate??'missing'} · start {run.source.startDate??'missing'} · due {run.source.dueDate??'missing'} · revision {run.source.taskVersion}<br/>{run.computed&&<>Computed due {run.computed.dueDate} · assignee {run.computed.ownerId?names.get(run.computed.ownerId)??'Unavailable':'unchanged'} · priority {run.computed.priority}<br/></>}{run.computed?.createdWork?.map((child:{id:string;dueDate:string;ownerId:string})=><span key={child.id}><a href={`/app/tasks/${child.id}`}>Created subtask</a> · due {child.dueDate} · {names.get(child.ownerId)??'Unavailable assignee'}<br/></span>)}Activation {run.activation_id??'none'} · {when(run.created_at)}{run.operation_id&&<> · <a href={`/app/recovery/bulk?operationId=${run.operation_id}`}>Review scoped undo</a></>}</span></li>)}</ul>{!view.runs.length&&<p>No matching triggers yet.</p>}</Card>
 </Shell>
}
