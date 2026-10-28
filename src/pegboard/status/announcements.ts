import { all, batch, bound, first, forbidden, invalid, newId, notFound, now, PegError } from '../db'
import { auditStatement } from '../authorization/audit'
import { teamEffective } from '../authorization/effective'
import { loadTeam } from '../authorization/grants'
import { openProject } from '../workspace/projects'
import { displayNames, workspaceRole, type Actor } from '../workspace/people'
import { assertStatusReuse } from './rights'
interface Announcement {id:string;workspace_id:string;subject_type:string;subject_id:string;parent_id:string|null;author_id:string;body:string;internal_only:number;created_at:number}
async function scope(db:D1Database,actor:Actor,type:string,id:string) {
  if(type==='project') {
    const opened=await openProject(db,actor,id)
    return {workspace:opened.project.workspace_id,comment:opened.effective.capabilities.has('comment'),manage:opened.effective.capabilities.has('manage_settings'),name:opened.project.name}
  }
  if(type!=='team') throw invalid('announcement_scope')
  const team=await loadTeam(db,id)
  if(!team)throw notFound()
  const effective=await teamEffective(db,actor,team)
  if(!effective.capabilities.has('read'))throw notFound()
  return {workspace:team.workspace_id,comment:effective.capabilities.has('comment'),manage:effective.capabilities.has('manage_settings'),name:team.name}
}
export async function announcements(db:D1Database,actor:Actor,type:string,id:string) {
  const access=await scope(db,actor,type,id),guest=await workspaceRole(db,actor.id,access.workspace)==='guest'
  const rows=await all<Announcement>(db,`SELECT * FROM peg_announcements WHERE subject_type=? AND subject_id=?${guest?' AND internal_only=0':''} ORDER BY created_at,id`,type,id),visible:Announcement[]=[]
  for(const row of rows)try {await assertStatusReuse(db,'announcement',row.id);visible.push(row)} catch(error) {if(!(error instanceof PegError&&error.code==='status_rights_custody_review'))throw error}
  const names=await displayNames(db,visible.map(row=>row.author_id))
  return {type,id,...access,rows:visible.map(row=>({...row,authorName:names.get(row.author_id)??'Former member'}))}
}
export async function addAnnouncement(db:D1Database,actor:Actor,type:string,id:string,input:Record<string,any>) {
  const access=await scope(db,actor,type,id),role=await workspaceRole(db,actor.id,access.workspace),guest=role==='guest'
  if(role==='agent'||role==='analyst'||!role)throw forbidden('human_announcement_required')
  if(input.parentId ? !access.comment : !access.manage || guest)throw forbidden('announcement_authority')
  if(typeof input.body!=='string'||!input.body.trim()||input.body.length>4000)throw invalid('announcement_body')
  if(guest&&input.internalOnly===true)throw forbidden('internal_announcement')
  let parent:Announcement|null=null
  if(input.parentId) {
    parent=await first<Announcement>(db,'SELECT * FROM peg_announcements WHERE id=? AND subject_type=? AND subject_id=?',input.parentId,type,id)
    if(!parent||guest&&parent.internal_only)throw notFound()
    await assertStatusReuse(db,'announcement',parent.id)
  }
  if(await first(db,"SELECT 1 FROM peg_status_rights_requests WHERE workspace_id=? AND ((target_type='project' AND ?='project' AND target_id=?) OR (target_type='person' AND target_id=?))",access.workspace,type,id,actor.id))throw new PegError(409,'status_rights_custody_review')
  const announcementId=newId('announcement')
  await batch(db,[bound(db,'INSERT INTO peg_announcements VALUES(?,?,?,?,?,?,?,?,?)',[announcementId,access.workspace,type,id,parent?.id??null,actor.id,input.body.trim(),input.internalOnly===true||parent?.internal_only?1:0,now()]),auditStatement(db,{workspaceId:access.workspace,actorId:actor.id,action:parent?'announcement.replied':'announcement.published',targetType:type,targetId:id,subjectId:announcementId})])
  return {id:announcementId}
}
export async function statusAnnouncements(db:D1Database,actor:Actor,type:string,id:string) {
  const projects=type==='project'?[{project_id:id}]:await all<{project_id:string}>(db,`WITH RECURSIVE family(id) AS (SELECT ? UNION ALL SELECT p.id FROM peg_portfolios p JOIN family f ON p.parent_id=f.id) SELECT DISTINCT project_id FROM peg_portfolio_projects WHERE portfolio_id IN(SELECT id FROM family)`,id)
  const scopes=new Map<string,{type:string;id:string}>()
  for(const {project_id} of projects)try {
    const {project}=await openProject(db,actor,project_id)
    scopes.set('project.'+project.id,{type:'project',id:project.id})
    if(project.team_id)scopes.set('team.'+project.team_id,{type:'team',id:project.team_id})
  }catch(error){if(!(error instanceof PegError&&[403,404].includes(error.status)))throw error}
  const result=[]
  for(const item of scopes.values())try{result.push(await announcements(db,actor,item.type,item.id))}catch(error){if(!(error instanceof PegError&&[403,404].includes(error.status)))throw error}
  return result
}
