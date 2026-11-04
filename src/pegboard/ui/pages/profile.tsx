import type { Viewer } from '../../../ui/viewer'
import type { colleagueDirectory, teammateProfile } from '../../workspace/profiles'
import { Card, Field, Shell } from '../shell'

export function ColleaguesPage({ viewer, view }: { viewer: Viewer; view: Awaited<ReturnType<typeof colleagueDirectory>> }) {
 return <Shell viewer={viewer} current="/app/people" title="People" facts={['Colleagues in this workspace']}>
  <Card title="Teammates"><ul className="rows">{view.people.map(person => <li key={person.id}><a href={`/app/people/${person.id}?workspace=${encodeURIComponent(view.workspace)}`}>{person.name}</a></li>)}</ul></Card>
 </Shell>
}
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: '2-digit', day: '2-digit', year: 'numeric' }).format(new Date(value + 'T12:00:00Z'))
export function ProfilePage({ viewer, view }: { viewer: Viewer; view: Awaited<ReturnType<typeof teammateProfile>> }) {
 return <Shell viewer={viewer} current="/app/people" title={view.person.name} facts={['Teammate profile']}>
  <Card title="Assigned work"><p><a href={'/app/people?workspace='+encodeURIComponent(view.workspace)}>All teammates</a></p><p>Project assignments you can currently open. Shared work appears once.</p>
   {view.assignments.length ? <ul className="rows" aria-label="Permitted assignments">{view.assignments.map(task => <li key={task.id} data-task-id={task.id}>
    <span className="grow"><a href={'/app/tasks/'+task.id}>{task.title}</a><br/><span>{task.parentId ? 'Subtask · ' : ''}{task.status === 'done' ? 'Done' : 'Open'}</span></span>
    <span>{task.projects.map((project, i) => <span key={project.id}>{i ? ' · ' : ''}<a href={'/app/projects/'+project.id}>{project.name}</a></span>)}</span>
   </li>)}</ul> : <p>No permitted project assignments.</p>}
  </Card>
  <Card title="Availability"><p>Working capacity after permitted time off · {view.availability.zone}. This summary does not subtract assigned work. Unknown source freshness cannot confirm availability.</p>
   <form method="get" className="inline" aria-label="Availability window"><input type="hidden" name="workspace" value={view.workspace}/><Field label="Starting date" name="from" type="date" value={view.availability.from} required/><button className="button quiet" type="submit">Show availability</button></form>
   <ul className="rows" aria-label="Availability by day">{view.availability.days.map(day => <li key={day.date}><span className="grow">{dateLabel(day.date)}</span><span>{day.availableHours === null ? 'Availability unknown' : `${day.availableHours} hours available`}</span></li>)}</ul>
  </Card>
 </Shell>
}
