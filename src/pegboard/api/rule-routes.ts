import {submitRuleRequest} from '../rules/requests'
import {suggestionView,suggestRule,reviewSuggestion} from '../rules/suggestions'
import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {activateRule,deactivateRule,loadRule,rulePreview,rulesView,saveRule} from '../rules/definitions'
import {processLocalRules} from '../rules/execution'
import {ruleAdministrator} from '../templates/rule-definition'
export function ruleRoutes(app:Hono<{Bindings:Bindings}>){
 app.post('/projects/:id/requests',door(({db,actor,params,input})=>submitRuleRequest(db,actor,params.id,input),{next:result=>`/app/tasks/${result.id}`}))
 app.get('/projects/:id/rule-suggestions',door(({db,actor,params})=>suggestionView(db,actor,params.id)))
 app.post('/projects/:id/rule-suggestions',door(({db,actor,params,input})=>suggestRule(db,actor,params.id,input)))
 app.post('/rule-suggestions/:id/review',door(({db,actor,params})=>reviewSuggestion(db,actor,params.id)))
 app.get('/projects/:id/rules',door(({db,actor,params})=>rulesView(db,actor,params.id)))
 app.post('/projects/:id/rules',door(({db,actor,params,input})=>saveRule(db,actor,params.id,input)))
 app.post('/projects/:id/rules/process',door(async({db,actor,params})=>{await ruleAdministrator(db,actor,params.id);return processLocalRules(db,params.id)}))
 app.post('/rules/:id',door(async({db,actor,params,input})=>{const rule=await loadRule(db,actor,params.id);return saveRule(db,actor,rule.project_id,input,rule.id)}))
 app.post('/rules/:id/preview',door(({db,actor,params,input})=>rulePreview(db,actor,params.id,input)))
 app.post('/rules/:id/deactivate',door(({db,actor,params})=>deactivateRule(db,actor,params.id)))
 app.post('/rules/:id/activate',door(({db,actor,params,input})=>activateRule(db,actor,params.id,input)))
}
