import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {activateTemplateRule,createTemplateRule,deactivateTemplateRule,previewTemplateRule,templateRuleView,updateTemplateRule} from '../templates/rules'
import {processTemplateRuleRuns} from '../templates/rule-execution'
import {loadTemplateRule,ruleAdministrator} from '../templates/rule-definition'
export function templateRuleRoutes(app:Hono<{Bindings:Bindings}>){
 const next=(_:unknown,{input,params}:{input:Record<string,any>;params:Record<string,string>})=>`/app/projects/${input.projectId??params.id}/template-rules`
 app.get('/projects/:id/template-rules',door(({db,actor,params})=>templateRuleView(db,actor,params.id)))
 app.post('/projects/:id/template-rules',door(({db,actor,params,input})=>createTemplateRule(db,actor,params.id,input),{next}))
 app.post('/projects/:id/template-rules/process',door(async({db,actor,params})=>{await ruleAdministrator(db,actor,params.id);return processTemplateRuleRuns(db,params.id)},{next}))
 app.post('/template-rules/:id',door(({db,actor,params,input})=>updateTemplateRule(db,actor,params.id,input),{next}))
 app.post('/template-rules/:id/preview',door(({db,actor,params,input})=>previewTemplateRule(db,actor,params.id,input)))
 app.post('/template-rules/:id/activate',door(async({db,actor,params,input})=>{const rule=await loadTemplateRule(db,actor,params.id),activated=await activateTemplateRule(db,actor,params.id,input);return {...activated,processing:await processTemplateRuleRuns(db,rule.project_id)}},{next}))
 app.post('/template-rules/:id/deactivate',door(({db,actor,params})=>deactivateTemplateRule(db,actor,params.id),{next}))
}
