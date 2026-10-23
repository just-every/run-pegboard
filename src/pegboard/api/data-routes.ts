import { createPortability, createPortabilityHandler } from '@runeditrun/rer/modules/portability'
import policy from '../portability/policy.mjs'
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { operatorAuth, runtimeBindings } from '../../auth.server'
import { actorOf } from '../workspace/people'
import { all, batch, bound } from '../db'
import { permanentEvent, searchAudit, exportAudit } from '../audit/search'
import { dataSettings, retentionPreview, setRetention, addHold, releaseHold, setProcessor, requireOwner } from '../data/settings'
import { erasurePlan, erase } from '../data/erasure'
import { expiryPlan, expire } from '../data/expiry'
import { door } from './door'

export function dataRoutes(app:Hono<{Bindings:Bindings}>) {
  app.get('/admin/audit',door(({db,actor,workspace,query})=>searchAudit(db,actor,workspace,Object.fromEntries(query))))
  app.get('/admin/audit/export',door(({db,actor,workspace,query})=>exportAudit(db,actor,workspace,Object.fromEntries(query))))
  app.get('/data',door(({db,actor,workspace})=>dataSettings(db,actor,workspace)))
  app.post('/data/retention-preview',door(({db,actor,workspace,input})=>retentionPreview(db,actor,workspace,input)))
  app.post('/data/retention',door(({db,actor,workspace,input})=>setRetention(db,actor,workspace,input),{next:()=>'/app/data'}))
  app.post('/data/holds',door(({db,actor,workspace,input})=>addHold(db,actor,workspace,input),{next:()=>'/app/data'}))
  app.post('/data/holds/:id/release',door(({db,actor,workspace,params,input})=>releaseHold(db,actor,workspace,params.id,input),{next:()=>'/app/data'}))
  app.post('/data/processors',door(({db,actor,workspace,input})=>setProcessor(db,actor,workspace,input),{next:()=>'/app/data'}))
  app.post('/data/erasure-preview',door(({db,actor,workspace,input})=>erasurePlan(db,actor,workspace,String(input.type),String(input.id))))
  app.post('/data/erase',door(({db,actor,workspace,input})=>erase(db,actor,workspace,input),{next:result=>'/app/data?receipt='+result.id}))
  app.post('/data/expiry-preview',door(({db,actor,workspace,input})=>expiryPlan(db,actor,workspace,input)))
  app.post('/data/expire',door(({db,actor,workspace,input})=>expire(db,actor,workspace,input),{next:result=>'/app/data?receipt='+result.id}))
  app.get('/data/journal',door(async({db,actor,workspace})=>{
    await requireOwner(db,actor,workspace);await createPortability({db,policy})
    const state=await db.prepare('SELECT source_identity,epoch FROM rer_portability_state WHERE id=1').first<{source_identity:string;epoch:number}>()
    return {sourceIdentity:state!.source_identity,epoch:state!.epoch,journal:(await all<{tombstone:string}>(db,'SELECT tombstone FROM rer_portability_journal WHERE source=? ORDER BY tombstone',state!.source_identity)).map(r=>r.tombstone)}
  }))
}
// The shared archive API uses the exact CLI policy. A populated destination refuses restore before writes.
export async function archiveResponse(request:Request,original:Bindings):Promise<Response|null> {
  if(!new URL(request.url).pathname.startsWith('/api/portability'))return null
  const env=runtimeBindings(original),session=await operatorAuth(env).getSession(request)
  const handler=await createPortabilityHandler({db:env.DB,policy,appOrigin:env.AUTH_ORIGIN,authorize:async()=>{
    if(!session)return null
    try{await requireOwner(env.DB,actorOf(session),'ws_main');return session.operator.id}catch{return null}
  }})
  const response=await handler(request)
  if(response&&session&&response.status<400&&!['GET','HEAD'].includes(request.method))await batch(env.DB,[permanentEvent(env.DB,{workspace:'ws_main',actor:session.operator.id,action:new URL(request.url).pathname.includes('/imports')?'archive.import':'archive.export',type:'archive',id:'ws_main',result:response.status<400?'success':'failure'})])
  return response
}
