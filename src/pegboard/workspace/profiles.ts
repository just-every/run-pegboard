// Colleague reads project work through current grants; this door never creates access.
import { all, first, notFound } from '../db'
import { isRecoveryHidden } from '../recovery/visibility'
import type { ProjectRow, TaskRow } from '../model'
import { taskAccess } from '../authorization/effective'
import { sharesWithWorkspace } from '../authorization/levels'
import { capacityPeople } from '../capacity/profiles'
import { profileAvailability } from '../capacity/availability'
import { operatorRow, workspaceRole, type Actor } from './people'

async function colleague(db: D1Database, actor: Actor, workspace: string) {
  if (!await first(db, 'SELECT 1 FROM peg_workspaces WHERE id=?', workspace)
    || !sharesWithWorkspace(await workspaceRole(db, actor.id, workspace))
    || await first(db, 'SELECT 1 FROM peg_erased_people WHERE operator_id=?', actor.id)) throw notFound()
}

export async function colleagueDirectory(db: D1Database, actor: Actor, workspace: string) {
  await colleague(db, actor, workspace)
  return { workspace, people: (await capacityPeople(db, actor, workspace)).map(person => ({ id: person.id, name: person.name })) }
}

export async function teammateProfile(db: D1Database, actor: Actor, workspace: string, personId: string, input: Record<string, string> = {}) {
  await colleague(db, actor, workspace)
  const person = (await capacityPeople(db, actor, workspace)).find(person => person.id === personId)
  if (!person || !sharesWithWorkspace(await workspaceRole(db, personId, workspace))) throw notFound()
  const operator = await operatorRow(db, personId)
  if (!operator) throw notFound()
  const target: Actor = { id: personId, displayName: person.name, email: '', baseRole: operator.role as Actor['baseRole'] }
  // Select task identities rather than placement rows: shared work occurs exactly once.
  const candidates = await all<TaskRow>(db, 'SELECT * FROM peg_tasks WHERE workspace_id=? AND owner_id=? ORDER BY created_at,id', workspace, personId)
  const assignments: { id: string; title: string; status: string; dueDate: string | null; parentId: string | null; projects: { id: string; name: string }[] }[] = []
  for (const task of candidates) {
    const access = await taskAccess(db, actor, task)
    if (!access.capabilities.has('read') || !access.contexts.size || !(await taskAccess(db, target, task)).capabilities.has('read')) continue
    const projects: { id: string; name: string }[] = []
    for (const id of access.contexts.keys()) {
      const project = await first<ProjectRow>(db, 'SELECT * FROM peg_projects WHERE id=? AND workspace_id=?', id, workspace)
      if (project && !await isRecoveryHidden(db, 'project', project.id)) projects.push({ id: project.id, name: project.name })
    }
    if (!projects.length) continue
    let parentId: string | null = null
    if (task.parent_id) {
      const parent = await first<TaskRow>(db, 'SELECT * FROM peg_tasks WHERE id=?', task.parent_id)
      if (parent && (await taskAccess(db, actor, parent)).capabilities.has('read')) parentId = parent.id
    }
    assignments.push({ id: task.id, title: task.title, status: task.status, dueDate: task.due_date, parentId, projects })
  }
  return { workspace, person: { id: person.id, name: person.name }, assignments, availability: await profileAvailability(db, actor, workspace, person.id, input) }
}
