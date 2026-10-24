import type { Bindings } from '../../auth.server'
import { all, first, run, newId, now, invalid, forbidden, notFound, conflict, PegError } from '../db'
import type { Actor } from '../workspace/people'
import { workspaceRole, workspaceSettings } from '../workspace/people'
import { openTask, require as requireTask } from '../tasks/access'
import { provider, target, type Target } from '../connectors/engineering/edge'
interface Link { id: string; task_id: string; created_by: string; service: Target['service']; origin: string; locator: string; external_id: string; source_url: string; source_status: string | null; source_owner: string | null; source_version: string | null; mappings: string; owner_mappings: string; mapped_owner: string | null; pending_status: string | null; backlink_state: string; direction: string; indicator: string | null; state: string; cause: string | null; checked_at: number | null; revoked_at: number | null; version: number }
async function authority(db: D1Database, actor: Actor, taskId: string) {
  const {task, access} = await openTask(db, actor, taskId)
  if (!['owner','admin'].includes(await workspaceRole(db, actor.id, task.workspace_id) ?? '')) throw forbidden()
  requireTask(access, 'edit')
  if (!(await workspaceSettings(db, task.workspace_id)).integrationsEnabled) throw forbidden()
  return task
}
const mapped = (json: string, key: string | null) => key && Object.hasOwn(JSON.parse(json), key) ? JSON.parse(json)[key] as string : null
const view = (l: Link) => ({ ...l, mappings: JSON.parse(l.mappings) as Record<string,string>, ownerMappings: JSON.parse(l.owner_mappings) as Record<string,string> })
async function owned(db: D1Database, actor: Actor, id: string) {
  const l = await first<Link>(db, 'SELECT * FROM peg_engineering_links WHERE id=? AND created_by=?', id, actor.id)
  if (!l) throw notFound()
  await authority(db, actor, l.task_id)
  return l
}
export async function engineeringView(db: D1Database, actor: Actor, taskId: string) {
  const task = await authority(db, actor, taskId)
  return { task: {id:task.id,title:task.title,status:task.status}, links: (await all<Link>(db, 'SELECT * FROM peg_engineering_links WHERE task_id=? AND created_by=? ORDER BY id', task.id, actor.id)).map(view) }
}
function mappings(input: unknown) {
  let value: any
  try { value = typeof input === 'string' ? JSON.parse(input) : input } catch { throw invalid('engineering_mapping_invalid') }
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length > 30 || !Object.keys(value).length || Object.entries(value).some(([k,v]) => !k || k.length > 100 || !['todo','doing','done'].includes(String(v)))) throw invalid('engineering_mapping_invalid')
  return JSON.stringify(value)
}
export async function linkEngineering(db: D1Database, env: Bindings, actor: Actor, taskId: string, input: Record<string,any>) {
  const task = await authority(db,actor,taskId), t=target(env,input), map=mappings(input.mappings)
  if (input.consent !== true && input.consent !== 'on') throw invalid('engineering_consent_required')
  if (!['inbound','both'].includes(input.direction)) throw invalid('engineering_direction_invalid')
  let owners: Record<string,string>
  try { owners=typeof input.ownerMappings==='string'?JSON.parse(input.ownerMappings):input.ownerMappings??{} } catch {throw invalid('engineering_owner_mapping_invalid')}
  if(!owners || Array.isArray(owners) || typeof owners!=='object' || Object.keys(owners).length>30)throw invalid('engineering_owner_mapping_invalid')
  for(const [sourceOwner,person] of Object.entries(owners)){if(!sourceOwner || sourceOwner.length>256 || typeof person!=='string' || !await workspaceRole(db,person,task.workspace_id))throw invalid('engineering_owner_mapping_invalid')}
  const previous=await first<Link>(db,'SELECT * FROM peg_engineering_links WHERE task_id=? AND created_by=? AND service=? AND origin=? AND locator=?',task.id,actor.id,t.service,t.origin,t.locator)
  const source = previous ? await readSource(db,env,actor,previous,input.credential) : await provider(env,t,input.credential).read()
  await authority(db,actor,task.id)
  const existing = await first<Link>(db,'SELECT * FROM peg_engineering_links WHERE task_id=? AND created_by=? AND service=? AND origin=? AND external_id=?',task.id,actor.id,t.service,t.origin,source.id)
  if (existing) return view(existing)
  const id=newId('eng'), indicator=mapped(map,source.status)
  await run(db,`INSERT INTO peg_engineering_links(id,task_id,created_by,service,origin,locator,external_id,source_url,source_status,source_owner,source_version,mappings,owner_mappings,mapped_owner,direction,indicator,state,cause,checked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(task_id,created_by,service,origin,external_id) DO NOTHING`,id,task.id,actor.id,t.service,t.origin,t.locator,source.id,source.url,source.status,source.owner,source.version,map,JSON.stringify(owners),mapped(JSON.stringify(owners),source.owner),input.direction,indicator,indicator?'current':'stale',indicator?null:'unmapped_source_status',now())
  return view((await first<Link>(db,'SELECT * FROM peg_engineering_links WHERE task_id=? AND created_by=? AND service=? AND origin=? AND external_id=?',task.id,actor.id,t.service,t.origin,source.id))!)
}
async function invalidateSource(db: D1Database, actor: Actor, l: Link, error: unknown) {
  if (!(error instanceof PegError) || !['engineering_source_refused','engineering_source_unavailable','engineering_source_incomplete','engineering_source_identity_changed'].includes(error.code)) return false
  await owned(db,actor,l.id)
  const refused=error.code==='engineering_source_refused'
  await run(db,`UPDATE peg_engineering_links SET source_status=NULL,source_owner=NULL,source_version=NULL,mapped_owner=NULL,indicator=NULL,state='stale',cause=?,revoked_at=?,version=version+1 WHERE id=? AND version=? AND revoked_at IS NULL`,error.code,refused?now():null,l.id,l.version)
  return true
}
async function checkedSourceRead<T>(db: D1Database, actor: Actor, l: Link, read: () => Promise<T>) {
  try {
    return await read()
  } catch(error) {
    await invalidateSource(db,actor,l,error)
    throw error
  }
}
async function readSource(db: D1Database, env: Bindings, actor: Actor, l: Link, credential: unknown) {
  return checkedSourceRead(db,actor,l,async()=>{
    const source=await provider(env,l,credential).read()
    if(source.id!==l.external_id)throw conflict('engineering_source_identity_changed')
    return source
  })
}
export async function refreshEngineering(db: D1Database, env: Bindings, actor: Actor, id: string, input: Record<string,any>) {
  const l=await owned(db,actor,id)
  if (l.revoked_at) throw conflict('engineering_link_revoked')
  try {
    const source=await provider(env,l,input.credential).read()
    await owned(db,actor,id)
    if (source.id!==l.external_id) throw conflict('engineering_source_identity_changed')
    const indicator=mapped(l.mappings,source.status)
    await run(db,`UPDATE peg_engineering_links SET source_status=?,source_owner=?,source_version=?,mapped_owner=?,indicator=?,state=?,cause=?,checked_at=?,pending_status=NULL,version=version+1 WHERE id=? AND version=? AND revoked_at IS NULL`,source.status,source.owner,source.version,mapped(l.owner_mappings,source.owner),indicator,l.pending_status&&source.status!==l.pending_status?'stale':indicator?'current':'stale',l.pending_status&&source.status!==l.pending_status?'reviewed_update_not_confirmed':indicator?null:'unmapped_source_status',now(),id,l.version)
  } catch(error) {
    if (!await invalidateSource(db,actor,l,error)) throw error
  }
  return view(await owned(db,actor,id))
}
export async function revokeEngineering(db: D1Database, actor: Actor, id: string) {
  const l=await owned(db,actor,id)
  await run(db,`UPDATE peg_engineering_links SET revoked_at=COALESCE(revoked_at,?),source_status=NULL,source_owner=NULL,source_version=NULL,mapped_owner=NULL,indicator=NULL,state='stale',cause='source_grant_revoked',version=version+1 WHERE id=?`,now(),l.id)
  return view(await owned(db,actor,id))
}
export async function updateEngineering(db: D1Database, env: Bindings, actor: Actor, id: string, input: Record<string,any>) {
  const l=await owned(db,actor,id)
  if(l.revoked_at || l.state!=='current' || l.direction!=='both')throw conflict('engineering_update_not_authorized')
  if(String(l.version)!==String(input.version))throw conflict('engineering_review_stale')
  if(input.confirm!==true && input.confirm!=='on')throw invalid('engineering_exact_review_required')
  const status=String(input.sourceStatus??'')
  if(!Object.hasOwn(JSON.parse(l.mappings),status))throw conflict('engineering_status_unmapped')
  const edge=provider(env,l,input.credential), source=await readSource(db,env,actor,l,input.credential)
  const current=await owned(db,actor,id)
  if(current.version!==l.version || current.revoked_at || source.id!==l.external_id || source.version!==l.source_version)throw conflict('engineering_review_stale')
  if(l.service==='github' && (!l.locator.includes('/issues/') || !['open','closed'].includes(status)))throw invalid('engineering_github_transition_invalid')
  if(l.service==='jira' && !/^[0-9]+$/.test(String(input.transitionId??'')))throw invalid('engineering_jira_transition_required')
  // Claim the reviewed effect before crossing the network. An interrupted send remains visibly uncertain.
  const claim=await run(db,`UPDATE peg_engineering_links SET state='uncertain',cause='reviewed_update_in_progress',pending_status=?,version=version+1 WHERE id=? AND version=? AND revoked_at IS NULL`,status,id,l.version)
  if(!claim.meta.changes)throw conflict('engineering_review_stale')
  if(source.status!==status) {
    try { await edge.update(status,source.version,String(input.transitionId??'')) }
    catch { await run(db,"UPDATE peg_engineering_links SET cause='reviewed_update_uncertain' WHERE id=? AND state='uncertain'",id) }
  }
  return refreshEngineering(db,env,actor,id,input)
}

