import { all, first } from '../db'
import type { TaskRow } from '../model'
import { isRecoveryHidden, type RecoveryType } from './visibility'

/** Missing or removed relationships are named by kind without disclosing another scope. */
export async function recoveryDependencies(db:D1Database,type:RecoveryType,id:string,task:TaskRow|null) {
  const conflicts=new Set<string>()
  if(type==='project'){
    if(await first(db,'SELECT 1 FROM peg_projects p LEFT JOIN peg_teams t ON t.id=p.team_id WHERE p.id=? AND p.team_id IS NOT NULL AND t.id IS NULL',id))conflicts.add('missing_team')
    return [...conflicts]
  }
  if(!task)return ['missing_task']
  if(task.parent_id){
    if(!await first(db,'SELECT 1 FROM peg_tasks WHERE id=?',task.parent_id))conflicts.add('missing_parent')
    else if(await isRecoveryHidden(db,'task',task.parent_id))conflicts.add('parent_in_trash')
  }
  if((type==='proof_version'||type==='attachment')&&await isRecoveryHidden(db,'task',task.id))conflicts.add('task_in_trash')
  const broken=await all<{kind:string}>(db,`WITH RECURSIVE ancestry(id,parent_id) AS (
    SELECT id,parent_id FROM peg_tasks WHERE id=? UNION SELECT t.id,t.parent_id FROM peg_tasks t JOIN ancestry a ON t.id=a.parent_id
  ) SELECT CASE WHEN p.id IS NULL THEN 'missing_project' ELSE 'missing_section' END kind
    FROM peg_task_projects h JOIN ancestry a ON a.id=h.task_id
    LEFT JOIN peg_projects p ON p.id=h.project_id LEFT JOIN peg_sections s ON s.id=h.section_id AND s.project_id=h.project_id
    WHERE p.id IS NULL OR (h.section_id IS NOT NULL AND s.id IS NULL)`,task.id)
  for(const row of broken)conflicts.add(row.kind)
  const links=await all<{id:string|null}>(db,`SELECT t.id FROM peg_dependencies d LEFT JOIN peg_tasks t
    ON t.id=CASE WHEN d.predecessor_id=? THEN d.successor_id ELSE d.predecessor_id END
    WHERE d.predecessor_id=? OR d.successor_id=?`,task.id,task.id,task.id)
  for(const link of links){
    if(!link.id)conflicts.add('missing_dependency')
    else if(await isRecoveryHidden(db,'task',link.id))conflicts.add('dependency_in_trash')
  }
  return [...conflicts].sort()
}
