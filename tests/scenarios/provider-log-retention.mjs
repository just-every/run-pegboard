// Harvest and QuickBooks Time are official-schema network edges, labelled schema-fake.
// All attempts and acknowledgments are persisted by the existing reviewed time-delivery door.
import assert from 'node:assert/strict'
import {startWorker} from '../support/worker.mjs'
import {startTimeServices} from '../support/time-services.mjs'
import {exportCanvasInstallation,restoreCanvasInstallation} from '../support/canvas-restore.mjs'
export const pass=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const identity=n=>['synthetic-pegboard-'+n,'example.test'].join(String.fromCharCode(64))
export const immutableRefusal=error=>{assert.match(String(error.stdout)+String(error.stderr),/time_delivery_history_is_preserved/);return true}
export const query=async(w,sql)=>JSON.parse(await w.sql(sql))[0].results
export async function providerLogFixture(w,services){
 const owner=w.owner,member=await w.person(identity('1311'),'Time author');let admin=await w.person(identity('1312'),'Custody administrator')
 await pass(owner.post(`/api/v1/workspaces/ws_main/people/${admin.id}/account`,{role:'admin'}))
 admin=await w.signIn(admin.email,admin.name,admin.id)
 const project=await pass(member.post('/api/v1/projects',{name:'Reviewed diagnostic custody'}))
 const tasks=[]
 for(let i=0;i<5;i++)tasks.push(await pass(member.post('/api/v1/tasks',{projectId:project.id,title:'Delivery item '+i})))
 const sheet=await pass(member.post('/api/v1/timesheets',{startDate:'2026-10-21',endDate:'2026-10-21'})),entries=[]
 for(const [i,task]of tasks.entries())entries.push(await pass(member.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:task.id,date:'2026-10-21',seconds:3600,key:'synthetic-pegboard-132'+i})))
 let view=await pass(member.get(`/api/v1/timesheets/${sheet.id}`))
 await pass(member.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'submit',revision:view.token}))
 view=await pass(owner.get(`/api/v1/timesheets/${sheet.id}`))
 await pass(owner.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'approve',revision:view.token}))
 const revision=(await pass(owner.get(`/api/v1/timesheets/${sheet.id}`))).token
 const mapping={people:{[member.id]:services.harvest.user},projects:{[project.id]:services.harvest.project},tasks:Object.fromEntries(tasks.map((t,i)=>[t.id,i===3?999999:services.harvest.tasks[i%2]]))}
 const input={service:'harvest',mapping,revision,confirm:'reviewed-exact-packet',credential:services.token('harvest'),account:services.harvest.account}
 const barrier=services.pauseNext()
 services.loseNext()
 const sending=owner.post(`/api/v1/timesheets/${sheet.id}/provider-delivery`,input)
 try{
  await barrier.waiting
  const inFlight=await pass(owner.post('/api/v1/data/retention-preview',{class:'provider_logs',days:1}))
  assert.equal(inFlight.impact.providerRows.length,1)
  assert.equal(inFlight.impact.providerRows[0].state,'sending')
  assert.match(inFlight.impact.providerRows[0].reason,/No matching settled acknowledgment/)
  assert.deepEqual(inFlight.impact.counts,{})
 }finally{barrier.release()}
 await pass(sending)
 // The first entry is uncertain, later entries settle; reconciliation of the first is deliberately not requested.
 const original=await query(w,'SELECT * FROM peg_time_delivery_history ORDER BY id')
 assert.ok(original.some(row=>row.state==='uncertain'))
 assert.ok(original.some(row=>row.state==='acknowledged'))
 assert.ok(original.some(row=>row.state==='rejected'))
 const correction=await pass(member.post('/api/v1/timesheets',{startDate:'2026-10-21',endDate:'2026-10-21'}))
 const adjustment=await pass(member.post(`/api/v1/time/${entries[1].id}/adjust`,{sheetId:correction.id,date:'2026-10-21',seconds:-360,reason:'Reviewed time correction',key:'synthetic-pegboard-1330'}))
 let correctionView=await pass(member.get(`/api/v1/timesheets/${correction.id}`))
 await pass(member.post(`/api/v1/timesheets/${correction.id}/decision`,{action:'submit',revision:correctionView.token}))
 correctionView=await pass(owner.get(`/api/v1/timesheets/${correction.id}`))
 await pass(owner.post(`/api/v1/timesheets/${correction.id}/decision`,{action:'approve',revision:correctionView.token}))
 correctionView=await pass(owner.get(`/api/v1/timesheets/${correction.id}`))
 await pass(owner.post(`/api/v1/timesheets/${correction.id}/provider-delivery`,{...input,revision:correctionView.token}))
 // Move only diagnostic timestamps, never fabricate attempts or change their business outcomes.
 // The immutable trigger is restored in this same fixture transaction, then refusals are exercised again.
 const old=Date.UTC(2026,0,1)
 await w.sql(`DROP TRIGGER peg_time_delivery_history_kept; UPDATE peg_time_delivery_history SET at=${old} WHERE state='sending' AND entry_id<>'${entries[4].id}'; CREATE TRIGGER peg_time_delivery_history_kept BEFORE UPDATE ON peg_time_delivery_history BEGIN SELECT RAISE(ABORT,'time_delivery_history_is_preserved'); END;`)
 const preview=await pass(owner.post('/api/v1/data/retention-preview',{class:'provider_logs',days:1}))
 await pass(owner.post('/api/v1/data/retention',{class:'provider_logs',days:1,token:preview.token,confirm:true}))
 const rows=await query(w,'SELECT * FROM peg_time_delivery_history ORDER BY id')
 return {w,owner,member,admin,project,tasks,sheet,entries,rows,input,adjustment,correction,cutoff:Date.UTC(2026,0,2)}
}
export const previewLogs=f=>pass(f.owner.post('/api/v1/data/expiry-preview',{class:'provider_logs',cutoff:f.cutoff}))
export const expireLogs=(f,p,client=f.owner)=>client.post('/api/v1/data/expire',{class:'provider_logs',cutoff:p.cutoff,token:p.token,confirm:true})
const baseline=async(w)=>JSON.parse(await w.sql('SELECT * FROM peg_time_deliveries ORDER BY service,account,entry_id; SELECT * FROM peg_time_entries ORDER BY id; SELECT * FROM peg_timesheets ORDER BY id; SELECT * FROM peg_time_history ORDER BY id;')).map(result=>result.results)
export async function providerLogRetentionScenario(){
 const services=await startTimeServices();let w,restored
 try{
  w=await startWorker({settings:{PEGBOARD_LOCAL_TIME_SERVICE_ORIGINS:services.origins}})
  const f=await providerLogFixture(w,services),{owner,member,admin}=f
  const original=await baseline(w),audit=await query(w,'SELECT * FROM peg_permanent_audit ORDER BY id'),history=f.rows,unresolved=history.filter(row=>row.entry_id===f.entries[0].id)
  const approvedTotal=async()=>{
   let total=0
   for(const id of [f.sheet.id,f.correction.id]){
    const view=await pass(owner.get(`/api/v1/timesheets/${id}`))
    assert.equal(view.sheet.status,'approved');total+=view.totalSeconds
   }
   return total
  }
  assert.equal(await approvedTotal(),17640,'five hours less the independently reviewed six-minute correction')
  const publicLedger=(await pass(owner.get(`/api/v1/timesheets/${f.sheet.id}/provider-deliveries`))).rows
  const expected=history.filter(row=>row.state==='sending'&&[f.entries[1].id,f.entries[2].id].includes(row.entry_id)).map(row=>row.id)
  assert.ok(expected.length>0);assert.equal((await pass(owner.get(`/api/v1/timesheets/${f.sheet.id}`))).totalSeconds,18000)
  for(const sql of [`DELETE FROM peg_time_delivery_history WHERE id=${expected[0]}`,`UPDATE peg_time_delivery_history SET reason='synthetic-pegboard-1340' WHERE id=${expected[0]}`,`DELETE FROM peg_time_deliveries`])await assert.rejects(()=>w.sql(sql),immutableRefusal)
  const preview=await previewLogs(f)
  assert.deepEqual(preview.selections,[{table:'peg_time_delivery_history',keys:expected.map(id=>({id}))}])
  assert.deepEqual(preview.providerRows.filter(row=>row.reason===null).map(row=>row.id),expected)
  for(const row of unresolved)assert.ok(preview.providerRows.find(r=>r.id===row.id).reason)
  for(const client of [member,admin]){
   await pass(client.post('/api/v1/data/expiry-preview',{class:'provider_logs',cutoff:f.cutoff}),403)
   await pass(expireLogs(f,preview,client),403)
   await pass(client.get('/api/v1/data/receipts/synthetic-pegboard-1341'),403)
  }
  await pass(owner.post('/api/v1/data/expire',{class:'provider_logs',cutoff:f.cutoff,token:preview.token}),409)
  const hold=await pass(owner.post('/api/v1/data/holds',{type:'task',id:f.tasks[1].id,authority:'Reviewed diagnostic hold',expiresAt:Date.now()+86400000}))
  await pass(expireLogs(f,preview),409)
  const held=await previewLogs(f);assert.deepEqual(held.counts,{});assert.equal(held.held,expected.length)
  const heldReceipt=await pass(expireLogs(f,held));assert.equal(heldReceipt.held,expected.length)
  assert.deepEqual(await query(w,'SELECT * FROM peg_time_delivery_history ORDER BY id'),history)
  await pass(owner.post(`/api/v1/data/holds/${hold.id}/release`,{confirm:true}))
  const stale=await previewLogs(f)
  await pass(member.patch(`/api/v1/tasks/${f.tasks[2].id}`,{title:'Later human edit survives'}))
  await pass(expireLogs(f,stale),409)
  assert.deepEqual(await query(w,'SELECT * FROM peg_time_delivery_history ORDER BY id'),history)
  const earlierArchive=await exportCanvasInstallation(owner),review=await previewLogs(f)
  await w.restart()
  const calls=services.requests.length
  const results=await Promise.all([expireLogs(f,review),expireLogs(f,review)])
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409])
  const done=results.find(r=>r.status===200).body
  assert.deepEqual(done.expiredDiagnostics.map(r=>r.id),expected)
  assert.equal(services.requests.length,calls,'expiry and refusals never contact the provider')
  const remaining=history.filter(row=>!expected.includes(row.id))
  assert.deepEqual(await query(w,'SELECT * FROM peg_time_delivery_history ORDER BY id'),remaining)
  assert.deepEqual(await baseline(w),original,'ledger, entries, signed sheets and time history are byte-identical')
  assert.equal(await approvedTotal(),17640)
  assert.deepEqual((await pass(owner.get(`/api/v1/timesheets/${f.sheet.id}/provider-deliveries`))).rows,publicLedger)
  assert.equal((await pass(owner.get('/api/v1/data'))).receipts.filter(row=>row.id===done.id).length,1)
  assert.deepEqual(await query(w,`SELECT * FROM peg_permanent_audit WHERE id<=${audit.at(-1).id} ORDER BY id`),audit,'existing permanent audit remains unchanged')
  const receipt=await pass(owner.get('/api/v1/data/receipts/'+done.id))
  assert.equal(receipt.outcome,'partial');assert.equal(receipt.providerDiagnostics.cutoff,f.cutoff)
  assert.deepEqual(receipt.providerDiagnostics.expired,done.expiredDiagnostics)
  assert.deepEqual(receipt.providerDiagnostics.retained.map(r=>r.id),remaining.map(r=>r.id))
  await w.restart();await pass(expireLogs(f,review),409)
  assert.deepEqual(await query(w,'SELECT * FROM peg_time_delivery_history ORDER BY id'),remaining)
  assert.deepEqual(await query(w,'SELECT * FROM peg_time_diagnostic_expiry'),[])
  for(const row of remaining)await assert.rejects(()=>w.sql(`DELETE FROM peg_time_delivery_history WHERE id=${row.id}`),immutableRefusal)
  restored=await restoreCanvasInstallation(owner,{earlierArchive})
  assert.deepEqual(await query(restored.worker,'SELECT * FROM peg_time_delivery_history ORDER BY id'),remaining)
  assert.deepEqual(await baseline(restored.worker),original)
  assert.deepEqual((await pass(restored.worker.owner.get('/api/v1/data/receipts/'+done.id))).providerDiagnostics,receipt.providerDiagnostics)
  const final=await previewLogs(f)
  assert.deepEqual(final.counts,{})
  await pass(owner.post(`/api/v1/workspaces/ws_main/people/${admin.id}/account`,{role:'owner'}))
  const successor=await w.signIn(admin.email,admin.name,admin.id)
  await pass(successor.post(`/api/v1/workspaces/ws_main/people/${owner.id}/account`,{status:'inactive'}))
  await pass(expireLogs(f,final),401)
  assert.deepEqual(await query(w,'SELECT * FROM peg_time_delivery_history ORDER BY id'),remaining)
  console.log('PROBE PEG-065 exact expiry: schema-fake time-delivery door -> real persisted sending rows, exact expired IDs '+expected.join(',')+' and retained IDs '+remaining.map(r=>r.id).join(','))
  console.log('PROBE PEG-065 authority and holds: owner review, administrator and member refusal, active hold, stale and concurrent confirmation -> one receipt, unchanged held history and no provider calls')
  console.log('PROBE PEG-065 durable custody: expiry, restart, replay and native archive with later journal -> no resurrection; ledger, approved original 18000 seconds and corrected total 17640 seconds, signed sheets and time history unchanged')
 }finally{await restored?.stop();await w?.stop();await services.stop()}
}
