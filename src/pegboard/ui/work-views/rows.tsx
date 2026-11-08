import type { WorkRow } from '../../views/rows'
import { columnValue } from '../../views/rows'
import { Field, Pick, Submit } from '../shell'

export const statusOptions = [{ value: 'todo', label: 'To do' }, { value: 'doing', label: 'Doing' }, { value: 'done', label: 'Done' }]
export const textValue = (value: unknown): string => value === null || value === undefined ? '—' : Array.isArray(value) ? value.join(', ') : String(value)
export const dateValue = (value: string | null) => !value ? 'Undated' : value.length === 10 ? `${value} · date only` : `${value} · UTC time`
export const summary = (row: WorkRow) => `${row.title} · ${row.status} · ${dateValue(row.dueDate)} · ${row.owner.name} · ${row.estimate} h`
const fence = (row: WorkRow, projectId: string) => <><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="revision" value={row.revision}/></>

export function DraftWarning() {
  return <><p data-draft-warning hidden role="alert"/><button className="button quiet" type="button" data-refresh-task hidden>Discard draft and refresh task</button></>
}
export function TaskEdit({ row, projectId }: { row: WorkRow; projectId: string }) {
  if (!row.canEdit) return null
  return <form className="stack work-actions" method="post" action={`/api/v1/work-view-tasks/${row.id}/edit`} aria-label={`Edit ${row.title}`} data-live-edit>
    {fence(row, projectId)}<Field label="Title" name="title" value={row.title} required/>
    <Pick label="Status" name="status" value={row.status} options={statusOptions}/><Submit quiet>Save task</Submit>
  </form>
}
export function DateEdit({ row }: { row: WorkRow }) {
  if (!row.canEdit) return null
  const timed = row.dueDateKind === 'instant'
  return <form className="stack work-actions" method="post" action="/api/v1/schedule/preview" aria-label={`Change due date for ${row.title}`} data-date-edit>
    <input type="hidden" name="taskId" value={row.id}/><input type="hidden" name="dateKind" value={timed ? 'instant' : 'date'}/>
    <Field label={timed ? 'Due time in UTC' : 'Due date'} name="due" type={timed ? 'datetime-local' : 'date'} value={timed ? row.dueDate!.slice(0, 16) : row.dueDate}/>
    <Submit quiet>Preview date change</Submit>
  </form>
}
export function CardMove({ row, projectId, sections }: { row: WorkRow; projectId: string; sections: {id:string;name:string}[] }) {
  if (!row.canEdit || row.parentId || !sections.length) return null
  return <form className="inline work-actions" action={`/api/v1/work-view-tasks/${row.id}/move`} method="post" aria-label={`Move ${row.title}`} data-live-edit>
    {fence(row, projectId)}<Pick label="Move to section" name="sectionId" value={row.section?.id} options={sections.map(section => ({ value: section.id, label: section.name }))}/><Submit quiet>Move card</Submit>
  </form>
}
export function DisplayColumns({ row, columns, labels }: { row: WorkRow; columns: string[]; labels: Map<string,string> }) {
  return <dl className="work-values">{columns.filter(column => column !== 'title').map(column => <div key={column}><dt>{labels.get(column)}</dt><dd>{column === 'dueDate' ? dateValue(row.dueDate) : column === 'startDate' ? dateValue(row.startDate) : textValue(columnValue(row, column))}</dd></div>)}</dl>
}
