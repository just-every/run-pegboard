import type { visibilityPreview } from '../../tasks/personal'
import type { viewTask } from '../../tasks/view'
import type { Viewer } from '../../../ui/viewer'
import { Area, Card, Field, Form, Pick, Shell, Submit, levelLabel, when } from '../shell'

type View = Awaited<ReturnType<typeof viewTask>>
const kindLabel: Record<string, string> = { created: 'created the task', 'status.changed': 'changed the status', updated: 'edited the task', 'project.added': 'hung it in a project', 'project.removed': 'took it out of a project', 'section.changed': 'moved it to a section', 'fields.changed': 'changed project fields', 'comment.added': 'commented', 'attachment.added': 'attached a file', 'collaborators.changed': 'changed collaborators', 'internal.changed': 'changed internal notes' }
const statusLabel: Record<string, string> = { todo: 'To do', doing: 'Doing', done: 'Done' }

export function TaskPage({ viewer, task, addable, sections, preview, tagOptions }: { viewer: Viewer; task: View; addable: { value: string; label: string }[]; sections: Record<string, { value: string; label: string }[]>; preview: Awaited<ReturnType<typeof visibilityPreview>> | null; tagOptions: {value:string;label:string}[] }) {
  const can = (capability: string) => (task.capabilities as string[]).includes(capability)
  const here = `/app/tasks/${task.id}`
  const first = task.projects[0]
  return <Shell viewer={viewer} current="/app/projects" title={task.title} chip={statusLabel[task.status].toUpperCase()} facts={[task.ref ?? 'No reference', `Owner ${task.owner.name}`, `Priority ${task.priority}`, task.dueDate ? `Due ${task.dueDate}` : 'No due date', task.personal ? 'Personal task, only you see it' : `Your access ${levelLabel(task.level)}`]}
    crumbs={[...(first ? [{ label: first.name, href: `/app/projects/${first.id}` }] : [{ label: 'My tasks', href: '/app/my-tasks' }]), { label: task.ref ?? 'Task', href: here, current: true }]}>
    <Card title="Task">
      <p className="muted">Task ID <code>{task.id}</code>{task.ref && <> · reference <strong>{task.ref}</strong></>}{task.aliases.length > 0 && <> · earlier references {task.aliases.join(', ')}</>}</p>
      {task.description && <p>{task.description}</p>}
      {can('edit') && <div className="inline">
        <form method="post" action={`/api/v1/tasks/${task.id}/complete`}><input type="hidden" name="_next" value={here} />{task.status === 'done' ? <><input type="hidden" name="reopen" value="1" /><button className="button quiet" type="submit">Reopen</button></> : <button className="button primary" type="submit">Mark complete</button>}</form>
      </div>}
      {task.subtasks.length > 0 && <><h3>Subtasks</h3><ul className="rows">{task.subtasks.map(sub => <li key={sub.id}><span className="grow"><a href={`/app/tasks/${sub.id}`}>{sub.title}</a></span>{sub.ref && <small>{sub.ref}</small>}<span className={sub.status === 'done' ? 'tagline on' : 'tagline'}>{statusLabel[sub.status]}</span></li>)}</ul></>}
      {can('edit') && <Form action="/api/v1/tasks" next={here} label="Add a subtask"><input type="hidden" name="parentId" value={task.id} /><div className="inline"><Field label="New subtask" name="title" /><Submit quiet>Add subtask</Submit></div></Form>}
    </Card>
    {can('edit') && <Card title="Edit">
      <Form action={`/api/v1/tasks/${task.id}/update`} next={here} label="Edit task">
        <Field label="Title" name="title" value={task.title} required /><Area label="Description" name="description" value={task.description} />
        <div className="inline"><Pick label="Status" name="status" value={task.status} options={[{ value: 'todo', label: 'To do' }, { value: 'doing', label: 'Doing' }, { value: 'done', label: 'Done' }]} /><Pick label="Priority" name="priority" value={task.priority} options={['low', 'normal', 'high', 'urgent'].map(value => ({ value, label: value }))} /><Field label="Due" name="dueDate" type="date" value={task.dueDate} /><Field label="Estimate (hours)" name="estimateHours" type="number" value={task.estimateHours} /></div>
        {'internalNotes' in task && <Area label="Internal notes (members only)" name="internalNotes" value={task.internalNotes} />}
        <Submit>Save</Submit>
      </Form>
    </Card>}
    {task.projects.length > 0 && <Card title="Projects">
      <ul className="rows">{task.projects.map(project => <li key={project.id}><span className="grow"><a href={`/app/projects/${project.id}`}>{project.name}</a><br /><small>Section {project.section?.name ?? 'none'} · your access {levelLabel(project.level)}</small></span>
        {project.level && ['editor', 'admin'].includes(project.level) && <form method="post" action={`/api/v1/tasks/${task.id}/section`}><input type="hidden" name="_next" value={here} /><input type="hidden" name="projectId" value={project.id} /><select className="select" name="sectionId" defaultValue={project.section?.id} aria-label={`Section in ${project.name}`}>{(sections[project.id] ?? []).map(section => <option key={section.value} value={section.value}>{section.label}</option>)}</select><button className="button quiet" type="submit">Move</button></form>}
        {project.level && ['editor', 'admin'].includes(project.level) && task.projects.length > 1 && <form method="post" action={`/api/v1/tasks/${task.id}/projects/${project.id}/remove`}><input type="hidden" name="_next" value={here} /><button className="button quiet" type="submit">Take out</button></form>}
        {project.fields.length > 0 && <form method="post" action={`/api/v1/tasks/${task.id}/fields`} className="stack" aria-label={`Fields in ${project.name}`}><input type="hidden" name="_next" value={here}/><input type="hidden" name="projectId" value={project.id}/><div className="inline">{project.fields.map(field=><label className="field" key={field.key}>{field.label}{field.units?` (${field.units})`:''}
 {!field.canEdit||field.type==='formula'?<output>{field.error?`Error: ${field.error}`:field.display}</output>:['rollup','people','multi'].includes(field.type)?<><input type="hidden" name={`field:${field.key}[]`} value=""/><select className="select" name={`field:${field.key}[]`} multiple defaultValue={Array.isArray(field.input)?field.input:[]} aria-label={`${field.label}: ${field.type==='rollup'?'related tasks':field.type==='people'?'people':'choices'}`}>{(field.type==='multi'?field.options.map(value=>({value,label:value})):field.choices).map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select>{field.type==='rollup'&&<output>{field.error?`Error: ${field.error}`:field.display}</output>}</>:['single','checkbox'].includes(field.type)?<select className="select" name={`field:${field.key}`} defaultValue={String(field.value??'')}><option value="">No value</option>{(field.type==='checkbox'?['true','false']:field.options).map(v=><option key={v} value={v}>{v}</option>)}</select>:<input className="input" name={`field:${field.key}`} type={['number','currency'].includes(field.type)?'number':field.type==='date'?'date':'text'} step="any" defaultValue={typeof field.input==='string'||typeof field.input==='number'?field.input:''}/>}</label>)}{project.level&&['editor','admin'].includes(project.level)&&<button className="button quiet" type="submit">Save fields</button>}</div></form>}</li>)}</ul>
      {can('edit') && addable.length > 0 && !task.personal && task.parentId === null && <>
        <Form action={`/api/v1/tasks/${task.id}/projects`} next={here} label="Add to a project"><div className="inline"><Pick label="Also hang it in" name="projectId" options={addable} /><Submit quiet>Add to project</Submit></div></Form>
        {task.projects.length === 1 && <Form action={`/api/v1/tasks/${task.id}/move`} next={here} label="Move to a project"><input type="hidden" name="from" value={task.projects[0].id} /><div className="inline"><Pick label="Move it to" name="to" options={addable} /><Submit quiet>Move to project</Submit></div></Form>}
      </>}
    </Card>}
    {task.personal&&task.parentId===null&&<Card title="Share personal work"><p>Only you can see this task. Review the exact project audience before sharing.</p><form method="get" action={here} className="stack" aria-label="Preview personal sharing"><Pick label="Project" name="projectId" options={addable}/><Submit quiet>Preview visibility</Submit></form>{preview&&<><h3>Visibility preview: {preview.project}</h3><p>{preview.notice}</p><ul className="rows">{preview.audience.map(a=><li key={a.id}>{a.name} · {levelLabel(a.level)}</li>)}</ul><p>Work included: {preview.content.map(t=>t.title).join(', ')}</p><Form action={`/api/v1/tasks/${task.id}/share-personal`} next={here} label="Approve personal sharing"><input type="hidden" name="projectId" value={preview.projectId}/><input type="hidden" name="previewRevision" value={preview.token}/><Submit>Share with reviewed audience</Submit></Form></>}</Card>}
    <Card title="Tags"><p><a href="/app/tags">Browse and filter tags</a></p><ul className="rows">{task.tags.map(t=><li key={t.id}><span className="grow">{t.name}{t.archived?' · Archived':''}</span>{can('edit')&&<Form action={`/api/v1/tasks/${task.id}/tags`} next={here} label={`Remove ${t.name}`}><input type="hidden" name="tagId" value={t.id}/><input type="hidden" name="remove" value="true"/><Submit quiet>Remove tag</Submit></Form>}</li>)}</ul>{can('edit')&&<Form action={`/api/v1/tasks/${task.id}/tags`} next={here} label="Tag task"><Pick label="Tag" name="tagId" options={tagOptions}/><Submit quiet>Add tag</Submit></Form>}</Card>
    <Card title="Conversation">
      <ul className="rows">{task.comments.map(comment => <li key={comment.id}><span className="grow"><strong>{comment.author}</strong> <small>{when(comment.at)}</small><br />{comment.body}</span></li>)}{task.comments.length === 0 && <li>No comments yet.</li>}</ul>
      {can('comment') && <Form action={`/api/v1/tasks/${task.id}/comments`} next={here} label="Comment"><Area label="Comment" name="body" /><Submit>Comment</Submit></Form>}
      <h3>Files</h3>
      <ul className="rows">{task.attachments.map(file => <li key={file.id}><span className="grow"><a href={`/api/v1/attachments/${file.id}`}>{file.name}</a> <small>{file.size} bytes · {file.by}</small></span></li>)}{task.attachments.length === 0 && <li>No files.</li>}</ul>
      {can('comment') && !task.personal && <form method="post" action={`/api/v1/tasks/${task.id}/attachments`} encType="multipart/form-data" className="stack"><input type="hidden" name="_next" value={here} /><div className="inline"><Pick label="Attach through" name="projectId" options={task.projects.map(project => ({ value: project.id, label: project.name }))} /><label className="field">File<input className="input" type="file" name="file" required /></label><Submit quiet>Attach</Submit></div></form>}
    </Card>
    <Card title="History">
      <ol className="rows history">{[...task.history].reverse().map(entry => <li key={entry.id}><span className="grow"><strong>{entry.actor}</strong> {kindLabel[entry.kind] ?? entry.kind} <small>{when(entry.at)}</small></span></li>)}</ol>
    </Card>
  </Shell>
}
