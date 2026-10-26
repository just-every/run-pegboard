import {first} from '../db'
import {displayNames} from '../workspace/people'
interface Origin {run_id:string;operation_id:string|null;task_id:string;project_id:string;definition_version:number;activation_epoch:number;activating_admin:string;work_count:number}
/** Call only after the operation's complete task scope has been authorized. */
export async function ruleOrigin(db:D1Database,operationId:string) {
 const row=await first<Origin>(db,'SELECT * FROM peg_rule_effect_runs WHERE operation_id=?',operationId)
 if(!row)return null
 const names=await displayNames(db,[row.activating_admin])
 return {...row,admin:names.get(row.activating_admin)??'Former member',externalLimits:'Undo preserves separate approvals and does not recall outside messages.'}
}
