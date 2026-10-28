import { first, notFound } from '../db'
import type { openTask } from '../tasks/access'
import type { Actor } from '../workspace/people'
import { isRecoveryHidden } from '../recovery/visibility'

// Managing a task does not grant custody of a file held in another project.
export async function proofContext(db:D1Database,actor:Actor,opened:Awaited<ReturnType<typeof openTask>>,version:string){
 const file=await first<{id:string;project_id:string|null}>(db,'SELECT a.id,a.project_id FROM peg_attachments a JOIN peg_proof_versions v ON v.attachment_id=a.id WHERE v.id=? AND a.task_id=?',version,opened.task.id)
 if(!file||await isRecoveryHidden(db,'attachment',file.id)||await isRecoveryHidden(db,'proof_version',version))throw notFound()
 if(file.project_id===null?opened.task.owner_id!==actor.id:!opened.access.contexts.has(file.project_id))throw notFound()
}
