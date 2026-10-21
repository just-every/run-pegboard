// A workspace catalogue filtered by actual project access or the person's private custody.
import {
  all,
  batch,
  bound,
  conflict,
  first,
  forbidden,
  invalid,
  newId,
  notFound,
} from '../db'
import type { Actor } from '../workspace/people'
import { workspaceRole } from '../workspace/people'
import { openProject, need } from '../workspace/projects'
import { openTask, require } from '../tasks/access'
import { auditStatement } from '../authorization/audit'
interface Tag {
  id: string
  workspace_id: string
  owner_id: string | null
  creator_id: string
  name: string
  color: string
  visibility: 'internal' | 'project'
  archived: number
}
async function readable(db: D1Database, actor: Actor, tag: Tag) {
  if (tag.owner_id) return tag.owner_id === actor.id
  const role = await workspaceRole(db, actor.id, tag.workspace_id)
  if (
    !role ||
    (tag.visibility === 'internal' && (role === 'guest' || role === 'agent'))
  )
    return false
  for (const row of await all<{ project_id: string }>(
    db,
    'SELECT project_id FROM peg_tag_projects WHERE tag_id=?',
    tag.id,
  ))
    if (await openProject(db, actor, row.project_id).catch(() => null))
      return true
  return false
}
async function open(db: D1Database, actor: Actor, id: string) {
  const tag = await first<Tag>(db, 'SELECT * FROM peg_tags WHERE id=?', id)
  if (!tag || !(await readable(db, actor, tag))) throw notFound()
  return tag
}
async function editable(db: D1Database, actor: Actor, tag: Tag) {
  if (tag.owner_id) {
    if (tag.owner_id !== actor.id) throw notFound()
    return
  }
  for (const row of await all<{ project_id: string }>(
    db,
    'SELECT project_id FROM peg_tag_projects WHERE tag_id=?',
    tag.id,
  ))
    need((await openProject(db, actor, row.project_id)).effective, 'edit')
}
const name = (v: unknown) => {
  if (typeof v !== 'string' || !v.trim() || v.length > 80)
    throw invalid('tag_name')
  return v.trim()
}
const color = (v: unknown) => {
  if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v))
    throw invalid('tag_color')
  return v
}
export async function tagCatalogue(
  db: D1Database,
  actor: Actor,
  workspaceId: string,
) {
  if (!(await workspaceRole(db, actor.id, workspaceId))) throw notFound()
  const out = []
  for (const tag of await all<Tag>(
    db,
    'SELECT * FROM peg_tags WHERE workspace_id=? ORDER BY name,id',
    workspaceId,
  )) {
    if (!(await readable(db, actor, tag))) continue
    let count = 0
    for (const row of await all<{ task_id: string }>(
      db,
      'SELECT task_id FROM peg_task_tags WHERE tag_id=?',
      tag.id,
    ))
      if (await openTask(db, actor, row.task_id).catch(() => null)) count++
    out.push({
      ...tag,
      count,
      canEdit: await editable(db, actor, tag).then(
        () => true,
        () => false,
      ),
    })
  }
  return out
}
export async function createTag(
  db: D1Database,
  actor: Actor,
  workspaceId: string,
  input: Record<string, any>,
) {
  const role = await workspaceRole(db, actor.id, workspaceId)
  if (!role || role === 'guest' || role === 'agent')
    throw forbidden('create_tag')
  if (input.projectId) {
    const { project, effective } = await openProject(db, actor, input.projectId)
    need(effective, 'edit')
    if (project.workspace_id !== workspaceId) throw invalid('project')
  }
  const visibility = input.visibility ?? 'internal'
  if (!['internal', 'project'].includes(visibility))
    throw invalid('tag_visibility')
  const id = newId('tag')
  await batch(db, [
    bound(
      db,
      'INSERT INTO peg_tags(id,workspace_id,owner_id,creator_id,name,color,visibility) VALUES(?,?,?,?,?,?,?)',
      [
        id,
        workspaceId,
        input.projectId ? null : actor.id,
        actor.id,
        name(input.name),
        color(input.color ?? '#287bc1'),
        visibility,
      ],
    ),
    ...(input.projectId
      ? [
          bound(db, 'INSERT INTO peg_tag_projects VALUES(?,?)', [
            id,
            input.projectId,
          ]),
        ]
      : []),
    auditStatement(db, {
      workspaceId: input.projectId ? workspaceId : null,
      actorId: actor.id,
      action: 'tag.created',
      targetType: 'tag',
      targetId: id,
      detail: { personal: !input.projectId },
    }),
  ])
  return { id }
}
export async function updateTag(
  db: D1Database,
  actor: Actor,
  id: string,
  input: Record<string, any>,
) {
  const tag = await open(db, actor, id)
  await editable(db, actor, tag)
  if (input.projectId) {
    if (tag.owner_id) throw conflict('personal_tag_not_shareable')
    const p = await openProject(db, actor, input.projectId)
    need(p.effective, 'edit')
    if (p.project.workspace_id !== tag.workspace_id) throw invalid('project')
  }
  const archived =
    input.archived === undefined
      ? tag.archived
      : input.archived === true || input.archived === 'true'
        ? 1
        : 0
  await batch(db, [
    bound(db, 'UPDATE peg_tags SET name=?,color=?,archived=? WHERE id=?', [
      input.name === undefined ? tag.name : name(input.name),
      input.color === undefined ? tag.color : color(input.color),
      archived,
      id,
    ]),
    ...(input.projectId
      ? [
          bound(db, 'INSERT OR IGNORE INTO peg_tag_projects VALUES(?,?)', [
            id,
            input.projectId,
          ]),
        ]
      : []),
    auditStatement(db, {
      workspaceId: tag.owner_id ? null : tag.workspace_id,
      actorId: actor.id,
      action: 'tag.updated',
      targetType: 'tag',
      targetId: id,
      detail: { archived },
    }),
  ])
  return { id }
}
export async function tagTask(
  db: D1Database,
  actor: Actor,
  taskId: string,
  tagId: string,
  remove = false,
) {
  const { task, access } = await openTask(db, actor, taskId)
  require(access, 'edit')
  const tag = await open(db, actor, tagId)
  if (tag.workspace_id !== task.workspace_id || (tag.archived && !remove))
    throw invalid('tag_unavailable')
  if (
    !tag.owner_id &&
    !access.personal &&
    !(
      await all<{ project_id: string }>(
        db,
        'SELECT project_id FROM peg_tag_projects WHERE tag_id=?',
        tag.id,
      )
    ).some((row) => access.contexts.has(row.project_id))
  )
    throw forbidden('tag_project')
  await batch(db, [
    remove
      ? bound(db, 'DELETE FROM peg_task_tags WHERE task_id=? AND tag_id=?', [
          task.id,
          tag.id,
        ])
      : bound(db, 'INSERT OR IGNORE INTO peg_task_tags VALUES(?,?)', [
          task.id,
          tag.id,
        ]),
  ])
}
export async function taskTags(db: D1Database, actor: Actor, taskId: string) {
  await openTask(db, actor, taskId)
  const tags = await all<Tag>(
      db,
      'SELECT t.* FROM peg_tags t JOIN peg_task_tags tt ON tt.tag_id=t.id WHERE tt.task_id=? ORDER BY t.name',
      taskId,
    ),
    out = []
  for (const tag of tags)
    if (await readable(db, actor, tag))
      out.push({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        archived: !!tag.archived,
      })
  return out
}
export async function tagFilter(db: D1Database, actor: Actor, tagId: string) {
  const tag = await open(db, actor, tagId),
    tasks = []
  for (const row of await all<{ task_id: string }>(
    db,
    'SELECT task_id FROM peg_task_tags WHERE tag_id=? ORDER BY task_id',
    tag.id,
  )) {
    const opened = await openTask(db, actor, row.task_id).catch(() => null)
    if (opened) tasks.push({ id: opened.task.id, title: opened.task.title })
  }
  return { tag: { id: tag.id, name: tag.name, color: tag.color }, tasks }
}
