/** Transient selection source ownership shared by the two editors. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./selection-transform.js'), require('./structure-operations.js'));
  else root.EditorMultiSelection = factory(root.SelectionTransform, StructureOps);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (transform, structure) {
  'use strict';

  function painted(color) {
    return Boolean(color && color !== 'transparent' && !(/^#(?:[\da-f]{3}0|[\da-f]{6}00)$/i).test(color));
  }

  function targets(cell, allLayers, activeId, isolationId) {
    if (!cell) return [];
    if (!cell.layers?.length) return [cell];
    const result = [];
    function walk(nodes, eligible, isolated) {
      for (const node of nodes || []) {
        const allowed = eligible && node.visible !== false && !node.locked;
        if (!allowed) continue;
        const inside = isolated || node.id === isolationId;
        if (node.type === 'region' && (!isolationId || inside) && (allLayers || node.id === activeId)) result.push(node);
        walk(node.children, allowed, inside);
      }
    }
    walk(cell.layers, true, false);
    return result;
  }

  function begin(doc, cell, sources, bounds, mask = null) {
    if (!doc || doc.cells?.[cell?.id] !== cell || !sources?.length) return null;
    const items = [];
    for (const target of sources) {
      if (target !== cell && !structure.isEditable(structure.findNode(cell, target.id))) return null;
      const all = transform.copyPixels(target, bounds);
      const pixels = {};
      for (const key of Object.keys(all)) {
        const [x, y] = key.split(',').map(Number);
        if (!mask || (mask.has(`${bounds.x + x},${bounds.y + y}`) && painted(all[key]))) pixels[key] = all[key];
      }
      if (Object.keys(pixels).length) items.push({ target, baseline: { ...pixels }, pixels });
    }
    if (!items.length) return null;
    for (const item of items) for (const key of Object.keys(item.pixels)) {
      const [x, y] = key.split(',').map(Number);
      delete item.target.pixels[`${bounds.x + x},${bounds.y + y}`];
    }
    return { doc, cell, bounds: { ...bounds }, items };
  }

  function addPaintedStroke(mask, sources, from, to, size) {
    let x = from.x, y = from.y;
    const dx = Math.abs(to.x - x), dy = Math.abs(to.y - y);
    const sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
    let error = dx - dy;
    while (true) {
      if (x >= 0 && y >= 0 && x < size.w && y < size.h) {
        const key = `${x},${y}`;
        if (sources.some(source => {
          const color = source.pixels?.[key];
          return painted(color);
        })) mask.add(key);
      }
      if (x === to.x && y === to.y) break;
      const twice = 2 * error;
      if (twice > -dy) { error -= dy; x += sx; }
      if (twice < dx) { error += dx; y += sy; }
    }
    return mask;
  }

  function maskBounds(mask) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const coordinate of mask) {
      const [x, y] = coordinate.split(',').map(Number);
      if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
  }

  function drawMask(context, mask, zoom) {
    if (!mask) return false;
    for (const key of mask) {
      const [x, y] = key.split(',').map(Number);
      context.fillRect(x * zoom, y * zoom, zoom, zoom);
    }
    return true;
  }

  function paintedBounds(sources, mask = null, bounds = null) {
    const coordinates = new Set();
    for (const source of sources) for (const [key, color] of Object.entries(source.pixels || {})) {
      const [x, y] = key.split(',').map(Number);
      if ((!mask || mask.has(key)) && (!bounds || (x >= bounds.x && y >= bounds.y &&
          x < bounds.x + bounds.w && y < bounds.y + bounds.h)) && painted(color)) coordinates.add(key);
    }
    return maskBounds(coordinates);
  }

  function freeGesture(sources, size) {
    const mask = new Set();
    let previous = null;
    let waiting = false;
    function finish() {
      previous = null;
      waiting = false;
      return { mask: new Set(mask), bounds: maskBounds(mask) };
    }
    return {
      start(point, additive) {
        if (!waiting || !additive) mask.clear();
        waiting = Boolean(additive);
        previous = point;
        addPaintedStroke(mask, sources, point, point, size);
      },
      move(point) {
        if (!previous) return;
        addPaintedStroke(mask, sources, previous, point, size);
        previous = point;
      },
      release(additive) {
        previous = null;
        waiting = Boolean(additive);
        return waiting ? null : finish();
      },
      releaseModifier() { return waiting && !previous ? finish() : null; },
      cancel() { mask.clear(); previous = null; waiting = false; },
      get mask() { return new Set(mask); }
    };
  }

  // Alignment is computed once for the union, never independently per region.
  function alignmentOffset(bounds, size, direction) {
    const right = size.w - bounds.w;
    const bottom = size.h - bounds.h;
    switch (direction) {
      case 'left': return { x: -bounds.x, y: 0 };
      case 'right': return { x: right - bounds.x, y: 0 };
      case 'top': return { x: 0, y: -bounds.y };
      case 'bottom': return { x: 0, y: bottom - bounds.y };
      case 'center-horizontal': return { x: Math.floor(right / 2) - bounds.x, y: 0 };
      case 'center-vertical': return { x: 0, y: Math.floor(bottom / 2) - bounds.y };
      case 'center': return { x: Math.floor(right / 2) - bounds.x, y: Math.floor(bottom / 2) - bounds.y };
      default: return null;
    }
  }

  function attached(session, target) {
    return session.doc.cells?.[session.cell.id] === session.cell &&
      (target === session.cell || structure.findNode(session.cell, target.id)?.node === target);
  }

  function cancel(session, size) {
    if (!session) return;
    for (const item of session.items) if (attached(session, item.target))
      transform.placePixels(item.target, item.baseline, session.bounds, size);
  }

  function commit(session, bounds, size, activeDocument = session?.doc, activeCell = session?.cell) {
    if (!session) return false;
    const valid = session.doc === activeDocument && session.cell === activeCell && session.items.every(({ target }) => attached(session, target) &&
      (target === session.cell || structure.isEditable(structure.findNode(session.cell, target.id))));
    if (!valid) { cancel(session, size); return false; }
    for (const item of session.items) transform.placePixels(item.target, item.pixels, bounds, size);
    return true;
  }

  // Preview the transformed sources in their original z-order and opacity.
  // The live document remains untouched while the pointer moves.
  function preview(session, bounds, size, compiler, options = {}) {
    if (!session || !compiler) return null;
    const cell = JSON.parse(JSON.stringify(session.cell));
    for (const item of session.items) {
      const target = item.target === session.cell ? cell : structure.findNode(cell, item.target.id)?.node;
      if (!target) return null;
      transform.placePixels(target, item.pixels, bounds, size);
    }
    return cell.layers?.length ? compiler.compositeCellLayers(cell, size, options) : { ...cell.pixels };
  }

  function snapshot(session) {
    return session.items.map(item => ({ ...item.pixels }));
  }
  function recolor(session, color) {
    if (!session) return;
    for (const item of session.items) for (const key of Object.keys(item.pixels)) item.pixels[key] = color;
  }
  function remove(session) {
    if (!session) return;
    for (const item of session.items) item.pixels = {};
  }
  function scale(session, sourceBounds, destinationBounds, originals = snapshot(session)) {
    session.items.forEach((item, index) => { item.pixels = transform.scalePixelsNearestNeighbor(originals[index],
      sourceBounds.w, sourceBounds.h, destinationBounds.w, destinationBounds.h); });
  }
  function rotate(session, sourceBounds, angle, originals = snapshot(session)) {
    session.items.forEach((item, index) => { item.pixels = transform.rotatePixelsNearestNeighbor(originals[index],
      sourceBounds.w, sourceBounds.h, angle).pixels; });
  }
  function flip(session, bounds, horizontal) {
    for (const item of session.items) {
      const pixels = {};
      for (const key of Object.keys(item.pixels)) {
        const [x, y] = key.split(',').map(Number);
        pixels[`${horizontal ? bounds.w - 1 - x : x},${horizontal ? y : bounds.h - 1 - y}`] = item.pixels[key];
      }
      item.pixels = pixels;
    }
  }
  return { targets, begin, cancel, commit, preview, scale, rotate, flip, snapshot, recolor, remove, addPaintedStroke, maskBounds, paintedBounds, alignmentOffset, freeGesture, drawMask };
});
