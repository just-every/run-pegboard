// Human-readable references (MKT-142): unique in the installation, stable on moves and multi-homing, and every old
// prefix and reference keeps resolving to its task after a prefix change. They never replace the immutable id.
import { all, bound, conflict, first, invalid, now } from '../db'
import {canonicalTask} from '../merge/canonical'
import type { ProjectRow } from '../model'

export const prefixPattern = /^[A-Z][A-Z0-9]{1,7}$/
export const normalizePrefix = (value: unknown): string => {
  const prefix = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (!prefixPattern.test(prefix)) throw invalid('prefix')
  return prefix
}
export const refPattern = /^([A-Z][A-Z0-9]{1,7})-(\d{1,9})$/

/** The statements that issue a task its next reference under the project's prefix; none when the project has no prefix. */
export async function issueRef(db: D1Database, project: ProjectRow, taskId: string, offset=0): Promise<{ ref: string; statements: D1PreparedStatement[] } | null> {
  if (!project.prefix) return null
  const row = await first<{ next_number: number }>(db, 'SELECT next_number FROM peg_ref_prefixes WHERE prefix=?', project.prefix)
  if (!row) return null
  const ref = `${project.prefix}-${row.next_number+offset}`
  return { ref, statements: [
    bound(db, 'UPDATE peg_ref_prefixes SET next_number=next_number+1 WHERE prefix=? AND next_number=?', [project.prefix, row.next_number+offset]),
    bound(db, 'INSERT INTO peg_task_refs(ref,task_id,current,created_at) VALUES (?,?,1,?)', [ref, taskId, now()]),
  ] }
}

/** Set or change a project's prefix. Tasks keep their numbers; the old references stay as aliases of the new ones. */
export async function setPrefix(db: D1Database, project: ProjectRow, value: unknown): Promise<{ prefix: string; statements: D1PreparedStatement[] }> {
  const prefix = normalizePrefix(value)
  if (prefix === project.prefix) throw conflict('prefix_unchanged')
  if (await first(db, 'SELECT 1 FROM peg_ref_prefixes WHERE prefix=?', prefix)) throw conflict('prefix_taken')
  if (!project.prefix) {
    // The first prefix numbers the project's tasks (and their subtasks) that have no reference yet, oldest first.
    const bare = await all<{ id: string }>(db, `WITH RECURSIVE tree(id) AS (SELECT task_id FROM peg_task_projects WHERE project_id=? UNION SELECT t.id FROM peg_tasks t JOIN tree ON t.parent_id=tree.id)
      SELECT t.id FROM tree JOIN peg_tasks t ON t.id=tree.id WHERE NOT EXISTS (SELECT 1 FROM peg_task_refs r WHERE r.task_id=t.id) ORDER BY t.created_at, t.id`, project.id)
    const at = now()
    return { prefix, statements: [
      bound(db, 'INSERT INTO peg_ref_prefixes(prefix,project_id,next_number) VALUES (?,?,?)', [prefix, project.id, bare.length + 1]),
      bound(db, 'UPDATE peg_projects SET prefix=? WHERE id=?', [prefix, project.id]),
      ...bare.map((task, index) => bound(db, 'INSERT INTO peg_task_refs(ref,task_id,current,created_at) VALUES (?,?,1,?)', [`${prefix}-${index + 1}`, task.id, at])),
    ] }
  }
  const old = (await first<{ next_number: number }>(db, 'SELECT next_number FROM peg_ref_prefixes WHERE prefix=?', project.prefix))!
  const refs = await all<{ ref: string; task_id: string }>(db, 'SELECT ref,task_id FROM peg_task_refs WHERE current=1 AND ref LIKE ?', `${project.prefix}-%`)
  const at = now()
  return { prefix, statements: [
    bound(db, 'INSERT INTO peg_ref_prefixes(prefix,project_id,next_number) VALUES (?,?,?)', [prefix, project.id, old.next_number]),
    bound(db, 'UPDATE peg_ref_prefixes SET retired_to=? WHERE prefix=?', [prefix, project.prefix]),
    bound(db, 'UPDATE peg_projects SET prefix=? WHERE id=?', [prefix, project.id]),
    ...refs.flatMap(entry => [bound(db, 'UPDATE peg_task_refs SET current=0 WHERE ref=?', [entry.ref]),
      bound(db, 'INSERT INTO peg_task_refs(ref,task_id,current,created_at) VALUES (?,?,1,?)', [`${prefix}-${entry.ref.slice(entry.ref.indexOf('-') + 1)}`, entry.task_id, at])]),
  ] }
}

/** An id or a reference, current or historical, to the task it names. Access is checked by the caller. */
export async function resolveTaskId(db: D1Database, idOrRef: string): Promise<string | null> {
  if (idOrRef.startsWith('tsk_')) return canonicalTask(db,idOrRef)
  const match = refPattern.exec(idOrRef.trim().toUpperCase())
  if (!match) return null
  const id=(await first<{ task_id: string }>(db, 'SELECT task_id FROM peg_task_refs WHERE ref=?', `${match[1]}-${match[2]}`))?.task_id
  return id?canonicalTask(db,id):null
}
export const currentRef = async (db: D1Database, taskId: string) => (await first<{ ref: string }>(db, 'SELECT ref FROM peg_task_refs WHERE task_id=? AND current=1', taskId))?.ref ?? null
export const aliases = async (db: D1Database, taskId: string) => (await all<{ ref: string }>(db, 'SELECT ref FROM peg_task_refs WHERE task_id=? AND current=0 ORDER BY created_at', taskId)).map(row => row.ref)
