import { lifecyclePreview, validateLifecycle } from '../admin/lifecycle'
import { removalPreview, removeReviewedPerson } from '../admin/departure/removal'
import {readableDefinitions} from '../fields/definitions'
// /api/v1: workspaces, people, teams, projects and their settings.
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { operatorAuth } from '../../auth.server'
import { all, batch, bound, forbidden, invalid, newId, notFound, now } from '../db'
import { auditStatement } from '../authorization/audit'
import { isAdministrator } from '../authorization/levels'
import { addPerson, changeBaseAccount, listPeople, setPersonRole, updateSettings } from '../admin/settings'
import { teamEffective } from '../authorization/effective'
import { loadTeam } from '../authorization/grants'
import { addField, addSection, createProject, fieldLibrary, listProjects, mapSection, previewShare, updateProject } from '../workspace/projects'
import { createTeam, joinTeam, listTeams, teamMembers, updateTeam } from '../workspace/teams'
import { workspaceRole, workspaceSettings, workspacesOf } from '../workspace/people'
import { board, exportRows, rollup, toCsv } from '../tasks/board'
import { changePrefix } from '../tasks/tasks'
import { door, flag, json } from './door'

type App = Hono<{ Bindings: Bindings }>
const list = (value: unknown) => Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? value.split(',').map(part => part.trim()).filter(Boolean) : undefined

