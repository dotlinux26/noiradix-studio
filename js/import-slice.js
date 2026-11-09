/**
 * NOIRADIX Studio 2.0 / PIX2 1.1
 * PNG Spritesheet Slicer & TexturePacker / NOIRADIX JSON Atlas Importer
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    const PIX2 = require('./pix2-format.js');
    module.exports = factory(PIX2);
  } else {
    const resolvedPIX2 = (typeof PIX2 !== 'undefined' ? PIX2 : (root && root.PIX2 ? root.PIX2 : (typeof globalThis !== 'undefined' ? globalThis.PIX2 : null)));
    root.ImportSlice = factory(resolvedPIX2);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (PIX2) {
  'use strict';

  /**
   * Safe RGBA to HEX helper with fallback
   */
  function toHexColor(r, g, b, a = 255) {
    const resolved = (PIX2 && typeof PIX2.rgbaToHex === 'function') ? PIX2 : (typeof globalThis !== 'undefined' && globalThis.PIX2 ? globalThis.PIX2 : (typeof window !== 'undefined' && window.PIX2 ? window.PIX2 : null));
    if (resolved && typeof resolved.rgbaToHex === 'function') {
      return resolved.rgbaToHex(r, g, b, a);
    }
    const rH = Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0');
    const gH = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0');
    const bH = Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
    if (a === 255 || a === undefined) return `#${rH}${gH}${bH}`;
    const aH = Math.max(0, Math.min(255, Math.round(a))).toString(16).padStart(2, '0');
    return `#${rH}${gH}${bH}${aH}`;
  }

  /**
   * Parse atlas JSON in NOIRADIX or TexturePacker (Hash or Array) format
   */
  function parseAtlasJSON(jsonInput) {
    let obj = jsonInput;
    if (typeof obj === 'string') {
      try {
        obj = JSON.parse(obj);
      } catch (err) {
        throw new Error(`Failed to parse Atlas JSON: ${err.message}`);
      }
    }
    if (!obj || typeof obj !== 'object') {
      throw new Error('Atlas JSON must be an object');
    }

    const normalizedFrames = [];

    if (Array.isArray(obj.frames)) {
      // TexturePacker Array format
      for (const item of obj.frames) {
        if (!item || !item.frame) continue;
        const fname = item.filename || item.name || `frame_${normalizedFrames.length}`;
        normalizedFrames.push(normalizeFrameItem(fname, item));
      }
    } else if (obj.frames && typeof obj.frames === 'object') {
      // TexturePacker Hash or NOIRADIX standard format
      for (const fname in obj.frames) {
        const item = obj.frames[fname];
        if (!item || !item.frame) continue;
        normalizedFrames.push(normalizeFrameItem(fname, item));
      }
    } else if (obj.components && Array.isArray(obj.components)) {
      // NOIRADIX Modular Manifest format
      for (const comp of obj.components) {
        normalizedFrames.push({
          name: comp.name || comp.id,
          id: comp.id,
          x: comp.trimOffset ? comp.trimOffset.x : 0,
          y: comp.trimOffset ? comp.trimOffset.y : 0,
          w: comp.size.w,
          h: comp.size.h,
          rotated: false,
          trimmed: Boolean(comp.trimOffset),
          sourceW: comp.size.w,
          sourceH: comp.size.h,
          trimX: comp.trimOffset ? comp.trimOffset.x : 0,
          trimY: comp.trimOffset ? comp.trimOffset.y : 0,
          trimW: comp.trimOffset ? comp.trimOffset.w : comp.size.w,
          trimH: comp.trimOffset ? comp.trimOffset.h : comp.size.h,
          pivotX: comp.pivot ? comp.pivot.x : 0.5,
          pivotY: comp.pivot ? comp.pivot.y : 0.5
        });
      }
    } else {
      throw new Error('Unrecognized Atlas JSON schema. Expected .frames (array or hash) or .components.');
    }

    return normalizedFrames;
  }

  function normalizeFrameItem(name, item) {
    const f = item.frame;
    const sSize = item.sourceSize || { w: f.w, h: f.h };
    const ssSize = item.spriteSourceSize || { x: 0, y: 0, w: f.w, h: f.h };
    const pivot = item.pivot || { x: 0.5, y: 0.5 };

    return {
      name,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      rotated: Boolean(item.rotated),
      trimmed: Boolean(item.trimmed),
      sourceW: sSize.w,
      sourceH: sSize.h,
      trimX: ssSize.x !== undefined ? ssSize.x : 0,
      trimY: ssSize.y !== undefined ? ssSize.y : 0,
      trimW: ssSize.w !== undefined ? ssSize.w : f.w,
      trimH: ssSize.h !== undefined ? ssSize.h : f.h,
      pivotX: pivot.x !== undefined ? pivot.x : 0.5,
      pivotY: pivot.y !== undefined ? pivot.y : 0.5
    };
  }

  /**
   * Slice a uniform grid
   */
  function sliceGrid(atlasW, atlasH, options = {}) {
    if (typeof atlasW === 'object' && atlasW !== null) {
      options = atlasW;
      atlasW = options.imageWidth || options.atlasW || options.width || 0;
      atlasH = options.imageHeight || options.atlasH || options.height || 0;
    }
    const cellW = Math.max(1, options.cellW || options.cellWidth || 16);
    const cellH = Math.max(1, options.cellH || options.cellHeight || 16);
    const margin = Math.max(0, options.margin || 0);
    const gap = Math.max(0, options.gap || options.spacing || 0);

    const availableW = atlasW - 2 * margin;
    const availableH = atlasH - 2 * margin;
    const cols = options.cols || options.columns || Math.floor((availableW + gap) / (cellW + gap));
    const rows = options.rows || Math.floor((availableH + gap) / (cellH + gap));

    const frames = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = margin + c * (cellW + gap);
        const y = margin + r * (cellH + gap);
        if (x + cellW <= atlasW && y + cellH <= atlasH) {
          frames.push({
            name: `cell_${r}_${c}`,
            row: r,
            col: c,
            frameIndex: c,
            x,
            y,
            w: cellW,
            h: cellH,
            rotated: false,
            trimmed: false,
            sourceW: cellW,
            sourceH: cellH,
            trimX: 0,
            trimY: 0,
            trimW: cellW,
            trimH: cellH,
            pivotX: 0.5,
            pivotY: 0.5
          });
        }
      }
    }
    return frames;
  }

  /**
   * Slice alpha islands (connected non-transparent pixel components)
   * @param {Function} getPixelRgba - (x, y) => { r, g, b, a }
   * @param {number} atlasW - image width
   * @param {number} atlasH - image height
   * @param {Object} [options] - { minSize: 1, padding: 0 }
   */
  function sliceAlphaIslands(getPixelRgba, atlasW, atlasH, options = {}) {
    const visited = new Uint8Array(atlasW * atlasH);
    const islands = [];
    const minSize = options.minSize || 2;
    const padding = options.padding || 0;

    for (let y = 0; y < atlasH; y++) {
      for (let x = 0; x < atlasW; x++) {
        const idx = y * atlasW + x;
        if (visited[idx]) continue;
        visited[idx] = 1;

        const p = getPixelRgba(x, y);
        if (!p || p.a === 0) continue;

        // BFS Flood fill to discover connected island
        let minX = x, maxX = x, minY = y, maxY = y;
        let count = 0;
        const queue = [x, y];

        while (queue.length > 0) {
          const cy = queue.pop();
          const cx = queue.pop();
          count++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          const neighbors = [
            [cx + 1, cy], [cx - 1, cy],
            [cx, cy + 1], [cx, cy - 1]
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < atlasW && ny >= 0 && ny < atlasH) {
              const nidx = ny * atlasW + nx;
              if (!visited[nidx]) {
                visited[nidx] = 1;
                const np = getPixelRgba(nx, ny);
                if (np && np.a > 0) {
                  queue.push(nx, ny);
                }
              }
            }
          }
        }

        const w = maxX - minX + 1;
        const h = maxY - minY + 1;

        if (w >= minSize && h >= minSize) {
          const px = Math.max(0, minX - padding);
          const py = Math.max(0, minY - padding);
          const pw = Math.min(atlasW - px, w + 2 * padding);
          const ph = Math.min(atlasH - py, h + 2 * padding);

          islands.push({
            name: `island_${islands.length}`,
            x: px,
            y: py,
            w: pw,
            h: ph,
            rotated: false,
            trimmed: true,
            sourceW: pw,
            sourceH: ph,
            trimX: 0,
            trimY: 0,
            trimW: pw,
            trimH: ph,
            pivotX: 0.5,
            pivotY: 0.5
          });
        }
      }
    }

    return islands;
  }

  /**
   * Extract pixels from a sliced frame with rotation and trimming reconstruction
   * @param {Function} getPixelRgba - (x, y) => { r, g, b, a }
   * @param {Object} frame - Normalized frame metadata
   * @returns {{ pixels: Object, width: number, height: number }}
   */
  function extractFramePixels(sampler, frame) {
    let getPixelRgba = sampler;
    if (typeof sampler === 'object' && sampler && sampler.data && sampler.width) {
      const { width, height, data } = sampler;
      getPixelRgba = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return { r: 0, g: 0, b: 0, a: 0 };
        const idx = (y * width + x) * 4;
        return {
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2],
          a: data[idx + 3]
        };
      };
    }

    const pixels = {};
    const fr = frame.frame || frame;
    const fw = fr.w !== undefined ? fr.w : frame.w;
    const fh = fr.h !== undefined ? fr.h : frame.h;
    const fx_pos = fr.x !== undefined ? fr.x : (frame.x || 0);
    const fy_pos = fr.y !== undefined ? fr.y : (frame.y || 0);

    const outW = (frame.sourceSize && frame.sourceSize.w) || frame.sourceW || fw;
    const outH = (frame.sourceSize && frame.sourceSize.h) || frame.sourceH || fh;

    const trimX = (frame.spriteSourceSize && frame.spriteSourceSize.x !== undefined) ? frame.spriteSourceSize.x : (frame.trimX || 0);
    const trimY = (frame.spriteSourceSize && frame.spriteSourceSize.y !== undefined) ? frame.spriteSourceSize.y : (frame.trimY || 0);

    const getPixel = typeof getPixelRgba === 'function' ? getPixelRgba : (x, y) => {
      if (getPixelRgba && getPixelRgba.data && x >= 0 && x < getPixelRgba.width && y >= 0 && y < getPixelRgba.height) {
        const idx = (y * getPixelRgba.width + x) * 4;
        return {
          r: getPixelRgba.data[idx],
          g: getPixelRgba.data[idx + 1],
          b: getPixelRgba.data[idx + 2],
          a: getPixelRgba.data[idx + 3]
        };
      }
      return null;
    };

    for (let fy = 0; fy < fh; fy++) {
      for (let fx = 0; fx < fw; fx++) {
        const atlasX = fx_pos + fx;
        const atlasY = fy_pos + fy;
        const rgba = getPixel(atlasX, atlasY);
        if (!rgba || rgba.a === 0) continue;

        let destX, destY;
        if (frame.rotated) {
          // TexturePacker rotates 90 deg clockwise in atlas
          // Unrotate 90 deg CCW: destX = fy, destY = (fw - 1) - fx
          destX = trimX + fy;
          destY = trimY + (fw - 1 - fx);
        } else {
          destX = trimX + fx;
          destY = trimY + fy;
        }

        if (destX >= 0 && destX < outW && destY >= 0 && destY < outH) {
          pixels[`${destX},${destY}`] = toHexColor(rgba.r, rgba.g, rgba.b, rgba.a);
        }
      }
    }

    return { pixels, width: outW, height: outH };
  }

  /**
   * Import sliced frames into a PIX2 document
   */
  function importFramesToDoc(doc, frames, getPixelRgba, options = {}) {
    if (!doc || !doc.cells) {
      throw new Error('Invalid PIX2 document');
    }

    const mode = options.mode || 'new-cells'; // 'new-cells' | 'regions'
    const isV11 = doc.meta.version === '1.1';
    const cellIdPrefix = options.cellPrefix || 'imported_';

    // Grouping for auto-animation detection (e.g. walk_0, walk_1)
    const animGroups = Object.create(null);

    // Ensure document cell dimensions accommodate the imported frames
    let maxImportW = 0, maxImportH = 0;
    for (const f of frames) {
      const fr = f.frame || f;
      const fw = fr.w || f.w || 16;
      const fh = fr.h || f.h || 16;
      if (fw > maxImportW) maxImportW = fw;
      if (fh > maxImportH) maxImportH = fh;
    }

    if (doc.meta && doc.meta.cellSize) {
      if (maxImportW > doc.meta.cellSize.w || maxImportH > doc.meta.cellSize.h) {
        const newW = Math.max(doc.meta.cellSize.w, maxImportW);
        const newH = Math.max(doc.meta.cellSize.h, maxImportH);
        if (typeof PIX2 !== 'undefined' && PIX2.resizeCells) {
          PIX2.resizeCells(doc, newW, newH, 'expand');
        } else {
          doc.meta.cellSize.w = newW;
          doc.meta.cellSize.h = newH;
        }
      }
    }

    let maxCol = doc.meta.grid ? (doc.meta.grid.cols || 4) : 4;
    let curRow = 0, curCol = 0;

    function inferDirectionFromTagOrRow(tag, row) {
      const t = (tag || '').toLowerCase();
      if (t.includes('down_right')) return 'down_right';
      if (t.includes('down_left')) return 'down_left';
      if (t.includes('up_right')) return 'up_right';
      if (t.includes('up_left')) return 'up_left';
      if (t.includes('down')) return 'down';
      if (t.includes('up')) return 'up';
      if (t.includes('right')) return 'right';
      if (t.includes('left')) return 'left';
      const standardDirs = ['down', 'up', 'right', 'left', 'down_right', 'up_right', 'up_left', 'down_left'];
      if (row >= 0 && row < standardDirs.length) return standardDirs[row];
      return 'none';
    }

    function inferRowFromTag(tag, customTagMap) {
      if (!tag) return null;
      const t = tag.trim().toLowerCase();
      for (const [index, direction] of ['down_right', 'up_right', 'up_left', 'down_left'].entries()) {
        if (t.startsWith(direction) || t.startsWith(`walk_${direction}`)) return index + 4;
      }
      if (t === 'down' || t === 'walk_down' || t.startsWith('down') || t.startsWith('walk_down')) return 0;
      if (t === 'up' || t === 'walk_up' || t.startsWith('up') || t.startsWith('walk_up')) return 1;
      if (t === 'right' || t === 'walk_right' || t.startsWith('right') || t.startsWith('walk_right')) return 2;
      if (t === 'left' || t === 'walk_left' || t.startsWith('left') || t.startsWith('walk_left')) return 3;
      if (customTagMap && customTagMap.has(t)) return customTagMap.get(t);
      return null;
    }

    const customTagMap = new Map();
    const assignedRows = new Set();
    let nextAvailableRow = 0;
    frames.forEach(f => {
      const inferred = inferRowFromTag(f.tag);
      if (f.row !== undefined) {
        assignedRows.add(f.row);
        if (f.tag?.trim() && inferred === null) customTagMap.set(f.tag.trim().toLowerCase(), f.row);
      } else if (inferred !== null) {
        assignedRows.add(inferred);
      }
      if (f.row !== undefined && f.row >= nextAvailableRow) {
        nextAvailableRow = f.row + 1;
      }
    });

    const tagFrameCounters = new Map();
    let maxAssignedRow = 0;
    let maxAssignedCol = 0;

    for (const f of frames) {
      const extracted = extractFramePixels(getPixelRgba, f);

      // Determine targetRow (Tag = Row)
      let targetRow;
      if (f.row !== undefined) {
        targetRow = f.row;
      } else {
        const inferred = inferRowFromTag(f.tag, customTagMap);
        if (inferred !== null) {
          targetRow = inferred;
        } else if (f.tag && f.tag.trim()) {
          const tKey = f.tag.trim().toLowerCase();
          if (!customTagMap.has(tKey)) {
            nextAvailableRow = Math.max(4, nextAvailableRow);
            while (assignedRows.has(nextAvailableRow)) nextAvailableRow++;
            customTagMap.set(tKey, nextAvailableRow++);
          }
          targetRow = customTagMap.get(tKey);
        } else {
          targetRow = curRow;
        }
      }

      // Determine targetCol (Frame # = Column)
      const rowKey = String(targetRow);
      const seqIndex = tagFrameCounters.get(rowKey) || 0;
      tagFrameCounters.set(rowKey, seqIndex + 1);

      let targetCol;
      if (f.col !== undefined) {
        targetCol = f.col;
      } else if (f.frameIndex !== undefined) {
        targetCol = f.frameIndex;
      } else {
        const numMatch = (f.name || '').match(/[_-](\d+)$/);
        if (numMatch) {
          targetCol = parseInt(numMatch[1], 10);
        } else {
          targetCol = seqIndex;
        }
      }

      maxAssignedRow = Math.max(maxAssignedRow, targetRow);
      maxAssignedCol = Math.max(maxAssignedCol, targetCol);

      const cellId = (options.useGridCellIds && !options.cellPrefix)
        ? `cell_${targetRow}_${targetCol}`
        : `${cellIdPrefix}${f.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
      if (options.rejectDuplicateCells && Object.hasOwn(doc.cells, cellId)) {
        throw new Error(`Multiple slices target row ${targetRow + 1}, frame ${targetCol}`);
      }

      const targetDir = inferDirectionFromTagOrRow(f.tag, targetRow);

      // Create new cell
      const newCell = {
        id: cellId,
        name: f.name || `frame_${targetRow}_${targetCol}`,
        row: targetRow,
        col: targetCol,
        direction: targetDir,
        frame: targetCol,
        size: { w: extracted.width, h: extracted.height },
        pixels: extracted.pixels
      };

      if (isV11) {
        const layerId = `layer_${cellId}`;
        const regionId = `reg_${cellId}`;
        newCell.layers = [
          {
            type: 'layer',
            id: layerId,
            cell: cellId,
            name: options.layerName || 'Artwork',
            visible: true,
            locked: false,
            opacity: 1.0,
            blend: 'normal',
            children: [
              {
                type: 'region',
                id: regionId,
                cell: cellId,
                parent: layerId,
                name: f.name,
                tags: f.tag ? [f.tag] : (Array.isArray(f.tags) ? f.tags : []),
                visible: true,
                locked: false,
                pixels: { ...extracted.pixels },
                primitives: []
              }
            ]
          }
        ];
      }

      doc.cells[cellId] = newCell;

      // Advance auto-grid row/col
      if (f.row === undefined && f.col === undefined && !f.tag) {
        curCol++;
        if (curCol >= maxCol) {
          curCol = 0;
          curRow++;
        }
      }

      // Detect animation frame sequence: by tag or name prefix
      const animKey = (f.tag && f.tag.trim()) ? f.tag.trim() : null;
      if (animKey) {
        if (!animGroups[animKey]) animGroups[animKey] = [];
        animGroups[animKey].push({ col: targetCol, cellId, dir: targetDir });
      } else {
        const seqSource = f.name || '';
        const match = seqSource.match(/^(.*?)[_-](\d+)$/);
        if (match) {
          const animName = match[1];
          const idx = parseInt(match[2], 10);
          if (!animGroups[animName]) animGroups[animName] = [];
          animGroups[animName].push({ col: idx, cellId, dir: targetDir });
        }
      }
    }

    // Ensure grid rows & cols accommodate all newly placed cells
    if (doc.meta && doc.meta.grid) {
      doc.meta.grid.rows = Math.max(doc.meta.grid.rows || 1, maxAssignedRow + 1);
      doc.meta.grid.cols = Math.max(doc.meta.grid.cols || 1, maxAssignedCol + 1);
    }

    // Auto-create detected animations if requested
    if (options.createAnimations !== false) {
      if (!doc.animations) doc.animations = {};
      for (const animName in animGroups) {
        const sorted = animGroups[animName].sort((a, b) => a.col - b.col);
        const animDir = sorted[0].dir || inferDirectionFromTagOrRow(animName, 0);
        doc.animations[animName] = {
          id: animName,
          name: animName.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          direction: animDir,
          frames: sorted.map(s => s.cellId),
          fps: options.fps || 8,
          loop: true,
          mode: 'loop'
        };
      }
    }

    return doc;
  }

  return {
    parseAtlasJSON,
    sliceGrid,
    sliceAlphaIslands,
    extractFramePixels,
    importFramesToDoc
  };
});

