import {
  all,
  batch,
  bound,
  conflict,
  first,
  invalid,
  notFound,
  newId,
} from '../db'
import type { Actor } from '../workspace/people'
import { workspaceRole, displayNames } from '../workspace/people'
import { openTask } from '../tasks/access'
import { openProject, need, fieldReadable } from '../workspace/projects'
import type { FieldRow } from '../model'
import {
  configOf,
  definitions,
  fieldInput,
  projectTaskIds,
} from './definitions'
import { historyStatement } from '../tasks/history'
import { auditStatement } from '../authorization/audit'

export type FieldValue = string | number | boolean | string[] | null
export interface Result {
  value: FieldValue
  error: string | null
}
const bad = (error: string): Result => ({ value: null, error })
export function normalize(field: FieldRow, value: unknown): FieldValue {
  if (value === null || value === '') return null
  if (field.type === 'text') {
    if (typeof value !== 'string' || value.length > 20000)
      throw invalid('text_value')
    return value
  }
  if (field.type === 'number' || field.type === 'currency') {
    if (
      (typeof value !== 'string' && typeof value !== 'number') ||
      !Number.isFinite(Number(value))
    )
      throw invalid('number_value')
    const n = Number(value)
    if (
      field.type === 'currency' &&
      Math.abs(n * 100 - Math.round(n * 100)) > 1e-6
    )
      throw invalid('usd_cents_required')
    return n
  }
  if (field.type === 'date') {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value
    )
      throw invalid('date_value')
    return value
  }
  if (field.type === 'checkbox') {
    if (value === true || value === 'true') return true
    if (value === false || value === 'false') return false
    throw invalid('checkbox_value')
  }
  const config = configOf(field)
  if (field.type === 'single') {
    if (typeof value !== 'string' || !config.options?.includes(value))
      throw invalid('dropdown_value')
    return value
  }
  if (['multi', 'people', 'rollup'].includes(field.type)) {
    const values = Array.isArray(value)
      ? value.filter((v) => v !== '')
      : typeof value === 'string'
        ? value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : null
    if (
      !values ||
      values.length > 100 ||
      values.some((v) => typeof v !== 'string' || v.length > 100)
    )
      throw invalid('list_value')
    if (
      field.type === 'multi' &&
      values.some((v) => !config.options?.includes(v))
    )
      throw invalid('dropdown_value')
    return [...new Set(values)]
  }
  throw invalid('computed_field_read_only')
}
// Arithmetic is parsed rather than evaluated as JavaScript. Each field reference is permission-checked by the resolver.
export async function arithmetic(
  expression: string,
  resolve: (key: string) => Promise<number>,
): Promise<number> {
  const tokens =
    expression.match(/(?:\d+(?:\.\d+)?)|(?:[a-z][a-z0-9_]*)|[()+*\/-]/g) ?? []
  if (tokens.join('') !== expression.replace(/\s/g, '') || tokens.length > 250)
    throw Error('INVALID_FORMULA')
  let at = 0
  const atom = async (): Promise<number> => {
    const t = tokens[at++]
    if (t === '(') {
      const n = await sum()
      if (tokens[at++] !== ')') throw Error('INVALID_FORMULA')
      return n
    }
    if (t === '-') return -(await atom())
    if (t && /^\d/.test(t)) return Number(t)
    if (t && /^[a-z]/.test(t)) return resolve(t)
    throw Error('INVALID_FORMULA')
  }
  const product = async (): Promise<number> => {
    let n = await atom()
    while (['*', '/'].includes(tokens[at])) {
      const op = tokens[at++],
        d = await atom()
      if (op === '/' && d === 0) throw Error('DIVISION_BY_ZERO')
      n = op === '*' ? n * d : n / d
    }
    return n
  }
  const sum = async (): Promise<number> => {
    let n = await product()
    while (['+', '-'].includes(tokens[at])) {
      const op = tokens[at++],
        d = await product()
      n = op === '+' ? n + d : n - d
    }
    return n
  }
  const n = await sum()
  if (at !== tokens.length) throw Error('INVALID_FORMULA')
  if (!Number.isFinite(n)) throw Error('NON_FINITE_RESULT')
  return Math.round(n * 1e10) / 1e10
}
export async function evaluate(
  db: D1Database,
  actor: Actor,
  taskId: string,
  projectId: string,
  key: string,
  trail = new Set<string>(),
): Promise<Result> {
  const marker = `${taskId}:${projectId}:${key}`
  if (trail.has(marker)) return bad('CYCLE')
  if (trail.size >= 50) return bad('DEPENDENCY_LIMIT')
  const next = new Set(trail).add(marker)
  const opened = await openTask(db, actor, taskId).catch(() => null),
    context = opened?.access.contexts.get(projectId)
  if (!context) return bad('INPUT_UNAVAILABLE')
  const field = (await definitions(db, projectId)).find((f) => f.key === key)
  if (!field || !fieldReadable(field, context)) return bad('INPUT_UNAVAILABLE')
  const stored = await first<{ value: string }>(
    db,
    'SELECT value FROM peg_field_values WHERE task_id=? AND field_id=?',
    taskId,
    field.id,
  )
  if (field.type === 'formula') {
    try {
      const value = await arithmetic(
        configOf(field).expression ?? '',
        async (name) => {
          const result = await evaluate(
            db,
            actor,
            taskId,
            projectId,
            name,
            next,
          )
          if (result.error) throw Error(result.error)
          if (typeof result.value !== 'number')
            throw Error(
              result.value === null ? 'MISSING_INPUT' : 'NON_NUMERIC_INPUT',
            )
          return result.value
        },
      )
      return { value, error: null }
    } catch (error) {
      return bad(error instanceof Error ? error.message : 'INVALID_FORMULA')
    }
  }
  if (field.type === 'rollup') {
    if (!stored) return bad('MISSING_RELATIONSHIP')
    const ids = JSON.parse(stored.value) as string[],
      config = configOf(field)
    let total = 0
    for (const id of ids) {
      const result = await evaluate(
        db,
        actor,
        id,
        config.sourceProject ?? projectId,
        config.sourceKey!,
        next,
      )
      if (result.error) return bad(result.error)
      if (typeof result.value !== 'number')
        return bad(
          result.value === null ? 'MISSING_INPUT' : 'NON_NUMERIC_INPUT',
        )
      total += result.value
    }
    return Number.isFinite(total)
      ? { value: Math.round(total * 1e10) / 1e10, error: null }
      : bad('NON_FINITE_RESULT')
  }
  return { value: stored ? JSON.parse(stored.value) : null, error: null }
}
export async function taskFields(
  db: D1Database,
  actor: Actor,
  taskId: string,
  projectId: string,
) {
  const { task, access } = await openTask(db, actor, taskId),
    context = access.contexts.get(projectId)
  if (!context) throw notFound()
  const out = []
  for (const field of await definitions(db, projectId)) {
    if (!fieldReadable(field, context)) continue
    const result = await evaluate(db, actor, taskId, projectId, field.key)
    const raw = await first<{ value: string }>(
      db,
      'SELECT value FROM peg_field_values WHERE task_id=? AND field_id=?',
      taskId,
      field.id,
    )
    const choices: { value: string; label: string }[] = []
    if (field.type === 'people') {
      const ids =
        context.role === 'guest'
          ? raw
            ? (JSON.parse(raw.value) as string[])
            : []
          : (
              await all<{ id: string }>(
                db,
                "SELECT o.id FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=? WHERE o.status='active' AND (o.role IN ('owner','admin') OR m.operator_id IS NOT NULL)",
                task.workspace_id,
              )
            ).map((p) => p.id)
      const names = await displayNames(db, ids)
      choices.push(
        ...ids.map((id) => ({
          value: id,
          label: names.get(id) ?? 'Former member',
        })),
      )
    }
    if (field.type === 'rollup') {
      const source = configOf(field).sourceProject ?? projectId
      for (const row of await projectTaskIds(db, source)) {
        const related = await openTask(db, actor, row.task_id).catch(() => null)
        if (related && related.access.contexts.has(source))
          choices.push({ value: related.task.id, label: related.task.title })
      }
    }
    const display =
      field.type === 'people' && Array.isArray(result.value)
        ? result.value
            .map(
              (id) =>
                choices.find((c) => c.value === id)?.label ?? 'Former member',
            )
            .join(', ')
        : Array.isArray(result.value)
          ? result.value.join(', ')
          : String(result.value ?? 'No value')
    out.push({
      choices,
      display,
      id: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      units: field.units,
      ...result,
      canEdit: context.capabilities.has('edit') && field.type !== 'formula',
      options: configOf(field).options ?? [],
      input:
        result.error === 'INPUT_UNAVAILABLE'
          ? null
          : raw
            ? (JSON.parse(raw.value) as FieldValue)
            : null,
    })
  }
  return out
}
export async function setValues(
  db: D1Database,
  actor: Actor,
  taskId: string,
  projectId: string,
  values: Record<string, unknown>,
) {
  const { task, access } = await openTask(db, actor, taskId),
    context = access.contexts.get(projectId)
  if (!context) throw notFound()
  need(context, 'edit')
  const fields = await definitions(db, projectId),
    statements: D1PreparedStatement[] = []
  for (const [key, value] of Object.entries(values)) {
    const field = fields.find((f) => f.key === key)
    if (!field || !fieldReadable(field, context)) throw notFound()
    const normalized = normalize(field, value)
    if (field.type === 'people' && Array.isArray(normalized))
      for (const id of normalized)
        if (!(await workspaceRole(db, id, task.workspace_id)))
          throw invalid('person_value')
    if (field.type === 'rollup' && Array.isArray(normalized))
      for (const id of normalized) await openTask(db, actor, id)
    statements.push(
      normalized === null
        ? bound(
            db,
            'DELETE FROM peg_field_values WHERE task_id=? AND field_id=?',
            [task.id, field.id],
          )
        : bound(
            db,
            'INSERT INTO peg_field_values VALUES(?,?,?) ON CONFLICT(task_id,field_id) DO UPDATE SET value=excluded.value',
            [task.id, field.id, JSON.stringify(normalized)],
          ),
    )
  }
  if (statements.length)
    await batch(db, [
      ...statements,
      historyStatement(db, task.id, projectId, actor.id, 'fields.changed', {
        keys: Object.keys(values),
      }),
    ])
}
const digest = async (data: unknown) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(data)),
      ),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
