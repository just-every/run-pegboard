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
}
