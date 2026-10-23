import { DataPage } from './pages/data'
import { AuditPage } from './pages/audit'
import { dataSettings, retentionPreview } from '../data/settings'
import { erasurePlan } from '../data/erasure'
import { expiryPlan } from '../data/expiry'
import { searchAudit } from '../audit/search'
import {decisionPreview} from '../decisions/tasks'
import {listNumericSources,previewNumericCsv} from '../goals/sources'
import {GoalsPage} from './pages/goals'
import {listGoals,goalView,goalAudience,goalAudiencePreview} from '../goals/goals'
import {RecurrencesPage} from './pages/recurrences'
import {listRecurrences,recurrenceView,previewRecurrence,rereviewRecurrence} from '../recurrence/recurrence'
import {TimePage} from './pages/time'
import {listSheets,sheetView,timeTaskOptions} from '../time/time'
import {timeDeliveries} from '../connectors/time/delivery'
import {catalogue} from '../fields/definitions'
import {changePreview} from '../fields/values'
import {fieldReport} from '../fields/report'
import {tagCatalogue,tagFilter} from '../tags/tags'
import {FieldReportPage} from './pages/field-report'
import {TagsPage} from './pages/tags'
import { personalMeta, localDay, settings, visibilityPreview } from '../tasks/personal'
// Pegboard's screens: GET documents rendered on the server from the same services the JSON API uses. Every write is
// a form that posts to the API. A link that does not open answers one refusal, whether or not the thing exists.
import { createElement as h, type ReactElement } from 'react'
import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { appDocument } from '../../ui/document.server'
import type { Viewer } from '../../ui/viewer'
import { pendingFor, previewRequest } from '../access-requests/decisions'
import { myRequests } from '../access-requests/requests'
import { accessReview } from '../admin/review'
import { listPeople } from '../admin/settings'
import { activeGrants, teamEffective } from '../authorization/effective'
import { grantsOn, loadTeam } from '../authorization/grants'
import { isAdministrator } from '../authorization/levels'
import { all, first, PegError } from '../db'
import { resolveTaskId } from '../references/refs'
import { board, myTasks } from '../tasks/board'
import { viewTask } from '../tasks/view'
import { displayNames, ensureDefaultWorkspace, workspaceRole, workspaceSettings, workspacesOf, actorOf, type Actor } from '../workspace/people'
import { listProjects, listSections, openProject, previewShare } from '../workspace/projects'
import { listTeams, teamMembers } from '../workspace/teams'
import { AccessReviewPage } from './pages/access-review'
import { AdminPage } from './pages/admin'
import { DecisionPage } from './pages/decision'
import { InboxPage } from './pages/inbox'
import { MyTasksPage } from './pages/my-tasks'
import { ProjectPage } from './pages/project'
import { ProjectSettingsPage } from './pages/project-settings'
import { ProjectsPage } from './pages/projects'
import { RefusalPage } from './pages/refusal'
import { TaskPage } from './pages/task'
import { TeamPage } from './pages/team'
import { TeamGate } from './pages/team-gate'
import { TeamsPage } from './pages/teams'

const page = (title: string, body: ReactElement, status = 200) => appDocument(`${title} · Pegboard`, body).then(response => status === 200 ? response : new Response(response.body, { status, headers: response.headers }))

async function context(db: D1Database, actor: Actor, baseRole: string): Promise<{ viewer: Viewer; workspace: string }> {
  const workspace = (await workspacesOf(db, actor))[0] ?? 'ws_main'
  const role = await workspaceRole(db, actor.id, workspace)
  return { viewer: { displayName: actor.displayName, email: actor.email, role: role ?? baseRole }, workspace }
}

/** The one refusal. Whether the target exists, is private or never was: the same words, and the same form for a member. */
async function refuse(db: D1Database, actor: Actor, viewer: Viewer, target: string, asked = false) {
  const roles = await Promise.all((await workspacesOf(db, actor)).map(id => workspaceRole(db, actor.id, id)))
  const canAsk = roles.some(role => role && role !== 'guest' && role !== 'agent')
  return page('Not available', h(RefusalPage, { viewer, target, canAsk, asked }), asked ? 200 : 404)
}

