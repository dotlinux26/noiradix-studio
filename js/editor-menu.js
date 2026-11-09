const EditorMenu = (() => {
  const actions = [
    ['cut', 'Cut', 'fa-scissors', 'Ctrl+X'],
    ['copy', 'Copy', 'fa-copy', 'Ctrl+C'],
    ['paste', 'Paste', 'fa-paste', 'Ctrl+V'],
    [],
    ['select-all', 'Select All', 'fa-vector-square', 'Ctrl+A'],
    ['deselect', 'Deselect', 'fa-xmark', 'Ctrl+D'],
    [],
    ['fill', 'Fill', 'fa-fill-drip'],
    ['flip-h', 'Flip Horizontal', 'fa-arrows-left-right'],
    ['flip-v', 'Flip Vertical', 'fa-arrows-up-down'],
    ['rotate-90', 'Rotate 90°', 'fa-rotate-right'],
    ['align-center', 'Align Center', 'fa-align-center'],
    [],
    ['delete', 'Delete', 'fa-trash', 'Del'],
  ];

  function populate(menu, entries = actions, run) {
    menu.replaceChildren();
    for (const [id, label, icon, shortcut] of entries) {
      if (!id) {
        const divider = document.createElement('div');
        divider.className = 'context-menu-divider';
        menu.append(divider);
        continue;
      }
      const item = document.createElement('button');
      item.type = 'button';
      item.dataset.action = id;
      item.className =
        'context-menu-item' + (id === 'delete' ? ' text-danger' : '');
      const glyph = document.createElement('i');
      glyph.className = 'fa-solid ' + icon;
      const text = document.createElement('span');
      text.textContent = label;
      item.append(glyph, text);
      if (shortcut) {
        const hint = document.createElement('kbd');
        hint.textContent = shortcut;
        item.append(hint);
      }
      if (run) item.addEventListener('click', () => run(id));
      menu.append(item);
    }
  }

  function position(menu, x, y) {
    menu.classList.remove('hidden');
    menu.style.left =
      Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top =
      Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8)) + 'px';
  }

  let current;
  function open(entries, x, y, run) {
    current?.remove();
    const menu = document.createElement('div');
    current = menu;
    menu.className = 'studio-context-menu editor-node-menu';
    const abort = new AbortController();
    const close = () => {
      menu.remove();
      if (current === menu) current = null;
      abort.abort();
    };
    populate(menu, entries, (id) => {
      close();
      run(id);
    });
    document.body.append(menu);
    position(menu, x, y);
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!menu.contains(event.target)) close();
      },
      { signal: abort.signal },
    );
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') close();
      },
      { signal: abort.signal },
    );
    menu.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  return { populate, position, open };
})();
