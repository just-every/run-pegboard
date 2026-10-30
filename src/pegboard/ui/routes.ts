import { IntakeScreen,IntakeSettings,IntakeQueue } from './pages/intake'
import { internalForm,safeForm,projectForms,reviewForm,administer } from '../intake/forms'
import { triageQueue } from '../intake/triage'
import { intakeDocument } from '../api/intake-routes'
import { dashboards, ownDashboard, readSnapshot } from '../reporting/dashboard'
import { ReportsSettings, ReportsList, ReportPage } from './pages/reports'
import { workView } from '../views/service'
import { listWorkViews } from '../views/store'
import { WorkViewPage, WorkViewContent } from './work-views/page'
import { ViewSettingsPage } from './work-views/settings'
import { ownKey, readReport } from '../analytics-export/reports'
import { AnalystReportPage } from './pages/analyst-report'
import { operatorMail } from '../../mail.server.mjs'
import { analystSettings } from '../analytics-export/keys'
import { AnalyticsPage } from './pages/analytics'
import { calendarChoices, projectBlocks, blockPreview } from '../calendars/blocks'
import { calendarSettings } from '../calendars/connections'
import { CalendarSettingsPage } from './pages/calendar-settings'
import { workloadView } from '../capacity/workload'
import { capacityPeople } from '../capacity/profiles'
import { staffingScenario } from '../capacity/scenarios'
import { effortPreview } from '../capacity/allocations'
import { accountAvailability,availabilityChoices } from '../capacity/availability'
import { feedSettings } from '../capacity/feeds'
import { WorkloadPage } from './pages/workload'
import { AccountAvailabilityPage,CapacitySettingsPage } from './pages/capacity-settings'
import {ApprovalPage,RoutingPage} from './pages/approvals'
import {routeFor,routeView,reviewLink,previewRoute} from '../approvals/routing'
import {proofView} from '../records/custody'
import {pendingRuleSchedulePreview} from '../bundles/pending-schedule'
import {availabilityView} from '../schedule/availability'
import {AvailabilityPage} from './pages/availability'
import {readinessNotices} from '../notices'
import {ReadinessPreferences} from './pages/readiness-notices'
import {Card,Shell} from './shell'
import {CalendarPage} from './pages/calendar'
import {schedulePreview} from './schedule-preview'
import type {ScheduleEditorProps} from './schedule-editor'
import {guestPreview} from '../guests/preview'
import {taskParticipants} from '../tasks/participants'
import {openTask} from '../tasks/access'
import {definitions as ruleDateFields} from '../fields/definitions'
import {RuleRequestPage} from './pages/rule-request'
import {RuleSuggestionsPage} from './pages/rule-suggestions'
import {suggestionView} from '../rules/suggestions'
import {RulesPage} from './pages/rules'
import {rulesView,rulePreview} from '../rules/definitions'
import {TemplatesPage} from './pages/templates'
import {ConversionsPage} from './pages/conversions'
import {errorDocument} from './error'
import {conversionPageData} from '../conversion/page-data'
import {conversionView,listConversionLinks} from '../conversion/operations'
import {undoConversionPreview} from '../conversion/undo'
import {templatePageData} from '../templates/page-data'
import {DuplicatePage} from './pages/duplicate'
import {sourceDuplication} from '../duplication/source'
import {previewDuplicate} from '../duplication/preview'
import {duplicateResult} from '../duplication/execution'
import {previewDuplicateActivation} from '../duplication/activation'
import {TemplateRulesPage} from './pages/template-rules'
import {templateRuleView,previewTemplateRule} from '../templates/rules'
import {listTemplates} from '../templates/definitions'
import {fieldRevisionView,fieldRevisionPreview} from '../revisions/fields'
import {FieldRevisionsPage} from './pages/field-revisions'
import {bundleRevisionPreview} from '../revisions/bundles'
import {bulkPreview,undoBulkPreview,listBulk} from '../recovery/bulk'
import {bulkInput} from '../api/bulk-routes'
import {BulkPage} from './pages/bulk'
import {briefView} from '../revisions/briefs'
import {BriefPage} from './pages/brief'
import { recoveryList,recoveryPreview } from '../recovery'
import { RecoveryPage } from './pages/recovery'
import { removalPreview } from '../admin/departure/removal'
import { MemberRemovalPage } from './pages/member-removal'
import {BundlesPage} from './pages/bundles'
import {bundleView,listBundles} from '../bundles/definitions'
import {previewBundle} from '../bundles/adoption'
import {bundleSavedView} from '../bundles/execution'
import {RegisterPage} from './pages/register'
import {registerView} from '../register/records'
import {CanvasPage} from './canvas/page'
import {PortfoliosPage} from './pages/portfolios'
import {TimelinePage} from './pages/timeline'
import {scheduleView} from '../schedule/timeline'
import {moveInput,planChange} from '../schedule/plan'
import {PortfolioPage} from './pages/portfolio'
import {listPortfolios,openPortfolio} from '../portfolios/portfolios'
import {portfolioRollup,portfolioDrill} from '../portfolios/rollup'
import {canvasView} from '../canvas/nodes'
import {ProjectListPage} from './pages/project-list'
import {MeetingPage} from './meeting-review/page'
import {meetings,meetingView} from '../meetings/review'
import { EngineeringPage } from './engineering-handoff/page'
import { engineeringView } from '../engineering-links/links'
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
import { listProjects, listSections, openProject, previewShare, need } from '../workspace/projects'
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
  const spaces=await workspacesOf(db,actor)
  const workspace=spaces.includes('ws_main')?'ws_main':spaces[0]??'ws_main'
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
  const scheduleInput=Object.fromEntries(url.searchParams) as Record<string,string>
  const editorFor=async(projectId:string,tasks:{value:string;label:string}[],here:string):Promise<ScheduleEditorProps>=>({here,projectId,tasks,people:await peopleOptions(db,actor,workspace),input:scheduleInput,preview:await schedulePreview(db,actor,scheduleInput)})

  try {
    if(section==='intake'&&id&&!tail){const row=await internalForm(db,actor,id),receiptId=url.searchParams.get('receipt'),receipt=receiptId?await first<{id:string;deadline:number}>(db,'SELECT id,deadline FROM peg_intake_submissions WHERE id=? AND form_id=? AND source_actor=?',receiptId,id,actor.id):null;return intakeDocument('Request intake',h(IntakeScreen,{viewer,form:safeForm(row),receipt:receipt?{receipt:receipt.id,deadline:receipt.deadline,acknowledgment:'Request received'}:null}))}
    if(section==='projects'&&id&&tail==='intake'&&segments.length===4)return page('Request triage',h(IntakeQueue,{viewer,view:await triageQueue(db,actor,id)}))
    if(section==='projects'&&id&&tail==='settings'&&segments[4]==='intake'&&segments.length===5){const {project}=await administer(db,actor,id),reviewId=url.searchParams.get('review');const review=reviewId?await reviewForm(db,actor,reviewId):null;if(review&&review.project.id!==id)throw new PegError(404,'not_found');return page('Intake settings',h(IntakeSettings,{viewer,project,list:await projectForms(db,actor,id),review,people:await peopleOptions(db,actor,workspace)}))}
    if(section==='settings'&&id==='reports'&&!tail)return page('Report settings',h(ReportsSettings,{viewer,projects:await listProjects(db,actor,workspace),list:await dashboards(db,actor,workspace)}))
    if(section==='reports'&&!id)return page('Reports',h(ReportsList,{viewer,list:await dashboards(db,actor,workspace)}))
    if(section==='reports'&&id&&!tail){const {row}=await ownDashboard(db,actor,workspace,id);const snapshot=url.searchParams.get('snapshot');return page(row.name,h(ReportPage,{viewer,id,name:row.name,report:snapshot?await readSnapshot(db,actor,workspace,id,snapshot):null}))}
    if(section==='approvals'&&id)return page('Review approval',h(ApprovalPage,{viewer,view:await routeView(db,actor,id),people:await peopleOptions(db,actor,workspace)}))
    if(section==='proof-reviews'&&id)return page('Review approval',h(ApprovalPage,{viewer,view:await reviewLink(db,actor,id),linkId:id,people:[]}))
    if(section==='approval-routing'&&id){const input:Record<string,any>=Object.fromEntries(url.searchParams);for(const n of [1,2])input['people'+n]=url.searchParams.getAll('people'+n+'[]');const kind=input.kind??'task';const target=kind==='proof'?(await proofView(db,actor,id)).taskId:id;const access=(await openTask(db,actor,target)).access;if(!access.capabilities.has('manage_shares')||access.role==='guest'||access.role==='agent')throw new PegError(403,'forbidden');const existing=await routeFor(db,kind,id);if(existing&&!input.new&&!input.preview)return new Response(null,{status:303,headers:{location:'/app/approvals/'+existing.id}});return page('Approval routing',h(RoutingPage,{viewer,kind,id,people:await peopleOptions(db,actor,workspace),input,preview:input.preview?await previewRoute(db,actor,kind,id,input):null}))}
    if(section==='proofs'&&id){const task=await viewTask(db,actor,id);if(!task.capabilities.includes('edit'))throw new PegError(403,'forbidden');const proofs=await all<{id:string}>(db,'SELECT id FROM peg_proofs WHERE task_id=?',id);return page('Proof reviews',h(Shell,{viewer,current:'/app/projects',title:'Proof reviews',children:h(Card,{title:'Reviewed versions',children:[h('form',{method:'post',action:'/api/v1/tasks/'+id+'/proofs',className:'stack'},h('input',{type:'hidden',name:'_next',value:'/app/proofs/'+id}),h('label',null,'File to review',h('select',{className:'select',name:'attachmentId','aria-label':'File to review'},task.attachments.map(a=>h('option',{value:a.id},a.name)))),h('button',{className:'button quiet'},'Create proof')), ...await Promise.all(proofs.map(async p=>{const v=await proofView(db,actor,p.id);return h('section',null,h('a',{href:'/app/approval-routing/'+p.id+'?kind=proof'},'Route proof for review'),h('form',{method:'post',action:'/api/v1/proofs/'+p.id+'/versions',className:'stack'},h('input',{type:'hidden',name:'_next',value:'/app/proofs/'+id}),h('input',{type:'hidden',name:'currentVersion',value:v.proof.current_version??''}),h('label',null,'Replacement file',h('select',{className:'select',name:'attachmentId','aria-label':'Replacement file'},task.attachments.map(a=>h('option',{value:a.id},a.name)))),h('button',{className:'button quiet'},'Add reviewed version')))}))]})}))}
    if(section==='settings'&&id==='analytics'&&tail&&segments.length===4) return page('Analyst report',h(AnalystReportPage,{viewer,keyId:tail,workspace,report:await readReport(db,await ownKey(db,actor,workspace,tail),url.searchParams.get('snapshot')??'')}))
    if(section==='settings'&&id==='analytics'&&!tail) {
      const response = await page('Analyst access', h(AnalyticsPage, { viewer, workspace, data: await analystSettings(db, actor, workspace) }))
      const headers = new Headers(response.headers)
      headers.set('content-security-policy', headers.get('content-security-policy') + "; connect-src 'self'")
      return new Response((await response.text()).replace('</body>', '<script src="/look/analytics.js" defer></script></body>'), { status: response.status, headers })
    }
    if(section==='settings'&&!id)return page('Work settings',h(Shell,{viewer,current:'/auth/settings/identity',title:'Work settings',children:h(Card,{title:'Scheduling and notices',children:h('p',null,h('a',{href:'/app/settings/reports'},'Report settings'), ' · ',h('a',{href:'/app/settings/availability'},'Working calendar'), ' · ',h('a',{href:'/app/settings/calendars'},'Calendar connections'), ' · ',h('a',{href:'/app/settings/readiness'},'Readiness notices'), ' · ',h('a',{href:'/app/settings/capacity'},'Capacity sources and tentative staffing'), ' · ',h('a',{href:'/app/account/availability'},'My availability'), ...(['owner','admin'].includes(viewer.role)?[' · ',h('a',{href:'/app/settings/analytics'},'Analyst access')]:[]))})}))
    if(section==='workload'&&!id){const input={...Object.fromEntries(url.searchParams),selected:url.searchParams.getAll('selected[]')},view=await workloadView(db,actor,workspace,input);return page('Workload',h(WorkloadPage,{viewer,view,scenario:url.searchParams.has('taskId')?await staffingScenario(db,actor,workspace,input):null,effort:url.searchParams.has('reviewEffort')?await effortPreview(db,actor,url.searchParams.get('effortTask')!,input):null,effortTask:url.searchParams.get('effortTask'),canConfigure:isAdministrator(await workspaceRole(db,actor.id,workspace))}))}
    if(section==='account'&&id==='availability')return page('My availability',h(AccountAvailabilityPage,{viewer,view:await accountAvailability(db,actor,workspace)}))
    if(section==='settings'&&id==='capacity')return page('Capacity settings',h(CapacitySettingsPage,{viewer,workspace,feeds:await feedSettings(db,actor,workspace),people:await capacityPeople(db,actor,workspace)}))
    if(section==='settings'&&id==='calendars')return page('Calendar connections',h(CalendarSettingsPage,{viewer,view:await calendarSettings(db,actor,workspace)}))
    if(section==='settings'&&id==='availability')return page('Working calendar',h(AvailabilityPage,{viewer,view:await availabilityView(db,actor,url.searchParams.get('workspace')??workspace)}))
    if(section==='settings'&&id==='readiness')return page('Readiness notice settings',h(Shell,{viewer,current:'/auth/settings/identity',title:'Readiness notice settings',children:h(ReadinessPreferences,{readiness:await readinessNotices(db,actor,workspace)})}))

    if(section==='conversions'&&!tail){
      const names=Object.fromEntries((await peopleOptions(db,actor,workspace)).map(person=>[person.value,person.label]))
      if(id)return page('Linked conversion',h(ConversionsPage,{viewer,input:{},tasks:[],projects:[],constituents:[],names,preview:null,result:await conversionView(db,actor,id),undo:url.searchParams.has('undo')?await undoConversionPreview(db,actor,workspace,id):null}))
      return page('Convert work',h(ConversionsPage,{viewer,...await conversionPageData(db,actor,workspace,url.searchParams),names,result:null,undo:null}))
    }
    if(section==='templates'&&!id)return page('Templates',h(TemplatesPage,{viewer,...await templatePageData(db,actor,workspace,url.searchParams)}))
    if(section==='projects'&&id&&tail==='duplicate'&&segments.length===4){
      const input:Record<string,any>=Object.fromEntries(url.searchParams)
      for(const key of ['taskIds','memberIds','ruleIds','stageIds'])input[key]=url.searchParams.getAll(key+'[]')
      const result=input.result?await duplicateResult(db,actor,id):null
      return page('Duplicate project',h(DuplicatePage,{viewer,input,result,source:result?null:await sourceDuplication(db,actor,id),preview:input.preview?await previewDuplicate(db,actor,id,input):null,review:result&&input.review?await previewDuplicateActivation(db,actor,id,input):null}))
    }
    if(section==='projects'&&id&&tail==='request'&&segments.length===4){const opened=await openProject(db,actor,id);need(opened.effective,'edit');return page('Submit project request',h(RuleRequestPage,{viewer,project:opened.project,requestKey:crypto.randomUUID()}))}
    if(section==='projects'&&id&&tail==='rule-suggestions'&&segments.length===4)return page('Ask your project Admin',h(RuleSuggestionsPage,{viewer,view:await suggestionView(db,actor,id)}))
    if(section==='projects'&&id&&tail==='rules'&&segments.length===4){
      const view=await rulesView(db,actor,id)
      if(url.searchParams.get('review')&&(await rulePreview(db,actor,url.searchParams.get('review')!,Object.fromEntries(url.searchParams))).rule.project_id!==id)throw new PegError(404,'not_found')
      return page('Work rules',h(RulesPage,{viewer,view,dateFields:(await ruleDateFields(db,id)).filter(f=>f.type==='date').map(f=>({value:f.key,label:f.label})),projects:(await listProjects(db,actor,view.project.workspace_id)).filter(p=>p.level==='admin'&&p.id!==id).map(p=>({value:p.id,label:p.name})),tags:(await tagCatalogue(db,actor,view.project.workspace_id)).filter(t=>!t.archived&&!t.owner_id).map(t=>({value:t.id,label:t.name})),people:await peopleOptions(db,actor,view.project.workspace_id),sections:(await listSections(db,id)).map(s=>({value:s.id,label:s.name})),preview:url.searchParams.get('review')?await rulePreview(db,actor,url.searchParams.get('review')!,Object.fromEntries(url.searchParams)):null}))
    }
    if(section==='projects'&&id&&tail==='template-rules'&&segments.length===4){
      const view=await templateRuleView(db,actor,id)
      return page('Template rules',h(TemplateRulesPage,{viewer,view,templates:(await listTemplates(db,actor,view.project.workspace_id)).map(t=>({id:t.template.id,name:t.template.name,version:t.headVersion,roles:t.definition.roles})),people:await peopleOptions(db,actor,view.project.workspace_id),selectedTemplateId:url.searchParams.get('templateId')??undefined,preview:url.searchParams.get('review')?await previewTemplateRule(db,actor,url.searchParams.get('review')!,{...Object.fromEntries(url.searchParams),runIds:url.searchParams.getAll('runIds[]')}):null}))
    }
    if(section==='fields'&&id&&tail==='revisions')return page('Field revisions',h(FieldRevisionsPage,{viewer,view:await fieldRevisionView(db,actor,id),preview:url.searchParams.has('fromVersion')?await fieldRevisionPreview(db,actor,id,Object.fromEntries(url.searchParams)):null}))
    if(section==='recovery'&&id==='bulk'&&!tail){const input=bulkInput({...Object.fromEntries(url.searchParams),taskIds:url.searchParams.getAll('taskIds[]')});return page('Bulk changes',h(BulkPage,{viewer,input,tasks:(await recoveryList(db,actor,workspace)).choices.filter(c=>c.value.startsWith('task.')).map(c=>({value:c.value.slice(5),label:c.label.slice(7)})),people:await peopleOptions(db,actor,workspace),listing:await listBulk(db,actor,workspace),preview:input.taskIds.length?await bulkPreview(db,actor,workspace,input):null,undo:url.searchParams.get('operationId')?await undoBulkPreview(db,actor,workspace,url.searchParams.get('operationId')!):null}))}
    if(section==='projects'&&id&&tail==='brief')return page('Project brief',h(BriefPage,{viewer,view:await briefView(db,actor,id,Object.fromEntries(url.searchParams))}))
    if(section==='recovery'&&!id)return page('Archive and trash',h(RecoveryPage,{viewer,listing:await recoveryList(db,actor,workspace),preview:url.searchParams.has('id')?await recoveryPreview(db,actor,workspace,Object.fromEntries(url.searchParams)):url.searchParams.get('target')?await recoveryPreview(db,actor,workspace,(()=>{const [type,id]=url.searchParams.get('target')!.split('.');return {type,id,action:type==='project'?'archive':'trash'}})()):null}))
    if(section==='workflow-bundles'&&!tail){return page('Workflow bundles',h(BundlesPage,{viewer,pendingSchedule:id&&url.searchParams.has('reviewJob')?await pendingRuleSchedulePreview(db,actor,id,url.searchParams.get('reviewJob')!):null,revisionPreview:id&&url.searchParams.has('fromVersion')?await bundleRevisionPreview(db,actor,id,Object.fromEntries(url.searchParams)):null,tags:(await tagCatalogue(db,actor,workspace)).filter(t=>!t.archived&&!t.owner_id).map(t=>({value:t.id,label:t.name})),bundles:id?[]:await listBundles(db,actor,workspace),view:id?await bundleView(db,actor,id):null,projects:(await listProjects(db,actor,workspace)).filter(p=>p.level==='admin').map(p=>({value:p.id,label:p.name})),fields:(await catalogue(db,actor,workspace)).map(f=>({value:f.id,label:f.label})),people:await peopleOptions(db,actor,workspace),preview:id&&url.searchParams.getAll('projectIds[]').length?await previewBundle(db,actor,id,{projectIds:url.searchParams.getAll('projectIds[]')}):null}))}
    if(section==='portfolios'&&!id){const role=await workspaceRole(db,actor.id,workspace);return page('Portfolios',h(PortfoliosPage,{viewer,workspace,query:url.searchParams.get('q')??'',portfolios:await listPortfolios(db,actor,workspace,url.searchParams.get('q')??''),canCreate:['owner','admin','manager','member'].includes(role??'')}))}
    if(section==='portfolios'&&id&&!tail){
      const atInput=url.searchParams.get('at'),at=atInput?Date.parse(atInput.length===16?atInput+':00Z':atInput):undefined,filterId=url.searchParams.get('filter')||undefined,drillMetric=url.searchParams.get('drill')
      let view
      try{view=await portfolioRollup(db,actor,id,{at,filterId})}catch(error){if(error instanceof PegError&&error.status===404)return refuse(db,actor,viewer,id);throw error}
      const admin=view.portfolio.level==='admin',tab=url.searchParams.get('tab')??'summary'
      return page('Portfolio',h(PortfolioPage,{viewer,view,tab:['summary','timeline','workload','dashboard'].includes(tab)?tab:'summary',atInput,projectOptions:admin?(await listProjects(db,actor,workspace)).map(p=>({value:p.id,label:p.name})):[],people:admin?await peopleOptions(db,actor,workspace):[],drill:drillMetric?await portfolioDrill(db,actor,id,{metric:drillMetric,at}):null}))
    }
    if(section==='projects'&&id&&tail==='register'&&segments.length===4){const data=await board(db,actor,id);return page('Delivery register',h(RegisterPage,{viewer,view:await registerView(db,actor,id),people:await peopleOptions(db,actor,workspace),tasks:data.columns.flatMap(c=>c.tasks.map(t=>({value:t.id,label:t.title})))}))}
    if(section==='projects'&&id&&(tail==='views'&&segments.length===4||tail==='settings'&&segments[4]==='views'&&segments.length===5)) {
      const input=Object.fromEntries(url.searchParams)
      if (input.previousView !== undefined && input.previousView !== (input.savedView??'')) {
        delete input.mode; delete input.status; delete input.groupBy
      }
      if (input.status === 'saved') delete input.status
      const options={viewId:input.savedView||undefined,mode:input.mode,status:input.status,groupBy:input.groupBy,from:input.from,days:input.days}
      const data=await workView(db,actor,id,options)
      const body=tail==='settings'?h(ViewSettingsPage,{viewer,presets:await listWorkViews(db,actor,id),data,selected:input.savedView}):request.headers.has('x-work-view-refresh')?h(WorkViewContent,{data}):h(WorkViewPage,{viewer,data,presets:data,input})
      const response=await page('Work views',body),headers=new Headers(response.headers)
      headers.set('content-security-policy',headers.get('content-security-policy')+"; connect-src 'self'")
      return new Response((await response.text()).replace('</head>','<link rel="stylesheet" href="/look/work-views.css"></head>'),{status:response.status,headers})
    }
    if(section==='projects'&&id&&tail==='calendar'&&segments.length===4){
      const view=await scheduleView(db,actor,id),here=`/app/projects/${id}/calendar`
      return page('Calendar',h(CalendarPage,{viewer,view,blocks:{here,connections:await calendarChoices(db,actor,workspace),tasks:view.tasks.filter(t=>t.inProject).map(t=>({id:t.id,title:t.title})),blocks:await projectBlocks(db,actor,id),preview:url.searchParams.get('calendarPreview')?await blockPreview(db,actor,url.searchParams.get('calendarPreview')!):null},editor:view.project.canEdit?await editorFor(id,view.tasks.filter(t=>t.inProject).map(t=>({value:t.id,label:t.title})),here):null}))
    }
    if(section==='projects'&&id&&tail==='timeline'&&segments.length===4){
      const input=Object.fromEntries(url.searchParams) as Record<string,string>
      let view
      try{view=await scheduleView(db,actor,id,{baselineId:input.baseline||undefined})}catch(error){if(error instanceof PegError&&error.status===404)return refuse(db,actor,viewer,id);throw error}
      let preview=null
      if(input.taskId&&(input.start||input.due)){
        const move={taskId:input.taskId,...(input.start?{start:input.start}:{}),...(input.due?{due:input.due}:{})}
        try{const{all:_,...plan}=await planChange(db,actor,moveInput([move]));preview={plan,move}}catch(error){if(error instanceof PegError)preview={error:error.code};else throw error}
      }
      const response=await page('Timeline',h(TimelinePage,{viewer,view,preview,input,people:await peopleOptions(db,actor,workspace)})),headers=new Headers(response.headers);headers.set('content-security-policy',headers.get('content-security-policy')+"; connect-src 'self'");return new Response(response.body,{status:response.status,headers})
    }
    if(section==='projects'&&id&&tail==='canvas'&&segments.length===4){
      const response=await page('Planning canvas',h(CanvasPage,{viewer,data:await canvasView(db,actor,id),selected:url.searchParams.get('node')}))
      const headers=new Headers(response.headers)
      headers.set('content-security-policy',headers.get('content-security-policy')+"; connect-src 'self'")
      return new Response((await response.text()).replace('</head>','<link rel="stylesheet" href="/look/canvas.css"></head>').replace('</body>','<script src="/look/canvas.js" defer></script></body>'),{status:response.status,headers})
    }
    if(section==='projects'&&id&&!tail&&url.searchParams.get('view')==='list'){const saved=url.searchParams.get('savedView'),filter=saved?await bundleSavedView(db,actor,id,saved):undefined;return page('Project list',h(ProjectListPage,{viewer,data:await board(db,actor,id,filter),viewName:filter?.name,savedView:saved??undefined,editor:(await openProject(db,actor,id)).effective.capabilities.has('edit')?await editorFor(id,(await board(db,actor,id,filter)).columns.flatMap(c=>c.tasks.map(t=>({value:t.id,label:t.title}))),`/app/projects/${id}?view=list${saved?`&savedView=${encodeURIComponent(saved)}`:''}`):null}))}
    if(section==='meetings'&&!tail)return page('Meeting review',h(MeetingPage,{viewer,items:await meetings(db,actor,workspace),view:id?await meetingView(db,actor,id):null,people:await peopleOptions(db,actor,workspace),projects:(await listProjects(db,actor,workspace)).map(p=>({value:p.id,label:p.name}))}))
    if(section==='engineering'&&id&&!tail)return page('Engineering handoff',h(EngineeringPage,{viewer,data:await engineeringView(db,actor,id)}))
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
      try { return await page('Project', h(ProjectPage, { viewer, data: await board(db, actor, id), id, conversionLinks:await listConversionLinks(db,actor,'project',id),editor:(await openProject(db,actor,id)).effective.capabilities.has('edit')?await editorFor(id,(await board(db,actor,id)).columns.flatMap(c=>c.tasks.map(t=>({value:t.id,label:t.title}))),`/app/projects/${id}`):null })) } catch (error) { if (error instanceof PegError && error.status === 404) return refuse(db, actor, viewer, id); throw error }
    }
    if(section==='projects'&&id&&tail==='field-report'&&segments.length===4)return page('Field report',h(FieldReportPage,{viewer,data:await fieldReport(db,actor,id,url.searchParams.get('tag')??undefined)}))
    if(section==='tags'&&!id)return page('Tags',h(TagsPage,{viewer,tags:await tagCatalogue(db,actor,workspace),filtered:url.searchParams.get('tag')?await tagFilter(db,actor,url.searchParams.get('tag')!):null,projects:(await listProjects(db,actor,workspace)).filter(p=>p.level&&['editor','admin'].includes(p.level)).map(p=>({value:p.id,label:p.name}))}))
    if (section === 'projects' && id && tail === 'settings') {
      let data
      try { data = await board(db, actor, id) } catch (error) { if (error instanceof PegError && error.status === 404) return refuse(db, actor, viewer, id); throw error }
      const can = (capability: string) => (data.capabilities as string[]).includes(capability)
      const proposal = Object.fromEntries(['visibility', 'teamId', 'teamLevel', 'workspaceLevel'].flatMap(key => url.searchParams.get(key) ? [[key, url.searchParams.get(key)!]] : []))
      const grants = can('manage_shares') ? await grantsOn(db, actor, 'project', id) : null
      const guestPeople=[]
      for(const guestId of new Set((grants??[]).filter(g=>g.grantee_type==='person').map(g=>g.grantee_id)))if(await workspaceRole(db,guestId,(await openProject(db,actor,id)).project.workspace_id)==='guest'){const name=await displayNames(db,[guestId]);guestPeople.push({value:guestId,label:name.get(guestId)??'Guest'})}
      const names = await displayNames(db, grants?.flatMap(grant => [grant.grantee_id, grant.created_by]) ?? [])
      const teams = await teamOptions(db, actor, workspace)
      const teamNames = new Map(teams.map(team => [team.value, team.label]))
      return page('Project settings', h(ProjectSettingsPage, {
        viewer, id, data, guestPeople, guestPreview:can('manage_shares')&&url.searchParams.get('recipient')?await guestPreview(db,actor,id,url.searchParams.get('recipient')!):null, sourceProjects:(await listProjects(db,actor,workspace)).map(p=>({value:p.id,label:p.name})), library:can('manage_fields')?await catalogue(db,actor,workspace):[], fieldPreview:can('manage_fields')&&url.searchParams.get('fieldId')?await changePreview(db,actor,url.searchParams.get('fieldId')!,Object.fromEntries(url.searchParams)):null, people: await peopleOptions(db, actor, workspace), teams, proposal, sectionList: (await listSections(db, id)).map(section => ({ id: section.id, name: section.name, mapsTo: section.maps_to })),
        preview: can('manage_shares') && Object.keys(proposal).length ? await previewShare(db, actor, id, proposal).catch(() => null) : null,
        grants: grants && grants.map(grant => ({ id: grant.id, grantee: grant.grantee_type === 'team' ? `Team ${teamNames.get(grant.grantee_id) ?? ''}` : names.get(grant.grantee_id) ?? 'Former member', level: grant.level, scope: grant.scope, source: grant.source, by: names.get(grant.created_by) ?? 'Former member' })),
      }))
    }
    if (section === 'tasks' && id) {
      let task
      try { task = await viewTask(db, actor, decodeURIComponent(id)) } catch (error) { if (error instanceof PegError && error.status === 404) return refuse(db, actor, viewer, decodeURIComponent(id)); throw error }
      const open = (await listProjects(db, actor, workspace)).filter(project => project.level && ['editor', 'admin'].includes(project.level) && !task.projects.some(own => own.id === project.id))
      const sections = Object.fromEntries(await Promise.all(task.projects.map(async project => [project.id, (await listSections(db, project.id)).map(entry => ({ value: entry.id, label: entry.name }))])))
      return page('Task', h(TaskPage, { viewer, task, editor:!task.personal&&task.capabilities.includes('edit')&&task.projects[0]?await editorFor(task.projects[0].id,[{value:task.id,label:task.title}],`/app/tasks/${task.id}`):null, participants: task.capabilities.includes('edit') ? await availabilityChoices(db,actor,workspace,await taskParticipants(db,actor,(await openTask(db,actor,task.id)).access),task.startDate,task.dueDate) : [], conversionLinks:await listConversionLinks(db,actor,'task',task.id), decision:task.kind==='approval'?await decisionPreview(db,actor,task.id):null, addable: open.map(project => ({ value: project.id, label: project.name })), sections, tagOptions:(await tagCatalogue(db,actor,workspace)).filter(t=>!t.archived).map(t=>({value:t.id,label:t.name})), preview: task.personal && url.searchParams.get('projectId') ? await visibilityPreview(db,actor,task.id,url.searchParams.get('projectId')!) : null }))
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
    if (section === 'inbox') return page('Inbox', h(InboxPage, { viewer, toDecide: await pendingFor(db, actor, { origin: env.AUTH_ORIGIN, from: env.MAIL_FROM, mail: operatorMail(env) }), mine: await myRequests(db, actor),readiness:await readinessNotices(db,actor,workspace) }))
    if (section === 'access-requests' && id) {
      let preview
      try { preview = await previewRequest(db, actor, id) } catch (error) { if (error instanceof PegError && error.status === 404) return refuse(db, actor, viewer, id); throw error }
      return page('Access request', h(DecisionPage, { viewer, request: preview }))
    }
    if (section === 'link' && id) {
      const target = decodeURIComponent(id)
      if (url.searchParams.get('asked')) return refuse(db, actor, viewer, target, true)
      const taskId = await resolveTaskId(db, target)
      for (const [type, where] of [['tasks', taskId], ['projects', target.startsWith('prj_') ? target : null], ['teams', target.startsWith('team_') ? target : null], ['portfolios', target.startsWith('pf_') ? target : null]] as const) {
        if (!where) continue
        const opened = type === 'tasks' ? await viewTask(db, actor, where).then(() => true, () => false) : type === 'projects' ? await openProject(db, actor, where).then(() => true, () => false) : type === 'portfolios' ? await openPortfolio(db, actor, where).then(() => true, () => false) : await teamEffective(db, actor, (await loadTeam(db, where))!).then(effective => effective.capabilities.has('read'), () => false)
        if (opened) return new Response(null, { status: 303, headers: { location: `/app/${type}/${where}`, 'cache-control': 'no-store' } })
      }
      return refuse(db, actor, viewer, target)
    }
    if(section==='admin'&&id==='removal'&&tail) return page('Member removal',h(MemberRemovalPage,{viewer,workspace,review:await removalPreview(db,actor,tail),receipt:url.searchParams.has('removed')}))
    if (section === 'access-review' || section === 'admin') {
      if (!isAdministrator(await workspaceRole(db, actor.id, workspace))) return refuse(db, actor, viewer, section)
      if (section === 'access-review') return page('Access review', h(AccessReviewPage, { viewer, review: await accessReview(db, actor, workspace, { action: url.searchParams.get('action') ?? undefined }) }))
      return page('Administration', h(AdminPage, { viewer, workspace, settings: await workspaceSettings(db, workspace), people: await listPeople(db, actor, workspace) }))
    }
  } catch (error) {
    if(section==='conversions'&&error instanceof PegError&&![403,404].includes(error.status))return errorDocument(error.status,error.code)
    if (error instanceof PegError) return page('Not available', h(RefusalPage, { viewer, target: '', canAsk: false, asked: false }), error.status)
    throw error
  }
  return null
}
