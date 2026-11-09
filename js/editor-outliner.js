const EditorOutliner = (() => {
  const icons = {
    layer: 'fa-layer-group',
    group: 'fa-folder',
    region: 'fa-vector-square',
  };
  const collapsed = new WeakMap();

  function focus(cell, state, node) {
    const match = StructureOps.findNode(cell, node.id);
    const target = StructureOps.firstEditableRegion(node);
    state.activeLayerId = match.layer.id;
    state.activeGroupId =
      [...match.path].reverse().find((item) => item.type === 'group')?.id ||
      null;
    state.activeRegionId =
      node.type === 'region' ? node.id : target?.id || null;
    return match;
  }

  function render(container, cell, state, callbacks) {
    container.replaceChildren();
    if (!collapsed.has(cell)) collapsed.set(cell, new Set());
    const folded = collapsed.get(cell);
    function select(row, node, extend = false) {
      if (
        state.isolatedNodeId &&
        !StructureOps.findNode(cell, node.id).path.some(
          (item) => item.id === state.isolatedNodeId,
        )
      ) {
        callbacks.exitIsolation();
      }
      const match = focus(cell, state, node);
      const selected = callbacks.focus?.(match, extend) || [];
      for (const item of container.children) {
        item.classList.toggle(
          'active',
          [
            state.activeLayerId,
            state.activeGroupId,
            state.activeRegionId,
          ].includes(item.dataset.id),
        );
        item.classList.toggle(
          'is-selected',
          selected.includes(item.dataset.id),
        );
      }
      row.focus({ preventScroll: true });
    }

    function renderNode(node, depth) {
      const match = StructureOps.findNode(cell, node.id);
      const row = document.createElement('div');
      row.className = 'structure-tree-item';
      row.dataset.id = node.id;
      row.dataset.type = node.type;
      row.tabIndex = 0;
      row.style.paddingInlineStart = Math.min(depth, 8) * 12 + 4 + 'px';
      row.classList.toggle(
        'active',
        [
          state.activeLayerId,
          state.activeGroupId,
          state.activeRegionId,
        ].includes(node.id),
      );
      row.classList.toggle(
        'is-selected',
        callbacks.selected?.().includes(node.id) || false,
      );
      row.classList.toggle('isolated', state.isolatedNodeId === node.id);
      row.classList.toggle('is-locked', !!node.locked);
      row.classList.toggle('is-hidden', node.visible === false);

      function action(label, icon, run, className = '') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'structure-action-btn ' + className;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML =
          '<i aria-hidden="true" class="fa-solid ' + icon + '"></i>';
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          run();
        });
        row.append(button);
      }

      if (node.children?.length) {
        action(
          folded.has(node.id) ? 'Expand' : 'Collapse',
          folded.has(node.id) ? 'fa-chevron-right' : 'fa-chevron-down',
          () => {
            if (folded.has(node.id)) folded.delete(node.id);
            else folded.add(node.id);
            render(container, cell, state, callbacks);
          },
          'structure-disclosure',
        );
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'structure-disclosure';
        row.append(spacer);
      }
      const icon = document.createElement('i');
      icon.className = 'fa-solid structure-node-icon ' + icons[node.type];
      const name = document.createElement('span');
      name.className = 'structure-node-name';
      name.textContent = node.name || node.id;
      name.title = `${name.textContent} · ${node.id}`;
      row.append(icon, name);

      function mutate(label, change) {
        callbacks.before?.();
        change();
        callbacks.change(label);
      }
      function rename() {
        if (!row.contains(name)) return;
        const input = document.createElement('input');
        input.className = 'structure-name-input';
        input.setAttribute('aria-label', 'Rename ' + node.type);
        input.maxLength = 256;
        input.value = name.textContent;
        name.replaceWith(input);
        input.focus();
        input.select();
        let cancelled = false;
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' || event.key === 'Enter') {
            event.stopPropagation();
            event.preventDefault();
            cancelled = event.key === 'Escape';
            input.blur();
          }
        });
        input.addEventListener(
          'blur',
          () => {
            const value = input.value.trim().normalize('NFC');
            input.replaceWith(name);
            if (!cancelled && value && value !== node.name)
              mutate('Rename ' + node.type, () => {
                node.name = value;
              });
          },
          { once: true },
        );
      }

      if (node.type === 'layer') {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.max = 100;
        input.className = 'structure-opacity-input editor-layer-opacity';
        input.setAttribute('aria-label', 'Layer opacity (%)');
        input.value = Math.round((node.opacity ?? 1) * 100);
        input.addEventListener('change', () => {
          const next = Number.isFinite(input.valueAsNumber)
            ? Math.max(0, Math.min(100, input.valueAsNumber)) / 100
            : (node.opacity ?? 1);
          input.value = Math.round(next * 100);
          if (next !== (node.opacity ?? 1))
            mutate('Layer opacity', () => {
              node.opacity = next;
            });
        });
        row.append(input);
      }
      const visibility = () =>
        mutate('Toggle visibility', () => {
          node.visible = node.visible === false;
        });
      const lock = () =>
        mutate('Toggle lock', () => {
          node.locked = !node.locked;
        });
      const remove = () => {
        if (
          !confirm('Delete ' + node.type + ' "' + (node.name || node.id) + '"?')
        )
          return;
        mutate('Delete ' + node.type, () => {
          match.siblings.splice(match.siblings.indexOf(node), 1);
          if (node.type === 'layer' && !cell.layers.length) cell.pixels = {};
          for (const key of [
            'activeLayerId',
            'activeGroupId',
            'activeRegionId',
            'isolatedNodeId',
          ]) {
            if (!StructureOps.findNode(cell, state[key])) state[key] = null;
          }
        });
      };
      action(
        node.visible === false ? 'Show' : 'Hide',
        node.visible === false ? 'fa-eye-slash' : 'fa-eye',
        visibility,
        'btn-vis',
      );
      action(
        node.locked ? 'Unlock' : 'Lock',
        node.locked ? 'fa-lock' : 'fa-lock-open',
        lock,
        'btn-lock',
      );
      action('Delete', 'fa-trash', remove, 'btn-del');

      function cloneNode(source, parentId, clearFlags = false) {
        const clone = {
          ...source,
          id: newId(source.type),
          cell: cell.id,
          parent: parentId,
        };
        if (source.pixels) clone.pixels = { ...source.pixels };
        if (source.tags) clone.tags = [...source.tags];
        if (source.children)
          clone.children = source.children.map((child) =>
            cloneNode(child, clone.id),
          );
        if (clearFlags) {
          clone.visible = true;
          clone.locked = false;
        }
        return clone;
      }
      const commands = {
        rename,
        duplicate: () =>
          mutate('Duplicate ' + node.type, () => {
            const clone = cloneNode(node, match.parent?.id);
            clone.name = (node.name || node.id) + ' Copy';
            match.siblings.splice(match.siblings.indexOf(node) + 1, 0, clone);
          }),
        isolate: () => {
          if (state.isolatedNodeId === node.id) callbacks.exitIsolation();
          else if (StructureOps.isEditable(match)) callbacks.isolate(node);
        },
        visibility,
        lock,
        delete: remove,
        content: () => {
          select(row, node);
          callbacks.selectContent?.(match);
        },
        extract: () =>
          mutate('Extract to new region', () => {
            const clone = cloneNode(node, match.parent?.id, true);
            clone.name = (node.name || node.id) + ' Extracted';
            match.siblings.splice(match.siblings.indexOf(node) + 1, 0, clone);
          }),
        up: () => reorder(1),
        down: () => reorder(-1),
        'add-group': () => addChild('group'),
        'add-region': () => addChild('region'),
      };
      function newId(type) {
        const suffix =
          globalThis.crypto?.randomUUID?.() ||
          Date.now().toString(36) + Math.random().toString(36).slice(2);
        return type + '_' + suffix.replaceAll('-', '');
      }
      function addChild(type) {
        if (!StructureOps.isEditable(match)) return;
        const name = prompt(
          type === 'group' ? 'Name the subgroup' : 'Name the region',
          type === 'group' ? 'New Group' : 'New Region',
        )?.trim();
        if (!name) return;
        mutate('Add ' + type, () => {
          node.children ||= [];
          node.children.push({
            id: newId(type),
            type,
            name: name.normalize('NFC').slice(0, 256),
            cell: cell.id,
            parent: node.id,
            visible: true,
            locked: false,
            ...(type === 'group' ? { children: [] } : { pixels: {} }),
          });
          folded.delete(node.id);
        });
      }
      function reorder(delta) {
        const index = match.siblings.indexOf(node);
        if (!match.siblings[index + delta]) return;
        mutate('Reorder ' + node.type, () => StructureOps.reorderNode(cell, node.id, delta));
      }
      function context(x, y) {
        const entries = [
          ['rename', 'Rename', 'fa-pen-to-square', 'F2'],
          ['duplicate', 'Duplicate', 'fa-copy'],
          ...(node.type !== 'region'
            ? [
                ['add-group', 'Add Subgroup', 'fa-folder-plus'],
                ['add-region', 'Add Region', 'fa-vector-square'],
              ]
            : []),
          [
            'isolate',
            state.isolatedNodeId === node.id ? 'Exit Isolation' : 'Isolate',
            'fa-crosshairs',
          ],
          ...(node.type === 'region'
            ? [
                ['content', 'Select Content', 'fa-vector-square'],
                [
                  'extract',
                  'Extract to New Region',
                  'fa-arrow-right-from-bracket',
                ],
              ]
            : []),
          ['up', 'Move Up', 'fa-arrow-up'],
          ['down', 'Move Down', 'fa-arrow-down'],
          [],
          ['visibility', node.visible === false ? 'Show' : 'Hide', 'fa-eye'],
          ['lock', node.locked ? 'Unlock' : 'Lock', 'fa-lock'],
          ['delete', 'Delete', 'fa-trash'],
        ];
        EditorMenu.open(entries, x, y, (id) => commands[id]());
      }

      row.addEventListener('click', (event) => {
        if (!event.target.closest('input,button'))
          select(row, node, event.ctrlKey || event.metaKey || event.shiftKey);
      });
      name.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        rename();
      });
      row.addEventListener('keydown', (event) => {
        if (event.target !== row) return;
        if (event.key === 'F2') {
          event.preventDefault();
          rename();
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          select(row, node);
        }
        if (
          event.key === 'ContextMenu' ||
          (event.shiftKey && event.key === 'F10')
        ) {
          event.preventDefault();
          const box = row.getBoundingClientRect();
          context(box.left, box.bottom);
        }
      });
      row.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        context(event.clientX, event.clientY);
      });

      const grip = document.createElement('span');
      grip.className = 'structure-drag-grip';
      grip.title = 'Drag up to bring forward or down to send backward';
      grip.innerHTML =
        '<i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>';
      row.prepend(grip);
      let pointerId;
      let origin;
      let targetRow;
      let marker;
      function clearMarker() {
        targetRow?.classList.remove('drop-before', 'drop-after', 'drop-inside');
        targetRow = null;
        marker = null;
      }
      function targetAt(event) {
        const list = container.getBoundingClientRect();
        if (
          event.clientX < list.left - 24 ||
          event.clientX > list.right + 24 ||
          event.clientY < list.top - 32 ||
          event.clientY > list.bottom + 24
        )
          return null;
        let element = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest('.structure-tree-item');
        if (element && !container.contains(element)) element = null;
        if (node.type === 'layer' && element?.dataset.type !== 'layer') {
          const layerId =
            element &&
            StructureOps.findNode(cell, element.dataset.id)?.layer.id;
          element = [...container.children].find(
            (item) => item.dataset.id === layerId,
          );
        }
        if (!element) {
          const rows = [...container.children].filter(
            (item) => node.type !== 'layer' || item.dataset.type === 'layer',
          );
          let distance = Infinity;
          for (const item of rows) {
            const box = item.getBoundingClientRect();
            const next = Math.abs(event.clientY - (box.top + box.height / 2));
            if (next < distance) {
              distance = next;
              element = item;
            }
          }
        }
        if (!element || element === row) return null;
        const target = StructureOps.findNode(cell, element.dataset.id);
        if (
          !target ||
          (node.type === 'layer' && target.node.type !== 'layer') ||
          target.path.some((ancestor) => ancestor.id === node.id)
        )
          return null;
        const bounds = element.getBoundingClientRect();
        const position = (event.clientY - bounds.top) / bounds.height;
        const inside =
          node.type !== 'layer' &&
          target.node.type !== 'region' &&
          position > 0.3 &&
          position < 0.7 &&
          StructureOps.isEditable(target);
        const parentId = inside ? target.node.id : target.parent?.id || null;
        if (
          node.type !== 'layer' &&
          !StructureOps.isEditable(StructureOps.findNode(cell, parentId))
        )
          return null;
        return { element, target, parentId, inside, after: position >= 0.5 };
      }
      grip.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || !StructureOps.isEditable(match)) return;
        pointerId = event.pointerId;
        origin = { x: event.clientX, y: event.clientY };
        grip.setPointerCapture(pointerId);
        event.preventDefault();
        event.stopPropagation();
      });
      grip.addEventListener('pointermove', (event) => {
        if (event.pointerId !== pointerId) return;
        const hit = targetAt(event);
        const nextMarker =
          hit &&
          (hit.inside
            ? 'drop-inside'
            : hit.after
              ? 'drop-after'
              : 'drop-before');
        if (targetRow === hit?.element && marker === nextMarker) return;
        clearMarker();
        if (!hit) return;
        targetRow = hit.element;
        marker = nextMarker;
        targetRow.classList.add(marker);
      });
      grip.addEventListener('pointerup', (event) => {
        if (event.pointerId !== pointerId) return;
        pointerId = undefined;
        clearMarker();
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 4)
          return;
        const hit = targetAt(event);
        if (!hit) return;
        callbacks.before?.();
        // Rows are front-to-back. Inserting above a row means inserting after
        // that node in the PIX2 back-to-front paint order.
        const index = hit.inside ? null : hit.target.index + Number(!hit.after);
        if (
          hit.target.siblings === match.siblings &&
          !hit.inside &&
          (index === match.index || index === match.index + 1)
        )
          return;
        const result = StructureOps.moveNode(
          cell,
          node.id,
          hit.parentId,
          index,
        );
        if (result.ok) callbacks.change('Move ' + node.type);
      });
      for (const type of ['pointercancel', 'lostpointercapture']) {
        grip.addEventListener(type, () => {
          pointerId = undefined;
          clearMarker();
        });
      }
      grip.addEventListener('click', (event) => event.stopPropagation());
      container.append(row);
      if (!folded.has(node.id))
        for (const child of (node.children || []).slice().reverse()) renderNode(child, depth + 1);
    }
    for (const layer of cell.layers.slice().reverse()) renderNode(layer, 0);
  }

  return { render };
})();
