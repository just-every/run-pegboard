import { all, bound, conflict, first, forbidden, invalid, newId, notFound, type Param } from '../db'
import { guarded, revision } from '../decisions/revision'
import { taskAccess } from '../authorization/effective'
import { rank, type Level } from '../authorization/levels'
import type { TaskRow } from '../model'
import { prepareTask } from '../tasks/tasks'
import { need, openProject } from '../workspace/projects'
import { displayNames, workspaceRole, workspaceSettings, type Actor } from '../workspace/people'

interface NodeRow { id:string; project_id:string; parent_id:string|null; title:string; kind:'phase'|'note'|'task'; internal_only:number; position:number; version:number; task_id:string|null }
const title = (value:unknown) => { if(typeof value!=='string'||!value.trim()||value.length>300)throw invalid('canvas_title');return value.trim() }
const position = (value:unknown) => { const n=Number(value??0);if(!Number.isSafeInteger(n)||Math.abs(n)>1000000)throw invalid('canvas_position');return n }
const rows = (db:D1Database,project:string) => all<NodeRow>(db,'SELECT * FROM peg_canvas_nodes WHERE project_id=? ORDER BY position,id',project)
const node = async(db:D1Database,project:string,id:string) => {const n=await first<NodeRow>(db,'SELECT * FROM peg_canvas_nodes WHERE id=? AND project_id=?',id,project);if(!n)throw notFound();return n}

async function editable(db:D1Database,actor:Actor,project:string) {
 const context=await openProject(db,actor,project);need(context.effective,'edit')
 if(context.effective.role==='guest'||context.effective.role==='agent')throw forbidden('member_canvas_edit')
 return context
}

/** A tree relationship is placement only; no task dates or approval state are written. */
function parentIn(nodes:NodeRow[],value:unknown,id?:string):string|null {
 const parent=typeof value==='string'&&value?value:null
 if(!parent)return null
 const byId=new Map(nodes.map(n=>[n.id,n]));let cursor:string|null=parent
 const visited=new Set<string>()
 while(cursor){if(cursor===id||visited.has(cursor))throw conflict('canvas_cycle');visited.add(cursor);const n=byId.get(cursor);if(!n)throw invalid('canvas_parent');cursor=n.parent_id}
 return parent
}

export async function canvasView(db:D1Database,actor:Actor,projectId:string) {
 const {project,effective}=await openProject(db,actor,projectId),nodes=await rows(db,projectId)
 const visible=[]
 for(const n of nodes){
  if(n.internal_only&&effective.role==='guest')continue
  let task:TaskRow|null=null
  if(n.task_id){
   task=await first<TaskRow>(db,'SELECT * FROM peg_tasks WHERE id=?',n.task_id)
   if(!task||!(await taskAccess(db,actor,task)).capabilities.has('read'))continue
   if(!await first(db,'SELECT 1 FROM peg_task_projects WHERE task_id=? AND project_id=?',task.id,projectId))continue
  }
  visible.push({row:n,task})
 }
 const ids=new Set(visible.map(n=>n.row.id)),names=await displayNames(db,visible.flatMap(n=>n.task?[n.task.owner_id]:[]))
 const canEdit=effective.capabilities.has('edit')&&!['guest','agent'].includes(effective.role??'')
 const people=canEdit?(await all<{id:string;display_name:string}>(db,`SELECT o.id,o.display_name FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=? WHERE o.status='active' AND (o.role IN ('owner','admin') OR m.role IN ('manager','member')) ORDER BY o.display_name`,project.workspace_id)).map(p=>({value:p.id,label:p.display_name})):[]
 const settings=await workspaceSettings(db,project.workspace_id)
 return {project:{id:project.id,name:project.name},canEdit,canExport:effective.capabilities.has('export')&&rank(effective.level as Level)>=rank(settings.exportMinLevel),people,
  nodes:visible.map(({row:n,task})=>({id:n.id,parentId:n.parent_id&&ids.has(n.parent_id)?n.parent_id:null,title:task?.title??n.title,kind:n.kind,internalOnly:!!n.internal_only,version:n.version,position:n.position,task:task?{id:task.id,title:task.title,status:task.status,owner:{id:task.owner_id,name:names.get(task.owner_id)??'Former member'}}:null}))}
}

export async function addCanvasNode(db:D1Database,actor:Actor,project:string,input:Record<string,any>) {
 const rev=await revision(db);await editable(db,actor,project)
 const nodes=await rows(db,project),parent=parentIn(nodes,input.parentId),kind=input.kind??'note'
 if(!['note','phase'].includes(kind))throw invalid('canvas_kind')
 const id=newId('node')
 await guarded(db,rev,[bound(db,'INSERT INTO peg_canvas_nodes(id,project_id,parent_id,title,kind,internal_only,position) VALUES(?,?,?,?,?,?,?)',[id,project,parent,title(input.title),kind,input.internalOnly?1:0,position(input.position)])])
 return {id}
}

export async function updateCanvasNode(db:D1Database,actor:Actor,project:string,id:string,input:Record<string,any>) {
 const rev=await revision(db);await editable(db,actor,project)
 const n=await node(db,project,id);if(n.version!==Number(input.version))throw conflict('canvas_review_stale')
 const nodes=await rows(db,project),parent=parentIn(nodes,input.parentId===undefined?n.parent_id:input.parentId,id)
 const assignments=['parent_id=?','position=?','version=version+1'],args:Param[]=[parent,input.position===undefined?n.position:position(input.position)]
 if(input.title!==undefined&&n.kind!=='task'){assignments.push('title=?');args.push(title(input.title))}
 await guarded(db,rev,[bound(db,`UPDATE peg_canvas_nodes SET ${assignments.join(',')} WHERE id=? AND version=?`,[...args,id,n.version])])
 return {id}
}

export async function promoteCanvasNode(db:D1Database,actor:Actor,project:string,id:string,input:Record<string,any>) {
 const rev=await revision(db);const context=await editable(db,actor,project)
 const n=await node(db,project,id)
 if(!input.confirm)throw invalid('canvas_exact_review_required')
 if(n.task_id){const view=await canvasView(db,actor,project);if(!view.nodes.some(x=>x.id===id))throw notFound();return {taskId:n.task_id}}
 if(n.kind!=='note'||n.version!==Number(input.version))throw conflict('canvas_review_stale')
 if(!['owner','admin','manager','member'].includes(await workspaceRole(db,String(input.ownerId),context.project.workspace_id)??''))throw invalid('canvas_task_owner')
 const task=await prepareTask(db,actor,{projectId:project,title:n.title,ownerId:String(input.ownerId),internalOnly:!!n.internal_only})
 try{
  await guarded(db,rev,[bound(db,'INSERT INTO peg_canvas_guards SELECT CASE WHEN EXISTS(SELECT 1 FROM peg_canvas_nodes WHERE id=? AND version=? AND task_id IS NULL) THEN 1 ELSE 0 END',[id,n.version]),...task.statements,bound(db,"UPDATE peg_canvas_nodes SET kind='task',title='',task_id=?,version=version+1 WHERE id=?",[task.id,id]),bound(db,'DELETE FROM peg_canvas_guards',[])])
 }catch(error){
  const existing=await node(db,project,id)
  if(existing.task_id){await editable(db,actor,project);return {taskId:existing.task_id}}
  throw error
 }
 return {taskId:task.id}
}
