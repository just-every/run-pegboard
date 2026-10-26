import {all,bound,conflict,first,forbidden,invalid,newId,notFound,now} from '../db'
import {guarded,revision} from '../decisions/revision'
import {workspaceRole,type Actor} from '../workspace/people'
import {isAdministrator} from '../authorization/levels'
import {openProject,need} from '../workspace/projects'
import {gallery} from './gallery'
import {definitionInput} from './validation'
import type {TemplateDefinition,TemplateRecord} from './types'
export async function templateMember(db:D1Database,actor:Actor,workspace:string){const role=await workspaceRole(db,actor.id,workspace);if(!role||['guest','analyst'].includes(role))throw forbidden('internal_template_member');return role}
export async function templateAdmin(db:D1Database,actor:Actor,workspace:string,projectId:string|null){
 const role=await templateMember(db,actor,workspace);if(role==='agent')throw forbidden('human_template_administrator')
 if(projectId){const {project,effective}=await openProject(db,actor,projectId);if(project.workspace_id!==workspace)throw notFound();need(effective,'manage_templates')}
 else if(!isAdministrator(role))throw forbidden('template_administrator')
}
export async function getTemplate(db:D1Database,actor:Actor,workspace:string,id:string,version?:number){
 await templateMember(db,actor,workspace)
 const built=gallery.find(t=>t.id===id)
 if(built){if(version!==undefined&&version!==1)throw notFound();return {template:{id:built.id,workspace_id:workspace,name:built.name,family:built.family,authority_project:null,created_by:'gallery',created_at:0} as TemplateRecord,version:1,headVersion:1,definition:built.definition}}
 const template=await first<TemplateRecord>(db,'SELECT * FROM peg_reusable_templates WHERE id=? AND workspace_id=?',id,workspace);if(!template)throw notFound()
 if(template.authority_project)await openProject(db,actor,template.authority_project)
 const head=(await first<{version:number}>(db,'SELECT MAX(version) version FROM peg_reusable_template_versions WHERE template_id=?',id))?.version;if(!head)throw notFound()
 const row=await first<{version:number;definition:string}>(db,'SELECT version,definition FROM peg_reusable_template_versions WHERE template_id=? AND version=?',id,version??head);if(!row)throw notFound()
 return {template,version:row.version,headVersion:head,definition:JSON.parse(row.definition) as TemplateDefinition}
}
export async function listTemplates(db:D1Database,actor:Actor,workspace:string){
 await templateMember(db,actor,workspace)
 const ids=[...gallery.map(t=>t.id),...(await all<{id:string}>(db,'SELECT id FROM peg_reusable_templates WHERE workspace_id=? ORDER BY created_at,id',workspace)).map(t=>t.id)],result=[]
 for(const id of ids){try{const t=await getTemplate(db,actor,workspace,id);result.push(t)}catch(e){if((e as {status?:number}).status!==404)throw e}}
 return result
}
export async function createTemplate(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>){
 const rev=await revision(db),authority=typeof input.authorityProjectId==='string'&&input.authorityProjectId?input.authorityProjectId:null
 await templateAdmin(db,actor,workspace,authority)
 const definition=definitionInput(input.definition),name=String(input.name??'').trim();if(!name||name.length>120)throw invalid('name')
 const id=newId('reusable'),at=now()
 await guarded(db,rev,[bound(db,'INSERT INTO peg_reusable_templates VALUES(?,?,?,?,?,?,?)',[id,workspace,name,'custom',authority,actor.id,at]),bound(db,'INSERT INTO peg_reusable_template_versions VALUES(?,?,?,?,?)',[id,1,JSON.stringify(definition),actor.id,at])])
 return {id,version:1}
}
export async function versionTemplate(db:D1Database,actor:Actor,workspace:string,id:string,input:Record<string,any>){
 const rev=await revision(db),view=await getTemplate(db,actor,workspace,id);if(view.template.created_by==='gallery')throw invalid('fork_gallery_template')
 await templateAdmin(db,actor,workspace,view.template.authority_project)
 if(Number(input.baseVersion)!==view.headVersion)throw conflict('template_version_changed')
 const definition=definitionInput(input.definition),version=view.headVersion+1
 await guarded(db,rev,[bound(db,'INSERT INTO peg_reusable_template_versions VALUES(?,?,?,?,?)',[id,version,JSON.stringify(definition),actor.id,now()])]);return {id,version}
}
export async function templateVersions(db:D1Database,actor:Actor,workspace:string,id:string){const t=await getTemplate(db,actor,workspace,id);return t.template.created_by==='gallery'?[{version:1,created_by:'gallery',created_at:0}]:all<{version:number;created_by:string;created_at:number}>(db,'SELECT version,created_by,created_at FROM peg_reusable_template_versions WHERE template_id=? ORDER BY version DESC',id)}
