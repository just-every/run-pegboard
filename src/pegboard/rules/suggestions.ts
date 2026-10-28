import {all,bound,conflict,first,newId,notFound,now} from '../db'
import {guarded,revision} from '../decisions/revision'
import {openProject,need} from '../workspace/projects'
import {ruleAdministrator,text} from '../templates/rule-definition'
import {workspaceRole,type Actor} from '../workspace/people'
interface Suggestion {id:string;project_id:string;requested_by:string;message:string;status:string;reviewed_by:string|null;created_at:number;reviewed_at:number|null}
export async function suggestionView(db:D1Database,actor:Actor,projectId:string){
 const {project,effective}=await openProject(db,actor,projectId);need(effective,'edit')
 const role=await workspaceRole(db,actor.id,project.workspace_id)
 if(!role||['agent','guest','analyst'].includes(role))throw notFound()
 const people=await all<{id:string;email:string;display_name:string;role:Actor['baseRole']}>(db,"SELECT o.* FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=? WHERE o.status='active' AND (o.role IN ('owner','admin') OR m.operator_id IS NOT NULL)",project.workspace_id)
 const responsible=[]
 for(const person of people){try{await ruleAdministrator(db,{id:person.id,email:person.email,displayName:person.display_name,baseRole:person.role},projectId);responsible.push({id:person.id,name:person.display_name})}catch(error){if(!error||typeof error!=='object'||!('status' in error)||![403,404].includes(Number(error.status)))throw error}}
 const admin=effective.capabilities.has('manage_rules')
 return {project,responsible,admin,requests:await all<Suggestion>(db,'SELECT * FROM peg_rule_suggestions WHERE project_id=?'+(admin?'':' AND requested_by=?')+' ORDER BY created_at DESC',projectId,...(admin?[]:[actor.id]))}
}
export async function suggestRule(db:D1Database,actor:Actor,projectId:string,input:Record<string,any>){
 const rev=await revision(db);await suggestionView(db,actor,projectId)
 const message=text(input.message,'rule_suggestion',2000),id=newId('rulesuggestion')
 await guarded(db,rev,[bound(db,"INSERT INTO peg_rule_suggestions(id,project_id,requested_by,message,status,created_at) VALUES(?,?,?,?,'submitted',?)",[id,projectId,actor.id,message,now()])]);return {id,status:'submitted'}
}
export async function reviewSuggestion(db:D1Database,actor:Actor,id:string){
 const rev=await revision(db),request=await first<Suggestion>(db,'SELECT * FROM peg_rule_suggestions WHERE id=?',id)
 if(!request)throw notFound();await ruleAdministrator(db,actor,request.project_id)
 if(request.status!=='submitted')throw conflict('suggestion_already_reviewed')
 await guarded(db,rev,[bound(db,"UPDATE peg_rule_suggestions SET status='reviewed',reviewed_by=?,reviewed_at=? WHERE id=?",[actor.id,now(),id])]);return {id,status:'reviewed'}
}
