import {vectorTodo,vectorDone} from './engineering-services.mjs'
import assert from 'node:assert/strict'

export function choicesFor(review,replacement) {
  return Object.fromEntries(review.affected.filter(set=>set.rows.length).map(set=>[set.key,set.mode==='transfer'?replacement:set.mode]))
}

/** Public product doors create the same responsibilities used by API and browser journeys. */
export async function createDepartureFixture({w,ok,suffix}) {
  const owner=w.owner
  let departing=await w.person(`departure-${suffix}@example.com`,'Departing manager','manager')
  const agent=await w.person(`departure-agent-${suffix}@example.com`,'Delegated planner','agent')
  const editor=await w.person(`departure-editor-${suffix}@example.com`,'Remaining editor')
  await ok(owner.post(`/api/v1/workspaces/ws_main/people/${departing.id}/account`,{role:'admin'}))
  departing=await w.signIn(departing.email,departing.name,departing.id)
  const project=await ok(departing.post('/api/v1/projects',{name:`Departure project ${suffix}`}))
  await ok(departing.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:editor.id,level:'editor'}))
  const task=await ok(departing.post('/api/v1/tasks',{projectId:project.id,title:'Retain assigned work',ownerId:departing.id}))
  await ok(departing.post(`/api/v1/tasks/${task.id}/comments`,{body:'Original handover context'}))
  const approval=await ok(owner.post('/api/v1/tasks',{projectId:project.id,title:'Pending independent review',kind:'approval',ownerId:departing.id}))
  const decided=await ok(owner.post('/api/v1/tasks',{projectId:project.id,title:'Already reviewed work',kind:'approval',ownerId:editor.id}))
  const decisionPreview=await ok(departing.get(`/api/v1/tasks/${decided.id}/decision-preview`))
  await ok(departing.post(`/api/v1/tasks/${decided.id}/decision`,{revision:decisionPreview.token,action:'approve',reason:'Reviewed before departure'}))
  const decidedBefore=await ok(owner.get(`/api/v1/tasks/${decided.id}/decision-preview`))
  const personal=await ok(departing.post('/api/v1/tasks',{title:'Private departure work'}))
  const portfolio=await ok(departing.post('/api/v1/portfolios',{name:'Departure portfolio'}))
  await ok(departing.post(`/api/v1/portfolios/${portfolio.id}/projects`,{projectId:project.id}))
  const goal=await ok(departing.post('/api/v1/goals',{title:'Departure objective',scope:'company',kind:'objective',periodStart:'2026-10-01',periodEnd:'2026-12-31',mode:'manual',unit:'percent'}))
  const tag=await ok(departing.post('/api/v1/tags',{name:'Handover stewardship'}))
  const privateGoal=await ok(departing.post('/api/v1/goals',{title:'Private departure objective',scope:'personal',kind:'objective',periodStart:'2026-10-01',periodEnd:'2026-12-31',mode:'manual'}))
  const team=await ok(departing.post('/api/v1/teams',{name:'Handover access reviewers'}))
  await ok(departing.patch(`/api/v1/teams/${team.id}`,{approvers:[departing.id]}))
  const personalSection=await ok(departing.post('/api/v1/my-tasks/sections',{name:'Daily focus'}))
  await ok(departing.post('/api/v1/my-tasks/rules',{group:'Today',sectionId:personalSection.id}))
  await ok(departing.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:agent.id,level:'editor',scopes:['read','comment','edit']}))
  const engineering=await ok(departing.post(`/api/v1/tasks/${task.id}/engineering`,{service:'vector',locator:'SYN-1',mappings:{[vectorTodo]:'todo',[vectorDone]:'done'},direction:'inbound',consent:true,credential:'synthetic-pegboard-800'}))
  let meeting=await ok(departing.post('/api/v1/meetings',{service:'zoom',sourceId:`synthetic-pegboard-${suffix}`,content:'WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nAction: Review the launch delivery\n',sourceAuthority:true,organizerConsent:true,participantConsent:true}))
  const proposal=meeting.proposals[0]
  await ok(departing.post(`/api/v1/meeting-proposals/${proposal.id}/revise`,{version:proposal.version,title:proposal.title,ownerId:departing.id,dueDate:'2027-01-05',dateResolved:true}))
  const risk=await ok(departing.post(`/api/v1/projects/${project.id}/register`,{kind:'risk',title:'Printer capacity risk',ownerId:departing.id,approverId:departing.id,impact:'Retail launch could slip',nextAction:'Reserve backup production',reviewDate:'2027-01-04',taskId:task.id}))
  const scheduleMoves=[{taskId:task.id,due:'2027-01-08'}]
  const proposed=await ok(agent.post('/api/v1/schedule/preview',{moves:scheduleMoves}))
  const schedule=await ok(agent.post('/api/v1/schedule/apply',{moves:scheduleMoves,revision:proposed.stamp,approverId:departing.id}))
  const recurringInput={sourceType:'task',sourceId:task.id,mode:'calendar',timezone:'America/New_York',unit:'week',interval:1,start:'2027-01-04',count:2}
  const recurringPreview=await ok(departing.post('/api/v1/recurrences/preview',recurringInput))
  const recurrence=await ok(departing.post('/api/v1/recurrences',{...recurringInput,revision:recurringPreview.token}))
  const webhookResponse=await departing.post('/api/v1/webhooks',{projectId:project.id,url:'https://example.com/departure-hook'})
  assert.equal(webhookResponse.status,200,'create departure webhook')
  const webhook={id:webhookResponse.body.id}
  const bundle=await ok(departing.post('/api/v1/workflow-bundles',{name:'Departure workflow'}))
  const bundlePath=`/api/v1/workflow-bundles/${bundle.id}`
  let bundleView=await ok(departing.get(bundlePath))
  await ok(departing.post(bundlePath+'/versions',{version:bundleView.current.version,key:'priority',kind:'rule',name:'Reviewed priority rule',priority:'high'}))
  bundleView=await ok(departing.get(bundlePath))
  await ok(departing.post(bundlePath+'/versions',{version:bundleView.current.version,key:'review',kind:'stages',name:'Handover stages',titles:['Independent handover review','Final handover review']}))
  const adoption=await ok(departing.post(bundlePath+'/preview',{projectIds:[project.id]}))
  await ok(departing.post(bundlePath+'/adopt',{projectIds:[project.id],keys:['priority','review'],revision:adoption.token}))
  const stage=await ok(departing.post(bundlePath+`/projects/${project.id}/start`,{key:'review',ownerId:departing.id}))
  const queuedTask=await ok(departing.post('/api/v1/tasks',{projectId:project.id,title:'Queued before departure',ownerId:departing.id}))
  // Never put a credential-bearing response in an assertion diagnostic.
  const credential=await departing.post('/api/v1/analytics/keys',{name:'Departure analyst access',projects:[project.id],fields:{Tasks:['id','status']},expiresAt:Date.now()+86400000,consent:true})
  assert.equal(credential.status,200,'create departure analyst access')
  const readAnalytics=()=>owner.call('GET',credential.body.servicePath+'/Tasks',undefined,{authorization:'Bearer '+credential.body.secret,cookie:''})
  return {owner,departing,editor,agent,privateGoal,team,engineering,meeting,risk,schedule,project,task,approval,decided,decidedBefore,personal,portfolio,goal,tag,recurrence,webhook,bundle,bundlePath,stage,queuedTask,readAnalytics,
    removalPath:`/api/v1/workspaces/ws_main/people/${departing.id}`}
}
