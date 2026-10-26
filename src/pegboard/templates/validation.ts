import {invalid} from '../db'
import type {TemplateDefinition} from './types'
const text=(v:unknown,n:number)=>{if(typeof v!=='string'||!v.trim()||v.length>n)throw invalid('template_text');return v.trim()}
const array=(v:unknown,n:number):any[]=>{if(!Array.isArray(v)||v.length>n)throw invalid('template_structure');return v}
export function definitionInput(raw:unknown):TemplateDefinition {
 let v:any=raw;try{if(typeof v==='string')v=JSON.parse(v)}catch{throw invalid('template_definition')}
 if(!v||!['project','task'].includes(v.kind))throw invalid('template_kind')
 const roles=array(v.roles,30).map(r=>text(r,80)),phases=array(v.phases,50).map(p=>text(p,100))
 if(!roles.length||!phases.length||new Set(roles).size!==roles.length||new Set(phases).size!==phases.length)throw invalid('template_roles_phases')
 const key=(x:unknown)=>{const s=text(x,40);if(!/^[a-z][a-z0-9_]*$/.test(s))throw invalid('template_key');return s}
 const fields=array(v.fields,30).map(f=>{if(!f||typeof f!=='object')throw invalid('template_field');if(!['text','number','checkbox','single'].includes(f.type))throw invalid('template_field_type');return {key:key(f.key),label:text(f.label,80),type:f.type,...(f.type==='single'?{options:array(f.options,100).map(o=>text(o,80))}:{})}})
 if(new Set(fields.map(f=>f.key)).size!==fields.length||fields.some(f=>f.type==='single'&&!f.options?.length))throw invalid('template_fields')
 const tasks=array(v.tasks,300).map(t=>{
  if(!t||typeof t!=='object')throw invalid('template_task')
  const start=Number(t.start),due=Number(t.due),hours=Number(t.hours)
  if(!Number.isInteger(start)||!Number.isInteger(due)||Math.abs(start)>3650||Math.abs(due)>3650||due<start||!Number.isFinite(hours)||hours<0||hours>10000)throw invalid('template_dates_hours')
  const role=text(t.role,80),phase=text(t.phase,100);if(!roles.includes(role)||!phases.includes(phase))throw invalid('template_task_role_phase')
  if(t.kind&&!['task','subtask','milestone'].includes(t.kind)||t.kind==='subtask'&&!t.parent)throw invalid('template_task_kind')
  const values:Record<string,string|number|boolean>={}
  if(t.fields&&typeof t.fields!=='object'||Array.isArray(t.fields))throw invalid('template_field_values')
  for(const [k,value] of Object.entries(t.fields??{})){
   const f=fields.find(f=>f.key===k);if(!f||f.type==='text'&&(typeof value!=='string'||value.length>2000)||f.type==='number'&&(typeof value!=='number'||!Number.isFinite(value))||f.type==='checkbox'&&typeof value!=='boolean'||f.type==='single'&&(!f.options?.includes(value as string)))throw invalid('template_field_value')
   values[k]=value as string|number|boolean
  }
  return {key:key(t.key),title:text(t.title,200),phase,role,start,due,hours,kind:t.parent?'subtask':t.kind??'task',...(t.parent?{parent:key(t.parent)}:{}),approval:t.approval===true,fields:values}
 })
 if(!tasks.length||new Set(tasks.map(t=>t.key)).size!==tasks.length||v.kind==='task'&&tasks.filter(t=>!t.parent).length!==1)throw invalid('template_tasks')
 for(const t of tasks){let parent=t.parent;const visited=new Set([t.key]);while(parent){const p=tasks.find(t=>t.key===parent);if(!p||visited.has(parent)||visited.size>=50)throw invalid('template_parent_cycle');visited.add(parent);parent=p.parent}}
 const dependencies=array(v.dependencies,600).map(d=>{if(!d||typeof d!=='object')throw invalid('template_dependency');if(!tasks.some(t=>t.key===d.predecessor)||!tasks.some(t=>t.key===d.successor)||d.predecessor===d.successor||!['fs','ss','ff','sf'].includes(d.type)||!Number.isInteger(d.lag)||Math.abs(d.lag)>365)throw invalid('template_dependency');return {predecessor:d.predecessor,successor:d.successor,type:d.type,lag:d.lag}})
 if(new Set(dependencies.map(d=>d.predecessor+':'+d.successor)).size!==dependencies.length)throw invalid('template_dependency')
 const visiting=new Set<string>(),visited=new Set<string>();const visit=(k:string)=>{if(visiting.has(k))throw invalid('template_dependency_cycle');if(visited.has(k))return;visiting.add(k);for(const e of dependencies.filter(d=>d.predecessor===k))visit(e.successor);visiting.delete(k);visited.add(k)};for(const t of tasks)visit(t.key)
 const rules=array(v.rules,30).map(r=>{if(!r||typeof r!=='object')throw invalid('template_rule');if(r.trigger!=='task_created'||r.action!=='set_priority'||!['normal','high','urgent'].includes(r.priority))throw invalid('template_rule');return {key:key(r.key),name:text(r.name,120),trigger:r.trigger,action:r.action,priority:r.priority}})
 if(new Set(rules.map(r=>r.key)).size!==rules.length)throw invalid('template_rules')
 return {kind:v.kind,description:typeof v.description==='string'?v.description.slice(0,4000):'',roles,phases,fields,tasks,dependencies,rules}
}
