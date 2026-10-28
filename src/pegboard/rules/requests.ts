import {bound,conflict,first,newId,now} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {openProject,need} from '../workspace/projects'
import {openTask} from '../tasks/access'
import {prepareTask} from '../tasks/tasks'
import {historyStatement} from '../tasks/history'
import {text} from '../templates/rule-definition'
import type {Actor} from '../workspace/people'
import {localRuleQueue,processLocalRules} from './execution'
import {processTemplateRuleRuns} from '../templates/rule-execution'
/** A scoped internal request creates ordinary work; a retried submission keeps its first identity. */
export async function submitRuleRequest(db:D1Database,actor:Actor,projectId:string,input:Record<string,any>){
 const rev=await revision(db),{project,effective}=await openProject(db,actor,projectId);need(effective,'edit')
 const key=text(input.requestKey,'request_key',100),value={title:text(input.title,'title',300),startDate:input.startDate||null,dueDate:input.dueDate||null},fingerprint=await digest([actor.id,value])
 const previous=await first<{task_id:string;fingerprint:string}>(db,'SELECT * FROM peg_rule_requests WHERE project_id=? AND request_key=?',projectId,key)
 if(previous){if(previous.fingerprint!==fingerprint)throw conflict('request_replay_changed');await openTask(db,actor,previous.task_id);await processTemplateRuleRuns(db,projectId);await processLocalRules(db,projectId);return {id:previous.task_id,replayed:true}}
 const prepared=await prepareTask(db,actor,{projectId,...value})
 const queued=await localRuleQueue(db,prepared.id,'form',actor.id,projectId,true)
 await guarded(db,rev,[...prepared.statements,bound(db,'INSERT INTO peg_rule_requests VALUES(?,?,?,?,?,?)',[newId('request'),project.id,key,fingerprint,prepared.id,now()]),historyStatement(db,prepared.id,projectId,actor.id,'request.submitted',{}),...queued])
 await processTemplateRuleRuns(db,projectId);await processLocalRules(db,projectId)
 return {id:prepared.id,replayed:false}
}
