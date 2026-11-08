/**
 * NOIRADIX Studio 2.0 / PIX2 1.1
 * Modular Sprite Pipeline & Structured Component Export
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    const PIX2 = require('./pix2-format.js');
    let versionInfo = null;
    try { versionInfo = require('./version.js'); } catch (_) {}
    module.exports = factory(PIX2, versionInfo);
  } else {
    root.ModularExport = factory(root.PIX2, root.NOIRADIX_VERSION);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PIX2, versionInfo) {
  'use strict';

  const CANONICAL_DOMAIN = (versionInfo && versionInfo.canonicalDomain) || 'https://noiradix.me';
  const DEFAULT_SCHEMA_URI = `${CANONICAL_DOMAIN}/schemas/pix2-manifest-v1.json`;

  // CRC32 implementation for zero-dependency ZIP generation
  const CRC32_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  // Pure JS uncompressed ZIP builder
  function buildZipArchive(files) {
    const parts = [];
    const centralDir = [];
    let offset = 0;

    for (const f of files) {
      const safeEntryName = f.name.replace(/\\/g, '/').replace(/^\/+/, '');
      const nameBuf = typeof Buffer !== 'undefined'
        ? Buffer.from(safeEntryName, 'utf8')
        : new TextEncoder().encode(safeEntryName);

      const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
      const crc = crc32(data);
      const size = data.length;

      const lHeader = new Uint8Array(30 + nameBuf.length);
      const lv = new DataView(lHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBuf.length, true);
      lv.setUint16(28, 0, true);
      lHeader.set(nameBuf, 30);

      parts.push(lHeader);
      parts.push(data);

      const cHeader = new Uint8Array(46 + nameBuf.length);
      const cv = new DataView(cHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBuf.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cHeader.set(nameBuf, 46);

      centralDir.push(cHeader);
      offset += lHeader.length + data.length;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const h of centralDir) {
      parts.push(h);
      cdSize += h.length;
    }

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdOffset, true);
    ev.setUint16(20, 0, true);
    parts.push(eocd);

    if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
      return new Blob(parts, { type: 'application/zip' });
    } else {
      // In Node.js buffer environment
      const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
      const combined = (typeof Buffer !== 'undefined') ? Buffer.alloc(totalLen) : new Uint8Array(totalLen);
      let cur = 0;
      for (const p of parts) {
        combined.set(p, cur);
        cur += p.length;
      }
      return combined;
    }
  }

  // Calculate bounding box and optionally trim pixel map
  function computeBoundingBox(pixels) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let count = 0;
    for (const k in pixels) {
      if (!pixels[k]) continue;
      const parsed = PIX2.parseCoordinate(k);
      if (!parsed) continue;
      const [x, y] = parsed;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      count++;
    }
    if (count === 0) {
      return { isEmpty: true, minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
    }
    return {
      isEmpty: false,
      minX,
      minY,
      maxX,
      maxY,
      w: maxX - minX + 1,
      h: maxY - minY + 1
    };
  }

  // Extract component pixel buffers for a node
  function extractNodePixels(node, parentOpacity = 1.0) {
    if (!node || node.visible === false) return {};
    const effectiveOpacity = (node.type === 'layer' ? (node.opacity !== undefined ? node.opacity : 1.0) : 1.0) * parentOpacity;
    const pixels = {};

    function collect(n, op) {
      if (!n || n.visible === false) return;
      if (n.type === 'region' && n.pixels) {
        for (const k in n.pixels) {
          const hex = n.pixels[k];
          if (!hex) continue;
          if (op >= 1.0) {
            pixels[k] = hex;
          } else {
            const rgba = PIX2.hexToRgba(hex);
            if (rgba) {
              const blendedA = Math.round(rgba.a * op);
              pixels[k] = PIX2.rgbaToHex(rgba.r, rgba.g, rgba.b, blendedA);
            }
          }
        }
      }
      for (const child of n.children || []) {
        collect(child, op);
      }
    }

    collect(node, effectiveOpacity);
    return pixels;
  }

  // Generate PNG data bytes from pixel object
  function renderPixelsToPngBytes(pixels, w, h) {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const imgData = ctx.createImageData(canvas.width, canvas.height);
      const d = imgData.data;

      for (const k in pixels) {
        const coord = PIX2.parseCoordinate(k);
        if (!coord) continue;
        const [x, y] = coord;
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
        const rgba = PIX2.hexToRgba(pixels[k]);
        const idx = (y * canvas.width + x) * 4;
        d[idx] = rgba.r;
        d[idx + 1] = rgba.g;
        d[idx + 2] = rgba.b;
        d[idx + 3] = rgba.a;
      }
      ctx.putImageData(imgData, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } else {
      // Minimal pure uncompressed PNG / BMP or mock buffer in headless test environment
      const header = Buffer.from('89504e470d0a1a0a', 'hex');
      const dummy = Buffer.alloc(32);
      dummy.write(JSON.stringify({ w, h, pixelCount: Object.keys(pixels).length }), 'utf8');
      return Buffer.concat([header, dummy]);
    }
  }

  /**
   * Export Modular Components or Composite Sprites with Manifest
   * @param {Object} doc - PIX2 Document
   * @param {Object} [options] - Export configuration options
   * @returns {{ manifest: Object, files: Array<{ name: string, data: Uint8Array }>, zip: Blob|Buffer }}
   */
  function exportModularComponents(doc, options = {}) {
    if (!doc || !doc.cells) {
      throw new Error('Invalid PIX2 document');
    }

    const mode = options.mode || 'modular'; // 'modular' | 'composite'
    const trimmed = Boolean(options.trimmed);
    const bakeOpacity = options.bakeOpacity !== false;
    const defaultDim = (doc.meta && (doc.meta.cell_size || doc.meta.cellSize)) || { w: 16, h: 16 };
    const defaultW = defaultDim.w || 16;
    const defaultH = defaultDim.h || 16;

    const files = [];
    const components = [];
    const manifestAnimations = [];

    // Ensure document is normalized if v1.0
    const workingDoc = (!doc.meta.version || doc.meta.version === '1.0')
      ? PIX2.upgradeV10ToV11(doc).doc
      : doc;

    if (mode === 'composite') {
      // Mode A: Composite visible layers per cell into transparent PNGs
      let order = 1;
      for (const cid in workingDoc.cells) {
        const cell = workingDoc.cells[cid];
        const cellW = (cell.size && cell.size.w) || defaultW;
        const cellH = (cell.size && cell.size.h) || defaultH;
        const compPixels = PIX2.compositeCellLayers(cell, { w: cellW, h: cellH });

        let exportPixels = compPixels;
        let outW = cellW;
        let outH = cellH;
        let trimOffset = null;

        if (trimmed) {
          const bbox = computeBoundingBox(compPixels);
          if (!bbox.isEmpty) {
            trimOffset = { x: bbox.minX, y: bbox.minY, w: bbox.w, h: bbox.h };
            outW = bbox.w;
            outH = bbox.h;
            exportPixels = {};
            for (const k in compPixels) {
              const coord = PIX2.parseCoordinate(k);
              if (coord) {
                exportPixels[`${coord[0] - bbox.minX},${coord[1] - bbox.minY}`] = compPixels[k];
              }
            }
          }
        }

        const filePath = `sprites/${cid}.png`;
        const pngBytes = renderPixelsToPngBytes(exportPixels, outW, outH);
        files.push({ name: filePath, data: pngBytes });

        components.push({
          id: cid,
          type: 'cell',
          name: cell.name || cid,
          path: filePath,
          size: { w: outW, h: outH },
          pivot: { x: 0.5, y: 0.5 },
          trimOffset,
          order: order++,
          visible: true,
          opacity: 1.0
        });
      }
    } else {
      // Mode B: Modular components per layer/group
      let order = 1;
      // Extract structural components across cells
      for (const cid in workingDoc.cells) {
        const cell = workingDoc.cells[cid];
        const cellW = (cell.size && cell.size.w) || defaultW;
        const cellH = (cell.size && cell.size.h) || defaultH;

        for (const layer of cell.layers || []) {
          if (layer.visible === false) continue;
          const nodePixels = extractNodePixels(layer, 1.0);
          let exportPixels = nodePixels;
          let outW = cellW;
          let outH = cellH;
          let trimOffset = null;

          if (trimmed) {
            const bbox = computeBoundingBox(nodePixels);
            if (!bbox.isEmpty) {
              trimOffset = { x: bbox.minX, y: bbox.minY, w: bbox.w, h: bbox.h };
              outW = bbox.w;
              outH = bbox.h;
              exportPixels = {};
              for (const k in nodePixels) {
                const coord = PIX2.parseCoordinate(k);
                if (coord) {
                  exportPixels[`${coord[0] - bbox.minX},${coord[1] - bbox.minY}`] = nodePixels[k];
                }
              }
            }
          }

          const filePath = `components/${cid}_${layer.id}.png`;
          const pngBytes = renderPixelsToPngBytes(exportPixels, outW, outH);
          files.push({ name: filePath, data: pngBytes });

          components.push({
            id: `${cid}_${layer.id}`,
            layerId: layer.id,
            cellId: cid,
            type: layer.type,
            name: layer.name || layer.id,
            path: filePath,
            size: { w: outW, h: outH },
            pivot: { x: 0.5, y: 0.5 },
            trimOffset,
            order: order++,
            visible: layer.visible !== false,
            opacity: layer.opacity !== undefined ? layer.opacity : 1.0
          });
        }
      }
    }

    // Process animations
    if (workingDoc.animations) {
      for (const animId in workingDoc.animations) {
        const anim = workingDoc.animations[animId];
        const animEntry = {
          name: anim.name || animId,
          fps: anim.fps || 6,
          loop: anim.loop !== false,
          action: anim.action || undefined,
          direction: anim.direction || undefined,
          template: anim.template || undefined,
          components: {}
        };

        if (mode === 'composite') {
          animEntry.frames = (anim.frames || []).map(fId => `sprites/${fId}.png`);
        } else {
          // Track layer components for each frame
          for (const fId of anim.frames || []) {
            const cell = workingDoc.cells[fId];
            if (cell && cell.layers) {
              for (const l of cell.layers) {
                const compKey = l.name || l.id;
                if (!animEntry.components[compKey]) animEntry.components[compKey] = [];
                animEntry.components[compKey].push(`components/${fId}_${l.id}.png`);
              }
            }
          }
        }

        manifestAnimations.push(animEntry);
      }
    }

    // Engine-Neutral Manifest Schema
    const manifest = {
      $schema: options.schemaUri || DEFAULT_SCHEMA_URI,
      formatVersion: '1.1',
      generator: 'NOIRADIX Studio 2.0.0',
      document: {
        title: (workingDoc.meta && workingDoc.meta.title) || 'Untitled',
        cellSize: { w: defaultW, h: defaultH },
        grid: (workingDoc.meta && workingDoc.meta.grid) || { cols: 4, rows: 4 }
      },
      exportMode: mode,
      trimmed,
      opacityBaked: bakeOpacity,
      components,
      animations: manifestAnimations
    };

    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestBytes = typeof Buffer !== 'undefined'
      ? Buffer.from(manifestJson, 'utf8')
      : new TextEncoder().encode(manifestJson);

    files.push({
      name: 'manifest.json',
      data: manifestBytes
    });

    const zip = buildZipArchive(files);

    return {
      manifest,
      files,
      zip
    };
  }

  return {
    exportModularComponents,
    computeBoundingBox,
    extractNodePixels,
    buildZipArchive,
    crc32
  };
});
