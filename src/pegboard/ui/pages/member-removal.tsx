import type { removalPreview } from '../../admin/departure/removal'
import type { Viewer } from '../../../ui/viewer'
import { Card, Check, Form, Pick, Shell, Submit } from '../shell'
type Review = Awaited<ReturnType<typeof removalPreview>>
export function MemberRemovalPage({viewer,review,workspace,receipt}:{viewer:Viewer;review:Review;workspace:string;receipt?:boolean}) {
 const here=`/app/admin/removal/${review.person.id}`
 return <Shell viewer={viewer} current="/app/admin" title={receipt?'Member removed':`Remove ${review.person.name}`} chip={review.person.status.toUpperCase()} facts={['Installation-wide responsibility review']}>
  <Card title={receipt?'Revocation complete':'Review every affected set'}>
   {receipt?<p>Access is inactive. Sessions and keys are revoked, queued authority is canceled and historical authorship remains preserved. <a href="/app/audit">Inspect permanent audit</a></p>:<>
    <p>This removes access across this installation. Existing outside messages stay sent. Replacements receive responsibility, never the departed person’s approval or credentials.</p>
    <p>{review.credentials.sessions} sessions · {review.credentials.keys} keys · {review.credentials.links} sign-in links to revoke</p>
    <Form action={`/api/v1/workspaces/${workspace}/people/${review.person.id}/remove`} next={`${here}?removed=1`} label="Review member removal">
     <input type="hidden" name="token" value={review.token}/>
     {review.affected.map(set=><section key={set.key}><h3>{set.label} · {set.rows.length}</h3>{!!set.rows.length&&<>
      <ul className="rows">{set.rows.map(row=><li key={row.id}><span>{row.label}</span></li>)}</ul>
      <Pick label={`Disposition for ${set.label}`} name={set.key} blank="Choose a disposition" options={set.mode==='stop'?[{value:'stop',label:'Stop; require fresh authorization'}]:set.mode==='unassign'?[{value:'unassign',label:'Explicitly unassign; keep private'}]:[...review.replacements.map(p=>({value:p.id,label:`Transfer to ${p.name}`})),{value:'unassign',label:'Explicitly unassign'}]}/>
     </>}</section>)}
     <Check name="confirm" label="I reviewed every affected set and approve this removal"/><Submit>Remove reviewed member</Submit>
    </Form></>}
  </Card>
 </Shell>
}
