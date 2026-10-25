import type { Viewer } from '../../../ui/viewer'
import type { BriefView } from '../../revisions/briefs'
import { Area, Card, Form, Pick, Shell, Submit, when } from '../shell'

export interface BriefPageProps {viewer:Viewer;view:BriefView}
export function BriefPage({viewer,view}:BriefPageProps) {
 const here=`/app/projects/${view.project.id}/brief`,api=`/api/v1/projects/${view.project.id}/brief`
 const options=view.versions.map(row=>({value:String(row.version),label:`Revision ${row.version} by ${row.actor}`}))
 return <Shell viewer={viewer} current="/app/projects" title={`${view.project.name}: brief`} facts={[view.version?`Current revision ${view.version}`:'No brief saved']}>
  <Card title="Current brief">
   {view.canEdit?<Form action={api} next={here} label="Edit project brief"><input type="hidden" name="version" value={view.version}/><Area label="Brief text" name="text" value={view.text}/><Submit>Save new revision</Submit></Form>:<p>{view.text||'No brief saved.'}</p>}
  </Card>
  {view.versions.length>0&&<Card title="Revision history">
   <ul className="rows">{view.versions.map(row=><li key={row.version}><span>Revision {row.version} · {row.actor} · {when(row.createdAt)}{row.restoredFrom!==null?` · Restored from revision ${row.restoredFrom}`:''}</span></li>)}</ul>
   <form action={here} method="get" className="stack" aria-label="Compare brief revisions">
    <Pick label="Earlier revision" name="fromVersion" options={options} value={String(view.comparison?.from.version??view.versions.at(-1)!.version)}/>
    <Pick label="Later revision" name="toVersion" options={options} value={String(view.comparison?.to.version??view.version)}/>
    <Submit quiet>Compare revisions</Submit>
   </form>
  </Card>}
  {view.comparison&&<Card title="Compare revisions">
   <p>{view.comparison.changed?'The brief text changed.':'These revisions have the same text.'}</p>
   <h3>Revision {view.comparison.from.version}</h3><p className="task-description">{view.comparison.from.text}</p>
   <h3>Revision {view.comparison.to.version}</h3><p className="task-description">{view.comparison.to.text}</p>
  </Card>}
  {view.canEdit&&view.versions.length>0&&<Card title="Restore a revision">
   <p>Restore the selected brief as a new revision. Existing revisions and later project work remain available.</p>
   <Form action={api+'/restore'} next={here} label="Restore project brief revision"><input type="hidden" name="version" value={view.version}/><Pick label="Revision to restore" name="fromVersion" options={options} value={String(view.comparison?.from.version??view.version)}/><Submit>Restore as new revision</Submit></Form>
  </Card>}
 </Shell>
}
