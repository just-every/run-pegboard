// The first-party page alone uses the native cookie. No extension cross-origin writes.
(() => {
 const status=document.querySelector('#capture-status'),error=document.querySelector('#capture-error')
 const fail=message=>{error.textContent=message;error.hidden=false}
 const post=async(path,body)=>{
  const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
  const value=await response.json();if(!response.ok)throw new Error(value.error);return value
 }
 const bridge=sourceId=>new Promise((resolve,reject)=>{
  const requestId=crypto.randomUUID()
  const receive=event=>{
   if(event.source!==window||event.origin!==location.origin||event.data?.type!=='pegboard-capture-result'||event.data.requestId!==requestId)return
   clearTimeout(timer);window.removeEventListener('message',receive)
   event.data.proof?resolve(event.data.proof):reject(new Error('Source permission changed. Select the page again and start a new capture.'))
  }
  const timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(new Error('Connect the extension from this tab and keep the source page open.'))},8000)
  window.addEventListener('message',receive)
  window.postMessage({type:'pegboard-capture-check',sourceId,requestId},location.origin)
 })
 const fragment=location.hash.slice(1)
 if(fragment){
  history.replaceState(null,'',location.pathname)
  try {const payload=JSON.parse(decodeURIComponent(fragment));post('/api/v1/captures',payload).then(v=>location.replace('/app/capture/'+v.id)).catch(e=>fail(e.message))}catch{fail('Invalid capture. Select the page again.')}
 }
 window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.type==='pegboard-capture-connected'&&status&&location.pathname==='/app/capture'&&!fragment&&!new URLSearchParams(location.search).has('cancelled'))status.textContent='Extension connected. Select text on a source page, then click the Pegboard extension.'})
 const form=document.querySelector('form[aria-label="Confirm captured task"]')
 form?.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;error.hidden=true
  try {const proof=await bridge(form.dataset.captureSource);const value=await post(form.action,{proof,reviewToken:form.elements.reviewToken.value});location.assign('/app/tasks/'+value.id)}
  catch(e){fail(e.message);button.disabled=false}
 })
})()
