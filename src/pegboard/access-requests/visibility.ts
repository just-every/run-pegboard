// Compute visibility from the work graph, never from how many hidden receipts exist.
import { workspacesOf, type Actor } from '../workspace/people'
import { listProjects } from '../workspace/projects'

export async function receiptProjects(db: D1Database, actor: Actor) {
  const projects = []
  for (const workspace of await workspacesOf(db, actor)) projects.push(...await listProjects(db, actor, workspace))
  return projects
}
