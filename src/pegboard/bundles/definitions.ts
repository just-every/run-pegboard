import {all,bound,first,forbidden,invalid,newId,notFound,now} from '../db'
import {guarded,revision} from '../decisions/revision'
import {workspaceRole,type Actor} from '../workspace/people'
import {catalogue} from '../fields/definitions'
export interface Component {kind:'field'|'view'|'rule'|'template'|'stages';name:string;fieldId?:string;fieldKey?:string;fieldVersion?:number;fieldType?:string;status?:string;priority?:string;title?:string;taskKind?:string;titles?:string[]}
export interface Bundle {id:string;workspace_id:string;name:string;created_by:string;created_at:number}
export interface Item {bundle_id:string;project_id:string;item_key:string;kind:string;base:string;config:string;version:number}
export const text=(v:unknown,key:string,max=160)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw invalid(key);return v.trim()}
export async function administrator(db:D1Database,actor:Actor,workspace:string){if(!['owner','admin'].includes(await workspaceRole(db,actor.id,workspace)??''))throw forbidden('workspace_administrator')}
export async function loadBundle(db:D1Database,actor:Actor,id:string){const b=await first<Bundle>(db,'SELECT * FROM peg_bundles WHERE id=?',id);if(!b)throw notFound();await administrator(db,actor,b.workspace_id);return b}
export async function listBundles(db:D1Database,actor:Actor,workspace:string){await administrator(db,actor,workspace);return all<Bundle>(db,'SELECT * FROM peg_bundles WHERE workspace_id=? ORDER BY name',workspace)}
export async function bundleView(db:D1Database,actor:Actor,id:string){
 const bundle=await loadBundle(db,actor,id),versions=(await all<{version:number;components:string;created_by:string;created_at:number}>(db,'SELECT * FROM peg_bundle_versions WHERE bundle_id=? ORDER BY version DESC',id)).map(v=>({...v,components:JSON.parse(v.components) as Record<string,Component>}))
 const adoptions=await all<{project_id:string;name:string;enabled:number;epoch:number}>(db,'SELECT a.*,p.name FROM peg_bundle_adoptions a JOIN peg_projects p ON p.id=a.project_id WHERE bundle_id=?',id)
 const items=await all<Item>(db,'SELECT * FROM peg_bundle_items WHERE bundle_id=?',id),history=await all<{id:string;project_id:string;actor_id:string;action:string;detail:string;at:number}>(db,'SELECT * FROM peg_bundle_history WHERE bundle_id=? ORDER BY at DESC,id',id),jobs=await all<{id:string;project_id:string;task_id:string;status:string}>(db,'SELECT * FROM peg_bundle_jobs WHERE bundle_id=? ORDER BY created_at DESC',id)
 const runs=await all<{id:string;project_id:string;item_key:string;config:string;owner_id:string}>(db,'SELECT * FROM peg_bundle_runs WHERE bundle_id=? ORDER BY created_at',id),runTasks=await all<{run_id:string;step:number;task_id:string;title:string;status:string}>(db,'SELECT r.run_id,r.step,r.task_id,t.title,t.status FROM peg_bundle_run_tasks r JOIN peg_bundle_runs b ON b.id=r.run_id JOIN peg_tasks t ON t.id=r.task_id WHERE b.bundle_id=? ORDER BY r.step',id)
 return {runs:runs.map(r=>({...r,config:JSON.parse(r.config) as Component,tasks:runTasks.filter(t=>t.run_id===r.id)})),bundle,versions,current:versions[0],adoptions,items:items.map(i=>({...i,base:JSON.parse(i.base) as Component,config:JSON.parse(i.config) as Component,override:i.base!==i.config})),history,jobs}
}
export async function createBundle(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>){
 await administrator(db,actor,workspace);const id=newId('bundle'),at=now(),rev=await revision(db)
 await guarded(db,rev,[bound(db,'INSERT INTO peg_bundles VALUES(?,?,?,?,?)',[id,workspace,text(input.name,'name'),actor.id,at]),bound(db,'INSERT INTO peg_bundle_versions VALUES(?,1,?,?,?)',[id,'{}',actor.id,at])]);return {id}
}
export async function versionBundle(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const rev=await revision(db),view=await bundleView(db,actor,id)
 if(Number(input.version)!==view.current.version)throw invalid('bundle_version_changed')
 const key=text(input.key,'component_key',60);if(!/^[a-z][a-z0-9_-]*$/.test(key))throw invalid('component_key')
 const components={...view.current.components}
 if(input.remove===true||input.remove==='yes')delete components[key]
 else{
  const kind=input.kind,name=text(input.name,'component_name'),component:Component={kind,name}
  if(kind==='field'){
   const field=(await catalogue(db,actor,view.bundle.workspace_id)).find(f=>f.id===input.fieldId);if(!field)throw invalid('field')
   Object.assign(component,{fieldId:field.id,fieldKey:field.key,fieldVersion:field.version,fieldType:field.type})
  }else if(kind==='view'){if(!['all','todo','doing','done'].includes(input.status))throw invalid('status');component.status=input.status}
  else if(kind==='rule'){if(!['low','normal','high','urgent'].includes(input.priority))throw invalid('priority');component.priority=input.priority}
  else if(kind==='template'){component.title=text(input.title,'task_title');if(!['task','milestone'].includes(input.taskKind??'task'))throw invalid('task_kind');component.taskKind=input.taskKind??'task'}
  else if(kind==='stages'){const titles=Array.isArray(input.titles)?input.titles:String(input.titles??'').split('\n');if(!titles.length||titles.length>10)throw invalid('stages');component.titles=titles.map((t:unknown)=>text(t,'stage_title'))}
  else throw invalid('component_kind')
  components[key]=component
 }
 if(Object.keys(components).length>50)throw invalid('bundle_size')
 await guarded(db,rev,[bound(db,'INSERT INTO peg_bundle_versions VALUES(?,?,?,?,?)',[id,view.current.version+1,JSON.stringify(components),actor.id,now()])]);return bundleView(db,actor,id)
}