export function workspaceRoutes(app: App) {
  app.get('/me', door(async ({ actor, db }) => ({ id: actor.id, email: actor.email, name: actor.displayName, baseRole: actor.baseRole, workspaces: await Promise.all((await workspacesOf(db, actor)).map(async id => ({ id, role: await workspaceRole(db, actor.id, id) }))) })))
  app.get('/workspaces', door(async ({ actor, db }) => {
    const ids = await workspacesOf(db, actor)
    const rows = await all<{ id: string; name: string }>(db, `SELECT id,name FROM peg_workspaces WHERE id IN (${ids.map(() => '?').join(',') || 'NULL'}) ORDER BY created_at`, ...ids)
    return { workspaces: await Promise.all(rows.map(async row => { const role = await workspaceRole(db, actor.id, row.id); return { ...row, role, settings: isAdministrator(role) ? await workspaceSettings(db, row.id) : undefined } })) }
  }))
  app.post('/workspaces', door(async ({ actor, db, input }) => {
    if (actor.baseRole === 'member') throw forbidden('administer')
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name || name.length > 120) throw invalid('name')
    const id = newId('ws')
    await batch(db, [bound(db, "INSERT INTO peg_workspaces(id,name,settings,created_at) VALUES (?,?,'{}',?)", [id, name, now()]), auditStatement(db, { workspaceId: id, actorId: actor.id, action: 'workspace.created', targetType: 'workspace', targetId: id })])
    return { id, name }
  }))
  app.get('/workspaces/:id/settings', door(async ({ actor, db, params }) => { if (!isAdministrator(await workspaceRole(db, actor.id, params.id))) throw notFound(); return workspaceSettings(db, params.id) }))
  app.patch('/workspaces/:id/settings', door(({ actor, db, params, input }) => updateSettings(db, actor, params.id, input), { next: () => '/app/admin' }))
  app.post('/workspaces/:id/settings', door(({ actor, db, params, input }) => {
    // A form carries strings and unchecked boxes: read each setting from its own field.
    const patch: Record<string, unknown> = {}
    for (const key of ['workspaceSharing', 'guestsAllowed', 'integrationsEnabled']) if (key in input || input[`${key}_present`]) patch[key] = flag(input[key])
    for (const key of ['requestExpiryDays', 'requestRetentionDays']) if (input[key] !== undefined && input[key] !== '') patch[key] = Number(input[key])
    for (const key of ['invitePolicy', 'exportMinLevel']) if (input[key]) patch[key] = input[key]
    return updateSettings(db, actor, params.id, patch)
  }, { next: () => '/app/admin' }))
  app.get('/workspaces/:id/people', door(async ({ actor, db, params }) => ({ people: await listPeople(db, actor, params.id) })))
  app.post('/workspaces/:id/people', door(({ actor, db, params, input, invite }) => addPerson(db, actor, params.id, input, invite), { next: () => '/app/admin' }))
  app.patch('/workspaces/:id/people/:operator', door(({ actor, db, params, input }) => setPersonRole(db, actor, params.id, params.operator, input.role)))
  app.post('/workspaces/:id/people/:operator/role', door(({ actor, db, params, input }) => setPersonRole(db, actor, params.id, params.operator, input.role), { next: () => '/app/admin' }))
  app.get('/workspaces/:id/people/:operator/removal-preview', door(({ actor, db, params }) => removalPreview(db, actor, params.operator)))
  app.delete('/workspaces/:id/people/:operator', door(({ actor, db, params, input }) => removeReviewedPerson(db, actor, params.operator, input)))
  app.post('/workspaces/:id/people/:operator/remove', door(({ actor, db, params, input }) => removeReviewedPerson(db, actor, params.operator, input), { next: () => '/app/admin' }))
  app.get('/workspaces/:id/people/:operator/lifecycle-preview', door(({ actor, db, params, query }) => lifecyclePreview(db, actor, params.id, params.operator, query.get('status'))))
  app.post('/workspaces/:id/people/:operator/lifecycle', door(async ({ actor, db, params, input, request, env }) => {
    await validateLifecycle(db, actor, params.id, params.operator, input)
    await changeBaseAccount(db, actor, params.id, params.operator, { status: input.status }, () => operatorAuth(env).setOperatorStatus(request, params.operator, input.status))
    return { id: params.operator, status: input.status }
  }, { next: () => '/app/admin' }))
  app.post('/workspaces/:id/people/:operator/account', door(({ actor, db, params, input, request, env }) => {
    const auth = operatorAuth(env)
    return changeBaseAccount(db, actor, params.id, params.operator, { role: input.role, status: input.status }, () => input.status ? auth.setOperatorStatus(request, params.operator, input.status) : auth.setRole(request, params.operator, input.role))
  }))

  app.get('/teams', door(({ actor, db, workspace, query }) => listTeams(db, actor, workspace, query.get('q') ?? '')))
  app.post('/teams', door(({ actor, db, workspace, input }) => createTeam(db, actor, { ...input, workspaceId: workspace } as never), { next: result => `/app/teams/${result.id}` }))
  app.get('/teams/:id', door(async ({ actor, db, params }) => {
    const team = await loadTeam(db, params.id)
    if (!team) throw notFound()
    const effective = await teamEffective(db, actor, team)
    if (!effective.capabilities.has('read')) throw notFound()
    return { id: team.id, name: team.name, description: team.description, privacy: team.privacy, defaultLevel: team.default_level, fallbackId: team.fallback_id, level: effective.level, capabilities: [...effective.capabilities], paths: effective.paths.map(path => ({ via: path.via, level: path.level })), members: await teamMembers(db, actor, team.id) }
  }))
  app.patch('/teams/:id', door(({ actor, db, params, input }) => updateTeam(db, actor, params.id, input as never)))
  app.post('/teams/:id/settings', door(({ actor, db, params, input }) => updateTeam(db, actor, params.id, { name: input.name, description: input.description, privacy: input.privacy, defaultLevel: input.defaultLevel, fallbackId: input.fallbackId === undefined ? undefined : input.fallbackId || null, approvers: list(input.approvers) }), { next: (_, { params }) => `/app/teams/${params.id}` }))
  app.post('/teams/:id/join', door(({ actor, db, params }) => joinTeam(db, actor, params.id), { next: (_, { params }) => `/app/teams/${params.id}` }))
  app.get('/teams/:id/members', door(async ({ actor, db, params }) => ({ members: await teamMembers(db, actor, params.id) })))

  app.get('/projects', door(async ({ actor, db, workspace }) => ({ projects: await listProjects(db, actor, workspace) })))
  app.post('/projects', door(({ actor, db, workspace, input }) => createProject(db, actor, { ...input, workspaceId: workspace } as never), { next: result => `/app/projects/${result.id}` }))
  app.get('/projects/:id', door(({ actor, db, params }) => board(db, actor, params.id)))
  app.patch('/projects/:id', door(({ actor, db, params, input }) => updateProject(db, actor, params.id, input)))
  app.post('/projects/:id/settings', door(({ actor, db, params, input }) => updateProject(db, actor, params.id, Object.fromEntries(Object.entries(input).filter(([key, value]) => !key.startsWith('_') && value !== '' && key !== 'workspaceId').map(([key, value]) => [key, value === 'none' ? null : value]))), { next: (_, { params }) => `/app/projects/${params.id}` }))
  app.get('/projects/:id/share-preview', door(({ actor, db, params, query }) => previewShare(db, actor, params.id, Object.fromEntries([...query.entries()].filter(([key]) => ['visibility', 'teamId', 'teamLevel', 'workspaceLevel'].includes(key))))))
  app.post('/projects/:id/sections', door(({ actor, db, params, input }) => addSection(db, actor, params.id, input as never), { next: (_, { params }) => `/app/projects/${params.id}` }))
  app.patch('/sections/:id', door(({ actor, db, params, input }) => mapSection(db, actor, params.id, input.mapsTo ?? null)))
  app.post('/sections/:id/map', door(({ actor, db, params, input }) => mapSection(db, actor, params.id, input.mapsTo || null), { next: (result) => `/app/projects/${result.project_id}` }))
  app.get('/projects/:id/fields', door(async ({ actor, db, params }) => { return { fields: await readableDefinitions(db, actor, params.id) } }))
  app.post('/projects/:id/fields', door(({ actor, db, params, input }) => addField(db, actor, params.id, input as never), { next: (_, { params }) => `/app/projects/${params.id}/settings` }))
  app.post('/projects/:id/prefix', door(async ({ actor, db, params, input }) => ({ prefix: await changePrefix(db, actor, params.id, input.prefix) }), { next: (_, { params }) => `/app/projects/${params.id}` }))
  app.get('/projects/:id/rollup', door(({ actor, db, params, query }) => rollup(db, actor, [params.id], query.get('field') ?? undefined)))
  app.get('/rollup', door(({ actor, db, query }) => rollup(db, actor, list(query.get('projects')) ?? [], undefined)))
  app.get('/projects/:id/export', door(async ({ actor, db, params, query }) => {
    const project = await board(db, actor, params.id)
    const rows = await exportRows(db, actor, (await db.prepare('SELECT workspace_id FROM peg_projects WHERE id=?').bind(params.id).first<{ workspace_id: string }>())!.workspace_id, params.id)
    return query.get('format') === 'json' ? json({ project: project.project.name, tasks: rows }) : new Response(toCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${params.id}.csv"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
  }))
  app.get('/export', door(async ({ actor, db, workspace, query }) => {
    const rows = await exportRows(db, actor, workspace)
    return query.get('format') === 'json' ? json({ tasks: rows }) : new Response(toCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="pegboard-export.csv"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
  }))
}
