import { batch } from './pegboard/db'
import { permanentEvent } from './pegboard/audit/search'
import { rejectedResponse } from './base/rejected-response'
import { createDependencies } from './modules/dependencies/index.mjs'
import { createIdpOwnerClaimHandler, createOwnerClaimHandler } from './modules/owner-claim/index.mjs'
import { firstRunResponse } from './base/setup'
import { fontDocumentResponse } from './base/font-response'
import { createOperatorAuth, createAuthHandler, createSignInHandler, type AuthConfig } from './modules/operator-auth/index.mjs'
import { operatorMail } from './mail.server.mjs'
import branding from './branding.json'
import { homeDocument, settingsDocument } from './ui/document.server'
import { settingsPath } from './ui/home'
import { pegboardPage } from './pegboard/ui/routes'
import { actorOf, ensureDefaultWorkspace, workspacesOf } from './pegboard/workspace/people'
import { listProjects } from './pegboard/workspace/projects'

// The edition's declared theme (public/rer-theme.css), as Base frames link it.
const theme = { href: '/rer-theme.css', productName: branding.name, accentColor: branding.primaryColor }

export interface Bindings {
 /** Local native webhook schema receiver. Never selected in deployed mode. */
 PEGBOARD_LOCAL_WEBHOOK_ORIGIN?: string
 DB: D1Database
 /** Built browser files; hosted deploys run the Worker first (staticAssetResponse). */
 ASSETS?: Fetcher
 RER_DEPLOY_SOURCE?: string
 RER_DEPLOY_FINGERPRINT?: string
 RER_VERSION?: { id: string }
 IDENTITY_PROVIDER?: string
 AUTH_ORIGIN: string
 AUTH_LOCAL?: string
 RER_DEV_ORIGIN?: string
 /** Local runtimes only (AUTH_LOCAL): Harvest/QuickBooks Time schema-fake origins as JSON. Deployed installations use the official APIs. */
 PEGBOARD_LOCAL_TIME_SERVICE_ORIGINS?: string
 /** Operator-configured public Vector installation origin. */
 PEGBOARD_VECTOR_ORIGIN?: string
 /** Local schema-edge origins only; never used in deployed mode. */
 PEGBOARD_LOCAL_ENGINEERING_ORIGINS?: string
 /** Local meeting provider schema edges only. */
 PEGBOARD_LOCAL_MEETING_ORIGINS?: string
 /** Local native availability schema edges only. */
 PEGBOARD_LOCAL_CAPACITY_ORIGINS?: string
 /** Official Calendar schema edges in local runtimes only. */
 PEGBOARD_LOCAL_CALENDAR_ORIGINS?: string
 /** Local runtimes only: the checkout's key gate and dev identity switch. Deploy refuses both. */
 RER_MODELS_SERVICE?: string
 RER_MODELS_KEY?: string
 RER_OWNER_CLAIM_ISSUER?: string
 RER_OWNER_CLAIM_INSTALLATION_ID?: string
 RER_OWNER_CLAIM_PUBLIC_KEYS?: string
 RER_DEMO?: string
 RER_DEV_KEY?: string
 RER_DEV_IDENTITY?: string
 RER_INSTALLATION_ID?: string
 RER_MANAGEMENT_ORIGIN?: string
 OWNER_EMAIL: string
 INSTALLATION_KEY?: string
 INSTALLATION_KEY_PREVIOUS?: string
 SESSION_SECRET: string
 SETUP_TOKEN?: string
 MAIL_PROVIDER?: 'development' | 'resend' | 'sendgrid' | 'cloudflare' | 'rer'
 MAIL_FROM?: string
 MAIL_API_KEY?: string
 MAIL_ACCOUNT_ID?: string
 MAIL_RELAY_URL?: string
}

export const runtimeBindings = (env: Bindings): Bindings => env.RER_DEV_ORIGIN && env.AUTH_LOCAL === 'true' ? { ...env, AUTH_ORIGIN: env.RER_DEV_ORIGIN } : env
export const authConfig = (env: Bindings): AuthConfig => ({ dependencies: true, origin: env.AUTH_ORIGIN, local: env.AUTH_LOCAL === 'true', OWNER_EMAIL: env.OWNER_EMAIL, SESSION_SECRET: env.SESSION_SECRET, INSTALLATION_KEY: env.INSTALLATION_KEY, INSTALLATION_KEY_PREVIOUS: env.INSTALLATION_KEY_PREVIOUS, SETUP_TOKEN: env.SETUP_TOKEN, MAIL_FROM: env.MAIL_FROM, branding: { productName: branding.name, accentColor: branding.primaryColor, signInPath: '/signin', theme: theme.href } })
export function operatorAuth(env: Bindings) {
 return createOperatorAuth({ db: env.DB, config: authConfig(env), mailSender: operatorMail(env), clientIp: request => request.headers.get('CF-Connecting-IP') ?? '' })
}

async function hasProjects(db: D1Database, actor: ReturnType<typeof actorOf>): Promise<boolean> {
 await ensureDefaultWorkspace(db)
 for (const workspace of await workspacesOf(db, actor)) if ((await listProjects(db, actor, workspace)).length) return true
 return false
}

const privateHeaders = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' }

