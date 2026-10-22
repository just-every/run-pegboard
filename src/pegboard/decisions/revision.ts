import { batch, bound, conflict, first, newId, now } from '../db'
export const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(n => n.toString(16).padStart(2, '0')).join('')
export async function revision(db: D1Database) {
  return { value: (await first<{value:number}>(db, 'SELECT value FROM peg_personal_revision WHERE id=1'))!.value,
    until: (await first<{deadline:number|null}>(db, 'SELECT MIN(expires_at) deadline FROM peg_grants WHERE revoked_at IS NULL AND expires_at>?', now()))!.deadline }
}
export async function guarded(db: D1Database, rev: Awaited<ReturnType<typeof revision>>, statements: D1PreparedStatement[]) {
  try { await batch(db, [bound(db,'INSERT INTO peg_personal_guards VALUES(?,?)',[newId('guard'),rev.value]), bound(db,'INSERT INTO peg_time_authority_guards VALUES(?,?)',[newId('guard'),rev.until]), ...statements]) }
  catch(error) { if(/stale_personal_preview|expired_time_authority|UNIQUE constraint/.test(String(error))) throw conflict('review_changed'); throw error }
}
