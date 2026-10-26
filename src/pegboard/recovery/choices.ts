import {all,PegError} from '../db'
import type {Actor} from '../workspace/people'
import {recoverySubject} from './authority'
import {isRecoveryHidden,type RecoveryType} from './visibility'
export async function recoveryChoices(db:D1Database,actor:Actor,workspace:string) {
 const rows=await all<{type:RecoveryType;id:string}>(db,`SELECT 'project' type,id FROM peg_projects WHERE workspace_id=? UNION ALL SELECT 'task',id FROM peg_tasks WHERE workspace_id=? UNION ALL SELECT 'proof_version',v.id FROM peg_proof_versions v JOIN peg_proofs p ON p.id=v.proof_id JOIN peg_tasks t ON t.id=p.task_id WHERE t.workspace_id=? UNION ALL SELECT 'attachment',a.id FROM peg_attachments a JOIN peg_tasks t ON t.id=a.task_id WHERE t.workspace_id=? AND NOT EXISTS(SELECT 1 FROM peg_proof_versions v WHERE v.attachment_id=a.id)`,workspace,workspace,workspace,workspace)
 const choices=[]
 for(const row of rows) {
  if(await isRecoveryHidden(db,row.type,row.id))continue
  try {const subject=await recoverySubject(db,actor,workspace,row.type,row.id);if(subject.canChange)choices.push({value:row.type+'.'+row.id,label:row.type.replaceAll('_',' ')+' · '+subject.label})}
  catch(error){if(!(error instanceof PegError&&[403,404].includes(error.status)))throw error}
 }
 return choices.sort((a,b)=>a.label.localeCompare(b.label))
}
