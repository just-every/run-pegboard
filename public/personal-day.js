// Refresh an open day at local midnight, including DST changes. No deadlines or project sections are mutated.
(() => {
  const day = document.querySelector('[data-personal-day]')
  if (!day) return
  const format = new Intl.DateTimeFormat('en-CA', {timeZone: day.dataset.timezone, year: 'numeric', month: '2-digit', day: '2-digit'})
  const check = () => { if (format.format(new Date()) !== day.dataset.personalDay) location.reload() }
  setInterval(check, 30000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
})()
