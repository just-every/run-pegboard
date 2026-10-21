import {
  all,
  batch,
  bound,
  conflict,
  first,
  invalid,
  newId,
  notFound,
} from '../db'
import type { Actor } from '../workspace/people'
import { openProject, need, fieldReadable } from '../workspace/projects'
import { auditStatement } from '../authorization/audit'
import type { FieldRow } from '../model'

export const fieldTypes = [
  'text',
  'number',
  'currency',
  'date',
  'people',
  'single',
  'multi',
  'checkbox',
  'formula',
  'rollup',
] as const
export type FieldType = (typeof fieldTypes)[number]
export interface FieldConfig {
  options?: string[]
  expression?: string
  sourceKey?: string
  sourceProject?: string
}
export const definitions = (db: D1Database, projectId: string) =>
  all<FieldRow>(
    db,
    'SELECT d.*,f.project_id,f.key FROM peg_project_fields f JOIN peg_field_definitions d ON d.id=f.field_id WHERE f.project_id=? ORDER BY f.key',
    projectId,
  )
export function configOf(field: FieldRow): FieldConfig {
  return JSON.parse(field.config)
}
const text = (value: unknown, max: number, code: string) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw invalid(code)
  return value.trim()
}
export function fieldInput(input: Record<string, any>, old?: FieldRow) {
  const key = text(input.key ?? old?.key, 40, 'key')
  if (!/^[a-z][a-z0-9_]*$/.test(key)) throw invalid('key')
  const type = input.type ?? old?.type ?? 'text',
    visibility = input.visibility ?? old?.visibility ?? 'everyone'
  if (
    !fieldTypes.includes(type) ||
    !['everyone', 'internal', 'editors', 'admins'].includes(visibility)
  )
    throw invalid('field_type_or_permission')
  let config: FieldConfig = old ? configOf(old) : {}
  if (input.config !== undefined) {
    try {
      config =
        typeof input.config === 'string'
          ? JSON.parse(input.config || '{}')
          : input.config
    } catch {
      throw invalid('field_configuration')
    }
    if (!config || Array.isArray(config) || typeof config !== 'object')
      throw invalid('field_configuration')
  }
  if (input.options !== undefined)
    config.options = String(input.options)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  if (input.expression !== undefined)
    config.expression = String(input.expression)
  if (input.sourceKey !== undefined) config.sourceKey = String(input.sourceKey)
  if (input.sourceProject !== undefined)
    config.sourceProject = String(input.sourceProject) || undefined
  if (
    ['single', 'multi'].includes(type) &&
    (!Array.isArray(config.options) ||
      !config.options.length ||
      config.options.length > 100 ||
      config.options.some(
        (s) => typeof s !== 'string' || !s.trim() || s.length > 80,
      ) ||
      new Set(config.options).size !== config.options.length)
  )
    throw invalid('dropdown_options')
  if (
    type === 'formula' &&
    (typeof config.expression !== 'string' ||
      !config.expression.trim() ||
      config.expression.length > 1000)
  )
    throw invalid('formula_expression')
  if (
    type === 'rollup' &&
    (typeof config.sourceKey !== 'string' ||
      !/^[a-z][a-z0-9_]*$/.test(config.sourceKey))
  )
    throw invalid('rollup_source')
  return {
    key,
    label: text(input.label ?? old?.label, 80, 'label'),
    type: type as FieldType,
    visibility: visibility as FieldRow['visibility'],
    units:
      type === 'currency'
        ? 'USD'
        : String(input.units ?? old?.units ?? '').slice(0, 40),
    config,
  }
}
export async function define(
  db: D1Database,
  actor: Actor,
  projectId: string,
  input: Record<string, any>,
) {
  const { project, effective } = await openProject(db, actor, projectId)
  need(effective, 'manage_fields')
  const field = fieldInput(input)
  if (
    await first(
      db,
      'SELECT 1 FROM peg_project_fields WHERE project_id=? AND key=?',
      projectId,
      field.key,
    )
  )
    throw conflict('field_exists')
  const id = newId('fld')
  await batch(db, [
    bound(
      db,
      'INSERT INTO peg_field_definitions(id,workspace_id,authority_project,key,label,type,visibility,units,config) VALUES(?,?,?,?,?,?,?,?,?)',
      [
        id,
        project.workspace_id,
        projectId,
        field.key,
        field.label,
        field.type,
        field.visibility,
        field.units,
        JSON.stringify(field.config),
      ],
    ),
    bound(db, 'INSERT INTO peg_project_fields VALUES(?,?,?)', [
      projectId,
      field.key,
      id,
    ]),
    auditStatement(db, {
      workspaceId: project.workspace_id,
      actorId: actor.id,
      action: 'field.defined',
      targetType: 'project',
      targetId: projectId,
      detail: { id, type: field.type },
    }),
  ])
  return (await definitions(db, projectId)).find((f) => f.id === id)!
}
export async function catalogue(
  db: D1Database,
  actor: Actor,
  workspaceId: string,
) {
  const fields: FieldRow[] = []
  for (const p of await all<{ id: string }>(
    db,
    'SELECT id FROM peg_projects WHERE workspace_id=?',
    workspaceId,
  )) {
    const opened = await openProject(db, actor, p.id).catch(() => null)
    if (!opened?.effective.capabilities.has('manage_fields')) continue
    for (const f of await definitions(db, p.id))
      if (!fields.some((x) => x.id === f.id)) fields.push(f)
  }
  return fields
}
export async function adopt(
  db: D1Database,
  actor: Actor,
  projectId: string,
  fieldId: string,
) {
  const { project, effective } = await openProject(db, actor, projectId)
  need(effective, 'manage_fields')
  const field = (await catalogue(db, actor, project.workspace_id)).find(
    (f) => f.id === fieldId,
  )
  if (!field) throw notFound()
  if (
    await first(
      db,
      'SELECT 1 FROM peg_project_fields WHERE project_id=? AND key=?',
      projectId,
      field.key,
    )
  )
    throw conflict('field_exists')
  await batch(db, [
    bound(db, 'INSERT INTO peg_project_fields VALUES(?,?,?)', [
      projectId,
      field.key,
      field.id,
    ]),
    auditStatement(db, {
      workspaceId: project.workspace_id,
      actorId: actor.id,
      action: 'field.adopted',
      targetType: 'project',
      targetId: projectId,
      detail: { fieldId },
    }),
  ])
  return { id: fieldId }
}
export async function readableDefinitions(
  db: D1Database,
  actor: Actor,
  projectId: string,
) {
  const { effective } = await openProject(db, actor, projectId)
  return (await definitions(db, projectId))
    .filter((f) => fieldReadable(f, effective))
    .map((f) => ({
      ...f,
      config: effective.capabilities.has('manage_fields')
        ? f.config
        : JSON.stringify(
            ['single', 'multi'].includes(f.type)
              ? { options: configOf(f).options }
              : {},
          ),
    }))
}
