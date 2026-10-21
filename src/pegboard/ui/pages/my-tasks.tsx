import type { myTasks } from '../../tasks/board'
import type { personalMeta } from '../../tasks/personal'
import type { Viewer } from '../../../ui/viewer'
import { Card, Field, Form, Pick, Shell, Submit } from '../shell'

type Tasks = Awaited<ReturnType<typeof myTasks>>
type Meta = Awaited<ReturnType<typeof personalMeta>>
export function MyTasksPage({
  viewer,
  tasks,
  workspace,
  meta,
  day,
  on,
}: {
  viewer: Viewer
  tasks: Tasks
  workspace: string
  meta: Meta
  day: string
  on?: string
}) {
  const here = '/app/my-tasks',
    manual = meta.settings.sort === 'manual'
  const groups = manual
    ? [
        ...meta.sections.map((x) => ({ id: x.id, name: x.name })),
        { id: '', name: 'Unsectioned' },
      ]
    : ['Overdue', 'Today', 'Upcoming', 'Later'].map((name) => ({
        id: name,
        name,
      }))
  return (
    <Shell
      viewer={viewer}
      current={here}
      title="My tasks"
      chip={`${tasks.length} OPEN`}
      facts={[
        meta.settings.timezone,
        day,
        manual
          ? 'Manual sections and ranks'
          : 'Default date and priority order',
      ]}
    >
      <Card title="Your day">
        <Form
          action="/api/v1/my-tasks/settings"
          next={here}
          label="Day settings"
        >
          <div className="inline">
            <Field
              label="Timezone"
              name="timezone"
              value={meta.settings.timezone}
            />
            <Pick
              label="Sort"
              name="sort"
              value={meta.settings.sort}
              options={[
                { value: 'default', label: 'Default date and priority' },
                { value: 'manual', label: 'Manual sections and ranks' },
              ]}
            />
            <Submit>Save day settings</Submit>
          </div>
        </Form>
        <form
          method="get"
          action={here}
          className="inline"
          aria-label="Day preview"
        >
          <Field label="Preview local day" name="on" type="date" value={on} />
          <Submit quiet>Preview day</Submit>
          <a href={here}>Current day</a>
        </form>
        {on && <p>Day preview. Saved section rules do not run in a preview.</p>}
        <p>
          Overdue wins over Today. Within each default group: due date or
          instant, priority, creation time, then ID. Date-only deadlines use the
          end of your local day.
        </p>
      </Card>
      {groups.map((group) => (
        <Card key={group.id} title={group.name}>
          <ul className="rows">
            {tasks
              .filter((t) =>
                manual
                  ? (t.sectionId ?? '') === group.id
                  : t.group === group.id,
              )
              .map((task) => (
                <li key={task.id} data-task-id={task.id}>
                  <span className="grow">
                    <a href={`/app/tasks/${task.id}`}>{task.title}</a>
                    <br />
                    <small>
                      {task.personal
                        ? 'Personal: only you can see it'
                        : task.projects.map((p) => p.name).join(', ')}
                      {task.dueDate ? ` · due ${task.dueDate}` : ''} ·{' '}
                      {task.priority}
                    </small>
                    <Form
                      action={`/api/v1/my-tasks/${task.id}/layout`}
                      next={here}
                      label={`Arrange ${task.title}`}
                    >
                      <div className="inline">
                        <Pick
                          label="Section"
                          name="sectionId"
                          value={task.sectionId}
                          blank="Unsectioned"
                          options={meta.sections.map((x) => ({
                            value: x.id,
                            label: x.name,
                          }))}
                        />
                        <Field
                          label="Task rank"
                          name="position"
                          type="number"
                          value={task.position}
                        />
                        <Pick
                          label="Mark Today"
                          name="today"
                          value={task.today ? 'true' : 'false'}
                          options={[
                            { value: 'false', label: 'Use due date' },
                            { value: 'true', label: 'Today' },
                          ]}
                        />
                        <Submit quiet>Arrange</Submit>
                      </div>
                    </Form>
                  </span>
                </li>
              ))}
            {!tasks.some((t) =>
              manual ? (t.sectionId ?? '') === group.id : t.group === group.id,
            ) && <li>Nothing here.</li>}
          </ul>
        </Card>
      ))}
      <Card title="Add a personal task">
        <Form action="/api/v1/tasks" next={here} label="Add a personal task">
          <input type="hidden" name="workspaceId" value={workspace} />
          <div className="inline">
            <Field label="Task" name="title" required />
            <Field label="Due" name="dueDate" type="date" />
            <Pick
              label="Priority"
              name="priority"
              value="normal"
              options={['urgent', 'high', 'normal', 'low'].map((value) => ({
                value,
                label: value,
              }))}
            />
            <Submit>Add task</Submit>
          </div>
        </Form>
      </Card>
      <Card title="Personal sections">
        <ul className="rows">
          {meta.sections.map((s) => (
            <li key={s.id}>
              <Form
                action="/api/v1/my-tasks/sections"
                next={here}
                label={`Edit ${s.name}`}
              >
                <input type="hidden" name="id" value={s.id} />
                <div className="inline">
                  <Field label="Section name" name="name" value={s.name} />
                  <Field
                    label="Section rank"
                    name="position"
                    type="number"
                    value={s.position}
                  />
                  <Submit quiet>Save section</Submit>
                </div>
              </Form>
            </li>
          ))}
        </ul>
        <Form
          action="/api/v1/my-tasks/sections"
          next={here}
          label="Add a personal section"
        >
          <div className="inline">
            <Field label="Section name" name="name" required />
            <Field
              label="Section rank"
              name="position"
              type="number"
              value={meta.sections.length}
            />
            <Submit>Add section</Submit>
          </div>
        </Form>
      </Card>
      {meta.sections.length > 0 && (
        <Card title="Section rules">
          <p>
            Move personal work on the current local day. Each move is recorded
            once per rule, task and day. Undo preserves later manual moves.
          </p>
          <Form
            action="/api/v1/my-tasks/rules"
            next={here}
            label="Add section rule"
          >
            <Pick
              label="When in group"
              name="group"
              options={['Overdue', 'Today', 'Upcoming', 'Later'].map(
                (value) => ({ value, label: value }),
              )}
            />
            <Pick
              label="Move to section"
              name="sectionId"
              options={meta.sections.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
            />
            <Submit>Add rule</Submit>
          </Form>
          <ul className="rows">
            {meta.rules.map((r) => (
              <li key={r.id}>
                {r.group_name} →{' '}
                {meta.sections.find((s) => s.id === r.section_id)?.name}
              </li>
            ))}
          </ul>
          <ul className="rows">
            {meta.moves.map((m) => (
              <li key={m.id}>
                <span className="grow">
                  {tasks.find((t) => t.id === m.task_id)?.title ??
                    'Personal task'}{' '}
                  · {m.local_day}
                  {m.undone ? ' · undone' : ''}
                </span>
                {!m.undone && (
                  <Form
                    action={`/api/v1/my-tasks/moves/${m.id}/undo`}
                    next={here}
                    label="Undo section move"
                  >
                    <Submit quiet>Undo move</Submit>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {!on && <div data-personal-day={day} data-timezone={meta.settings.timezone}><script src="/personal-day.js" defer /></div>}
    </Shell>
  )
}
