import {bound,first,forbidden,invalid,newId,notFound,now} from '../db'
import {openProject,need} from '../workspace/projects'
import {workspaceRole,type Actor} from '../workspace/people'
export interface TemplateRuleDefinition {
 templateId:string; templateVersion:number; name:string; roles:Record<string,string|null>; keepUnassigned:boolean
 date:{source:'fixed'|'task_start'|'task_due';value?:string;offsetDays:number}
}
export interface TemplateRule {
 id:string;workspace_id:string;project_id:string;name:string;version:number;definition:string
 enabled:number;activation_id:string|null;created_by:string;created_at:number
}
export interface TemplateRuleRun {
 id:string;rule_id:string;task_id:string;definition_version:number;definition:string;activation_id:string|null
 status:'queued'|'pending'|'applied'|'noop';source:string;computed_start_date:string|null;result:string|null
 outcome:string|null;review_history:string;exact_review_activation_id:string|null;created_at:number;finished_at:number|null
}
export const text=(value:unknown,key:string,max=160)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw invalid(key);return value.trim()}
export function dateOnly(value:unknown):string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw invalid('rule_date')
 return value
}
export function computedDate(definition:TemplateRuleDefinition,source:string|null){
 const date=definition.date.source==='fixed'?definition.date.value!:source
 if(!date)return null
 const instant=new Date(dateOnly(date)+'T00:00:00Z');instant.setUTCDate(instant.getUTCDate()+definition.date.offsetDays)
 return dateOnly(instant.toISOString().slice(0,10))
}
export function ruleDefinition(input:Record<string,any>):TemplateRuleDefinition {
 let roles=input.roles??Object.fromEntries(Object.entries(input).filter(([key])=>key.startsWith('role:')).map(([key,value])=>[key.slice(5),value===''?null:value]))
 if(typeof roles==='string'){try{roles=JSON.parse(roles)}catch{throw invalid('rule_roles')}}
 if(!roles||typeof roles!=='object'||Array.isArray(roles))throw invalid('rule_roles')
 const ordered:Record<string,string|null>={}
 for(const key of Object.keys(roles).sort()){
  if(!key||key.length>100||key==='__proto__'||key==='constructor'||key==='prototype')throw invalid('rule_roles')
  if(roles[key]!==null&&typeof roles[key]!=='string')throw invalid('rule_roles')
  ordered[key]=roles[key]===null?null:text(roles[key],'rule_roles',100)
 }
 const source=input.date?.source??input.dateSource??'fixed',offsetDays=Number(input.date?.offsetDays??input.offsetDays??0)
 if(!['fixed','task_start','task_due'].includes(source)||!Number.isSafeInteger(offsetDays)||Math.abs(offsetDays)>3660)throw invalid('rule_date_mapping')
 const templateVersion=Number(input.templateVersion??input.version)
 if(!Number.isSafeInteger(templateVersion)||templateVersion<1)throw invalid('template_version')
 const keepUnassigned=input.keepUnassigned===true||input.keepUnassigned==='yes'||input.keepUnassigned==='on'
 return {templateId:text(input.templateId,'template',100),templateVersion,name:text(input.workName??input.name,'name',120),roles:ordered,keepUnassigned,date:{source,offsetDays,...(source==='fixed'?{value:dateOnly(input.date?.value??input.startDate)}:{})}}
}
export async function ruleAdministrator(db:D1Database,actor:Actor,projectId:string){
 const opened=await openProject(db,actor,projectId),role=await workspaceRole(db,actor.id,opened.project.workspace_id)
 if(!role||['agent','guest','analyst'].includes(role))throw forbidden('project_administrator')
 need(opened.effective,'manage_rules');return opened
}
export async function loadTemplateRule(db:D1Database,actor:Actor,id:string){
 const rule=await first<TemplateRule>(db,'SELECT * FROM peg_template_rules WHERE id=?',id)
 if(!rule)throw notFound()
 await ruleAdministrator(db,actor,rule.project_id);return rule
}
export const ruleEvent=(db:D1Database,ruleId:string,action:string,actorId:string|null,runId:string|null=null,previous?:TemplateRule)=>bound(db,`INSERT INTO peg_template_rule_events(id,rule_id,run_id,actor_id,action,at,definition_version,activation_id)
 SELECT ?,id,?,?,?,?,version,COALESCE(?,activation_id) FROM peg_template_rules WHERE id=?`,[newId('ruleevent'),runId,actorId,action,now(),previous?.activation_id??null,ruleId])
export const ruleInput=(rule:TemplateRule,definition:TemplateRuleDefinition,startDate:string,token?:string)=>({templateId:definition.templateId,version:definition.templateVersion,startDate,name:definition.name,roles:definition.roles,keepUnassigned:definition.keepUnassigned,targetProjectId:rule.project_id,...(token?{token}:{})})
