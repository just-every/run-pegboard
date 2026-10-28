import assert from 'node:assert/strict'

export const profilePath = person => `/api/v1/workspaces/ws_main/profiles/${person.id}`
export const profileOk = async promise => {
  const response = await promise
  assert.equal(response.status, 200, JSON.stringify(response.body))
  return response.body
}

export async function profileFixture(w) {
  const owner = w.owner, ok = profileOk
  const person = (number, name, role) => w.person(['synthetic-pegboard-' + number, 'example.com'].join('@'), name, role)
  const reader = await person(601, 'Colleague Reader'), subject = await person(602, 'Profile Teammate'), guest = await person(603, 'Profile Guest', 'guest')
  const projects = []
  for (const name of ['Shared campaign', 'Shared launch', 'Confidential project']) projects.push({ ...await ok(owner.post('/api/v1/projects', { name })), name })
  const grants = []
  for (const project of projects.slice(0, 2)) {
    grants.push(await ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: reader.id, level: 'viewer' })))
    await ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: subject.id, level: 'editor' }))
  }
  const task = async (title, extra = {}) => ({ ...await ok(owner.post('/api/v1/tasks', { projectId: projects[0].id, title, ownerId: subject.id, ...extra })), title })
  const shared = await task('Prepare shared launch')
  await ok(owner.post(`/api/v1/tasks/${shared.id}/projects`, { projectId: projects[1].id }))
  await ok(owner.post(`/api/v1/tasks/${shared.id}/projects`, { projectId: projects[2].id }))
  const child = await task('Check launch materials', { parentId: shared.id })
  const completed = await task('Completed launch review', { status: 'done' })
  const collaborator = await task('Collaborative assignment', { ownerId: owner.id })
  await ok(owner.patch(`/api/v1/tasks/${collaborator.id}`, { collaborators: [subject.id] }))
  const hidden = await task('Confidential acquisition work', { projectId: projects[2].id })
  const privateTask = { ...await ok(subject.post('/api/v1/tasks', { title: 'Private personal appointment' })), title: 'Private personal appointment' }
  // A private subtask also has no independent project placement.
  const privateChild = { ...await ok(subject.post('/api/v1/tasks', { title: 'Private personal preparation', parentId: privateTask.id })), title: 'Private personal preparation' }
  return { owner, reader, subject, guest, projects, grants, shared, child, completed, collaborator, hidden, privateTask, privateChild,
    visibleIds: [shared.id, child.id, completed.id, collaborator.id].sort() }
}
