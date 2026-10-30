import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startWorker } from './worker.mjs'

/** The real native archive doors into an empty installation of this committed tree. */
export async function restoreCanvasInstallation(owner, options={}) {
 const pass=async call=>{const r=await call;assert.ok(r.status>=200&&r.status<300,JSON.stringify(r.body));return r.body}
 let archive=options.archive
 if(!archive){
 const job=await pass(owner.post('/api/portability/exports',{}));
 for(let part=0;part<100;part++){
  const result=await pass(owner.post(`/api/portability/exports/${job.id}/advance`,{maxParts:16}))
  if(result.phase==='complete'){archive=await pass(owner.get(`/api/portability/exports/${job.id}/download`));break}
 }
 }
 assert.ok(archive,'native archive completes')
 const scratch=await mkdtemp(join(tmpdir(),'pegboard-canvas-restore-'));let worker
 try{
  execFileSync('git',['archive','--output',join(scratch,'product.tar'),'HEAD']);execFileSync('tar',['-xf',join(scratch,'product.tar'),'-C',scratch],{stdio:'pipe'})
  await symlink(join(process.cwd(),'node_modules'),join(scratch,'node_modules'),'dir')
  await mkdir(join(scratch,'exports'));await writeFile(join(scratch,'exports/canvas.rer'),archive,{mode:0o600})
  const cliAt=(cwd,...args)=>spawnSync(process.execPath,[join(process.cwd(),'node_modules/@runeditrun/rer/global/rer.mjs'),...args],{cwd,encoding:'utf8',timeout:options.cliTimeout??180000,maxBuffer:4*1024*1024,env:{...process.env,CI:'1',WRANGLER_SEND_METRICS:'false'}})
  const cli=(...args)=>cliAt(scratch,...args)
  await options.beforeImport?.({scratch,cli})
  if(options.interruptImport){
   // Stop only this owned CLI, after it confirms durable staged parts. Its
   // next supported invocation must recover the same reserved destination.
   await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[join(process.cwd(),'node_modules/@runeditrun/rer/global/rer.mjs'),'import','--input','exports/canvas.rer','--yes'],{cwd:scratch,env:{...process.env,CI:'1',WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']})
    let output='',interrupted=false
    const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('native import never reached durable staging'))},options.cliTimeout??180000)
    const observe=chunk=>{output+=chunk.toString();if(!interrupted&&/Staging the restore: [1-9][0-9]* of/.test(output)){interrupted=true;child.kill('SIGTERM')}}
    child.stdout.on('data',observe);child.stderr.on('data',observe)
    child.once('error',error=>{clearTimeout(timer);reject(error)})
    child.once('close',(code,signal)=>{clearTimeout(timer);try{assert.ok(interrupted,'native CLI reached staged work before interruption');assert.ok(code!==0||signal,'the owned transfer was interrupted');resolve()}catch(error){reject(error)}})
   })
  }
  if(options.interruptImport){
   // Export is audited product activity. Inspect an isolated copy of this
   // synthetic interrupted store, keeping the reserved destination untouched.
   const inspection=join(scratch,'interrupted-inspection')
   await mkdir(inspection);execFileSync('tar',['-xf',join(scratch,'product.tar'),'-C',inspection],{stdio:'pipe'})
   await symlink(join(process.cwd(),'node_modules'),join(inspection,'node_modules'),'dir')
   await cp(join(scratch,'.wrangler'),join(inspection,'.wrangler'),{recursive:true})
   await mkdir(join(inspection,'exports'))
   try{
    const partial=cliAt(inspection,'export','--output','exports/interrupted.rer')
    assert.equal(partial.status,0,partial.stdout+partial.stderr)
    const manifest=JSON.parse((await readFile(join(inspection,'exports/interrupted.rer'),'utf8')).split('\n')[0])
    for(const table of ['oa_operators','peg_tasks','peg_attachments','peg_proofs'])assert.equal(manifest.tables.find(t=>t.name===table)?.count,0,table+' stays empty after an interrupted staged restore')
   }finally{await rm(inspection,{recursive:true,force:true})}
  }
  const result=cli('import','--input','exports/canvas.rer','--yes')
  assert.equal(result.status,0,result.stdout+result.stderr)
  let roundTrip
  if(options.roundTrip){
   const exported=cli('export','--output','exports/round-trip.rer')
   assert.equal(exported.status,0,exported.stdout+exported.stderr)
   roundTrip=await readFile(join(scratch,'exports/round-trip.rer'),'utf8')
  }
  await options.afterImport?.({scratch,cli,roundTrip})
  worker=await startWorker({restoredPersist:join(scratch,'.wrangler/state'),settings:options.settings})
  return {worker,archive,roundTrip,cli,async stop(){await worker.stop();await rm(scratch,{recursive:true,force:true})}}
 }catch(error){await worker?.stop();await rm(scratch,{recursive:true,force:true});throw error}
}
