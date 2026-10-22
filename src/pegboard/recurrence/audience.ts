// A standing share is reviewed once, then fenced against changes before each occurrence.
import { all, first, forbidden, invalid, now } from '../db'
import { activeGrants, canDelegate, teamsOf } from '../authorization/effective'
import { isAdministrator, sharesWithWorkspace } from '../authorization/levels'
import { openProject, need } from '../workspace/projects'
import { displayNames, operatorRow, workspaceRole, workspaceSettings, type Actor } from '../workspace/people'
import { digest } from '../decisions/revision'
import type { GrantRow, ProjectRow, TaskRow } from '../model'
import type { Snapshot } from './recurrence'
export interface Audience { teamName:string|null; project:Pick<ProjectRow,'visibility'|'team_id'|'team_level'|'workspace_level'>|null; grants:GrantRow[]; revision:string; labels:{id:string;name:string;level:string}[] }
const internal = async(db:D1Database,id:string,workspace:string) => sharesWithWorkspace(await workspaceRole(db,id,workspace))
async function standing(db:D1Database,workspace:string,person:string) {
  const operator=await operatorRow(db,person)
  return [person,await workspaceRole(db,person,workspace),operator?.version??null]
}
async function teamStanding(db:D1Database,workspace:string,id:string) {
  const team=await first(db,'SELECT id,policy_rev FROM peg_teams WHERE id=? AND workspace_id=?',id,workspace)
  if(!team)throw invalid('audience_team_unavailable')
  const members=await activeGrants(db,'team',id)
  const people=[]
  for(const grant of members.sort((a,b)=>a.id.localeCompare(b.id)))people.push([grant,await standing(db,workspace,grant.grantee_id)])
  return [team,people]
}
export async function reviewAudience(db:D1Database,actor:Actor,source:Snapshot,selected:string[]):Promise<Audience> {
  if(!source.project)return {teamName:null,project:null,grants:[],revision:await digest(null),labels:[]}
  const {project:p,effective}=await openProject(db,actor,source.sourceId)
  need(effective,'manage_shares')
  const project={visibility:p.visibility,team_id:p.team_id,team_level:p.team_level,workspace_level:p.workspace_level}
  if(p.visibility!=='private'&&!canDelegate(effective,p.visibility==='team'?p.team_level:p.workspace_level))throw forbidden('audience_delegation')
  if(p.visibility==='workspace'&&!(await workspaceSettings(db,p.workspace_id)).workspaceSharing)throw forbidden('workspace_sharing')
  const grants:GrantRow[]=[],labels:Audience['labels']=[],states:unknown[]=[]
  for(const id of [...new Set(selected)].sort()){
    const grant=(await activeGrants(db,'project',p.id)).find(g=>g.id===id)
    if(!grant||grant.scope==='approve')throw invalid('internal_audience_only')
    if(!canDelegate(effective,grant.level))throw forbidden('audience_delegation')
    if(grant.grantee_type==='person'){
      if(!await internal(db,grant.grantee_id,p.workspace_id))throw invalid('internal_audience_only')
      states.push(await standing(db,p.workspace_id,grant.grantee_id))
      labels.push({id,name:(await displayNames(db,[grant.grantee_id])).get(grant.grantee_id)??'Unavailable person',level:grant.level})
    }else{
      states.push(await teamStanding(db,p.workspace_id,grant.grantee_id))
      labels.push({id,name:String((await first<{name:string}>(db,'SELECT name FROM peg_teams WHERE id=?',grant.grantee_id))!.name),level:grant.level})
    }
    grants.push(grant)
  }
  if(p.visibility==='team')states.push(await teamStanding(db,p.workspace_id,p.team_id!))
  if(p.visibility==='workspace'){
    const people=await all<{id:string}>(db,`SELECT o.id FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=? WHERE o.status='active' AND (o.role IN ('owner','admin') OR m.role IN ('manager','member','analyst')) ORDER BY o.id`,p.workspace_id)
    for(const person of people)states.push(await standing(db,p.workspace_id,person.id))
  }
  const teamName=p.team_id?(await first<{name:string}>(db,'SELECT name FROM peg_teams WHERE id=?',p.team_id))?.name??null:null
  return {teamName,project,grants,labels,revision:await digest([project,p.policy_rev,grants,states])}
}
export async function audienceChoices(db:D1Database,actor:Actor,source:Snapshot) {
  if(!source.project)return []
  const choices=[]
  for(const grant of await activeGrants(db,'project',source.sourceId)){
    try{const review=await reviewAudience(db,actor,source,[grant.id]);choices.push(review.labels[0])}catch{}
  }
  return choices
}
/** Assignment is deliberately absent from the grant calculation. */
export async function unreachable(db:D1Database,activator:Actor,source:Snapshot,audience:Audience) {
  const out: {taskId:string;title:string;ownerId:string;name:string}[]=[]
  for(const task of source.tasks){
    const role=await workspaceRole(db,task.owner_id,task.workspace_id)
    let reads=false
    if(source.project){
      const p=audience.project!,teams=await teamsOf(db,task.owner_id)
      const internal=sharesWithWorkspace(role)
      reads=!!role&&(isAdministrator(role)||task.owner_id===activator.id||internal&&(p.visibility==='workspace'||p.visibility==='team'&&teams.some(t=>t.object_id===p.team_id)||audience.grants.some(g=>(g.grantee_type==='person'?g.grantee_id===task.owner_id:teams.some(t=>t.object_id===g.grantee_id))&&(!g.scopes||g.scopes.split(',').includes('read')))))
      if(role==='guest'&&task.internal_only)reads=false
    }else{
      // Use the pinned homes, including homes the source has since left.
      for(const home of source.homes){
        try{await openProject(db,{...activator,id:task.owner_id},home.project_id);reads=true}catch{}
      }
      if(!source.homes.length)reads=!!role&&task.owner_id===activator.id
    }
    if(!reads)out.push({taskId:task.id,title:task.title,ownerId:task.owner_id,name:(await displayNames(db,[task.owner_id])).get(task.owner_id)??'Unavailable assignee'})
  }
  return out
}
