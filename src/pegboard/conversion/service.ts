import {invalid} from '../db'
import type {Actor} from '../workspace/people'
import {previewProjectConversion,applyProjectConversion,type ProjectConversionInput} from './projects'
import {previewHierarchyConversion,applyHierarchyConversion,type HierarchyInput} from './hierarchy'

export function conversionInput(input:Record<string,any>){
 const {kind,sourceId}=input
 if(!['task_to_project','project_to_task','promote','demote'].includes(kind)||typeof sourceId!=='string'||!sourceId)throw invalid('conversion_selection')
 const normalized:Record<string,any>={kind,sourceId}
 for(const key of ['targetProjectId','parentId','name','visibility','token'])if(input[key]!==undefined&&input[key]!=='')normalized[key]=input[key]
 for(const key of ['taskIds','retainIds'])if(input[key]!==undefined)normalized[key]=input[key]
 return normalized as ProjectConversionInput|HierarchyInput
}
export function previewConversion(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>){
 const value=conversionInput(input)
 return value.kind==='task_to_project'||value.kind==='project_to_task'?previewProjectConversion(db,actor,workspace,value):previewHierarchyConversion(db,actor,workspace,value)
}
export function applyConversion(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>){
 const value=conversionInput(input)
 return value.kind==='task_to_project'||value.kind==='project_to_task'?applyProjectConversion(db,actor,workspace,value):applyHierarchyConversion(db,actor,workspace,value)
}
