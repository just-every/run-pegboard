import type { WorkRow } from '../../views/rows'
import { columnValue } from '../../views/rows'
import { DateEdit, DraftWarning, TaskEdit, dateValue, summary, textValue } from '../work-views/rows'

export function WorkTable({ rows, columns, availableColumns, projectId }: { rows: WorkRow[]; columns: string[]; availableColumns: { id:string; label:string }[]; projectId:string }) {
  const labels = new Map(availableColumns.map(column => [column.id, column.label]))
  return <div className="work-table-scroll" role="region" aria-label="Task spreadsheet" tabIndex={0}><table className="work-table">
    <caption>Tasks · edit a cell, then save or review its date changes</caption>
    <thead><tr>{columns.map(column => <th key={column} scope="col">{labels.get(column)}</th>)}<th scope="col">Edit</th></tr></thead>
    <tbody>{rows.map(row => <tr className="work-row" key={row.id} data-work-row={row.id} data-revision={row.revision}>
      {columns.map(column => <td key={column} data-column={column}>{column === 'title' ? <a href={`/app/tasks/${row.id}`}>{row.title}</a> : column === 'dueDate' ? <><span>{dateValue(row.dueDate)}</span><DateEdit row={row}/></> : column === 'startDate' ? dateValue(row.startDate) : textValue(columnValue(row, column))}</td>)}
      <td><p data-summary>{summary(row)}</p><TaskEdit row={row} projectId={projectId}/>{row.canEdit && <DraftWarning/>}</td>
    </tr>)}</tbody>
  </table>{rows.length === 0 && <p>No permitted tasks match these filters.</p>}</div>
}
