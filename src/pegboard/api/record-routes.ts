import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { all } from '../db'
import { door } from './door'
import { createProof,proofView,addProofVersion,proofDecisionPreview,decideProof,submitOutput,outputView } from '../records/custody'
import { openTask } from '../tasks/access'
export function recordRoutes(app:Hono<{Bindings:Bindings}>) {

  app.post('/tasks/:id/proofs',door(({db,actor,params,input})=>createProof(db,actor,params.id,input)))
  app.get('/tasks/:id/proofs',door(async({db,actor,params})=>{
    const {task}=await openTask(db,actor,params.id),rows=await all<{id:string}>(db,'SELECT id FROM peg_proofs WHERE task_id=? ORDER BY id',task.id),proofs=[]
    for(const row of rows)try{proofs.push(await proofView(db,actor,row.id))}catch(error){if(!(error instanceof Error&&'status' in error&&error.status===404))throw error}
    return {proofs}
  }))
  app.get('/proofs/:id',door(({db,actor,params})=>proofView(db,actor,params.id)))
  app.post('/proofs/:id/versions',door(({db,actor,params,input})=>addProofVersion(db,actor,params.id,input)))
  app.get('/proofs/:id/decision-preview',door(({db,actor,params})=>proofDecisionPreview(db,actor,params.id)))
  app.post('/proofs/:id/decisions',door(({db,actor,params,input})=>decideProof(db,actor,params.id,input)))
  app.post('/tasks/:id/agent-outputs',door(({db,actor,params,input})=>submitOutput(db,actor,params.id,input)))
  app.get('/agent-outputs/:id',door(({db,actor,params})=>outputView(db,actor,params.id)))
  app.get('/agent-outputs/:id/retrieval',door(({db,actor,params})=>outputView(db,actor,params.id,true)))
}
