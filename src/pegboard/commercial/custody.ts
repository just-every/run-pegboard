import { all, bound, placeholders } from '../db'
// Exact reviewed redaction retains only the opaque mapping needed to refuse replay.
export async function commercialErasureScope(db: D1Database, person: string | null, projects: string[]) {
  const handoffs = await all<{ id: string; project_id: string | null }>(db, `SELECT id,project_id FROM peg_commercial_handoffs WHERE project_id IN (${placeholders(projects)}) OR (? IS NOT NULL AND (actor_id=? OR instr(commitment,?)>0 OR id IN(SELECT handoff_id FROM peg_commercial_reviews WHERE actor_id=? OR instr(plan,?)>0))) ORDER BY id`, ...projects, person, person, person, person, person)
  const reviews = await all<{ id: string }>(db, `SELECT id FROM peg_commercial_reviews WHERE handoff_id IN (${placeholders(handoffs)}) ORDER BY id`, ...handoffs.map(h => h.id))
  const portals = person ? await all<{ id: string }>(db, 'SELECT id FROM peg_commercial_portals WHERE actor_id=? ORDER BY id', person) : []
  return { handoffs, reviews, portals }
}
export function commercialErasureStatements(db: D1Database, scope: Awaited<ReturnType<typeof commercialErasureScope>>) {
  return [
    ...scope.reviews.map(r => bound(db, 'DELETE FROM peg_commercial_reviews WHERE id=?', [r.id])),
    ...scope.handoffs.map(h => bound(db, "UPDATE peg_commercial_handoffs SET state='erased',commitment='{}',source_revision=NULL,actor_id=NULL WHERE id=?", [h.id])),
    ...scope.portals.map(p => bound(db, "UPDATE peg_commercial_portals SET active=0,actor_id='erased',actor_version=0 WHERE id=?", [p.id])),
  ]
}