async function handleAuthResponse(request: Request, original: Bindings): Promise<Response | null> {
 const env = runtimeBindings(original), url = new URL(request.url)
 if (url.pathname === '/auth/owner-claim' && env.RER_DEMO === '1' && env.RER_OWNER_CLAIM_PUBLIC_KEYS) {
  return createOwnerClaimHandler({ db: env.DB, authConfig: authConfig(env), clientIp: req => req.headers.get('CF-Connecting-IP') ?? '',
   issuer: env.RER_OWNER_CLAIM_ISSUER ?? '', installationId: env.RER_OWNER_CLAIM_INSTALLATION_ID ?? '',
   appOrigin: env.AUTH_ORIGIN, expectedEmail: env.OWNER_EMAIL, publicKeys: JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS) })(request)
 }
 if (url.pathname.startsWith('/.well-known/rer-') || url.pathname.startsWith('/auth/dependencies/')) {
  const linked = await createDependencies({ db: env.DB, INSTALLATION_KEY: env.INSTALLATION_KEY, INSTALLATION_KEY_PREVIOUS: env.INSTALLATION_KEY_PREVIOUS, origin: env.AUTH_ORIGIN, name: branding.name, provider: env.IDENTITY_PROVIDER, local: env.AUTH_LOCAL === 'true', auth: operatorAuth(env), claimOwner: token => createIdpOwnerClaimHandler({db:env.DB,authConfig:authConfig(env),clientIp:()=>request.headers.get('CF-Connecting-IP')??''})(new Request(env.AUTH_ORIGIN+'/auth/owner-claim',{method:'POST',headers:{Host:new URL(env.AUTH_ORIGIN).host,Origin:env.AUTH_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({token})})) }).handle(request)
  if (linked) return linked
 }
 if (url.pathname === '/auth/owner-claim') return createIdpOwnerClaimHandler({db:env.DB,authConfig:authConfig(env),clientIp:req=>req.headers.get('CF-Connecting-IP')??''})(request)
 // The shared server-rendered sign-in page: plain forms that work before any script.
 if (url.pathname === '/signin') {
  const page = await createSignInHandler(operatorAuth(env), {
   defaultReturnTo: '/setup',
  })(request)
  if (page) return fontDocumentResponse(page)
 }
 if (url.pathname.startsWith('/auth/')) {
  const response = await fontDocumentResponse(await createAuthHandler(operatorAuth(env))(request))
  // Sign-in settings (the owner's page) wear the app's bar: its views with Settings current, and the person.
  if (url.pathname === settingsPath && request.method === 'GET' && response?.status === 200 && response.headers.get('content-type')?.startsWith('text/html')) {
   const session = await operatorAuth(env).getSession(request)
   if (session) return settingsDocument(response, session.operator)
  }
  return response
 }
 if (url.pathname === '/setup' || url.pathname === '/app' || url.pathname.startsWith('/app/')) {
  const setup = await firstRunResponse(request, env, operatorAuth(env), { theme })
  if (setup) return setup
 }
 if (url.pathname === '/app') {
  const session = await operatorAuth(env).getSession(request)
  if (!session) return new Response(null, { status: 303, headers: { ...privateHeaders, location: '/signin' } })
  // A person with projects lands on them; the empty wall is for a person with none.
  if (await hasProjects(env.DB, actorOf(session))) return new Response(null, { status: 303, headers: { ...privateHeaders, location: '/app/projects' } })
  return homeDocument(session.operator)
 }
 if (url.pathname.startsWith('/app/')) return pegboardPage(request, original)
 return null
}

export async function authResponse(request: Request, original: Bindings): Promise<Response | null> {
 const path=new URL(request.url).pathname,authPath=path.startsWith('/auth/')||path==='/signin'
 const before=authPath?await operatorAuth(runtimeBindings(original)).getSession(request):null
 const response = await handleAuthResponse(request, original)
 if(authPath&&response&&response.status>=400&&response.status!==404)await batch(original.DB,[permanentEvent(original.DB,{workspace:null,actor:before?.operator.id??null,action:'authentication.refused',type:'authentication',id:'installation',result:'failure'})])
 const mutations:Record<string,string>={'/auth/operator/role':'role_changed','/auth/operator/status':'status_changed','/auth/session/revoke':'session_revoked','/auth/invite':'invited','/auth/invite/cancel':'invitation_cancelled','/auth/signout':'signed_out','/auth/display-name':'profile_changed','/auth/email':'identity_changed','/auth/policy/approve':'policy_approved','/auth/policy/revoke':'policy_revoked','/auth/domain-rules':'domain_policy_changed','/auth/providers/unlink':'provider_unlinked','/auth/providers/relink':'provider_relinked'}
 if(request.method==='POST'&&mutations[path]&&response&&response.status<400){
  let subject=before?.operator.id??'installation',metadata:Record<string,unknown>={}
  // Only these bounded native operator responses supply a subject. No request, challenge or credential body is inspected.
  if(['/auth/operator/role','/auth/operator/status','/auth/invite/cancel'].includes(path)&&response.headers.get('content-type')?.includes('application/json')){
   const value=await response.clone().json().catch(()=>null) as {id?:unknown;role?:unknown}|null
   if(typeof value?.id==='string'&&/^[a-f0-9-]{36}$/.test(value.id))subject=value.id
   metadata={role:value?.role}
  }
  await batch(original.DB,[permanentEvent(original.DB,{workspace:null,actor:before?.operator.id??null,action:'authentication.'+mutations[path],type:subject==='installation'?'installation':'person',id:subject,metadata})])
 }
 return response ? rejectedResponse(request, response) : null
}
