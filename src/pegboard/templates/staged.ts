import {all,bound,conflict,first,newId,notFound,now} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {loadApplication} from './adoption'
import {openProject,need} from '../workspace/projects'
import type {Actor} from '../workspace/people'
interface Staged {id:string;application_id:string;project_id:string;rule_key:string;definition:string;active:number}
export async function stagedRules(db:D1Database,actor:Actor,applicationId:string){await loadApplication(db,actor,applicationId);return (await all<Staged>(db,'SELECT * FROM peg_template_staged_rules WHERE application_id=? ORDER BY rule_key',applicationId)).map(r=>({...r,definition:JSON.parse(r.definition)}))}
export async function stagedRulePreview(db:D1Database,actor:Actor,id:string){
 const rev=await revision(db),rule=await first<Staged>(db,'SELECT * FROM peg_template_staged_rules WHERE id=?',id);if(!rule)throw notFound()
 const application=await loadApplication(db,actor,rule.application_id),{effective}=await openProject(db,actor,rule.project_id);need(effective,'manage_rules')
 const plan={ruleId:id,applicationId:application.id,projectId:rule.project_id,workspace:application.workspace_id,active:!!rule.active,definition:JSON.parse(rule.definition),effect:'Set the priority of future new tasks in this project. Existing tasks and template-created tasks are unchanged.'}
 return {...plan,rev,token:await digest([actor.id,rev,plan])}
}
export async function activateStagedRule(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const view=await stagedRulePreview(db,actor,id);if(input.token!==view.token)throw conflict('template_rule_review_changed');if(view.active)throw conflict('template_rule_already_active')
 const bundleId=newId('bundle'),component={kind:'rule',name:view.definition.name,priority:view.definition.priority,actions:[]},config=JSON.stringify(component),at=now()
 await guarded(db,view.rev,[bound(db,'INSERT INTO peg_bundles VALUES(?,?,?,?,?)',[bundleId,view.workspace,view.definition.name,actor.id,at]),bound(db,'INSERT INTO peg_bundle_versions VALUES(?,?,?,?,?)',[bundleId,1,JSON.stringify({priority:component}),actor.id,at]),bound(db,'INSERT INTO peg_bundle_adoptions VALUES(?,?,1,1,?)',[bundleId,view.projectId,actor.id]),bound(db,'INSERT INTO peg_bundle_items VALUES(?,?,?,?,?,?,?)',[bundleId,view.projectId,'priority','rule',config,config,1]),bound(db,'INSERT INTO peg_bundle_history VALUES(?,?,?,?,?,?,?)',[newId('bundleevent'),bundleId,view.projectId,actor.id,'template.rule_activated',JSON.stringify({ruleId:id}),at]),bound(db,'UPDATE peg_template_staged_rules SET active=1 WHERE id=?',[id])])
 return {bundleId,projectId:view.projectId}
}
