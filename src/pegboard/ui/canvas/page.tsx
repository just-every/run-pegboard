import type { Viewer } from '../../../ui/viewer'
import { Shell, Card, Field, Pick, Form, Check, Submit } from '../shell'

export interface CanvasNode {
  id: string; parentId: string | null; title: string; kind: 'note' | 'phase' | 'task'
  internalOnly: boolean; version: number; position: number
  task: { id: string; title: string; status: string; owner: { id: string; name: string } | null } | null
}
export interface CanvasData {
  project: { id: string; name: string }; canEdit: boolean; canExport: boolean
  nodes: CanvasNode[]; people: { value: string; label: string }[]
}
const titleOf = (node: CanvasNode) => node.task?.title ?? node.title
const kindOf = (node: CanvasNode) => node.kind === 'phase' ? 'Phase' : node.kind === 'task' ? 'Task' : 'Note'
const detailOf = (node: CanvasNode) => [kindOf(node), node.internalOnly ? 'Internal only' : 'Project audience', ...(node.task ? [node.task.status, node.task.owner?.name ?? 'Unassigned'] : [])].join(' · ')

function Branches({ nodes, parentId, next, selected, depth = 0, ancestors = [] }: {
  nodes: CanvasNode[]; parentId: string | null; next: string; selected: string | null; depth?: number; ancestors?: string[]
}) {
  const children = nodes.filter(node => node.parentId === parentId && !ancestors.includes(node.id)).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  if (!children.length) return null
  return <ul className="canvas-branches">{children.map(node => <li key={node.id} data-canvas-node={node.id} className={depth >= 3 ? 'canvas-deep' : undefined}>
    <article className="card canvas-node" data-kind={node.kind}>
      <span className="peg" aria-hidden="true" />
      <a className="canvas-node-title" data-canvas-select href={`${next}?node=${encodeURIComponent(node.id)}`} aria-current={selected === node.id ? 'true' : undefined}>{titleOf(node)}</a>
      <p className="canvas-node-detail" data-canvas-detail>{detailOf(node)}</p>
      <a className="canvas-task-link" data-canvas-task href={node.task ? `/app/tasks/${encodeURIComponent(node.task.id)}` : undefined} hidden={!node.task}>{node.task ? `Open task ${node.task.id}` : 'Open task'}</a>
    </article>
    <Branches nodes={nodes} parentId={node.id} next={next} selected={selected} depth={depth + 1} ancestors={[...ancestors, node.id]} />
  </li>)}</ul>
}

function parentOptions(nodes: CanvasNode[], selected?: string) {
  const excluded = new Set(selected ? [selected] : [])
  let previous = -1
  while (previous !== excluded.size) {
    previous = excluded.size
    for (const node of nodes) if (node.parentId && excluded.has(node.parentId)) excluded.add(node.id)
  }
  return nodes.filter(node => !excluded.has(node.id)).map(node => ({ value: node.id, label: `${kindOf(node)} · ${titleOf(node)}` }))
}

