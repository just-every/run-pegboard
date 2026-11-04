import type { Viewer } from '../../../ui/viewer'
import type { feedbackView } from '../../proofs/feedback'
import type { internalProof } from '../../records/custody'
import { Shell,Card,Form,Field,Area,Pick,Submit,when } from '../shell'

type View=Awaited<ReturnType<typeof feedbackView>>
export function ProofReviewPage({viewer,view,pdfModule,pdfWorker}:{viewer:Viewer;view:View;pdfModule:string;pdfWorker:string}){
  const here='/app/proof-viewer/'+view.id,api='/api/v1/proofs/'+view.id
  const choices=view.versions.map(v=>({value:v.id,label:`Version ${v.version} · ${v.name}`}))
  const returnTo=here+'?version='+view.documents[0].id+(view.documents[1]?'&compare='+view.documents[1].id:'')
  return <Shell viewer={viewer} current="/app/projects" title="PDF proof review" facts={[view.title,'Internal member review · Feedback grants no approval']}>
    <Card title="Compare retained versions">
      <p><a href={'/app/tasks/'+view.taskId}>Open task</a> · <a href={'/app/proofs/'+view.taskId}>Proof reviews</a></p>
      <form method="get" action={here} className="stack" aria-label="Choose proof versions">
        <Pick label="Review version" name="version" value={view.documents[0].id} options={choices}/>
        <Pick label="Compare version" name="compare" value={view.documents[1]?.id} options={choices} blank="No comparison"/>
        <Submit quiet>Show selected versions</Submit>
      </form>
      <p>Each pin uses page coordinates from the top left, from 0 to 1. Select a page on the rendered PDF or enter its page and coordinates with the keyboard. Old feedback stays with its original bytes.</p>
    </Card>
    <div className="proof-comparison" data-proof-review data-pdf-module={pdfModule} data-pdf-worker={pdfWorker}>
      {view.documents.map(document=>{
        const pins=view.feedback.filter(f=>f.version_id===document.id),token=view.tokens[document.id]
        return <section className="proof-version" key={document.id} aria-label={'Version '+document.version} data-proof-version={document.id} data-proof-digest={document.digest} data-material={api+'/versions/'+document.id+'/material'}>
          <Card title={'Version '+document.version+(document.id===view.currentVersion?' · Current':' · Retained')}>
            <p>{document.name} · {document.pages.length} {document.pages.length===1?'page':'pages'}</p>
            <dl><div><dt>Version identity</dt><dd><code>{document.id}</code></dd></div><div><dt>SHA-256</dt><dd><code>{document.digest}</code></dd></div></dl>
            <a href={api+'/versions/'+document.id+'/material'}>Download retained PDF</a>
            <p role="status" data-pdf-status>Loading verified PDF pages…</p>
            <div data-pdf-pages/>
            <ul hidden data-pdf-pins>{pins.map((pin,i)=><li key={pin.id} data-pin-page={pin.page} data-pin-x={pin.x} data-pin-y={pin.y} data-pin-number={i+1}/>)}</ul>
          </Card>
          <Card title={'Feedback on version '+document.version}>
            {document.canComment?<Form action={api+'/feedback'} next={returnTo} label={'Add feedback to version '+document.version}>
              <input type="hidden" name="versionId" value={document.id}/><input type="hidden" name="token" value={token}/><input type="hidden" name="key" value={crypto.randomUUID()}/>
              <Pick label="Page" name="page" options={document.pages.map((_,i)=>({value:String(i+1),label:'Page '+(i+1)}))}/>
              <Field label="Horizontal coordinate" name="x" type="number" value="0.5" step="any" required/>
              <Field label="Vertical coordinate" name="y" type="number" value="0.5" step="any" required/>
              <Area label="Feedback" name="body"/><Submit>Add pinned feedback</Submit>
            </Form>:<p>You have read access. Comment permission on this version’s file is required to add feedback.</p>}
            {!pins.length&&<p>No feedback on this version.</p>}
            <ol className="rows">{pins.map((pin,i)=><li key={pin.id} data-feedback-id={pin.id}>
              <p><a href={'#pdf-'+document.id+'-'+pin.page}>Pin {i+1} · Page {pin.page}</a> · ({pin.x}, {pin.y}) · {pin.state}</p>
              <p>{view.names[pin.author_id]??'Erased actor'} · {when(pin.created_at)}</p><p className="task-description">{pin.body}</p>
              {pin.canEdit&&<Form action={api+'/feedback/'+pin.id} next={returnTo} label={'Edit pin '+(i+1)+' on version '+document.version}>
                <input type="hidden" name="versionId" value={document.id}/><input type="hidden" name="token" value={token}/><input type="hidden" name="revision" value={pin.revision}/>
                <Area label="Feedback text" name="body" value={pin.body}/><Pick label="Feedback status" name="state" value={pin.state} options={[{value:'open',label:'Open'},{value:'resolved',label:'Resolved'}]}/><Submit quiet>Save feedback</Submit>
              </Form>}
              <details><summary>Version-specific history</summary><ol>{view.history.filter(h=>h.feedback_id===pin.id).map(h=><li key={h.id}>{view.names[h.actor_id]??'Erased actor'} · {when(h.at)} · {h.state}<p className="task-description">{h.body}</p></li>)}</ol></details>
            </li>)}</ol>
          </Card>
        </section>
      })}
    </div>
    <script src="/look/proof-review.js" type="module"/>
  </Shell>
}

export function ProofListPage({viewer,task,proofs,canEdit}:{viewer:Viewer;task:{id:string;title:string;attachments:{id:string;name:string}[]};proofs:Awaited<ReturnType<typeof internalProof>>[];canEdit:boolean}){
 const here='/app/proofs/'+task.id
 return <Shell viewer={viewer} current="/app/projects" title="Proof reviews" facts={[task.title]}><Card title="Reviewed versions">
   {canEdit&&<Form action={'/api/v1/tasks/'+task.id+'/proofs'} next={here} label="Create proof"><Pick label="File to review" name="attachmentId" options={task.attachments.map(a=>({value:a.id,label:a.name}))}/><Submit quiet>Create proof</Submit></Form>}
   {proofs.map(v=><section key={v.proof.id}>
     <p><a href={'/app/proof-viewer/'+v.proof.id}>Review PDF versions</a>{canEdit&&<> · <a href={'/app/approval-routing/'+v.proof.id+'?kind=proof'}>Route proof for review</a></>}</p>
     {canEdit&&v.versions.some(version=>version.id===v.proof.current_version)&&<Form action={'/api/v1/proofs/'+v.proof.id+'/versions'} next={here} label="Add proof version"><input type="hidden" name="currentVersion" value={v.proof.current_version??''}/><Pick label="Replacement file" name="attachmentId" options={task.attachments.map(a=>({value:a.id,label:a.name}))}/><Submit quiet>Add reviewed version</Submit></Form>}
   </section>)}
 </Card></Shell>
}
