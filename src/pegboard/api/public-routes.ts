import type { Hono } from 'hono'
import { runtimeBindings, type Bindings } from '../../auth.server'
import { batch, invalid } from '../db'
import { permanentEvent } from '../audit/search'
import { issueKey, listKeys, revokeKey, authenticate } from '../public-api/credentials'
import { execute } from '../public-api/operations'
import { openapi, restOperations, tools } from '../public-api/schema'
import { door, describe, json } from './door'

export function publicRoutes(app: Hono<{ Bindings: Bindings }>) {
 app.post('/api-keys', door(({ db, actor, input }) => issueKey(db, actor, input)))
 app.get('/api-keys', door(async ({ db, actor }) => ({ keys: await listKeys(db, actor) })))
 app.delete('/api-keys/:id', door(({ db, actor, params }) => revokeKey(db, actor, params.id)))
 app.get('/public/openapi.json', () => json(openapi()))
 for (const [method, path, name] of restOperations) {
  app.on(method.toUpperCase(), '/public' + path.replace(/\{(\w+)\}/g, ':$1'), async c => {
   const db = runtimeBindings(c.env).DB
   let access: Awaited<ReturnType<typeof authenticate>> | undefined
   try {
    access = await authenticate(db, c.req.raw)
    const body = method === 'get' ? Object.fromEntries(new URL(c.req.url).searchParams) : await c.req.json().catch(() => { throw invalid('invalid_json') })
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('invalid_json')
    if (method === 'get') {
     const schema = tools.find(tool=>tool.name===name)!.inputSchema
     for (const [key,field] of Object.entries(schema.properties)) if (key in body && (field as {type?:string}).type === 'integer') body[key]=Number(body[key])
    }
    const result = await execute(db, access, name, { ...body, ...c.req.param() })
    await batch(db, [permanentEvent(db, { workspace: null, actor: access.actor.id, action: 'api.' + name, type: 'api_key', id: access.key.id })])
    return json(result)
   } catch (error) {
    const failure = describe(error)
    await batch(db, [permanentEvent(db, { workspace: null, actor: access?.actor.id ?? null, action: 'api.' + name, type: 'api_key', id: access?.key.id ?? 'installation', result: 'failure' })])
    return json({ error: failure.code, ...failure.detail }, failure.status)
   }
  })
 }
 app.post('/public/mcp', async c => {
  let id: unknown = null
  try {
   const db = runtimeBindings(c.env).DB, access = await authenticate(db, c.req.raw)
   const message = await c.req.json().catch(() => { throw invalid('invalid_json') })
   if (!message || message.jsonrpc !== '2.0' || Array.isArray(message)) throw invalid('invalid_jsonrpc')
   if (message.id !== undefined && message.id !== null && typeof message.id !== 'string' && !(typeof message.id === 'number' && Number.isFinite(message.id))) throw invalid('invalid_jsonrpc')
   id = message.id ?? null
   if (message.method === ['notifications','initialized'].join('/') && message.id === undefined) return new Response(null, { status: 202 })
   let result: unknown
   if (message.method === 'initialize') {
    if (!['2024-11-05', '2025-03-26', '2025-06-18'].includes(message.params?.protocolVersion)) throw invalid('unsupported_protocol')
    result = { protocolVersion: message.params.protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'pegboard', version: '1.0.0' }, instructions: 'Tools act under the credential scope and current permissions. Human approvals require the native decision door.' }
   } else if (message.method === ['tools','list'].join('/')) result = { tools }
   else if (message.method === 'ping') result = {}
   else if (message.method === ['tools','call'].join('/')) {
    if (!tools.some(tool => tool.name === message.params?.name)) return json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Unknown tool' } })
    const input = message.params.arguments ?? {}
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('arguments')
    try {
     const value = await execute(db, access, message.params.name, input)
     result = { content: [{ type: 'text', text: JSON.stringify(value) }], isError: false }
     await batch(db, [permanentEvent(db, { workspace: null, actor: access.actor.id, action: 'mcp.' + message.params.name, type: 'api_key', id: access.key.id })])
    } catch (error) {
     const failure = describe(error)
     result = { content: [{ type: 'text', text: JSON.stringify({ error: failure.code, status: failure.status, ...failure.detail }) }], isError: true }
     await batch(db, [permanentEvent(db, { workspace: null, actor: access.actor.id, action: 'mcp.' + message.params.name, type: 'api_key', id: access.key.id, result: 'failure' })])
    }
   } else return json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } })
   return json({ jsonrpc: '2.0', id, result })
  } catch (error) {
   const failure = describe(error)
   return json({ jsonrpc: '2.0', id, error: { code: -32600, message: failure.code } }, failure.status)
  }
 })
}
