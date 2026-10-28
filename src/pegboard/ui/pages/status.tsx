import type { statusModelState } from '../../status/model'
import type { statusPage } from '../../status/page'
import type { Viewer } from '../../../ui/viewer'
import { Area, Card, Check, Field, Form, Pick, Shell, Submit, when } from '../shell'

type View = Awaited<ReturnType<typeof statusPage>>
const channels = [{value:'in_app',label:'In app'},{value:'slack',label:'Slack'},{value:'teams',label:'Teams'},{value:'nook',label:'Nook'},{value:'email',label:'Email'}]
export function StatusPage({viewer,view,people,model}: {viewer:Viewer;view:View;model:ReturnType<typeof statusModelState>;people:{value:string;label:string}[]}) {
  const here = `/app/${view.type === 'project' ? 'projects' : 'portfolios'}/${view.id}/status`
  const selected = view.selected, content = selected?.content ?? view.correction?.content
  const sources = selected?.sources ?? view.correction?.sources ?? []
  return <Shell viewer={viewer} current={view.type === 'project' ? '/app/projects' : '/app/portfolios'} title={`${view.type === 'project' ? 'Project' : 'Portfolio'} status`} facts={['Drafts stay private until an authorized person reviews and publishes the exact revision.']}>
    <Card title="Status history">
      {view.history.length === 0 && <p>No reviewed publication yet.</p>}
      {view.history.map(revision=><section key={revision.id} id={revision.id}>
        <h3>{revision.content.summary}</h3><p>{revision.content.health.replaceAll('_',' ')} · {revision.content.from} to {revision.content.to} · Published {when(revision.publishedAt)} · Reviewed by {view.names[revision.reviewedBy] ?? 'Former member'}</p>
        {revision.correctsId && <p>Correction of <a href={`#${revision.correctsId}`}>an earlier revision</a></p>}
        {(['highlights','risks','decisions','nextSteps'] as const).map(key=>revision.content[key]&&<p key={key}><strong>{({highlights:'Highlights',risks:'Risks',decisions:'Decisions',nextSteps:'Next steps'})[key]}:</strong> {revision.content[key]}</p>)}
        <ul className="plain">{revision.sources.map(source=><li key={source.id}><a href={source.link}>{source.title}</a></li>)}</ul>
        <ul className="rows">{revision.receipts.map(receipt=><li key={receipt.recipient_id+receipt.channel}>{view.names[receipt.recipient_id] ?? 'Recipient'} · {channels.find(c=>c.value===receipt.channel)?.label} · {receipt.state}{receipt.reason ? ` · ${receipt.reason.replaceAll('_',' ')}` : ''}</li>)}</ul>
        <p><a href={`/app/inbox#status-${revision.id}`}>Open revision discussion</a>{view.manage && <> · <a href={`${here}?corrects=${revision.id}`}>Draft a correction</a></>}</p>
      </section>)}
    </Card>
    {view.announcements.map(scope=><Card key={scope.type+scope.id} title={`${scope.name}: announcements`}>
      <ul className="rows">{scope.rows.map(row=><li key={row.id} id={row.id}><span className="grow">{row.body}<br/><small>{row.authorName} · {when(row.created_at)}{row.parent_id?' · Threaded reply':''}{row.internal_only?' · Internal':''}</small>{row.parent_id&&<p><a href={`#${row.parent_id}`}>Parent announcement</a></p>}</span></li>)}</ul>
      {scope.manage&&<Form action={`/api/v1/announcements/${scope.type}/${scope.id}`} next={here} label={`Publish ${scope.type} announcement`}><Area label="Announcement text" name="body"/><Check label="Internal announcement" name="internalOnly"/><Submit>Publish announcement</Submit></Form>}
      {scope.comment&&scope.rows.length>0&&<Form action={`/api/v1/announcements/${scope.type}/${scope.id}`} next={here} label={`Reply to ${scope.type} announcement`}><Pick label="Announcement to reply to" name="parentId" options={scope.rows.map(row=>({value:row.id,label:row.body.slice(0,100)}))}/><Area label="Announcement reply" name="body"/><Submit quiet>Reply to announcement</Submit></Form>}
    </Card>)}
    {view.manage && <>
      <Card title="On-demand status draft">
        {model.connected ? <><p>Connected model: {model.model}. Only selected source records in the covered window are sent, after your consent. The result is an unpublished draft with no recipients.</p><Form action="/api/v1/status-drafts/generate" next="" label="Request model status draft"><input type="hidden" name="subjectType" value={view.type}/><input type="hidden" name="subjectId" value={view.id}/><div className="inline"><Field label="Draft window starts" name="from" type="date" required/><Field label="Draft window ends" name="to" type="date" required/></div><fieldset><legend>Selected model sources</legend>{view.sources.map(source=><Check key={source.value} label={source.label} name="sourceIds[]" value={source.value}/>)}</fieldset><Check label="Send these selected source records to the approved model processor for this draft" name="modelConsent"/><Submit>Generate private draft</Submit></Form></> : <p>No AI model connected. <a href={model.connectHref}>Connect model</a></p>}
      </Card>
      <Card title="Drafts"><ul className="rows">{view.drafts.map(draft=><li key={draft.id}><a href={`${here}?draft=${draft.id}`}>{draft.content.summary}</a><span>Version {draft.version}{draft.rejection ? ' · Rejected, edit required' : ''}</span></li>)}</ul><a href={here}>Start a separate draft</a></Card>
      <Card title={selected ? 'Edit status draft' : view.correction ? 'Draft a correction' : 'Draft an update'}>
        {selected?.generation && <p>Model draft from {selected.generation.model}, generated at version {selected.generation.version}. Review every sourced assertion and edit or reject it before publishing. A saved edit remains a draft.</p>}
        {selected?.rejection && <p>Rejected: {selected.rejection.reason}. Save an edit before another review.</p>}
        <Form action={selected ? `/api/v1/status-drafts/${selected.id}/save` : '/api/v1/status-drafts'} next="" label="Compose status draft">
          <input type="hidden" name="subjectType" value={view.type}/><input type="hidden" name="subjectId" value={view.id}/>
          {selected && <input type="hidden" name="version" value={selected.version}/>}
          {(selected?.correctsId || view.correction) && <input type="hidden" name="correctsId" value={selected?.correctsId ?? view.correction!.id}/>}
          <Pick label="Health" name="health" value={content?.health} options={['on_track','at_risk','off_track'].map(value=>({value,label:value.replaceAll('_',' ')}))}/>
          <Area label="Status summary" name="summary" value={content?.summary}/>
          <div className="inline"><Field label="Window starts" type="date" name="from" value={content?.from} required/><Field label="Window ends" type="date" name="to" value={content?.to} required/></div>
          <Area label="Highlights" name="highlights" value={content?.highlights}/><Area label="Risks" name="risks" value={content?.risks}/><Area label="Decisions" name="decisions" value={content?.decisions}/><Area label="Next steps" name="nextSteps" value={content?.nextSteps}/>
          <fieldset><legend>Work to cite</legend>{view.sources.map(source=><Check key={source.value} label={source.label} name="sourceIds[]" value={source.value} checked={sources.some(s=>s.id===source.value)}/>)}</fieldset>
          <fieldset><legend>Exact recipients</legend>{people.map(person=><Check key={person.value} label={person.label} name="recipientIds[]" value={person.value} checked={selected?.recipients.some(r=>r.id===person.value)}/>)}</fieldset>
          <fieldset><legend>Channels for selected recipients</legend>{channels.map(channel=><Check key={channel.value} label={channel.label} name="channels[]" value={channel.value} checked={selected ? selected.recipients.some(r=>r.channels.includes(channel.value)) : channel.value==='in_app'}/>)}</fieldset>
          <Check label="Include opted-in internal subscribers in this review" name="includeSubscribers" checked={selected?.includeSubscribers}/>
          <p>Client content needs its own draft and exact recipient review. Exclude private material before selecting a guest.</p><Submit>Save draft</Submit>
        </Form>
        {selected && <><p><a href={`${here}?draft=${selected.id}&review=1`}>Review exact publication</a></p><Form action={`/api/v1/status-drafts/${selected.id}/reject`} next={`${here}?draft=${selected.id}`} label="Reject status draft"><input type="hidden" name="version" value={selected.version}/><Field label="Rejection reason" name="reason" required/><Submit quiet>Reject draft</Submit></Form></>}
      </Card>
      {view.review && <Card title="Review exact publication"><p>Version {view.review.version}. Publishing records your human decision once.</p><h3>{view.review.content.summary}</h3><p>{view.review.content.from} to {view.review.content.to} · {view.review.content.health.replaceAll('_',' ')}</p>{(['highlights','risks','decisions','nextSteps'] as const).map(key=><p key={key}>{view.review!.content[key]}</p>)}<ul>{view.review.sources.map(source=><li key={source.id}>{source.title} · {source.status}</li>)}</ul><ul>{view.review.recipients.map(recipient=><li key={recipient.id}>{people.find(person=>person.value===recipient.id)?.label ?? recipient.id} · {recipient.channels.map(channel=>channels.find(c=>c.value===channel)?.label).join(', ')}</li>)}</ul><Form action={`/api/v1/status-drafts/${view.review.id}/publish`} next={here} label="Publish reviewed revision"><input type="hidden" name="token" value={view.review.token}/><Submit>Approve and publish exact revision</Submit></Form></Card>}
    </>}
    {view.subscription && <Card title="Settings"><Form action={`/api/v1/status-subscriptions/${view.type}/${view.id}`} next={here} label="Status subscription"><Check label="Subscribe to reviewed internal updates" name="enabled" checked={view.subscription.enabled}/>{channels.map(channel=><Check key={channel.value} label={channel.label} name="channels[]" value={channel.value} checked={view.subscription!.channels.includes(channel.value)}/>)}<Submit quiet>Save subscription</Submit></Form></Card>}
  </Shell>
}
