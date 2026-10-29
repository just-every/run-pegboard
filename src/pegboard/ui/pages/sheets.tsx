import type { Viewer } from '../../../ui/viewer'
import type { sheetSettings, sheetReview } from '../../sheets/exports'
import { Card, Check, Field, Form, Shell, Submit } from '../shell'
type Settings = Awaited<ReturnType<typeof sheetSettings>>
type Review = Awaited<ReturnType<typeof sheetReview>>
const here = '/app/settings/sheets'
const Credential = () => <Field label="One-use Google credential" name="credential" type="password" required />
export function SheetsPage({ viewer, data, review }: { viewer: Viewer; data: Settings; review: Review | null }) {
 return <Shell viewer={viewer} current="/auth/settings/identity" title="Google Sheets exports" facts={['Settings · Owner review · Read-only direction']}>
  <Card title="Choose an export">
   <p><a href="/app/settings">Work settings</a></p>
   <p>Export selected work into a dedicated Google spreadsheet tab. Every send and manual refresh needs a fresh review of the destination, its current recipients and the exact content. Group, domain and public-link audiences are refused because their recipients are unknown.</p>
   <p>Spreadsheet edits never change Pegboard work. A reviewed refresh replaces edits inside the export range. Revoking this Pegboard grant stops future sends; previously exported Google copies and recipient downloads remain outside Pegboard.</p>
   <p>Use an owner-authorized Google credential for this invocation only. It is never saved. Google application registration and live connection qualification remain required before claiming a live integration.</p>
   {data.projects.length ? <Form action="/api/v1/sheets" next={here} label="Configure Sheets export">
    <Field label="Google spreadsheet ID" name="spreadsheetId" required />
    <fieldset><legend>Projects to export</legend><div className="stack">{data.projects.map(p => <Check key={p.id} name="projects[]" value={p.id} label={p.name} />)}</div></fieldset>
    <fieldset><legend>Fields to export</legend><p>Task identity, project identities and deletion state are always included. Every other column requires explicit selection.</p><div className="stack">{data.fields.map(f => <Check key={f.value} name="fields[]" value={f.value} label={f.label} />)}</div></fieldset>
    <Credential /><Check name="consent" label="I authorize this exact project and field scope; no data is sent until reviewed" /><Submit>Configure export</Submit>
   </Form> : <p>No project currently permits export.</p>}
  </Card>
  {review && <Card title={review.state === 'confirmed' ? 'Export confirmed by readback' : review.state === 'review' ? 'Review exact export' : 'Export outcome'} id="sheet-review">
   <p role="status">{review.state === 'review' ? 'Awaiting your exact approval' : review.state}</p>
   {review.destinationName && <><p>Destination: <a href={review.destinationUrl} rel="noreferrer">{review.destinationName}</a></p>
    <p>Export identity: <code>{review.exportId}</code> · Refresh watermark: {review.watermark}</p>
    <h3>Current destination recipients</h3><ul className="rows">{review.audience?.map(a => <li key={a.id}><span>{a.address}</span> <span>{a.role}</span></li>)}</ul>
    <h3>Exact spreadsheet content</h3><p>The first row records the export identity, operation and refresh watermark. The second row contains these column headings. Each remaining row stays mapped to the same task.</p>
    <ol aria-label="Exact export rows" className="rows">{review.values?.map((row, index) => <li key={index}><div className="grow"><strong>Sheet row {index + 1}</strong><dl>{row.map((value, col) => <div key={col}><dt>{index < 2 ? `Column ${col + 1}` : review.columns?.[col]}</dt><dd>{value || 'Empty'}</dd></div>)}</dl></div></li>)}</ol>
   </>}
   {review.state === 'review' && <Form action={`/api/v1/sheet-reviews/${review.id}/send`} next="" label="Send reviewed export"><Credential /><Check name="confirm" label="I approve these exact recipients, destination and content, replacing this export range" /><Submit>Send reviewed export</Submit></Form>}
   {review.state === 'pending' && <Form action={`/api/v1/sheet-reviews/${review.id}/reconcile`} next="" label="Reconcile uncertain export"><p>The response is uncertain. Read back Google before any new reviewed send; this action never writes.</p><Credential /><Submit quiet>Read back outcome</Submit></Form>}
   {['not_applied', 'conflict'].includes(review.state) && <p>No retry was sent. Start a new manual refresh review to inspect and authorize any replacement.</p>}
  </Card>}
  <Card title="Your export grants">
   {!data.exports.length ? <p>No export configured.</p> : <ul className="rows">{data.exports.map(e => <li key={e.id} data-sheet-export={e.id}><div className="grow"><strong>{e.tab_title}</strong><p>Spreadsheet ID: <code>{e.spreadsheet_id}</code></p><p>Status: {e.active ? 'Active' : 'Revoked'} · Last confirmed refresh: {e.watermark ?? 'Never'}</p>
    <p>Projects: {e.projects.map(id => data.projects.find(p => p.id === id)?.name ?? 'Unavailable project').join(', ')}</p><p>Fields: {e.fields.map(id => data.fields.find(f => f.value === id)?.label ?? 'Unavailable field').join(', ')}</p>
    {e.active ? <>{e.pending ? <p><a href={`${here}?review=${e.pending.id}`}>Reconcile uncertain export</a></p> : <Form action={`/api/v1/sheets/${e.id}/reviews`} next="" label={`Review refresh ${e.id}`}><Credential /><Submit quiet>Review manual refresh</Submit></Form>}
     <Form action={`/api/v1/sheets/${e.id}/revoke`} next={here} label={`Revoke export ${e.id}`}><Submit quiet>Revoke grant</Submit></Form></> : <p>Future sends are refused. Previously exported external copies remain.</p>}
   </div></li>)}</ul>}
  </Card>
 </Shell>
}
