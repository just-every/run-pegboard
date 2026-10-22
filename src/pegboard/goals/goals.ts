import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { isAdministrator } from '../authorization/levels'
import { openTask } from '../tasks/access'
import { openProject } from '../workspace/projects'
import { workspaceRole, type Actor } from '../workspace/people'
import { dayNumber } from '../tasks/personal'
import { auditStatement } from '../authorization/audit'
import { digest, guarded, revision } from '../decisions/revision'
interface Goal {id:string;workspace_id:string;scope:'company'|'team'|'personal';team_id:string|null;owner_id:string;created_by:string;title:string;kind:'objective'|'key_result';period_start:string;period_end:string;mode:'manual'|'work'|'numeric';unit:string;baseline:number;target:number;manual_percent:number;override_percent:number|null;stale_after_seconds:number;created_at:number;updated_at:number}
interface Link {goal_id:string;source_type:'task'|'project'|'goal';source_id:string;weight:number}
interface Event {goal_id:string;event_key:string;value:number;observed_at:number;received_at:number;actor_id:string}
const finite=(value:unknown)=>{const n=Number(value);if(!Number.isFinite(n))throw invalid('finite_number');return n}
const percent=(value:unknown)=>{const n=finite(value);if(n<0||n>100)throw invalid('percent');return n}
const text=(value:unknown,max:number)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw invalid('text');return value.trim()}
const clamp=(n:number)=>Math.max(0,Math.min(100,n))
async function load(db:D1Database,actor:Actor,id:string) {
  const goal=await first<Goal>(db,'SELECT * FROM peg_goals WHERE id=?',id)
  if(!goal)throw notFound()
  const role=await workspaceRole(db,actor.id,goal.workspace_id)
  if(!role||role==='agent'||(goal.scope==='personal'?goal.owner_id!==actor.id:!isAdministrator(role)))throw notFound()
  return goal
}
async function editable(db:D1Database,actor:Actor,id:string){return load(db,actor,id)}
export async function createGoal(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
  const rev=await revision(db),role=await workspaceRole(db,actor.id,workspace),scope=input.scope??'personal',mode=input.mode??'manual',kind=input.kind??'objective'
  if(!role||role==='agent'||role==='guest')throw forbidden('human_goal_owner')
  if(!['company','team','personal'].includes(scope)||!['manual','work','numeric'].includes(mode)||!['objective','key_result'].includes(kind))throw invalid('goal_type')
  if(scope!=='personal'&&!isAdministrator(role))throw forbidden('workspace_administrator')
  const owner=scope==='personal'?actor.id:String(input.ownerId??actor.id)
  if(!await workspaceRole(db,owner,workspace))throw invalid('owner')
  const teamId=scope==='team'?String(input.teamId??''):null
  if(teamId!==null&&!await first(db,'SELECT 1 FROM peg_teams WHERE id=? AND workspace_id=?',teamId,workspace))throw invalid('team')
  const start=String(input.periodStart??''),end=String(input.periodEnd??'')
  if(dayNumber(end)<dayNumber(start))throw invalid('period')
  const baseline=finite(input.baseline??0),target=finite(input.target??100),staleAfter=Number(input.staleAfterSeconds??604800)
  if(target===baseline||!Number.isSafeInteger(staleAfter)||staleAfter<30||staleAfter>31536000)throw invalid('goal_calculation')
  const id=newId('goal'),at=now()
  await guarded(db,rev,[bound(db,'INSERT INTO peg_goals(id,workspace_id,scope,team_id,owner_id,created_by,title,kind,period_start,period_end,mode,unit,baseline,target,stale_after_seconds,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,workspace,scope,teamId,owner,actor.id,text(input.title,300),kind,start,end,mode,text(input.unit??'percent',80),baseline,target,staleAfter,at,at]),auditStatement(db,{workspaceId:scope==='personal'?null:workspace,actorId:actor.id,action:'goal.created',targetType:'goal',targetId:id,detail:{scope,mode}})])
  return {id}
}
async function source(db:D1Database,actor:Actor,type:Link['source_type'],id:string,workspace:string) {
  if(type==='task'){const opened=await openTask(db,actor,id);if(opened.task.workspace_id!==workspace)throw invalid('source_workspace');return {id:opened.task.id,title:opened.task.title}}
  if(type==='project'){const opened=await openProject(db,actor,id);if(opened.project.workspace_id!==workspace)throw invalid('source_workspace');return {id:opened.project.id,title:opened.project.name}}
  if(type==='goal'){const goal=await load(db,actor,id);if(goal.workspace_id!==workspace)throw invalid('source_workspace');return {id:goal.id,title:goal.title}}
  throw invalid('source_type')
}
async function reaches(db:D1Database,start:string,target:string,seen=new Set<string>()):Promise<boolean>{
  if(start===target)return true
  if(seen.has(start))return false
  seen.add(start);if(seen.size>500)throw invalid('goal_graph_limit')
  for(const row of await all<{source_id:string}>(db,"SELECT source_id FROM peg_goal_links WHERE goal_id=? AND source_type='goal'",start))if(await reaches(db,row.source_id,target,seen))return true
  return false
}
export async function linkGoal(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
  const rev=await revision(db),goal=await editable(db,actor,id),type=input.sourceType as Link['source_type'],sourceId=String(input.sourceId??''),weight=finite(input.weight??1)
  if(weight<=0||weight>1000000)throw invalid('weight')
  await source(db,actor,type,sourceId,goal.workspace_id)
  if(type==='goal'&&await reaches(db,sourceId,id))throw conflict('goal_cycle')
  await guarded(db,rev,[bound(db,'INSERT INTO peg_goal_links VALUES(?,?,?,?) ON CONFLICT(goal_id,source_type,source_id) DO UPDATE SET weight=excluded.weight',[id,type,sourceId,weight]),bound(db,'UPDATE peg_goals SET updated_at=? WHERE id=?',[now(),id])])
  return {id}
}
export async function numericEvent(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
  const rev=await revision(db),goal=await editable(db,actor,id)
  if(goal.mode!=='numeric')throw invalid('numeric_goal_required')
  const key=text(input.key,120),value=finite(input.value),observed=Number(input.observedAt)
  if(!Number.isSafeInteger(observed)||observed<0||observed>now())throw invalid('observation_time')
  const prior=await first<Event>(db,'SELECT * FROM peg_goal_events WHERE goal_id=? AND event_key=?',id,key)
  if(prior){if(prior.value!==value||prior.observed_at!==observed)throw conflict('numeric_event_key_reused');return {id,key,replayed:true}}
  await guarded(db,rev,[bound(db,'INSERT INTO peg_goal_events VALUES(?,?,?,?,?,?)',[id,key,value,observed,now(),actor.id])])
  return {id,key,replayed:false}
}
export async function checkIn(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
  const view=await goalView(db,actor,id),goal=view.goal
  if(input.revision!==view.token)throw conflict('goal_preview_changed')
  const note=text(input.note,5000),at=now(),checkin=newId('checkin'),statements:D1PreparedStatement[]=[]
  const detail:Record<string,unknown>={progress:view.progress}
  if(input.percent!==undefined){
    const n=percent(input.percent)
    if(goal.mode==='manual'){detail.from=goal.manual_percent;detail.to=n;statements.push(bound(db,'UPDATE peg_goals SET manual_percent=?,updated_at=? WHERE id=?',[n,at,id]))}
    else {detail.overrideFrom=goal.override_percent;detail.overrideTo=n;statements.push(bound(db,'UPDATE peg_goals SET override_percent=?,updated_at=? WHERE id=?',[n,at,id]))}
  }
  if(input.clearOverride===true){detail.overrideFrom=goal.override_percent;detail.overrideTo=null;statements.push(bound(db,'UPDATE peg_goals SET override_percent=NULL,updated_at=? WHERE id=?',[at,id]))}
  statements.push(bound(db,'INSERT INTO peg_goal_checkins VALUES(?,?,?,?,?,?)',[checkin,id,actor.id,at,note,JSON.stringify(detail)]))
  await guarded(db,view.rev,statements)
  return {id:checkin}
}
interface Leaf {key:string;percent:number;weight:number;observedAt:number;stale:boolean}
async function leaves(db:D1Database,actor:Actor,goal:Goal,weight:number,found:Map<string,Leaf>,flags:Set<string>,seen:Set<string>) {
  if(seen.has(goal.id)){flags.add('cycle');return}
  const path=new Set(seen).add(goal.id)
  const put=(leaf:Leaf)=>{const prior=found.get(leaf.key);if(!prior||leaf.weight>prior.weight)found.set(leaf.key,leaf)}
  if(goal.mode==='manual'){put({key:`goal:${goal.id}`,percent:goal.override_percent??goal.manual_percent,weight,observedAt:goal.updated_at,stale:now()-goal.updated_at>goal.stale_after_seconds*1000});return}
  if(goal.mode==='numeric'){
    const event=await first<Event>(db,'SELECT * FROM peg_goal_events WHERE goal_id=? ORDER BY observed_at DESC,event_key DESC LIMIT 1',goal.id)
    if(!event){flags.add('missing_numeric_input');return}
    put({key:`goal:${goal.id}`,percent:clamp((event.value-goal.baseline)/(goal.target-goal.baseline)*100),weight,observedAt:event.observed_at,stale:now()-event.observed_at>goal.stale_after_seconds*1000});return
  }
  const links=await all<Link>(db,'SELECT * FROM peg_goal_links WHERE goal_id=? ORDER BY source_type,source_id',goal.id)
  if(!links.length)flags.add('missing_work_input')
  for(const link of links){
    try{
      await source(db,actor,link.source_type,link.source_id,goal.workspace_id)
      if(link.source_type==='goal'){
        const child=await load(db,actor,link.source_id),nested=new Map<string,Leaf>(),nestedFlags=new Set<string>()
        await leaves(db,actor,child,weight*link.weight,nested,nestedFlags,path)
        for(const flag of nestedFlags)flags.add(flag)
        for(const leaf of nested.values())put(child.override_percent!==null&&!nestedFlags.size&&!leaf.stale?{...leaf,percent:child.override_percent}:leaf)
        continue
      }
      const ids=link.source_type==='task'?[link.source_id]:(await all<{id:string}>(db,'WITH RECURSIVE work(id) AS (SELECT task_id FROM peg_task_projects WHERE project_id=? UNION SELECT t.id FROM peg_tasks t JOIN work w ON t.parent_id=w.id) SELECT id FROM work',link.source_id)).map(t=>t.id)
      if(!ids.length)flags.add('missing_work_input')
      for(const id of ids){
        const {task}=await openTask(db,actor,id)
        put({key:`task:${task.id}`,percent:task.status==='done'?100:0,weight:weight*link.weight,observedAt:task.updated_at,stale:false})
      }
    }catch{flags.add('restricted_input')}
  }
}
export async function goalView(db:D1Database,actor:Actor,id:string) {
  const rev=await revision(db),goal=await load(db,actor,id),found=new Map<string,Leaf>(),flags=new Set<string>()
  await leaves(db,actor,goal,1,found,flags,new Set())
  const rows=[...found.values()],total=rows.reduce((n,l)=>n+l.weight,0)
  if(rows.some(l=>l.stale))flags.add('stale_input')
  const links=[]
  for(const link of await all<Link>(db,'SELECT * FROM peg_goal_links WHERE goal_id=? ORDER BY source_type,source_id',id)){
    try{const visible=await source(db,actor,link.source_type,link.source_id,goal.workspace_id);links.push({...link,title:visible.title})}catch{}
  }
  const events=goal.mode==='numeric'?await all<Event>(db,'SELECT * FROM peg_goal_events WHERE goal_id=? ORDER BY observed_at DESC,event_key',id):[]
  const checkins=await all<{id:string;actor_id:string;at:number;note:string;detail:string}>(db,'SELECT * FROM peg_goal_checkins WHERE goal_id=? ORDER BY at,id',id)
  return {goal,links,events,checkins:checkins.map(c=>({...c,detail:flags.has('restricted_input')?{}:JSON.parse(c.detail)})),progress:flags.size||!total?null:goal.override_percent??rows.reduce((n,l)=>n+l.percent*l.weight,0)/total,states:[...flags],sourceCount:rows.length,unit:goal.unit,calculation:goal.mode==='work'?'Weighted completion; each task counts once at its highest linked weight':goal.mode==='numeric'?'(latest observed value - baseline) / (target - baseline) × 100':'Manual percent',freshness:rows.length?Math.min(...rows.map(r=>r.observedAt)):null,overridden:goal.override_percent!==null,rev,token:await digest([goal,rev,links,events,checkins])}
}
export async function listGoals(db:D1Database,actor:Actor,workspace:string) {
  const out=[]
  for(const row of await all<{id:string}>(db,'SELECT id FROM peg_goals WHERE workspace_id=? ORDER BY created_at,id',workspace)){
    try{out.push(await goalView(db,actor,row.id))}catch{}
  }
  return out
}
