// A held gesture previews its complete date set. Only a release over a loaded, current preview confirms it.
(()=>{
 const panel=document.querySelector('[data-drag-preview]');if(!panel)return
 const status=panel.querySelector('[data-drag-status]'),list=panel.querySelector('[data-drag-shifts]')
 let active=null,serial=0,controller=null
 const date=(value,days)=>{if(!value)return undefined;const at=new Date(value.length===10?value+'T00:00:00Z':value);at.setUTCDate(at.getUTCDate()+days);return value.length===10?at.toISOString().slice(0,10):at.toISOString().replace('.000Z','Z')}
 const cancel=()=>{active=null;serial++;controller?.abort();panel.hidden=true;list.replaceChildren()}
 async function preview(days){
  if(!active||days===active.days)return
  const current=active;current.days=days;current.ready=false;const id=++serial
  controller?.abort();controller=new AbortController();panel.hidden=false;status.textContent='Loading knock-on preview. Keep holding.';list.replaceChildren()
  const moves=[{taskId:current.button.dataset.taskId,...(current.button.dataset.start?{start:date(current.button.dataset.start,days)}:{}),...(current.button.dataset.due?{due:date(current.button.dataset.due,days)}:{})}]
  try{
   const response=await fetch('/api/v1/schedule/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({moves}),signal:controller.signal}),plan=await response.json()
   if(id!==serial||active!==current)return
   if(!response.ok)throw Error(plan.error)
   for(const shift of plan.shifts){const row=document.createElement('li');row.textContent=`${shift.title} · ${shift.owner} · ${shift.estimateHours} planned hours · ${shift.timezone} · ${shift.from.start??'No start'} to ${shift.from.due??'No due'} → ${shift.to.start??'No start'} to ${shift.to.due??'No due'}${shift.calendarAdjusted?' · adjusted to working availability':''}${shift.completed?' · completed, cannot move':''}`;list.append(row)}
   panel.scrollIntoView({block:'center'})
   current.plan=plan;current.moves=moves;current.ready=!plan.blocked&&!plan.waits&&plan.editable&&plan.shifts.length>0
   status.textContent=plan.blocked?'A completed dependant prevents this move. Release cancels.':plan.waits?'This set needs its authorized approver. Release cancels; use the date form to propose it.':current.ready?'Review these changes. Release to apply once, or press Escape to cancel.':'Nothing changes. Release cancels.'
  }catch(error){if(error.name==='AbortError'||id!==serial)return;status.textContent='Preview unavailable. Release cancels; use the date form to review this move.'}
 }
 async function confirm(){
  const current=active;if(!current)return
  active=null;serial++;controller?.abort()
  if(!current.ready){panel.hidden=true;return}
  status.textContent='Applying the reviewed change set.'
  try{
   const response=await fetch('/api/v1/schedule/apply',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({moves:current.moves,revision:current.plan.stamp})}),result=await response.json()
   if(!response.ok)throw Error(result.error)
   if(result.status!=='applied'){status.textContent='This change is waiting for its authorized approver.';return}
   window.location.assign(window.location.pathname)
  }catch(error){status.textContent=`Nothing applied: ${String(error.message).replaceAll('_',' ')}. Preview again before confirming.`}
 }
 for(const button of document.querySelectorAll('[data-schedule-drag]')){
  button.addEventListener('pointerdown',event=>{if(event.button!==0)return;cancel();button.setPointerCapture(event.pointerId);active={button,x:event.clientX,days:null,ready:false};event.preventDefault()})
  button.addEventListener('pointermove',event=>{if(active?.button!==button)return;preview(Math.round((event.clientX-active.x)/24))})
  button.addEventListener('pointerup',()=>{if(active?.button===button)void confirm()})
  button.addEventListener('pointercancel',cancel)
  button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();if(active?.button!==button){cancel();active={button,x:0,days:0,ready:false}}void preview((active.days??0)+(event.key==='ArrowRight'?1:-1))}else if(event.key==='Enter'&&active?.button===button){event.preventDefault();void confirm()}else if(event.key==='Escape')cancel()})
 }
 document.addEventListener('keydown',event=>{if(event.key==='Escape')cancel()})
})()
