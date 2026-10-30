import {accessPrivacyScenario} from './scenarios/access-privacy.mjs'
import {startEngineeringServices} from './support/engineering-services.mjs'
// PEG-020 and PEG-083's decision lifecycle, through real sign-in and the public doors: a role matrix over the project,
// task, export, webhook and admin doors; capability changes seen at once; and every way an access request can fail to grant.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { startWorker, proofDocument } from './support/worker.mjs'
import { createDepartureFixture, choicesFor } from './support/departure.mjs'

let w, owner, P, T, who = {}
const ok = async (promise, status = 200) => { const r = await promise; assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
const grant = (project, person, level, extra = {}) => ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: project, granteeId: person.id, level, ...extra }))
const audit = async (filter = '') => (await ok(owner.get(`/api/v1/admin/access-review${filter}`))).audit
const waiting = async who => (await ok(who.get('/api/v1/access-requests'))).toDecide
const decide = (who, request, body) => who.post(`/api/v1/access-requests/${request.id}/decision`, { revision: request.revision, ...body })
let counter = 0

describe('PEG-020 roles, grants and the decision lifecycle', { concurrency: false }, () => {
  before(async () => {
    w = await startWorker(); owner = w.owner
    for (const [key, name, role] of [['admin', 'Ada Admin', 'member'], ['manager', 'Max Manager', 'manager'], ['editor', 'Eli Editor'], ['commenter', 'Cleo Commenter'], ['viewer', 'Vic Viewer'], ['projadmin', 'Pru Projectadmin'], ['analyst', 'Ana Analyst', 'analyst'], ['agent', 'Agent Scoped', 'agent'], ['guest', 'Gus Guest', 'guest'], ['member', 'Pat Plain']])
      who[key] = await w.person(`${key}@example.com`, name, role)
    await ok(owner.post(`/api/v1/workspaces/ws_main/people/${who.admin.id}/account`, { role: 'admin' }))
    who.admin = await w.signIn('admin@example.com', 'Ada Admin', who.admin.id)
    P = (await ok(owner.post('/api/v1/projects', { name: 'Matrix' }))).id
    T = (await ok(owner.post('/api/v1/tasks', { title: 'Matrix task', projectId: P }))).id
    await grant(P, who.editor, 'editor'); await grant(P, who.commenter, 'commenter'); await grant(P, who.viewer, 'viewer'); await grant(P, who.projadmin, 'admin')
    await grant(P, who.analyst, 'editor'); await grant(P, who.agent, 'editor', { scopes: ['read', 'comment'] }); await grant(P, who.guest, 'commenter')
  }, { timeout: 120000 })
  after(() => w?.stop())

  it('enforces the role matrix at every door', async () => {
    const doors = {
      read: c => c.get(`/api/v1/projects/${P}`), comment: c => c.post(`/api/v1/tasks/${T}/comments`, { body: 'hello' }), edit: c => c.patch(`/api/v1/tasks/${T}`, { priority: 'high' }),
      export: c => c.get(`/api/v1/projects/${P}/export`), settings: c => c.patch(`/api/v1/projects/${P}`, { description: 'matrix' }),
      fields: c => c.post(`/api/v1/projects/${P}/fields`, { key: `f${++counter}`, label: 'Field' }), webhook: c => c.post('/api/v1/webhooks', { projectId: P, url: 'https://example.com/hook' }),
      workspaceWebhook: c => c.post('/api/v1/webhooks', { url: 'https://example.com/all' }), team: c => c.post('/api/v1/teams', { name: `Team ${++counter}` }),
      review: c => c.get('/api/v1/admin/access-review'), share: c => c.post('/api/v1/grants', { objectType: 'project', objectId: P, granteeId: who.analyst.id, level: 'viewer', scope: 'approve' }),
    }
    const names = Object.keys(doors)
    const expected = {
      viewer:    [200, 403, 403, 200, 403, 403, 403, 403, 403, 403, 403],
      commenter: [200, 200, 403, 200, 403, 403, 403, 403, 403, 403, 403],
      editor:    [200, 200, 200, 200, 403, 403, 403, 403, 403, 403, 403],
      projadmin: [200, 200, 200, 200, 200, 200, 200, 403, 403, 403, 200],
      analyst:   [200, 403, 403, 200, 403, 403, 403, 403, 403, 403, 403],
      agent:     [200, 200, 403, 403, 403, 403, 403, 403, 403, 403, 403],
      guest:     [200, 200, 403, 200, 403, 403, 403, 403, 403, 403, 403],
      member:    [404, 404, 404, 404, 404, 404, 404, 403, 403, 403, 404],
      manager:   [404, 404, 404, 404, 404, 404, 404, 403, 200, 403, 404],
      admin:     [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200],
    }
    for (const [role, statuses] of Object.entries(expected)) for (const [index, name] of names.entries())
      assert.equal((await doors[name](who[role])).status, statuses[index], `${role} → ${name}`)
    for (const name of names) assert.ok([200].includes((await doors[name](owner)).status), `owner → ${name}`)
    // The screens are doors too: the same standing opens or refuses them.
    for (const [role, statuses] of Object.entries(expected)) for (const path of [`/app/projects/${P}`, `/app/projects/${P}/settings`, `/app/tasks/${T}`])
      assert.equal((await who[role].get(path)).status, statuses[0], `${role} → ${path}`)
    // Nobody is signed in: every door says so, and a form-less cross-origin write is refused.
    const anonymous = { ...owner, cookie: '' }
    assert.equal((await owner.constructor.prototype.call.call({ ...anonymous, origin: owner.origin }, 'GET', `/api/v1/projects/${P}`)).status, 401)
    assert.equal((await owner.call('PATCH', `/api/v1/tasks/${T}`, { priority: 'low' }, { origin: 'https://elsewhere.example' })).status, 403)
  })

  it('applies a change of permission to an open tab at once and records it', async () => {
    const before = await ok(who.editor.get(`/api/v1/tasks/${T}`))
    assert.ok(before.capabilities.includes('edit'))
    await ok(who.editor.patch(`/api/v1/tasks/${T}`, { description: 'edit while open' }))
    const grants = (await ok(owner.get(`/api/v1/grants?objectType=project&objectId=${P}`))).grants
    const mine = grants.find(g => g.grantee_id === who.editor.id)
    await ok(owner.delete(`/api/v1/grants/${mine.id}`)); await grant(P, who.editor, 'viewer')
    assert.equal((await who.editor.patch(`/api/v1/tasks/${T}`, { description: 'stale tab' })).status, 403)
    assert.equal((await who.editor.post(`/api/v1/tasks/${T}/comments`, { body: 'stale tab' })).status, 403)
    const rows = (await audit()).filter(r => r.subject === 'Eli Editor')
    assert.ok(rows.some(r => r.action === 'grant.revoked' && r.detail.level === 'editor'))
    assert.ok(rows.some(r => r.action === 'grant.created' && r.detail.level === 'viewer' && r.actor === 'Wes Holloway'))
    await ok(owner.delete(`/api/v1/grants/${(await ok(owner.get(`/api/v1/grants?objectType=project&objectId=${P}`))).grants.find(g => g.grantee_id === who.editor.id).id}`)); await grant(P, who.editor, 'editor')
  })

  it('refuses to remove the last owner and never leaks a private field through an aggregate', async () => {
    assert.equal((await ok(owner.post(`/api/v1/workspaces/ws_main/people/${owner.id}/account`, { status: 'inactive' }), 409)).error, 'last_owner')
    const team = await ok(who.manager.post('/api/v1/teams', { name: 'Solo admin team' }))
    const mine = (await ok(who.manager.get(`/api/v1/grants?objectType=team&objectId=${team.id}`))).grants[0]
    assert.equal((await ok(who.manager.delete(`/api/v1/grants/${mine.id}`), 409)).error, 'last_owner')
    assert.equal((await who.manager.get(`/api/v1/teams/${team.id}`)).status, 200, 'the team still has its admin')
    const money = (await ok(owner.post('/api/v1/projects', { name: 'Events' }))).id
    await ok(owner.post(`/api/v1/projects/${money}/fields`, { key: 'budget', label: 'Budget', type: 'number', visibility: 'admins' }))
    for (const [n, title] of [[100, 'Venue hire'], [250, 'Catering']]) { const t = await ok(owner.post('/api/v1/tasks', { title, projectId: money, estimateHours: 1 })); await ok(owner.post(`/api/v1/tasks/${t.id}/fields`, { projectId: money, values: { budget: n } })) }
    await grant(money, who.viewer, 'viewer'); await grant(money, who.projadmin, 'admin')
    assert.equal((await ok(who.projadmin.get(`/api/v1/projects/${money}/rollup?field=budget`))).field.sum, 350)
    assert.equal((await who.viewer.get(`/api/v1/projects/${money}/rollup?field=budget`)).status, 404)
    const csv = (await ok(who.viewer.get(`/api/v1/projects/${money}/export`)))
    assert.ok(csv.includes('Venue hire') && !csv.includes('Budget') && !csv.includes('250'), csv)
    assert.ok(!JSON.stringify(await ok(who.viewer.get(`/api/v1/projects/${money}`))).includes('budget'))
    assert.ok(!(await ok(who.viewer.get('/api/v1/export'))).includes('250'))
  })

  it('gives one person Viewer on A and Editor on B, and follows a team grant as it is granted and revoked', async () => {
    const A = (await ok(owner.post('/api/v1/projects', { name: 'Project A' }))).id, B = (await ok(owner.post('/api/v1/projects', { name: 'Project B' }))).id
    const ta = (await ok(owner.post('/api/v1/tasks', { title: 'On A', projectId: A }))).id, tb = (await ok(owner.post('/api/v1/tasks', { title: 'On B', projectId: B }))).id
    await grant(A, who.member, 'viewer'); await grant(B, who.member, 'editor')
    assert.equal((await who.member.post(`/api/v1/tasks/${ta}/comments`, { body: 'no' })).status, 403)
    assert.equal((await who.member.patch(`/api/v1/tasks/${ta}`, { title: 'no' })).status, 403)
    assert.equal((await who.member.patch(`/api/v1/tasks/${tb}`, { title: 'On B, edited' })).status, 200)
    // Commenter directly, Editor through a team: Editor wins; revoking the team grant drops back to Commenter at once.
    const team = await ok(owner.post('/api/v1/teams', { name: 'Editors', privacy: 'private' }))
    await ok(owner.post('/api/v1/grants', { objectType: 'team', objectId: team.id, granteeId: who.commenter.id, level: 'viewer' }))
    await grant(B, who.commenter, 'commenter')
    const teamGrant = await ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: B, granteeType: 'team', granteeId: team.id, level: 'editor' }))
    assert.equal((await who.commenter.patch(`/api/v1/tasks/${tb}`, { priority: 'high' })).status, 200)
    const standing = await ok(owner.get(`/api/v1/standing?objectType=project&objectId=${B}&operatorId=${who.commenter.id}`))
    assert.deepEqual(standing.paths.map(p => p.level).sort(), ['commenter', 'editor']); assert.equal(standing.level, 'editor')
    await ok(owner.delete(`/api/v1/grants/${teamGrant.id}`))
    assert.equal((await who.commenter.patch(`/api/v1/tasks/${tb}`, { priority: 'low' })).status, 403)
    assert.equal((await who.commenter.post(`/api/v1/tasks/${tb}/comments`, { body: 'still can comment' })).status, 200)
    // B Editor cannot do what B Admin can; neither grant opens internal-only or personal work.
    const internal = await ok(owner.post('/api/v1/tasks', { title: 'Internal only', projectId: B, internalOnly: true }))
    const personal = await ok(owner.post('/api/v1/tasks', { title: 'Owner personal' }))
    await ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: B, granteeId: who.guest.id, level: 'admin' }))
    for (const door of [c => c.patch(`/api/v1/projects/${B}`, { name: 'x' }), c => c.post(`/api/v1/projects/${B}/fields`, { key: 'k1', label: 'k' }), c => c.post('/api/v1/webhooks', { projectId: B, url: 'https://example.com/b' })])
      assert.equal((await door(who.member)).status, 403)
    assert.equal((await who.guest.get(`/api/v1/tasks/${internal.id}`)).status, 404, 'a guest Admin still cannot see internal-only work')
    for (const reader of [who.member, who.guest, who.admin]) assert.equal((await reader.get(`/api/v1/tasks/${personal.id}`)).status, 404)
    assert.equal((await who.guest.patch(`/api/v1/projects/${B}`, { name: 'Guest-run B' })).status, 200, 'a guest Admin administers the project it was given')
  })

  it('walks every access-request path to a grant or to nothing, with exact audit rows', async () => {
    await accessPrivacyScenario(w)
    const stage = async (name, extra = {}) => ok(owner.post('/api/v1/projects', { name, ...extra }))
    const ask = (who, targetId, level = 'viewer', message = '') => ok(who.post('/api/v1/access-requests', { targetId, level, message }))
    // Request-to-join team: the chosen Team Admin (not a workspace administrator) is told, approves Editor; only that scope appears.
    const ops = await ok(who.manager.post('/api/v1/teams', { name: 'Ops', privacy: 'request', defaultLevel: 'viewer' }))
    assert.deepEqual((await ok(who.member.get('/api/v1/teams'))).teams.filter(t => t.name === 'Ops').map(t => t.action), ['request'])
    assert.equal((await who.member.post(`/api/v1/teams/${ops.id}/join`, {})).status, 403, 'a request team is joined only by request')
    await ask(who.member, ops.id, 'editor', 'I run the ops calendar')
    assert.equal((await waiting(owner)).length, 0, 'a workspace administrator is not interrupted while the team has an Admin')
    const [toTeamAdmin] = await waiting(who.manager)
    assert.equal(toTeamAdmin.requester.email, 'member@example.com'); assert.equal(toTeamAdmin.message, 'I run the ops calendar')
    assert.deepEqual(toTeamAdmin.grantable, ['viewer', 'commenter', 'editor', 'admin'])
    assert.equal((await decide(who.manager, toTeamAdmin, { decision: 'approve', level: 'editor' })).status, 200)
    assert.equal((await ok(who.member.get(`/api/v1/teams/${ops.id}`))).level, 'editor')
    assert.ok((await audit()).some(r => r.action === 'request.approved' && r.actor === 'Max Manager' && r.subject === 'Pat Plain' && r.detail.requestedLevel === 'editor' && r.detail.grantedLevel === 'editor'))
    assert.ok((await audit()).some(r => r.action === 'request.delivered' && r.subject === 'Max Manager' && r.detail.inbox === true))

    // Denial with a reason, replay, and a second decision on a decided request.
    const secret = (await stage('Denied project')).id
    await grant(secret, who.projadmin, 'admin')
    await ask(who.member, secret, 'commenter')
    const [denyIt] = await waiting(who.projadmin)
    assert.equal((await ok(decide(who.projadmin, denyIt, { decision: 'deny', reason: 'Not this quarter' }))).status, 'denied')
    assert.equal((await who.member.get(`/api/v1/projects/${secret}`)).status, 404)
    const denialRead = await grant(secret, who.member, 'viewer')
    assert.equal((await ok(who.member.get('/api/v1/access-requests'))).mine.find(r => r.id === denyIt.id).reason, 'Not this quarter')
    await ok(owner.delete('/api/v1/grants/'+denialRead.id))
    assert.ok(!(await ok(who.member.get('/api/v1/access-requests'))).mine.some(r => r.id === denyIt.id))
    for (const body of [{ decision: 'approve' }, { decision: 'deny' }]) assert.equal((await ok(decide(who.projadmin, denyIt, body), 409)).error, 'already_decided')

    // Concurrent duplicates make one pending request.
    const busy = (await stage('Busy project')).id
    await Promise.all([1, 2, 3, 4, 5].map(() => ask(who.member, busy, 'viewer')))
    assert.equal((await waiting(owner)).filter(r => r.targetId === busy).length, 1)
    const pendingRead = await grant(busy, who.member, 'viewer')
    assert.equal((await ok(who.member.get('/api/v1/access-requests'))).mine.filter(r => r.targetId === busy && r.status === 'pending').length, 1)

    await ok(owner.delete('/api/v1/grants/'+pendingRead.id))
    // Expiry: a request past its time grants nothing.
    const [late] = (await waiting(owner)).filter(r => r.targetId === busy)
    await w.sql(`UPDATE peg_access_requests SET expires_at=1 WHERE id='${late.id}'`)
    const expiryRead = await grant(busy, who.member, 'viewer')
    assert.equal((await ok(who.member.get('/api/v1/access-requests'))).mine.find(r => r.id === late.id).status, 'expired')
    assert.ok(!(await waiting(owner)).some(r => r.id === late.id))
    await ok(owner.delete('/api/v1/grants/'+expiryRead.id))
    assert.equal((await ok(decide(owner, late, { decision: 'approve' }), 409)).error, 'expired')
    assert.equal((await who.member.get(`/api/v1/projects/${busy}`)).status, 404)
    assert.ok((await audit()).some(r => r.action === 'request.expired' && r.detail.requestId === late.id))

    // A requester deactivated before the decision, an approver revoked before it, a policy changed after it was asked.
    const gone = (await stage('Deactivated requester')).id
    await ask(who.viewer, gone, 'viewer')
    const [forGone] = (await waiting(owner)).filter(r => r.targetId === gone)
    await ok(owner.post(`/api/v1/workspaces/ws_main/people/${who.viewer.id}/account`, { status: 'inactive' }))
    assert.equal((await ok(decide(owner, forGone, { decision: 'approve' }), 409)).error, 'stale')
    await ok(owner.post(`/api/v1/workspaces/ws_main/people/${who.viewer.id}/account`, { status: 'active' }))
    who.viewer = await w.signIn('viewer@example.com', 'Vic Viewer', who.viewer.id)

    const revoked = (await stage('Approver revoked')).id
    const approverGrant = await grant(revoked, who.projadmin, 'admin')
    await ask(who.commenter, revoked, 'viewer')
    const [forRevoked] = await waiting(who.projadmin).then(list => list.filter(r => r.targetId === revoked))
    await ok(owner.delete(`/api/v1/grants/${approverGrant.id}`))
    assert.equal((await decide(who.projadmin, forRevoked, { decision: 'approve' })).status, 404)
    assert.equal((await who.commenter.get(`/api/v1/projects/${revoked}`)).status, 404)

    const changed = (await stage('Policy changes', { visibility: 'workspace' })).id
    const team = await ok(owner.post('/api/v1/teams', { name: 'Narrowing team', privacy: 'private' }))
    await ask(who.guest, changed, 'viewer').catch(() => {})
    await ask(who.analyst, 'prj_nope00000000000000', 'viewer')
    const priv = (await stage('Narrowed later')).id
    await ask(who.analyst, priv, 'viewer')
    const [forPriv] = (await waiting(owner)).filter(r => r.targetId === priv)
    await ok(owner.patch(`/api/v1/projects/${priv}`, { visibility: 'team', teamId: team.id, teamLevel: 'viewer', previewRevision: (await ok(owner.get(`/api/v1/projects/${priv}/share-preview?visibility=team&teamId=${team.id}&teamLevel=viewer`))).revision }))
    assert.equal((await ok(decide(owner, forPriv, { decision: 'approve' }), 409)).error, 'stale_preview')
    const [fresh] = (await waiting(owner)).filter(r => r.targetId === priv)
    assert.equal((await ok(decide(owner, fresh, { decision: 'approve' }), 409)).error, 'stale')
    assert.equal((await who.analyst.get(`/api/v1/projects/${priv}`)).status, 404)

    // Delegation: an approver may grant up to Editor; Admin needs Admin authority. An authorized delegator may choose each level.
    const ladder = (await stage('Ladder')).id
    const levels = ['viewer', 'commenter', 'editor', 'admin'], askers = [who.viewer, who.commenter, who.analyst, who.member]
    await Promise.all(askers.map((c, i) => ask(c, ladder, levels[i])))
    const queue = (await waiting(owner)).filter(r => r.targetId === ladder)
    assert.equal(queue.length, 4)
    for (const request of queue) await ok(decide(owner, request, { decision: 'approve', level: request.level }))
    const review = await ok(owner.get('/api/v1/admin/access-review'))
    for (const [i, c] of askers.entries()) {
      const row = review.grants.find(g => g.objectId === ladder && g.granteeId === c.id)
      assert.ok(row, `grant for ${levels[i]}`); assert.equal(row.source, 'request'); assert.ok(['viewer', 'commenter', 'editor', 'admin'].includes(row.level))
    }
    // The analyst was granted Editor but a read-only kind holds only Viewer: the audit says what was granted, the standing says what holds.
    assert.equal((await ok(who.analyst.get(`/api/v1/projects/${ladder}`))).level, 'viewer')
    const delegated = (await stage('Approver ceiling')).id
    await ok(owner.patch(`/api/v1/teams/${ops.id}`, { approvers: [who.editor.id] }))
    const ceilingTeam = await ok(owner.post('/api/v1/teams', { name: 'Ceiling', privacy: 'request' }))
    await ok(owner.patch(`/api/v1/teams/${ceilingTeam.id}`, { approvers: [who.editor.id] }))
    await ask(who.member, ceilingTeam.id, 'admin')
    const [adminAsk] = await waiting(who.editor)
    assert.deepEqual(adminAsk.grantable, ['viewer', 'commenter', 'editor'])
    assert.equal((await decide(who.editor, adminAsk, { decision: 'approve', level: 'admin' })).status, 403)
    assert.equal((await decide(who.editor, adminAsk, { decision: 'approve', level: 'editor' })).status, 200)
    void delegated

    // A forwarded mail button or a prefetch is a GET: it shows the request and grants nothing. An unsigned or cross-origin POST is refused.
    const open = (await stage('Mail GET')).id
    await ask(who.commenter, open, 'viewer')
    const [mailed] = (await waiting(owner)).filter(r => r.targetId === open)
    assert.equal((await owner.get(`/api/v1/access-requests/${mailed.id}/decision`)).status, 404)
    assert.equal((await owner.get(`/app/access-requests/${mailed.id}`)).status, 200)
    assert.equal((await who.commenter.get(`/api/v1/projects/${open}`)).status, 404)
    const noCookie = await fetch(`${w.origin}/api/v1/access-requests/${mailed.id}/decision`, { method: 'POST', headers: { origin: w.origin, 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'approve', revision: mailed.revision }) })
    assert.equal(noCookie.status, 401)
    assert.equal((await owner.call('POST', `/api/v1/access-requests/${mailed.id}/decision`, { decision: 'approve', revision: mailed.revision }, { origin: 'https://mail.example' })).status, 403)
    assert.equal((await who.commenter.get(`/api/v1/projects/${open}`)).status, 404)

    // A guest has no request option and cannot post one; a private personal task is never a target, whatever id is sent.
    assert.equal((await who.guest.post('/api/v1/access-requests', { targetId: open, level: 'viewer' })).status, 403)
    const mine = await ok(who.member.post('/api/v1/tasks', { title: 'Pat personal' }))
    const before = (await audit()).length
    assert.deepEqual(await ask(who.commenter, mine.id, 'viewer'), await ask(who.commenter, 'tsk_00000000000000000000', 'viewer'))
    assert.equal((await audit()).filter(r => r.target_id === mine.id || r.targetId === mine.id).length, 0)
    assert.equal((await waiting(who.member)).length, 0)
    void before
  })

  it('decides blind portfolio requests as viewer membership without project authority', async () => {
    const make = name => ok(owner.post('/api/v1/portfolios', { name }))
    const ask = (person, id, level = 'viewer') => ok(person.post('/api/v1/access-requests', { targetId: id, level, message: 'Review membership only' }))
    const preview = async (person, id) => (await waiting(person)).find(row => row.targetId === id)
    const review = () => ok(owner.get('/api/v1/admin/access-review'))
    const rowFor = async id => (await review()).portfolioMemberships.filter(row => row.portfolioId === id)
    const pf = await make('Private planning portfolio')
    const project = await ok(owner.post('/api/v1/projects', { name: 'Portfolio confidential project' }))
    const task = await ok(owner.post('/api/v1/tasks', { projectId: project.id, title: 'Private portfolio task' }))
    await ok(owner.post(`/api/v1/portfolios/${pf.id}/projects`, { projectId: project.id }))
    // Blind refusals and acknowledgments do not depend on the target existing.
    for (const path of ['/api/v1/portfolios/', '/app/portfolios/']) {
      const hidden = await who.member.get(path + pf.id), absent = await who.member.get(path + 'pf_synthetic-pegboard-8300')
      assert.equal(hidden.status, 404); assert.equal(absent.status, 404)
      if (path.startsWith('/api')) assert.deepEqual(hidden.body, absent.body)
      else assert.equal(hidden.body.replaceAll(pf.id, 'TARGET'), absent.body.replaceAll('pf_synthetic-pegboard-8300', 'TARGET'))
      assert.ok(!JSON.stringify(hidden.body).includes(pf.name))
    }
    const absent = await ask(who.member, 'pf_synthetic-pegboard-8300')
    assert.deepEqual(await ask(who.member, pf.id, 'admin'), absent)
    assert.equal(await preview(owner, pf.id), undefined, 'a portfolio request cannot request Admin')
    assert.deepEqual(await ask(who.member, pf.id), absent)
    const ownReceipts = (await ok(who.member.get('/api/v1/access-requests'))).mine
    const blind = id => ownReceipts.filter(row => row.targetId === id).map(({ id, targetId, createdAt, expiresAt, ...row }) => ({ ...row, lifetime: expiresAt-createdAt }))
    assert.deepEqual(blind(pf.id), blind('pf_synthetic-pegboard-8300'), 'pending receipts cannot enumerate private portfolio existence')
    assert.equal(blind(pf.id).length, 1)
    const unknown = ownReceipts.find(row => row.targetId === 'pf_synthetic-pegboard-8300')
    assert.equal((await owner.get(`/api/v1/access-requests/${unknown.id}`)).status, 404)
    assert.equal((await decide(owner, unknown, { decision: 'approve' })).status, 404)
    await Promise.all([1, 2, 3].map(() => ask(who.member, pf.id)))
    assert.equal((await waiting(owner)).filter(row => row.targetId === pf.id).length, 1)
    const request = await preview(owner, pf.id)
    assert.equal(request.targetName, pf.name); assert.equal(request.requester.id, who.member.id)
    assert.equal(request.message, 'Review membership only'); assert.deepEqual(request.grantable, ['viewer'])
    assert.deepEqual(request.scopes, [{ scope: 'portfolio', label: 'Portfolio membership only; no project access' }])
    assert.ok(request.expiresAt > request.createdAt)
    assert.equal((await owner.get(`/app/access-requests/${request.id}`)).status, 200, 'prefetch only previews')
    assert.deepEqual(await rowFor(pf.id), [])
    assert.equal((await decide(who.member, request, { decision: 'approve' })).status, 404)
    assert.equal((await decide(who.guest, request, { decision: 'approve' })).status, 404)
    assert.equal((await decide(owner, request, { decision: 'approve', level: 'editor' })).status, 403)
    assert.equal((await decide(owner, request, { decision: 'approve', scope: `project:${project.id}` })).status, 400)
    assert.equal((await decide(owner, { ...request, revision: 'synthetic-pegboard-8301' }, { decision: 'approve' })).status, 409)
    const approved = await ok(decide(owner, request, { decision: 'approve', level: 'viewer', scope: 'portfolio' }))
    assert.equal(approved.level, 'viewer')
    const memberships = await rowFor(pf.id)
    assert.deepEqual(memberships.map(({ at, ...row }) => row), [{ portfolioId: pf.id, portfolio: pf.name, operatorId: who.member.id, member: 'Pat Plain', level: 'viewer', by: 'Wes Holloway', requestId: request.id }])
    assert.ok(memberships[0].at >= request.createdAt)
    assert.equal((await who.member.get(`/api/v1/portfolios/${pf.id}`)).status, 200)
    for (const path of [`/api/v1/projects/${project.id}`, `/api/v1/tasks/${task.id}`, `/app/projects/${project.id}`]) assert.equal((await who.member.get(path)).status, 404)
    assert.equal((await who.member.post(`/api/v1/portfolios/${pf.id}/members`, { operatorId: who.guest.id, level: 'admin' })).status, 403)
    const current = await review()
    assert.equal(current.grants.filter(row => row.requestId === request.id).length, 0)
    const events = current.audit.filter(row => row.targetId === pf.id)
    assert.deepEqual(events.filter(row => row.action === 'request.created').map(row => [row.actor, row.detail.requestedLevel]), [['Pat Plain', 'viewer']])
    assert.equal(events.filter(row => row.action === 'request.deduplicated').length, 3)
    assert.deepEqual(events.filter(row => row.action === 'request.approved').map(row => [row.actor, row.subject, row.detail.requestedLevel, row.detail.grantedLevel, row.detail.grantObject]), [['Wes Holloway', 'Pat Plain', 'viewer', 'viewer', `portfolio:${pf.id}`]])
    assert.deepEqual(events.filter(row => row.action === 'portfolio.member_set').map(row => [row.actor, row.subject, row.detail]), [['Wes Holloway', 'Pat Plain', { level: 'viewer', source: 'request', requestId: request.id }]])
    for (const decision of ['approve', 'deny']) assert.equal((await decide(owner, request, { decision })).status, 409)
    await ok(owner.post(`/api/v1/portfolios/${pf.id}/members`, { operatorId: who.member.id, level: 'none' }))
    assert.equal((await who.member.get(`/api/v1/portfolios/${pf.id}`)).status, 404)
    assert.deepEqual(await rowFor(pf.id), [])
    assert.equal((await decide(owner, request, { decision: 'approve' })).status, 409, 'replay cannot restore removed membership')

    // Independent lifecycles keep each refused path observable and changes empty.
    const denied = await make('Denied portfolio'); await ask(who.member, denied.id)
    const deny = await preview(owner, denied.id)
    await ok(decide(owner, deny, { decision: 'deny', reason: 'Not this planning group' }))
    assert.equal((await ok(who.member.get('/api/v1/access-requests'))).mine.find(row => row.id === deny.id).reason, 'Not this planning group')
    assert.equal((await decide(owner, deny, { decision: 'approve' })).status, 409)
    const expired = await make('Expired portfolio'); await ask(who.member, expired.id)
    const late = await preview(owner, expired.id)
    await w.sql(`UPDATE peg_access_requests SET expires_at=1 WHERE id='${late.id}'`)
    assert.equal((await ok(decide(owner, late, { decision: 'approve' }), 409)).error, 'expired')
    const inactive = await make('Inactive requester portfolio'); await ask(who.viewer, inactive.id)
    const deactivated = await preview(owner, inactive.id)
    await ok(owner.post(`/api/v1/workspaces/ws_main/people/${who.viewer.id}/account`, { status: 'inactive' }))
    assert.equal((await ok(decide(owner, deactivated, { decision: 'approve' }), 409)).error, 'stale')
    await ok(owner.post(`/api/v1/workspaces/ws_main/people/${who.viewer.id}/account`, { status: 'active' }))
    who.viewer = await w.signIn('viewer'+String.fromCharCode(64)+'example.com', 'Vic Viewer', who.viewer.id)
    const parent = await make('Portfolio authority parent')
    const child = await ok(owner.post('/api/v1/portfolios', { name: 'Inherited portfolio authority', parentId: parent.id }))
    await ok(owner.post(`/api/v1/portfolios/${parent.id}/members`, { operatorId: who.projadmin.id, level: 'admin' }))
    await ask(who.member, child.id)
    const delegated = await preview(who.projadmin, child.id)
    assert.deepEqual(delegated.grantable, ['viewer'])
    await ok(owner.post(`/api/v1/portfolios/${parent.id}/members`, { operatorId: who.projadmin.id, level: 'none' }))
    assert.equal((await decide(who.projadmin, delegated, { decision: 'approve' })).status, 404)
    await ok(owner.post(`/api/v1/portfolios/${parent.id}/members`, { operatorId: who.projadmin.id, level: 'admin' }))
    assert.equal((await ok(decide(who.projadmin, delegated, { decision: 'approve' }), 409)).error, 'stale_preview')
    const fresh = await preview(who.projadmin, child.id)
    assert.equal((await ok(decide(who.projadmin, fresh, { decision: 'approve' }), 409)).error, 'stale')
    for (const target of [denied, expired, inactive, child]) {
      assert.deepEqual(await rowFor(target.id), [])
      assert.equal((await who.member.get(`/api/v1/portfolios/${target.id}`)).status, 404)
    }
    const allowed = await ok(owner.post('/api/v1/portfolios', { name: 'Delegated approval', parentId: parent.id }))
    await ask(who.member, allowed.id)
    await ok(decide(who.projadmin, await preview(who.projadmin, allowed.id), { decision: 'approve' }))
    assert.equal((await who.member.get(`/api/v1/portfolios/${allowed.id}`)).status, 200)
    for (const person of [who.guest, who.agent]) assert.equal((await person.post('/api/v1/access-requests', { targetId: allowed.id })).status, 403)
  })

  it('holds workspace policy, scoped grants and file rights at the doors', async () => {
    const policy = body => ok(owner.patch('/api/v1/workspaces/ws_main/settings', body))
    // Invitation policy, export level, workspace sharing and integrations each change what a door allows, and say so in the audit.
    await policy({ invitePolicy: 'owner' })
    assert.equal((await who.admin.post('/api/v1/workspaces/ws_main/people', { email: 'late@example.com', role: 'member' })).status, 403)
    await policy({ invitePolicy: 'admin' })
    await ok(who.admin.post('/api/v1/workspaces/ws_main/people', { email: 'late@example.com', displayName: 'Late Joiner', role: 'member' }))
    await policy({ exportMinLevel: 'editor' })
    assert.equal((await who.viewer.get(`/api/v1/projects/${P}/export`)).status, 403)
    assert.equal((await who.commenter.get('/api/v1/export')).body.includes('Matrix task'), false, 'a workspace export leaves out what the person may not export')
    await policy({ exportMinLevel: 'viewer' })
    await policy({ workspaceSharing: false })
    assert.equal((await owner.patch(`/api/v1/projects/${P}`, { visibility: 'workspace' })).status, 403)
    await policy({ workspaceSharing: true, integrationsEnabled: false })
    assert.equal((await who.projadmin.post('/api/v1/webhooks', { projectId: P, url: 'https://example.com/hook' })).status, 403)
    await policy({ integrationsEnabled: true })
    assert.equal((await owner.patch('/api/v1/workspaces/ws_main/settings', { requestExpiryDays: 400 })).status, 400, 'policy is bounded')
    assert.equal((await who.member.patch('/api/v1/workspaces/ws_main/settings', { exportMinLevel: 'viewer' })).status, 403)
    assert.ok((await audit('?action=settings')).filter(r => r.action === 'settings.changed').length >= 6)
    // Files: a Commenter may attach an allowed type; a Viewer may not; a disallowed type is refused.
    const attach = (c, type, body = 'note') => c.post(`/api/v1/tasks/${T}/attachments?name=note.txt`, body, { 'content-type': type })
    assert.equal((await attach(who.commenter, 'text/plain')).status, 200)
    assert.equal((await attach(who.viewer, 'text/plain')).status, 403)
    assert.equal((await attach(who.commenter, 'text/html', '<script>')).status, 400)
    // Task-assignee scope reaches only the tasks assigned; approve-only reads and approves, and changes nothing.
    const S = (await ok(owner.post('/api/v1/projects', { name: 'Scoped' }))).id
    const mine = await ok(owner.post('/api/v1/tasks', { title: 'Assigned to Pat', projectId: S, ownerId: who.member.id }))
    const other = await ok(owner.post('/api/v1/tasks', { title: 'Someone else’s', projectId: S }))
    await grant(S, who.member, 'editor', { scope: 'assignee' }); await grant(S, who.commenter, 'editor', { scope: 'approve' })
    assert.equal((await who.member.patch(`/api/v1/tasks/${mine.id}`, { status: 'doing' })).status, 200)
    assert.equal((await who.member.get(`/api/v1/tasks/${other.id}`)).status, 404)
    assert.equal((await who.member.get(`/api/v1/projects/${S}`)).status, 404, 'an assignee grant opens tasks, not the project')
    const approver = await ok(owner.get(`/api/v1/standing?objectType=project&objectId=${S}&operatorId=${who.commenter.id}`))
    assert.deepEqual(approver.capabilities.sort(), ['approve', 'read'])
    assert.equal((await who.commenter.post(`/api/v1/tasks/${mine.id}/comments`, { body: 'no' })).status, 403)
    // Retention: decided requests leave the review after the retention window; the audit rows stay.
    await policy({ requestRetentionDays: 30 })
    await w.sql("UPDATE peg_access_requests SET decided_at=1 WHERE status<>'pending'")
    const review = await ok(owner.get('/api/v1/admin/access-review'))
    assert.equal(review.requests.filter(r => r.status !== 'pending').length, 0)
    assert.ok(review.audit.some(r => r.action === 'request.approved'))
  })

  it('keeps one workspace invisible to another’s people', async () => {
    const other = await ok(owner.post('/api/v1/workspaces', { name: 'Skunkworks' }))
    const hidden = await ok(owner.post('/api/v1/projects', { name: 'Skunk project', workspaceId: other.id }))
    assert.ok(!(await ok(who.member.get('/api/v1/workspaces'))).workspaces.some(entry => entry.id === other.id))
    for (const door of [c => c.get(`/api/v1/projects?workspace=${other.id}`), c => c.get(`/api/v1/teams?workspace=${other.id}`), c => c.get(`/api/v1/projects/${hidden.id}`), c => c.post('/api/v1/projects', { name: 'Intruder', workspaceId: other.id })])
      assert.equal((await door(who.member)).status, 404)
    assert.ok(!(await ok(who.member.get('/api/v1/projects'))).projects.some(project => project.name === 'Skunk project'))
  })
})

