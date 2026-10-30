import { createElement as h } from 'react'
import type { Hono } from 'hono'
import { runtimeBindings, type Bindings } from '../../auth.server'
import { appDocument } from '../../ui/document.server'
import { PegError } from '../db'
import { describe, door, json } from './door'
import { formRow, internalForm, projectForms, publicForm, publishForm, reviewForm, revokeForm, safeForm, saveForm } from '../intake/forms'
import { limitPublic, submitIntake } from '../intake/submissions'
import { triageQueue, triageSubmission } from '../intake/triage'
import { PublicIntakeScreen,PublishedIntakeScreen } from '../ui/pages/intake'
export async function intakeDocument(title:string,body:ReturnType<typeof h>) {
 const response=await appDocument(title,body),headers=new Headers(response.headers)
 headers.set('referrer-policy','strict-origin')
 return new Response((await response.text()).replace('</head>','<link rel="stylesheet" href="/look/intake.css"></head>').replace('</body>','<script src="/look/intake.js" defer></script></body>'),{status:response.status,headers})
}
async function readSubmission(request:Request) {
 const type=request.headers.get('content-type')??''
 if(!type.includes('application/json')&&!type.includes('application/x-www-form-urlencoded'))throw new PegError(415,'intake_text_only')
 const reader=request.body?.getReader();let length=0,raw='';const decoder=new TextDecoder()
 if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>20000){await reader.cancel();throw new PegError(413,'intake_too_large')}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}finally{reader.releaseLock()}
 if(type.includes('application/json')){try{const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw Error();return input}catch{throw new PegError(400,'invalid_json')}}
 const fields=new URLSearchParams(raw),input:Record<string,any>=Object.assign(Object.create(null),{answers:Object.create(null)})
 for(const [key,value]of fields){if(fields.getAll(key).length!==1)throw new PegError(400,'intake_duplicate_field');if(key.startsWith('answer.'))input.answers[key.slice(7)]=value;else input[key]=value}
 return input
}
function sameOrigin(request:Request,env:Bindings){const origin=request.headers.get('origin');if(!origin||request.headers.get('sec-fetch-site')==='cross-site'||![new URL(request.url).origin,new URL(env.AUTH_ORIGIN).origin].includes(origin))throw new PegError(403,'cross_origin')}
export async function publicIntakePage(request:Request,original:Bindings):Promise<Response|null>{
 const match=/^\/intake\/([^/]+)$/.exec(new URL(request.url).pathname);if(!match)return null
 const env=runtimeBindings(original),cap=match[1]
 try{
  const row=await publicForm(env.DB,cap)
  if(request.method==='GET'||request.method==='HEAD')return intakeDocument('Request intake',h(PublicIntakeScreen,{form:safeForm(row),action:'/intake/'+cap}))
  if(request.method!=='POST')throw new PegError(405,'method_not_allowed')
  sameOrigin(request,env);await limitPublic(env.DB,cap,request.headers.get('cf-connecting-ip')??'local')
  const receipt=await submitIntake(env.DB,{capability:cap},await readSubmission(request))
  return intakeDocument('Request received',h(PublicIntakeScreen,{form:safeForm(row),action:'/intake/'+cap,receipt}))
 }catch(error){const failure=describe(error);return json({error:failure.status>=500?'intake_unavailable':failure.code},failure.status)}
}
export function intakeRoutes(app:Hono<{Bindings:Bindings}>) {
 app.post('/projects/:id/intake/forms',door(async({db,actor,params,input,form})=>{
  const value=form?{name:input.name,fields:[{id:'title',label:input.titleLabel,required:true},{id:'kind',label:input.branchLabel,required:true,choices:String(input.choices??'').split(',').map(v=>v.trim())},{id:'details',label:input.detailLabel,required:true,when:{field:'kind',equals:input.branchValue}}],mapping:{title:'title',description:['kind','details'],ownerId:input.ownerId,priority:input.priority},hours:input.hours}:input
  const result=await saveForm(db,actor,params.id,value)
  return form?new Response(null,{status:303,headers:{location:`/app/projects/${params.id}/settings/intake?review=${result.id}`,'cache-control':'no-store'}}):result
 },{next:(r,{params})=>`/app/projects/${params.id}/settings/intake?review=${r.id}`}))
 app.get('/projects/:id/intake/forms',door(({db,actor,params})=>projectForms(db,actor,params.id)))
 app.post('/intake/forms/:id/draft',door(async({db,actor,params,input})=>saveForm(db,actor,(await formRow(db,params.id)).project_id,input,params.id)))
 app.get('/intake/forms/:id/review',door(({db,actor,params})=>reviewForm(db,actor,params.id)))
 app.post('/intake/forms/:id/publish',door(async({db,actor,params,input,form})=>{
  const r=await publishForm(db,actor,params.id,input)
  if(!form)return r
  const row=await formRow(db,params.id),path=`/app/projects/${row.project_id}/settings/intake`
  if(!r.capability)return new Response(null,{status:303,headers:{location:path,'cache-control':'no-store'}})
  // A capability is returned once in this response, never put into a redirect query or saved in plaintext.
  return intakeDocument('Public intake link',h(PublishedIntakeScreen,{capability:r.capability,back:path}))
 }))
 app.post('/intake/forms/:id/revoke',door(({db,actor,params})=>revokeForm(db,actor,params.id)))
 app.get('/intake/forms/:id',door(async({db,actor,params})=>safeForm(await internalForm(db,actor,params.id))))
 app.post('/intake/forms/:id/submit',door(async({db,actor,params,request})=>{
  const receipt=await submitIntake(db,{actor,formId:params.id},await readSubmission(request))
  return (request.headers.get('content-type')??'').includes('form')?new Response(null,{status:303,headers:{location:`/app/intake/${params.id}?receipt=${receipt.receipt}`,'cache-control':'no-store'}}):json(receipt)
 },{raw:true}))
 app.get('/projects/:id/intake',door(({db,actor,params})=>triageQueue(db,actor,params.id)))
 app.post('/intake/submissions/:id/triage',door(({db,actor,params})=>triageSubmission(db,actor,params.id)))
 app.get('/public-intake/:cap',async c=>{try{return json(safeForm(await publicForm(runtimeBindings(c.env).DB,c.req.param('cap'))))}catch(error){const failure=describe(error);return json({error:'intake_unavailable'},failure.status)}})
 app.post('/public-intake/:cap',async c=>{try{const env=runtimeBindings(c.env),request=c.req.raw,cap=c.req.param('cap');sameOrigin(request,env);await publicForm(env.DB,cap);await limitPublic(env.DB,cap,request.headers.get('cf-connecting-ip')??'local');return json(await submitIntake(env.DB,{capability:cap},await readSubmission(request)))}catch(error){const failure=describe(error);return json({error:failure.code},failure.status)}})
}
