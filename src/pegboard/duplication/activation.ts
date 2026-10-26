import {all, bound, conflict, first, forbidden, invalid, newId, now} from '../db'
import {digest, guarded, revision} from '../decisions/revision'
import {auditStatement, bumpEpoch} from '../authorization/audit'
import {projectEffective} from '../authorization/effective'
import {workspaceRole, workspaceSettings, type Actor} from '../workspace/people'
import {workActions} from '../bundles/action-config'
import type {Component} from '../bundles/definitions'
import {duplicateResult} from './execution'
import {duplicationAdmin, selection, sourceDuplication, type MemberChoice, type RuleChoice} from './source'
import {shifted} from './preview'

/** Each activation is exact, separate from copying, and fenced on both current projects. */
export async function previewDuplicateActivation(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const rev=await revision(db),result=await duplicateResult(db,actor,id)
 if(!result.source)throw forbidden('duplicate_source_authority_required')
 await duplicationAdmin(db,actor,result.source.id)
 const current=await sourceDuplication(db,actor,result.source.id),stageIds=selection(input.stageIds)
 if(!stageIds.length)throw invalid('duplicate_stages_required')
 const selected=stageIds.map(stageId=>{const stage=result.staged.find(s=>s.id===stageId&&!s.activated_at);if(!stage)throw conflict('duplicate_stage_unavailable');return stage})
 const members:({stageId:string}&MemberChoice)[]=[],rules:{stageId:string;sourceId:string;name:string;config:Component;version:number}[]=[]
 for(const stage of selected.filter(s=>s.kind==='member')){
  const pinned=stage.config as MemberChoice,person=current.members.find(m=>m.id===pinned.id)
  if(!person||person.role!==pinned.role||person.level!==pinned.level||!Array.isArray(pinned.paths)||JSON.stringify(person.paths)!==JSON.stringify(pinned.paths))throw conflict('duplicate_member_changed')
  if(person.role==='guest'&&!(await workspaceSettings(db,result.project.workspace_id)).guestsAllowed)throw forbidden('guests_disabled')
  members.push({...person,stageId:stage.id})
 }
 const reaches=async(personId:string)=>{
  const member=members.find(m=>m.id===personId)
  if(member&&member.role!=='guest'&&member.paths.some(path=>path.scope!=='assignee'&&path.capabilities.includes('read')))return true
  const effective=await projectEffective(db,{...actor,id:personId},result.project)
  return effective.role!=='guest'&&effective.role!=='agent'&&effective.capabilities.has('read')
 }
 const offset=Number(result.options.offset??0)
 for(const stage of selected.filter(s=>s.kind==='rule')){
  const pinned=stage.config as RuleChoice,live=current.rules.find(r=>r.id===pinned.id)
  if(!live||live.version!==pinned.version||JSON.stringify(live.config)!==JSON.stringify(pinned.config))throw conflict('duplicate_rule_changed')
  const config:Component={...pinned.config,actions:workActions(pinned.config.actions)}
  if(config.kind!=='rule'||!['low','normal','high','urgent'].includes(config.priority??''))throw invalid('duplicate_rule_definition')
  if(config.ownerId){
   const role=await workspaceRole(db,config.ownerId,result.project.workspace_id)
   if(!role||role==='guest'||role==='agent'||!await reaches(config.ownerId))throw forbidden('duplicate_rule_owner_access_required')
  }
  for(const key of ['startDate','dueDate'] as const)if(config[key])config[key]=shifted(config[key]!,offset)!
  for(const action of config.actions??[]){
   if(action.kind==='project'){
    if(action.value!==result.source.id&&action.value!==id)throw forbidden('duplicate_rule_destination_review_required')
    action.value=id
   }
   if(action.kind==='collaborator'&&!await reaches(action.value!))throw forbidden('duplicate_rule_collaborator_access_required')
   if(action.kind==='tag'&&!await first(db,'SELECT 1 FROM peg_tag_projects p JOIN peg_tags t ON t.id=p.tag_id WHERE p.project_id=? AND p.tag_id=? AND t.archived=0 AND t.owner_id IS NULL',id,action.value!))throw forbidden('duplicate_rule_tag_adoption_required')
  }
  rules.push({stageId:stage.id,sourceId:stage.source_id,name:config.name,config,version:pinned.version})
 }
 // Members see the duplicate's present work, including edits made since creation.
 const tasks=[]
 for(const task of result.tasks)tasks.push({id:task.id,title:task.title,ownerId:task.ownerId,startDate:task.startDate,dueDate:task.dueDate,approval:task.approval})
 const review={project:{id:result.project.id,name:result.project.name,visibility:result.project.visibility},sourceId:result.source.id,members,rules,tasks,scope:'Copied rules apply only to future tasks created in this project. Existing copied work is unchanged.',stageIds}
 return {...review,rev,token:await digest([actor.id,rev,review])}
}
export async function activateDuplicate(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const review=await previewDuplicateActivation(db,actor,id,input)
 if(input.revision!==review.token)throw conflict('duplicate_activation_changed')
 const {project}=await duplicationAdmin(db,actor,id),at=now(),statements:D1PreparedStatement[]=[]
 for(const member of review.members)for(const path of member.paths){
  statements.push(bound(db,"INSERT INTO peg_grants(id,workspace_id,object_type,object_id,grantee_type,grantee_id,level,scope,scopes,source,created_by,created_at,expires_at) VALUES(?,?,'project',?,'person',?,?,?,?,'direct',?,?,?)",[newId('grant'),project.workspace_id,id,member.id,path.level,path.scope,path.capabilities.join(','),actor.id,at,path.expiresAt]))
 }
 if(review.rules.length){
  // An independent native bundle prevents later source edits from silently changing this activation.
  const bundleId=newId('bundle'),components=Object.fromEntries(review.rules.map((r,index)=>['rule_'+index,r.config]))
  statements.push(bound(db,'INSERT INTO peg_bundles VALUES(?,?,?,?,?)',[bundleId,project.workspace_id,`${project.name} copied rules`.slice(0,160),actor.id,at]),bound(db,'INSERT INTO peg_bundle_versions VALUES(?,1,?,?,?)',[bundleId,JSON.stringify(components),actor.id,at]),bound(db,'INSERT INTO peg_bundle_adoptions VALUES(?,?,1,1,?)',[bundleId,id,actor.id]))
  for(const [key,config] of Object.entries(components))statements.push(bound(db,"INSERT INTO peg_bundle_items VALUES(?,?,?,'rule',?,?,1)",[bundleId,id,key,JSON.stringify(config),JSON.stringify(config)]))
 }
 for(const stageId of review.stageIds)statements.push(bound(db,'UPDATE peg_duplicate_staged SET activated_at=?,activated_by=? WHERE id=? AND activated_at IS NULL',[at,actor.id,stageId]))
 statements.push(auditStatement(db,{workspaceId:project.workspace_id,actorId:actor.id,action:'project.duplicate_activated',targetType:'project',targetId:id,detail:{revision:review.token,members:review.members.map(m=>m.id),rules:review.rules.map(r=>r.sourceId)}}),bumpEpoch(db))
 await guarded(db,review.rev,statements)
 return duplicateResult(db,actor,id)
}
