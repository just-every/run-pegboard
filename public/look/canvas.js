/* The server owns permissions and revisions. Polls patch the tree, never replace an editor. */
(() => {
  const root = document.querySelector('[data-canvas-project]');
  if (!root) return;
  const project = encodeURIComponent(root.dataset.canvasProject);
  const api = `/api/v1/projects/${project}/canvas`;
  const page = `/app/projects/${project}/canvas`;
  const diagram = root.querySelector('[data-canvas-map]');
  const sync = root.querySelector('[data-canvas-sync]');
  const selected = root.dataset.canvasSelected;
  let latest = null, polling = null, busy = false, conflict = false, stopped = false;
  const titleOf = node => node.task?.title ?? node.title;
  const kindOf = node => ({ note: 'Note', phase: 'Phase', task: 'Task' })[node.kind];
  const detailOf = node => [kindOf(node), node.internalOnly ? 'Internal only' : 'Project audience', ...(node.task ? [node.task.status, node.task.owner?.name ?? 'Unassigned'] : [])].join(' · ');
  const setText = (element, value) => { if (element && element.textContent !== value) element.textContent = value; };
  const make = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  };

  function clearPrivateContent() {
    stopped = true;
    latest = null;
    polling?.abort();
    clearInterval(timer);
    root.querySelectorAll('fieldset').forEach(fieldset => { fieldset.disabled = true; });
    root.querySelectorAll('input,select,textarea').forEach(field => { field.value = ''; });
    diagram.replaceChildren();
    root.replaceChildren(make('p', 'notice', 'This canvas is no longer available. Private content has been cleared. Reload after your access is restored.'));
    document.title = 'Planning canvas · Pegboard';
  }

  function createNode(node) {
    const item = make('li');
    item.dataset.canvasNode = node.id;
    const card = make('article', 'card canvas-node');
    const peg = make('span', 'peg');
    peg.setAttribute('aria-hidden', 'true');
    const title = make('a', 'canvas-node-title');
    title.dataset.canvasSelect = '';
    const detail = make('p', 'canvas-node-detail');
    detail.dataset.canvasDetail = '';
    const task = make('a', 'canvas-task-link', 'Open task');
    task.dataset.canvasTask = '';
    card.append(peg, title, detail, task);
    item.append(card);
    return item;
  }

  function patchTree(nodes) {
    const active = document.activeElement;
    const existing = new Map([...diagram.querySelectorAll('[data-canvas-node]')].map(item => [item.dataset.canvasNode, item]));
    const ids = new Set(nodes.map(node => node.id));
    existing.forEach((item, id) => { if (!ids.has(id)) item.remove(); });
    const children = new Map();
    nodes.forEach(node => {
      const parent = ids.has(node.parentId) ? node.parentId : null;
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(node);
    });
    children.forEach(branch => branch.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)));
    const visited = new Set();
    function branch(parent, host, depth) {
      const items = children.get(parent) ?? [];
      let list = [...host.children].find(child => child.tagName === 'UL');
      if (!items.length) { list?.remove(); return; }
      if (!list) { list = make('ul', 'canvas-branches'); host.append(list); }
      let index = 0;
      for (const node of items) {
        if (visited.has(node.id)) continue;
        visited.add(node.id);
        const item = existing.get(node.id) ?? createNode(node);
        item.classList.toggle('canvas-deep', depth >= 3);
        const card = item.firstElementChild;
        card.dataset.kind = node.kind;
        const title = item.querySelector('[data-canvas-select]');
        setText(title, titleOf(node));
        title.href = `${page}?node=${encodeURIComponent(node.id)}`;
        if (node.id === selected) title.setAttribute('aria-current', 'true');
        else title.removeAttribute('aria-current');
        setText(item.querySelector('[data-canvas-detail]'), detailOf(node));
        const task = item.querySelector('[data-canvas-task]');
        task.hidden = !node.task;
        if (node.task) {
          task.href = `/app/tasks/${encodeURIComponent(node.task.id)}`;
          setText(task, `Open task ${node.task.id}`);
        }
        else task.removeAttribute('href');
        const cursor = list.children[index] ?? null;
        if (item !== cursor) list.insertBefore(item, cursor);
        index += 1;
        branch(node.id, item, depth + 1);
      }
    }
    branch(null, diagram, 0);
    // Moving an existing branch must not steal keyboard focus from its link.
    if (active?.isConnected && document.activeElement !== active) active.focus({ preventScroll: true });
    root.querySelector('[data-canvas-empty]').hidden = nodes.length > 0;
  }

  function optionsFor(nodes, exclude) {
    const excluded = new Set(exclude ? [exclude] : []);
    let previous = -1;
    while (previous !== excluded.size) {
      previous = excluded.size;
      nodes.forEach(node => { if (excluded.has(node.parentId)) excluded.add(node.id); });
    }
    return [{ value: '', label: 'Project root' }, ...nodes.filter(node => !excluded.has(node.id)).map(node => ({ value: node.id, label: `${kindOf(node)} · ${titleOf(node)}` }))];
  }

  function patchOptions(select, options) {
    const value = select.value;
    const old = [...select.options];
    if (old.length === options.length && old.every((item, index) => item.value === options[index].value && item.textContent === options[index].label)) return;
    select.replaceChildren(...options.map(item => new Option(item.label, item.value)));
    select.value = options.some(item => item.value === value) ? value : '';
  }

  function controls() {
    root.querySelectorAll('form button[type=submit]').forEach(button => {
      button.disabled = busy || (conflict && !!button.closest('[data-canvas-editor]'));
    });
    const warning = root.querySelector('[data-canvas-conflict]');
    const reload = root.querySelector('[data-canvas-reload]');
    if (warning) warning.hidden = !conflict;
    if (reload) { reload.hidden = !conflict; reload.disabled = busy || !latest; }
  }

  function patchEditor(data) {
    const editor = root.querySelector('[data-canvas-editor]');
    if (!data.canEdit) root.querySelectorAll('[data-canvas-write]').forEach(element => element.remove());
    if (!data.canExport) root.querySelector('[data-canvas-export]')?.remove();
    const node = data.nodes.find(item => item.id === selected);
    if (editor && !node) {
      editor.replaceChildren(make('p', 'notice', 'This planning item is no longer available. Choose another item from the canvas.'));
    } else if (editor && node) {
      setText(editor.querySelector('[data-canvas-editor-title]'), titleOf(node));
      setText(editor.querySelector('[data-canvas-editor-detail]'), detailOf(node));
      const task = editor.querySelector('[data-canvas-editor-task]');
      if (task) {
        task.hidden = !node.task;
        if (node.task) {
          let identity = task.querySelector('[data-canvas-task-id]');
          if (!identity) { identity = make('span'); identity.dataset.canvasTaskId = ''; task.prepend(identity); }
          setText(identity, `Task ${node.task.id} · `);
          let link = task.querySelector('a');
          if (!link) { link = make('a', '', 'Edit in List'); task.append(link); }
          link.href = `/app/projects/${project}?view=list`;
          const title = editor.querySelector('[name=title]');
          if (title) title.readOnly = true;
        } else task.replaceChildren();
      }
      if (node.kind !== 'note') editor.querySelector('[data-canvas-promotion]')?.remove();
      const revision = editor.querySelector('[data-canvas-revision]');
      if (revision && Number(revision.dataset.canvasRevision) !== node.version) conflict = true;
    }
    root.querySelectorAll('select[name=parentId]').forEach(select => {
      patchOptions(select, optionsFor(data.nodes, select.closest('[data-canvas-editor]') ? selected : null));
    });
    root.querySelectorAll('select[name=ownerId]').forEach(select => patchOptions(select, [{ value: '', label: 'Choose an owner' }, ...data.people]));
    controls();
  }

  function loadRevision() {
    const node = latest?.nodes.find(item => item.id === selected);
    const editor = root.querySelector('[data-canvas-editor]');
    if (!node || !editor || !latest.canEdit) return;
    editor.querySelectorAll('[data-canvas-revision]').forEach(fieldset => {
      fieldset.dataset.canvasRevision = String(node.version);
      fieldset.querySelector('[name=version]').value = String(node.version);
      const title = fieldset.querySelector('[name=title]');
      if (title) title.value = titleOf(node);
      const parent = fieldset.querySelector('[name=parentId]');
      if (parent) parent.value = node.parentId ?? '';
      const position = fieldset.querySelector('[name=position]');
      if (position) position.value = String(node.position);
      const confirm = fieldset.querySelector('[name=confirm]');
      if (confirm) confirm.checked = false;
    });
    conflict = false;
    controls();
  }

  async function refresh() {
    if (stopped) return false;
    polling?.abort();
    const request = new AbortController();
    polling = request;
    const timeout = setTimeout(() => request.abort(), 8000);
    try {
      const response = await fetch(api, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal: request.signal });
      if (request !== polling || stopped) return false;
      if ([401, 403, 404].includes(response.status) || response.redirected) { clearPrivateContent(); return false; }
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (request !== polling || stopped) return false;
      if (!data.project || !Array.isArray(data.nodes) || !Array.isArray(data.people)) throw new Error('invalid_response');
      latest = data;
      patchTree(data.nodes);
      patchEditor(data);
      setText(root.querySelector('[data-canvas-project-name]'), data.project.name);
      setText(root.querySelector('[data-canvas-root-name]'), data.project.name);
      setText(sync, 'Live updates connected. Task details and branch positions are current.');
      return true;
    } catch {
      if (request === polling && !stopped) setText(sync, 'Updates unavailable. This canvas may be stale; your unsaved draft is preserved.');
      return false;
    } finally {
      clearTimeout(timeout);
      if (request === polling) polling = null;
    }
  }

  root.addEventListener('click', event => {
    if (event.target.closest('[data-canvas-reload]')) loadRevision();
  });
  root.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (busy || stopped || (conflict && form.closest('[data-canvas-editor]'))) return;
    busy = true;
    controls();
    const body = Object.fromEntries(new FormData(form));
    if (form.closest('[data-canvas-editor]') && latest?.nodes.find(item => item.id === selected)?.task) delete body.title;
    const request = new AbortController();
    const timeout = setTimeout(() => request.abort(), 15000);
    try {
      const response = await fetch(form.action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: request.signal });
      if (stopped) return;
      if ([401, 403, 404].includes(response.status) || response.redirected) { clearPrivateContent(); return; }
      if (response.status === 409) {
        conflict = true;
        await refresh();
        setText(sync, 'Revision conflict. Your draft was kept. Load the current revision and review it before saving again.');
      } else if (!response.ok) {
        setText(sync, 'The change was refused. Review the title, parent, position and required audience confirmation. Your draft was kept.');
      } else {
        const current = await refresh();
        if (stopped) return;
        if (current) {
          if (form.closest('[data-canvas-add]')) form.reset();
          else loadRevision();
          setText(sync, 'Saved. The canvas shows the latest project work.');
        } else setText(sync, 'The change was saved, but live updates are unavailable. Reload before submitting it again.');
      }
    } catch {
      if (!stopped) setText(sync, 'The save could not be confirmed. Your draft was kept. Reconnect and check the canvas before trying again.');
    } finally {
      clearTimeout(timeout);
      busy = false;
      if (!stopped) controls();
    }
  });
  const timer = setInterval(() => { if (!polling && !busy) void refresh(); }, 1800);
  window.addEventListener('online', () => { if (!busy) void refresh(); });
  window.addEventListener('pagehide', () => { stopped = true; clearInterval(timer); polling?.abort(); latest = null; });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  void refresh();
})();
