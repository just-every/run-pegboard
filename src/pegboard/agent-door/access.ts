import { ToolRefusal, type ToolContext } from '../../modules/agent-door/index.ts'
import { authenticate, type ApiKey } from '../public-api/credentials.ts'
import { execute, type Access } from '../public-api/operations.ts'
import { first, now, PegError } from '../db.ts'
import { operatorRow, workspaceRole, workspaceSettings, type Actor } from '../workspace/people.ts'

export const scopes = (key?: ApiKey | null) => ['work:read', ...(!key || key.writable ? ['work:write'] : [])]
export async function currentKey(db: D1Database, id: string) {
 const key = await first<ApiKey>(db, 'SELECT * FROM peg_api_keys WHERE id=?', id)
 const person = key ? await operatorRow(db, key.owner_id) : null
 return key && person?.status === 'active' && person.version === key.owner_version && !key.revoked_at && key.expires_at > now()
  && await workspaceRole(db, person.id, 'ws_main') && (await workspaceSettings(db, 'ws_main')).integrationsEnabled ? key : null
}
export async function localCredentials(db: D1Database, request: Request) {
 try {
  const {key, actor} = await authenticate(db, request)
  return { sponsor: {id: actor.id}, agent: {id: `pegboard-key:${key.id}`, name: key.name, specialist: 'work-coordination'}, clientId: key.id, scopes: scopes(key) }
 } catch { return null }
}
export async function access(ctx: ToolContext): Promise<Access> {
 const person = await operatorRow(ctx.db, ctx.person.id)
 if (!person || person.status !== 'active') throw new ToolRefusal('sponsor_unavailable')
 const local = ctx.agent.id.startsWith('pegboard-key:')
 const key = local && ctx.clientId ? await currentKey(ctx.db, ctx.clientId) : null
 if (local && (!key || key.owner_id !== person.id || ctx.agent.id !== `pegboard-key:${key.id}`)) throw new ToolRefusal('api_key_unavailable')
 const actor: Actor = {id: person.id, email: person.email, displayName: person.display_name, baseRole: person.role as Actor['baseRole'],
  preparedBy: {...ctx.actor,operationId:ctx.operationId,idempotencyKey:ctx.idempotencyKey}, ...(key ? {apiScope: {projects: JSON.parse(key.projects), personal: !!key.personal}} : {})}
 return {key, actor}
}
export async function native(ctx: ToolContext, name: string, args: Record<string, unknown>) {
 try {
  const {idempotency_key, expected_revision: _revision, ...input} = args
  return await execute(ctx.db, await access(ctx), name, {...input, ...(['task_create','task_update','task_comment','personal_section_save','personal_task_place'].includes(name) && ctx.idempotencyKey ? {intent: input.intent ?? ctx.idempotencyKey} : {})})
 } catch (error) {
  if (error instanceof PegError) throw new ToolRefusal(error.code, error.code, {status: error.status})
  throw error
 }
}

export async function nativeFailure<T>(work: () => Promise<T>): Promise<T> {
 try { return await work() } catch(error) {
  if(error instanceof PegError) throw new ToolRefusal(error.code,error.code,{status:error.status,...error.detail})
  throw error
 }
}
