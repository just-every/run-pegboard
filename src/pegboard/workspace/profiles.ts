import { all, first, notFound } from '../db'
import type { TaskRow } from '../model'
import { taskAccess } from '../authorization/effective'
import { capacityPeople } from '../capacity/profiles'
import { workspaceRole, type Actor } from './people'

async function colleague(db: D1Database, actor: Actor, workspace: string) {
  const role = await workspaceRole(db, actor.id, workspace)
  if (!role || role === 'guest' || role === 'agent' || actor.apiScope ||
      await first(db, 'SELECT 1 FROM peg_erased_people WHERE operator_id=?', actor.id)) throw notFound()
}

/** A colleague directory contains names, never account or administrative details. */
export async function teammateDirectory(db: D1Database, actor: Actor, workspace: string) {
  await colleague(db, actor, workspace)
  return (await capacityPeople(db, actor, workspace)).map(person => ({ id: person.id, name: person.name }))
}

export async function teammateProfile(db: D1Database, actor: Actor, workspace: string, operator: string) {
  await colleague(db, actor, workspace)
  const person = (await capacityPeople(db, actor, workspace)).find(person => person.id === operator)
  if (!person) throw notFound()
  const rows = await all<TaskRow>(db, `SELECT t.* FROM peg_tasks t WHERE t.workspace_id=? AND
    (t.owner_id=? OR EXISTS (SELECT 1 FROM peg_task_collaborators c WHERE c.task_id=t.id AND c.operator_id=?))
    ORDER BY COALESCE(t.due_date,'9999'),t.created_at,t.id`, workspace, operator, operator)
  const assignments = []
  for (const task of rows) {
    const access = await taskAccess(db, actor, task)
    // Even the subject's own profile is a shared-work view, with no private-work totals.
    if (access.personal || !access.capabilities.has('read')) continue
    assignments.push({ id: task.id, title: task.title, status: task.status, dueDate: task.due_date })
  }
  return { person: { id: person.id, name: person.name }, availability: { zone: person.zone, week: person.week }, assignments }
}