export async function changePreview(
  db: D1Database,
  actor: Actor,
  fieldId: string,
  input: Record<string, any>,
) {
  const revision = (await first<{ value: number }>(
    db,
    'SELECT value FROM peg_personal_revision WHERE id=1',
  ))!.value
  const attached = await all<{ project_id: string }>(
    db,
    'SELECT project_id FROM peg_project_fields WHERE field_id=? ORDER BY project_id',
    fieldId,
  )
  if (!attached.length) throw notFound()
  for (const { project_id } of attached)
    need((await openProject(db, actor, project_id)).effective, 'manage_fields')
  const field = (await definitions(db, attached[0].project_id)).find(
      (f) => f.id === fieldId,
    )!,
    next = fieldInput(input, field)
  if (next.key !== field.key) throw invalid('field_key_is_stable')
  const values = await all<{ task_id: string; value: string }>(
    db,
    'SELECT task_id,value FROM peg_field_values WHERE field_id=? ORDER BY task_id',
    fieldId,
  )
  for (const row of values) await openTask(db, actor, row.task_id)
  const incompatible = []
  for (const row of values) {
    try {
      const old = JSON.parse(row.value),
        normalized = normalize(
          { ...field, ...next, config: JSON.stringify(next.config) },
          old,
        )
      if (JSON.stringify(normalized) !== JSON.stringify(old))
        incompatible.push(row.task_id)
    } catch {
      incompatible.push(row.task_id)
    }
  }
  return {
    revision,
    fieldId,
    version: field.version,
    affected: values.length,
    projects: attached.map((x) => x.project_id),
    incompatible,
    canApply: !incompatible.length,
    token: await digest([revision, field, next, values, attached]),
    next,
  }
}
export async function changeDefinition(
  db: D1Database,
  actor: Actor,
  fieldId: string,
  input: Record<string, any>,
) {
  const preview = await changePreview(db, actor, fieldId, input)
  if (input.previewRevision !== preview.token)
    throw conflict('field_preview_required')
  if (!preview.canApply) throw conflict('incompatible_values_preserved')
  const n = preview.next
  // The preview guards every stored value; version fencing prevents competing definition changes.
  try {
    await batch(db, [
      bound(db, 'INSERT INTO peg_personal_guards VALUES(?,?)', [
        newId('guard'),
        preview.revision,
      ]),
      bound(
        db,
        'UPDATE peg_field_definitions SET label=?,type=?,visibility=?,units=?,config=?,version=version+1 WHERE id=? AND version=?',
        [
          n.label,
          n.type,
          n.visibility,
          n.units,
          JSON.stringify(n.config),
          fieldId,
          preview.version,
        ],
      ),
      auditStatement(db, {
        workspaceId: (await first<{ workspace_id: string }>(
          db,
          'SELECT workspace_id FROM peg_field_definitions WHERE id=?',
          fieldId,
        ))!.workspace_id,
        actorId: actor.id,
        action: 'field.changed',
        targetType: 'field',
        targetId: fieldId,
        detail: { type: n.type, affected: preview.affected },
      }),
    ])
  } catch (error) {
    if (String(error).includes('stale_personal_preview'))
      throw conflict('field_preview_required')
    throw error
  }
  return { id: fieldId }
}
