import type {Viewer} from '../../../ui/viewer'
import type {BulkInput,bulkPreview,undoBulkPreview,listBulk} from '../../recovery/bulk'
import {Card,Check,Field,Form,Pick,Shell,Submit} from '../shell'
type Preview=Awaited<ReturnType<typeof bulkPreview>>
type Undo=Awaited<ReturnType<typeof undoBulkPreview>>
export function BulkPage({viewer,tasks,people,listing,preview,undo,input}:{viewer:Viewer;tasks:{value:string;label:string}[];people:{value:string;label:string}[];listing:Awaited<ReturnType<typeof listBulk>>;preview:Preview|null;undo:Undo|null;input:BulkInput}) {
 const shown=(field:string,value:string|null)=>field==='owner_id'?(value?people.find(p=>p.value===value)?.label??'Former member':'Unassigned'):value??'No value'
 return <Shell viewer={viewer} current="/app/admin" title="Bulk changes and undo" facts={['Review exact effects; preserve later human work']}>
  {preview&&<Card title="Review bulk change"><ul className="rows">{preview.tasks.map(t=><li key={t.id}><span><strong>{t.title}</strong>{t.effects.map(e=><p key={e.field}>{e.field.replaceAll('_',' ')}: {shown(e.field,e.before)} → {shown(e.field,e.after)}</p>)}</span></li>)}</ul>
   {preview.conflicts.map(c=><p key={c.taskId+c.field}>{c.reason.replaceAll('_',' ')}</p>)}
   {preview.canApply&&<Form action="/api/v1/recovery/bulk/apply" next="" label="Apply reviewed bulk change"><input type="hidden" name="token" value={preview.token}/>{input.taskIds.map(id=><input key={id} type="hidden" name="taskIds[]" value={id}/>)}{Object.entries(input.patch).map(([key,value])=><input key={key} type="hidden" name={value===null?key==='startDate'?'clearStart':'clearDue':key} value={value??'1'}/>)}<Submit>Apply reviewed changes</Submit></Form>}
  </Card>}
  {undo&&<Card title="Review undo">{undo.origin&&<p>Rule run {undo.origin.run_id} · version {undo.origin.definition_version} · activated by {undo.origin.admin} · activation {undo.origin.activation_epoch}. {undo.origin.externalLimits}</p>}<p>{undo.restored.length+undo.restoredWork.length} effects can be restored · {undo.conflicts.length} conflicts preserve later work.</p><ul className="rows">{undo.tasks.map(t=><li key={t.id}><span><strong>{t.title}</strong>{undo.restored.filter(e=>e.taskId===t.id).map(e=><p key={e.field}>{undo.origin&&<code>{e.effectId} · </code>}Restore {e.field.replaceAll('_',' ')} to {shown(e.field,e.after)}</p>)}{undo.restoredWork.filter(e=>e.taskId===t.id).map(e=><p key={e.effectId}><code>{e.effectId} · </code>{e.kind==='complete'?'Restore prior completion':e.kind==='subtask'?'Trash unchanged created subtask':'Remove rule '+e.kind}</p>)}{undo.conflicts.filter(e=>e.taskId===t.id).map(e=><p key={e.field}>{undo.origin&&<code>{e.effectId} · </code>}Preserve {e.field.replaceAll('_',' ')}: {e.reason.replaceAll('_',' ')}</p>)}</span></li>)}</ul><Form action={`/api/v1/recovery/bulk/${undo.id}/undo`} next="/app/recovery/bulk" label="Confirm conflict-preserving undo"><input type="hidden" name="token" value={undo.token}/><Submit>Undo unchanged effects</Submit></Form></Card>}
  <Card title="Choose work and changes"><form method="get" action="/app/recovery/bulk" className="stack" aria-label="Preview bulk change">
   {tasks.map(t=><Check key={t.value} name="taskIds[]" value={t.value} label={t.label}/>)}
   <Pick label="New owner" name="ownerId" options={people} blank="Keep current owner"/>
   <Pick label="New priority" name="priority" options={['low','normal','high','urgent'].map(p=>({value:p,label:p}))} blank="Keep current priority"/>
   <Field label="New start date" name="startDate" type="date"/><Check name="clearStart" label="Clear start dates"/><Field label="New due date" name="dueDate" type="date"/><Check name="clearDue" label="Clear due dates"/><Submit quiet>Preview selected changes</Submit>
  </form></Card>
  <Card title="Change history"><ul className="rows">{listing.operations.map(op=><li key={op.id}><span className="grow"><strong>{op.tasks.map(t=>t.title).join(', ')}</strong><br/>{op.origin?`Rule version ${op.origin.definition_version} · ${op.origin.admin} · `:""}{op.effectCount} recorded effects{op.undo?` · ${op.undo.restored} restored · ${op.undo.conflicts.length} conflicts preserved`:''}</span>{op.canUndo&&<a className="button quiet" href={`/app/recovery/bulk?operationId=${op.id}`}>Review undo</a>}</li>)}</ul></Card>
 </Shell>
}
