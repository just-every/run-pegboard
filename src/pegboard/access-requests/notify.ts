// Delivery of an access request: the inbox first (always available), then email to the same person. Nothing in a
// message carries authority: it links to a signed-in decision page, and a GET never decides anything.
import { batch, bound, newId, now } from '../db'
import type { RequestRow } from '../model'
import { auditStatement } from '../authorization/audit'
import { operatorRow } from '../workspace/people'

import type { operatorMail } from '../../mail.server.mjs'
export type Mailer = NonNullable<ReturnType<typeof operatorMail>>
export interface Delivery { origin: string; from?: string; mail?: Mailer }

const escape = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
const html = (text: string) => `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif">${text.split('\n\n').map(part => `<p>${escape(part)}</p>`).join('')}</body></html>`
export const decisionPath = (requestId: string) => `/app/access-requests/${requestId}`

/** Put the request in each recipient's inbox and email them; the audit row records what reached whom, never the content. */
export async function deliver(db: D1Database, delivery: Delivery, request: RequestRow, kind: 'request' | 'fallback', recipientIds: string[]) {
  for (const id of recipientIds) {
    const operator = await operatorRow(db, id)
    if (!operator) continue
    let channel = 'unavailable'
    if (delivery.mail && delivery.from) {
      // A fallback recipient is told only that an access decision is waiting: no name of the work, no requester detail.
      const text = kind === 'fallback'
        ? `An access request needs a decision.\n\nSign in to review it: ${delivery.origin}${decisionPath(request.id)}`
        : `Someone asked for ${request.level} access.\n\nSign in to review the request and decide: ${delivery.origin}${decisionPath(request.id)}`
      try {
        const result = await delivery.mail.send({ deliveryId: `access-${request.id}-${id}`, from: delivery.from, to: [operator.email], subject: 'Access request waiting for you', text, html: html(text), headers: { 'Auto-Submitted': 'auto-generated' } })
        channel = result?.status ?? 'sent'
      } catch { channel = 'failed' }
    }
    await batch(db, [
      bound(db, 'INSERT INTO peg_inbox(id,operator_id,kind,request_id,created_at) VALUES (?,?,?,?,?)', [newId('inb'), id, kind, request.id, now()]),
      auditStatement(db, { workspaceId: request.workspace_id, actorId: null, action: 'request.delivered', targetType: request.target_type, targetId: request.target_id, subjectId: id, detail: { requestId: request.id, route: kind, inbox: true, email: channel } }),
    ])
  }
}
