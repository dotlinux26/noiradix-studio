/** Floating raster ownership and settlement shared by both editor adapters. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(
      require('./selection-transform.js'),
      require('./structure-operations.js'),
    );
  else root.EditorFloatingSelection = factory(root.SelectionTransform, StructureOps);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (transform, structure) {
  'use strict';
  function create(state) {
    let scope = null;
    let rotation = null;
    function resetRotation() {
      rotation = null;
    }
    function clear() {
      scope = null;
      resetRotation();
      state.pixels = null;
      state.originalBounds = null;
      state.baselinePixels = null;
      state.baselineBounds = null;
      state.targetId = null;
      state.baselineTargetId = null;
    }
    function attached() {
      if (!scope || scope.doc?.cells?.[scope.cell.id] !== scope.cell) return false;
      return (
        scope.target === scope.cell ||
        structure.findNode(scope.cell, scope.target.id)?.node === scope.target
      );
    }
    function editable() {
      return (
        attached() &&
        (scope.target === scope.cell ||
          structure.isEditable(structure.findNode(scope.cell, scope.target.id)))
      );
    }
    function bind(doc, cell, target, bounds) {
      scope = { doc, cell, target };
      state.originalBounds = { ...bounds };
      state.x = bounds.x;
      state.y = bounds.y;
      state.targetId = target === cell ? null : target.id;
      state.baselineTargetId = state.targetId;
    }
    function lift(doc, cell, target, bounds) {
      bind(doc, cell, target, bounds);
      if (!editable()) {
        clear();
        return null;
      }
      const lifted = transform.liftPixels(target, bounds);
      state.pixels = lifted.pixels;
      state.baselinePixels = lifted.baselinePixels;
      state.baselineBounds = lifted.baselineBounds;
      return lifted;
    }
    function paste(doc, cell, target, bounds, pixels) {
      bind(doc, cell, target, bounds);
      if (!editable()) {
        clear();
        return false;
      }
      state.pixels = { ...pixels };
      state.baselinePixels = null;
      state.baselineBounds = null;
      return true;
    }
    function cancel() {
      const original = scope;
      if (attached() && state.baselinePixels && state.baselineBounds) {
        // Cancellation restores the lift-time source even if it was locked later.
        transform.placePixels(
          scope.target,
          state.baselinePixels,
          state.baselineBounds,
          scope.cell.size || scope.doc.meta.cellSize,
        );
      }
      clear();
      return original;
    }
    function commit(doc, bounds, size) {
      if (!state.pixels || !scope) return { status: 'empty' };
      if (scope.doc !== doc || !editable()) {
        const restored = cancel();
        return { status: 'cancelled', restored };
      }
      const result = {
        status: 'committed',
        cell: scope.cell,
        target: scope.target,
        bounds: { ...bounds },
      };
      transform.placePixels(scope.target, state.pixels, bounds, size);
      clear();
      return result;
    }
    function flip(bounds, horizontal) {
      if (!state.pixels) return false;
      const pixels = {};
      for (const key in state.pixels) {
        const [x, y] = key.split(',').map(Number);
        pixels[`${horizontal ? bounds.w - 1 - x : x},${horizontal ? y : bounds.h - 1 - y}`] =
          state.pixels[key];
      }
      state.pixels = pixels;
      resetRotation();
      return true;
    }
    function rotate90(bounds, size) {
      const next = transform.quarterTurnBounds(bounds, size);
      if (!next || !state.pixels) return null;
      resetRotation();
      state.pixels = transform.rotatePixelsNearestNeighbor(
        state.pixels,
        bounds.w,
        bounds.h,
        Math.PI / 2,
      ).pixels;
      state.originalBounds = { ...next };
      state.x = next.x;
      state.y = next.y;
      return next;
    }
    function beginRotation(bounds) {
      if (!state.pixels) return null;
      if (!rotation) rotation = { pixels: { ...state.pixels }, bounds: { ...bounds }, angle: 0 };
      return rotation;
    }
    function rotate(angle) {
      if (!rotation) return null;
      const base = rotation.bounds;
      const result = transform.rotatePixelsNearestNeighbor(rotation.pixels, base.w, base.h, angle);
      const bounds = {
        x: Math.round(base.x + (base.w - result.w) / 2),
        y: Math.round(base.y + (base.h - result.h) / 2),
        w: result.w,
        h: result.h,
      };
      state.pixels = result.pixels;
      state.originalBounds = { ...bounds };
      state.x = bounds.x;
      state.y = bounds.y;
      rotation.angle = angle;
      return { ...result, bounds };
    }
    return {
      lift,
      paste,
      commit,
      cancel,
      clear,
      flip,
      rotate90,
      beginRotation,
      rotate,
      resetRotation,
    };
  }
  return { create };
});
