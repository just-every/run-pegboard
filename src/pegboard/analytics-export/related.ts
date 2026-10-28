import { all, first } from '../db'
import { decisionPreview } from '../decisions/tasks'
import { routeFor, routeView } from '../approvals/routing'
import { proofView } from '../records/custody'
import { goalView } from '../goals/goals'
import { openPortfolio } from '../portfolios/portfolios'
import { projectTaskIds } from '../fields/definitions'
import { openTask } from '../tasks/access'
import { keyActor, type AnalystKey } from './keys'
import { portfolioProjects, type Scopes } from './scopes'
import type { Dataset } from './schema'

export type AddRow = (dataset: Dataset, record: Record<string, unknown>, taskId: string | null, projectId: string | null) => Promise<void>
export async function relatedRows(db: D1Database, key: AnalystKey, tasks: Set<string>, add: AddRow) {
  const fields = JSON.parse(key.fields)
  const actor = keyActor(key), scopes: Scopes = JSON.parse(key.scopes), projects: string[] = JSON.parse(key.projects)
  for (const id of fields.Portfolios || fields.PortfolioProjects ? scopes.portfolios ?? [] : []) {
    if (!await first(db, 'SELECT 1 FROM peg_portfolios WHERE id=?', id)) continue
    const { portfolio } = await openPortfolio(db, actor, id), ids = await portfolioProjects(db, id), work = new Map<string, { status: string; estimate_hours: number; kind: string }>()
    for (const { project_id } of ids) {
      await add('PortfolioProjects', { id: id + ':' + project_id, portfolioId: id, projectId: project_id }, null, project_id)
      for (const row of await projectTaskIds(db, project_id)) if (tasks.has(row.task_id)) work.set(row.task_id, (await openTask(db, actor, row.task_id)).task)
    }
    await add('Portfolios', { id, name: portfolio.name, parentId: scopes.portfolios.includes(portfolio.parent_id ?? '') ? portfolio.parent_id : null,
      taskCount: [...work.values()].filter(t => t.kind !== 'milestone').length, doneCount: [...work.values()].filter(t => t.kind !== 'milestone' && t.status === 'done').length, estimateHours: [...work.values()].filter(t => t.kind !== 'milestone').reduce((n, t) => n + t.estimate_hours, 0) }, null, null)
  }
  for (const id of fields.Goals || fields.GoalLinks ? scopes.goals ?? [] : []) {
    if (!await first(db, 'SELECT 1 FROM peg_goals WHERE id=?', id)) continue
    const view = await goalView(db, actor, id)
    await add('Goals', { id, title: view.goal.title, kind: view.goal.kind, mode: view.goal.mode, unit: view.unit, progressPercent: view.progress,
      state: view.states.length ? view.states.join(',') : 'current', observedAt: view.freshness }, null, null)
    for (const link of view.links) await add('GoalLinks', { id: id + ':' + link.source_type + ':' + link.source_id, goalId: id, sourceType: link.source_type, sourceId: link.source_id, weight: link.weight }, link.source_type === 'task' ? link.source_id : null, link.source_type === 'project' ? link.source_id : null)
  }
  if (fields.Requests) for (const request of await all<{ id: string; task_id: string; project_id: string; created_at: number }>(db, 'SELECT * FROM peg_rule_requests ORDER BY id')) {
    if (!projects.includes(request.project_id) || !tasks.has(request.task_id)) continue
    const { task } = await openTask(db, actor, request.task_id)
    await add('Requests', { id: request.id, taskId: task.id, projectId: request.project_id, createdAt: request.created_at, status: task.status }, task.id, request.project_id)
  }
  if (fields.Approvals) for (const taskId of tasks) {
    if (await first(db, 'SELECT 1 FROM peg_approval_tasks WHERE task_id=?', taskId)) {
      const route = await routeFor(db, 'task', taskId), view = route ? await routeView(db, actor, route.id) : await decisionPreview(db, actor, taskId)
      await add('Approvals', { id: 'task:' + taskId, taskId, kind: 'task', subjectId: taskId, version: route?.version ?? String((await openTask(db, actor, taskId)).task.updated_at), state: view.state }, taskId, null)
    }
    for (const proof of await all<{ id: string; current_version: string }>(db, 'SELECT id,current_version FROM peg_proofs WHERE task_id=?', taskId)) {
      const file = await first<{ project_id: string | null }>(db, 'SELECT a.project_id FROM peg_attachments a JOIN peg_proof_versions v ON v.attachment_id=a.id WHERE v.id=?', proof.current_version)
      if (!file?.project_id || !projects.includes(file.project_id)) continue
      const view = await proofView(db, actor, proof.id)
      await add('Approvals', { id: 'proof:' + proof.id, taskId, kind: 'proof', subjectId: proof.id, version: proof.current_version,
        state: ({ approve: 'approved', reject: 'rejected', changes: 'changes_requested' } as Record<string, string>)[view.state] ?? view.state }, taskId, file.project_id)
    }
  }
}
