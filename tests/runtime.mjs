import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queued=await queuedEntrypoint(import.meta.url,'verify:runtime');if(queued!==null)process.exit(queued);
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const issuer = 'https://rer.example.test', installationId = randomUUID()
const publicKeys = JSON.stringify({ demo: publicKey.export({ format: 'jwk' }) })
const claimToken = origin => {
  const now = Math.floor(Date.now() / 1000), encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const message = `${encode({ alg: 'ES256', typ: 'rer-owner-claim+jwt', kid: 'demo' })}.${encode({ v: 1, iss: issuer, aud: origin, installationId, email: 'owner@example.com', jti: randomUUID(), iat: now, exp: now + 300 })}`
  return `${message}.${sign('sha256', Buffer.from(message), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}

// Each mode runs the emitted Worker on its own fresh migrated store, never the checkout's local data.
async function withWorker(mode, run) {
 const socket = createServer()
 await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
 const port = socket.address().port
 await new Promise(resolve => socket.close(resolve))
 const persist = await mkdtemp(join(tmpdir(), 'foundation-runtime-'))
 const quiet = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }
 // Read counts outside the watched build directory so wrangler's temporary config cannot restart the app.
 const sqlConfig = join(persist, 'wrangler.json')
 const built = JSON.parse(await readFile('dist/server/wrangler.json', 'utf8'))
 await writeFile(sqlConfig, JSON.stringify({ name: 'runtime-sql', d1_databases: built.d1_databases.map(({ binding, database_name, database_id }) => ({ binding, database_name, database_id })) }))
 const database = (...args) => execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', ...args, 'foundation', '--local', '--persist-to', persist, '--config', args[0] === 'execute' ? sqlConfig : 'dist/server/wrangler.json'], { stdio: 'pipe', env: quiet })
 let worker
 try {
  database('migrations', 'apply')
  const origin = `http://127.0.0.1:${port}`, setupToken = randomBytes(32).toString('hex')
  const settings = { AUTH_LOCAL: 'true', AUTH_ORIGIN: origin, OWNER_EMAIL: 'owner@example.com', SESSION_SECRET: randomBytes(32).toString('hex'), SETUP_TOKEN: setupToken,
   RER_DEMO: mode, RER_OWNER_CLAIM_ISSUER: issuer, RER_OWNER_CLAIM_INSTALLATION_ID: installationId, RER_OWNER_CLAIM_PUBLIC_KEYS: publicKeys }
  worker = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--inspector-port', '0', '--local', '--persist-to', persist, '--ip', '127.0.0.1', '--config', 'dist/server/wrangler.json', '--port', String(port), ...Object.entries(settings).flatMap(([name, value]) => ['--var', `${name}:${value}`])], { stdio: ['ignore', 'pipe', 'pipe'], env: quiet })
  console.log(`runtime Worker started: pid=${worker.pid} demo=${mode}`)
  let output = ''
  worker.stdout.on('data', chunk => { output += chunk })
  worker.stderr.on('data', chunk => { output += chunk })
  let ready = false
  for (let attempt = 0; attempt < 120; attempt++) {
    if (worker.exitCode !== null) throw new Error(output)
    try { ready = (await fetch(`${origin}/health`)).ok } catch {}
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert.ok(ready, output)
  const counts = () => {
   const tables = ['oa_operators', 'oa_sessions', 'oa_bootstrap', 'oc_owner_claims', 'oa_identity_providers']
   const sql = `SELECT ${tables.map(table => `(SELECT count(*) FROM ${table}) AS ${table}`).join(', ')}`
   return JSON.parse(database('execute', '--json', '--command', sql).toString())[0].results[0]
  }
  const manual = (path, init = {}) => fetch(`${origin}${path}`, { redirect: 'manual', ...init })
  await run({ origin, setupToken, manual, counts })
 } finally {
  if (worker) {
   worker.kill('SIGTERM')
   await new Promise(resolve => worker.exitCode !== null ? resolve() : worker.once('exit', resolve))
   console.log(`runtime Worker stopped: pid=${worker.pid}`)
  }
  await rm(persist, { recursive: true, force: true })
 }
}

