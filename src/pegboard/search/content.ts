import {all,invalid,notFound,PegError} from '../db'
import {viewTask} from '../tasks/view'
import {listProjects} from '../workspace/projects'
import {briefView} from '../revisions/briefs'
import {workspaceRole,type Actor} from '../workspace/people'

export interface SearchInput {q?:unknown;kind?:unknown;status?:unknown;projectId?:unknown;priority?:unknown;ownerId?:unknown;after?:unknown}
export function searchInput(input:SearchInput) {
 const text=(value:unknown,max:number)=>{if(value!==undefined&&typeof value!=='string')throw invalid('search_query');const s=String(value??'').trim();if(s.length>max)throw invalid('search_query');return s}
 const out={q:text(input.q,200),kind:text(input.kind,20),status:text(input.status,20),projectId:text(input.projectId,100),priority:text(input.priority,20),ownerId:text(input.ownerId,100)}
 if(out.kind&&!['task','approval','project','brief'].includes(out.kind)||out.status&&!['todo','doing','done'].includes(out.status)||out.priority&&!['low','normal','high','urgent'].includes(out.priority))throw invalid('search_filter')
 return out
}
export interface SearchResult {id:string;type:'task'|'project'|'brief';title:string;href:string;matches:string[];status?:string;priority?:string;editable?:boolean}
/** Candidate text is never a disclosure boundary: match again against the ordinary, currently authorized view. */
export async function contentSearch(db:D1Database,actor:Actor,workspace:string,input:SearchInput) {
 if(!await workspaceRole(db,actor.id,workspace))throw notFound()
 const filters=searchInput(input),q=filters.q.toLocaleLowerCase(),matches=(s:string)=>s.toLocaleLowerCase().includes(q),results:SearchResult[]=[]
 if(!filters.kind||filters.kind==='task'||filters.kind==='approval'){
  const candidates=await all<{id:string}>(db,`SELECT t.id FROM peg_tasks t WHERE t.workspace_id=? AND (
   instr(lower(t.title||char(10)||t.description),lower(?))>0 OR EXISTS(SELECT 1 FROM peg_comments c WHERE c.task_id=t.id AND instr(lower(c.body),lower(?))>0)
   OR EXISTS(SELECT 1 FROM peg_attachments a WHERE a.task_id=t.id AND instr(lower(a.name),lower(?))>0)
   OR EXISTS(SELECT 1 FROM peg_task_refs r WHERE r.task_id=t.id AND instr(lower(r.ref),lower(?))>0)) ORDER BY t.id`,workspace,filters.q,filters.q,filters.q,filters.q)
  for(const candidate of candidates)try{
   const task=await viewTask(db,actor,candidate.id)
   if(filters.kind==='approval'&&task.kind!=='approval'||filters.status&&task.status!==filters.status||filters.priority&&task.priority!==filters.priority||filters.ownerId&&task.owner.id!==filters.ownerId||filters.projectId&&!task.projects.some(p=>p.id===filters.projectId))continue
   const sources=[...(!q||matches(task.title)||matches(task.description)||matches(task.ref??'')||task.aliases.some(a=>matches(a))?['Task']:[]),...(task.comments.some(c=>matches(c.body))?['Comment']:[]),...(task.attachments.some(a=>matches(a.name))?['Attachment']:[])]
   if(sources.length)results.push({id:task.id,type:'task',title:task.title,href:`/app/tasks/${task.id}`,matches:sources,status:task.status,priority:task.priority,editable:task.capabilities.includes('edit')})
  }catch(error){if(!(error instanceof PegError&&[403,404].includes(error.status)))throw error}
 }
 if((!filters.kind||filters.kind==='project'||filters.kind==='brief')&&!filters.status&&!filters.priority&&!filters.ownerId)for(const p of await listProjects(db,actor,workspace)){
  if(filters.projectId&&filters.projectId!==p.id)continue
  if(filters.kind!=='brief'&&(matches(p.name)||matches(p.description)))results.push({id:p.id,type:'project',title:p.name,href:`/app/projects/${p.id}`,matches:['Project']})
  if(filters.kind!=='project'){
   const brief=await briefView(db,actor,p.id)
   if(brief.text&&matches(brief.text))results.push({id:p.id,type:'brief',title:p.name+' · Brief',href:`/app/projects/${p.id}/brief`,matches:['Brief']})
  }
 }
 results.sort((a,b)=>(a.type+':'+a.id).localeCompare(b.type+':'+b.id))
 const after=String(input.after??'');if(after.length>150)throw invalid('search_query')
 const page=results.filter(r=>!after||(r.type+':'+r.id)>after).slice(0,50)
 return {filters,results:page,count:results.length,suggestions:results.slice(0,8).map(r=>({id:r.id,type:r.type,title:r.title,href:r.href})),next:page.length===50?`${page.at(-1)!.type}:${page.at(-1)!.id}`:null}
}
