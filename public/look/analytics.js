// A credential lives only in this document. No storage, history state, URL or clipboard receives it.
const form = document.querySelector('form[aria-label="Authorize analyst key"]')
const credential = document.getElementById('analytics-credential')
const clearCredential = () => {
  credential.hidden = true
  credential.querySelectorAll('code,[data-analytics-expiry]').forEach(node => { node.textContent = '' })
}
addEventListener('pagehide', clearCredential)
addEventListener('pageshow', event => { if (event.persisted) clearCredential() })
if (form) form.addEventListener('submit', async event => {
  event.preventDefault()
  const button = form.querySelector('button[type="submit"]'), error = document.getElementById('analytics-error')
  button.disabled = true
  error.hidden = true
  clearCredential()
  try {
    const response = await fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)), credentials: 'same-origin' })
    if (response.redirected) { location.assign('/signin'); return }
    if (!response.ok) {
      error.textContent = response.status === 403 ? 'Your current authority does not permit analyst access.' : 'Choose at least one project and field, and explicitly consent before authorizing.'
      error.hidden = false
      return
    }
    const result = await response.json()
    credential.querySelector('[data-analytics-key]').textContent = result.id
    credential.querySelector('[data-analytics-secret]').textContent = result.secret
    credential.querySelector('[data-analytics-service]').textContent = new URL(result.servicePath, location.origin).href
    credential.querySelector('[data-analytics-expiry]').textContent = new Date(result.expiresAt).toISOString()
    form.reset()
    credential.hidden = false
    credential.focus()
  } catch {
    error.textContent = 'Authorization could not be confirmed. Reload your key list before issuing a replacement.'
    error.hidden = false
  } finally { button.disabled = false }
})
