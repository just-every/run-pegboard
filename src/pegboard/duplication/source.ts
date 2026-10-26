import {all, first, forbidden, invalid} from '../db'
import {projectEffective} from '../authorization/effective'
import {openProject, need, fieldReadable, listSections} from '../workspace/projects'
import {workspaceRole, displayNames, type Actor} from '../workspace/people'
import {openTask} from '../tasks/access'
import {definitions, projectTaskIds} from '../fields/definitions'
import type {TaskRow} from '../model'
import type {Component} from '../bundles/definitions'

export interface MemberChoice {id:string; name:string; level:string; role:string}
export interface RuleChoice {id:string; bundleId:string; key:string; version:number; config:Component}
export async function duplicationAdmin(db:D1Database, actor:Actor, id:string) {
 const opened=await openProject(db,actor,id)
 need(opened.effective,'manage_templates')
 if(['guest','agent','analyst'].includes(opened.effective.role??''))throw forbidden('duplicate_administrator')
 return opened
}
export const selection=(value:unknown):string[]=>{
 if(value===undefined||value===null||value==='')return []
 const values=typeof value==='string'?[value]:value
 if(!Array.isArray(values)||values.length>500||values.some(v=>typeof v!=='string'||!v||v.length>160))throw invalid('duplicate_selection')
 return [...new Set<string>(values)].sort()
}
export const enabled=(value:unknown)=>value===true||value==='true'||value==='on'||value==='1'
/** Only tasks actually readable through this source, never a personal task reached by a raw ID. */
export async function sourceDuplication(db:D1Database,actor:Actor,id:string){
 const {project,effective}=await duplicationAdmin(db,actor,id),tasks:(TaskRow&{approval:boolean})[]=[]
 for(const row of await projectTaskIds(db,id)){
  const opened=await openTask(db,actor,row.task_id).catch(error=>{if(error?.status===404)return null;throw error})
  if(!opened?.access.contexts.has(id))continue
  const {internal_notes:_,...safe}=opened.task
  tasks.push({...safe,internal_notes:'',approval:!!await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',row.task_id)})
 }
 // A hidden parent must not leave a readable descendant detached into the result.
 const retained=new Set(tasks.filter(t=>!t.parent_id).map(t=>t.id))
 for(let changed=true;changed;){changed=false;for(const t of tasks)if(t.parent_id&&retained.has(t.parent_id)&&!retained.has(t.id)){retained.add(t.id);changed=true}}
 const members:MemberChoice[]=[]
 const people=await all<{id:string;display_name:string}>(db,"SELECT o.id,o.display_name FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=? WHERE o.status='active' AND (o.role IN ('owner','admin') OR m.operator_id IS NOT NULL) ORDER BY o.id",project.workspace_id)
 for(const person of people){
  if(person.id===actor.id)continue
  const role=await workspaceRole(db,person.id,project.workspace_id)
  if(!role||role==='agent')continue
  const access=await projectEffective(db,{...actor,id:person.id},project)
  if(access.capabilities.has('read')&&access.level)members.push({id:person.id,name:person.display_name,level:access.level,role})
 }
 const rules=(await all<{bundle_id:string;item_key:string;version:number;config:string}>(db,"SELECT * FROM peg_bundle_items WHERE project_id=? AND kind='rule' ORDER BY bundle_id,item_key",id)).map(r=>({id:r.bundle_id+':'+r.item_key,bundleId:r.bundle_id,key:r.item_key,version:r.version,config:JSON.parse(r.config) as Component}))
 const fields=(await definitions(db,id)).filter(f=>fieldReadable(f,effective))
 return {project,tasks:tasks.filter(t=>retained.has(t.id)),sections:await listSections(db,id),members,rules,fields,names:Object.fromEntries(await displayNames(db,tasks.map(t=>t.owner_id))),placements:await all<{task_id:string;section_id:string|null;position:number}>(db,'SELECT task_id,section_id,position FROM peg_task_projects WHERE project_id=? ORDER BY position,task_id',id)}
}
export type DuplicateSource=Awaited<ReturnType<typeof sourceDuplication>>
