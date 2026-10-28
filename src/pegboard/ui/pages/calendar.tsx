import { CalendarBlocks, type CalendarBlocksProps } from './calendar-blocks'
import type {scheduleView} from '../../schedule/timeline'
import type {Viewer} from '../../../ui/viewer'
import {Card,Shell} from '../shell'
import {ScheduleEditor,type ScheduleEditorProps} from '../schedule-editor'
export function CalendarPage({viewer,view,editor,blocks}:{viewer:Viewer;view:Awaited<ReturnType<typeof scheduleView>>;editor:ScheduleEditorProps|null;blocks:CalendarBlocksProps}){
 const dated=view.tasks.filter(task=>task.inProject&&(task.start||task.due)),days=[...new Set(dated.map(task=>(task.due??task.start!).slice(0,10)))].sort()
 return <Shell viewer={viewer} current="/app/projects" title={`${view.project.name}: calendar`} chip="CALENDAR" crumbs={[{label:view.project.name,href:`/app/projects/${view.project.id}`},{label:'Calendar',href:`/app/projects/${view.project.id}/calendar`,current:true}]}>
  <p><a href={`/app/projects/${view.project.id}`}>Path</a> · <a href={`/app/projects/${view.project.id}?view=list`}>List</a> · <a href={`/app/projects/${view.project.id}/timeline`}>Timeline</a></p>
  <CalendarBlocks {...blocks}/>
  {days.map(day=><Card key={day} title={day}><ul className="rows">{dated.filter(task=>(task.due??task.start!).slice(0,10)===day).map(task=><li key={task.id}><span><a href={task.link}>{task.title}</a><br/>{task.owner} · {task.start??'No start'} to {task.due??'No due'}{task.kind==='milestone'?' · Milestone':''}</span></li>)}</ul></Card>)}
  {days.length===0&&<Card title="No dated work"><p>Tasks appear here when they have a start or due date.</p></Card>}{editor&&<ScheduleEditor {...editor}/>}
 </Shell>
}
