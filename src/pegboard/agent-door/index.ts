import { createAgentDoor, operatorAuthPeople, type Trust } from '../../modules/agent-door/index.ts'
import { createBusinessSettings } from '../../modules/business-settings/index.ts'
import { operatorAuth, authConfig, runtimeBindings, type Bindings } from '../../auth.server.ts'
import { localCredentials, currentKey, scopes } from './access.ts'
import { workTools } from './tools.ts'

export const capabilities = ['tools','policy','pause','audit','idempotency'] as const
export const notTools = [
 {clauses:['PEG-011','PEG-062'],reason:'screen' as const},
 {clauses:['PEG-026','PEG-027','PEG-080'],reason:'connector' as const},
 {clauses:['PEG-024'],reason:'import-door' as const},
 {clauses:['PEG-021'],reason:'installation' as const},
 {clauses:['PEG-079'],reason:'device' as const},
]
function trust(env: Bindings): Trust | null {
 const {RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:keys}=env
 if (![issuer,installationId,keys].some(Boolean)) return null
 if (!issuer || !installationId || !keys) throw new Error('Incomplete agent door trust')
 return {issuer,installationId,appOrigin:env.AUTH_ORIGIN,publicKeys:JSON.parse(keys)}
}
export function agentServices(original: Bindings) {
 const env = runtimeBindings(original), trusted = trust(env), auth = operatorAuth(env)
 const people = operatorAuthPeople({db:env.DB,allowList:authConfig(env).allowList,session:request=>auth.getSession(request)})
 const settings = createBusinessSettings({db:env.DB,business:{settings:1,values:['display_name'],team:{roles:{admin:'admin',member:'member'}}},
  team:auth.businessTeam,trust:trusted?{v:1,issuer:trusted.issuer,audience:env.AUTH_ORIGIN,subject:trusted.installationId,email:env.OWNER_EMAIL,keys:trusted.publicKeys}:null})
 const door = createAgentDoor({seed:'pegboard',name:'Pegboard',specialist:'work-coordination',db:env.DB,origin:env.AUTH_ORIGIN,trust:trusted,
  capabilities,people,tools:workTools(),resources:[],notTools,paths:['/api/v1/public/mcp'],
  localCredentials:request=>localCredentials(env.DB,request),
  currentScopes:async principal=>principal.agent.id.startsWith('pegboard-key:')
   ? principal.clientId ? await currentKey(env.DB,principal.clientId).then(key=>key&&key.owner_id===principal.person.id?scopes(key):[]) : []
   : principal.scopes,
 })
 return {door,settings}
}
export async function agentResponse(request: Request, env: Bindings) {
 const path=new URL(request.url).pathname
 if (!(path==='/mcp'||path==='/api/v1/public/mcp'||path.startsWith('/agents')||path==='/api/rer/agent-policy'||path==='/api/rer/business-settings'||path.startsWith('/.well-known/oauth-protected-resource')||path.startsWith('/rer-business'))) return null
 const {door,settings}=agentServices(env)
 return await door.handle(request) ?? await settings.handle(request)
}
