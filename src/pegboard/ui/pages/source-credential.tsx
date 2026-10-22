import { appDocument } from '../../../ui/document.server'
import { AppBar } from '../../../ui/bar'
/** The one place an API source's credential is shown: a no-store page, once, answering the owner's consenting form. */
export function credentialDocument(goalId: string, source: { id: string; expiresAt: number; token?: string }) {
  return appDocument('Numeric API source authorized', <>
    <AppBar />
    <main className="board" id="main"><section className="page"><article className="card note-card" aria-label="New API source credential">
      <h1>API source authorized</h1>
      <p>Save this credential now. It is shown once and stored only as a digest.</p>
      <p><code>{source.token}</code></p>
      <p>It publishes observations to this one goal until <time dateTime={new Date(source.expiresAt).toISOString()}>{new Date(source.expiresAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</time>, and then stops for good. It reads nothing, acts as nobody and sends nothing outward.</p>
      <p>Post <code>{'{key, value, observedAt}'}</code> to <code>/api/v1/metric-sources/{source.id}/events</code> with <code>Authorization: Bearer</code> and this credential.</p>
      <p><a className="button" href={`/app/goals/${goalId}`}>Back to the goal</a></p>
    </article></section></main>
  </>)
}