async function peopleOptions(db: D1Database, actor: Actor, workspace: string) {
  const role = await workspaceRole(db, actor.id, workspace)
  if (!role || role === 'guest') return []
  const rows = await all<{ id: string; display_name: string }>(db, "SELECT o.id,o.display_name FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=? WHERE o.status='active' AND (o.role IN ('owner','admin') OR m.operator_id IS NOT NULL) ORDER BY o.display_name", workspace)
  return rows.map(row => ({ value: row.id, label: row.display_name }))
}
const teamOptions = async (db: D1Database, actor: Actor, workspace: string) => (await listTeams(db, actor, workspace)).teams.map(team => ({ value: team.id, label: team.name }))

export async function pegboardPage(request: Request, original: Bindings): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const env = runtimeBindings(original), segments = path.split('/').filter(Boolean)
  if (segments[0] !== 'app' || segments.length < 2) return null
  const session = await operatorAuth(env).getSession(request)
  if (!session) return new Response(null, { status: 303, headers: { location: '/signin', 'cache-control': 'no-store' } })
  const db = env.DB, actor = actorOf(session)
  await ensureDefaultWorkspace(db)
  const { viewer, workspace } = await context(db, actor, session.operator.role)
  const [, section, id, tail] = segments
  try {
    if(section==='audit'&&!id)return page('Permanent audit',h(AuditPage,{viewer,data:await searchAudit(db,actor,workspace,Object.fromEntries(url.searchParams)),input:Object.fromEntries(url.searchParams)}))
    if(section==='data'&&!id){
      const input=Object.fromEntries(url.searchParams),data=await dataSettings(db,actor,workspace)
      return page('Data settings',h(DataPage,{viewer,data,input,retention:input.review==='retention'?await retentionPreview(db,actor,workspace,input):null,erasure:input.review==='erase'?await erasurePlan(db,actor,workspace,input.type,input.id):null,expiry:input.review==='expiry'?await expiryPlan(db,actor,workspace,input):null}))
    }
    if(section==='goals'&&!tail){
      const input:Record<string,any>=Object.fromEntries(url.searchParams)
      for(const field of ['people','teams','editors'])if(input.previewAudience)input[field]=url.searchParams.getAll(field+'[]')
      const view=id?await goalView(db,actor,id):null
      const role=await workspaceRole(db,actor.id,workspace)
      const people=['agent','guest'].includes(role??'')?[]:(await all<{id:string;display_name:string}>(db,`SELECT o.id,o.display_name FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=? WHERE o.status='active' AND (o.role IN ('owner','admin') OR m.role IN ('manager','member','analyst')) ORDER BY o.display_name`,workspace)).map(p=>({value:p.id,label:p.display_name}))
      return page('Goals',h(GoalsPage,{viewer,input,view,sources:view?.goal.mode==='numeric'&&view.goal.owner_id===actor.id?await listNumericSources(db,actor,id):[],csvPreview:id&&input.csvSource?await previewNumericCsv(db,actor,input.csvSource,input):null,goals:id?[]:await listGoals(db,actor,workspace),people,teams:await teamOptions(db,actor,workspace),audience:view?.canManage?await goalAudience(db,actor,id):[],preview:id&&input.previewAudience?await goalAudiencePreview(db,actor,id,input):null}))
    }
    if(section==='recurrences'&&!tail){
      const input:Record<string,any>=Object.fromEntries(url.searchParams);input.grantIds=url.searchParams.getAll('grantIds[]')
      return page('Recurring work',h(RecurrencesPage,{viewer,input,items:id?[]:await listRecurrences(db,actor,workspace),view:id?await recurrenceView(db,actor,id):null,preview:!id&&input.sourceId?await previewRecurrence(db,actor,input):null,review:id&&input.review?await rereviewRecurrence(db,actor,id,input):null}))
    }
    if(section==='time' &&!tail){const prefs=await settings(db,actor);return page('Timesheets',h(TimePage,{viewer,sheets:await listSheets(db,actor,workspace),view:id?await sheetView(db,actor,id):null,deliveries:id?await timeDeliveries(db,actor,id):null,tasks:await timeTaskOptions(db,actor,workspace),day:localDay(Date.now(),prefs.timezone)}))}
    if (section === 'projects' && !id) return page('Projects', h(ProjectsPage, { viewer, projects: await listProjects(db, actor, workspace), teams: (await listTeams(db, actor, workspace)).teams, canCreate: !!(await workspaceRole(db, actor.id, workspace)) && !['guest', 'analyst', 'agent'].includes((await workspaceRole(db, actor.id, workspace)) as string), workspace }))
    if (section === 'projects' && id && !tail) {
      try { return await page('Project', h(ProjectPage, { viewer, data: await board(db, actor, id), id })) } catch (error) { if (error instanceof PegError && error.status === 404) return refuse(db, actor, viewer, id); throw error }
    }
    if(section==='projects'&&id&&tail==='field-report'&&segments.length===4)return page('Field report',h(FieldReportPage,{viewer,data:await fieldReport(db,actor,id,url.searchParams.get('tag')??undefined)}))
    if(section==='tags'&&!id)return page('Tags',h(TagsPage,{viewer,tags:await tagCatalogue(db,actor,workspace),filtered:url.searchParams.get('tag')?await tagFilter(db,actor,url.searchParams.get('tag')!):null,projects:(await listProjects(db,actor,workspace)).filter(p=>p.level&&['editor','admin'].includes(p.level)).map(p=>({value:p.id,label:p.name}))}))
    if (section === 'projects' && id && tail === 'settings') {
      let data
      try { data = await board(db, actor, id) } catch (error) { if (error instanceof PegError && error.status === 404) return refuse(db, actor, viewer, id); throw error }
      const can = (capability: string) => (data.capabilities as string[]).includes(capability)
      const proposal = Object.fromEntries(['visibility', 'teamId', 'teamLevel', 'workspaceLevel'].flatMap(key => url.searchParams.get(key) ? [[key, url.searchParams.get(key)!]] : []))
      const grants = can('manage_shares') ? await grantsOn(db, actor, 'project', id) : null
      const names = await displayNames(db, grants?.flatMap(grant => [grant.grantee_id, grant.created_by]) ?? [])
      const teams = await teamOptions(db, actor, workspace)
      const teamNames = new Map(teams.map(team => [team.value, team.label]))
      return page('Project settings', h(ProjectSettingsPage, {
        viewer, id, data,sourceProjects:(await listProjects(db,actor,workspace)).map(p=>({value:p.id,label:p.name})), library:can('manage_fields')?await catalogue(db,actor,workspace):[], fieldPreview:can('manage_fields')&&url.searchParams.get('fieldId')?await changePreview(db,actor,url.searchParams.get('fieldId')!,Object.fromEntries(url.searchParams)):null, people: await peopleOptions(db, actor, workspace), teams, proposal, sectionList: (await listSections(db, id)).map(section => ({ id: section.id, name: section.name, mapsTo: section.maps_to })),
        preview: can('manage_shares') && Object.keys(proposal).length ? await previewShare(db, actor, id, proposal).catch(() => null) : null,
        grants: grants && grants.map(grant => ({ id: grant.id, grantee: grant.grantee_type === 'team' ? `Team ${teamNames.get(grant.grantee_id) ?? ''}` : names.get(grant.grantee_id) ?? 'Former member', level: grant.level, scope: grant.scope, source: grant.source, by: names.get(grant.created_by) ?? 'Former member' })),
      }))
    }
    if (section === 'tasks' && id) {
      let task
      try { task = await viewTask(db, actor, decodeURIComponent(id)) } catch (error) { if (error instanceof PegError && error.status === 404) return refuse(db, actor, viewer, decodeURIComponent(id)); throw error }
      const open = (await listProjects(db, actor, workspace)).filter(project => project.level && ['editor', 'admin'].includes(project.level) && !task.projects.some(own => own.id === project.id))
      const sections = Object.fromEntries(await Promise.all(task.projects.map(async project => [project.id, (await listSections(db, project.id)).map(entry => ({ value: entry.id, label: entry.name }))])))
      return page('Task', h(TaskPage, { viewer, task, decision:task.kind==='approval'?await decisionPreview(db,actor,task.id):null, addable: open.map(project => ({ value: project.id, label: project.name })), sections, tagOptions:(await tagCatalogue(db,actor,workspace)).filter(t=>!t.archived).map(t=>({value:t.id,label:t.name})), preview: task.personal && url.searchParams.get('projectId') ? await visibilityPreview(db,actor,task.id,url.searchParams.get('projectId')!) : null }))
    }
    if (section === 'my-tasks') { const prefs=await settings(db,actor), on=url.searchParams.get('on')??undefined; const tasks=await myTasks(db,actor,on); return page('My tasks',h(MyTasksPage,{viewer,tasks,workspace,meta:await personalMeta(db,actor),day:on??localDay(Date.now(),prefs.timezone),on})) }
    if (section === 'teams' && !id) return page('Teams', h(TeamsPage, { viewer, teams: (await listTeams(db, actor, workspace, url.searchParams.get('q') ?? '')).teams, query: url.searchParams.get('q') ?? '', workspace, canCreate: ['owner', 'admin', 'manager'].includes((await workspaceRole(db, actor.id, workspace)) as string) }))
    if (section === 'teams' && id) {
      const team = await loadTeam(db, id)
      const effective = team ? await teamEffective(db, actor, team) : null
      if (!team || !effective?.capabilities.has('read')) {
        // A team that is public or by request may be looked at (its listing is already discoverable); a private one is not.
        const listed = team && (await listTeams(db, actor, workspace)).teams.find(entry => entry.id === id)
        if (!listed) return refuse(db, actor, viewer, id)
        return page(listed.name, h(TeamGate, { viewer, team: listed }))
      }
      const approvers = (await all<{ operator_id: string }>(db, "SELECT operator_id FROM peg_approvers WHERE object_type='team' AND object_id=?", id)).map(row => row.operator_id)
      return page(team.name, h(TeamPage, { viewer, people: await peopleOptions(db, actor, workspace), team: { id, name: team.name, description: team.description, privacy: team.privacy, defaultLevel: team.default_level, fallbackId: team.fallback_id, level: effective.level, capabilities: [...effective.capabilities], paths: effective.paths.map(path => ({ via: path.via, level: path.level })), members: await teamMembers(db, actor, id), approvers } }))
    }
    if (section === 'inbox') return page('Inbox', h(InboxPage, { viewer, toDecide: await pendingFor(db, actor), mine: await myRequests(db, actor) }))
    if (section === 'access-requests' && id) {
      let preview
      try { preview = await previewRequest(db, actor, id) } catch (error) { if (error instanceof PegError && error.status === 404) return refuse(db, actor, viewer, id); throw error }
      return page('Access request', h(DecisionPage, { viewer, request: preview }))
    }
    if (section === 'link' && id) {
      const target = decodeURIComponent(id)
      if (url.searchParams.get('asked')) return refuse(db, actor, viewer, target, true)
      const taskId = await resolveTaskId(db, target)
      for (const [type, where] of [['tasks', taskId], ['projects', target.startsWith('prj_') ? target : null], ['teams', target.startsWith('team_') ? target : null]] as const) {
        if (!where) continue
        const opened = type === 'tasks' ? await viewTask(db, actor, where).then(() => true, () => false) : type === 'projects' ? await openProject(db, actor, where).then(() => true, () => false) : await teamEffective(db, actor, (await loadTeam(db, where))!).then(effective => effective.capabilities.has('read'), () => false)
        if (opened) return new Response(null, { status: 303, headers: { location: `/app/${type}/${where}`, 'cache-control': 'no-store' } })
      }
      return refuse(db, actor, viewer, target)
    }
    if (section === 'access-review' || section === 'admin') {
      if (!isAdministrator(await workspaceRole(db, actor.id, workspace))) return refuse(db, actor, viewer, section)
      if (section === 'access-review') return page('Access review', h(AccessReviewPage, { viewer, review: await accessReview(db, actor, workspace, { action: url.searchParams.get('action') ?? undefined }) }))
      return page('Administration', h(AdminPage, { viewer, workspace, settings: await workspaceSettings(db, workspace), people: await listPeople(db, actor, workspace) }))
    }
  } catch (error) {
    if (error instanceof PegError) return page('Not available', h(RefusalPage, { viewer, target: '', canAsk: false, asked: false }), error.status)
    throw error
  }
  return null
}
