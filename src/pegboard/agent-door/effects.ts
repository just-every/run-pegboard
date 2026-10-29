import type {ToolContext} from '../../modules/agent-door/index.ts'
import {all} from '../db.ts'
import {openTask} from '../tasks/access.ts'
import {openProject} from '../workspace/projects.ts'
import {access} from './access.ts'

export async function recipients(name: string, args: Record<string,unknown>, ctx: ToolContext, id?: string) {
 if(!id || name.startsWith('personal_'))return []
 const {actor}=await access(ctx),emails=[]
 for(const guest of await all<{id:string;email:string;display_name:string}>(ctx.db,"SELECT o.id,o.email,o.display_name FROM oa_operators o JOIN peg_workspace_members m ON m.operator_id=o.id WHERE o.status='active' AND m.workspace_id='ws_main' AND m.role='guest' ORDER BY o.id")) {
  const recipient={...actor,id:guest.id,email:guest.email,displayName:guest.display_name,baseRole:'member' as const,apiScope:undefined}
  const visible=args.taskId?await openTask(ctx.db,recipient,id).catch(()=>null):await openProject(ctx.db,recipient,id).catch(()=>null)
  if(visible)emails.push(guest.email)
 }
 return emails
}
export function proposedItems(name: string, args: Record<string,unknown>) {
 const labels:Record<string,string>={title:'Title',description:'Description',kind:'Work type',estimateHours:'Estimated hours',status:'Status',priority:'Priority',body:'Comment',name:'Section name',position:'Position',today:'Show in Today',sectionId:'Section'}
 const values=name==='task_update'?args.patch as Record<string,unknown>:args
 return Object.entries(values).filter(([key])=>labels[key]).map(([key,value])=>`${labels[key]}: ${typeof value==='boolean'?value?'Yes':'No':String(value)}`)
}
