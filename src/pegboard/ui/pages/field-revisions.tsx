import type {Viewer} from '../../../ui/viewer'
import type {fieldRevisionView,fieldRevisionPreview} from '../../revisions/fields'
import {Card,Form,Pick,Shell,Submit,when} from '../shell'
const describe=(field:any)=>`${field.label} · ${field.type} · ${field.visibility}${field.units?' · '+field.units:''}${field.config.options?' · '+field.config.options.join(', '):''}${field.config.expression?' · '+field.config.expression:''}${field.config.sourceKey?' · source '+field.config.sourceKey:''}`
export function FieldRevisionsPage({viewer,view,preview}:{viewer:Viewer;view:Awaited<ReturnType<typeof fieldRevisionView>>;preview:Awaited<ReturnType<typeof fieldRevisionPreview>>|null}){
 const here=`/app/fields/${view.fieldId}/revisions`
 return <Shell viewer={viewer} current="/app/projects" title={`${view.current.label}: revisions`} facts={['Review shared definitions without losing current task values']}>
 <Card title="Current definition"><p>{describe(view.current)}</p></Card>
 <Card title="Compare a retained revision"><form method="get" action={here} className="stack" aria-label="Compare field revision"><Pick label="Source revision" name="fromVersion" value={String(preview?.fromVersion??view.versions[0]?.version)} options={view.versions.map(v=>({value:String(v.version),label:`Revision ${v.version} · ${v.snapshot.label}`}))}/><Submit quiet>Compare field revision</Submit></form></Card>
 {preview&&<Card title="Review field restoration"><p>Current: {describe(preview.current)}</p><p>Revision {preview.fromVersion}: {describe(preview.restored)}</p><p>{preview.affected} affected tasks across {preview.projects.length} projects. Restoring appends a new definition revision and keeps current task values and independent human decisions.</p>{!preview.canApply&&<p>Current values are incompatible with this revision. They are preserved; restoration is refused.</p>}{preview.changed&&preview.canApply&&<Form action={`/api/v1/fields/${view.fieldId}/revisions/restore`} next={here} label="Restore field revision"><input type="hidden" name="fromVersion" value={preview.fromVersion}/><input type="hidden" name="token" value={preview.token}/><Submit>Restore as new field revision</Submit></Form>}</Card>}
 <Card title="Definition history"><ul className="rows">{view.versions.map(v=><li key={v.version}><span>Revision {v.version} · {describe(v.snapshot)}<br/>{v.actor} · {when(v.at)}</span></li>)}</ul></Card>
 </Shell>
}
