import type {reconcileConversion} from '../../conversion/reconciliation'
import {Card} from '../shell'
type Reconciliation=Awaited<ReturnType<typeof reconcileConversion>>
const labels={tasks:'Work records',comments:'Comments',files:'Files',proofVersions:'Proof versions',timeEntries:'Time entries',aliases:'References',dependencies:'Dependency links',history:'History entries',fields:'Field values',collaborators:'Collaborators'} as const
export function ConversionEvidence({value,names}:{value:Reconciliation;names:Record<string,string>}){
 const name=(id:string)=>names[id]??'Former member'
 return <Card title="Retained evidence"><p>Records keep their original identity, author and project scope. Proof decisions remain on their original version; changed approval work needs a fresh human decision.</p>
  <ul className="rows">{Object.entries(labels).map(([key,label])=><li key={key}>{label}: {value[key as keyof typeof labels]}</li>)}<li>Recorded duration: {value.timeSeconds} seconds</li></ul>
  <details><summary>Inspect retained records</summary>
   <h3>Files</h3><ul className="rows">{value.manifest.files.map(file=><li key={file.id}><span style={{overflowWrap:'anywhere'}}><a href={`/api/v1/attachments/${file.id}`}>Open original file</a> · {file.size} bytes · {name(file.created_by)}<br/>SHA-256 {file.digest}</span></li>)}</ul>
   <h3>Comments and time</h3><ul className="rows">{value.manifest.comments.map(comment=><li key={comment.id}>Comment by {name(comment.authorId)} · <a href={`/app/tasks/${comment.taskId}`}>Original work</a></li>)}{value.manifest.time.map(entry=><li key={entry.id}>{name(entry.personId)} · {entry.seconds??0} seconds · <a href={`/app/tasks/${entry.taskId}`}>Original work</a></li>)}</ul>
   <h3>References and dependencies</h3><ul className="rows">{value.manifest.aliases.map(alias=><li key={alias.ref}><a href={`/app/tasks/${alias.task_id}`}>{alias.ref}</a></li>)}{value.manifest.dependencies.map(edge=><li key={edge.id}><a href={`/app/tasks/${edge.taskId}`}>Work</a> → <a href={`/app/tasks/${edge.otherId}`}>Linked work</a> · {edge.type} · {edge.lag} working days</li>)}</ul>
   <p style={{overflowWrap:'anywhere'}}>Evidence manifest digest: {value.digest}</p>
  </details>
 </Card>
}
