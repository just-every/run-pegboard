// Drag selects the same review door as the accessible staffing form. It never writes a task.
document.addEventListener('dragstart', event => {
 const task=event.target.closest('[data-capacity-task]')
 if(task&&event.dataTransfer)event.dataTransfer.setData('text/plain',task.dataset.capacityTask)
})
document.addEventListener('dragover',event=>{if(event.target.closest('[data-capacity-person]'))event.preventDefault()})
document.addEventListener('drop',event=>{
 const person=event.target.closest('[data-capacity-person]'),task=event.dataTransfer?.getData('text/plain')
 if(!person||!task||!document.querySelector('[data-capacity-task="'+CSS.escape(task)+'"]'))return
 event.preventDefault()
 const url=new URL(location.href);url.searchParams.set('taskId',task);url.searchParams.set('personId',person.dataset.capacityPerson);location.assign(url)
})
