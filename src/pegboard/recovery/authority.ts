import { all, first, forbidden, invalid, notFound } from '../db'
import { projectEffective, taskAccess } from '../authorization/effective'
import type { ProjectRow, TaskRow } from '../model'
import type { Actor } from '../workspace/people'
import type { RecoveryType } from './visibility'

export async function recoverySubject(db:D1Database,actor:Actor,workspace:string,type:RecoveryType,id:string,write=false) {
  if(type==='project'){
    const project=await first<ProjectRow>(db,'SELECT * FROM peg_projects WHERE id=? AND workspace_id=?',id,workspace)
    if(!project||await first(db,"SELECT 1 FROM peg_data_erased_objects WHERE object_type='project' AND object_id=?",id))throw notFound()
    const access=await projectEffective(db,actor,project)
    if(!access.capabilities.has('read'))throw notFound()
    const canChange=access.capabilities.has('manage_settings')
    if(write&&!canChange)throw forbidden('manage_settings')
    return {label:project.name,canChange,personal:false,task:null,project}
  }
  const version=type==='proof_version'?await first<{task_id:string;attachment_id:string;version:number}>(db,'SELECT p.task_id,v.attachment_id,v.version FROM peg_proof_versions v JOIN peg_proofs p ON p.id=v.proof_id WHERE v.id=?',id):null
  if(type==='proof_version'&&!version)throw notFound()
  const file=version||type==='attachment'?await first<{task_id:string;project_id:string|null;name:string}>(db,'SELECT task_id,project_id,name FROM peg_attachments WHERE id=?',version?.attachment_id??id):null
  if((version||type==='attachment')&&!file)throw notFound()
  if(type==='attachment'&&await first(db,"SELECT 1 FROM peg_data_erased_objects WHERE object_type='attachment' AND object_id=?",id))throw notFound()
  const task=await first<TaskRow>(db,'SELECT * FROM peg_tasks WHERE id=? AND workspace_id=?',version?.task_id??file?.task_id??id,workspace)
  if(!task||await first(db,"SELECT 1 FROM peg_data_erased_objects WHERE object_type='task' AND object_id=?",task.id))throw notFound()
  const access=await taskAccess(db,actor,task,true)
  if(!access.capabilities.has('read'))throw notFound()
  if(file&&(file.project_id===null?task.owner_id!==actor.id:!access.contexts.has(file.project_id)))throw notFound()
  // Proof bytes are recovered through their version so independent decisions stay linked.
  if(type==='attachment'&&await first(db,'SELECT 1 FROM peg_proof_versions WHERE attachment_id=?',id))throw invalid('attachment_has_proof_version')
  let canChange=access.capabilities.has('edit')&&access.role!=='agent'&&access.role!=='guest'
  if(type==='attachment'&&file?.project_id&&!access.contexts.get(file.project_id)?.capabilities.has('edit'))canChange=false
  if(type==='task'&&canChange){
    // Removing a shared root or its descendants affects every home, including hidden homes.
    const rows=await all<TaskRow>(db,`WITH RECURSIVE subtree(id) AS (SELECT id FROM peg_tasks WHERE id=? UNION SELECT t.id FROM peg_tasks t JOIN subtree s ON t.parent_id=s.id) SELECT t.* FROM peg_tasks t JOIN subtree s ON s.id=t.id`,id)
    for(const child of rows){
      const grant=await taskAccess(db,actor,child,true)
      if(!grant.capabilities.has('edit')){canChange=false;break}
      const homes=await all<{project_id:string}>(db,`WITH RECURSIVE ancestry(id,parent_id) AS (SELECT id,parent_id FROM peg_tasks WHERE id=? UNION SELECT t.id,t.parent_id FROM peg_tasks t JOIN ancestry a ON t.id=a.parent_id) SELECT h.project_id FROM peg_task_projects h JOIN ancestry a ON a.id=h.task_id WHERE a.parent_id IS NULL`,child.id)
      if(homes.some(h=>!grant.contexts.get(h.project_id)?.capabilities.has('edit'))){canChange=false;break}
    }
  }
  if(write&&!canChange)throw forbidden('recovery_scope')
  return {label:version?`Version ${version.version} on ${task.title}`:file?`${file.name} on ${task.title}`:task.title,canChange,personal:access.personal,task,project:null}
}
