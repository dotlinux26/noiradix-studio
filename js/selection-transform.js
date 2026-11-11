/**
 * NOIRADIX Studio 2.0 / PixelArt 2.0 - Unified Selection Transform Engine
 * Shared geometry, nearest-neighbor resampling, handle hit-testing, and scaling.
 * Zero external runtime dependencies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SelectionTransform = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Resamples pixel map using pure nearest-neighbor algorithm (zero blur, pixel-crisp).
   * @param {Object} sourcePixels - map of "x,y" => hexColor
   * @param {number} srcW - source width (>= 1)
   * @param {number} srcH - source height (>= 1)
   * @param {number} dstW - target width (>= 1)
   * @param {number} dstH - target height (>= 1)
   * @returns {Object} resampled pixels map "x,y" => hexColor
   */
  function scalePixelsNearestNeighbor(sourcePixels, srcW, srcH, dstW, dstH) {
    if (!sourcePixels || dstW <= 0 || dstH <= 0 || srcW <= 0 || srcH <= 0) {
      return {};
    }

    const result = {};
    const scaleX = srcW / dstW;
    const scaleY = srcH / dstH;

    for (let dy = 0; dy < dstH; dy++) {
      const sy = Math.min(srcH - 1, Math.floor(dy * scaleY));
      for (let dx = 0; dx < dstW; dx++) {
        const sx = Math.min(srcW - 1, Math.floor(dx * scaleX));
        const srcKey = `${sx},${sy}`;
        const color = sourcePixels[srcKey];
        if (color) {
          result[`${dx},${dy}`] = color;
        }
      }
    }

    return result;
  }

  /**
   * Rotates pixel map using pure nearest-neighbor backward-mapping.
   * @param {Object} sourcePixels - map of "x,y" => hexColor
   * @param {number} srcW - source width
   * @param {number} srcH - source height
   * @param {number} angleRad - rotation angle in radians
   * @returns {{ pixels: Object, w: number, h: number }}
   */
  function rotatePixelsNearestNeighbor(sourcePixels, srcW, srcH, angleRad) {
    if (!sourcePixels || srcW <= 0 || srcH <= 0) {
      return { pixels: {}, w: srcW || 1, h: srcH || 1 };
    }

    // Cardinal rotations use exact integer mapping. Besides preserving every
    // pixel, this avoids floating-point bounding-box drift at 90/180/270°.
    const quarterTurn = Math.PI / 2;
    const quarterSteps = Math.round(angleRad / quarterTurn);
    if (Math.abs(angleRad - quarterSteps * quarterTurn) < 1e-8) {
      const normalizedSteps = ((quarterSteps % 4) + 4) % 4;
      const dstW = normalizedSteps % 2 === 1 ? srcH : srcW;
      const dstH = normalizedSteps % 2 === 1 ? srcW : srcH;
      const result = {};
      for (const key in sourcePixels) {
        const [x, y] = key.split(',').map(Number);
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= srcW || y < 0 || y >= srcH) continue;
        let dx = x;
        let dy = y;
        if (normalizedSteps === 1) {
          dx = srcH - 1 - y;
          dy = x;
        } else if (normalizedSteps === 2) {
          dx = srcW - 1 - x;
          dy = srcH - 1 - y;
        } else if (normalizedSteps === 3) {
          dx = y;
          dy = srcW - 1 - x;
        }
        result[`${dx},${dy}`] = sourcePixels[key];
      }
      return { pixels: result, w: dstW, h: dstH };
    }

    // Normalize angle
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // Compute bounding box of rotated rectangle
    const cx = srcW / 2;
    const cy = srcH / 2;

    const corners = [
      { x: -cx, y: -cy },
      { x: srcW - cx, y: -cy },
      { x: srcW - cx, y: srcH - cy },
      { x: -cx, y: srcH - cy }
    ];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const c of corners) {
      const rx = c.x * cos - c.y * sin;
      const ry = c.x * sin + c.y * cos;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }

    const dstW = Math.max(1, Math.round(maxX - minX));
    const dstH = Math.max(1, Math.round(maxY - minY));
    const ncx = dstW / 2;
    const ncy = dstH / 2;

    const result = {};

    // Backward mapping: for each destination pixel, find source pixel
    for (let dy = 0; dy < dstH; dy++) {
      for (let dx = 0; dx < dstW; dx++) {
        const ox = dx + 0.5 - ncx;
        const oy = dy + 0.5 - ncy;

        // Inverse rotation: R(-angle)
        const sxRaw = ox * cos + oy * sin + cx;
        const syRaw = -ox * sin + oy * cos + cy;

        const sx = Math.floor(sxRaw);
        const sy = Math.floor(syRaw);

        if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
          const color = sourcePixels[`${sx},${sy}`];
          if (color) {
            result[`${dx},${dy}`] = color;
          }
        }
      }
    }

    return { pixels: result, w: dstW, h: dstH };
  }

  /**
   * Computes handle positions for a selection box in canvas screen/pixel coordinates.
   * @param {{ x: number, y: number, w: number, h: number }} sel
   * @param {number} zoom
   * @param {Object} [options]
   * @returns {Object} handles map
   */
  function getSelectionHandles(sel, zoom, options = {}) {
    if (!sel || sel.w <= 0 || sel.h <= 0) return null;
    const sx = sel.x * zoom;
    const sy = sel.y * zoom;
    const sw = sel.w * zoom;
    const sh = sel.h * zoom;

    const stemLen = (sy < 28) ? -22 : 22;
    const rotX = sx + sw / 2;
    const rotY = sy - stemLen;

    const handleRadius = Math.max(4, Math.min(8, Math.floor(zoom / 2.5)));

    return {
      rot: { x: rotX, y: rotY, r: 7 },
      nw: { x: sx, y: sy, r: handleRadius },
      ne: { x: sx + sw, y: sy, r: handleRadius },
      se: { x: sx + sw, y: sy + sh, r: handleRadius },
      sw: { x: sx, y: sy + sh, r: handleRadius },
      n: { x: sx + sw / 2, y: sy, r: handleRadius },
      e: { x: sx + sw, y: sy + sh / 2, r: handleRadius },
      s: { x: sx + sw / 2, y: sy + sh, r: handleRadius },
      w: { x: sx, y: sy + sh / 2, r: handleRadius },
      bounds: { sx, sy, sw, sh }
    };
  }

  /**
   * Hit-tests pointer coordinates against selection handles.
   * @param {{ x: number, y: number, w: number, h: number }} sel
   * @param {number} canvasX - pointer X relative to canvas
   * @param {number} canvasY - pointer Y relative to canvas
   * @param {number} zoom
   * @returns {'rot'|'nw'|'ne'|'se'|'sw'|'n'|'e'|'s'|'w'|'body'|null}
   */
  function hitTestSelectionHandles(sel, canvasX, canvasY, zoom) {
    const handles = getSelectionHandles(sel, zoom);
    if (!handles) return null;

    // 1. Check rotation handle first
    const dxRot = canvasX - handles.rot.x;
    const dyRot = canvasY - handles.rot.y;
    if (dxRot * dxRot + dyRot * dyRot <= (handles.rot.r + 4) * (handles.rot.r + 4)) {
      return 'rot';
    }

    // Only show scale handles if selection is at least 8x8 in screen pixels
    if (handles.bounds.sw >= 8 && handles.bounds.sh >= 8) {
      // 2. Check 4 corners
      const corners = ['nw', 'ne', 'se', 'sw'];
      for (const h of corners) {
        const info = handles[h];
        const dx = canvasX - info.x;
        const dy = canvasY - info.y;
        if (dx * dx + dy * dy <= (info.r + 3) * (info.r + 3)) {
          return h;
        }
      }

      // 3. Check 4 edges (if large enough to avoid corner overlaps)
      if (handles.bounds.sw >= 24) {
        for (const h of ['n', 's']) {
          const info = handles[h];
          const dx = canvasX - info.x;
          const dy = canvasY - info.y;
          if (dx * dx + dy * dy <= (info.r + 3) * (info.r + 3)) {
            return h;
          }
        }
      }

      if (handles.bounds.sh >= 24) {
        for (const h of ['w', 'e']) {
          const info = handles[h];
          const dx = canvasX - info.x;
          const dy = canvasY - info.y;
          if (dx * dx + dy * dy <= (info.r + 3) * (info.r + 3)) {
            return h;
          }
        }
      }
    }

    // 4. Check selection body
    const b = handles.bounds;
    if (canvasX >= b.sx && canvasX < b.sx + b.sw && canvasY >= b.sy && canvasY < b.sy + b.sh) {
      return 'body';
    }

    return null;
  }

  function drawHandles(ctx, bounds, zoom) {
    const handles = getSelectionHandles(bounds, zoom);
    if (!handles) return;
    const { sx, sy, sw, sh } = handles.bounds;
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#4f46e5';
    ctx.fillStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(handles.rot.x, sy);
    ctx.lineTo(handles.rot.x, handles.rot.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(handles.rot.x, handles.rot.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6366f1';
    if (sw >= 8 && sh >= 8) {
      for (const id of ['nw','ne','se','sw','n','e','s','w']) {
        if (('ns'.includes(id) && sw < 24) || ('ew'.includes(id) && sh < 24)) continue;
        const point = handles[id];
        ctx.fillRect(point.x - 2.5, point.y - 2.5, 5, 5);
      }
    }
    ctx.restore();
  }

  function copyPixels(target, bounds) {
    const source = target.pixels || {};
    const pixels = {};
    for (let y = 0; y < bounds.h; y++) {
      for (let x = 0; x < bounds.w; x++) {
        const key = `${bounds.x + x},${bounds.y + y}`;
        if (!source[key]) continue;
        pixels[`${x},${y}`] = source[key];
      }
    }
    return pixels;
  }

  function liftPixels(target, bounds) {
    const source = target.pixels ??= {};
    const pixels = copyPixels(target, bounds);
    for (const key in pixels) {
      const [x, y] = key.split(',').map(Number);
      delete source[`${bounds.x + x},${bounds.y + y}`];
    }
    return { pixels, baselinePixels: { ...pixels }, baselineBounds: { ...bounds } };
  }

  function placePixels(target, pixels, origin, size) {
    target.pixels ??= {};
    for (const key in pixels) {
      const [relativeX, relativeY] = key.split(',').map(Number);
      const x = origin.x + relativeX;
      const y = origin.y + relativeY;
      if (x >= 0 && x < size.w && y >= 0 && y < size.h) {
        target.pixels[`${x},${y}`] = pixels[key];
      }
    }
  }

  function quarterTurnBounds(bounds, size) {
    const w = bounds.h;
    const h = bounds.w;
    if (w > size.w || h > size.h) return null;
    return {
      x: Math.max(0, Math.min(size.w - w, bounds.x)),
      y: Math.max(0, Math.min(size.h - h, bounds.y)),
      w, h
    };
  }

  /**
   * Computes scaled selection bounds given original selection, active handle,
   * current pointer coordinates in artwork pixel units, and shiftKey constraint.
   *
   * @param {{ x: number, y: number, w: number, h: number }} origSel
   * @param {string} handle - 'nw'|'ne'|'se'|'sw'|'n'|'e'|'s'|'w'
   * @param {number} curPixelX - current pointer X in artwork coordinates
   * @param {number} curPixelY - current pointer Y in artwork coordinates
   * @param {boolean} shiftKey - whether aspect ratio is preserved
   * @param {number} [minDim=1] - minimum dimension in pixels
   * @returns {{ x: number, y: number, w: number, h: number }}
   */
  function computeScaledBounds(origSel, handle, curPixelX, curPixelY, shiftKey, minDim = 1) {
    if (!origSel) return { x: 0, y: 0, w: 1, h: 1 };

    const ox = origSel.x;
    const oy = origSel.y;
    const ow = origSel.w;
    const oh = origSel.h;
    const aspectRatio = ow / oh;

    let newX = ox;
    let newY = oy;
    let newW = ow;
    let newH = oh;

    switch (handle) {
      case 'se': {
        newW = Math.max(minDim, curPixelX - ox + 1);
        newH = Math.max(minDim, curPixelY - oy + 1);
        if (shiftKey) {
          // Uniform scaling driven by dominant axis
          if (newW / ow > newH / oh) {
            newH = Math.max(minDim, Math.round(newW / aspectRatio));
          } else {
            newW = Math.max(minDim, Math.round(newH * aspectRatio));
          }
        }
        break;
      }
      case 'sw': {
        const right = ox + ow;
        newW = Math.max(minDim, right - curPixelX);
        newH = Math.max(minDim, curPixelY - oy + 1);
        if (shiftKey) {
          if (newW / ow > newH / oh) {
            newH = Math.max(minDim, Math.round(newW / aspectRatio));
          } else {
            newW = Math.max(minDim, Math.round(newH * aspectRatio));
          }
        }
        newX = right - newW;
        break;
      }
      case 'ne': {
        const bottom = oy + oh;
        newW = Math.max(minDim, curPixelX - ox + 1);
        newH = Math.max(minDim, bottom - curPixelY);
        if (shiftKey) {
          if (newW / ow > newH / oh) {
            newH = Math.max(minDim, Math.round(newW / aspectRatio));
          } else {
            newW = Math.max(minDim, Math.round(newH * aspectRatio));
          }
        }
        newY = bottom - newH;
        break;
      }
      case 'nw': {
        const right = ox + ow;
        const bottom = oy + oh;
        newW = Math.max(minDim, right - curPixelX);
        newH = Math.max(minDim, bottom - curPixelY);
        if (shiftKey) {
          if (newW / ow > newH / oh) {
            newH = Math.max(minDim, Math.round(newW / aspectRatio));
          } else {
            newW = Math.max(minDim, Math.round(newH * aspectRatio));
          }
        }
        newX = right - newW;
        newY = bottom - newH;
        break;
      }
      case 'e': {
        newW = Math.max(minDim, curPixelX - ox + 1);
        break;
      }
      case 'w': {
        const right = ox + ow;
        newW = Math.max(minDim, right - curPixelX);
        newX = right - newW;
        break;
      }
      case 's': {
        newH = Math.max(minDim, curPixelY - oy + 1);
        break;
      }
      case 'n': {
        const bottom = oy + oh;
        newH = Math.max(minDim, bottom - curPixelY);
        newY = bottom - newH;
        break;
      }
      default:
        break;
    }

    return { x: newX, y: newY, w: newW, h: newH };
  }

  return {
    scalePixelsNearestNeighbor,
    rotatePixelsNearestNeighbor,
    getSelectionHandles,
    hitTestSelectionHandles,
    drawHandles,
    copyPixels,
    liftPixels,
    placePixels,
    quarterTurnBounds,
    computeScaledBounds
  };
});
