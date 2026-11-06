/**
 * PIX2 Format Engine & Parser / Serializer
 * Specification v1.0
 * AI-Native Structured Pixel Art Language
 * 
 * Core Invariant: Pure Transparency (Zero background, only explicitly drawn pixels are saved).
 * Supports: #RGB, #RGBA, #RRGGBB, #RRGGBBAA, decoupled Cell IDs, user-defined animations.
 */

const PIX2 = (function () {
  'use strict';

  // ===========================================================================
  // COMMENT & LEXER DISAMBIGUATION
  // ===========================================================================

  /**
   * Strips comments from a line while strictly preserving HEX colors.
   * - Semicolon ';' is always a comment.
   * - Hash '#' is a comment ONLY if preceded by whitespace and not part of a valid hex color.
   */
  function stripComment(rawLine) {
    if (!rawLine) return '';

    // 1. Strip semicolon comment first
    const semiIdx = rawLine.indexOf(';');
    let text = (semiIdx >= 0 ? rawLine.slice(0, semiIdx) : rawLine);

    // 2. Character scan for '#' comment vs hex color
    let result = '';
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' || ch === "'") {
        inQuote = !inQuote;
      }

      if (!inQuote && ch === '#') {
        const rest = text.slice(i);
        // Valid hex colors: #RGB, #RGBA, #RRGGBB, #RRGGBBAA followed by delimiter or end
        const hexMatch = rest.match(/^#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?=[\s,;"']|$)/);
        if (hexMatch) {
          // This is an actual hex color! Keep it
          result += hexMatch[0];
          i += hexMatch[0].length - 1;
          continue;
        } else {
          // This is a comment token! Discard rest of line
          break;
        }
      }

      result += ch;
    }

    return result.trim();
  }

  // ===========================================================================
  // COLOR HANDLING & RGBA PRESERVATION
  // ===========================================================================

  /**
   * Normalize hex color string.
   * Preserves full alpha for 4-digit and 8-digit RGBA codes.
   */
  function normalizeHex(hex) {
    if (!hex) return '#000000';
    hex = hex.trim().toLowerCase();
    if (!hex.startsWith('#')) hex = '#' + hex;

    const raw = hex.slice(1);
    // 3-digit RGB: #rgb -> #rrggbb
    if (raw.length === 3) {
      return '#' + raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2];
    }
    // 4-digit RGBA: #rgba -> #rrggbbaa
    if (raw.length === 4) {
      return '#' + raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
    }
    // 6-digit RRGGBB
    if (raw.length === 6) {
      return hex;
    }
    // 8-digit RRGGBBAA
    if (raw.length === 8) {
      if (raw.endsWith('ff')) {
        return '#' + raw.slice(0, 6); // Opaque alpha normalized to 6 digits
      }
      return hex; // Preserve non-opaque alpha!
    }

    return hex.slice(0, 7);
  }

  /**
   * Convert hex color (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) to RGBA object.
   */
  function hexToRgba(hex) {
    if (!hex) return { r: 0, g: 0, b: 0, a: 0 };
    hex = hex.replace('#', '').trim().toLowerCase();

    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + 'ff';
    } else if (hex.length === 4) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    } else if (hex.length === 6) {
      hex = hex + 'ff';
    } else if (hex.length === 8) {
      // already 8 digits
    } else {
      return { r: 0, g: 0, b: 0, a: 255 };
    }

    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    const a = parseInt(hex.slice(6, 8), 16);
    return { r, g, b, a: isNaN(a) ? 255 : a };
  }

  /**
   * Convert RGBA numbers to normalized hex string.
   */
  function rgbaToHex(r, g, b, a = 255) {
    const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    if (a < 255) {
      return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // ===========================================================================
  // DOCUMENT CREATION & DATA MODEL
  // ===========================================================================

  /**
   * Create a new PIX2 document
   */
  function createDocument(title = 'New Sprite', cols = 4, rows = 4, cellW = 16, cellH = 16) {
    const doc = {
      meta: {
        title: title,
        author: 'User',
        version: '1.0',
        color_mode: 'RGBA',
        coordinate_origin: 'top-left',
        grid: { cols, rows },
        cellSize: { w: cellW, h: cellH },
        gap: 0,
        margin: 0
      },
      palette: {
        1: '#1a1a24',
        2: '#ffffff',
        3: '#ff6b8b',
        4: '#4ecdc4',
        5: '#ffe66d'
      },
      animations: {},
      cells: {}
    };

    // Initialize all grid cells with explicit ID and coordinates
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `cell_${r}_${c}`;
        doc.cells[id] = {
          id: id,
          name: `Frame ${r},${c}`,
          row: r,
          col: c,
          direction: 'none',
          frame: c,
          pixels: {} // key "x,y" => hexColor
        };
      }
    }

    // Default animation setup (only if 4x4, user can edit/delete freely)
    if (cols >= 4 && rows >= 4) {
      doc.animations['walk_down'] = {
        name: 'Walk Down',
        direction: 'down',
        frames: ['cell_0_0', 'cell_0_1', 'cell_0_2', 'cell_0_3'],
        fps: 6,
        loop: true,
        mode: 'loop'
      };
      doc.animations['walk_up'] = {
        name: 'Walk Up',
        direction: 'up',
        frames: ['cell_1_0', 'cell_1_1', 'cell_1_2', 'cell_1_3'],
        fps: 6,
        loop: true,
        mode: 'loop'
      };
      doc.animations['walk_right'] = {
        name: 'Walk Right',
        direction: 'right',
        frames: ['cell_2_0', 'cell_2_1', 'cell_2_2', 'cell_2_3'],
        fps: 6,
        loop: true,
        mode: 'loop'
      };
      doc.animations['walk_left'] = {
        name: 'Walk Left',
        direction: 'left',
        frames: ['cell_3_0', 'cell_3_1', 'cell_3_2', 'cell_3_3'],
        fps: 6,
        loop: true,
        mode: 'loop'
      };
    }

    return doc;
  }

  // ===========================================================================
  // PARSER (PIX2 Text -> Document Object)
  // ===========================================================================

  /**
   * Parse .pix2 text into internal document model
   */
  function parse(text) {
    if (!text) return createDocument();

    const lines = text.split(/\r?\n/);
    const doc = {
      meta: {
        title: 'Untitled',
        author: 'Unknown',
        version: '1.0',
        color_mode: 'RGBA',
        coordinate_origin: 'top-left',
        grid: { cols: 4, rows: 4 },
        cellSize: { w: 16, h: 16 },
        gap: 0,
        margin: 0
      },
      palette: {},
      animations: {},
      cells: {}
    };

    let currentSection = null;
    let currentCell = null;
    let currentAnim = null;

    for (let i = 0; i < lines.length; i++) {
      const line = stripComment(lines[i]);
      if (!line) continue;

      // Section Directives (@...)
      if (line.startsWith('@')) {
        const parts = line.slice(1).trim().split(/\s+/);
        const secName = parts[0].toLowerCase();

        if (secName === 'pix2') {
          doc.meta.version = parts[1] || '1.0';
          continue;
        } else if (secName === 'meta') {
          currentSection = 'meta';
          currentCell = null;
          currentAnim = null;
          continue;
        } else if (secName === 'grid') {
          currentSection = 'grid';
          currentCell = null;
          currentAnim = null;
          continue;
        } else if (secName === 'palette') {
          currentSection = 'palette';
          currentCell = null;
          currentAnim = null;
          continue;
        } else if (secName === 'animations') {
          currentSection = 'animations_block';
          currentCell = null;
          currentAnim = null;
          continue;
        } else if (secName === 'animation') {
          currentSection = 'animation';
          currentCell = null;
          const animId = parts[1] || `anim_${Object.keys(doc.animations).length}`;
          currentAnim = {
            id: animId,
            name: animId,
            direction: 'none',
            frames: [],
            fps: 6,
            loop: true,
            mode: 'loop'
          };
          doc.animations[animId] = currentAnim;
          continue;
        } else if (secName === 'cell' || secName === 'frame') {
          currentSection = 'cell';
          currentAnim = null;
          const cellId = parts[1] || `cell_${Object.keys(doc.cells).length}`;

          // Detect row & col if cellId has standard pattern
          let parsedRow = null, parsedCol = null;
          const match = cellId.match(/cell_(\d+)_(\d+)/);
          if (match) {
            parsedRow = parseInt(match[1], 10);
            parsedCol = parseInt(match[2], 10);
          }

          currentCell = {
            id: cellId,
            name: cellId,
            row: parsedRow,
            col: parsedCol,
            direction: 'none',
            frame: parsedCol !== null ? parsedCol : 0,
            pixels: {}
          };
          doc.cells[cellId] = currentCell;
          continue;
        } else if (secName === 'end') {
          break;
        }
      }

      // Inside @meta or @grid
      if (currentSection === 'meta' || currentSection === 'grid') {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim().toLowerCase();
          const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

          if (key === 'title' || key === 'name') doc.meta.title = val;
          else if (key === 'author') doc.meta.author = val;
          else if (key === 'version') doc.meta.version = val;
          else if (key === 'color_mode') doc.meta.color_mode = val;
          else if (key === 'coordinate_origin') doc.meta.coordinate_origin = val;
          else if (key === 'columns' || key === 'cols') doc.meta.grid.cols = parseInt(val, 10) || 4;
          else if (key === 'rows') doc.meta.grid.rows = parseInt(val, 10) || 4;
          else if (key === 'grid') {
            const dims = val.split('x').map(n => parseInt(n.trim(), 10));
            doc.meta.grid = { cols: dims[0] || 4, rows: dims[1] || 4 };
          } else if (key === 'default_cell' || key === 'cell_size') {
            const dims = val.split('x').map(n => parseInt(n.trim(), 10));
            doc.meta.cellSize = { w: dims[0] || 16, h: dims[1] || 16 };
          } else if (key === 'gap') {
            doc.meta.gap = parseInt(val, 10) || 0;
          } else if (key === 'margin') {
            doc.meta.margin = parseInt(val, 10) || 0;
          }
        }
      }

      // Inside @palette
      else if (currentSection === 'palette') {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const id = line.slice(0, colonIdx).trim();
          const colorToken = line.slice(colonIdx + 1).trim().split(/\s+/)[0];
          doc.palette[id] = normalizeHex(colorToken);
        }
      }

      // Inside @animations (legacy block syntax: `walk_down: [c0, c1] @ 6fps loop`)
      else if (currentSection === 'animations_block') {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const animName = line.slice(0, colonIdx).trim();
          const rest = line.slice(colonIdx + 1).trim();
          const framesMatch = rest.match(/\[(.*?)\]/);
          let frames = [];
          if (framesMatch) {
            frames = framesMatch[1].split(',').map(s => s.trim()).filter(Boolean);
          }
          let fps = 6;
          const fpsMatch = rest.match(/@\s*(\d+)\s*fps/i);
          if (fpsMatch) fps = parseInt(fpsMatch[1], 10);
          const loop = !/once/i.test(rest);
          doc.animations[animName] = {
            id: animName,
            name: animName,
            direction: 'none',
            frames,
            fps,
            loop,
            mode: loop ? 'loop' : 'once'
          };
        }
      }

      // Inside individual @animation
      else if (currentSection === 'animation' && currentAnim) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim().toLowerCase();
          const val = line.slice(colonIdx + 1).trim();

          if (key === 'name') currentAnim.name = val.replace(/^["']|["']$/g, '');
          else if (key === 'direction') currentAnim.direction = val.toLowerCase();
          else if (key === 'fps') currentAnim.fps = parseInt(val, 10) || 6;
          else if (key === 'loop') currentAnim.loop = (val.toLowerCase() === 'true');
          else if (key === 'mode') currentAnim.mode = val.toLowerCase();
          else if (key === 'frames') {
            const framesMatch = val.match(/\[(.*?)\]/);
            if (framesMatch) {
              currentAnim.frames = framesMatch[1].split(',').map(s => s.trim()).filter(Boolean);
            }
          }
        }
      }

      // Inside @cell
      else if (currentSection === 'cell' && currentCell) {
        // Properties
        if (line.startsWith('name:')) {
          currentCell.name = line.slice(5).trim().replace(/^["']|["']$/g, '');
          continue;
        } else if (line.startsWith('direction:') || line.startsWith('dir:')) {
          currentCell.direction = line.split(':')[1].trim().toLowerCase();
          continue;
        } else if (line.startsWith('frame:')) {
          currentCell.frame = parseInt(line.split(':')[1].trim(), 10) || 0;
          continue;
        } else if (line.startsWith('grid_pos:') || line.startsWith('pos:')) {
          const [r, c] = line.split(':')[1].split(',').map(n => parseInt(n.trim(), 10));
          currentCell.row = r;
          currentCell.col = c;
          continue;
        } else if (line.startsWith('size:')) {
          const dims = line.split(':')[1].split('x').map(n => parseInt(n.trim(), 10));
          currentCell.size = { w: dims[0] || doc.meta.cellSize.w, h: dims[1] || doc.meta.cellSize.h };
          continue;
        }

        // Multiple pixel tokens on one line: e.g. "p 5,2 1  p 6,2 2  p 7,2 #ffffff"
        if (line.startsWith('p ') || line.includes(' p ') || line.startsWith('pixel ') || line.includes(' pixel ')) {
          const tokens = line.split(/\s+/);
          for (let t = 0; t < tokens.length; t++) {
            const tok = tokens[t].toLowerCase();
            if ((tok === 'p' || tok === 'pixel') && t + 2 < tokens.length) {
              const coord = tokens[t + 1];
              const colRef = tokens[t + 2];
              const [x, y] = coord.split(',').map(n => parseInt(n, 10));
              const color = resolveColor(colRef, doc.palette);
              if (!isNaN(x) && !isNaN(y) && color) {
                currentCell.pixels[`${x},${y}`] = color;
              }
              t += 2;
            }
          }
          continue;
        }

        // AI Vector Commands
        const parts = line.split(/\s+/);
        const cmd = parts[0].toLowerCase();

        if (cmd === 'dot' || cmd === 'd') {
          const [x, y] = (parts[1] || '').split(',').map(n => parseInt(n, 10));
          const color = resolveColor(parts[2], doc.palette);
          if (!isNaN(x) && !isNaN(y) && color) {
            currentCell.pixels[`${x},${y}`] = color;
          }
        } else if (cmd === 'line') {
          const [x1, y1] = (parts[1] || '').split(',').map(n => parseInt(n, 10));
          const [x2, y2] = (parts[2] || '').split(',').map(n => parseInt(n, 10));
          const color = resolveColor(parts[3], doc.palette);
          if (color) {
            drawLineBresenham(x1, y1, x2, y2, (x, y) => {
              currentCell.pixels[`${x},${y}`] = color;
            });
          }
        } else if (cmd === 'rect') {
          const [x, y] = (parts[1] || '').split(',').map(n => parseInt(n, 10));
          const [w, h] = (parts[2] || '').split(',').map(n => parseInt(n, 10));
          const color = resolveColor(parts[3], doc.palette);
          const mode = (parts[4] || 'outline').toLowerCase();
          if (color && !isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
            for (let dy = 0; dy < h; dy++) {
              for (let dx = 0; dx < w; dx++) {
                if (mode === 'fill' || dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1) {
                  currentCell.pixels[`${x + dx},${y + dy}`] = color;
                }
              }
            }
          }
        } else if (cmd === 'fill') {
          const [startX, startY] = (parts[1] || '').split(',').map(n => parseInt(n, 10));
          const color = resolveColor(parts[2], doc.palette);
          if (color && !isNaN(startX) && !isNaN(startY)) {
            floodFillCell(currentCell, startX, startY, color, doc.meta.cellSize);
          }
        } else if (cmd === 'sym_dot') {
          const [x, y] = (parts[1] || '').split(',').map(n => parseInt(n, 10));
          const axisX = parseFloat(parts[2]) || ((doc.meta.cellSize.w - 1) / 2);
          const color = resolveColor(parts[3], doc.palette);
          if (color && !isNaN(x) && !isNaN(y)) {
            currentCell.pixels[`${x},${y}`] = color;
            const mx = Math.round(2 * axisX - x);
            currentCell.pixels[`${mx},${y}`] = color;
          }
        }
      }
    }

    // Post-check: ensure cells without explicit grid position are placed logically
    let autoRow = 0, autoCol = 0;
    const cols = doc.meta.grid.cols || 4;
    for (const cid in doc.cells) {
      const cell = doc.cells[cid];
      if (cell.row === null || isNaN(cell.row)) {
        cell.row = autoRow;
        cell.col = autoCol;
        autoCol++;
        if (autoCol >= cols) {
          autoCol = 0;
          autoRow++;
        }
      }
    }

    return doc;
  }

  /**
   * Resolve a color token to valid Hex.
   */
  function resolveColor(token, palette) {
    if (!token) return null;
    token = token.trim();
    if (palette && palette[token]) {
      return palette[token];
    }
    return normalizeHex(token);
  }

  // ===========================================================================
  // BRESENHAM & FLOOD FILL ALGORITHMS
  // ===========================================================================

  function drawLineBresenham(x0, y0, x1, y1, plot) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = (x0 < x1) ? 1 : -1;
    let sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
      plot(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      let e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  function floodFillCell(cell, startX, startY, newColor, cellSize) {
    const targetColor = cell.pixels[`${startX},${startY}`] || null;
    if (targetColor === newColor) return;

    const queue = [[startX, startY]];
    const visited = new Set();
    const w = cellSize.w, h = cellSize.h;

    while (queue.length > 0) {
      const [x, y] = queue.pop();
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const cur = cell.pixels[key] || null;
      if (cur === targetColor) {
        cell.pixels[key] = newColor;
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
  }

  // ===========================================================================
  // SERIALIZER (Document Object -> PIX2 Text)
  // ===========================================================================

  /**
   * Serialize document object to canonical .pix2 string
   */
  function serialize(doc) {
    // 1. Gather all unique colors used across cells
    const colorUsage = {};
    for (const cellId in doc.cells) {
      const cell = doc.cells[cellId];
      for (const k in cell.pixels) {
        const c = normalizeHex(cell.pixels[k]);
        colorUsage[c] = (colorUsage[c] || 0) + 1;
      }
    }

    // Build palette map (color -> ID)
    const sortedColors = Object.entries(colorUsage).sort((a, b) => b[1] - a[1]);
    const paletteMap = {};
    const paletteOut = {};
    let palId = 1;

    // Preserve existing palette entries
    for (const id in doc.palette) {
      const c = normalizeHex(doc.palette[id]);
      if (colorUsage[c] && !paletteMap[c]) {
        paletteMap[c] = id;
        paletteOut[id] = c;
      }
    }

    // Assign indexed IDs for any new colors
    for (const [c] of sortedColors) {
      if (!paletteMap[c]) {
        while (paletteOut[palId]) palId++;
        paletteMap[c] = String(palId);
        paletteOut[palId] = c;
        palId++;
      }
    }

    const lines = [];
    lines.push('@pix2 1.0');
    lines.push('');
    lines.push('@meta');
    lines.push(`  title: "${doc.meta.title || 'Untitled'}"`);
    lines.push(`  author: "${doc.meta.author || 'User'}"`);
    lines.push(`  version: "${doc.meta.version || '1.0'}"`);
    lines.push(`  color_mode: "${doc.meta.color_mode || 'RGBA'}"`);
    lines.push(`  coordinate_origin: "${doc.meta.coordinate_origin || 'top-left'}"`);
    lines.push('');

    lines.push('@grid');
    lines.push(`  columns: ${doc.meta.grid.cols}`);
    lines.push(`  rows: ${doc.meta.grid.rows}`);
    lines.push(`  default_cell: ${doc.meta.cellSize.w}x${doc.meta.cellSize.h}`);
    if (doc.meta.gap) lines.push(`  gap: ${doc.meta.gap}`);
    if (doc.meta.margin) lines.push(`  margin: ${doc.meta.margin}`);
    lines.push('  background: none');
    lines.push('');

    lines.push('@palette');
    const sortedPalKeys = Object.keys(paletteOut).sort((a, b) => {
      const na = parseInt(a, 10), nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    for (const k of sortedPalKeys) {
      lines.push(`  ${k}: ${paletteOut[k]}`);
    }
    lines.push('');

    // Cells Output
    const cellIds = Object.keys(doc.cells).sort((a, b) => {
      const ca = doc.cells[a], cb = doc.cells[b];
      return ((ca.row || 0) - (cb.row || 0)) || ((ca.col || 0) - (cb.col || 0));
    });

    for (const cid of cellIds) {
      const cell = doc.cells[cid];
      lines.push(`@cell ${cid}`);
      if (cell.name) lines.push(`  name: "${cell.name}"`);
      if (cell.direction && cell.direction !== 'none') lines.push(`  direction: ${cell.direction}`);
      if (cell.frame !== undefined) lines.push(`  frame: ${cell.frame}`);
      if (cell.row !== null && cell.col !== null && !isNaN(cell.row) && !isNaN(cell.col)) {
        lines.push(`  grid_pos: ${cell.row},${cell.col}`);
      }
      if (cell.size) lines.push(`  size: ${cell.size.w}x${cell.size.h}`);

      // Group pixels by Y coordinate for clean human/AI reading
      const pixelsByY = {};
      for (const coord in cell.pixels) {
        const [x, y] = coord.split(',').map(n => parseInt(n, 10));
        if (!pixelsByY[y]) pixelsByY[y] = [];
        const color = normalizeHex(cell.pixels[coord]);
        const pId = paletteMap[color] || color;
        pixelsByY[y].push({ x, pId });
      }

      const sortedY = Object.keys(pixelsByY).map(Number).sort((a, b) => a - b);
      for (const y of sortedY) {
        const rowPixels = pixelsByY[y].sort((a, b) => a.x - b.x);
        const pStrs = rowPixels.map(p => `pixel ${p.x},${y} ${p.pId}`);
        lines.push('  ' + pStrs.join(' '));
      }
      lines.push('');
    }

    // Animations Output
    for (const animId in doc.animations) {
      const anim = doc.animations[animId];
      lines.push(`@animation ${animId}`);
      if (anim.name) lines.push(`  name: "${anim.name}"`);
      if (anim.direction && anim.direction !== 'none') lines.push(`  direction: ${anim.direction}`);
      const framesStr = (anim.frames || []).join(', ');
      lines.push(`  frames: [${framesStr}]`);
      lines.push(`  fps: ${anim.fps || 6}`);
      lines.push(`  loop: ${anim.loop !== false}`);
      if (anim.mode) lines.push(`  mode: ${anim.mode}`);
      lines.push('');
    }

    lines.push('@end');
    return lines.join('\n');
  }

  // ===========================================================================
  // CELL RESIZING & PNG SLICING
  // ===========================================================================

  function resizeCells(doc, newW, newH, mode = 'scale') {
    const oldW = doc.meta.cellSize.w;
    const oldH = doc.meta.cellSize.h;
    if (oldW === newW && oldH === newH) return doc;

    const scaleX = newW / oldW;
    const scaleY = newH / oldH;

    for (const cid in doc.cells) {
      const cell = doc.cells[cid];
      const newPixels = {};

      if (mode === 'scale') {
        for (let ny = 0; ny < newH; ny++) {
          for (let nx = 0; nx < newW; nx++) {
            const srcX = Math.floor(nx / scaleX);
            const srcY = Math.floor(ny / scaleY);
            const color = cell.pixels[`${srcX},${srcY}`];
            if (color) {
              newPixels[`${nx},${ny}`] = color;
            }
          }
        }
      } else {
        const offsetX = Math.floor((newW - oldW) / 2);
        const offsetY = Math.floor((newH - oldH) / 2);
        for (const coord in cell.pixels) {
          const [x, y] = coord.split(',').map(Number);
          const nx = x + offsetX;
          const ny = y + offsetY;
          if (nx >= 0 && nx < newW && ny >= 0 && ny < newH) {
            newPixels[`${nx},${ny}`] = cell.pixels[coord];
          }
        }
      }

      cell.pixels = newPixels;
    }

    doc.meta.cellSize = { w: newW, h: newH };
    return doc;
  }

  /**
   * Slices an RGBA ImageData buffer into a structured PIX2 document with exact alpha preservation.
   */
  function sliceImageIntoDoc(imgData, options = {}) {
    const {
      width = imgData.width,
      height = imgData.height,
      cols = 4,
      rows = 4,
      cellW = 16,
      cellH = 16,
      gapX = 0,
      gapY = 0,
      marginX = 0,
      marginY = 0,
      title = 'Imported Sprite'
    } = options;

    const doc = createDocument(title, cols, rows, cellW, cellH);
    doc.meta.gap = gapX;
    doc.meta.margin = marginX;
    doc.palette = {};

    const data = imgData.data;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellId = `cell_${r}_${c}`;
        const cell = doc.cells[cellId] || {
          id: cellId,
          name: `Frame ${r},${c}`,
          row: r,
          col: c,
          direction: 'none',
          frame: c,
          pixels: {}
        };
        doc.cells[cellId] = cell;

        const startX = marginX + c * (cellW + gapX);
        const startY = marginY + r * (cellH + gapY);

        for (let py = 0; py < cellH; py++) {
          for (let px = 0; px < cellW; px++) {
            const sx = startX + px;
            const sy = startY + py;
            if (sx >= width || sy >= height) continue;

            const idx = (sy * width + sx) * 4;
            const a = data[idx + 3];

            // Only store pixels with visible alpha!
            if (a > 0) {
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const hex = rgbaToHex(r, g, b, a);
              cell.pixels[`${px},${py}`] = hex;
            }
          }
        }
      }
    }

    return doc;
  }

  return {
    createDocument,
    parse,
    serialize,
    resizeCells,
    sliceImageIntoDoc,
    normalizeHex,
    hexToRgba,
    rgbaToHex,
    stripComment,
    drawLineBresenham
  };
})();

// Export for Node.js test environment or ES module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PIX2;
}
