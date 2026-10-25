import { first } from '../db'

export type RecoveryType = 'project' | 'task' | 'proof_version'

/** Ordinary read doors must apply this before returning retained content. */
export async function isRecoveryHidden(db:D1Database,type:RecoveryType,id:string):Promise<boolean> {
  if(type==='task')return !!await first(db,`WITH RECURSIVE ancestry(id,parent_id) AS (
    SELECT id,parent_id FROM peg_tasks WHERE id=? UNION SELECT t.id,t.parent_id FROM peg_tasks t JOIN ancestry a ON t.id=a.parent_id
  ) SELECT 1 FROM peg_recovery r JOIN ancestry a ON a.id=r.object_id WHERE r.object_type='task' AND r.restored_at IS NULL LIMIT 1`,id)
  if(await first(db,'SELECT 1 FROM peg_recovery WHERE object_type=? AND object_id=? AND restored_at IS NULL',type,id))return true
  if(type==='proof_version'){
    const proof=await first<{task_id:string}>(db,'SELECT p.task_id FROM peg_proof_versions v JOIN peg_proofs p ON p.id=v.proof_id WHERE v.id=?',id)
    return proof?isRecoveryHidden(db,'task',proof.task_id):false
  }
  return false
}