describe('PEG-032 reviewed departure preserves work and revokes authority', {concurrency:false},()=>{
  let worker,fixture,edge
  before(async()=>{
    edge=await startEngineeringServices()
    worker=await startWorker({settings:{PEGBOARD_VECTOR_ORIGIN:'https://vector.example.com',PEGBOARD_LOCAL_ENGINEERING_ORIGINS:edge.origins}})
    fixture=await createDepartureFixture({w:worker,ok,suffix:'access'})
  },{timeout:120000})
  after(async()=>{await worker?.stop();await edge?.stop()})

  it('requires a current complete review, transfers responsibilities, stops delegated work and preserves human authorship',async()=>{
    const f=fixture,path=f.removalPath
    assert.equal((await f.editor.get(path+'/removal-preview')).status,403)
    assert.equal((await f.editor.post(path+'/remove',{confirm:true,choices:{}})).status,403)
    assert.equal((await f.readAnalytics()).status,200,'the departing administrator key initially works')
    let review=await ok(f.owner.get(path+'/removal-preview'))
    assert.equal(review.completed,false,'a removed query parameter cannot attest a removal')
    const active=new Set(review.affected.filter(set=>set.rows.length).map(set=>set.key))
    for(const key of ['tasks','taskApprovals','personal','projects','portfolios','goals','recurrences','rules','queued','stages','tags','webhooks','personalGoals','approvers','personalRules','engineering','meetings','proposals','register','deliveryApprovals','scheduleApprovals','agents'])assert.ok(active.has(key),`${key} needs an explicit disposition`)
    assert.ok(review.credentials.sessions>0)
    assert.ok(review.credentials.keys>0)
    assert.equal((await f.owner.post(path+'/remove',{token:review.token,confirm:true,choices:{}})).status,400)
    assert.equal((await f.departing.get(`/api/v1/tasks/${f.task.id}`)).status,200,'an incomplete review has no partial effect')

    const later=await ok(f.owner.post('/api/v1/tasks',{projectId:f.project.id,title:'Assigned after removal review',ownerId:f.departing.id}))
    assert.equal((await f.owner.post(path+'/remove',{token:review.token,confirm:true,choices:choicesFor(review,f.owner.id)})).status,409)
    assert.equal((await ok(f.owner.get(`/api/v1/tasks/${later.id}`))).owner.id,f.departing.id)
    review=await ok(f.owner.get(path+'/removal-preview'))
    const beforeTask=await ok(f.owner.get(`/api/v1/tasks/${f.task.id}`))
    const removed=await ok(f.owner.post(path+'/remove',{token:review.token,confirm:true,choices:choicesFor(review,f.owner.id)}))
    assert.equal(removed.status,'inactive')
    const afterReview=await ok(f.owner.get(path+'/removal-preview'))
    assert.equal(afterReview.completed,true,'the permanent event attests the completed removal')
    assert.ok(afterReview.affected.every(set=>set.rows.length===0),'every reviewed set leaves departed authority')
    assert.deepEqual(afterReview.credentials,{sessions:0,keys:0,links:0})
    assert.equal((await f.agent.get(`/api/v1/tasks/${f.task.id}`)).status,404,'delegated agent authority is revoked')
    assert.equal((await f.owner.get(`/api/v1/goals/${f.privateGoal.id}`)).status,404,'private goals remain private after explicit unassignment')
    for(const id of [f.task.id,f.child.id,later.id,f.approval.id,f.stage.taskId])assert.equal((await ok(f.owner.get(`/api/v1/tasks/${id}`))).owner.id,f.owner.id)
    assert.equal((await ok(f.owner.get(`/api/v1/goals/${f.goal.id}`))).goal.owner_id,f.owner.id)
    assert.equal((await ok(f.owner.get(`/api/v1/portfolios/${f.portfolio.id}`))).portfolio.owner,f.owner.name)
    const projects=await ok(f.owner.get('/api/v1/projects'))
    assert.equal(projects.projects.find(project=>project.id===f.project.id).ownerId,f.owner.id)
    assert.equal((await f.owner.get(`/api/v1/tasks/${f.personal.id}`)).status,404,'private work is not silently disclosed by departure')
    const currentTask=await ok(f.owner.get(`/api/v1/tasks/${f.task.id}`))
    assert.deepEqual(currentTask.comments,beforeTask.comments)
    for(const entry of beforeTask.history)assert.deepEqual(currentTask.history.find(row=>row.id===entry.id),entry)
    const transferred=currentTask.history.filter(row=>row.kind==='owner.transferred')
    assert.ok(transferred.some(row=>row.actor===f.owner.name&&row.detail.from===f.departing.id&&row.detail.to===f.owner.id))
    const decided=await ok(f.owner.get(`/api/v1/tasks/${f.decided.id}/decision-preview`))
    assert.equal(decided.state,'approved')
    assert.deepEqual(decided.decisions,f.decidedBefore.decisions,'removal neither replaces nor impersonates the historical human decision')
    assert.equal((await ok(f.owner.get(`/api/v1/tasks/${f.approval.id}/decision-preview`))).state,'pending')

    assert.equal((await f.departing.get(`/api/v1/tasks/${f.task.id}`)).status,401,'the existing session is revoked')
    assert.equal((await f.departing.patch(`/api/v1/tasks/${f.task.id}`,{priority:'urgent'})).status,401)
    assert.equal((await f.readAnalytics()).status,401,'the existing analyst key is revoked')
    const recurrence=await ok(f.owner.get(`/api/v1/recurrences/${f.recurrence.id}`))
    assert.equal(recurrence.schedule.active,0)
    const bundle=await ok(f.owner.get(f.bundlePath))
    assert.ok(bundle.adoptions.every(row=>row.activated_by!==f.departing.id||!row.enabled))
    assert.ok(bundle.jobs.some(job=>job.task_id===f.queuedTask.id&&job.status==='cancelled'))
    assert.equal(bundle.runs.find(run=>run.id===f.stage.runId).owner_id,f.owner.id)
    await ok(f.owner.post(f.bundlePath+'/jobs/process',{}))
    assert.equal((await ok(f.owner.get(`/api/v1/tasks/${f.queuedTask.id}`))).priority,'normal','cancelled queued work never executes')
    const replay=await f.owner.post(path+'/remove',{token:review.token,confirm:true,choices:choicesFor(review,f.owner.id)})
    assert.equal(replay.status,409)
  })
})

