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

  // Safe environment detection for hybrid browser/node test runtime
  const _hasWindow = typeof window !== 'undefined';
  const _hasDocument = typeof document !== 'undefined';
  const _inMemoryStorage = new Map();
  const _storage = (typeof localStorage !== 'undefined') ? localStorage : {
    getItem: (k) => _inMemoryStorage.has(k) ? _inMemoryStorage.get(k) : null,
    setItem: (k, v) => { _inMemoryStorage.set(k, String(v)); },
    removeItem: (k) => { _inMemoryStorage.delete(k); },
    clear: () => { _inMemoryStorage.clear(); }
  };

  // Ensure PIX2 engine and Tools library are loaded
  const _PIX2 = typeof PIX2 !== 'undefined' ? PIX2 : (_hasWindow && window.PIX2 ? window.PIX2 : (typeof require !== 'undefined' ? require('../../js/pix2-format.js') : null));
  const _Tools = typeof Tools !== 'undefined' ? Tools : (_hasWindow && window.Tools ? window.Tools : (typeof require !== 'undefined' ? require('../../js/tools.js') : null));
  const _StructureOps = typeof StructureOps !== 'undefined' ? StructureOps : (typeof require !== 'undefined' ? require('../../js/structure-operations.js') : null);

  if (!_PIX2) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('CRITICAL: PIX2 Reference Engine not found. Please verify js/pix2-format.js is loaded.');
    }
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
    ],
    solarenvy: [
      '#10141f', '#2f2e41', '#3b5dc9', '#41a6f6', '#73eff7', '#257179', '#38b764', '#a7f070',
      '#ffcd75', '#ef7d57', '#b13e53', '#5d275d', '#333c57', '#566c86', '#94b0c2', '#f4f4f4',
      '#181425', '#262b44', '#3a4466', '#5a6988', '#8b9bb4', '#c0cbdc', '#ffffff', '#2ce8f5',
      '#0099db', '#124e89', '#193c3e', '#265c42', '#3e8948', '#63c74d', '#fee761', '#feae34'
    ],
    dawnbringer16: [
      '#140c1c', '#442434', '#30346d', '#4e4a4e', '#854c30', '#346524', '#d04648', '#757161',
      '#597dce', '#d27d2c', '#8595a1', '#6daa2c', '#d2aa99', '#6dc2ca', '#dad45e', '#deeed6'
    ],
    dawnbringer32: [
      '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
      '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
      '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
      '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77643', '#8f974a', '#8a6f30'
    ],
    nes54: [
      '#7c7c7c', '#0000fc', '#0000bc', '#4428bc', '#940084', '#a80020', '#a81000', '#881400',
      '#503000', '#007800', '#006800', '#0058f8', '#004058', '#000000', '#bcbcbc', '#0078f8',
      '#6844fc', '#d800cc', '#e40058', '#f83800', '#e45c10', '#ac7c00', '#00b800', '#00a800',
      '#00a844', '#008888', '#f8f8f8', '#3cbcfc', '#6888fc', '#9878f8', '#f878f8', '#f85898',
      '#f87858', '#fca044', '#f8b800', '#b8f818', '#58d854', '#58f898', '#00e8d8', '#fcfcfc',
      '#a4e4fc', '#b8b8f8', '#d8b8f8', '#f8b8f8', '#f8a4c0', '#f0d0b0', '#fce0a8', '#f8d878',
      '#d8f878', '#b8f8b8', '#b8f8d8', '#00fcfc'
    ]
  };

  const CUSTOM_PALETTES_STORAGE_KEY = 'noiradix_custom_palettes';

  function loadCustomPalettes() {
    try {
      const raw = _storage.getItem(CUSTOM_PALETTES_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveCustomPalettes(palettesObj) {
    try {
      _storage.setItem(CUSTOM_PALETTES_STORAGE_KEY, JSON.stringify(palettesObj));
    } catch (err) {
      console.warn('Failed to save custom palettes to storage:', err);
    }
  }

  function populatePaletteDropdown() {
    if (!dom.paletteSelect) return;
    const prevVal = dom.paletteSelect.value;
    dom.paletteSelect.innerHTML = '';

    // 1. Built-in presets
    const builtInGroup = document.createElement('optgroup');
    builtInGroup.label = 'Built-in Presets';
    const builtIns = [
      { id: 'noiradix', name: 'Noiradix Classic', count: PRESET_PALETTES.noiradix.length },
      { id: 'pico8', name: 'PICO-8', count: PRESET_PALETTES.pico8.length },
      { id: 'endesga32', name: 'Endesga 32', count: PRESET_PALETTES.endesga32.length },
      { id: 'gameboy', name: 'Game Boy', count: PRESET_PALETTES.gameboy.length },
      { id: 'sweetie16', name: 'Sweetie 16', count: PRESET_PALETTES.sweetie16.length },
      { id: 'solarenvy', name: 'Solar Envy', count: PRESET_PALETTES.solarenvy.length },
      { id: 'dawnbringer16', name: 'DawnBringer 16', count: PRESET_PALETTES.dawnbringer16.length },
      { id: 'dawnbringer32', name: 'DawnBringer 32', count: PRESET_PALETTES.dawnbringer32.length },
      { id: 'nes54', name: 'NES 54', count: PRESET_PALETTES.nes54.length }
    ];
    builtIns.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} (${b.count})`;
      builtInGroup.appendChild(opt);
    });
    dom.paletteSelect.appendChild(builtInGroup);

    // 2. Custom Library presets
    const customPalettes = loadCustomPalettes();
    const customKeys = Object.keys(customPalettes);
    if (customKeys.length > 0) {
      const customGroup = document.createElement('optgroup');
      customGroup.label = 'Custom Library';
      customKeys.forEach(k => {
        const item = customPalettes[k];
        const opt = document.createElement('option');
        opt.value = `custom_${k}`;
        opt.textContent = `${item.name} (${item.colors ? item.colors.length : 0})`;
        customGroup.appendChild(opt);
      });
      dom.paletteSelect.appendChild(customGroup);
    }

    // 3. Action option
    const actionGroup = document.createElement('optgroup');
    actionGroup.label = 'Actions';
    const newOpt = document.createElement('option');
    newOpt.value = '__new_preset__';
    newOpt.textContent = '+ Save Current Palette to Library...';
    actionGroup.appendChild(newOpt);
    dom.paletteSelect.appendChild(actionGroup);

    if (prevVal && dom.paletteSelect.querySelector(`option[value="${prevVal}"]`)) {
      dom.paletteSelect.value = prevVal;
    } else {
      dom.paletteSelect.value = 'noiradix';
    }
  }

  function promptAndSavePalettePreset() {
    const colors = [];
    if (state.activeSwatches && state.activeSwatches.length > 0) {
      state.activeSwatches.forEach(c => {
        const hex = (typeof _PIX2 !== 'undefined' && _PIX2.normalizeHex) ? _PIX2.normalizeHex(c) : c;
        if (hex && !colors.includes(hex)) colors.push(hex);
      });
    }
    if (state.doc && state.doc.palette) {
      for (const id in state.doc.palette) {
        const c = state.doc.palette[id];
        const hex = (typeof _PIX2 !== 'undefined' && _PIX2.normalizeHex) ? _PIX2.normalizeHex(c) : c;
        if (hex && !colors.includes(hex)) colors.push(hex);
      }
    }

    if (colors.length === 0) {
      showToast('Palette has no valid colors to save.', 'error');
      return;
    }

    const defaultName = `${state.title || 'My'} Palette`;
    const inputName = prompt(`Save ${colors.length} colors to your Palette Library.\nEnter preset name:`, defaultName);
    if (inputName === null) {
      populatePaletteDropdown();
      return;
    }
    const finalName = inputName.trim() || defaultName;
    const key = finalName.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || `palette_${Date.now()}`;
    const customPalettes = loadCustomPalettes();
    customPalettes[key] = {
      name: finalName,
      colors: colors,
      created: Date.now()
    };
    saveCustomPalettes(customPalettes);

    populatePaletteDropdown();
    if (dom.paletteSelect) {
      dom.paletteSelect.value = `custom_${key}`;
    }
    state.activeSwatches = [...colors];
    renderPaletteSwatches();
    syncPaletteToDoc();
    showToast(`Saved palette "${finalName}" (${colors.length} colors) to library!`);
  }

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
    // The structural node that owned the pixels when they were lifted.  A
    // selection transaction must not follow a later layer/tree selection.
    floatingTargetId: null,
    floatingBaselineTargetId: null,
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
    showRulers: _storage.getItem('pix2_pixelart_rulers') !== 'false',
    _hoverX: null,
    _hoverY: null,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,

    // Space Key Navigation State
    isSpaceDown: false,
    didPanWithSpace: false,
    spaceDownTime: 0,

    // Split Pane Resizing
    isDraggingSplitter: false,
    codePaneWidth: 440,

    // Drawing drag
    isDrawing: false,
    lastX: null,
    lastY: null,
    dragStartX: null,
    dragStartY: null,

    // History (Delta-Based & Snapshot Hybrid Undo / Redo)
    history: [],
    historyIndex: -1,
    maxHistory: 50,
    lastHistoryPixels: null,

    // Synchronization Locks
    isSyncingFromCanvas: false,
    isSyncingFromSource: false,
    sourceDebounceTimer: null,

    // PNG Export
    exportScale: 8,

    // Canvas Background Configuration
    canvasBgMode: _storage.getItem('pix2_canvas_bg_mode') || 'transparent', // 'transparent' | 'white' | 'black' | 'custom'
    canvasBgColor: _storage.getItem('pix2_canvas_bg_color') || '#2a2e3f',
    exportIncludeBg: false,

    // Alignment Guidelines
    guideCenter: false,
    guideV: false,
    guideH: false,

    // Selection Free Multi-Angle Rotation State
    isRotatingSelection: false,
    rotationStartAngle: 0,
    rotationCurrentAngle: 0,
    rotationCenter: null,
    // A floating selection keeps one immutable raster source across repeated
    // rotation gestures. Re-sampling the previous axis-aligned bounding box is
    // what caused the selection to grow after every rotation.
    rotationSessionPixels: null,
    rotationSessionSel: null,
    rotationAccumulatedAngle: 0,
    rotationGestureBaseAngle: 0,

    // Selection Scaling State (Unified SelectionTransform Engine)
    isScalingSelection: false,
    activeScaleHandle: null,
    scaleOriginalSel: null,
    scaleOriginalPixels: null,

    // Structural Graphics & PIX2 1.1 Support
    isolatedNodeId: null,
    activeLayerId: null,
    activeRegionId: null,

    // Document Dirty & Disk Link State
    isDirty: false,

    // Code Editor Lock / Safe Mode
    isCodeEditingUnlocked: false,

    // Hardware-Accelerated 1:1 Canvas Buffers & Performance
    artworkCanvas: null,
    artworkCtx: null,
    floatingCanvas: null,
    floatingCtx: null,
    isSourceDirty: false,
    viewMode: 'split'
  };

  // Toast Notification System
  let toastTimer = null;
  function showToast(msg, type = 'info') {
    if (typeof document === 'undefined') return;
    let toast = document.getElementById('pa-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pa-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `pa-toast visible pa-toast-${type}`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.className = 'pa-toast';
    }, 2800);
  }

  // ===========================================================================
  // REVISION & DIRTY STATE TRACKER (Centralized Mutation Control)
  // ===========================================================================
  let documentRevision = 0;
  let lastSavedRevision = 0;

  function markDocumentMutation(action = 'edit') {
    documentRevision++;
    setDirty(documentRevision !== lastSavedRevision);
  }

  function markDocumentSaved() {
    lastSavedRevision = documentRevision;
    setDirty(false);
  }

  async function confirmDiscardUnsavedChanges(actionDesc = 'proceed') {
    if (!state.isDirty) return true;
    const name = currentFileName || (currentFileHandle ? currentFileHandle.name : null) || state.title || 'Untitled Artwork';
    const msg = `Artwork "${name}" has unsaved changes.\n\nDiscard unsaved changes and ${actionDesc}?`;
    return window.confirm(msg);
  }

  // Dirty State Tracker & Desktop Status Synchronizer
  function setDirty(dirty) {
    state.isDirty = dirty;
    if (!dirty) {
      lastSavedRevision = documentRevision;
    } else if (documentRevision === lastSavedRevision) {
      documentRevision++;
    }

    const fileName = currentFileName || (currentFileHandle ? currentFileHandle.name : null) || `${sanitizeFilename(state.title)}.pix2`;
    const isLinked = Boolean(currentFileHandle);

    if (typeof paProjectSessions !== 'undefined' && activePaProjectId) {
      const cur = paProjectSessions.find(p => p.id === activePaProjectId);
      if (cur) {
        cur.isDirty = dirty;
        cur.fileName = fileName;
      }
    }

    if (typeof document === 'undefined') return;

    renderPaProjectTabs();

    document.title = (dirty || !isLinked)
      ? `● ${fileName} — NOIRADIX PixelArt`
      : `${fileName} — NOIRADIX PixelArt`;

    const dirtyDot = document.getElementById('pa-header-dirty-dot');
    if (dirtyDot) {
      dirtyDot.classList.toggle('is-dirty', dirty);
      dirtyDot.title = dirty ? 'Unsaved changes (Ctrl+S to save)' : `Saved to disk (${fileName})`;
    }

    const sourceBadge = document.getElementById('pa-file-source-badge');
    const sourceText = document.getElementById('pa-file-source-text');
    if (sourceBadge && sourceText) {
      if (isLinked) {
        sourceBadge.className = 'pa-file-source-badge local';
        sourceBadge.title = `Direct disk link: ${fileName}`;
        sourceText.textContent = 'Local File';
      } else {
        sourceBadge.className = 'pa-file-source-badge draft';
        sourceBadge.title = 'In-Memory Draft (Ctrl+S to save to physical file)';
        sourceText.textContent = 'Draft';
      }
    }

    const pathText = document.getElementById('pa-file-path-text');
    if (pathText) {
      pathText.textContent = fileName;
    }

    const saveBadge = document.getElementById('pa-save-status-badge');
    const saveText = document.getElementById('pa-save-status-text');
    if (saveBadge && saveText) {
      if (!isLinked) {
        saveBadge.className = 'pa-save-status-badge draft';
        saveText.textContent = 'Unsaved to Disk';
      } else if (dirty) {
        saveBadge.className = 'pa-save-status-badge dirty';
        saveText.textContent = 'Unsaved Changes';
      } else {
        saveBadge.className = 'pa-save-status-badge clean';
        saveText.textContent = 'Saved to Disk';
      }
    }

    const btnSave = document.getElementById('btn-save-pix2');
    if (btnSave) {
      btnSave.classList.toggle('pa-btn-accent', dirty || !isLinked);
    }
  }

  // High-Performance Cached Checkerboard Pattern (Eliminates 512x512 rendering lag)
  let _checkerPatternCache = null;
  let _lastCheckerKey = '';
  function getCheckerPattern(ctx, tileSize, isDark) {
    const key = `${tileSize}_${isDark}`;
    if (_checkerPatternCache && _lastCheckerKey === key) return _checkerPatternCache;
    const patCanvas = document.createElement('canvas');
    patCanvas.width = tileSize * 2;
    patCanvas.height = tileSize * 2;
    const pctx = patCanvas.getContext('2d');
    const c1 = isDark ? '#1a1d29' : '#ffffff';
    const c2 = isDark ? '#121520' : '#e2e8f0';
    pctx.fillStyle = c1;
    pctx.fillRect(0, 0, tileSize * 2, tileSize * 2);
    pctx.fillStyle = c2;
    pctx.fillRect(0, 0, tileSize, tileSize);
    pctx.fillRect(tileSize, tileSize, tileSize, tileSize);
    _checkerPatternCache = ctx.createPattern(patCanvas, 'repeat');
    _lastCheckerKey = key;
    return _checkerPatternCache;
  }

  // ===========================================================================
  // PIXELART MULTI-DOCUMENT PROJECT SESSIONS & STRUCTURE ENGINE (PIX2 1.1)
  // ===========================================================================
  let paProjectSessions = [];
  let activePaProjectId = null;

  class PaProjectSession {
    constructor(id, title, doc, fileHandle = null, fileName = null) {
      this.id = id || ('pa_proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
      this.title = title || 'Pixel Artwork';
      this.doc = doc;
      this.fileHandle = fileHandle;
      this.fileName = fileName || (title ? `${title}.pix2` : 'untitled.pix2');
      this.w = 64;
      this.h = 64;
      this.isDirty = false;
      this.revision = 0;
      this.lastSavedRevision = 0;
      this.history = [];
      this.historyIndex = -1;
      this.lastHistoryPixels = null;
      this.selection = null;
      this.isolatedNodeId = null;
    }
  }

  function reorderPaProjectSessions(orderedIds) {
    const byId = new Map(paProjectSessions.map(session => [session.id, session]));
    const ordered = orderedIds.map(id => byId.get(id)).filter(Boolean);
    if (ordered.length !== paProjectSessions.length) return;
    paProjectSessions = ordered;
    renderPaProjectTabs();
  }

  function renderPaProjectTabs() {
    if (!_hasDocument) return;
    const strip = document.getElementById('pa-project-tabs-strip');
    if (!strip) return;
    strip.innerHTML = '';

    paProjectSessions.forEach(session => {
      const tab = document.createElement('div');
      tab.className = `project-tab ${session.id === activePaProjectId ? 'active' : ''}`;
      tab.dataset.tabId = session.id;
      tab.title = session.fileName || session.title;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'project-tab-label';
      titleSpan.textContent = session.fileName || session.title;
      tab.appendChild(titleSpan);

      if (session.isDirty) {
        const dot = document.createElement('span');
        dot.className = 'project-tab-dirty-dot';
        dot.textContent = '●';
        tab.appendChild(dot);
      }

      const closeBtn = document.createElement('span');
      closeBtn.className = 'project-tab-close';
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      closeBtn.title = 'Close artwork session';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePaProjectSession(session.id);
      });
      tab.appendChild(closeBtn);

      tab.addEventListener('click', () => {
        if (session.id !== activePaProjectId) {
          switchPaProjectSession(session.id);
        }
      });

      strip.appendChild(tab);
    });

    if (window.NoiraTabStrip) {
      window.NoiraTabStrip.attach(strip, {
        onReorder: reorderPaProjectSessions,
        onAfterReorder: (tabId) => {
          const tab = strip.querySelector(`[data-tab-id="${tabId}"]`);
          if (tab) tab.focus({ preventScroll: true });
        }
      });
    }
  }

  function saveCurrentPaSession() {
    const cur = paProjectSessions.find(p => p.id === activePaProjectId);
    if (!cur) return;
    cur.doc = state.doc;
    cur.fileHandle = currentFileHandle;
    cur.fileName = currentFileName;
    cur.title = state.title;
    cur.w = state.w;
    cur.h = state.h;
    cur.isDirty = state.isDirty;
    cur.revision = documentRevision;
    cur.lastSavedRevision = lastSavedRevision;
    cur.history = [...state.history];
    cur.historyIndex = state.historyIndex;
    cur.lastHistoryPixels = state.lastHistoryPixels ? { ...state.lastHistoryPixels } : null;
    cur.selection = state.selection ? { ...state.selection } : null;
    cur.isolatedNodeId = state.isolatedNodeId;
  }

  function switchPaProjectSession(sessionId) {
    const target = paProjectSessions.find(p => p.id === sessionId);
    if (!target) return;

    saveCurrentPaSession();
    activePaProjectId = sessionId;

    state.doc = target.doc;
    currentFileHandle = target.fileHandle;
    currentFileName = target.fileName;
    state.title = target.title || 'Pixel Artwork';
    state.w = target.w || 64;
    state.h = target.h || 64;
    state.isDirty = target.isDirty || false;
    documentRevision = target.revision || 0;
    lastSavedRevision = target.lastSavedRevision || 0;
    state.history = target.history ? [...target.history] : [];
    state.historyIndex = target.historyIndex;
    state.lastHistoryPixels = target.lastHistoryPixels ? { ...target.lastHistoryPixels } : null;
    state.selection = target.selection ? { ...target.selection } : null;
    state.isolatedNodeId = target.isolatedNodeId || null;

    if (dom.docTitle) dom.docTitle.value = state.title;
    if (dom.dimBadge) dom.dimBadge.textContent = `${state.w}×${state.h}`;

    setDirty(target.isDirty);
    resizeCanvasesToZoom();
    rebuildArtworkBuffer();
    repaintCanvas();
    renderRulers();
    renderPaProjectTabs();
    renderPaLayersTree();
    updateIsolationBannerUI();

    // Ensure the new tab is scrolled into view (fixes first-click tab not visible)
    if (typeof requestAnimationFrame !== 'undefined' && typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        const strip = document.getElementById('pa-project-tabs-strip');
        const newTab = strip?.querySelector(`[data-tab-id="${sessionId}"]`);
        if (newTab) newTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    }
  }

  function createPaProjectSession(title, doc, fileHandle = null) {
    saveCurrentPaSession();

    // If the active only session is pristine initial untitled with zero edits, replace it
    if (paProjectSessions.length === 1 &&
        paProjectSessions[0].id === 'pa_initial' &&
        !paProjectSessions[0].isDirty &&
        (!paProjectSessions[0].history || paProjectSessions[0].history.length <= 1)) {
      const initCell = getArtworkCell();
      if (!initCell || !initCell.pixels || Object.keys(initCell.pixels).length === 0) {
        paProjectSessions.splice(0, 1);
      }
    }

    const cell = (doc && doc.cells) ? (doc.cells.artwork || Object.values(doc.cells)[0]) : null;
    const docW = (cell && cell.size && cell.size.w) || (doc && doc.grid && doc.grid.cell_size && doc.grid.cell_size.w) || state.w || 64;
    const docH = (cell && cell.size && cell.size.h) || (doc && doc.grid && doc.grid.cell_size && doc.grid.cell_size.h) || state.h || 64;

    const newId = 'pa_proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const session = new PaProjectSession(newId, title, doc, fileHandle);
    session.w = docW;
    session.h = docH;
    paProjectSessions.push(session);
    switchPaProjectSession(newId);
    return session;
  }

  function closePaProjectSession(sessionId) {
    const session = paProjectSessions.find(p => p.id === sessionId);
    if (!session) return;

    if (session.isDirty) {
      const confirmDiscard = confirm(`Artwork "${session.fileName || session.title}" has unsaved changes. Discard and close?`);
      if (!confirmDiscard) return;
    }

    const idx = paProjectSessions.findIndex(p => p.id === sessionId);
    if (idx !== -1) {
      paProjectSessions.splice(idx, 1);
    }

    if (paProjectSessions.length === 0) {
      createNewDocument(64, 64, 'Pixel Artwork');
    } else {
      const nextSession = paProjectSessions[Math.min(idx, paProjectSessions.length - 1)];
      switchPaProjectSession(nextSession.id);
    }
  }

  function enterIsolationMode(nodeId, breadcrumb) {
    state.isolatedNodeId = nodeId;
    updateIsolationBannerUI(breadcrumb);
    rebuildArtworkBuffer();
    repaintCanvas();
    renderSelectionMarquee();
    if (typeof showToast === 'function') showToast(`Entered isolation mode: ${breadcrumb || nodeId}`);
  }

  function exitIsolationMode() {
    if (!state.isolatedNodeId) return;
    state.isolatedNodeId = null;
    updateIsolationBannerUI();
    rebuildArtworkBuffer();
    repaintCanvas();
    renderSelectionMarquee();
    if (typeof showToast === 'function') showToast('Exited isolation mode');
  }

  function updateIsolationBannerUI(breadcrumb = '') {
    if (!_hasDocument) return;
    const banner = document.getElementById('pa-isolation-banner');
    const bcElem = document.getElementById('pa-isolation-breadcrumb');
    if (!banner) return;
    if (state.isolatedNodeId) {
      banner.classList.remove('hidden');
      if (bcElem) bcElem.textContent = breadcrumb || state.isolatedNodeId;
    } else {
      banner.classList.add('hidden');
    }
  }

  function findRegionAt(cell, x, y) {
    if (!cell || !cell.layers) return null;
    for (let i = cell.layers.length - 1; i >= 0; i--) {
      const layer = cell.layers[i];
      if (layer.visible === false) continue;
      function searchNodes(nodes) {
        for (let j = (nodes || []).length - 1; j >= 0; j--) {
          const n = nodes[j];
          if (n.type === 'region' && n.pixels) {
            if (n.pixels[`${x},${y}`]) return n;
          } else if (n.type === 'group') {
            const found = searchNodes(n.children);
            if (found) return found;
          }
        }
        return null;
      }
      const found = searchNodes(layer.children);
      if (found) return found;
    }
    return null;
  }

  function findNodeById(cell, nodeId) {
    if (!cell || !cell.layers || !nodeId) return null;
    function search(nodes) {
      for (const n of (nodes || [])) {
        if (n.id === nodeId) return n;
        if (n.children) {
          const res = search(n.children);
          if (res) return res;
        }
      }
      return null;
    }
    for (const l of cell.layers) {
      if (l.id === nodeId) return l;
      const res = search(l.children);
      if (res) return res;
    }
    return null;
  }

  // Persistent expand/collapse state for groups
  const groupExpanded = new Map();

  function isGroupExpanded(groupId) {
    return groupExpanded.get(groupId) !== false; // default expanded
  }

  function toggleGroupExpanded(groupId) {
    groupExpanded.set(groupId, !isGroupExpanded(groupId));
  }

  function renderPaLayersTree() {
    if (!_hasDocument) return;
    const container = document.getElementById('pa-layers-tree');
    if (!container) return;
    container.innerHTML = '';

    const cell = getArtworkCell();
    if (!cell) return;
    if (_StructureOps && typeof _StructureOps.normalizeRasterOwnership === 'function') {
      const normalization = _StructureOps.normalizeRasterOwnership(cell);
      if (normalization.changed && !state.activeRegionId && normalization.createdRegionIds.length) {
        state.activeRegionId = normalization.createdRegionIds[0];
      }
    }

    if (!cell.layers || cell.layers.length === 0) {
      container.innerHTML = '<div class="pa-layers-empty">No structural layers. Drawing in flat root mode. Click "+ Layer" above to create layers.</div>';
      return;
    }

    cell.layers.forEach((layer) => {
      const layerEl = document.createElement('div');
      layerEl.className = 'pa-layer-item';
      layerEl.draggable = true;
      layerEl.title = 'Drag to reorder layer';
      layerEl.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-pix2-node', layer.id);
        layerEl.classList.add('is-dragging');
      });
      layerEl.addEventListener('dragend', () => layerEl.classList.remove('is-dragging'));
      layerEl.addEventListener('dragover', (event) => {
        if (event.dataTransfer.types.includes('application/x-pix2-node')) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          layerEl.classList.add('is-drop-target');
        }
      });
      layerEl.addEventListener('dragleave', () => layerEl.classList.remove('is-drop-target'));
      layerEl.addEventListener('drop', (event) => {
        event.preventDefault();
        layerEl.classList.remove('is-drop-target');
        const sourceId = event.dataTransfer.getData('application/x-pix2-node');
        if (!sourceId || sourceId === layer.id || !_StructureOps) return;
        prepareStructureMutation();
        const targetIndex = cell.layers.indexOf(layer);
        const result = _StructureOps.moveNode(cell, sourceId, null, targetIndex);
        if (!result.ok) return;
        commitStructureMutation();
        showToast(`Reordered layer: ${result.node.name || result.node.id}`);
      });

      const header = document.createElement('div');
      header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 11.5px;';

      const nameRow = document.createElement('div');
      nameRow.style.cssText = 'display: flex; align-items: center; gap: 6px; font-weight: 600; cursor: pointer;';
      nameRow.innerHTML = `<i class="fa-solid fa-layer-group text-accent"></i> <span>${escapeHtml(layer.name || layer.id)}</span>`;
      nameRow.addEventListener('click', () => {
        state.activeLayerId = layer.id;
        const findEditableRegion = (nodes) => {
          for (const node of nodes || []) {
            if (node.visible === false || node.locked) continue;
            if (node.type === 'region') return node;
            const nested = findEditableRegion(node.children);
            if (nested) return nested;
          }
          return null;
        };
        const region = findEditableRegion(layer.children);
        state.activeRegionId = region ? region.id : null;
        renderPaLayersTree();
      });
      // Layer context menu
      nameRow.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showLayerContextMenu(e.clientX, e.clientY, layer, cell);
      });

      const actionsRow = document.createElement('div');
      actionsRow.style.cssText = 'display: flex; align-items: center; gap: 4px;';

      const visBtn = document.createElement('button');
      visBtn.className = 'pa-btn-icon-xs';
      visBtn.innerHTML = layer.visible !== false ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash" style="opacity:0.4;"></i>';
      visBtn.title = layer.visible !== false ? 'Hide Layer' : 'Show Layer';
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        prepareStructureMutation();
        layer.visible = layer.visible === false;
        commitStructureMutation();
      });
      actionsRow.appendChild(visBtn);

      const lockBtn = document.createElement('button');
      lockBtn.className = 'pa-btn-icon-xs';
      lockBtn.innerHTML = layer.locked ? '<i class="fa-solid fa-lock text-accent"></i>' : '<i class="fa-solid fa-lock-open" style="opacity:0.4;"></i>';
      lockBtn.title = layer.locked ? 'Unlock Layer' : 'Lock Layer';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        prepareStructureMutation();
        layer.locked = !layer.locked;
        commitStructureMutation();
      });
      actionsRow.appendChild(lockBtn);

      header.appendChild(nameRow);
      header.appendChild(actionsRow);
      layerEl.appendChild(header);

      const childrenCont = document.createElement('div');
      childrenCont.style.cssText = 'display: flex; flex-direction: column; gap: 4px; padding-left: 8px; border-left: 2px solid rgba(99,102,241,0.25); margin-top: 4px;';

      function renderNode(node, depth = 1, parentId = layer.id) {
        if (node.type === 'group') {
          const expanded = isGroupExpanded(node.id);
          const groupEl = document.createElement('div');
          groupEl.className = 'pa-layer-child';

          const groupHeader = document.createElement('div');
          groupHeader.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer;';
          groupHeader.innerHTML = `
            <i class="fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="color: #818cf8; font-size: 9px; width: 12px;"></i>
            <i class="fa-solid fa-folder" style="color: #818cf8; font-size: 10px;"></i>
            <span>${escapeHtml(node.name || node.id)}</span>
          `;
          groupHeader.addEventListener('click', () => {
            toggleGroupExpanded(node.id);
            renderPaLayersTree();
          });
          groupHeader.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showGroupContextMenu(e.clientX, e.clientY, node, cell, layer, parentId);
          });
          groupEl.appendChild(groupHeader);

          if (expanded) {
            const groupChildren = document.createElement('div');
            groupChildren.style.cssText = 'display: flex; flex-direction: column; gap: 4px; padding-left: 12px; border-left: 1px dashed rgba(99,102,241,0.18); margin-top: 2px;';
            (node.children || []).forEach(child => renderNode(child, depth + 1, node.id));
            groupEl.appendChild(groupChildren);
          }

          childrenCont.appendChild(groupEl);
        } else if (node.type === 'region') {
          const itemEl = document.createElement('div');
          const isIsolated = state.isolatedNodeId === node.id;
          const isActive = state.activeRegionId === node.id && state.activeLayerId === layer.id;
          itemEl.className = `pa-layer-child${isIsolated ? ' is-isolated' : ''}${isActive ? ' is-active' : ''}`;

          const itemTitle = document.createElement('div');
          itemTitle.style.cssText = 'display: flex; align-items: center; gap: 6px;';
          itemTitle.innerHTML = `<i class="fa-solid fa-vector-square" style="color: #818cf8; font-size: 10px;"></i> <span>${escapeHtml(node.name || node.id)}</span>`;

          itemEl.appendChild(itemTitle);

          itemEl.addEventListener('click', () => {
            state.activeLayerId = layer.id;
            state.activeRegionId = node.id;
            renderPaLayersTree();
          });

          itemEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            enterIsolationMode(node.id, `${layer.name || layer.id} / ${node.name || node.id}`);
          });

          itemEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showRegionContextMenu(e.clientX, e.clientY, node, cell, layer);
          });

          childrenCont.appendChild(itemEl);
        }
      }

      (layer.children || []).forEach(child => renderNode(child, 1, layer.id));
      layerEl.appendChild(childrenCont);
      container.appendChild(layerEl);
    });
  }

  function commitStructureMutation() {
    rebuildArtworkBuffer();
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
    setDirty(true);
    renderPaLayersTree();
  }

  function prepareStructureMutation() {
    // Structural changes must never snapshot a document while selected pixels
    // are temporarily lifted out of their owning Region.
    if (state.floatingPixels) commitFloatingSelection();
  }

  // ===========================================================================
  // LAYER TREE CONTEXT MENUS (browser-only)
  // ===========================================================================
  let activeContextMenu = null;

  function hideContextMenu() {
    if (typeof document === 'undefined') return;
    if (activeContextMenu) {
      activeContextMenu.remove();
      activeContextMenu = null;
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideContextMenu(); });
  }

  function showContextMenu(x, y, items) {
    if (typeof document === 'undefined') return;
    hideContextMenu();
    const menu = document.createElement('div');
    menu.className = 'pa-context-menu';
    menu.style.cssText = `
      position: fixed; left: ${x}px; top: ${y}px; z-index: 9999;
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: 6px; padding: 4px 0; min-width: 160px; box-shadow: var(--shadow-md);
    `;
    items.forEach(item => {
      if (item === 'separator') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: var(--border-subtle); margin: 4px 8px;';
        menu.appendChild(sep);
        return;
      }
      const btn = document.createElement('button');
      btn.style.cssText = 'width: 100%; text-align: left; padding: 6px 12px; background: none; border: none; color: var(--text-main); font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;';
      btn.innerHTML = `<i class="fa-solid ${item.icon}" style="width: 14px;"></i> ${item.label}`;
      if (item.disabled) btn.style.opacity = '0.4';
      else btn.addEventListener('click', () => { item.action(); hideContextMenu(); });
      btn.addEventListener('mouseenter', () => { if (!item.disabled) btn.style.background = 'var(--bg-card-hover)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      if (r.right > window.innerWidth) menu.style.left = `${window.innerWidth - r.width - 4}px`;
      if (r.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - r.height - 4}px`;
    });
    activeContextMenu = menu;
  }

  function showLayerContextMenu(x, y, layer, cell) {
    showContextMenu(x, y, [
      { label: 'Rename Layer', icon: 'fa-pen-to-square', action: () => {
        const newName = prompt('Rename layer:', layer.name || layer.id);
        if (newName && newName.trim()) {
          prepareStructureMutation();
          layer.name = newName.trim();
          commitStructureMutation();
        }
      }},
      { label: 'Duplicate Layer', icon: 'fa-copy', action: () => {
        prepareStructureMutation();
        const clone = JSON.parse(JSON.stringify(layer));
        clone.id = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        clone.name = (layer.name || 'Layer') + ' Copy';
        function resetIds(node) {
          node.id = node.type + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          (node.children || []).forEach(resetIds);
        }
        (clone.children || []).forEach(resetIds);
        cell.layers.push(clone);
        commitStructureMutation();
      }},
      { label: 'Delete Layer', icon: 'fa-trash', action: () => {
        if (confirm(`Delete layer "${layer.name || layer.id}" and all its contents?`)) {
          prepareStructureMutation();
          const idx = cell.layers.indexOf(layer);
          if (idx !== -1) cell.layers.splice(idx, 1);
          if (state.activeLayerId === layer.id) state.activeLayerId = null;
          if (state.activeRegionId) state.activeRegionId = null;
          commitStructureMutation();
        }
      }},
      { type: 'separator' },
      { label: 'Lock Layer', icon: layer.locked ? 'fa-lock-open' : 'fa-lock', action: () => {
        prepareStructureMutation();
        layer.locked = !layer.locked;
        commitStructureMutation();
      }},
      { label: layer.visible === false ? 'Show Layer' : 'Hide Layer', icon: layer.visible === false ? 'fa-eye' : 'fa-eye-slash', action: () => {
        prepareStructureMutation();
        layer.visible = layer.visible === false;
        commitStructureMutation();
      }},
    ]);
  }

  function showGroupContextMenu(x, y, group, cell, layer, parentId) {
    showContextMenu(x, y, [
      { label: 'Rename Group', icon: 'fa-pen-to-square', action: () => {
        const newName = prompt('Rename group:', group.name || group.id);
        if (newName && newName.trim()) {
          prepareStructureMutation();
          group.name = newName.trim();
          commitStructureMutation();
        }
      }},
      { label: 'Duplicate Group', icon: 'fa-copy', action: () => {
        prepareStructureMutation();
        const clone = JSON.parse(JSON.stringify(group));
        clone.id = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        clone.name = (group.name || 'Group') + ' Copy';
        function resetIds(node) {
          node.id = node.type + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          (node.children || []).forEach(resetIds);
        }
        (clone.children || []).forEach(resetIds);
        const parent = parentId === layer.id ? layer : findNodeById(cell, parentId);
        if (parent && parent.children) parent.children.push(clone);
        commitStructureMutation();
      }},
      { label: 'Delete Group', icon: 'fa-trash', action: () => {
        if (confirm(`Delete group "${group.name || group.id}" and all its contents?`)) {
          prepareStructureMutation();
          const parent = parentId === layer.id ? layer : findNodeById(cell, parentId);
          if (parent && parent.children) {
            const idx = parent.children.indexOf(group);
            if (idx !== -1) parent.children.splice(idx, 1);
          }
          commitStructureMutation();
        }
      }},
      { type: 'separator' },
      { label: 'Add Region to Group', icon: 'fa-vector-square', action: () => {
        prepareStructureMutation();
        const newRegion = { type: 'region', id: 'region_' + Date.now(), cell: cell.id, parent: group.id, name: 'New Region', tags: [], visible: true, locked: false, pixels: {}, primitives: [] };
        if (!group.children) group.children = [];
        group.children.push(newRegion);
        commitStructureMutation();
      }},
      { label: 'Add Sub-Group', icon: 'fa-folder-plus', action: () => {
        prepareStructureMutation();
        const newGroup = { type: 'group', id: 'group_' + Date.now(), cell: cell.id, parent: group.id, name: 'New Group', children: [] };
        if (!group.children) group.children = [];
        group.children.push(newGroup);
        commitStructureMutation();
      }},
    ]);
  }

  function showRegionContextMenu(x, y, region, cell, layer) {
    showContextMenu(x, y, [
      { label: 'Rename Region', icon: 'fa-pen-to-square', action: () => {
        const newName = prompt('Rename region:', region.name || region.id);
        if (newName && newName.trim()) {
          prepareStructureMutation();
          region.name = newName.trim();
          commitStructureMutation();
        }
      }},
      { label: 'Duplicate Region', icon: 'fa-copy', action: () => {
        prepareStructureMutation();
        const clone = JSON.parse(JSON.stringify(region));
        clone.id = 'region_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        clone.name = (region.name || 'Region') + ' Copy';
        if (!layer.children) layer.children = [];
        layer.children.push(clone);
        commitStructureMutation();
      }},
      { label: 'Delete Region', icon: 'fa-trash', action: () => {
        if (confirm(`Delete region "${region.name || region.id}"?`)) {
          prepareStructureMutation();
          const idx = layer.children.indexOf(region);
          if (idx !== -1) layer.children.splice(idx, 1);
          if (state.activeRegionId === region.id) state.activeRegionId = null;
          commitStructureMutation();
        }
      }},
      { type: 'separator' },
      { label: 'Select Content', icon: 'fa-mouse-pointer', action: () => {
        if (region.pixels && Object.keys(region.pixels).length) {
          prepareStructureMutation();
          const bounds = getRegionBounds(region);
          state.selection = bounds;
          state.activeLayerId = layer.id;
          state.activeRegionId = region.id;
          ensureFloatingSelection();
          commitStructureMutation();
        }
      }},
      { label: 'Extract to New Region', icon: 'fa-arrow-right-from-bracket', action: () => {
        prepareStructureMutation();
        const newRegion = { type: 'region', id: 'region_' + Date.now(), cell: cell.id, parent: layer.id, name: region.name + ' Extracted', tags: [], visible: true, locked: false, pixels: { ...region.pixels }, primitives: [] };
        layer.children.push(newRegion);
        commitStructureMutation();
      }},
      { type: 'separator' },
      { label: 'Lock Region', icon: region.locked ? 'fa-lock-open' : 'fa-lock', action: () => {
        prepareStructureMutation();
        region.locked = !region.locked;
        commitStructureMutation();
      }},
      { label: region.visible === false ? 'Show Region' : 'Hide Region', icon: region.visible === false ? 'fa-eye' : 'fa-eye-slash', action: () => {
        prepareStructureMutation();
        region.visible = region.visible === false;
        commitStructureMutation();
      }},
    ]);
  }

  function findNodeById(cell, id) {
    if (!cell.layers) return null;
    for (const layer of cell.layers) {
      if (layer.id === id) return layer;
      function search(nodes) {
        for (const n of nodes || []) {
          if (n.id === id) return n;
          if (n.type === 'group') {
            const found = search(n.children);
            if (found) return found;
          }
        }
        return null;
      }
      const found = search(layer.children);
      if (found) return found;
    }
    return null;
  }

  function getRegionBounds(region) {
    if (!region.pixels) return { x: 0, y: 0, w: 1, h: 1 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const key in region.pixels) {
      const comma = key.indexOf(',');
      const x = parseInt(key.substring(0, comma), 10);
      const y = parseInt(key.substring(comma + 1), 10);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  // DOM Elements Cache
  const dom = {};

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================
  async function init() {
    cacheDom();
    initTheme();
    initPanelWidth();
    bindEvents();

    if (dom.codeEditor) {
      dom.codeEditor.readOnly = true;
    }

    let documentRestored = false;
    let autosavePayload = await retrieveAutosaveFromStorage();
    if (!recoveryPayloadHasDocument(autosavePayload)) {
      autosavePayload = null;
    }

    // 0. Check for restorable pre-reload backup from previous session
    try {
      const preBackup = await getPreReloadBackup();
      if (recoveryPayloadHasDocument(preBackup)) {
        if (dom.recoveryBanner) {
          if (dom.recoveryMsg) {
            const timeStr = preBackup.time ? new Date(preBackup.time).toLocaleTimeString() : 'previous session';
            const count = Object.keys(preBackup.pixels || {}).length;
            const detail = preBackup.documentSource ? 'full structured document' : `${count} pixels`;
            dom.recoveryMsg.textContent = `Pre-reload backup found from ${timeStr} (${detail}).`;
          }
          dom.recoveryBanner.classList.remove('hidden');
        }
      }
    } catch (_) {}

    // 1. Check for persisted physical file handle in IndexedDB
    try {
      const persisted = await retrievePersistedFileHandle();
      if (persisted) {
        currentFileHandle = persisted;
        currentFileName = persisted.name;
        state.title = persisted.name.replace(/\.[^/.]+$/, '');
        if (dom.docTitle) dom.docTitle.value = state.title;

        // Establish disk baseline first!
        let diskText = '';
        let diskModified = 0;
        try {
          const file = await persisted.getFile();
          diskModified = file.lastModified;
          diskText = await file.text();
          lastKnownFileModified = diskModified;
          lastSavedContent = diskText;
          state.lastFileModified = diskModified;
        } catch (handleErr) {
          console.warn('Could not read persisted file handle directly:', handleErr);
        }

        const diskHash = hashString(normalizeForCompare(diskText));
        const autosaveHasUnsavedEdits = autosavePayload && (
          autosavePayload.isDirty === true ||
          (autosavePayload.revision !== undefined && autosavePayload.lastSavedRevision !== undefined && autosavePayload.revision !== autosavePayload.lastSavedRevision)
        );
        const autosaveMatchesDiskBaseline = autosavePayload && (!autosavePayload.baseContentHash || autosavePayload.baseContentHash === diskHash);

        // If autosave has unsaved edits and disk has not drifted, recover autosave:
        if (autosaveHasUnsavedEdits && autosaveMatchesDiskBaseline) {
          const recovered = installRecoveryPayload(autosavePayload);
          if (!recovered) throw new Error('Autosave did not contain a recoverable document');
          const cell = recovered.cell;
          rebuildArtworkBuffer();
          repaintCanvas();
          syncCanvasToSource();
          documentRestored = true;
          state.title = persisted.name.replace(/\.[^/.]+$/, '');
          if (dom.docTitle) dom.docTitle.value = state.title;
          updateDocumentTitle();
          documentRevision = autosavePayload.revision || 1;
          lastSavedRevision = autosavePayload.lastSavedRevision || 0;
          setDirty(true);
          showToast(`Restored unsaved session changes (${Object.keys(cell.pixels).length} pixels)`, 'info');
        } else if (diskText && diskText.trim()) {
          // Read directly from disk handle
          dom.codeEditor.value = diskText;
          const ok = applySourceCodeToCanvas();
          if (ok) {
            documentRestored = true;
            pendingExternalConflict = null;
            setDirty(false);
          }
        }
      }
    } catch (_) {}

    // 2. Fallback: If handle could not be read directly, check last saved disk content in localStorage
    if (!documentRestored && currentFileName) {
      const lastSavedText = _storage.getItem('pix2_last_saved_content');
      if (lastSavedText && lastSavedText.trim()) {
        try {
          dom.codeEditor.value = lastSavedText;
          const ok = applySourceCodeToCanvas();
          if (ok) {
            documentRestored = true;
            // Unverified localStorage cache must NOT be set as authoritative disk baseline.
            // Baseline remains uninitialized (0 / '') until the physical file handle is verified.
            lastSavedContent = '';
            lastKnownFileModified = 0;
            setDirty(true);
          }
        } catch (_) {}
      }
    }

    // 3. Fallback: Check for crash recovery / autosave if no disk file was restored
    if (!documentRestored && autosavePayload) {
      try {
        const recovered = installRecoveryPayload(autosavePayload);
        if (recovered) {
          const cell = recovered.cell;
          rebuildArtworkBuffer();
          repaintCanvas();
          syncCanvasToSource();
          documentRestored = true;
          documentRevision = autosavePayload.revision || 1;
          lastSavedRevision = autosavePayload.lastSavedRevision || 0;
          setDirty(documentRevision !== lastSavedRevision);
          const recoveryKind = recovered.legacy ? `${Object.keys(cell.pixels || {}).length} legacy pixels` : 'full structured document';
          showToast(`Recovered artwork from autosave (${recoveryKind})`, 'info');
        }
      } catch (recoveryError) {
        console.warn('Ignoring invalid autosave payload:', recoveryError);
      }
    }

    // 4. Default: Blank canvas if nothing was restored
    if (!documentRestored) {
      createNewDocument(64, 64, 'Pixel Artwork');
    }

    populatePaletteDropdown();
    renderPaletteSwatches();
    updateUi();
    updateCanvasBgUi();
    updateAiPromptView();
    updateDocumentTitle();

    // Initialize PaProjectSession for current document
    if (paProjectSessions.length === 0) {
      const initialSession = new PaProjectSession('pa_initial', state.title || 'Pixel Artwork', state.doc, currentFileHandle, currentFileName);
      initialSession.w = state.w;
      initialSession.h = state.h;
      initialSession.isDirty = state.isDirty;
      initialSession.revision = documentRevision;
      initialSession.lastSavedRevision = lastSavedRevision;
      initialSession.history = [...state.history];
      initialSession.historyIndex = state.historyIndex;
      paProjectSessions.push(initialSession);
      activePaProjectId = initialSession.id;
    }
    renderPaProjectTabs();
    renderPaLayersTree();

    // Responsive Drag & Mouse-Wheel Horizontal Scroll across all horizontal bars
    enableHorizontalDragScroll(document.querySelector('.pa-header'));
    enableHorizontalDragScroll(document.querySelector('.pa-canvas-statusbar'));
    enableHorizontalDragScroll(document.querySelector('.pa-palette-deck'));
    enableHorizontalDragScroll(document.querySelector('.pa-swatches-scroll'));
    enableHorizontalDragScroll(document.querySelector('.pa-code-header'));
    enableHorizontalDragScroll(document.querySelector('.pa-code-statusbar'));
    enableHorizontalDragScroll(document.querySelector('.pa-structure-actions'));

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
      if (e.target.closest('.project-tabs-strip')) return;
      if (['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.target.closest('button, select, input, textarea, [role="button"], .pa-dim-badge, .pa-btn, .pa-icon-btn, .pa-color-slot, .pa-swatch, .pa-preset-chip, .pa-status-btn, .pa-mode-badge, .pa-autosave-pill, .pa-file-path-pill, .pa-file-source-badge, .pa-save-status-badge, .pa-btn-icon-xs, .pa-ai-ratio-btn')) return;
      isDown = true;
      isDragging = false;
      startX = e.clientX;
      startScrollLeft = container.scrollLeft;
      try { container.setPointerCapture(e.pointerId); } catch (_) {}
    });

    container.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) {
        isDragging = true;
        container.classList.add('pa-is-dragging');
      }
      container.scrollLeft = startScrollLeft - dx;
    });

    const stopDrag = (e) => {
      if (isDown) {
        isDown = false;
        container.classList.remove('pa-is-dragging');
        if (e && e.pointerId) {
          try { container.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      }
    };
    container.addEventListener('pointerup', stopDrag);
    container.addEventListener('pointercancel', stopDrag);

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
      try { container.setPointerCapture(e.pointerId); } catch (_) {}
    });

    container.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 3) {
        isDragging = true;
        container.classList.add('pa-is-dragging');
      }
      container.scrollTop = startScrollTop - dy;
    });

    const stopDrag = (e) => {
      if (isDown) {
        isDown = false;
        container.classList.remove('pa-is-dragging');
        if (e && e.pointerId) {
          try { container.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      }
    };
    container.addEventListener('pointerup', stopDrag);
    container.addEventListener('pointercancel', stopDrag);

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

    // Pre-Reload Backup Recovery Banner
    dom.recoveryBanner = document.getElementById('pa-recovery-banner');
    dom.recoveryMsg = document.getElementById('pa-recovery-msg');
    dom.btnRestoreBackup = document.getElementById('btn-restore-backup');
    dom.btnDismissBackup = document.getElementById('btn-dismiss-backup');

    // Canvas
    dom.viewport = document.getElementById('pa-canvas-viewport');
    dom.container = document.getElementById('pa-canvas-container');
    dom.canvasStack = document.getElementById('pa-canvas-stack');
    dom.rulerCorner = document.getElementById('pa-ruler-corner');
    dom.rulerTop = document.getElementById('pa-ruler-top');
    dom.rulerLeft = document.getElementById('pa-ruler-left');
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
    dom.btnToggleRulers = document.getElementById('btn-toggle-rulers');
    dom.btnBgTransparent = document.getElementById('btn-bg-transparent');
    dom.btnBgWhite = document.getElementById('btn-bg-white');
    dom.btnBgBlack = document.getElementById('btn-bg-black');
    dom.btnBgCustom = document.getElementById('btn-bg-custom');
    dom.bgCustomInput = document.getElementById('pa-bg-custom-input');
    dom.bgCustomChip = document.getElementById('pa-bg-custom-chip');
    dom.bgCustomLabel = document.getElementById('pa-bg-custom-label');
    dom.exportIncludeBg = document.getElementById('pa-export-include-bg');

    // Alignment Guide Buttons
    dom.btnToggleGuideCenter = document.getElementById('btn-toggle-guide-center');
    dom.btnToggleGuideV = document.getElementById('btn-toggle-guide-v');
    dom.btnToggleGuideH = document.getElementById('btn-toggle-guide-h');

    // Splitter & Source Code Pane
    dom.splitResizer = document.getElementById('pa-split-resizer');
    dom.codePane = document.getElementById('pa-code-pane');
    dom.codeHeader = document.getElementById('pa-code-header');
    dom.codeEditor = document.getElementById('pa-code-editor');
    dom.codeGutter = document.getElementById('pa-code-gutter');
    dom.syncBadge = document.getElementById('pa-sync-badge');
    dom.codeModeBadge = document.getElementById('pa-code-mode-badge');
    dom.btnToggleCodeLock = document.getElementById('btn-toggle-code-lock');
    dom.btnApplyCode = document.getElementById('btn-apply-code');
    dom.codeLinesCount = document.getElementById('pa-code-lines-count');
    dom.codePixelsCount = document.getElementById('pa-code-pixels-count');
    dom.diagnosticPill = document.getElementById('pa-diagnostic-pill');

    // Multi-Document Project Tabs & Structure Panel (PIX2 1.1)
    dom.paProjectTabsStrip = document.getElementById('pa-project-tabs-strip');
    dom.btnPaProjectNewTab = document.getElementById('pa-btn-project-new-tab');
    if (dom.btnPaProjectNewTab) {
      dom.btnPaProjectNewTab.addEventListener('click', () => {
        if (dom.modalNew) dom.modalNew.classList.remove('hidden');
      });
    }
    dom.btnPaSideLayers = document.getElementById('btn-pa-side-layers');
    dom.btnPaSideCode = document.getElementById('btn-pa-side-code');
    dom.paLayersView = document.getElementById('pa-layers-view');
    dom.paCodeBody = document.getElementById('pa-code-body');
    dom.paLayersTree = document.getElementById('pa-layers-tree');
    dom.btnPaAddLayer = document.getElementById('btn-pa-add-layer');
    dom.btnPaAddGroup = document.getElementById('btn-pa-add-group');
    dom.btnPaAddRegion = document.getElementById('btn-pa-add-region');
    dom.paIsolationBanner = document.getElementById('pa-isolation-banner');
    dom.paIsolationBreadcrumb = document.getElementById('pa-isolation-breadcrumb');
    dom.btnPaExitIsolation = document.getElementById('btn-pa-exit-isolation');
    dom.btnPaToolRegionSelect = document.getElementById('btn-pa-tool-region-select');
    dom.paAppVersionBadge = document.getElementById('pa-app-version-badge');
    dom.modalAboutPa = document.getElementById('modal-about-pa');

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
    dom.modalResize = document.getElementById('modal-resize-canvas');
    dom.inputResizeW = document.getElementById('input-resize-w');
    dom.inputResizeH = document.getElementById('input-resize-h');
    dom.btnConfirmResizeCanvas = document.getElementById('btn-confirm-resize-canvas');
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
    const doc = _PIX2.createDocument(state.title, 1, 1, state.w, state.h, { profile: 'pixelart' });
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

    if (dom && dom.dimBadge) dom.dimBadge.textContent = `${state.w}×${state.h}`;
    if (dom && dom.docTitle) dom.docTitle.value = state.title;

    resizeCanvasesToZoom();
    rebuildArtworkBuffer();
    repaintCanvas();
    renderRulers();
    syncCanvasToSource();
    triggerAutosave();

    if (typeof paProjectSessions !== 'undefined' && activePaProjectId) {
      const cur = paProjectSessions.find(p => p.id === activePaProjectId);
      if (cur) {
        cur.title = state.title;
        cur.doc = state.doc;
        cur.w = state.w;
        cur.h = state.h;
        cur.fileName = `${state.title}.pix2`;
        cur.fileHandle = null;
        cur.isDirty = false;
        cur.history = [...state.history];
        cur.historyIndex = state.historyIndex;
        cur.isolatedNodeId = null;
        renderPaProjectTabs();
      }
    }
  }

  function getArtworkCell() {
    if (!state.doc || !state.doc.cells) return null;
    if (state.doc.cells.artwork) return state.doc.cells.artwork;
    const firstKey = Object.keys(state.doc.cells)[0];
    return firstKey ? state.doc.cells[firstKey] : null;
  }

  /**
   * Returns the node that editing commands are allowed to mutate.  PIX2 1.1
   * documents store source pixels in their layer tree; cell.pixels is only a
   * composited render cache and must never be the write target in that case.
   */
  function getActiveEditingTarget(cell = getArtworkCell(), explicitTargetId = null) {
    if (!cell) return null;
    if (!cell.layers || cell.layers.length === 0) return cell;
    if (_StructureOps && typeof _StructureOps.normalizeRasterOwnership === 'function') {
      _StructureOps.normalizeRasterOwnership(cell);
    }
    if (!_Tools || typeof _Tools.getTargetForPlot !== 'function') return null;
    return _Tools.getTargetForPlot(
      cell,
      explicitTargetId || state.isolatedNodeId || state.activeRegionId || state.activeLayerId || null
    );
  }

  // Once a floating selection has lifted pixels, retain its original target
  // even if the user clicks another layer before committing or pressing Esc.
  function getFloatingSelectionTarget(cell = getArtworkCell()) {
    if (!cell) return null;
    if (!cell.layers || cell.layers.length === 0) return cell;
    return state.floatingTargetId ? findNodeById(cell, state.floatingTargetId) : getActiveEditingTarget(cell);
  }

  // ===========================================================================
  // HARDWARE-ACCELERATED 1:1 OFFSCREEN TEXTURE BUFFERS
  // ===========================================================================
  function rebuildArtworkBuffer() {
    if (typeof document === 'undefined') return;
    if (!state.artworkCanvas) {
      state.artworkCanvas = document.createElement('canvas');
      state.artworkCtx = state.artworkCanvas.getContext('2d');
    }
    if (state.artworkCanvas.width !== state.w || state.artworkCanvas.height !== state.h) {
      state.artworkCanvas.width = state.w;
      state.artworkCanvas.height = state.h;
    }
    const actx = state.artworkCtx;
    actx.clearRect(0, 0, state.w, state.h);
    const cell = getArtworkCell();
    if (!cell) return;

    if (_StructureOps && typeof _StructureOps.normalizeRasterOwnership === 'function') {
      const normalization = _StructureOps.normalizeRasterOwnership(cell);
      if (normalization.changed && !state.activeRegionId && normalization.createdRegionIds.length) {
        state.activeRegionId = normalization.createdRegionIds[0];
      }
    }

    if (cell.layers && cell.layers.length > 0 && typeof PIX2 !== 'undefined' && typeof PIX2.compositeCellLayers === 'function') {
      cell.pixels = PIX2.compositeCellLayers(cell, { w: state.w, h: state.h });
    }

    if (cell.pixels) {
      if (state.isolatedNodeId && cell.layers && cell.layers.length > 0) {
        const isoNode = findNodeById(cell, state.isolatedNodeId);
        const isoPixels = {};
        if (isoNode) {
          const collect = (n) => {
            if (n.type === 'region' && n.pixels) {
              for (const k in n.pixels) isoPixels[k] = n.pixels[k];
            }
            if (n.children) n.children.forEach(collect);
          };
          collect(isoNode);
        }

        // Draw non-isolated pixels with 0.22 dimming
        actx.save();
        actx.globalAlpha = 0.22;
        for (const key in cell.pixels) {
          if (!isoPixels[key]) {
            const commaIdx = key.indexOf(',');
            if (commaIdx === -1) continue;
            const px = Number(key.substring(0, commaIdx));
            const py = Number(key.substring(commaIdx + 1));
            const color = cell.pixels[key];
            if (px >= 0 && px < state.w && py >= 0 && py < state.h && color) {
              actx.fillStyle = color;
              actx.fillRect(px, py, 1, 1);
            }
          }
        }
        actx.restore();

        // Draw isolated pixels at full opacity 1.0
        for (const key in isoPixels) {
          const commaIdx = key.indexOf(',');
          if (commaIdx === -1) continue;
          const px = Number(key.substring(0, commaIdx));
          const py = Number(key.substring(commaIdx + 1));
          const color = isoPixels[key];
          if (px >= 0 && px < state.w && py >= 0 && py < state.h && color) {
            actx.fillStyle = color;
            actx.fillRect(px, py, 1, 1);
          }
        }
      } else {
        for (const key in cell.pixels) {
          const commaIdx = key.indexOf(',');
          if (commaIdx === -1) continue;
          const px = Number(key.substring(0, commaIdx));
          const py = Number(key.substring(commaIdx + 1));
          const color = cell.pixels[key];
          if (px >= 0 && px < state.w && py >= 0 && py < state.h && color) {
            actx.fillStyle = color;
            actx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
  }

  function plotPixelOnBuffer(px, py, color) {
    if (!state.artworkCtx) return;
    if (px < 0 || px >= state.w || py < 0 || py >= state.h) return;
    if (color === null) {
      state.artworkCtx.clearRect(px, py, 1, 1);
    } else {
      state.artworkCtx.fillStyle = color;
      state.artworkCtx.fillRect(px, py, 1, 1);
    }
  }

  function rebuildFloatingBuffer() {
    if (!state.floatingPixels || !state.selection) {
      state.floatingCanvas = null;
      state.floatingCtx = null;
      return;
    }
    // This cache is only for rendering; selection state must remain usable in
    // the Node test/runtime path where no Canvas/DOM exists.
    if (typeof document === 'undefined') return;
    const w = state.selection.w;
    const h = state.selection.h;
    if (!state.floatingCanvas) {
      state.floatingCanvas = document.createElement('canvas');
      state.floatingCtx = state.floatingCanvas.getContext('2d');
    }
    if (state.floatingCanvas.width !== w || state.floatingCanvas.height !== h) {
      state.floatingCanvas.width = w;
      state.floatingCanvas.height = h;
    }
    const fctx = state.floatingCtx;
    fctx.clearRect(0, 0, w, h);
    for (const relKey in state.floatingPixels) {
      const commaIdx = relKey.indexOf(',');
      if (commaIdx === -1) continue;
      const rx = Number(relKey.substring(0, commaIdx));
      const ry = Number(relKey.substring(commaIdx + 1));
      const col = state.floatingPixels[relKey];
      if (rx >= 0 && rx < w && ry >= 0 && ry < h && col) {
        fctx.fillStyle = col;
        fctx.fillRect(rx, ry, 1, 1);
      }
    }
  }

  let repaintRafId = null;
  function requestCanvasRepaint() {
    if (typeof requestAnimationFrame === 'undefined') {
      repaintCanvas();
      return;
    }
    if (repaintRafId !== null) return;
    repaintRafId = requestAnimationFrame(() => {
      repaintRafId = null;
      repaintCanvas();
    });
  }

  // ===========================================================================
  // CANVAS RENDERING & HIGH PRECISION GRID
  // ===========================================================================
  function resizeCanvasesToZoom() {
    // Phase 1 Finding A: Defensive Adaptive Zoom Clamping Guard
    const maxAllowedZoom = getMaxAllowedZoom();
    if (state.zoom > maxAllowedZoom) {
      state.zoom = maxAllowedZoom;
    }
    if (!dom || !dom.canvasMain) return;

    const totalW = Math.max(1, Math.round(state.w * state.zoom));
    const totalH = Math.max(1, Math.round(state.h * state.zoom));

    // Defensive canvas backing buffer allocation with safe fallback
    try {
      if (dom.canvasMain.width !== totalW) dom.canvasMain.width = totalW;
      if (dom.canvasMain.height !== totalH) dom.canvasMain.height = totalH;
      if (dom.canvasPreview.width !== totalW) dom.canvasPreview.width = totalW;
      if (dom.canvasPreview.height !== totalH) dom.canvasPreview.height = totalH;
    } catch (e) {
      console.warn('Canvas allocation failed, falling back to safe zoom:', e);
      state.zoom = Math.max(1, Math.floor(4096 / Math.max(state.w, state.h)));
      const safeW = Math.max(1, Math.round(state.w * state.zoom));
      const safeH = Math.max(1, Math.round(state.h * state.zoom));
      dom.canvasMain.width = safeW;
      dom.canvasMain.height = safeH;
      dom.canvasPreview.width = safeW;
      dom.canvasPreview.height = safeH;
    }

    const rulerOffset = state.showRulers ? 24 : 0;
    if (dom.container) {
      dom.container.classList.toggle('hide-rulers', !state.showRulers);
      dom.container.style.width = `${totalW + rulerOffset}px`;
      dom.container.style.height = `${totalH + rulerOffset}px`;
    }
    if (dom.canvasStack) {
      dom.canvasStack.style.width = `${totalW}px`;
      dom.canvasStack.style.height = `${totalH}px`;
    }
    dom.canvasMain.style.width = `${totalW}px`;
    dom.canvasMain.style.height = `${totalH}px`;
    dom.canvasPreview.style.width = `${totalW}px`;
    dom.canvasPreview.style.height = `${totalH}px`;

    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    if (dom.rulerTop) {
      const rw = Math.min(16384, Math.round(totalW * dpr));
      const rh = Math.round(24 * dpr);
      if (dom.rulerTop.width !== rw) dom.rulerTop.width = rw;
      if (dom.rulerTop.height !== rh) dom.rulerTop.height = rh;
      dom.rulerTop.style.width = `${totalW}px`;
      dom.rulerTop.style.height = '24px';
    }
    if (dom.rulerLeft) {
      const rw = Math.round(24 * dpr);
      const rh = Math.min(16384, Math.round(totalH * dpr));
      if (dom.rulerLeft.width !== rw) dom.rulerLeft.width = rw;
      if (dom.rulerLeft.height !== rh) dom.rulerLeft.height = rh;
      dom.rulerLeft.style.width = '24px';
      dom.rulerLeft.style.height = `${totalH}px`;
    }
    if (dom.btnToggleRulers) dom.btnToggleRulers.classList.toggle('active', state.showRulers);
    updateContainerTransform();
  }

  function getVisibleCanvasBounds() {
    const zoom = state.zoom;
    if (!dom.canvasMain || !dom.viewport) {
      return { minX: 0, maxX: state.w, minY: 0, maxY: state.h };
    }

    // At low zoom (<= 2x), always render the full canvas for 100% complete overview without culling
    if (zoom <= 2) {
      return { minX: 0, maxX: state.w, minY: 0, maxY: state.h };
    }

    const cRect = dom.canvasMain.getBoundingClientRect();
    const vRect = dom.viewport.getBoundingClientRect();

    if (cRect.width <= 0 || cRect.height <= 0 || vRect.width <= 0 || vRect.height <= 0) {
      return { minX: 0, maxX: state.w, minY: 0, maxY: state.h };
    }

    // Canvas position relative to viewport (in screen pixels)
    const canvasLeftInVp = cRect.left - vRect.left;
    const canvasTopInVp = cRect.top - vRect.top;

    // Viewport window mapped into canvas coordinates
    // Generous pad margin (300px) ensures rapid panning / wheel zooming never shows blank edges
    const pad = 300;
    const vpLeftOnCanvas = -canvasLeftInVp - pad;
    const vpTopOnCanvas = -canvasTopInVp - pad;
    const vpRightOnCanvas = -canvasLeftInVp + vRect.width + pad;
    const vpBottomOnCanvas = -canvasTopInVp + vRect.height + pad;

    const minX = Math.max(0, Math.floor(vpLeftOnCanvas / zoom));
    const maxX = Math.min(state.w, Math.ceil(vpRightOnCanvas / zoom));
    const minY = Math.max(0, Math.floor(vpTopOnCanvas / zoom));
    const maxY = Math.min(state.h, Math.ceil(vpBottomOnCanvas / zoom));

    return { minX, maxX, minY, maxY };
  }

  function repaintCanvas() {
    if (!dom || !dom.ctxMain) return;
    const ctx = dom.ctxMain;
    const zoom = state.zoom;
    const totalW = Math.max(1, Math.round(state.w * zoom));
    const totalH = Math.max(1, Math.round(state.h * zoom));

    // Frustum Culling: Calculate visible bounds to skip 95%+ of off-screen work
    const { minX, maxX, minY, maxY } = getVisibleCanvasBounds();

    const renderX = Math.max(0, Math.floor(minX * zoom));
    const renderY = Math.max(0, Math.floor(minY * zoom));
    const renderW = Math.min(totalW - renderX, Math.ceil((maxX - minX + 1) * zoom));
    const renderH = Math.min(totalH - renderY, Math.ceil((maxY - minY + 1) * zoom));

    if (renderW <= 0 || renderH <= 0) return;

    ctx.clearRect(renderX, renderY, renderW, renderH);

    // 1. Canvas Background (Visible region only)
    if (state.canvasBgMode === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(renderX, renderY, renderW, renderH);
    } else if (state.canvasBgMode === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(renderX, renderY, renderW, renderH);
    } else if (state.canvasBgMode === 'custom') {
      ctx.fillStyle = state.canvasBgColor || '#2a2e3f';
      ctx.fillRect(renderX, renderY, renderW, renderH);
    } else {
      // 'transparent' default: Cached 1:1 Pixel-Aligned Checkerboard Pattern
      const isDark = document.body.classList.contains('dark-theme');
      const tileCanvasSize = zoom >= 4 ? Math.max(1, Math.round(zoom)) : (zoom <= 1 ? 16 : Math.round(8 * zoom));
      const pattern = getCheckerPattern(ctx, tileCanvasSize, isDark);
      ctx.fillStyle = pattern;
      ctx.fillRect(renderX, renderY, renderW, renderH);
    }

    // 2. Render visible artwork slice via GPU nearest-neighbor blit
    if (!state.artworkCanvas) {
      rebuildArtworkBuffer();
    }
    if (state.artworkCanvas) {
      const sX = minX;
      const sY = minY;
      const sW = Math.min(state.w - sX, maxX - minX + 1);
      const sH = Math.min(state.h - sY, maxY - minY + 1);
      const dX = Math.floor(sX * zoom);
      const dY = Math.floor(sY * zoom);
      const dW = Math.round(sW * zoom);
      const dH = Math.round(sH * zoom);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(state.artworkCanvas, sX, sY, sW, sH, dX, dY, dW, dH);
    }

    // 3. Razor-Sharp Pixel Grid Overlay (Active at zoom >= 4, strictly visible lines)
    if (state.showGrid && zoom >= 4) {
      let isDarkBg = document.body.classList.contains('dark-theme');
      if (state.canvasBgMode === 'black') {
        isDarkBg = true;
      } else if (state.canvasBgMode === 'white') {
        isDarkBg = false;
      } else if (state.canvasBgMode === 'custom') {
        isDarkBg = isColorDark(state.canvasBgColor);
      }
      ctx.strokeStyle = isDarkBg ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      const startY = renderY;
      const endY = renderY + renderH;
      const startX = renderX;
      const endX = renderX + renderW;

      // Vertical visible lines with +0.5 pixel-crisp alignment
      for (let x = minX; x <= maxX; x++) {
        const posX = Math.floor(x * zoom) + 0.5;
        ctx.moveTo(posX, startY);
        ctx.lineTo(posX, endY);
      }

      // Horizontal visible lines
      for (let y = minY; y <= maxY; y++) {
        const posY = Math.floor(y * zoom) + 0.5;
        ctx.moveTo(startX, posY);
        ctx.lineTo(endX, posY);
      }
      ctx.stroke();
    }

    // 4. Bilateral Symmetry Axis Guidelines
    if (state.symH) {
      const axisX = Math.floor((state.w / 2) * zoom) + 0.5;
      if (axisX >= renderX && axisX <= renderX + renderW) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(axisX, renderY);
        ctx.lineTo(axisX, renderY + renderH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (state.symV) {
      const axisY = Math.floor((state.h / 2) * zoom) + 0.5;
      if (axisY >= renderY && axisY <= renderY + renderH) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(renderX, axisY);
        ctx.lineTo(renderX + renderW, axisY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 5. Alignment Guidelines (Vertical, Horizontal, Center Axis)
    if (state.guideCenter || state.guideV) {
      const gX = Math.floor((state.w / 2) * zoom) + 0.5;
      if (gX >= renderX && gX <= renderX + renderW) {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(gX, renderY);
        ctx.lineTo(gX, renderY + renderH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (state.guideCenter || state.guideH) {
      const gY = Math.floor((state.h / 2) * zoom) + 0.5;
      if (gY >= renderY && gY <= renderY + renderH) {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(renderX, gY);
        ctx.lineTo(renderX + renderW, gY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (state.guideCenter) {
      const cX = Math.floor((state.w / 2) * zoom);
      const cY = Math.floor((state.h / 2) * zoom);
      if (cX >= renderX - 20 && cX <= renderX + renderW + 20 && cY >= renderY - 20 && cY <= renderY + renderH + 20) {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cX + 0.5, cY + 0.5, Math.min(8, Math.max(3, zoom / 2)), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    renderSelectionMarquee();
    updateContainerTransform();
  }

  // ===========================================================================
  // CANVAS RULERS & ADAPTIVE PIXEL TICKS (Canvas 2D Accelerated)
  // ===========================================================================
  let rulerStaticTop = null;
  let rulerStaticLeft = null;

  function invalidateRulerCache() {
    rulerStaticTop = null;
    rulerStaticLeft = null;
  }

  function renderRulers() {
    if (!dom.rulerTop || !dom.rulerLeft) return;

    if (!state.showRulers) {
      if (dom.container) dom.container.classList.add('hide-rulers');
      if (dom.btnToggleRulers) dom.btnToggleRulers.classList.remove('active');
      return;
    }

    if (dom.container) dom.container.classList.remove('hide-rulers');
    if (dom.btnToggleRulers) dom.btnToggleRulers.classList.add('active');

    const ctxT = dom.rulerTop.getContext('2d');
    const ctxL = dom.rulerLeft.getContext('2d');
    if (!ctxT || !ctxL) return;

    const zoom = state.zoom;
    const cw = state.w;
    const ch = state.h;
    const totalW = Math.max(1, Math.round(cw * zoom));
    const totalH = Math.max(1, Math.round(ch * zoom));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Create or resize offscreen static caches to avoid rebuilding ticks on every mousemove
    if (typeof document !== 'undefined') {
      if (!rulerStaticTop) rulerStaticTop = document.createElement('canvas');
      if (!rulerStaticLeft) rulerStaticLeft = document.createElement('canvas');

      const rwT = Math.min(16384, Math.round(totalW * dpr));
      const rhT = Math.round(24 * dpr);
      if (rulerStaticTop.width !== rwT) rulerStaticTop.width = rwT;
      if (rulerStaticTop.height !== rhT) rulerStaticTop.height = rhT;

      const rwL = Math.round(24 * dpr);
      const rhL = Math.min(16384, Math.round(totalH * dpr));
      if (rulerStaticLeft.width !== rwL) rulerStaticLeft.width = rwL;
      if (rulerStaticLeft.height !== rhL) rulerStaticLeft.height = rhL;
    }

    const sCtxT = rulerStaticTop ? rulerStaticTop.getContext('2d') : ctxT;
    const sCtxL = rulerStaticLeft ? rulerStaticLeft.getContext('2d') : ctxL;

    if (sCtxT) sCtxT.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (sCtxL) sCtxL.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isDark = typeof document !== 'undefined' && document.body && document.body.classList.contains('dark-theme');
    const bgColor = isDark ? '#141722' : '#f8fafc';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const tickColor = isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(100, 116, 139, 0.45)';
    const subTickColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(100, 116, 139, 0.18)';

    // Choose adaptive interval: 1, 2, 4, 8, 16, 32, 64, 128, 256, 512
    // Minimum text spacing is 40px so numbers like "1023" never overlap
    const minTextPx = 40;
    let interval = 1;
    const allowedSteps = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
    for (const s of allowedSteps) {
      if (s * zoom >= minTextPx) {
        interval = s;
        break;
      }
      interval = s;
    }
    state._rulerInterval = interval;

    const { minX, maxX, minY, maxY } = getVisibleCanvasBounds();
    const startX = Math.max(0, Math.floor((minX - interval) / interval) * interval);
    const endX = Math.min(cw, Math.ceil((maxX + interval) / interval) * interval);

    // 1. RENDER TOP RULER (STATIC BASELINE)
    if (sCtxT) {
      sCtxT.fillStyle = bgColor;
      sCtxT.fillRect(0, 0, totalW, 24);

      sCtxT.font = '9px "JetBrains Mono", monospace';
      sCtxT.textBaseline = 'top';

      // Sub-pixel tick marks when zoom >= 6
      if (zoom >= 6) {
        sCtxT.strokeStyle = subTickColor;
        sCtxT.lineWidth = 1;
        sCtxT.beginPath();
        const subStart = Math.max(0, minX - 2);
        const subEnd = Math.min(cw, maxX + 2);
        for (let x = subStart; x < subEnd; x++) {
          if (x % interval !== 0) {
            const posX = Math.floor(x * zoom) + 0.5;
            sCtxT.moveTo(posX, 16);
            sCtxT.lineTo(posX, 24);
          }
        }
        sCtxT.stroke();
      }

      // Main interval tick marks
      sCtxT.strokeStyle = tickColor;
      sCtxT.lineWidth = 1;
      sCtxT.beginPath();
      for (let x = startX; x <= endX; x += interval) {
        const posX = Math.floor(x * zoom) + 0.5;
        sCtxT.moveTo(posX, 10);
        sCtxT.lineTo(posX, 24);
      }
      const endEdgeX = Math.floor(cw * zoom) + 0.5;
      sCtxT.moveTo(endEdgeX, 6);
      sCtxT.lineTo(endEdgeX, 24);
      sCtxT.stroke();

      // Numbers
      for (let x = startX; x <= endX; x += interval) {
        const posX = Math.floor(x * zoom);
        sCtxT.fillStyle = textColor;
        sCtxT.fillText(String(x), posX + 2, 2);
      }
    }

    // 2. RENDER LEFT RULER (STATIC BASELINE)
    if (sCtxL) {
      const startY = Math.max(0, Math.floor((minY - interval) / interval) * interval);
      const endY = Math.min(ch, Math.ceil((maxY + interval) / interval) * interval);

      sCtxL.fillStyle = bgColor;
      sCtxL.fillRect(0, 0, 24, totalH);

      sCtxL.font = '9px "JetBrains Mono", monospace';
      sCtxL.textBaseline = 'top';

      if (zoom >= 6) {
        sCtxL.strokeStyle = subTickColor;
        sCtxL.lineWidth = 1;
        sCtxL.beginPath();
        const subStart = Math.max(0, minY - 2);
        const subEnd = Math.min(ch, maxY + 2);
        for (let y = subStart; y < subEnd; y++) {
          if (y % interval !== 0) {
            const posY = Math.floor(y * zoom) + 0.5;
            sCtxL.moveTo(16, posY);
            sCtxL.lineTo(24, posY);
          }
        }
        sCtxL.stroke();
      }

      // Main interval tick marks
      sCtxL.strokeStyle = tickColor;
      sCtxL.lineWidth = 1;
      sCtxL.beginPath();
      for (let y = startY; y <= endY; y += interval) {
        const posY = Math.floor(y * zoom) + 0.5;
        sCtxL.moveTo(10, posY);
        sCtxL.lineTo(24, posY);
      }
      const endEdgeY = Math.floor(ch * zoom) + 0.5;
      sCtxL.moveTo(6, endEdgeY);
      sCtxL.lineTo(24, endEdgeY);
      sCtxL.stroke();

      // Numbers
      for (let y = startY; y <= endY; y += interval) {
        const posY = Math.floor(y * zoom);
        sCtxL.fillStyle = textColor;
        sCtxL.fillText(String(y), 2, posY + 2);
      }
    }

    drawRulerHighlights();
  }

  function drawRulerHighlights() {
    if (!dom.rulerTop || !dom.rulerLeft || !state.showRulers) return;
    const ctxT = dom.rulerTop.getContext('2d');
    const ctxL = dom.rulerLeft.getContext('2d');
    if (!ctxT || !ctxL) return;

    const zoom = state.zoom;
    const cw = state.w;
    const ch = state.h;
    const totalW = Math.max(1, Math.round(cw * zoom));
    const totalH = Math.max(1, Math.round(ch * zoom));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    ctxT.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxL.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Blit pre-rendered static ruler ticks in sub-millisecond time
    if (rulerStaticTop && rulerStaticLeft) {
      ctxT.drawImage(rulerStaticTop, 0, 0, totalW, 24);
      ctxL.drawImage(rulerStaticLeft, 0, 0, 24, totalH);
    }

    // Active Selection Span Highlight on Rulers (tracks selection drag in real-time)
    if (state.selection) {
      const selX = Math.floor(state.selection.x * zoom);
      const selW = Math.max(1, Math.round(state.selection.w * zoom));
      const selY = Math.floor(state.selection.y * zoom);
      const selH = Math.max(1, Math.round(state.selection.h * zoom));

      ctxT.fillStyle = 'rgba(99, 102, 241, 0.2)';
      ctxT.fillRect(selX, 0, selW, 24);
      ctxT.fillStyle = '#6366f1';
      ctxT.fillRect(selX, 22, selW, 2);

      ctxL.fillStyle = 'rgba(99, 102, 241, 0.2)';
      ctxL.fillRect(0, selY, 24, selH);
      ctxL.fillStyle = '#6366f1';
      ctxL.fillRect(22, selY, 2, selH);
    }

    // Real-time Cursor Tracking Highlight on Top Ruler
    if (state._hoverX !== null && state._hoverX >= 0 && state._hoverX < cw) {
      const hx = Math.floor(state._hoverX * zoom);
      const hw = Math.max(1, Math.round(zoom));
      ctxT.fillStyle = 'rgba(99, 102, 241, 0.35)';
      ctxT.fillRect(hx, 0, hw, 24);
      ctxT.fillStyle = '#6366f1';
      ctxT.fillRect(hx, 20, hw, 4);
    }

    // Real-time Cursor Tracking Highlight on Left Ruler
    if (state._hoverY !== null && state._hoverY >= 0 && state._hoverY < ch) {
      const hy = Math.floor(state._hoverY * zoom);
      const hh = Math.max(1, Math.round(zoom));
      ctxL.fillStyle = 'rgba(99, 102, 241, 0.35)';
      ctxL.fillRect(0, hy, 24, hh);
      ctxL.fillStyle = '#6366f1';
      ctxL.fillRect(20, hy, 4, hh);
    }
  }

  function updateRulerHighlight(px, py) {
    if (!state.showRulers) return;
    if (state._hoverX === px && state._hoverY === py) return;
    state._hoverX = px;
    state._hoverY = py;

    if (rulerStaticTop && rulerStaticLeft) {
      // Instantaneous blit without dropping frames or lagging during pointer drag
      drawRulerHighlights();
    } else {
      renderRulers();
    }
  }

  function clearPreviewCanvas() {
    if (!dom.ctxPreview) return;
    const { minX, maxX, minY, maxY } = getVisibleCanvasBounds();
    const zoom = state.zoom;
    const totalW = Math.max(1, Math.round(state.w * zoom));
    const totalH = Math.max(1, Math.round(state.h * zoom));

    if (minX === 0 && minY === 0 && maxX === state.w && maxY === state.h) {
      dom.ctxPreview.clearRect(0, 0, totalW, totalH);
      return;
    }

    const rx = Math.max(0, Math.floor(minX * zoom));
    const ry = Math.max(0, Math.floor(minY * zoom));
    const rw = Math.min(totalW - rx, Math.ceil((maxX - minX + 1) * zoom));
    const rh = Math.min(totalH - ry, Math.ceil((maxY - minY + 1) * zoom));
    dom.ctxPreview.clearRect(rx, ry, rw, rh);
  }

  function renderSelectionMarquee() {
    clearPreviewCanvas();
    if (!state.selection) return;

    const { x, y, w, h } = state.selection;
    const zoom = state.zoom;
    const ctx = dom.ctxPreview;

    // Render floating pixels being dragged/transformed on preview canvas
    if (state.floatingPixels) {
      if (!state.floatingCanvas) {
        rebuildFloatingBuffer();
      }
      if (state.floatingCanvas) {
        ctx.imageSmoothingEnabled = false;
        if (state.isRotatingSelection && state.rotationCurrentAngle !== 0) {
          ctx.save();
          const centerCanvasX = (x + w / 2) * zoom;
          const centerCanvasY = (y + h / 2) * zoom;
          ctx.translate(centerCanvasX, centerCanvasY);
          ctx.rotate(state.rotationCurrentAngle);
          ctx.drawImage(state.floatingCanvas, (-w / 2) * zoom, (-h / 2) * zoom, w * zoom, h * zoom);
          ctx.restore();
        } else {
          ctx.drawImage(state.floatingCanvas, x * zoom, y * zoom, w * zoom, h * zoom);
        }
      }
    }

    // Free Multi-Angle Selection Rotation Marquee & Pivot
    if (state.isRotatingSelection && state.rotationCurrentAngle !== 0) {
      ctx.save();
      const centerCanvasX = (x + w / 2) * zoom;
      const centerCanvasY = (y + h / 2) * zoom;
      ctx.translate(centerCanvasX, centerCanvasY);
      ctx.rotate(state.rotationCurrentAngle);

      const localLeft = (-w / 2) * zoom;
      const localTop = (-h / 2) * zoom;
      const localW = w * zoom;
      const localH = h * zoom;

      // Soft scrim inside rotated selection
      ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
      ctx.fillRect(localLeft, localTop, localW, localH);

      // Rotated dashed marquee border
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(localLeft + 0.5, localTop + 0.5, localW - 1, localH - 1);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(localLeft + 0.5, localTop + 0.5, localW - 1, localH - 1);

      // Rotated handle stem + knob
      const rotHandleY = localTop - 18;
      ctx.beginPath();
      ctx.moveTo(0, localTop);
      ctx.lineTo(0, rotHandleY);
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, rotHandleY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mini pivot center dot inside handle
      ctx.beginPath();
      ctx.arc(0, rotHandleY, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4f46e5';
      ctx.fill();

      // Degree readout
      const deg = Math.round((state.rotationCurrentAngle * 180) / Math.PI);
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#4f46e5';
      ctx.textAlign = 'center';
      ctx.fillText(`${deg}°`, 0, rotHandleY - 8);

      ctx.restore();
      return;
    }

    const sx = Math.floor(x * zoom);
    const sy = Math.floor(y * zoom);
    const sw = Math.floor(w * zoom);
    const sh = Math.floor(h * zoom);

    ctx.save();
    // 1. Soft scrim inside selection
    ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
    ctx.fillRect(sx, sy, sw, sh);

    if (w === 1 && h === 1) {
      // Single pixel cell: Draw ultra-crisp solid border + inner highlight
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

      if (zoom >= 8) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);
      }
    } else {
      // Multi-pixel selection: Crisp solid dark underlay + high-contrast dashed overlay
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

      // Selection Scaling Handles (Unified SelectionTransform Engine)
      if (typeof SelectionTransform !== 'undefined' && (sw >= 16 || sh >= 16)) {
        const handles = SelectionTransform.getSelectionHandles(state.selection, zoom);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        const handleKeys = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
        handleKeys.forEach(k => {
          const h = handles[k];
          if (h) {
            ctx.fillRect(h.x, h.y, h.w, h.h);
            ctx.strokeRect(h.x + 0.5, h.y + 0.5, h.w - 1, h.h - 1);
          }
        });
      } else if (sw >= 16 && sh >= 16) {
        const handleSize = Math.max(3, Math.min(6, Math.floor(zoom / 3)));
        ctx.fillStyle = '#6366f1';
        ctx.setLineDash([]);
        ctx.fillRect(sx, sy, handleSize, handleSize);
        ctx.fillRect(sx + sw - handleSize, sy, handleSize, handleSize);
        ctx.fillRect(sx, sy + sh - handleSize, handleSize, handleSize);
        ctx.fillRect(sx + sw - handleSize, sy + sh - handleSize, handleSize, handleSize);
      }

      // Free Multi-Angle Selection Rotation Handle (Stem + Circular Pivot)
      const topMidX = sx + sw / 2;
      const topMidY = sy;
      const stemLen = (sy < 24) ? -20 : 20;
      const rotHandleX = topMidX;
      const rotHandleY = topMidY - stemLen;

      ctx.beginPath();
      ctx.moveTo(topMidX, topMidY);
      ctx.lineTo(rotHandleX, rotHandleY);
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rotHandleX, rotHandleY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mini pivot center dot inside handle
      ctx.beginPath();
      ctx.arc(rotHandleX, rotHandleY, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4f46e5';
      ctx.fill();
    }
    ctx.restore();
  }

  function renderRegionOverlay(region) {
    if (!dom.ctxPreview || !region || !region.pixels) return;
    const ctx = dom.ctxPreview;
    const zoom = state.zoom;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let count = 0;
    for (const k in region.pixels) {
      const commaIdx = k.indexOf(',');
      if (commaIdx === -1) continue;
      const x = Number(k.substring(0, commaIdx));
      const y = Number(k.substring(commaIdx + 1));
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count++;
    }
    if (count === 0) return;

    ctx.save();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    const rx = minX * zoom;
    const ry = minY * zoom;
    const rw = (maxX - minX + 1) * zoom;
    const rh = (maxY - minY + 1) * zoom;
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);

    const name = region.name || region.id;
    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 11px system-ui, sans-serif';
    const textW = ctx.measureText(name).width;
    ctx.fillRect(rx, Math.max(0, ry - 18), textW + 8, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, rx + 4, Math.max(0, ry - 18) + 13);
    ctx.restore();
  }

  function isOverRotationHandle(e) {
    if (!state.selection || (state.selection.w <= 1 && state.selection.h <= 1)) return false;
    const rect = state.cachedCanvasRect || dom.canvasMain.getBoundingClientRect();
    const sx = Math.floor(state.selection.x * state.zoom);
    const sy = Math.floor(state.selection.y * state.zoom);
    const sw = Math.floor(state.selection.w * state.zoom);
    const stemLen = (sy < 24) ? -20 : 20;
    const handleCanvasX = sx + sw / 2;
    const handleCanvasY = sy - stemLen;
    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;
    return Math.hypot(mouseCanvasX - handleCanvasX, mouseCanvasY - handleCanvasY) <= 22;
  }

  function resetRotationSession() {
    state.rotationSessionPixels = null;
    state.rotationSessionSel = null;
    state.rotationAccumulatedAngle = 0;
    state.rotationGestureBaseAngle = 0;
    state.rotationBaseFloatingPixels = null;
    state.rotationBaseSel = null;
  }

  function beginRotationGesture() {
    ensureFloatingSelection();
    if (!state.floatingPixels || !state.selection) return false;
    if (!state.rotationSessionPixels || !state.rotationSessionSel) {
      state.rotationSessionPixels = { ...state.floatingPixels };
      state.rotationSessionSel = { ...state.selection };
      state.rotationAccumulatedAngle = 0;
    }
    state.rotationGestureBaseAngle = state.rotationAccumulatedAngle;
    state.rotationBaseFloatingPixels = state.rotationSessionPixels;
    state.rotationBaseSel = state.rotationSessionSel;
    return true;
  }

  const ZOOM_LADDER = [0.1, 0.125, 0.2, 0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];

  function getMaxAllowedZoom() {
    const maxDim = Math.max(state.w, state.h);
    // Large artworks (512x512 up to 1024x1024) both cap at 8x zoom for comfortable pixel detailing
    // while keeping max backing dimension within 8192px (under the 16384px GPU texture limit)
    if (maxDim >= 512) {
      return 8;
    }
    if (maxDim >= 256) {
      return 16;
    }
    if (maxDim >= 128) {
      return 32;
    }
    return 64;
  }

  function getNextZoom(currentZoom, direction) {
    const maxZ = getMaxAllowedZoom();
    const ladder = ZOOM_LADDER.filter(z => z <= maxZ);
    if (!ladder.includes(maxZ) && maxZ < 64) ladder.push(maxZ);

    if (direction > 0) {
      for (const z of ladder) {
        if (z > currentZoom + 0.001) return z;
      }
      return ladder[ladder.length - 1];
    } else {
      for (let i = ladder.length - 1; i >= 0; i--) {
        if (ladder[i] < currentZoom - 0.001) return ladder[i];
      }
      return ladder[0];
    }
  }

  function formatZoom(z) {
    if (z < 1) {
      return `${Math.round(z * 100)}%`;
    }
    return Number.isInteger(z) ? `${z}×` : `${z.toFixed(1)}×`;
  }

  function updateContainerTransform() {
    if (dom && dom.container) {
      dom.container.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
    }
    if (dom && dom.zoomLabel) {
      dom.zoomLabel.textContent = formatZoom(state.zoom);
    }
    invalidateRulerCache();
  }

  // Phase 1 Finding B: Smooth Auto-Centering (preserves current zoom level with 150ms animation)
  function centerCanvasInViewport(animate = true) {
    if (state.panX === 0 && state.panY === 0) return;
    if (animate && dom && dom.container) {
      dom.container.style.transition = 'transform 150ms cubic-bezier(0.2, 0, 0, 1)';
      state.panX = 0;
      state.panY = 0;
      updateContainerTransform();
      setTimeout(() => {
        if (dom && dom.container) dom.container.style.transition = '';
        requestCanvasRepaint();
        renderRulers();
      }, 160);
    } else {
      state.panX = 0;
      state.panY = 0;
      updateContainerTransform();
      requestCanvasRepaint();
      renderRulers();
    }
  }

  function fitCanvasToViewport() {
    const rulerOffset = state.showRulers ? 24 : 0;
    const vpW = dom.viewport.clientWidth - 40 - rulerOffset;
    const vpH = dom.viewport.clientHeight - 40 - rulerOffset;
    if (vpW <= 0 || vpH <= 0) return;

    const scale = Math.min(vpW / state.w, vpH / state.h);
    const maxZ = getMaxAllowedZoom();
    let best = ZOOM_LADDER[0];
    for (const z of ZOOM_LADDER) {
      if (z <= scale && z <= maxZ) {
        best = z;
      } else {
        break;
      }
    }
    state.zoom = best;
    state.panX = 0;
    state.panY = 0;
    resizeCanvasesToZoom();
    repaintCanvas();
    renderRulers();
  }

  // ===========================================================================
  // BI-DIRECTIONAL SYNCHRONIZATION ENGINE
  // ===========================================================================

  // 1. Canvas -> Source (Strictly On Pointer Up for 60fps performance)
  function syncCanvasToSource(force = false) {
    if (!dom || !dom.codeEditor) return;
    if (state.isSyncingFromSource) return;
    if (state.viewMode === 'canvas' && !force) {
      state.isSourceDirty = true;
      updatePixelCount();
      return;
    }
    state.isSyncingFromCanvas = true;
    state.isSourceDirty = false;

    try {
      const cell = getArtworkCell();
      if (!cell) return;

      // Update document cell size
      cell.size = { w: state.w, h: state.h };
      state.doc.meta.cell_size = { w: state.w, h: state.h };
      state.doc.meta.grid = { columns: 1, rows: 1, default_cell: `${state.w}x${state.h}` };

      // If cell has large pixel count (> 30,000), prevent 1,000,000 line textarea DOM layout freezes
      const numPixels = cell.pixels ? Object.keys(cell.pixels).length : 0;
      if (numPixels > 30000 && !force) {
        state.sourcePaneMode = 'summary';
        dom.codeEditor.value = `@pix2 1.0\n@meta\n  title: "${state.doc.meta.title || 'Artwork'}"\n  size: ${state.w}x${state.h}\n\n@cell artwork\n  size: ${state.w}x${state.h}\n  ; [Status: ${numPixels.toLocaleString()} pixels - Full code hidden for maximum UI responsiveness]\n  ; [Artwork data, saving, and PNG export remain 100% intact]\n`;
        updateCodeGutter();
        updatePixelCount();
        dom.syncBadge.className = 'pa-sync-badge synced';
        dom.syncBadge.innerHTML = '<i class="fa-solid fa-circle"></i> Synced';
        dom.diagnosticPill.className = 'pa-diagnostic-pill clean';
        dom.diagnosticPill.innerHTML = '<i class="fa-solid fa-check"></i> Standard v1.0';
        return;
      }
      state.sourcePaneMode = 'full';

      // Serialize canonical PIX2
      let serialized = _PIX2.serialize(state.doc);
      if (state.canvasBgMode && state.canvasBgMode !== 'transparent') {
        const bgVal = state.canvasBgMode === 'white' ? '#ffffff' : (state.canvasBgMode === 'black' ? '#000000' : state.canvasBgColor);
        serialized = serialized.replace(/background:\s*none/, `background: ${bgVal}`);
      }
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

  function flushSourceCode() {
    // If the user is actively editing code in unlocked editor (and not in summary mode), return editor text
    if (state.isCodeEditingUnlocked && dom && dom.codeEditor && dom.codeEditor.value && state.sourcePaneMode !== 'summary') {
      return dom.codeEditor.value;
    }

    // Ensure cell size metadata is up-to-date before serializing
    const cell = getArtworkCell();
    if (cell) {
      cell.size = { w: state.w, h: state.h };
      if (state.doc && state.doc.meta) {
        state.doc.meta.cell_size = { w: state.w, h: state.h };
        state.doc.meta.grid = { columns: 1, rows: 1, default_cell: `${state.w}x${state.h}` };
      }
    }

    // ALWAYS serialize from authoritative canonical state.doc!
    let serialized = _PIX2.serialize(state.doc);
    if (state.canvasBgMode && state.canvasBgMode !== 'transparent') {
      const bgVal = state.canvasBgMode === 'white' ? '#ffffff' : (state.canvasBgMode === 'black' ? '#000000' : state.canvasBgColor);
      serialized = serialized.replace(/background:\s*none/, `background: ${bgVal}`);
    }
    return serialized;
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
    if (!source || !source.trim() || state.sourcePaneMode === 'summary') {
      state.isSyncingFromSource = false;
      return false;
    }

    try {
      // 1. Parse raw PIX2 source into AST document with PixelArt profile (supports up to 1024x1024)
      const parsedDoc = _PIX2.parse(source, { profile: 'pixelart' });
      if (!parsedDoc || !parsedDoc.cells) {
        throw new Error('PIX2 parse error: missing cells object.');
      }

      // Check parse diagnostics
      if (parsedDoc._diagnostics && parsedDoc._diagnostics.length > 0) {
        const severeErr = parsedDoc._diagnostics.find(d => d.code && d.code.startsWith('PIX2_ERR_'));
        if (severeErr) {
          dom.syncBadge.className = 'pa-sync-badge error';
          dom.syncBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Syntax Error';
          dom.diagnosticPill.className = 'pa-diagnostic-pill error';
          dom.diagnosticPill.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(severeErr.message)}`;
          showToast(`Syntax error: ${severeErr.message}`, 'error');
          return false;
        }
      }

      // 2. Validate parsed AST document
      const validation = _PIX2.validate(parsedDoc, { profile: 'pixelart', strict: false });
      if (!validation.valid && validation.errors && validation.errors.length > 0) {
        const firstErr = validation.errors[0];
        dom.syncBadge.className = 'pa-sync-badge error';
        dom.syncBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Syntax Error';

        dom.diagnosticPill.className = 'pa-diagnostic-pill error';
        dom.diagnosticPill.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(firstErr)}`;
        showToast(`Validation error: ${firstErr}`, 'error');
        return false; // Non-destructive: keep canvas intact!
      }

      // 3. Document is valid - commit to active state
      state.doc = parsedDoc;

      // Extract artwork title
      if (parsedDoc.meta && parsedDoc.meta.title) {
        state.title = parsedDoc.meta.title;
        if (dom.docTitle) dom.docTitle.value = state.title;
      }

      // Extract artwork dimensions
      const cell = getArtworkCell();
      if (cell && cell.size) {
        if (cell.size.w !== state.w || cell.size.h !== state.h) {
          state.w = Math.max(1, Math.min(1024, cell.size.w));
          state.h = Math.max(1, Math.min(1024, cell.size.h));
          dom.dimBadge.textContent = `${state.w}×${state.h}`;
          resizeCanvasesToZoom();
          renderRulers();
        }
      }

      // Update palette swatches if document palette has colors
      if (parsedDoc.palette && Object.keys(parsedDoc.palette).length > 0) {
        state.activeSwatches = Object.values(parsedDoc.palette);
        populatePaletteDropdown();
        renderPaletteSwatches();
      }

      // Sync background directive if present
      const bgMatch = source.match(/background:\s*([^\s;]+)/i);
      if (bgMatch) {
        const bgVal = bgMatch[1].trim().toLowerCase();
        if (bgVal === 'none') {
          setCanvasBgMode('transparent', null, true);
        } else if (bgVal === '#ffffff' || bgVal === '#fff') {
          setCanvasBgMode('white', null, true);
        } else if (bgVal === '#000000' || bgVal === '#000') {
          setCanvasBgMode('black', null, true);
        } else if (bgVal.startsWith('#')) {
          setCanvasBgMode('custom', bgVal, true);
        }
      }

      rebuildArtworkBuffer();
      repaintCanvas();
      pushHistory();
      triggerAutosave();

      dom.syncBadge.className = 'pa-sync-badge synced';
      dom.syncBadge.innerHTML = '<i class="fa-solid fa-circle"></i> Synced';

      dom.diagnosticPill.className = 'pa-diagnostic-pill clean';
      dom.diagnosticPill.innerHTML = '<i class="fa-solid fa-check"></i> Standard v1.0';

      updateCodeGutter();
      updatePixelCount();
      return true;
    } catch (err) {
      dom.syncBadge.className = 'pa-sync-badge error';
      dom.syncBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Parse Error';
      dom.diagnosticPill.className = 'pa-diagnostic-pill error';
      dom.diagnosticPill.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(err.message)}`;
      showToast(`Parse error: ${err.message}`, 'error');
      return false;
    } finally {
      state.isSyncingFromSource = false;
    }
  }

  let lastGutterLineCount = 0;
  function updateCodeGutter() {
    const text = dom.codeEditor.value || '';
    let lineCount = 1;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) lineCount++;
    }
    dom.codeLinesCount.textContent = `${lineCount} lines`;

    if (lineCount === lastGutterLineCount) return;
    lastGutterLineCount = lineCount;

    let gutterText = '';
    const maxGutter = Math.min(lineCount, 5000);
    for (let i = 1; i <= maxGutter; i++) {
      gutterText += i + '\n';
    }
    if (lineCount > 5000) {
      gutterText += '...\n';
    }
    dom.codeGutter.textContent = gutterText;
  }

  function updatePixelCount() {
    const cell = getArtworkCell();
    const count = cell && cell.pixels ? Object.keys(cell.pixels).length : 0;
    dom.codePixelsCount.textContent = `${count} pixels`;
  }

  // ===========================================================================
  // DRAWING TOOLS & CANVAS INTERACTIONS
  // ===========================================================================
  function isEventOverCanvas(e) {
    if (!dom.canvasMain) return false;
    const rect = state.cachedCanvasRect || dom.canvasMain.getBoundingClientRect();
    return e.clientX >= rect.left && e.clientX < rect.right &&
           e.clientY >= rect.top && e.clientY < rect.bottom;
  }

  function getPixelCoord(e) {
    const rect = state.cachedCanvasRect || dom.canvasMain.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / state.zoom);
    const y = Math.floor((e.clientY - rect.top) / state.zoom);
    return {
      x: Math.max(0, Math.min(state.w - 1, x)),
      y: Math.max(0, Math.min(state.h - 1, y))
    };
  }

  function renderPixelDirect(px, py, color) {
    if (!dom.ctxMain) return;
    const zoom = state.zoom;
    const x = Math.floor(px * zoom);
    const y = Math.floor(py * zoom);
    const sz = Math.max(1, Math.ceil(zoom));

    if (color === null) {
      if (state.canvasBgMode === 'white') {
        dom.ctxMain.fillStyle = '#ffffff';
        dom.ctxMain.fillRect(x, y, sz, sz);
      } else if (state.canvasBgMode === 'black') {
        dom.ctxMain.fillStyle = '#000000';
        dom.ctxMain.fillRect(x, y, sz, sz);
      } else if (state.canvasBgMode === 'custom') {
        dom.ctxMain.fillStyle = state.canvasBgColor || '#2a2e3f';
        dom.ctxMain.fillRect(x, y, sz, sz);
      } else {
        const isDark = document.body.classList.contains('dark-theme');
        const tileCanvasSize = zoom >= 4 ? Math.max(1, Math.round(zoom)) : (zoom <= 1 ? 16 : Math.round(8 * zoom));
        dom.ctxMain.fillStyle = getCheckerPattern(dom.ctxMain, tileCanvasSize, isDark);
        dom.ctxMain.fillRect(x, y, sz, sz);
      }
    } else {
      dom.ctxMain.fillStyle = color;
      dom.ctxMain.fillRect(x, y, sz, sz);
    }

    if (state.showGrid && zoom >= 4) {
      let isDarkBg = document.body.classList.contains('dark-theme');
      if (state.canvasBgMode === 'black') isDarkBg = true;
      else if (state.canvasBgMode === 'white') isDarkBg = false;
      else if (state.canvasBgMode === 'custom') isDarkBg = isColorDark(state.canvasBgColor);
      dom.ctxMain.strokeStyle = isDarkBg ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
      dom.ctxMain.lineWidth = 1;
      dom.ctxMain.strokeRect(x + 0.5, y + 0.5, sz, sz);
    }
  }

  function plotPixelWithSymmetry(cell, x, y, color) {
    if (x < 0 || x >= state.w || y < 0 || y >= state.h) return;
    const w = state.w;
    const h = state.h;

    const targetNode = (cell.layers && cell.layers.length > 0 && typeof Tools !== 'undefined' && typeof Tools.getTargetForPlot === 'function')
      ? Tools.getTargetForPlot(cell, state.isolatedNodeId || state.activeRegionId || state.activeLayerId)
      : null;

    const plotSingle = (px, py) => {
      const key = `${px},${py}`;
      const oldVal = (cell.pixels && cell.pixels[key]) ? cell.pixels[key] : null;
      const newVal = color;
      if (state.activeStrokeChanges && oldVal !== newVal) {
        if (!state.activeStrokeChanges[key]) {
          state.activeStrokeChanges[key] = [oldVal, newVal];
        } else {
          state.activeStrokeChanges[key][1] = newVal;
        }
      }
      if (color === null) {
        delete cell.pixels[key];
        if (targetNode && targetNode.pixels) {
          delete targetNode.pixels[key];
        }
        plotPixelOnBuffer(px, py, null);
      } else {
        cell.pixels[key] = color;
        if (targetNode && targetNode.pixels) {
          targetNode.pixels[key] = color;
        }
        plotPixelOnBuffer(px, py, color);
      }
      renderPixelDirect(px, py, color);
    };

    plotSingle(x, y);
    if (state.symH) plotSingle(w - 1 - x, y);
    if (state.symV) plotSingle(x, h - 1 - y);
    if (state.symH && state.symV) plotSingle(w - 1 - x, h - 1 - y);

    if (targetNode && typeof Tools !== 'undefined' && typeof Tools.syncCompositeIfStructured === 'function') {
      Tools.syncCompositeIfStructured(cell, { w: state.w, h: state.h });
    }
  }

  function onPointerDown(e) {
    // Right click is reserved exclusively for Desktop Context Menu
    if (e.button === 2) {
      return;
    }
    if (e.button === 0) {
      e.preventDefault();
    }

    // Pan via Hand tool, middle click or Space key
    if (e.button === 1 || e.spaceKey || state.isSpaceDown || state.currentTool === 'pan') {
      state.isPanning = true;
      state.panStartX = e.clientX - state.panX;
      state.panStartY = e.clientY - state.panY;
      dom.viewport.style.cursor = 'grabbing';
      return;
    }

    // Ignore clicks on ruler corner or ruler tick bars
    if (e.target && (e.target.closest('#pa-ruler-top') || e.target.closest('#pa-ruler-left') || e.target.closest('#pa-ruler-corner'))) {
      return;
    }

    // Don't initiate drawing if click is outside canvas and not over active selection rotation handle
    const overCanvas = isEventOverCanvas(e);
    if (!overCanvas && !isOverRotationHandle(e)) {
      return;
    }

    const cell = getArtworkCell();
    if (!cell) return;

    const { x, y } = getPixelCoord(e);
    state.isDrawing = true;
    const isStrokeTool = (state.currentTool === 'pen' || state.currentTool === 'eraser');
    state.activeStrokeChanges = isStrokeTool ? {} : null;
    state.dragStartX = x;
    state.dragStartY = y;
    state.lastX = x;
    state.lastY = y;
    state.cachedCanvasRect = dom.canvasMain.getBoundingClientRect();
    updateRulerHighlight(x, y);

    const activeColor = state.primaryColor;

    // Check if clicking on SelectionTransform handles (Rotation or Scale)
    if (state.selection && typeof SelectionTransform !== 'undefined') {
      const rect = state.cachedCanvasRect || dom.canvasMain.getBoundingClientRect();
      const mouseCanvasX = e.clientX - rect.left;
      const mouseCanvasY = e.clientY - rect.top;
      const hit = SelectionTransform.hitTestSelectionHandles(state.selection, mouseCanvasX, mouseCanvasY, state.zoom);

      if (hit === 'rot') {
        state.isRotatingSelection = true;
        state.isDrawing = false;
        if (!beginRotationGesture()) {
          state.isRotatingSelection = false;
          return;
        }

        const cx = state.selection.x + state.selection.w / 2;
        const cy = state.selection.y + state.selection.h / 2;
        const screenCenterX = rect.left + cx * state.zoom;
        const screenCenterY = rect.top + cy * state.zoom;
        state.rotationCenter = { x: screenCenterX, y: screenCenterY, cx, cy };
        state.rotationStartAngle = Math.atan2(e.clientY - screenCenterY, e.clientX - screenCenterX);
        state.rotationCurrentAngle = 0;
        dom.viewport.style.cursor = 'grabbing';
        return;
      }

      if (hit && hit !== 'body') {
        state.isScalingSelection = true;
        state.activeScaleHandle = hit;
        state.isDrawing = false;
        resetRotationSession();
        ensureFloatingSelection();
        state.scaleOriginalPixels = { ...state.floatingPixels };
        state.scaleOriginalSel = { ...state.selection };
        dom.viewport.style.cursor = `${hit}-resize`;
        return;
      }
    } else if (state.selection && isOverRotationHandle(e)) {
      state.isRotatingSelection = true;
      state.isDrawing = false;
      if (!beginRotationGesture()) {
        state.isRotatingSelection = false;
        return;
      }

      const rect = dom.canvasMain.getBoundingClientRect();
      const cx = state.selection.x + state.selection.w / 2;
      const cy = state.selection.y + state.selection.h / 2;
      const screenCenterX = rect.left + cx * state.zoom;
      const screenCenterY = rect.top + cy * state.zoom;
      state.rotationCenter = { x: screenCenterX, y: screenCenterY, cx, cy };
      state.rotationStartAngle = Math.atan2(e.clientY - screenCenterY, e.clientX - screenCenterX);
      state.rotationCurrentAngle = 0;
      dom.viewport.style.cursor = 'grabbing';
      return;
    }

    // Region Select Tool Handling
    if (state.currentTool === 'region-select') {
      state.isDrawing = false;
      const hit = findRegionAt(cell, x, y);
      if (hit) {
        state.activeRegionId = hit.id;
        renderPaLayersTree();
        const now = performance.now();
        if (state.lastRegionClickTime && (now - state.lastRegionClickTime < 350) && state.lastRegionClickId === hit.id) {
          enterIsolationMode(hit.id, hit.name || hit.id);
        } else {
          clearPreviewCanvas();
          renderRegionOverlay(hit);
        }
        state.lastRegionClickTime = now;
        state.lastRegionClickId = hit.id;
        showToast(`Selected region: ${hit.name || hit.id}`);
      } else {
        if (state.isolatedNodeId) {
          const now = performance.now();
          if (state.lastOutsideClickTime && (now - state.lastOutsideClickTime < 350)) {
            exitIsolationMode();
          }
          state.lastOutsideClickTime = now;
        }
        clearPreviewCanvas();
      }
      return;
    }

    // Selection Tool Handling
    if (state.currentTool === 'select') {
      // Check if clicking inside active selection -> Move / Drag it!
      if (state.selection &&
          x >= state.selection.x && x < state.selection.x + state.selection.w &&
          y >= state.selection.y && y < state.selection.y + state.selection.h) {
        state.isMovingSelection = true;
        resetRotationSession();
        state.moveStartX = x;
        state.moveStartY = y;
        ensureFloatingSelection();
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
      const isHuge = (state.w * state.h >= 262144);
      if (isHuge) {
        showToast(`Filling ${state.w}×${state.h} (${(state.w * state.h).toLocaleString()} pixels)...`, 'info');
        dom.viewport.style.cursor = 'wait';
      }
      setTimeout(() => {
        _Tools.floodFill(cell, x, y, activeColor, {
          w: state.w,
          h: state.h,
          targetId: state.isolatedNodeId || state.activeRegionId || state.activeLayerId
        });
        rebuildArtworkBuffer();
        repaintCanvas();
        pushHistory();
        syncCanvasToSource();
        triggerAutosave();
        if (isHuge) {
          dom.viewport.style.cursor = 'crosshair';
          showToast(`Flood fill completed (${(state.w * state.h).toLocaleString()} pixels)`, 'success');
        }
      }, isHuge ? 20 : 0);
      state.isDrawing = false;
      return;
    }

    // Pen / Eraser
    if (state.currentTool === 'pen') {
      plotPixelWithSymmetry(cell, x, y, activeColor);
    } else if (state.currentTool === 'eraser') {
      plotPixelWithSymmetry(cell, x, y, null);
    }
  }

  function onPointerMove(e) {
    const overCanvas = isEventOverCanvas(e);
    let x = null, y = null;
    if (overCanvas) {
      const coords = getPixelCoord(e);
      x = coords.x;
      y = coords.y;
      dom.coordLabel.textContent = `${x}, ${y}`;
      if (!state.isDrawing) {
        updateHoverColor(x, y);
      }
      updateRulerHighlight(x, y);
    } else {
      if (!state.isDrawing && !state.isPanning && !state.isMovingSelection && !state.isRotatingSelection && !state.isSelecting) {
        dom.coordLabel.textContent = '-, -';
        updateHoverColor(null, null);
        updateRulerHighlight(null, null);
      } else {
        const coords = getPixelCoord(e);
        x = coords.x;
        y = coords.y;
        updateRulerHighlight(x, y);
      }
    }

    // Pan movement
    if (state.isPanning) {
      state.panX = e.clientX - state.panStartX;
      state.panY = e.clientY - state.panStartY;
      if (state.isSpaceDown) {
        state.didPanWithSpace = true;
      }
      updateContainerTransform();
      requestCanvasRepaint();
      return;
    }

    // Free Multi-Angle Selection Rotation Drag with Magnetic 90° & 15° Snapping
    if (state.isRotatingSelection && state.rotationCenter) {
      const currentAngle = Math.atan2(e.clientY - state.rotationCenter.y, e.clientX - state.rotationCenter.x);
      const deltaAngle = currentAngle - state.rotationStartAngle;
      let totalAngle = state.rotationGestureBaseAngle + deltaAngle;

      const halfPi = Math.PI / 2;
      const nearest90 = Math.round(totalAngle / halfPi) * halfPi;
      const snapThreshold = (10 * Math.PI) / 180; // 10 degree magnetic snap zone
      if (Math.abs(totalAngle - nearest90) < snapThreshold) {
        totalAngle = nearest90;
      } else if (e.shiftKey) {
        // Shift key: Snap to 15-degree steps
        const step = (15 * Math.PI) / 180;
        totalAngle = Math.round(totalAngle / step) * step;
      }
      // Preview only the delta from the already-rendered accumulated result.
      state.rotationCurrentAngle = totalAngle - state.rotationGestureBaseAngle;
      renderSelectionMarquee();
      return;
    }

    // Region Select Hover Overlay
    if (state.currentTool === 'region-select' && !state.isDrawing && !state.isPanning) {
      const cell = getArtworkCell();
      if (cell && x !== null && y !== null) {
        const hit = findRegionAt(cell, x, y);
        clearPreviewCanvas();
        if (hit) {
          renderRegionOverlay(hit);
          dom.viewport.style.cursor = 'pointer';
        } else {
          dom.viewport.style.cursor = 'crosshair';
        }
      }
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

    // Scaling active selection (Nearest-neighbor scaling with Shift uniform aspect preservation)
    if (state.isScalingSelection && state.scaleOriginalSel && typeof SelectionTransform !== 'undefined') {
      const scaled = SelectionTransform.computeScaledBounds(
        state.scaleOriginalSel,
        state.activeScaleHandle,
        x,
        y,
        e.shiftKey
      );
      state.selection = { ...scaled };
      state.floatingCurrentX = scaled.x;
      state.floatingCurrentY = scaled.y;
      state.floatingOriginalSel = { ...scaled };
      state.floatingPixels = SelectionTransform.scalePixelsNearestNeighbor(
        state.scaleOriginalPixels,
        state.scaleOriginalSel.w,
        state.scaleOriginalSel.h,
        scaled.w,
        scaled.h
      );
      rebuildFloatingBuffer();
      renderSelectionMarquee();
      return;
    }

    // Selection Handles Hover Cursor
    if (state.selection && !state.isDrawing && !state.isPanning && !state.isMovingSelection && !state.isRotatingSelection && !state.isScalingSelection && typeof SelectionTransform !== 'undefined') {
      const rect = state.cachedCanvasRect || dom.canvasMain.getBoundingClientRect();
      const mouseCanvasX = e.clientX - rect.left;
      const mouseCanvasY = e.clientY - rect.top;
      const hit = SelectionTransform.hitTestSelectionHandles(state.selection, mouseCanvasX, mouseCanvasY, state.zoom);
      if (hit === 'rot') {
        dom.viewport.style.cursor = 'grab';
      } else if (hit === 'nw' || hit === 'se') {
        dom.viewport.style.cursor = 'nwse-resize';
      } else if (hit === 'ne' || hit === 'sw') {
        dom.viewport.style.cursor = 'nesw-resize';
      } else if (hit === 'n' || hit === 's') {
        dom.viewport.style.cursor = 'ns-resize';
      } else if (hit === 'e' || hit === 'w') {
        dom.viewport.style.cursor = 'ew-resize';
      } else if (hit === 'body') {
        dom.viewport.style.cursor = 'move';
      } else {
        dom.viewport.style.cursor = (state.currentTool === 'pan') ? 'grab' : (state.currentTool === 'picker' ? 'crosshair' : 'default');
      }
    } else if (isOverRotationHandle(e)) {
      dom.viewport.style.cursor = 'grab';
    } else if (!state.isDrawing && !state.isPanning && !state.isMovingSelection && !state.isRotatingSelection && !state.isScalingSelection) {
      dom.viewport.style.cursor = (state.currentTool === 'pan') ? 'grab' : 'crosshair';
    }

    if (!state.isDrawing) return;

    // P0 Point Deduplication: Drop redundant mousemove events within the same artwork pixel
    if ((state.currentTool === 'pen' || state.currentTool === 'eraser') && x === state.lastX && y === state.lastY) {
      return;
    }

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
    state.cachedCanvasRect = null;
    if (state.isPanning) {
      state.isPanning = false;
      dom.viewport.style.cursor = state.isSpaceDown ? 'grab' : (state.currentTool === 'pan' ? 'grab' : 'crosshair');
      renderRulers();
      return;
    }

    if (state.isScalingSelection) {
      state.isScalingSelection = false;
      state.scaleOriginalSel = null;
      state.scaleOriginalPixels = null;
      dom.viewport.style.cursor = 'crosshair';
      rebuildFloatingBuffer();
      renderSelectionMarquee();
      return;
    }

    if (state.isRotatingSelection) {
      const theta = state.rotationGestureBaseAngle + state.rotationCurrentAngle;
      state.isRotatingSelection = false;
      state.isDrawing = false;
      state.rotationCurrentAngle = 0;
      dom.viewport.style.cursor = 'crosshair';

      if (state.rotationSessionPixels && state.rotationSessionSel && typeof SelectionTransform !== 'undefined') {
        const baseSel = state.rotationSessionSel;
        const rotated = SelectionTransform.rotatePixelsNearestNeighbor(
          state.rotationSessionPixels,
          baseSel.w,
          baseSel.h,
          theta
        );
        state.selection.x = Math.round(baseSel.x + (baseSel.w - rotated.w) / 2);
        state.selection.y = Math.round(baseSel.y + (baseSel.h - rotated.h) / 2);
        state.selection.w = rotated.w;
        state.selection.h = rotated.h;
        state.floatingPixels = rotated.pixels;
        state.floatingCurrentX = state.selection.x;
        state.floatingCurrentY = state.selection.y;
        state.rotationAccumulatedAngle = theta;
        rebuildFloatingBuffer();

        const deg = Math.round((theta * 180) / Math.PI);
        showToast(`Selection rotation: ${deg}°`);
        if (Math.abs(theta) > 0.01) setDirty(true);
      }

      renderSelectionMarquee();
      return;
    }

    if (state.isMovingSelection) {
      state.isMovingSelection = false;
      state.isDrawing = false;
      renderSelectionMarquee();
      if (isEventOverCanvas(e)) {
        const coords = getPixelCoord(e);
        dom.coordLabel.textContent = `${coords.x}, ${coords.y}`;
        updateHoverColor(coords.x, coords.y);
        updateRulerHighlight(coords.x, coords.y);
      }
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

    clearPreviewCanvas();

    if (repaintRafId !== null) {
      cancelAnimationFrame(repaintRafId);
      repaintRafId = null;
    }

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
    } else {
      repaintCanvas();
    }

    renderSelectionMarquee();

    // Flush final coordinate and hover display
    if (isEventOverCanvas(e)) {
      dom.coordLabel.textContent = `${x}, ${y}`;
      updateHoverColor(x, y);
      updateRulerHighlight(x, y);
    }

    // Canvas -> Code sync and history push strictly on Pointer Up when artwork modified
    if (state.currentTool !== 'select') {
      pushHistory();
      syncCanvasToSource();
      triggerAutosave();
    }
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
    clearPreviewCanvas();
    dom.ctxPreview.fillStyle = color;
    _Tools.line(x0, y0, x1, y1, (px, py) => {
      dom.ctxPreview.fillRect(px * zoom, py * zoom, zoom, zoom);
      if (state.symH) dom.ctxPreview.fillRect((state.w - 1 - px) * zoom, py * zoom, zoom, zoom);
      if (state.symV) dom.ctxPreview.fillRect(px * zoom, (state.h - 1 - py) * zoom, zoom, zoom);
    });
  }

  function drawPreviewRect(x0, y0, x1, y1, color, fill, shiftKey, altKey) {
    const zoom = state.zoom;
    clearPreviewCanvas();
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
    clearPreviewCanvas();
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
    const target = getFloatingSelectionTarget(cell);
    if (target) {
      if (!target.pixels) target.pixels = {};
      for (const relKey in state.floatingPixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const destX = state.selection.x + rx;
        const destY = state.selection.y + ry;
        if (destX >= 0 && destX < state.w && destY >= 0 && destY < state.h) {
          target.pixels[`${destX},${destY}`] = state.floatingPixels[relKey];
        }
      }
      rebuildArtworkBuffer();
      pushHistory();
      repaintCanvas();
      syncCanvasToSource();
      triggerAutosave();
    }
    state.floatingPixels = null;
    state.floatingOriginalSel = null;
    state.floatingTargetId = null;
    state.floatingBaselinePixels = null;
    state.floatingBaselineSel = null;
    state.floatingBaselineTargetId = null;
    state.floatingCanvas = null;
    state.floatingCtx = null;
    resetRotationSession();
  }

  /**
   * Cancels a transient floating selection without changing the document.
   * A floating selection is deliberately removed from the artwork buffer while
   * it is being moved, scaled, or rotated. Cancelling must restore the
   * immutable lift-time pixels rather than committing their preview position.
   */
  function cancelFloatingSelection() {
    const cell = getArtworkCell();
    const baselinePixels = state.floatingBaselinePixels;
    const baselineSel = state.floatingBaselineSel;
    const baselineTarget = state.floatingBaselineTargetId
      ? findNodeById(cell, state.floatingBaselineTargetId)
      : getFloatingSelectionTarget(cell);

    if (baselineTarget && baselinePixels && baselineSel) {
      if (!baselineTarget.pixels) baselineTarget.pixels = {};
      for (const relKey in baselinePixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const x = baselineSel.x + rx;
        const y = baselineSel.y + ry;
        if (x >= 0 && x < state.w && y >= 0 && y < state.h) {
          baselineTarget.pixels[`${x},${y}`] = baselinePixels[relKey];
        }
      }
      rebuildArtworkBuffer();
    }

    state.floatingPixels = null;
    state.floatingOriginalSel = null;
    state.floatingTargetId = null;
    state.floatingBaselinePixels = null;
    state.floatingBaselineSel = null;
    state.floatingBaselineTargetId = null;
    state.floatingCanvas = null;
    state.floatingCtx = null;
    state.isMovingSelection = false;
    state.isScalingSelection = false;
    state.isRotatingSelection = false;
    state.isSelecting = false;
    state.isDrawing = false;
    state.selection = null;
    state.rotationCurrentAngle = 0;
    state.scaleOriginalSel = null;
    state.scaleOriginalPixels = null;
    resetRotationSession();
    rebuildFloatingBuffer();
    repaintCanvas();
    renderSelectionMarquee();
  }

  // ===========================================================================
  // SELECTION & TRANSFORM HELPERS
  // ===========================================================================
  function selectAll() {
    commitFloatingSelection();
    state.selection = {
      x: 0,
      y: 0,
      w: state.w,
      h: state.h
    };
    selectTool('select');
    renderSelectionMarquee();
    showToast(`Selected entire canvas (${state.w}×${state.h})`);
  }

  function copySelection() {
    const cell = getArtworkCell();
    if (!cell) return;

    if (state.floatingPixels && state.selection) {
      state.clipboard = {
        w: state.selection.w,
        h: state.selection.h,
        pixels: { ...state.floatingPixels }
      };
      showToast(`Copied floating selection (${state.selection.w}×${state.selection.h})`);
      return;
    }

    const target = getActiveEditingTarget(cell);
    if (!target || !target.pixels) return;

    const x = state.selection ? state.selection.x : 0;
    const y = state.selection ? state.selection.y : 0;
    const w = state.selection ? state.selection.w : state.w;
    const h = state.selection ? state.selection.h : state.h;
    const copiedPixels = {};

    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const key = `${px},${py}`;
        if (target.pixels[key]) {
          copiedPixels[`${px - x},${py - y}`] = target.pixels[key];
        }
      }
    }

    state.clipboard = { w, h, pixels: copiedPixels };
    showToast(`Copied ${Object.keys(copiedPixels).length} pixels (${w}×${h})`);
  }

  function cutSelection() {
    copySelection();
    deleteSelection();
  }

  function deleteSelection() {
    if (state.floatingPixels) {
      state.floatingPixels = null;
      state.floatingOriginalSel = null;
      state.floatingTargetId = null;
      state.floatingBaselinePixels = null;
      state.floatingBaselineSel = null;
      state.floatingBaselineTargetId = null;
      state.selection = null;
      renderSelectionMarquee();
      repaintCanvas();
      pushHistory();
      syncCanvasToSource();
      triggerAutosave();
      return;
    }

    const cell = getArtworkCell();
    const target = getActiveEditingTarget(cell);
    if (!target || !target.pixels) return;

    if (!state.selection) {
      target.pixels = {};
      rebuildArtworkBuffer();
      repaintCanvas();
      pushHistory();
      syncCanvasToSource();
      triggerAutosave();
      showToast('Cleared canvas content');
      return;
    }

    const { x, y, w, h } = state.selection;
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        delete target.pixels[`${px},${py}`];
      }
    }

    state.selection = null;
    rebuildArtworkBuffer();
    renderSelectionMarquee();
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
  }

  function pasteSelection() {
    if (!state.clipboard || !state.clipboard.pixels) {
      showToast('Clipboard is empty', 'error');
      return;
    }
    commitFloatingSelection();

    const target = getActiveEditingTarget();
    if (!target) {
      showToast('Select an editable layer or region before pasting', 'error');
      return;
    }

    // Switch tools before creating the floating transaction: selectTool()
    // commits an existing floating selection when changing tools.
    selectTool('select');

    const startX = state.selection ? state.selection.x : 0;
    const startY = state.selection ? state.selection.y : 0;

    state.selection = {
      x: startX,
      y: startY,
      w: state.clipboard.w,
      h: state.clipboard.h
    };
    state.floatingOriginalSel = { ...state.selection };
    state.floatingTargetId = target === getArtworkCell() ? null : target.id;
    state.floatingBaselineTargetId = null;
    state.floatingCurrentX = startX;
    state.floatingCurrentY = startY;
    state.floatingPixels = { ...state.clipboard.pixels };
    rebuildFloatingBuffer();

    renderSelectionMarquee();
    syncCanvasToSource();
    showToast(`Pasted ${Object.keys(state.clipboard.pixels).length} pixels`);
  }

  function fillSelection() {
    const cell = getArtworkCell();
    const target = getActiveEditingTarget(cell);
    if (!target) return;
    if (!target.pixels) target.pixels = {};

    if (!state.selection) {
      for (let py = 0; py < state.h; py++) {
        for (let px = 0; px < state.w; px++) {
          target.pixels[`${px},${py}`] = state.primaryColor;
        }
      }
      rebuildArtworkBuffer();
      repaintCanvas();
      pushHistory();
      syncCanvasToSource();
      triggerAutosave();
      showToast(`Filled entire canvas (${state.w}×${state.h})`);
      return;
    }

    const { x, y, w, h } = state.selection;
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        target.pixels[`${px},${py}`] = state.primaryColor;
      }
    }

    state.floatingPixels = null;
    state.floatingOriginalSel = null;
    state.floatingTargetId = null;
    state.floatingBaselinePixels = null;
    state.floatingBaselineSel = null;
    state.floatingBaselineTargetId = null;
    state.floatingCanvas = null;
    state.floatingCtx = null;
    rebuildArtworkBuffer();
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
    showToast(`Filled selection (${w}×${h})`);
  }

  function ensureFloatingSelection() {
    if (state.floatingPixels || !state.selection) return;
    const cell = getArtworkCell();
    const target = getActiveEditingTarget(cell);
    if (!target) return;
    if (!target.pixels) target.pixels = {};
    state.floatingOriginalSel = { ...state.selection };
    state.floatingTargetId = target === cell ? null : target.id;
    state.floatingCurrentX = state.selection.x;
    state.floatingCurrentY = state.selection.y;
    state.floatingPixels = {};
    resetRotationSession();
    for (let py = 0; py < state.selection.h; py++) {
      for (let px = 0; px < state.selection.w; px++) {
        const key = `${state.selection.x + px},${state.selection.y + py}`;
        if (target.pixels[key]) {
          state.floatingPixels[`${px},${py}`] = target.pixels[key];
          delete target.pixels[key];
        }
      }
    }
    // Transform previews replace floatingPixels, so retain the lift-time
    // content separately for Escape/cancel restoration.
    state.floatingBaselinePixels = { ...state.floatingPixels };
    state.floatingBaselineSel = { ...state.floatingOriginalSel };
    state.floatingBaselineTargetId = state.floatingTargetId;
    rebuildArtworkBuffer();
    rebuildFloatingBuffer();
  }

  // Transform Actions (Selection or Full Canvas)
  function rotateArtwork() {
    const cell = getArtworkCell();
    if (!cell) return;
    const targetId = state.isolatedNodeId || state.activeRegionId || state.activeLayerId || null;

    if (state.selection) {
      resetRotationSession();
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
      rebuildFloatingBuffer();
      repaintCanvas();
      renderSelectionMarquee();
      // This is a preview-only change. The original document stays untouched
      // until commitFloatingSelection(), which records exactly one history step.
      showToast(`Rotated selection 90° CW (${state.selection.w}×${state.selection.h})`);
      return;
    }

    _Tools.rotate90Clockwise(cell, state.w, state.h, targetId);
    rebuildArtworkBuffer();
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
    showToast(`Rotated canvas 90° CW (${state.w}×${state.h})`);
  }

  function flipArtworkH() {
    const cell = getArtworkCell();
    if (!cell) return;
    const targetId = state.isolatedNodeId || state.activeRegionId || state.activeLayerId || null;

    if (state.selection) {
      resetRotationSession();
      ensureFloatingSelection();
      const newFloating = {};
      const sw = state.selection.w;
      for (const relKey in state.floatingPixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const nx = sw - 1 - rx;
        newFloating[`${nx},${ry}`] = state.floatingPixels[relKey];
      }
      state.floatingPixels = newFloating;
      rebuildFloatingBuffer();
      repaintCanvas();
      renderSelectionMarquee();
      // Keep transforms transient until the selection is committed.
      showToast(`Flipped selection Horizontally`);
      return;
    }

    _Tools.flipHorizontal(cell, state.w, targetId);
    rebuildArtworkBuffer();
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
    showToast(`Flipped canvas Horizontally`);
  }

  function flipArtworkV() {
    const cell = getArtworkCell();
    if (!cell) return;
    const targetId = state.isolatedNodeId || state.activeRegionId || state.activeLayerId || null;

    if (state.selection) {
      resetRotationSession();
      ensureFloatingSelection();
      const newFloating = {};
      const sh = state.selection.h;
      for (const relKey in state.floatingPixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const ny = sh - 1 - ry;
        newFloating[`${rx},${ny}`] = state.floatingPixels[relKey];
      }
      state.floatingPixels = newFloating;
      rebuildFloatingBuffer();
      repaintCanvas();
      renderSelectionMarquee();
      // Keep transforms transient until the selection is committed.
      showToast(`Flipped selection Vertically`);
      return;
    }

    _Tools.flipVertical(cell, state.h, targetId);
    rebuildArtworkBuffer();
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
    showToast(`Flipped canvas Vertically`);
  }

  function alignArtwork(direction = 'center') {
    commitFloatingSelection();
    const cell = getArtworkCell();
    if (!cell || !cell.pixels) return;
    const targetId = state.isolatedNodeId || state.activeRegionId || state.activeLayerId || null;
    const target = (cell.layers && cell.layers.length > 0 && _Tools && typeof _Tools.getTargetForPlot === 'function')
      ? _Tools.getTargetForPlot(cell, targetId)
      : cell;
    if (!target || !target.pixels) return;

    const coords = Object.keys(target.pixels).map(k => k.split(',').map(Number));
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
    for (const k in target.pixels) {
      const [x, y] = k.split(',').map(Number);
      const nx = x + shiftX;
      const ny = y + shiftY;
      if (nx >= 0 && nx < state.w && ny >= 0 && ny < state.h) {
        newPixels[`${nx},${ny}`] = target.pixels[k];
      }
    }
    target.pixels = newPixels;
    if (target !== cell && typeof _Tools.syncCompositeIfStructured === 'function') {
      _Tools.syncCompositeIfStructured(cell);
    }
    rebuildArtworkBuffer();
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
    _Tools.nudge(cell, dx, dy, state.w, state.h, state.isolatedNodeId || state.activeRegionId || state.activeLayerId || null);
    rebuildArtworkBuffer();
    repaintCanvas();
    pushHistory();
    syncCanvasToSource();
    triggerAutosave();
  }

  // ===========================================================================
  // HISTORY (DELTA-BASED & SNAPSHOT HYBRID ENGINE)
  // ===========================================================================
  function calculatePixelDiff(prevPixels = {}, currPixels = {}) {
    const diff = {};
    for (const k in currPixels) {
      if (currPixels[k] !== prevPixels[k]) {
        diff[k] = [prevPixels[k] !== undefined ? prevPixels[k] : null, currPixels[k]];
      }
    }
    for (const k in prevPixels) {
      if (currPixels[k] === undefined) {
        diff[k] = [prevPixels[k], null];
      }
    }
    return diff;
  }

  function applyPixelDiff(pixels, diff, direction = 'forward') {
    if (!pixels || !diff) return pixels;
    const isForward = direction === 'forward';
    for (const k in diff) {
      const val = isForward ? diff[k][1] : diff[k][0];
      if (val === null || val === undefined) {
        delete pixels[k];
      } else {
        pixels[k] = val;
      }
    }
    return pixels;
  }

  function estimateHistoryMemory() {
    let bytes = 0;
    for (const item of state.history) {
      if (item.type === 'snapshot' && item.pixels) {
        bytes += Object.keys(item.pixels).length * 48 + 512;
        if (item.structuralLayers) bytes += JSON.stringify(item.structuralLayers).length * 2;
      } else if (item.type === 'diff' && item.diff) {
        bytes += Object.keys(item.diff).length * 64 + 256;
      }
    }
    if (state.lastHistoryPixels) {
      bytes += Object.keys(state.lastHistoryPixels).length * 48;
    }
    return bytes;
  }

  function rebaseOldestHistoryEntry() {
    if (state.history.length < 2) return;
    const oldest = state.history[0];
    const next = state.history[1];
    if (next.type === 'diff' && oldest.type === 'snapshot') {
      const combinedPixels = { ...(oldest.pixels || {}) };
      for (const k in next.diff) {
        const newVal = next.diff[k][1];
        if (newVal === null || newVal === undefined) delete combinedPixels[k];
        else combinedPixels[k] = newVal;
      }
      next.type = 'snapshot';
      next.pixels = combinedPixels;
      delete next.diff;
    }
    state.history.shift();
    if (state.historyIndex > 0) state.historyIndex--;
  }

  function pruneHistoryBudget() {
    // Dynamic ceiling: 50MB baseline, scaling with canvas resolution for large 1024x1024 canvases
    const MAX_BYTES = Math.max(50 * 1024 * 1024, Math.round(state.w * state.h * 80));
    while (state.history.length > 1 && (state.history.length > state.maxHistory || estimateHistoryMemory() > MAX_BYTES)) {
      rebaseOldestHistoryEntry();
    }
  }

  function pushHistory() {
    const cell = getArtworkCell();
    if (!cell) return;

    markDocumentMutation('history-step');

    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }

    const currPixels = cell.pixels || {};

    // The composite buffer cannot represent layer order, groups, visibility or
    // ownership. Structured documents therefore use complete AST snapshots;
    // flat v1.0 documents retain the efficient pixel-diff path below.
    if (cell.layers && cell.layers.length > 0) {
      const snapshot = {
        type: 'snapshot',
        w: state.w,
        h: state.h,
        title: state.title,
        revision: documentRevision,
        pixels: { ...currPixels },
        structuralLayers: JSON.parse(JSON.stringify(cell.layers))
      };
      const previous = state.history[state.historyIndex];
      if (previous && previous.structuralLayers &&
          JSON.stringify(previous.structuralLayers) === JSON.stringify(snapshot.structuralLayers) &&
          previous.title === snapshot.title) return;
      state.history.push(snapshot);
      state.historyIndex = state.history.length - 1;
      state.lastHistoryPixels = { ...currPixels };
      state.activeStrokeChanges = null;
      pruneHistoryBudget();
      return;
    }

    if (state.history.length === 0) {
      // Base history entry is always a full snapshot
      const snapshot = {
        type: 'snapshot',
        w: state.w,
        h: state.h,
        title: state.title,
        revision: documentRevision,
        pixels: { ...currPixels }
      };
      state.history.push(snapshot);
      state.historyIndex = 0;
      state.lastHistoryPixels = { ...currPixels };
      state.activeStrokeChanges = null;
      return;
    }

    const lastEntry = state.history[state.historyIndex];
    const dimChanged = !lastEntry || (lastEntry.w !== state.w || lastEntry.h !== state.h);
    const hasStrokeDiff = state.activeStrokeChanges && Object.keys(state.activeStrokeChanges).length > 0;

    if (dimChanged) {
      const snapshot = {
        type: 'snapshot',
        w: state.w,
        h: state.h,
        title: state.title,
        revision: documentRevision,
        pixels: { ...currPixels }
      };
      state.history.push(snapshot);
      state.lastHistoryPixels = { ...currPixels };
      state.activeStrokeChanges = null;
    } else if (hasStrokeDiff) {
      // Active stroke diff collected in O(K) time without scanning full canvas
      const strokeDiff = state.activeStrokeChanges;
      state.activeStrokeChanges = null;
      const strokeKeys = Object.keys(strokeDiff);

      if (strokeKeys.length <= 25000) {
        state.history.push({
          type: 'diff',
          w: state.w,
          h: state.h,
          title: state.title,
          revision: documentRevision,
          diff: strokeDiff
        });
        // Mutate baseline in-place in O(K) time to maintain continuous integrity across operations
        if (!state.lastHistoryPixels) {
          state.lastHistoryPixels = { ...currPixels };
        } else {
          for (let i = 0; i < strokeKeys.length; i++) {
            const k = strokeKeys[i];
            const newVal = strokeDiff[k][1];
            if (newVal === null || newVal === undefined) delete state.lastHistoryPixels[k];
            else state.lastHistoryPixels[k] = newVal;
          }
        }
      } else {
        state.history.push({
          type: 'snapshot',
          w: state.w,
          h: state.h,
          title: state.title,
          revision: documentRevision,
          pixels: { ...currPixels }
        });
        state.lastHistoryPixels = { ...currPixels };
      }
    } else {
      // Fallback for non-stroke tools (Bucket, Line, Rect, Circle, Clear, Paste, Script)
      state.activeStrokeChanges = null;
      if (!state.lastHistoryPixels) {
        state.lastHistoryPixels = {};
      }
      const prevPixels = state.lastHistoryPixels;
      const diff = calculatePixelDiff(prevPixels, currPixels);
      const diffKeys = Object.keys(diff);
      if (diffKeys.length === 0 && lastEntry && lastEntry.title === state.title) {
        return;
      }

      if (diffKeys.length <= 25000) {
        state.history.push({
          type: 'diff',
          w: state.w,
          h: state.h,
          title: state.title,
          revision: documentRevision,
          diff: diff
        });
        for (let i = 0; i < diffKeys.length; i++) {
          const k = diffKeys[i];
          const newVal = diff[k][1];
          if (newVal === null || newVal === undefined) delete state.lastHistoryPixels[k];
          else state.lastHistoryPixels[k] = newVal;
        }
      } else {
        state.history.push({
          type: 'snapshot',
          w: state.w,
          h: state.h,
          title: state.title,
          revision: documentRevision,
          pixels: { ...currPixels }
        });
        state.lastHistoryPixels = { ...currPixels };
      }
    }

    state.historyIndex = state.history.length - 1;
    pruneHistoryBudget();
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    const currentEntry = state.history[state.historyIndex];
    state.historyIndex--;
    const targetEntry = state.history[state.historyIndex];

    const cell = getArtworkCell();
    if (!cell) return;

    if (currentEntry.type === 'diff' && currentEntry.diff && targetEntry.w === state.w && targetEntry.h === state.h) {
      // Reverse diff in O(M) time directly onto cell.pixels
      applyPixelDiff(cell.pixels, currentEntry.diff, 'backward');
    } else {
      // Reconstruct target state from snapshots
      restoreHistorySnapshot(targetEntry);
      return;
    }

    state.w = targetEntry.w;
    state.h = targetEntry.h;
    state.title = targetEntry.title;
    if (cell.size) cell.size = { w: state.w, h: state.h };
    if (targetEntry.revision !== undefined) {
      documentRevision = targetEntry.revision;
      setDirty(documentRevision !== lastSavedRevision);
    } else {
      markDocumentMutation('undo-redo');
    }

    state.lastHistoryPixels = { ...(cell.pixels || {}) };
    if (dom && dom.dimBadge) dom.dimBadge.textContent = `${state.w}×${state.h}`;
    resizeCanvasesToZoom();
    rebuildArtworkBuffer();
    repaintCanvas();
    renderRulers();
    syncCanvasToSource(true);
    triggerAutosave();
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    const targetEntry = state.history[state.historyIndex];

    const cell = getArtworkCell();
    if (!cell) return;

    if (targetEntry.type === 'diff' && targetEntry.diff && targetEntry.w === state.w && targetEntry.h === state.h) {
      // Apply diff forwards in O(M) time directly onto cell.pixels
      applyPixelDiff(cell.pixels, targetEntry.diff, 'forward');
    } else {
      restoreHistorySnapshot(targetEntry);
      return;
    }

    state.w = targetEntry.w;
    state.h = targetEntry.h;
    state.title = targetEntry.title;
    if (cell.size) cell.size = { w: state.w, h: state.h };
    if (targetEntry.revision !== undefined) {
      documentRevision = targetEntry.revision;
      setDirty(documentRevision !== lastSavedRevision);
    } else {
      markDocumentMutation('undo-redo');
    }

    state.lastHistoryPixels = { ...(cell.pixels || {}) };
    if (dom && dom.dimBadge) dom.dimBadge.textContent = `${state.w}×${state.h}`;
    resizeCanvasesToZoom();
    rebuildArtworkBuffer();
    repaintCanvas();
    renderRulers();
    syncCanvasToSource(true);
    triggerAutosave();
  }

  function restoreHistorySnapshot(snapshot) {
    if (!snapshot) return;
    const cell = getArtworkCell();
    if (!cell) return;

    state.w = snapshot.w;
    state.h = snapshot.h;
    state.title = snapshot.title;

    if (snapshot.type === 'diff') {
      let basePixels = {};
      const targetIdx = state.history.indexOf(snapshot);
      if (targetIdx !== -1) {
        let snapIdx = targetIdx;
        while (snapIdx >= 0 && state.history[snapIdx].type !== 'snapshot') {
          snapIdx--;
        }
        if (snapIdx >= 0) {
          basePixels = { ...(state.history[snapIdx].pixels || {}) };
          for (let i = snapIdx + 1; i <= targetIdx; i++) {
            if (state.history[i].diff) applyPixelDiff(basePixels, state.history[i].diff, 'forward');
          }
        }
      }
      cell.pixels = basePixels;
    } else {
      cell.pixels = { ...(snapshot.pixels || {}) };
    }

    if (snapshot.structuralLayers !== undefined) {
      if (snapshot.structuralLayers) cell.layers = JSON.parse(JSON.stringify(snapshot.structuralLayers));
      else delete cell.layers;
    } else if (cell.layers && cell.layers.length > 0) {
      // A legacy history entry predates structural editing; it must restore
      // the original flat representation rather than leaving a newer tree.
      delete cell.layers;
    }

    cell.size = { w: state.w, h: state.h };
    if (snapshot.revision !== undefined) {
      documentRevision = snapshot.revision;
      setDirty(documentRevision !== lastSavedRevision);
    } else {
      markDocumentMutation('undo-redo');
    }

    state.lastHistoryPixels = { ...(cell.pixels || {}) };
    if (dom && dom.dimBadge) dom.dimBadge.textContent = `${state.w}×${state.h}`;
    resizeCanvasesToZoom();
    rebuildArtworkBuffer();
    repaintCanvas();
    renderRulers();
    syncCanvasToSource(true);
    triggerAutosave();
  }

  // ===========================================================================
  // AUTOSAVE & CRASH RECOVERY (IndexedDB v2 + Safe Fallback)
  // ===========================================================================
  function recoveryPayloadHasDocument(payload) {
    if (!payload) return false;
    if (typeof payload.documentSource === 'string' && payload.documentSource.trim()) return true;
    return Boolean(payload.pixels && Object.keys(payload.pixels).length > 0);
  }

  function createRecoveryPayload(extra = {}) {
    const cell = getArtworkCell();
    if (!cell || !state.doc) return null;
    return {
      schemaVersion: 3,
      w: state.w,
      h: state.h,
      title: state.title,
      revision: documentRevision,
      lastSavedRevision: lastSavedRevision,
      isDirty: state.isDirty,
      baseContentHash: hashString(normalizeForCompare(lastSavedContent)),
      // The serialized document is authoritative. `pixels` remains only for
      // backwards compatibility with v2 recovery readers.
      documentSource: _PIX2.serialize(state.doc),
      pixels: { ...(cell.pixels || {}) },
      activeLayerId: state.activeLayerId || null,
      activeRegionId: state.activeRegionId || null,
      isolatedNodeId: state.isolatedNodeId || null,
      updatedAt: Date.now(),
      ...extra
    };
  }

  function decodeRecoveryPayload(payload) {
    if (!payload) return null;

    if (typeof payload.documentSource === 'string' && payload.documentSource.trim()) {
      const doc = _PIX2.parse(payload.documentSource, { profile: 'pixelart' });
      if (!doc || !doc.cells) throw new Error('Recovery document is missing cells');
      const validation = _PIX2.validate(doc, { profile: 'pixelart', strict: false });
      if (!validation.valid) {
        throw new Error((validation.errors && validation.errors[0]) || 'Recovery document is invalid');
      }
      const cell = doc.cells.artwork || doc.cells[Object.keys(doc.cells)[0]];
      if (!cell) throw new Error('Recovery document has no editable cell');
      const size = cell.size || (doc.meta && (doc.meta.cell_size || doc.meta.cellSize)) || {};
      return {
        doc,
        cell,
        w: Math.max(1, Math.min(1024, Number(size.w || payload.w || 64))),
        h: Math.max(1, Math.min(1024, Number(size.h || payload.h || 64))),
        title: payload.title || (doc.meta && doc.meta.title) || cell.name || 'Recovered Artwork',
        legacy: false
      };
    }

    if (!payload.pixels) return null;
    const w = Math.max(1, Math.min(1024, Number(payload.w || 64)));
    const h = Math.max(1, Math.min(1024, Number(payload.h || 64)));
    const title = payload.title || 'Recovered Artwork';
    const doc = _PIX2.createDocument(title, 1, 1, w, h, { profile: 'pixelart' });
    doc.cells = {
      artwork: {
        id: 'artwork',
        name: title,
        size: { w, h },
        pixels: { ...payload.pixels }
      }
    };
    return { doc, cell: doc.cells.artwork, w, h, title, legacy: true };
  }

  function seedRecoveryHistory(revision) {
    const cell = getArtworkCell();
    if (!cell) return;
    const snapshot = {
      type: 'snapshot',
      w: state.w,
      h: state.h,
      title: state.title,
      revision,
      pixels: { ...(cell.pixels || {}) }
    };
    if (cell.layers && cell.layers.length > 0) {
      snapshot.structuralLayers = JSON.parse(JSON.stringify(cell.layers));
    }
    state.history = [snapshot];
    state.historyIndex = 0;
    state.lastHistoryPixels = { ...(cell.pixels || {}) };
    state.activeStrokeChanges = null;
  }

  function installRecoveryPayload(payload) {
    const recovered = decodeRecoveryPayload(payload);
    if (!recovered) return null;
    state.doc = recovered.doc;
    state.w = recovered.w;
    state.h = recovered.h;
    state.title = recovered.title;
    state.selection = null;
    state.floatingPixels = null;
    state.activeLayerId = payload.activeLayerId || null;
    state.activeRegionId = payload.activeRegionId || null;
    state.isolatedNodeId = payload.isolatedNodeId || null;
    if (state.doc.palette && Object.keys(state.doc.palette).length > 0) {
      state.activeSwatches = Object.values(state.doc.palette);
    }
    seedRecoveryHistory(payload.revision || 1);
    return recovered;
  }

  let autosaveTimer = null;
  function triggerAutosave(immediate = false) {
    clearTimeout(autosaveTimer);
    const execute = () => {
      const payload = createRecoveryPayload();
      if (payload) saveAutosaveToStorage(payload);
    };

    if (immediate) {
      execute();
    } else {
      autosaveTimer = setTimeout(execute, 1000);
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
  // CANVAS BACKGROUND & THEME ADAPTATION
  // ===========================================================================
  function isColorDark(hex) {
    if (!hex) return false;
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    // Standard relative luminance (YIQ)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq < 128;
  }

  function setCanvasBgMode(mode, customColor, skipSync = false) {
    state.canvasBgMode = mode;
    if (customColor) {
      state.canvasBgColor = customColor;
      if (dom.bgCustomInput) dom.bgCustomInput.value = customColor.slice(0, 7);
      if (dom.bgCustomChip) dom.bgCustomChip.style.backgroundColor = customColor;
    }
    try {
      localStorage.setItem('pix2_canvas_bg_mode', state.canvasBgMode);
      if (state.canvasBgColor) {
        localStorage.setItem('pix2_canvas_bg_color', state.canvasBgColor);
      }
    } catch (e) {}

    updateCanvasBgUi();
    repaintCanvas();
    if (!skipSync) {
      syncCanvasToSource();
    }
  }

  function updateCanvasBgUi() {
    if (!dom.btnBgTransparent) return;
    dom.btnBgTransparent.classList.toggle('active', state.canvasBgMode === 'transparent');
    dom.btnBgWhite.classList.toggle('active', state.canvasBgMode === 'white');
    dom.btnBgBlack.classList.toggle('active', state.canvasBgMode === 'black');
    dom.btnBgCustom.classList.toggle('active', state.canvasBgMode === 'custom');
    if (dom.bgCustomChip) {
      dom.bgCustomChip.style.backgroundColor = state.canvasBgColor || '#2a2e3f';
    }
  }

  // ===========================================================================
  // RESIZE CANVAS MODAL & RESOLUTION MANAGER
  // ===========================================================================
  function openResizeCanvasModal() {
    if (!dom.modalResize) return;
    if (dom.inputResizeW) dom.inputResizeW.value = state.w;
    if (dom.inputResizeH) dom.inputResizeH.value = state.h;

    const chips = dom.modalResize.querySelectorAll('.pa-preset-chip');
    chips.forEach(chip => {
      const cw = parseInt(chip.dataset.w, 10);
      const ch = parseInt(chip.dataset.h, 10);
      chip.classList.toggle('active', cw === state.w && ch === state.h);
    });

    dom.modalResize.classList.remove('hidden');
    if (dom.inputResizeW) dom.inputResizeW.focus();
  }

  function resizeCanvas(newW, newH) {
    newW = Math.max(1, Math.min(1024, parseInt(newW, 10) || 64));
    newH = Math.max(1, Math.min(1024, parseInt(newH, 10) || 64));

    if (newW === state.w && newH === state.h) {
      if (dom.modalResize) dom.modalResize.classList.add('hidden');
      return;
    }

    const cell = getArtworkCell();
    if (!cell) return;

    commitFloatingSelection();
    state.selection = null;

    state.w = newW;
    state.h = newH;
    cell.size = { w: newW, h: newH };
    if (state.doc && state.doc.meta) {
      state.doc.meta.cell_size = { w: newW, h: newH };
      state.doc.meta.grid = { columns: 1, rows: 1, default_cell: `${newW}x${newH}` };
    }

    // Clean out-of-bounds pixels if shrank
    if (cell.pixels) {
      for (const k in cell.pixels) {
        const comma = k.indexOf(',');
        if (comma === -1) continue;
        const x = Number(k.substring(0, comma));
        const y = Number(k.substring(comma + 1));
        if (x < 0 || x >= newW || y < 0 || y >= newH) {
          delete cell.pixels[k];
        }
      }
    }

    dom.dimBadge.textContent = `${state.w}×${state.h}`;
    resizeCanvasesToZoom();
    rebuildArtworkBuffer();
    repaintCanvas();
    renderRulers();
    syncCanvasToSource(true);
    pushHistory();
    triggerAutosave();
    setDirty(true);

    if (dom.modalResize) dom.modalResize.classList.add('hidden');
    showToast(`Canvas resized to ${newW}×${newH}`, 'success');
  }

  // ===========================================================================
  // PNG EXPORT ENGINE
  // ===========================================================================
  function openExportModal() {
    commitFloatingSelection();
    if (dom.exportIncludeBg) {
      dom.exportIncludeBg.checked = state.exportIncludeBg;
    }
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

    if (state.exportIncludeBg && state.canvasBgMode !== 'transparent') {
      const bg = state.canvasBgMode === 'white' ? '#ffffff' : (state.canvasBgMode === 'black' ? '#000000' : state.canvasBgColor);
      pctx.fillStyle = bg;
      pctx.fillRect(0, 0, state.w, state.h);
    }

    if (!state.artworkCanvas) rebuildArtworkBuffer();
    if (state.artworkCanvas) {
      pctx.imageSmoothingEnabled = false;
      pctx.drawImage(state.artworkCanvas, 0, 0, state.w, state.h);
    }
  }

  function downloadExportedPng() {
    commitFloatingSelection();
    const scale = state.exportScale;
    const offscreen = document.createElement('canvas');
    offscreen.width = state.w * scale;
    offscreen.height = state.h * scale;
    const ctx = offscreen.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (state.exportIncludeBg && state.canvasBgMode !== 'transparent') {
      const bg = state.canvasBgMode === 'white' ? '#ffffff' : (state.canvasBgMode === 'black' ? '#000000' : state.canvasBgColor);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    }

    if (!state.artworkCanvas) rebuildArtworkBuffer();
    if (state.artworkCanvas) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(state.artworkCanvas, 0, 0, offscreen.width, offscreen.height);
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
  let currentAiTemplate = 'portrait';
  function updateAiPromptView(template) {
    if (template) currentAiTemplate = template;
    const promptArea = document.getElementById('pa-ai-prompt-text');
    if (!promptArea) return;

    const inputW = document.getElementById('input-ai-w');
    const inputH = document.getElementById('input-ai-h');
    const specModeSelect = document.getElementById('select-ai-spec-mode');

    const targetW = (inputW && parseInt(inputW.value, 10)) ? parseInt(inputW.value, 10) : state.w;
    const targetH = (inputH && parseInt(inputH.value, 10)) ? parseInt(inputH.value, 10) : state.h;
    const isComprehensive = !specModeSelect || specModeSelect.value === 'comprehensive';

    const palList = (state.activeSwatches && state.activeSwatches.length > 0)
      ? state.activeSwatches
      : ['#1a1a24', '#ffffff', '#4f46e5', '#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

    const palMapLines = palList.map((c, i) => `  ${i + 1}: ${c}`).join('\n');

    let taskDesc = '';
    if (currentAiTemplate === 'portrait') {
      taskDesc = `Design an iconic 2D pixel art character portrait (e.g. cyber warrior, sorcerer, or roguelike champion) within a ${targetW}x${targetH} grid. Use crisp cluster shading and clean, readable silhouette.`;
    } else if (currentAiTemplate === 'item') {
      taskDesc = `Design a 2D RPG game item/weapon/icon (e.g. enchanted sword, mana potion, or legendary helm) within a ${targetW}x${targetH} grid. Ensure strong outer contours, inner specular highlights, and clear readable geometry.`;
    } else if (currentAiTemplate === 'landscape') {
      taskDesc = `Design a 2D pixel art landscape/scenery backdrop (e.g. neon cyberpunk alley, retro sunset mountains, or enchanted forest) within a ${targetW}x${targetH} grid. Create layered parallax depth with foreground, midground, and atmospheric lighting.`;
    } else if (currentAiTemplate === 'prop') {
      taskDesc = `Design a modular 2D pixel art building prop / isometric tile kit element within a ${targetW}x${targetH} grid with seamless boundary snapping and solid mass.`;
    } else {
      taskDesc = `Design a detailed 2D pixel art asset on a ${targetW}x${targetH} grid.`;
    }

    if (!isComprehensive) {
      // Compact Brief
      promptArea.value = `You are an expert pixel artist creating code for the PIX2 standard.
TASK: ${taskDesc}
CANVAS: ${targetW}x${targetH}
PALETTE:
${palMapLines}

RULES:
- Emit valid PIX2 v1.0 syntax starting with "@pix2 1.0"
- Use "@meta", "@grid", "@palette", and "@cell artwork"
- Plot pixels using "pixel x,y <palette_id>" or "pixel x,y <#hex>"
- Close with "@end"
- Output raw code inside \`\`\`pix2 ... \`\`\` without markdown commentary.`;
      return;
    }

    // Comprehensive 350+ Line PIX2 Normative Standard Specification Prompt
    promptArea.value = `You are an autonomous AI Pixel Artist and Systems Architect emitting strictly conforming PIX2 v1.0 specifications.

================================================================================
SECTION 1: THE ACTIVE PROJECT BRIEF
================================================================================
Task Objective:
${taskDesc}

Target Resolution:
- Width: ${targetW} pixels (X axis: 0 through ${targetW - 1})
- Height: ${targetH} pixels (Y axis: 0 through ${targetH - 1})
- Coordinate Origin: top-left (0,0 is the top-left pixel)
- Color Mode: "RGBA"

Standard Palette Map (1-based indices):
@palette
${palMapLines}

================================================================================
SECTION 2: NORMATIVE PIX2 LANGUAGE GRAMMAR (RFC SPECIFICATION)
================================================================================
PIX2 is a deterministic, human-readable, line-oriented domain-specific language 
designed for precision pixel art, sprite sheets, and retro graphics synthesis.
All implementations MUST strictly conform to the grammar below.

LEXICAL CONVENTIONS:
1. Whitespace: Space (' ') and Horizontal Tab ('\\t') are token separators.
2. Comments:
   - Semicolon ';' initiates a comment until end-of-line.
   - Hash '#' initiates a comment ONLY if preceded by whitespace and NOT followed 
     by 3, 4, 6, or 8 hex digits. (Valid hex color codes e.g. #4f46e5 are NEVER comments).
3. Directives start with '@' as the first non-whitespace character.
4. Identifiers: alphanumeric characters, underscores, and dashes [a-zA-Z0-9_-].
5. Numbers: base-10 integers only. Floats or exponents are forbidden in coordinates.

TOP-LEVEL STRUCTURE:
A conforming PIX2 document consists of five ordered sections terminated by @end:
  <Document> ::= <VersionDirective>
                 <MetaSection>
                 <GridSection>
                 <PaletteSection>
                 <CellSection>+
                 "@end"

1. VERSION DIRECTIVE:
   The first non-comment line of the document MUST be:
   @pix2 1.0

2. META SECTION (@meta):
   Defines global metadata fields:
   @meta
     title: "${sanitizeFilename(state.title)}"
     author: "Noiradix AI"
     version: "1.0"
     color_mode: "RGBA"
     coordinate_origin: "top-left"

3. GRID SECTION (@grid):
   Defines the sprite sheet dimensions and layout:
   @grid
     columns: 1
     rows: 1
     default_cell: ${targetW}x${targetH}
     background: none

4. PALETTE SECTION (@palette):
   Maps sequential integer identifiers to valid hexadecimal colors:
   @palette
${palMapLines}

5. CELL SECTION (@cell):
   Defines an individual artwork frame:
   @cell artwork
     name: "${sanitizeFilename(state.title)}"
     size: ${targetW}x${targetH}
     <Command>*

================================================================================
SECTION 3: CONFORMING CELL DRAWING COMMANDS
================================================================================
Inside a @cell block, pixels are defined using single or grouped primitive commands:

1. INDIVIDUAL PIXEL PLOTTING:
   Syntax: pixel <x>,<y> <color_or_id>
   Multiple pixels on the same horizontal row may be chained on a single line:
   pixel 12,14 1 pixel 13,14 1 pixel 14,14 2 pixel 15,14 2
   - <x> is integer between 0 and ${targetW - 1}
   - <y> is integer between 0 and ${targetH - 1}
   - <color_or_id> is either an integer key defined in @palette (e.g. 1) 
     or an inline hex literal (e.g. #4f46e5).

2. LINE PRIMITIVE (BRESENHAM INTERPOLATION):
   Syntax: line <x0>,<y0> <x1>,<y1> <color_or_id>
   Renders an exact Bresenham integer line between coordinates.

3. RECTANGLE PRIMITIVE:
   Syntax: rect <x>,<y> <width>x<height> <color_or_id> [outline|fill]
   - outline: strokes a 1-pixel boundary
   - fill: fills solid interior

4. FLOOD FILL PRIMITIVE:
   Syntax: fill <x>,<y> <color_or_id>
   Performs a 4-way flood fill starting at (x,y).

================================================================================
SECTION 4: ARTISTIC CONSTRAINTS & SOLID MASS MANDATE
================================================================================
To ensure the generated sprite looks professional, authentic, and game-engine ready:

1. SOLID MASS & SILHOUETTE INTEGRITY:
   - Pixel art characters and props MUST have a solid mass. Do NOT generate hollow 
     or floating isolated pixels.
   - Every interior region (skin, armor, cloth, hair) must be fully packed with 
     solid colored pixels.
   - Zero transparent pinholes inside the solid silhouette.

2. CLUSTER SHADING:
   - Group pixels into cohesive geometric clusters (patches) representing light, 
     mid-tone, and core shadow.
   - Avoid "dithering noise" or salt-and-pepper scattering unless intentionally 
     texturing rough fabric or stone.

3. ZERO ANTI-ALIASING BLUR:
   - Do NOT emit blurred semi-transparent transitions around outer contours. 
     Outlines must remain sharp and readable on both light and dark backgrounds.

================================================================================
SECTION 5: COMPLETE MINIMAL WORKED EXAMPLE
================================================================================
Below is a structurally flawless example of a 16x16 shield for your reference:

@pix2 1.0

@meta
  title: "Example Shield"
  author: "Noiradix AI"
  version: "1.0"
  color_mode: "RGBA"
  coordinate_origin: "top-left"

@grid
  columns: 1
  rows: 1
  default_cell: 16x16
  background: none

@palette
  1: #1a1c2c
  2: #566c86
  3: #94b0c2
  4: #f4f4f4
  5: #f59e0b

@cell artwork
  name: "Example Shield"
  size: 16x16
  pixel 6,2 1 pixel 7,2 1 pixel 8,2 1 pixel 9,2 1
  pixel 5,3 1 pixel 6,3 2 pixel 7,3 3 pixel 8,3 3 pixel 9,3 2 pixel 10,3 1
  pixel 4,4 1 pixel 5,4 2 pixel 6,4 4 pixel 7,4 4 pixel 8,4 3 pixel 9,4 2 pixel 10,4 2 pixel 11,4 1
  pixel 4,5 1 pixel 5,5 2 pixel 6,5 4 pixel 7,5 5 pixel 8,5 5 pixel 9,5 3 pixel 10,5 2 pixel 11,5 1
  pixel 4,6 1 pixel 5,6 2 pixel 6,6 4 pixel 7,6 5 pixel 8,6 5 pixel 9,6 3 pixel 10,6 2 pixel 11,6 1
  pixel 4,7 1 pixel 5,7 2 pixel 6,7 3 pixel 7,7 4 pixel 8,7 4 pixel 9,7 3 pixel 10,7 2 pixel 11,7 1
  pixel 4,8 1 pixel 5,8 2 pixel 6,8 3 pixel 7,8 3 pixel 8,8 3 pixel 9,8 2 pixel 10,8 2 pixel 11,8 1
  pixel 5,9 1 pixel 6,9 2 pixel 7,9 3 pixel 8,9 3 pixel 9,9 2 pixel 10,9 1
  pixel 5,10 1 pixel 6,10 2 pixel 7,10 2 pixel 8,10 2 pixel 9,10 2 pixel 10,10 1
  pixel 6,11 1 pixel 7,11 2 pixel 8,11 2 pixel 9,11 1
  pixel 6,12 1 pixel 7,12 2 pixel 8,12 1
  pixel 7,13 1 pixel 8,13 1
  pixel 7,14 1

@end

================================================================================
SECTION 6: FINAL INSTRUCTION
================================================================================
Now, synthesize the requested pixel artwork for "${taskDesc}" 
at dimension ${targetW}x${targetH}.

OUTPUT MANDATE:
Emit ONLY the raw conforming PIX2 code block inside triple backticks:
\`\`\`pix2
... your code here ...
\`\`\`
Do not include conversational greetings or postscripts.`;
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
  // PERSISTENT STORAGE (IndexedDB v2 + File System Access API)
  // ===========================================================================
  const DB_NAME = 'noiradix_pixelart_db';
  const DB_VERSION = 2;
  const STORE_FILE_HANDLES = 'file_handles';
  const STORE_AUTOSAVES = 'autosaves';
  const STORE_BACKUPS = 'backups';

  function getDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported in current environment'));
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_FILE_HANDLES)) {
          db.createObjectStore(STORE_FILE_HANDLES);
        }
        if (!db.objectStoreNames.contains(STORE_AUTOSAVES)) {
          db.createObjectStore(STORE_AUTOSAVES);
        }
        if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
          db.createObjectStore(STORE_BACKUPS);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function persistFileHandle(handle) {
    if (!handle) return;
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_FILE_HANDLES, 'readwrite');
      tx.objectStore(STORE_FILE_HANDLES).put(handle, 'current_file');
    } catch (err) {
      console.warn('Failed storing handle in IndexedDB:', err);
    }
  }

  async function retrievePersistedFileHandle() {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_FILE_HANDLES, 'readonly');
        const req = tx.objectStore(STORE_FILE_HANDLES).get('current_file');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (_) {
      return null;
    }
  }

  async function clearPersistedFileHandle() {
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_FILE_HANDLES, 'readwrite');
      tx.objectStore(STORE_FILE_HANDLES).delete('current_file');
    } catch (_) {}
  }

  async function saveAutosaveToStorage(payload) {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_AUTOSAVES, 'readwrite');
        tx.objectStore(STORE_AUTOSAVES).put(payload, 'latest_autosave');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (_) {
      try {
        _storage.setItem('pix2_pixelart_autosave', JSON.stringify(payload));
        return true;
      } catch (e) {
        console.warn('Autosave localStorage fallback failed:', e);
        return false;
      }
    }
  }

  async function retrieveAutosaveFromStorage() {
    try {
      const db = await getDb();
      const res = await new Promise((resolve) => {
        const tx = db.transaction(STORE_AUTOSAVES, 'readonly');
        const req = tx.objectStore(STORE_AUTOSAVES).get('latest_autosave');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (res) return res;
    } catch (_) {}
    try {
      const raw = _storage.getItem('pix2_pixelart_autosave');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  async function clearAutosave() {
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_AUTOSAVES, 'readwrite');
      tx.objectStore(STORE_AUTOSAVES).delete('latest_autosave');
    } catch (_) {}
    try {
      _storage.removeItem('pix2_pixelart_autosave');
    } catch (_) {}
  }

  let _lastInMemoryBackup = null;

  async function savePreReloadBackup(payload) {
    let saved = false;
    _lastInMemoryBackup = payload;
    try {
      const db = await getDb();
      saved = await new Promise((resolve) => {
        const tx = db.transaction(STORE_BACKUPS, 'readwrite');
        tx.objectStore(STORE_BACKUPS).put(payload, 'pre_reload_backup');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (_) {}
    try {
      // LocalStorage JSON cannot serialize FileSystemHandle; clone without fileHandle
      const jsonSafe = { ...payload };
      delete jsonSafe.fileHandle;
      _storage.setItem('pix2_backup_before_reload', JSON.stringify(jsonSafe));
      saved = true;
    } catch (_) {}
    return saved || Boolean(_lastInMemoryBackup);
  }

  async function getPreReloadBackup() {
    try {
      const db = await getDb();
      const res = await new Promise((resolve) => {
        const tx = db.transaction(STORE_BACKUPS, 'readonly');
        const req = tx.objectStore(STORE_BACKUPS).get('pre_reload_backup');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (res) return res;
    } catch (_) {}
    if (_lastInMemoryBackup) return _lastInMemoryBackup;
    try {
      const raw = _storage.getItem('pix2_backup_before_reload');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  async function clearPreReloadBackup() {
    _lastInMemoryBackup = null;
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_BACKUPS, 'readwrite');
      tx.objectStore(STORE_BACKUPS).delete('pre_reload_backup');
    } catch (_) {}
    try {
      _storage.removeItem('pix2_backup_before_reload');
    } catch (_) {}
  }

  async function restorePreReloadBackup() {
    const backup = await getPreReloadBackup();
    if (!recoveryPayloadHasDocument(backup)) {
      showToast('No pre-reload backup found to restore.', 'warning');
      return false;
    }
    let recovered;
    try {
      recovered = decodeRecoveryPayload(backup);
    } catch (error) {
      showToast(`Backup is invalid: ${error.message}`, 'error');
      return false;
    }
    pushHistory();
    state.doc = recovered.doc;
    state.w = recovered.w;
    state.h = recovered.h;
    state.title = recovered.title;
    state.activeLayerId = backup.activeLayerId || null;
    state.activeRegionId = backup.activeRegionId || null;
    state.isolatedNodeId = backup.isolatedNodeId || null;
    if (dom.docTitle) dom.docTitle.value = state.title;

    // Robust Document Identity Validation via W3C FileSystemHandle isSameEntry:
    // 1. If fileHandle is present in backup and currentFileHandle is present,
    //    and isSameEntry is available: use native W3C isSameEntry() to verify true file identity.
    //    This authoritatively distinguishes identical filenames across different folders,
    //    even if both files currently share identical baseline content!
    // 2. If isSameEntry() confirms it is the exact same physical file:
    //    Verify the disk baseline hash to guarantee content hasn't diverged.
    // 3. If fileHandle is absent (e.g. from fallback storage), handles are different, or
    //    isSameEntry cannot definitively confirm identity:
    //    SAFELY DETACH the file handle and restore as an independent draft ("Restored - [title]").
    //    This eliminates any possibility of cross-file overwrites.
    let isSameDocument = false;
    if (currentFileHandle && backup.fileHandle && typeof currentFileHandle.isSameEntry === 'function') {
      try {
        const isSame = await currentFileHandle.isSameEntry(backup.fileHandle);
        if (isSame && currentFileName === backup.fileName) {
          const curFile = await currentFileHandle.getFile();
          const curText = await curFile.text();
          const curHash = hashString(normalizeForCompare(curText));
          if (!backup.baseContentHash || curHash === backup.baseContentHash) {
            isSameDocument = true;
          }
        }
      } catch (_) {
        isSameDocument = false;
      }
    }

    if (!isSameDocument) {
      currentFileHandle = null;
      currentFileName = null;
      clearPersistedFileHandle();
      state.title = backup.title ? `Restored - ${backup.title}` : 'Restored Artwork';
      if (dom.docTitle) dom.docTitle.value = state.title;
    }

    const cell = getArtworkCell();
    if (cell) cell.size = { w: state.w, h: state.h };
    resizeCanvasesToZoom();
    rebuildArtworkBuffer();
    repaintCanvas();
    renderRulers();
    syncCanvasToSource(true);
    pushHistory();
    if (dom.recoveryBanner) dom.recoveryBanner.classList.add('hidden');
    await clearPreReloadBackup();
    updateDocumentTitle();
    showToast(`Restored backup from ${new Date(backup.time || Date.now()).toLocaleTimeString()}!`, 'success');
    return true;
  }

  function hashString(str) {
    if (!str) return '0';
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return (hash >>> 0).toString(16);
  }

  let currentFileHandle = null;
  let currentFileName = null;
  let lastKnownFileModified = 0;
  let lastSavedContent = '';
  let isExternalReloading = false;
  let pendingExternalConflict = null;
  let fileWatcherHeartbeatTimer = null;

  function updateDocumentTitle() {
    if (typeof document === 'undefined') return;
    const name = currentFileName || `${sanitizeFilename(state.title || 'Untitled')}.pix2`;
    document.title = state.isDirty ? `● ${name} — NOIRADIX PixelArt` : `${name} — NOIRADIX PixelArt`;
    const pathText = document.getElementById('pa-file-path-text');
    if (pathText) {
      if (currentFileName) {
        if (lastKnownFileModified === 0 && state.isDirty && !lastSavedContent) {
          pathText.textContent = `${currentFileName} (Unverified draft)`;
          pathText.title = 'Unverified session draft — not yet reconciled with disk file. Press Ctrl+S to save or Ctrl+Shift+R to reload disk version.';
        } else {
          pathText.textContent = name;
          pathText.title = `Linked to ${currentFileName}`;
        }
      } else {
        pathText.textContent = state.title ? `${state.title} (Draft)` : 'Unsaved Draft';
        pathText.title = 'In-memory draft';
      }
    }
  }

  async function openFileNative() {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'PIX2 Sprite & Images (*.pix2, *.txt, *.png, *.jpg)',
              accept: {
                'text/plain': ['.pix2', '.txt'],
                'image/*': ['.png', '.jpg', '.jpeg', '.webp']
              }
            }
          ],
          multiple: false
        });
        const file = await handle.getFile();
        if (file.name.endsWith('.pix2') || file.name.endsWith('.txt')) {
          const text = await file.text();
          let parsed;
          // Transactional validation before replacing active document
          try {
            parsed = _PIX2.parse(text, { profile: 'pixelart' });
            if (!parsed || !parsed.cells) throw new Error('Missing cells in PIX2 document.');
            const val = _PIX2.validate(parsed, { profile: 'pixelart', strict: false });
            if (!val.valid) throw new Error((val.errors && val.errors[0]) || 'Invalid PIX2 format.');
          } catch (valErr) {
            showToast(`Cannot open file: ${valErr.message}`, 'error');
            return;
          }
          const title = file.name.replace(/\.[^/.]+$/, '');
          const session = createPaProjectSession(title, parsed, handle);
          session.fileName = file.name;
          session.isDirty = false;
          state.history = [];
          state.historyIndex = -1;
          state.lastHistoryPixels = null;
          pushHistory();
          currentFileName = file.name;
          lastKnownFileModified = file.lastModified;
          lastSavedContent = text;
          pendingExternalConflict = null;
          const btnReload = document.getElementById('btn-reload-file');
          if (btnReload) {
            btnReload.classList.remove('pulse-warning');
            btnReload.title = 'Reload linked file from disk (Ctrl+Shift+R)';
          }
          await persistFileHandle(handle);
          try {
            localStorage.setItem('noiradix_pixelart_file_name', currentFileName);
            localStorage.setItem('pix2_last_saved_content', text);
            localStorage.setItem('pix2_last_saved_time', String(file.lastModified));
          } catch (_) {}
          markDocumentSaved();
          triggerAutosave(true);
          saveCurrentPaSession();
          renderPaProjectTabs();
          showToast(`Opened ${file.name} from disk!`);
          return;
        } else if (file.type.startsWith('image/')) {
          importImageToPixelArt(file);
          currentFileHandle = null;
          currentFileName = file.name;
          state.title = file.name.replace(/\.[^/.]+$/, '');
          dom.docTitle.value = state.title;
          lastKnownFileModified = 0;
          lastSavedContent = '';
          pendingExternalConflict = null;
          await clearPersistedFileHandle();
          markDocumentMutation('import-image');
          saveCurrentPaSession();
          renderPaProjectTabs();
          return;
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('File System Access API failed, falling back:', err);
      }
    }
    dom.fileInput.click();
  }

  let activeSavePromise = Promise.resolve();
  let saveSequenceCounter = 0;
  let lastCompletedSaveSeq = 0;
  let activeSaveOperations = 0;

  function saveFileNative(forceSaveAs = false) {
    commitFloatingSelection();
    const snapshotRevision = documentRevision;
    const saveSeq = ++saveSequenceCounter;
    const text = flushSourceCode();
    activeSaveOperations++;

    const doSave = async () => {
      try {
        // Prevent stale out-of-order writes if a newer queued save already completed
        if (saveSeq < lastCompletedSaveSeq && !forceSaveAs) {
          return;
        }

        // Direct overwrite to existing handle
        if (!forceSaveAs && currentFileHandle && 'createWritable' in currentFileHandle) {
          try {
            if (currentFileHandle.queryPermission) {
              const perm = await currentFileHandle.queryPermission({ mode: 'readwrite' });
              if (perm !== 'granted') {
                const req = await currentFileHandle.requestPermission({ mode: 'readwrite' });
                if (req !== 'granted') {
                  showToast('Write permission to file was denied.', 'error');
                  return;
                }
              }
            }
            const writable = await currentFileHandle.createWritable();
            await writable.write(text);
            await writable.close();
            try {
              const fresh = await currentFileHandle.getFile();
              lastKnownFileModified = fresh.lastModified;
            } catch (_) {
              lastKnownFileModified = Date.now();
            }
            lastSavedContent = text;
            pendingExternalConflict = null;
            const btnReload = document.getElementById('btn-reload-file');
            if (btnReload) {
              btnReload.classList.remove('pulse-warning');
              btnReload.title = 'Reload linked file from disk (Ctrl+Shift+R)';
            }
            await persistFileHandle(currentFileHandle);
            try {
              _storage.setItem('noiradix_pixelart_file_name', currentFileName);
              _storage.setItem('pix2_last_saved_content', text);
              _storage.setItem('pix2_last_saved_time', String(lastKnownFileModified));
            } catch (_) {}
            lastCompletedSaveSeq = Math.max(lastCompletedSaveSeq, saveSeq);
            lastSavedRevision = snapshotRevision;
            setDirty(documentRevision !== lastSavedRevision);
            triggerAutosave(true);
            showToast(`Saved to ${currentFileHandle.name}!`);
            return;
          } catch (err) {
            console.warn('Direct overwrite failed, prompting Save As:', err);
          }
        }

        // Save As via File System Access API
        if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
          try {
            const suggested = currentFileName || `${sanitizeFilename(state.title)}.pix2`;
            const handle = await window.showSaveFilePicker({
              suggestedName: suggested,
              types: [{
                description: 'PIX2 Sprite File (*.pix2)',
                accept: { 'text/plain': ['.pix2'] }
              }]
            });
            const writable = await handle.createWritable();
            await writable.write(text);
            await writable.close();
            currentFileHandle = handle;
            currentFileName = handle.name;
            state.title = handle.name.replace(/\.[^/.]+$/, '');
            if (dom.docTitle) dom.docTitle.value = state.title;
            try {
              const fresh = await handle.getFile();
              lastKnownFileModified = fresh.lastModified;
            } catch (_) {
              lastKnownFileModified = Date.now();
            }
            lastSavedContent = text;
            pendingExternalConflict = null;
            const btnReload = document.getElementById('btn-reload-file');
            if (btnReload) {
              btnReload.classList.remove('pulse-warning');
              btnReload.title = 'Reload linked file from disk (Ctrl+Shift+R)';
            }
            await persistFileHandle(handle);
            try {
              _storage.setItem('noiradix_pixelart_file_name', currentFileName);
              _storage.setItem('pix2_last_saved_content', text);
              _storage.setItem('pix2_last_saved_time', String(lastKnownFileModified));
            } catch (_) {}
            lastCompletedSaveSeq = Math.max(lastCompletedSaveSeq, saveSeq);
            lastSavedRevision = snapshotRevision;
            setDirty(documentRevision !== lastSavedRevision);
            triggerAutosave(true);
            showToast(`Saved as ${handle.name}!`);
            return;
          } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn('Save file picker failed, falling back to download:', err);
          }
        }

        // Fallback: Blob download
        savePix2File();
        lastCompletedSaveSeq = Math.max(lastCompletedSaveSeq, saveSeq);
        lastSavedRevision = snapshotRevision;
        setDirty(documentRevision !== lastSavedRevision);
        triggerAutosave(true);
      } finally {
        activeSaveOperations = Math.max(0, activeSaveOperations - 1);
      }
    };

    activeSavePromise = activeSavePromise.then(doSave, doSave);
    return activeSavePromise;
  }

  function savePix2File() {
    commitFloatingSelection();
    const text = flushSourceCode();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(state.title)}.pix2`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${sanitizeFilename(state.title)}.pix2`);
  }

  // ===========================================================================
  // DESKTOP CONTEXT MENU (RIGHT-CLICK)
  // ===========================================================================
  const contextMenu = typeof document !== 'undefined' ? document.getElementById('pa-context-menu') : null;

  function openContextMenu(x, y) {
    if (!contextMenu) return;
    contextMenu.classList.remove('hidden');

    const menuW = 215;
    const menuH = 370;
    const posX = Math.max(10, Math.min(x, window.innerWidth - menuW - 10));
    const posY = Math.max(10, Math.min(y, window.innerHeight - menuH - 10));

    contextMenu.style.left = `${posX}px`;
    contextMenu.style.top = `${posY}px`;
  }

  function closeContextMenu() {
    if (contextMenu) contextMenu.classList.add('hidden');
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!await confirmDiscardUnsavedChanges('open another file')) {
      e.target.value = '';
      return;
    }

    if (file.name.endsWith('.pix2') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        try {
          const parsed = _PIX2.parse(text, { profile: 'pixelart' });
          if (!parsed || !parsed.cells) throw new Error('Missing cells in PIX2 document.');
          const val = _PIX2.validate(parsed, { profile: 'pixelart', strict: false });
          if (!val.valid) throw new Error((val.errors && val.errors[0]) || 'Invalid PIX2 format.');
        } catch (valErr) {
          showToast(`Cannot open file: ${valErr.message}`, 'error');
          return;
        }
        state.sourcePaneMode = 'full';
        dom.codeEditor.value = text;
        const ok = applySourceCodeToCanvas();
        if (!ok) {
          showToast('Failed to apply file to canvas.', 'error');
          return;
        }
        currentFileHandle = null;
        currentFileName = file.name;
        state.title = file.name.replace(/\.[^/.]+$/, '');
        dom.docTitle.value = state.title;
        lastKnownFileModified = 0;
        lastSavedContent = text;
        pendingExternalConflict = null;
        clearPersistedFileHandle();
        try {
          localStorage.removeItem('noiradix_pixelart_file_name');
          localStorage.setItem('pix2_last_saved_content', text);
          localStorage.removeItem('pix2_last_saved_time');
        } catch (_) {}
        markDocumentSaved();
        triggerAutosave(true);
        saveCurrentPaSession();
        renderPaProjectTabs();
        showToast(`Opened ${file.name}`);
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
        // Create canvas sized to image (capped at 1024, aspect ratio preserved)
        const scale = Math.min(1, 1024 / img.width, 1024 / img.height);
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
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

        rebuildArtworkBuffer();
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
    // Rulers keep an offscreen static tick layer.  Theme changes alter every
    // cached ruler colour, so invalidate and paint now instead of waiting for
    // the next pointer move to trigger drawRulerHighlights().
    invalidateRulerCache();
    repaintCanvas();
    renderRulers();
  }

  function toggleTheme() {
    const current = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  // ===========================================================================
  // REAL-TIME FILE WATCHER & LIVE HOT-RELOAD (External AI & Disk Collaboration)
  // ===========================================================================
  function normalizeForCompare(str) {
    return (str || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  }

  async function checkAndReloadExternalFileChanges(force = false, isHeartbeat = false) {
    if (!currentFileHandle || isExternalReloading || activeSaveOperations > 0) return;
    if (typeof currentFileHandle.getFile !== 'function') return;

    try {
      isExternalReloading = true;
      const file = await currentFileHandle.getFile();
      const currentModified = file.lastModified;

      // If baseline timestamp is not yet recorded, record it and baseline content from file
      if (lastKnownFileModified === 0) {
        lastKnownFileModified = currentModified;
        const curText = await file.text();
        lastSavedContent = curText;
        try { _storage.setItem('pix2_last_saved_content', curText); } catch (_) {}

        // If the document is currently dirty (e.g. unverified session recovery), alert user if canvas diverges from disk
        if (state.isDirty) {
          const currentCanvasText = flushSourceCode();
          if (normalizeForCompare(currentCanvasText) !== normalizeForCompare(curText)) {
            showToast('Loaded session draft differs from disk version. Review canvas or press Ctrl+Shift+R to reload from disk.', 'warning');
          }
        }
        updateDocumentTitle();
        isExternalReloading = false;
        return;
      }

      // Quick timestamp optimization for periodic heartbeat polling only:
      // Periodic heartbeat skips reading file text if filesystem mtime is identical.
      // Focus, visibilitychange, and forced reloads ALWAYS verify content.
      if (isHeartbeat && currentModified === lastKnownFileModified && !force && !pendingExternalConflict && lastSavedContent) {
        isExternalReloading = false;
        return;
      }

      // Ensure lastSavedContent is hydrated from storage if not set in memory
      if (!lastSavedContent) {
        lastSavedContent = _storage.getItem('pix2_last_saved_content') || '';
      }

      const text = await file.text();
      if (!text || !text.trim()) {
        isExternalReloading = false;
        return;
      }

      const normDisk = normalizeForCompare(text);
      const normSaved = normalizeForCompare(lastSavedContent);

      // Strict content comparison:
      // If content on disk matches our last saved baseline, NO external modification occurred!
      if (normDisk === normSaved) {
        lastKnownFileModified = currentModified;
        if (pendingExternalConflict) {
          pendingExternalConflict = null;
          const btnReload = document.getElementById('btn-reload-file');
          if (btnReload) {
            btnReload.classList.remove('pulse-warning');
            btnReload.title = 'Reload linked file from disk (Ctrl+Shift+R)';
          }
        }
        isExternalReloading = false;
        return;
      }

      // Genuine External Change detected (disk content differs from saved content)
      if (state.isDirty && !force) {
        // PixelArt has unsaved edits: do NOT overwrite silently!
        showExternalConflictNotification(file, text, currentModified);
        isExternalReloading = false;
        return;
      }

      // Safe reload
      pushHistory(); // Critical! Save undo state so user can Ctrl+Z immediately if unwanted
      state.sourcePaneMode = 'full';
      dom.codeEditor.value = text;
      const ok = applySourceCodeToCanvas();
      if (ok) {
        lastKnownFileModified = currentModified;
        lastSavedContent = text;
        try {
          _storage.setItem('pix2_last_saved_content', text);
          _storage.setItem('pix2_last_saved_time', String(currentModified));
        } catch (_) {}
        pendingExternalConflict = null;
        markDocumentSaved();
        const btnReload = document.getElementById('btn-reload-file');
        if (btnReload) {
          btnReload.classList.remove('pulse-warning');
          btnReload.title = 'Reload linked file from disk (Ctrl+Shift+R)';
        }
        showToast(`⚡ Reloaded ${file.name} from disk (external update detected)!`, 'info');
      }
    } catch (err) {
      console.debug('External file check deferred:', err);
    } finally {
      isExternalReloading = false;
    }
  }

  function showExternalConflictNotification(file, newText, newModified) {
    if (pendingExternalConflict && pendingExternalConflict.modified === newModified) return;
    pendingExternalConflict = { file, text: newText, modified: newModified };

    showToast(
      `⚠️ "${file.name}" changed externally on disk! Click "Reload Disk" in status bar or Save to overwrite.`,
      'warning',
      6000
    );

    const btnReload = document.getElementById('btn-reload-file');
    if (btnReload) {
      btnReload.classList.add('pulse-warning');
      btnReload.title = `External changes detected on ${file.name}! Click to reload from disk (Ctrl+Shift+R).`;
    }
  }

  async function handleManualFileReload() {
    if (!currentFileHandle) {
      showToast('Artwork is an unsaved in-memory draft. Press Ctrl+S to save to disk first.', 'info');
      return;
    }
    if (state.isDirty) {
      // Emergency snapshot to pre-reload backup before discarding canvas edits
      const cell = getArtworkCell();
      if (cell && cell.pixels) {
        const backupPayload = createRecoveryPayload({
          docId: state.title,
          fileName: currentFileName || '',
          fileHandle: currentFileHandle || null,
          time: Date.now(),
          baseContentHash: hashString(normalizeForCompare(lastSavedContent || ''))
        });
        const backupOk = await savePreReloadBackup(backupPayload);
        if (!backupOk) {
          const proceedWithoutBackup = confirm(
            'WARNING: Could not save emergency backup to local storage or IndexedDB.\n\nProceeding will permanently discard your unsaved canvas edits. Are you sure you want to reload anyway?'
          );
          if (!proceedWithoutBackup) return;
        }
      }

      const confirmDiscard = confirm(
        `"${currentFileHandle.name}" has unsaved changes in NOIRADIX PixelArt.\n\nReloading from disk will discard your current editor edits and load the external disk version.\n\n(Tip: You can press Ctrl+Z immediately after reload to undo and recover your edits).\n\nDo you want to discard PixelArt edits and reload from disk?`
      );
      if (!confirmDiscard) return;
    }
    // Single history push on reload occurs inside checkAndReloadExternalFileChanges
    await checkAndReloadExternalFileChanges(true);
    const btnReload = document.getElementById('btn-reload-file');
    if (btnReload) {
      btnReload.classList.remove('pulse-warning');
      btnReload.title = 'Reload linked file from disk (Ctrl+Shift+R)';
    }
    pendingExternalConflict = null;
    showToast(`Reloaded ${currentFileHandle.name} from disk. (Press Ctrl+Z to undo if needed)`, 'info');
  }

  function initFileWatcher() {
    // 1. Focus listener: window gets active focus when switching from external editor/AI
    window.addEventListener('focus', () => {
      checkAndReloadExternalFileChanges(false, false);
    });

    // 2. Visibility change listener (tab becomes visible)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkAndReloadExternalFileChanges(false, false);
      }
    });

    // 3. Heartbeat polling (every 1500ms when document is active and no unsaved edits)
    if (fileWatcherHeartbeatTimer) clearInterval(fileWatcherHeartbeatTimer);
    fileWatcherHeartbeatTimer = setInterval(() => {
      if (!document.hidden && currentFileHandle && !state.isDirty) {
        checkAndReloadExternalFileChanges(false, true);
      }
    }, 1500);
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
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.viewport.addEventListener('pointercancel', () => {
      if (state.isMovingSelection || state.isScalingSelection || state.isRotatingSelection) {
        cancelFloatingSelection();
      }
    });
    dom.viewport.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY);
    });

    // Native Double-Click Isolation Mode Router (Region Select parity with Studio)
    dom.viewport.addEventListener('dblclick', (e) => {
      if (state.currentTool === 'region-select') {
        const coords = getPixelCoord(e);
        const cell = getArtworkCell();
        if (coords && cell && cell.layers) {
          const hit = findRegionAt(cell, coords.x, coords.y);
          if (hit) {
            enterIsolationMode(hit.id, hit.name || hit.id);
          } else if (state.isolatedNodeId) {
            exitIsolationMode();
          }
        }
      }
    });

    // Wheel Zoom centered on cursor
    dom.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const oldZoom = state.zoom;
      const direction = e.deltaY < 0 ? 1 : -1;
      const newZoom = getNextZoom(oldZoom, direction);
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
      renderRulers();
    }, { passive: false });

    dom.viewport.addEventListener('mouseleave', () => {
      if (!state.isDrawing && !state.isPanning && !state.isMovingSelection && !state.isRotatingSelection && !state.isSelecting) {
        dom.coordLabel.textContent = '-, -';
        updateHoverColor(null, null);
        updateRulerHighlight(null, null);
      }
    });

    // Source Code Editor Input & Escape-to-Cancel
    dom.codeEditor.addEventListener('input', handleSourceCodeInput);
    dom.codeEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isCodeEditingUnlocked) {
        e.preventDefault();
        syncCanvasToSource();
        lockCodeEditor();
        showToast('Code locked (reverted to canvas state).', 'info');
      }
    });
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
          rebuildArtworkBuffer();
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
      const val = e.target.value;
      if (val === '__new_preset__') {
        promptAndSavePalettePreset();
        return;
      }
      if (val.startsWith('custom_')) {
        const key = val.replace('custom_', '');
        const customPalettes = loadCustomPalettes();
        if (customPalettes[key] && customPalettes[key].colors) {
          state.activeSwatches = [...customPalettes[key].colors];
          renderPaletteSwatches();
          syncPaletteToDoc();
          showToast(`Loaded palette "${customPalettes[key].name}"`);
        }
        return;
      }
      const preset = PRESET_PALETTES[val];
      if (preset) {
        state.activeSwatches = [...preset];
        renderPaletteSwatches();
        syncPaletteToDoc();
      }
    });

    const btnSavePalette = document.getElementById('btn-save-palette');
    if (btnSavePalette) {
      btnSavePalette.addEventListener('click', promptAndSavePalettePreset);
    }

    // Close context menu on click outside, resize, or scroll
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#pa-context-menu')) {
        closeContextMenu();
      }
    });
    window.addEventListener('resize', closeContextMenu);
    window.addEventListener('scroll', closeContextMenu, true);

    // Desktop Context Menu Item Actions
    document.querySelectorAll('#pa-context-menu .context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        closeContextMenu();
        switch (action) {
          case 'cut': cutSelection(); break;
          case 'copy': copySelection(); break;
          case 'paste': pasteSelection(); break;
          case 'select-all': selectAll(); break;
          case 'deselect':
            commitFloatingSelection();
            state.selection = null;
            renderSelectionMarquee();
            break;
          case 'fill': fillSelection(); break;
          case 'flip-h': flipArtworkH(); break;
          case 'flip-v': flipArtworkV(); break;
          case 'rotate-90': rotateArtwork(); break;
          case 'align-center': alignArtwork('center'); break;
          case 'delete': deleteSelection(); break;
        }
      });
    });

    // Navigation & File Buttons
    document.getElementById('btn-new-canvas').addEventListener('click', () => {
      dom.modalNew.classList.remove('hidden');
    });

    document.getElementById('btn-open-file').addEventListener('click', openFileNative);
    dom.fileInput.addEventListener('change', handleFileSelected);

    document.getElementById('btn-save-pix2').addEventListener('click', () => saveFileNative(false));
    document.getElementById('btn-export-png').addEventListener('click', openExportModal);
    document.getElementById('btn-ai-assistant').addEventListener('click', () => {
      if (state.isSourceDirty) {
        syncCanvasToSource();
      }
      updateAiPromptView();
      dom.modalAi.classList.remove('hidden');
    });

    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('btn-help-modal').addEventListener('click', () => {
      dom.modalHelp.classList.remove('hidden');
    });

    if (dom.paAppVersionBadge) {
      dom.paAppVersionBadge.addEventListener('click', () => {
        if (dom.modalAboutPa) dom.modalAboutPa.classList.remove('hidden');
      });
    }

    // View Mode Toggles
    const btnSplit = document.getElementById('btn-view-split');
    const btnCanvas = document.getElementById('btn-view-canvas');
    const btnCode = document.getElementById('btn-view-code');

    function setViewMode(mode) {
      state.viewMode = mode;
      dom.workspace.classList.remove('view-canvas-only', 'view-code-only');
      btnSplit.classList.remove('active');
      btnCanvas.classList.remove('active');
      btnCode.classList.remove('active');

      if (mode === 'canvas') {
        dom.workspace.classList.add('view-canvas-only');
        btnCanvas.classList.add('active');
        dom.codePane.style.width = '';
      } else if (mode === 'code') {
        dom.workspace.classList.add('view-code-only');
        btnCode.classList.add('active');
        dom.codePane.style.width = '100%';
        if (state.isSourceDirty) {
          syncCanvasToSource(true);
        }
      } else {
        btnSplit.classList.add('active');
        dom.codePane.style.width = `${state.codePaneWidth}px`;
        if (state.isSourceDirty) {
          syncCanvasToSource(true);
        }
      }
    }

    btnSplit.addEventListener('click', () => setViewMode('split'));
    btnCanvas.addEventListener('click', () => setViewMode('canvas'));
    btnCode.addEventListener('click', () => setViewMode('code'));

    // Code Editor Lock & Edit Controls (Auto-locks on Apply, No separate Lock button)
    function unlockCodeEditor() {
      // If code editor is currently displaying summary placeholder, regenerate full source before unlocking
      if (state.sourcePaneMode === 'summary') {
        syncCanvasToSource(true);
      }
      state.isCodeEditingUnlocked = true;
      dom.codeEditor.readOnly = false;
      if (dom.codeModeBadge) {
        dom.codeModeBadge.className = 'pa-mode-badge editing';
        dom.codeModeBadge.innerHTML = '<i class="fa-solid fa-pen"></i> Editing';
        dom.codeModeBadge.title = 'Direct editing unlocked. Click "Apply" to commit changes to canvas.';
      }
      if (dom.btnToggleCodeLock) {
        dom.btnToggleCodeLock.classList.add('hidden');
      }
      if (dom.btnApplyCode) {
        dom.btnApplyCode.classList.remove('hidden');
      }
      dom.codeEditor.focus();
      showToast('Code editor unlocked for direct edits. Click "Apply" when done.');
    }

    function lockCodeEditor() {
      state.isCodeEditingUnlocked = false;
      dom.codeEditor.readOnly = true;
      if (dom.codeModeBadge) {
        dom.codeModeBadge.className = 'pa-mode-badge locked';
        dom.codeModeBadge.innerHTML = '<i class="fa-solid fa-lock"></i> View Only';
        dom.codeModeBadge.title = 'Safe View Mode (ReadOnly to prevent accidental deletion)';
      }
      if (dom.btnToggleCodeLock) {
        dom.btnToggleCodeLock.classList.remove('hidden');
      }
      if (dom.btnApplyCode) {
        dom.btnApplyCode.classList.add('hidden');
      }
    }

    if (dom.btnToggleCodeLock) {
      dom.btnToggleCodeLock.addEventListener('click', unlockCodeEditor);
    }
    if (dom.btnApplyCode) {
      dom.btnApplyCode.addEventListener('click', () => {
        const ok = applySourceCodeToCanvas();
        if (ok) {
          lockCodeEditor();
          setViewMode('canvas');
          showToast('Applied code changes to canvas!');
        }
      });
    }

    // Structure & Layers Pane Toggle & Actions (PIX2 1.1)
    // Code-only controls are intentionally hidden in the Layers context so
    // the structural workflow is not cluttered by source-editor commands.
    function setSidePaneTab(tab) {
      const showCode = tab === 'code';
      if (dom.paLayersView) dom.paLayersView.classList.toggle('hidden', showCode);
      if (dom.paCodeBody) dom.paCodeBody.classList.toggle('hidden', !showCode);
      if (dom.btnPaSideLayers) dom.btnPaSideLayers.classList.toggle('active', !showCode);
      if (dom.btnPaSideCode) dom.btnPaSideCode.classList.toggle('active', showCode);
      if (dom.codeHeader) dom.codeHeader.classList.toggle('code-context-hidden', !showCode);
      if (dom.codePane) dom.codePane.classList.toggle('side-layers-active', !showCode);
      if (!showCode) renderPaLayersTree();
    }

    if (dom.btnPaSideLayers) {
      dom.btnPaSideLayers.addEventListener('click', () => {
        setSidePaneTab('layers');
      });
    }
    if (dom.btnPaSideCode) {
      dom.btnPaSideCode.addEventListener('click', () => {
        setSidePaneTab('code');
      });
    }

    if (dom.btnPaAddLayer) {
      dom.btnPaAddLayer.addEventListener('click', () => {
        const cell = getArtworkCell();
        if (!cell) return;
        if (!cell.layers) cell.layers = [];
        const layerNum = cell.layers.length + 1;
        const name = prompt('Enter Layer Name:', `Layer ${layerNum}`);
        if (!name) return;
        prepareStructureMutation();
        const layerId = 'layer_' + Date.now().toString(36);
        const regionId = 'region_' + Date.now().toString(36);
        const newRegion = {
          type: 'region',
          id: regionId,
          cell: cell.id,
          parent: layerId,
          name: `${name.trim()} Content`,
          visible: true,
          locked: false,
          pixels: {}
        };
        const newLayer = {
          type: 'layer',
          id: layerId,
          cell: cell.id,
          name: name.trim(),
          visible: true,
          locked: false,
          opacity: 1.0,
          blend: 'normal',
          children: [newRegion]
        };
        cell.layers.push(newLayer);
        state.activeLayerId = newLayer.id;
        state.activeRegionId = newRegion.id;
        commitStructureMutation();
      });
    }

    if (dom.btnPaAddGroup) {
      dom.btnPaAddGroup.addEventListener('click', () => {
        const cell = getArtworkCell();
        if (!cell || !cell.layers || cell.layers.length === 0) return;
        const groupName = prompt('Enter Group Name:', 'New Group');
        if (!groupName) return;
        prepareStructureMutation();
        const parentLayer = cell.layers.find(l => l.id === state.activeLayerId) || cell.layers[0];
        if (!parentLayer.children) parentLayer.children = [];
        const newGroup = {
          type: 'group',
          id: 'grp_' + Date.now().toString(36),
          cell: cell.id,
          parent: parentLayer.id,
          name: groupName.trim(),
          visible: true,
          children: []
        };
        parentLayer.children.push(newGroup);
        commitStructureMutation();
      });
    }

    if (dom.btnPaAddRegion) {
      dom.btnPaAddRegion.addEventListener('click', () => {
        const cell = getArtworkCell();
        if (!cell || !cell.layers || cell.layers.length === 0) {
          if (typeof showToast === 'function') showToast('Please create a layer first');
          return;
        }
        const regionName = prompt('Enter Region Name:', 'New Region');
        if (!regionName) return;
        prepareStructureMutation();
        const parentLayer = cell.layers.find(l => l.id === state.activeLayerId) || cell.layers[0];
        if (!parentLayer.children) parentLayer.children = [];
        const newRegion = {
          type: 'region',
          id: 'region_' + Date.now().toString(36),
          cell: cell.id,
          parent: parentLayer.id,
          name: regionName.trim(),
          visible: true,
          pixels: {}
        };
        parentLayer.children.push(newRegion);
        state.activeRegionId = newRegion.id;
        commitStructureMutation();
        if (typeof showToast === 'function') showToast(`Created region: "${regionName.trim()}"`);
      });
    }

    if (dom.btnPaExitIsolation) {
      dom.btnPaExitIsolation.addEventListener('click', exitIsolationMode);
    }

    // Alignment Guide Controls
    if (dom.btnToggleGuideCenter) {
      dom.btnToggleGuideCenter.addEventListener('click', () => {
        state.guideCenter = !state.guideCenter;
        dom.btnToggleGuideCenter.classList.toggle('active', state.guideCenter);
        repaintCanvas();
      });
    }
    if (dom.btnToggleGuideV) {
      dom.btnToggleGuideV.addEventListener('click', () => {
        state.guideV = !state.guideV;
        dom.btnToggleGuideV.classList.toggle('active', state.guideV);
        repaintCanvas();
      });
    }
    if (dom.btnToggleGuideH) {
      dom.btnToggleGuideH.addEventListener('click', () => {
        state.guideH = !state.guideH;
        dom.btnToggleGuideH.classList.toggle('active', state.guideH);
        repaintCanvas();
      });
    }

    // Statusbar Controls
    dom.btnToggleGrid.addEventListener('click', () => {
      state.showGrid = !state.showGrid;
      dom.btnToggleGrid.classList.toggle('active', state.showGrid);
      repaintCanvas();
    });

    // Canvas Background Selector Controls
    if (dom.btnBgTransparent) {
      dom.btnBgTransparent.addEventListener('click', () => setCanvasBgMode('transparent'));
    }
    if (dom.btnBgWhite) {
      dom.btnBgWhite.addEventListener('click', () => setCanvasBgMode('white'));
    }
    if (dom.btnBgBlack) {
      dom.btnBgBlack.addEventListener('click', () => setCanvasBgMode('black'));
    }
    if (dom.btnBgCustom) {
      dom.btnBgCustom.addEventListener('click', () => {
        if (state.canvasBgMode === 'custom') {
          if (dom.bgCustomInput) dom.bgCustomInput.click();
        } else {
          setCanvasBgMode('custom');
          if (dom.bgCustomInput) dom.bgCustomInput.click();
        }
      });
    }
    if (dom.bgCustomInput) {
      dom.bgCustomInput.addEventListener('input', (e) => {
        setCanvasBgMode('custom', e.target.value);
      });
    }
    if (dom.exportIncludeBg) {
      dom.exportIncludeBg.addEventListener('change', (e) => {
        state.exportIncludeBg = e.target.checked;
        updateExportPreview();
      });
    }

    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      state.zoom = getNextZoom(state.zoom, 1);
      resizeCanvasesToZoom();
      repaintCanvas();
      renderRulers();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      state.zoom = getNextZoom(state.zoom, -1);
      resizeCanvasesToZoom();
      repaintCanvas();
      renderRulers();
    });
    document.getElementById('btn-zoom-fit').addEventListener('click', fitCanvasToViewport);
    document.getElementById('btn-zoom-100').addEventListener('click', () => {
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      resizeCanvasesToZoom();
      repaintCanvas();
      renderRulers();
    });

    // Toggle Canvas Rulers button
    if (dom.btnToggleRulers) {
      dom.btnToggleRulers.addEventListener('click', () => {
        state.showRulers = !state.showRulers;
        localStorage.setItem('pix2_pixelart_rulers', String(state.showRulers));
        resizeCanvasesToZoom();
        repaintCanvas();
        renderRulers();
        showToast(`Canvas Rulers: ${state.showRulers ? 'ON' : 'OFF'}`);
      });
    }

    // Dimension Badge Click / Keyboard trigger to open Resize Canvas Modal
    if (dom.dimBadge) {
      dom.dimBadge.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      dom.dimBadge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openResizeCanvasModal();
      });
      dom.dimBadge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openResizeCanvasModal();
        }
      });
    }

    // Code Header Actions
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const text = flushSourceCode();
      navigator.clipboard.writeText(text).then(() => {
        showToast('PIX2 code copied to clipboard!');
      });
    });

    document.getElementById('btn-download-pix2').addEventListener('click', () => {
      saveFileNative(false);
    });

    // Modal Close buttons
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pa-modal-backdrop').forEach(m => m.classList.add('hidden'));
      });
    });

    // Modal Backdrop click to dismiss
    document.querySelectorAll('.pa-modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.add('hidden');
      });
    });

    // New Canvas Modal confirm
    document.querySelectorAll('#modal-new-canvas .pa-preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#modal-new-canvas .pa-preset-chip').forEach(c => c.classList.remove('active'));
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
      // New Canvas creates an independent session. It must not overwrite the
      // artwork currently shown in another project tab.
      const title = 'New Artwork';
      const doc = _PIX2.createDocument(title, 1, 1, cw, ch, { profile: 'pixelart' });
      doc.meta.title = title;
      createPaProjectSession(title, doc, null);
      state.history = [];
      state.historyIndex = -1;
      state.lastHistoryPixels = null;
      pushHistory();
      currentFileHandle = null;
      currentFileName = null;
      lastKnownFileModified = 0;
      lastSavedContent = '';
      pendingExternalConflict = null;
      const btnReload = document.getElementById('btn-reload-file');
      if (btnReload) {
        btnReload.classList.remove('pulse-warning');
        btnReload.title = 'Reload linked file from disk (Ctrl+Shift+R)';
      }
      updateDocumentTitle();
      markDocumentSaved();
      renderPaProjectTabs();
      dom.modalNew.classList.add('hidden');
      setTimeout(fitCanvasToViewport, 50);
    });

    // Resize Canvas Modal confirm & preset chips
    document.querySelectorAll('#modal-resize-canvas .pa-preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#modal-resize-canvas .pa-preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const pw = parseInt(chip.dataset.w, 10);
        const ph = parseInt(chip.dataset.h, 10);
        if (dom.inputResizeW) dom.inputResizeW.value = pw;
        if (dom.inputResizeH) dom.inputResizeH.value = ph;
      });
    });

    if (dom.btnConfirmResizeCanvas) {
      dom.btnConfirmResizeCanvas.addEventListener('click', () => {
        const rw = parseInt(dom.inputResizeW ? dom.inputResizeW.value : state.w, 10) || state.w;
        const rh = parseInt(dom.inputResizeH ? dom.inputResizeH.value : state.h, 10) || state.h;
        resizeCanvas(rw, rh);
      });
    }

    const onResizeKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const rw = parseInt(dom.inputResizeW ? dom.inputResizeW.value : state.w, 10) || state.w;
        const rh = parseInt(dom.inputResizeH ? dom.inputResizeH.value : state.h, 10) || state.h;
        resizeCanvas(rw, rh);
      }
    };
    if (dom.inputResizeW) dom.inputResizeW.addEventListener('keydown', onResizeKeydown);
    if (dom.inputResizeH) dom.inputResizeH.addEventListener('keydown', onResizeKeydown);

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

    // AI Dimension & Configuration Controls
    const inputAiW = document.getElementById('input-ai-w');
    const inputAiH = document.getElementById('input-ai-h');
    const selectAiMode = document.getElementById('select-ai-spec-mode');
    const btnAiSync = document.getElementById('btn-ai-sync-dim');

    if (inputAiW) inputAiW.addEventListener('input', () => updateAiPromptView());
    if (inputAiH) inputAiH.addEventListener('input', () => updateAiPromptView());
    if (selectAiMode) selectAiMode.addEventListener('change', () => updateAiPromptView());

    if (btnAiSync) {
      btnAiSync.addEventListener('click', () => {
        if (inputAiW) inputAiW.value = state.w;
        if (inputAiH) inputAiH.value = state.h;
        document.querySelectorAll('.pa-ai-ratio-btn').forEach(btn => {
          btn.classList.toggle('active', parseInt(btn.dataset.w, 10) === state.w && parseInt(btn.dataset.h, 10) === state.h);
        });
        updateAiPromptView();
      });
    }

    document.querySelectorAll('.pa-ai-ratio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pa-ai-ratio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (inputAiW) inputAiW.value = btn.dataset.w;
        if (inputAiH) inputAiH.value = btn.dataset.h;
        updateAiPromptView();
      });
    });

    document.getElementById('btn-copy-ai-prompt').addEventListener('click', () => {
      const promptText = document.getElementById('pa-ai-prompt-text').value;
      navigator.clipboard.writeText(promptText).then(() => {
        showToast('AI Prompt copied! Paste into ChatGPT, Claude or your agent.');
      });
    });

    document.getElementById('btn-confirm-ai-inject').addEventListener('click', injectAiCodeToCanvas);

    // Title input with real-time filename synchronization
    function syncDocTitle(val) {
      const cleanTitle = (val || 'Pixel Artwork').trim();
      state.title = cleanTitle;
      const cleanFileName = `${sanitizeFilename(cleanTitle)}.pix2`;
      currentFileName = cleanFileName;

      dom.docTitle.value = cleanTitle;
      const pathText = document.getElementById('pa-file-path-text');
      if (pathText) {
        pathText.textContent = cleanFileName;
      }

      // Detach handle if renamed so next Save prompts Save As
      if (currentFileHandle && currentFileHandle.name !== cleanFileName) {
        currentFileHandle = null;
        clearPersistedFileHandle();
      }

      if (state.doc && state.doc.meta) {
        state.doc.meta.title = cleanTitle;
        const cell = getArtworkCell();
        if (cell) cell.name = cleanTitle;
        syncCanvasToSource();
        triggerAutosave();
      }
      setDirty(true);
    }

    dom.docTitle.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const cleanFileName = `${sanitizeFilename(val || 'artwork')}.pix2`;
      state.title = val || 'artwork';
      currentFileName = cleanFileName;
      const pathText = document.getElementById('pa-file-path-text');
      if (pathText) {
        pathText.textContent = cleanFileName;
      }
      setDirty(true);
    });

    dom.docTitle.addEventListener('change', (e) => {
      syncDocTitle(e.target.value);
    });

    const filePathPill = document.getElementById('pa-file-path-pill');
    if (filePathPill) {
      filePathPill.addEventListener('click', () => {
        const name = currentFileName || `${sanitizeFilename(state.title)}.pix2`;
        navigator.clipboard.writeText(name).then(() => {
          showToast(`Copied "${name}" to clipboard!`);
        });
      });
    }

    initFileWatcher();

    const btnReloadFile = document.getElementById('btn-reload-file');
    if (btnReloadFile) {
      btnReloadFile.addEventListener('click', handleManualFileReload);
    }

    // Real-time window beforeunload watcher
    window.addEventListener('beforeunload', (e) => {
      triggerAutosave(true);
      if (state.isDirty || (!currentFileHandle && state.doc && Object.keys(getArtworkCell()?.pixels || {}).length > 0)) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Pre-Reload Backup Banner Actions
    if (dom.btnRestoreBackup) {
      dom.btnRestoreBackup.addEventListener('click', restorePreReloadBackup);
    }
    if (dom.btnDismissBackup) {
      dom.btnDismissBackup.addEventListener('click', () => {
        if (dom.recoveryBanner) dom.recoveryBanner.classList.add('hidden');
        clearPreReloadBackup();
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't intercept shortcuts when typing in inputs or editor (except Ctrl+S)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          saveFileNative(true);
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          saveFileNative(false);
        }
        return;
      }

      // Space Navigation (Tap auto-center, Space+drag pan, Shift+Space fit)
      if (e.code === 'Space' || e.key === ' ') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        if (e.shiftKey) {
          fitCanvasToViewport();
          return;
        }
        if (!state.isSpaceDown && !e.repeat) {
          state.isSpaceDown = true;
          state.didPanWithSpace = false;
          state.spaceDownTime = performance.now();
          if (dom.viewport && !state.isPanning) {
            dom.viewport.style.cursor = 'grab';
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        selectAll();
      } else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveFileNative(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveFileNative(false);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        openFileNative();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        handleManualFileReload();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
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
        fillSelection();
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
        if (state.isolatedNodeId) {
          exitIsolationMode();
          return;
        }
        closeContextMenu();
        cancelFloatingSelection();
        showToast('Selection cancelled; original pixels restored');
      } else if (e.key === 'Enter') {
        commitFloatingSelection();
        renderSelectionMarquee();
      } else if (e.key === 'm' || e.key === 'M' || ((e.key === 'v' || e.key === 'V') && !e.shiftKey)) {
        selectTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        if (e.shiftKey) {
          state.symH = !state.symH;
          document.getElementById('btn-toggle-sym-h').classList.toggle('active', state.symH);
          repaintCanvas();
          showToast(`Horizontal Symmetry ${state.symH ? 'ON' : 'OFF'}`);
        } else {
          selectTool('pan');
        }
      } else if ((e.key === 'v' || e.key === 'V') && e.shiftKey) {
        state.symV = !state.symV;
        document.getElementById('btn-toggle-sym-v').classList.toggle('active', state.symV);
        repaintCanvas();
        showToast(`Vertical Symmetry ${state.symV ? 'ON' : 'OFF'}`);
      } else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
        // S = Bilateral symmetry toggle (both H and V together)
        const nextState = !(state.symH && state.symV);
        state.symH = nextState;
        state.symV = nextState;
        document.getElementById('btn-toggle-sym-h').classList.toggle('active', state.symH);
        document.getElementById('btn-toggle-sym-v').classList.toggle('active', state.symV);
        repaintCanvas();
        showToast(`Bilateral Symmetry ${nextState ? 'ON' : 'OFF'}`);
      } else if (e.key === 'i' || e.key === 'I') {
        selectTool('picker');
      } else if (e.key === 'p' || e.key === 'P') {
        selectTool('pan');
      } else if (e.key === 'x' || e.key === 'X') {
        swapColors();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (state.isSpaceDown) {
          const duration = performance.now() - (state.spaceDownTime || 0);
          state.isSpaceDown = false;
          if (dom.viewport && !state.isPanning) {
            dom.viewport.style.cursor = state.currentTool === 'pan' ? 'grab' : 'crosshair';
          }
          // Space tap (< 200ms without dragging): auto-center canvas in viewport, preserving zoom level
          if (duration < 200 && !state.didPanWithSpace && !e.shiftKey) {
            centerCanvasInViewport(true);
          }
        }
      }
    });

    window.addEventListener('blur', () => {
      state.isSpaceDown = false;
      if (state.isMovingSelection || state.isScalingSelection || state.isRotatingSelection) {
        cancelFloatingSelection();
      }
      if (state.isPanning) {
        state.isPanning = false;
        if (dom.viewport) dom.viewport.style.cursor = state.currentTool === 'pan' ? 'grab' : 'crosshair';
      }
    });

    // Multi-File Drag & Drop Tabs Router (.pix2, .txt, images)
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!e.dataTransfer) return;

      // Extract FileSystemFileHandle if available via W3C File System Access API
      const handleMap = new Map();
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          if (typeof item.getAsFileSystemHandle === 'function') {
            try {
              const handle = await item.getAsFileSystemHandle();
              if (handle && handle.kind === 'file') {
                handleMap.set(handle.name, handle);
              }
            } catch (_) {}
          }
        }
      }

      if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

      const files = Array.from(e.dataTransfer.files);
      const pix2Files = files.filter(f => f.name.toLowerCase().endsWith('.pix2') || f.name.toLowerCase().endsWith('.txt'));
      const imageFiles = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name));

      // 1. Ingest PIX2 documents into independent project tabs
      if (pix2Files.length > 0) {
        for (const pf of pix2Files) {
          try {
            const text = await pf.text();
            const doc = _PIX2.parse(text, { profile: 'pixelart' });
            const handle = handleMap.get(pf.name) || null;
            const session = createPaProjectSession(pf.name.replace(/\.[^/.]+$/, ''), doc, handle);
            session.fileName = pf.name;
            session.isDirty = false;
            renderPaProjectTabs();
            showToast(`Opened ${pf.name} as tab!`, 'success');
          } catch (err) {
            showToast(`Error parsing ${pf.name}: ${err.message}`, 'error');
          }
        }
      }

      // 2. Ingest raster image files
      if (imageFiles.length > 0) {
        for (const imgFile of imageFiles) {
          try {
            importImageToPixelArt(imgFile);
            showToast(`Imported ${imgFile.name}!`, 'success');
          } catch (err) {
            showToast(`Error importing ${imgFile.name}: ${err.message}`, 'error');
          }
        }
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
  if (_hasDocument) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Export production functions for Node.js / automated audit test suites
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      state,
      dom,
      PRESET_PALETTES,
      getMaxAllowedZoom,
      resizeCanvasesToZoom,
      centerCanvasInViewport,
      fitCanvasToViewport,
      renderRulers,
      drawRulerHighlights,
      updateRulerHighlight,
      invalidateRulerCache,
      calculatePixelDiff,
      applyPixelDiff,
      pushHistory,
      undo,
      redo,
      restoreHistorySnapshot,
      pruneHistoryBudget,
      rebaseOldestHistoryEntry,
      estimateHistoryMemory,
      normalizeForCompare,
      saveFileNative,
      saveAutosaveToStorage,
      retrieveAutosaveFromStorage,
      clearAutosave,
      recoveryPayloadHasDocument,
      createRecoveryPayload,
      decodeRecoveryPayload,
      installRecoveryPayload,
      savePreReloadBackup,
      getPreReloadBackup,
      restorePreReloadBackup,
      clearPreReloadBackup,
      flushSourceCode,
      setDirty,
      markDocumentMutation,
      markDocumentSaved,
      confirmDiscardUnsavedChanges,
      hashString,
      createNewDocument,
      getArtworkCell,
      getActiveEditingTarget,
      prepareStructureMutation,
      ensureFloatingSelection,
      commitFloatingSelection,
      cancelFloatingSelection,
      resetRotationSession,
      checkAndReloadExternalFileChanges,
      handleManualFileReload,
      getCurrentFileHandle: () => currentFileHandle,
      setCurrentFileHandle: (h) => { currentFileHandle = h; },
      getCurrentFileName: () => currentFileName,
      setCurrentFileName: (n) => { currentFileName = n; },
      getRulerStaticTop: () => rulerStaticTop,
      getRulerStaticLeft: () => rulerStaticLeft,
      setRulerStaticTop: (v) => { rulerStaticTop = v; },
      setRulerStaticLeft: (v) => { rulerStaticLeft = v; },
      getLastSavedContent: () => lastSavedContent,
      getLastKnownFileModified: () => lastKnownFileModified,
      setLastKnownFileModified: (t) => { lastKnownFileModified = t; },
      enterIsolationMode,
      exitIsolationMode,
      findRegionAt,
      findNodeById,
      createPaProjectSession,
      switchPaProjectSession,
      closePaProjectSession,
      renderPaLayersTree,
      renderPaProjectTabs
    };
  }
})();
