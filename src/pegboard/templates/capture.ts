import {all,bound,conflict,first,invalid,newId,now} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {templateAdmin} from './definitions'
import {openProject} from '../workspace/projects'
import {openTask} from '../tasks/access'
import {definitions} from '../fields/definitions'
import {dayNumber,workingBetween} from '../schedule/calendar'
import type {Actor} from '../workspace/people'
import type {TaskRow} from '../model'
import type {TemplateDefinition} from './types'
export async function captureTemplatePreview(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>){
 const rev=await revision(db),projectId=String(input.sourceProjectId??''),project=(await openProject(db,actor,projectId)).project
 if(project.workspace_id!==workspace)throw invalid('workspace');await templateAdmin(db,actor,workspace,projectId)
 const roots=input.sourceTaskId?[String(input.sourceTaskId)]:(await all<{task_id:string}>(db,'SELECT task_id FROM peg_task_projects WHERE project_id=? ORDER BY position,task_id',projectId)).map(t=>t.task_id)
 const tasks:TaskRow[]=[],queue=[...roots],seen=new Set<string>()
 while(queue.length){const id=queue.shift()!;if(seen.has(id))continue;seen.add(id);const {task,access}=await openTask(db,actor,id)
  if(task.workspace_id!==workspace||!access.contexts.has(projectId)||task.internal_only)throw invalid('template_private_task_excluded')
  if(input.sourceTaskId&&id===input.sourceTaskId&&task.parent_id)throw invalid('template_root_required')
  tasks.push(task);if(tasks.length>300)throw invalid('template_task_limit');queue.push(...(await all<{id:string}>(db,'SELECT id FROM peg_tasks WHERE parent_id=? ORDER BY created_at,id',id)).map(t=>t.id))
 }
 if(!tasks.length)throw invalid('template_tasks')
 const keys=new Map(tasks.map((t,i)=>[t.id,`task_${i+1}`])),owners=[...new Set(tasks.map(t=>t.owner_id))],roles=owners.map((_,i)=>`Role ${i+1}`),sections=await all<{id:string;name:string}>(db,'SELECT id,name FROM peg_sections WHERE project_id=? ORDER BY position,id',projectId),homeSections=new Map((await all<{task_id:string;section_id:string}>(db,'SELECT task_id,section_id FROM peg_task_projects WHERE project_id=?',projectId)).map(h=>[h.task_id,h.section_id]))
 const phase=(task:TaskRow):string=>{const root=task.parent_id?tasks.find(t=>t.id===task.parent_id):null;return root?phase(root):sections.find(s=>s.id===homeSections.get(task.id))?.name??'Work'}
 const phases=[...new Set(tasks.map(phase))],base=[project.start_date,...tasks.map(t=>t.start_date??t.due_date)].filter((d):d is string=>!!d).sort()[0];if(!base)throw invalid('source_start_date_required')
 const definition:TemplateDefinition={kind:input.sourceTaskId?'task':'project',description:'',roles,phases,fields:(await definitions(db,projectId)).filter(f=>f.visibility==='everyone'&&['text','number','checkbox','single'].includes(f.type)).map(f=>({key:f.key,label:f.label,type:f.type as any,...(f.type==='single'?{options:JSON.parse(f.config).options}:{})})),tasks:[],dependencies:[],rules:[]}
 for(const task of tasks)definition.tasks.push({key:keys.get(task.id)!,title:task.title,phase:phase(task),role:roles[owners.indexOf(task.owner_id)],start:workingBetween(dayNumber(base),dayNumber(task.start_date??task.due_date??base)),due:workingBetween(dayNumber(base),dayNumber(task.due_date??task.start_date??base)),hours:task.estimate_hours,kind:task.parent_id?'subtask':task.kind,...(task.parent_id?{parent:keys.get(task.parent_id)!}:{}),approval:!!await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',task.id),fields:{}})
 for(const edge of await all<{predecessor_id:string;successor_id:string;type:'fs'|'ss'|'ff'|'sf';lag_days:number}>(db,'SELECT * FROM peg_dependencies WHERE workspace_id=?',workspace))if(keys.has(edge.predecessor_id)&&keys.has(edge.successor_id))definition.dependencies.push({predecessor:keys.get(edge.predecessor_id)!,successor:keys.get(edge.successor_id)!,type:edge.type,lag:edge.lag_days})
 for(const [i,r] of (await all<{config:string}>(db,"SELECT config FROM peg_bundle_items WHERE project_id=? AND kind='rule' ORDER BY item_key",projectId)).entries()){
  const config=JSON.parse(r.config);if(['normal','high','urgent'].includes(config.priority))definition.rules.push({key:`rule_${i+1}`,name:String(config.name??'New task priority'),trigger:'task_created',action:'set_priority',priority:config.priority})
 }
 const plan={sourceProjectId:projectId,sourceTaskId:input.sourceTaskId??null,authorityProjectId:projectId,name:String(input.name??'').trim(),definition,notice:'Owners become role placeholders. Field values, descriptions, notes, comments, files, audience and prior decisions are excluded. Retained priority rules stay inactive.'}
 if(!plan.name||plan.name.length>120)throw invalid('name')
 return {...plan,rev,token:await digest([actor.id,rev,plan])}
}
export async function captureTemplate(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>){
 const view=await captureTemplatePreview(db,actor,workspace,input);if(input.token!==view.token)throw conflict('template_capture_changed')
 const id=newId('reusable'),at=now()
 await guarded(db,view.rev,[bound(db,'INSERT INTO peg_reusable_templates VALUES(?,?,?,?,?,?,?)',[id,workspace,view.name,'custom',view.authorityProjectId,actor.id,at]),bound(db,'INSERT INTO peg_reusable_template_versions VALUES(?,?,?,?,?)',[id,1,JSON.stringify(view.definition),actor.id,at])]);return {id,version:1}
}
