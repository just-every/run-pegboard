// Runs the emitted Worker on its own migrated store, as an installation with its owner, and gives tests a client per
// person who signs in through the public doors (the owner by the setup token, everyone else by invitation and sign-in).
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wrangler = ['node_modules/wrangler/bin/wrangler.js']
const quiet = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }

export class Client {
  constructor(origin, cookie, name) { this.origin = origin; this.cookie = cookie; this.name = name }
  async call(method, path, body, headers = {}) {
    const init = { method, redirect: 'manual', headers: { cookie: this.cookie, origin: this.origin, ...headers } }
    if (body !== undefined) { init.headers['content-type'] ??= 'application/json'; init.body = typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) }
    const response = await fetch(`${this.origin}${path}`, init)
    const type = response.headers.get('content-type') ?? ''
    const parsed = type.includes('json') ? await response.json() : await response.text()
    return { status: response.status, body: parsed, headers: response.headers }
  }
  get(path) { return this.call('GET', path) }
  post(path, body, headers) { return this.call('POST', path, body, headers) }
  patch(path, body) { return this.call('PATCH', path, body) }
  delete(path) { return this.call('DELETE', path) }
  /** A browser form post: urlencoded fields, answered by a redirect. */
  form(path, fields) { return this.call('POST', path, new URLSearchParams(fields).toString(), { 'content-type': 'application/x-www-form-urlencoded' }) }
}

export async function startWorker({ settings = {} } = {}) {
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const persist = await mkdtemp(join(tmpdir(), 'pegboard-graph-'))
  execFileSync(process.execPath, [...wrangler, 'd1', 'migrations', 'apply', 'foundation', '--local', '--persist-to', persist, '--config', 'wrangler.jsonc'], { stdio: 'pipe', env: quiet })
  // Store edits run from a scratch folder: wrangler writes its temp files beside its config, and the dev server restarts when they appear in the checkout.
  const scratch = await mkdtemp(join(tmpdir(), 'pegboard-sql-'))
  await writeFile(join(scratch, 'wrangler.json'), JSON.stringify({ name: 'sql', d1_databases: [{ binding: 'DB', database_name: 'foundation', database_id: 'local-foundation-only' }] }))
  const origin = `http://127.0.0.1:${port}`, setupToken = randomBytes(32).toString('hex'), devKey = randomBytes(40).toString('base64url')
  // The local dev Worker (src/server.dev.ts): its key-gated one-click door signs an invited person in, as `rer dev` does.
  const env = { ...process.env, CI: '1', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true', RER_STATE_DIR: persist, RER_DEV_KEY: devKey, AUTH_LOCAL: 'true', AUTH_ORIGIN: origin, OWNER_EMAIL: 'owner@example.com', MAIL_FROM: 'pegboard@example.com', SESSION_SECRET: randomBytes(32).toString('hex'), SETUP_TOKEN: setupToken, ...settings }
  let child, output = ''
  const launch = () => {
    child = spawn('node_modules/.bin/vite', ['--port', String(port), '--host', '127.0.0.1', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], env })
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
  }
  const ready = async () => {
    for (let attempt = 0; ; attempt++) {
      if (child.exitCode !== null || attempt > 480) throw new Error(`Worker did not start\n${output}`)
      try { if ((await fetch(`${origin}/health`)).ok) break } catch {}
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }
  launch()
  await ready()
  const cookieOf = response => response.headers.getSetCookie().map(line => line.split(';')[0]).filter(pair => !pair.endsWith('=')).join('; ')
  const claim = await fetch(`${origin}/auth/bootstrap`, { method: 'POST', redirect: 'manual', headers: { origin, 'x-rer-dev-key': devKey, 'content-type': 'application/json' }, body: JSON.stringify({ token: setupToken, displayName: 'Wes Holloway' }) })
  if (claim.status !== 303) throw new Error(`owner claim ${claim.status} ${await claim.text()}`)
  const claimed = new Client(origin, cookieOf(claim), 'Wes Holloway')
  await fetch(`${origin}/setup`, { method: 'POST', redirect: 'manual', headers: { cookie: claimed.cookie, origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'displayName=Wes+Holloway&confirm=yes' })
  const enter = async (as, displayName, id) => {
    const entered = await fetch(`${origin}/auth/dev/enter?as=${encodeURIComponent(as)}&returnTo=/app`, { redirect: 'manual', headers: { origin, 'x-rer-dev-key': devKey } })
    if (entered.status !== 303) throw new Error(`sign-in ${as}: ${entered.status}`)
    const client = new Client(origin, cookieOf(entered), displayName)
    client.id = id; client.email = as
    return client
  }
  // The owner signs in through the local dev door, so Base's step-up for sensitive account changes holds as it does in `rer dev`.
  const owner = await enter('owner', 'Wes Holloway')
  owner.id = (await owner.get('/api/v1/me')).body.id
  const server = {
    origin, owner, persist, devKey, output: () => output,
    /** Invite a person into the default workspace in a role (as the owner, through the admin door) and sign them in. */
    async person(email, displayName, role = 'member') {
      const added = await owner.post('/api/v1/workspaces/ws_main/people', { email, displayName, role })
      if (added.status !== 200) throw new Error(`invite ${email}: ${added.status} ${JSON.stringify(added.body)}`)
      return server.signIn(email, displayName, added.body.id)
    },
    signIn: enter,
    /** The store, for the one thing no door offers: moving time. */
    async sql(statement) {
      const out = execFileSync(process.execPath, [join(process.cwd(), wrangler[0]), 'd1', 'execute', 'foundation', '--local', '--persist-to', persist, '--config', join(scratch, 'wrangler.json'), '--json', '--command', statement], { cwd: scratch, stdio: 'pipe', env: quiet }).toString()
      // A second writer on the store makes the dev Worker restart once; wait until it answers steadily again.
      await new Promise(resolve => setTimeout(resolve, 2000))
      for (let steady = 0, tries = 0; steady < 4 && tries < 100; tries++) {
        try { steady = (await fetch(`${origin}/health`)).ok ? steady + 1 : 0 } catch { steady = 0 }
        await new Promise(resolve => setTimeout(resolve, 250))
      }
      return out
    },
    /** Restart the owned process against the same durable installation, without recreating its owner or sessions. */
    async restart() {
      const previous = child
      previous.kill('SIGTERM')
      await new Promise(resolve => previous.exitCode !== null ? resolve() : previous.once('exit', resolve))
      launch()
      await ready()
    },
    async stop() {
      child.kill('SIGTERM')
      await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve))
      await rm(persist, { recursive: true, force: true })
      await rm(scratch, { recursive: true, force: true })
    },
  }
  return server
}
