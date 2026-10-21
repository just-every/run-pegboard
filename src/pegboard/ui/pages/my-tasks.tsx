import type { myTasks } from '../../tasks/board'
import type { Viewer } from '../../../ui/viewer'
import { Card, Field, Form, Shell, Submit } from '../shell'

export function MyTasksPage({ viewer, tasks, workspace }: { viewer: Viewer; tasks: Awaited<ReturnType<typeof myTasks>>; workspace: string }) {
  return <Shell viewer={viewer} current="/app/my-tasks" title="My tasks" chip={`${tasks.length} OPEN`} facts={[`${tasks.filter(task => task.personal).length} personal`, `${tasks.filter(task => !task.personal).length} shared`]}>
    <Card title="Open tasks">
      <ul className="rows">{tasks.map(task => <li key={task.id}><span className="grow"><a href={`/app/tasks/${task.id}`}>{task.title}</a><br /><small>{task.personal ? 'Personal: only you can see it' : task.projects.map(project => project.name).join(', ')}{task.dueDate ? ` · due ${task.dueDate}` : ''}</small></span>{task.ref && <small>{task.ref}</small>}<span className="tagline">{task.priority}</span></li>)}
        {tasks.length === 0 && <li>Nothing open.</li>}</ul>
    </Card>
    <Card title="Add a personal task">
      <Form action="/api/v1/tasks" next="/app/my-tasks" label="Add a personal task"><input type="hidden" name="workspaceId" value={workspace} /><div className="inline"><Field label="Task" name="title" required /><Field label="Due" name="dueDate" type="date" /><Submit>Add task</Submit></div></Form>
    </Card>
  </Shell>
}
