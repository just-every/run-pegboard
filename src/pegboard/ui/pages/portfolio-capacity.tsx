import type { Viewer } from '../../../ui/viewer'
import type { portfolioCapacity,comparePortfolioCapacity,portfolioCapacityUndoPreview } from '../../capacity/portfolio-plans'
import { Card, Field, Form, Pick, Shell, Submit } from '../shell'

type View=Awaited<ReturnType<typeof portfolioCapacity>>
type Compare=Awaited<ReturnType<typeof comparePortfolioCapacity>>
type Undo=Awaited<ReturnType<typeof portfolioCapacityUndoPreview>>
const hidden=(data:Record<string,unknown>)=>Object.entries(data).map(([name,value])=><input key={name} type="hidden" name={name} value={typeof value==='object'?JSON.stringify(value):String(value??'')}/>)
const person=(view:View,id:string)=>view.people.find(p=>p.id===id)?.name??'Former member'
export function PortfolioCapacityPage({viewer,view,comparison,undo}:{viewer:Viewer;view:View;comparison:Compare|null;undo:Undo|null}) {
 const here='/app/portfolios/'+view.portfolioId+'/capacity',api='/api/v1/portfolios/'+view.portfolioId+'/capacity',period={from:view.from,days:view.days}
 return <Shell viewer={viewer} current="/app/portfolios" title="Portfolio capacity" facts={[view.name,view.projectCount+' readable projects','Human scenarios']}>
  <Card title="Compare human scenarios"><p>Enter two what-if reassignments. These alternatives are entered by a person; no agent generated or ranked them. Dates never move through this door.</p><p><a href={'/app/portfolios/'+view.portfolioId}>Back to portfolio</a> · <a href={'/app/settings/portfolio-capacity?portfolio='+view.portfolioId}>Commitment settings</a></p>{view.limited&&<p role="status">Limited context. Hidden work is not disclosed and feasibility is unverified.</p>}
   <form method="get" action={here} className="stack" aria-label="Compare human scenarios">
    <Field label="First date" name="from" type="date" value={view.from}/><Field label="Days" name="days" type="number" value={view.days}/>
    {[1,2].map(n=><fieldset key={n}><legend>Human scenario {n}</legend><Pick label={'Task for scenario '+n} name={'taskId'+n} value={comparison?.alternatives[n-1].taskId} options={view.tasks.map(t=>({value:t.id,label:t.title+(t.locked?' · Locked':'')}))}/><Pick label={'Alternate for scenario '+n} name={'personId'+n} value={comparison?.alternatives[n-1].personId} options={view.people.map(p=>({value:p.id,label:p.name+(p.skills?' · '+p.skills:'')}))}/></fieldset>)}
    <Submit quiet>Compare alternatives</Submit>
   </form>
  </Card>
  <Card title="Sourced commitments"><p>Shared tasks appear once. Locks preserve the recorded owner and dates in these scenarios.</p><ul className="rows">{view.tasks.map(t=><li key={t.id} data-capacity-source={t.id}><a href={'/app/tasks/'+t.id}>{t.title}</a><span>{person(view,t.ownerId)} · {t.estimateHours} estimate h · {t.start??'Undated'} to {t.due??'Undated'}</span><span>{t.locked?'Locked commitment':'Unlocked'} · Required skills: {t.skills||'Not specified'}</span></li>)}</ul></Card>
  <Card title="Verified current workload"><p>Current committed hours across all workspace work, counted once per person. Other commitments disclose hours only. Unknown availability is not verified capacity.</p><ul className="rows">{view.people.filter(p=>p.hours>0||view.tasks.some(t=>t.ownerId===p.id)).map(p=><li key={p.id} data-current-person={p.id}><strong>{p.name} · {p.zone}</strong><ul className="plain">{p.days.map(d=><li key={d.date}>{d.date}: {d.hours} committed h · {d.availableHours} available h{d.overloadHours>0?' · Overload '+d.overloadHours+' h':''}{d.unknown?' · Unknown availability':''}</li>)}</ul></li>)}</ul></Card>
  {comparison&&<>
   <Card title="Exact human review"><p>Review the affected tasks, people and person-day hours against their current working calendars. A feasible result applies only to the displayed dates and affected people; unknown availability and undated work prevent that claim. Assignment grants no access.</p>{comparison.shortage&&<p role="status">Staffing shortage: neither entered alternative is verified feasible. No automatic reassignment or deadline movement.</p>}
    {comparison.alternatives.map((a,i)=><section key={i} aria-label={'Review scenario '+(i+1)}>
     <h3>Human scenario {i+1}: {a.feasible?'Feasible for this period':'Not verified feasible'}</h3>
     <p><a href={'/app/tasks/'+a.taskId}>{a.title}</a> · {person(view,a.fromPersonId)} → {person(view,a.personId)} · {a.hours} participant-hours transferred</p><p>Dates unchanged: {a.start} to {a.due} · Required skills: {a.skills||'Not specified'}</p>
     <ul className="rows">{a.after.map(p=><li key={p.id}><strong>{p.name} · {p.zone}</strong><span>Before {a.before.find(b=>b.id===p.id)?.hours} h · After {p.hours} h · Available {p.availableHours} h</span><ul className="plain">{p.days.map(d=><li key={d.date}>{d.date}: {d.hours} committed h · {d.availableHours} available h{d.overloadHours>0?' · Overload '+d.overloadHours+' h':''}{d.unknown?' · Unknown availability':''}</li>)}</ul></li>)}</ul>
     <p>Source work, including other visible commitments:</p><ul className="plain">{a.sources.map(t=><li key={t.id}><a href={'/app/tasks/'+t.id}>{t.title}</a> · {t.estimateHours} estimate h · {t.start??'Undated'} to {t.due??'Undated'}</li>)}</ul>
     {a.reasons.map(r=><p key={r} role="status">{r}</p>)}
     {a.feasible&&<Form action={api+'/apply'} next={here+'?'+new URLSearchParams({from:view.from,days:String(view.days)})} label={'Approve scenario '+(i+1)}>{hidden({...period,alternatives:comparison.alternatives.map(a=>({taskId:a.taskId,personId:a.personId})),token:comparison.token,choice:i})}<Submit>Approve scenario {i+1}</Submit></Form>}
    </section>)}
    <h3>Preserved locks</h3><ul className="plain">{comparison.locked.map(t=><li key={t.id}>{t.title} · {person(view,t.ownerId)} · {t.estimateHours} h · {t.start} to {t.due}</li>)}</ul><a href={here+'?'+new URLSearchParams({from:view.from,days:String(view.days)})}>Cancel review</a>
   </Card>
  </>}
  <Card title="Attributed applications">{view.applications.length?<ul className="rows">{view.applications.map(op=><li key={op.id}>Application {op.id} · {person(view,op.actorId)} · {op.undone?'Undone':<a href={here+'?operation='+op.id+'&'+new URLSearchParams({from:view.from,days:String(view.days)})}>Review undo</a>}</li>)}</ul>:<p>No portfolio-capacity changes applied.</p>}</Card>
  {undo&&<Card title="Review selective undo"><p>{undo.title} · {person(view,undo.from)} → {person(view,undo.to)}. Only this reassignment and its effort allocation are reverted. Later text, estimates and dates are retained.</p>{undo.reasons.map(r=><p key={r} role="status">{r}</p>)}{undo.canUndo&&<Form action={api+'/'+undo.id+'/undo'} next={here+'?'+new URLSearchParams({from:view.from,days:String(view.days)})} label="Undo portfolio reassignment">{hidden({token:undo.token})}<Submit>Undo reviewed reassignment</Submit></Form>}</Card>}
 </Shell>
}
export function PortfolioCapacitySettingsPage({viewer,view}:{viewer:Viewer;view:View}) {
 const here='/app/settings/portfolio-capacity?portfolio='+view.portfolioId
 return <Shell viewer={viewer} current="/auth/settings/identity" title="Portfolio commitment settings" facts={[view.name]}>
  <Card title="Capacity requirements and locks"><p>Required skills are comma-separated. A lock prevents changes by this human scenario door. It does not change existing dates or grant authority.</p><a href={'/app/portfolios/'+view.portfolioId+'/capacity'}>Back to Portfolio capacity</a>
   {view.tasks.filter(t=>t.canEdit).map(t=><Form key={t.id} action={'/api/v1/tasks/'+t.id+'/capacity-commitment'} next={here} label={'Commitment for '+t.title}><h3>{t.title}</h3><Field label="Required skills" name="skills" value={t.skills}/><label className="checkbox"><input type="checkbox" name="locked" defaultChecked={t.locked}/>Lock this commitment for capacity plans</label><Submit quiet>Save commitment</Submit></Form>)}
  </Card>
 </Shell>
}
