// activeTab is granted by the toolbar gesture, never by a page asking for it.
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('')
const snapshot=()=>({title:document.title,excerpt:window.getSelection()?.toString()??'',url:location.href})
function safeUrl(raw){const u=new URL(raw);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('Unsupported source');u.search='';u.hash='';return u.href}
function bridge(){
 if(window.__pegboardCaptureBridge)return;window.__pegboardCaptureBridge=true
 window.addEventListener('message',async event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.type!=='pegboard-capture-check')return
  const {sourceId,requestId}=event.data
  try {const result=await chrome.runtime.sendMessage({type:'confirm-source',sourceId});window.postMessage({type:'pegboard-capture-result',requestId,...result},location.origin)}catch{window.postMessage({type:'pegboard-capture-result',requestId,error:true},location.origin)}
 })
 window.postMessage({type:'pegboard-capture-connected'},location.origin)
}
async function inject(tabId){await chrome.scripting.executeScript({target:{tabId},func:bridge})}
chrome.tabs.onUpdated.addListener(async(tabId,change,tab)=>{
 const {connection}=await chrome.storage.session.get('connection')
 if(change.status==='complete'&&connection?.tabId===tabId&&new URL(tab.url).origin===connection.origin&&new URL(tab.url).pathname.startsWith('/app/capture'))await inject(tabId).catch(()=>{})
})
chrome.action.onClicked.addListener(async tab=>{
 try {
  const url=new URL(tab.url)
  if(url.pathname==='/app/capture'&&!url.hash){
   await chrome.storage.session.set({connection:{origin:url.origin,tabId:tab.id}});await inject(tab.id);return
  }
  const {connection}=await chrome.storage.session.get('connection')
  if(!connection)throw new Error('Open Pegboard capture and click the extension there first')
  const [captured]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:snapshot})
  const value=captured.result
  if(!value.title.trim()||value.title.length>300||value.excerpt.length>12000)throw new Error('Selection is too long')
  const sourceId=crypto.randomUUID(),proof=crypto.randomUUID()+crypto.randomUUID()
  const payload={sourceId,title:value.title,excerpt:value.excerpt,url:safeUrl(value.url),proofHash:await hash(proof)}
  await chrome.storage.session.set({['capture:'+sourceId]:{sourceTab:tab.id,documentId:captured.documentId,snapshot:await hash(value),proof,appTab:connection.tabId}})
  await chrome.tabs.update(connection.tabId,{url:connection.origin+'/app/capture#'+encodeURIComponent(JSON.stringify(payload)),active:true})
  await chrome.action.setBadgeText({text:'',tabId:tab.id})
 }catch(error){
  await chrome.action.setBadgeText({text:'!',tabId:tab.id})
  await chrome.action.setTitle({title:String(error.message),tabId:tab.id})
 }
})
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message.type!=='confirm-source')return
 ;(async()=>{
  const {connection}=await chrome.storage.session.get('connection'),stored=await chrome.storage.session.get('capture:'+message.sourceId),intent=stored['capture:'+message.sourceId]
  if(!connection||!intent||sender.tab?.id!==intent.appTab||sender.tab.id!==connection.tabId||new URL(sender.url).origin!==connection.origin||!new URL(sender.url).pathname.startsWith('/app/capture/'))throw new Error('Wrong preview')
  const [current]=await chrome.scripting.executeScript({target:{tabId:intent.sourceTab,documentIds:[intent.documentId]},func:snapshot})
  if(current.documentId!==intent.documentId||await hash(current.result)!==intent.snapshot)throw new Error('Source changed')
  reply({proof:intent.proof})
 })().catch(()=>reply({error:true}))
 return true
})
