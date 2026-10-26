import { all, bound, conflict, invalid, newId, now } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { auditStatement } from '../authorization/audit'
import { displayNames, type Actor } from '../workspace/people'
import type { TaskProjectRow, TaskRow } from '../model'
import { historyStatement, reopenGuard } from '../tasks/history'
import { conversionPerson } from './context'
import { conversionStatements, conversionView, operationReplay, type ConversionEffect, type ConversionLink } from './operations'
import { reconcileConversion } from './reconciliation'
import { hierarchyGraph, type HierarchyInput } from './hierarchy-graph'
import { hierarchyAudience } from './hierarchy-scope'

export type { HierarchyInput } from './hierarchy-graph'

interface HierarchyState {
  parentId: string | null; kind: TaskRow['kind']; ownerId: string; owner: string;
  collaborators: string[]; startDate: string | null; dueDate: string | null;
  estimateHours: number; status: TaskRow['status'];
}
interface HierarchyMapping { id: string; title: string; before: HierarchyState; after: HierarchyState; retained: boolean }

function normalize(input: Record<string, any>): HierarchyInput {
  if (input.kind !== 'promote' && input.kind !== 'demote') throw invalid('conversion_kind')
  for (const key of ['sourceId', 'targetProjectId', 'parentId']) {
    if (key === 'sourceId' || input[key] !== undefined && input[key] !== '') {
      if (typeof input[key] !== 'string' || !input[key] || input[key].length > 160) throw invalid('conversion_identity')
    }
  }
  return { kind: input.kind, sourceId: input.sourceId, ...(input.targetProjectId ? { targetProjectId: input.targetProjectId } : {}), ...(input.parentId ? { parentId: input.parentId } : {}) }
}

async function planHierarchyConversion(db: D1Database, actor: Actor, workspace: string, input: Record<string, any>) {
  await conversionPerson(db, actor, workspace)
  const options = normalize(input), rev = await revision(db), graph = await hierarchyGraph(db, actor, workspace, options)
  const visibility = await hierarchyAudience(db, actor, graph)
  const reconciliation = await reconcileConversion(db, actor, graph.work.map(row => row.id))
  const changedIds = new Set([...graph.work, ...graph.oldChain, ...graph.nextChain].map(row => row.id))
  const approvals = new Set((await all<{ task_id: string }>(db, 'SELECT a.task_id FROM peg_approval_tasks a JOIN peg_tasks t ON t.id=a.task_id WHERE t.workspace_id=?', workspace)).map(row => row.task_id))
  const reopens = graph.affected.filter(task => changedIds.has(task.id) && task.status === 'done' && approvals.has(task.id))
  const reopensIds = new Set(reopens.map(task => task.id))
  const names = await displayNames(db, graph.affected.map(row => row.owner_id))
  const mapping: HierarchyMapping[] = []
  for (const task of graph.affected) {
    const collaborators = await all<{ operator_id: string }>(db, 'SELECT operator_id FROM peg_task_collaborators WHERE task_id=? ORDER BY operator_id', task.id)
    const state = { parentId: task.parent_id, kind: task.kind, ownerId: task.owner_id, owner: names.get(task.owner_id) ?? 'Former member', collaborators: collaborators.map(row => row.operator_id), startDate: task.start_date, dueDate: task.due_date, estimateHours: task.estimate_hours, status: task.status }
    const changed = task.id === graph.source.id
    mapping.push({ id: task.id, title: task.title, before: state, after: { ...state, ...(changed ? { parentId: graph.parent?.id ?? null, kind: options.kind === 'promote' ? 'task' : 'subtask' } : {}), ...(reopensIds.has(task.id) ? { status: 'todo' as const } : {}) }, retained: true })
  }
  const capacity = [...new Set(mapping.map(row => row.before.ownerId))].map(ownerId => {
    const work = mapping.filter(row => row.before.ownerId === ownerId)
    const beforeHours = work.filter(row => row.before.status !== 'done').reduce((sum, row) => sum + row.before.estimateHours, 0)
    const afterHours = work.filter(row => row.after.status !== 'done').reduce((sum, row) => sum + row.after.estimateHours, 0)
    return { ownerId, owner: names.get(ownerId) ?? 'Former member', beforeHours, afterHours, addedHours: afterHours - beforeHours, from: work.flatMap(row => row.before.startDate ? [row.before.startDate] : []).sort()[0] ?? null, to: work.flatMap(row => row.before.dueDate ? [row.before.dueDate] : []).sort().at(-1) ?? null }
  })
  const memberships = { before: graph.beforeHomes.map(row => ({ projectId: row.project_id, sectionId: row.section_id })), after: graph.afterHomes.map(row => ({ projectId: row.project_id, sectionId: row.section_id })) }
  const payload = {
    ...options,
    source: { type: 'task' as const, id: graph.source.id, title: graph.source.title },
    target: { type: 'task' as const, id: graph.source.id, title: graph.source.title },
    parent: graph.parent ? { id: graph.parent.id, title: graph.parent.title } : null,
    mapping, work: mapping, memberships, reconciliation, counts: { tasks: reconciliation.tasks, comments: reconciliation.comments, files: reconciliation.files, proofVersions: reconciliation.proofVersions, timeEntries: reconciliation.timeEntries, timeSeconds: reconciliation.timeSeconds, aliases: reconciliation.aliases, dependencies: reconciliation.dependencies, history: reconciliation.history, fields: reconciliation.fields },
    visibility, audience: visibility, capacity, dependencies: reconciliation.manifest.dependencies, fields: reconciliation.manifest.fields,
    repairs: [], reopens: reopens.map(task => ({ id: task.id, title: task.title })), warnings: reopens.length ? ['Completed approval tasks in the affected structure reopen for a fresh human decision.'] : [], rev,
  }
  return { graph, options, reopens, preview: { ...payload, token: await digest([actor.id, workspace, payload]) } }
}

