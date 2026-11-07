/**
 * PIX2 Format Engine & Reference Compiler
 * Specification v1.0
 * AI-Native Structured Pixel Art Language
 * 
 * Author: Nguyen Duc Canh (@dotlinux26)
 * Copyright: (c) 2026 Nguyen Duc Canh (@dotlinux26)
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Core Invariant: Pure Transparency (Zero background, only explicitly drawn pixels are saved).
 * Supports: #RGB, #RGBA, #RRGGBB, #RRGGBBAA, decoupled Cell IDs, user-defined animations.
 */

const PIX2 = (function () {
  'use strict';

  // ===========================================================================
  // SECURITY & RESOURCE BOUNDS (Anti-DoS & Anti-Prototype Pollution)
  // ===========================================================================
  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
  const MAX_GRID_COLS = 128;
  const MAX_GRID_ROWS = 256;
  const MAX_CELL_DIM = 512;
  const MIN_CELL_DIM = 1;
  const MAX_ANIM_FPS = 120;
  const MAX_FRAMES_PER_ANIM = 512;
  const MAX_TOTAL_CELLS = 4096;
  const MAX_COORD_ABS = 2048;

  function isSafeIdentifier(key) {
    if (!key || typeof key !== 'string') return false;
    const lower = key.trim().toLowerCase();
    return !FORBIDDEN_KEYS.has(lower);
  }

  function sanitizeKey(raw, fallback = 'item') {
    if (!raw || typeof raw !== 'string') return fallback;
    const trimmed = raw.trim();
    if (!isSafeIdentifier(trimmed)) return fallback;
    // Allow safe alphanumeric, underscore, dash; strip path traversals
    const clean = trimmed
      .replace(/\\/g, '/')
      .replace(/\0/g, '')
      .replace(/\.\.+/g, '_')
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 128);
    return clean || fallback;
  }

  // ===========================================================================
  // COMMENT & LEXER DISAMBIGUATION
  // ===========================================================================

  /**
   * Strips comments from a line while strictly preserving HEX colors.
   * - Semicolon ';' is always a comment.
   * - Hash '#' is a comment ONLY if at line start or preceded by whitespace,
   *   and not part of a valid hex color code.
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
        const isPrecededByWhitespace = (i === 0 || /\s/.test(text[i - 1]));
        const rest = text.slice(i);
        // Valid hex colors: #RGB, #RGBA, #RRGGBB, #RRGGBBAA followed by delimiter or end
        const hexMatch = rest.match(/^#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?=[\s,;"']|$)/);
        if (hexMatch) {
          // This is an actual hex color! Keep it
          result += hexMatch[0];
          i += hexMatch[0].length - 1;
          continue;
        } else if (isPrecededByWhitespace) {
          // Comment token at line start or preceded by whitespace! Discard rest of line
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

  const HEX_CHARS_REGEX = /^[0-9a-fA-F]+$/;

  /**
   * Strict validation of hex color codes (must be 3, 4, 6, or 8 hex digits).
   * @param {string} hex
   * @returns {boolean}
   */
  function isValidHex(hex) {
    if (!hex || typeof hex !== 'string') return false;
    const trimmed = hex.trim();
    if (!trimmed.startsWith('#')) return false;
    const raw = trimmed.slice(1);
    if (raw.length !== 3 && raw.length !== 4 && raw.length !== 6 && raw.length !== 8) return false;
    return HEX_CHARS_REGEX.test(raw);
  }

  /**
   * Normalize hex color string.
   * Preserves full alpha for 4-digit and 8-digit RGBA codes.
   * Returns null if input is not a valid hex representation.
   * @param {string} hex
   * @returns {string|null}
   */
  function normalizeHex(hex) {
    if (!hex || typeof hex !== 'string') return null;
    hex = hex.trim().toLowerCase();
    if (!hex.startsWith('#')) hex = '#' + hex;

    const raw = hex.slice(1);
    if (!HEX_CHARS_REGEX.test(raw)) return null;

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

    return null;
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
  // STRICT INTEGER & COORDINATE VALIDATION HELPERS
  // ===========================================================================

  const STRICT_INT_REGEX = /^-?[0-9]+$/;

  /**
   * Parse a strict integer string without allowing trailing non-digit characters (e.g. "1abc"),
   * floats (e.g. "1.5"), or unsafe integer overflow.
   * @param {*} val
   * @returns {number} Integer or NaN
   */
  function parseStrictInt(val) {
    if (typeof val === 'number') return Number.isSafeInteger(val) ? val : NaN;
    if (typeof val !== 'string') return NaN;
    const trimmed = val.trim();
    if (!STRICT_INT_REGEX.test(trimmed)) return NaN;
    const num = Number(trimmed);
    return Number.isSafeInteger(num) ? num : NaN;
  }

  /**
   * Bind non-enumerable backward-compatibility alias for cellSize <-> cell_size.
   * Ensures JSON.stringify only outputs canonical snake_case `cell_size` without duplicate keys.
   * @param {Object} meta
   */
  function attachCellSizeAlias(meta) {
    if (!meta || typeof meta !== 'object') return;
    if (!meta.cell_size) {
      meta.cell_size = meta.cellSize || { w: 16, h: 16 };
    }
    delete meta.cellSize;
    try {
      Object.defineProperty(meta, 'cellSize', {
        get() { return this.cell_size; },
        set(val) { this.cell_size = val; },
        enumerable: false,
        configurable: true
      });
    } catch (e) {
      meta.cellSize = meta.cell_size;
    }
  }

  /**
   * Parse a strict integer coordinate pair string "x,y".
   * @param {string} str
   * @returns {[number, number]|null}
   */
  function parseCoordinate(str) {
    if (typeof str !== 'string') return null;
    const parts = str.split(',');
    if (parts.length !== 2) return null;
    const x = parseStrictInt(parts[0]);
    const y = parseStrictInt(parts[1]);
    if (isNaN(x) || isNaN(y)) return null;
    return [x, y];
  }

  /**
   * Parse a strict dimension string "<w>x<h>".
   * @param {string} str
   * @returns {[number, number]|null}
   */
  function parseDimension(str) {
    if (typeof str !== 'string') return null;
    const parts = str.toLowerCase().split('x');
    if (parts.length !== 2) return null;
    const w = parseStrictInt(parts[0]);
    const h = parseStrictInt(parts[1]);
    if (isNaN(w) || isNaN(h) || w < 0 || h < 0) return null;
    return [w, h];
  }

  /**
   * Escape double quotes and control characters for PIX2 string literals.
   * @param {string} str
   * @returns {string}
   */
  function escapePix2String(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  /**
   * Unescape PIX2 string literals.
   * @param {string} str
   * @returns {string}
   */
  function unescapePix2String(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/^["']|["']$/g, '')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\\\/g, '\\');
  }

  // ===========================================================================
  // DOCUMENT CREATION & DATA MODEL
  // ===========================================================================

  /**
   * Create a new PIX2 document
   */
  function createDocument(title = 'New Sprite', cols = 4, rows = 4, cellW = 16, cellH = 16) {
    cols = Math.min(Math.max(1, parseStrictInt(cols) || 4), MAX_GRID_COLS);
    rows = Math.min(Math.max(1, parseStrictInt(rows) || 4), MAX_GRID_ROWS);
    cellW = Math.min(Math.max(MIN_CELL_DIM, parseStrictInt(cellW) || 16), MAX_CELL_DIM);
    cellH = Math.min(Math.max(MIN_CELL_DIM, parseStrictInt(cellH) || 16), MAX_CELL_DIM);

    const meta = {
      title: String(title || 'New Sprite').normalize('NFC').slice(0, 256),
      author: 'User',
      version: '1.0',
      color_mode: 'RGBA',
      coordinate_origin: 'top-left',
      grid: { cols, rows },
      cell_size: { w: cellW, h: cellH },
      gap: 0,
      margin: 0
    };
    attachCellSizeAlias(meta);

    const doc = {
      meta,
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
          pixels: {}
        };
      }
    }

    return doc;
  }

  // ===========================================================================
  // PARSER (Text -> AST)
  // ===========================================================================

  function parse(text) {
    if (typeof text !== 'string') return createDocument();
    if (text.length > MAX_FILE_SIZE) {
      throw new Error(`PIX2 security violation: file size exceeds maximum limit (${MAX_FILE_SIZE} bytes).`);
    }

    const lines = (text || '').normalize('NFC').split(/\r\n|\r|\n/);
    const doc = createDocument('Untitled', 4, 4, 16, 16);
    doc.meta.version = null; // Requires explicit @pix2 version directive in source
    doc.palette = {};
    doc.cells = {};
    doc.animations = {};

    const diagnostics = [];
    doc._diagnostics = diagnostics;

    let hasPix2Header = false;
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
          hasPix2Header = true;
          if (parts.length >= 2 && parts[1]) {
            doc.meta.version = sanitizeKey(parts[1], '');
            if (doc.meta.version !== '1.0') {
              diagnostics.push({
                code: 'PIX2_ERR_UNSUPPORTED_VERSION',
                line: i + 1,
                message: `Unsupported PIX2 version: "${doc.meta.version}" (expected "1.0")`
              });
            }
          } else {
            doc.meta.version = null;
            diagnostics.push({
              code: 'PIX2_ERR_MISSING_VERSION',
              line: i + 1,
              message: 'Missing version parameter in @pix2 header directive (expected "@pix2 1.0")'
            });
          }
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
          const rawAnimId = parts[1] || `anim_${Object.keys(doc.animations).length}`;
          const animId = sanitizeKey(rawAnimId, `anim_${Object.keys(doc.animations).length}`);
          if (doc.animations[animId]) {
            diagnostics.push({
              code: 'PIX2_WARN_DUPLICATE_ANIMATION',
              line: i + 1,
              message: `Duplicate animation identifier "${animId}" detected. Overwriting previous animation.`
            });
          }
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
          const rawCellId = parts[1] || `cell_${Object.keys(doc.cells).length}`;
          const cellId = sanitizeKey(rawCellId, `cell_${Object.keys(doc.cells).length}`);

          if (doc.cells[cellId]) {
            diagnostics.push({
              code: 'PIX2_WARN_DUPLICATE_CELL',
              line: i + 1,
              message: `Duplicate cell identifier "${cellId}" detected. Overwriting previous cell.`
            });
          }

          // Memory DoS protection: cap maximum cells per document
          if (Object.keys(doc.cells).length >= MAX_TOTAL_CELLS && !doc.cells[cellId]) {
            currentCell = null;
            continue;
          }

          // Detect row & col if cellId has standard pattern
          let parsedRow = null, parsedCol = null;
          const match = cellId.match(/cell_(\d+)_(\d+)/);
          if (match) {
            parsedRow = Math.min(parseInt(match[1], 10), MAX_GRID_ROWS);
            parsedCol = Math.min(parseInt(match[2], 10), MAX_GRID_COLS);
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
          // Check for any illegal trailing content after @end marker
          for (let j = i + 1; j < lines.length; j++) {
            const trailing = stripComment(lines[j]);
            if (trailing) {
              diagnostics.push({
                code: 'PIX2_WARN_TRAILING_CONTENT',
                line: j + 1,
                message: `Unexpected trailing content after @end marker: "${trailing.slice(0, 64)}"`
              });
            }
          }
          break;
        }
      }

      // Inside @meta or @grid
      if (currentSection === 'meta' || currentSection === 'grid') {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim().toLowerCase();
          const val = unescapePix2String(line.slice(colonIdx + 1).trim());

          if (key === 'title' || key === 'name') doc.meta.title = val.normalize('NFC').slice(0, 256);
          else if (key === 'author') doc.meta.author = val.normalize('NFC').slice(0, 128);
          else if (key === 'version') doc.meta.version = val.slice(0, 32);
          else if (key === 'color_mode') doc.meta.color_mode = val.slice(0, 32);
          else if (key === 'coordinate_origin') doc.meta.coordinate_origin = val.slice(0, 32);
          else if (key === 'columns' || key === 'cols') {
            const num = parseStrictInt(val);
            if (!isNaN(num)) {
              doc.meta.grid.cols = Math.min(Math.max(1, num), MAX_GRID_COLS);
            } else {
              diagnostics.push({
                code: 'PIX2_ERR_INVALID_INTEGER',
                line: i + 1,
                message: `Invalid integer for columns: "${val}"`
              });
            }
          } else if (key === 'rows') {
            const num = parseStrictInt(val);
            if (!isNaN(num)) {
              doc.meta.grid.rows = Math.min(Math.max(1, num), MAX_GRID_ROWS);
            } else {
              diagnostics.push({
                code: 'PIX2_ERR_INVALID_INTEGER',
                line: i + 1,
                message: `Invalid integer for rows: "${val}"`
              });
            }
          } else if (key === 'grid') {
            const dims = parseDimension(val);
            if (dims) {
              doc.meta.grid = {
                cols: Math.min(Math.max(1, dims[0]), MAX_GRID_COLS),
                rows: Math.min(Math.max(1, dims[1]), MAX_GRID_ROWS)
              };
            } else {
              diagnostics.push({
                code: 'PIX2_ERR_INVALID_DIMENSION',
                line: i + 1,
                message: `Invalid grid dimension format: "${val}" (expected <cols>x<rows>)`
              });
            }
          } else if (key === 'default_cell' || key === 'cell_size') {
            const dims = parseDimension(val);
            if (dims) {
              doc.meta.cell_size = {
                w: Math.min(Math.max(MIN_CELL_DIM, dims[0]), MAX_CELL_DIM),
                h: Math.min(Math.max(MIN_CELL_DIM, dims[1]), MAX_CELL_DIM)
              };
              attachCellSizeAlias(doc.meta);
            } else {
              diagnostics.push({
                code: 'PIX2_ERR_INVALID_DIMENSION',
                line: i + 1,
                message: `Invalid cell_size dimension format: "${val}" (expected <w>x<h>)`
              });
            }
          } else if (key === 'gap') {
            const num = parseStrictInt(val);
            if (!isNaN(num)) {
              doc.meta.gap = Math.min(Math.max(0, num), 128);
            } else {
              diagnostics.push({
                code: 'PIX2_ERR_INVALID_INTEGER',
                line: i + 1,
                message: `Invalid integer for gap: "${val}"`
              });
            }
          } else if (key === 'margin') {
            const num = parseStrictInt(val);
            if (!isNaN(num)) {
              doc.meta.margin = Math.min(Math.max(0, num), 128);
            } else {
              diagnostics.push({
                code: 'PIX2_ERR_INVALID_INTEGER',
                line: i + 1,
                message: `Invalid integer for margin: "${val}"`
              });
            }
          }
        }
      }

      // Inside @palette
      else if (currentSection === 'palette') {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const rawId = line.slice(0, colonIdx).trim();
          if (isSafeIdentifier(rawId)) {
            const colorToken = line.slice(colonIdx + 1).trim().split(/\s+/)[0];
            const normalized = normalizeHex(colorToken);
            if (normalized) {
              doc.palette[rawId] = normalized;
            } else {
              diagnostics.push({
                code: 'PIX2_ERR_INVALID_HEX',
                line: i + 1,
                message: `Invalid hex color code in palette: "${colorToken}"`
              });
            }
          }
        }
      }

      // Inside @animations (legacy block syntax: `walk_down: [c0, c1] @ 6fps loop`)
      else if (currentSection === 'animations_block') {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const rawAnimName = line.slice(0, colonIdx).trim();
          const animName = sanitizeKey(rawAnimName, 'anim');
          const rest = line.slice(colonIdx + 1).trim();
          const framesMatch = rest.match(/\[(.*?)\]/);
          let frames = [];
          if (framesMatch) {
            frames = framesMatch[1]
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
              .filter(isSafeIdentifier)
              .slice(0, MAX_FRAMES_PER_ANIM);
          }
          let fps = 6;
          const fpsMatch = rest.match(/@\s*(\d+)\s*fps/i);
          if (fpsMatch) {
            const parsedFps = parseStrictInt(fpsMatch[1]);
            if (!isNaN(parsedFps)) fps = Math.min(Math.max(1, parsedFps), MAX_ANIM_FPS);
          }
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
          const val = unescapePix2String(line.slice(colonIdx + 1).trim());

          if (key === 'name') currentAnim.name = val.slice(0, 256);
          else if (key === 'direction') currentAnim.direction = val.toLowerCase().slice(0, 32);
          else if (key === 'fps') {
            const num = parseStrictInt(val);
            if (!isNaN(num)) {
              currentAnim.fps = Math.min(Math.max(1, num), MAX_ANIM_FPS);
            } else {
              diagnostics.push({
                code: 'PIX2_ERR_INVALID_INTEGER',
                line: i + 1,
                message: `Invalid integer for fps: "${val}"`
              });
            }
          }
          else if (key === 'loop') currentAnim.loop = (val.toLowerCase() === 'true');
          else if (key === 'mode') currentAnim.mode = val.toLowerCase().slice(0, 32);
          else if (key === 'frames') {
            const framesMatch = val.match(/\[(.*?)\]/);
            if (framesMatch) {
              currentAnim.frames = framesMatch[1]
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .filter(isSafeIdentifier)
                .slice(0, MAX_FRAMES_PER_ANIM);
            }
          }
        }
      }

      // Inside @cell
      else if (currentSection === 'cell' && currentCell) {
        // Properties
        if (line.startsWith('name:')) {
          currentCell.name = unescapePix2String(line.slice(5).trim()).slice(0, 256);
          continue;
        } else if (line.startsWith('direction:') || line.startsWith('dir:')) {
          currentCell.direction = line.split(':')[1].trim().toLowerCase().slice(0, 32);
          continue;
        } else if (line.startsWith('frame:')) {
          const num = parseStrictInt(line.split(':')[1].trim());
          if (!isNaN(num)) {
            currentCell.frame = Math.min(Math.max(0, num), 2048);
          } else {
            diagnostics.push({
              code: 'PIX2_ERR_INVALID_INTEGER',
              line: i + 1,
              message: `Invalid integer for frame: "${line.split(':')[1].trim()}"`
            });
          }
          continue;
        } else if (line.startsWith('grid_pos:') || line.startsWith('pos:')) {
          const coord = parseCoordinate(line.split(':')[1].trim());
          if (coord) {
            currentCell.row = Math.min(Math.max(0, coord[0]), MAX_GRID_ROWS);
            currentCell.col = Math.min(Math.max(0, coord[1]), MAX_GRID_COLS);
          } else {
            diagnostics.push({
              code: 'PIX2_ERR_INVALID_COORDINATE',
              line: i + 1,
              message: `Invalid grid_pos coordinate format: "${line.split(':')[1].trim()}"`
            });
          }
          continue;
        } else if (line.startsWith('size:')) {
          const dims = parseDimension(line.split(':')[1].trim());
          if (dims) {
            currentCell.size = {
              w: Math.min(Math.max(MIN_CELL_DIM, dims[0]), MAX_CELL_DIM),
              h: Math.min(Math.max(MIN_CELL_DIM, dims[1]), MAX_CELL_DIM)
            };
          } else {
            diagnostics.push({
              code: 'PIX2_ERR_INVALID_DIMENSION',
              line: i + 1,
              message: `Invalid cell size format: "${line.split(':')[1].trim()}"`
            });
          }
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
              const parsed = parseCoordinate(coord);
              if (!parsed) {
                diagnostics.push({
                  code: 'PIX2_ERR_INVALID_COORDINATE',
                  line: i + 1,
                  message: `Invalid coordinate syntax "${coord}" in cell "${currentCell.id}"`
                });
              } else {
                const [x, y] = parsed;
                const color = resolveColor(colRef, doc.palette);
                if (!color) {
                  diagnostics.push({
                    code: 'PIX2_ERR_UNRESOLVED_COLOR',
                    line: i + 1,
                    message: `Unresolved or invalid color reference "${colRef}" in cell "${currentCell.id}"`
                  });
                } else if (Math.abs(x) <= MAX_COORD_ABS && Math.abs(y) <= MAX_COORD_ABS) {
                  currentCell.pixels[`${x},${y}`] = color;
                }
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
          const parsed = parseCoordinate(parts[1] || '');
          if (!parsed) {
            diagnostics.push({
              code: 'PIX2_ERR_INVALID_COORDINATE',
              line: i + 1,
              message: `Invalid coordinate syntax "${parts[1]}" in dot command`
            });
          } else {
            const [x, y] = parsed;
            const color = resolveColor(parts[2], doc.palette);
            if (!color) {
              diagnostics.push({
                code: 'PIX2_ERR_UNRESOLVED_COLOR',
                line: i + 1,
                message: `Unresolved color "${parts[2]}" in dot command`
              });
            } else if (Math.abs(x) <= MAX_COORD_ABS && Math.abs(y) <= MAX_COORD_ABS) {
              currentCell.pixels[`${x},${y}`] = color;
            }
          }
        } else if (cmd === 'line') {
          const p1 = parseCoordinate(parts[1] || '');
          const p2 = parseCoordinate(parts[2] || '');
          const color = resolveColor(parts[3], doc.palette);
          if (!p1 || !p2) {
            diagnostics.push({
              code: 'PIX2_ERR_INVALID_COORDINATE',
              line: i + 1,
              message: `Invalid coordinates in line command`
            });
          } else if (!color) {
            diagnostics.push({
              code: 'PIX2_ERR_UNRESOLVED_COLOR',
              line: i + 1,
              message: `Unresolved color "${parts[3]}" in line command`
            });
          } else {
            const [x1, y1] = p1;
            const [x2, y2] = p2;
            const cellW = (currentCell.size && currentCell.size.w) || (doc.meta.cell_size && doc.meta.cell_size.w) || 16;
            const cellH = (currentCell.size && currentCell.size.h) || (doc.meta.cell_size && doc.meta.cell_size.h) || 16;
            if (Math.abs(x1) <= MAX_COORD_ABS && Math.abs(y1) <= MAX_COORD_ABS &&
                Math.abs(x2) <= MAX_COORD_ABS && Math.abs(y2) <= MAX_COORD_ABS) {
              drawLineBresenham(x1, y1, x2, y2, (x, y) => {
                if (x >= 0 && x < cellW && y >= 0 && y < cellH) {
                  currentCell.pixels[`${x},${y}`] = color;
                }
              });
            }
          }
        } else if (cmd === 'rect') {
          const origin = parseCoordinate(parts[1] || '');
          const dims = parseDimension(parts[2] || '');
          const color = resolveColor(parts[3], doc.palette);
          const mode = (parts[4] || 'outline').toLowerCase();
          if (!origin || !dims) {
            diagnostics.push({
              code: 'PIX2_ERR_INVALID_COORDINATE',
              line: i + 1,
              message: `Invalid origin or dimension in rect command`
            });
          } else if (!color) {
            diagnostics.push({
              code: 'PIX2_ERR_UNRESOLVED_COLOR',
              line: i + 1,
              message: `Unresolved color "${parts[3]}" in rect command`
            });
          } else {
            const [x, y] = origin;
            const [w, h] = dims;
            const cellW = (currentCell.size && currentCell.size.w) || (doc.meta.cell_size && doc.meta.cell_size.w) || 16;
            const cellH = (currentCell.size && currentCell.size.h) || (doc.meta.cell_size && doc.meta.cell_size.h) || 16;
            const maxBoundW = cellW * 2;
            const maxBoundH = cellH * 2;
            const clampedW = Math.min(Math.max(0, w), maxBoundW);
            const clampedH = Math.min(Math.max(0, h), maxBoundH);
            if (clampedW * clampedH <= 262144) {
              for (let dy = 0; dy < clampedH; dy++) {
                for (let dx = 0; dx < clampedW; dx++) {
                  if (mode === 'fill' || dx === 0 || dy === 0 || dx === clampedW - 1 || dy === clampedH - 1) {
                    const px = x + dx, py = y + dy;
                    if (px >= 0 && px < cellW && py >= 0 && py < cellH) {
                      currentCell.pixels[`${px},${py}`] = color;
                    }
                  }
                }
              }
            }
          }
        } else if (cmd === 'fill') {
          const startPt = parseCoordinate(parts[1] || '');
          const color = resolveColor(parts[2], doc.palette);
          if (!startPt) {
            diagnostics.push({
              code: 'PIX2_ERR_INVALID_COORDINATE',
              line: i + 1,
              message: `Invalid start point in fill command`
            });
          } else if (!color) {
            diagnostics.push({
              code: 'PIX2_ERR_UNRESOLVED_COLOR',
              line: i + 1,
              message: `Unresolved color "${parts[2]}" in fill command`
            });
          } else {
            const [startX, startY] = startPt;
            floodFillCell(currentCell, startX, startY, color, doc.meta.cell_size);
          }
        } else if (cmd === 'sym_dot') {
          const pt = parseCoordinate(parts[1] || '');
          if (!pt) {
            diagnostics.push({
              code: 'PIX2_ERR_INVALID_COORDINATE',
              line: i + 1,
              message: `Invalid coordinate in sym_dot command`
            });
          } else {
            const [x, y] = pt;
            const cellW = (currentCell.size && currentCell.size.w) || (doc.meta.cell_size && doc.meta.cell_size.w) || 16;
            const cellH = (currentCell.size && currentCell.size.h) || (doc.meta.cell_size && doc.meta.cell_size.h) || 16;
            let axisX, colToken;
            if (parts.length >= 4) {
              axisX = parseFloat(parts[2]);
              if (isNaN(axisX)) axisX = ((cellW - 1) / 2);
              colToken = parts[3];
            } else {
              axisX = ((cellW - 1) / 2);
              colToken = parts[2];
            }
            const color = resolveColor(colToken, doc.palette);
            if (!color) {
              diagnostics.push({
                code: 'PIX2_ERR_UNRESOLVED_COLOR',
                line: i + 1,
                message: `Unresolved color "${colToken}" in sym_dot command`
              });
            } else {
              if (x >= 0 && x < cellW && y >= 0 && y < cellH) {
                currentCell.pixels[`${x},${y}`] = color;
              }
              const mx = Math.round(2 * axisX - x);
              if (mx >= 0 && mx < cellW && y >= 0 && y < cellH) {
                currentCell.pixels[`${mx},${y}`] = color;
              }
            }
          }
        }
      }
    }

    if (!hasPix2Header) {
      diagnostics.push({
        code: 'PIX2_WARN_MISSING_HEADER',
        line: 1,
        message: 'Missing standard @pix2 header directive (expected "@pix2 1.0")'
      });
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

  function resolveColor(token, palette) {
    if (!token || typeof token !== 'string') return null;
    token = token.trim();
    if (palette && Object.prototype.hasOwnProperty.call(palette, token) && typeof palette[token] === 'string') {
      const palVal = palette[token];
      return isValidHex(palVal) ? normalizeHex(palVal) : null;
    }
    return normalizeHex(token);
  }

  // ===========================================================================
  // BRESENHAM & FLOOD FILL ALGORITHMS
  // ===========================================================================

  function drawLineBresenham(x0, y0, x1, y1, plot) {
    if (isNaN(x0) || isNaN(y0) || isNaN(x1) || isNaN(y1)) return;
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = (x0 < x1) ? 1 : -1;
    let sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;
    let maxSteps = 4096;

    while (maxSteps-- > 0) {
      plot(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      let e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  function floodFillCell(cell, startX, startY, fillColor, defaultCellSize) {
    if (!cell || isNaN(startX) || isNaN(startY) || !fillColor) return;
    const rawW = (cell.size && cell.size.w) || (defaultCellSize && defaultCellSize.w) || 16;
    const rawH = (cell.size && cell.size.h) || (defaultCellSize && defaultCellSize.h) || 16;
    const cellW = Math.min(Math.max(1, rawW), MAX_CELL_DIM);
    const cellH = Math.min(Math.max(1, rawH), MAX_CELL_DIM);

    if (startX < 0 || startX >= cellW || startY < 0 || startY >= cellH) return;

    const targetColor = cell.pixels[`${startX},${startY}`] || null;
    if (targetColor === fillColor) return;

    const queue = [[startX, startY]];
    const visited = new Set();
    const maxSteps = Math.min(65536, cellW * cellH * 4);
    let steps = 0;

    while (queue.length > 0 && steps++ < maxSteps) {
      const [x, y] = queue.pop();
      if (x < 0 || x >= cellW || y < 0 || y >= cellH) continue;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const currentColor = cell.pixels[key] || null;
      if (currentColor === targetColor) {
        cell.pixels[key] = fillColor;

        if (x > 0) queue.push([x - 1, y]);
        if (x < cellW - 1) queue.push([x + 1, y]);
        if (y > 0) queue.push([x, y - 1]);
        if (y < cellH - 1) queue.push([x, y + 1]);
      }
    }
  }

  // ===========================================================================
  // SERIALIZER (AST -> Text)
  // ===========================================================================

  function serialize(doc) {
    // 1. Gather all unique colors used across cells
    const colorUsage = Object.create(null);
    for (const cellId in doc.cells) {
      const cell = doc.cells[cellId];
      for (const k in cell.pixels) {
        const c = normalizeHex(cell.pixels[k]);
        if (c) colorUsage[c] = (colorUsage[c] || 0) + 1;
      }
    }

    // Build palette map (color -> ID)
    const sortedColors = Object.entries(colorUsage).sort((a, b) => b[1] - a[1]);
    const paletteMap = Object.create(null);
    const paletteOut = Object.create(null);
    let palId = 1;

    // Preserve ALL existing palette entries safely (even unused ones to maintain roundtrip)
    for (const id in doc.palette) {
      if (Object.prototype.hasOwnProperty.call(doc.palette, id) && isSafeIdentifier(id)) {
        const c = normalizeHex(doc.palette[id]);
        if (c) {
          paletteOut[id] = c;
          if (!paletteMap[c]) {
            paletteMap[c] = id;
          }
        }
      }
    }

    // Assign indexed IDs for any new colors in cells that aren't yet in palette
    for (const [c] of sortedColors) {
      if (!paletteMap[c]) {
        while (paletteOut[String(palId)]) palId++;
        paletteMap[c] = String(palId);
        paletteOut[String(palId)] = c;
        palId++;
      }
    }

    const lines = [];
    lines.push('@pix2 1.0');
    lines.push('');
    lines.push('@meta');
    lines.push(`  title: "${escapePix2String(doc.meta.title || 'Untitled')}"`);
    lines.push(`  author: "${escapePix2String(doc.meta.author || 'User')}"`);
    lines.push(`  version: "${escapePix2String(doc.meta.version || '1.0')}"`);
    lines.push(`  color_mode: "${escapePix2String(doc.meta.color_mode || 'RGBA')}"`);
    lines.push(`  coordinate_origin: "${escapePix2String(doc.meta.coordinate_origin || 'top-left')}"`);
    lines.push('');

    const gridCols = (doc.meta.grid && doc.meta.grid.cols) || 4;
    const gridRows = (doc.meta.grid && doc.meta.grid.rows) || 4;
    const cellW = (doc.meta.cell_size || doc.meta.cellSize || { w: 16 }).w;
    const cellH = (doc.meta.cell_size || doc.meta.cellSize || { h: 16 }).h;

    lines.push('@grid');
    lines.push(`  columns: ${gridCols}`);
    lines.push(`  rows: ${gridRows}`);
    lines.push(`  default_cell: ${cellW}x${cellH}`);
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
      if (cell.name) lines.push(`  name: "${escapePix2String(cell.name)}"`);
      if (cell.direction && cell.direction !== 'none') lines.push(`  direction: ${cell.direction}`);
      if (cell.frame !== undefined) lines.push(`  frame: ${cell.frame}`);
      if (cell.row !== null && cell.col !== null && !isNaN(cell.row) && !isNaN(cell.col)) {
        lines.push(`  grid_pos: ${cell.row},${cell.col}`);
      }
      if (cell.size) lines.push(`  size: ${cell.size.w}x${cell.size.h}`);

      // Group pixels by Y coordinate for clean human/AI reading
      const pixelsByY = {};
      for (const coord in cell.pixels) {
        const parsed = parseCoordinate(coord);
        if (!parsed) continue;
        const [x, y] = parsed;
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
      if (anim.name) lines.push(`  name: "${escapePix2String(anim.name)}"`);
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
    const curDims = doc.meta.cell_size || doc.meta.cellSize || { w: 16, h: 16 };
    const oldW = curDims.w;
    const oldH = curDims.h;
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
        // Crop / Canvas Expand Anchor Top-Left
        for (const coord in cell.pixels) {
          const parsed = parseCoordinate(coord);
          if (!parsed) continue;
          const [x, y] = parsed;
          if (x < newW && y < newH) {
            newPixels[coord] = cell.pixels[coord];
          }
        }
      }

      cell.pixels = newPixels;
      if (cell.size) {
        cell.size = { w: newW, h: newH };
      }
    }

    doc.meta.cell_size = { w: newW, h: newH };
    attachCellSizeAlias(doc.meta);
    return doc;
  }

  // ===========================================================================
  // RASTERIZATION (Cell -> HTML5 Canvas)
  // ===========================================================================

  function renderCellToCanvas(cell, defaultCellSize, targetCanvas = null) {
    const w = (cell.size && cell.size.w) || defaultCellSize.w;
    const h = (cell.size && cell.size.h) || defaultCellSize.h;

    const canvas = targetCanvas || document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);

    const imgData = ctx.createImageData(w, h);
    const d = imgData.data;

    for (const coord in cell.pixels) {
      const parsed = parseCoordinate(coord);
      if (!parsed) continue;
      const [x, y] = parsed;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;

      const rgba = hexToRgba(cell.pixels[coord]);
      const idx = (y * w + x) * 4;
      d[idx] = rgba.r;
      d[idx + 1] = rgba.g;
      d[idx + 2] = rgba.b;
      d[idx + 3] = rgba.a;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  function renderAtlasToCanvas(doc, targetCanvas = null) {
    const cols = doc.meta.grid.cols;
    const rows = doc.meta.grid.rows;
    const cellDim = doc.meta.cell_size || doc.meta.cellSize;
    const cw = cellDim.w;
    const ch = cellDim.h;
    const gap = doc.meta.gap || 0;
    const margin = doc.meta.margin || 0;

    const totalW = margin * 2 + cols * cw + (cols - 1) * gap;
    const totalH = margin * 2 + rows * ch + (rows - 1) * gap;

    const canvas = targetCanvas || document.createElement('canvas');
    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, totalW, totalH);

    for (const cid in doc.cells) {
      const cell = doc.cells[cid];
      if (cell.row === null || cell.col === null) continue;
      if (cell.row >= rows || cell.col >= cols) continue;

      const destX = margin + cell.col * (cw + gap);
      const destY = margin + cell.row * (ch + gap);
      const cellCanvas = renderCellToCanvas(cell, cellDim);
      ctx.drawImage(cellCanvas, destX, destY);
    }

    return canvas;
  }

  // ===========================================================================
  // DOCUMENT VALIDATION & DIAGNOSTICS API
  // ===========================================================================

  /**
   * Validate a PIX2 document structure, coordinates, palette, and frame integrity.
   * @param {Object} doc - Parsed PIX2 document object.
   * @param {Object} [options] - Optional settings ({ strict: boolean }).
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  function validate(doc, options) {
    const opts = options || {};
    const strict = opts.strict === true;
    const errors = [];
    const warnings = [];
    const structuredDiagnostics = [];

    function recordDiagnostic(code, severity, message, details) {
      const fullMsg = `[${code}] ${message}`;
      const isError = severity === 'error' || (strict && severity === 'warning');
      if (isError) {
        errors.push(fullMsg);
      } else {
        warnings.push(fullMsg);
      }
      const entry = Object.assign({
        code,
        severity: isError ? 'error' : 'warning',
        message
      }, details || {});
      structuredDiagnostics.push(entry);
    }

    if (!doc || typeof doc !== 'object') {
      const msg = 'Document is not an object';
      errors.push(msg);
      structuredDiagnostics.push({ code: 'PIX2_ERR_INVALID_DOCUMENT', severity: 'error', message: msg });
      return { valid: false, errors, warnings, diagnostics: structuredDiagnostics };
    }

    if (!doc.meta || typeof doc.meta !== 'object') {
      recordDiagnostic('PIX2_ERR_MISSING_META', 'error', 'Missing or invalid @meta object');
    } else {
      if (strict && (!doc.meta.version || doc.meta.version !== '1.0')) {
        recordDiagnostic('PIX2_ERR_UNSUPPORTED_VERSION', 'error', `Unsupported or missing @pix2 version header: "${doc.meta.version || 'none'}" (expected "1.0")`);
      }
      if (!doc.meta.grid || typeof doc.meta.grid.cols !== 'number' || typeof doc.meta.grid.rows !== 'number') {
        recordDiagnostic('PIX2_ERR_INVALID_GRID', 'error', 'Invalid grid definition');
      } else {
        if (doc.meta.grid.cols < 1 || doc.meta.grid.cols > MAX_GRID_COLS) {
          recordDiagnostic('PIX2_WARN_CLAMPED_COLS', 'warning', `Grid columns clamped to max ${MAX_GRID_COLS}`);
        }
        if (doc.meta.grid.rows < 1 || doc.meta.grid.rows > MAX_GRID_ROWS) {
          recordDiagnostic('PIX2_WARN_CLAMPED_ROWS', 'warning', `Grid rows clamped to max ${MAX_GRID_ROWS}`);
        }
      }
      const cellDim = doc.meta.cell_size || doc.meta.cellSize;
      if (!cellDim || typeof cellDim.w !== 'number' || typeof cellDim.h !== 'number') {
        recordDiagnostic('PIX2_ERR_INVALID_CELL_SIZE', 'error', 'Invalid cell_size definition');
      }
    }

    // Include parser diagnostics if attached
    if (doc._diagnostics && Array.isArray(doc._diagnostics)) {
      for (const diag of doc._diagnostics) {
        const isErr = diag.code.startsWith('PIX2_ERR_');
        const sev = isErr ? 'error' : 'warning';
        recordDiagnostic(diag.code, sev, `Line ${diag.line}: ${diag.message}`, { line: diag.line });
      }
    }

    // Palette validation
    if (doc.palette && typeof doc.palette === 'object') {
      for (const palId in doc.palette) {
        if (!isSafeIdentifier(palId)) continue;
        const hex = doc.palette[palId];
        if (!isValidHex(hex)) {
          recordDiagnostic('PIX2_ERR_INVALID_HEX', 'error', `Palette entry "${palId}" has invalid hex color "${hex}"`);
        }
      }
    }

    for (const key of ['cells', 'palette', 'animations']) {
      if (doc[key] && typeof doc[key] === 'object') {
        const propNames = Object.getOwnPropertyNames(doc[key]);
        for (const id of propNames) {
          if (FORBIDDEN_KEYS.has(id.toLowerCase())) {
            recordDiagnostic('PIX2_ERR_PROTOTYPE_POLLUTION', 'error', `Illegal prototype pollution identifier in ${key}: "${id}"`);
          }
        }
      }
    }

    // Semantic checks: Cell coordinate bounds & pixel integrity
    const cellDim = doc.meta && (doc.meta.cell_size || doc.meta.cellSize);
    const defaultW = (cellDim && cellDim.w) || 16;
    const defaultH = (cellDim && cellDim.h) || 16;

    if (doc.cells && typeof doc.cells === 'object') {
      for (const cellId in doc.cells) {
        const cell = doc.cells[cellId];
        if (!cell || typeof cell !== 'object') continue;
        const cellW = (cell.size && cell.size.w) || defaultW;
        const cellH = (cell.size && cell.size.h) || defaultH;

        if (cell.pixels && typeof cell.pixels === 'object') {
          for (const coord in cell.pixels) {
            const parsed = parseCoordinate(coord);
            if (!parsed) {
              recordDiagnostic('PIX2_ERR_INVALID_COORDINATE', 'warning', `Cell "${cellId}": malformed pixel coordinate format "${coord}"`, { cell_id: cellId, raw_coordinate: coord });
              continue;
            }
            const [x, y] = parsed;
            if (x < 0 || x >= cellW || y < 0 || y >= cellH) {
              recordDiagnostic('PIX2_WARN_OUT_OF_BOUNDS', 'warning', `Cell "${cellId}": pixel at (${x}, ${y}) is outside bounds [0..${cellW - 1}, 0..${cellH - 1}]`, { cell_id: cellId, coordinate: [x, y], bounds: { w: cellW, h: cellH } });
            }
            const col = cell.pixels[coord];
            if (!isValidHex(col)) {
              recordDiagnostic('PIX2_ERR_INVALID_COLOR', 'error', `Cell "${cellId}": pixel at (${x}, ${y}) has invalid color value "${col}"`, { cell_id: cellId, coordinate: [x, y], color: col });
            }
          }
        }
      }
    }

    // Semantic checks: Animation frame reference integrity
    if (doc.animations && typeof doc.animations === 'object') {
      for (const animId in doc.animations) {
        const anim = doc.animations[animId];
        if (!anim || typeof anim !== 'object') continue;
        if (anim.frames && Array.isArray(anim.frames)) {
          for (const frameId of anim.frames) {
            if (!doc.cells || !doc.cells[frameId]) {
              recordDiagnostic('PIX2_ERR_MISSING_FRAME', 'warning', `Animation "${animId}": references non-existent cell "${frameId}"`, { anim_id: animId, frame_id: frameId });
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      diagnostics: structuredDiagnostics
    };
  }

  // ===========================================================================
  // PUBLIC EXPORTS
  // ===========================================================================

  return {
    parse,
    serialize,
    createDocument,
    validate,
    normalizeHex,
    isValidHex,
    hexToRgba,
    rgbaToHex,
    stripComment,
    drawLineBresenham,
    floodFillCell,
    isSafeIdentifier,
    sanitizeKey,
    parseStrictInt,
    parseCoordinate,
    parseDimension,
    escapePix2String,
    unescapePix2String,
    attachCellSizeAlias,
    renderCellToCanvas,
    renderAtlasToCanvas,
    resizeCells
  };
})();

// Export for Node.js test environment or ES module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PIX2;
}
