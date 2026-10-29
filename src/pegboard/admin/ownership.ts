import { all, conflict, forbidden, invalid } from '../db'
import { digest } from '../decisions/revision'
import { operatorRow, type Actor } from '../workspace/people'

/** Reviewed native role handoff. Base owns fresh proof, session fences and the last-owner guard. */
export async function ownershipPreview(db: D1Database, actor: Actor, person: string, action: unknown) {
  const owner = await operatorRow(db, actor.id), subject = await operatorRow(db, person)
  if (owner?.status !== 'active' || owner.role !== 'owner') throw forbidden('installation_owner')
  if (action !== 'promote' && action !== 'relinquish') throw invalid('ownership_action')
  const owners = await all<{ id: string; name: string; version: number }>(db, "SELECT id,display_name name,version FROM oa_operators WHERE role='owner' AND status='active' ORDER BY id")
  if (action === 'promote') {
    if (subject?.status !== 'active' || subject.role !== 'admin' || subject.id === actor.id) throw conflict('active_administrator_required')
  } else {
    if (person !== actor.id) throw forbidden('own_ownership_only')
    if (owners.length < 2) throw conflict('last_owner')
  }
  const token = await digest({ actor: actor.id, action, ownerVersion: owner.version, person, subjectVersion: subject!.version, owners })
  return { action, person: { id: person, name: subject!.display_name }, owners, token }
}

export async function validateOwnership(db: D1Database, actor: Actor, person: string, input: Record<string, unknown>) {
  const preview = await ownershipPreview(db, actor, person, input.action)
  if (input.token !== preview.token) throw conflict('ownership_review_changed')
  if (input.confirm !== true && input.confirm !== 'on') throw invalid('confirm_ownership')
  return { ...preview, role: preview.action === 'promote' ? 'owner' as const : 'admin' as const }
}
