const form = document.querySelector('[data-view-save]')
if (form) form.addEventListener('submit', async event => {
  event.preventDefault()
  const fields = new FormData(form), error = document.querySelector('[data-view-settings-error]'), button = form.querySelector('button[type=submit]')
  button.disabled = true; error.hidden = true
  const sortColumn = fields.get('sortColumn')
  const input = { name: fields.get('name'), mode: fields.get('mode'), groupBy: fields.get('groupBy') || null,
    filters: { status: fields.getAll('statuses[]'), ownerIds: fields.getAll('owners[]'), dueFrom: fields.get('dueFrom') || null, dueTo: fields.get('dueTo') || null },
    columns: fields.getAll('columns[]'), sort: sortColumn ? [{ column: sortColumn, direction: fields.get('sortDirection') }] : [], shared: fields.has('shared'), revision: fields.get('revision') }
  try {
    const response = await fetch(form.action, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
    const result = await response.json()
    if (!response.ok) throw new Error(response.status === 409 ? 'This configuration changed. Your draft is retained; reopen the saved view to review the current version.' : 'The view could not be saved with your current permissions.')
    location.assign(form.dataset.return + '?savedView=' + encodeURIComponent(result.id))
  } catch (failure) { error.textContent = failure.message; error.hidden = false }
  finally { button.disabled = false }
})
