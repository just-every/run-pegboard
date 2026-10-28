import type { Bindings } from '../../auth.server'
import { all, bound, conflict, first, forbidden, invalid, newId } from '../db'
import { guarded, revision } from '../decisions/revision'
import { auditStatement } from '../authorization/audit'
import { operatorRow, workspaceRole, type Actor } from '../workspace/people'
import { calendarEdge, type Service } from '../connectors/calendars/edge'
export interface Connection { id: string; workspace_id: string; owner_id: string; owner_version: number; service: Service; calendar_id: string; active: number; revision: number }
export async function calendarAdmin(db: D1Database, actor: Actor, workspace: string) {
 if (actor.apiScope || await workspaceRole(db, actor.id, workspace) !== 'owner') throw forbidden('installation_owner')
}
export async function connectionFor(db: D1Database, actor: Actor, id: string, inactive = false) {
 const row = await first<Connection>(db, 'SELECT * FROM peg_calendar_connections WHERE id=? AND owner_id=?', id, actor.id)
 if (!row) throw forbidden('calendar_owner')
 await calendarAdmin(db, actor, row.workspace_id)
 if ((await operatorRow(db, actor.id))?.version !== row.owner_version || !inactive && !row.active) throw conflict('calendar_connection_ended')
 return row
}
export async function calendarSettings(db: D1Database, actor: Actor, workspace: string) {
 await calendarAdmin(db, actor, workspace)
 return { connections: await all<Connection>(db, 'SELECT * FROM peg_calendar_connections WHERE workspace_id=? AND owner_id=? ORDER BY service,id', workspace, actor.id) }
}
export async function connectCalendar(env: Bindings, db: D1Database, actor: Actor, workspace: string, input: Record<string, any>) {
 await calendarAdmin(db, actor, workspace)
 if (!['google', 'microsoft'].includes(input.service)) throw invalid('calendar_service')
 let calendar = input.calendarId
 if (typeof calendar !== 'string' || !calendar || calendar.length > 512 || /[\r\n\x00]/.test(calendar)) throw invalid('calendar_id')
 if (input.consent !== true && input.consent !== 'on') throw invalid('calendar_consent_required')
 const rev = await revision(db), person = (await operatorRow(db, actor.id))!
 calendar = await calendarEdge(env, input.service, calendar, input.credential).permission()
 await calendarAdmin(db, actor, workspace)
 const old = await first<Connection>(db, 'SELECT * FROM peg_calendar_connections WHERE owner_id=? AND service=? AND calendar_id=?', actor.id, input.service, calendar)
 const id = old?.id ?? newId('calendar')
 await guarded(db, rev, [old ? bound(db, 'UPDATE peg_calendar_connections SET active=1,revision=revision+1,owner_version=? WHERE id=?', [person.version, id])
  : bound(db, 'INSERT INTO peg_calendar_connections(id,workspace_id,owner_id,owner_version,service,calendar_id) VALUES(?,?,?,?,?,?)', [id, workspace, actor.id, person.version, input.service, calendar]),
  auditStatement(db, { workspaceId: null, actorId: actor.id, action: 'calendar.connected', targetType: 'calendar', targetId: id, detail: { service: input.service } })])
 return { id, service: input.service, active: true }
}
export async function disconnectCalendar(db: D1Database, actor: Actor, id: string) {
 await connectionFor(db, actor, id, true)
 await guarded(db, await revision(db), [bound(db, 'UPDATE peg_calendar_connections SET active=0,revision=revision+1 WHERE id=?', [id]), auditStatement(db, { workspaceId: null, actorId: actor.id, action: 'calendar.disconnected', targetType: 'calendar', targetId: id })])
 return { id, active: false }
}
export { digest as taskFingerprint } from '../decisions/revision'
