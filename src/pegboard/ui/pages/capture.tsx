import type { Viewer } from '../../../ui/viewer'
import type { captureOptions,captureView } from '../../capture/browser'
import { Card,Form,Pick,Shell,Submit } from '../shell'
type View=Awaited<ReturnType<typeof captureView>>
export function CapturePage({viewer,view,options,cancelled=false}:{viewer:Viewer;view:View|null;options:Awaited<ReturnType<typeof captureOptions>>;cancelled?:boolean}) {
 const here=view?'/app/capture/'+view.id:'/app/capture'
 return <Shell viewer={viewer} current="/app/projects" title="Capture a page" facts={['Selected content only · Review before creating work']}>
  <Card title={view?'Review captured content':'Connect the capture extension'}>
   <p id="capture-status" role="status">{cancelled?'Capture cancelled. No task was created.':!view?'Click the Pegboard extension here to connect this signed-in tab. Then select text on a source page and click the extension there. Keep both tabs open until you confirm.':'Captured content is untrusted plain text. Nothing runs or grants access.'}</p>
   <p id="capture-error" role="alert" hidden/>
   {view&&view.state==='created'?<a href={'/app/tasks/'+view.taskId}>Open captured task</a>:view&&<>
    <h3 data-capture-title>{view.title}</h3><p><a href={view.url} target="_blank" rel="noopener noreferrer">Source page</a></p>
    <p className="task-description" data-capture-excerpt>{view.excerpt||'No text selected'}</p>
    <p>Source identity <code>{view.sourceId}</code></p>
   </>}
  </Card>
  {view&&view.state==='pending'&&<>
   <Card title="Choose the destination">
    <form method="get" action={here} className="stack" aria-label="Choose capture project"><Pick label="Project" name="projectId" value={options.projects.some(p=>p.value===view.projectId)?view.projectId:undefined} blank="My tasks: private" options={options.projects}/><Submit quiet>Choose project</Submit></form>
    <Form action={'/api/v1/captures/'+view.id+'/review'} next={here} label="Review capture destination">
     <input type="hidden" name="projectId" value={view.projectId??''}/>
     <Pick label="Owner" name="ownerId" value={view.ownerId??viewer.displayName} options={options.people}/>
     <Submit quiet>Review destination</Submit>
    </Form>
   </Card>
   {view.target&&<Card title="Confirm this task">
    <dl><dt>Project</dt><dd>{view.target.name}</dd><dt>Owner</dt><dd>{options.people.find(p=>p.value===view.ownerId)?.label??'Unavailable'}</dd><dt>Visibility</dt><dd>{view.target.visibility}</dd><dt>Attribution</dt><dd>Created by {viewer.displayName}</dd></dl>
    <p>The extension rechecks your source tab and selected text. A changed page or lost permission requires a new capture.</p>
    <form method="post" action={'/api/v1/captures/'+view.id+'/confirm'} className="stack" aria-label="Confirm captured task" data-capture-source={view.sourceId}>
     <input type="hidden" name="reviewToken" value={view.reviewToken??''}/><input type="hidden" name="proof" value=""/>
     <Submit>Create captured task</Submit>
    </form><noscript>Enable JavaScript and the extension to confirm source access.</noscript>
   </Card>}
   <Card><Form action={'/api/v1/captures/'+view.id+'/cancel'} next="/app/capture?cancelled=1" label="Cancel capture"><Submit quiet>Cancel capture</Submit></Form></Card>
  </>}
  <script src="/capture.js" defer/>
 </Shell>
}