describe('Scoped guest work', { concurrency: false }, () => {
  let worker, root, editor, peer, outsider, project, task
  before(async () => {
    worker = await startWorker(); root = worker.owner
    editor = await worker.person('freelancer@example.com', 'Freelancer', 'guest')
    peer = await worker.person('shared-peer@example.com', 'Shared participant', 'guest')
    outsider = await worker.person('internal-person@example.com', 'Internal person')
    await ok(root.post(`/api/v1/workspaces/ws_main/people/${outsider.id}/account`,{role:'admin'}))
    project = (await ok(root.post('/api/v1/projects', { name: 'Client campaign' }))).id
    for (const person of [editor, peer]) await ok(root.post('/api/v1/grants', { objectType:'project', objectId:project, granteeId:person.id, level:'editor' }))
  }, { timeout: 120000 })
  after(() => worker?.stop())
  it('reviews initial guest access without granting, commits exact roles once, and retains decisions after revocation', async () => {
    const makeGuest = name => worker.person(`synthetic-pegboard-${name}${String.fromCharCode(64)}example.test`,name,'guest')
    const project = await ok(root.post('/api/v1/projects',{name:'Reviewed client work',description:'synthetic-pegboard-940'}))
    const descriptionGuest=await makeGuest('description')
    const descriptionBase=`/api/v1/projects/${project.id}/guest-shares`
    const descriptionReview=await ok(root.post(descriptionBase+'/preview',{recipientId:descriptionGuest.id,level:'editor'}))
    assert.deepEqual(descriptionReview.tasks,[])
    assert.equal(descriptionReview.project.description,'synthetic-pegboard-940','an empty project still discloses its description in review')
    assert.equal((await descriptionGuest.get(`/api/v1/projects/${project.id}`)).status,404)
    const descriptionGrant=await ok(root.post(`${descriptionBase}/${descriptionReview.id}/decision`,{decision:'approve',fingerprint:descriptionReview.fingerprint}))
    assert.equal((await ok(descriptionGuest.get(`/api/v1/projects/${project.id}`))).project.description,descriptionReview.project.description)
    assert.ok((await ok(descriptionGuest.get(`/app/projects/${project.id}`))).includes('synthetic-pegboard-940'))
    assert.equal((await ok(root.get(`/api/v1/projects/${project.id}/guest-preview?recipient=${descriptionGuest.id}`))).project.description,descriptionReview.project.description)
    await ok(root.delete(`/api/v1/grants/${descriptionGrant.grantId}`))
    assert.equal((await descriptionGuest.get(`/api/v1/projects/${project.id}`)).status,404)
    console.log('PROBE PEG-019 BLOCKING-A: empty project with description -> Editor preview includes exact description; before confirmation 404; confirmed API and page show reviewed description; revocation 404')
    const internal = await ok(root.post('/api/v1/projects',{name:'Internal workspace work'}))
    const task = await ok(root.post('/api/v1/tasks',{title:'Reviewed deliverable',description:'Visible brief',projectId:internal.id}))
    await ok(root.post(`/api/v1/tasks/${task.id}/comments`,{body:'synthetic-pegboard-911'}))
    await ok(root.post(`/api/v1/tasks/${task.id}/projects`,{projectId:project.id}))
    await ok(root.post(`/api/v1/tasks/${task.id}/comments`,{body:'synthetic-pegboard-912',internalOnly:true}))
    const hiddenTask = await ok(root.post('/api/v1/tasks',{title:'synthetic-pegboard-913',projectId:project.id,internalOnly:true}))
    await ok(root.post(`/api/v1/projects/${internal.id}/fields`,{key:'internal',label:'synthetic-pegboard-914'}))
    await ok(root.post(`/api/v1/tasks/${task.id}/fields`,{projectId:internal.id,values:{internal:'synthetic-pegboard-915'}}))
    const file = await ok(root.post(`/api/v1/tasks/${task.id}/attachments?projectId=${internal.id}&name=synthetic-pegboard-916.txt`,'synthetic-pegboard-916',{'content-type':'text/plain'}))
    const internalField=await ok(root.post(`/api/v1/projects/${project.id}/fields`,{key:'members',label:'synthetic-pegboard-918',visibility:'internal'}))
    await ok(root.post(`/api/v1/tasks/${task.id}/fields`,{projectId:project.id,values:{members:'synthetic-pegboard-919'}}))
    const roleFields={}
    for(const visibility of ['everyone','editors','admins']){
      roleFields[visibility]=await ok(root.post(`/api/v1/projects/${project.id}/fields`,{key:visibility,label:`synthetic-pegboard-field-${visibility}`,visibility}))
      await ok(root.post(`/api/v1/tasks/${task.id}/fields`,{projectId:project.id,values:{[visibility]:`synthetic-pegboard-value-${visibility}`}}))
    }
    const visibleFile = await ok(root.post(`/api/v1/tasks/${task.id}/attachments?projectId=${project.id}&name=synthetic-pegboard-917.txt`,'synthetic-pegboard-917',{'content-type':'text/plain'}))
    const listing = () => ok(root.get(`/api/v1/projects/${project.id}/guest-shares`))
    const grants = async () => (await ok(root.get(`/api/v1/grants?objectType=project&objectId=${project.id}`))).grants
    const preview = (guest,extra={}) => ok(root.post(`/api/v1/projects/${project.id}/guest-shares/preview`,{recipientId:guest.id,level:'viewer',...extra}))
    const decide = (review,extra={}) => root.post(`/api/v1/projects/${project.id}/guest-shares/${review.id}/decision`,{decision:'approve',fingerprint:review.fingerprint,...extra})
    const cancelledGuest = await makeGuest('cancelled'), cancelled = await preview(cancelledGuest)
    assert.deepEqual(await grants(),[])
    assert.equal((await cancelledGuest.get(`/api/v1/tasks/${task.id}`)).status,404)
    assert.deepEqual(cancelled.tasks.map(t=>t.id),[task.id])
    assert.deepEqual(cancelled.manifest.attachmentIds,[visibleFile.id])
    assert.ok(!cancelled.manifest.fields.includes(internalField.id))
    assert.deepEqual(cancelled.manifest.withheld.taskIds,[hiddenTask.id])
    assert.ok(cancelled.manifest.withheld.attachmentIds.includes(file.id))
    assert.ok(cancelled.manifest.withheld.fieldIds.includes(internalField.id))
    for(const marker of ['911','912','913','914','915','916','918','919']) assert.ok(!JSON.stringify(cancelled).includes(`synthetic-pegboard-${marker}`))
    await ok(decide(cancelled,{decision:'cancel'}))
    assert.equal((await decide(cancelled)).status,409)
    assert.deepEqual(await grants(),[])
    assert.equal((await editor.post(`/api/v1/projects/${project.id}/guest-shares/preview`,{recipientId:cancelledGuest.id})).status,404)
    const expiresAt = Date.now()+3600000, baseline=(await listing()).accounting
    let approver
    for(const [name,level,scope,caps] of [
      ['reader','viewer','full',['read','export']],['commenter','commenter','full',['read','export','comment']],
      ['approver','viewer','approve',['read','approve']],['editor','editor','full',['read','export','comment','edit']],
      ['assigned','editor','assignee',['read','export','comment','edit']],
    ]) {
      const guest=await makeGuest(name)
      if(scope==='assignee') await ok(root.patch(`/api/v1/tasks/${task.id}`,{ownerId:guest.id}))
      const review=await preview(guest,{level,scope,expiresAt})
      const before=(await grants()).length
      assert.equal((await guest.get(`/api/v1/tasks/${task.id}`)).status,404)
      assert.deepEqual(review.tasks.map(t=>t.id),[task.id])
      assert.equal(review.project.description,scope==='assignee'?null:'synthetic-pegboard-940')
      assert.deepEqual(review.tasks[0].capabilities.sort(),caps.sort())
      const visibleFields=[roleFields.everyone.id,...(caps.includes('edit')?[roleFields.editors.id]:[])].sort()
      assert.deepEqual(review.tasks[0].projects.find(p=>p.id===project.id).fields.map(f=>f.id).sort(),visibleFields)
      assert.ok(review.manifest.withheld.fieldIds.includes(roleFields.admins.id))
      const result=await ok(decide(review))
      assert.equal((await grants()).length,before+1)
      const received=await ok(guest.get(`/api/v1/tasks/${task.id}`))
      assert.deepEqual(received.capabilities.sort(),caps.sort())
      assert.deepEqual(received.projects.find(p=>p.id===project.id).fields.map(f=>f.id).sort(),visibleFields)
      assert.equal((await guest.patch(`/api/v1/tasks/${task.id}`,{priority:'high'})).status,caps.includes('edit')?200:403)
      assert.equal((await guest.post(`/api/v1/tasks/${task.id}/comments`,{body:'Visible client reply'})).status,caps.includes('comment')?200:403)
      for(const path of [`/api/v1/tasks/${hiddenTask.id}`,`/api/v1/attachments/${file.id}`,`/api/v1/projects/${internal.id}/export`])assert.equal((await guest.get(path)).status,404)
      assert.equal((await guest.get('/api/v1/workspaces/ws_main/people')).status,403)
      assert.equal((await guest.post(`/api/v1/projects/${project.id}/guest-shares/preview`,{recipientId:cancelledGuest.id})).status,scope==='assignee'?404:403)
      const exported = await guest.get(`/api/v1/projects/${project.id}/export`)
      assert.equal(exported.status,scope==='assignee'?404:scope==='approve'?403:200)
      if(exported.status===200)for(const marker of ['911','912','913','914','915','916','918','919'])assert.ok(!exported.body.includes(`synthetic-pegboard-${marker}`))
      if(scope==='assignee') {
        const peerTask=await ok(root.post('/api/v1/tasks',{title:'Peer only work',projectId:project.id}))
        assert.equal((await guest.patch(`/api/v1/tasks/${peerTask.id}`,{priority:'low'})).status,404)
      }
      if(scope==='approve')approver=guest
      await ok(root.delete(`/api/v1/grants/${result.grantId}`))
      assert.equal((await guest.get(`/api/v1/tasks/${task.id}`)).status,404)
      assert.equal((await guest.get(`/api/v1/attachments/${visibleFile.id}`)).status,404)
      assert.equal((await decide(review)).status,409)
      const record=(await listing()).decisions.find(d=>d.id===review.id)
      assert.equal(record.actorId,root.id);assert.equal(record.recipientId,guest.id)
      assert.deepEqual(record.proposal,{objectType:'project',objectId:project.id,granteeType:'person',granteeId:guest.id,level,scope,expiresAt})
      assert.deepEqual(record.manifest,review.manifest);assert.equal(record.fingerprint,review.fingerprint)
    }
    assert.deepEqual((await listing()).accounting,{members:baseline.members,freeGuests:baseline.freeGuests+5})
    assert.deepEqual(await grants(),[])
    assert.equal((await approver.get(`/api/v1/projects/${project.id}/guest-shares`)).status,404)
    const assetProject=await ok(root.post('/api/v1/projects',{name:'Reviewed proof share'}))
    const assetTask=await ok(root.post('/api/v1/tasks',{title:'Client proof asset',projectId:assetProject.id}))
    const assetFile=await ok(root.post(`/api/v1/tasks/${assetTask.id}/attachments?projectId=${assetProject.id}&name=synthetic-pegboard-921.pdf`,proofDocument('Reviewed asset'),{'content-type':'application/pdf'}))
    const proof=await ok(root.post(`/api/v1/tasks/${assetTask.id}/proofs`,{attachmentId:assetFile.id}))
    const assetBase=`/api/v1/projects/${assetProject.id}/guest-shares`
    const assetReview=await ok(root.post(assetBase+'/preview',{recipientId:approver.id,level:'viewer',scope:'approve'}))
    const assetGrant=await ok(root.post(`${assetBase}/${assetReview.id}/decision`,{decision:'approve',fingerprint:assetReview.fingerprint}))
    const config={mode:'ordered',stages:[{name:'Client sign-off',people:[approver.id],quorum:1}]}
    const routing=await ok(root.post(`/api/v1/approval-routing/proof/${proof.id}/preview`,config))
    const route=await ok(root.post(`/api/v1/approval-routing/proof/${proof.id}`,{...config,token:routing.token}))
    const managerView=await ok(root.get(`/api/v1/approvals/${route.id}`))
    const link=await ok(root.post(`/api/v1/approvals/${route.id}/share`,{recipientId:approver.id,expiresAt,token:managerView.token}))
    const guestView=await ok(approver.get(`/api/v1/proof-reviews/${link.id}`))
    await ok(approver.post(`/api/v1/proof-reviews/${link.id}/decision`,{token:guestView.token,version:guestView.version,action:'approve',reason:'Reviewed asset sign-off'}))
    const signed=(await ok(root.get(`/api/v1/approvals/${route.id}`))).votes
    assert.equal(signed.length,1);assert.equal(signed[0].actor_id,approver.id);assert.equal(signed[0].version,proof.versionId)
    await worker.sql(`UPDATE peg_grants SET expires_at=1 WHERE id='${assetGrant.grantId}'`)
    assert.equal((await approver.get(`/api/v1/proof-reviews/${link.id}`)).status,404)
    await ok(root.delete(`/api/v1/grants/${assetGrant.grantId}`))
    for(const path of [`/api/v1/proof-reviews/${link.id}`,`/api/v1/proof-reviews/${link.id}/material`,`/api/v1/attachments/${assetFile.id}`,`/app/proof-reviews/${link.id}`])assert.equal((await approver.get(path)).status,404)
    assert.deepEqual((await ok(root.get(`/api/v1/approvals/${route.id}`))).votes,signed)

    console.log('PROBE PEG-019 initial-share: preview -> zero grants; five exact roles -> one grant each; cancel and replay -> no extra authority; hidden records, links and exports -> refused; history and free-guest counts retained')
  })

  it('requires fresh guest review after changed content, proposals, expiry or authority, including restart and concurrent confirmation', async () => {
    const project=await ok(root.post('/api/v1/projects',{name:'Fresh review required'}))
    const guest=await worker.person(`synthetic-pegboard-stale${String.fromCharCode(64)}example.test`,'Review guest','guest')
    const base=`/api/v1/projects/${project.id}/guest-shares`
    const preview=()=>ok(root.post(base+'/preview',{recipientId:guest.id,level:'editor',scope:'full'}))
    const decide=(review,extra={})=>root.post(`${base}/${review.id}/decision`,{decision:'approve',fingerprint:review.fingerprint,...extra})
    let review=await preview()
    await ok(root.patch(`/api/v1/projects/${project.id}`,{description:'synthetic-pegboard-941'}))
    assert.equal((await decide(review)).status,409,'a changed project description requires a fresh review even without tasks')
    assert.equal((await guest.get(`/api/v1/projects/${project.id}`)).status,404)
    review=await preview()
    assert.equal(review.project.description,'synthetic-pegboard-941')
    const task=await ok(root.post('/api/v1/tasks',{title:'Reviewed source',projectId:project.id}))
    review=await preview()
    await ok(root.patch(`/api/v1/tasks/${task.id}`,{description:'Changed after review'}))
    assert.equal((await decide(review)).status,409)
    assert.equal((await guest.get(`/api/v1/tasks/${task.id}`)).status,404)
    for(const input of [{level:'admin'},{scope:'approve'},{recipientId:peer.id},{expiresAt:1},{fingerprint:'synthetic-pegboard-920'}]){
      review=await preview();assert.equal((await decide(review,input)).status,409)
    }
    review=await preview()
    await ok(root.patch('/api/v1/workspaces/ws_main/settings',{guestsAllowed:false}))
    assert.ok([403,400,409].includes((await decide(review)).status))
    await ok(root.patch('/api/v1/workspaces/ws_main/settings',{guestsAllowed:true}))
    assert.equal((await decide(review)).status,409)
    review=await preview()
    await worker.sql(`UPDATE peg_guest_share_reviews SET review_until=1 WHERE id='${review.id}'`)
    assert.equal((await decide(review)).status,409)
    const expiring=await ok(root.post(base+'/preview',{recipientId:guest.id,level:'viewer',expiresAt:Date.now()+60000}))
    await worker.sql(`UPDATE peg_guest_share_reviews SET review_until=1 WHERE id='${expiring.id}'`)
    assert.equal((await decide(expiring)).status,409)
    const manager=await worker.person(`synthetic-pegboard-reviewer${String.fromCharCode(64)}example.test`,'Reviewing manager')
    const authority=await ok(root.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:manager.id,level:'admin'}))
    review=await ok(manager.post(base+'/preview',{recipientId:guest.id,level:'viewer'}))
    assert.equal((await decide(review)).status,404,'another human cannot adopt a review they did not make')
    await ok(root.delete(`/api/v1/grants/${authority.id}`))
    assert.equal((await manager.post(`${base}/${review.id}/decision`,{decision:'approve',fingerprint:review.fingerprint})).status,404)
    review=await preview()
    await worker.restart()
    const results=await Promise.all([decide(review),decide(review)])
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409])
    const grants=(await ok(root.get(`/api/v1/grants?objectType=project&objectId=${project.id}`))).grants
    assert.equal(grants.filter(g=>g.grantee_id===guest.id).length,1)
    assert.equal((await ok(root.get(base))).decisions.filter(d=>d.id===review.id).length,1)
    await ok(root.delete(`/api/v1/grants/${grants[0].id}`))
    assert.equal((await decide(review)).status,409)
    const erasedReview=await preview()
    await ok(root.post(`/api/v1/workspaces/ws_main/people/${guest.id}/account`,{status:'inactive'}))
    const erasure=await ok(root.post('/api/v1/data/erasure-preview',{type:'person',id:guest.id}))
    assert.deepEqual(erasure.blockers,[])
    await ok(root.post('/api/v1/data/erase',{type:'person',id:guest.id,token:erasure.token,confirm:true}))
    assert.equal((await guest.get(`/api/v1/tasks/${task.id}`)).status,401)
    assert.equal((await decide(erasedReview)).status,409)
    assert.equal((await ok(root.get(`/api/v1/grants?objectType=project&objectId=${project.id}`))).grants.some(g=>g.grantee_id===guest.id),false)
    console.log('PROBE PEG-019 erasure: inactive guest -> native reviewed erasure; old session and pending review -> no reads or new grant')
    console.log('PROBE PEG-019 recheck: changed content, role, scope, recipient, expiry and authority -> no grant; restart and concurrent confirmation -> one grant; revoke then replay -> refused')
  })

  it('lets a guest Editor assign only shared participants, complete work and submit assigned time', async () => {
    assert.deepEqual((await ok(editor.get(`/api/v1/projects/${project}/participants`))).participants.map(p=>p.value).sort(), [root.id,editor.id,peer.id].sort())
    task = await ok(editor.post('/api/v1/tasks', { title:'Guest deliverable', projectId:project, ownerId:peer.id }))
    await ok(editor.patch(`/api/v1/tasks/${task.id}`, { ownerId:editor.id, collaborators:[peer.id] }))
    for (const input of [{ownerId:outsider.id},{collaborators:[outsider.id]},{internalNotes:'secret'},{internalOnly:true}]) assert.equal((await editor.patch(`/api/v1/tasks/${task.id}`,input)).status,403)
    for (const input of [{ownerId:outsider.id},{internalNotes:'secret'},{internalOnly:true}]) assert.equal((await editor.post('/api/v1/tasks',{title:'Refused work',projectId:project,...input})).status,403)
    assert.deepEqual((await ok(editor.get(`/api/v1/tasks/${task.id}`))).collaborators.map(p=>p.id),[peer.id])
    await ok(editor.patch(`/api/v1/tasks/${task.id}`,{status:'done'})); assert.equal((await ok(root.get(`/api/v1/tasks/${task.id}`))).status,'done')
    await ok(editor.patch(`/api/v1/tasks/${task.id}`,{status:'todo'}))
    const day='2026-10-20', sheet=await ok(editor.post('/api/v1/timesheets',{startDate:day,endDate:day}))
    await ok(editor.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:task.id,date:day,seconds:1800,key:'synthetic-pegboard-901'}))
    const view=await ok(editor.get(`/api/v1/timesheets/${sheet.id}`))
    await ok(editor.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'submit',revision:view.token}))
    assert.equal((await ok(editor.get(`/api/v1/timesheets/${sheet.id}`))).sheet.status,'submitted')
    const unassigned=await ok(root.post('/api/v1/tasks',{title:'Peer work',projectId:project,ownerId:root.id}))
    const otherSheet=await ok(editor.post('/api/v1/timesheets',{startDate:day,endDate:day}))
    assert.equal((await editor.post(`/api/v1/timesheets/${otherSheet.id}/entries`,{taskId:unassigned.id,date:day,seconds:60,key:'synthetic-pegboard-902'})).status,403)
    assert.equal((await editor.get('/api/v1/workspaces/ws_main/people')).status,403)
    assert.equal((await editor.post('/api/v1/workspaces/ws_main/people',{email:'uninvited@example.com',displayName:'No invite',role:'guest'})).status,403)
    assert.equal((await editor.get('/app/admin')).status,404)
  })
  it('keeps scoped comments private, exact guest roles limited and old file links revoked', async () => {
    const hidden=await ok(root.post('/api/v1/projects',{name:'Internal campaign'}))
    const shared=await ok(root.post('/api/v1/tasks',{title:'Shared asset',projectId:hidden.id}))
    await ok(root.post(`/api/v1/tasks/${shared.id}/comments`,{body:'Internal comment synthetic-pegboard-903'}))
    await ok(root.post(`/api/v1/tasks/${shared.id}/projects`,{projectId:project}))
    await ok(root.post(`/api/v1/tasks/${shared.id}/comments`,{body:'Members only synthetic-pegboard-906',internalOnly:true}))
    assert.equal((await editor.post(`/api/v1/tasks/${shared.id}/comments`,{body:'No hidden guest comment',internalOnly:true})).status,403)
    await ok(editor.post(`/api/v1/tasks/${shared.id}/comments`,{body:'Client comment'}))
    assert.deepEqual((await ok(editor.get(`/api/v1/tasks/${shared.id}`))).comments.map(c=>c.body),['Client comment'])
    const preview=await ok(root.get(`/api/v1/projects/${project}/guest-preview?recipient=${editor.id}`))
    assert.equal(preview.recipient.id,editor.id)
    assert.deepEqual(preview.tasks.map(t=>t.title).sort(),['Guest deliverable','Peer work','Shared asset'].sort())
    assert.deepEqual(preview.tasks.find(t=>t.id===shared.id).comments.map(c=>c.body),['Client comment'])
    assert.ok(!JSON.stringify(preview).includes('Members only synthetic-pegboard-906'))
    assert.ok(!JSON.stringify(preview).includes('Internal comment synthetic-pegboard-903'))
    assert.equal((await editor.get(`/api/v1/projects/${project}/guest-preview?recipient=${peer.id}`)).status,403)
    assert.deepEqual((await ok(root.get(`/api/v1/tasks/${shared.id}`))).comments.map(c=>c.body),['Internal comment synthetic-pegboard-903','Members only synthetic-pegboard-906','Client comment'])
    for (const [key,level,scope] of [['viewer','viewer','full'],['commenter','commenter','full'],['approver','viewer','approve'],['assignee','editor','assignee']]) {
      const guest=await worker.person(`${key}-client@example.com`,key,'guest')
      await ok(root.post('/api/v1/grants',{objectType:'project',objectId:project,granteeId:guest.id,level,scope}))
      assert.equal((await guest.patch(`/api/v1/tasks/${shared.id}`,{title:'No edit'})).status,key==='assignee'?404:403)
      assert.equal((await guest.post(`/api/v1/tasks/${shared.id}/comments`,{body:'Comment'})).status,key==='commenter'?200:key==='assignee'?404:403)
      assert.equal((await guest.post(`/api/v1/tasks/${shared.id}/attachments?projectId=${project}&name=denied.txt`,'synthetic-pegboard-904',{'content-type':'text/plain'})).status,key==='assignee'?404:403)
      if(key==='assignee') {
        await ok(root.patch(`/api/v1/tasks/${shared.id}`,{ownerId:guest.id}))
        await ok(guest.patch(`/api/v1/tasks/${shared.id}`,{status:'done'}))
        assert.equal((await guest.patch(`/api/v1/tasks/${task.id}`,{status:'done'})).status,404)
      }
    }
    const attachment=await ok(editor.post(`/api/v1/tasks/${shared.id}/attachments?projectId=${project}&name=deliverable.txt`,'synthetic-pegboard-905',{'content-type':'text/plain'}))
    assert.equal((await editor.get(`/api/v1/attachments/${attachment.id}`)).status,200)
    const grant=(await ok(root.get(`/api/v1/grants?objectType=project&objectId=${project}`))).grants.find(g=>g.grantee_id===editor.id)
    await ok(root.delete(`/api/v1/grants/${grant.id}`))
    assert.equal((await root.get(`/api/v1/projects/${project}/guest-preview?recipient=${editor.id}`)).status,403)
    for(const path of [`/api/v1/tasks/${shared.id}`,`/api/v1/attachments/${attachment.id}`,`/api/v1/projects/${project}/export`,`/app/tasks/${shared.id}`]) assert.equal((await editor.get(path)).status,404)
    assert.ok((await ok(root.get('/api/v1/admin/access-review'))).audit.some(row=>row.action==='grant.revoked'&&row.detail.grantId===grant.id))
  })
})
