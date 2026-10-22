// Whether a numeric source still stands. A source ends for good (revoked, expired, or its sponsor stopped being the
// goal's accountable owner) and an ended source never resumes, however the people around it change afterwards.
import {first,now} from '../db'
import {sharesWithWorkspace} from '../authorization/levels'
import {workspaceRole} from '../workspace/people'
/** Who may be named accountable for a company or team goal: an active internal human, never an agent, guest or analyst. */
export const accountableRoles=['owner','admin','manager','member']
export type EndCause='revoked'|'expired'|'ownership_changed'
export interface SourceRow {id:string;goal_id:string;owner_id:string;name:string;kind:'api'|'csv';token_hash:string|null;created_at:number;expires_at:number;ended_at:number|null;ended_cause:'revoked'|'ownership_changed'|null}
export type Standing={active:true}|{active:false;cause:EndCause;at:number}
export async function sourceStanding(db:D1Database,source:SourceRow,goal:{owner_id:string;workspace_id:string;scope:string}):Promise<Standing> {
  if(source.ended_at!==null)return {active:false,cause:source.ended_cause??'revoked',at:source.ended_at}
  if(source.expires_at<=now())return {active:false,cause:'expired',at:source.expires_at}
  const role=await workspaceRole(db,source.owner_id,goal.workspace_id)
  // The database ends a source when the owner changes; this also refuses a sponsor who no longer holds the seat.
  if(source.owner_id!==goal.owner_id||!(goal.scope==='personal'?sharesWithWorkspace(role):accountableRoles.includes(role??'')))return {active:false,cause:'ownership_changed',at:now()}
  return {active:true}
}
export const sourceOf=(db:D1Database,id:string)=>first<SourceRow>(db,'SELECT * FROM peg_goal_sources WHERE id=?',id)
