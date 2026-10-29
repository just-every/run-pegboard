// This document owns its drafts in memory. No browser storage or outbound service receives collaboration text.
(() => {
 const live=document.querySelector('[data-live-collaboration]')
 if(!live)return
 const status=live.querySelector('[data-live-status]'),error=live.querySelector('[data-live-error]'),conflict=live.querySelector('[data-live-conflict]'),latest=live.querySelector('[data-live-latest]')
 const dirty=new Set(),pending=new Set(),intents=new WeakMap(),source=live.dataset.liveCollaboration
 let fingerprint='',running=false,stopped=false,lastDocument=null
 const forms=()=>[...document.querySelectorAll('form')].filter(f=>f.action.includes('/api/v1/')&&(f.querySelector('[name=description]')||f.querySelector('[name=text]')||/\/brief\/restore$/.test(new URL(f.action).pathname)||/\/comments(?:\/|$)/.test(new URL(f.action).pathname)))
 const revision=f=>f.querySelector('[name=descriptionVersion],[name=version]')
 const message=text=>{error.textContent=text;error.hidden=false}
 const refused=()=>{
  stopped=true
  // Current authority wins over both cached remote context and unsent local text.
  const main=document.querySelector('main');main.replaceChildren()
  const heading=document.createElement('h1');heading.textContent='This work is no longer available.'
  const text=document.createElement('p');text.textContent='Your current access cannot read this work. Cached text has been cleared.'
  main.append(heading,text)
 }
 function apply(doc,review=false){
  lastDocument=doc
  let collided=false
  const held=new Set()
  for(const form of forms()){
   const next=[...doc.querySelectorAll('form')].find(f=>f.getAttribute('action')===form.getAttribute('action'))
   if(!next){dirty.delete(form);form.remove();continue}
   const oldRevision=revision(form),newRevision=revision(next)
   if(dirty.has(form)||pending.has(form)){
    held.add(form.closest('[data-live-region]'))
    if(oldRevision&&newRevision&&oldRevision.value!==newRevision.value){
     collided=true
     if(review){oldRevision.value=newRevision.value;form.dataset.reviewed='true'}
    }
   }else{
    for(const field of form.querySelectorAll('textarea,input:not([name=_next]),select')){
     const fresh=next.elements.namedItem(field.name)
     if(fresh&&'value' in fresh){
      if(field.tagName==='SELECT'){
       const selected=field.value;field.replaceChildren(...[...fresh.options].map(o=>document.importNode(o,true)))
       field.value=[...field.options].some(o=>o.value===selected)?selected:fresh.value
      }else{field.value=fresh.value;field.defaultValue=fresh.value}
     }
    }
   }
  }
  for(const region of document.querySelectorAll('[data-live-region]')){
   if(held.has(region))continue
   const fresh=doc.querySelector(`[data-live-region="${region.dataset.liveRegion}"]`)
   if(fresh){
    const selected=region.querySelector('select')?.value
    region.replaceChildren(...[...fresh.childNodes].map(n=>document.importNode(n,true)))
    const select=region.querySelector('select');if(select&&[...select.options].some(o=>o.value===selected))select.value=selected
   }
  }
  conflict.hidden=!collided||review
  if(review){
   latest.replaceChildren()
   for(const region of doc.querySelectorAll('[data-live-region="brief"],[data-live-region="description"],[data-live-region="comments"]')){
    const copy=document.importNode(region,true);copy.removeAttribute('data-live-region');copy.querySelectorAll('form').forEach(f=>f.remove());latest.append(copy)
   }
   latest.hidden=false
   message('Latest text is shown below. Your draft is unchanged; reconcile it before saving.')
  }
  bind()
 }
 async function refresh(force=false){
  if(stopped||running)return
  running=true
  try{
   const response=await fetch(source,{cache:'no-store',credentials:'same-origin'})
   if([401,403,404].includes(response.status)){refused();return}
   if(!response.ok)throw new Error('unavailable')
   const data=await response.json(),next=JSON.stringify(data)
   const scope=source.includes('/tasks/')?JSON.stringify([data.capabilities,data.projects.map(p=>p.id),'internalNotes' in data]):JSON.stringify(data.canEdit)
   if(scope!==live.dataset.liveScope){
    stopped=true;document.querySelector('main').replaceChildren();location.replace(location.href);return
   }
   if(force||next!==fingerprint){
    const html=await fetch(location.href,{cache:'no-store',credentials:'same-origin'})
    if([401,403,404].includes(html.status)||html.redirected){refused();return}
    if(!html.ok)throw new Error('unavailable')
    const doc=new DOMParser().parseFromString(await html.text(),'text/html')
    if(!doc.querySelector('[data-live-collaboration]')){refused();return}
    apply(doc);fingerprint=next
   }
   status.textContent='Live · current authorized revisions'
  }catch{status.textContent='Offline or reconnecting · showing the last received revision. Unsent text is kept here.'}
  finally{running=false}
 }
 function bind(){
  for(const form of forms()){
   if(form.dataset.collaborationBound)continue
   form.dataset.collaborationBound='true'
   form.addEventListener('input',()=>{dirty.add(form);intents.delete(form)})
   form.addEventListener('change',()=>{dirty.add(form);intents.delete(form)})
   form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending.has(form))return
    const fields=new URLSearchParams(new FormData(form));fields.delete('_next')
    if(!intents.has(form))intents.set(form,crypto.randomUUID())
    fields.set('key',intents.get(form))
    const body=Object.fromEntries(fields)
    if('internalOnly' in body)body.internalOnly=body.internalOnly==='on'
    if('active' in body)body.active=body.active==='true'
    pending.add(form);status.textContent='Saving · waiting for confirmation';error.hidden=true
    form.querySelectorAll('button').forEach(b=>b.disabled=true)
    try{
     const response=await fetch(form.action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'})
     if([401,404].includes(response.status)){refused();return}
     if(!response.ok){
      if(response.status===409){conflict.hidden=false;message('This revision changed. Your draft has not been sent over the newer text. Review the latest text and reconcile your draft.')}
      else message('This change was refused. Your draft is kept; check your current permissions and fields.')
      return
     }
     dirty.delete(form);intents.delete(form)
     if(/\/comments$/.test(new URL(form.action).pathname))form.reset()
     conflict.hidden=true;latest.hidden=true
    }catch{message('Save could not be confirmed. Your text is kept. Reconnect and retry the same change safely.')}
    finally{
     pending.delete(form);form.querySelectorAll('button').forEach(b=>b.disabled=false)
     await refresh(true)
    }
   })
  }
 }
 live.querySelector('[data-live-review]').addEventListener('click',()=>{if(lastDocument)apply(lastDocument,true)})
 addEventListener('offline',()=>{status.textContent='Offline · unsent text is kept here.'})
 addEventListener('online',()=>refresh(true))
 addEventListener('pagehide',()=>{stopped=true;clearInterval(timer)})
 addEventListener('pageshow',event=>{if(event.persisted)location.reload()})
 bind();refresh(true)
 const timer=setInterval(()=>refresh(),1000)
})()
