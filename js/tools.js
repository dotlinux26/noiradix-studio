/**
 * PIX2 Studio - Drawing Tools and Pixel Art Algorithms
 */

const Tools = (function () {
  'use strict';

  // Bresenham's line algorithm
  function line(x0, y0, x1, y1, callback) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = (x0 < x1) ? 1 : -1;
    let sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
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

  // Single pixel plot with optional symmetry
  function plotPixel(cell, x, y, color, symmetry = false, cellWidth = 16) {
    if (!cell) return;
    if (!cell.pixels) cell.pixels = {};
    cell.pixels[`${x},${y}`] = color;
    if (symmetry) {
      const symX = cellWidth - 1 - x;
      cell.pixels[`${symX},${y}`] = color;
    }
  }

  // Single pixel erase with optional symmetry
  function erasePixel(cell, x, y, symmetry = false, cellWidth = 16) {
    if (!cell || !cell.pixels) return;
    delete cell.pixels[`${x},${y}`];
    if (symmetry) {
      const symX = cellWidth - 1 - x;
      delete cell.pixels[`${symX},${y}`];
    }
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

  // 4-way flood fill (supports both signatures)
  function floodFill(cell, startX, startY, arg4, arg5, arg6, arg7) {
    if (!cell) return;
    if (!cell.pixels) cell.pixels = {};

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
      targetColor = cell.pixels[`${startX},${startY}`] || null;
    }

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;
    if (targetColor === replacementColor) return;

    const queue = [[startX, startY]];
    const visited = new Set();

    while (queue.length > 0) {
      const [cx, cy] = queue.pop();
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

      const key = `${cx},${cy}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const curColor = cell.pixels[key] || null;
      if (curColor === targetColor) {
        if (replacementColor === null) {
          delete cell.pixels[key];
        } else {
          cell.pixels[key] = replacementColor;
        }

        queue.push([cx + 1, cy]);
        queue.push([cx - 1, cy]);
        queue.push([cx, cy + 1]);
        queue.push([cx, cy - 1]);
      }
    }
  }

  // Align drawn contents to center
  function alignCenter(cell, w, h, axis = 'both') {
    const coords = Object.keys(cell.pixels).map(k => k.split(',').map(Number));
    if (coords.length === 0) return;

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

    if (shiftX === 0 && shiftY === 0) return;

    const newPixels = {};
    for (const k in cell.pixels) {
      const [x, y] = k.split(',').map(Number);
      const nx = x + shiftX;
      const ny = y + shiftY;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        newPixels[`${nx},${ny}`] = cell.pixels[k];
      }
    }
    cell.pixels = newPixels;
  }

  // Flip horizontally
  function flipHorizontal(cell, w) {
    const newPixels = {};
    for (const k in cell.pixels) {
      const [x, y] = k.split(',').map(Number);
      const nx = w - 1 - x;
      newPixels[`${nx},${y}`] = cell.pixels[k];
    }
    cell.pixels = newPixels;
  }

  // Flip vertically
  function flipVertical(cell, h) {
    const newPixels = {};
    for (const k in cell.pixels) {
      const [x, y] = k.split(',').map(Number);
      const ny = h - 1 - y;
      newPixels[`${x},${ny}`] = cell.pixels[k];
    }
    cell.pixels = newPixels;
  }

  // Rotate 90 degrees clockwise
  function rotate90Clockwise(cell, w, h) {
    const newPixels = {};
    for (const k in cell.pixels) {
      const [x, y] = k.split(',').map(Number);
      // (x, y) -> (h - 1 - y, x)
      const nx = h - 1 - y;
      const ny = x;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        newPixels[`${nx},${ny}`] = cell.pixels[k];
      }
    }
    cell.pixels = newPixels;
  }

  // Nudge pixels
  function nudge(cell, dx, dy, w, h) {
    const newPixels = {};
    for (const k in cell.pixels) {
      const [x, y] = k.split(',').map(Number);
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        newPixels[`${nx},${ny}`] = cell.pixels[k];
      }
    }
    cell.pixels = newPixels;
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
    plotRect
  };
})();
