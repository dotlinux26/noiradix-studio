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
  const regionSelection = _hasDocument ? RegionSelection.create() : null;
  let brushSettings;
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
  const _Viewport = typeof NoiraViewport !== 'undefined' ? NoiraViewport : require('../../js/viewport-pan-zoom.js');
  const _EditorCanvas = typeof EditorCanvas !== 'undefined' ? EditorCanvas : require('../../js/editor-canvas.js');
  const _EditorRulers = typeof EditorRulers !== 'undefined' ? EditorRulers : require('../../js/editor-rulers.js');
  const _SelectionTransform = typeof SelectionTransform !== 'undefined' ? SelectionTransform : require('../../js/selection-transform.js');
  const _PaletteLibrary = typeof EditorPaletteLibrary !== 'undefined' ? EditorPaletteLibrary : require('../../js/editor-palette-library.js');
  const _FloatingSelection = typeof EditorFloatingSelection !== 'undefined' ? EditorFloatingSelection : require('../../js/editor-floating-selection.js');
  const _FileSave = typeof EditorFileSave !== 'undefined' ? EditorFileSave : require('../../js/editor-file-save.js');
  const _Version = typeof NOIRADIX_VERSION !== 'undefined' ? NOIRADIX_VERSION : require('../../js/version.js');
  const _PalettePresets = typeof EditorPalettePresets !== 'undefined' ? EditorPalettePresets : require('../../js/editor-palette-presets.js');
  const PRESET_PALETTES = _PalettePresets.create('pixelart');


  const paletteLibrary = _PaletteLibrary.create({
    storage: _storage,
    getSelect: () => dom.paletteSelect,
    builtIns: [
      { id: 'noiradix', name: 'Noiradix Classic', count: PRESET_PALETTES.noiradix.length },
      { id: 'pico8', name: 'PICO-8', count: PRESET_PALETTES.pico8.length },
      { id: 'endesga32', name: 'Endesga 32', count: PRESET_PALETTES.endesga32.length },
      { id: 'gameboy', name: 'Game Boy', count: PRESET_PALETTES.gameboy.length },
      { id: 'sweetie16', name: 'Sweetie 16', count: PRESET_PALETTES.sweetie16.length },
      { id: 'solarenvy', name: 'Solar Envy', count: PRESET_PALETTES.solarenvy.length },
      { id: 'dawnbringer16', name: 'DawnBringer 16', count: PRESET_PALETTES.dawnbringer16.length },
      { id: 'dawnbringer32', name: 'DawnBringer 32', count: PRESET_PALETTES.dawnbringer32.length },
      { id: 'nes54', name: 'NES 54', count: PRESET_PALETTES.nes54.length }
    ],
    actionLabel: '+ Save Current Palette to Library...',
    fallback: 'noiradix'
  });
  const { load: loadCustomPalettes, save: saveCustomPalettes, populate: populatePaletteDropdown } = paletteLibrary;

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

    document.title = _Version.documentTitle(_Version.pixelart, state.doc ? fileName : null, dirty || !isLinked);

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

  // ===========================================================================
  // PIXELART MULTI-DOCUMENT PROJECT SESSIONS & STRUCTURE ENGINE (PIX2 1.1)
  // ===========================================================================
  let paProjectSessions = [];
  let activePaProjectId = null;
  const PA_WORKSPACE_KEY = 'noiradix_pixelart_open_sessions';

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
    persistPaWorkspace();
  }

  function renderPaProjectTabs() {
    if (!_hasDocument) return;
    NoiraTabStrip.render(document.getElementById('pa-project-tabs-strip'), paProjectSessions, activePaProjectId, {
      onActivate: switchPaProjectSession,
      onClose: closePaProjectSession,
      onReorder: reorderPaProjectSessions
    });
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
    cur.lastKnownFileModified = lastKnownFileModified;
    cur.lastSavedContent = lastSavedContent;
    cur.pendingExternalConflict = pendingExternalConflict;
    cur.activeLayerId = state.activeLayerId;
    cur.activeRegionId = state.activeRegionId;
  }

  function persistPaWorkspace() {
    if (!_hasDocument || state.floatingPixels) return false;
    try {
      saveCurrentPaSession();
      return EditorWorkspaceStorage.write(PA_WORKSPACE_KEY, {
        activeId: activePaProjectId,
        sessions: paProjectSessions.map(session => ({
          id: session.id,
          title: session.title,
          fileName: session.fileName,
          linked: Boolean(session.fileHandle),
          revision: session.revision,
          lastSavedRevision: session.lastSavedRevision,
          isDirty: session.isDirty,
          baseContentHash: hashString(normalizeForCompare(session.lastSavedContent || '')),
          activeLayerId: session.activeLayerId,
          activeRegionId: session.activeRegionId,
          documentSource: _PIX2.serialize(session.doc)
        }))
      });
    } catch (error) {
      console.warn('Could not persist open artwork tabs:', error);
      return false;
    }
  }

  function restorePaWorkspace(workspace, activeSession) {
    if (!Array.isArray(workspace?.sessions) || !workspace.sessions.length) return false;
    const sessions = [];
    for (const item of workspace.sessions) {
      if (item.id === activeSession?.id) {
        sessions.push(activeSession);
        continue;
      }
      try {
        const recovered = decodeRecoveryPayload(item);
        if (!recovered) continue;
        const session = new PaProjectSession(item.id, recovered.title, recovered.doc, null, item.fileName);
        session.w = recovered.w;
        session.h = recovered.h;
        session.revision = item.revision || 0;
        session.lastSavedRevision = item.lastSavedRevision || 0;
        session.isDirty = Boolean(item.isDirty);
        session.activeLayerId = item.activeLayerId || null;
        session.activeRegionId = item.activeRegionId || null;
        session.history = [recoveryHistoryEntry(recovered.cell, session.w, session.h, session.title, session.revision)];
        session.historyIndex = 0;
        session.lastHistoryPixels = { ...recovered.cell.pixels };
        sessions.push(session);
      } catch (error) {
        console.warn('Could not restore artwork tab:', item.fileName, error);
      }
    }
    if (!sessions.length) return false;
    paProjectSessions = sessions;
    activePaProjectId = null;
    const selected = sessions.find(session => session.id === workspace.activeId) || sessions[0];
    switchPaProjectSession(selected.id);
    return true;
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

  function preparePaProjectSwitch() {
    if (!_hasDocument || !state.isCodeEditingUnlocked) return true;
    clearTimeout(state.sourceDebounceTimer);
    if (state.sourcePaneMode !== 'summary' && !applySourceCodeToCanvas()) return false;
    lockCodeEditor();
    return true;
  }

  function switchPaProjectSession(sessionId) {
    const target = paProjectSessions.find(p => p.id === sessionId);
    if (!target || activePaProjectId === sessionId) return;
    if (!preparePaProjectSwitch()) return;

    if (state.floatingPixels) commitFloatingSelection();
    regionSelection?.reset();
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
    lastKnownFileModified = target.lastKnownFileModified || 0;
    lastSavedContent = target.lastSavedContent || '';
    pendingExternalConflict = target.pendingExternalConflict || null;
    state.activeLayerId = target.activeLayerId || null;
    state.activeRegionId = target.activeRegionId || null;

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
    updatePaEmptyWorkspaceUI();
    syncCanvasToSource();
    persistPaWorkspace();

    // Ensure the new tab is scrolled into view (fixes first-click tab not visible)
    if (typeof requestAnimationFrame !== 'undefined' && typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        const strip = document.getElementById('pa-project-tabs-strip');
        const newTab = strip?.querySelector(`[data-tab-id="${sessionId}"]`);
        if (newTab) newTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    }
  }

  function updatePaEmptyWorkspaceUI() {
    if (!_hasDocument) return;
    const emptyWorkspace = document.getElementById('pa-empty-workspace');
    const isEmpty = (!state.doc || paProjectSessions.length === 0);
    if (emptyWorkspace) {
      emptyWorkspace.style.display = isEmpty ? 'flex' : 'none';
    }
    const toolbar = document.getElementById('pa-toolbar');
    const canvasPane = document.getElementById('pa-canvas-pane');
    const resizer = document.getElementById('pa-split-resizer');
    const codePane = document.getElementById('pa-code-pane');
    if (toolbar) toolbar.style.display = isEmpty ? 'none' : 'flex';
    if (canvasPane) canvasPane.style.display = isEmpty ? 'none' : 'flex';
    if (resizer) resizer.style.display = isEmpty ? 'none' : '';
    if (codePane) codePane.style.display = isEmpty ? 'none' : 'flex';

    if (isEmpty) {
      document.title = _Version.documentTitle(_Version.pixelart);
      if (dom && dom.docTitle) dom.docTitle.value = '';
      if (dom && dom.dimBadge) dom.dimBadge.textContent = '0×0';
    } else {
      updateDocumentTitle();
    }
  }

  function loadSamplePixelArt() {
    const title = 'Sample Ghost Art';
    const doc = _PIX2.createDocument(title, 1, 1, 32, 32, { profile: 'pixelart' });
    const cell = _Tools.getTargetForPlot(Object.values(doc.cells)[0]);
    if (cell) {
      // Draw a cute ghost silhouette in pixel art
      const cWhite = '#f8fafc';
      const cCyan = '#38bdf8';
      const cShadow = '#64748b';
      const cEye = '#0f172a';
      // Body shape
      for (let y = 8; y <= 22; y++) {
        for (let x = 10; x <= 22; x++) {
          cell.pixels[`${x},${y}`] = cWhite;
        }
      }
      // Top round head
      for (let x = 12; x <= 20; x++) {
        cell.pixels[`${x},7`] = cWhite;
      }
      for (let x = 14; x <= 18; x++) {
        cell.pixels[`${x},6`] = cWhite;
      }
      // Eyes
      cell.pixels['13,12'] = cEye;
      cell.pixels['14,12'] = cEye;
      cell.pixels['13,13'] = cEye;
      cell.pixels['14,13'] = cEye;
      cell.pixels['18,12'] = cEye;
      cell.pixels['19,12'] = cEye;
      cell.pixels['18,13'] = cEye;
      cell.pixels['19,13'] = cEye;
      // Cheeks
      cell.pixels['11,15'] = '#f43f5e';
      cell.pixels['21,15'] = '#f43f5e';
      // Ghost ripples / feet
      for (let x = 10; x <= 22; x++) {
        if (x % 3 !== 0) cell.pixels[`${x},23`] = cShadow;
      }
      // Wisps
      cell.pixels['8,11'] = cCyan;
      cell.pixels['7,12'] = cCyan;
      cell.pixels['24,11'] = cCyan;
      cell.pixels['25,12'] = cCyan;
    }
    if (!createPaProjectSession(title, doc)) return;
    showToast('Loaded Sample Ghost Artwork!', 'success');
    setTimeout(fitCanvasToViewport, 50);
  }

  function createPaProjectSession(title, doc, fileHandle = null) {
    if (!preparePaProjectSwitch()) return null;
    saveCurrentPaSession();

    const cell = (doc && doc.cells) ? (doc.cells.artwork || Object.values(doc.cells)[0]) : null;
    const docW = (cell && cell.size && cell.size.w) || doc?.meta?.cellSize?.w || state.w || 64;
    const docH = (cell && cell.size && cell.size.h) || doc?.meta?.cellSize?.h || state.h || 64;

    const newId = 'pa_proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const session = new PaProjectSession(newId, title, doc, fileHandle);
    session.w = docW;
    session.h = docH;
    paProjectSessions.push(session);
    _storage.removeItem('noiradix_pixelart_closed_workspace');
    switchPaProjectSession(newId);
    pushHistory(true);
    return session;
  }

  function closePaProjectSession(sessionOrId) {
    const session = (typeof sessionOrId === 'object' && sessionOrId !== null)
      ? sessionOrId
      : paProjectSessions.find(p => p.id === sessionOrId);
    if (!session) return;
    if (session.id === activePaProjectId) {
      if (!preparePaProjectSwitch()) return;
      saveCurrentPaSession();
    }


    if (session.isDirty) {
      const confirmDiscard = confirm(`Artwork "${session.fileName || session.title}" has unsaved changes. Discard and close?`);
      if (!confirmDiscard) return;
    }

    const isClosingActive = (activePaProjectId === session.id);
    if (isClosingActive) regionSelection?.reset();
    const idx = paProjectSessions.indexOf(session);
    if (idx !== -1) {
      paProjectSessions.splice(idx, 1);
    }

    // Immediately purge and release RAM references from discarded session
    session.doc = null;
    session.history = [];
    session.lastSavedContent = '';
    session.fileHandle = null;
    session.selection = null;
    session.lastHistoryPixels = null;

    if (paProjectSessions.length === 0) {
      activePaProjectId = null;
      state.doc = null;
      state.history = [];
      state.historyIndex = -1;
      state.selection = null;
      state.lastHistoryPixels = null;
      state.isolatedNodeId = null;
      currentFileHandle = null;
      currentFileName = null;
      lastSavedContent = '';
      floatingSession.clear();
      state.floatingOriginalSel = null;
      state.isMovingSelection = false;

      // Clear canvas buffers to free GPU/RAM memory
      if (dom && dom.canvasMain) {
        const ctx = dom.canvasMain.getContext('2d');
        ctx.clearRect(0, 0, dom.canvasMain.width, dom.canvasMain.height);
      }
      if (dom && dom.canvasPreview) {
        const pctx = dom.canvasPreview.getContext('2d');
        pctx.clearRect(0, 0, dom.canvasPreview.width, dom.canvasPreview.height);
      }

      // Keep an intentionally empty workspace across reload and remove its active recovery data.
      clearTimeout(autosaveTimer);
      _storage.setItem('noiradix_pixelart_closed_workspace', 'true');
      _storage.removeItem('noiradix_pixelart_file_name');
      _storage.removeItem('pix2_last_saved_content');
      _storage.removeItem('pix2_last_saved_time');
      clearAutosave();
      clearPersistedFileHandle();
      state.artworkCanvas = null;
      state.artworkCtx = null;
      if (dom.codeEditor) dom.codeEditor.value = '';

      state.title = 'Pixel Artwork';
      renderPaProjectTabs();
      updatePaEmptyWorkspaceUI();
    } else if (isClosingActive) {
      activePaProjectId = null;
      const nextSession = paProjectSessions[Math.min(idx, paProjectSessions.length - 1)];
      switchPaProjectSession(nextSession.id);
    } else {
      renderPaProjectTabs();
    }
    persistPaWorkspace();
  }

  function enterIsolationMode(nodeId, breadcrumb) {
    const cell = getArtworkCell();
    const match = _StructureOps.findNode(cell, nodeId);
    if (!_StructureOps.isEditable(match)) return;
    if (state.floatingPixels) commitFloatingSelection();
    state.selection = null;
    state.activeLayerId = match.layer.id;
    if (match.node.type === 'region') state.activeRegionId = nodeId;
    state.isolatedNodeId = nodeId;
    regionSelection?.focus(cell, state.activeLayerId, nodeId, [nodeId]);
    if (_hasDocument) renderPaLayersTree();
    updateIsolationBannerUI(breadcrumb);
    rebuildArtworkBuffer();
    repaintCanvas();
    renderSelectionMarquee();
    if (typeof showToast === 'function') showToast(`Entered isolation mode: ${breadcrumb || nodeId}`);
  }

  function exitIsolationMode() {
    if (!state.isolatedNodeId) return;
    if (state.floatingPixels) commitFloatingSelection();
    state.selection = null;
    const cell = getArtworkCell();
    const match = _StructureOps.findNode(cell, state.isolatedNodeId);
    state.isolatedNodeId = null;
    if (match) {
      state.activeLayerId = match.layer.id;
      if (match.node.type === 'region') state.activeRegionId = match.node.id;
      regionSelection?.focus(cell, state.activeLayerId, null, [(match.path[1] || match.node).id]);
    }
    selectTool('region-select');
    if (_hasDocument) renderPaLayersTree();
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
    return _StructureOps.hitRegion(cell, x, y, state.activeLayerId, state.isolatedNodeId)?.node || null;
  }

  function findNodeById(cell, id) {
    return _StructureOps.findNode(cell, id)?.node || null;
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

    EditorOutliner.render(container, cell, state, {
      before: prepareStructureMutation,
      selected: () => regionSelection.resolve(cell, state.activeLayerId, state.isolatedNodeId).map(node => node.id),
      focus: ({ node }, extend) => {
        if (extend && node.type !== 'layer') {
          selectTool('region-select');
          const selected = regionSelection.toggle(cell, state.activeLayerId, state.isolatedNodeId, node.id);
          renderSelectionMarquee();
          return selected;
        }
        const ids = node.type === 'layer' ? [] : [node.id];
        regionSelection.focus(cell, state.activeLayerId, state.isolatedNodeId, ids);
        renderSelectionMarquee();
        return ids;
      },
      change: () => {
        updateIsolationBannerUI();
        commitStructureMutation();
        renderSelectionMarquee();
      },
      isolate: node => {
        enterIsolationMode(node.id, node.name || node.id);
        selectTool('region-select');
      },
      exitIsolation: exitIsolationMode,
      selectContent: ({ node }) => {
        const bounds = _StructureOps.bounds(node);
        if (!bounds) return;
        prepareStructureMutation();
        selectTool('select');
        state.selection = bounds;
        renderSelectionMarquee();
      }
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

  // DOM Elements Cache
  const dom = {};

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================
  async function init() {
    EditorToolbar.mount(document.getElementById('pa-toolbar'));
    cacheDom();
    initTheme();
    initPanelWidth();
    bindEvents();

    if (dom.codeEditor) {
      dom.codeEditor.readOnly = true;
    }

    const intentionallyEmpty = _storage.getItem('noiradix_pixelart_closed_workspace') === 'true';
    const workspace = intentionallyEmpty ? null : await EditorWorkspaceStorage.read(PA_WORKSPACE_KEY);
    const activeDraft = workspace?.sessions?.find(item => item.id === workspace.activeId);
    let documentRestored = false;
    let autosavePayload = activeDraft || (intentionallyEmpty ? null : await retrieveAutosaveFromStorage());
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
      const persisted = intentionallyEmpty || (activeDraft && !activeDraft.linked) ? null : await retrievePersistedFileHandle();
      if (persisted && (!activeDraft || activeDraft.fileName === persisted.name)) {
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

        if (activeDraft && autosaveHasUnsavedEdits && !autosaveMatchesDiskBaseline) {
          // Keep this browser draft detached when its disk baseline cannot be verified.
          currentFileHandle = null;
          currentFileName = null;
          lastSavedContent = '';
          lastKnownFileModified = 0;
          throw new Error('Browser draft baseline differs from disk');
        }

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
    if (!documentRestored && !intentionallyEmpty) {
      createNewDocument(64, 64, 'Pixel Artwork');
    }

    populatePaletteDropdown();
    renderPaletteSwatches();
    updateUi();
    updateCanvasBgUi();
    updateAiPromptView();
    updateDocumentTitle();

    // Initialize PaProjectSession for current document
    if (paProjectSessions.length === 0 && state.doc) {
      const initialSession = new PaProjectSession(activeDraft?.id || 'pa_initial', state.title || 'Pixel Artwork', state.doc, currentFileHandle, activeDraft?.fileName || currentFileName);
      initialSession.w = state.w;
      initialSession.h = state.h;
      initialSession.isDirty = state.isDirty;
      initialSession.revision = documentRevision;
      initialSession.lastSavedRevision = lastSavedRevision;
      initialSession.history = [...state.history];
      initialSession.historyIndex = state.historyIndex;
      initialSession.lastHistoryPixels = state.lastHistoryPixels;
      initialSession.lastSavedContent = lastSavedContent;
      initialSession.lastKnownFileModified = lastKnownFileModified;
      initialSession.activeLayerId = state.activeLayerId;
      initialSession.activeRegionId = state.activeRegionId;
      paProjectSessions.push(initialSession);
      activePaProjectId = initialSession.id;
      restorePaWorkspace(workspace, documentRestored ? initialSession : null);
    }
    renderPaProjectTabs();
    renderPaLayersTree();
    updatePaEmptyWorkspaceUI();

    // Responsive Drag & Mouse-Wheel Horizontal Scroll across all horizontal bars
    enableHorizontalDragScroll(document.querySelector('.pa-header'));
    enableHorizontalDragScroll(document.querySelector('.pa-canvas-statusbar'));
    enableHorizontalDragScroll(document.querySelector('.pa-palette-deck'));
    enableHorizontalDragScroll(document.querySelector('.pa-swatches-scroll'));
    enableHorizontalDragScroll(document.querySelector('.pa-code-header'));
    enableHorizontalDragScroll(document.querySelector('.pa-code-statusbar'));
    window.NoiraViewport.enableHorizontalDragScroll(document.querySelector('.pa-structure-actions'),
      'pa-is-dragging', { dragFromButtons: true });

    // Responsive Drag & Mouse-Wheel Vertical Scroll
    window.NoiraViewport.enableVerticalDragScroll(document.getElementById('pa-toolbar'),
      'pa-is-dragging', { dragFromButtons: true });

    // Fit canvas to viewport
    setTimeout(fitCanvasToViewport, 50);

    // Periodic Autosave every 20 seconds
    setInterval(triggerAutosave, 20000);
  }

  function enableHorizontalDragScroll(container) {
    window.NoiraViewport.enableHorizontalDragScroll(container, 'pa-is-dragging');
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
  function createNewDocument(w = 64, h = 64, title = 'Pixel Artwork', options = {}) {
    state.w = Math.max(1, Math.min(1024, w));
    state.h = Math.max(1, Math.min(1024, h));
    state.title = title || 'Pixel Artwork';
    state.selection = null;

    // Construct canonical PIX2 document
    const doc = _PIX2.createDocument(state.title, 1, 1, state.w, state.h, { ...options, profile: 'pixelart' });
    doc.meta.title = state.title;
    doc.meta.author = 'PixelArt User';
    doc.meta.color_mode = 'RGBA';
    doc.meta.coordinate_origin = 'top-left';

    // Populate palette
    doc.palette = {};
    state.activeSwatches.forEach((hex, idx) => {
      doc.palette[String(idx + 1)] = hex;
    });

    state.doc = doc;
    state.history = [];
    state.historyIndex = -1;
    pushHistory(true);

    if (dom && dom.dimBadge) dom.dimBadge.textContent = `${state.w}×${state.h}`;
    if (dom && dom.docTitle) dom.docTitle.value = state.title;

    resizeCanvasesToZoom();
    rebuildArtworkBuffer();
    repaintCanvas();
    renderRulers();
    syncCanvasToSource();
    triggerAutosave();

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

    const displayPixels = state.isolatedNodeId && _StructureOps.findNode(cell, state.isolatedNodeId)
      ? _PIX2.compositeCellLayers(cell, { w: state.w, h: state.h }, { isolatedNodeId: state.isolatedNodeId, dimNonIsolated: 0 })
      : cell.pixels;
    _EditorCanvas.drawPixels(actx, displayPixels, state.w, state.h);
  }

  function plotPixelOnBuffer(px, py, color) {
    if (!state.artworkCtx) return;
    if (px < 0 || px >= state.w || py < 0 || py >= state.h) return;
    _EditorCanvas.writePixel(state.artworkCtx, px, py, color);
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

    let totalW = Math.max(1, Math.round(state.w * state.zoom));
    let totalH = Math.max(1, Math.round(state.h * state.zoom));

    // Defensive canvas backing buffer allocation with safe fallback
    try {
      _EditorCanvas.resize(dom.canvasMain, totalW, totalH);
      _EditorCanvas.resize(dom.canvasPreview, totalW, totalH);
    } catch (e) {
      console.warn('Canvas allocation failed, falling back to safe zoom:', e);
      state.zoom = Math.max(1, Math.floor(4096 / Math.max(state.w, state.h)));
      totalW = Math.max(1, Math.round(state.w * state.zoom));
      totalH = Math.max(1, Math.round(state.h * state.zoom));
      _EditorCanvas.resize(dom.canvasMain, totalW, totalH);
      _EditorCanvas.resize(dom.canvasPreview, totalW, totalH);
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
    if (dom.rulerTop) _EditorRulers.sizeRuler(dom.rulerTop, totalW, false, dpr);
    if (dom.rulerLeft) _EditorRulers.sizeRuler(dom.rulerLeft, totalH, true, dpr);
    if (dom.btnToggleRulers) dom.btnToggleRulers.classList.toggle('active', state.showRulers);
    updateContainerTransform();
  }

  function getVisibleCanvasBounds() {
    return _EditorCanvas.visibleBounds(dom.canvasMain, dom.viewport, state.w, state.h, state.zoom);
  }

  function repaintCanvas() {
    if (!dom || !dom.ctxMain) return;
    const ctx = dom.ctxMain;
    const zoom = state.zoom;
    const bounds = getVisibleCanvasBounds();
    const { minX, maxX, minY, maxY } = bounds;
    const slice = _EditorCanvas.artworkSlice(bounds, state.w, state.h, zoom);
    const { x: renderX, y: renderY, width: renderW, height: renderH } = slice;
    if (renderW <= 0 || renderH <= 0) return;
    const background = state.canvasBgMode === 'transparent'
      ? _EditorCanvas.checker(ctx, zoom, document.body.classList.contains('dark-theme'))
      : state.canvasBgMode === 'custom' ? state.canvasBgColor || '#2a2e3f'
      : state.canvasBgMode === 'black' ? '#000000' : '#ffffff';
    if (!state.artworkCanvas) rebuildArtworkBuffer();
    _EditorCanvas.paintArtwork(ctx, state.artworkCanvas, slice, background);

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

    rulerStaticTop ??= document.createElement('canvas');
    rulerStaticLeft ??= document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const dark = document.body.classList.contains('dark-theme');
    const { minX, maxX, minY, maxY } = getVisibleCanvasBounds();
    _EditorRulers.paintRuler(rulerStaticTop, state.w, state.zoom, false, dpr, dark, minX, maxX);
    _EditorRulers.paintRuler(rulerStaticLeft, state.h, state.zoom, true, dpr, dark, minY, maxY);
    drawRulerHighlights();
  }

  function drawRulerHighlights() {
    if (!dom.rulerTop || !dom.rulerLeft || !state.showRulers || !rulerStaticTop || !rulerStaticLeft) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { w, h, zoom, selection, _hoverX, _hoverY } = state;
    _EditorRulers.drawOverlay(dom.rulerTop, rulerStaticTop, w, zoom, false, dpr, _hoverX, selection?.x, selection?.w);
    _EditorRulers.drawOverlay(dom.rulerLeft, rulerStaticLeft, h, zoom, true, dpr, _hoverY, selection?.y, selection?.h);
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
    if (state.currentTool === 'region-select' && dom.ctxPreview) {
      regionSelection.draw(dom.ctxPreview, state.zoom, getArtworkCell(), state.activeLayerId, state.isolatedNodeId);
    }
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

    }
    SelectionTransform.drawHandles(ctx, state.selection, zoom);
    ctx.restore();
  }

  function isOverRotationHandle(e) {
    const rect = state.cachedCanvasRect || dom.canvasMain.getBoundingClientRect();
    return SelectionTransform.hitTestSelectionHandles(state.selection, e.clientX - rect.left,
      e.clientY - rect.top, state.zoom) === 'rot';
  }

  function resetRotationSession() {
    floatingSession.resetRotation();
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
    const rotation = floatingSession.beginRotation(state.selection);
    state.rotationSessionPixels = rotation.pixels;
    state.rotationSessionSel = rotation.bounds;
    state.rotationAccumulatedAngle = rotation.angle;
    state.rotationGestureBaseAngle = rotation.angle;
    state.rotationBaseFloatingPixels = rotation.pixels;
    state.rotationBaseSel = rotation.bounds;
    return true;
  }

  function getMaxAllowedZoom() {
    return _Viewport.artworkZoomLimit(state.w, state.h);
  }

  function getNextZoom(currentZoom, direction) {
    return _Viewport.stepArtworkZoom(currentZoom, direction, state.w, state.h);
  }

  function updateContainerTransform() {
    if (dom && dom.container) {
      dom.container.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
    }
    if (dom && dom.zoomLabel) {
      dom.zoomLabel.textContent = _Viewport.formatArtworkZoom(state.zoom);
      dom.zoomLabel.title = `Zoom limit for this canvas: ${getMaxAllowedZoom()}×`;
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
    const padding = state.showRulers ? 64 : 40;
    const { clientWidth, clientHeight } = dom.viewport;
    if (clientWidth <= padding || clientHeight <= padding) return;
    state.zoom = _Viewport.fitArtworkZoom(clientWidth, clientHeight, state.w, state.h, padding);
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

      // If cell has large pixel count (> 30,000), prevent 1,000,000 line textarea DOM layout freezes
      const numPixels = cell.pixels ? Object.keys(cell.pixels).length : 0;
      if (numPixels > 30000 && !force) {
        state.sourcePaneMode = 'summary';
        dom.codeEditor.value = `@pix2 ${state.doc.meta.version}\n@meta\n  title: "${state.doc.meta.title || 'Artwork'}"\n  size: ${state.w}x${state.h}\n\n@cell artwork\n  size: ${state.w}x${state.h}\n  ; [Status: ${numPixels.toLocaleString()} pixels - Full code hidden for maximum UI responsiveness]\n  ; [Artwork data, saving, and PNG export remain 100% intact]\n`;
        updateCodeGutter();
        updatePixelCount();
        dom.syncBadge.className = 'pa-sync-badge synced';
        dom.syncBadge.innerHTML = '<i class="fa-solid fa-circle"></i> Synced';
        dom.diagnosticPill.className = 'pa-diagnostic-pill clean';
        dom.diagnosticPill.innerHTML = `<i class="fa-solid fa-check"></i> PIX2 v${state.doc.meta.version}`;
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
      dom.diagnosticPill.innerHTML = `<i class="fa-solid fa-check"></i> PIX2 v${state.doc.meta.version}`;
    } finally {
      state.isSyncingFromCanvas = false;
    }
  }

  function flushSourceCode() {
    // If the user is actively editing code in unlocked editor (and not in summary mode), return editor text
    if (state.isCodeEditingUnlocked && dom && dom.codeEditor && dom.codeEditor.value && state.sourcePaneMode !== 'summary') {
      return dom.codeEditor.value;
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
      const parsedDoc = _PIX2.parseValidated(source, { profile: 'pixelart' });
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
        const previousSerialized = _PIX2.serialize(state.doc);
        const nextSerialized = _PIX2.serialize(parsedDoc);
        if (previousSerialized === nextSerialized) {
          lockCodeEditor();
          return true;
        }
        state.doc = parsedDoc;
      if (!_StructureOps.findNode(getArtworkCell(), state.activeLayerId)) state.activeLayerId = null;
      if (!_StructureOps.findNode(getArtworkCell(), state.activeRegionId)) state.activeRegionId = null;
      if (!_StructureOps.findNode(getArtworkCell(), state.isolatedNodeId)) state.isolatedNodeId = null;
      renderPaLayersTree();
      updateIsolationBannerUI();

      // Extract artwork title
      if (parsedDoc.meta && parsedDoc.meta.title) {
        state.title = parsedDoc.meta.title;
        if (dom.docTitle) dom.docTitle.value = state.title;
      }

      // Extract artwork dimensions
      const cell = getArtworkCell();
      const size = cell?.size || parsedDoc.meta.cellSize;
      if (size) {
        if (size.w !== state.w || size.h !== state.h) {
          state.w = Math.max(1, Math.min(1024, size.w));
          state.h = Math.max(1, Math.min(1024, size.h));
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
      dom.diagnosticPill.innerHTML = `<i class="fa-solid fa-check"></i> PIX2 v${state.doc.meta.version}`;

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

    // Paint the backing surface before applying RGBA so a replacement stroke
    // blends with the checkerboard, rather than with the previous pixel.
    if (color === null || color.length === 9 || color.length === 5) {
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
        dom.ctxMain.fillStyle = _EditorCanvas.checker(dom.ctxMain, zoom, isDark);
        dom.ctxMain.fillRect(x, y, sz, sz);
      }
    }
    if (color !== null) {
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

  function paintRaster(cell, color, emitPixels) {
    const structured = Boolean(cell.layers?.length);
    const target = getActiveEditingTarget(cell);
    const { keys: changed, diff } = _Tools.editRaster(target,
      { w: state.w, h: state.h, color, recordDiff: !structured }, emitPixels);
    if (!changed.size) return false;
    if (structured) {
      const display = _EditorCanvas.updateComposite(_PIX2, cell, state, changed, state.isolatedNodeId);
      for (const key of changed) {
        const [x, y] = key.split(',').map(Number);
        const displayedColor = display[key] || null;
        plotPixelOnBuffer(x, y, displayedColor);
        renderPixelDirect(x, y, displayedColor);
      }
    } else {
      for (const key of changed) {
        const [oldVal, nextVal] = diff[key];
        if (state.activeStrokeChanges) {
          if (!state.activeStrokeChanges[key]) state.activeStrokeChanges[key] = [oldVal, nextVal];
          else state.activeStrokeChanges[key][1] = nextVal;
        }
        const [x, y] = key.split(',').map(Number);
        plotPixelOnBuffer(x, y, nextVal);
        renderPixelDirect(x, y, nextVal);
      }
    }
    return true;
  }

  function paintBrush(cell, tool, x0, y0, x1, y1) {
    const erasing = tool === 'eraser';
    const color = erasing ? null : _Tools.brushColor(state.primaryColor, brushSettings.opacity);
    if (!erasing && !color) return;
    const size = erasing ? brushSettings.eraserSize : brushSettings.size;
    if (paintRaster(cell, color, plot => _Tools.brushStroke(x0, y0, x1, y1, size, state, plot))) {
      state.brushStrokeChanged = true;
    }
  }

  function shapeOptions(event) {
    return { w: state.w, h: state.h, symH: state.symH, symV: state.symV,
      shift: event.shiftKey, center: event.altKey };
  }

  function regionPointerView(event) {
    const rect = dom.canvasMain.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, zoom: state.zoom, shift: event.shiftKey };
  }

  function getBrushPoint(event) {
    const size = state.currentTool === 'pen' ? brushSettings.size : brushSettings.eraserSize;
    return _Tools.brushPoint(regionPointerView(event), size, state);
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
    if (document.activeElement.matches('input, textarea, select')) {
      document.activeElement.blur();
    }

    const cell = getArtworkCell();
    if (!cell) return;

    let { x, y } = getPixelCoord(e);
    if (state.currentTool === 'region-select') {
      if (e.altKey) return;
      const extend = e.shiftKey || e.ctrlKey || e.metaKey;
      const hit = regionSelection.start(cell, state.activeLayerId, state.isolatedNodeId, { x, y }, extend, regionPointerView(e));
      if (hit && !state.activeLayerId) {
        state.activeLayerId = hit.layer.id;
        regionSelection.start(cell, state.activeLayerId, state.isolatedNodeId, { x, y }, extend, regionPointerView(e));
      }
      if (hit) state.activeRegionId = hit.node.id;
      renderPaLayersTree();
      renderSelectionMarquee();
      return;
    }
    state.isDrawing = true;
    const isStrokeTool = (state.currentTool === 'pen' || state.currentTool === 'eraser');
    if (isStrokeTool) ({ x, y } = getBrushPoint(e));
    state.activeStrokeChanges = isStrokeTool ? {} : null;
    state.brushStrokeChanged = false;
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
      const documentAtClick = state.doc;
      const targetId = state.isolatedNodeId || state.activeRegionId || state.activeLayerId;
      const size = { w: state.w, h: state.h, targetId };
      const isHuge = (state.w * state.h >= 262144);
      if (isHuge) {
        showToast(`Filling ${state.w}×${state.h} (${(state.w * state.h).toLocaleString()} pixels)...`, 'info');
        dom.viewport.style.cursor = 'wait';
      }
      setTimeout(() => {
        if (state.doc !== documentAtClick || (state.isolatedNodeId || state.activeRegionId || state.activeLayerId) !== targetId) {
          dom.viewport.style.cursor = 'crosshair';
          return;
        }
        _Tools.floodFill(cell, x, y, activeColor, size);
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
    if (isStrokeTool) paintBrush(cell, state.currentTool, x, y, x, y);
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

    if (state.currentTool === 'region-select' && !state.isPanning) {
      regionSelection.move(getPixelCoord(e), regionPointerView(e));
      const hit = overCanvas && findRegionAt(getArtworkCell(), x, y);
      dom.viewport.style.cursor = hit ? 'move' : 'crosshair';
      renderSelectionMarquee();
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

    if ((state.currentTool === 'pen' || state.currentTool === 'eraser') && !state.isPanning) {
      if (overCanvas || state.isDrawing) ({ x, y } = getBrushPoint(e));
      renderSelectionMarquee();
      if (overCanvas) {
        const size = state.currentTool === 'pen' ? brushSettings.size : brushSettings.eraserSize;
        _Tools.drawBrushOutline(dom.ctxPreview, x, y, size, state, state.zoom);
      }
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
      if (x === state.lastX && y === state.lastY) return;
      paintBrush(cell, state.currentTool, state.lastX, state.lastY, x, y);
      state.lastX = x;
      state.lastY = y;
    } else if (['line', 'rect', 'rect-fill', 'circle', 'circle-fill'].includes(state.currentTool)) {
      clearPreviewCanvas();
      const drawn = new Set();
      dom.ctxPreview.fillStyle = activeColor;
      _Tools.shapePixels(state.currentTool, state.dragStartX, state.dragStartY, x, y, shapeOptions(e), (px, py) => {
        const key = `${px},${py}`;
        if (drawn.has(key)) return;
        drawn.add(key);
        dom.ctxPreview.fillRect(px * state.zoom, py * state.zoom, state.zoom, state.zoom);
      });
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

    if (state.currentTool === 'region-select' && e.button === 0) {
      const cell = getArtworkCell();
      if (cell && regionSelection.release(cell, state.activeLayerId, state.isolatedNodeId, state, prepareStructureMutation, showToast)) {
        commitStructureMutation();
      }
      renderSelectionMarquee();
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
        const rotated = floatingSession.rotate(theta);
        if (!rotated) return;
        state.selection = { ...rotated.bounds };
        state.rotationAccumulatedAngle = theta;
        rebuildFloatingBuffer();

        const deg = Math.round((theta * 180) / Math.PI);
        showToast(`Selection rotation: ${deg}°`);
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

    if (['line', 'rect', 'rect-fill', 'circle', 'circle-fill'].includes(state.currentTool)) {
      paintRaster(cell, activeColor, plot =>
        _Tools.shapePixels(state.currentTool, state.dragStartX, state.dragStartY, x, y, shapeOptions(e), plot));
    }
    repaintCanvas();

    renderSelectionMarquee();

    // Flush final coordinate and hover display
    if (isEventOverCanvas(e)) {
      dom.coordLabel.textContent = `${x}, ${y}`;
      updateHoverColor(x, y);
      updateRulerHighlight(x, y);
    }

    // Canvas -> Code sync and history push strictly on Pointer Up when artwork modified
    const isBrush = state.currentTool === 'pen' || state.currentTool === 'eraser';
    if (isBrush && !state.brushStrokeChanged) state.activeStrokeChanges = null;
    if (state.currentTool !== 'select' && (!isBrush || state.brushStrokeChanged)) {
      pushHistory();
      syncCanvasToSource();
      triggerAutosave();
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

  const floatingSession = _FloatingSelection.create({
    get pixels() { return state.floatingPixels; }, set pixels(value) { state.floatingPixels = value; },
    get originalBounds() { return state.floatingOriginalSel; }, set originalBounds(value) { state.floatingOriginalSel = value; },
    get baselinePixels() { return state.floatingBaselinePixels; }, set baselinePixels(value) { state.floatingBaselinePixels = value; },
    get baselineBounds() { return state.floatingBaselineSel; }, set baselineBounds(value) { state.floatingBaselineSel = value; },
    get targetId() { return state.floatingTargetId; }, set targetId(value) { state.floatingTargetId = value; },
    get baselineTargetId() { return state.floatingBaselineTargetId; }, set baselineTargetId(value) { state.floatingBaselineTargetId = value; },
    get x() { return state.floatingCurrentX; }, set x(value) { state.floatingCurrentX = value; },
    get y() { return state.floatingCurrentY; }, set y(value) { state.floatingCurrentY = value; }
  });

  function commitFloatingSelection() {
    if (!state.floatingPixels || !state.selection) return;
    const cell = getArtworkCell();
    const result = floatingSession.commit(state.doc, state.selection, state);
    _EditorCanvas.refreshSourceComposite(_PIX2, result.restored);
    if (result.status === 'committed') {
      rebuildArtworkBuffer();
      pushHistory();
      repaintCanvas();
      syncCanvasToSource();
      triggerAutosave();
    }
    floatingSession.clear();
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
    const restored = floatingSession.cancel();
    _EditorCanvas.refreshSourceComposite(_PIX2, restored);
    if (restored) rebuildArtworkBuffer();

    floatingSession.clear();
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
    const copiedPixels = _SelectionTransform.copyPixels(target, { x, y, w, h });

    state.clipboard = { w, h, pixels: copiedPixels };
    showToast(`Copied ${Object.keys(copiedPixels).length} pixels (${w}×${h})`);
  }

  function cutSelection() {
    copySelection();
    deleteSelection();
  }

  function deleteSelection() {
    if (state.floatingPixels) {
      floatingSession.clear();
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
    floatingSession.paste(state.doc, getArtworkCell(), target, state.selection, state.clipboard.pixels);
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

    floatingSession.clear();
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
    state.floatingOriginalSel = { ...state.selection };
    state.floatingTargetId = target === cell ? null : target.id;
    state.floatingCurrentX = state.selection.x;
    state.floatingCurrentY = state.selection.y;
    resetRotationSession();
    const lifted = floatingSession.lift(state.doc, cell, target, state.floatingOriginalSel);
    if (!lifted) return;
    state.floatingPixels = lifted.pixels;
    state.floatingBaselinePixels = lifted.baselinePixels;
    state.floatingBaselineSel = lifted.baselineBounds;
    state.floatingBaselineTargetId = state.floatingTargetId;
    rebuildArtworkBuffer();
    rebuildFloatingBuffer();
  }

  // Transform Actions (Selection or Full Canvas)
  function rotateArtwork() {
    const cell = getArtworkCell();
    if (!cell) return;
    const targetId = state.isolatedNodeId || state.activeRegionId || state.activeLayerId || null;

    if (state.currentTool === 'region-select' && regionSelection.resolve(cell, state.activeLayerId, state.isolatedNodeId).length) {
      if (!regionSelection.rotate90(cell, state.activeLayerId, state.isolatedNodeId, state, prepareStructureMutation)) {
        showToast('Selected regions cannot rotate within this canvas');
        return;
      }
      commitStructureMutation();
      renderSelectionMarquee();
      return;
    }

    if (state.selection) {
      const bounds = { ...state.selection };
      const next = SelectionTransform.quarterTurnBounds(bounds, state);
      if (!next) {
        showToast('Rotated selection would exceed the canvas size');
        return;
      }
      resetRotationSession();
      ensureFloatingSelection();
      if (!state.floatingPixels) {
        showToast('Select an editable layer or region');
        return;
      }
      floatingSession.rotate90(bounds, state);
      state.selection = { ...next };
      rebuildFloatingBuffer();
      repaintCanvas();
      renderSelectionMarquee();
      showToast(`Rotated selection 90° CW (${next.w}×${next.h})`);
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
      if (!floatingSession.flip(state.selection, true)) return;
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
      if (!floatingSession.flip(state.selection, false)) return;
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
    if (_Tools.alignRaster(getActiveEditingTarget(), state, direction)) {
      commitStructureMutation();
    }
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

  function pushHistory(initial = false) {
    const cell = getArtworkCell();
    if (!cell) return;

    const currPixels = cell.pixels || {};
    const previousEntry = state.history[state.historyIndex];
    let pendingDiff = null;
    // Decide whether the command changed artwork BEFORE dirtying the document
    // or discarding redo. View focus and repeated no-op commands are not edits.
    if (previousEntry && previousEntry.w === state.w && previousEntry.h === state.h &&
        previousEntry.title === state.title) {
      let unchanged = false;
      if (cell.layers?.length) {
        unchanged = Boolean(previousEntry.structuralLayers) &&
          JSON.stringify(previousEntry.structuralLayers) === JSON.stringify(cell.layers);
      } else if (!previousEntry.structuralLayers) {
        pendingDiff = state.activeStrokeChanges || calculatePixelDiff(state.lastHistoryPixels || {}, currPixels);
        unchanged = Object.values(pendingDiff).every(([before, after]) => before === after);
      }
      if (unchanged) {
        state.activeStrokeChanges = null;
        return;
      }
    }

    if (!initial) markDocumentMutation('history-step');

    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }

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
    const dimChanged = !lastEntry || Boolean(lastEntry.structuralLayers) ||
      (lastEntry.w !== state.w || lastEntry.h !== state.h);
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
      const diff = pendingDiff || calculatePixelDiff(prevPixels, currPixels);
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
    if (!_StructureOps.findNode(cell, state.activeLayerId)) state.activeLayerId = null;
    if (!_StructureOps.findNode(cell, state.activeRegionId)) state.activeRegionId = null;
    if (!_StructureOps.findNode(cell, state.isolatedNodeId)) state.isolatedNodeId = null;

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
    if (_hasDocument) {
      renderPaLayersTree();
      updateIsolationBannerUI();
    }
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
    state.history = [recoveryHistoryEntry(cell, state.w, state.h, state.title, revision)];
    state.historyIndex = 0;
    state.lastHistoryPixels = { ...(cell.pixels || {}) };
    state.activeStrokeChanges = null;
  }

  function recoveryHistoryEntry(cell, w, h, title, revision) {
    const snapshot = {
      type: 'snapshot',
      w,
      h,
      title,
      revision,
      pixels: { ...(cell.pixels || {}) }
    };
    if (cell.layers && cell.layers.length > 0) {
      snapshot.structuralLayers = JSON.parse(JSON.stringify(cell.layers));
    }
    return snapshot;
  }

  function installRecoveryPayload(payload) {
    const recovered = decodeRecoveryPayload(payload);
    if (!recovered) return null;
    state.doc = recovered.doc;
    state.w = recovered.w;
    state.h = recovered.h;
    state.title = recovered.title;
    state.selection = null;
    floatingSession.clear();
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
      if (state.floatingPixels) return;
      const cached = persistPaWorkspace();
      const payload = createRecoveryPayload();
      if (payload) saveAutosaveToStorage(payload);
      if (_hasDocument) Promise.resolve(cached).then(ok => {
        const indicator = document.getElementById('pa-autosave-status-text');
        if (indicator) indicator.textContent = ok ? 'Browser Draft Saved' : 'Browser autosave incomplete';
      });
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
      state.doc.meta.grid = { cols: 1, rows: 1 };
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
      if (state.isolatedNodeId) _EditorCanvas.drawPixels(pctx, getArtworkCell()?.pixels || {}, state.w, state.h);
      else pctx.drawImage(state.artworkCanvas, 0, 0, state.w, state.h);
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
      if (state.isolatedNodeId) {
        ctx.save();
        ctx.scale(scale, scale);
        _EditorCanvas.drawPixels(ctx, getArtworkCell()?.pixels || {}, state.w, state.h);
        ctx.restore();
      } else {
        ctx.drawImage(state.artworkCanvas, 0, 0, offscreen.width, offscreen.height);
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

    const example = _PIX2.createDocument('New Artwork', 1, 1, targetW, targetH, { profile: 'pixelart' });
    example.palette = Object.fromEntries(palList.map((color, index) => [String(index + 1), color]));
    promptArea.value = Pix2AiPrompt.build({
      brief: taskDesc, source: _PIX2.serialize(example), width: targetW, height: targetH,
      profile: 'pixelart', detailed: isComprehensive
    });
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
    document.title = _Version.documentTitle(_Version.pixelart, state.doc ? name : null, state.isDirty || !currentFileHandle);
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
          if (!session) return;
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
          await importImageToPixelArt(file);
          return;
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('File System Access API failed, falling back:', err);
      }
    }
    dom.fileInput.click();
  }

  function showPix2ImportError(message) {
    const errorEl = document.getElementById('pa-import-pix2-error');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function importPix2CodeAsNewArtwork() {
    const sourceEl = document.getElementById('pa-import-pix2-source');
    const errorEl = document.getElementById('pa-import-pix2-error');
    const rawSource = sourceEl ? sourceEl.value.trim() : '';
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
    if (!rawSource) {
      showPix2ImportError('Paste PIX2 source code before importing.');
      return false;
    }

    // Accept common Markdown code fences from AI chats while parsing only the PIX2 body.
    const source = rawSource
      .replace(/^```(?:pix2)?[ \t]*\r?\n/i, '')
      .replace(/\r?\n```\s*$/, '');

    let parsed;
    try {
      parsed = _PIX2.parseValidated(source, { profile: 'pixelart' });
      if (!parsed || !parsed.cells || !Object.keys(parsed.cells).length) {
        throw new Error('The PIX2 document has no cells to edit.');
      }
      const validation = _PIX2.validate(parsed, { profile: 'pixelart', strict: false });
      if (!validation.valid) {
        throw new Error((validation.errors && validation.errors[0]) || 'The PIX2 document is invalid.');
      }
    } catch (error) {
      showPix2ImportError(error.message || 'Could not parse this PIX2 document.');
      return false;
    }

    const sourceTitle = typeof parsed.meta?.title === 'string' ? parsed.meta.title.trim() : '';
    const title = (sourceTitle || 'Imported PIX2 Artwork').slice(0, 80);
    const session = createPaProjectSession(title, parsed, null);
    if (!session) return false;

    session.fileName = `${sanitizeFilename(title)}.pix2`;
    session.isDirty = false;
    state.history = [];
    state.historyIndex = -1;
    state.lastHistoryPixels = null;
    pushHistory();
    currentFileHandle = null;
    currentFileName = null;
    lastKnownFileModified = 0;
    lastSavedContent = '';
    pendingExternalConflict = null;
    documentRevision = 0;
    lastSavedRevision = 0;
    const btnReload = document.getElementById('btn-reload-file');
    if (btnReload) {
      btnReload.classList.remove('pulse-warning');
      btnReload.title = 'Reload linked file from disk (Ctrl+Shift+R)';
    }
    updateDocumentTitle();
    markDocumentSaved();
    triggerAutosave(true);
    saveCurrentPaSession();
    renderPaProjectTabs();
    document.getElementById('modal-import-pix2-code')?.classList.add('hidden');
    sourceEl.value = '';
    setTimeout(fitCanvasToViewport, 50);
    showToast(`Imported PIX2 as a new artwork tab: ${title}`, 'success');
    return true;
  }

  const enqueueArtworkSave = _FileSave.createQueue();
  let activeSaveOperations = 0;

  function saveFileNative(forceSaveAs = false) {
    if (_hasDocument && state.isCodeEditingUnlocked && state.sourcePaneMode !== 'summary') {
      clearTimeout(state.sourceDebounceTimer);
      if (!applySourceCodeToCanvas()) return Promise.resolve(false);
    }
    commitFloatingSelection();
    if (!state.doc) return Promise.resolve(false);
    const doc = state.doc;
    const session = paProjectSessions.find(item => item.id === activePaProjectId) || null;
    const revision = documentRevision;
    const text = flushSourceCode();
    const title = state.title;
    const fileName = currentFileName || `${sanitizeFilename(title)}.pix2`;
    const direct = !forceSaveAs && currentFileHandle?.createWritable ? currentFileHandle : null;
    const access = direct ? _FileSave.permission(direct) : Promise.resolve(true);
    let picker;
    if (!direct && typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
      try {
        picker = window.showSaveFilePicker({ suggestedName: fileName,
          types: [{ description: 'PIX2 Sprite File', accept: { 'text/plain': ['.pix2'] } }] });
      } catch (error) {
        picker = Promise.reject(error);
      }
      picker.catch(() => {});
    }
    activeSaveOperations++;
    return enqueueArtworkSave(async () => {
      try {
        if (session && !paProjectSessions.includes(session)) return false;
        if (!await access) throw new Error('Write permission was denied');
        const handle = picker ? await picker : direct;
        let modified = 0;
        if (handle) modified = await _FileSave.write(handle, text);
        else savePix2File(text, fileName);
        if (session && !paProjectSessions.includes(session)) return true;
        const active = session ? session.id === activePaProjectId : state.doc === doc;
        if (active) saveCurrentPaSession();
        if (session) {
          session.lastSavedContent = text;
          session.lastSavedRevision = revision;
          session.isDirty = session.revision !== revision || _PIX2.serialize(session.doc) !== text;
          session.lastKnownFileModified = modified;
          session.pendingExternalConflict = null;
          if (handle) {
            session.fileHandle = handle;
            session.fileName = handle.name;
          }
        }
        if (active) {
          if (handle) {
            currentFileHandle = handle;
            currentFileName = handle.name;
            persistFileHandle(handle);
            state.title = handle.name.replace(/\.[^/.]+$/, '');
            if (dom.docTitle) dom.docTitle.value = state.title;
          }
          lastKnownFileModified = modified;
          lastSavedContent = text;
          pendingExternalConflict = null;
          lastSavedRevision = revision;
          setDirty(documentRevision !== lastSavedRevision || _PIX2.serialize(state.doc) !== text);
          triggerAutosave(true);
          updateDocumentTitle();
          showToast(handle ? 'Saved to ' + handle.name : 'Downloaded ' + fileName);
        }
        if (_hasDocument) persistPaWorkspace();
        return true;
      } catch (error) {
        if (error.name !== 'AbortError') showToast('Save failed: ' + error.message, 'error');
        return false;
      } finally {
        activeSaveOperations--;
      }
    });
  }

  function savePix2File(text = flushSourceCode(), fileName = `${sanitizeFilename(state.title)}.pix2`) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // ===========================================================================
  // DESKTOP CONTEXT MENU (RIGHT-CLICK)
  // ===========================================================================
  const contextMenu = typeof document !== 'undefined' ? document.getElementById('pa-context-menu') : null;

  function openContextMenu(x, y) {
    if (!contextMenu) return;
    EditorMenu.position(contextMenu, x, y);
  }

  function closeContextMenu() {
    if (contextMenu) contextMenu.classList.add('hidden');
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (/\.(pix2|txt)$/i.test(file.name)) {
        const text = await file.text();
        const doc = _PIX2.parse(text, { profile: 'pixelart' });
        const validation = _PIX2.validate(doc, { profile: 'pixelart', strict: false });
        if (!validation.valid) throw new Error(validation.errors[0] || 'Invalid PIX2 format');
        const session = createPaProjectSession(file.name.replace(/\.[^.]+$/, ''), doc);
        if (!session) return;
        session.fileName = file.name;
        currentFileName = file.name;
        lastSavedContent = text;
        syncCanvasToSource(true);
        markDocumentSaved();
        triggerAutosave(true);
        saveCurrentPaSession();
        renderPaProjectTabs();
        fitCanvasToViewport();
        showToast(`Opened ${file.name}`);
      } else if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
        await importImageToPixelArt(file);
      }
    } catch (error) {
      showToast(`Cannot open file: ${error.message}`, 'error');
    }
  }

  async function importImageToPixelArt(file) {
    const image = await createImageBitmap(file);
    try {
      const { maxCellDim } = _PIX2.PROFILES.pixelart;
      const width = image.width;
      const height = image.height;
      if (width > maxCellDim || height > maxCellDim) {
        throw new Error(`Image is ${width}×${height}. PixelArt supports up to ${maxCellDim}×${maxCellDim}.`);
      }
      const title = file.name.replace(/\.[^.]+$/, '');
      const draft = _PIX2.createDocument(title, 1, 1, width, height, { profile: 'pixelart' });
      const cell = Object.values(draft.cells)[0];
      const target = _Tools.getTargetForPlot(cell);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      const importedPixels = {};
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3];
        if (!alpha) continue;
        const pixel = index / 4;
        importedPixels[`${pixel % width},${Math.floor(pixel / width)}`] =
          _PIX2.rgbaToHex(pixels[index], pixels[index + 1], pixels[index + 2], alpha);
      }
      const session = createPaProjectSession(title, draft);
      if (!session) return;
      target.pixels = importedPixels;
      commitStructureMutation();
      saveCurrentPaSession();
      showToast(`Imported ${file.name} into ${session.fileName}`, 'success');
    } finally {
      image.close();
    }
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

    const watchedHandle = currentFileHandle;
    const watchedProject = activePaProjectId;
    const watchedRevision = documentRevision;
    const stillCurrent = () => currentFileHandle === watchedHandle && activePaProjectId === watchedProject && documentRevision === watchedRevision && !activeSaveOperations;
    try {
      isExternalReloading = true;
      const file = await currentFileHandle.getFile();
      if (!stillCurrent()) return;
      const currentModified = file.lastModified;

      // If baseline timestamp is not yet recorded, record it and baseline content from file
      if (lastKnownFileModified === 0) {
        lastKnownFileModified = currentModified;
        const curText = await file.text();
        if (!stillCurrent()) return;
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
      if (!stillCurrent()) return;
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
      const previousSource = dom.codeEditor.value;
      const previousSourceMode = state.sourcePaneMode;
      state.sourcePaneMode = 'full';
      dom.codeEditor.value = text;
      const ok = applySourceCodeToCanvas();
      if (!ok) {
        dom.codeEditor.value = previousSource;
        state.sourcePaneMode = previousSourceMode;
        updateCodeGutter();
        return;
      }
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
    if (contextMenu) EditorMenu.populate(contextMenu);
    window.NoiraViewport.bindInspectorResize(dom.splitResizer, dom.codePane, 200, 300,
      'pix2_pixelart_panel_width', width => { state.codePaneWidth = width; });

    // Canvas Viewport Events
    brushSettings = _Tools.bindBrushSettings();
    RegionSelection.bindActions(regionSelection, getArtworkCell, state, commitStructureMutation, showToast);
    dom.viewport.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.viewport.addEventListener('pointercancel', () => {
      if (regionSelection.cancel()) renderSelectionMarquee();
      if (state.isMovingSelection || state.isScalingSelection || state.isRotatingSelection) {
        cancelFloatingSelection();
      }
    });
    dom.viewport.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY);
    });

    dom.viewport.addEventListener('dblclick', (e) => {
      if (state.currentTool !== 'region-select' || e.shiftKey || e.ctrlKey || e.metaKey || !isEventOverCanvas(e)) return;
      const point = getPixelCoord(e);
      const hit = _StructureOps.pickIsolationRegion(getArtworkCell(), point, state, e.altKey)?.node;
      if (hit && hit.id !== state.isolatedNodeId) enterIsolationMode(hit.id, hit.name || hit.id);
    });

    // Wheel Zoom centered on cursor
    dom.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!e.deltaY) return;
      const oldZoom = state.zoom;
      const direction = e.deltaY < 0 ? 1 : -1;
      const newZoom = getNextZoom(oldZoom, direction);
      if (newZoom === oldZoom) return;

      // Analytical Invariant Cursor-Centered Zoom:
      // Point under the mouse cursor remains invariant in viewport screen coordinates
      const rect = dom.canvasMain.getBoundingClientRect();
      const unscaledX = (e.clientX - rect.left) / oldZoom;
      const unscaledY = (e.clientY - rect.top) / oldZoom;

      state.zoom = newZoom;
      resizeCanvasesToZoom();
      const resized = dom.canvasMain.getBoundingClientRect();
      const { dx, dy } = _EditorCanvas.wheelAnchor(resized, e.clientX, e.clientY, unscaledX, unscaledY, state.zoom);
      state.panX += dx;
      state.panY += dy;
      updateContainerTransform();
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

    document.getElementById('btn-import-pix2-code').addEventListener('click', () => {
      const sourceEl = document.getElementById('pa-import-pix2-source');
      const errorEl = document.getElementById('pa-import-pix2-error');
      sourceEl.value = '';
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      document.getElementById('modal-import-pix2-code').classList.remove('hidden');
      setTimeout(() => sourceEl.focus(), 0);
    });
    document.getElementById('btn-confirm-import-pix2').addEventListener('click', importPix2CodeAsNewArtwork);
    document.getElementById('pa-import-pix2-source').addEventListener('input', () => {
      const errorEl = document.getElementById('pa-import-pix2-error');
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    });

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
      if (!createPaProjectSession(title, doc, null)) return;
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

    // Empty Workspace Actions
    const paBtnEmptyNew = document.getElementById('pa-btn-empty-new');
    if (paBtnEmptyNew) {
      paBtnEmptyNew.addEventListener('click', () => {
        if (dom.modalNew) dom.modalNew.classList.remove('hidden');
      });
    }

    const paBtnEmptyOpen = document.getElementById('pa-btn-empty-open');
    if (paBtnEmptyOpen) {
      paBtnEmptyOpen.addEventListener('click', openFileNative);
    }

    const paBtnEmptySample = document.getElementById('pa-btn-empty-sample');
    if (paBtnEmptySample) {
      paBtnEmptySample.addEventListener('click', () => {
        loadSamplePixelArt();
      });
    }

    const paEmptyDropzone = document.getElementById('pa-empty-dropzone');
    if (paEmptyDropzone) {
      paEmptyDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        paEmptyDropzone.classList.add('drag-over');
      });
      paEmptyDropzone.addEventListener('dragleave', () => {
        paEmptyDropzone.classList.remove('drag-over');
      });
      paEmptyDropzone.addEventListener('drop', () => {
        paEmptyDropzone.classList.remove('drag-over');
      });
    }

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

    window.addEventListener('pagehide', () => {
      if (state.floatingPixels) cancelFloatingSelection();
      persistPaWorkspace();
    });
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

      if (state.currentTool === 'region-select' && e.key.startsWith('Arrow') && getArtworkCell()) {
        e.preventDefault();
        if (regionSelection.nudge(getArtworkCell(), state.activeLayerId, state.isolatedNodeId,
          state, e.key, prepareStructureMutation)) {
          commitStructureMutation();
          renderSelectionMarquee();
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
      } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
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
      } else if (!e.ctrlKey && !e.metaKey && (e.key === 'g' || e.key === 'G')) {
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
        if (state.selection) rotateArtwork();
        else selectTool('region-select');
      } else if (e.key === 'Escape') {
        if (regionSelection.cancel()) {
          renderSelectionMarquee();
          return;
        }
        if (state.isolatedNodeId) {
          if (state.floatingPixels) cancelFloatingSelection();
          exitIsolationMode();
          selectTool('region-select');
          return;
        }
        if (state.currentTool === 'region-select' && !state.selection) {
          regionSelection.reset();
          renderSelectionMarquee();
          return;
        }
        closeContextMenu();
        cancelFloatingSelection();
        showToast('Selection cancelled; original pixels restored');
      } else if (e.key === 'Enter') {
        if (state.floatingPixels) e.preventDefault();
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
      if (regionSelection.cancel()) renderSelectionMarquee();
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
            if (!session) return;
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
            await importImageToPixelArt(imgFile);
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
    if (toolName !== 'region-select') {
      regionSelection?.cancel();
    }
    state.currentTool = toolName;
    if (_hasDocument) {
      document.querySelectorAll('.pa-tool-btn[data-tool]').forEach((b) => {
        b.classList.toggle('active', b.dataset.tool === toolName);
      });
    }

    if (toolName !== 'select') state.selection = null;
    if (_hasDocument) {
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
