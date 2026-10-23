import type { Viewer } from '../../../ui/viewer'
import type { engineeringView } from '../../engineering-links/links'
import { Shell, Card, Form, Field, Area, Pick, Check, Submit, when } from '../shell'
export function EngineeringPage({viewer,data}:{viewer:Viewer;data:Awaited<ReturnType<typeof engineeringView>>}) {
  const next=`/app/engineering/${data.task.id}`
  return <Shell viewer={viewer} current="/app/projects" title="Engineering handoff" facts={['Source indicators never decide business acceptance']}>
    <Card title={data.task.title}><a href={`/app/tasks/${data.task.id}`}>Return to task</a> · <a href="/app/meetings">Review meeting actions</a><p>Business task: {data.task.status}. Launch and business decisions remain human decisions.</p><p>These links are private to the administrator who authorized them. Credentials are used for this request only. Last checked context is a snapshot; refresh to confirm current source access.</p></Card>
    <Card title="Link existing engineering work"><Form action={`/api/v1/tasks/${data.task.id}/engineering`} next={next} label="Link engineering work">
      <Pick label="Engineering service" name="service" options={[{value:'vector',label:'Vector'},{value:'jira',label:'Jira'},{value:'github',label:'GitHub'}]}/>
      <Field label="Jira site origin (Vector uses configured origin)" name="origin" type="url"/>
      <Field label="Source reference (GitHub: owner, repository, issues or pulls, number separated by slashes)" name="locator" required/>
      <Field label="Credential for this request (Jira: base64 email and API token)" name="credential" type="password" required/>
      <Area label="Status ID mapping as JSON (source status to todo, doing or done)" name="mappings" value={'{"open":"todo","closed":"done"}'}/><Area label="Source owner ID to Pegboard person ID mapping as JSON" name="ownerMappings" value={'{}'}/>
      <Pick label="Sync direction" name="direction" options={[{value:'inbound',label:'Source indicator only'},{value:'both',label:'Source indicator and reviewed return update'}]}/>
      <Check label="I authorize reading this source for this task" name="consent"/><Submit>Link work</Submit>
    </Form></Card>
    {data.links.map(link=><Card key={link.id} title={`${link.service} · ${link.locator}`}>
      <a href={link.source_url} rel="noreferrer">Open engineering source</a><p><code>{link.external_id}</code></p>
      <p>{link.state==='current'?`Engineering indicator: ${link.indicator}`:'Source stale or unavailable'}{link.cause?` · ${link.cause}`:''}</p>
      <p>Source status: {link.source_status??'Unavailable'} · Source owner ID: {link.source_owner??'Unavailable'} · Mapped owner ID: {link.mapped_owner??'Unmapped'} · Last checked {when(link.checked_at)}</p>
      <p>Direction: {link.direction==='both'?'Reviewed return updates':'Source indicator only'} · Business task: <a href={`/app/tasks/${data.task.id}`}>Pegboard task</a></p>
      <p>Source backlink: {link.backlink_state}</p>
      {!link.revoked_at&&<><Form action={`/api/v1/engineering/${link.id}/backlink`} next={next} label="Review source backlink"><p>Post only this task URL and an opaque link marker to the engineering source. This exposes the URL to the source audience; Pegboard task access stays unchanged.</p><Field label="Source credential" name="credential" type="password" required/><Check label="Approve publishing this task URL to the source audience" name="confirm"/><Submit quiet>Publish or reconcile backlink</Submit></Form><Form action={`/api/v1/engineering/${link.id}/refresh`} next={next} label={`Refresh ${link.locator}`}><Field label="Source credential" name="credential" type="password" required/><Submit quiet>Refresh source</Submit></Form>
      {link.direction==='both'&&link.state==='current'&&<Form action={`/api/v1/engineering/${link.id}/update`} next={next} label="Review source update"><input type="hidden" name="version" value={link.version}/><Pick label="Reviewed source status ID" name="sourceStatus" options={Object.keys(link.mappings).map(value=>({value,label:value}))}/>{link.service==='jira'&&<Field label="Jira transition ID" name="transitionId" required/>}<Field label="Source credential" name="credential" type="password" required/><Check label="Approve this exact source status change" name="confirm"/><Submit>Apply reviewed update</Submit></Form>}
      <Form action={`/api/v1/engineering/${link.id}/revoke`} next={next} label={`Revoke ${link.locator}`}><Submit quiet>Revoke source grant</Submit></Form></>}
    </Card>)}
  </Shell>
}
