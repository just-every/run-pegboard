// Hidden branches are disabled before submission and independently checked by the server.
for (const form of document.querySelectorAll('.intake-form')) {
 const update = () => {
  for (const field of form.querySelectorAll('[data-branch-field]')) {
   const parent=form.elements.namedItem('answer.'+field.dataset.branchField)
   const shown=parent&&!parent.disabled&&parent.value===field.dataset.branchValue
   field.hidden=!shown
   for(const input of field.querySelectorAll('input,select,textarea'))input.disabled=!shown
  }
 }
 form.addEventListener('change',update);update()
}
