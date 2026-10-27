import type {Plan} from '../schedule/plan'
import {Card,Field,Form,Pick,Submit} from './shell'
export type SchedulePreview={plan:Omit<Plan,'all'>;move:{taskId:string;start?:string;due?:string}}|{error:string}|null
export interface ScheduleEditorProps {here:string;projectId:string;tasks:{value:string;label:string}[];people:{value:string;label:string}[];input:Record<string,string>;preview:SchedulePreview}
const types:Record<string,string>={fs:'finish to start',ss:'start to start',ff:'finish to finish',sf:'start to finish'}
export function ScheduleEditor({here,projectId,tasks,people,input,preview}:ScheduleEditorProps){
 const plan=preview&&'plan'in preview?preview.plan:null,move=preview&&'move'in preview?preview.move:null
 return <Card title="Move a task"><form method="get" action={here.split('?')[0]} className="stack" aria-label="Preview a date change">
  {[...new URL(here,'http://local').searchParams].filter(([key])=>!['taskId','start','due'].includes(key)).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}
  <Pick label="Task to move" name="taskId" options={tasks} value={input.taskId}/><div className="inline"><Field label="New start" name="start" type="date" value={input.start??''}/><Field label="New due" name="due" type="date" value={input.due??''}/></div><Submit quiet>Preview knock-on changes</Submit>
 </form>
 {preview&&'error'in preview&&<p role="alert">This change cannot be previewed: {preview.error.replaceAll('_',' ')}.</p>}
 {plan&&<section aria-label="Knock-on preview"><h3>Knock-on preview</h3><ul className="rows">{plan.shifts.map(shift=><li key={shift.id}><span className="grow"><a href={shift.link}>{shift.title}</a><br/>{shift.from.start??'No start'} – {shift.from.due??'No due'} to {shift.to.start??'No start'} – {shift.to.due??'No due'}<br/>{shift.owner} · {shift.estimateHours} planned hours · {shift.timezone}{shift.reason?` · because ${shift.reason.predecessorTitle??'earlier work'} (${types[shift.reason.type]}${shift.reason.lag?`, ${shift.reason.lag>0?'lag':'lead'} ${Math.abs(shift.reason.lag)}`:''})`:' · the change you asked for'}{shift.crossed.length?` · skips ${shift.crossed.map(h=>h.name).join(', ')}`:''}{shift.dst?' · crosses a daylight-saving change, local time kept':''}{shift.calendarAdjusted?' · adjusted to working availability':''}{shift.completed?' · already complete, cannot move':''}</span></li>)}</ul>
  {plan.blocked&&<p role="alert">A completed task would have to move, so this set cannot be applied.</p>}{plan.waits&&<p role="status">Some affected work is outside your access. The whole set waits for its authorized approver; no dates change.</p>}
  {!plan.blocked&&plan.shifts.length>0&&<Form action="/api/v1/schedule/apply" next={here} label="Apply change set"><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="taskId" value={move!.taskId}/>{move!.start&&<input type="hidden" name="start" value={move!.start}/>} {move!.due&&<input type="hidden" name="due" value={move!.due}/>}<input type="hidden" name="revision" value={plan.stamp}/>{plan.waits&&<Pick label="Approver" name="approverId" blank="Any person who can edit all of it" options={people}/>}<Submit>{plan.waits?'Send for approval':'Apply this change set'}</Submit></Form>}
 </section>}
 <p><a href="/app/settings/availability">Working calendar settings</a></p>
 </Card>
}