export async function backlinkEngineering(db: D1Database, env: Bindings, actor: Actor, id: string, input: Record<string,any>) {
  const l=await owned(db,actor,id)
  if(l.revoked_at || l.state!=='current')throw conflict('engineering_update_not_authorized')
  if(input.confirm!==true && input.confirm!=='on')throw invalid('engineering_exact_review_required')
  const edge=provider(env,l,input.credential),text=`[Pegboard:${l.id}] ${new URL(env.AUTH_ORIGIN).origin}/app/tasks/${l.task_id}`
  await readSource(db,env,actor,l,input.credential)
  if(await checkedSourceRead(db,actor,l,()=>edge.hasBacklink(text))){
    await owned(db,actor,id);await run(db,"UPDATE peg_engineering_links SET backlink_state='posted' WHERE id=? AND revoked_at IS NULL",id)
    return view(await owned(db,actor,id))
  }
  // A lost acknowledgment with no visible comment stays unresolved rather than posting a second comment.
  if(l.backlink_state!=='not_sent')throw conflict('engineering_backlink_uncertain')
  const current=await owned(db,actor,id)
  if(current.revoked_at || current.version!==l.version)throw conflict('engineering_review_stale')
  const claim=await run(db,"UPDATE peg_engineering_links SET backlink_state='uncertain',version=version+1 WHERE id=? AND version=? AND revoked_at IS NULL AND backlink_state='not_sent'",id,l.version)
  if(!claim.meta.changes)throw conflict('engineering_review_stale')
  try{await edge.backlink(text)}catch{/* Read back before reporting a result; never replay an uncertain comment. */}
  try{if(await edge.hasBacklink(text))await run(db,"UPDATE peg_engineering_links SET backlink_state='posted' WHERE id=? AND revoked_at IS NULL",id)}catch(error){
    // Preserve the comment outcome, while removing context the provider can no longer verify.
    await invalidateSource(db,actor,await owned(db,actor,id),error)
  }
  return view(await owned(db,actor,id))
}
