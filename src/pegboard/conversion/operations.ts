import {openTask} from '../tasks/access'
import {all,bound,conflict,first,notFound,now,type Param} from '../db'
import {auditStatement} from '../authorization/audit'
import type {TaskProjectRow} from '../model'
import type {Actor} from '../workspace/people'
import {objectAuthority,conversionPerson} from './context'
import {reconcileConversion} from './reconciliation'

export type ConversionEffect={kind:'task_structure';taskId:string;before:{parentId:string|null;kind:string};after:{parentId:string|null;kind:string}}|{kind:'placement';taskId:string;projectId:string;before:TaskProjectRow|null;after:TaskProjectRow|null}
export interface ConversionLink {type:'task'|'project';id:string;relation:string}
export interface ConversionRepair {kind:string;sourceId:string;projectId?:string;title?:string}
export interface ConversionRecord {id:string;kind:string;sourceType:'task'|'project';sourceId:string;targetType:'task'|'project';targetId:string;token:string;options:Record<string,any>;reconciliation:Record<string,unknown>;effects:ConversionEffect[];links?:ConversionLink[];repairs?:ConversionRepair[]}
export interface OperationRow {id:string;workspace_id:string;actor_id:string;kind:string;source_type:string;source_id:string;target_type:string;target_id:string;review_token:string;options:string;reconciliation:string;created_at:number;undone_at:number|null;undone_by:string|null}
export function conversionStatements(db:D1Database,actor:Actor,workspace:string,record:ConversionRecord){
 const at=now(),links:ConversionLink[]=[{type:record.sourceType,id:record.sourceId,relation:'source'},{type:record.targetType,id:record.targetId,relation:'target'},...record.links??[]]
 const unique=[...new Map(links.map(link=>[JSON.stringify(link),link])).values()]
 return [bound(db,'INSERT INTO peg_conversions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL)',[record.id,workspace,actor.id,record.kind,record.sourceType,record.sourceId,record.targetType,record.targetId,record.token,JSON.stringify(record.options),JSON.stringify(record.reconciliation),at] as Param[]),
 ...record.effects.map((effect,index)=>bound(db,'INSERT INTO peg_conversion_effects VALUES(?,?,?,?,?,?,?,NULL)',[record.id,index,effect.kind,effect.taskId,effect.kind==='placement'?effect.projectId:null,JSON.stringify(effect.before),JSON.stringify(effect.after)])),
 ...unique.map(link=>bound(db,'INSERT INTO peg_conversion_links VALUES(?,?,?,?)',[record.id,link.type,link.id,link.relation])),
 ...(record.repairs??[]).map(repair=>bound(db,'INSERT INTO peg_conversion_repairs VALUES(?,?,?,?,1)',[record.id,repair.kind,repair.sourceId,repair.projectId??null])),
 auditStatement(db,{workspaceId:workspace,actorId:actor.id,action:'work.converted',targetType:record.targetType,targetId:record.targetId,detail:{conversionId:record.id,kind:record.kind}})]
}
export async function conversionAuthority(db:D1Database,actor:Actor,row:OperationRow,write=false){
 await conversionPerson(db,actor,row.workspace_id)
 const links=await all<{object_type:string;object_id:string;relation:string}>(db,'SELECT * FROM peg_conversion_links WHERE conversion_id=? ORDER BY object_type,object_id',row.id)
 for(const link of links)await objectAuthority(db,actor,row.workspace_id,link.object_type,link.object_id,write, ['promote','demote'].includes(row.kind))
 return links
}
export async function conversionView(db:D1Database,actor:Actor,id:string){
 const row=await first<OperationRow>(db,'SELECT * FROM peg_conversions WHERE id=?',id)
 if(!row)throw notFound()
 const links=await conversionAuthority(db,actor,row)
 const source=await objectAuthority(db,actor,row.workspace_id,row.source_type,row.source_id),target=await objectAuthority(db,actor,row.workspace_id,row.target_type,row.target_id)
 const taskIds=[...new Set(links.filter(l=>l.object_type==='task'&&l.relation==='work').map(l=>l.object_id))]
 const options=JSON.parse(row.options),reconciliation=await reconcileConversion(db,actor,taskIds)
 const repairs=(await all<any>(db,'SELECT * FROM peg_conversion_repairs WHERE conversion_id=? ORDER BY kind,source_id',id)).map(r=>({kind:r.kind,sourceId:r.source_id,projectId:r.project_id,inert:true,title:r.kind,repairPath:r.project_id?`/app/projects/${r.project_id}/settings`:null}))
 return {id:row.id,kind:row.kind,source,target,...(row.target_type==='project'?{projectId:row.target_id}:{taskId:row.target_id}),options,mapping:options.mapping??[],reconciliation,repairs,createdAt:row.created_at,undoneAt:row.undone_at,actorId:row.actor_id,links}
}
export type ConversionView=Awaited<ReturnType<typeof conversionView>>
export async function operationReplay(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>){
 if(typeof input.token!=='string')return null
 const row=await first<OperationRow>(db,'SELECT * FROM peg_conversions WHERE review_token=?',input.token)
 if(!row)return null
 if(row.actor_id!==actor.id||row.workspace_id!==workspace||row.kind!==input.kind||row.source_id!==(row.source_type==='task'?(await openTask(db,actor,input.sourceId)).task.id:input.sourceId))throw conflict('conversion_replay_changed')
 const options=JSON.parse(row.options)
 for(const key of ['targetProjectId','parentId','taskIds','retainIds','visibility','name'])if(input[key]!==undefined&&JSON.stringify(Array.isArray(input[key])?[...input[key]].sort():key==='name'?String(input[key]).trim():input[key])!==JSON.stringify(options[key]))throw conflict('conversion_replay_changed')
 await conversionAuthority(db,actor,row,true)
 return conversionView(db,actor,row.id)
}
export async function listConversionLinks(db:D1Database,actor:Actor,type:string,id:string){
 const rows=await all<{conversion_id:string}>(db,'SELECT DISTINCT conversion_id FROM peg_conversion_links WHERE object_type=? AND object_id=? ORDER BY conversion_id',type,id),result:ConversionView[]=[]
 for(const row of rows){try{result.push(await conversionView(db,actor,row.conversion_id))}catch(error){if(!(error&&typeof error==='object'&&'status' in error&&(error.status===404||error.status===403)))throw error}}
 return result
}
