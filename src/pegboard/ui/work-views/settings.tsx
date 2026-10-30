import type { Viewer } from '../../../ui/viewer'
import type { listWorkViews } from '../../views/store'
import type { workView } from '../../views/service'
import { initialConfig, modes } from '../../views/config'
import { Card, Check, Field, Form, Pick, Shell, Submit } from '../shell'
import { modeLabel } from './page'
import { statusOptions } from './rows'

export function ViewSettingsPage({viewer,presets,data,selected}:{viewer:Viewer;presets:Awaited<ReturnType<typeof listWorkViews>>;data:Awaited<ReturnType<typeof workView>>;selected?:string}) {
  const id=presets.project.id, here=`/app/projects/${id}/settings/views`, saved=presets.views.find(view=>view.id===selected)
  const config=saved??initialConfig(), editing=!!saved?.canEdit
  const options=presets.availableColumns.map(column=>({value:column.id,label:column.label}))
  const owners=[...presets.owners, ...config.filters.ownerIds.filter(id=>!presets.owners.some(owner=>owner.id===id)).map((id,index)=>({id,name:`Saved owner filter ${index+1}`}))]
  const defaults=(scope:'personal'|'team')=><Form action={`/api/v1/projects/${id}/work-view-defaults`} next={here} label={`Set ${scope} default`}>
    <input type="hidden" name="revision" value={presets.defaultsRevision}/><input type="hidden" name="scope" value={scope}/>
    <Pick label={scope==='personal'?'My default view':'Team default view'} name="viewId" blank="No saved default" value={scope==='personal'?presets.personalDefaultId:presets.teamDefaultId} options={presets.views.filter(view=>scope==='personal'||view.shared).map(view=>({value:view.id,label:view.name}))}/><Submit quiet>Set {scope} default</Submit>
  </Form>
  return <Shell viewer={viewer} current="/app/projects" title={`${presets.project.name}: saved view settings`} crumbs={[{label:presets.project.name,href:`/app/projects/${id}`},{label:'Settings',href:`/app/projects/${id}/settings`},{label:'Saved views',href:here,current:true}]}>
    <Card title="Saved work views"><p><a href={`/app/projects/${id}/views`}>Open work views</a> · <a href={here}>Create a new view</a></p>
      <ul className="rows">{presets.views.map(view=><li key={view.id}><a href={`${here}?savedView=${view.id}`}>{view.name}</a><span>{view.shared?'Shared configuration':'Personal configuration'}</span><a href={`/app/projects/${id}/views?savedView=${view.id}`}>Open saved work</a></li>)}</ul>
      {presets.views.length===0&&<p>No saved views yet.</p>}
    </Card>
    <Card title={editing?'Edit saved view':saved?'Save a personal copy':'Create saved view'}>
      <p>Sharing makes this configuration available to current project readers. It grants no access to tasks or fields. Each reader’s current permissions apply.</p>
      <p role="alert" data-view-settings-error hidden/>
      <form className="stack" method="post" action={editing?`/api/v1/work-views/${saved!.id}`:`/api/v1/projects/${id}/work-views`} aria-label="Save view configuration" data-view-save data-return={here}>
        {editing&&<input type="hidden" name="revision" value={saved!.revision}/>}
        <Field label="View name" name="name" value={saved?.name??''} required/>
        <div className="inline"><Pick label="Initial view" name="mode" value={config.mode} options={modes.map(mode=>({value:mode,label:modeLabel(mode)}))}/><Pick label="Group by" name="groupBy" value={config.groupBy??''} blank="No grouping" options={options}/></div>
        <fieldset><legend>Filters</legend><div className="work-columns">{statusOptions.map(status=><Check key={status.value} label={status.label} name="statuses[]" value={status.value} checked={config.filters.status.includes(status.value)}/>)}</div><p>Leave statuses or owners unchecked to include all permitted matches.</p>
          <div className="work-columns">{owners.map(owner=><Check key={owner.id} label={owner.name} name="owners[]" value={owner.id} checked={config.filters.ownerIds.includes(owner.id)}/>)}</div>
          <div className="inline"><Field label="Due from" name="dueFrom" type="date" value={config.filters.dueFrom}/><Field label="Due through" name="dueTo" type="date" value={config.filters.dueTo}/></div>
        </fieldset>
        <fieldset><legend>Visible columns</legend><div className="work-columns">{presets.availableColumns.map(column=><Check key={column.id} label={column.label} name="columns[]" value={column.id} checked={config.columns.includes(column.id)}/>)}</div></fieldset>
        <div className="inline"><Pick label="Sort by" name="sortColumn" value={config.sort[0]?.column??''} blank="Project order" options={options}/><Pick label="Sort direction" name="sortDirection" value={config.sort[0]?.direction??'asc'} options={[{value:'asc',label:'Ascending'},{value:'desc',label:'Descending'}]}/></div>
        <Check label="Share configuration with current project readers" name="shared" checked={!!saved?.shared}/><Submit>Save view</Submit>
      </form>
    </Card>
    <Card title="Default work views"><p>Your personal default takes precedence. A project Admin can choose a shared team default; current access is checked each time it opens.</p>{defaults('personal')}{presets.canSetTeamDefault&&defaults('team')}</Card>
    <script src="/look/work-view-settings.js" defer/>
  </Shell>
}
