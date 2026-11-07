/**
 * NOIRADIX PixelArt - Application Controller
 * Standalone 2D Pixel Art Painting Studio & Live PIX2 Code Editor
 * 
 * Reuses: PIX2 Engine (js/pix2-format.js) & Tools (js/tools.js)
 * Author: Nguyen Duc Canh (@dotlinux26)
 * License: Apache-2.0
 */

(function () {
  'use strict';

  // Ensure PIX2 engine is loaded
  const _PIX2 = typeof PIX2 !== 'undefined' ? PIX2 : (typeof window !== 'undefined' ? window.PIX2 : null);
  const _Tools = typeof Tools !== 'undefined' ? Tools : (typeof window !== 'undefined' ? window.Tools : null);

  if (!_PIX2) {
    console.error('CRITICAL: PIX2 Reference Engine not found. Please verify js/pix2-format.js is loaded.');
    return;
  }

  // ===========================================================================
  // PALETTE PRESETS
  // ===========================================================================
  const PRESET_PALETTES = {
    noiradix: [
      '#1a1a24', '#ffffff', '#4f46e5', '#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'
    ],
    pico8: [
      '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
      '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'
    ],
    gameboy: [
      '#0f380f', '#306230', '#8bac0f', '#9bbc0f'
    ],
    sweetie16: [
      '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
      '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57'
    ],
    endesga32: [
      '#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633',
      '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e',
      '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
      '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'
    ]
  };

  // ===========================================================================
  // APPLICATION STATE
  // ===========================================================================
  const state = {
    doc: null,
    w: 64,
    h: 64,
    title: 'Pixel Artwork',

    // Tools
    currentTool: 'pen', // 'pen' | 'eraser' | 'bucket' | 'line' | 'rect' | 'picker'
    rectFill: false,
    symH: false,
    symV: false,

    // Colors
    primaryColor: '#4f46e5',
    secondaryColor: '#ffffff',
    alpha: 255,

    // Palette
    paletteKey: 'noiradix',
    activeSwatches: [...PRESET_PALETTES.noiradix],

    // Viewport
    zoom: 12,
    panX: 0,
    panY: 0,
    showGrid: true,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,

    // Drawing drag
    isDrawing: false,
    lastX: null,
    lastY: null,
    dragStartX: null,
    dragStartY: null,

    // History (Undo / Redo)
    history: [],
    historyIndex: -1,
    maxHistory: 50,

    // Synchronization Locks
    isSyncingFromCanvas: false,
    isSyncingFromSource: false,
    sourceDebounceTimer: null,

    // PNG Export
    exportScale: 8
  };

  // DOM Elements Cache
  const dom = {};

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================
  function init() {
    cacheDom();
    initTheme();
    bindEvents();

    // Create Initial Document
    createNewDocument(64, 64, 'Pixel Artwork');
    renderPaletteSwatches();
    updateUi();
    updateAiPromptView();

    // Fit canvas to viewport
    setTimeout(fitCanvasToViewport, 50);
  }

  function cacheDom() {
    dom.workspace = document.getElementById('pa-workspace');
    dom.docTitle = document.getElementById('pa-doc-title');
    dom.dimBadge = document.getElementById('pa-dim-badge');

    // Canvas
    dom.viewport = document.getElementById('pa-canvas-viewport');
    dom.container = document.getElementById('pa-canvas-container');
    dom.canvasMain = document.getElementById('pa-canvas-main');
    dom.canvasPreview = document.getElementById('pa-canvas-preview');
    dom.ctxMain = dom.canvasMain.getContext('2d');
    dom.ctxPreview = dom.canvasPreview.getContext('2d');

    // Statusbar
    dom.coordLabel = document.getElementById('pa-coord-label');
    dom.hoverColorDot = document.getElementById('pa-hover-color-dot');
    dom.hoverColorLabel = document.getElementById('pa-hover-color-label');
    dom.zoomLabel = document.getElementById('pa-zoom-label');
    dom.btnToggleGrid = document.getElementById('btn-toggle-grid');

    // Source Code Pane
    dom.codeEditor = document.getElementById('pa-code-editor');
    dom.codeGutter = document.getElementById('pa-code-gutter');
    dom.syncBadge = document.getElementById('pa-sync-badge');
    dom.codeLinesCount = document.getElementById('pa-code-lines-count');
    dom.codePixelsCount = document.getElementById('pa-code-pixels-count');
    dom.diagnosticPill = document.getElementById('pa-diagnostic-pill');

    // Color Deck
    dom.colorPrimaryPreview = document.getElementById('pa-color-primary-preview');
    dom.colorSecondaryPreview = document.getElementById('pa-color-secondary-preview');
    dom.colorPrimarySlot = document.getElementById('pa-color-primary-slot');
    dom.colorSecondarySlot = document.getElementById('pa-color-secondary-slot');
    dom.colorHex = document.getElementById('pa-color-hex');
    dom.colorPickerNative = document.getElementById('pa-color-picker-native');
    dom.alphaSlider = document.getElementById('pa-alpha-slider');
    dom.alphaVal = document.getElementById('pa-alpha-val');
    dom.paletteSelect = document.getElementById('pa-palette-select');
    dom.swatchesContainer = document.getElementById('pa-swatches-container');

    // Modals
    dom.modalNew = document.getElementById('modal-new-canvas');
    dom.modalExport = document.getElementById('modal-export-png');
    dom.modalAi = document.getElementById('modal-ai-assistant');
    dom.modalHelp = document.getElementById('modal-help');
    dom.exportPreviewCanvas = document.getElementById('pa-export-preview-canvas');
    dom.exportDimLabel = document.getElementById('pa-export-dim-label');

    // Hidden file input
    dom.fileInput = document.getElementById('pa-hidden-file-input');
  }

  // ===========================================================================
  // DOCUMENT MODEL MANAGEMENT
  // ===========================================================================
  function createNewDocument(w = 64, h = 64, title = 'Pixel Artwork') {
    state.w = Math.max(1, Math.min(512, w));
    state.h = Math.max(1, Math.min(512, h));
    state.title = title || 'Pixel Artwork';

    // Construct canonical PIX2 document
    const doc = _PIX2.createDocument(state.title, 1, 1, state.w, state.h);
    doc.meta.title = state.title;
    doc.meta.author = 'PixelArt User';
    doc.meta.color_mode = 'RGBA';
    doc.meta.coordinate_origin = 'top-left';

    // Custom cell artwork
    doc.cells = {
      artwork: {
        id: 'artwork',
        name: state.title,
        size: { w: state.w, h: state.h },
        pixels: {}
      }
    };

    // Populate palette
    doc.palette = {};
    state.activeSwatches.forEach((hex, idx) => {
      doc.palette[String(idx + 1)] = hex;
    });

    state.doc = doc;
    state.history = [];
    state.historyIndex = -1;
    pushHistory();

    // Resize Canvases
    dom.canvasMain.width = state.w;
    dom.canvasMain.height = state.h;
    dom.canvasPreview.width = state.w;
    dom.canvasPreview.height = state.h;

    dom.dimBadge.textContent = `${state.w}×${state.h}`;
    dom.docTitle.value = state.title;

    repaintCanvas();
    syncCanvasToSource();
  }

  function getArtworkCell() {
    if (!state.doc || !state.doc.cells) return null;
    if (state.doc.cells.artwork) return state.doc.cells.artwork;
    const firstKey = Object.keys(state.doc.cells)[0];
    return firstKey ? state.doc.cells[firstKey] : null;
  }

  // ===========================================================================
  // CANVAS RENDERING
  // ===========================================================================
  function repaintCanvas() {
    const ctx = dom.ctxMain;
    const w = state.w;
    const h = state.h;

    ctx.clearRect(0, 0, w, h);

    const cell = getArtworkCell();
    if (!cell || !cell.pixels) return;

    // Render all pixels
    for (const key in cell.pixels) {
      const parts = key.split(',');
      const px = parseInt(parts[0], 10);
      const py = parseInt(parts[1], 10);
      const color = cell.pixels[key];

      if (px >= 0 && px < w && py >= 0 && py < h) {
        ctx.fillStyle = color;
        ctx.fillRect(px, py, 1, 1);
      }
    }

    updateContainerTransform();
  }

  function updateContainerTransform() {
    dom.container.style.width = `${state.w * state.zoom}px`;
    dom.container.style.height = `${state.h * state.zoom}px`;
    dom.container.style.transform = `translate(${state.panX}px, ${state.panY}px)`;

    // Main canvas stretched to container
    dom.canvasMain.style.width = '100%';
    dom.canvasMain.style.height = '100%';
    dom.canvasPreview.style.width = '100%';
    dom.canvasPreview.style.height = '100%';

    // Grid styling
    if (state.showGrid && state.zoom >= 4) {
      dom.container.style.backgroundImage = `
        linear-gradient(to right, rgba(128,128,128,0.2) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(128,128,128,0.2) 1px, transparent 1px)
      `;
      dom.container.style.backgroundSize = `${state.zoom}px ${state.zoom}px`;
    } else {
      dom.container.style.backgroundImage = 'none';
    }

    dom.zoomLabel.textContent = `${state.zoom}×`;
  }

  function fitCanvasToViewport() {
    const vpW = dom.viewport.clientWidth - 40;
    const vpH = dom.viewport.clientHeight - 40;
    if (vpW <= 0 || vpH <= 0) return;

    const scaleX = vpW / state.w;
    const scaleY = vpH / state.h;
    const bestScale = Math.floor(Math.min(scaleX, scaleY));
    state.zoom = Math.max(1, Math.min(64, bestScale || 1));
    state.panX = 0;
    state.panY = 0;
    updateContainerTransform();
  }

  // ===========================================================================
  // BI-DIRECTIONAL SYNCHRONIZATION ENGINE
  // ===========================================================================

  // 1. Canvas -> Source
  function syncCanvasToSource() {
    if (state.isSyncingFromSource) return;
    state.isSyncingFromCanvas = true;

    try {
      const cell = getArtworkCell();
      if (!cell) return;

      // Update document cell size
      cell.size = { w: state.w, h: state.h };
      state.doc.meta.cell_size = { w: state.w, h: state.h };
      state.doc.meta.grid = { columns: 1, rows: 1, default_cell: `${state.w}x${state.h}` };

      // Serialize canonical PIX2
      const serialized = _PIX2.serialize(state.doc);
      dom.codeEditor.value = serialized;

      updateCodeGutter();
      updatePixelCount();

      dom.syncBadge.className = 'pa-sync-badge synced';
      dom.syncBadge.innerHTML = '<i class="fa-solid fa-circle"></i> Synced';

      dom.diagnosticPill.className = 'pa-diagnostic-pill clean';
      dom.diagnosticPill.innerHTML = '<i class="fa-solid fa-check"></i> Standard v1.0';
    } finally {
      state.isSyncingFromCanvas = false;
    }
  }

  // 2. Source -> Canvas (Debounced 200ms)
  function handleSourceCodeInput() {
    if (state.isSyncingFromCanvas) return;

    dom.syncBadge.className = 'pa-sync-badge parsing';
    dom.syncBadge.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Parsing...';

    clearTimeout(state.sourceDebounceTimer);
    state.sourceDebounceTimer = setTimeout(() => {
      applySourceCodeToCanvas();
    }, 200);
  }

  function applySourceCodeToCanvas() {
    state.isSyncingFromSource = true;
    const source = dom.codeEditor.value;

    try {
      // Validate
      const validation = _PIX2.validate(source, false);
      if (!validation.valid && validation.errors.length > 0) {
        const firstErr = validation.errors[0];
        dom.syncBadge.className = 'pa-sync-badge error';
        dom.syncBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Syntax Error';

        dom.diagnosticPill.className = 'pa-diagnostic-pill error';
        dom.diagnosticPill.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(firstErr)}`;
        return; // Non-destructive: keep canvas intact!
      }

      // Parse
      const parsedDoc = _PIX2.parse(source);
      if (!parsedDoc || !parsedDoc.cells) return;

      state.doc = parsedDoc;

      // Extract artwork dimensions
      const cell = getArtworkCell();
      if (cell && cell.size) {
        if (cell.size.w !== state.w || cell.size.h !== state.h) {
          state.w = Math.max(1, Math.min(512, cell.size.w));
          state.h = Math.max(1, Math.min(512, cell.size.h));
          dom.canvasMain.width = state.w;
          dom.canvasMain.height = state.h;
          dom.canvasPreview.width = state.w;
          dom.canvasPreview.height = state.h;
          dom.dimBadge.textContent = `${state.w}×${state.h}`;
        }
      }

      // Update palette swatches if document palette has colors
      if (parsedDoc.palette && Object.keys(parsedDoc.palette).length > 0) {
        state.activeSwatches = Object.values(parsedDoc.palette);
        renderPaletteSwatches();
      }

      repaintCanvas();
      pushHistory();

      dom.syncBadge.className = 'pa-sync-badge synced';
      dom.syncBadge.innerHTML = '<i class="fa-solid fa-circle"></i> Synced';

      dom.diagnosticPill.className = 'pa-diagnostic-pill clean';
      dom.diagnosticPill.innerHTML = '<i class="fa-solid fa-check"></i> Standard v1.0';

      updateCodeGutter();
      updatePixelCount();
    } catch (err) {
      dom.syncBadge.className = 'pa-sync-badge error';
      dom.syncBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Parse Error';
      dom.diagnosticPill.className = 'pa-diagnostic-pill error';
      dom.diagnosticPill.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(err.message)}`;
    } finally {
      state.isSyncingFromSource = false;
    }
  }

  function updateCodeGutter() {
    const lines = dom.codeEditor.value.split('\n');
    let gutterHtml = '';
    for (let i = 1; i <= lines.length; i++) {
      gutterHtml += `${i}<br>`;
    }
    dom.codeGutter.innerHTML = gutterHtml;
    dom.codeLinesCount.textContent = `${lines.length} lines`;
  }

  function updatePixelCount() {
    const cell = getArtworkCell();
    const count = cell && cell.pixels ? Object.keys(cell.pixels).length : 0;
    dom.codePixelsCount.textContent = `${count} pixels`;
  }

  // ===========================================================================
  // DRAWING TOOLS & CANVAS INTERACTIONS
  // ===========================================================================
  function getPixelCoord(e) {
    const rect = dom.canvasMain.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / state.zoom);
    const y = Math.floor((e.clientY - rect.top) / state.zoom);
    return { x, y };
  }

  function plotPixelWithSymmetry(cell, x, y, color) {
    if (x < 0 || x >= state.w || y < 0 || y >= state.h) return;
    const w = state.w;
    const h = state.h;

    if (color === null) {
      delete cell.pixels[`${x},${y}`];
      if (state.symH) delete cell.pixels[`${w - 1 - x},${y}`];
      if (state.symV) delete cell.pixels[`${x},${h - 1 - y}`];
      if (state.symH && state.symV) delete cell.pixels[`${w - 1 - x},${h - 1 - y}`];
    } else {
      cell.pixels[`${x},${y}`] = color;
      if (state.symH) cell.pixels[`${w - 1 - x},${y}`] = color;
      if (state.symV) cell.pixels[`${x},${h - 1 - y}`] = color;
      if (state.symH && state.symV) cell.pixels[`${w - 1 - x},${h - 1 - y}`] = color;
    }
  }

  function onPointerDown(e) {
    // Pan via middle click or Space key
    if (e.button === 1 || e.spaceKey || state.isPanning) {
      state.isPanning = true;
      state.panStartX = e.clientX - state.panX;
      state.panStartY = e.clientY - state.panY;
      dom.viewport.style.cursor = 'grab';
      return;
    }

    const cell = getArtworkCell();
    if (!cell) return;

    const { x, y } = getPixelCoord(e);
    state.isDrawing = true;
    state.dragStartX = x;
    state.dragStartY = y;
    state.lastX = x;
    state.lastY = y;

    const isRightClick = e.button === 2;
    const activeColor = isRightClick ? state.secondaryColor : state.primaryColor;

    if (state.currentTool === 'picker') {
      pickColorAt(x, y);
      state.isDrawing = false;
      return;
    }

    if (state.currentTool === 'bucket') {
      const colorToFill = activeColor;
      _Tools.floodFill(cell, x, y, colorToFill, { w: state.w, h: state.h });
      repaintCanvas();
      pushHistory();
      syncCanvasToSource();
      state.isDrawing = false;
      return;
    }

    if (state.currentTool === 'pen') {
      plotPixelWithSymmetry(cell, x, y, activeColor);
      repaintCanvas();
    } else if (state.currentTool === 'eraser') {
      plotPixelWithSymmetry(cell, x, y, null);
      repaintCanvas();
    }
  }

  function onPointerMove(e) {
    const { x, y } = getPixelCoord(e);

    // Update coordinate labels
    dom.coordLabel.textContent = `${x}, ${y}`;
    updateHoverColor(x, y);

    // Pan movement
    if (state.isPanning) {
      state.panX = e.clientX - state.panStartX;
      state.panY = e.clientY - state.panStartY;
      updateContainerTransform();
      return;
    }

    if (!state.isDrawing) return;

    const cell = getArtworkCell();
    if (!cell) return;

    const isRightClick = e.buttons === 2;
    const activeColor = isRightClick ? state.secondaryColor : state.primaryColor;

    if (state.currentTool === 'pen' || state.currentTool === 'eraser') {
      const col = state.currentTool === 'pen' ? activeColor : null;
      // Continuous line drawing between last and current point
      _Tools.line(state.lastX, state.lastY, x, y, (px, py) => {
        plotPixelWithSymmetry(cell, px, py, col);
      });
      state.lastX = x;
      state.lastY = y;
      repaintCanvas();
    } else if (state.currentTool === 'line') {
      drawPreviewLine(state.dragStartX, state.dragStartY, x, y, activeColor);
    } else if (state.currentTool === 'rect') {
      drawPreviewRect(state.dragStartX, state.dragStartY, x, y, activeColor, state.rectFill);
    }
  }

  function onPointerUp(e) {
    if (state.isPanning) {
      state.isPanning = false;
      dom.viewport.style.cursor = 'crosshair';
      return;
    }

    if (!state.isDrawing) return;
    state.isDrawing = false;

    const cell = getArtworkCell();
    if (!cell) return;

    const { x, y } = getPixelCoord(e);
    const isRightClick = e.button === 2;
    const activeColor = isRightClick ? state.secondaryColor : state.primaryColor;

    dom.ctxPreview.clearRect(0, 0, state.w, state.h);

    if (state.currentTool === 'line') {
      _Tools.line(state.dragStartX, state.dragStartY, x, y, (px, py) => {
        plotPixelWithSymmetry(cell, px, py, activeColor);
      });
      repaintCanvas();
    } else if (state.currentTool === 'rect') {
      const minX = Math.min(state.dragStartX, x);
      const maxX = Math.max(state.dragStartX, x);
      const minY = Math.min(state.dragStartY, y);
      const maxY = Math.max(state.dragStartY, y);
      const rw = maxX - minX + 1;
      const rh = maxY - minY + 1;

      _Tools.rect(minX, minY, rw, rh, state.rectFill, (px, py) => {
        plotPixelWithSymmetry(cell, px, py, activeColor);
      });
      repaintCanvas();
    }

    pushHistory();
    syncCanvasToSource();
  }

  function drawPreviewLine(x0, y0, x1, y1, color) {
    dom.ctxPreview.clearRect(0, 0, state.w, state.h);
    dom.ctxPreview.fillStyle = color;
    _Tools.line(x0, y0, x1, y1, (px, py) => {
      dom.ctxPreview.fillRect(px, py, 1, 1);
      if (state.symH) dom.ctxPreview.fillRect(state.w - 1 - px, py, 1, 1);
      if (state.symV) dom.ctxPreview.fillRect(px, state.h - 1 - py, 1, 1);
    });
  }

  function drawPreviewRect(x0, y0, x1, y1, color, fill) {
    dom.ctxPreview.clearRect(0, 0, state.w, state.h);
    dom.ctxPreview.fillStyle = color;
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const rw = maxX - minX + 1;
    const rh = maxY - minY + 1;

    _Tools.rect(minX, minY, rw, rh, fill, (px, py) => {
      dom.ctxPreview.fillRect(px, py, 1, 1);
      if (state.symH) dom.ctxPreview.fillRect(state.w - 1 - px, py, 1, 1);
      if (state.symV) dom.ctxPreview.fillRect(px, state.h - 1 - py, 1, 1);
    });
  }

  function pickColorAt(x, y) {
    const cell = getArtworkCell();
    if (!cell || !cell.pixels) return;
    const col = cell.pixels[`${x},${y}`];
    if (col) {
      setPrimaryColor(col);
    }
  }

  function updateHoverColor(x, y) {
    const cell = getArtworkCell();
    const col = cell && cell.pixels ? cell.pixels[`${x},${y}`] : null;
    if (col) {
      dom.hoverColorDot.style.backgroundColor = col;
      dom.hoverColorLabel.textContent = col;
    } else {
      dom.hoverColorDot.style.backgroundColor = 'transparent';
      dom.hoverColorLabel.textContent = 'Transparent';
    }
  }

  // ===========================================================================
  // HISTORY (UNDO / REDO)
  // ===========================================================================
  function pushHistory() {
    const cell = getArtworkCell();
    if (!cell) return;

    // Snapshot of pixels
    const snapshot = {
      w: state.w,
      h: state.h,
      title: state.title,
      pixels: { ...cell.pixels }
    };

    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }

    state.history.push(snapshot);
    if (state.history.length > state.maxHistory) {
      state.history.shift();
    }
    state.historyIndex = state.history.length - 1;
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      restoreHistorySnapshot(state.history[state.historyIndex]);
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      restoreHistorySnapshot(state.history[state.historyIndex]);
    }
  }

  function restoreHistorySnapshot(snapshot) {
    if (!snapshot) return;
    state.w = snapshot.w;
    state.h = snapshot.h;
    state.title = snapshot.title;

    const cell = getArtworkCell();
    if (cell) {
      cell.size = { w: state.w, h: state.h };
      cell.pixels = { ...snapshot.pixels };
    }

    dom.canvasMain.width = state.w;
    dom.canvasMain.height = state.h;
    dom.canvasPreview.width = state.w;
    dom.canvasPreview.height = state.h;
    dom.dimBadge.textContent = `${state.w}×${state.h}`;

    repaintCanvas();
    syncCanvasToSource();
  }

  // ===========================================================================
  // COLOR & PALETTE MANAGEMENT
  // ===========================================================================
  function setPrimaryColor(color) {
    state.primaryColor = _PIX2.normalizeHex(color) || color;
    dom.colorPrimaryPreview.style.backgroundColor = state.primaryColor;
    dom.colorHex.value = state.primaryColor.replace('#', '');
    dom.colorPickerNative.value = state.primaryColor.slice(0, 7);
  }

  function setSecondaryColor(color) {
    state.secondaryColor = _PIX2.normalizeHex(color) || color;
    dom.colorSecondaryPreview.style.backgroundColor = state.secondaryColor;
  }

  function swapColors() {
    const temp = state.primaryColor;
    setPrimaryColor(state.secondaryColor);
    setSecondaryColor(temp);
  }

  function renderPaletteSwatches() {
    dom.swatchesContainer.innerHTML = '';
    state.activeSwatches.forEach((hex, idx) => {
      const chip = document.createElement('div');
      chip.className = 'pa-swatch';
      chip.style.backgroundColor = hex;
      chip.title = `${hex} (Click to select, Right-click to replace)`;

      chip.addEventListener('click', () => {
        setPrimaryColor(hex);
      });

      chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        state.activeSwatches[idx] = state.primaryColor;
        renderPaletteSwatches();
        syncPaletteToDoc();
      });

      dom.swatchesContainer.appendChild(chip);
    });
  }

  function syncPaletteToDoc() {
    if (!state.doc) return;
    state.doc.palette = {};
    state.activeSwatches.forEach((hex, idx) => {
      state.doc.palette[String(idx + 1)] = hex;
    });
    syncCanvasToSource();
  }

  function addActiveColorToPalette() {
    if (!state.activeSwatches.includes(state.primaryColor)) {
      state.activeSwatches.push(state.primaryColor);
      renderPaletteSwatches();
      syncPaletteToDoc();
    }
  }

  // ===========================================================================
  // PNG EXPORT ENGINE
  // ===========================================================================
  function openExportModal() {
    updateExportPreview();
    dom.modalExport.classList.remove('hidden');
  }

  function updateExportPreview() {
    const scale = state.exportScale;
    const outW = state.w * scale;
    const outH = state.h * scale;

    dom.exportDimLabel.textContent = `${outW} × ${outH} px`;

    // Render scaled preview
    const previewCanvas = dom.exportPreviewCanvas;
    previewCanvas.width = state.w;
    previewCanvas.height = state.h;
    const pctx = previewCanvas.getContext('2d');
    pctx.clearRect(0, 0, state.w, state.h);

    const cell = getArtworkCell();
    if (cell && cell.pixels) {
      for (const k in cell.pixels) {
        const [px, py] = k.split(',').map(Number);
        pctx.fillStyle = cell.pixels[k];
        pctx.fillRect(px, py, 1, 1);
      }
    }
  }

  function downloadExportedPng() {
    const scale = state.exportScale;
    const offscreen = document.createElement('canvas');
    offscreen.width = state.w * scale;
    offscreen.height = state.h * scale;
    const ctx = offscreen.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Draw scaled nearest-neighbor
    ctx.drawImage(dom.canvasMain, 0, 0, state.w * scale, state.h * scale);

    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilename(state.title)}_${state.w}x${state.h}_${scale}x.png`;
      a.click();
      URL.revokeObjectURL(url);
      dom.modalExport.classList.add('hidden');
    });
  }

  // ===========================================================================
  // AI ASSISTANT & PROMPT GENERATOR
  // ===========================================================================
  function updateAiPromptView(template = 'portrait') {
    const promptArea = document.getElementById('pa-ai-prompt-text');
    const palStr = state.activeSwatches.join(', ');

    let templateDesc = '';
    if (template === 'portrait') {
      templateDesc = `Draw a 2D pixel art character portrait (e.g. hero knight or mysterious wizard) on a ${state.w}x${state.h} canvas with symmetrical silhouette.`;
    } else if (template === 'item') {
      templateDesc = `Draw a 2D RPG game item (e.g. potion bottle, sword, treasure chest) on a ${state.w}x${state.h} canvas with clean outline and shading.`;
    } else if (template === 'landscape') {
      templateDesc = `Draw a 2D pixel art landscape (e.g. mountain sunset, forest glade) on a ${state.w}x${state.h} canvas with gradient sky and layered depth.`;
    }

    const prompt = `You are a pixel art assistant emitting code in the normative PIX2 v1.0 standard language.

