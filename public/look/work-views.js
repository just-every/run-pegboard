// Only committed reads refresh automatically. Draft writes stay here until a person submits them.
const root = document.querySelector('[data-work-view]')
if (root) {
  const status = root.querySelector('[data-live-status]'), preview = root.querySelector('[data-date-preview]')
  let reading = false, ended = false, writing = false
  const message = text => { status.textContent = text }
  const refuse = () => {
    ended = true
    document.title = 'Not available · Pegboard'
    const note = document.createElement('p')
    note.className = 'card panel'
    note.textContent = 'This view is no longer available. Current access is required to read or change work.'
    document.getElementById('main').replaceChildren(note)
  }
  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options })
    if ([401, 403, 404].includes(response.status) || response.redirected) { refuse(); throw new Error('Access ended') }
    return response
  }
  const refresh = async () => {
    if (reading || ended || writing) return
    if (!navigator.onLine) { message('Offline — stale view. Changes are not sent until you reconnect and review them.'); return }
    reading = true
    try {
      const response = await request(location.href, { signal: AbortSignal.timeout(5000), headers: { 'x-work-view-refresh': '1' } })
      if (!response.ok) throw new Error('Read unavailable')
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
      const fresh = doc.querySelector('[data-work-content]'), current = root.querySelector('[data-work-content]')
      if (!fresh || !current) throw new Error('View unavailable')
      const focused = document.activeElement
      let conflict = false
      for (const row of current.querySelectorAll('[data-work-row][data-dirty="1"]')) {
        const replacement = [...fresh.querySelectorAll('[data-work-row]')].find(candidate => candidate.dataset.workRow === row.dataset.workRow)
        // Removed rows and columns are never retained for drafts. Current authority wins.
        if (!replacement || current.dataset.schema !== fresh.dataset.schema) continue
        if (replacement.dataset.revision !== row.dataset.revision) {
          row.dataset.conflict = '1'
          const warning = row.querySelector('[data-draft-warning]')
          warning.hidden = false
          warning.textContent = 'A committed edit changed this task. Your draft is retained; refresh the task before saving. Current: ' + replacement.querySelector('[data-summary]').textContent
          conflict = true
        }
        replacement.replaceWith(row)
      }
      current.replaceWith(fresh)
      if (focused?.isConnected) focused.focus({ preventScroll: true })
      message(conflict ? 'Conflict — a remote edit needs review. Your draft has not been sent.' : 'Live — committed values checked. Local drafts are not shared.')
    } catch { if (!ended) message('Connection unavailable — stale view. Keep your draft and reconnect before sending changes.') }
    finally { reading = false }
  }
  const post = async (url, input) => {
    if (!navigator.onLine) throw new Error('Offline — your draft has not been sent. Reconnect and review before saving.')
    const response = await request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(10000) })
    const result = await response.json()
    if (!response.ok) throw new Error(response.status === 409 ? 'Conflict — reviewed values changed. Your draft is retained. Refresh this task before saving again.' : 'Change refused: ' + String(result.error ?? 'unavailable').replaceAll('_', ' '))
    return result
  }
  const dirty = event => { const row = event.target.closest('[data-work-row]'); if (row) row.dataset.dirty = '1' }
  root.addEventListener('focusin', event => { if (event.target.matches('input,select,textarea')) dirty(event) })
  root.addEventListener('input', dirty)
  root.addEventListener('change', dirty)
  root.addEventListener('click', event => {
    if (event.target.closest('[data-refresh-task]')) { delete event.target.closest('[data-work-row]').dataset.dirty; void refresh() }
    if (event.target.closest('[data-cancel-date]')) preview.replaceChildren()
  })
  root.addEventListener('submit', async event => {
    const form = event.target
    if (!form.matches('[data-live-edit],[data-date-edit],[data-date-apply]')) return
    event.preventDefault()
    if (writing || ended) return
    const button = form.querySelector('button[type="submit"]'), row = form.closest('[data-work-row]')
    const input = Object.fromEntries(new FormData(form))
    delete input._next
    writing = true; button.disabled = true
    try {
      if (form.matches('[data-date-edit]')) {
        let due = input.due
        if (input.dateKind === 'instant' && due) due = new Date(due + 'Z').toISOString()
        const moves = [{ taskId: input.taskId, due: due || null }]
        const plan = await post('/api/v1/schedule/preview', { moves })
        preview.replaceChildren()
        const title = document.createElement('h2'); title.textContent = 'Review date changes'; preview.append(title)
        const list = document.createElement('ul'); list.className = 'rows'
        for (const shift of plan.shifts) {
          const item = document.createElement('li')
          item.textContent = `${shift.title}: ${shift.from.start ?? 'No start'} to ${shift.from.due ?? 'No due'} → ${shift.to.start ?? 'No start'} to ${shift.to.due ?? 'No due'} · ${shift.owner} · ${shift.estimateHours} planned hours`
          list.append(item)
        }
        preview.append(list)
        const note = document.createElement('p')
        note.textContent = plan.blocked ? 'This change cannot be applied because it would move completed work.' : plan.waits ? 'Some affected work needs its authorized approver. No dates will change now.' : 'Apply confirms this exact set. Current permissions and record versions are checked again.'
        preview.append(note)
        if (!plan.blocked && plan.shifts.length) {
          const apply = document.createElement('form'); apply.dataset.dateApply = '1'; apply.action = '/api/v1/schedule/apply'; apply.setAttribute('aria-label', 'Apply reviewed date')
          for (const [name, value] of Object.entries({ moves: JSON.stringify(moves), revision: plan.stamp })) { const field = document.createElement('input'); field.type = 'hidden'; field.name = name; field.value = value; apply.append(field) }
          const commit = document.createElement('button'); commit.type = 'submit'; commit.className = 'button primary'; commit.textContent = plan.waits ? 'Submit for authorized approval' : 'Apply this change set'; apply.append(commit); preview.append(apply)
        }
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'button quiet'; cancel.dataset.cancelDate = '1'; cancel.textContent = 'Cancel date change'; preview.append(cancel)
        preview.scrollIntoView({ block: 'nearest' }); message('Date preview ready. No dates have changed.')
      } else {
        if (input.moves) input.moves = JSON.parse(input.moves)
        const result = await post(form.action, input)
        if (row) delete row.dataset.dirty
        if (form.matches('[data-date-apply]')) { root.querySelectorAll('[data-work-row]').forEach(node => { delete node.dataset.dirty }); preview.replaceChildren() }
        message(result.status === 'pending' ? 'Awaiting authorized approval. No dates changed.' : 'Change committed. Refreshing visible values.')
      }
    } catch (error) { if (!ended) message(error.message) }
    finally { writing = false; if (button.isConnected) button.disabled = false }
    if (!form.matches('[data-date-edit]')) await refresh()
  })
  addEventListener('offline', () => message('Offline — stale view. Changes are not sent until you reconnect and review them.'))
  addEventListener('online', () => { void refresh() })
  addEventListener('pageshow', () => { void refresh() })
  const timer = setInterval(refresh, 1000)
  addEventListener('pagehide', () => { clearInterval(timer); preview.replaceChildren() })
  void refresh()
}
