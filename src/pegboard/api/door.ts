import { permanentEvent } from '../audit/search'
import { batch, newId } from '../db'
import { workspaceRole } from '../workspace/people'
// The one way a request reaches Pegboard's services: a signed-in person, a same-origin write, a body in JSON or form
// fields, and one error shape. Forms and the JSON API are the same door; a form post answers with a redirect.
import type { Context, Handler } from 'hono'
import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { operatorMail } from '../../mail.server.mjs'
import { PegError } from '../db'
import { ensureDefaultWorkspace, actorOf, defaultWorkspaceId, type Actor } from '../workspace/people'
import type { Delivery } from '../access-requests/notify'
import { errorDocument } from '../ui/error'

type Env = { Bindings: Bindings }
export interface Door {
  env: Bindings; db: D1Database; actor: Actor; session: Session; request: Request; params: Record<string, string>; query: URLSearchParams
  input: Record<string, any>; delivery: Delivery; invite: (input: { email: string; displayName: string; role: 'member' }) => Promise<unknown>
  workspace: string; form: boolean
}
const headers = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' }
export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json; charset=utf-8', ...extra } })

const sameOrigin = (request: Request, env: Bindings) => {
  const origin = request.headers.get('origin')
  return !!origin && request.headers.get('sec-fetch-site') !== 'cross-site' && (origin === new URL(request.url).origin || origin === new URL(env.AUTH_ORIGIN).origin)
}
async function readInput(request: Request): Promise<{ input: Record<string, any>; form: boolean }> {
  const type = request.headers.get('content-type') ?? ''
  if (type.includes('application/json')) { try { const body = await request.json(); return { input: body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, any> : {}, form: false } } catch { throw new PegError(400, 'invalid_json') } }
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const data = await request.formData(), input: Record<string, any> = Object.create(null)
    for (const [key, value] of data.entries()) { if (typeof value !== 'string') continue; if (key.endsWith('[]')) (input[key.slice(0, -2)] ??= []).push(value); else input[key] = value }
    return { input, form: true }
  }
  return { input: {}, form: false }
}
/** A form's own `next` field, kept to this app's own paths. */
const landing = (input: Record<string, any>, fallback: string) => typeof input._next === 'string' && /^\/app(\/|$|\?)/.test(input._next) && !input._next.includes('//') ? input._next : fallback

export function describe(error: unknown): PegError {
  if (error instanceof PegError) return error
  if (error instanceof Error && error.message.includes('status_rights_custody_review')) return new PegError(409, 'status_rights_custody_review')
  if (error instanceof Error && error.message.includes('approval_decision_required')) return new PegError(409, 'approval_decision_required')
  if (error instanceof Error && error.name === 'AuthError') { const { code, status } = error as Error & { code: string; status: number }; return new PegError(status, code) }
  console.error(error)
  return new PegError(500, 'internal_error')
}

export interface Options { next?: (result: any, door: Door) => string; raw?: boolean }
/** Wrap a service call as a route. The result is JSON; a form post redirects to `next`. */
export const door = (handler: (door: Door) => Promise<unknown>, options: Options = {}): Handler<Env> => async (c: Context<Env>) => {
  const request = c.req.raw, env = runtimeBindings(c.env)
  let form = false
  let audited: { context: Door; id: string; action: string; subject: string; type: string } | null = null
  try {
    const writing = !['GET', 'HEAD'].includes(request.method)
    const session = await operatorAuth(env).getSession(request)
    form = (request.headers.get('content-type') ?? '').includes('form')
    if (!session) {
      await batch(env.DB,[permanentEvent(env.DB,{workspace:null,actor:null,action:'authentication.refused',type:'api',id:'installation',result:'failure'})])
      if (form) return new Response(null, { status: 303, headers: { ...headers, location: '/signin' } })
      return json({ error: 'unauthenticated' }, 401)
    }
    if (writing && !sameOrigin(request, env)) throw new PegError(403, 'cross_origin')
    await ensureDefaultWorkspace(env.DB)
    const read = options.raw ? { input: {}, form: false } : writing ? await readInput(request) : { input: {}, form: false }
    const query = new URL(request.url).searchParams
    const auth = operatorAuth(env)
    const context: Door = {
      env, db: env.DB, actor: actorOf(session), session, request, params: c.req.param(), query, input: read.input, form: read.form,
      workspace: String(read.input.workspaceId ?? query.get('workspace') ?? defaultWorkspaceId),
      delivery: { origin: new URL(env.AUTH_ORIGIN).origin, from: env.MAIL_FROM, mail: operatorMail(env) },
      invite: input => auth.invite(request, input),
    }
    if ((writing || /\/export$/.test(new URL(request.url).pathname)) && await workspaceRole(env.DB,context.actor.id,context.workspace)) {
      const id=newId('operation'), route=c.req.routePath, subject=/^(?:[a-z]+_[a-f0-9]{20}|[a-f0-9-]{36})$/.test(context.params.id??'')?context.params.id:id
      audited={context,id,action:request.method+' '+route,subject,type:route.split('/').filter(Boolean)[2]??'operation'}
      await batch(env.DB,[permanentEvent(env.DB,{workspace:/\/(tasks|my-tasks|goals|metric-sources|time|timesheets)(\/|$)/.test(c.req.routePath)?null:context.workspace,actor:context.actor.id,action:audited.action,type:audited.type,id:subject,result:'started',metadata:{id:audited.id}})])
    }
    const result = await handler(context)
    if(audited) await batch(env.DB,[permanentEvent(env.DB,{workspace:/\/(tasks|my-tasks|goals|metric-sources|time|timesheets)(\/|$)/.test(c.req.routePath)?null:context.workspace,actor:context.actor.id,action:audited.action,type:audited.type,id:audited.subject,result:result instanceof Response&&result.status>=400?'failure':'success',metadata:{id:audited.id}})])
    if (result instanceof Response) return result
    if (form && writing) return new Response(null, { status: 303, headers: { ...headers, location: landing(read.input, options.next?.(result, context) ?? '/app') } })
    return json(result ?? { ok: true })
  } catch (error) {
    const failure = describe(error)
    if(audited) await batch(env.DB,[permanentEvent(env.DB,{workspace:/\/(tasks|my-tasks|goals|metric-sources|time|timesheets)(\/|$)/.test(c.req.routePath)?null:audited.context.workspace,actor:audited.context.actor.id,action:audited.action,type:audited.type,id:audited.subject,result:'failure',metadata:{id:audited.id}})])
    if (form) return errorDocument(failure.status, failure.code)
    return json({ error: failure.code, ...failure.detail }, failure.status)
  }
}
export const flag = (value: unknown) => value === true || value === 'true' || value === 'on' || value === '1'
export const optional = <T>(value: unknown, map: (v: string) => T): T | undefined => value === undefined || value === '' ? undefined : map(String(value))
