import type { board } from '../../tasks/board'
import type { Viewer } from '../../../ui/viewer'
import { Card, Field, Form, Pick, Shell, Submit } from '../shell'

export function ProjectListPage({viewer,data,viewName,savedView}:{viewer:Viewer;data:Awaited<ReturnType<typeof board>>;viewName?:string;savedView?:string}) {
 const id=data.project.id,here=`/app/projects/${id}?view=list${savedView?`&savedView=${encodeURIComponent(savedView)}`:''}`
 return <Shell viewer={viewer} current="/app/projects" title={data.project.name} chip="LIST" facts={viewName?[`Saved view: ${viewName}`]:[]} crumbs={[{label:data.project.name,href:`/app/projects/${id}`},{label:'List',href:here,current:true}]}>
  <p><a href={`/app/projects/${id}`}>Path</a> · <a href={`/app/projects/${id}/canvas`}>Planning canvas</a></p>
  {data.columns.map(column=><Card key={column.section?.id??'none'} title={column.section?.name??'No section'}>
   <ul className="rows">{column.tasks.map(task=><li key={task.id}><div className="grow"><a href={`/app/tasks/${task.id}`}>{task.title}</a><p>{task.owner} · {task.status==='todo'?'To do':task.status==='doing'?'Doing':'Done'} · <code>{task.id}</code></p>
    {data.capabilities.includes('edit')&&<Form action={`/api/v1/tasks/${task.id}/update`} next={here} label={`Edit ${task.title} in List`}><div className="inline"><Field label="Title" name="title" value={task.title} required/><Pick label="Status" name="status" value={task.status} options={[{value:'todo',label:'To do'},{value:'doing',label:'Doing'},{value:'done',label:'Done'}]}/><Submit quiet>Update task</Submit></div></Form>}
   </div></li>)}</ul>
  </Card>)}
 </Shell>
}