export function CanvasPage({ viewer, data, selected }: { viewer: Viewer; data: CanvasData; selected: string | null }) {
  const projectPath = `/app/projects/${encodeURIComponent(data.project.id)}`
  const next = `${projectPath}/canvas`, api = `/api/v1/projects/${encodeURIComponent(data.project.id)}/canvas`
  const node = data.nodes.find(item => item.id === selected)
  return <Shell viewer={viewer} current="/app/projects" title="Planning canvas" chip="PLAN" facts={['Phases, notes and linked tasks', 'Placement changes no dates']} crumbs={[{ label: 'Projects', href: '/app/projects' }, { label: 'Project Path', href: projectPath }]}>
    <div className="canvas-workspace" data-canvas-project={data.project.id} data-canvas-selected={node?.id ?? ''}>
      <nav className="canvas-toolbar" aria-label="Project planning views">
        <a className="button quiet" href={projectPath}>Project Path</a>
        <a className="button quiet" href={`${projectPath}?view=list`}>Task List</a>
        {data.canExport && <a className="button quiet" data-canvas-export href={`${api}/export`} download>Export canvas JSON</a>}
      </nav>
      <p className="muted canvas-sync" data-canvas-sync role="status" aria-live="polite">Showing the saved canvas. Live updates connect when JavaScript is available.</p>
      <Card>
        <h2 data-canvas-project-name>{data.project.name}</h2>
        <p className="muted">Select a planning item to rearrange its branch.</p>
        <div className="canvas-map" data-canvas-map aria-label="Project planning tree">
          <div className="canvas-root"><span className="peg" aria-hidden="true" /><strong data-canvas-root-name>{data.project.name}</strong></div>
          <Branches nodes={data.nodes} parentId={null} next={next} selected={selected} />
        </div>
        <p data-canvas-empty hidden={data.nodes.length > 0}>No planning items yet. Add a note or phase to start a branch.</p>
      </Card>
      {node && <div data-canvas-editor={node.id}>
        <Card title="Selected planning item">
          <p className="canvas-selected-title" data-canvas-editor-title>{titleOf(node)}</p>
          <p className="muted" data-canvas-editor-detail>{detailOf(node)}</p>
          <p data-canvas-editor-task hidden={!node.task}>{node.task && <><span data-canvas-task-id>Task {node.task.id} · </span><a href={`${projectPath}?view=list`}>Edit in List</a></>}</p>
          {data.canEdit && <div data-canvas-write>
            <p className="notice" data-canvas-conflict role="status" hidden>This item changed while you were editing. Your draft is still here. Load the current revision before saving.</p>
            <button type="button" className="button quiet" data-canvas-reload hidden>Load current revision</button>
            <Form action={`${api}/nodes/${encodeURIComponent(node.id)}/update`} next={next} label="Edit planning item">
              <fieldset className="canvas-form-fields" data-canvas-revision={node.version}>
                <input type="hidden" name="version" value={node.version} />
                {!node.task && <Field label="Planning item title" name="title" value={titleOf(node)} required />}
                <Pick label="Parent branch" name="parentId" value={node.parentId} options={parentOptions(data.nodes, node.id)} blank="Project root" />
                <Field label="Position within branch (lower comes first)" name="position" type="number" step="1" value={node.position} required />
                <details><summary>Moving and visibility</summary><p>The parent and position controls move this item and its branch. Visibility stays {node.internalOnly ? 'internal only' : 'with the project audience'}.</p></details>
                <Submit>Save planning item</Submit>
              </fieldset>
            </Form>
            {node.kind === 'note' && <div data-canvas-promotion>
              <h3>Turn this note into a task</h3>
              <p>The saved note title becomes the task title. Its audience is preserved. The new task has no deadline.</p>
              <Form action={`${api}/nodes/${encodeURIComponent(node.id)}/promote`} next={next} label="Promote note to task">
                <fieldset className="canvas-form-fields" data-canvas-revision={node.version}>
                  <input type="hidden" name="version" value={node.version} />
                  <Pick label="Accountable owner" name="ownerId" options={data.people} blank="Choose an owner" />
                  <label className="checkbox"><input type="checkbox" name="confirm" required />I approve creating this task for {node.internalOnly ? 'the internal project audience only' : 'the project audience, including guests with access'}.</label>
                  <Submit>Promote note to task</Submit>
                </fieldset>
              </Form>
            </div>}
          </div>}
        </Card>
      </div>}
      {selected && !node && <Card title="Planning item unavailable"><p>Choose an item from the current canvas.</p></Card>}
      {data.canEdit && <div data-canvas-write data-canvas-add>
        <Card title="Add planning item">
          <Form action={`${api}/nodes`} next={next} label="Add planning item">
            <fieldset className="canvas-form-fields">
              <Field label="Planning item title" name="title" required />
              <Pick label="Item kind" name="kind" options={[{ value: 'note', label: 'Note' }, { value: 'phase', label: 'Phase' }]} />
              <Pick label="Parent branch" name="parentId" options={parentOptions(data.nodes)} blank="Project root" />
              <Field label="Position within branch (lower comes first)" name="position" type="number" step="1" value={0} required />
              <Check label="Internal only: hide this item from project guests" name="internalOnly" />
              <Submit>Add planning item</Submit>
            </fieldset>
          </Form>
        </Card>
      </div>}
      <details><summary>Export and restore</summary><p>Canvas JSON is a snapshot for inspection. Restore the saved canvas through the native installation archive workflow.</p></details>
    </div>
  </Shell>
}
