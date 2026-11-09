/**
 * PIX2 Studio - Drawing Tools and Pixel Art Algorithms
 */

const Tools = (function () {
  'use strict';

  // Bresenham's line algorithm with guard counter
  function line(x0, y0, x1, y1, callback) {
    if (isNaN(x0) || isNaN(y0) || isNaN(x1) || isNaN(y1)) return;
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = (x0 < x1) ? 1 : -1;
    let sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;
    let maxSteps = 4096;

    while (maxSteps-- > 0) {
      callback(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      let e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  // Rectangle outline or fill
  function rect(x, y, w, h, fill, callback) {
    const minX = Math.min(x, x + w - 1);
    const maxX = Math.max(x, x + w - 1);
    const minY = Math.min(y, y + h - 1);
    const maxY = Math.max(y, y + h - 1);

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        if (fill || px === minX || px === maxX || py === minY || py === maxY) {
          callback(px, py);
        }
      }
    }
  }

  // ===========================================================================
  // PIX2 1.1 STRUCTURAL TARGET RESOLUTION HELPERS
  // ===========================================================================

  function findFirstEditableRegion(node, ancestorsEditable = true) {
    if (!node || !ancestorsEditable || node.locked || node.visible === false) return null;
    if (node.type === 'region') return node;
    for (const child of (node.children || [])) {
      const region = findFirstEditableRegion(child, true);
      if (region) return region;
    }
    return null;
  }

  function getTargetForPlot(cell, explicitTargetId) {
    if (!cell) return null;
    if (cell.layers && cell.layers.length > 0) {
      if (explicitTargetId) {
        const targetId = (typeof explicitTargetId === 'object' && explicitTargetId !== null) ? explicitTargetId.id : explicitTargetId;
        for (const layer of cell.layers) {
          function findInNode(n) {
            if (n.id === targetId) return n;
            for (const c of (n.children || [])) {
              const res = findInNode(c);
              if (res) return res;
            }
            return null;
          }
          const found = findInNode(layer);
          if (found) {
            if (found.locked || found.visible === false) return null;
            // PIX2 1.1 raster data belongs to Region nodes. Selecting a Layer
            // or Group changes focus, but drawing must resolve to an editable
            // descendant instead of silently creating layer.pixels.
            return found.type === 'region' ? found : findFirstEditableRegion(found);
          }
        }
      }
      const activeState = (typeof window !== 'undefined' && window.state) ? window.state : (typeof global !== 'undefined' && global.state) ? global.state : null;
      if (activeState && typeof activeState.getActiveRegion === 'function') {
        const reg = activeState.getActiveRegion(cell.id);
        if (reg) {
          if (reg.locked || reg.visible === false) return null;
          return reg;
        }
      }
      for (const layer of cell.layers) {
        const region = findFirstEditableRegion(layer);
        if (region) return region;
      }
      return null;
    }
    return cell;
  }

  function getTargetsForTransform(cell, explicitTargetId = null) {
    if (!cell) return [];
    if (!cell.layers || cell.layers.length === 0) return [cell];
    if (explicitTargetId) {
      const target = getTargetForPlot(cell, explicitTargetId);
      return target ? [target] : [];
    }
    const activeState = (typeof window !== 'undefined' && window.state) ? window.state : null;
    if (activeState && activeState.activeRegionId) {
      const found = activeState.findNode(cell.id, activeState.activeRegionId);
      if (found && found.node.type === 'region' && !found.node.locked && found.node.visible !== false) {
        return [found.node];
      }
    }
    const list = [];
    function collect(nodes) {
      for (const n of nodes || []) {
        if (n.type === 'region' && !n.locked && n.visible !== false) list.push(n);
        if (n.children) collect(n.children);
      }
    }
    collect(cell.layers);
    return list.length > 0 ? list : [cell];
  }

  function syncCompositeIfStructured(cell) {
    if (cell && cell.layers && cell.layers.length > 0) {
      const activeState = (typeof window !== 'undefined' && window.state) ? window.state : null;
      if (activeState && typeof activeState.syncCellComposite === 'function') {
        activeState.syncCellComposite(cell.id);
      }
    }
  }

  // Single pixel plot with optional symmetry
  function plotPixel(cell, x, y, color, symmetry = false, cellWidth = 16, explicitTargetId = null) {
    const target = getTargetForPlot(cell, explicitTargetId);
    if (!target) return;
    if (!target.pixels) target.pixels = {};
    target.pixels[`${x},${y}`] = color;
    if (symmetry) {
      const symX = cellWidth - 1 - x;
      target.pixels[`${symX},${y}`] = color;
    }
    syncCompositeIfStructured(cell);
  }

  // Single pixel erase with optional symmetry
  function erasePixel(cell, x, y, symmetry = false, cellWidth = 16, explicitTargetId = null) {
    const target = getTargetForPlot(cell, explicitTargetId);
    if (!target || !target.pixels) return;
    delete target.pixels[`${x},${y}`];
    if (symmetry) {
      const symX = cellWidth - 1 - x;
      delete target.pixels[`${symX},${y}`];
    }
    syncCompositeIfStructured(cell);
  }

  // Plot line with Bresenham algorithm
  function plotLine(cell, x0, y0, x1, y1, color, symmetry = false, cellWidth = 16) {
    line(x0, y0, x1, y1, (x, y) => {
      plotPixel(cell, x, y, color, symmetry, cellWidth);
    });
  }

  // Erase line with Bresenham algorithm
  function eraseLine(cell, x0, y0, x1, y1, symmetry = false, cellWidth = 16) {
    line(x0, y0, x1, y1, (x, y) => {
      erasePixel(cell, x, y, symmetry, cellWidth);
    });
  }

  // Plot rectangle outline or filled
  function plotRect(cell, x0, y0, x1, y1, color, fill = false, symmetry = false, cellWidth = 16) {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    rect(minX, minY, w, h, fill, (x, y) => {
      plotPixel(cell, x, y, color, symmetry, cellWidth);
    });
  }

  // Midpoint ellipse algorithm (outline or filled)
  function ellipse(x0, y0, x1, y1, fill = false, callback) {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    let a = Math.abs(maxX - minX);
    let b = Math.abs(maxY - minY);
    let b1 = b & 1;
    let dx = 4 * (1 - a) * b * b;
    let dy = 4 * (b1 + 1) * a * a;
    let err = dx + dy + b1 * a * a;
    let e2;

    let y_top = minY;
    let y_bot = maxY;
    let x_left = minX;
    let x_right = maxX;

    a = 8 * a * a;
    b1 = 8 * b * b;

    const scanlines = {};
    const outlinePoints = [];

    const plot4 = (xl, xr, yt, yb) => {
      if (fill) {
        if (!scanlines[yt]) scanlines[yt] = [xl, xr];
        else {
          scanlines[yt][0] = Math.min(scanlines[yt][0], xl);
          scanlines[yt][1] = Math.max(scanlines[yt][1], xr);
        }
        if (!scanlines[yb]) scanlines[yb] = [xl, xr];
        else {
          scanlines[yb][0] = Math.min(scanlines[yb][0], xl);
          scanlines[yb][1] = Math.max(scanlines[yb][1], xr);
        }
      } else {
        outlinePoints.push({ x: xl, y: yt });
        outlinePoints.push({ x: xr, y: yt });
        outlinePoints.push({ x: xl, y: yb });
        outlinePoints.push({ x: xr, y: yb });
      }
    };

    do {
      plot4(x_left, x_right, y_top, y_bot);
      e2 = 2 * err;
      if (e2 <= dy) { y_top++; y_bot--; err += dy += a; }
      if (e2 >= dx || 2 * err > dy) { x_left++; x_right--; err += dx += b1; }
    } while (x_left <= x_right);

    while (y_top - y_bot <= b) {
      plot4(x_left - 1, x_right + 1, y_top, y_bot);
      y_top++; y_bot--;
    }

    if (fill) {
      for (const sy in scanlines) {
        const y = parseInt(sy, 10);
        const [leftX, rightX] = scanlines[sy];
        for (let x = leftX; x <= rightX; x++) {
          callback(x, y);
        }
      }
    } else {
      const seen = new Set();
      for (const pt of outlinePoints) {
        const k = `${pt.x},${pt.y}`;
        if (!seen.has(k)) {
          seen.add(k);
          callback(pt.x, pt.y);
        }
      }
    }
  }

  // Plot circle / ellipse outline or filled
  function plotCircle(cell, x0, y0, x1, y1, color, fill = false, symmetry = false, cellWidth = 16) {
    ellipse(x0, y0, x1, y1, fill, (x, y) => {
      plotPixel(cell, x, y, color, symmetry, cellWidth);
    });
  }

  // 4-way flood fill (supports both signatures)
  function floodFill(cell, startX, startY, arg4, arg5, arg6, arg7, explicitTargetId = null) {
    if (!cell) return;
    // Object-form callers may carry a target ID without changing the public
    // API used by legacy PIX2 documents.
    const requestedTarget = explicitTargetId || (arg5 && typeof arg5 === 'object' ? arg5.targetId : null);
    const target = getTargetForPlot(cell, requestedTarget);
    if (!target) return;
    if (!target.pixels) target.pixels = {};

    let targetColor, replacementColor, w, h;
    if (typeof arg4 === 'string' && typeof arg5 === 'string') {
      targetColor = arg4;
      replacementColor = arg5;
      w = arg6 || 16;
      h = arg7 || 16;
    } else {
      replacementColor = arg4;
      const sizeObj = arg5 || {};
      w = sizeObj.w || cell.size?.w || 16;
      h = sizeObj.h || cell.size?.h || 16;
      targetColor = target.pixels[`${startX},${startY}`] || null;
    }

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;
    if (targetColor === replacementColor) return;

    const total = w * h;
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    const startIdx = startY * w + startX;
    queue[tail++] = startIdx;
    visited[startIdx] = 1;

    const maxSteps = Math.min(total * 4, 4194304);
    let steps = 0;

    while (head < tail && steps++ < maxSteps) {
      const idx = queue[head++];
      const cx = idx % w;
      const cy = (idx / w) | 0;
      const key = `${cx},${cy}`;

      const curColor = target.pixels[key] || null;
      if (curColor === targetColor) {
        if (replacementColor === null) {
          delete target.pixels[key];
        } else {
          target.pixels[key] = replacementColor;
        }

        if (cx > 0 && !visited[idx - 1]) {
          visited[idx - 1] = 1;
          queue[tail++] = idx - 1;
        }
        if (cx < w - 1 && !visited[idx + 1]) {
          visited[idx + 1] = 1;
          queue[tail++] = idx + 1;
        }
        if (cy > 0 && !visited[idx - w]) {
          visited[idx - w] = 1;
          queue[tail++] = idx - w;
        }
        if (cy < h - 1 && !visited[idx + w]) {
          visited[idx + w] = 1;
          queue[tail++] = idx + w;
        }
      }
    }
    syncCompositeIfStructured(cell);
  }

  // Align drawn contents to center
  function alignCenter(cell, w, h, axis = 'both', explicitTargetId = null) {
    const targets = getTargetsForTransform(cell, explicitTargetId);
    for (const target of targets) {
      if (!target.pixels) continue;
      const coords = Object.keys(target.pixels).map(k => k.split(',').map(Number));
      if (coords.length === 0) continue;

      let minX = w, maxX = 0, minY = h, maxY = 0;
      coords.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });

      const boxW = maxX - minX + 1;
      const boxH = maxY - minY + 1;

      let shiftX = 0;
      let shiftY = 0;

      if (axis === 'both' || axis === 'x') {
        const targetLeft = Math.floor((w - boxW) / 2);
        shiftX = targetLeft - minX;
      }
      if (axis === 'both' || axis === 'y') {
        const targetTop = Math.floor((h - boxH) / 2);
        shiftY = targetTop - minY;
      }

      if (shiftX === 0 && shiftY === 0) continue;

      const newPixels = {};
      for (const k in target.pixels) {
        const [x, y] = k.split(',').map(Number);
        const nx = x + shiftX;
        const ny = y + shiftY;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          newPixels[`${nx},${ny}`] = target.pixels[k];
        }
      }
      target.pixels = newPixels;
    }
    syncCompositeIfStructured(cell);
  }

  // Flip horizontally
  function flipHorizontal(cell, w, explicitTargetId = null) {
    const targets = getTargetsForTransform(cell, explicitTargetId);
    for (const target of targets) {
      if (!target.pixels) continue;
      const newPixels = {};
      for (const k in target.pixels) {
        const [x, y] = k.split(',').map(Number);
        const nx = w - 1 - x;
        newPixels[`${nx},${y}`] = target.pixels[k];
      }
      target.pixels = newPixels;
    }
    syncCompositeIfStructured(cell);
  }

  // Flip vertically
  function flipVertical(cell, h, explicitTargetId = null) {
    const targets = getTargetsForTransform(cell, explicitTargetId);
    for (const target of targets) {
      if (!target.pixels) continue;
      const newPixels = {};
      for (const k in target.pixels) {
        const [x, y] = k.split(',').map(Number);
        const ny = h - 1 - y;
        newPixels[`${x},${ny}`] = target.pixels[k];
      }
      target.pixels = newPixels;
    }
    syncCompositeIfStructured(cell);
  }

  // Rotate 90 degrees clockwise
  function rotate90Clockwise(cell, w, h, explicitTargetId = null) {
    const targets = getTargetsForTransform(cell, explicitTargetId);
    for (const target of targets) {
      if (!target.pixels) continue;
      const newPixels = {};
      for (const k in target.pixels) {
        const [x, y] = k.split(',').map(Number);
        const nx = h - 1 - y;
        const ny = x;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          newPixels[`${nx},${ny}`] = target.pixels[k];
        }
      }
      target.pixels = newPixels;
    }
    syncCompositeIfStructured(cell);
  }

  // Nudge pixels
  function nudge(cell, dx, dy, w, h, explicitTargetId = null) {
    const targets = getTargetsForTransform(cell, explicitTargetId);
    for (const target of targets) {
      if (!target.pixels) continue;
      const newPixels = {};
      for (const k in target.pixels) {
        const [x, y] = k.split(',').map(Number);
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          newPixels[`${nx},${ny}`] = target.pixels[k];
        }
      }
      target.pixels = newPixels;
    }
    syncCompositeIfStructured(cell);
  }

  return {
    line,
    rect,
    floodFill,
    alignCenter,
    centerContent: alignCenter,
    flipHorizontal,
    flipVertical,
    rotate90Clockwise,
    nudge,
    plotPixel,
    erasePixel,
    plotLine,
    eraseLine,
    plotRect,
    ellipse,
    plotCircle,
    getTargetForPlot,
    getTargetsForTransform,
    syncCompositeIfStructured
  };
})();

if (typeof window !== 'undefined') {
  window.Tools = Tools;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Tools;
}
