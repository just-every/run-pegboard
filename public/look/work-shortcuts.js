// Visible alternatives remain available in Find work for every keyboard action.
document.addEventListener('keydown', event => {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const key = event.key.toLowerCase();
  if (key === 'f') {
    event.preventDefault();
    const input = document.querySelector('form[aria-label="Search work"] input[name="q"]');
    if (input) input.focus(); else location.assign('/app/search');
  } else if (key === 'n') {
    const input = document.querySelector('form[aria-label="Quick add task"] input[name="title"]');
    if (input) { event.preventDefault(); input.focus(); }
  } else if (key === 's') {
    const inputs = [...document.querySelectorAll('form[aria-label="Change selected search results"] input[name="taskIds[]"]')];
    if (inputs.length) { event.preventDefault(); const value = inputs.some(input => !input.checked); for (const input of inputs) input.checked = value; }
  }
});
