import type { Viewer } from '../../../ui/viewer'
import type { goalView, goalAudiencePreview, goalAudience } from '../../goals/goals'
import { newId } from '../../db'
import { Shell, Card, Form, Field, Pick, Submit, Area, when } from '../shell'
type View=Awaited<ReturnType<typeof goalView>>
type Preview=Awaited<ReturnType<typeof goalAudiencePreview>>
type Audience=Awaited<ReturnType<typeof goalAudience>>
type Option={value:string;label:string}
const fields=(plan:Record<string,any>)=>Object.entries(plan).flatMap(([name,value])=>Array.isArray(value)?value.map(v=><input type="hidden" key={name+v} name={name+'[]'} value={v}/>):<input type="hidden" key={name} name={name} value={String(value)}/>)
export function GoalsPage({viewer,goals,view,people,teams,audience,preview,input}:{viewer:Viewer;goals:View[];view:View|null;people:Option[];teams:Option[];audience:Audience;preview:Preview|null;input:Record<string,any>}) {
  const here=view?`/app/goals/${view.goal.id}`:'/app/goals'
  const current=(type:string)=>audience.filter(g=>g.grantee_type===type).map(g=>g.grantee_id)
  const selected=(name:string,id:string)=>Array.isArray(input[name])?input[name].includes(id):(name==='people'?current('person'):name==='teams'?current('team'):audience.filter(g=>g.editor).map(g=>g.grantee_id)).includes(id)
  return <Shell viewer={viewer} current="/app/goals" title={view?view.goal.title:'Goals'} facts={view?[view.goal.scope,`Accountable owner: ${view.owner}`,`${view.goal.period_start} – ${view.goal.period_end}`]:['Company, team and personal goals']}>
    {!view&&<Card title="Goals you can read"><ul className="rows">{goals.map(v=><li key={v.goal.id}><a href={`/app/goals/${v.goal.id}`}>{v.goal.title}</a><p>{v.goal.scope} · {v.owner} · {v.progress===null?'Needs input':`${Math.round(v.progress)}%`}</p></li>)}</ul></Card>}
    {!view&&!['agent','guest'].includes(viewer.role)&&<Card title="Create a goal"><Form action="/api/v1/goals" next="/app/goals" label="Create a goal"><Field label="Goal title" name="title" required/>
      <Pick label="Scope" name="scope" value="personal" options={[{value:'personal',label:'Personal'},...(['owner','admin'].includes(viewer.role)?[{value:'company',label:'Company'}]:[]),...(teams.length?[{value:'team',label:'Team'}]:[])]}/>
      <Pick label="Team (for a team goal)" name="teamId" options={teams} blank="No team"/>
      <Pick label="Accountable owner (company/team)" name="ownerId" options={people} blank="Me"/>
      <Pick label="Kind" name="kind" options={[{value:'objective',label:'Objective'},{value:'key_result',label:'Key result'}]}/>
      <Field label="Period starts" name="periodStart" type="date" value={new Date().toISOString().slice(0,10)} required/><Field label="Period ends" name="periodEnd" type="date" required/>
      <Pick label="Progress" name="mode" options={[{value:'manual',label:'Manual check-ins'},{value:'work',label:'Linked work'},{value:'numeric',label:'Numeric observations'}]}/><Field label="Unit" name="unit" value="percent"/><Field label="Baseline" name="baseline" type="number" value="0" step="any"/><Field label="Target" name="target" type="number" value="100" step="any"/>
      <p>New company goals are readable by active internal members. Team goals follow current team access. Personal goals start private. Existing goals stay restricted until reviewed.</p><Submit>Create goal</Submit>
    </Form></Card>}
    {view&&<>
      <Card title="Progress and permitted links"><p role="status">{view.progress===null?'Progress unavailable':`${Math.round(view.progress)}%`}{view.states.length?` · ${view.states.map(s=>s.replaceAll('_',' ')).join(' · ')}`:''}</p><p>{view.calculation}</p>{view.sourceCount!==null&&<p>{view.sourceCount} permitted inputs</p>}<ul className="rows">{view.links.map(l=><li key={l.source_type+l.source_id}><a href={`/app/${l.source_type==='project'?'projects':l.source_type==='task'?'tasks':'goals'}/${l.source_id}`}>{l.title}</a></li>)}</ul><p>Each reader's progress uses only work they can open. A restricted input has no title, owner or count.</p></Card>
      <Card title="Check-ins"><ul className="rows">{view.checkins.map(c=><li key={c.id}><p>{c.note}</p><small>{when(c.at)}</small></li>)}</ul>
        {view.canCheckIn&&<Form action={`/api/v1/goals/${view.goal.id}/checkins`} next={here} label="Goal check-in"><input type="hidden" name="revision" value={view.token}/><Area label="Check-in note" name="note"/><Field label={view.goal.mode==='manual'?'Progress percent':'Override percent (optional)'} name="percent" type="number" step="any"/>{view.goal.mode!=='manual'&&<p>An override never turns missing, stale or restricted inputs into success.</p>}<Submit>Record check-in</Submit></Form>}
      </Card>
      {view.canCheckIn&&view.goal.mode==='numeric'&&<Card title="Numeric observation"><Form action={`/api/v1/goals/${view.goal.id}/numeric-events`} next={here} label="Numeric observation"><input type="hidden" name="key" value={newId('observation')}/><Field label={`Observed value (${view.goal.unit})`} name="value" type="number" step="any" required/><Field label="Observed at (UTC)" name="observedAt" type="datetime-local" value={new Date().toISOString().slice(0,16)} required/><Submit>Record observation</Submit></Form></Card>}
      {view.canManage&&<Card title="Manage this goal">
        <Form action={`/api/v1/goals/${view.goal.id}/links`} next={here} label="Link goal work"><Pick label="Link type" name="sourceType" options={['task','project','goal'].map(value=>({value,label:value}))}/><Field label="Linked work ID" name="sourceId" required/><Field label="Weight" name="weight" type="number" value="1" step="any"/><Submit>Link work</Submit></Form>
        <form method="get" action={here} className="stack" aria-label="Preview goal audience"><input type="hidden" name="previewAudience" value="1"/>
          {view.goal.scope!=='personal'&&<Pick label="Accountable owner" name="ownerId" options={people} value={input.ownerId??view.goal.owner_id}/>}
          <Pick label="Visibility" name="visibility" value={input.visibility??view.goal.visibility} options={view.goal.scope==='personal'?[{value:'restricted',label:'Owner and named audience'}]:[{value:'default',label:'Company or team default'},{value:'restricted',label:'Named audience only'}]}/>
          <h3>People who may read</h3>{people.map(p=><label key={p.value} className="checkbox"><input type="checkbox" name="people[]" value={p.value} defaultChecked={selected('people',p.value)}/>{p.label}</label>)}
          <h3>Teams who may read</h3>{teams.map(t=><label key={t.value} className="checkbox"><input type="checkbox" name="teams[]" value={t.value} defaultChecked={selected('teams',t.value)}/>{t.label}</label>)}
          <h3>Named editors</h3>{people.map(p=><label key={p.value} className="checkbox"><input type="checkbox" name="editors[]" value={p.value} defaultChecked={selected('editors',p.value)}/>{p.label}</label>)}
          <p>Editors may check in and record observations. Only managers may link work and change this audience. Guests and agents require their separate reviewed scope.</p><Submit>Preview audience and ownership</Submit>
        </form>
      </Card>}
      {preview&&<Card title="Review newly revealed notes and titles"><p>Confirm the accountable owner and audience only after reviewing this disclosure.</p>{preview.newlyRevealed.length===0?<p>No new readers.</p>:<ul className="rows">{preview.newlyRevealed.map(p=><li key={p.id}><h3>{p.name}</h3><p>Check-in notes: {p.notes.join(' · ')||'None'}</p><p>Permitted linked titles: {p.linkedTitles.join(' · ')||'None'}</p></li>)}</ul>}<Form action={`/api/v1/goals/${view.goal.id}/audience`} next={here} label="Confirm goal audience">{fields(preview.plan)}<input type="hidden" name="revision" value={preview.token}/><Submit>Confirm reviewed goal audience</Submit></Form></Card>}
    </>}
  </Shell>
}
