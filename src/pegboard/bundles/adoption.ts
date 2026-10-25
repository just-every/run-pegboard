import {all,bound,conflict,first,invalid,newId,now} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {openProject,need} from '../workspace/projects'
import type {Actor} from '../workspace/people'
import {bundleView,loadBundle,type Component,type Item} from './definitions'
export const bundleHistory=(db:D1Database,bundle:string,project:string,actor:string,action:string,detail:unknown)=>bound(db,'INSERT INTO peg_bundle_history VALUES(?,?,?,?,?,?,?)',[newId('bundleevent'),bundle,project,actor,action,JSON.stringify(detail),now()])
export const ids=(v:unknown)=>{const a=typeof v==='string'?[v]:v;if(!Array.isArray(a)||!a.length||a.length>50||a.some(id=>typeof id!=='string'||!id))throw invalid('selection');return [...new Set<string>(a)]}
export async function previewBundle(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const rev=await revision(db),view=await bundleView(db,actor,id),projectIds=ids(input.projectIds),projects=[]
 for(const projectId of projectIds){
  const {project,effective}=await openProject(db,actor,projectId);need(effective,'manage_rules');if(project.workspace_id!==view.bundle.workspace_id)throw invalid('workspace')
  const old=await all<Item>(db,'SELECT * FROM peg_bundle_items WHERE bundle_id=? AND project_id=?',id,projectId),rows=[]
  for(const [key,next] of Object.entries(view.current.components)){
   const item=old.find(i=>i.item_key===key),base=item?JSON.parse(item.base):null,current=item?JSON.parse(item.config):null
   let state=item?.base===JSON.stringify(next)?'unchanged':item&&item.base!==item.config?'override':item&&item.kind!==next.kind?'incompatible':'compatible',reason=''
   if(next.kind==='field'){
    const field=await first<{key:string;version:number;type:string}>(db,'SELECT key,version,type FROM peg_field_definitions WHERE id=? AND workspace_id=?',next.fieldId!,project.workspace_id),local=await first<{field_id:string}>(db,'SELECT field_id FROM peg_project_fields WHERE project_id=? AND key=?',projectId,next.fieldKey!)
    if(!field||field.version!==next.fieldVersion||field.type!==next.fieldType||local&&local.field_id!==next.fieldId){state='incompatible';reason='The field definition changed or its key already has another identity.'}
   }
   rows.push({key,kind:next.kind,name:next.name,base,current,next,state,reason})
  }
  for(const item of old.filter(i=>!view.current.components[i.item_key]))rows.push({key:item.item_key,kind:item.kind,name:JSON.parse(item.config).name,base:JSON.parse(item.base),current:JSON.parse(item.config),next:null,state:'retained',reason:'Removed from the new bundle; local configuration and history are retained.'})
  projects.push({id:projectId,name:project.name,rows})
 }
 return {bundle:view.bundle,version:view.current.version,projects,token:await digest([rev,view.current,projects]),rev}
}
export async function adoptBundle(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const preview=await previewBundle(db,actor,id,input);if(input.revision!==preview.token)throw conflict('bundle_preview_changed')
 const keys=ids(input.keys),statements=[]
 for(const project of preview.projects){
  const adoption=await first(db,'SELECT 1 FROM peg_bundle_adoptions WHERE bundle_id=? AND project_id=?',id,project.id)
  if(!adoption)statements.push(bound(db,'INSERT INTO peg_bundle_adoptions VALUES(?,?,1,1,?)',[id,project.id,actor.id]))
  else statements.push(bound(db,'UPDATE peg_bundle_adoptions SET epoch=epoch+1,activated_by=? WHERE bundle_id=? AND project_id=?',[actor.id,id,project.id]))
  for(const key of keys){
   const row=project.rows.find(r=>r.key===key);if(!row)throw invalid('component')
   if(row.state==='override'||row.state==='unchanged'||row.state==='retained')continue
   if(row.state!=='compatible'||!row.next)throw conflict('incompatible_component')
   const config=JSON.stringify(row.next)
   if(row.next.kind==='field')statements.push(bound(db,'INSERT OR IGNORE INTO peg_project_fields(project_id,key,field_id) VALUES(?,?,?)',[project.id,row.next.fieldKey!,row.next.fieldId!]))
   statements.push(bound(db,'INSERT INTO peg_bundle_items VALUES(?,?,?,?,?,?,?) ON CONFLICT(bundle_id,project_id,item_key) DO UPDATE SET kind=excluded.kind,base=excluded.base,config=excluded.config,version=excluded.version',[id,project.id,key,row.next.kind,config,config,preview.version]))
  }
  statements.push(bound(db,"UPDATE peg_bundle_jobs SET status='cancelled',finished_at=? WHERE bundle_id=? AND project_id=? AND status='queued'",[now(),id,project.id]),bundleHistory(db,id,project.id,actor.id,'adopted',{version:preview.version,keys}))
 }
 await guarded(db,preview.rev,statements);return bundleView(db,actor,id)
}
export async function overrideRule(db:D1Database,actor:Actor,id:string,projectId:string,input:Record<string,any>){
 await loadBundle(db,actor,id);const rev=await revision(db),{effective}=await openProject(db,actor,projectId);need(effective,'manage_rules')
 const item=await first<Item>(db,"SELECT * FROM peg_bundle_items WHERE bundle_id=? AND project_id=? AND item_key=? AND kind='rule'",id,projectId,String(input.key));if(!item)throw invalid('rule')
 if(!['low','normal','high','urgent'].includes(input.priority))throw invalid('priority')
 const config:Component={...JSON.parse(item.config),priority:input.priority}
 await guarded(db,rev,[bound(db,'UPDATE peg_bundle_items SET config=? WHERE bundle_id=? AND project_id=? AND item_key=?',[JSON.stringify(config),id,projectId,item.item_key]),bound(db,'UPDATE peg_bundle_adoptions SET epoch=epoch+1 WHERE bundle_id=? AND project_id=?',[id,projectId]),bound(db,"UPDATE peg_bundle_jobs SET status='cancelled',finished_at=? WHERE bundle_id=? AND project_id=? AND status='queued'",[now(),id,projectId]),bundleHistory(db,id,projectId,actor.id,'rule.overridden',{key:item.item_key,priority:input.priority})]);return bundleView(db,actor,id)
}
export async function disableBundle(db:D1Database,actor:Actor,id:string,projectId:string){
 await loadBundle(db,actor,id);const rev=await revision(db),{effective}=await openProject(db,actor,projectId);need(effective,'manage_rules')
 await guarded(db,rev,[bound(db,'UPDATE peg_bundle_adoptions SET enabled=0,epoch=epoch+1 WHERE bundle_id=? AND project_id=?',[id,projectId]),bound(db,"UPDATE peg_bundle_jobs SET status='cancelled',finished_at=? WHERE bundle_id=? AND project_id=? AND status='queued'",[now(),id,projectId]),bundleHistory(db,id,projectId,actor.id,'disabled',{})]);return {disabled:true}
}
