import { all, batch, bound, invalid, now, type Param } from '../db'
import { requireAdministrator } from '../admin/settings'
import { auditMetadata } from './metadata'
import type { Actor } from '../workspace/people'

export const permanentEvent=(db:D1Database,input:{workspace:string|null;actor:string|null;action:string;type:string;id:string;result?:string;metadata?:Record<string,unknown>})=>bound(db,'INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail) VALUES(?,?,?,?,?,?,?,?)',[input.workspace,now(),input.actor,input.action,input.type,input.id,input.result??'success',JSON.stringify(auditMetadata(input.metadata))])
/** Local rule receipts commit with the definition, queue or terminal work transaction. */
export function localRuleEvent(db:D1Database,input:{projectId:string;actor:string|null;action:string;ruleId:string;version:number;activationId?:string|null;runId?:string;operationId?:string|null;eventId?:string;taskId?:string;triggerActorId?:string;activatedById?:string|null;result?:string;outcome?:string;workCount?:number}) {
  const {projectId,actor,action,result='success',...metadata}=input
  return bound(db,`INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail)
    SELECT workspace_id,?,?,?,?,?,?,? FROM peg_projects WHERE id=?${input.runId?' AND EXISTS(SELECT 1 FROM peg_local_rule_runs WHERE id=?)':''}`,
    [now(),actor,action,'rule',input.ruleId,result,JSON.stringify(auditMetadata(metadata)),projectId,...(input.runId?[input.runId]:[])])
}
export async function searchAudit(db:D1Database,actor:Actor,workspace:string,filter:Record<string,unknown>={}) {
  const role=await requireAdministrator(db,actor,workspace)
  // Installation authentication events are owner-only; personal work remains outside workspace audit.
  const args:Param[]=[workspace,actor.id], conditions=[role==='owner'?"(workspace_id=? OR (workspace_id IS NULL AND (actor_id=? OR action LIKE 'authentication.%' OR action LIKE 'archive.%')))":'(workspace_id=? OR (workspace_id IS NULL AND actor_id=?))']
  for(const [key,column] of [['action','action'],['actor','actor_id'],['subject','target_id']] as const) if(filter[key]){
    const value=String(filter[key]);if(value.length>100)throw invalid('audit_filter')
    conditions.push(`${column}=?`);args.push(value)
  }
  for(const [key,field] of [['rule','ruleId'],['run','runId'],['activation','activationId'],['operation','operationId']] as const) if(filter[key]) {
    const value=String(filter[key]);if(value.length>100)throw invalid('audit_filter')
    conditions.push(`json_extract(detail,'$.${field}')=?`);args.push(value)
  }
  const after=filter.after===undefined?0:Number(filter.after), limit=filter.limit===undefined?100:Number(filter.limit)
  if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>500)throw invalid('audit_page')
  args.push(after,limit+1)
  const rows=await all<{id:number;at:number;actor_id:string|null;action:string;target_type:string|null;target_id:string|null;subject_id:string|null;result:string;detail:string;erased:number}>(db,`SELECT a.*,EXISTS(SELECT 1 FROM peg_erased_people e WHERE e.operator_id=a.actor_id) erased FROM peg_permanent_audit a WHERE ${conditions.join(' AND ')} AND a.id>? ORDER BY a.id LIMIT ?`,...args)
  return {events:rows.slice(0,limit).map(({detail,erased,...row})=>({...row,actor:erased?'Erased actor':row.actor_id??'System',metadata:JSON.parse(detail)})),next:rows.length>limit?rows[limit-1].id:null}
}
export async function exportAudit(db:D1Database,actor:Actor,workspace:string,filter:Record<string,unknown>) {
  const result=await searchAudit(db,actor,workspace,filter)
  await batch(db,[permanentEvent(db,{workspace,actor:actor.id,action:'audit.exported',type:'workspace',id:workspace,metadata:{rows:result.events.length}})])
  return result
}