TASK:
${templateDesc}

CANVAS SPECIFICATIONS:
- Canvas Dimension: ${state.w}x${state.h}
- Color Palette: ${palStr}
- Syntax format: PIX2 v1.0

STRICT PIX2 RULES:
1. Always start with "@pix2 1.0"
2. Define "@meta" with title and coordinate_origin: "top-left"
3. Define "@grid" with columns: 1, rows: 1, default_cell: ${state.w}x${state.h}
4. Define "@palette" mapping color indices to hex colors
5. Put pixels in "@cell artwork" using primitive drawing commands:
   - "p x,y #hex" or "p x,y palette_id"
   - "line x0,y0 x1,y1 #hex" (Normative Bresenham line)
   - "rect x,y wxh #hex [outline|fill]" (Rectangle)
   - "fill x,y #hex" (4-way flood fill)
6. Terminate file with "@end"

OUTPUT FORMAT:
Emit ONLY the raw .pix2 code block inside \`\`\`pix2 ... \`\`\` with no introductory chit-chat.`;

    promptArea.value = prompt;
  }

  function injectAiCodeToCanvas() {
    const raw = document.getElementById('pa-ai-inject-code').value;
    if (!raw.trim()) return;

    // Strip code fence if present
    let cleanCode = raw.trim();
    if (cleanCode.startsWith('```')) {
      cleanCode = cleanCode.replace(/^```[a-z0-9_-]*\n?/i, '').replace(/\n?```$/i, '');
    }

    dom.codeEditor.value = cleanCode;
    applySourceCodeToCanvas();
    dom.modalAi.classList.add('hidden');
  }

  // ===========================================================================
  // FILE I/O & SAVE
  // ===========================================================================
  function savePix2File() {
    const text = dom.codeEditor.value || _PIX2.serialize(state.doc);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(state.title)}.pix2`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.pix2') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        dom.codeEditor.value = evt.target.result;
        applySourceCodeToCanvas();
      };
      reader.readAsText(file);
    } else if (file.type.startsWith('image/')) {
      importImageToPixelArt(file);
    }
    e.target.value = '';
  }

  function importImageToPixelArt(file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas sized to image (capped at 512)
        const targetW = Math.min(512, img.width);
        const targetH = Math.min(512, img.height);
        createNewDocument(targetW, targetH, file.name.replace(/\.[^/.]+$/, ''));

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetW;
        tempCanvas.height = targetH;
        const tctx = tempCanvas.getContext('2d');
        tctx.drawImage(img, 0, 0, targetW, targetH);

        const imgData = tctx.getImageData(0, 0, targetW, targetH).data;
        const cell = getArtworkCell();
        cell.pixels = {};

        for (let y = 0; y < targetH; y++) {
          for (let x = 0; x < targetW; x++) {
            const idx = (y * targetW + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const a = imgData[idx + 3];

            if (a > 10) {
              const hex = _PIX2.rgbaToHex(r, g, b, a);
              cell.pixels[`${x},${y}`] = hex;
            }
          }
        }

        repaintCanvas();
        pushHistory();
        syncCanvasToSource();
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ===========================================================================
  // THEME MANAGEMENT
  // ===========================================================================
  function initTheme() {
    const saved = localStorage.getItem('pix2_theme') || 'light';
    setTheme(saved);
  }

  function setTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      document.getElementById('btn-theme-toggle').querySelector('i').className = 'fa-solid fa-sun';
      localStorage.setItem('pix2_theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      document.getElementById('btn-theme-toggle').querySelector('i').className = 'fa-solid fa-moon';
      localStorage.setItem('pix2_theme', 'light');
    }
  }

  function toggleTheme() {
    const current = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  // ===========================================================================
  // EVENT BINDINGS
  // ===========================================================================
  function bindEvents() {
    // Canvas Viewport Events
    dom.viewport.addEventListener('mousedown', onPointerDown);
    dom.viewport.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.viewport.addEventListener('contextmenu', (e) => e.preventDefault());

    // Wheel Zoom centered on cursor
    dom.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const newZoom = Math.max(1, Math.min(64, state.zoom + delta));
      if (newZoom !== state.zoom) {
        state.zoom = newZoom;
        updateContainerTransform();
      }
    }, { passive: false });

    // Source Code Editor Input
    dom.codeEditor.addEventListener('input', handleSourceCodeInput);
    dom.codeEditor.addEventListener('scroll', () => {
      dom.codeGutter.scrollTop = dom.codeEditor.scrollTop;
    });

    // Tool Buttons
    document.querySelectorAll('.pa-tool-btn[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pa-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentTool = btn.dataset.tool;
      });
    });

    // Rect Mode Toggle (Outline vs Fill)
    const btnRectFill = document.getElementById('btn-toggle-rect-fill');
    btnRectFill.addEventListener('click', () => {
      state.rectFill = !state.rectFill;
      btnRectFill.classList.toggle('active', state.rectFill);
      btnRectFill.title = `Rectangle Mode: ${state.rectFill ? 'Fill' : 'Outline'} (Click to toggle)`;
    });

    // Symmetry Toggles
    const btnSymH = document.getElementById('btn-toggle-sym-h');
    btnSymH.addEventListener('click', () => {
      state.symH = !state.symH;
      btnSymH.classList.toggle('active', state.symH);
    });

    const btnSymV = document.getElementById('btn-toggle-sym-v');
    btnSymV.addEventListener('click', () => {
      state.symV = !state.symV;
      btnSymV.classList.toggle('active', state.symV);
    });

    // Undo / Redo / Clear
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);
    document.getElementById('btn-clear-canvas').addEventListener('click', () => {
      if (confirm('Are you sure you want to clear the canvas?')) {
        const cell = getArtworkCell();
        if (cell) {
          cell.pixels = {};
          repaintCanvas();
          pushHistory();
          syncCanvasToSource();
        }
      }
    });

    // Palette & Colors
    dom.colorHex.addEventListener('change', () => {
      setPrimaryColor('#' + dom.colorHex.value);
    });

    dom.colorPickerNative.addEventListener('input', (e) => {
      setPrimaryColor(e.target.value);
    });

    dom.alphaSlider.addEventListener('input', (e) => {
      state.alpha = parseInt(e.target.value, 10);
      dom.alphaVal.textContent = state.alpha;
    });

    document.getElementById('btn-swap-colors').addEventListener('click', swapColors);
    document.getElementById('btn-add-palette-color').addEventListener('click', addActiveColorToPalette);

    dom.paletteSelect.addEventListener('change', (e) => {
      const preset = PRESET_PALETTES[e.target.value];
      if (preset) {
        state.activeSwatches = [...preset];
        renderPaletteSwatches();
        syncPaletteToDoc();
      }
    });

    // Navigation & File Buttons
    document.getElementById('btn-new-canvas').addEventListener('click', () => {
      dom.modalNew.classList.remove('hidden');
    });

    document.getElementById('btn-open-file').addEventListener('click', () => {
      dom.fileInput.click();
    });
    dom.fileInput.addEventListener('change', handleFileSelected);

    document.getElementById('btn-save-pix2').addEventListener('click', savePix2File);
    document.getElementById('btn-export-png').addEventListener('click', openExportModal);
    document.getElementById('btn-ai-assistant').addEventListener('click', () => {
      updateAiPromptView();
      dom.modalAi.classList.remove('hidden');
    });

    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('btn-help-modal').addEventListener('click', () => {
      dom.modalHelp.classList.remove('hidden');
    });

    // View Mode Toggles
    const btnSplit = document.getElementById('btn-view-split');
    const btnCanvas = document.getElementById('btn-view-canvas');
    const btnCode = document.getElementById('btn-view-code');

    function setViewMode(mode) {
      dom.workspace.classList.remove('view-canvas-only', 'view-code-only');
      btnSplit.classList.remove('active');
      btnCanvas.classList.remove('active');
      btnCode.classList.remove('active');

      if (mode === 'canvas') {
        dom.workspace.classList.add('view-canvas-only');
        btnCanvas.classList.add('active');
      } else if (mode === 'code') {
        dom.workspace.classList.add('view-code-only');
        btnCode.classList.add('active');
      } else {
        btnSplit.classList.add('active');
      }
    }

    btnSplit.addEventListener('click', () => setViewMode('split'));
    btnCanvas.addEventListener('click', () => setViewMode('canvas'));
    btnCode.addEventListener('click', () => setViewMode('code'));

    // Statusbar Controls
    dom.btnToggleGrid.addEventListener('click', () => {
      state.showGrid = !state.showGrid;
      dom.btnToggleGrid.classList.toggle('active', state.showGrid);
      updateContainerTransform();
    });

    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      state.zoom = Math.min(64, state.zoom + 2);
      updateContainerTransform();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      state.zoom = Math.max(1, state.zoom - 2);
      updateContainerTransform();
    });
    document.getElementById('btn-zoom-fit').addEventListener('click', fitCanvasToViewport);
    document.getElementById('btn-zoom-100').addEventListener('click', () => {
      state.zoom = 1;
      updateContainerTransform();
    });

    // Code Header Actions
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(dom.codeEditor.value).then(() => {
        alert('PIX2 code copied to clipboard!');
      });
    });

    document.getElementById('btn-download-pix2').addEventListener('click', savePix2File);

    // Modal Close buttons
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pa-modal-backdrop').forEach(m => m.classList.add('hidden'));
      });
    });

    // New Canvas Modal confirm
    document.querySelectorAll('.pa-preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.pa-preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const sz = parseInt(chip.dataset.size, 10);
        document.getElementById('input-custom-w').value = sz;
        document.getElementById('input-custom-h').value = sz;
      });
    });

    document.getElementById('btn-confirm-new-canvas').addEventListener('click', () => {
      const cw = parseInt(document.getElementById('input-custom-w').value, 10) || 64;
      const ch = parseInt(document.getElementById('input-custom-h').value, 10) || 64;
      createNewDocument(cw, ch, 'New Artwork');
      dom.modalNew.classList.add('hidden');
      setTimeout(fitCanvasToViewport, 50);
    });

    // Export Modal Scale buttons
    document.querySelectorAll('.pa-scale-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pa-scale-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.exportScale = parseInt(btn.dataset.scale, 10);
        updateExportPreview();
      });
    });
    document.getElementById('btn-download-png').addEventListener('click', downloadExportedPng);

    // AI Assistant Tabs
    document.querySelectorAll('.pa-ai-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.pa-ai-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tmpl = tab.dataset.template;
        if (tmpl === 'inject') {
          document.getElementById('pa-ai-prompt-view').classList.add('hidden');
          document.getElementById('pa-ai-inject-view').classList.remove('hidden');
        } else {
          document.getElementById('pa-ai-prompt-view').classList.remove('hidden');
          document.getElementById('pa-ai-inject-view').classList.add('hidden');
          updateAiPromptView(tmpl);
        }
      });
    });

    document.getElementById('btn-copy-ai-prompt').addEventListener('click', () => {
      const promptText = document.getElementById('pa-ai-prompt-text').value;
      navigator.clipboard.writeText(promptText).then(() => {
        alert('AI Prompt copied! Paste into ChatGPT or Claude.');
      });
    });

    document.getElementById('btn-confirm-ai-inject').addEventListener('click', injectAiCodeToCanvas);

    // Title input
    dom.docTitle.addEventListener('change', () => {
      state.title = dom.docTitle.value.trim() || 'Pixel Artwork';
      if (state.doc && state.doc.meta) {
        state.doc.meta.title = state.title;
        const cell = getArtworkCell();
        if (cell) cell.name = state.title;
        syncCanvasToSource();
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't intercept shortcuts when typing in inputs or editor
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault();
          savePix2File();
        }
        return;
      }

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault();
        redo();
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        savePix2File();
      } else if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        dom.fileInput.click();
      } else if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        dom.modalNew.classList.remove('hidden');
      } else if (e.key === 'b' || e.key === 'B') {
        selectTool('pen');
      } else if (e.key === 'e' || e.key === 'E') {
        selectTool('eraser');
      } else if (e.key === 'g' || e.key === 'G') {
        selectTool('bucket');
      } else if (e.key === 'l' || e.key === 'L') {
        selectTool('line');
      } else if (e.key === 'u' || e.key === 'U') {
        selectTool('rect');
      } else if (e.key === 'i' || e.key === 'I') {
        selectTool('picker');
      } else if (e.key === 'x' || e.key === 'X') {
        swapColors();
      } else if (e.key === 'h' || e.key === 'H') {
        state.symH = !state.symH;
        document.getElementById('btn-toggle-sym-h').classList.toggle('active', state.symH);
      } else if (e.key === 'v' || e.key === 'V') {
        state.symV = !state.symV;
        document.getElementById('btn-toggle-sym-v').classList.toggle('active', state.symV);
      }
    });
  }

  function selectTool(toolName) {
    state.currentTool = toolName;
    document.querySelectorAll('.pa-tool-btn[data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === toolName);
    });
  }

  function updateUi() {
    setPrimaryColor(state.primaryColor);
    setSecondaryColor(state.secondaryColor);
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================
  function sanitizeFilename(name) {
    return (name || 'artwork').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m];
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
