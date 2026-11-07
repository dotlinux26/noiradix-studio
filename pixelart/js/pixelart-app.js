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

  // Ensure PIX2 engine and Tools library are loaded
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

    // Tools: 'pen' | 'eraser' | 'bucket' | 'line' | 'rect' | 'rect-fill' | 'circle' | 'circle-fill' | 'select' | 'picker' | 'pan'
    currentTool: 'pen',
    symH: false,
    symV: false,

    // Selection Marquee State
    selection: null, // { x, y, w, h }
    isSelecting: false,
    clipboard: null, // { w, h, pixels }

    // Floating Selection Drag & Transform State
    isMovingSelection: false,
    floatingPixels: null,
    floatingOriginalSel: null,
    floatingCurrentX: 0,
    floatingCurrentY: 0,
    moveStartX: 0,
    moveStartY: 0,

    // Colors
    primaryColor: '#4f46e5',
    secondaryColor: '#ffffff',
    alpha: 255,

    // Palette
    paletteKey: 'noiradix',
    activeSwatches: [...PRESET_PALETTES.noiradix],

    // Viewport & Pan
    zoom: 12,
    panX: 0,
    panY: 0,
    showGrid: true,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,

    // Split Pane Resizing
    isDraggingSplitter: false,
    codePaneWidth: 440,

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
    initPanelWidth();
    bindEvents();

    // Check for crash recovery / autosave
    const saved = localStorage.getItem('pix2_pixelart_autosave');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.w && parsed.h && parsed.pixels) {
          createNewDocument(parsed.w, parsed.h, parsed.title || 'Recovered Artwork');
          const cell = getArtworkCell();
          cell.pixels = { ...parsed.pixels };
          repaintCanvas();
          syncCanvasToSource();
        } else {
          createNewDocument(64, 64, 'Pixel Artwork');
        }
      } catch (e) {
        createNewDocument(64, 64, 'Pixel Artwork');
      }
    } else {
      createNewDocument(64, 64, 'Pixel Artwork');
    }

    renderPaletteSwatches();
    updateUi();
    updateAiPromptView();

    // Responsive Drag & Mouse-Wheel Horizontal Scroll
    enableHorizontalDragScroll(document.querySelector('.pa-header'));
    enableHorizontalDragScroll(document.querySelector('.pa-canvas-statusbar'));
    enableHorizontalDragScroll(document.querySelector('.pa-palette-deck'));
    enableHorizontalDragScroll(document.querySelector('.pa-swatches-scroll'));

    // Responsive Drag & Mouse-Wheel Vertical Scroll
    enableVerticalDragScroll(document.getElementById('pa-toolbar'));

    // Fit canvas to viewport
    setTimeout(fitCanvasToViewport, 50);

    // Periodic Autosave every 20 seconds
    setInterval(triggerAutosave, 20000);
  }

  function enableHorizontalDragScroll(container) {
    if (!container) return;
    let isDown = false;
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    container.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.target.closest('button, select, input, textarea, .pa-btn, .pa-icon-btn, .pa-color-slot')) return;
      isDown = true;
      isDragging = false;
      startX = e.clientX;
      startScrollLeft = container.scrollLeft;
    });

    container.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) isDragging = true;
      container.scrollLeft = startScrollLeft - dx;
    });

    const stopDrag = () => { isDown = false; };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    container.addEventListener('wheel', (e) => {
      const deltaY = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      const deltaX = e.deltaMode === 1 ? e.deltaX * 33 : e.deltaX;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        e.preventDefault();
        container.scrollLeft += deltaY;
      } else if (Math.abs(deltaX) > 0) {
        container.scrollLeft += deltaX;
      }
    }, { passive: false });
  }

  function enableVerticalDragScroll(container) {
    if (!container) return;
    let isDown = false;
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    container.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.target.closest('button, select, input, textarea, .pa-tool-btn')) return;
      isDown = true;
      isDragging = false;
      startY = e.clientY;
      startScrollTop = container.scrollTop;
    });

    container.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 3) isDragging = true;
      container.scrollTop = startScrollTop - dy;
    });

    const stopDrag = () => { isDown = false; };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    container.addEventListener('wheel', (e) => {
      const deltaY = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      if (Math.abs(deltaY) > 0) {
        e.preventDefault();
        container.scrollTop += deltaY;
      }
    }, { passive: false });
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

    // Splitter & Source Code Pane
    dom.splitResizer = document.getElementById('pa-split-resizer');
    dom.codePane = document.getElementById('pa-code-pane');
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

  function initPanelWidth() {
    const savedWidth = localStorage.getItem('pix2_pixelart_panel_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (parsed >= 200 && parsed <= window.innerWidth - 300) {
        state.codePaneWidth = parsed;
        dom.codePane.style.width = `${parsed}px`;
      }
    }
  }

  // ===========================================================================
  // DOCUMENT MODEL MANAGEMENT
  // ===========================================================================
  function createNewDocument(w = 64, h = 64, title = 'Pixel Artwork') {
    state.w = Math.max(1, Math.min(1024, w));
    state.h = Math.max(1, Math.min(1024, h));
    state.title = title || 'Pixel Artwork';
    state.selection = null;

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

    dom.dimBadge.textContent = `${state.w}×${state.h}`;
    dom.docTitle.value = state.title;

    resizeCanvasesToZoom();
    repaintCanvas();
    syncCanvasToSource();
    triggerAutosave();
  }

  function getArtworkCell() {
    if (!state.doc || !state.doc.cells) return null;
    if (state.doc.cells.artwork) return state.doc.cells.artwork;
    const firstKey = Object.keys(state.doc.cells)[0];
    return firstKey ? state.doc.cells[firstKey] : null;
  }

  // ===========================================================================
  // CANVAS RENDERING & HIGH PRECISION GRID
  // ===========================================================================
  function resizeCanvasesToZoom() {
    const totalW = state.w * state.zoom;
    const totalH = state.h * state.zoom;

    dom.canvasMain.width = totalW;
    dom.canvasMain.height = totalH;
    dom.canvasPreview.width = totalW;
    dom.canvasPreview.height = totalH;

    dom.container.style.width = `${totalW}px`;
    dom.container.style.height = `${totalH}px`;
    dom.canvasMain.style.width = `${totalW}px`;
    dom.canvasMain.style.height = `${totalH}px`;
    dom.canvasPreview.style.width = `${totalW}px`;
    dom.canvasPreview.style.height = `${totalH}px`;
  }

  function repaintCanvas() {
    const ctx = dom.ctxMain;
    const zoom = state.zoom;
    const totalW = state.w * zoom;
    const totalH = state.h * zoom;

    ctx.clearRect(0, 0, totalW, totalH);

    // 1. Pixel-Aligned Checkerboard Background (1:1 with art pixels)
    const isDark = document.body.classList.contains('dark-theme');
    const c1 = isDark ? '#1a1d29' : '#ffffff';
    const c2 = isDark ? '#121520' : '#e2e8f0';

    // When zoom >= 4, each checker tile is EXACTLY 1 artwork pixel (zoom x zoom screen px)
    // When zoom < 4, checker tile is an integer multiple of zoom so it never splits an art pixel
    const tileArtPixels = zoom >= 4 ? 1 : (zoom === 1 ? 16 : 8);
    const tileCanvasSize = tileArtPixels * zoom;

    for (let cy = 0; cy < totalH; cy += tileCanvasSize) {
      for (let cx = 0; cx < totalW; cx += tileCanvasSize) {
        const col = Math.floor(cx / tileCanvasSize);
        const row = Math.floor(cy / tileCanvasSize);
        ctx.fillStyle = ((col + row) % 2 === 0) ? c1 : c2;
        const curW = Math.min(tileCanvasSize, totalW - cx);
        const curH = Math.min(tileCanvasSize, totalH - cy);
        ctx.fillRect(cx, cy, curW, curH);
      }
    }

    const cell = getArtworkCell();
    if (cell && cell.pixels) {
      // 2. Render all artwork pixels (Integer zoom * zoom block)
      for (const key in cell.pixels) {
        const parts = key.split(',');
        const px = parseInt(parts[0], 10);
        const py = parseInt(parts[1], 10);
        const color = cell.pixels[key];

        if (px >= 0 && px < state.w && py >= 0 && py < state.h) {
          ctx.fillStyle = color;
          ctx.fillRect(px * zoom, py * zoom, zoom, zoom);
        }
      }
    }

    // 3. Razor-Sharp Pixel Grid Overlay (Active at zoom >= 4)
    if (state.showGrid && zoom >= 4) {
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      // Vertical grid lines with +0.5 pixel-crisp alignment
      for (let x = 0; x <= state.w; x++) {
        const posX = Math.floor(x * zoom) + 0.5;
        ctx.moveTo(posX, 0);
        ctx.lineTo(posX, totalH);
      }

      // Horizontal grid lines
      for (let y = 0; y <= state.h; y++) {
        const posY = Math.floor(y * zoom) + 0.5;
        ctx.moveTo(0, posY);
        ctx.lineTo(totalW, posY);
      }
      ctx.stroke();
    }

    // 4. Bilateral Symmetry Axis Guidelines
    if (state.symH) {
      const axisX = Math.floor((state.w / 2) * zoom) + 0.5;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(axisX, 0);
      ctx.lineTo(axisX, totalH);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (state.symV) {
      const axisY = Math.floor((state.h / 2) * zoom) + 0.5;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, axisY);
      ctx.lineTo(totalW, axisY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    renderSelectionMarquee();
    updateContainerTransform();
  }

  function renderSelectionMarquee() {
    dom.ctxPreview.clearRect(0, 0, state.w * state.zoom, state.h * state.zoom);
    if (!state.selection) return;

    const { x, y, w, h } = state.selection;
    const zoom = state.zoom;
    const ctx = dom.ctxPreview;

    // Render floating pixels being dragged/transformed on preview canvas
    if (state.floatingPixels) {
      for (const relKey in state.floatingPixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const px = x + rx;
        const py = y + ry;
        if (px >= 0 && px < state.w && py >= 0 && py < state.h) {
          ctx.fillStyle = state.floatingPixels[relKey];
          ctx.fillRect(px * zoom, py * zoom, zoom, zoom);
        }
      }
    }

    // Dashed Marquee Outline
    ctx.save();
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x * zoom + 0.5, y * zoom + 0.5, w * zoom - 1, h * zoom - 1);

    ctx.strokeStyle = '#ffffff';
    ctx.lineDashOffset = 4;
    ctx.strokeRect(x * zoom + 0.5, y * zoom + 0.5, w * zoom - 1, h * zoom - 1);
    ctx.restore();
  }

  function updateContainerTransform() {
    dom.container.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
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
    resizeCanvasesToZoom();
    repaintCanvas();
  }

  // ===========================================================================
  // BI-DIRECTIONAL SYNCHRONIZATION ENGINE
  // ===========================================================================

  // 1. Canvas -> Source (Strictly On Pointer Up for 60fps performance)
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
          state.w = Math.max(1, Math.min(1024, cell.size.w));
          state.h = Math.max(1, Math.min(1024, cell.size.h));
          dom.dimBadge.textContent = `${state.w}×${state.h}`;
          resizeCanvasesToZoom();
        }
      }

      // Update palette swatches if document palette has colors
      if (parsedDoc.palette && Object.keys(parsedDoc.palette).length > 0) {
        state.activeSwatches = Object.values(parsedDoc.palette);
        renderPaletteSwatches();
      }

      repaintCanvas();
      pushHistory();
      triggerAutosave();

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
    return {
      x: Math.max(0, Math.min(state.w - 1, x)),
      y: Math.max(0, Math.min(state.h - 1, y))
    };
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
    // Pan via Hand tool, middle click or Space key
    if (e.button === 1 || e.spaceKey || state.currentTool === 'pan') {
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

    // Selection Tool Handling
    if (state.currentTool === 'select') {
      // Check if clicking inside active selection -> Move / Drag it!
      if (state.selection &&
          x >= state.selection.x && x < state.selection.x + state.selection.w &&
          y >= state.selection.y && y < state.selection.y + state.selection.h) {
        state.isMovingSelection = true;
        state.moveStartX = x;
        state.moveStartY = y;
        if (!state.floatingPixels) {
          state.floatingOriginalSel = { ...state.selection };
          state.floatingCurrentX = state.selection.x;
          state.floatingCurrentY = state.selection.y;
          state.floatingPixels = {};
          for (let py = 0; py < state.selection.h; py++) {
            for (let px = 0; px < state.selection.w; px++) {
              const key = `${state.selection.x + px},${state.selection.y + py}`;
              if (cell.pixels && cell.pixels[key]) {
                state.floatingPixels[`${px},${py}`] = cell.pixels[key];
                delete cell.pixels[key];
              }
            }
          }
          repaintCanvas();
        }
        renderSelectionMarquee();
        return;
      }

      // Clicking outside -> Commit floating selection first, then create new marquee
      commitFloatingSelection();
      state.isSelecting = true;
      state.selection = { x, y, w: 1, h: 1 };
      renderSelectionMarquee();
      return;
    }

    // If using any drawing tool, commit any pending floating selection
    if (state.floatingPixels) {
      commitFloatingSelection();
    }

    // Picker
    if (state.currentTool === 'picker') {
      pickColorAt(x, y);
      state.isDrawing = false;
      return;
    }

    // Bucket
    if (state.currentTool === 'bucket') {
      _Tools.floodFill(cell, x, y, activeColor, { w: state.w, h: state.h });
      repaintCanvas();
      pushHistory();
      syncCanvasToSource();
      triggerAutosave();
      state.isDrawing = false;
      return;
    }

    // Pen / Eraser
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

    // Moving active selection
    if (state.isMovingSelection && state.floatingOriginalSel) {
      const dx = x - state.moveStartX;
      const dy = y - state.moveStartY;
      state.floatingCurrentX = state.floatingOriginalSel.x + dx;
      state.floatingCurrentY = state.floatingOriginalSel.y + dy;
      state.selection.x = state.floatingCurrentX;
      state.selection.y = state.floatingCurrentY;
      renderSelectionMarquee();
      return;
    }

    if (!state.isDrawing) return;

    const cell = getArtworkCell();
    if (!cell) return;

    const isRightClick = e.buttons === 2;
    const activeColor = isRightClick ? state.secondaryColor : state.primaryColor;

    // Selection Marquee Drag
    if (state.currentTool === 'select' && state.isSelecting) {
      const minX = Math.min(state.dragStartX, x);
      const maxX = Math.max(state.dragStartX, x);
      const minY = Math.min(state.dragStartY, y);
      const maxY = Math.max(state.dragStartY, y);
      state.selection = {
        x: Math.max(0, minX),
        y: Math.max(0, minY),
        w: Math.min(state.w - minX, maxX - minX + 1),
        h: Math.min(state.h - minY, maxY - minY + 1)
      };
      renderSelectionMarquee();
      return;
    }

    // Pen & Eraser Continuous Bresenham Stroke
    if (state.currentTool === 'pen' || state.currentTool === 'eraser') {
      const col = state.currentTool === 'pen' ? activeColor : null;
      _Tools.line(state.lastX, state.lastY, x, y, (px, py) => {
        plotPixelWithSymmetry(cell, px, py, col);
      });
      state.lastX = x;
      state.lastY = y;
      repaintCanvas();
    } else if (state.currentTool === 'line') {
      drawPreviewLine(state.dragStartX, state.dragStartY, x, y, activeColor);
    } else if (state.currentTool === 'rect') {
      drawPreviewRect(state.dragStartX, state.dragStartY, x, y, activeColor, false, e.shiftKey, e.altKey);
    } else if (state.currentTool === 'rect-fill') {
      drawPreviewRect(state.dragStartX, state.dragStartY, x, y, activeColor, true, e.shiftKey, e.altKey);
    } else if (state.currentTool === 'circle') {
      drawPreviewCircle(state.dragStartX, state.dragStartY, x, y, activeColor, false, e.shiftKey, e.altKey);
    } else if (state.currentTool === 'circle-fill') {
      drawPreviewCircle(state.dragStartX, state.dragStartY, x, y, activeColor, true, e.shiftKey, e.altKey);
    }
  }

  function onPointerUp(e) {
    if (state.isPanning) {
      state.isPanning = false;
      dom.viewport.style.cursor = state.currentTool === 'pan' ? 'grab' : 'crosshair';
      return;
    }

    if (state.isMovingSelection) {
      state.isMovingSelection = false;
      renderSelectionMarquee();
      return;
    }

    if (!state.isDrawing) return;
    state.isDrawing = false;
    state.isSelecting = false;

    const cell = getArtworkCell();
    if (!cell) return;

    const { x, y } = getPixelCoord(e);
    const isRightClick = e.button === 2;
    const activeColor = isRightClick ? state.secondaryColor : state.primaryColor;

    dom.ctxPreview.clearRect(0, 0, state.w * state.zoom, state.h * state.zoom);

    if (state.currentTool === 'line') {
      _Tools.line(state.dragStartX, state.dragStartY, x, y, (px, py) => {
        plotPixelWithSymmetry(cell, px, py, activeColor);
      });
      repaintCanvas();
    } else if (state.currentTool === 'rect' || state.currentTool === 'rect-fill') {
      const fillMode = state.currentTool === 'rect-fill';
      const { minX, minY, rw, rh } = computeShapeBounds(state.dragStartX, state.dragStartY, x, y, e.shiftKey, e.altKey);
      _Tools.rect(minX, minY, rw, rh, fillMode, (px, py) => {
        plotPixelWithSymmetry(cell, px, py, activeColor);
      });
      repaintCanvas();
    } else if (state.currentTool === 'circle' || state.currentTool === 'circle-fill') {
      const fillMode = state.currentTool === 'circle-fill';
      const { minX, maxX, minY, maxY } = computeShapeBounds(state.dragStartX, state.dragStartY, x, y, e.shiftKey, e.altKey);
      const points = rasterizeEllipse(minX, minY, maxX, maxY, fillMode);
      for (const pt of points) {
        plotPixelWithSymmetry(cell, pt.x, pt.y, activeColor);
      }
      repaintCanvas();
    }

    renderSelectionMarquee();
    pushHistory();

    // Canvas -> Code sync strictly on Pointer Up for 60fps performance!
    syncCanvasToSource();
    triggerAutosave();
  }

  function computeShapeBounds(startX, startY, curX, curY, shiftKey, altKey) {
    let minX, maxX, minY, maxY;

    if (altKey) {
      let rx = Math.abs(curX - startX);
      let ry = Math.abs(curY - startY);
      if (shiftKey) {
        rx = ry = Math.max(rx, ry);
      }
      minX = startX - rx;
      maxX = startX + rx;
      minY = startY - ry;
      maxY = startY + ry;
    } else {
      let w = Math.abs(curX - startX);
      let h = Math.abs(curY - startY);
      if (shiftKey) {
        const size = Math.max(w, h);
        const signX = curX >= startX ? 1 : -1;
        const signY = curY >= startY ? 1 : -1;
        curX = startX + signX * size;
        curY = startY + signY * size;
      }
      minX = Math.min(startX, curX);
      maxX = Math.max(startX, curX);
      minY = Math.min(startY, curY);
      maxY = Math.max(startY, curY);
    }

    return { minX, maxX, minY, maxY, rw: maxX - minX + 1, rh: maxY - minY + 1 };
  }

  function rasterizeEllipse(x0, y0, x1, y1, fill) {
    let a = Math.abs(x1 - x0);
    let b = Math.abs(y1 - y0);
    let b1 = b & 1;
    let dx = 4 * (1 - a) * b * b;
    let dy = 4 * (b1 + 1) * a * a;
    let err = dx + dy + b1 * a * a;
    let e2;

    if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
    if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
    let y_top = y0 + Math.floor((b + 1) / 2);
    let y_bot = y_top - b1;
    a = 8 * a * a;
    b1 = 8 * b * b;

    const scanlines = {};
    const outlinePoints = [];

    const plot4 = (x_left, x_right, yt, yb) => {
      if (fill) {
        if (!scanlines[yt]) scanlines[yt] = [x_left, x_right];
        else {
          scanlines[yt][0] = Math.min(scanlines[yt][0], x_left);
          scanlines[yt][1] = Math.max(scanlines[yt][1], x_right);
        }
        if (!scanlines[yb]) scanlines[yb] = [x_left, x_right];
        else {
          scanlines[yb][0] = Math.min(scanlines[yb][0], x_left);
          scanlines[yb][1] = Math.max(scanlines[yb][1], x_right);
        }
      } else {
        outlinePoints.push({ x: x_left, y: yt });
        outlinePoints.push({ x: x_right, y: yt });
        outlinePoints.push({ x: x_left, y: yb });
        outlinePoints.push({ x: x_right, y: yb });
      }
    };

    do {
      plot4(x0, x1, y_top, y_bot);
      e2 = 2 * err;
      if (e2 <= dy) { y_top++; y_bot--; err += dy += a; }
      if (e2 >= dx || 2 * err > dy) { x0++; x1--; err += dx += b1; }
    } while (x0 <= x1);

    while (y_top - y_bot <= b) {
      plot4(x0 - 1, x1 + 1, y_top, y_bot);
      y_top++; y_bot--;
    }

    const result = [];
    if (fill) {
      for (const sy in scanlines) {
        const y = parseInt(sy, 10);
        const [minX, maxX] = scanlines[sy];
        for (let x = minX; x <= maxX; x++) {
          result.push({ x, y });
        }
      }
    } else {
      const seen = new Set();
      for (const pt of outlinePoints) {
        const k = `${pt.x},${pt.y}`;
        if (!seen.has(k)) {
          seen.add(k);
          result.push(pt);
        }
      }
    }
    return result;
  }

  function drawPreviewLine(x0, y0, x1, y1, color) {
    const zoom = state.zoom;
    dom.ctxPreview.clearRect(0, 0, state.w * zoom, state.h * zoom);
    dom.ctxPreview.fillStyle = color;
    _Tools.line(x0, y0, x1, y1, (px, py) => {
      dom.ctxPreview.fillRect(px * zoom, py * zoom, zoom, zoom);
      if (state.symH) dom.ctxPreview.fillRect((state.w - 1 - px) * zoom, py * zoom, zoom, zoom);
      if (state.symV) dom.ctxPreview.fillRect(px * zoom, (state.h - 1 - py) * zoom, zoom, zoom);
    });
  }

  function drawPreviewRect(x0, y0, x1, y1, color, fill, shiftKey, altKey) {
    const zoom = state.zoom;
    dom.ctxPreview.clearRect(0, 0, state.w * zoom, state.h * zoom);
    dom.ctxPreview.fillStyle = color;
    const { minX, minY, rw, rh } = computeShapeBounds(x0, y0, x1, y1, shiftKey, altKey);

    _Tools.rect(minX, minY, rw, rh, fill, (px, py) => {
      dom.ctxPreview.fillRect(px * zoom, py * zoom, zoom, zoom);
      if (state.symH) dom.ctxPreview.fillRect((state.w - 1 - px) * zoom, py * zoom, zoom, zoom);
      if (state.symV) dom.ctxPreview.fillRect(px * zoom, (state.h - 1 - py) * zoom, zoom, zoom);
    });
  }

  function drawPreviewCircle(x0, y0, x1, y1, color, fill, shiftKey, altKey) {
    const zoom = state.zoom;
    dom.ctxPreview.clearRect(0, 0, state.w * zoom, state.h * zoom);
    dom.ctxPreview.fillStyle = color;
    const { minX, maxX, minY, maxY } = computeShapeBounds(x0, y0, x1, y1, shiftKey, altKey);

    const points = rasterizeEllipse(minX, minY, maxX, maxY, fill);
    for (const pt of points) {
      dom.ctxPreview.fillRect(pt.x * zoom, pt.y * zoom, zoom, zoom);
      if (state.symH) dom.ctxPreview.fillRect((state.w - 1 - pt.x) * zoom, pt.y * zoom, zoom, zoom);
      if (state.symV) dom.ctxPreview.fillRect(pt.x * zoom, (state.h - 1 - pt.y) * zoom, zoom, zoom);
    }
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

  function commitFloatingSelection() {
    if (!state.floatingPixels || !state.selection) return;
    const cell = getArtworkCell();
    if (cell) {
      if (!cell.pixels) cell.pixels = {};
      for (const relKey in state.floatingPixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const destX = state.selection.x + rx;
        const destY = state.selection.y + ry;
        if (destX >= 0 && destX < state.w && destY >= 0 && destY < state.h) {
          cell.pixels[`${destX},${destY}`] = state.floatingPixels[relKey];
        }
      }
      pushHistory();
      repaintCanvas();
      syncCanvasToSource();
      triggerAutosave();
    }
    state.floatingPixels = null;
    state.floatingOriginalSel = null;
  }

  // ===========================================================================
  // SELECTION & TRANSFORM HELPERS
  // ===========================================================================
  function copySelection() {
    if (!state.selection) return;
    const cell = getArtworkCell();
    if (!cell || !cell.pixels) return;

    if (state.floatingPixels) {
      state.clipboard = {
        w: state.selection.w,
        h: state.selection.h,
        pixels: { ...state.floatingPixels }
      };
      return;
    }

    const { x, y, w, h } = state.selection;
    const copiedPixels = {};

    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const key = `${px},${py}`;
        if (cell.pixels[key]) {
          copiedPixels[`${px - x},${py - y}`] = cell.pixels[key];
        }
      }
    }

    state.clipboard = { w, h, pixels: copiedPixels };
  }

  function cutSelection() {
    if (!state.selection) return;
    copySelection();
    deleteSelection();
  }

  function deleteSelection() {
    if (state.floatingPixels) {
      state.floatingPixels = null;
      state.floatingOriginalSel = null;
      state.selection = null;
      renderSelectionMarquee();
      repaintCanvas();
      pushHistory();
      syncCanvasToSource();
      triggerAutosave();
      return;
    }

    if (!state.selection) return;
    const cell = getArtworkCell();
    if (!cell || !cell.pixels) return;

    const { x, y, w, h } = state.selection;
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        delete cell.pixels[`${px},${py}`];
      }
    }

    state.selection = null;
    renderSelectionMarquee();
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
  }

  function pasteSelection() {
    if (!state.clipboard || !state.clipboard.pixels) return;
    commitFloatingSelection();

    const startX = state.selection ? state.selection.x : 0;
    const startY = state.selection ? state.selection.y : 0;

    state.selection = {
      x: startX,
      y: startY,
      w: state.clipboard.w,
      h: state.clipboard.h
    };
    state.floatingOriginalSel = { ...state.selection };
    state.floatingCurrentX = startX;
    state.floatingCurrentY = startY;
    state.floatingPixels = { ...state.clipboard.pixels };

    renderSelectionMarquee();
    syncCanvasToSource();
  }

  function fillSelection() {
    if (!state.selection) return;
    const cell = getArtworkCell();
    if (!cell) return;

    const { x, y, w, h } = state.selection;
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        cell.pixels[`${px},${py}`] = state.primaryColor;
      }
    }

    state.floatingPixels = null;
    state.floatingOriginalSel = null;
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
  }

  function ensureFloatingSelection() {
    if (state.floatingPixels || !state.selection) return;
    const cell = getArtworkCell();
    if (!cell) return;
    state.floatingOriginalSel = { ...state.selection };
    state.floatingCurrentX = state.selection.x;
    state.floatingCurrentY = state.selection.y;
    state.floatingPixels = {};
    for (let py = 0; py < state.selection.h; py++) {
      for (let px = 0; px < state.selection.w; px++) {
        const key = `${state.selection.x + px},${state.selection.y + py}`;
        if (cell.pixels && cell.pixels[key]) {
          state.floatingPixels[`${px},${py}`] = cell.pixels[key];
          delete cell.pixels[key];
        }
      }
    }
  }

  // Transform Actions (Selection or Full Canvas)
  function rotateArtwork() {
    const cell = getArtworkCell();
    if (!cell) return;

    if (state.selection) {
      ensureFloatingSelection();
      const newFloating = {};
      const oldW = state.selection.w;
      const oldH = state.selection.h;
      for (const relKey in state.floatingPixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const nx = oldH - 1 - ry;
        const ny = rx;
        newFloating[`${nx},${ny}`] = state.floatingPixels[relKey];
      }
      state.floatingPixels = newFloating;
      state.selection.w = oldH;
      state.selection.h = oldW;
      if (state.floatingOriginalSel) {
        state.floatingOriginalSel.w = oldH;
        state.floatingOriginalSel.h = oldW;
      }
      repaintCanvas();
      renderSelectionMarquee();
      return;
    }

    _Tools.rotate90Clockwise(cell, state.w, state.h);
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
  }

  function flipArtworkH() {
    const cell = getArtworkCell();
    if (!cell) return;

    if (state.selection) {
      ensureFloatingSelection();
      const newFloating = {};
      const sw = state.selection.w;
      for (const relKey in state.floatingPixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const nx = sw - 1 - rx;
        newFloating[`${nx},${ry}`] = state.floatingPixels[relKey];
      }
      state.floatingPixels = newFloating;
      repaintCanvas();
      renderSelectionMarquee();
      return;
    }

    _Tools.flipHorizontal(cell, state.w);
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
  }

  function flipArtworkV() {
    const cell = getArtworkCell();
    if (!cell) return;

    if (state.selection) {
      ensureFloatingSelection();
      const newFloating = {};
      const sh = state.selection.h;
      for (const relKey in state.floatingPixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const ny = sh - 1 - ry;
        newFloating[`${rx},${ny}`] = state.floatingPixels[relKey];
      }
      state.floatingPixels = newFloating;
      repaintCanvas();
      renderSelectionMarquee();
      return;
    }

    _Tools.flipVertical(cell, state.h);
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
  }

  function alignArtwork(direction = 'center') {
    commitFloatingSelection();
    const cell = getArtworkCell();
    if (!cell || !cell.pixels) return;

    const coords = Object.keys(cell.pixels).map(k => k.split(',').map(Number));
    if (coords.length === 0) return;

    let minX = state.w, maxX = 0, minY = state.h, maxY = 0;
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

    switch (direction) {
      case 'left':
        shiftX = -minX;
        break;
      case 'right':
        shiftX = (state.w - boxW) - minX;
        break;
      case 'center-h':
        shiftX = Math.floor((state.w - boxW) / 2) - minX;
        break;
      case 'top':
        shiftY = -minY;
        break;
      case 'bottom':
        shiftY = (state.h - boxH) - minY;
        break;
      case 'center-v':
        shiftY = Math.floor((state.h - boxH) / 2) - minY;
        break;
      case 'center':
      default:
        shiftX = Math.floor((state.w - boxW) / 2) - minX;
        shiftY = Math.floor((state.h - boxH) / 2) - minY;
        break;
    }

    if (shiftX === 0 && shiftY === 0) return;

    const newPixels = {};
    for (const k in cell.pixels) {
      const [x, y] = k.split(',').map(Number);
      const nx = x + shiftX;
      const ny = y + shiftY;
      if (nx >= 0 && nx < state.w && ny >= 0 && ny < state.h) {
        newPixels[`${nx},${ny}`] = cell.pixels[k];
      }
    }
    cell.pixels = newPixels;
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
  }

  function nudgeArtwork(dx, dy) {
    if (state.selection) {
      ensureFloatingSelection();
      state.selection.x += dx;
      state.selection.y += dy;
      if (state.floatingOriginalSel) {
        state.floatingCurrentX += dx;
        state.floatingCurrentY += dy;
      }
      repaintCanvas();
      renderSelectionMarquee();
      return;
    }

    const cell = getArtworkCell();
    if (!cell) return;
    _Tools.nudge(cell, dx, dy, state.w, state.h);
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
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

    dom.dimBadge.textContent = `${state.w}×${state.h}`;
    resizeCanvasesToZoom();
    repaintCanvas();
    syncCanvasToSource();
    triggerAutosave();
  }

  // ===========================================================================
  // AUTOSAVE & CRASH RECOVERY
  // ===========================================================================
  function triggerAutosave() {
    const cell = getArtworkCell();
    if (!cell) return;

    const payload = {
      w: state.w,
      h: state.h,
      title: state.title,
      pixels: cell.pixels,
      updatedAt: Date.now()
    };

    try {
      localStorage.setItem('pix2_pixelart_autosave', JSON.stringify(payload));
    } catch (e) {
      // Storage quota exceeded or disabled
    }
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

    // Draw scaled nearest-neighbor from pixel matrix
    const cell = getArtworkCell();
    if (cell && cell.pixels) {
      for (const k in cell.pixels) {
        const [px, py] = k.split(',').map(Number);
        ctx.fillStyle = cell.pixels[k];
        ctx.fillRect(px * scale, py * scale, scale, scale);
      }
    }

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
        // Create canvas sized to image (capped at 1024)
        const targetW = Math.min(1024, img.width);
        const targetH = Math.min(1024, img.height);
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
        triggerAutosave();
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
    repaintCanvas();
  }

  function toggleTheme() {
    const current = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  // ===========================================================================
  // EVENT BINDINGS
  // ===========================================================================
  function bindEvents() {
    // Draggable Split Resizer
    dom.splitResizer.addEventListener('mousedown', () => {
      state.isDraggingSplitter = true;
      dom.splitResizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!state.isDraggingSplitter) return;
      const newWidth = Math.max(200, Math.min(window.innerWidth - 300, window.innerWidth - e.clientX));
      state.codePaneWidth = newWidth;
      dom.codePane.style.width = `${newWidth}px`;
    });

    window.addEventListener('mouseup', () => {
      if (state.isDraggingSplitter) {
        state.isDraggingSplitter = false;
        dom.splitResizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('pix2_pixelart_panel_width', String(state.codePaneWidth));
      }
    });

    // Canvas Viewport Events
    dom.viewport.addEventListener('mousedown', onPointerDown);
    dom.viewport.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.viewport.addEventListener('contextmenu', (e) => e.preventDefault());

    // Wheel Zoom centered on cursor
    dom.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const oldZoom = state.zoom;
      const delta = e.deltaY < 0 ? 1 : -1;
      const newZoom = Math.max(1, Math.min(64, oldZoom + delta));
      if (newZoom === oldZoom) return;

      // Analytical Invariant Cursor-Centered Zoom:
      // Point under the mouse cursor remains invariant in viewport screen coordinates
      const rect = dom.canvasMain.getBoundingClientRect();
      const unscaledX = (e.clientX - rect.left) / oldZoom;
      const unscaledY = (e.clientY - rect.top) / oldZoom;

      const deltaW = (state.w * (newZoom - oldZoom)) / 2;
      const deltaH = (state.h * (newZoom - oldZoom)) / 2;
      const shiftX = unscaledX * (newZoom - oldZoom);
      const shiftY = unscaledY * (newZoom - oldZoom);

      state.zoom = newZoom;
      state.panX += Math.round(deltaW - shiftX);
      state.panY += Math.round(deltaH - shiftY);

      resizeCanvasesToZoom();
      repaintCanvas();
    }, { passive: false });

    // Source Code Editor Input
    dom.codeEditor.addEventListener('input', handleSourceCodeInput);
    dom.codeEditor.addEventListener('scroll', () => {
      dom.codeGutter.scrollTop = dom.codeEditor.scrollTop;
    });

    // Tool Buttons
    document.querySelectorAll('.pa-tool-btn[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectTool(btn.dataset.tool);
      });
    });

    // Symmetry Toggles
    const btnSymH = document.getElementById('btn-toggle-sym-h');
    btnSymH.addEventListener('click', () => {
      state.symH = !state.symH;
      btnSymH.classList.toggle('active', state.symH);
      repaintCanvas();
    });

    const btnSymV = document.getElementById('btn-toggle-sym-v');
    btnSymV.addEventListener('click', () => {
      state.symV = !state.symV;
      btnSymV.classList.toggle('active', state.symV);
      repaintCanvas();
    });

    // Transform & Align Action Buttons
    document.getElementById('btn-rotate-90').addEventListener('click', rotateArtwork);
    document.getElementById('btn-flip-h').addEventListener('click', flipArtworkH);
    const btnFlipV = document.getElementById('btn-flip-v');
    if (btnFlipV) btnFlipV.addEventListener('click', flipArtworkV);

    document.getElementById('btn-align-center').addEventListener('click', () => alignArtwork('center'));
    const btnAlignLeft = document.getElementById('btn-align-left');
    if (btnAlignLeft) btnAlignLeft.addEventListener('click', () => alignArtwork('left'));
    const btnAlignRight = document.getElementById('btn-align-right');
    if (btnAlignRight) btnAlignRight.addEventListener('click', () => alignArtwork('right'));
    const btnAlignTop = document.getElementById('btn-align-top');
    if (btnAlignTop) btnAlignTop.addEventListener('click', () => alignArtwork('top'));
    const btnAlignBottom = document.getElementById('btn-align-bottom');
    if (btnAlignBottom) btnAlignBottom.addEventListener('click', () => alignArtwork('bottom'));

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
          triggerAutosave();
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
      repaintCanvas();
    });

    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      state.zoom = Math.min(64, state.zoom + 2);
      resizeCanvasesToZoom();
      repaintCanvas();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      state.zoom = Math.max(1, state.zoom - 2);
      resizeCanvasesToZoom();
      repaintCanvas();
    });
    document.getElementById('btn-zoom-fit').addEventListener('click', fitCanvasToViewport);
    document.getElementById('btn-zoom-100').addEventListener('click', () => {
      state.zoom = 1;
      resizeCanvasesToZoom();
      repaintCanvas();
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
        const pw = parseInt(chip.dataset.w, 10);
        const ph = parseInt(chip.dataset.h, 10);
        document.getElementById('input-custom-w').value = pw;
        document.getElementById('input-custom-h').value = ph;
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
        triggerAutosave();
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
      } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        copySelection();
      } else if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
        cutSelection();
      } else if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
        pasteSelection();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection();
      } else if (e.key === 'f' || e.key === 'F') {
        if (state.selection) fillSelection();
      } else if (e.key === 'ArrowUp') {
        nudgeArtwork(0, -1);
      } else if (e.key === 'ArrowDown') {
        nudgeArtwork(0, 1);
      } else if (e.key === 'ArrowLeft') {
        nudgeArtwork(-1, 0);
      } else if (e.key === 'ArrowRight') {
        nudgeArtwork(1, 0);
      } else if (e.key === 'b' || e.key === 'B') {
        selectTool('pen');
      } else if (e.key === 'e' || e.key === 'E') {
        selectTool('eraser');
      } else if (e.key === 'g' || e.key === 'G') {
        selectTool('bucket');
      } else if (e.key === 'l' || e.key === 'L') {
        selectTool('line');
      } else if (e.key === 'u' || e.key === 'U') {
        if (e.shiftKey) selectTool('rect-fill');
        else selectTool('rect');
      } else if (e.key === 'c' || e.key === 'C') {
        if (e.shiftKey) selectTool('circle-fill');
        else selectTool('circle');
      } else if (e.key === 'r' || e.key === 'R') {
        rotateArtwork();
      } else if (e.key === 'Escape') {
        commitFloatingSelection();
        state.selection = null;
        renderSelectionMarquee();
      } else if (e.key === 'Enter') {
        commitFloatingSelection();
        renderSelectionMarquee();
      } else if (e.key === 'm' || e.key === 'M') {
        selectTool('select');
      } else if (e.key === 'i' || e.key === 'I') {
        selectTool('picker');
      } else if (e.key === 'p' || e.key === 'P') {
        selectTool('pan');
      } else if (e.key === 'x' || e.key === 'X') {
        swapColors();
      } else if (e.key === 'h' || e.key === 'H') {
        state.symH = !state.symH;
        document.getElementById('btn-toggle-sym-h').classList.toggle('active', state.symH);
        repaintCanvas();
      } else if (e.key === 'v' || e.key === 'V') {
        state.symV = !state.symV;
        document.getElementById('btn-toggle-sym-v').classList.toggle('active', state.symV);
        repaintCanvas();
      }
    });
  }

  function selectTool(toolName) {
    if (state.currentTool !== toolName && state.floatingPixels) {
      commitFloatingSelection();
    }
    state.currentTool = toolName;
    document.querySelectorAll('.pa-tool-btn[data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === toolName);
    });

    if (toolName !== 'select' && state.selection) {
      state.selection = null;
      renderSelectionMarquee();
    }
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
