import { all, notFound } from '../db'
import { isRecoveryHidden } from '../recovery/visibility'
import { teamEffective } from '../authorization/effective'
import { loadTeam } from '../authorization/grants'
import type { ProjectRow } from '../model'
import { openProject } from '../workspace/projects'
import type { Actor } from '../workspace/people'

export const teamScope = (id: string) => id.startsWith('team_')
export const viewTable = (id: string) => teamScope(id) ? 'peg_team_work_views' : 'peg_work_views'
export const defaultTable = (id: string) => teamScope(id) ? 'peg_team_work_view_defaults' : 'peg_work_view_defaults'
export const scopeKey = (id: string) => teamScope(id) ? 'team_id' : 'project_id'
export const scopeId = (row: { project_id?: string; team_id?: string }) => row.team_id ?? row.project_id!
/** Team discovery alone supplies no saved-view or underlying project authority. */
export async function openViewScope(db: D1Database, actor: Actor, id: string) {
  if (!teamScope(id)) {
    const opened = await openProject(db, actor, id)
    return { ...opened, scope: 'project' as const }
  }
  const team = await loadTeam(db, id)
  if (!team) throw notFound()
  const effective = await teamEffective(db, actor, team)
  if (!effective.capabilities.has('read')) throw notFound()
  return { project: team, effective, scope: 'team' as const }
}
export async function scopeProjects(db: D1Database, actor: Actor, id: string) {
  const opened = await openViewScope(db, actor, id)
  if (opened.scope === 'project') return [(await openProject(db, actor, id)).project]
  const projects = []
  for (const project of await all<ProjectRow>(db, 'SELECT * FROM peg_projects WHERE team_id=? AND workspace_id=? ORDER BY created_at,id', id, opened.project.workspace_id)) {
    if (await isRecoveryHidden(db, 'project', project.id)) continue
    const readable = await openProject(db, actor, project.id).catch(error => { if (error?.status === 404) return null; throw error })
    if (readable) projects.push(project)
  }
  return projects
}
