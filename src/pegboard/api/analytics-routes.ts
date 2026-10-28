import type { Context, Hono } from 'hono'
import { runtimeBindings, type Bindings } from '../../auth.server'
import { door, describe, flag, json } from './door'
import { authenticate, createKey, listKeys, revokeKey } from '../analytics-export/keys'
import { datasets, metadata, type Dataset, type Fields } from '../analytics-export/schema'
import { feed, guard } from '../analytics-export/snapshots'
import { invalid, now } from '../db'
import { dataRevision } from '../data/settings'

export function analyticsRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.post('/analytics/keys', door(async ({ db, actor, workspace, input, form }) => {
    if (form) {
      const days = Number(input.expiryDays), fields: Record<string, string[]> = {}
      if (!Number.isSafeInteger(days) || days < 1 || days > 30) throw invalid('analyst_scope_and_expiry')
      for (const selected of input.fields ?? []) {
        const [dataset, field, extra] = String(selected).split('.')
        if (!field || extra) throw invalid('analyst_fields')
        ;(fields[dataset] ??= []).push(field)
      }
      input = { ...input, projects: input.projects ?? [], fields, expiresAt: now() + days * 86400000, consent: flag(input.consent) }
    }
    const result = await createKey(db, actor, workspace, input)
    // A form submitted with fetch keeps the credential only in the current document, never in a URL or session.
    return json(result)
  }))
  app.get('/analytics/keys', door(async ({ db, actor, workspace }) => ({ keys: await listKeys(db, actor, workspace) })))
  app.post('/analytics/keys/:id/revoke', door(({ db, actor, workspace, params }) => revokeKey(db, actor, workspace, params.id), { next: (_, context) => '/app/settings/analytics?workspace=' + encodeURIComponent(context.workspace) }))
  const read = async (c: Context<{ Bindings: Bindings }>) => {
    const headers = { 'odata-version': '4.0', 'cache-control': 'private, no-store', 'vary': 'Authorization', 'x-content-type-options': 'nosniff' }
    try {
      const db = runtimeBindings(c.env).DB, rev = await dataRevision(db), key = await authenticate(db, c.req.param('id')!, c.req.raw)
      const entity = c.req.param('entity'), fields: Fields = JSON.parse(key.fields)
      const base = new URL(`/api/v1/analytics/odata/${key.id}`, runtimeBindings(c.env).AUTH_ORIGIN).toString()
      if (entity === '$metadata') {
        await guard(db, key, rev)
        return new Response(metadata(fields), { headers: { ...headers, 'content-type': 'application/xml; charset=utf-8' } })
      }
      if (!entity) {
        await guard(db, key, rev)
        return json({ '@odata.context': base + '/$metadata', value: datasets.filter(name => fields[name]).map(name => ({ name, kind: 'EntitySet', url: name })) }, 200, headers)
      }
      return json(await feed(db, key, entity as Dataset, c.req.raw, base), 200, headers)
    } catch (error) {
      const failure = describe(error)
      return json({ error: { code: failure.code, message: failure.code } }, failure.status, { ...headers, ...(failure.status === 401 ? { 'www-authenticate': 'Basic realm="Pegboard analytics"' } : {}) })
    }
  }
  app.get('/analytics/odata/:id', read)
  app.get('/analytics/odata/:id/:entity', read)
}
