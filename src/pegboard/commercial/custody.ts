import { all, bound, placeholders } from '../db'
// Exact reviewed redaction retains only the opaque mapping needed to refuse replay.
export async function commercialErasureScope(db: D1Database, person: string | null, projects: string[], tasks: string[]) {
  const handoffs = await all<{ id: string; project_id: string | null }>(db, `SELECT id,project_id FROM peg_commercial_handoffs WHERE project_id IN (${placeholders(projects)}) OR id IN (SELECT r.handoff_id FROM peg_commercial_reviews r, json_each(r.plan,'$.project.tasks') t WHERE json_extract(t.value,'$.id') IN (${placeholders(tasks)})) OR (? IS NOT NULL AND (actor_id=? OR instr(commitment,?)>0 OR id IN(SELECT handoff_id FROM peg_commercial_reviews WHERE actor_id=? OR instr(plan,?)>0))) ORDER BY id`, ...projects, ...tasks, person, person, person, person, person)
  const reviews = await all<{ id: string }>(db, `SELECT id FROM peg_commercial_reviews WHERE handoff_id IN (${placeholders(handoffs)}) ORDER BY id`, ...handoffs.map(h => h.id))
  const portals = person ? await all<{ id: string }>(db, 'SELECT id FROM peg_commercial_portals WHERE actor_id=? ORDER BY id', person) : []
  // Shared snapshots must retain every linked participant's hold, including people
  // present only in a reviewed role mapping rather than current work.
  const ids = handoffs.map(h => h.id)
  const people = await all<{ id: string }>(db, `SELECT id FROM oa_operators WHERE id IN (
    SELECT actor_id FROM peg_commercial_handoffs WHERE id IN (${placeholders(ids)})
    UNION SELECT actor_id FROM peg_commercial_reviews WHERE handoff_id IN (${placeholders(ids)})
    UNION SELECT j.atom FROM peg_commercial_handoffs h, json_tree(h.commitment) j WHERE h.id IN (${placeholders(ids)}) AND j.type='text'
    UNION SELECT j.atom FROM peg_commercial_reviews r, json_tree(r.plan) j WHERE r.handoff_id IN (${placeholders(ids)}) AND j.type='text'
  ) ORDER BY id`, ...ids, ...ids, ...ids, ...ids)
  return { handoffs, reviews, portals, people }
}
export function commercialErasureStatements(db: D1Database, scope: Awaited<ReturnType<typeof commercialErasureScope>>) {
  return [
    ...scope.reviews.map(r => bound(db, 'DELETE FROM peg_commercial_reviews WHERE id=?', [r.id])),
    ...scope.handoffs.map(h => bound(db, "UPDATE peg_commercial_handoffs SET state='erased',commitment='{}',source_revision=NULL,actor_id=NULL WHERE id=?", [h.id])),
    ...scope.portals.map(p => bound(db, "UPDATE peg_commercial_portals SET active=0,actor_id='erased',actor_version=0 WHERE id=?", [p.id])),
  ]
}
