import {all} from '../db'
import {getTemplate,listTemplates,templateVersions} from './definitions'
import {templatePreview} from './instantiation'
import {adoptionPreview,listTemplateApplications,loadApplication} from './adoption'
import {captureTemplatePreview} from './capture'
import {stagedRulePreview,stagedRules} from './staged'
import {listProjects} from '../workspace/projects'
import {openTask} from '../tasks/access'
import {workspaceRole,type Actor} from '../workspace/people'
export async function templatePageData(db:D1Database,actor:Actor,workspace:string,query:URLSearchParams){
 const projects=(await listProjects(db,actor,workspace)).filter(p=>p.level==='admin').map(p=>({value:p.id,label:p.name})),sourceTaskOptions=[]
 const sourceProjectId=query.get('sourceProjectId')
 if(sourceProjectId&&projects.some(p=>p.value===sourceProjectId))for(const row of await all<{id:string;title:string;internal_only:number}>(db,'SELECT t.id,t.title,t.internal_only FROM peg_tasks t JOIN peg_task_projects p ON p.task_id=t.id WHERE p.project_id=? AND t.parent_id IS NULL ORDER BY p.position,t.id',sourceProjectId)){if(row.internal_only)continue;try{await openTask(db,actor,row.id);sourceTaskOptions.push({value:row.id,label:row.title})}catch(error){if((error as {status?:number}).status!==404)throw error}}
 const templates=await listTemplates(db,actor,workspace),templateId=query.get('templateId'),selected=templateId?await getTemplate(db,actor,workspace,templateId,query.has('version')?Number(query.get('version')):undefined):null
 const people=[];for(const p of await all<{id:string;display_name:string}>(db,"SELECT id,display_name FROM oa_operators WHERE status='active' ORDER BY display_name,id")){const role=await workspaceRole(db,p.id,workspace);if(role&&!['guest','agent','analyst'].includes(role))people.push({value:p.id,label:p.display_name})}
 const roles:Record<string,string|null>={};for(const role of selected?.definition.roles??[]){const value=query.get(`role:${role}`);if(value)roles[role]=value==='unassigned'?null:value}
 const input={templateId:templateId??'',version:selected?.version??1,startDate:query.get('startDate')??'',name:query.get('name')??selected?.template.name??'',roles,keepUnassigned:Object.values(roles).some(v=>v===null),...(query.get('targetProjectId')?{targetProjectId:query.get('targetProjectId')!}:{})}
 const preview=query.get('review')==='work'&&selected?await templatePreview(db,actor,workspace,input):null
 const captureInput={sourceProjectId:query.get('sourceProjectId'),sourceTaskId:query.get('sourceTaskId')||undefined,name:query.get('captureName')},capture=query.get('review')==='capture'?await captureTemplatePreview(db,actor,workspace,captureInput):null
 const projectId=query.get('projectId')??query.get('targetProjectId'),applications=projectId?await listTemplateApplications(db,actor,projectId):[]
 const adoptionRoles=Object.fromEntries([...query.entries()].filter(([key])=>key.startsWith('adoptRole:')).map(([key,value])=>[key.slice(10),value==='unassigned'?null:value]).filter(([,value])=>value!==''))
 const applicationId=query.get('applicationId'),application=applicationId?await loadApplication(db,actor,applicationId):null,adoption=application&&query.has('adoptVersion')?await adoptionPreview(db,actor,application.id,{version:Number(query.get('adoptVersion')),...(Object.keys(adoptionRoles).length?{roles:{...JSON.parse(application.input).roles,...adoptionRoles},keepUnassigned:Object.values(adoptionRoles).some(v=>v===null)||JSON.parse(application.input).keepUnassigned}:{}),...(query.has('selection')?{keys:query.getAll('keys[]')}:{})}):null
 const rules=application?await stagedRules(db,actor,application.id):[],rulePreview=query.has('ruleId')?await stagedRulePreview(db,actor,query.get('ruleId')!):null
 return {manage:query.get('manage')==='1'||query.get('review')==='capture'||['sourceProjectId','applicationId','projectId','ruleId'].some(key=>query.has(key)),workspace,projects,sourceTaskOptions,templates,selected,versions:selected?await templateVersions(db,actor,workspace,selected.template.id):[],people,input,preview,capture,captureInput,applications,application,adoption,rules,rulePreview,canAuthor:(await workspaceRole(db,actor.id,workspace))!=='agent'}
}
