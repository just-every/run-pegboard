import {first} from '../db'
import {displayNames} from '../workspace/people'
interface Origin {run_id:string;operation_id:string|null;task_id:string;project_id:string;definition_version:number;activation_epoch:number;activating_admin:string;work_count:number}
/** Call only after the operation's complete task scope has been authorized. */
export async function ruleOrigin(db:D1Database,operationId:string) {
 const row=await first<Origin>(db,'SELECT * FROM peg_rule_effect_runs WHERE operation_id=?',operationId)??await first<Origin>(db,'SELECT id run_id,operation_id,task_id,(SELECT project_id FROM peg_local_rules WHERE id=rule_id) project_id,version definition_version,version activation_epoch,activated_by activating_admin,work_count FROM peg_local_rule_runs WHERE operation_id=?',operationId)
 if(!row)return null
 const names=await displayNames(db,[row.activating_admin])
 return {...row,admin:names.get(row.activating_admin)??'Former member',externalLimits:'Undo preserves separate approvals and does not recall outside messages.'}
}
