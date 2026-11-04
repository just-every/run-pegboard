// HubSpot CRM v3 wire schemas. These credentials establish no real tenant authority.
import {createServer} from 'node:http'
import {createHmac} from 'node:crypto'
export const hubspotCredential='synthetic-pegboard-701',hubspotSecret='synthetic-pegboard-702'
export async function startHubspotService(){
 const deals=new Map(),requests=[]
 const state={portalId:'1001',refused:false,rejectWrite:false,lose:false,loseBeforeWrite:false,readOutage:false,writes:0,requests,deals}
 state.deal=(id='2001')=>{if(!deals.has(id))deals.set(id,{id,version:1,stage:'closedwon',name:'Synthetic delivery',close:'2026-11-20T00:00:00Z',delivery:null,operation:null});return deals.get(id)}
 state.change=(id,values)=>{const deal=state.deal(id);Object.assign(deal,values);deal.version++}
 const record=deal=>({id:deal.id,archived:false,createdAt:'2026-10-01T12:00:00Z',updatedAt:new Date(Date.UTC(2026,10,1,12)+deal.version*1000).toISOString(),properties:{dealname:deal.name,pipeline:'default',dealstage:deal.stage,closedate:deal.close,hs_lastmodifieddate:new Date(Date.UTC(2026,10,1,12)+deal.version*1000).toISOString(),pegboard_delivery_status:deal.delivery,pegboard_delivery_operation:deal.operation,amount:'900000',private_notes:'synthetic-pegboard-excluded-customer',contact_email:['synthetic-pegboard-9','example.invalid'].join('@')}})
 const server=createServer(async(req,res)=>{
  let raw='';for await(const c of req)raw+=c
  const input=raw?JSON.parse(raw):null,url=new URL(req.url,'http://localhost')
  requests.push({method:req.method,path:req.url,input})
  const send=(code,body)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(body))}
  if(req.headers.authorization!=='Bearer '+hubspotCredential||state.refused)return send(403,{status:'error',message:'Source authority refused'})
  if(state.readOutage&&req.method==='GET')return send(503,{status:'error',message:'Unavailable'})
  if(url.pathname==='/account-info/v3/details')return send(200,{portalId:Number(state.portalId),timeZone:['US','Central'].join('/'),uiDomain:'app.hubspot.com'})
  if(url.pathname==='/crm/v3/pipelines/deals')return send(200,{results:[{id:'default',stages:[{id:'closedwon',metadata:{isClosed:'true',probability:'1.0'}},{id:'open',metadata:{isClosed:'false',probability:'0.5'}}]}]})
  if(url.pathname.startsWith('/crm/v3/properties/deals/')){
   const name=url.pathname.split('/').at(-1)
   return send(200,{name,type:name.endsWith('_status')?'enumeration':'string',modificationMetadata:{readOnlyValue:false},...(name.endsWith('_status')?{options:[{value:'in_progress',hidden:false},{value:'delivered',hidden:false}]}:{})})
  }
  const match=/^\/crm\/v3\/objects\/deals\/([1-9][0-9]*)$/.exec(url.pathname)
  if(!match)return send(404,{status:'error'})
  const deal=state.deal(match[1])
  if(req.method==='GET'){
   const selected=url.searchParams.get('properties')?.split(',')??[]
   if(selected.some(key=>!['dealname','pipeline','dealstage','closedate','hs_lastmodifieddate','pegboard_delivery_status','pegboard_delivery_operation'].includes(key)))return send(400,{status:'error'})
   // Extra properties simulate a provider projection expansion; the adapter must still discard them.
   return send(200,record(deal))
  }
  if(req.method==='PATCH'){
   if(state.loseBeforeWrite){state.loseBeforeWrite=false;state.readOutage=true;req.socket.destroy();return}
   if(state.rejectWrite)return send(403,{status:'error',message:'Write refused'})
   if(Object.keys(input??{}).join(',')!=='properties'||Object.keys(input.properties??{}).sort().join(',')!=='pegboard_delivery_operation,pegboard_delivery_status'||!['in_progress','delivered'].includes(input.properties.pegboard_delivery_status))return send(400,{status:'error'})
   deal.delivery=input.properties.pegboard_delivery_status;deal.operation=input.properties.pegboard_delivery_operation;deal.version++;state.writes++
   if(state.lose){state.lose=false;state.readOutage=true;req.socket.destroy();return}
   return send(200,record(deal))
  }
  send(405,{status:'error'})
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 state.origin=`http://127.0.0.1:${server.address().port}`
 state.event=async(worker,dealId='2001',eventId='3001',extra={},signed=true)=>{
  const path='/api/v1/commercial/hubspot/events',timestamp=String(Date.now()),body=JSON.stringify([{eventId:Number(eventId),subscriptionId:1,portalId:Number(state.portalId),appId:1,occurredAt:Date.UTC(2026,10,1),subscriptionType:'deal.propertyChange',attemptNumber:0,objectId:Number(dealId),propertyName:'dealstage',propertyValue:state.deal(dealId).stage,changeSource:'CRM',...extra}])
  const signature=createHmac('sha256',hubspotSecret).update('POST'+worker.origin+path+body+timestamp).digest('base64')
  const response=await fetch(worker.origin+path,{method:'POST',headers:{'content-type':'application/json','x-hubspot-request-timestamp':timestamp,'x-hubspot-signature-v3':signed?signature:'invalid'},body})
  return {status:response.status,body:await response.json()}
 }
 state.settings={PEGBOARD_LOCAL_HUBSPOT_ORIGIN:state.origin,PEGBOARD_HUBSPOT_CLIENT_SECRET:hubspotSecret}
 state.stop=()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})
 return state
}
