import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
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
  const cli=(...args)=>spawnSync(process.execPath,[join(process.cwd(),'node_modules/@runeditrun/rer/global/rer.mjs'),...args],{cwd:scratch,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024,env:{...process.env,CI:'1',WRANGLER_SEND_METRICS:'false'}})
  await options.beforeImport?.({scratch,cli})
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
