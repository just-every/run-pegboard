import type { Viewer } from '../../../ui/viewer'
import { Card, Shell, Form, Field, Area, Pick, Submit, when } from '../shell'
import type { listMessages, readMessageDraft, reviewMessage, readMessage } from '../../messages/messages'
type Listing=Awaited<ReturnType<typeof listMessages>>
type Draft=Awaited<ReturnType<typeof readMessageDraft>>
type Review=Awaited<ReturnType<typeof reviewMessage>>
type Thread=Awaited<ReturnType<typeof readMessage>>
export function MessagesPage({viewer,list}:{viewer:Viewer;list:Listing}) {
 return <Shell viewer={viewer} current="/app/projects" title="Project Messages" facts={[list.projectName]}>
  <Card title="Announcements"><p><a href={'/app/projects/'+list.projectId}>Back to project</a></p><ul className="rows">{list.publications.map(p=><li key={p.id}><a href={'/app/messages/'+p.id}>{p.subject}</a></li>)}{!list.publications.length&&<li>No announcements for you.</li>}</ul></Card>
  {list.canPublish&&<Card title="Drafts"><p><a className="button quiet" href={'/app/projects/'+list.projectId+'/messages/new'}>Compose announcement</a></p><ul className="rows">{list.drafts.map(d=><li key={d.id}><a href={'/app/message-drafts/'+d.id}>{d.subject}</a></li>)}</ul></Card>}
 </Shell>
}
export function MessageCompose({viewer,projectId,projectName,draft,people,work,review,correction}:{viewer:Viewer;projectId:string;projectName:string;draft:Draft|null;people:{value:string;label:string}[];work:{value:string;label:string}[];review:Review|null;correction:Thread|null}) {
 const previous=correction?.publications.find(p=>p.id===correction.latestId),corrects=draft?.corrects_id??previous?.id
 return <Shell viewer={viewer} current="/app/projects" title={review?'Review exact announcement':'Compose announcement'} facts={[projectName,'Human-authored text · Internal participants only']}>
  <Card title={review?'Exact content and audience':'Announcement draft'}>
   <p><a href={'/app/projects/'+projectId+'/messages'}>Project Messages</a></p>
   {review?<>
    <h3>{review.subject}</h3><p className="message-text">{review.body}</p>
    <h3>Reviewed recipients</h3><ul className="rows">{review.audience.map(p=><li key={p.id} data-recipient-id={p.id}>{p.name}</li>)}</ul>
    <h3>Linked work</h3><ul className="rows">{review.links.map((s:any)=><li key={s.id}><a href={'/app/tasks/'+s.id}>{s.title}</a></li>)}</ul>
    {corrects&&<p>Attributable correction to <a href={'/app/messages/'+corrects}>the previous publication</a>. It remains in history.</p>}
    <Form action={'/api/v1/message-drafts/'+review.id+'/publish'} next={'/app/message-drafts/'+review.id} label="Publish exact announcement"><input type="hidden" name="token" value={review.token}/><label className="checkbox"><input type="checkbox" name="confirm" value="true" required/>I reviewed this exact text, work and audience</label><Submit>Publish announcement</Submit></Form>
    <p><a href={'/app/message-drafts/'+review.id}>Return to draft</a></p>
   </>:<Form action={draft?'/api/v1/message-drafts/'+draft.id+'/save':'/api/v1/projects/'+projectId+'/messages'} next="/app" label="Save announcement draft">
    {draft&&<input type="hidden" name="version" value={draft.version}/>}{corrects&&<input type="hidden" name="correctsId" value={corrects}/>}
    <Field label="Subject" name="subject" required value={draft?.subject??previous?.subject}/><Area label="Announcement body" name="body" value={draft?.body??previous?.body}/>
    <label className="field">Reviewed audience<select className="select" name="recipients[]" multiple required defaultValue={draft?.recipients??previous?.recipients??[]}>{people.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
    <label className="field">Work links<select className="select" name="linkIds[]" multiple defaultValue={(draft?.links??previous?.links??[]).map((s:any)=>s.id)}>{work.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
    <Submit>Save draft</Submit>
   </Form>}
   {draft&&!review&&<Form action={'/api/v1/message-drafts/'+draft.id+'/review'} next={'/app/message-drafts/'+draft.id+'?review=true'} label="Review announcement"><Submit>Review exact announcement</Submit></Form>}
  </Card>
 </Shell>
}
export function MessageThread({viewer,view,replyKey}:{viewer:Viewer;view:Thread;replyKey:string}) {
 const latest=view.publications.find(p=>p.id===view.latestId)!,path='/app/messages/'+view.id
 return <Shell viewer={viewer} current="/app/projects" title={latest.subject} facts={[view.projectName,'Immutable announcement history']}>
  <Card title="Announcement"><p><a href={'/app/projects/'+view.projectId+'/messages'}>Project Messages</a></p>
   {view.publications.map(p=><section key={p.id} data-publication-id={p.id}><h3>{p.corrects_id?'Correction: ':''}{p.subject}</h3><p className="message-text">{p.body}</p><p>Published by {p.authorName} · {when(p.published_at)}</p><ul className="rows">{p.links.map((s:any)=><li key={s.id}><a href={s.href}>{s.title}</a></li>)}</ul></section>)}
   {view.canPublish&&<p><a href={'/app/projects/'+view.projectId+'/messages/new?corrects='+view.latestId}>Write a correction</a></p>}
  </Card>
  <Card title="Thread preferences"><Form action={'/api/v1/messages/'+view.id+'/preferences'} next={path} label="Thread preferences"><input type="hidden" name="token" value={view.token}/><Pick label="Follow thread" name="following" value={String(view.preferences.following)} options={[{value:'true',label:'Following'},{value:'false',label:'Not following'}]}/><Pick label="Thread notices" name="muted" value={String(view.preferences.muted)} options={[{value:'false',label:'Inbox notices on'},{value:'true',label:'Muted'}]}/><Submit quiet>Save thread preferences</Submit></Form><p>Mentions never add recipients. Muting hides this thread’s Inbox notices.</p></Card>
  <Card title="Replies">
   {view.comments.map(c=><section key={c.id} id={c.id} data-comment-id={c.id}><p>{c.parent_id?'Reply to '+c.parent_id+' · ':''}{c.authorName} · {when(c.updated_at)} · Revision {c.revision}</p><p className="message-text">{c.deleted_at?'Reply deleted':c.body}</p>
    <details><summary>Revision history</summary>{view.history.filter(h=>h.comment_id===c.id).map(h=><p key={h.revision}>Revision {h.revision} · {when(h.at)} · {h.authorName}: {h.deleted_at?'Deleted':h.body}</p>)}</details>
    {view.canReply&&c.editable&&<Form action={'/api/v1/messages/'+view.id+'/replies/'+c.id} next={path+'#'+c.id} label={'Revise reply '+c.id}><input type="hidden" name="token" value={view.token}/><input type="hidden" name="revision" value={c.revision}/><Area label="Revised reply" name="body" value={c.body}/><Pick label="Change" name="action" options={[{value:'edit',label:'Edit reply'},{value:'delete',label:'Delete reply'}]}/><Submit quiet>Save reply revision</Submit></Form>}
   </section>)}
   {view.canReply?<Form action={'/api/v1/messages/'+view.latestId+'/replies'} next={path} label="Reply to announcement"><input type="hidden" name="token" value={view.token}/><input type="hidden" name="key" value={replyKey}/><Pick label="Reply to" name="parentId" blank="Announcement" options={view.comments.filter(c=>!c.deleted_at).map(c=>({value:c.id,label:c.body.slice(0,90)}))}/><Area label="Reply body" name="body"/><Submit>Post reply</Submit></Form>:<p>Your current access is read-only.</p>}
  </Card>
 </Shell>
}
