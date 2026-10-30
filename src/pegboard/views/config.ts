import { invalid } from '../db'
import type { FieldRow } from '../model'

export const modes = ['list', 'board', 'table', 'calendar', 'timeline', 'workload'] as const
export type Mode = typeof modes[number]
export const nativeColumns = ['title', 'status', 'owner', 'dueDate', 'startDate', 'estimate', 'section'] as const
export interface ViewConfig {
  mode: Mode
  filters: { status: string[]; ownerIds: string[]; dueFrom: string | null; dueTo: string | null }
  groupBy: string | null
  sort: { column: string; direction: 'asc' | 'desc' }[]
  columns: string[]
}
export const initialConfig = (): ViewConfig => ({ mode: 'list', filters: { status: [], ownerIds: [], dueFrom: null, dueTo: null }, groupBy: 'section', sort: [], columns: [...nativeColumns] })
export const fieldColumn = (field: Pick<FieldRow, 'id'>) => `field:${field.id}`
export const columnSet = (fields: FieldRow[]) => new Set<string>([...nativeColumns, ...fields.map(fieldColumn)])
export function modeOf(value: unknown): Mode {
  if (!modes.includes(value as Mode)) throw invalid('view_mode')
  return value as Mode
}
function strings(value: unknown, key: string, max = 100): string[] {
  if (!Array.isArray(value) || value.length > max || value.some(item => typeof item !== 'string' || item.length > 150)) throw invalid(key)
  return [...new Set(value)]
}
function date(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw invalid('view_due_range')
  return value
}
/** Only native filters are supported: a stored configuration never encodes hidden custom-field predicates. */
export function parseConfig(input: Record<string, any>, allowed: Set<string>): ViewConfig {
  const base = initialConfig(), raw = input.filters ?? base.filters
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key => !['status', 'ownerIds', 'dueFrom', 'dueTo'].includes(key))) throw invalid('view_filters')
  const status = strings(raw.status ?? [], 'view_status', 3), ownerIds = strings(raw.ownerIds ?? [], 'view_owners')
  if (status.some(value => !['todo', 'doing', 'done'].includes(value))) throw invalid('view_status')
  const dueFrom = date(raw.dueFrom), dueTo = date(raw.dueTo)
  if (dueFrom && dueTo && dueFrom > dueTo) throw invalid('view_due_range')
  const columns = strings(input.columns ?? base.columns, 'view_columns', 100).filter(column => allowed.has(column))
  const groupBy = input.groupBy === undefined ? base.groupBy : input.groupBy
  if (groupBy !== null && typeof groupBy !== 'string') throw invalid('view_group')
  const sort = input.sort ?? []
  if (!Array.isArray(sort) || sort.length > 5 || sort.some(item => !item || typeof item.column !== 'string' || !['asc', 'desc'].includes(item.direction))) throw invalid('view_sort')
  return { mode: modeOf(input.mode ?? base.mode), filters: { status, ownerIds, dueFrom, dueTo }, columns,
    groupBy: groupBy && allowed.has(groupBy) ? groupBy : null,
    sort: sort.filter(item => allowed.has(item.column)).map(item => ({ column: item.column, direction: item.direction })) }
}
/** Prune column selection, grouping and sorting together, without naming rejected columns. */
export function pruneConfig(config: ViewConfig, allowed: Set<string>, owners?: Set<string>): ViewConfig {
  return { ...config, filters: { ...config.filters, ownerIds: owners ? config.filters.ownerIds.filter(id => owners.has(id)) : config.filters.ownerIds },
    columns: config.columns.filter(column => allowed.has(column)),
    groupBy: config.groupBy && allowed.has(config.groupBy) ? config.groupBy : null,
    sort: config.sort.filter(item => allowed.has(item.column)) }
}
