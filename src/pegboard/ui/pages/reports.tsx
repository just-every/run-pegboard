import type { Viewer } from '../../../ui/viewer'
import type { Report, Value, dashboards } from '../../reporting/dashboard'
import { measures, supportsMeasure, widgetKinds } from '../../reporting/definition'
import { Card, Check, Field, Form, Pick, Shell, Submit, when } from '../shell'
const label=(s:string)=>s.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase())
const number=(n:number|null)=>n===null?'Unknown':Number.isInteger(n)?String(n):n.toFixed(2)

export function ReportsSettings({viewer,projects,list}:{viewer:Viewer;projects:{id:string;name:string}[];list:Awaited<ReturnType<typeof dashboards>>}) {
 return <Shell viewer={viewer} current="/auth/settings/identity" title="Report settings" facts={['Saved native dashboards · No email delivery']}>
  <Card title="Create a dashboard"><Form action="/api/v1/reports" next="" label="Create a dashboard">
   <Field label="Dashboard name" name="name" required/>
   <fieldset><legend>Projects</legend>{projects.map(p=><Check key={p.id} name="projects[]" value={p.id} label={p.name}/>)}</fieldset>
   <div className="inline"><Field label="First local day" name="start" type="date" required/><Field label="Last local day" name="end" type="date" required/></div>
   <Field label="IANA timezone" name="timezone" value="America/New_York" required/>
   <Pick label="Saved status filter" name="status" options={['all','todo','doing','done'].map(value=>({value,label:label(value)}))}/>
   <fieldset><legend>Widget measures</legend>{widgetKinds.map(kind=><Pick key={kind} label={label(kind)+' measure'} name={'measure:'+kind} options={measures.filter(m=>supportsMeasure(kind,m)).map(value=>({value,label:label(value)}))}/>)}</fieldset>
   <Submit>Save dashboard</Submit>
  </Form></Card>
  <Card title="My dashboards"><p><a href="/app/reports">Open reports</a></p><ul className="rows">{list.map(r=><li key={r.id}><a href={'/app/reports/'+r.id}>{r.name}</a></li>)}</ul></Card>
 </Shell>
}
export function ReportsList({viewer,list}:{viewer:Viewer;list:Awaited<ReturnType<typeof dashboards>>}) {
 return <Shell viewer={viewer} current="/app/reports" title="Reports" facts={['Native snapshots · Included reporting']}><Card title="My dashboards"><p><a href="/app/settings/reports">Report settings</a></p>{!list.length&&<p>No dashboards yet. Choose your projects and window in Report settings.</p>}<ul className="rows">{list.map(r=><li key={r.id}><a href={'/app/reports/'+r.id}>{r.name}</a></li>)}</ul></Card></Shell>
}
function Chart({kind,values}:{kind:string;values:Value[]}) {
 const min=Math.min(0,...values.map(v=>v.value??0)),max=Math.max(1,...values.flatMap(v=>[v.value??0,v.scope??0])),span=max-min,n=Math.max(1,values.length),x=(i:number)=>35+i*530/Math.max(1,n-1),y=(v:number)=>175-(v-min)/span*150
 if(kind==='single-number')return <p className="report-number">{number(values[0]?.value??null)}</p>
 if(kind==='table')return null
 if(kind==='donut'&&min<0)return <p>Signed values have no donut proportion. Read the exact values below or choose a bar, line, number or table.</p>
 const colors=['var(--azure-ink)','var(--tomato)','var(--done-ink)']
 let offset=0
 return <svg viewBox="0 0 600 210" role="img" aria-label={label(kind)+' chart'} className="report-chart"><title>{label(kind)}; exact values and source rows follow</title>
  {kind==='horizontal-bar'?values.map((v,i)=><g key={i}><text x="0" y={35+i*55} fontSize="14">{v.label}</text>{v.value!==null&&<rect x={100+(Math.min(0,v.value)-min)/span*400} y={18+i*55} width={Math.abs(v.value)/span*400} height="24" fill={colors[i%3]}/>}<text x="510" y={35+i*55} fontSize="14">{number(v.value)}</text></g>):kind==='vertical-column'?values.map((v,i)=><g key={i}>{v.value!==null&&<rect x={60+i*170} y={Math.min(y(0),y(v.value))} width="80" height={Math.abs(y(0)-y(v.value))} fill={colors[i%3]}/>}<text x={60+i*170} y="199" fontSize="14">{v.label}</text><text x={60+i*170} y={Math.max(30,y(v.value??0)-5)} fontSize="14">{number(v.value)}</text></g>):kind==='donut'?<>
   {values.map((v,i)=>{const total=values.reduce((sum,v)=>sum+(v.value??0),0),share=total?(v.value??0)/total*100:0,start=offset;offset+=share;return <circle key={i} cx="300" cy="100" r="65" fill="none" pathLength="100" stroke={colors[i%3]} strokeWidth="30" strokeDasharray={`${share} ${100-share}`} strokeDashoffset={-start} transform="rotate(-90 300 100)"/>})}
   {!values.some(v=>v.value)&&<text x="235" y="105" fontSize="15">No measured work</text>}
  </>:<>
   <path d="M 30 15 V 180 H 580" stroke="var(--edge)" fill="none"/>
   {values.map((v,i)=><g key={i}>{v.value!==null&&<circle cx={x(i)} cy={y(v.value)} r="4" fill="var(--azure-ink)"/>}{i>0&&v.value!==null&&values[i-1].value!==null&&<line x1={x(i-1)} y1={y(values[i-1].value!)} x2={x(i)} y2={y(v.value)} stroke="var(--azure-ink)" strokeWidth="3"/>}{v.scope!==undefined&&v.scope!==null&&i>0&&values[i-1].scope!==null&&values[i-1].scope!==undefined&&<line x1={x(i-1)} y1={y(values[i-1].scope!)} x2={x(i)} y2={y(v.scope)} stroke="var(--grey)" strokeDasharray="5 4" strokeWidth="2"/>}</g>)}
   <text x="35" y="205" fontSize="14">{values[0]?.label}</text><text x="565" textAnchor="end" y="205" fontSize="14">{values.at(-1)?.label}</text>
  </>}
 </svg>
}
export function ReportPage({viewer,id,name,report}:{viewer:Viewer;id:string;name:string;report:Report|null}) {
 return <Shell viewer={viewer} current="/app/reports" title={name} facts={['Native dashboard · Authorized snapshot']}>
  <Card title="Snapshot"><p><a href="/app/reports">All reports</a> · <a href="/app/settings/reports">Report settings</a></p>
   <Form action={`/api/v1/reports/${id}/capture`} next="" label="Capture report"><Submit>Capture report</Submit></Form>
   {!report?<p>Capture an authorized snapshot to view this dashboard.</p>:<>
    <p>Snapshot <code data-report-snapshot>{report.id}</code> · {when(report.capturedAt)}</p>
    <p>{report.definition.start} through {report.definition.end}, inclusive local days · {report.definition.timezone} · Status: {report.definition.status}</p>
    <p>Local midnight boundaries define daily buckets, including short and long DST days. Done means the task’s recorded done status. Reopening restores remaining work. Shared tasks count once. Task-history measures use events recorded at the time, with changes to scope and effort retained.</p>
    <p>Before a baseline, task history is unknown. Future task-history points are unknown. Cycle hours run from the latest recorded doing event to completion; status age starts at the latest status change. A legacy baseline cannot establish either duration. Throughput counts recorded completion transitions while work was in selected scope.</p>
    <p role="status">{report.unknown.length?'Some earlier history is unknown; no earlier trend is invented.':'All source tasks have recorded history for the selected window.'}</p>
    <div className="inline">{['csv','xlsx','pdf'].map(format=><a key={format} className="button quiet" href={`/api/v1/reports/${id}/snapshots/${report.id}?format=${format}`}>Download {format.toUpperCase()}</a>)}</div>
   </>}
  </Card>
  {report&&<><div className="report-widgets">{report.widgets.map((widget,index)=><Card key={index} title={label(widget.kind)}>
   <p>{label(widget.measure)} · Group: {widget.group} · {report.definition.timezone}</p>
   {widget.basis&&<p>{widget.basis}</p>}
   {['burn-up','burn-down'].includes(widget.kind)&&<p>Blue: {widget.kind==='burn-up'?'completed':'remaining'} · Dashed: current scope</p>}
   <Chart kind={widget.kind} values={widget.values}/>
   <ul className="rows report-values" aria-label={label(widget.kind)+' values'}>{widget.values.map((v,i)=><li key={i} data-report-value={index+':'+i}><strong>{v.label}: {number(v.value)}</strong>{v.scope!==undefined&&<span> · Scope: {number(v.scope)}</span>}<details><summary>Source rows</summary><ul>{v.sourceIds.map(sourceId=><li key={sourceId}><a href={'#source-'+sourceId}>{report.sources.find(s=>s.id===sourceId)!.title}</a></li>)}{v.metricIds?.map(id=><li key={id}><a href={'#metric-'+id}>Business record {id}</a></li>)}</ul><p>Event references: {v.eventIds.join(', ')||'none'}</p></details></li>)}</ul>
  </Card>)}</div>
  <Card title="Source rows"><ul className="rows">{report.sources.map(source=><li id={'source-'+source.id} key={source.id}><a href={'/app/tasks/'+source.id}>{source.title}</a> · <code>{source.id}</code><details><summary>Event-time history</summary><ul>{source.events.map(e=><li key={e.seq}>{when(e.at)} · {e.kind} · {e.status} · {e.effort} effort hours · {e.projects.length?'In selected scope':'Outside selected scope'} · Event {e.seq}</li>)}</ul></details></li>)}</ul></Card>
  {!!report.metrics?.length&&<Card title="Business source records"><ul className="rows">{report.metrics.map(row=><li key={row.measure+':'+row.id} id={'metric-'+row.measure+':'+row.id} data-report-metric={row.measure}>
   <a href={'/app/tasks/'+row.taskId}>{report.sources.find(s=>s.id===row.taskId)!.title}</a>{row.label&&<> · {row.label}</>} · {label(row.measure)}: <strong>{number(row.value)}</strong> · {row.day??'Unscheduled'}{row.state&&<> · {row.state}</>}
   {row.sheetId&&<> · <a href={'/app/time/'+row.sheetId}>Timesheet record</a></>}{row.subjectKind==='proof'&&<> · <a href={'/app/tasks/'+row.taskId}>Task proof reviews</a></>}
  </li>)}</ul></Card>}</>}
 </Shell>
}
