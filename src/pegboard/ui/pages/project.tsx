import type { board } from '../../tasks/board'
import type { Viewer } from '../../../ui/viewer'
import { PathWall, type Station } from '../../../ui/path'
import { Tassel, TaskCard } from '../../../ui/task'
import { AppBar } from '../../../ui/bar'
import { Flap } from '../../../ui/flap'
import { Heading } from '../../../ui/heading'
import { homeTabs } from '../../../ui/home'
import { Card, Field, Form, Pick, Submit, levelLabel } from '../shell'

type Board = Awaited<ReturnType<typeof board>>
const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))
const when = (date: string | null) => date ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : undefined

/** A project's wall: each section hangs as a card on the cord, its tasks as tassels beneath it. */
export function ProjectPage({ viewer, data, id }: { viewer: Viewer; data: Board; id: string }) {
  const can = (capability: string) => (data.capabilities as string[]).includes(capability)
  const stations: Station[] = data.columns.map((column, index) => ({
    id: `s${index}`,
    card: <TaskCard id={`s${index}`} title={column.section?.name ?? 'No section'} more={`${column.tasks.length} task${column.tasks.length === 1 ? '' : 's'}${column.section?.mapsTo ? ` · counts as ${column.section.mapsTo === 'todo' ? 'To do' : column.section.mapsTo === 'doing' ? 'Doing' : 'Done'}` : ''}`} />,
    tassels: <>{column.tasks.map(task => <Tassel key={task.id} href={`/app/tasks/${task.id}`} title={task.title} owner={task.owner} when={when(task.dueDate)} chip={[task.ref, task.status === 'done' ? 'Done' : task.subtasks ? `${task.subtasks.done}/${task.subtasks.total} subtasks` : null].filter(Boolean).join(' · ') || undefined} />)}</>,
  }))
  const sections = data.columns.filter(column => column.section).map(column => ({ value: column.section!.id, label: column.section!.name }))
  return <>
    <AppBar viewer={viewer} tabs={homeTabs(viewer, '/app/projects')} crumbs={[{ label: 'Projects', href: '/app/projects' }, { label: data.project.name, href: `/app/projects/${id}`, current: true }]} />
    <main className="board" id="main">
      <Heading title={data.project.name} chip={<Flap text={data.counts.tasks && data.counts.done === data.counts.tasks ? 'DONE' : `${data.counts.tasks} TASKS`} tone={data.counts.tasks && data.counts.done === data.counts.tasks ? 'landed' : 'quiet'} />} facts={[`${data.counts.tasks} tasks`, `${data.counts.done} done`, `Owner ${data.project.owner.name}`, `Your access ${levelLabel(data.level)}`, ...(data.project.prefix ? [`References ${data.project.prefix}-n`] : [])]} />
      <PathWall label={`${data.project.name}, by section`} rows={chunk(stations, 4)}>
        {(can('edit') || can('manage_settings')) && <div className="page projectbar">
          {can('edit') && <Card title="Add a task">
            <Form action="/api/v1/tasks" next={`/app/projects/${id}`} label="Add a task">
              <input type="hidden" name="projectId" value={id} />
              <Field label="Task title" name="title" required />
              <div className="inline"><Pick label="Section" name="sectionId" options={sections} /><Field label="Estimate (hours)" name="estimateHours" type="number" value="0" /><Field label="Due date" name="dueDate" type="date" /></div>
              <Submit>Add task</Submit>
            </Form>
          </Card>}
          <Card title="This project"><p className="muted">{data.project.description || 'No description yet.'}</p>
            <p><a className="button quiet" href={`/app/projects/${id}/settings`}>{can('manage_settings') ? 'Settings, sharing and fields' : 'Who can see this'}</a></p></Card>
        </div>}
      </PathWall>
    </main>
  </>
}
