import {recoveryChoices} from '../recovery/choices'
import {board} from '../tasks/board'
import {previewConversion} from './service'
import type {Actor} from '../workspace/people'

export async function conversionPageData(db:D1Database,actor:Actor,workspace:string,query:URLSearchParams){
 const input:Record<string,any>=Object.fromEntries(query),choices=await recoveryChoices(db,actor,workspace)
 const tasks=choices.filter(c=>c.value.startsWith('task.')).map(c=>({value:c.value.slice(5),label:c.label.slice(7)})),projects=choices.filter(c=>c.value.startsWith('project.')).map(c=>({value:c.value.slice(8),label:c.label.slice(10)}))
 const constituents=input.kind==='project_to_task'&&input.sourceId?(await board(db,actor,input.sourceId)).columns.flatMap(column=>column.tasks.map(task=>({value:task.id,label:task.title}))):[]
 if(constituents.length&&[...query.keys()].some(key=>key.startsWith('map:'))){input.taskIds=constituents.filter(t=>query.get(`map:${t.value}`)==='include').map(t=>t.value);input.retainIds=constituents.filter(t=>query.get(`map:${t.value}`)==='retain').map(t=>t.value)}
 return {input,tasks,projects,constituents,preview:input.preview?await previewConversion(db,actor,workspace,input):null}
}
