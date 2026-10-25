import type { Viewer } from '../../../ui/viewer'
import type { recoveryList,recoveryPreview } from '../../recovery'
import { Card, Form, Pick, Shell, Submit, when } from '../shell'
type Listing=Awaited<ReturnType<typeof recoveryList>>
type Preview=Awaited<ReturnType<typeof recoveryPreview>>
export function RecoveryPage({viewer,listing,preview}:{viewer:Viewer;listing:Listing;preview:Preview|null}) {
 return <Shell viewer={viewer} current="/app/admin" title="Archive and trash" facts={['Restore retained work with its graph and history']}>
  {preview&&<Card title="Review recovery"><h3>{preview.action} · {preview.label}</h3><p>{preview.preserves}</p><p>{preview.externalLimits}</p>
   {preview.conflicts.length?<ul>{preview.conflicts.map(c=><li key={c}>{c.replaceAll('_',' ')}</li>)}</ul>:<Form action="/api/v1/recovery/apply" next="/app/recovery" label="Confirm recovery">
    {Object.entries({type:preview.type,id:preview.id,action:preview.action,token:preview.token}).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}<Submit>{preview.action==='restore'?'Restore reviewed work':preview.action==='archive'?'Archive reviewed project':'Trash reviewed work'}</Submit>
   </Form>}
  </Card>}
  <Card title="Archive or trash"><form method="get" action="/app/recovery" className="stack" aria-label="Choose recovery work"><Pick label="Work to review" name="target" options={listing.choices} blank="Choose retained work"/><Submit quiet>Preview removal</Submit></form></Card>
  <Card title="Retained work"><p>{listing.retentionDays===null?'Kept until the owner reviews erasure.':`Eligible for owner-reviewed expiry after ${listing.retentionDays} days.`} <a href="/app/data">Published retention policy</a></p>
   <ul className="rows" aria-label="Retained work">{listing.records.map(r=><li key={r.object_type+r.object_id}><span className="grow"><strong>{r.label}</strong><br/>{r.object_type.replaceAll('_',' ')} · {when(r.removed_at)}</span>{r.canRestore&&<a className="button quiet" href={`/app/recovery?type=${r.object_type}&id=${r.object_id}&action=restore`}>Review restore</a>}</li>)}</ul>
   {!listing.records.length&&<p>No retained work is available to you.</p>}
  </Card>
 </Shell>
}
