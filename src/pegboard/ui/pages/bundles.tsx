import type {Viewer} from '../../../ui/viewer'
import type {bundleView} from '../../bundles/definitions'
import type {previewBundle} from '../../bundles/adoption'
import {Card,Check,Field,Form,Pick,Shell,Submit,Area,when} from '../shell'
type View=Awaited<ReturnType<typeof bundleView>>
type Option={value:string;label:string}
const priorities=['low','normal','high','urgent'].map(value=>({value,label:value}))
const summary=(c:any)=>!c?'Not applied':c.kind==='field'?`Shared field ${c.fieldKey} · version ${c.fieldVersion}`:c.kind==='rule'?`New tasks → priority ${c.priority}`:c.kind==='view'?`Task status: ${c.status}`:c.kind==='template'?`${c.taskKind}: ${c.title}`:c.titles.join(' → ')
export function BundlesPage({viewer,bundles,view,projects,fields,people,preview}:{viewer:Viewer;bundles:{id:string;name:string}[];view:View|null;projects:Option[];fields:Option[];people:Option[];preview:Awaited<ReturnType<typeof previewBundle>>|null}){
 const here=view?`/app/workflow-bundles/${view.bundle.id}`:'/app/workflow-bundles',id=view?.bundle.id
 return <Shell viewer={viewer} current="/app/projects" title={view?.bundle.name??'Workflow bundles'} facts={['Administrator-reviewed project configuration']}>
 <Card title="Projects"><a href="/app/projects">Back to projects</a>{view&&<p><a href="/app/workflow-bundles">All workflow bundles</a></p>}</Card>
 {!view&&<><Card title="Reusable bundles"><ul className="rows">{bundles.map(b=><li key={b.id}><a href={`/app/workflow-bundles/${b.id}`}>{b.name}</a></li>)}</ul></Card><Card title="Create a bundle"><Form action="/api/v1/workflow-bundles" next={here} label="Create workflow bundle"><Field label="Bundle name" name="name" required/><Submit>Create bundle</Submit></Form></Card></>}
 {view&&<>
 <Card title={`Bundle version ${view.current.version}`}><ul className="rows">{Object.entries(view.current.components).map(([key,c])=><li key={key}><span className="grow"><strong>{c.name}</strong> · {c.kind}<br/>{summary(c)}<br/><code>{key}</code></span></li>)}</ul>
 <details><summary>Add or revise a component</summary><Form action={`/api/v1/workflow-bundles/${id}/versions`} next={here} label="Version bundle component"><input type="hidden" name="version" value={view.current.version}/>
 <Field label="Stable component key" name="key" required/><Field label="Component name" name="name" required/><Pick label="Component kind" name="kind" options={['field','view','rule','template','stages'].map(value=>({value,label:value}))}/>
 <Pick label="Shared field" name="fieldId" options={fields} blank="Choose for a field component"/><Pick label="Saved view status" name="status" options={['all','todo','doing','done'].map(value=>({value,label:value}))}/><Pick label="New-task rule priority" name="priority" options={priorities}/>
 <Field label="Template task title" name="title"/><Pick label="Template task kind" name="taskKind" options={[{value:'task',label:'Task'},{value:'milestone',label:'Milestone'}]}/><Area label="Approval stage titles (one per line)" name="titles"/><Submit>Save new version</Submit></Form></details>
 </Card>
 <Card title="Preview adoption"><form method="get" action={here} className="stack" aria-label="Preview bundle adoption">{projects.map(p=><Check key={p.value} label={p.label} name="projectIds[]" value={p.value}/>)}<Submit>Preview selected projects</Submit></form></Card>
 {preview&&<Card title={`Review version ${preview.version}`}>
 {preview.projects.map(p=><div key={p.id}><h3>{p.name}</h3><ul className="rows">{p.rows.map(r=><li key={r.key}><span className="grow"><strong>{r.name}</strong> · {r.state}<br/>Current: {summary(r.current)}<br/>Proposed: {summary(r.next)}{r.reason&&<p>{r.reason}</p>}</span></li>)}</ul></div>)}
 <Form action={`/api/v1/workflow-bundles/${id}/adopt`} next={here} label="Adopt reviewed bundle"><input type="hidden" name="revision" value={preview.token}/>{preview.projects.map(p=><input key={p.id} type="hidden" name="projectIds[]" value={p.id}/>)}
 {Object.entries(view.current.components).map(([key,c])=><Check key={key} name="keys[]" value={key} label={`Adopt ${c.name}`}/>)}<p>Only chosen compatible changes apply. Local overrides and existing work stay intact.</p><Submit>Adopt chosen changes</Submit></Form></Card>}
 {view.adoptions.map(a=><Card title={a.name} key={a.project_id}>
 <p>{a.enabled?'Enabled':'Disabled'} · <a href={`/app/projects/${a.project_id}/settings`}>Project settings</a></p>
 <ul className="rows">{view.items.filter(i=>i.project_id===a.project_id).map(i=><li key={i.item_key}><span className="grow"><strong>{i.config.name}</strong> · version {i.version}{i.override?' · local override':''}<br/>{summary(i.config)}
 {i.kind==='view'&&<p><a href={`/app/projects/${a.project_id}?view=list&savedView=${encodeURIComponent(id+':'+i.item_key)}`}>Open {i.config.name}</a></p>}
 {i.kind==='rule'&&a.enabled===1&&<Form action={`/api/v1/workflow-bundles/${id}/projects/${a.project_id}/override`} next={here} label={`Override ${i.config.name} in ${a.name}`}><input type="hidden" name="key" value={i.item_key}/><Pick label="Local priority" name="priority" value={i.config.priority} options={priorities}/><Submit quiet>Save local override</Submit></Form>}
 {['template','stages'].includes(i.kind)&&a.enabled===1&&<Form action={`/api/v1/workflow-bundles/${id}/projects/${a.project_id}/start`} next="" label={`Start ${i.config.name} in ${a.name}`}><input type="hidden" name="key" value={i.item_key}/><Pick label="Work owner" name="ownerId" options={people}/><Submit quiet>{i.kind==='stages'?'Start approval stages':'Create from template'}</Submit></Form>}
 </span></li>)}</ul>
 {a.enabled===1&&<Form action={`/api/v1/workflow-bundles/${id}/projects/${a.project_id}/disable`} next={here} label={`Disable bundle in ${a.name}`}><Submit quiet>Disable bundle</Submit></Form>}
 </Card>)}
 <Card title="Started workflows">{view.runs.map(r=><div key={r.id}><h3>{r.config.name}</h3><ul className="rows">{r.tasks.map(t=><li key={t.task_id}><a href={`/app/tasks/${t.task_id}`}>{t.title}</a><span>{t.status}</span></li>)}</ul>{r.config.kind==='stages'&&r.tasks.length<(r.config.titles?.length??0)&&view.adoptions.some(a=>a.project_id===r.project_id&&a.enabled===1)&&<Form action={`/api/v1/workflow-bundles/${id}/projects/${r.project_id}/start`} next="" label={`Continue ${r.config.name}`}><input type="hidden" name="key" value={r.item_key}/><input type="hidden" name="runId" value={r.id}/><p>The previous stages must have current human approval.</p><Submit quiet>Start next approval stage</Submit></Form>}</div>)}</Card>
 <Card title="Queued rule work"><ul className="rows">{view.jobs.map(j=><li key={j.id}><a href={`/app/tasks/${j.task_id}`}>Task</a><span>{j.status}</span></li>)}</ul><Form action={`/api/v1/workflow-bundles/${id}/jobs/process`} next={here} label="Process queued rules"><Submit quiet>Process queued rules</Submit></Form></Card>
 <Card title="Bundle history"><ul className="rows">{view.history.map(h=><li key={h.id}><span>{h.action} · {projects.find(p=>p.value===h.project_id)?.label??'Project'}</span><span>{when(h.at)}</span></li>)}</ul><p>{view.versions.length} immutable versions retained. Existing task history and human decisions are never copied or erased by adoption.</p></Card>
 </>}
 </Shell>
}
