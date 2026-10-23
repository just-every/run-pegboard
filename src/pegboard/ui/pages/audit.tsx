import { Card, Field, Shell, when } from '../shell'
import type { Viewer } from '../../../ui/viewer'
import type { searchAudit } from '../../audit/search'
export function AuditPage({viewer,data,input}:{viewer:Viewer;data:Awaited<ReturnType<typeof searchAudit>>;input:Record<string,string>}) {
  const params=new URLSearchParams(input)
  return <Shell viewer={viewer} current="/app/audit" title="Permanent audit" facts={['Append-only records','opaque identities','UTC']}>
    <Card title="Find an event">
      <p>Task activity can contain work details. This permanent audit records actions and results without names, addresses, credentials or file bodies. Erased actors retain an opaque identity.</p>
      <form method="get" action="/app/audit" className="stack" aria-label="Search audit">
        <div className="grid"><Field label="Exact action" name="action" value={input.action}/><Field label="Actor ID" name="actor" value={input.actor}/><Field label="Subject ID" name="subject" value={input.subject}/></div>
        <button className="button primary">Search audit</button>
      </form>
      <p><a className="button quiet" href={'/api/v1/admin/audit/export?'+params}>Export this page as JSON</a> <a href="/app/data">Data settings</a></p>
    </Card>
    <Card title="Recorded events"><ol className="rows history" aria-label="Permanent audit events">{data.events.map(row=><li key={row.id}><span className="grow"><strong>{row.action}</strong> · {row.result}<br/><small>{when(row.at)} · Event {row.id}</small><br/>Actor: <code>{row.actor}</code><br/>Subject: <code>{row.target_type} {row.target_id}</code></span></li>)}</ol>{!data.events.length&&<p>No events match these filters.</p>}{data.next&&<p><a className="button quiet" href={'/app/audit?'+new URLSearchParams({...input,after:String(data.next)})}>Next events</a></p>}</Card>
  </Shell>
}
