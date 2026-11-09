/**
 * PIX2 structural tree operations shared by Studio and PixelArt.
 * This module only mutates a cell's hierarchy; each product owns rendering,
 * history, dirty state, and UI notifications around the transaction.
 */
const StructureOps = (function () {
  'use strict';

  function findNode(cell, nodeId) {
    if (!cell || !Array.isArray(cell.layers) || !nodeId) return null;
    function visit(nodes, parent, layer) {
      for (let index = 0; index < (nodes || []).length; index++) {
        const node = nodes[index];
        const owningLayer = layer || (node.type === 'layer' ? node : null);
        if (node.id === nodeId) return { cell, node, parent, layer: owningLayer, siblings: nodes, index };
        const result = visit(node.children, node, owningLayer);
        if (result) return result;
      }
      return null;
    }
    return visit(cell.layers, null, null);
  }

  function containsId(node, nodeId) {
    if (!node) return false;
    if (node.id === nodeId) return true;
    return (node.children || []).some(child => containsId(child, nodeId));
  }

  function refreshParentage(node, cellId, parentId) {
    node.cell = cellId;
    node.parent = parentId || undefined;
    for (const child of node.children || []) refreshParentage(child, cellId, node.id);
  }

  function moveNode(cell, nodeId, targetParentId = null, targetIndex = null) {
    const source = findNode(cell, nodeId);
    if (!source) return { ok: false, reason: 'missing-source' };
    const isLayer = source.node.type === 'layer';
    let destination = null;
    if (isLayer) {
      if (targetParentId) return { ok: false, reason: 'layer-must-be-root' };
      destination = { node: null, siblings: cell.layers };
    } else {
      const parent = findNode(cell, targetParentId);
      if (!parent || (parent.node.type !== 'layer' && parent.node.type !== 'group')) return { ok: false, reason: 'invalid-parent' };
      if (containsId(source.node, parent.node.id)) return { ok: false, reason: 'cycle' };
      if (parent.node.locked || parent.node.visible === false) return { ok: false, reason: 'parent-not-editable' };
      parent.node.children = parent.node.children || [];
      destination = { node: parent.node, siblings: parent.node.children };
    }

    source.siblings.splice(source.index, 1);
    let index = targetIndex === null ? destination.siblings.length : Math.max(0, Math.min(destination.siblings.length, targetIndex));
    if (source.siblings === destination.siblings && source.index < index) index--;
    destination.siblings.splice(index, 0, source.node);
    refreshParentage(source.node, cell.id, destination.node ? destination.node.id : null);
    return { ok: true, node: source.node, parent: destination.node, index };
  }

  function reorderNode(cell, nodeId, direction) {
    const match = findNode(cell, nodeId);
    if (!match || !Number.isInteger(direction) || direction === 0) return { ok: false, reason: 'invalid-request' };
    const nextIndex = Math.max(0, Math.min(match.siblings.length - 1, match.index + Math.sign(direction)));
    if (nextIndex === match.index) return { ok: false, reason: 'boundary' };
    return moveNode(cell, nodeId, match.parent ? match.parent.id : null, nextIndex);
  }

  function bounds(node) {
    const pixels = {};
    (function collect(current) {
      if (current.pixels) Object.assign(pixels, current.pixels);
      (current.children || []).forEach(collect);
    })(node);
    const keys = Object.keys(pixels);
    if (!keys.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const key of keys) {
      const [x, y] = key.split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, pixelCount: keys.length } : null;
  }

  function normalizeRasterOwnership(cell) {
    if (!cell || !Array.isArray(cell.layers)) return { changed: false, createdRegionIds: [], migratedPixelCount: 0 };
    const usedIds = new Set();
    (function collectIds(nodes) {
      for (const node of nodes || []) {
        if (node.id) usedIds.add(node.id);
        collectIds(node.children);
      }
    })(cell.layers);

    let changed = false;
    let migratedPixelCount = 0;
    const createdRegionIds = [];
    function uniqueRegionId(owner) {
      const stem = `region_content_${String(owner.id || 'node').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      let id = stem;
      let suffix = 2;
      while (usedIds.has(id)) id = `${stem}_${suffix++}`;
      usedIds.add(id);
      return id;
    }
    function hasRegion(node) {
      if (node.type === 'region') return true;
      return (node.children || []).some(hasRegion);
    }
    function normalizeNode(node) {
      if (!node || node.type === 'region') return;
      node.children = Array.isArray(node.children) ? node.children : [];
      const ownedPixels = node.pixels && typeof node.pixels === 'object' ? node.pixels : null;
      const needsRasterOwner = Boolean(ownedPixels && Object.keys(ownedPixels).length) || (node.type === 'layer' && !hasRegion(node));
      if (needsRasterOwner) {
        const id = uniqueRegionId(node);
        const pixels = ownedPixels ? { ...ownedPixels } : {};
        node.children.unshift({
          type: 'region',
          id,
          cell: cell.id,
          parent: node.id,
          name: `${node.name || 'Layer'} Content`,
          visible: true,
          locked: false,
          pixels
        });
        migratedPixelCount += Object.keys(pixels).length;
        createdRegionIds.push(id);
        delete node.pixels;
        changed = true;
      }
      for (const child of node.children) normalizeNode(child);
    }
    for (const layer of cell.layers) normalizeNode(layer);
    return { changed, createdRegionIds, migratedPixelCount };
  }

  return { findNode, moveNode, reorderNode, bounds, normalizeRasterOwnership };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = StructureOps;
