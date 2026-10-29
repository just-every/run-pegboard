import { TimelineRange } from './timeline'
import type { Viewer } from '../../../ui/viewer'
import type { workView } from '../../views/service'
import type { listWorkViews } from '../../views/store'
import { modes } from '../../views/config'
import { columnValue, type WorkRow } from '../../views/rows'
import { Card, Pick, Shell, Submit } from '../shell'
import { WorkTable } from '../pages/table'
import { CardMove, DisplayColumns, DraftWarning, TaskEdit, dateValue, summary, textValue, statusOptions } from './rows'

type Data = Awaited<ReturnType<typeof workView>>
type Presets = Awaited<ReturnType<typeof listWorkViews>>
export const modeLabel = (mode:string) => mode === 'board' ? 'Board' : mode === 'timeline' ? 'Timeline' : mode[0].toUpperCase() + mode.slice(1)
export function WorkViewPage({ viewer, data, presets, input }: { viewer:Viewer; data:Data; presets:Presets; input:Record<string,string> }) {
  const id = data.project.id, path = `/app/projects/${id}/views`, mode = data.config.mode
  const query = new URLSearchParams(input); query.delete('taskId'); query.delete('due')
  return <Shell viewer={viewer} current="/app/projects" title={data.project.name} chip={modeLabel(mode).toUpperCase()} facts={[`${data.counts.tasks} permitted tasks`, 'One shared task graph']} crumbs={[{label:data.project.name,href:`/app/projects/${id}`},{label:'Work views',href:path,current:true}]}>
    <section data-work-view>
      <nav className="work-view-nav" aria-label="Work views">{modes.map(view => { const params = new URLSearchParams(query); params.set('mode',view); return <a key={view} href={`${path}?${params}`} aria-current={mode===view?'page':undefined}>{modeLabel(view)}</a> })}</nav>
      <Card title="View this work"><p><a href={`/app/projects/${id}`}>Path</a> · <a href={`/app/projects/${id}/settings/views`}>Saved view settings</a> · <a href={`/app/projects/${id}/timeline`}>Schedule and dependencies</a></p>
        <form method="get" action={path} className="inline" aria-label="Filter and group work"><input type="hidden" name="mode" value={mode}/>
          <Pick label="Saved view" name="savedView" value={input.savedView ?? data.config.id ?? ''} blank="Project defaults" options={presets.views.map(view=>({value:view.id,label:view.name}))}/>
          <Pick label="Status filter" name="status" value={input.status??(data.config.filters.status.length===1?data.config.filters.status[0]:'all')} options={[{value:'all',label:'All statuses'},...statusOptions]}/>
          <Pick label="Group by" name="groupBy" value={input.groupBy??data.config.groupBy??''} blank="No grouping" options={data.availableColumns.map(column=>({value:column.id,label:column.label}))}/><Submit quiet>Show work</Submit>
        </form>
      </Card>
      <p className="work-live-state" role="status" data-live-status>Checking committed values…</p>
      <WorkViewContent data={data}/>
      <section className="work-date-preview" data-date-preview aria-label="Review date changes" aria-live="polite"/>
    </section>
    <script src="/look/work-views.js" defer/>
  </Shell>
}
export function WorkViewContent({data}:{data:Data}) {
  const columns = data.config.columns.length ? data.config.columns : ['title']
  const labels = new Map(data.availableColumns.map(column=>[column.id,column.label]))
  const grouping = data.config.mode === 'calendar' ? 'dueDate' : data.config.groupBy
  const groups = new Map<string,WorkRow[]>()
  for(const row of data.rows) {
    const value = grouping === 'dueDate' ? row.dueDate?.slice(0,10)??'Undated' : grouping ? textValue(columnValue(row,grouping)) : 'Tasks'
    groups.set(value,[...(groups.get(value)??[]),row])
  }
  const card = (row:WorkRow) => <li className="work-row" key={row.id} data-work-row={row.id} data-revision={row.revision}>
    <div className="grow"><a href={`/app/tasks/${row.id}`}>{row.title}</a><p data-summary>{summary(row)}</p>
      <DisplayColumns row={row} columns={columns} labels={labels}/>
      {data.config.mode==='timeline'&&<p>{dateValue(row.startDate)} → {dateValue(row.dueDate)}</p>}
      {data.config.mode==='board'?<CardMove row={row} projectId={data.project.id} sections={data.sections}/>:<TaskEdit row={row} projectId={data.project.id}/>}
      {row.canEdit&&<DraftWarning/>}
    </div>
  </li>
  return <section className="work-content" data-work-content data-revision={data.revision} data-schema={JSON.stringify(columns)}>
    {data.config.mode==='table'?<Card title="Task table"><WorkTable rows={data.rows} columns={columns} availableColumns={data.availableColumns} projectId={data.project.id}/></Card>:<>
      {data.config.mode==='timeline'&&<Card title="Schedule overview"><TimelineRange rows={data.rows}/></Card>}
      {data.config.mode==='workload'&&data.workload&&<Card title="Committed workload"><p>Capacity for the same filtered work. Completed tasks stay in the task list and add no committed hours.</p>{data.workload.people.map(person=><section key={person.id}><h3>{person.name}</h3><p>{person.hours} committed h · {person.days.reduce((sum,day)=>sum+day.availableHours,0)} available h · {person.zone}</p><ul className="rows">{person.days.map(day=><li key={day.date}>{day.date} · {day.hours} h committed · {day.availableHours} h available</li>)}</ul></section>)}</Card>}
      {[...groups].map(([name,rows])=><Card key={name} title={name}><ul className="rows">{rows.map(card)}</ul></Card>)}
      {data.rows.length===0&&<Card title="No matching work"><p>No permitted tasks match these filters.</p></Card>}
    </>}
    {data.pagination&&data.pagination.total>data.rows.length&&<p>Showing {data.rows.length} of {data.pagination.total} matching tasks. Narrow this view to see the work you need.</p>}
  </section>
}
