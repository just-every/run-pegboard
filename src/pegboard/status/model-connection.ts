import { aiConfig, createAiClient, aiDiagnostics } from '../../modules/ai/index.mjs'
import type { Bindings } from '../../auth.server'
import { batch, bound, conflict, first, invalid, newId, PegError } from '../db'
import { auditStatement, bumpEpoch, epoch } from '../authorization/audit'
import { workspaceRole, type Actor } from '../workspace/people'
import { requireOwner, setProcessor } from '../data/settings'

export type ModelRuntime = Bindings & {AI_ENABLED?:string;AI_MODEL?:string;AI_API_KEY?:string;AI_BASE_URL?:string;AI_PROCESSOR?:string;PEGBOARD_LOCAL_STATUS_MODEL_ORIGIN?:string}
interface Connection {workspace_id:string;model:string;sealed_key:string;configured_by:string;enabled:number;version:number}
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes))
const decode=(value:string)=>Uint8Array.from(atob(value),char=>char.charCodeAt(0))
async function installationKey(env:Bindings) {
  if(!env.INSTALLATION_KEY || env.INSTALLATION_KEY.length<32)throw new PegError(503,'status_model_installation_key_required')
  return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.INSTALLATION_KEY)),{name:'AES-GCM'},false,['encrypt','decrypt'])
}
const context=(workspace:string,model:string,issuer:string)=>new TextEncoder().encode(JSON.stringify(['status-model',workspace,model,issuer]))
const record=(db:D1Database,workspace:string)=>first<Connection>(db,'SELECT * FROM peg_status_model_connections WHERE workspace_id=?',workspace)
const base=(env:ModelRuntime)=>env.AUTH_LOCAL==='true'&&env.PEGBOARD_LOCAL_STATUS_MODEL_ORIGIN ? env.PEGBOARD_LOCAL_STATUS_MODEL_ORIGIN : 'https://api.openai.com/v1'
export async function statusModelRuntime(db:D1Database,env:ModelRuntime,workspace:string):Promise<ModelRuntime> {
  const row=await record(db,workspace)
  if(!row)return env
  if(!row.enabled || await workspaceRole(db,row.configured_by,workspace)!=='owner')return {...env,AI_ENABLED:'false'}
  try {
    const [iv,cipher]=row.sealed_key.split('.')
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:context(workspace,row.model,row.configured_by)},await installationKey(env),decode(cipher))
    return {...env,AI_ENABLED:'true',AI_MODEL:row.model,AI_API_KEY:new TextDecoder().decode(plain),AI_BASE_URL:base(env),AI_PROCESSOR:'openai',RER_MODELS_SERVICE:undefined,RER_MODELS_KEY:undefined}
  }catch{throw new PegError(503,'status_model_reconnect_required',{connectHref:'/app/settings/status-model'})}
}
export async function statusModelConnection(db:D1Database,env:ModelRuntime,workspace:string) {
  const row=await record(db,workspace)
  if(row)return {connected:!!row.enabled && await workspaceRole(db,row.configured_by,workspace)==='owner',model:row.model,version:row.version,source:'owner_connection',connectHref:'/app/settings/status-model'}
  const config=aiConfig({...env,MODELS_SERVICE:env.RER_MODELS_SERVICE,MODELS_KEY:env.RER_MODELS_KEY})
  return {connected:env.AI_ENABLED==='true' && !!env.AI_MODEL && aiDiagnostics(config).length===0,model:env.AI_MODEL??null,version:0,source:'runtime_configuration',connectHref:'/app/settings/status-model'}
}
export async function connectStatusModel(db:D1Database,actor:Actor,env:ModelRuntime,workspace:string,input:Record<string,any>) {
  await requireOwner(db,actor,workspace)
  const current=await record(db,workspace),version=current?.version??0
  if(!Number.isInteger(Number(input.version)) || Number(input.version)!==version)throw conflict('stale_status_model_connection')
  if(input.disconnect===true) {
    const seen=await epoch(db)
    await batch(db,[bound(db,"INSERT INTO peg_status_review_guards VALUES(?,CASE WHEN (SELECT value FROM peg_epoch WHERE id=1)=? AND COALESCE((SELECT version FROM peg_status_model_connections WHERE workspace_id=?),0)=? AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner') THEN 1 ELSE 0 END)",[newId('model_guard'),seen,workspace,version,actor.id]),bound(db,"INSERT INTO peg_status_model_connections VALUES(?,'','',?,0,1) ON CONFLICT(workspace_id) DO UPDATE SET sealed_key='',enabled=0,version=version+1",[workspace,actor.id]),auditStatement(db,{workspaceId:workspace,actorId:actor.id,action:'status.model_disconnected',targetType:'workspace',targetId:workspace}),bumpEpoch(db),bound(db,'DELETE FROM peg_status_review_guards',[])])
    return statusModelConnection(db,env,workspace)
  }
  if(input.processorConsent!==true)throw invalid('status_model_processor_consent_required')
  const model=String(input.model??'').trim(),apiKey=input.apiKey
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,149}$/.test(model)||typeof apiKey!=='string'||!apiKey||apiKey.length>4096||/\s/.test(apiKey))throw invalid('status_model_connection')
  const key=await installationKey(env),seen=await epoch(db)
  try {
    const response=await createAiClient({enabled:true,model,direct:{apiKey,baseUrl:base(env)}}).chat({model,store:false,max_completion_tokens:32,messages:[{role:'user',content:'Return ready true to test this model connection. No application data is supplied.'}],response_format:{type:'json_schema',json_schema:{name:'status_connection',strict:true,schema:{type:'object',properties:{ready:{type:'boolean'}},required:['ready'],additionalProperties:false}}}},{feature:'status-draft',signal:AbortSignal.timeout(45000)})
    const packet:any=await response.json()
    if(packet.choices?.[0]?.finish_reason!=='stop'||JSON.parse(packet.choices[0].message.content).ready!==true)throw Error()
  }catch{throw new PegError(503,'status_model_connection_test_failed',{connectHref:'/app/settings/status-model'})}
  await requireOwner(db,actor,workspace)
  const iv=crypto.getRandomValues(new Uint8Array(12)),sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:context(workspace,model,actor.id)},key,new TextEncoder().encode(apiKey))
  // The consent is an explicit owner decision, separate from the connection probe.
  await setProcessor(db,actor,workspace,{processor:'openai',approved:true,sharing:true,training:false,confirm:true})
  try {await batch(db,[bound(db,"INSERT INTO peg_status_review_guards VALUES(?,CASE WHEN (SELECT value FROM peg_epoch WHERE id=1)=? AND COALESCE((SELECT version FROM peg_status_model_connections WHERE workspace_id=?),0)=? AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner') THEN 1 ELSE 0 END)",[newId('model_guard'),seen,workspace,version,actor.id]),bound(db,'INSERT INTO peg_status_model_connections VALUES(?,?,?,?,1,1) ON CONFLICT(workspace_id) DO UPDATE SET model=excluded.model,sealed_key=excluded.sealed_key,configured_by=excluded.configured_by,enabled=1,version=version+1',[workspace,model,encode(iv)+'.'+encode(new Uint8Array(sealed)),actor.id]),auditStatement(db,{workspaceId:workspace,actorId:actor.id,action:'status.model_connected',targetType:'workspace',targetId:workspace}),bumpEpoch(db),bound(db,'DELETE FROM peg_status_review_guards',[])])}catch(error){if(String(error).includes('CHECK constraint'))throw conflict('stale_status_model_connection');throw error}
  return statusModelConnection(db,env,workspace)
}
