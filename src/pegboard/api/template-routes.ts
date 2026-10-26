import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {createTemplate,getTemplate,listTemplates,templateVersions,versionTemplate} from '../templates/definitions'
import {applyTemplate,templatePreview} from '../templates/instantiation'
import {adoptionPreview,adoptTemplate,listTemplateApplications} from '../templates/adoption'
import {captureTemplate,captureTemplatePreview} from '../templates/capture'
import {activateStagedRule,stagedRulePreview,stagedRules} from '../templates/staged'
export function templateRoutes(app:Hono<{Bindings:Bindings}>){
 app.get('/templates',door(async({db,actor,workspace})=>({templates:await listTemplates(db,actor,workspace)})))
 app.post('/templates',door(({db,actor,workspace,input})=>createTemplate(db,actor,workspace,input),{next:r=>`/app/templates?templateId=${r.id}`}))
 app.post('/templates/preview',door(({db,actor,workspace,input})=>templatePreview(db,actor,workspace,input)))
 // internalRule is intentionally never read from HTTP input.
 app.post('/templates/apply',door(({db,actor,workspace,input})=>applyTemplate(db,actor,workspace,input),{next:r=>`/app/projects/${r.projectId}`}))
 app.post('/templates/capture/preview',door(({db,actor,workspace,input})=>captureTemplatePreview(db,actor,workspace,input)))
 app.post('/templates/capture',door(({db,actor,workspace,input})=>captureTemplate(db,actor,workspace,input),{next:r=>`/app/templates?templateId=${r.id}`}))
 app.get('/templates/:id',door(({db,actor,workspace,params,query})=>getTemplate(db,actor,workspace,params.id,query.has('version')?Number(query.get('version')):undefined)))
 app.get('/templates/:id/versions',door(async({db,actor,workspace,params})=>({versions:await templateVersions(db,actor,workspace,params.id)})))
 app.post('/templates/:id/versions',door(({db,actor,workspace,params,input})=>versionTemplate(db,actor,workspace,params.id,input),{next:(_,{params})=>`/app/templates?templateId=${params.id}`}))
 app.get('/projects/:id/template-applications',door(async({db,actor,params})=>({applications:await listTemplateApplications(db,actor,params.id)})))
 app.post('/template-applications/:id/adoption/preview',door(({db,actor,params,input})=>adoptionPreview(db,actor,params.id,input)))
 app.post('/template-applications/:id/adopt',door(({db,actor,params,input})=>adoptTemplate(db,actor,params.id,input),{next:r=>`/app/projects/${r.projectId}`}))
 app.get('/template-applications/:id/rules',door(async({db,actor,params})=>({rules:await stagedRules(db,actor,params.id)})))
 app.post('/template-staged-rules/:id/preview',door(({db,actor,params})=>stagedRulePreview(db,actor,params.id)))
 app.post('/template-staged-rules/:id/activate',door(({db,actor,params,input})=>activateStagedRule(db,actor,params.id,input),{next:r=>`/app/projects/${r.projectId}`}))
}
