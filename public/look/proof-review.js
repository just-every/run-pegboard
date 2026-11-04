// PDF execution and links stay inert. Only page pixels and extracted text enter the review.
const root=document.querySelector('[data-proof-review]')
if(root){
  const pdf=await import(root.dataset.pdfModule)
  pdf.GlobalWorkerOptions.workerSrc=root.dataset.pdfWorker
  for(const section of root.querySelectorAll('[data-proof-version]')){
    const status=section.querySelector('[data-pdf-status]'),pages=section.querySelector('[data-pdf-pages]')
    try{
      const response=await fetch(section.dataset.material,{cache:'no-store'})
      if(!response.ok)throw Error('source_unavailable')
      const bytes=await response.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')
      if(hash!==section.dataset.proofDigest)throw Error('source_changed')
      const loading=pdf.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,enableXfa:false,disableFontFace:true,useSystemFonts:true})
      const document=await loading.promise
      for(let number=1;number<=document.numPages;number++){
        const page=await document.getPage(number),viewport=page.getViewport({scale:1.5}),canvas=window.document.createElement('canvas')
        canvas.width=viewport.width;canvas.height=viewport.height;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','PDF page '+number)
        const context=canvas.getContext('2d')
        await page.render({canvasContext:context,viewport}).promise
        for(const pin of section.querySelectorAll('[data-pin-page="'+number+'"]')){
          const x=Number(pin.dataset.pinX)*canvas.width,y=Number(pin.dataset.pinY)*canvas.height
          context.beginPath();context.arc(x,y,13,0,Math.PI*2);context.fillStyle='#D8301F';context.fill();context.fillStyle='white';context.font='bold 14px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(pin.dataset.pinNumber,x,y)
        }
        const frame=window.document.createElement('section');frame.id='pdf-'+section.dataset.proofVersion+'-'+number;frame.tabIndex=-1
        const heading=window.document.createElement('h3');heading.textContent='Page '+number;frame.append(heading,canvas)
        const text=await page.getTextContent(),details=window.document.createElement('details'),summary=window.document.createElement('summary'),paragraph=window.document.createElement('p')
        summary.textContent='Page '+number+' text';paragraph.textContent=text.items.filter(item=>'str' in item).map(item=>item.str).join(' ');paragraph.className='task-description';details.append(summary,paragraph);frame.append(details);pages.append(frame)
        canvas.addEventListener('click',event=>{
          const form=section.querySelector('form'),bounds=canvas.getBoundingClientRect()
          if(!form)return
          form.elements.page.value=String(number);form.elements.x.value=String(Number(((event.clientX-bounds.left)/bounds.width).toFixed(4)));form.elements.y.value=String(Number(((event.clientY-bounds.top)/bounds.height).toFixed(4)));form.elements.body.focus()
        })
      }
      status.textContent='Verified PDF · '+document.numPages+' '+(document.numPages===1?'page':'pages')
      await document.destroy()
    }catch{
      pages.replaceChildren();status.textContent='PDF unavailable. Refresh to check current access and retained bytes.'
    }
  }
}
