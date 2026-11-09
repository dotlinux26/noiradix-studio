/**
 * Region selection and drag transactions shared by both editor viewports.
 * Selection IDs are scoped to the cell object, layer and isolation view.
 */
const RegionSelection = (function () {
  'use strict';

  function create() {
    let scope;
    let ids = [];
    let drag = null;

    function resolve(cell, layerId, isolatedId) {
      if (
        scope?.cell !== cell ||
        scope?.layerId !== layerId ||
        scope?.isolatedId !== isolatedId
      ) {
        scope = { cell, layerId, isolatedId };
        ids = [];
        drag = null;
      }
      ids = ids.filter((id) =>
        StructureOps.isEditable(StructureOps.findNode(cell, id)),
      );
      return ids.map((id) => StructureOps.findNode(cell, id).node);
    }

    function focus(cell, layerId, isolatedId, nodeIds) {
      resolve(cell, layerId, isolatedId);
      ids = nodeIds;
    }

    function toggle(cell, layerId, isolatedId, id) {
      resolve(cell, layerId, isolatedId);
      ids = ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids, id];
      return resolve(cell, layerId, isolatedId).map((node) => node.id);
    }

    function start(cell, layerId, isolatedId, point, extend, view) {
      const nodes = resolve(cell, layerId, isolatedId);
      const box = nodes.length
        ? StructureOps.bounds({ children: nodes })
        : null;
      if (!extend && box && view) {
        const handle = SelectionTransform.hitTestSelectionHandles(
          box,
          view.x,
          view.y,
          view.zoom,
        );
        if (handle && handle !== 'body') {
          drag = {
            handle,
            box,
            initialAngle: angleAt(box, view),
            angle: 0,
            nextBox: box,
          };
          return null;
        }
      }
      const hit = StructureOps.hitRegion(
        cell,
        point.x,
        point.y,
        layerId,
        isolatedId,
      );
      if (!hit) {
        if (!extend) ids = [];
        return null;
      }
      const inScope = isolatedId
        ? hit.path.slice(hit.path.findIndex((node) => node.id === isolatedId))
        : hit.path.slice(1);
      const target = inScope[0] || hit.node;
      if (extend) {
        ids = ids.includes(target.id)
          ? ids.filter((id) => id !== target.id)
          : [...ids, target.id];
      } else {
        if (!ids.includes(target.id)) ids = [target.id];
        drag = { cell, layerId, isolatedId, point, dx: 0, dy: 0 };
      }
      return hit;
    }

    function angleAt(box, view) {
      return Math.atan2(
        view.y / view.zoom - box.y - box.h / 2,
        view.x / view.zoom - box.x - box.w / 2,
      );
    }

    function move(point, view) {
      if (!drag || !point) return false;
      if (drag.handle === 'rot' && view) {
        let angle = angleAt(drag.box, view) - drag.initialAngle;
        if (view.shift)
          angle = (Math.round(angle / (Math.PI / 12)) * Math.PI) / 12;
        drag.angle = angle;
        const cosine = Math.abs(Math.cos(angle));
        const sine = Math.abs(Math.sin(angle));
        const w = Math.max(
          1,
          Math.round(drag.box.w * cosine + drag.box.h * sine),
        );
        const h = Math.max(
          1,
          Math.round(drag.box.w * sine + drag.box.h * cosine),
        );
        drag.nextBox = {
          x: Math.round(drag.box.x + (drag.box.w - w) / 2),
          y: Math.round(drag.box.y + (drag.box.h - h) / 2),
          w,
          h,
        };
        return true;
      }
      if (drag.handle) {
        drag.nextBox = SelectionTransform.computeScaledBounds(
          drag.box,
          drag.handle,
          point.x,
          point.y,
          view?.shift,
        );
        return true;
      }
      drag.dx = point.x - drag.point.x;
      drag.dy = point.y - drag.point.y;
      return true;
    }

    function release(cell, layerId, isolatedId, size, beforeChange, notify) {
      const nodes = resolve(cell, layerId, isolatedId);
      const gesture = drag;
      drag = null;
      if (gesture?.handle)
        return applyTransform(nodes, gesture, size, beforeChange, notify);
      return Boolean(
        gesture && translate(nodes, gesture.dx, gesture.dy, size, beforeChange),
      );
    }

    function editableRasters(nodes) {
      const rasters = new Set();
      function collect(node) {
        if (node.locked) return false;
        if (node.pixels) rasters.add(node);
        return (node.children || []).every(collect);
      }
      return nodes.every(collect) ? rasters : null;
    }

    function applyTransform(nodes, gesture, size, beforeChange, notify) {
      const rasters = editableRasters(nodes);
      const { box, nextBox, angle, handle } = gesture;
      if (
        !rasters?.size ||
        nextBox.w > size.w ||
        nextBox.h > size.h ||
        (!angle &&
          ['x', 'y', 'w', 'h'].every((key) => box[key] === nextBox[key]))
      )
        return false;
      const left = Math.max(0, Math.min(size.w - nextBox.w, nextBox.x));
      const top = Math.max(0, Math.min(size.h - nextBox.h, nextBox.y));
      const changes = new Map();
      for (const node of rasters) {
        const local = {};
        for (const [key, color] of Object.entries(node.pixels)) {
          const [x, y] = key.split(',').map(Number);
          local[`${x - box.x},${y - box.y}`] = color;
        }
        const transformed =
          handle === 'rot'
            ? SelectionTransform.rotatePixelsNearestNeighbor(
                local,
                box.w,
                box.h,
                angle,
              ).pixels
            : SelectionTransform.scalePixelsNearestNeighbor(
                local,
                box.w,
                box.h,
                nextBox.w,
                nextBox.h,
              );
        if (Object.keys(local).length && !Object.keys(transformed).length) {
          notify?.(`Transform would erase all pixels in ${node.name || node.id}. Keep a larger selection.`);
          return false;
        }
        const pixels = {};
        for (const [key, color] of Object.entries(transformed)) {
          const [x, y] = key.split(',').map(Number);
          pixels[`${left + x},${top + y}`] = color;
        }
        changes.set(node, pixels);
      }
      beforeChange();
      for (const [node, pixels] of changes) node.pixels = pixels;
      return true;
    }

    function translate(nodes, dx, dy, size, beforeChange) {
      if (!dx && !dy) return false;
      const rasters = editableRasters(nodes);
      if (!rasters) return false;
      const box = StructureOps.bounds({ children: nodes });
      if (!box || box.w > size.w || box.h > size.h) return false;
      dx = Math.max(-box.x, Math.min(size.w - box.x - box.w, dx));
      dy = Math.max(-box.y, Math.min(size.h - box.y - box.h, dy));
      if (!dx && !dy) return false;
      beforeChange();
      for (const node of rasters) {
        const translated = {};
        for (const [key, color] of Object.entries(node.pixels)) {
          const [x, y] = key.split(',').map(Number);
          translated[`${x + dx},${y + dy}`] = color;
        }
        node.pixels = translated;
      }
      return true;
    }

    function nudge(cell, layerId, isolatedId, size, key, beforeChange) {
      const delta = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[key];
      return Boolean(
        delta &&
        !drag &&
        translate(
          resolve(cell, layerId, isolatedId),
          ...delta,
          size,
          beforeChange,
        ),
      );
    }

    function rotate90(cell, layerId, isolatedId, size, beforeChange) {
      const nodes = resolve(cell, layerId, isolatedId);
      const box = nodes.length
        ? StructureOps.bounds({ children: nodes })
        : null;
      if (drag || !box) return false;
      const nextBox = {
        x: Math.round(box.x + (box.w - box.h) / 2),
        y: Math.round(box.y + (box.h - box.w) / 2),
        w: box.h,
        h: box.w,
      };
      return applyTransform(
        nodes,
        { box, nextBox, angle: Math.PI / 2, handle: 'rot' },
        size,
        beforeChange,
      );
    }

    function draw(ctx, zoom, cell, layerId, isolatedId) {
      const nodes = resolve(cell, layerId, isolatedId);
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#312e81';
      const box =
        drag?.nextBox ||
        (nodes.length ? StructureOps.bounds({ children: nodes }) : null);
      if (box) {
        const bounds = {
          ...box,
          x: box.x + (drag?.dx || 0),
          y: box.y + (drag?.dy || 0),
        };
        const x = bounds.x * zoom;
        const y = bounds.y * zoom;
        ctx.setLineDash([]);
        ctx.strokeStyle = '#312e81';
        ctx.strokeRect(x + 0.5, y + 0.5, box.w * zoom, box.h * zoom);
        SelectionTransform.drawHandles(ctx, bounds, zoom);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x + 0.5, y + 0.5, box.w * zoom, box.h * zoom);
      }
      ctx.restore();
    }

    function cancel() {
      const wasDragging = Boolean(drag);
      drag = null;
      return wasDragging;
    }

    function reset() {
      scope = undefined;
      ids = [];
      drag = null;
    }

    return {
      resolve,
      focus,
      toggle,
      start,
      move,
      release,
      nudge,
      rotate90,
      draw,
      cancel,
      reset,
    };
  }

  function bindActions(selection, getCell, state, onChange, notify) {
    function selectedNodes() {
      const cell = getCell();
      const nodes = cell && !state.isolatedNodeId
        ? selection.resolve(cell, state.activeLayerId, null)
        : [];
      return { cell, nodes };
    }

    function apply(action, { cell, nodes }) {
      if (!nodes.length) {
        notify('Select regions outside isolation first');
        return;
      }
      const group = action === 'group';
      const result = group
        ? StructureOps.groupNodes(cell, nodes.map(node => node.id))
        : nodes.length === 1 ? StructureOps.ungroupNode(cell, nodes[0].id) : null;
      if (!result) {
        notify(group
          ? 'Ctrl/Cmd-click adjacent items in the same layer or group'
          : 'Select one editable group');
        return;
      }
      const focused = Array.isArray(result) ? result : [result];
      selection.focus(cell, state.activeLayerId, null, focused.map(node => node.id));
      onChange(cell, group ? 'Group' : 'Ungroup');
    }

    for (const [action, shortcut] of [
      ['group', 'Ctrl/Cmd+G'],
      ['ungroup', 'Ctrl/Cmd+Shift+G'],
    ]) {
      for (const button of document.querySelectorAll(
        `#btn-${action}-regions, [data-region-action="${action}"]`,
      )) {
        button.title = `${button.title} · ${shortcut}`;
        button.setAttribute('aria-keyshortcuts', action === 'group'
          ? 'Control+G Meta+G'
          : 'Control+Shift+G Meta+Shift+G');
        button.addEventListener('click', () => apply(action, selectedNodes()));
      }
    }
    window.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'g') return;
      const target = event.target;
      if (target.isContentEditable || target.closest?.('input, textarea, select, [role="menu"], [role="dialog"]')) return;
      if (Array.from(document.querySelectorAll('.studio-modal-backdrop:not(.hidden), .pa-modal-backdrop:not(.hidden)'))
        .some(modal => modal.getClientRects().length)) return;
      const selected = selectedNodes();
      const { nodes } = selected;
      if (event.shiftKey ? nodes.length !== 1 || nodes[0].type !== 'group' : nodes.length < 2) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) apply(event.shiftKey ? 'ungroup' : 'group', selected);
    }, { capture: true });
  }

  return { create, bindActions };
})();
