// Client fixtures use the same canonical door and MCP eras as production clients.
export const toolNames = {
 task_read:'pegboard.task.read',task_create:'pegboard.task.create',task_update:'pegboard.task.update',task_comment:'pegboard.task.comment',
 project_tasks:'pegboard.project.tasks',project_report:'pegboard.project.report',personal_tasks:'pegboard.personal.tasks',personal_sections:'pegboard.personal.sections',
 personal_section_save:'pegboard.personal.section_save',personal_task_place:'pegboard.personal.task_place',task_approve:'pegboard.task.approve',
}
export function message(input) {
 const params={...input.params},headers={'MCP-Protocol-Version':'2025-11-25'}
 if(input.method==='tools/call') {
  params.name=toolNames[params.name]??params.name
  const {intent,...args}=params.arguments??{}
  params.arguments={...args,...(intent?{idempotency_key:intent}:{})}
 }
 return {body:{...input,params},headers}
}
export function toolResponse(response) {
 const result=response.body.result
 if(!result)return {...response,body:response.body.error?.data??response.body}
 const body=result.structuredContent??JSON.parse(result.content?.[0]?.text??'null')
 const error=result._meta?.['com.runeditrun/error']
 return {status:result.isError ? error?.status??(error?.code==='insufficient_scope'?403:400) : 200,body}
}
export const localPolicy = {document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'owner-approved-work',class:'*',do:'autonomous'}],spend:{none:true}}}
