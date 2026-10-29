import type {Viewer} from '../../../ui/viewer'
import type {mergePreview} from '../../merge/preview'
import type {mergeView,mergeUndoPreview} from '../../merge/execution'
import type {duplicatePreview} from '../../merge/duplicates'
import {Card,Form,Pick,Shell,Submit} from '../shell'
type Preview=Awaited<ReturnType<typeof mergePreview>>
export function MergePage({viewer,input,tasks,people,preview,duplicate,result,undo}:{viewer:Viewer;input:Record<string,string>;tasks:{value:string;label:string}[];people:{value:string;label:string}[];preview:Preview|null;duplicate:Awaited<ReturnType<typeof duplicatePreview>>|null;result:Awaited<ReturnType<typeof mergeView>>|null;undo:Awaited<ReturnType<typeof mergeUndoPreview>>|null}){
 const shown=(key:string,value:unknown)=>key==='owner_id'?people.find(p=>p.value===value)?.label??'Former member':value===null||value===''?'No value':typeof value==='object'?JSON.stringify(value):String(value)
 const labels:Record<string,string>={owner_id:'Owner',start_date:'Start date',due_date:'Due date',estimate_hours:'Estimated hours',internal_notes:'Internal notes'}
 const pair=(source:string,survivor:string)=><><input type="hidden" name="sourceId" value={source}/><input type="hidden" name="survivorId" value={survivor}/></>
 return <Shell viewer={viewer} current="/app/search" title="Duplicates and task merge" facts={['Review both tasks before combining their work']}>
  {!result&&<Card title="Choose two tasks"><form method="get" action="/app/task-merges" className="stack" aria-label="Choose merge tasks">
   <Pick label="Task to combine" name="sourceId" value={input.sourceId} blank="Choose a task" options={tasks}/><Pick label="Surviving task" name="survivorId" value={input.survivorId} blank="Choose a survivor" options={tasks}/>
   <button className="button quiet" name="mark" value="1">Review duplicate mark</button><button className="button primary" name="review" value="1">Review task merge</button>
  </form></Card>}
  {duplicate&&<Card title="Review duplicate mark"><p>{duplicate.source.title} will be marked as a duplicate of {duplicate.target.title}. Both tasks keep their content and permissions.</p><Form action="/api/v1/task-duplicates" next="" label="Confirm duplicate mark">{pair(duplicate.source.id,duplicate.target.id)}<input type="hidden" name="token" value={duplicate.token}/><Submit>Mark duplicate</Submit></Form></Card>}
  {preview&&<>
   <Card title="Resolve conflicting values"><p>{preview.source.title} will join {preview.survivor.title}. Both source histories and all permitted comments and files are conserved; time entries keep their original attribution.</p>
    <form method="get" action="/app/task-merges" className="stack" aria-label="Resolve merge conflicts">{pair(preview.source.id,preview.survivor.id)}<input type="hidden" name="review" value="1"/>
     {preview.fields.filter(f=>f.different).map(f=><Pick key={f.key} label={labels[f.key]??f.key[0].toUpperCase()+f.key.slice(1)} name={'choice:'+f.key} value={f.choice} blank="Choose a value" options={[{value:'source',label:preview.source.title+': '+shown(f.key,f.source)},{value:'survivor',label:preview.survivor.title+': '+shown(f.key,f.survivor)}]}/>)}
     {preview.custom.filter(f=>f.different).map(f=><Pick key={f.key} label={f.label} name={'choice:'+f.key} value={f.choice} blank="Choose a value" options={[{value:'source',label:preview.source.title+': '+shown(f.key,f.source)},{value:'survivor',label:preview.survivor.title+': '+shown(f.key,f.survivor)}]}/>)}
     <Submit quiet>Update merge preview</Submit>
    </form>
   </Card>
   <Card title="Conserved work"><h3>Projects and sections</h3><ul className="rows">{preview.projects.map(p=><li key={p.id}>{p.name}{p.section?' · '+p.section.name:''}</li>)}</ul><h3>Comments</h3><ul className="rows">{preview.comments.map(c=><li key={c.id}><span><strong>{c.author}</strong><p>{c.body}</p><p>From {c.sourceTaskId===preview.source.id?preview.source.title:preview.survivor.title}</p></span></li>)}</ul><h3>Attachments</h3><ul className="rows">{preview.attachments.map(a=><li key={a.id}>{a.name} · From {a.sourceTaskId===preview.source.id?preview.source.title:preview.survivor.title}</li>)}</ul><p>{preview.dependencies.length} dependency links reviewed. Internal links between these two tasks are removed; other links follow the survivor. No approval is copied.</p>
    {preview.conflicts.map(c=><p role="alert" key={c}>{c.replaceAll('_',' ')}. Resolve this before merging.</p>)}
    {!!preview.unresolved.length&&<p role="status">Choose every conflicting value, then update the preview.</p>}
    {preview.canApply&&<Form action="/api/v1/task-merges" next="" label="Confirm reviewed merge">{pair(preview.source.id,preview.survivor.id)}<input type="hidden" name="choices" value={JSON.stringify(preview.choices)}/><input type="hidden" name="token" value={preview.token}/><Submit>Merge reviewed tasks</Submit></Form>}
   </Card>
  </>}
  {result&&<Card title="Merged task"><p><a href={'/app/tasks/'+result.survivorId}>{result.title}</a></p><p>{result.comments.length} comments · {result.history.length} history entries · {result.attachments.length} attachments · {result.time.seconds} seconds in time entries you may review.</p><p>Time entries are retained once, with their original task and person.</p><ul className="rows" aria-label="Merged comments">{result.comments.map(c=><li key={c.id}><span><strong>{c.author}</strong><p>{c.body}</p><p>From {c.sourceTaskId===result.sourceId?'combined task':'surviving task'}</p></span></li>)}</ul><ul className="rows" aria-label="Conserved time entries">{result.time.entries.map(e=><li key={e.id}>{e.seconds??'Running'} seconds · From {e.sourceTaskId===result.sourceId?'combined task':'surviving task'}</li>)}</ul><a className="button quiet" href={`/app/task-merges/${result.id}?undo=1`}>Review merge undo</a></Card>}
  {undo&&<Card title="Review merge undo"><p>The original task and its source material will separate again. Later independent work stays on the survivor.</p><ul className="rows" aria-label="Merge undo conflicts">{undo.conflicts.map(c=><li key={c.field}>Preserve {labels[c.field]??c.field}: {c.reason.replaceAll('_',' ')}</li>)}</ul>{undo.canApply&&<Form action={`/api/v1/task-merges/${undo.id}/undo`} next="" label="Confirm merge undo"><input type="hidden" name="token" value={undo.token}/><Submit>Undo unchanged merge effects</Submit></Form>}</Card>}
 </Shell>
}
