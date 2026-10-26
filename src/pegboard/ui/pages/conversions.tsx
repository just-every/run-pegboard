import type {Viewer} from '../../../ui/viewer'
import type {previewConversion} from '../../conversion/service'
import type {ConversionView} from '../../conversion/operations'
import type {undoConversionPreview} from '../../conversion/undo'
import {Card,Field,Form,Pick,Shell,Submit} from '../shell'
import {conversionHref} from '../conversion-links'
import {ConversionEvidence} from './conversion-evidence'
type Preview=Awaited<ReturnType<typeof previewConversion>>
type Undo=Awaited<ReturnType<typeof undoConversionPreview>>
const kinds=[{value:'task_to_project',label:'Task to project'},{value:'project_to_task',label:'Project to task'},{value:'promote',label:'Promote subtask to top-level work'},{value:'demote',label:'Make task a subtask'}]
const fields=(input:Record<string,any>)=>Object.entries(input).filter(([key])=>!['preview','selected','source'].includes(key)).flatMap(([key,value])=>value===undefined||value===null?[]:Array.isArray(value)?value.map(v=><input key={key+v} type="hidden" name={key+'[]'} value={v}/>):<input key={key} type="hidden" name={key} value={String(value)}/>)
const date=(value:string|null)=>value??'No date'
export function ConversionsPage({viewer,input,tasks,projects,constituents,names,preview,result,undo}:{viewer:Viewer;input:Record<string,any>;tasks:{value:string;label:string}[];projects:{value:string;label:string}[];constituents:{value:string;label:string}[];names:Record<string,string>;preview:Preview|null;result:ConversionView|null;undo:Undo|null}){
 const kind=input.kind??'task_to_project',retained=Array.isArray(input.retainIds)?input.retainIds:[]
 const label=kinds.find(k=>k.value===kind)?.label??'Convert work'
 return <Shell viewer={viewer} current="/app/projects" title={result?'Linked conversion':label} facts={['Preview exact work and audience before changing structure']}>
  {!result&&<>
   <Card title="Conversion"><form method="get" action="/app/conversions" className="stack" aria-label="Choose conversion"><Pick label="Conversion" name="kind" options={kinds} value={kind}/><Submit quiet>Choose conversion</Submit></form></Card>
   <Card title="Choose source and destination"><form method="get" action="/app/conversions" className="stack" aria-label="Preview work conversion">
    <input type="hidden" name="kind" value={kind}/><input type="hidden" name="selected" value="1"/>
    <Pick label={kind==='project_to_task'?'Source project':'Source work'} name="sourceId" options={kind==='project_to_task'?projects:tasks} value={input.sourceId} blank="Choose source"/>
    {(kind==='task_to_project'||kind==='project_to_task')&&<Field label={kind==='task_to_project'?'New project name':'New parent task name'} name="name" value={input.name} placeholder="Keep source name"/>}
    {kind==='project_to_task'&&<Pick label="Destination project" name="targetProjectId" value={input.targetProjectId} options={projects} blank="Keep source project"/>}
    {kind==='demote'&&<Pick label="New parent work" name="parentId" value={input.parentId} options={tasks.filter(t=>t.value!==input.sourceId)} blank="Choose parent"/>}
    {kind==='project_to_task'&&constituents.length>0&&<fieldset><legend>Constituent work</legend><p>Each top-level record becomes a subtask or stays linked in its current project.</p>{constituents.map(task=><Pick key={task.value} label={task.label} name={`map:${task.value}`} value={retained.includes(task.value)?'retain':'include'} options={[{value:'include',label:'Make a subtask'},{value:'retain',label:'Keep as linked work'}]}/>)}</fieldset>}
    <p>Original file, time and history contexts remain. Existing authority must cover every source and target; this conversion cannot broaden access to private work.</p>
    <div className="inline"><button className="button quiet" type="submit">Load source choices</button><button className="button primary" type="submit" name="preview" value="1">Preview conversion</button></div>
   </form></Card>
  </>}
  {preview&&<>
   <Card title="Review conversion"><h3>{preview.source.title} → {preview.target.title}</h3><p>{label}. Work identities and historical records are retained.</p>
    {'tasks' in preview?<ul className="rows">{preview.mapping.map(mapping=>{const task=preview.tasks.find(t=>t.id===mapping.taskId)!;return <li key={task.id}><span><strong>{task.title}</strong> · {mapping.action.replaceAll('_',' ')}<br/>{names[task.owner_id]??'Unassigned'} · {date(task.start_date)} to {date(task.due_date)} · {task.estimate_hours} hours</span></li>})}</ul>:<ul className="rows">{preview.work.map(work=><li key={work.id}><span><strong>{work.title}</strong> · {work.after.kind==='subtask'?'Subtask':'Top-level work'}<br/>{work.after.owner} · {date(work.after.startDate)} to {date(work.after.dueDate)} · {work.after.estimateHours} hours</span></li>)}</ul>}
    {'parent' in preview&&preview.parent&&<p>New parent: <a href={`/app/tasks/${preview.parent.id}`}>{preview.parent.title}</a></p>}
    <Form action="/api/v1/conversions/apply" next="" label="Apply reviewed conversion">{fields('options' in preview?preview.options:{kind:preview.kind,sourceId:preview.sourceId,targetProjectId:preview.targetProjectId,parentId:preview.parentId})}<input type="hidden" name="token" value={preview.token}/><Submit>Apply reviewed conversion</Submit></Form>
   </Card>
   <Card title="Audience and capacity">{'note' in preview.visibility?<><p>Visibility: {preview.visibility.before} → {preview.visibility.after}</p><p>{preview.visibility.note}</p></>:<><p>Every current audience path remains scoped. Access does not expand.</p><ul className="rows">{preview.visibility.after.map(path=><li key={path.taskId+path.personId}>{path.name} · {path.capabilities.map(c=>c.replaceAll('_',' ')).join(', ')}</li>)}</ul></>}
    <ul className="rows">{preview.capacity.map(person=><li key={person.ownerId}>{person.owner} · {'hours' in person?person.hours:person.afterHours} open hours · {person.addedHours} added hours</li>)}</ul>
   </Card>
   <ConversionEvidence value={preview.reconciliation} names={names}/>
   <Card title="Settings retained as linked context"><p>{preview.repairs.length} settings remain inert conversion context. Repair them at their original project before adopting a replacement.</p><ul className="rows">{preview.repairs.map((repair,index)=><li key={index}>{repair.title??repair.kind} · Inert{repair.repairPath&&<> · <a href={repair.repairPath}>Open original settings</a></>}</li>)}</ul><p>Conversion activates no automation and sends no outward notice. Historical approvals are never applied to a different file version.</p></Card>
  </>}
  {result&&<>
   <Card title="Source and destination"><p><a href={conversionHref(result.source)}>{result.source.title}</a> → <a href={conversionHref(result.target)}>{result.target.title}</a></p><p>{result.undoneAt?'Unchanged structural effects were undone. Source links and later human edits remain.':'Conversion recorded once. Reopening either original work link retains its identity.'}</p>{!result.undoneAt&&<a className="button quiet" href={`/app/conversions/${result.id}?undo=1`}>Review undo</a>}</Card>
   <ConversionEvidence value={result.reconciliation} names={names}/>
   {result.repairs.length>0&&<Card title="Linked settings to repair"><ul className="rows">{result.repairs.map((repair,index)=><li key={index}>{repair.kind.replaceAll('_',' ')} · Inert{repair.repairPath&&<> · <a href={repair.repairPath}>Open original settings</a></>}</li>)}</ul></Card>}
  </>}
  {undo&&<Card title="Review structural undo"><p>{undo.effects.length} unchanged effects can be undone. {undo.conflicts.length} conflicts preserve later work.</p><p>{undo.preserved}</p><ul className="rows">{undo.conflicts.map(conflict=><li key={conflict.position}>{conflict.reason.replaceAll('_',' ')} · <a href={`/app/tasks/${conflict.taskId}`}>Inspect work</a></li>)}</ul><Form action={`/api/v1/conversions/${undo.id}/undo`} next={`/app/conversions/${undo.id}`} label="Undo unchanged conversion effects"><input type="hidden" name="token" value={undo.token}/><Submit>Undo unchanged structure</Submit></Form></Card>}
 </Shell>
}
