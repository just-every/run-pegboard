import {invalid} from '../db'
export type WorkAction={kind:'complete'|'comment'|'collaborator'|'project'|'subtask'|'tag';value?:string}
export function workActions(value:unknown):WorkAction[]{
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>6)throw invalid('rule_actions')
 const kinds=new Set<string>()
 return value.map(action=>{
  if(!action||typeof action!=='object'||!['complete','comment','collaborator','project','subtask','tag'].includes(action.kind)||kinds.has(action.kind))throw invalid('rule_action')
  kinds.add(action.kind)
  if(action.kind==='complete')return {kind:'complete'}
  const max=action.kind==='comment'?10000:action.kind==='subtask'?300:100
  if(typeof action.value!=='string'||!action.value.trim()||action.value.length>max)throw invalid('rule_action_value')
  return {kind:action.kind,value:action.value.trim()}
 })
}
