import type {Viewer} from '../../../ui/viewer'
import {Shell,Card,Field,Pick,Form,Submit} from '../shell'
import type {DuplicateSource} from '../../duplication/source'
import type {DuplicatePreview} from '../../duplication/preview'
import type {DuplicateResult} from '../../duplication/execution'
import type {previewDuplicateActivation} from '../../duplication/activation'

type Review=Awaited<ReturnType<typeof previewDuplicateActivation>>
const hidden=(values:Record<string,any>)=>Object.entries(values).filter(([key])=>key!=='offset').flatMap(([key,value])=>value===null||value===undefined?[]:Array.isArray(value)?value.map(v=><input key={key+v} type="hidden" name={key+'[]'} value={v}/>):<input key={key} type="hidden" name={key} value={String(value)}/>)
const date=(value:string|null)=>value?new Date(value.length===10?value+'T12:00:00Z':value).toLocaleString('en-US',value.length===10?{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'}:{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'No date'
const checked=(input:Record<string,any>,key:string,id:string,initial=false)=>input[key]===undefined?initial:Array.isArray(input[key])?input[key].includes(id):input[key]===id
export function DuplicatePage({viewer,source=null,preview=null,input={},result=null,review=null}:{viewer:Viewer;source?:DuplicateSource|null;preview?:DuplicatePreview|null;input?:Record<string,any>;result?:DuplicateResult|null;review?:Review|null}){
 const project=result?.project??source?.project
 if(!project)return null
 const path=`/app/projects/${project.id}/duplicate`,resultPath=path+'?result=1'
 return <Shell viewer={viewer} current="/app/projects" title={result?'Project duplicated':'Duplicate project'} crumbs={[{href:`/app/projects/${project.id}`,label:project.name}]} facts={[result?result.project.name:`From ${project.name}`,result?`${result.tasks.length} new work records`:'Choose the work to carry forward']}>
  {source&&!result&&<Card title="Choose what to copy"><form method="get" action={path} className="stack" aria-label="Preview duplicate project">
   <input type="hidden" name="preview" value="1"/>
   <Field label="New project name" name="name" value={input.name??`${source.project.name} copy`} required/>
   <fieldset><legend>Tasks and nested tasks</legend>{source.tasks.map(task=><label key={task.id} className="checkbox"><input type="checkbox" name="taskIds[]" value={task.id} defaultChecked={!input.preview||checked(input,'taskIds',task.id)}/><span>{task.title}{task.parent_id&&<span className="muted"> · Nested under {source.tasks.find(t=>t.id===task.parent_id)?.title}</span>}{task.approval&&<span> · Approval required again</span>}</span></label>)}{!source.tasks.length&&<p>No readable tasks. Project structure can still be copied.</p>}</fieldset>
   <label className="checkbox"><input type="checkbox" name="includeAssignees" value="true" defaultChecked={input.includeAssignees===true||input.includeAssignees==='true'}/>Keep current assignees</label>
   <Pick label="Dates" name="dateMode" value={input.dateMode??'original'} options={[{value:'original',label:'Keep original dates'},{value:'relative',label:'Move dates relative to a new start'}]}/>
   <Field label="New start date for relative dates" name="startDate" type="date" value={input.startDate}/>
   <details><summary>Members to stage for a separate review</summary><p>Copying creates a private project. Selected memberships stay inactive.</p>{source.members.length?source.members.map(member=><label key={member.id} className="checkbox"><input type="checkbox" name="memberIds[]" value={member.id} defaultChecked={checked(input,'memberIds',member.id)}/>{member.name} · {member.level} · {member.role}</label>):<p>No other current source members.</p>}</details>
   <details><summary>Rules to stage for a separate review</summary>{source.rules.length?source.rules.map(rule=><label key={rule.id} className="checkbox"><input type="checkbox" name="ruleIds[]" value={rule.id} defaultChecked={checked(input,'ruleIds',rule.id)}/>{rule.config.name} · Version {rule.version}</label>):<p>No source rules.</p>}</details>
   <Submit>Preview duplicate</Submit>
  </form></Card>}
  {preview&&!result&&<>
   <Card title="Review the new project"><p>{preview.options.name} · Private · Owned by {preview.audience.owner}</p><p>{preview.audience.administrators}</p><p>Project dates: {date(preview.projectDates.startDate)} to {date(preview.projectDates.dueDate)}. Timed dates use {preview.timezone}.</p>
    <ul className="rows">{preview.work.map(task=><li key={task.id}><strong>{task.title}</strong><p>{task.owner} · {date(task.start_date)} to {date(task.due_date)} · {task.estimate_hours} hours{task.approval?' · Approval pending':''}{task.internal_only?' · Internal only':''}</p></li>)}</ul>
    <details><summary>Fields and dependencies</summary>{preview.options.dateMode==='relative'&&<p>Dates shift by {preview.offset} calendar days; timed work keeps its local wall time.</p>}<ul className="rows">{preview.fields.map(field=><li key={field.id}>{field.label} · {field.type} · {field.visibility}</li>)}{preview.dependencies.map(edge=><li key={edge.id}>{preview.work.find(t=>t.id===edge.predecessor)?.title} → {preview.work.find(t=>t.id===edge.successor)?.title} · {edge.type.toUpperCase()} · {edge.lag} working days</li>)}</ul></details>
    <p>{preview.members.length} memberships and {preview.rules.length} rules staged inactive. Comments, files, internal notes, proof decisions and outgoing notices are excluded.</p>
    {(preview.members.length>0||preview.rules.length>0)&&<details><summary>Staged for later review</summary><ul className="rows">{preview.members.map(member=><li key={member.id}>{member.name} · {member.level} · {member.role} · Inactive</li>)}{preview.rules.map(rule=><li key={rule.id}>{rule.config.name} · Version {rule.version} · Inactive</li>)}</ul></details>}
    {preview.warnings.length>0&&<ul className="rows">{preview.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
    <Form action={`/api/v1/projects/${project.id}/duplicate`} next="" label="Create reviewed duplicate">{hidden(preview.options)}<input type="hidden" name="revision" value={preview.token}/><Submit>Create private duplicate</Submit></Form>
   </Card>
   <Card title="Capacity impact"><p>Added effort is compared with readable open commitments in the same date span. Hidden commitments and undated work are not included in the comparison.</p><ul className="rows">{preview.capacity.map(owner=><li key={owner.ownerId}><strong>{owner.owner}</strong><p>{owner.addedHours} added hours · {owner.existingHours} existing hours across {owner.existingTasks} readable commitments · {date(owner.from)} to {date(owner.to)}</p></li>)}</ul></Card>
  </>}
  {result&&<>
   <Card title="New work and source links"><p><a href={`/app/projects/${result.project.id}`}>Open {result.project.name}</a>{result.source&&<> · From <a href={`/app/projects/${result.source.id}`}>{result.source.name}</a></>}</p><ul className="rows">{result.tasks.map(task=><li key={task.id}><a href={`/app/tasks/${task.id}`}>{task.title}</a><p>New ID: {task.id}{task.sourceId&&<> · <a href={`/app/tasks/${task.sourceId}`}>Source: {task.sourceTitle}</a></>}{task.approval?' · Approval pending':''}</p></li>)}</ul></Card>
   <Card title="Staged memberships and rules"><p>Each selected membership grants access to the current duplicate. Rules require a separate reviewed activation and do not run on the copied work.</p>
    {result.staged.length>0?<form method="get" action={path} className="stack" aria-label="Review staged activation"><input type="hidden" name="result" value="1"/><input type="hidden" name="review" value="1"/>{result.staged.map(stage=><label key={stage.id} className="checkbox"><input type="checkbox" name="stageIds[]" value={stage.id} disabled={!!stage.activated_at} defaultChecked={checked(input,'stageIds',stage.id)}/>{stage.kind==='member'?`${stage.config.name} · ${stage.config.level} · ${stage.config.role}`:stage.config.config.name} · {stage.activated_at?'Activated':'Inactive'}</label>)}{result.staged.some(s=>!s.activated_at)&&<Submit quiet>Review selected activation</Submit>}</form>:<p>No members or rules were selected.</p>}
   </Card>
  </>}
  {review&&<Card title="Approve this exact activation"><p>{review.scope}</p><ul className="rows">{review.members.map(member=><li key={member.id}>{member.name} · {member.level} · {member.role} · Project access</li>)}{review.rules.map(rule=><li key={rule.stageId}><strong>{rule.name}</strong><p>Priority: {rule.config.priority}{rule.config.ownerId?` · Assignee: ${rule.config.ownerId}`:''} · Start: {date(rule.config.startDate??null)} · Due: {date(rule.config.dueDate??null)}</p>{rule.config.actions?.map(action=><p key={action.kind}>{action.kind}{action.value?`: ${action.value}`:''}</p>)}</li>)}</ul><p>{review.tasks.length} current tasks are inside the reviewed project audience. Required work approvals remain pending.</p><Form action={`/api/v1/projects/${project.id}/duplicate-review/activate`} next={resultPath} label="Activate reviewed selections">{hidden({stageIds:review.stageIds})}<input type="hidden" name="revision" value={review.token}/><Submit>Activate reviewed selections</Submit></Form></Card>}
 </Shell>
}