export async function previewHierarchyConversion(db: D1Database, actor: Actor, workspace: string, input: Record<string, any>) {
  return (await planHierarchyConversion(db, actor, workspace, input)).preview
}

export async function applyHierarchyConversion(db: D1Database, actor: Actor, workspace: string, input: Record<string, any>) {
  const replay = await operationReplay(db, actor, workspace, input)
  if (replay) return replay
  const { graph, options, preview, reopens } = await planHierarchyConversion(db, actor, workspace, input)
  if (typeof input.token !== 'string' || input.token !== preview.token) throw conflict('conversion_review_changed')
  const at = now(), id = newId('conversion'), source = graph.source
  const effects: ConversionEffect[] = [{ kind: 'task_structure', taskId: source.id, before: { parentId: source.parent_id, kind: source.kind }, after: { parentId: graph.parent?.id ?? null, kind: options.kind === 'promote' ? 'task' : 'subtask' } }]
  const statements: D1PreparedStatement[] = []
  // Reopen before changing memberships, whose native triggers also invalidate approval completion.
  for (const task of reopens) statements.push(reopenGuard(db, task.id, actor.id, 'work_conversion'), bound(db, "UPDATE peg_tasks SET status='todo',completed_at=NULL,updated_at=? WHERE id=? AND status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=?)", [at, task.id, task.id]))
  statements.push(bound(db, 'UPDATE peg_tasks SET parent_id=?,kind=?,updated_at=? WHERE id=?', [graph.parent?.id ?? null, options.kind === 'promote' ? 'task' : 'subtask', at, source.id]))
  const existing = await all<TaskProjectRow>(db, 'SELECT * FROM peg_task_projects WHERE task_id=? ORDER BY project_id', source.id)
  const homes: TaskProjectRow[] = options.kind === 'promote' ? graph.afterHomes.map(home => ({ ...home, task_id: source.id, fields: '{}', added_by: actor.id, added_at: at })) : []
  for (const projectId of [...new Set([...existing, ...homes].map(home => home.project_id))]) {
    const before = existing.find(home => home.project_id === projectId) ?? null, after = homes.find(home => home.project_id === projectId) ?? null
    effects.push({ kind: 'placement', taskId: source.id, projectId, before, after })
    if (before) statements.push(bound(db, 'DELETE FROM peg_task_projects WHERE task_id=? AND project_id=?', [source.id, projectId]))
    if (after) statements.push(bound(db, 'INSERT INTO peg_task_projects(task_id,project_id,section_id,fields,position,added_by,added_at) VALUES(?,?,?,?,?,?,?)', [after.task_id, after.project_id, after.section_id, after.fields, after.position, after.added_by, after.added_at]))
  }
  const links: ConversionLink[] = [...graph.work.map(task => ({ type: 'task' as const, id: task.id, relation: 'work' })), ...graph.affected.map(task => ({ type: 'task' as const, id: task.id, relation: 'authority' })), ...[...new Set([...graph.beforeHomes, ...graph.afterHomes].map(home => home.project_id))].map(projectId => ({ type: 'project' as const, id: projectId, relation: 'context' }))]
  const { manifest: _, ...summary } = preview.reconciliation
  statements.push(historyStatement(db, source.id, null, actor.id, 'work.converted', { conversionId: id, kind: options.kind }), auditStatement(db, { workspaceId: workspace, actorId: actor.id, action: 'task.structure_changed', targetType: 'task', targetId: source.id, detail: { conversionId: id } }), ...conversionStatements(db, actor, workspace, {
    id, kind: options.kind, sourceType: 'task', sourceId: source.id, targetType: 'task', targetId: source.id, token: preview.token,
    options: { ...options, sourceId: source.id, mapping: graph.work.map(task => ({ id: task.id, parentId: task.id === source.id ? graph.parent?.id ?? null : task.parent_id })) }, reconciliation: summary, effects, links,
  }))
  try {
    await guarded(db, preview.rev, statements)
  } catch (error) {
    // A concurrent submission may commit this exact reviewed token while this batch waits.
    // Replay still rechecks every current authority fence before returning the survivor.
    const committed = await operationReplay(db, actor, workspace, input)
    if (committed) return committed
    throw error
  }
  return conversionView(db, actor, id)
}
