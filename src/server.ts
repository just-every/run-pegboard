import {processApprovalReminders} from './pegboard/approvals/routing'
import {approvalMail} from './pegboard/approvals/mail.mjs'
import {processBundleJobs} from './pegboard/bundles/queue'
import { archiveResponse } from './pegboard/api/data-routes'
import {processRecurrences} from './pegboard/recurrence/recurrence'
import { withDemo } from './modules/demo/index.mjs'
import { seedDemo } from './demo'
import { rejectedResponse } from './base/rejected-response'
import start from '@tanstack/react-start/server-entry'
import { Hono } from 'hono'
import { dispatch } from './base/dispatch'
import { staticAssetResponse } from './base/static-assets'
import { deploymentHealth } from './base/deployment-health'
import { lobbyResponse } from './base/lobby'
import { setupStateResponse } from './base/setup-state'
import { authResponse, runtimeBindings, type Bindings } from './auth.server'
import { identity } from './identity'
import { alternative, job } from './site/copy'
import { pegboardApi } from './pegboard/api'

const api = new Hono<{ Bindings: Bindings }>()
api.get('/health', (context) => context.json({ status: 'ok', ...deploymentHealth(context.env) }))
api.route('/api/v1', pegboardApi)

// Start documents keep their own cache policy and add no-transform, so no proxy
// rewrites the HTML React hydrates (Cloudflare's email address obfuscation
// honours it; src/base/hydration/README.md).
function noTransform(response: Response): Response {
  const headers = new Headers(response.headers), policy = headers.get('cache-control')
  headers.set('cache-control', policy ? `${policy}, no-transform` : 'no-transform')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export default withDemo<Bindings, ExportedHandler<Bindings>>({
  async scheduled(_event, env, execution) { execution.waitUntil(processRecurrences(runtimeBindings(env).DB).then(()=>processBundleJobs(runtimeBindings(env).DB)).then(()=>{const e=runtimeBindings(env);return processApprovalReminders(e.DB,{origin:e.AUTH_ORIGIN,from:e.MAIL_FROM,mail:approvalMail(e)})})) },
  async fetch(request, env, execution) {
    const asset = await staticAssetResponse(request, env)
    if (asset) return asset
    const archive = await archiveResponse(request, env)
    if (archive) return archive
    const auth = await authResponse(request, env)
    if (auth) return auth
    // The installed variant: the Lobby at / and the public claim state it reads.
    // Local dev serves the saved origin's data at its own port (RER_DEV_ORIGIN).
    const state = await setupStateResponse(request, runtimeBindings(env))
    if (state) return state
    const lobby = await lobbyResponse(request, runtimeBindings(env), identity)
    if (lobby) {
      if (request.method === 'HEAD') return lobby
      // Keep Base's Lobby, theme and owner-state action; add only this seed's copy.
      const html = (await lobby.text())
        .replace('<p class="line">', `<p class="credit">${job}</p><p class="line">`)
        .replace('</section>', `<p class="credit">${alternative}</p></section>`)
      return new Response(html, lobby)
    }
    return rejectedResponse(request, await dispatch(request, () => api.fetch(request, env, execution), async () => noTransform(await start.fetch(request))))
  },
} satisfies ExportedHandler<Bindings>, { seed: seedDemo })
