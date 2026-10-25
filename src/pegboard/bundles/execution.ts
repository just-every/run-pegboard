import type {FieldRow} from '../model'
import {all,bound,conflict,first,invalid,newId,now} from '../db'
import {guarded,revision} from '../decisions/revision'
import {openProject,need,fieldReadable} from '../workspace/projects'
import {prepareTask} from '../tasks/tasks'
import {decisionPreview} from '../decisions/tasks'
import type {Actor} from '../workspace/people'
import {bundleHistory} from './adoption'
import type {Component,Item} from './definitions'
export async function bundleConfiguration(db:D1Database,actor:Actor,projectId:string){
 const {effective}=await openProject(db,actor,projectId)
 const items=(await all<Item&{enabled:number;name:string}>(db,'SELECT i.*,a.enabled,b.name FROM peg_bundle_items i JOIN peg_bundle_adoptions a ON a.bundle_id=i.bundle_id AND a.project_id=i.project_id JOIN peg_bundles b ON b.id=i.bundle_id WHERE i.project_id=?',projectId)).map(i=>({...i,config:JSON.parse(i.config) as Component}))
 const visible=[]
 for(const item of items){if(item.kind==='rule'&&!effective.capabilities.has('manage_rules'))continue;if(['template','stages'].includes(item.kind)&&!effective.capabilities.has('edit'))continue;if(item.kind==='field'){const field=await first<FieldRow>(db,'SELECT * FROM peg_field_definitions WHERE id=?',item.config.fieldId!);if(!field||!fieldReadable(field,effective))continue}visible.push(item)}
 return visible
}
export async function bundleSavedView(db:D1Database,actor:Actor,projectId:string,key:string){
 const item=(await bundleConfiguration(db,actor,projectId)).find(i=>i.bundle_id+':'+i.item_key===key&&i.kind==='view');if(!item)throw invalid('saved_view');return {name:item.config.name,status:item.config.status!}
}
export async function instantiateBundle(db:D1Database,actor:Actor,id:string,projectId:string,input:Record<string,any>){
 const rev=await revision(db),{effective}=await openProject(db,actor,projectId);need(effective,'edit')
 const item=(await bundleConfiguration(db,actor,projectId)).find(i=>i.bundle_id===id&&i.item_key===input.key)
 if(!item?.enabled||!['template','stages'].includes(item.kind))throw conflict('bundle_not_active')
 let runId=newId('bundlerun'),config=item.config,step=0,ownerId=input.ownerId||actor.id,run=null
 if(input.runId){
  run=await first<{id:string;config:string;owner_id:string;created_by:string}>(db,'SELECT * FROM peg_bundle_runs WHERE id=? AND bundle_id=? AND project_id=? AND item_key=?',String(input.runId),id,projectId,item.item_key)
  if(!run||item.kind!=='stages')throw invalid('stage_run')
  if(run.config!==JSON.stringify(config))throw conflict('stage_definition_changed')
  runId=run.id;ownerId=run.owner_id
  const tasks=await all<{step:number;task_id:string}>(db,'SELECT * FROM peg_bundle_run_tasks WHERE run_id=? ORDER BY step',runId)
  for(const task of tasks)if((await decisionPreview(db,actor,task.task_id)).state!=='approved')throw conflict('previous_stage_pending')
  step=tasks.length
 }
 const title=item.kind==='template'?config.title:config.titles?.[step]
 if(!title)throw conflict('all_stages_started')
 const prepared=await prepareTask(db,actor,{projectId,title,ownerId,kind:item.kind==='stages'?'approval':config.taskKind??'task'}),statements=[...prepared.statements]
 if(!run)statements.push(bound(db,'INSERT INTO peg_bundle_runs VALUES(?,?,?,?,?,?,?,?)',[runId,id,projectId,item.item_key,JSON.stringify(config),ownerId,actor.id,now()]))
 statements.push(bound(db,'INSERT INTO peg_bundle_run_tasks VALUES(?,?,?)',[runId,step,prepared.id]),bundleHistory(db,id,projectId,actor.id,'work.started',{key:item.item_key,runId,step,taskId:prepared.id}))
 await guarded(db,rev,statements);return {runId,taskId:prepared.id,step}
}