await withWorker('1', async ({ origin, manual, counts }) => {
 const before = counts()
 const claim = await manual('/auth/owner-claim', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ token: claimToken(origin), displayName: 'Wes Holloway', returnTo: '/app' }) })
 const status = claim.status, cookie = claim.headers.get('set-cookie')?.split(';')[0]
 assert.equal(status, 303, await claim.text())
 assert.ok(cookie)
 const session = await manual('/auth/session', { headers: { cookie } })
 assert.equal(session.status, 200)
 assert.equal((await session.json()).operator.role, 'owner')
 assert.equal((await manual('/app', { headers: { cookie } })).status, 200)
 console.log('OWNER-CLAIM demo:', JSON.stringify({ status, session: session.status, before, after: counts() }))
})

await withWorker('0', async ({ origin, setupToken, manual, counts }) => {
 const empty = { oa_operators: 0, oa_sessions: 0, oa_bootstrap: 0, oc_owner_claims: 0, oa_identity_providers: 0 }
 assert.deepEqual(counts(), empty)
 const results = []
 for (const [name, input, extraHeaders] of [
  ['missing', {}, {}],
  ['signed', { token: claimToken(origin) }, {}],
  ['spoofed-demo', { token: claimToken(origin) }, { RER_DEMO: '1', 'x-rer-demo': '1' }],
 ]) {
  const response = await manual('/auth/owner-claim', { method: 'POST', headers: { origin, 'content-type': 'application/json', ...extraHeaders }, body: JSON.stringify(input) })
  const body = await response.json().catch(() => null)
  results.push({ name, status: response.status, error: body?.error ?? null, cookie: response.headers.has('set-cookie'), counts: counts() })
 }
 console.log('OWNER-CLAIM installed:', JSON.stringify(results))
 for (const result of results) {
  assert.equal(result.status, 403, result.name)
  assert.equal(result.error, 'provider_unlinked', result.name)
  assert.equal(result.cookie, false, result.name)
  assert.deepEqual(result.counts, empty, result.name)
 }
  const health = await (await fetch(`${origin}/health`)).json()
  assert.equal(health.status, 'ok')
  assert.equal(health.ok, true)
  assert.deepEqual(Object.keys(health.deployment ?? {}).sort(), ['fingerprint', 'sourceSha', 'versionId'])
  const document = await fetch(origin)
  assert.equal(document.status, 200)
  const branding = JSON.parse(await readFile(new URL('../src/branding.json', import.meta.url)))
  assert.ok((await document.text()).includes(branding.name))
  for (const path of ['/missing', '/health/extra', '/api', '/api/missing']) {
    assert.equal((await fetch(`${origin}${path}`)).status, 404, path)
  }
  console.log('HTTP-001 passed against emitted local Worker: health, the installed homepage, HTTP and document 404s')

  // The owner's first run into the app home: claim with the setup token, finish setup, open /app, and every
  // stylesheet and script the home links answers (the look is the home's own files).
  assert.equal((await manual('/app')).headers.get('location'), '/signin')
  const claim = await manual('/auth/bootstrap', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ token: setupToken, displayName: 'Wes Holloway' }) })
  assert.equal(claim.status, 303, await claim.text())
  const cookie = claim.headers.get('set-cookie').split(';')[0]
  assert.equal((await manual('/app', { headers: { cookie } })).headers.get('location'), '/setup')
  const finished = await manual('/setup', { method: 'POST', headers: { cookie, origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'displayName=Wes+Holloway&confirm=yes' })
  assert.equal(finished.headers.get('location'), '/app')
  const home = await manual('/app', { headers: { cookie } })
  assert.equal(home.status, 200)
  assert.match(home.headers.get('content-type'), /^text\/html/)
  const linked = [...(await home.text()).matchAll(/<(?:link rel="stylesheet" href|script src)="(\/[^"]+)"/g)].map(match => match[1])
  assert.ok(linked.length > 0)
  for (const path of linked) assert.equal((await fetch(`${origin}${path}`)).status, 200, path)
  console.log('APP-HOME passed against emitted local Worker: the owner claims, finishes setup and opens the app home with its look')
})
