document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-copy]')
  if (!button) return
  try {
    await navigator.clipboard.writeText(button.dataset.copy)
    button.textContent = 'Copied'
    setTimeout(() => { button.textContent = 'Copy' }, 1600)
  } catch {
    button.textContent = 'Select the command to copy'
  }
})
