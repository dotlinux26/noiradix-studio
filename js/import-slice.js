/**
 * NOIRADIX Studio 2.0 / PIX2 1.1
 * PNG Spritesheet Slicer & TexturePacker / NOIRADIX JSON Atlas Importer
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    const PIX2 = require('./pix2-format.js');
    module.exports = factory(PIX2);
  } else {
    root.ImportSlice = factory(root.PIX2);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PIX2) {
  'use strict';

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
    const cellW = Math.max(1, options.cellW || 16);
    const cellH = Math.max(1, options.cellH || 16);
    const margin = Math.max(0, options.margin || 0);
    const gap = Math.max(0, options.gap || 0);

    const availableW = atlasW - 2 * margin;
    const availableH = atlasH - 2 * margin;
    const cols = options.cols || Math.floor((availableW + gap) / (cellW + gap));
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

    for (let fy = 0; fy < fh; fy++) {
      for (let fx = 0; fx < fw; fx++) {
        const atlasX = fx_pos + fx;
        const atlasY = fy_pos + fy;
        const rgba = getPixelRgba(atlasX, atlasY);
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
          pixels[`${destX},${destY}`] = PIX2.rgbaToHex(rgba.r, rgba.g, rgba.b, rgba.a);
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
    const animGroups = {};

    let maxCol = doc.meta.grid ? (doc.meta.grid.cols || 4) : 4;
    let curRow = 0, curCol = 0;

    for (const f of frames) {
      const extracted = extractFramePixels(getPixelRgba, f);
      const cellId = `${cellIdPrefix}${f.name}`.replace(/[^a-zA-Z0-9_]/g, '_');

      // Create new cell
      const newCell = {
        id: cellId,
        name: f.name,
        row: f.row !== undefined ? f.row : curRow,
        col: f.col !== undefined ? f.col : curCol,
        direction: 'none',
        frame: curCol,
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
            name: 'Artwork',
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
                tags: [],
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
      if (f.row === undefined || f.col === undefined) {
        curCol++;
        if (curCol >= maxCol) {
          curCol = 0;
          curRow++;
        }
      }

      // Detect animation frame sequence: <name>_<index>
      const match = f.name.match(/^(.*?)[_-](\d+)$/);
      if (match) {
        const animName = match[1];
        const idx = parseInt(match[2], 10);
        if (!animGroups[animName]) animGroups[animName] = [];
        animGroups[animName].push({ idx, cellId });
      }
    }

    // Auto-create detected animations if requested
    if (options.createAnimations !== false) {
      if (!doc.animations) doc.animations = {};
      for (const animName in animGroups) {
        const sorted = animGroups[animName].sort((a, b) => a.idx - b.idx);
        doc.animations[animName] = {
          id: animName,
          name: animName,
          direction: 'none',
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

