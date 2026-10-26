import type {Viewer} from '../../../ui/viewer'
import type {previewTemplateRule,templateRuleView} from '../../templates/rules'
import type {TemplateRuleDefinition} from '../../templates/rule-definition'
import {Card,Check,Field,Form,Pick,Shell,Submit,when} from '../shell'
type View=Awaited<ReturnType<typeof templateRuleView>>
type Preview=Awaited<ReturnType<typeof previewTemplateRule>>
export interface RuleTemplateOption {id:string;name:string;version:number;roles:string[]}
type Person={value:string;label:string}
function MappingFields({definition,people}:{definition:TemplateRuleDefinition;people:Person[]}){
 return <>
 <Field label="Created work name" name="workName" value={definition.name} required/>
 <Pick label="Start date source" name="dateSource" value={definition.date.source} options={[{value:'fixed',label:'Fixed date'},{value:'task_start',label:'New task start date'},{value:'task_due',label:'New task due date'}]}/>
 <Field label="Fixed start date (used for Fixed date only)" name="startDate" type="date" value={definition.date.value}/>
 <Field label="Calendar days added to the source date" name="offsetDays" type="number" step="1" value={definition.date.offsetDays} required/>
 {Object.entries(definition.roles).map(([role,owner])=><Pick key={role} label={`Assign ${role}`} name={`role:${role}`} value={owner??''} options={people} blank="Leave unassigned"/>)}
 <Check label="I explicitly allow roles left unassigned" name="keepUnassigned" value="yes" checked={definition.keepUnassigned}/>
 </>
}
export function TemplateRulesPage({viewer,view,templates,people,preview=null,selectedTemplateId}:{viewer:Viewer;view:View;templates:RuleTemplateOption[];people:Person[];preview?:Preview|null;selectedTemplateId?:string}){
 const here=`/app/projects/${view.project.id}/template-rules`,selected=templates.find(t=>t.id===selectedTemplateId)??templates[0]
 return <Shell viewer={viewer} current="/app/projects" title="Template rules" facts={[view.project.name,'Project Admin review']}>
 <Card title="Project settings"><a href={`/app/projects/${view.project.id}/settings`}>Back to project settings</a><p>When a task is created here, an activated rule immediately creates its pinned template work in this project. Generated work never triggers another template rule. Template rules do not copy members or decisions.</p></Card>
 <Card title="Create a new-task rule">
 <form method="get" action={here} className="stack" aria-label="Choose rule template"><Pick label="Template" name="templateId" value={selected?.id} options={templates.map(t=>({value:t.id,label:t.name}))}/><Submit quiet>Choose template</Submit></form>
 {selected?<Form action={`/api/v1/projects/${view.project.id}/template-rules`} next={here} label="Create template rule">
 <input type="hidden" name="templateId" value={selected.id}/><input type="hidden" name="templateVersion" value={selected.version}/><p>{selected.name} · pinned version {selected.version}</p>
 <Field label="Rule name" name="name" required/>
 <MappingFields definition={{templateId:selected.id,templateVersion:selected.version,name:selected.name,roles:Object.fromEntries(selected.roles.map(r=>[r,null])),keepUnassigned:false,date:{source:'fixed',offsetDays:0}}} people={people}/>
 <p>Save the draft, then preview and activate its exact scope, assignments and date mapping.</p><Submit>Save rule draft</Submit>
 </Form>:<p>No templates are available.</p>}
 </Card>
 {view.rules.map(rule=><Card key={rule.id} title={rule.name}>
 <p>Definition {rule.version} · {rule.enabled?'Activated':'Needs review'} · template version {rule.config.templateVersion}</p>
 <p>Start from {rule.config.date.source==='fixed'?rule.config.date.value:rule.config.date.source==='task_start'?'the new task start date':'the new task due date'}{rule.config.date.offsetDays!==0?` with ${rule.config.date.offsetDays} calendar days added`:''}. Work remains in {view.project.name}.</p>
 <form method="get" action={here} className="stack" aria-label={`Preview ${rule.name}`}><input type="hidden" name="review" value={rule.id}/>{rule.config.date.source!=='fixed'&&<Field label="Example source date for review" name="sampleSourceDate" type="date" required/>}{view.runs.filter(run=>run.rule_id===rule.id&&run.status==='pending').map(run=><Check key={run.id} label={`Review pending trigger from ${when(run.created_at)} under definition ${run.definition_version}`} name="runIds[]" value={run.id}/>)}<Submit quiet>Preview activation</Submit></form>
 {rule.enabled===1&&<Form action={`/api/v1/template-rules/${rule.id}/deactivate`} next={here} label={`Deactivate ${rule.name}`}><input type="hidden" name="projectId" value={view.project.id}/><Submit quiet>Deactivate rule</Submit></Form>}
 <details><summary>Change definition and require a new review</summary><Form action={`/api/v1/template-rules/${rule.id}`} next={here} label={`Edit ${rule.name}`}>
 <input type="hidden" name="projectId" value={view.project.id}/><input type="hidden" name="ruleVersion" value={rule.version}/><input type="hidden" name="templateId" value={rule.config.templateId}/>
 <Field label="Rule name" name="name" value={rule.name} required/><Field label="Pinned template version" name="templateVersion" type="number" step="1" value={rule.config.templateVersion} required/>
 <MappingFields definition={rule.config} people={people}/><Submit quiet>Save a new definition</Submit>
 </Form></details>
 </Card>)}
 {preview&&<Card title={`Review definition ${preview.ruleVersion}`}>
 <p>{preview.policy.trigger}. {preview.policy.scope}. {preview.policy.dates}. {preview.policy.missingDate}. {preview.policy.approval}.</p>
 <p>Example template start: {preview.startDate} · calendar: US federal holidays and weekends excluded from template working-day offsets · timezone: {preview.preview.timezone}. Date-only values have no time shift at daylight saving boundaries.</p>
 <ul className="rows">{preview.preview.tasks.map(task=><li key={task.key}><span className="grow"><strong>{task.title}</strong><br/>{task.owner} · starts {task.startDate} · due {task.dueDate}{task.approvalState?' · requires a new human decision':''}</span></li>)}</ul>
 {preview.preview.capacity.map(row=><p key={row.ownerId??'unassigned'}>{row.owner}: {row.addedHours} added hours. {row.notice}</p>)}
 {preview.selectedRuns.map(run=><section key={run.id}><h3>Pending trigger from definition {run.fromDefinitionVersion}</h3><p><a href={`/app/tasks/${run.taskId}`}>Triggering task</a> · source start {run.source.startDate??'missing'} · source due {run.source.dueDate??'missing'} · revised template start {run.startDate??'missing source date; no work will be created'}</p>{run.preview&&<ul className="rows">{run.preview.tasks.map(task=><li key={task.key}><span className="grow">{task.title} · {task.owner} · starts {task.startDate} · due {task.dueDate}</span></li>)}</ul>}<p>Activating approves this exact saved trigger and the revised mapping. The previous definition remains in its review history.</p></section>)}
 <Form action={`/api/v1/template-rules/${preview.ruleId}/activate`} next={here} label="Activate reviewed template rule"><input type="hidden" name="projectId" value={view.project.id}/><input type="hidden" name="token" value={preview.token}/>{preview.selectedRuns.map(run=><input key={run.id} type="hidden" name="runIds[]" value={run.id}/>)}{preview.sampleSourceDate&&<input type="hidden" name="sampleSourceDate" value={preview.sampleSourceDate}/>}<p>Activating approves this exact deterministic mapping for future matching tasks under your current project Admin authority. Changing the template version or mapping requires another review.</p><Submit>Activate reviewed rule</Submit></Form>
 </Card>}
 <Card title="Template runs"><Form action={`/api/v1/projects/${view.project.id}/template-rules/process`} next={here} label="Resume queued template runs"><Submit quiet>Resume queued runs</Submit></Form>
 <ul className="rows">{view.runs.map(run=><li key={run.id}><span className="grow"><a href={`/app/tasks/${run.task_id}`}>Triggering task</a> · definition {run.definition_version}<br/>{run.status}{run.outcome?` · ${run.outcome.replaceAll('_',' ')}`:''}{run.computed_start_date?` · template start ${run.computed_start_date}`:''}<br/>Template version {run.config.templateVersion} · activated by {people.find(p=>p.value===run.activatedBy)?.label??(run.activatedBy?'Human project Admin':'Awaiting activation')}<br/>Assignments: {Object.entries(run.config.roles).map(([role,id])=>`${role}: ${id?people.find(p=>p.value===id)?.label??'Unavailable member':'Unassigned'}`).join(' · ')}<br/>Source start {run.source.startDate??'missing'} · source due {run.source.dueDate??'missing'}<br/>Source revision {run.source.taskVersion} · {when(run.created_at)}{run.activation_id&&<> · activation <code>{run.activation_id}</code></>}{run.result&&<ul>{run.result.taskIds.map(id=><li key={id}><a href={`/app/tasks/${id}`}>Created task</a></li>)}</ul>}</span></li>)}</ul>
 {!view.runs.length&&<p>No tasks have triggered a template rule.</p>}
 </Card>
 <Card title="Activation history"><ul className="rows">{view.activations.map(a=><li key={a.id}><span className="grow">Definition {a.definition_version} · template version {a.template_version}<br/>Activated by {people.find(p=>p.value===a.activated_by)?.label??'Human project Admin'} · {when(a.activated_at)}</span></li>)}</ul><ul className="rows">{view.events.map(e=><li key={e.id}><span>{e.action.replaceAll('_',' ')}</span><span>{when(e.at)}</span></li>)}</ul></Card>
 </Shell>
}
