/**
 * NOIRADIX Studio - Main Application Controller
 * Fully Static & Zero External Dependencies
 * Professional Pixel Art Editor & Structured Sprite Authoring Environment
 *
 * Author: Nguyen Duc Canh (dotlinux26)
 * Copyright: (c) 2026 dotlinux26 (Nguyen Duc Canh). All rights reserved.
 * License: Apache-2.0
 */

(function () {
  'use strict';

  const regionSelection = RegionSelection.create();
  let brushSettings;
  let animPlayer = null;
  let studioAnimPlayer = null;
  let selectedGridCellId = 'cell_0_0';
  let activeStudioClipId = 'walk_down';

  // Desktop File & Autosave State
  let currentFileHandle = null;
  let currentFileName = 'player_wispling.pix2';
  let currentFilePath = null;
  let isDocumentDirty = false;
  let documentRevision = 0;
  let lastSavedRevision = 0;
  let periodicAutosaveTimer = null;
  let debouncedAutosaveTimer = null;
  let miniPreviewScale = 6;
  const MINI_PREVIEW_ZOOMS = [0.125, 0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32];

  // Real-Time File Watcher & External Hot-Reload
  let lastKnownFileModified = 0;
  let lastSavedContent = '';
  let isExternalReloading = false;
  let pendingExternalConflict = null;
  let fileWatcherHeartbeatTimer = null;

  // Floating preview & marquee animation state
  let userClosedFloatingPreview = false;
  let marqueeAnimFrameId = null;

  // Import & Slice State (PIX2 1.1 Ingestion Pipeline)
  let importSliceState = {
    image: null,
    imageInfo: null,
    rawBytes: null,
    jsonAtlas: null,
    frames: [],
    selectedSliceIndex: -1,
    activeTool: 'select', // 'select' | 'draw' | 'hand'
    zoom: 1,
    showPixelGrid: true,
    showLabels: true,
    showRulers: true,
    isDrawingSlice: false,
    isDraggingSlice: false,
    isResizingSlice: false,
    dragStartX: 0,
    dragStartY: 0,
    currentDragRect: null,
    activeHandle: null,
    dragOriginRect: null,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    scrollStartX: 0,
    scrollStartY: 0
  };

  // DOM Elements cache
  const dom = {};

  // Narrow document port for Studio-owned controllers; history stays in EditorState.
  const studioDocumentModel = {
    get doc() { return state.doc; }, set doc(value) { state.doc = value; },
    get activeTabId() { return state.activeTabId; }, set activeTabId(value) { state.activeTabId = value; },
    beginStroke: () => state.beginStroke(),
    endStroke: label => state.endStroke(label),
    saveSnapshot: label => state.saveSnapshot(label),
    openCellTab: id => state.openCellTab(id),
    setDocument: (...args) => state.setDocument(...args)
  };


  // Security & Sanitization Utilities
  function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const WINDOWS_RESERVED_NAMES = new Set([
    'con', 'prn', 'aux', 'nul',
    'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
    'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
  ]);

  function sanitizeSafeFilename(raw, defaultExt = '', fallback = 'sprite') {
    if (!raw || typeof raw !== 'string') {
      return defaultExt ? `${fallback}${defaultExt}` : fallback;
    }

    let name = String(raw).normalize('NFC').trim();

    // 1. Separate existing extension if defaultExt is provided
    if (defaultExt) {
      const extRegex = new RegExp(`${defaultExt.replace('.', '\\.')}$`, 'i');
      if (extRegex.test(name)) {
        name = name.replace(extRegex, '');
      }
    }

    // 2. Replace illegal Windows / POSIX characters (\ / : * ? " < > |) and control chars
    // Preserves: Unicode, Vietnamese diacritics, Asian CJK, spaces, safe punctuation (-, _, (), [])
    name = name
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/[\\/:*?"<>|]/g, '_');

    // 3. Prevent path traversal attempts (leading dots or slash sequences)
    name = name.replace(/^\.+/, '').trim();

    // 4. Windows forbids trailing periods or spaces in file base names
    name = name.replace(/[. ]+$/, '');

    // 5. Protect against Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    const lowerBase = name.toLowerCase();
    if (WINDOWS_RESERVED_NAMES.has(lowerBase)) {
      name = `_${name}`;
    }

    // 6. Max length clamp (120 chars for base name ensures total path safety within Windows MAX_PATH)
    if (name.length > 120) {
      name = name.slice(0, 120).trim().replace(/[. ]+$/, '');
    }

    // 7. Fallback if empty or all underscores
    if (!name || /^_+$/.test(name)) {
      name = fallback;
    }

    // 8. Re-attach extension
    if (defaultExt) {
      return `${name}${defaultExt}`;
    }
    return name;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    EditorToolbar.mount(document.getElementById('studio-tool-rail'), true);
    initDomCache();
    initTheme();
    initAnimationPlayers();
    initDraggablePanel();
    initFloatingAboutBubble();
    initHeaderScroll();
    bindEvents();
    bindKeyboardShortcuts();
    initCanvasPanningAndZoom();
    initImportSliceCanvasEvents();
    initInspectorDeckResizer();
    initAutosave();

    // Populate custom palette presets library
    const customPalettes = loadCustomPalettes();
    for (const key in customPalettes) {
      if (state.presetPalettes) {
        state.presetPalettes[`custom_${key}`] = [...customPalettes[key].colors];
      }
    }
    populatePaletteDropdown();

    await initAppSession();
    if (projectSessions.length === 0 && state.doc) {
      syncOrRegisterProjectSession(state.doc, currentFileName || 'noiradix_ghost.pix2', currentFileHandle, currentFilePath || 'noiradix_ghost.pix2');
    }
    renderProjectTabs();
    updateAutosaveIndicator(currentFileHandle && !isDocumentDirty ? 'disk' : 'browser', Date.now());
    initFileWatcher();
    updateAiGuidePane(dom.selectAiPromptMode ? dom.selectAiPromptMode.value : 'all-in-one');
  });

  // ===========================================================================
  // PERSISTENT FILE HANDLE & SESSION STORAGE (IndexedDB + localStorage)
  // ===========================================================================

  const DB_NAME = 'noiradix_studio_db';
  const STORE_NAME = 'file_handles';

  function getDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
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
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, 'current_file');
    } catch (err) {
      console.warn('Failed storing handle in IndexedDB:', err);
    }
  }

  async function retrievePersistedFileHandle() {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('current_file');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      return null;
    }
  }

  async function clearPersistedFileHandle() {
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete('current_file');
    } catch (err) {
      console.warn(err);
    }
  }

  async function initAppSession() {
    // 0. Restore multi-document project sessions if saved
    const data = await EditorWorkspaceStorage.read('noiradix_open_project_sessions');
    if (data) {
      try {
        if (data && Array.isArray(data.sessions)) {
          if (data.sessions.length === 0) {
            projectSessions = [];
            activeProjectId = null;
            state.doc = null;
            refreshAll();
            return true;
          }
          projectSessions = [];
          for (const item of data.sessions) {
            try {
              if (item.content && item.content.trim()) {
                const doc = PIX2.parse(item.content);
                const session = new ProjectSession(item.id, item.title, doc, null, item.fileName, item.filePath);
                session.isDirty = Boolean(item.isDirty);
                session.lastSavedContent = item.content;
                session.activeTabId = item.activeTabId || 'tab-grid-overview';
                session.openCellTabs = Array.isArray(item.openCellTabs) ? item.openCellTabs : [];
                projectSessions.push(session);
              }
            } catch (pErr) {
              console.warn('Failed restoring project session:', item.fileName, pErr);
            }
          }
          if (projectSessions.length > 0) {
            const activeId = data.activeId && projectSessions.some(p => p.id === data.activeId)
              ? data.activeId
              : projectSessions[0].id;
            switchProjectSession(activeId);
            return true;
          }
        }
      } catch (err) {
        console.warn('Failed reading noiradix_open_project_sessions:', err);
      }
    }

    const sessionType = localStorage.getItem('noiradix_session_type') || 'disk';
    const activeFileName = localStorage.getItem('noiradix_active_file_name');

    // 1. If active session is an in-memory draft, resume the draft first!
    if (sessionType === 'draft') {
      if (checkCrashRecovery()) {
        return true;
      }
    }

    // 2. Try restoring persisted FileSystemFileHandle from IndexedDB (Only if matching active file)
    try {
      const savedHandle = await retrievePersistedFileHandle();
      if (savedHandle && (!activeFileName || savedHandle.name === activeFileName)) {
        currentFileHandle = savedHandle;
        currentFileName = savedHandle.name;
        currentFilePath = localStorage.getItem('noiradix_active_file_path') || savedHandle.name;

        let docLoaded = false;

        // Try reading directly from file handle
        try {
          const file = await savedHandle.getFile();
          if (file) {
            const content = await file.text();
            if (content && content.trim()) {
              const doc = PIX2.parse(content);
              state.setDocument(doc);
              localStorage.setItem('pix2_last_saved_content', content);
              lastSavedContent = content;
              lastKnownFileModified = file.lastModified;
              docLoaded = true;
            }
          }
        } catch (readErr) {
          console.warn('Direct handle getFile read failed, trying cached content:', readErr);
        }

        // If direct read failed (e.g. permission reset on F5), load from last saved content
        if (!docLoaded) {
          const cached = localStorage.getItem('pix2_last_saved_content') || localStorage.getItem('pix2_draft_content');
          if (cached) {
            try {
              const doc = PIX2.parse(cached);
              state.setDocument(doc);
              docLoaded = true;
            } catch (pErr) {
              console.warn('Failed parsing cached content:', pErr);
            }
          }
        }

        if (docLoaded) {
          syncOrRegisterProjectSession(state.doc, currentFileName, savedHandle, currentFilePath);
          setDirty(false);
          refreshAll();
          showToast(`Resumed local file: ${savedHandle.name}`, 'info');
          return true;
        }
      }
    } catch (err) {
      console.warn('Could not restore file handle from IndexedDB:', err);
    }

    // 3. Check crash recovery next
    if (checkCrashRecovery()) {
      return true;
    }

    // 4. Fallback: load default demo
    loadDefaultProject();
    return false;
  }

  function initDomCache() {
    dom.tabsContainer = document.getElementById('tabs-container');
    dom.projectTabsStrip = document.getElementById('project-tabs-strip');
    dom.btnProjectNewTab = document.getElementById('btn-project-new-tab');
    if (dom.btnProjectNewTab) {
      dom.btnProjectNewTab.addEventListener('click', () => openNewFileModal());
    }
    dom.views = {
      grid: document.getElementById('view-grid-overview'),
      anim: document.getElementById('view-anim-studio'),
      cell: document.getElementById('view-cell-editor'),
      code: document.getElementById('view-code-editor'),
      'import-slice': document.getElementById('view-import-slice')
    };

    // Canvas elements
    dom.gridCanvas = document.getElementById('grid-canvas');
    dom.cellCanvas = document.getElementById('cell-canvas');
    dom.cellOverlay = document.getElementById('cell-overlay');
    dom.rulerTop = document.getElementById('ruler-top');
    dom.rulerLeft = document.getElementById('ruler-left');
    dom.miniPreviewCanvas = document.getElementById('mini-preview-canvas');
    dom.animCanvas = document.getElementById('anim-canvas');
    dom.canvasViewport = document.getElementById('canvas-viewport');
    dom.canvasContainerWithRulers = document.getElementById('canvas-container-with-rulers');

    // Structure & Layers (PIX2 1.1)
    dom.structureLayersCard = document.getElementById('structure-layers-card');
    dom.structureTreeContainer = document.getElementById('structure-tree-container');
    dom.btnAddLayer = document.getElementById('btn-add-layer');
    dom.btnAddGroup = document.getElementById('btn-add-group');
    dom.btnAddRegion = document.getElementById('btn-add-region');
    dom.isolationBanner = document.getElementById('isolation-banner');
    dom.isolationBreadcrumbText = document.getElementById('isolation-breadcrumb-text');
    dom.btnExitIsolation = document.getElementById('btn-exit-isolation');
    dom.btnToolRegionSelect = document.getElementById('btn-tool-region-select');

    // Import & Slice elements
    dom.importSliceDropzone = document.getElementById('import-slice-dropzone');
    dom.inputImportSliceFile = document.getElementById('input-import-slice-file');
    dom.importSliceFileInfo = document.getElementById('import-slice-file-info');
    dom.importSliceFileName = document.getElementById('import-slice-file-name');
    dom.importSliceImgDims = document.getElementById('import-slice-img-dims');
    dom.selectSliceMethod = document.getElementById('select-slice-method');
    dom.sliceOptsGrid = document.getElementById('slice-opts-grid');
    dom.sliceOptsManual = document.getElementById('slice-opts-manual');
    dom.sliceOptsAlpha = document.getElementById('slice-opts-alpha');
    dom.sliceOptsAtlas = document.getElementById('slice-opts-atlas');
    dom.inputSliceCellW = document.getElementById('input-slice-cell-w');
    dom.inputSliceCellH = document.getElementById('input-slice-cell-h');
    dom.inputSliceCols = document.getElementById('input-slice-cols');
    dom.inputSliceRows = document.getElementById('input-slice-rows');
    dom.inputSliceSpacing = document.getElementById('input-slice-spacing');
    dom.inputSliceMargin = document.getElementById('input-slice-margin');
    dom.inputSliceAlphaThresh = document.getElementById('input-slice-alpha-thresh');
    dom.inputSliceMinSize = document.getElementById('input-slice-min-size');
    dom.atlasDetectedInfo = document.getElementById('atlas-detected-info');
    dom.btnRunSlicePreview = document.getElementById('btn-run-slice-preview');
    dom.btnSliceModeDrag = document.getElementById('btn-slice-mode-drag');
    dom.btnSliceToolSelect = document.getElementById('btn-slice-tool-select');
    dom.btnSliceToolDraw = document.getElementById('btn-slice-tool-draw');
    dom.btnSliceToolHand = document.getElementById('btn-slice-tool-hand');
    dom.btnSliceZoomOut = document.getElementById('btn-slice-zoom-out');
    dom.sliceZoomLevel = document.getElementById('slice-zoom-level');
    dom.btnSliceZoomIn = document.getElementById('btn-slice-zoom-in');
    dom.btnSliceZoomFit = document.getElementById('btn-slice-zoom-fit');
    dom.btnSliceZoomReset = document.getElementById('btn-slice-zoom-reset');
    dom.btnSliceSelectAll = document.getElementById('btn-slice-select-all');
    dom.btnSliceDeselect = document.getElementById('btn-slice-deselect');
    dom.btnSliceDeleteSelected = document.getElementById('btn-slice-delete-selected');
    dom.btnSliceClearAll = document.getElementById('btn-slice-clear-all');
    dom.chkSliceAutoAnimate = document.getElementById('chk-slice-auto-animate');
    dom.inputSliceLayerName = document.getElementById('input-slice-layer-name');
    dom.btnImportSliceCommit = document.getElementById('btn-import-slice-commit');
    dom.sliceCountBadge = document.getElementById('slice-count-badge');
    dom.importSliceCanvas = document.getElementById('import-slice-canvas');
    dom.importSliceEmptyPrompt = document.getElementById('import-slice-empty-prompt');
    dom.importSliceViewportContainer = document.getElementById('import-slice-viewport-container');
    dom.importSlicesDeck = document.getElementById('import-slices-deck');
    dom.importSlicesList = document.getElementById('import-slices-list');
    dom.importSlicesCountText = document.getElementById('import-slices-count-text');
    dom.btnBatchTagPrefix = document.getElementById('btn-batch-tag-prefix');
    dom.btnAutoTag4Dir = document.getElementById('btn-auto-tag-4dir');
    dom.btnAutoTag8Dir = document.getElementById('btn-auto-tag-8dir');
    dom.btnClearAllTags = document.getElementById('btn-clear-all-tags');
    dom.btnSliceToggleGrid = document.getElementById('btn-slice-toggle-grid');
    dom.btnSliceToggleRulers = document.getElementById('btn-slice-toggle-rulers');
    dom.btnSliceToggleLabels = document.getElementById('btn-slice-toggle-labels');
    dom.sliceCoordsInfo = document.getElementById('slice-coords-info');
    dom.importSliceOverlay = document.getElementById('import-slice-overlay');
    dom.sliceContainerWithRulers = document.getElementById('slice-container-with-rulers');
    dom.sliceRulerTop = document.getElementById('slice-ruler-top');
    dom.sliceRulerLeft = document.getElementById('slice-ruler-left');
    dom.sliceRulerCorner = document.getElementById('slice-ruler-corner');
    dom.btnCellResizeFrame = document.getElementById('btn-cell-resize-frame');
    dom.chkResizeFrameCenter = document.getElementById('chk-resize-frame-center');

    // Grid Overview Zoom Controls
    dom.btnGridZoomOut = document.getElementById('btn-grid-zoom-out');
    dom.gridZoomLevel = document.getElementById('grid-zoom-level');
    dom.btnGridZoomIn = document.getElementById('btn-grid-zoom-in');
    dom.btnGridZoomReset = document.getElementById('btn-grid-zoom-reset');

    // Direction 2-dir button
    dom.btnMode2dir = document.getElementById('btn-mode-2dir');

    // Tool buttons
    dom.toolButtons = document.querySelectorAll('[data-tool]');
    dom.colorPrimary = document.getElementById('color-primary');
    dom.colorSecondary = document.getElementById('color-secondary');
    dom.colorPickerInput = document.getElementById('color-picker-input');
    dom.paletteSwatches = document.getElementById('palette-swatches');
    dom.paletteSelect = document.getElementById('palette-select');
    dom.btnAddColor = document.getElementById('btn-add-color');

    // Code & Prompt
    dom.codeViewer = document.getElementById('pix2-code-viewer');
    dom.codeTextarea = document.getElementById('pix2-code-text');
    dom.btnApplyCode = document.getElementById('btn-apply-code');
    dom.btnCopyAiPrompt = document.getElementById('btn-copy-ai-prompt');
    dom.selectAiPromptMode = document.getElementById('select-ai-prompt-mode');
    dom.btnCopyRawCode = document.getElementById('btn-copy-raw-code');
    dom.btnToggleEditCode = document.getElementById('btn-toggle-edit-code');
    dom.codeModeBadge = document.getElementById('code-mode-badge');

    // Info labels
    dom.labelCoords = document.getElementById('label-mouse-coords');
    dom.labelResolution = document.getElementById('label-cell-resolution');
    dom.inputCellName = document.getElementById('cell-name-input');
    dom.inputProjectTitle = document.getElementById('project-title-input');

    // Theme Toggle
    dom.btnThemeToggle = document.getElementById('btn-theme-toggle');
    dom.themeBtnLabel = document.getElementById('theme-btn-label');

    // Status Bar elements
    dom.statusCellLabel = document.getElementById('status-cell-label');
    dom.statusCoordLabel = document.getElementById('status-coord-label');
    dom.statusGridTotal = document.getElementById('status-grid-total');
    dom.statusColorDot = document.getElementById('status-color-dot');
    dom.statusColorLabel = document.getElementById('status-color-label');
    dom.statusSymmetryLabel = document.getElementById('status-symmetry-label');
    dom.statusZoomLabel = document.getElementById('status-zoom-label');
    dom.statusToolLabel = document.getElementById('status-tool-label');
    dom.btnImportCode = document.getElementById('btn-import-code');
    dom.btnReloadFile = document.getElementById('btn-reload-file');

    // Grid Overview Inspector elements
    dom.gridInspectorRowLabel = document.getElementById('grid-inspector-row-label');
    dom.gridSelectedBadge = document.getElementById('grid-selected-badge');
    dom.gridCellIdInput = document.getElementById('grid-cell-id');
    dom.gridCellName = document.getElementById('grid-cell-name');
    dom.gridCellAnim = document.getElementById('grid-cell-anim');
    dom.gridCellDir = document.getElementById('grid-cell-dir');
    dom.btnGridOpenEditor = document.getElementById('btn-grid-open-editor');
    dom.animClipsList = document.getElementById('anim-clips-list');
    dom.btnQuick4dir = document.getElementById('btn-quick-4dir');
    dom.btnQuick8dir = document.getElementById('btn-quick-8dir');
    dom.btnAddAnimClip = document.getElementById('btn-add-anim-clip');
    dom.btnQuickNewAnim = document.getElementById('btn-quick-new-anim');

    // Grid Dimension Management
    dom.btnGridAddRow = document.getElementById('btn-grid-add-row');
    dom.btnGridRemoveRow = document.getElementById('btn-grid-remove-row');
    dom.btnGridAddCol = document.getElementById('btn-grid-add-col');
    dom.btnGridRemoveCol = document.getElementById('btn-grid-remove-col');

    // Cell Editor Tagging elements
    dom.cellAnimSelect = document.getElementById('cell-anim-select');
    dom.cellDirSelect = document.getElementById('cell-dir-select');

    // Dedicated Animation Studio elements
    dom.studioAnimCanvas = document.getElementById('studio-anim-canvas');
    dom.studioAnimList = document.getElementById('studio-anim-list');
    dom.btnStudioAddAnim = document.getElementById('btn-studio-add-anim');
    dom.studioClipName = document.getElementById('studio-clip-name');
    dom.studioClipFps = document.getElementById('studio-clip-fps');
    dom.studioClipFpsLabel = document.getElementById('studio-clip-fps-label');
    dom.studioClipMode = document.getElementById('studio-clip-mode');
    dom.studioClipDir = document.getElementById('studio-clip-dir');
    dom.btnStudioDeleteClip = document.getElementById('btn-studio-delete-clip');
    dom.studioActiveClipTitle = document.getElementById('studio-active-clip-title');
    dom.studioTimelineFrameCounter = document.getElementById('studio-timeline-frame-counter');
    dom.studioActiveFramePill = document.getElementById('studio-active-frame-pill');
    dom.studioActiveFrameText = document.getElementById('studio-active-frame-text');
    dom.timelineSelectedFrameInfo = document.getElementById('timeline-selected-frame-info');
    dom.studioFrameIdxBadge = document.getElementById('studio-frame-idx-badge');
    dom.studioFrameCellId = document.getElementById('studio-frame-cell-id');
    dom.studioFrameNameInput = document.getElementById('studio-frame-name-input');
    dom.btnStudioEditFramePixels = document.getElementById('btn-studio-edit-frame-pixels');
    dom.btnStudioOnionSkin = document.getElementById('btn-studio-onion-skin');
    dom.onionSkinLabel = document.getElementById('onion-skin-label');
    dom.btnStudioPlay = document.getElementById('btn-studio-play');
    dom.btnStudioPrev = document.getElementById('btn-studio-prev');
    dom.btnStudioNext = document.getElementById('btn-studio-next');
    dom.timelineFramesStrip = document.getElementById('timeline-frames-strip');
    dom.btnTimelineAddFrame = document.getElementById('btn-timeline-add-frame');

    // Modal Frame Picker
    dom.modalFramePicker = document.getElementById('modal-frame-picker');
    dom.framePickerRowFilter = document.getElementById('frame-picker-row-filter');
    dom.framePickerSearch = document.getElementById('frame-picker-search');
    dom.framePickerGrid = document.getElementById('frame-picker-grid');
    dom.framePickerManualId = document.getElementById('frame-picker-manual-id');
    dom.btnFramePickerAddManual = document.getElementById('btn-frame-picker-add-manual');
    dom.btnCloseFramePicker = document.getElementById('btn-close-frame-picker');
    dom.btnCancelFramePicker = document.getElementById('btn-cancel-frame-picker');

    // Floating Panel elements & Toggle button
    dom.btnToggleFloatAnim = document.getElementById('btn-toggle-float-anim');
    dom.animFloatingPanel = document.getElementById('anim-floating-panel');
    dom.animPanelDragHandle = document.getElementById('anim-panel-drag-handle');
    dom.animPanelMinBtn = document.getElementById('anim-panel-min-btn');
    dom.animModeSelect = document.getElementById('anim-mode-select');
    dom.floatingAnimSelect = document.getElementById('floating-anim-select');

    // Action & Direction Template Modal elements
    dom.modalActionTemplate = document.getElementById('modal-action-template');
    dom.templateActionInput = document.getElementById('template-action-input');
    dom.actionChipsContainer = document.getElementById('action-chips-container');
    dom.btnMode4dir = document.getElementById('btn-mode-4dir');
    dom.btnMode8dir = document.getElementById('btn-mode-8dir');
    dom.templateColsInput = document.getElementById('template-cols-input');
    dom.templateFpsInput = document.getElementById('template-fps-input');
    dom.templateStartRow = document.getElementById('template-start-row');
    dom.templateLivePreview = document.getElementById('template-live-preview');
    dom.templateSummaryBadge = document.getElementById('template-summary-badge');
    dom.btnCloseTemplateModal = document.getElementById('btn-close-template-modal');
    dom.btnCancelTemplateModal = document.getElementById('btn-cancel-template-modal');
    dom.btnApplyTemplateModal = document.getElementById('btn-apply-template-modal');

    // Game Export Studio Modal elements
    dom.modalGameExport = document.getElementById('modal-game-export');
    dom.btnCloseExportModal = document.getElementById('btn-close-export-modal');
    dom.btnCancelExportModal = document.getElementById('btn-cancel-export-modal');
    dom.btnQuickExportPng = document.getElementById('btn-quick-export-png');
    dom.btnExecuteGameExport = document.getElementById('btn-execute-game-export');
    dom.btnExecuteExportLabel = document.getElementById('btn-execute-export-label');
    dom.exportSpacingSelect = document.getElementById('export-spacing-select');
    dom.exportMarginSelect = document.getElementById('export-margin-select');
    dom.exportExtrudeCheckbox = document.getElementById('export-extrude-checkbox');
    dom.exportScaleSelect = document.getElementById('export-scale-select');
    dom.exportPivotSelect = document.getElementById('export-pivot-select');
    dom.exportFormatOptions = document.getElementById('export-format-options');
    dom.exportPreviewCanvas = document.getElementById('export-preview-canvas');
    dom.exportDimensionBadge = document.getElementById('export-dimension-badge');
    dom.exportGridInfo = document.getElementById('export-grid-info');
    dom.exportCellSizeInfo = document.getElementById('export-cell-size-info');
    dom.exportSpacingInfo = document.getElementById('export-spacing-info');
    dom.exportClipsInfo = document.getElementById('export-clips-info');
    dom.exportBleedTag = document.getElementById('export-bleed-tag');

    // New File Modal elements
    dom.modalNewFile = document.getElementById('modal-new-file');
    dom.newFileNameInput = document.getElementById('new-file-name-input');
    dom.newFileTitleInput = document.getElementById('new-file-title-input');
    dom.newFilePresets = document.getElementById('new-file-presets');
    dom.newFileCols = document.getElementById('new-file-cols');
    dom.newFileRows = document.getElementById('new-file-rows');
    dom.newFileCellW = document.getElementById('new-file-cell-w');
    dom.newFileCellH = document.getElementById('new-file-cell-h');
    dom.btnCloseNewFileModal = document.getElementById('btn-close-new-file-modal');
    dom.btnCancelNewFile = document.getElementById('btn-cancel-new-file');
    dom.btnConfirmNewFile = document.getElementById('btn-confirm-new-file');
    dom.newFileSummaryCard = document.getElementById('new-file-summary-card');
    dom.newFileSummarySize = document.getElementById('new-file-summary-size');
    dom.newFileSummaryCells = document.getElementById('new-file-summary-cells');
    dom.newFileSummaryTemplate = document.getElementById('new-file-summary-template');

    // Resize Frame Modal elements
    dom.btnResizeFrame = document.getElementById('btn-resize-frame');
    dom.modalResizeFrame = document.getElementById('modal-resize-frame');
    dom.resizeFrameW = document.getElementById('resize-frame-w');
    dom.resizeFrameH = document.getElementById('resize-frame-h');
    dom.resizeFramePresets = document.getElementById('resize-frame-presets');
    dom.btnCloseResizeFrameModal = document.getElementById('btn-close-resize-frame-modal');
    dom.btnCancelResizeFrame = document.getElementById('btn-cancel-resize-frame');
    dom.btnConfirmResizeFrame = document.getElementById('btn-confirm-resize-frame');

    // Import Code Modal elements
    dom.modalImportCode = document.getElementById('modal-import-code');
    dom.importFileNameInput = document.getElementById('import-file-name-input');
    dom.importCodeTextarea = document.getElementById('import-code-textarea');
    dom.importCodeError = document.getElementById('import-code-error');
    dom.btnCloseImportModal = document.getElementById('btn-close-import-modal');
    dom.btnCancelImportCode = document.getElementById('btn-cancel-import-code');
    dom.btnConfirmImportCode = document.getElementById('btn-confirm-import-code');
    dom.btnImportPasteClipboard = document.getElementById('btn-import-paste-clipboard');
    dom.btnImportClearCode = document.getElementById('btn-import-clear-code');

    // Floating About Bubble & About Modal elements
    dom.btnFloatingAbout = document.getElementById('btn-floating-about');
    dom.btnBrandAbout = document.getElementById('btn-brand-about');
    dom.modalAboutStudio = document.getElementById('modal-about-studio');
    dom.btnCloseAboutModal = document.getElementById('btn-close-about-modal');
    dom.btnAboutCloseDone = document.getElementById('btn-about-close-done');
    dom.modalDemoChooser = document.getElementById('modal-demo-chooser');
  }

  // ===========================================================================
  // STUDIO MULTI-DOCUMENT PROJECT SESSIONS MANAGER
  // ===========================================================================
  let projectSessions = [];
  let activeProjectId = null;

  class ProjectSession {
    constructor(id, title, doc, fileHandle = null, fileName = null, filePath = null) {
      this.id = id || ('proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
      this.title = title || (doc && doc.meta && doc.meta.title) || 'Untitled.pix2';
      this.doc = doc;
      this.fileHandle = fileHandle;
      this.fileName = fileName || this.title;
      this.filePath = filePath || this.fileName;
      this.isDirty = false;
      this.revision = 0;
      this.lastSavedRevision = 0;
      this.lastSavedContent = '';
      this.history = [];
      this.historyIndex = -1;
      this.openCellTabs = [];
      this.activeTabId = 'tab-grid-overview';
      this.selection = null;
      this.structureFocus = {};
    }
  }

  function getActiveSession() {
    return activeProjectId ? (projectSessions.find(p => p.id === activeProjectId) || null) : null;
  }

  function saveCurrentSessionState() {
    const cur = getActiveSession();
    if (!cur) return;
    cur.doc = state.doc;
    cur.fileHandle = currentFileHandle;
    cur.fileName = currentFileName;
    cur.filePath = currentFilePath;
    cur.isDirty = isDocumentDirty;
    cur.revision = documentRevision;
    cur.lastSavedRevision = lastSavedRevision;
    cur.lastSavedContent = lastSavedContent;
    cur.lastKnownFileModified = lastKnownFileModified;
    cur.pendingExternalConflict = pendingExternalConflict;
    cur.openCellTabs = state.openCellTabs ? [...state.openCellTabs] : [];
    cur.activeTabId = state.activeTabId || 'tab-grid-overview';
    cur.history = state.history ? [...state.history] : [];
    cur.historyIndex = state.historyIndex;
    cur.selection = state.selection ? { ...state.selection } : null;
    cur.structureFocus = {
      activeLayerId: state.activeLayerId,
      activeGroupId: state.activeGroupId,
      activeRegionId: state.activeRegionId,
      isolatedNodeId: state.isolatedNodeId
    };
  }

  function persistAllProjectSessions() {
    try {
      saveCurrentSessionState();
      const payload = projectSessions.map(s => ({
        id: s.id,
        title: s.title,
        fileName: s.fileName,
        filePath: s.filePath,
        isDirty: Boolean(s.isDirty),
        activeTabId: s.activeTabId,
        openCellTabs: s.openCellTabs,
        content: (typeof PIX2 !== 'undefined' && s.doc) ? PIX2.serialize(s.doc) : (s.lastSavedContent || '')
      }));
      return EditorWorkspaceStorage.write('noiradix_open_project_sessions', {
        activeId: activeProjectId,
        sessions: payload
      });
    } catch (err) {
      console.warn('Failed to persist project sessions to localStorage:', err);
      return false;
    }
  }

  function reorderProjectSessions(orderedIds) {
    const byId = new Map(projectSessions.map(session => [session.id, session]));
    const ordered = orderedIds.map(id => byId.get(id)).filter(Boolean);
    if (ordered.length !== projectSessions.length) return;
    projectSessions = ordered;
    renderProjectTabs();
    persistAllProjectSessions();
  }

  function renderProjectTabs() {
    NoiraTabStrip.render(dom.projectTabsStrip, projectSessions, activeProjectId, {
      onActivate: switchProjectSession,
      onClose: closeProjectSession,
      onReorder: reorderProjectSessions
    });
  }

  function switchProjectSession(sessionId) {
    const target = projectSessions.find(p => p.id === sessionId);
    if (!target) return;

    commitFloatingSelection();
    regionSelection.reset();
    if (activeProjectId && activeProjectId !== sessionId) {
      saveCurrentSessionState();
    }
    activeProjectId = sessionId;

    state.setDocument(target.doc);
    currentFileHandle = target.fileHandle;
    currentFileName = target.fileName;
    currentFilePath = target.filePath;
    isDocumentDirty = target.isDirty;
    documentRevision = target.revision || 0;
    lastSavedRevision = target.lastSavedRevision || 0;
    lastSavedContent = target.lastSavedContent || '';
    lastKnownFileModified = target.lastKnownFileModified || 0;
    pendingExternalConflict = target.pendingExternalConflict || null;
    if (target.openCellTabs && Array.isArray(target.openCellTabs)) {
      state.openCellTabs = [...target.openCellTabs];
    } else {
      state.openCellTabs = [];
    }
    state.activeTabId = target.activeTabId || 'tab-grid-overview';
    Object.assign(state, target.structureFocus);
    if (target.history?.length) {
      state.history = target.history;
      state.historyIndex = target.historyIndex;
    } else if (state.history[state.historyIndex]) {
      state.history[state.historyIndex].activeTab = state.activeTabId;
    }
    state.selection = target.selection ? { ...target.selection } : null;

    setDirty(target.isDirty, false);
    renderProjectTabs();
    refreshAll();
  }

  function createProjectSession(doc, title = 'Untitled.pix2', fileHandle = null) {
    saveCurrentSessionState();
    const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const session = new ProjectSession(newId, title, doc, fileHandle, title, title);
    session.lastSavedContent = (typeof PIX2 !== 'undefined' && doc) ? PIX2.serialize(doc) : '';
    projectSessions.push(session);
    switchProjectSession(newId);
    persistAllProjectSessions();
    return session;
  }

  function syncOrRegisterProjectSession(doc, fileName = null, fileHandle = null, filePath = null) {
    if (!doc) return null;
    const name = fileName || currentFileName || (fileHandle ? fileHandle.name : null) || sanitizeSafeFilename(doc.meta?.title, '.pix2', 'untitled');
    const path = filePath || currentFilePath || name;
    const title = (doc.meta && doc.meta.title) || name;

    let session = projectSessions.find(p => p.id === activeProjectId);

    if (!session) {
      if (activeProjectId) {
        saveCurrentSessionState();
      }
      const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      session = new ProjectSession(newId, title, doc, fileHandle, name, path);
      session.lastSavedContent = (typeof PIX2 !== 'undefined') ? PIX2.serialize(doc) : '';
      session.isDirty = isDocumentDirty;
      projectSessions.push(session);
      activeProjectId = newId;
    } else {
      session.doc = doc;
      session.title = title;
      session.fileName = name;
      session.filePath = path;
      if (fileHandle) session.fileHandle = fileHandle;
      session.isDirty = isDocumentDirty;
    }

    renderProjectTabs();
    persistAllProjectSessions();
    return session;
  }

  function closeProjectSession(sessionOrId) {
    const session = (typeof sessionOrId === 'object' && sessionOrId !== null)
      ? sessionOrId
      : projectSessions.find(p => p.id === sessionOrId);
    if (!session) return;

    if (session.isDirty) {
      const confirmDiscard = confirm(`Project "${session.fileName || session.title}" has unsaved changes. Discard and close?`);
      if (!confirmDiscard) return;
    }

    const isClosingActive = (activeProjectId === session.id);
    if (isClosingActive) regionSelection.reset();
    const idx = projectSessions.indexOf(session);
    if (idx !== -1) {
      projectSessions.splice(idx, 1);
    }

    // Immediately purge and release RAM references from discarded session
    session.doc = null;
    session.history = [];
    session.lastSavedContent = '';
    session.fileHandle = null;
    session.openCellTabs = [];
    session.selection = null;

    if (projectSessions.length === 0) {
      activeProjectId = null;
      state.doc = null;
      state.history = [];
      state.historyIndex = -1;
      state.selection = null;
      state.openCellTabs = [];
      currentFileHandle = null;
      currentFileName = null;
      currentFilePath = null;
      lastSavedContent = '';
      floatingSession.clear();
      floatingOriginalSel = null;

      // Clear canvas buffers to free GPU/RAM memory
      if (dom.gridCanvas) {
        const gctx = dom.gridCanvas.getContext('2d');
        gctx.clearRect(0, 0, dom.gridCanvas.width, dom.gridCanvas.height);
      }
      if (dom.cellCanvas) {
        const cctx = dom.cellCanvas.getContext('2d');
        cctx.clearRect(0, 0, dom.cellCanvas.width, dom.cellCanvas.height);
      }
      if (dom.miniPreviewCanvas) {
        const mctx = dom.miniPreviewCanvas.getContext('2d');
        mctx.clearRect(0, 0, dom.miniPreviewCanvas.width, dom.miniPreviewCanvas.height);
      }

      // Purge recovery drafts from localStorage so closed discarded files never linger
      localStorage.removeItem('pix2_draft_content');
      localStorage.removeItem('pix2_recovery_snapshot');
      localStorage.removeItem('pix2_last_saved_content');
      localStorage.removeItem('noiradix_active_file_name');
      localStorage.removeItem('noiradix_active_file_path');
      persistAllProjectSessions();
      renderProjectTabs();
      refreshAll();
    } else if (isClosingActive) {
      activeProjectId = null;
      const nextSession = projectSessions[Math.min(idx, projectSessions.length - 1)];
      switchProjectSession(nextSession.id);
      persistAllProjectSessions();
    } else {
      renderProjectTabs();
      persistAllProjectSessions();
    }
  }

  // ===========================================================================
  // THEME MANAGEMENT (Light Mode Default, Dark Mode Supported)
  // ===========================================================================

  function initTheme() {
    const savedTheme = localStorage.getItem('pix2_theme') || 'light';
    setTheme(savedTheme);
  }

  function setTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      if (dom.themeBtnLabel) dom.themeBtnLabel.textContent = 'Light';
      if (dom.btnThemeToggle) dom.btnThemeToggle.querySelector('i').className = 'fa-solid fa-sun';
      localStorage.setItem('pix2_theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      if (dom.themeBtnLabel) dom.themeBtnLabel.textContent = 'Dark';
      if (dom.btnThemeToggle) dom.btnThemeToggle.querySelector('i').className = 'fa-solid fa-moon';
      localStorage.setItem('pix2_theme', 'light');
    }
    if (animPlayer) animPlayer.render();
    if (studioAnimPlayer) studioAnimPlayer.render();
    if (state.doc) refreshAll();
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    setTheme(isDark ? 'light' : 'dark');
  }

  // ===========================================================================
  // DRAGGABLE FLOATING ANIMATION STUDIO PANEL
  // ===========================================================================

  function initDraggablePanel() {
    if (!dom.animPanelDragHandle || !dom.animFloatingPanel) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    dom.animPanelDragHandle.addEventListener('mousedown', (e) => {
      if (['SELECT', 'BUTTON', 'OPTION', 'I'].includes(e.target.tagName)) return;

      isDragging = true;
      const rect = dom.animFloatingPanel.getBoundingClientRect();

      dom.animFloatingPanel.style.bottom = 'auto';
      dom.animFloatingPanel.style.right = 'auto';
      dom.animFloatingPanel.style.left = `${rect.left}px`;
      dom.animFloatingPanel.style.top = `${rect.top}px`;

      initialLeft = rect.left;
      initialTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;

      dom.animPanelDragHandle.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = Math.max(10, Math.min(window.innerWidth - dom.animFloatingPanel.offsetWidth - 10, initialLeft + dx));
      const newTop = Math.max(55, Math.min(window.innerHeight - dom.animFloatingPanel.offsetHeight - 35, initialTop + dy));

      dom.animFloatingPanel.style.left = `${newLeft}px`;
      dom.animFloatingPanel.style.top = `${newTop}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        dom.animPanelDragHandle.style.cursor = 'grab';
      }
    });

    if (dom.animPanelMinBtn) {
      dom.animPanelMinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.animFloatingPanel.classList.toggle('minimized');
        const isMin = dom.animFloatingPanel.classList.contains('minimized');
        dom.animPanelMinBtn.innerHTML = isMin ? '<i class="fa-solid fa-plus"></i>' : '<i class="fa-solid fa-minus"></i>';
      });
    }
  }

  // ===========================================================================
  // FLOATING ABOUT BUBBLE & ABOUT NOIRADIX STUDIO MODAL
  // ===========================================================================

  function openAboutModal() {
    if (!dom.modalAboutStudio) return;
    if (typeof commitFloatingSelection === 'function') {
      commitFloatingSelection();
    }
    dom.modalAboutStudio.classList.remove('hidden');
  }

  function closeAboutModal() {
    if (dom.modalAboutStudio) {
      dom.modalAboutStudio.classList.add('hidden');
    }
  }

  function openDemoChooserModal() {
    if (dom.modalDemoChooser) {
      dom.modalDemoChooser.classList.remove('hidden');
    }
  }

  function closeDemoChooserModal() {
    if (dom.modalDemoChooser) {
      dom.modalDemoChooser.classList.add('hidden');
    }
  }

  function initFloatingAboutBubble() {
    const btn = dom.btnFloatingAbout;
    if (!btn) return;

    // 1. Restore saved position from localStorage if valid
    try {
      const savedPos = localStorage.getItem('noiradix_about_bubble_pos');
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (parsed && typeof parsed.left === 'number' && typeof parsed.top === 'number') {
          const pad = 6;
          const w = 36;
          const h = 36;
          const maxLeft = Math.max(pad, window.innerWidth - w - pad);
          const maxTop = Math.max(pad, window.innerHeight - h - pad);
          const clampedLeft = Math.min(Math.max(parsed.left, pad), maxLeft);
          const clampedTop = Math.min(Math.max(parsed.top, pad), maxTop);
          btn.style.left = `${clampedLeft}px`;
          btn.style.top = `${clampedTop}px`;
          btn.style.bottom = 'auto';
          btn.style.right = 'auto';
        }
      }
    } catch (_) {}

    // 2. Draggable mechanics with pointer events (Smooth, Touch-Friendly, Free Roam)
    let isPointerDown = false;
    let hasMoved = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let ignoreNextClick = false;

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      isPointerDown = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      const rect = btn.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      try {
        btn.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    btn.addEventListener('pointermove', (e) => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!hasMoved && Math.hypot(dx, dy) > 4) {
        hasMoved = true;
        btn.classList.add('is-dragging');
        btn.style.bottom = 'auto';
        btn.style.right = 'auto';
      }

      if (hasMoved) {
        const pad = 6;
        const w = btn.offsetWidth || 36;
        const h = btn.offsetHeight || 36;
        const maxLeft = Math.max(pad, window.innerWidth - w - pad);
        const maxTop = Math.max(pad, window.innerHeight - h - pad);
        const newLeft = Math.min(Math.max(initialLeft + dx, pad), maxLeft);
        const newTop = Math.min(Math.max(initialTop + dy, pad), maxTop);
        btn.style.left = `${newLeft}px`;
        btn.style.top = `${newTop}px`;
      }
    });

    const finishDrag = (e) => {
      if (!isPointerDown) return;
      isPointerDown = false;

      try {
        btn.releasePointerCapture(e.pointerId);
      } catch (_) {}

      if (hasMoved) {
        btn.classList.remove('is-dragging');
        try {
          localStorage.setItem('noiradix_about_bubble_pos', JSON.stringify({
            left: btn.offsetLeft,
            top: btn.offsetTop
          }));
        } catch (_) {}
        // Suppress click event firing immediately after drag
        ignoreNextClick = true;
        setTimeout(() => { ignoreNextClick = false; }, 120);
      }
    };

    btn.addEventListener('pointerup', finishDrag);
    btn.addEventListener('pointercancel', finishDrag);

    // Click handler to open About modal
    btn.addEventListener('click', (e) => {
      if (ignoreNextClick) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      openAboutModal();
    });

    // Brand badge click in navbar also opens About modal
    if (dom.btnBrandAbout) {
      dom.btnBrandAbout.addEventListener('click', () => {
        openAboutModal();
      });
    }

    // Modal Close Triggers
    dom.btnCloseAboutModal?.addEventListener('click', closeAboutModal);
    dom.btnAboutCloseDone?.addEventListener('click', closeAboutModal);
    dom.modalAboutStudio?.addEventListener('click', (e) => {
      if (e.target === dom.modalAboutStudio) {
        closeAboutModal();
      }
    });

    // Window resize viewport safety clamping
    window.addEventListener('resize', () => {
      if (!btn.style.left) return;
      const pad = 6;
      const w = btn.offsetWidth || 36;
      const h = btn.offsetHeight || 36;
      const curLeft = parseFloat(btn.style.left) || 0;
      const curTop = parseFloat(btn.style.top) || 0;
      const maxLeft = Math.max(pad, window.innerWidth - w - pad);
      const maxTop = Math.max(pad, window.innerHeight - h - pad);
      btn.style.left = `${Math.min(Math.max(curLeft, pad), maxLeft)}px`;
      btn.style.top = `${Math.min(Math.max(curTop, pad), maxTop)}px`;
    });

    // Auto-open modal ONCE on first-time visit only
    try {
      const hasSeenAbout = localStorage.getItem('noiradix_about_seen');
      if (!hasSeenAbout) {
        localStorage.setItem('noiradix_about_seen', 'true');
        setTimeout(() => {
          openAboutModal();
        }, 400);
      }
    } catch (_) {}
  }

  // ===========================================================================
  // SMOOTH DRAG-TO-SCROLL & MOUSE-WHEEL FOR TOOLBARS (No ugly native scrollbars)
  // ===========================================================================

  function initHeaderScroll() {
    const containers = [
      document.querySelector('.studio-header'),
      document.getElementById('tabs-container'),
      document.querySelector('.studio-statusbar'),
      document.querySelector('.code-pane-header'),
      ...document.querySelectorAll('.view-sub-toolbar')
    ];

    containers.forEach(container => window.NoiraViewport.enableHorizontalDragScroll(container));
  }

  // ===========================================================================
  // ANIMATION PLAYERS INITIALIZATION
  // ===========================================================================

  function updateStudioPlayButtonUI() {
    const playButtons = [dom.btnStudioPlay, document.getElementById('btn-timeline-play')].filter(Boolean);
    const isPlaying = studioAnimPlayer && studioAnimPlayer.isPlaying;
    playButtons.forEach(btn => {
      if (isPlaying) {
        btn.innerHTML = btn.id === 'btn-timeline-play' ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-pause"></i> Pause';
        btn.title = 'Pause Animation (Space)';
        btn.classList.add('is-playing');
      } else {
        btn.innerHTML = btn.id === 'btn-timeline-play' ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-play"></i> Play';
        btn.title = 'Play Animation (Space)';
        btn.classList.remove('is-playing');
      }
    });
  }

  function updateFloatingPlayButtonUI() {
    const btn = document.getElementById('anim-play-pause');
    if (!btn) return;
    if (animPlayer && animPlayer.isPlaying) {
      btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      btn.title = 'Pause Preview';
    } else {
      btn.innerHTML = '<i class="fa-solid fa-play"></i>';
      btn.title = 'Play Preview';
    }
  }

  function initAnimationPlayers() {
    if (dom.animCanvas) {
      animPlayer = new AnimationPlayer(dom.animCanvas);
      animPlayer.scale = 8;
      window.animPlayer = animPlayer;
      animPlayer.start();
      updateFloatingPlayButtonUI();
    }

    if (dom.studioAnimCanvas) {
      studioAnimPlayer = new AnimationPlayer(dom.studioAnimCanvas);
      studioAnimPlayer.scale = 16; // 16x scale: grand, crisp, high-visibility viewport
      studioAnimPlayer.onFrameChange = (frameIdx, cellId) => {
        updateStudioActiveFrameUI(frameIdx, cellId);
      };
      window.studioAnimPlayer = studioAnimPlayer;
      studioAnimPlayer.start();
      updateStudioPlayButtonUI();
    }
  }

  // ===========================================================================
  // DIRTY STATE & AUTOSAVE / RECOVERY ENGINE
  // ===========================================================================

  function getProjectFullPath() {
    const base = (localStorage.getItem('noiradix_project_root_dir') || '').trim();
    const name = currentFileName || (currentFileHandle ? currentFileHandle.name : null) || sanitizeSafeFilename(state.doc ? state.doc.meta.title : null, '.pix2', 'untitled');
    if (!base) return name;
    const cleanBase = base.replace(/\\/g, '/').replace(/\/+$/, '');
    return `${cleanBase}/${name}`;
  }

  function setDirty(dirty, updateRevision = true) {
    isDocumentDirty = dirty;
    if (dirty && updateRevision) {
      documentRevision++;
    } else if (!dirty && updateRevision) {
      lastSavedRevision = documentRevision;
    }
    const title = (state.doc ? state.doc.meta.title : 'NOIRADIX Studio') || 'Untitled';
    const fileName = currentFileName || (currentFileHandle ? currentFileHandle.name : null) || sanitizeSafeFilename(title, '.pix2', 'untitled');
    const isDirectDiskLinked = Boolean(currentFileHandle);

    document.title = NOIRADIX_VERSION.documentTitle(
      NOIRADIX_VERSION.studio, state.doc ? fileName : null, dirty || !isDirectDiskLinked
    );

    const dirtyDot = document.getElementById('header-dirty-dot');
    if (dirtyDot) {
      if (dirty) {
        dirtyDot.className = 'header-dirty-dot is-dirty';
        dirtyDot.title = 'Unsaved changes (Ctrl+S to save)';
      } else if (!isDirectDiskLinked) {
        dirtyDot.className = 'header-dirty-dot is-draft';
        dirtyDot.title = 'In-Memory Draft - Not saved to disk file! Press Ctrl+S to save.';
      } else {
        dirtyDot.className = 'header-dirty-dot';
        dirtyDot.title = `All changes saved to disk (${currentFileHandle.name})`;
      }
    }

    if (dom.inputProjectTitle) {
      const fullPath = getProjectFullPath();
      dom.inputProjectTitle.title = dirty
        ? `● ${fileName} (Unsaved Changes - Ctrl+S to save)\nFull Path: ${fullPath}`
        : isDirectDiskLinked
          ? `${fileName} (Saved to disk)\nFull Path: ${fullPath}`
          : `${fileName} (Memory Draft - Unsaved to Disk! Press Ctrl+S)\nFull Path: ${fullPath}`;
    }

    if (!dirty) {
      updateAutosaveIndicator(currentFileHandle ? 'disk' : 'browser', Date.now());
    }

    const cur = getActiveSession();
    if (cur) {
      cur.isDirty = dirty;
      renderProjectTabs();
    }

    updateFileStatusUI();
  }

  function formatTruncatedPath(fullPath, maxChars = 34) {
    if (!fullPath) return 'Unsaved Project (Memory)';
    const normalized = fullPath.replace(/\\/g, '/');
    if (normalized.length <= maxChars) return normalized;
    const parts = normalized.split('/');
    if (parts.length <= 2) return '...' + normalized.slice(-maxChars);
    const tail = parts.slice(-2).join('/');
    return '.../' + tail;
  }

  function updateFileStatusUI() {
    const fileSourceBadge = document.getElementById('file-source-badge');
    const fileSourceText = document.getElementById('file-source-text');
    const filePathPill = document.getElementById('file-path-pill');
    const filePathText = document.getElementById('file-path-text');
    const saveStatusBadge = document.getElementById('save-status-badge');
    const saveStatusText = document.getElementById('save-status-text');
    const btnSave = document.getElementById('btn-save-pix2');

    if (!state.doc) {
      if (fileSourceBadge) {
        fileSourceBadge.className = 'file-source-badge draft';
        fileSourceBadge.innerHTML = '<i class="fa-solid fa-folder"></i> <span id="file-source-text">No File</span>';
        fileSourceBadge.title = 'No project open. Create or open a file to start editing.';
      }
      if (filePathText && filePathPill) {
        filePathText.textContent = 'No File Open';
        filePathPill.style.display = 'none';
      }
      if (saveStatusBadge) {
        saveStatusBadge.className = 'save-status-badge clean';
        saveStatusBadge.innerHTML = '<i class="fa-solid fa-minus"></i> <span id="save-status-text">Idle</span>';
        saveStatusBadge.title = 'No active document';
      }
      return;
    }

    const isDirectDiskLinked = Boolean(currentFileHandle);
    const hasFileName = Boolean(currentFileName || currentFilePath);

    if (fileSourceBadge && fileSourceText) {
      if (isDirectDiskLinked) {
        fileSourceBadge.className = 'file-source-badge local';
        fileSourceBadge.innerHTML = '<i class="fa-solid fa-hard-drive"></i> <span id="file-source-text">Local File</span>';
        fileSourceBadge.title = `File linked directly to disk (${currentFileHandle.name}). Ctrl+S writes directly to disk.`;
      } else {
        fileSourceBadge.className = 'file-source-badge draft';
        fileSourceBadge.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> <span id="file-source-text">In-Memory Draft</span>';
        fileSourceBadge.title = 'In-memory draft held in browser temporary cache. Not yet saved to physical disk file. Press Ctrl+S to save.';
      }
    }

    if (filePathText && filePathPill) {
      if (hasFileName) {
        const full = getProjectFullPath();
        filePathText.textContent = formatTruncatedPath(full);
        filePathPill.title = isDirectDiskLinked
          ? `File: ${full}\nLinked to disk (Ctrl+S saves directly without prompt)\nClick to copy full path`
          : `File: ${full}\nIn-memory draft (Press Ctrl+S to save to physical disk file)\nClick to copy name`;
        filePathPill.style.display = 'inline-flex';
      } else {
        filePathText.textContent = 'Unsaved Project (Memory)';
        filePathPill.title = 'Project is held in memory draft. Press Ctrl+S to save to disk.';
      }
    }

    if (saveStatusBadge && saveStatusText) {
      if (isDocumentDirty) {
        saveStatusBadge.className = 'save-status-badge dirty';
        saveStatusBadge.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> <span id="save-status-text">Saving...</span>';
        saveStatusBadge.title = 'Saving edits to browser memory snapshot...';
      } else {
        if (isDirectDiskLinked) {
          saveStatusBadge.className = 'save-status-badge clean';
          saveStatusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span id="save-status-text">Saved to Disk</span>';
          saveStatusBadge.title = `All changes saved directly to disk file (${currentFileHandle.name})`;
        } else {
          // In-memory draft: WARN CLEARLY that changes are memory only, not on disk!
          saveStatusBadge.className = 'save-status-badge memory-draft';
          saveStatusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span id="save-status-text">Unsaved to Disk (Memory Only)</span>';
          saveStatusBadge.title = 'Draft is temporarily held in browser cache. Press Ctrl+S to save as a physical .pix2 file on disk!';
        }
      }
    }

    if (btnSave) {
      if (isDirectDiskLinked) {
        btnSave.classList.remove('needs-disk-save');
        if (isDocumentDirty) {
          btnSave.classList.add('dirty');
          btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save *</span>';
          btnSave.title = 'Unsaved changes. Click or press Ctrl+S to save directly to disk file.';
        } else {
          btnSave.classList.remove('dirty');
          btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save</span>';
          btnSave.title = `Saved to disk (${currentFileHandle.name}). Press Ctrl+S to save again.`;
        }
      } else {
        // Needs disk save!
        btnSave.classList.add('needs-disk-save');
        btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save to Disk *</span>';
        btnSave.title = 'Draft is in browser memory only! Click or press Ctrl+S to choose a disk file location.';
      }
    }
  }

  function updateAutosaveIndicator(status, time) {
    const pill = document.getElementById('autosave-status-pill');
    const textEl = document.getElementById('autosave-status-text');
    if (!pill || !textEl) return;

    if (status === 'saving') {
      pill.className = 'autosave-pill saving';
      pill.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> <span id="autosave-status-text">Saving...</span>';
    } else if (status === 'failed') {
      pill.className = 'autosave-pill memory-draft';
      textEl.textContent = 'Browser autosave failed';
      pill.title = 'The browser could not save a recovery copy. Save to disk to keep your edits.';
    } else {
      const timeStr = time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now';
      if (status === 'disk') {
        pill.className = 'autosave-pill saved';
        pill.innerHTML = `<i class="fa-solid fa-hard-drive"></i> <span id="autosave-status-text">Saved to Disk ${timeStr}</span>`;
        pill.title = `All changes automatically synchronized to disk file (${currentFileHandle.name}) at ${timeStr}.`;
      } else {
        pill.className = 'autosave-pill memory-draft';
        pill.innerHTML = `<i class="fa-solid fa-memory"></i> <span id="autosave-status-text">Browser Draft Saved ${timeStr}</span>`;
        pill.title = `Draft saved in this browser at ${timeStr}. Press Ctrl+S to save to disk.`;
      }
    }
  }

  function initAutosave() {
    if (periodicAutosaveTimer) clearInterval(periodicAutosaveTimer);
    periodicAutosaveTimer = setInterval(() => {
      if (isDocumentDirty && state.doc) {
        saveRecoverySnapshot();
      }
    }, 30000); // 30s interval
  }

  function triggerEventAutosave() {
    setDirty(true);
    updateAutosaveIndicator('saving');
    if (debouncedAutosaveTimer) clearTimeout(debouncedAutosaveTimer);
    debouncedAutosaveTimer = setTimeout(() => {
      saveRecoverySnapshot();
    }, 1200); // 1200ms debounce
  }

  async function saveRecoverySnapshot() {
    if (!state.doc) return;
    if (floatingSelectionPixels) return;
    const doc = state.doc;
    const handle = currentFileHandle;
    const revision = documentRevision;
    const fileName = currentFileName;
    try {
      const text = PIX2.serialize(doc);
      const now = Date.now();
      const cached = await persistAllProjectSessions();
      if (state.doc !== doc || revision !== documentRevision) return;
      const snapshot = {
        timestamp: now,
        title: state.doc.meta.title || 'Untitled',
        fileName: fileName || 'new_sprite.pix2',
        data: text
      };
      if (!cached) {
        localStorage.setItem('pix2_recovery_snapshot', JSON.stringify(snapshot));
        localStorage.setItem('pix2_draft_content', text);
        localStorage.setItem('noiradix_active_file_name', snapshot.fileName);
      }
      const writtenToDisk = handle && isDocumentDirty && !activeStudioSaves
        ? await saveStudioSnapshot()
        : false;
      if (state.doc === doc && revision === documentRevision) {
        updateAutosaveIndicator(writtenToDisk ? 'disk' : cached ? 'browser' : 'failed', now);
      }
    } catch (err) {
      console.warn('Autosave snapshot failed:', err);
      updateAutosaveIndicator('failed');
    }
  }

  function checkCrashRecovery() {
    try {
      const raw = localStorage.getItem('pix2_recovery_snapshot');
      if (!raw) return false;
      const snapshot = JSON.parse(raw);
      if (!snapshot || !snapshot.data) return false;

      const timeAgoSec = Math.round((Date.now() - snapshot.timestamp) / 1000);
      const fileName = snapshot.fileName || localStorage.getItem('noiradix_active_file_name') || 'new_sprite.pix2';

      // If snapshot is recent (within 4 hours, typical refresh/tab reopen), auto-resume seamlessly
      if (timeAgoSec < 14400) {
        const doc = PIX2.parse(snapshot.data);
        currentFileHandle = null;
        currentFileName = fileName;
        currentFilePath = fileName;
        state.setDocument(doc);
        centerCellCanvas();
        centerGridCanvas();
        refreshAll();
        setDirty(false);
        syncOrRegisterProjectSession(state.doc, currentFileName, null, currentFilePath);
        showToast(`Resumed in-memory draft "${fileName}". (Unsaved to disk - Press Ctrl+S)`, 'info');
        return true;
      }

      // If snapshot is between 4 hours and 7 days old, ask user if they want to restore previous draft
      if (timeAgoSec < 86400 * 7) {
        const timeStr = new Date(snapshot.timestamp).toLocaleTimeString();
        const dateStr = new Date(snapshot.timestamp).toLocaleDateString();
        const restore = confirm(`Found unsaved in-memory draft for "${fileName}" from ${dateStr} ${timeStr}.\n\nClick OK to RESTORE this draft session.\nClick Cancel to start fresh.`);
        if (restore) {
          const doc = PIX2.parse(snapshot.data);
          currentFileHandle = null;
          currentFileName = fileName;
          currentFilePath = fileName;
          state.setDocument(doc);
          centerCellCanvas();
          centerGridCanvas();
          refreshAll();
          setDirty(false);
          syncOrRegisterProjectSession(state.doc, currentFileName, null, currentFilePath);
          showToast(`Restored in-memory draft "${fileName}". Press Ctrl+S to save to disk.`, 'info');
          return true;
        } else {
          localStorage.removeItem('pix2_recovery_snapshot');
          localStorage.removeItem('pix2_draft_content');
        }
      }
    } catch (err) {
      console.error('Error reading recovery snapshot:', err);
    }
    return false;
  }

  // ===========================================================================
  // PROJECT LOADING & SAMPLE DATA
  // ===========================================================================

  function loadSampleProject(sampleKey = 'ghost') {
    let source = window.DEFAULT_SAMPLE_PIX2;
    let fileName = 'noiradix_ghost.pix2';
    let fileTitle = 'Noiradix Ghost';
    let cellDim = 16;

    if (sampleKey === 'reaper') {
      source = window.SAMPLE_REAPER_PIX2 || null;
      fileName = 'arch_lich_reaper_48x48.pix2';
      fileTitle = 'Arch-Lich Grim Reaper 48x48';
      cellDim = 48;
    }

    if (source) {
      try {
        const doc = PIX2.parse(source);
        if (getActiveSession()) {
          createProjectSession(doc, fileName);
          selectedGridCellId = Object.keys(doc.cells)[0] || null;
          centerCellCanvas();
          centerGridCanvas();
          showToast('Loaded ' + fileTitle + ' in new tab', 'success');
          return;
        }
        state.setDocument(doc);
      } catch (err) {
        console.error('Failed parsing sample:', err);
        createBlankProject(fileName, fileTitle, 4, 4, cellDim, cellDim);
      }
    } else {
      createBlankProject(fileName, fileTitle, 4, 4, cellDim, cellDim);
    }
    currentFileHandle = null;
    clearPersistedFileHandle();
    currentFileName = fileName;
    currentFilePath = fileName;
    localStorage.setItem('noiradix_session_type', 'draft');
    localStorage.setItem('noiradix_active_file_name', currentFileName);
    localStorage.setItem('noiradix_active_file_path', currentFilePath);
    selectedGridCellId = 'cell_0_0';
    centerCellCanvas();
    centerGridCanvas();
    setDirty(false);
    syncOrRegisterProjectSession(state.doc, currentFileName, null, currentFilePath);
    refreshAll();
    showToast('Loaded ' + fileTitle, 'success');
  }

  function loadDefaultProject() {
    loadSampleProject('ghost');
  }

  function createBlankProject(fileNameOrTitle, maybeTitleOrCols, cols = 4, rows = 4, cellW = 16, cellH = 16) {
    let fileName = 'new_sprite.pix2';
    let title = 'New Sprite';
    let actualCols = 4;
    let actualRows = 4;
    let actualW = 16;
    let actualH = 16;

    if (typeof maybeTitleOrCols === 'string') {
      fileName = fileNameOrTitle;
      title = maybeTitleOrCols;
      actualCols = cols;
      actualRows = rows;
      actualW = cellW;
      actualH = cellH;
    } else if (typeof maybeTitleOrCols === 'number') {
      // Called with legacy signature: (title, cols, rows, cellW, cellH)
      title = fileNameOrTitle;
      fileName = sanitizeSafeFilename(title, '.pix2', 'new_sprite');
      actualCols = maybeTitleOrCols;
      actualRows = cols;
      actualW = rows;
      actualH = cellW;
    } else {
      fileName = fileNameOrTitle || 'new_sprite.pix2';
      title = fileName.replace(/\.pix2$/i, '').replace(/[-_]+/g, ' ');
    }

    const cleanFileName = sanitizeSafeFilename(fileName, '.pix2', 'new_sprite');
    const derivedTitle = title || cleanFileName.replace(/\.pix2$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const doc = PIX2.createDocument(derivedTitle, actualCols, actualRows, actualW, actualH);

    // 1. Save state of current session first so existing tabs and work are preserved
    saveCurrentSessionState();

    // 2. Create independent new project session and activate it
    const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const session = new ProjectSession(newId, derivedTitle, doc, null, cleanFileName, cleanFileName);
    session.lastSavedContent = (typeof PIX2 !== 'undefined') ? PIX2.serialize(doc) : '';
    session.isDirty = false;
    session.activeTabId = 'tab-grid-overview';
    session.openCellTabs = [];
    projectSessions.push(session);

    // 3. Switch active pointer to the new session
    activeProjectId = newId;
    state.setDocument(doc);
    currentFileHandle = null;
    clearPersistedFileHandle();
    currentFileName = cleanFileName;
    currentFilePath = cleanFileName;
    lastSavedContent = session.lastSavedContent;
    documentRevision = 0;
    lastSavedRevision = 0;
    state.openCellTabs = [];
    state.activeTabId = 'tab-grid-overview';
    state.selection = null;
    setDirty(false);

    centerCellCanvas();
    centerGridCanvas();

    const snapshot = {
      timestamp: Date.now(),
      title: doc.meta.title || derivedTitle,
      fileName: currentFileName,
      data: lastSavedContent
    };
    localStorage.setItem('pix2_recovery_snapshot', JSON.stringify(snapshot));
    localStorage.setItem('pix2_draft_content', lastSavedContent);
    localStorage.removeItem('pix2_last_saved_content');
    localStorage.setItem('noiradix_session_type', 'draft');
    localStorage.setItem('noiradix_active_file_name', currentFileName);
    localStorage.setItem('noiradix_active_file_path', currentFilePath);

    renderProjectTabs();
    refreshAll();
    persistAllProjectSessions();
    return session;
  }

  function openNewFileModal() {
    if (typeof handleBeforeLeaveCodeTab === 'function' && !handleBeforeLeaveCodeTab()) {
      return;
    }
    if (!dom.modalNewFile) return;

    const existingNames = new Set(projectSessions.map(s => (s.fileName || '').toLowerCase()));
    let defaultFileName = 'new_sprite.pix2';
    if (existingNames.has(defaultFileName.toLowerCase())) {
      let counter = 1;
      while (existingNames.has(`new_sprite_${counter}.pix2`)) {
        counter++;
      }
      defaultFileName = `new_sprite_${counter}.pix2`;
    }
    const derivedTitle = defaultFileName.replace(/\.pix2$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    if (dom.newFileNameInput) {
      dom.newFileNameInput.value = defaultFileName;
    }
    if (dom.newFileTitleInput) {
      dom.newFileTitleInput.value = derivedTitle;
    }
    if (dom.newFileCols) dom.newFileCols.value = '4';
    if (dom.newFileRows) dom.newFileRows.value = '4';
    if (dom.newFileCellW) dom.newFileCellW.value = '16';
    if (dom.newFileCellH) dom.newFileCellH.value = '16';

    if (dom.newFilePresets) {
      dom.newFilePresets.querySelectorAll('.chip-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === 0);
      });
    }

    updateNewFileSummary();
    dom.modalNewFile.classList.remove('hidden');

    setTimeout(() => {
      if (dom.newFileNameInput) {
        dom.newFileNameInput.focus();
        const dotIdx = dom.newFileNameInput.value.lastIndexOf('.');
        if (dotIdx > 0) {
          dom.newFileNameInput.setSelectionRange(0, dotIdx);
        } else {
          dom.newFileNameInput.select();
        }
      }
    }, 50);
  }

  function updateNewFileSummary() {
    if (!dom.newFileSummaryCard) return;
    const cols = dom.newFileCols ? (parseInt(dom.newFileCols.value, 10) || 4) : 4;
    const rows = dom.newFileRows ? (parseInt(dom.newFileRows.value, 10) || 4) : 4;
    const cw = dom.newFileCellW ? Math.min(512, Math.max(1, parseInt(dom.newFileCellW.value, 10) || 16)) : 16;
    const ch = dom.newFileCellH ? Math.min(512, Math.max(1, parseInt(dom.newFileCellH.value, 10) || 16)) : 16;
    const totalCells = cols * rows;
    const pixelsPerFrame = cw * ch;

    const activePreset = dom.newFilePresets?.querySelector('.chip-btn.active');
    const templateName = activePreset ? (activePreset.dataset.template || 'custom') : 'custom';
    let templateLabel = 'Custom Layout';
    if (templateName === '4dir') templateLabel = '4-Direction Locomotion (Down, Up, Right, Left)';
    else if (templateName === 'platformer_2dir') templateLabel = 'Platformer 2D (Idle/Run Right, Left)';
    else if (templateName === '8dir') templateLabel = '8-Direction Locomotion (Full Compass)';

    if (dom.newFileSummarySize) {
      dom.newFileSummarySize.textContent = `${cw} × ${ch} px (${pixelsPerFrame.toLocaleString()} px/frame)`;
    }
    if (dom.newFileSummaryCells) {
      dom.newFileSummaryCells.textContent = `${cols} cols × ${rows} rows (${totalCells} cells total)`;
    }
    if (dom.newFileSummaryTemplate) {
      dom.newFileSummaryTemplate.textContent = templateLabel;
    }
  }

  function openResizeFrameModal() {
    if (!state.doc || !state.doc.meta) return;
    if (!dom.modalResizeFrame) return;

    const curW = state.doc.meta.cellSize ? state.doc.meta.cellSize.w : 16;
    const curH = state.doc.meta.cellSize ? state.doc.meta.cellSize.h : 16;

    if (dom.resizeFrameW) dom.resizeFrameW.value = curW;
    if (dom.resizeFrameH) dom.resizeFrameH.value = curH;

    if (dom.resizeFramePresets) {
      dom.resizeFramePresets.querySelectorAll('.chip-btn').forEach(btn => {
        const bw = parseInt(btn.dataset.w, 10);
        const bh = parseInt(btn.dataset.h, 10);
        btn.classList.toggle('active', bw === curW && bh === curH);
      });
    }

    dom.modalResizeFrame.classList.remove('hidden');
    setTimeout(() => {
      if (dom.resizeFrameW) {
        dom.resizeFrameW.focus();
        dom.resizeFrameW.select();
      }
    }, 50);
  }

  function closeResizeFrameModal() {
    if (dom.modalResizeFrame) {
      dom.modalResizeFrame.classList.add('hidden');
    }
  }

  function confirmResizeFrame() {
    if (!state.doc) return;
    const newW = dom.resizeFrameW ? Math.min(512, Math.max(1, parseInt(dom.resizeFrameW.value, 10) || 16)) : 16;
    const newH = dom.resizeFrameH ? Math.min(512, Math.max(1, parseInt(dom.resizeFrameH.value, 10) || 16)) : 16;
    const shouldCenter = dom.chkResizeFrameCenter ? dom.chkResizeFrameCenter.checked : false;
    closeResizeFrameModal();
    setResolution(newW, newH, shouldCenter);
  }

  function closeNewFileModal() {
    if (dom.modalNewFile) {
      dom.modalNewFile.classList.add('hidden');
    }
  }

  function confirmNewFileCreation() {
    const rawName = dom.newFileNameInput ? dom.newFileNameInput.value.trim() : '';
    const rawTitle = dom.newFileTitleInput ? dom.newFileTitleInput.value.trim() : '';
    const cleanFileName = sanitizeSafeFilename(rawName || 'new_sprite', '.pix2', 'new_sprite');
    const derivedTitle = rawTitle || cleanFileName.replace(/\.pix2$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const cols = dom.newFileCols ? (parseInt(dom.newFileCols.value, 10) || 4) : 4;
    const rows = dom.newFileRows ? (parseInt(dom.newFileRows.value, 10) || 4) : 4;
    const cellW = dom.newFileCellW ? Math.min(512, Math.max(1, parseInt(dom.newFileCellW.value, 10) || 16)) : 16;
    const cellH = dom.newFileCellH ? Math.min(512, Math.max(1, parseInt(dom.newFileCellH.value, 10) || 16)) : 16;

    createBlankProject(cleanFileName, derivedTitle, cols, rows, cellW, cellH);

    // If platformer preset was selected
    const activePreset = dom.newFilePresets?.querySelector('.chip-btn.active');
    if (activePreset && activePreset.dataset.template === 'platformer_2dir' && state.doc) {
      state.doc.animations['idle_right'] = {
        name: 'Idle Right',
        direction: 'right',
        action: 'idle',
        template: 'platformer_2dir',
        frames: ['cell_0_0'],
        fps: 5,
        loop: true,
        mode: 'loop'
      };
      state.doc.animations['idle_left'] = {
        name: 'Idle Left',
        direction: 'left',
        action: 'idle',
        template: 'platformer_2dir',
        frames: ['cell_1_0'],
        fps: 5,
        loop: true,
        mode: 'loop'
      };

      if (cols >= 2) {
        state.doc.animations['run_right'] = {
          name: 'Run Right',
          direction: 'right',
          action: 'run',
          template: 'platformer_2dir',
          frames: Array.from({ length: cols }, (_, i) => `cell_0_${i}`),
          fps: 8,
          loop: true,
          mode: 'loop'
        };
        state.doc.animations['run_left'] = {
          name: 'Run Left',
          direction: 'left',
          action: 'run',
          template: 'platformer_2dir',
          frames: Array.from({ length: cols }, (_, i) => `cell_1_${i}`),
          fps: 8,
          loop: true,
          mode: 'loop'
        };
      }
    }

    closeNewFileModal();
    selectedGridCellId = 'cell_0_0';
    renderProjectTabs();
    refreshAll();
    showToast(`Created new file "${cleanFileName}"!`, 'success');
  }

  // ===========================================================================
  // IMPORT PIX2 CODE MODAL (Paste & Load Direct to Studio)
  // ===========================================================================

  function openImportCodeModal() {
    if (typeof handleBeforeLeaveCodeTab === 'function' && !handleBeforeLeaveCodeTab()) {
      return;
    }
    if (isDocumentDirty) {
      if (!confirm('You have unsaved changes. Discard and import new code?')) {
        return;
      }
    }
    if (!dom.modalImportCode) return;

    if (dom.importFileNameInput) {
      dom.importFileNameInput.value = 'imported_sprite.pix2';
    }
    if (dom.importCodeTextarea) {
      dom.importCodeTextarea.value = '';
    }
    if (dom.importCodeError) {
      dom.importCodeError.classList.add('hidden');
      dom.importCodeError.textContent = '';
    }

    dom.modalImportCode.classList.remove('hidden');

    setTimeout(() => {
      if (dom.importCodeTextarea) {
        dom.importCodeTextarea.focus();
      }
    }, 50);
  }

  function closeImportCodeModal() {
    if (dom.modalImportCode) {
      dom.modalImportCode.classList.add('hidden');
    }
  }

  function showImportCodeError(msg) {
    if (dom.importCodeError) {
      dom.importCodeError.textContent = msg;
      dom.importCodeError.classList.remove('hidden');
    } else {
      showToast(msg, 'error');
    }
  }

  function detectTitleInImportCode(text) {
    if (!text || !dom.importFileNameInput) return;
    const match = text.match(/@meta\.title\s+(?:"([^"]+)"|'([^']+)'|([^\s\r\n#;]+))/i);
    if (match) {
      const foundTitle = match[1] || match[2] || match[3];
      if (foundTitle && foundTitle.trim()) {
        const cleanName = sanitizeSafeFilename(foundTitle.trim(), '.pix2', 'imported_sprite');
        dom.importFileNameInput.value = cleanName;
      }
    }
  }

  async function pasteClipboardIntoImport() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        showToast('Clipboard access not permitted. Please press Ctrl+V directly.', 'warning');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showToast('Clipboard is empty!', 'info');
        return;
      }
      if (dom.importCodeTextarea) {
        dom.importCodeTextarea.value = text;
        dom.importCodeTextarea.focus();
        if (dom.importCodeError) {
          dom.importCodeError.classList.add('hidden');
          dom.importCodeError.textContent = '';
        }
        detectTitleInImportCode(text);
        showToast('Pasted from clipboard!', 'success');
      }
    } catch (err) {
      showToast('Could not access clipboard. Please press Ctrl+V directly.', 'info');
    }
  }

  function confirmImportCode() {
    const rawCode = dom.importCodeTextarea ? dom.importCodeTextarea.value.trim() : '';
    if (!rawCode) {
      showImportCodeError('Please paste some .pix2 code before importing.');
      return;
    }

    let parsedDoc;
    try {
      parsedDoc = PIX2.parse(rawCode);
    } catch (err) {
      showImportCodeError(err.message || 'Syntax error in .pix2 code');
      return;
    }

    if (!parsedDoc || !parsedDoc.cells || parsedDoc.cells.size === 0) {
      showImportCodeError('Invalid document: No cell or sprite frames found in .pix2 code.');
      return;
    }

    // Determine target filename
    const userSpecifiedName = dom.importFileNameInput ? dom.importFileNameInput.value.trim() : '';
    let targetFileName = userSpecifiedName;
    if (!targetFileName || targetFileName === 'imported_sprite.pix2') {
      if (parsedDoc.meta && parsedDoc.meta.title) {
        targetFileName = sanitizeSafeFilename(parsedDoc.meta.title, '.pix2', 'imported_sprite');
      } else {
        targetFileName = 'imported_sprite.pix2';
      }
    } else {
      targetFileName = sanitizeSafeFilename(targetFileName, '.pix2', 'imported_sprite');
    }

    // 1. Save state of current session first so existing tabs and work are preserved
    if (activeProjectId) {
      saveCurrentSessionState();
    }

    // 2. Always create a new project session for the imported document
    const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const session = new ProjectSession(newId, parsedDoc.meta?.title || targetFileName, parsedDoc, null, targetFileName, targetFileName);
    session.lastSavedContent = rawCode;
    session.isDirty = false;
    session.activeTabId = 'tab-grid-overview';
    session.openCellTabs = [];
    projectSessions.push(session);

    // 3. Switch active pointer to new session
    activeProjectId = newId;
    currentFileHandle = null;
    clearPersistedFileHandle();
    currentFileName = targetFileName;
    currentFilePath = targetFileName;
    lastSavedContent = rawCode;
    documentRevision = 0;
    lastSavedRevision = 0;

    state.setDocument(parsedDoc, false);
    state.activeTabId = 'tab-grid-overview';
    state.openCellTabs = [];
    state.history = [];
    state.historyIndex = -1;
    state.selection = null;
    setDirty(false);

    centerCellCanvas();
    centerGridCanvas();
    closeImportCodeModal();
    renderProjectTabs();
    refreshAll();
    persistAllProjectSessions();

    showToast(`Successfully imported "${targetFileName}" as new project tab (${parsedDoc.cells.size} frames)!`, 'success');
  }

  function refreshAll() {
    const emptyWorkspace = document.getElementById('studio-empty-workspace');
    if (!state.doc || projectSessions.length === 0) {
      if (emptyWorkspace) emptyWorkspace.style.display = 'flex';
      if (dom.tabsContainer) dom.tabsContainer.style.display = 'none';
      if (dom.animFloatingPanel) {
        dom.animFloatingPanel.classList.add('hidden');
        dom.animFloatingPanel.style.display = 'none';
        if (dom.btnToggleFloatAnim) dom.btnToggleFloatAnim.classList.remove('active');
      }
      if (dom.views) {
        Object.values(dom.views).forEach(v => {
          if (v) {
            v.classList.remove('is-active', 'active');
            v.style.display = 'none';
          }
        });
      }
      updateProjectTitleUI();
      updateFileStatusUI();
      renderProjectTabs();
      return;
    }

    if (emptyWorkspace) emptyWorkspace.style.display = 'none';
    if (dom.tabsContainer) dom.tabsContainer.style.display = 'flex';

    renderTabs();
    updateProjectTitleUI();
    updateFileStatusUI();
    updateResolutionButtons();
    renderPalette();
    populateAnimDropdowns();

    if (state.activeTabId === 'tab-grid-overview') {
      switchView('grid');
      renderGridOverview();
      updateGridInspectorUI();

      // In Grid Overview: restore floating preview if user hasn't explicitly closed it
      if (dom.animFloatingPanel) {
        if (!userClosedFloatingPreview) {
          dom.animFloatingPanel.classList.remove('hidden');
          dom.animFloatingPanel.style.display = 'flex';
          if (dom.btnToggleFloatAnim) dom.btnToggleFloatAnim.classList.add('active');
        } else {
          dom.animFloatingPanel.classList.add('hidden');
          dom.animFloatingPanel.style.display = 'none';
          if (dom.btnToggleFloatAnim) dom.btnToggleFloatAnim.classList.remove('active');
        }
      }
    } else {
      // In all other tabs (Animation Studio, Cell Editor, Code): hide floating preview completely!
      if (dom.animFloatingPanel) {
        dom.animFloatingPanel.classList.add('hidden');
        dom.animFloatingPanel.style.display = 'none';
        if (dom.btnToggleFloatAnim) dom.btnToggleFloatAnim.classList.remove('active');
      }

      // Stop marquee loop if active
      if (marqueeAnimFrameId) {
        cancelAnimationFrame(marqueeAnimFrameId);
        marqueeAnimFrameId = null;
      }

      if (state.activeTabId === 'tab-anim-studio') {
        switchView('anim');
        renderDedicatedAnimationStudio();
      } else if (state.activeTabId === 'tab-pix2-code') {
        switchView('code');
        renderCodeEditor();
      } else if (state.activeTabId === 'tab-import-slice') {
        switchView('import-slice');
        if (state.doc && state.doc.meta && state.doc.meta.cellSize) {
          if (dom.inputSliceCellW && !dom.inputSliceCellW.dataset.userModified) {
            dom.inputSliceCellW.value = state.doc.meta.cellSize.w;
          }
          if (dom.inputSliceCellH && !dom.inputSliceCellH.dataset.userModified) {
            dom.inputSliceCellH.value = state.doc.meta.cellSize.h;
          }
        }
        renderImportSliceView();
      } else {
        switchView('cell');
        renderCellEditor();
        renderCellRulers();
        renderMiniPreview();
        updateCellEditorTagUI();
        renderStructureLayersTree();
        updateIsolationBannerUI();
      }
    }

    if (animPlayer && dom.animFloatingPanel && !dom.animFloatingPanel.classList.contains('hidden')) {
      animPlayer.render();
    }
    if (studioAnimPlayer && state.activeTabId === 'tab-anim-studio') {
      studioAnimPlayer.render();
    }
  }

  function switchView(viewName) {
    for (const key in dom.views) {
      if (dom.views[key]) {
        const isActive = (key === viewName);
        dom.views[key].classList.toggle('active', isActive);
        dom.views[key].style.display = isActive ? 'flex' : 'none';
      }
    }
  }

  function updateProjectTitleUI() {
    if (dom.inputProjectTitle) {
      if (state.doc) {
        const displayFileName = currentFileName || (currentFileHandle ? currentFileHandle.name : null) || sanitizeSafeFilename(state.doc.meta.title, '.pix2', 'untitled');
        dom.inputProjectTitle.value = displayFileName;
        const fullPath = getProjectFullPath();
        dom.inputProjectTitle.title = isDocumentDirty
          ? `● ${displayFileName} (Unsaved Changes - Ctrl+S to save)\nFull Path: ${fullPath}`
          : `${displayFileName} (Saved)\nFull Path: ${fullPath}`;
      } else {
        dom.inputProjectTitle.value = '';
        dom.inputProjectTitle.title = 'No project open';
      }
    }
    const dirtyDot = document.getElementById('header-dirty-dot');
    if (dirtyDot) {
      dirtyDot.classList.toggle('is-dirty', isDocumentDirty);
    }
    const fileName = state.doc ? currentFileName || state.doc.meta.title || 'Untitled' : null;
    document.title = NOIRADIX_VERSION.documentTitle(
      NOIRADIX_VERSION.studio, fileName, isDocumentDirty || !currentFileHandle
    );
  }

  function updateResolutionButtons() {
    if (!state.doc || !state.doc.meta || !state.doc.meta.cellSize) return;
    const curW = state.doc.meta.cellSize.w;
    const curH = state.doc.meta.cellSize.h;
    const resKey = `${curW}x${curH}`;

    document.querySelectorAll('.pill-btn[data-res]').forEach(btn => {
      const isMatch = btn.dataset.res === resKey;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });
  }

  // ===========================================================================
  // TABS MANAGEMENT
  // ===========================================================================

  function renderTabs() {
    dom.tabsContainer.innerHTML = '';

    // 1. Grid Overview Tab (Pinned #1)
    const gridTab = createTabElement({
      id: 'tab-grid-overview',
      title: 'Grid Overview',
      icon: 'fa-solid fa-table-cells',
      isActive: state.activeTabId === 'tab-grid-overview',
      closable: false
    });
    dom.tabsContainer.appendChild(gridTab);

    // 2. Dedicated Animation Studio Tab (Pinned #2)
    const animStudioTab = createTabElement({
      id: 'tab-anim-studio',
      title: 'Animation Studio',
      icon: 'fa-solid fa-clapperboard',
      isActive: state.activeTabId === 'tab-anim-studio',
      closable: false
    });
    dom.tabsContainer.appendChild(animStudioTab);

    // 3. Import & Slice Tab (Pinned #3)
    const importSliceTab = createTabElement({
      id: 'tab-import-slice',
      title: 'Import & Slice',
      icon: 'fa-solid fa-scissors',
      isActive: state.activeTabId === 'tab-import-slice',
      closable: false
    });
    dom.tabsContainer.appendChild(importSliceTab);

    // 4. PIX2 Code & AI Tab (Pinned #4)
    const codeTab = createTabElement({
      id: 'tab-pix2-code',
      title: 'PIX2 Code & AI',
      icon: 'fa-solid fa-code',
      isActive: state.activeTabId === 'tab-pix2-code',
      closable: false
    });
    dom.tabsContainer.appendChild(codeTab);

    // 5. Open Cell Editor Tabs (Appended after the 4 primary tabs)
    state.openCellTabs.forEach(cellId => {
      const cell = state.doc ? state.doc.cells[cellId] : null;
      const title = cell ? (cell.name || cellId) : cellId;
      const tabEl = createTabElement({
        id: cellId,
        title: title,
        icon: 'fa-regular fa-image',
        isActive: state.activeTabId === cellId,
        closable: true,
        onClose: () => {
          state.closeCellTab(cellId);
          refreshAll();
        }
      });
      dom.tabsContainer.appendChild(tabEl);
    });
  }

  function createTabElement({ id, title, icon, isActive, closable, onClose }) {
    const tab = document.createElement('div');
    tab.className = `studio-tab ${isActive ? 'active' : ''}`;
    tab.dataset.tabId = id;

    const iconEl = document.createElement('i');
    iconEl.className = icon;
    tab.appendChild(iconEl);

    const label = document.createElement('span');
    label.className = 'tab-title';
    label.textContent = title;
    tab.appendChild(label);

    if (closable) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close-btn';
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      closeBtn.title = 'Close tab';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onClose) onClose();
      });
      tab.appendChild(closeBtn);
    }

    tab.addEventListener('click', () => {
      if (state.activeTabId === 'tab-pix2-code' && id !== 'tab-pix2-code') {
        if (typeof handleBeforeLeaveCodeTab === 'function' && !handleBeforeLeaveCodeTab()) {
          return;
        }
      }
      commitFloatingSelection();
      state.selection = null;
      closeContextMenu();
      closeGridContextMenu();
      state.activeTabId = id;
      refreshAll();
    });

    return tab;
  }

  // ===========================================================================
  // GRID OVERVIEW RENDERING & ACTIONS (Zero Overlap, Generous Spacing)
  // ===========================================================================

  // Layout metrics for Grid Overview (Generous horizontal & vertical spacing to prevent cramped layout)
  const GRID_LAYOUT = {
    leftHeaderW: 192,
    topHeaderH: 56,
    cellGapX: 28,
    cellGapY: 52,
    zoom: 4
  };

  const GRID_ZOOM_LEVELS = [0.025, 0.05, 0.075, 0.1, 0.125, 0.2, 0.25, 0.33, 0.5, 0.75, 1, 2, 3, 4, 6, 8, 12, 16];


  let gridRowDeleteButtons = [];
  let gridRowDuplicateButtons = [];
  let gridRowMoveUpButtons = [];
  let gridRowMoveDownButtons = [];
  let gridRowCards = [];
  let gridColDeleteButtons = [];
  let rowDragState = null;

  // Grid Overview Free 360° Panning State (Pan anywhere without needing Hand shortcut H)
  let isGridPanning = false;
  let gridPanX = 0, gridPanY = 0;
  let gridDragStartX = 0, gridDragStartY = 0;
  let gridDragStartPanX = 0, gridDragStartPanY = 0;

  const gridController = StudioGrid.create({
    state: studioDocumentModel, dom,
    view: {
      get gridColDeleteButtons() { return gridColDeleteButtons; }, set gridColDeleteButtons(value) { gridColDeleteButtons = value; },
      get gridPanX() { return gridPanX; }, set gridPanX(value) { gridPanX = value; },
      get gridPanY() { return gridPanY; }, set gridPanY(value) { gridPanY = value; },
      get gridRowCards() { return gridRowCards; }, set gridRowCards(value) { gridRowCards = value; },
      get gridRowDeleteButtons() { return gridRowDeleteButtons; }, set gridRowDeleteButtons(value) { gridRowDeleteButtons = value; },
      get gridRowDuplicateButtons() { return gridRowDuplicateButtons; }, set gridRowDuplicateButtons(value) { gridRowDuplicateButtons = value; },
      get gridRowMoveDownButtons() { return gridRowMoveDownButtons; }, set gridRowMoveDownButtons(value) { gridRowMoveDownButtons = value; },
      get gridRowMoveUpButtons() { return gridRowMoveUpButtons; }, set gridRowMoveUpButtons(value) { gridRowMoveUpButtons = value; },
      get marqueeAnimFrameId() { return marqueeAnimFrameId; }, set marqueeAnimFrameId(value) { marqueeAnimFrameId = value; },
      get selectedGridCellId() { return selectedGridCellId; }, set selectedGridCellId(value) { selectedGridCellId = value; },
      get rowDragState() { return rowDragState; }, set rowDragState(value) { rowDragState = value; }
    },
    GRID_LAYOUT,
    GRID_ZOOM_LEVELS,
    populateAnimDropdowns: (...args) => populateAnimDropdowns(...args),
    refreshAll: (...args) => refreshAll(...args),
    showToast: (...args) => showToast(...args),
    triggerEventAutosave: (...args) => triggerEventAutosave(...args),
    updateGridInspectorUI: (...args) => updateGridInspectorUI(...args)
  });
  const { setGridZoom, fitGridCanvas, zoomGridIn, zoomGridOut, applyGridPan, centerGridCanvas, getRowMoveUpHit, getRowMoveDownHit, getRowCardHit, getRowDuplicateHit, getRowDeleteHit, getColDeleteHit, confirmAndDeleteRow, confirmAndDeleteCol, getCellAtGrid, getCellRowCol, renderGridOverview, inferRowTitle, drawChecker, getGridCellFromPos, addGridRow, addGridCol, promptAndDuplicateRow, duplicateSpecificRow, moveRow, deleteSpecificRow, deleteSpecificCol, removeSelectedRow, removeSelectedCol } = gridController;


  // ===========================================================================
  // INTELLIGENT GRID ROW & COLUMN MANAGEMENT (SELECTION-AWARE & AUTO-FRAME EXTENSION)
  // ===========================================================================


  // ===========================================================================
  // FRAME PICKER MODAL (ANIMATION STUDIO)
  // ===========================================================================


  // ===========================================================================
  // INSPECTOR & ANIMATION TAGGING
  // ===========================================================================


  function setupBadgeMarquee(badgeEl, text, maxW = 90) {
    if (!badgeEl) return;
    badgeEl.title = text;

    let textWidth = 0;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = '11px monospace';
      textWidth = ctx.measureText(text).width;
    } catch {
      textWidth = text.length * 7;
    }

    const availableW = maxW - 14;
    if (textWidth > availableW) {
      badgeEl.innerHTML = `
        <div class="badge-marquee-container">
          <div class="badge-marquee-track">
            <span class="marquee-text">${text}</span>
            <span class="marquee-spacer"></span>
            <span class="marquee-text">${text}</span>
            <span class="marquee-spacer"></span>
          </div>
        </div>`;
      badgeEl.classList.add('has-marquee');
    } else {
      badgeEl.textContent = text;
      badgeEl.classList.remove('has-marquee');
    }
  }

  function updateGridInspectorUI() {
    if (!state.doc || !dom.gridCellName) return;
    let cell = state.doc.cells[selectedGridCellId];
    if (!cell) {
      const match = (selectedGridCellId || '').match(/cell_(\d+)_(\d+)/);
      if (match) {
        cell = getCellAtGrid(state.doc, parseInt(match[1], 10), parseInt(match[2], 10));
        if (cell) selectedGridCellId = cell.id;
      }
    }
    if (!cell) return;

    if (dom.gridSelectedBadge) setupBadgeMarquee(dom.gridSelectedBadge, selectedGridCellId, 90);
    if (dom.gridCellIdInput) dom.gridCellIdInput.value = cell.id || selectedGridCellId;
    dom.gridCellName.value = cell.name || selectedGridCellId;

    const { r: selR, c: selC } = getCellRowCol(selectedGridCellId);

    if (dom.gridInspectorRowLabel) {
      dom.gridInspectorRowLabel.textContent = `Row ${selR}`;
    }

    let currentAnim = '';
    for (const animName in state.doc.animations) {
      const anim = state.doc.animations[animName];
      if (anim.frames && (anim.frames.includes(selectedGridCellId) || anim.frames.some(fid => fid.startsWith(`cell_${selR}_`)))) {
        currentAnim = animName;
        break;
      }
    }
    if (dom.gridCellAnim) {
      dom.gridCellAnim.value = currentAnim || '';
    }

    if (dom.gridCellDir) {
      dom.gridCellDir.value = cell.direction || 'none';
    }
  }

  function updateCellEditorTagUI() {
    const cell = state.getActiveCell();
    if (!cell || !state.doc) return;

    if (dom.inputCellName) dom.inputCellName.value = cell.name || cell.id;

    let currentAnim = '';
    for (const animName in state.doc.animations) {
      if (state.doc.animations[animName].frames.includes(cell.id)) {
        currentAnim = animName;
        break;
      }
    }
    if (dom.cellAnimSelect && currentAnim) {
      dom.cellAnimSelect.value = currentAnim;
    }
    if (dom.cellDirSelect) {
      dom.cellDirSelect.value = cell.direction || 'none';
    }
  }

  function updateIsolationBannerUI() {
    if (!dom.isolationBanner) return;
    if (state.isolatedNodeId) {
      dom.isolationBanner.classList.remove('hidden');
      dom.isolationBanner.style.display = 'flex';
      const cell = state.getActiveCell();
      let nodeLabel = state.isolatedNodeId;
      if (cell && typeof state.findNode === 'function') {
        const match = state.findNode(cell.id, state.isolatedNodeId);
        if (match && match.node) {
          nodeLabel = `${match.node.name || match.node.id} (${match.node.type})`;
        }
      }
      if (dom.isolationBreadcrumbText) {
        dom.isolationBreadcrumbText.textContent = nodeLabel;
      }
    } else {
      dom.isolationBanner.classList.add('hidden');
      dom.isolationBanner.style.display = 'none';
    }
  }

  function renderStructureLayersTree() {
    if (!dom.structureLayersCard || !dom.structureTreeContainer) return;
    const isCellTab = state.activeTabId && state.activeTabId.startsWith('cell_');
    if (!isCellTab && !state.getActiveCell()) {
      dom.structureLayersCard.style.display = 'none';
      return;
    }
    dom.structureLayersCard.style.display = 'block';

    const cell = state.getActiveCell();
    if (!cell) {
      dom.structureTreeContainer.innerHTML = '<div style="padding: 8px; color: var(--text-dim); font-size: 11px;">No cell selected</div>';
      return;
    }

    if (!cell.layers || cell.layers.length === 0) {
      dom.structureTreeContainer.innerHTML = `
        <div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 11px;">
          <p style="margin: 0 0 8px 0;">Flat PIX2 1.0 frame (no layers).</p>
          <button id="btn-convert-v11-layers" class="btn btn-xs btn-primary" style="display: inline-flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-layer-group"></i> Convert to PIX2 1.1 Layers
          </button>
        </div>
      `;
      const btnConvert = document.getElementById('btn-convert-v11-layers');
      if (btnConvert) {
        btnConvert.addEventListener('click', () => {
          // Never create an empty layer before preserving the flat source:
          // addLayer() synchronizes its composite and would otherwise replace
          // cell.pixels before it can be copied.  The canonical upgrader
          // snapshots every cell first and creates deterministic legacy IDs.
          const upgrade = state.upgradeDocumentToV11(cell.id, { profile: 'studio' });
          if (!upgrade.success) {
            showToast(`Unable to convert document: ${upgrade.error || 'unknown error'}`, 'error');
            return;
          }
          const curSession = getActiveSession();
          if (curSession) {
            curSession.doc = state.doc;
          }
          saveCurrentSessionState();
          triggerEventAutosave();
          renderProjectTabs();
          refreshAll();
          showToast('Converted document to PIX2 1.1 layers without changing pixels');
        });
      }
      return;
    }

    EditorOutliner.render(dom.structureTreeContainer, cell, state, {
      before: commitFloatingSelection,
      selected: () => regionSelection.resolve(cell, state.activeLayerId, state.isolatedNodeId).map(node => node.id),
      focus: ({ node }, extend) => {
        if (extend && node.type !== 'layer') {
          selectTool('region-select');
          const selected = regionSelection.toggle(cell, state.activeLayerId, state.isolatedNodeId, node.id);
          renderCellOverlay();
          return selected;
        }
        const ids = node.type === 'layer' ? [] : [node.id];
        regionSelection.focus(cell, state.activeLayerId, state.isolatedNodeId, ids);
        renderCellOverlay();
        return ids;
      },
      change: label => {
        state.syncCellComposite(cell.id);
        state.saveSnapshot(label);
        triggerEventAutosave();
        refreshAll();
      },
      isolate: node => {
        commitFloatingSelection();
        state.setIsolation(cell.id, node.id);
        selectTool('region-select');
        refreshAll();
      },
      exitIsolation: () => {
        exitRegionIsolation(cell);
        renderCellEditor();
        updateIsolationBannerUI();
      },
      selectContent: ({ node }) => {
        const bounds = StructureOps.bounds(node);
        if (!bounds) return;
        commitFloatingSelection();
        selectTool('select');
        state.selection = bounds;
        renderCellOverlay();
      }
    });
  }

  // ===========================================================================
  // IMPORT & SLICE STUDIO CONTROLLER (PIX2 1.1)
  // ===========================================================================

  let isSpacebarHeld = false;

  const sliceController = StudioSlice.create({
    dom, importSliceState,
    input: { get spaceHeld() { return isSpacebarHeld; }, set spaceHeld(value) { isSpacebarHeld = value; } },
    getActiveView: () => state.activeTabId,
    activateView: view => { state.activeTabId = view; },
    commitProject(draft, candidate, fileName, count) {
      createProjectSession(draft, fileName);
      state.beginStroke();
      state.doc = candidate;
      state.endStroke(`Import ${count} Slices`);
      triggerEventAutosave();
      state.activeTabId = 'tab-grid-overview';
      updateResolutionButtons();
      centerGridCanvas();
      refreshAll();
    },
    refreshAll, escapeHTML, sanitizeSafeFilename, showToast
  });
  const { setSliceTool, setSliceZoom, updateSliceTransform, applySliceZoom, fitSliceZoom, batchTagPrefix, autoTag4Dir, autoTag8Dir, clearAllTags, getSliceCanvasCoords, drawRoundedRect, hitTestSliceHandles, renderSliceRulers, renderImportSliceView, renderImportSlicesList, deleteImportSlice, syncUntrimmedSliceSize, initInspectorDeckResizer, initImportSliceCanvasEvents, updateImportSlices, commitImportSlicesToProject, handleSingleFileToImportSlice, handlePairDropToImportSlice } = sliceController;


  // ===========================================================================
  // ACTION & DIRECTION TEMPLATE GENERATOR MODAL LOGIC
  // ===========================================================================

  let currentTemplateMode = 4; // 2, 4 or 8

  const DIRECTIONS_2 = [
    { id: 'right', label: 'Right' },
    { id: 'left', label: 'Left' }
  ];

  const DIRECTIONS_4 = [
    { id: 'down', label: 'Down' },
    { id: 'up', label: 'Up' },
    { id: 'right', label: 'Right' },
    { id: 'left', label: 'Left' }
  ];

  const DIRECTIONS_8 = [
    { id: 'down', label: 'Down' },
    { id: 'up', label: 'Up' },
    { id: 'right', label: 'Right' },
    { id: 'left', label: 'Left' },
    { id: 'down_left', label: 'Down-Left' },
    { id: 'down_right', label: 'Down-Right' },
    { id: 'up_left', label: 'Up-Left' },
    { id: 'up_right', label: 'Up-Right' }
  ];

  const animationController = StudioAnimation.create({
    state: studioDocumentModel, dom,
    view: {
      get activeStudioClipId() { return activeStudioClipId; }, set activeStudioClipId(value) { activeStudioClipId = value; },
      get currentTemplateMode() { return currentTemplateMode; }, set currentTemplateMode(value) { currentTemplateMode = value; },
      get selectedGridCellId() { return selectedGridCellId; }, set selectedGridCellId(value) { selectedGridCellId = value; },
      get animPlayer() { return animPlayer; }, set animPlayer(value) { animPlayer = value; },
      get studioAnimPlayer() { return studioAnimPlayer; }, set studioAnimPlayer(value) { studioAnimPlayer = value; }
    },
    DIRECTIONS_2,
    DIRECTIONS_4,
    DIRECTIONS_8,
    escapeHTML: (...args) => escapeHTML(...args),
    getCellAtGrid: (...args) => getCellAtGrid(...args),
    getCellRowCol: (...args) => getCellRowCol(...args),
    handleBeforeLeaveCodeTab: (...args) => handleBeforeLeaveCodeTab(...args),
    inferRowTitle: (...args) => inferRowTitle(...args),
    refreshAll: (...args) => refreshAll(...args),
    showToast: (...args) => showToast(...args),
    triggerEventAutosave: (...args) => triggerEventAutosave(...args),
    updateGridInspectorUI: (...args) => updateGridInspectorUI(...args),
    updateStudioPlayButtonUI: (...args) => updateStudioPlayButtonUI(...args)
  });
  const { openFramePickerModal, closeFramePickerModal, renderFramePickerCards, appendCellToActiveAnimation, populateAnimDropdowns, assignRowToAnimation, assignCellToAnimation, applyRowBatchTag, ensureGridDimensions, openActionTemplateModal, closeActionTemplateModal, syncActiveActionChip, renderTemplateLivePreview, applyActionTemplate, autoSetup4Directions, autoSetup8Directions, renderDedicatedAnimationStudio, updateStudioActiveFrameUI, selectStudioFrame, renderTimelineFramesStrip } = animationController;


  // ===========================================================================
  // DEDICATED ANIMATION STUDIO WORKSPACE LOGIC
  // ===========================================================================


  // ===========================================================================
  // CELL EDITOR RENDERING & DRAWING
  // ===========================================================================

  let isPointerDown = false;
  let lastPixelX = null;
  let lastPixelY = null;
  let dragStartX = null;
  let dragStartY = null;

  const cellArtwork = document.createElement('canvas');
  let bufferedCell = null;
  let bufferedPixels = null;
  let bufferedIsolation = null;

  function sizeCellCanvases(w, h, zoom) {
    const width = Math.max(1, Math.round(w * zoom));
    const height = Math.max(1, Math.round(h * zoom));
    EditorCanvas.resize(dom.cellCanvas, width, height);
    EditorCanvas.resize(dom.cellOverlay, width, height);
    if (state.showRulers) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      EditorRulers.sizeRuler(dom.rulerTop, width, false, dpr);
      EditorRulers.sizeRuler(dom.rulerLeft, height, true, dpr);
    }
  }

  function renderCellEditor(reuseArtwork = false) {
    const cell = state.getActiveCell();
    if (!cell || !state.doc) return;
    if (state.isolatedNodeId && !StructureOps.findNode(cell, state.isolatedNodeId)) state.isolatedNodeId = null;

    const cw = state.doc.meta.cellSize.w;
    const ch = state.doc.meta.cellSize.h;
    const limit = NoiraViewport.artworkZoomLimit(cw, ch);
    const zoom = state.cellZoom = Math.min(state.cellZoom, limit);
    sizeCellCanvases(cw, ch, zoom);
    if (dom.statusZoomLabel) {
      const label = `Zoom: ${NoiraViewport.formatArtworkZoom(zoom)} / ${limit}×`;
      if (dom.statusZoomLabel.textContent !== label) dom.statusZoomLabel.textContent = label;
      dom.statusZoomLabel.title = 'Current zoom / maximum for this frame';
    }

    const ctx = dom.cellCanvas.getContext('2d');
    if (!reuseArtwork || bufferedCell !== cell || bufferedPixels !== cell.pixels ||
        bufferedIsolation !== state.isolatedNodeId || cellArtwork.width !== cw || cellArtwork.height !== ch) {
      if (cellArtwork.width !== cw) cellArtwork.width = cw;
      if (cellArtwork.height !== ch) cellArtwork.height = ch;
      const source = cellArtwork.getContext('2d');
      source.clearRect(0, 0, cw, ch);
      const pixels = state.isolatedNodeId
        ? PIX2.compositeCellLayers(cell, { w: cw, h: ch }, { isolatedNodeId: state.isolatedNodeId, dimNonIsolated: 0 })
        : cell.pixels;
      EditorCanvas.drawPixels(source, pixels, cw, ch);
      bufferedCell = cell;
      bufferedPixels = cell.pixels;
      bufferedIsolation = state.isolatedNodeId;
    }
    const bounds = EditorCanvas.visibleBounds(dom.cellCanvas, dom.canvasViewport, cw, ch, zoom);
    const slice = EditorCanvas.artworkSlice(bounds, cw, ch, zoom);
    if (slice.width <= 0 || slice.height <= 0) return;
    const isDark = document.body.classList.contains('dark-theme');
    const background = state.checkerboardBg ? EditorCanvas.checker(ctx, zoom, isDark) : '#ffffff';
    EditorCanvas.paintArtwork(ctx, cellArtwork, slice, background);

    // 3. Grid lines
    if (state.showGridLines && zoom >= 8) {
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        ctx.moveTo(x * zoom - 0.5, slice.y);
        ctx.lineTo(x * zoom - 0.5, slice.y + slice.height);
      }
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        ctx.moveTo(slice.x, y * zoom - 0.5);
        ctx.lineTo(slice.x + slice.width, y * zoom - 0.5);
      }
      ctx.stroke();
    }

    if (state.symmetry || state.symmetryVertical) {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      if (state.symmetry) {
        ctx.moveTo(cw * zoom / 2, 0);
        ctx.lineTo(cw * zoom / 2, ch * zoom);
      }
      if (state.symmetryVertical) {
        ctx.moveTo(0, ch * zoom / 2);
        ctx.lineTo(cw * zoom, ch * zoom / 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const resolution = `${cw} × ${ch} px`;
    if (dom.labelResolution && dom.labelResolution.textContent !== resolution) {
      dom.labelResolution.textContent = resolution;
    }
    if (!reuseArtwork && state.currentTool === 'region-select') renderCellOverlay();
  }

  const cellRulerBaseline = {
    top: document.createElement('canvas'),
    left: document.createElement('canvas')
  };
  let rulerHoverX = null, rulerHoverY = null;
  let cellRulerHighlightKey = null;

  function renderCellRulers() {
    const show = Boolean(state.doc && state.showRulers);
    dom.canvasContainerWithRulers.classList.toggle('hide-rulers', !show);
    if (!show) return;
    const { w, h } = state.doc.meta.cellSize;
    const zoom = state.cellZoom;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const dark = document.body.classList.contains('dark-theme');
    EditorRulers.paintRuler(cellRulerBaseline.top, w, zoom, false, dpr, dark);
    EditorRulers.paintRuler(cellRulerBaseline.left, h, zoom, true, dpr, dark);
    cellRulerHighlightKey = null;
    drawCellRulerHighlights();
  }

  function drawCellRulerHighlights() {
    if (!state.doc || !state.showRulers) return;
    const { w, h } = state.doc.meta.cellSize;
    const { cellZoom: zoom, selection } = state;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = [w, h, zoom, dpr, rulerHoverX, rulerHoverY, selection?.x, selection?.y, selection?.w, selection?.h].join('/');
    if (key === cellRulerHighlightKey) return;
    cellRulerHighlightKey = key;
    EditorRulers.drawOverlay(dom.rulerTop, cellRulerBaseline.top, w, zoom, false, dpr, rulerHoverX, selection?.x, selection?.w);
    EditorRulers.drawOverlay(dom.rulerLeft, cellRulerBaseline.left, h, zoom, true, dpr, rulerHoverY, selection?.y, selection?.h);
  }

  function renderMiniPreview() {
    const cell = state.getActiveCell();
    if (!cell || !state.doc || !dom.miniPreviewCanvas) return;

    const cw = (cell.size && cell.size.w) || (state.doc ? state.doc.meta.cellSize.w : 16);
    const ch = (cell.size && cell.size.h) || (state.doc ? state.doc.meta.cellSize.h : 16);
    dom.miniPreviewCanvas.width = cw;
    dom.miniPreviewCanvas.height = ch;
    const ctx = dom.miniPreviewCanvas.getContext('2d');
    for (const coord in cell.pixels) {
      const [x, y] = coord.split(',').map(Number);
      ctx.fillStyle = cell.pixels[coord];
      ctx.fillRect(x, y, 1, 1);
    }
    updateMiniPreviewZoom();
  }

  function getMiniPreviewScale() {
    if (miniPreviewScale !== 'fit') return miniPreviewScale;
    const canvas = dom.miniPreviewCanvas;
    const viewport = canvas.parentElement;
    return window.NoiraViewport.computeFitZoom(viewport.clientWidth, viewport.clientHeight,
      canvas.width, canvas.height, MINI_PREVIEW_ZOOMS, 18);
  }

  function updateMiniPreviewZoom() {
    const canvas = dom.miniPreviewCanvas;
    const scale = getMiniPreviewScale();
    canvas.style.width = canvas.width * scale + 'px';
    canvas.style.height = canvas.height * scale + 'px';
    document.getElementById('preview-zoom-value').value = scale + '×';
    document.getElementById('preview-zoom-fit').classList.toggle('active', miniPreviewScale === 'fit');
  }

  function stepMiniPreviewZoom(direction) {
    const index = MINI_PREVIEW_ZOOMS.indexOf(getMiniPreviewScale());
    miniPreviewScale = MINI_PREVIEW_ZOOMS[Math.max(0, Math.min(MINI_PREVIEW_ZOOMS.length - 1, index + direction))];
    updateMiniPreviewZoom();
  }

  // ===========================================================================
  // PALETTE UI & PRESETS LIBRARY (Custom Library + Built-in Presets)
  // ===========================================================================


  const paletteLibrary = EditorPaletteLibrary.create({
    storage: localStorage,
    getSelect: () => dom.paletteSelect,
    builtIns: [
      { id: 'wispling', name: 'Wispling Ghost', count: 8 },
      { id: 'pico8', name: 'Pico-8', count: 16 },
      { id: 'gameboy', name: 'GameBoy', count: 4 },
      { id: 'endesga32', name: 'Endesga 32', count: 32 }
    ],
    actionLabel: '+ Save Current Palette...',
    fallback: null
  });
  const { load: loadCustomPalettes, save: saveCustomPalettes, populate: populatePaletteDropdown } = paletteLibrary;

  function promptAndSavePalettePreset() {
    if (!state.doc || !state.doc.palette) {
      showToast('No active document palette to save.', 'error');
      return;
    }

    const colors = [];
    for (const id in state.doc.palette) {
      const col = state.doc.palette[id];
      if (typeof col === 'string' && col.startsWith('#')) {
        const normalized = (typeof PIX2 !== 'undefined') ? PIX2.normalizeHex(col) : col;
        if (!colors.includes(normalized)) colors.push(normalized);
      }
    }

    if (colors.length === 0) {
      showToast('Document palette has no valid colors to save.', 'error');
      return;
    }

    const defaultName = `${state.doc.meta.title || 'Custom'} Palette`;
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

    if (state.presetPalettes) {
      state.presetPalettes[`custom_${key}`] = [...colors];
    }

    populatePaletteDropdown();
    if (dom.paletteSelect) {
      dom.paletteSelect.value = `custom_${key}`;
    }

    showToast(`Saved palette preset "${finalName}" (${colors.length} colors) to library!`, 'success');
  }

  function renderPalette() {
    if (!state.doc || !dom.paletteSwatches) return;
    dom.paletteSwatches.innerHTML = '';

    const pal = state.doc.palette;
    for (const id in pal) {
      if (typeof PIX2 !== 'undefined' && !PIX2.isSafeIdentifier(id)) continue;
      const color = (typeof PIX2 !== 'undefined') ? PIX2.normalizeHex(pal[id]) : pal[id];
      const swatch = document.createElement('div');
      swatch.className = `palette-swatch ${color === state.primaryColor ? 'active' : ''}`;
      swatch.style.backgroundColor = color;
      swatch.title = `Color [${id}]: ${color}`;

      swatch.addEventListener('click', () => {
        state.primaryColor = color;
        updateColorUI();
      });

      swatch.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        state.secondaryColor = color;
        updateColorUI();
      });

      dom.paletteSwatches.appendChild(swatch);
    }

    updateColorUI();
  }

  function updateColorUI() {
    if (dom.colorPrimary) dom.colorPrimary.style.backgroundColor = state.primaryColor;
    if (dom.colorSecondary) dom.colorSecondary.style.backgroundColor = state.secondaryColor;
    if (dom.colorPickerInput) dom.colorPickerInput.value = state.primaryColor.slice(0, 7);

    document.querySelectorAll('.palette-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.style.backgroundColor === state.primaryColor);
    });
  }

  // ===========================================================================
  // CANVAS MOUSE EVENTS & DRAWING (BoundingRect Precise Mapping)
  // ===========================================================================

  function getPixelCoords(e) {
    const rect = dom.cellOverlay.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoom = state.cellZoom;
    const px = Math.floor(mx / zoom);
    const py = Math.floor(my / zoom);

    const cw = state.doc ? state.doc.meta.cellSize.w : 16;
    const ch = state.doc ? state.doc.meta.cellSize.h : 16;

    if (px >= 0 && px < cw && py >= 0 && py < ch) {
      return { x: px, y: py };
    }
    return null;
  }

  let isMovingSelection = false;
  let moveStartX = null;
  let moveStartY = null;
  let floatingSelectionPixels = null;
  let floatingOriginalSel = null;
  let floatingCurrentX = 0;
  let floatingCurrentY = 0;

  // Selection Transform Engine (Scaling & Free Rotation)
  let isScalingSelection = false;
  let activeScaleHandle = null;
  let scaleOriginalSel = null;
  let scaleOriginalPixels = null;
  let isRotatingSelection = false;
  let rotationCenter = null;
  let rotationStartAngle = 0;
  let rotationCurrentAngle = 0;
  let rotationBaseFloatingPixels = null;
  let rotationBaseSel = null;
  // Transform previews replace floatingSelectionPixels. Keep an immutable
  // lift-time baseline so Escape can restore, rather than commit, artwork.
  let floatingBaselinePixels = null;
  let floatingBaselineSel = null;
  let floatingSelectionCellId = null;
  let floatingSelectionTargetId = null;

  // PIX2 1.1 keeps source pixels in the selected region, while cell.pixels is
  // a composited cache. Keep every selection transaction bound to that source
  // node so changing a tree row mid-transform can never redirect its write.
  function getSelectionTarget(cell, targetId = null) {
    if (!cell) return null;
    if (!cell.layers || cell.layers.length === 0) return cell;
    if (targetId) {
      const match = state.findNode(cell.id, targetId);
      return match ? match.node : null;
    }
    return state.getActiveRegion(cell.id);
  }

  function getFloatingSelectionCell() {
    return (floatingSelectionCellId && state.doc && state.doc.cells)
      ? state.doc.cells[floatingSelectionCellId]
      : state.getActiveCell();
  }

  function ensureFloatingSelection() {
    if (floatingSelectionPixels && floatingOriginalSel) return;
    const cell = state.getActiveCell();
    const target = getSelectionTarget(cell);
    if (!cell || !target || !state.selection) return;
    floatingOriginalSel = { ...state.selection };
    floatingSelectionCellId = cell.id;
    floatingSelectionTargetId = cell.layers && cell.layers.length ? target.id : null;
    floatingCurrentX = floatingOriginalSel.x;
    floatingCurrentY = floatingOriginalSel.y;
    state.beginStroke();
    const lifted = floatingSession.lift(state.doc, cell, target, floatingOriginalSel);
    if (!lifted) return;
    floatingSelectionPixels = lifted.pixels;
    floatingBaselinePixels = lifted.baselinePixels;
    floatingBaselineSel = lifted.baselineBounds;
    if (cell.layers && cell.layers.length) state.syncCellComposite(cell.id);
    renderCellEditor();
  }

  const floatingSession = EditorFloatingSelection.create({
    get pixels() { return floatingSelectionPixels; }, set pixels(value) { floatingSelectionPixels = value; },
    get originalBounds() { return floatingOriginalSel; }, set originalBounds(value) { floatingOriginalSel = value; },
    get baselinePixels() { return floatingBaselinePixels; }, set baselinePixels(value) { floatingBaselinePixels = value; },
    get baselineBounds() { return floatingBaselineSel; }, set baselineBounds(value) { floatingBaselineSel = value; },
    get targetId() { return floatingSelectionTargetId; }, set targetId(value) { floatingSelectionTargetId = value; },
    get baselineTargetId() { return floatingSelectionTargetId; }, set baselineTargetId(value) { floatingSelectionTargetId = value; },
    get x() { return floatingCurrentX; }, set x(value) { floatingCurrentX = value; },
    get y() { return floatingCurrentY; }, set y(value) { floatingCurrentY = value; }
  });

  function commitFloatingSelection(label = 'Move Selection') {
    if (!floatingSelectionPixels || !floatingOriginalSel) return;
    const cell = getFloatingSelectionCell();
    const size = cell && (cell.size || state.doc.meta.cellSize);
    const bounds = { x: floatingCurrentX, y: floatingCurrentY, w: floatingOriginalSel.w, h: floatingOriginalSel.h };
    const result = floatingSession.commit(state.doc, bounds, size);
    EditorCanvas.refreshSourceComposite(PIX2, result.restored);
    if (result.status === 'committed') {
      state.selection = { ...result.bounds };
      if (cell.layers && cell.layers.length) state.syncCellComposite(cell.id);
      if (state.endStroke(label)) triggerEventAutosave();
      renderCellEditor();
      renderMiniPreview();
    } else {
      state.strokePreState = null;
      renderCellEditor();
      renderMiniPreview();
    }
    floatingSession.clear();
    floatingOriginalSel = null;
    floatingBaselinePixels = null;
    floatingBaselineSel = null;
    floatingSelectionCellId = null;
    floatingSelectionTargetId = null;
  }

  function cancelFloatingSelection() {
    const cell = getFloatingSelectionCell();
    EditorCanvas.refreshSourceComposite(PIX2, floatingSession.cancel());
    // beginStroke() captured the pre-lift document. Cancellation leaves no
    // committed mutation, so discard it rather than recording a false undo.
    state.strokePreState = null;
    floatingSession.clear();
    floatingOriginalSel = null;
    floatingBaselinePixels = null;
    floatingBaselineSel = null;
    floatingSelectionCellId = null;
    floatingSelectionTargetId = null;
    isMovingSelection = false;
    isScalingSelection = false;
    isRotatingSelection = false;
    activeScaleHandle = null;
    scaleOriginalSel = null;
    scaleOriginalPixels = null;
    rotationCenter = null;
    rotationBaseFloatingPixels = null;
    rotationBaseSel = null;
    state.selection = null;
    renderCellEditor();
    renderMiniPreview();
    renderCellOverlay();
  }

  function renderMovingSelectionOverlay() {
    clearOverlay();
    if (!dom.cellOverlay || !floatingOriginalSel) return;
    const ctx = dom.cellOverlay.getContext('2d');
    const zoom = state.cellZoom;

    // Draw floating pixels moving with cursor
    if (floatingSelectionPixels) {
      for (const relKey in floatingSelectionPixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const px = floatingCurrentX + rx;
        const py = floatingCurrentY + ry;
        ctx.fillStyle = floatingSelectionPixels[relKey];
        ctx.fillRect(px * zoom, py * zoom, zoom, zoom);
      }
    }

    // Draw dashed marquee bounding floating pixels
    const sx = floatingCurrentX * zoom;
    const sy = floatingCurrentY * zoom;
    const sw = floatingOriginalSel.w * zoom;
    const sh = floatingOriginalSel.h * zoom;

    ctx.fillStyle = 'rgba(99, 102, 241, 0.16)';
    ctx.fillRect(sx, sy, sw, sh);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx, sy, sw, sh);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.setLineDash([]);
    SelectionTransform.drawHandles(ctx, { ...floatingOriginalSel, x: floatingCurrentX, y: floatingCurrentY }, zoom);
  }

  function editorPointerView(event, canvas, zoom) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, zoom, shift: event.shiftKey };
  }

  function paintCellStroke(cell, tool, x0, y0, x1, y1) {
    const target = cell.layers?.length ? state.getActiveRegion(cell.id) : cell;
    if (!target) return;
    const isEraser = tool === 'eraser';
    const color = isEraser ? null : Tools.brushColor(state.primaryColor, brushSettings.opacity);
    if (!isEraser && !color) return;
    const size = isEraser ? brushSettings.eraserSize : brushSettings.size;
    const dimensions = cell.size || state.doc.meta.cellSize;
    const { keys: changed } = Tools.editRaster(target, { ...dimensions, color }, plot => {
      Tools.brushStroke(x0, y0, x1, y1, size,
        { ...dimensions, symH: state.symmetry, symV: state.symmetryVertical }, plot);
    });
    if (!changed.size) return;
    const display = EditorCanvas.updateComposite(PIX2, cell, dimensions, changed, state.isolatedNodeId);
    const reuse = bufferedCell === cell && bufferedPixels === cell.pixels && bufferedIsolation === state.isolatedNodeId;
    const source = reuse ? cellArtwork.getContext('2d') : null;
    const preview = dom.miniPreviewCanvas?.getContext('2d');
    for (const key of changed) {
      const [x, y] = key.split(',').map(Number);
      if (source) EditorCanvas.writePixel(source, x, y, display[key]);
      if (preview) EditorCanvas.writePixel(preview, x, y, cell.pixels[key]);
    }
    renderCellEditor(reuse);
  }

  function getBrushPoint(event) {
    const size = state.currentTool === 'pen' ? brushSettings.size : brushSettings.eraserSize;
    return Tools.brushPoint(editorPointerView(event, dom.cellOverlay, state.cellZoom), size, state.doc.meta.cellSize);
  }

  function handleCellMouseDown(e) {
    if (e.button !== 0 || state.currentTool === 'pan' || dom.canvasViewport.classList.contains('space-held')) return;

    let coords = getPixelCoords(e);
    if (!coords) return;

    const cell = state.getActiveCell();
    if (!cell) return;
    const tool = state.currentTool;
    if (tool === 'region-select') {
      if (e.altKey) return;
      const view = editorPointerView(e, dom.cellOverlay, state.cellZoom);
      const hit = regionSelection.start(cell, state.activeLayerId, state.isolatedNodeId, coords, e.shiftKey || e.ctrlKey || e.metaKey, view);
      if (hit && !state.activeLayerId) {
        state.activeLayerId = hit.layer.id;
        regionSelection.start(cell, state.activeLayerId, state.isolatedNodeId, coords, e.shiftKey || e.ctrlKey || e.metaKey, view);
      }
      if (hit) state.activeRegionId = hit.node.id;
      renderStructureLayersTree();
      renderCellOverlay();
      return;
    }

    // Check if clicking on selection transform handles (Rotation or Scale)
    if (state.selection && typeof SelectionTransform !== 'undefined') {
      const rect = dom.cellOverlay.getBoundingClientRect();
      const mouseCanvasX = e.clientX - rect.left;
      const mouseCanvasY = e.clientY - rect.top;
      const hit = SelectionTransform.hitTestSelectionHandles(state.selection, mouseCanvasX, mouseCanvasY, state.cellZoom);

      if (hit === 'rot') {
        isRotatingSelection = true;
        isPointerDown = true;
        ensureFloatingSelection();
        rotationBaseFloatingPixels = { ...floatingSelectionPixels };
        rotationBaseSel = { ...state.selection };
        const cx = state.selection.x + state.selection.w / 2;
        const cy = state.selection.y + state.selection.h / 2;
        const screenCenterX = rect.left + cx * state.cellZoom;
        const screenCenterY = rect.top + cy * state.cellZoom;
        rotationCenter = { x: screenCenterX, y: screenCenterY, cx, cy };
        rotationStartAngle = Math.atan2(e.clientY - screenCenterY, e.clientX - screenCenterX);
        rotationCurrentAngle = 0;
        return;
      }

      if (hit && hit !== 'body') {
        isScalingSelection = true;
        activeScaleHandle = hit;
        isPointerDown = true;
        ensureFloatingSelection();
        scaleOriginalPixels = { ...floatingSelectionPixels };
        scaleOriginalSel = { ...state.selection };
        return;
      }
    }

    // Check if clicking inside active selection
    if (state.selection && coords.x >= state.selection.x && coords.x < state.selection.x + state.selection.w &&
        coords.y >= state.selection.y && coords.y < state.selection.y + state.selection.h) {
      // User clicked INSIDE active selection -> Start moving/dragging it!
      isMovingSelection = true;
      isPointerDown = true;
      moveStartX = coords.x;
      moveStartY = coords.y;
      // Always use the same lift transaction as scale/rotate so Escape and
      // pointer cancellation can restore the exact original pixels.
      ensureFloatingSelection();
      renderMovingSelectionOverlay();
      return;
    }

    // User clicked OUTSIDE active selection:
    if (state.selection) {
      commitFloatingSelection();
      state.selection = null; // Disappears when clicking outside!
      renderCellOverlay(coords.x, coords.y);
    }

    if (tool === 'pen' || tool === 'eraser') coords = getBrushPoint(e);
    isPointerDown = true;
    dragStartX = coords.x;
    dragStartY = coords.y;
    lastPixelX = coords.x;
    lastPixelY = coords.y;

    if (tool !== 'select') {
      state.beginStroke();
    }

    const color = (e.button === 2) ? state.secondaryColor : state.primaryColor;

    if (tool === 'pen' || tool === 'eraser') {
      paintCellStroke(cell, tool, coords.x, coords.y, coords.x, coords.y);
    } else if (tool === 'picker') {
      const picked = cell.pixels[`${coords.x},${coords.y}`] || 'transparent';
      if (picked !== 'transparent') {
        if (e.button === 2) state.secondaryColor = picked;
        else state.primaryColor = picked;
        updateColorUI();
        showToast(`Picked color: ${picked}`);
      }
    } else if (tool === 'bucket') {
      Tools.floodFill(cell, coords.x, coords.y, color, state.doc.meta.cellSize);
      state.endStroke('Paint Bucket Fill');
      triggerEventAutosave();
      refreshAll();
    } else if (tool === 'line' || tool === 'rect' || tool === 'rect-fill' || tool === 'circle' || tool === 'circle-fill' || tool === 'select') {
      renderShapeOverlay(dragStartX, dragStartY, coords.x, coords.y, tool, color, e);
    }
  }

  function handleCellMouseMove(e) {
    let coords = getPixelCoords(e);
    updateStatusBarCoords(coords ? coords.x : null, coords ? coords.y : null);

    if (state.currentTool === 'pan') {
      dom.cellOverlay.style.cursor = 'grab';
      return;
    }

    if (state.currentTool === 'region-select') {
      regionSelection.move(coords, editorPointerView(e, dom.cellOverlay, state.cellZoom));
      const hit = coords && StructureOps.hitRegion(state.getActiveCell(), coords.x, coords.y, state.activeLayerId, state.isolatedNodeId);
      dom.cellOverlay.style.cursor = hit ? 'move' : 'crosshair';
      renderCellOverlay();
      return;
    }

    // Hover cursor update: inside selection -> move cursor or handle resize cursor
    if (state.selection && !isPointerDown && typeof SelectionTransform !== 'undefined') {
      const rect = dom.cellOverlay.getBoundingClientRect();
      const mouseCanvasX = e.clientX - rect.left;
      const mouseCanvasY = e.clientY - rect.top;
      const hit = SelectionTransform.hitTestSelectionHandles(state.selection, mouseCanvasX, mouseCanvasY, state.cellZoom);
      if (hit === 'rot') {
        dom.cellOverlay.style.cursor = 'grab';
      } else if (hit === 'nw' || hit === 'se') {
        dom.cellOverlay.style.cursor = 'nwse-resize';
      } else if (hit === 'ne' || hit === 'sw') {
        dom.cellOverlay.style.cursor = 'nesw-resize';
      } else if (hit === 'n' || hit === 's') {
        dom.cellOverlay.style.cursor = 'ns-resize';
      } else if (hit === 'e' || hit === 'w') {
        dom.cellOverlay.style.cursor = 'ew-resize';
      } else if (hit === 'body') {
        dom.cellOverlay.style.cursor = 'move';
      } else {
        dom.cellOverlay.style.cursor = (state.currentTool === 'picker') ? 'crosshair' : 'default';
      }
    } else if (coords && state.selection && !isPointerDown) {
      if (coords.x >= state.selection.x && coords.x < state.selection.x + state.selection.w &&
          coords.y >= state.selection.y && coords.y < state.selection.y + state.selection.h) {
        dom.cellOverlay.style.cursor = 'move';
      } else {
        dom.cellOverlay.style.cursor = (state.currentTool === 'picker') ? 'crosshair' : 'default';
      }
    }

    if (coords && state.doc && (state.currentTool === 'pen' || state.currentTool === 'eraser')) coords = getBrushPoint(e);
    if (!isPointerDown) {
      if (coords) renderCellOverlay(coords.x, coords.y);
      return;
    }

    if (!coords) return;

    if (isScalingSelection && scaleOriginalSel && typeof SelectionTransform !== 'undefined') {
      const scaled = SelectionTransform.computeScaledBounds(
        scaleOriginalSel,
        activeScaleHandle,
        coords.x,
        coords.y,
        e.shiftKey
      );
      state.selection = { ...scaled };
      floatingCurrentX = scaled.x;
      floatingCurrentY = scaled.y;
      floatingOriginalSel = { ...scaled };
      floatingSelectionPixels = SelectionTransform.scalePixelsNearestNeighbor(
        scaleOriginalPixels,
        scaleOriginalSel.w,
        scaleOriginalSel.h,
        scaled.w,
        scaled.h
      );
      renderMovingSelectionOverlay();
      return;
    }

    if (isRotatingSelection && rotationCenter && typeof SelectionTransform !== 'undefined') {
      const curAngle = Math.atan2(e.clientY - rotationCenter.y, e.clientX - rotationCenter.x);
      let deltaAngle = curAngle - rotationStartAngle;
      if (e.shiftKey) {
        const step = (15 * Math.PI) / 180;
        deltaAngle = Math.round(deltaAngle / step) * step;
      }
      rotationCurrentAngle = deltaAngle;
      const rotated = SelectionTransform.rotatePixelsNearestNeighbor(
        rotationBaseFloatingPixels,
        rotationBaseSel.w,
        rotationBaseSel.h,
        deltaAngle
      );
      floatingSelectionPixels = rotated.pixels;
      floatingCurrentX = Math.round(rotationBaseSel.x + (rotationBaseSel.w - rotated.w) / 2);
      floatingCurrentY = Math.round(rotationBaseSel.y + (rotationBaseSel.h - rotated.h) / 2);
      floatingOriginalSel = { x: floatingCurrentX, y: floatingCurrentY, w: rotated.w, h: rotated.h };
      state.selection = { ...floatingOriginalSel };
      renderMovingSelectionOverlay();
      return;
    }

    if (isMovingSelection && floatingOriginalSel) {
      const dx = coords.x - moveStartX;
      const dy = coords.y - moveStartY;
      floatingCurrentX = floatingOriginalSel.x + dx;
      floatingCurrentY = floatingOriginalSel.y + dy;
      renderMovingSelectionOverlay();
      return;
    }

    const cell = state.getActiveCell();
    if (!cell) return;
    const color = (e.buttons === 2) ? state.secondaryColor : state.primaryColor;
    const tool = state.currentTool;

    if (tool === 'pen' || tool === 'eraser') {
      if (coords.x !== lastPixelX || coords.y !== lastPixelY) {
        paintCellStroke(cell, tool, lastPixelX, lastPixelY, coords.x, coords.y);
        renderCellOverlay(coords.x, coords.y);
        lastPixelX = coords.x;
        lastPixelY = coords.y;
      }
    } else if (tool === 'line' || tool === 'rect' || tool === 'rect-fill' || tool === 'circle' || tool === 'circle-fill' || tool === 'select') {
      renderShapeOverlay(dragStartX, dragStartY, coords.x, coords.y, tool, color, e);
    }
  }

  function handleCellMouseUp(e) {
    if (state.currentTool === 'region-select' && e.button === 0) {
      const cell = state.getActiveCell();
      if (cell && regionSelection.release(cell, state.activeLayerId, state.isolatedNodeId,
        cell.size || state.doc.meta.cellSize, () => state.beginStroke(), showToast)) {
        state.syncCellComposite(cell.id);
        state.endStroke('Move regions');
        triggerEventAutosave();
        refreshAll();
      }
      renderCellOverlay();
      return;
    }
    if (!isPointerDown) return;
    isPointerDown = false;

    if (isScalingSelection) {
      isScalingSelection = false;
      scaleOriginalSel = null;
      scaleOriginalPixels = null;
      renderCellOverlay();
      return;
    }

    if (isRotatingSelection) {
      isRotatingSelection = false;
      rotationCenter = null;
      renderCellOverlay();
      return;
    }

    if (isMovingSelection) {
      isMovingSelection = false;
      state.selection = {
        x: floatingCurrentX,
        y: floatingCurrentY,
        w: floatingOriginalSel.w,
        h: floatingOriginalSel.h
      };
      renderMovingSelectionOverlay();
      return;
    }

    const coords = getPixelCoords(e);
    const cell = state.getActiveCell();
    const tool = state.currentTool;
    if (tool === 'pen' || tool === 'eraser') {
      if (state.endStroke(tool === 'pen' ? 'Pencil Stroke' : 'Eraser Stroke')) {
        triggerEventAutosave();
        refreshAll();
      }
      renderCellOverlay();
      return;
    }
    if (!cell || !coords) {
      renderCellOverlay();
      return;
    }

    const color = (e.button === 2) ? state.secondaryColor : state.primaryColor;

    if (['line', 'rect', 'rect-fill', 'circle', 'circle-fill'].includes(tool)) {
      const target = cell.layers?.length ? state.getActiveRegion(cell.id) : cell;
      if (target) {
        Tools.editRaster(target, { ...(cell.size || state.doc.meta.cellSize), color }, plot => {
          Tools.shapePixels(tool, dragStartX, dragStartY, coords.x, coords.y, cellShapeOptions(e), plot);
        });
        state.syncCellComposite(cell.id);
      }
      if (state.endStroke('Draw ' + tool)) triggerEventAutosave();
      refreshAll();
    } else if (tool === 'select') {
      const minX = Math.min(dragStartX, coords.x);
      const maxX = Math.max(dragStartX, coords.x);
      const minY = Math.min(dragStartY, coords.y);
      const maxY = Math.max(dragStartY, coords.y);
      // Support selecting single cell or multi-cell regions reliably
      state.selection = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      renderCellOverlay();
      showToast(`Selected region: ${state.selection.w}×${state.selection.h}`);
    }
    renderCellOverlay();
  }

  function clearOverlay() {
    if (!dom.cellOverlay) return;
    const ctx = dom.cellOverlay.getContext('2d');
    ctx.clearRect(0, 0, dom.cellOverlay.width, dom.cellOverlay.height);
  }

  function renderCellOverlay(hoverPx = null, hoverPy = null) {
    drawCellRulerHighlights();
    clearOverlay();
    if (!dom.cellOverlay) return;
    const ctx = dom.cellOverlay.getContext('2d');
    const zoom = state.cellZoom;

    if (floatingSelectionPixels && floatingOriginalSel) {
      renderMovingSelectionOverlay();
      if (hoverPx !== null && hoverPy !== null) {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(hoverPx * zoom, hoverPy * zoom, zoom, zoom);
      }
      return;
    }

    if (state.currentTool === 'region-select') {
      regionSelection.draw(ctx, zoom, state.getActiveCell(), state.activeLayerId, state.isolatedNodeId);
    }

    // 1. Draw Active Selection Marquee (Persistent across tool & tab switches)
    if (state.selection) {
      const sx = Math.floor(state.selection.x * zoom);
      const sy = Math.floor(state.selection.y * zoom);
      const sw = Math.floor(state.selection.w * zoom);
      const sh = Math.floor(state.selection.h * zoom);

      // Soft purple scrim inside selection
      ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
      ctx.fillRect(sx, sy, sw, sh);

      if (state.selection.w === 1 && state.selection.h === 1) {
        // Single cell: Solid crisp border without breaking into blurry dots
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
        if (zoom >= 8) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);
        }
      } else {
        // Base solid dark outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

        // Foreground dashed bright accent
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
        ctx.setLineDash([]);

      }
      SelectionTransform.drawHandles(ctx, state.selection, zoom);
    }

    if (hoverPx !== null && hoverPy !== null && state.doc) {
      const size = state.currentTool === 'pen' ? brushSettings.size
        : (state.currentTool === 'eraser' ? brushSettings.eraserSize : 1);
      Tools.drawBrushOutline(ctx, hoverPx, hoverPy, size, state.doc.meta.cellSize, zoom);
    }
  }

  function cellShapeOptions(event) {
    return { ...state.doc.meta.cellSize, symH: state.symmetry, symV: state.symmetryVertical,
      shift: event.shiftKey, center: event.altKey };
  }

  function renderShapeOverlay(x0, y0, x1, y1, tool, color, event) {
    clearOverlay();
    if (!dom.cellOverlay || !state.doc) return;
    const ctx = dom.cellOverlay.getContext('2d');
    const zoom = state.cellZoom;
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    if (tool !== 'select') {
      ctx.fillStyle = color;
      const drawn = new Set();
      Tools.shapePixels(tool, x0, y0, x1, y1, cellShapeOptions(event), (x, y) => {
        const key = `${x},${y}`;
        if (drawn.has(key)) return;
        drawn.add(key);
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      });
    } else if (tool === 'select') {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.16)';
      ctx.fillRect(minX * zoom, minY * zoom, (maxX - minX + 1) * zoom, (maxY - minY + 1) * zoom);
      ctx.strokeStyle = '#6366f1';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(minX * zoom, minY * zoom, (maxX - minX + 1) * zoom, (maxY - minY + 1) * zoom);
      ctx.setLineDash([]);
    }
  }

  // ===========================================================================
  // CROSS-TAB CLIPBOARD & SELECTION OPERATIONS (Ctrl+C, Ctrl+X, Ctrl+V)
  // ===========================================================================

  function executeSelectionCopy() {
    const cell = state.getActiveCell();
    if (!cell) {
      showToast('Select a cell tab to copy pixels');
      return;
    }
    const cw = (cell.size && cell.size.w) || (state.doc ? state.doc.meta.cellSize.w : 16);
    const ch = (cell.size && cell.size.h) || (state.doc ? state.doc.meta.cellSize.h : 16);
    const sel = state.selection || { x: 0, y: 0, w: cw, h: ch };
    if (floatingSelectionPixels && floatingOriginalSel) {
      state.clipboard = {
        w: floatingOriginalSel.w, h: floatingOriginalSel.h,
        pixels: { ...floatingSelectionPixels },
        originCellId: cell.id, originX: floatingCurrentX, originY: floatingCurrentY
      };
      showToast('Copied floating selection', 'success');
      return;
    }
    const target = getSelectionTarget(cell);
    if (!target) return;
    const copiedPixels = SelectionTransform.copyPixels(target, sel);
    const count = Object.keys(copiedPixels).length;

    state.clipboard = {
      w: sel.w,
      h: sel.h,
      pixels: copiedPixels,
      originCellId: cell.id,
      originX: sel.x,
      originY: sel.y
    };

    showToast(`Copied ${count} pixels (${sel.w}×${sel.h}) to clipboard (Ctrl+C)`, 'success');
  }

  function executeSelectionCut() {
    const cell = state.getActiveCell();
    if (!cell || !state.selection) {
      showToast('No active selection to cut.');
      return;
    }

    if (!getSelectionTarget(cell) && !floatingSelectionPixels) return;
    executeSelectionCopy();
    if (floatingSelectionPixels) {
      executeSelectionDelete();
      return;
    }

    const target = getSelectionTarget(cell);
    if (!target) {
      showToast('Select an editable layer or region');
      return;
    }
    state.beginStroke();
    const sel = state.selection;
    for (let py = 0; py < sel.h; py++) {
      for (let px = 0; px < sel.w; px++) {
        const key = `${sel.x + px},${sel.y + py}`;
        if (target.pixels) delete target.pixels[key];
      }
    }

    state.syncCellComposite(cell.id);
    state.endStroke('Cut Selection');
    triggerEventAutosave();
    refreshAll();
    renderCellOverlay();
    showToast(`Cut selection (${sel.w}×${sel.h}) to clipboard (Ctrl+X)`, 'success');
  }

  function executeSelectionPaste(targetX = null, targetY = null) {
    const cell = state.getActiveCell();
    if (!cell) {
      showToast('Open a cell tab to paste pixels.');
      return;
    }
    if (!state.clipboard || !state.clipboard.pixels) {
      showToast('Clipboard is empty. Copy pixels first with Ctrl+C.');
      return;
    }

    commitFloatingSelection();
    const clip = state.clipboard;
    const cw = (cell.size && cell.size.w) || (state.doc ? state.doc.meta.cellSize.w : 16);
    const ch = (cell.size && cell.size.h) || (state.doc ? state.doc.meta.cellSize.h : 16);

    let px = (targetX !== null) ? targetX : (state.selection ? state.selection.x : clip.originX);
    let py = (targetY !== null) ? targetY : (state.selection ? state.selection.y : clip.originY);

    px = Math.max(0, Math.min(cw - 1, px));
    py = Math.max(0, Math.min(ch - 1, py));

    const target = getSelectionTarget(cell);
    if (!target) {
      showToast('Select an editable layer or region');
      return;
    }
    state.beginStroke();
    if (!target.pixels) target.pixels = {};

    let pastedCount = 0;
    for (const relKey in clip.pixels) {
      const [rx, ry] = relKey.split(',').map(Number);
      const destX = px + rx;
      const destY = py + ry;
      if (destX >= 0 && destX < cw && destY >= 0 && destY < ch) {
        target.pixels[`${destX},${destY}`] = clip.pixels[relKey];
        pastedCount++;
      }
    }

    state.selection = {
      x: px,
      y: py,
      w: Math.min(clip.w, cw - px),
      h: Math.min(clip.h, ch - py)
    };

    state.syncCellComposite(cell.id);
    state.endStroke('Paste Selection');
    triggerEventAutosave();
    refreshAll();
    renderCellOverlay();
    showToast(`Pasted ${pastedCount} pixels into ${cell.name || cell.id}! (Ctrl+V)`, 'success');
  }

  function executeSelectionDelete() {
    const cell = state.getActiveCell();
    if (!cell) return;

    if (floatingSelectionPixels) {
      // User moved/lifted selection and hits Delete:
      // Discard floating pixels without writing to destination!
      // Destination background pixels are 100% UNTOUCHED!
      // Original location was already cleared when lifted.
      floatingSession.clear();
      floatingOriginalSel = null;
      floatingBaselinePixels = null;
      floatingBaselineSel = null;
      floatingSelectionCellId = null;
      floatingSelectionTargetId = null;
      state.selection = null;
      state.endStroke('Delete Floating Selection');
      triggerEventAutosave();
      renderCellEditor();
      renderMiniPreview();
      renderCellOverlay();
      showToast('Deleted selection (Del)', 'info');
      return;
    }

    const target = getSelectionTarget(cell);
    if (!target) {
      showToast('Select an editable layer or region');
      return;
    }
    if (state.selection) {
      state.beginStroke();
      const sel = state.selection;
      for (let py = 0; py < sel.h; py++) {
        for (let px = 0; px < sel.w; px++) {
          const key = `${sel.x + px},${sel.y + py}`;
          if (target.pixels) delete target.pixels[key];
        }
      }
      state.selection = null;
      state.syncCellComposite(cell.id);
      state.endStroke('Delete Selection');
      triggerEventAutosave();
      refreshAll();
      renderCellOverlay();
      showToast(`Deleted selection (${sel.w}×${sel.h}) (Del)`);
    } else {
      if (confirm(`Clear all pixels in ${target.name || target.id}?`)) {
        state.beginStroke();
        target.pixels = {};
        state.syncCellComposite(cell.id);
        state.endStroke('Clear Artwork');
        triggerEventAutosave();
        refreshAll();
        showToast(`Cleared ${cell.name || cell.id}`);
      }
    }
  }

  function executeSelectionFill() {
    const cell = state.getActiveCell();
    if (!cell || !state.selection) {
      showToast('Select a region to fill.');
      return;
    }
    commitFloatingSelection();
    const target = getSelectionTarget(cell);
    if (!target) {
      showToast('Select an editable layer or region');
      return;
    }
    state.beginStroke();
    const sel = state.selection;
    for (let py = 0; py < sel.h; py++) {
      for (let px = 0; px < sel.w; px++) {
        const key = `${sel.x + px},${sel.y + py}`;
        if (!target.pixels) target.pixels = {};
        target.pixels[key] = state.primaryColor;
      }
    }
    state.syncCellComposite(cell.id);
    state.endStroke('Fill Selection');
    triggerEventAutosave();
    refreshAll();
    renderCellOverlay();
    showToast(`Filled selection with ${state.primaryColor}`, 'success');
  }

  function executeSelectionFlip(horizontal = true) {
    const cell = state.getActiveCell();
    if (!cell) return;

    if (!state.selection && !floatingSelectionPixels) {
      showToast('Select a region to flip.');
      return;
    }
    const wasFloating = Boolean(floatingSelectionPixels);
    ensureFloatingSelection();
    if (!floatingSession.flip(floatingOriginalSel, horizontal)) {
      showToast('Select an editable layer or region');
      return;
    }
    if (!wasFloating) {
      commitFloatingSelection(horizontal ? 'Flip Horizontal' : 'Flip Vertical');
      refreshAll();
      renderCellOverlay();
    } else renderMovingSelectionOverlay();
    showToast(`Flipped selection ${horizontal ? 'Horizontally' : 'Vertically'}`);
  }

  function executeSelectAll() {
    const cell = state.getActiveCell();
    if (!cell) return;
    commitFloatingSelection();
    const cw = (cell.size && cell.size.w) || (state.doc ? state.doc.meta.cellSize.w : 16);
    const ch = (cell.size && cell.size.h) || (state.doc ? state.doc.meta.cellSize.h : 16);
    state.selection = {
      x: 0,
      y: 0,
      w: cw,
      h: ch
    };
    renderCellOverlay();
    showToast(`Selected All (${cw}×${ch}) (Ctrl+A)`);
  }

  function executeSelectionRotate() {
    const cell = state.getActiveCell();
    if (!cell) return;
    const size = cell.size || state.doc.meta.cellSize;

    if (state.currentTool === 'region-select' && regionSelection.resolve(cell, state.activeLayerId, state.isolatedNodeId).length) {
      if (!regionSelection.rotate90(cell, state.activeLayerId, state.isolatedNodeId, size, () => state.beginStroke())) {
        showToast('Selected regions cannot rotate within this frame');
        return;
      }
      state.syncCellComposite(cell.id);
      if (state.endStroke('Rotate regions 90°')) triggerEventAutosave();
      refreshAll();
      return;
    }

    if (!state.selection && !floatingSelectionPixels) {
      state.beginStroke();
      Tools.rotate90Clockwise(cell, size.w, size.h);
      if (state.endStroke('Rotate cell 90°')) {
        triggerEventAutosave();
        refreshAll();
      }
      return;
    }

    const wasFloating = Boolean(floatingSelectionPixels);
    const bounds = wasFloating
      ? { ...floatingOriginalSel, x: floatingCurrentX, y: floatingCurrentY }
      : state.selection;
    const next = SelectionTransform.quarterTurnBounds(bounds, size);
    if (!next) {
      showToast('Rotated selection would exceed the frame size');
      return;
    }
    ensureFloatingSelection();
    if (!floatingSelectionPixels) {
      showToast('Select an editable layer or region');
      return;
    }
    floatingSession.rotate90(bounds, size);
    state.selection = { ...next };
    if (!wasFloating) {
      commitFloatingSelection('Rotate selection 90°');
      refreshAll();
    }
    renderCellOverlay();
    showToast(`Rotated selection 90° CW (${next.w}×${next.h})`);
  }

  function executeDeselect() {
    commitFloatingSelection();
    if (state.selection) {
      state.selection = null;
      renderCellOverlay();
      showToast('Deselected (Ctrl+D)');
    }
  }

  function executeCopyGridCell(cellId) {
    if (!state.doc || !state.doc.cells[cellId]) return;
    const cell = state.doc.cells[cellId];
    const cw = state.doc.meta.cellSize.w;
    const ch = state.doc.meta.cellSize.h;
    state.clipboard = {
      w: cw,
      h: ch,
      pixels: { ...cell.pixels },
      originCellId: cellId,
      originX: 0,
      originY: 0
    };
    showToast(`Copied frame "${cell.name || cellId}" (Ctrl+C)`, 'success');
  }

  function executePasteGridCell(cellId) {
    if (!state.doc || !state.doc.cells[cellId]) return;
    if (!state.clipboard || !state.clipboard.pixels) {
      showToast('Clipboard is empty. Copy pixels or a frame first with Ctrl+C.');
      return;
    }
    const cell = state.doc.cells[cellId];
    state.beginStroke();
    if (!cell.pixels) cell.pixels = {};
    for (const k in state.clipboard.pixels) {
      if (typeof PIX2 !== 'undefined' && !PIX2.isSafeIdentifier(k)) continue;
      cell.pixels[k] = state.clipboard.pixels[k];
    }
    state.endStroke(`Paste Frame into ${cellId}`);
    triggerEventAutosave();
    refreshAll();
    showToast(`Pasted into "${cell.name || cellId}" (Ctrl+V)`, 'success');
  }

  function duplicateGridCellToNext(cellId) {
    if (!state.doc || !state.doc.cells[cellId]) return;
    const { r, c } = getCellRowCol(cellId);
    const nextC = c + 1;
    if (nextC < state.doc.meta.grid.cols) {
      const nextCell = getCellAtGrid(state.doc, r, nextC);
      const nextId = nextCell ? nextCell.id : `cell_${r}_${nextC}`;
      state.beginStroke();
      if (!state.doc.cells[nextId]) {
        state.doc.cells[nextId] = { id: nextId, name: nextId, row: r, col: nextC, direction: 'none', frame: nextC, pixels: {} };
      }
      state.doc.cells[nextId].pixels = JSON.parse(JSON.stringify(state.doc.cells[cellId].pixels || {}));
      state.endStroke(`Duplicate Frame to ${nextId}`);
      selectedGridCellId = nextId;
      triggerEventAutosave();
      refreshAll();
      showToast(`Duplicated to ${nextId}!`, 'success');
    } else {
      showToast('Reached last column. Click "+ Col" to add columns first.');
    }
  }

  function flipGridCell(cellId, horizontal = true) {
    if (!state.doc || !state.doc.cells[cellId]) return;
    const cell = state.doc.cells[cellId];
    const cw = state.doc.meta.cellSize.w;
    const ch = state.doc.meta.cellSize.h;
    state.beginStroke();
    const newPixels = {};
    for (const coord in cell.pixels) {
      const [x, y] = coord.split(',').map(Number);
      const nx = horizontal ? (cw - 1 - x) : x;
      const ny = horizontal ? y : (ch - 1 - y);
      newPixels[`${nx},${ny}`] = cell.pixels[coord];
    }
    cell.pixels = newPixels;
    state.endStroke(`Flip Frame ${horizontal ? 'H' : 'V'}`);
    triggerEventAutosave();
    refreshAll();
    showToast(`Flipped ${cell.name || cellId} ${horizontal ? 'Horizontally' : 'Vertically'}`);
  }

  function flipRow(rowIdx, horizontal = true) {
    if (!state.doc) return;
    const doc = state.doc;
    const rows = doc.meta.grid.rows;
    const cols = doc.meta.grid.cols;
    if (rowIdx < 0 || rowIdx >= rows) return;

    const rowTitle = inferRowTitle(rowIdx) || `Row ${rowIdx}`;
    const cw = doc.meta.cellSize.w;
    const ch = doc.meta.cellSize.h;
    let flippedCount = 0;

    state.beginStroke();
    for (let c = 0; c < cols; c++) {
      const cell = getCellAtGrid(doc, rowIdx, c) || doc.cells[`cell_${rowIdx}_${c}`];
      if (cell && cell.pixels && Object.keys(cell.pixels).length > 0) {
        const newPixels = {};
        for (const coord in cell.pixels) {
          const [x, y] = coord.split(',').map(Number);
          const nx = horizontal ? (cw - 1 - x) : x;
          const ny = horizontal ? y : (ch - 1 - y);
          newPixels[`${nx},${ny}`] = cell.pixels[coord];
        }
        cell.pixels = newPixels;
        flippedCount++;
      }
    }
    const dirName = horizontal ? 'Horizontal' : 'Vertical';
    state.endStroke(`Flip Row ${rowIdx} ${dirName}`);
    triggerEventAutosave();
    refreshAll();
    showToast(`Flipped Row ${rowIdx} ("${rowTitle}") ${dirName.toLowerCase()} (${flippedCount} frame(s) modified).`, 'success');
  }

  function clearGridCell(cellId) {
    if (!state.doc || !state.doc.cells[cellId]) return;
    const cell = state.doc.cells[cellId];
    state.beginStroke();
    cell.pixels = {};
    state.endStroke(`Clear Frame ${cellId}`);
    triggerEventAutosave();
    refreshAll();
    showToast(`Cleared frame ${cell.name || cellId}`);
  }

  // ===========================================================================
  // DESKTOP-GRADE CONTEXT MENUS (RIGHT-CLICK)
  // ===========================================================================

  const contextMenu = document.getElementById('studio-context-menu');
  const gridContextMenu = document.getElementById('grid-context-menu');
  let gridContextCellId = null;

  function openContextMenu(x, y) {
    closeGridContextMenu();
    if (!contextMenu) return;
    EditorMenu.position(contextMenu, x, y);
  }

  function closeContextMenu() {
    if (contextMenu) contextMenu.classList.add('hidden');
  }

  function openGridContextMenu(x, y, cellId) {
    closeContextMenu();
    if (!gridContextMenu) return;
    gridContextCellId = cellId;

    const { r, c } = getCellRowCol(cellId);
    const totalRows = state.doc ? state.doc.meta.grid.rows : 1;

    const moveUpItem = gridContextMenu.querySelector('[data-grid-action="move-row-up"]');
    const moveDownItem = gridContextMenu.querySelector('[data-grid-action="move-row-down"]');
    const moveUpLabel = document.getElementById('ctx-move-up-label');
    const moveDownLabel = document.getElementById('ctx-move-down-label');

    if (moveUpLabel) moveUpLabel.textContent = `Move Row ${r} Up`;
    if (moveDownLabel) moveDownLabel.textContent = `Move Row ${r} Down`;
    if (moveUpItem) moveUpItem.style.display = (r > 0) ? 'flex' : 'none';
    if (moveDownItem) moveDownItem.style.display = (r < totalRows - 1) ? 'flex' : 'none';

    const dupRowLabel = document.getElementById('ctx-dup-row-label');
    if (dupRowLabel) dupRowLabel.textContent = `Duplicate Row ${r}...`;

    const delRowLabel = document.getElementById('ctx-del-row-label');
    if (delRowLabel) delRowLabel.textContent = `Delete Row ${r}`;

    const delColLabel = document.getElementById('ctx-del-col-label');
    if (delColLabel) delColLabel.textContent = `Delete Column ${c}`;

    gridContextMenu.classList.remove('hidden');
    const menuW = 230;
    const menuH = 440;
    const posX = Math.min(x, window.innerWidth - menuW - 10);
    const posY = Math.min(y, window.innerHeight - menuH - 10);

    gridContextMenu.style.left = `${posX}px`;
    gridContextMenu.style.top = `${posY}px`;
  }

  function closeGridContextMenu() {
    if (gridContextMenu) gridContextMenu.classList.add('hidden');
    gridContextCellId = null;
  }

  function updateStatusBarCoords(px, py) {
    if (rulerHoverX !== px || rulerHoverY !== py) {
      rulerHoverX = px;
      rulerHoverY = py;
      drawCellRulerHighlights();
    }
    if (px === null || py === null) {
      if (dom.labelCoords) dom.labelCoords.textContent = 'X: -, Y: -';
      if (dom.statusCoordLabel) dom.statusCoordLabel.textContent = 'Pixel: [X: -, Y: -]';
      if (dom.statusColorLabel) dom.statusColorLabel.textContent = 'Color: -';
      if (dom.statusColorDot) dom.statusColorDot.style.backgroundColor = 'transparent';
      return;
    }

    if (dom.labelCoords) dom.labelCoords.textContent = `X: ${px}, Y: ${py}`;
    if (dom.statusCoordLabel) dom.statusCoordLabel.textContent = `Pixel: [X: ${px}, Y: ${py}]`;

    const cell = state.getActiveCell();
    const col = (cell && cell.pixels) ? (cell.pixels[`${px},${py}`] || 'Transparent') : 'Transparent';
    if (dom.statusColorLabel) dom.statusColorLabel.textContent = `Color: ${col}`;
    if (dom.statusColorDot) dom.statusColorDot.style.backgroundColor = (col === 'Transparent' ? 'transparent' : col);

    if (dom.statusCellLabel) {
      dom.statusCellLabel.textContent = `Frame: ${cell ? (cell.name || cell.id) : selectedGridCellId}`;
    }
    if (dom.statusToolLabel) {
      dom.statusToolLabel.textContent = `Tool: ${state.currentTool.toUpperCase()}`;
    }
    if (dom.statusSymmetryLabel) {
      dom.statusSymmetryLabel.textContent = `Symmetry: ${state.symmetry ? 'H ' : ''}${state.symmetryVertical ? 'V' : (state.symmetry ? '' : 'OFF')}`;
    }
  }

  // ===========================================================================
  // ANCHOR-CENTERED ZOOM & SMOOTH PANNING
  // ===========================================================================

  let panX = 0;
  let panY = 0;

  function applyCanvasTransform() {
    if (!dom.canvasContainerWithRulers) return;
    if (panX === 0 && panY === 0) {
      dom.canvasContainerWithRulers.style.transform = '';
    } else {
      dom.canvasContainerWithRulers.style.transform = `translate(${panX}px, ${panY}px)`;
    }
  }

  function centerCellCanvas() {
    panX = 0;
    panY = 0;
    applyCanvasTransform();
  }

  function fitCellCanvas() {
    if (!state.getActiveCell()) return;
    const { w, h } = state.doc.meta.cellSize;
    const padding = state.showRulers ? 64 : 40;
    const { clientWidth, clientHeight } = dom.canvasViewport;
    if (clientWidth <= padding || clientHeight <= padding) return;
    state.cellZoom = NoiraViewport.fitArtworkZoom(clientWidth, clientHeight, w, h, padding);
    centerCellCanvas();
    renderCellEditor(true);
    renderCellRulers();
    renderCellOverlay();
    updateStatusBarCoords(null, null);
  }

  function initCanvasPanningAndZoom() {
    if (!dom.canvasViewport) return;

    let isSpacePressed = false;
    let isPanning = false;
    let startX = 0, startY = 0;
    let dragStartPanX = 0, dragStartPanY = 0;
    let viewportPaintPending = false;
    function requestViewportPaint() {
      if (viewportPaintPending) return;
      viewportPaintPending = true;
      requestAnimationFrame(() => {
        viewportPaintPending = false;
        renderCellEditor(true);
      });
    }
    new ResizeObserver(requestViewportPaint).observe(dom.canvasViewport);

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.code === 'Space' && e.shiftKey && state.activeTabId === 'tab-grid-overview') {
        e.preventDefault();
        if (!e.repeat) fitGridCanvas();
        return;
      }
      if (e.code === 'Space' && e.shiftKey && state.getActiveCell()) {
        e.preventDefault();
        if (e.repeat) return;
        fitCellCanvas();
        return;
      }
      if (e.code === 'Space' && !isSpacePressed) {
        isSpacePressed = true;
        dom.canvasViewport.classList.add('space-held');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        isSpacePressed = false;
        if (isPanning && state.currentTool !== 'pan') {
          isPanning = false;
          dom.canvasViewport.classList.remove('is-panning');
        }
        dom.canvasViewport.classList.remove('space-held');
      }
    });

    window.addEventListener('blur', () => {
      isSpacePressed = false;
      isPanning = false;
      dom.canvasViewport.classList.remove('space-held', 'is-panning');
    });

    dom.canvasViewport.addEventListener('mousedown', (e) => {
      // Pan with: Space + Left Click OR Middle Click OR Pan Tool (Button 0)
      if (isSpacePressed || e.button === 1 || (state.currentTool === 'pan' && e.button === 0)) {
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        dragStartPanX = panX;
        dragStartPanY = panY;
        dom.canvasViewport.classList.add('is-panning');
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panX = Math.round(dragStartPanX + dx);
      panY = Math.round(dragStartPanY + dy);
      applyCanvasTransform();
      requestViewportPaint();
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        dom.canvasViewport.classList.remove('is-panning');
      }
    });

    // Anchor-Centered Wheel Zoom
    dom.canvasViewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!state.getActiveCell() || !e.deltaY) return;
      const rect = dom.cellOverlay.getBoundingClientRect();
      const oldZoom = state.cellZoom;
      const { w, h } = state.doc.meta.cellSize;
      const newZoom = NoiraViewport.stepArtworkZoom(oldZoom, e.deltaY < 0 ? 1 : -1, w, h);
      if (newZoom === oldZoom) return;

      // Unscaled point under mouse cursor
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const unscaledX = mx / oldZoom;
      const unscaledY = my / oldZoom;

      state.cellZoom = newZoom;
      sizeCellCanvases(w, h, newZoom);
      renderCellRulers();
      const resized = dom.cellOverlay.getBoundingClientRect();
      const { dx, dy } = EditorCanvas.wheelAnchor(resized, e.clientX, e.clientY, unscaledX, unscaledY, newZoom);
      panX += dx;
      panY += dy;
      applyCanvasTransform();
      renderCellEditor(true);
      renderCellOverlay();
      updateStatusBarCoords(null, null);
    }, { passive: false });
  }

  // ===========================================================================
  // DESKTOP-GRADE NATIVE FILE MANAGEMENT (File System Access API & Fallbacks)
  // ===========================================================================

  async function openFileNative() {
    if (typeof handleBeforeLeaveCodeTab === 'function' && !handleBeforeLeaveCodeTab()) {
      return;
    }
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'PIX2 Sprite Files (*.pix2, *.txt)',
            accept: { 'text/plain': ['.pix2', '.txt'] }
          }],
          multiple: false
        });
        await handleFileOpenFromHandle(handle);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('File System Access API failed, falling back:', err);
      }
    }

    fallbackFileInputOpen();
  }

  function fallbackFileInputOpen() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pix2,image/png,image/*';
    input.onchange = (e) => {
      if (e.target.files.length > 0) handleFileOpen(e.target.files[0]);
    };
    input.click();
  }

  const enqueueStudioSave = EditorFileSave.createQueue();
  let activeStudioSaves = 0;

  function saveFileNative(forceSaveAs = false) {
    if (!state.doc) return Promise.resolve();
    commitFloatingSelection();
    if (isCodeEditingUnlocked && dom.codeTextarea && state.activeTabId === 'tab-pix2-code') {
      try {
        const parsed = PIX2.parse(dom.codeTextarea.value);
        if (!PIX2.validate(parsed, { strict: true }).valid) throw new Error('Invalid PIX2');
        state.setDocument(parsed, true);
        triggerEventAutosave();
      } catch (_) {
        showToast('Cannot save invalid PIX2 code. Fix the diagnostics first.', 'error');
        return Promise.resolve();
      }
    }
    return saveStudioSnapshot({ interactive: true, forceSaveAs });
  }

  function saveStudioSnapshot({ interactive = false, forceSaveAs = false } = {}) {
    const session = getActiveSession();
    const doc = state.doc;
    if (!session || !doc || floatingSelectionPixels) return Promise.resolve(false);
    const revision = documentRevision;
    const text = PIX2.serialize(doc);
    const fileName = currentFileName || sanitizeSafeFilename(doc.meta.title, '.pix2', 'sprite');
    const direct = !forceSaveAs && currentFileHandle?.createWritable ? currentFileHandle : null;
    const access = direct ? EditorFileSave.permission(direct, interactive) : Promise.resolve(true);
    // Open a picker during the original user gesture, before waiting for other writes.
    let picker;
    if (!direct && interactive && typeof window.showSaveFilePicker === 'function') {
      try {
        picker = window.showSaveFilePicker({ suggestedName: fileName,
          types: [{ description: 'PIX2 Sprite File', accept: { 'text/plain': ['.pix2'] } }] });
      } catch (error) {
        picker = Promise.reject(error);
      }
      picker.catch(() => {});
    }
    activeStudioSaves++;
    return enqueueStudioSave(async () => {
      try {
        if (!projectSessions.includes(session)) return false;
        if (!await access) throw new Error('Write permission was denied');
        const handle = picker ? await picker : direct;
        let modified = 0;
        if (handle) modified = await EditorFileSave.write(handle, text);
        else if (interactive) fallbackDownloadSave(text, fileName);
        else return false;
        if (!projectSessions.includes(session)) return true;
        const active = getActiveSession() === session;
        if (active) saveCurrentSessionState();
        session.lastSavedContent = text;
        session.lastSavedRevision = revision;
        session.isDirty = session.revision !== revision || PIX2.serialize(session.doc) !== text;
        session.lastKnownFileModified = modified;
        session.pendingExternalConflict = null;
        if (handle) {
          session.fileHandle = handle;
          session.fileName = handle.name;
          session.filePath = handle.name;
        }
        if (active) {
          if (handle) {
            currentFileHandle = handle;
            currentFileName = session.fileName;
            currentFilePath = session.filePath;
            persistFileHandle(handle);
          }
          lastSavedContent = text;
          lastKnownFileModified = modified;
          pendingExternalConflict = null;
          lastSavedRevision = revision;
          isDocumentDirty = session.isDirty;
          if (!isDocumentDirty) setDirty(false);
          updateFileStatusUI();
          renderProjectTabs();
          if (interactive) showToast(handle ? 'Saved to ' + handle.name : 'Downloaded ' + fileName, 'success');
        }
        await persistAllProjectSessions();
        return true;
      } catch (error) {
        if (error.name !== 'AbortError') showToast('Save failed: ' + error.message, 'error');
        return false;
      } finally {
        activeStudioSaves--;
      }
    });
  }

  function fallbackDownloadSave(text, fileName) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // ===========================================================================
  // REAL-TIME FILE WATCHER & LIVE HOT-RELOAD (External AI & Tool Collaboration)
  // ===========================================================================

  async function checkAndReloadExternalFileChanges(force = false) {
    if (!currentFileHandle || isExternalReloading || activeStudioSaves) return;
    if (typeof currentFileHandle.getFile !== 'function') return;

    const watchedHandle = currentFileHandle;
    const watchedSession = getActiveSession();
    const watchedRevision = documentRevision;
    const stillCurrent = () => currentFileHandle === watchedHandle && getActiveSession() === watchedSession && documentRevision === watchedRevision && !activeStudioSaves;
    try {
      isExternalReloading = true;
      const file = await currentFileHandle.getFile();
      if (!stillCurrent()) return;
      const currentModified = file.lastModified;

      // Check if file modified time is newer than our recorded timestamp
      if (!force && lastKnownFileModified > 0 && currentModified <= lastKnownFileModified) {
        isExternalReloading = false;
        return;
      }

      const text = await file.text();
      if (!stillCurrent()) return;
      if (!text || !text.trim()) {
        isExternalReloading = false;
        return;
      }

      // If content is identical to our last saved version, just sync timestamp
      if (text === lastSavedContent) {
        lastKnownFileModified = currentModified;
        isExternalReloading = false;
        return;
      }

      // External change detected!
      if (isDocumentDirty && !force) {
        // Studio has unsaved edits: do NOT overwrite silently!
        showExternalConflictNotification(file, text, currentModified);
        isExternalReloading = false;
        return;
      }

      // Safe reload (preserving active tabs)
      const newDoc = PIX2.parseValidated(text);
      state.setDocument(newDoc, true);
      lastKnownFileModified = currentModified;
      lastSavedContent = text;
      localStorage.setItem('pix2_last_saved_content', text);
      localStorage.removeItem('pix2_recovery_snapshot');
      pendingExternalConflict = null;
      setDirty(false);
      refreshAll();
      const btnReload = document.getElementById('btn-reload-file');
      if (btnReload) btnReload.classList.remove('pulse-warning');
      showToast(`⚡ Reloaded ${file.name} from disk (external update detected)!`, 'info');
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
      btnReload.title = `External changes detected on ${file.name}! Click to reload from disk.`;
    }
  }

  async function handleManualFileReload() {
    if (!currentFileHandle) {
      showToast('No local disk file is currently linked.', 'info');
      return;
    }
    if (isDocumentDirty) {
      const confirmDiscard = confirm(
        `"${currentFileHandle.name}" has unsaved changes in NOIRADIX Studio.\n\nReloading from disk will discard your current Studio edits and load the external disk version.\n\nDo you want to discard Studio edits and reload from disk?`
      );
      if (!confirmDiscard) return;
    }
    await checkAndReloadExternalFileChanges(true);
    const btnReload = document.getElementById('btn-reload-file');
    if (btnReload) btnReload.classList.remove('pulse-warning');
    pendingExternalConflict = null;
  }

  function initFileWatcher() {
    // 1. Focus listener: window gets active focus when switching from external editor/AI
    window.addEventListener('focus', () => {
      checkAndReloadExternalFileChanges(false);
    });

    // 2. Visibility change listener (tab becomes visible)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkAndReloadExternalFileChanges(false);
      }
    });

    // 3. Heartbeat polling (every 1500ms when document is active and no unsaved edits)
    if (fileWatcherHeartbeatTimer) clearInterval(fileWatcherHeartbeatTimer);
    fileWatcherHeartbeatTimer = setInterval(() => {
      if (!document.hidden && currentFileHandle && !isDocumentDirty) {
        checkAndReloadExternalFileChanges(false);
      }
    }, 1500);
  }

  // ===========================================================================
  // PIX2 CODE & SYNTAX HIGHLIGHTED VIEWER
  // ===========================================================================

  let isCodeEditingUnlocked = false;

  const sourceController = StudioSource.create({
    state: studioDocumentModel, dom,
    view: {
      get isCodeEditingUnlocked() { return isCodeEditingUnlocked; }, set isCodeEditingUnlocked(value) { isCodeEditingUnlocked = value; }
    },

    escapeHtml: (...args) => escapeHtml(...args),
    refreshAll: (...args) => refreshAll(...args),
    showToast: (...args) => showToast(...args),
    triggerEventAutosave: (...args) => triggerEventAutosave(...args)
  });
  const { splitLineComment, highlightPix2Code, renderCodeEditor, lockCodeEditingSilently, handleBeforeLeaveCodeTab, toggleCodeEditMode, copyRawPix2Code, fallbackCopyText, applyCodeToDoc, getSpriteMath, updateAiGuidePane, copyAiPrompt } = sourceController;


  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }


  // ===========================================================================
  // AI SPECIFICATION & CONTEXTUAL PROMPT STUDIO
  // ===========================================================================


  // ===========================================================================
  // PNG EXPORT & IMPORT
  // ===========================================================================

  // ===========================================================================
  // GAME EXPORT STUDIO & ATLAS GENERATOR (Bleed Protection, Spacing, Engine Presets)
  // ===========================================================================

  let currentExportFormat = 'unity'; // 'unity' | 'texturepacker' | 'png-only' | 'zip-frames'
  let exportPreviewZoom = 4; // 1, 2, 4, 'fit' - magnifying glass preview zoom

  function openGameExportModal() {
    if (!dom.modalGameExport || !state.doc) return;
    if (typeof commitFloatingSelection === 'function') {
      commitFloatingSelection();
    }
    syncExportFormatCards();
    document.querySelectorAll('#export-zoom-group [data-scale]').forEach(b => {
      b.classList.toggle('active', b.dataset.scale === String(exportPreviewZoom));
    });
    dom.modalGameExport.classList.remove('hidden');
    updateExportPreview();
  }

  function closeGameExportModal() {
    if (dom.modalGameExport) {
      dom.modalGameExport.classList.add('hidden');
    }
  }

  function syncExportFormatCards() {
    if (!dom.exportFormatOptions) return;
    const cards = dom.exportFormatOptions.querySelectorAll('.format-option-card');
    cards.forEach(card => {
      const fmt = card.dataset.format;
      const isSelected = (fmt === currentExportFormat);
      card.classList.toggle('active', isSelected);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });

    if (dom.btnExecuteExportLabel) {
      if (currentExportFormat === 'unity') dom.btnExecuteExportLabel.textContent = 'Export Unity 2D Package (.ZIP)';
      else if (currentExportFormat === 'texturepacker') dom.btnExecuteExportLabel.textContent = 'Export TexturePacker (.ZIP)';
      else if (currentExportFormat === 'modular-components') dom.btnExecuteExportLabel.textContent = 'Export Modular Components (.ZIP)';
      else if (currentExportFormat === 'png-only') dom.btnExecuteExportLabel.textContent = 'Export PNG Atlas';
      else if (currentExportFormat === 'zip-frames') dom.btnExecuteExportLabel.textContent = 'Export Frames (.ZIP)';
    }

    const modOpts = document.getElementById('modular-export-options-group');
    if (modOpts) {
      modOpts.classList.toggle('hidden', currentExportFormat !== 'modular-components');
    }
  }

  function getExportOptions() {
    const spacing = Math.max(0, Math.min(16, parseInt(dom.exportSpacingSelect?.value || '1', 10) || 0));
    const margin = Math.max(0, Math.min(32, parseInt(dom.exportMarginSelect?.value || '1', 10) || 0));
    const extrude = dom.exportExtrudeCheckbox ? dom.exportExtrudeCheckbox.checked : false;
    const scale = Math.max(1, Math.min(8, parseInt(dom.exportScaleSelect?.value || '1', 10) || 1));
    const pivotChoice = dom.exportPivotSelect?.value || 'bottom-center';

    let pivot = { x: 0.5, y: 0.0 };
    if (pivotChoice === 'center') pivot = { x: 0.5, y: 0.5 };
    else if (pivotChoice === 'top-left') pivot = { x: 0.0, y: 1.0 };

    return { spacing, margin, extrude, scale, pivotChoice, pivot };
  }

  function generateAtlasCanvas(opts) {
    try {
      return StudioAtlas.build(state.doc, opts, {
        resolveCell: getCellAtGrid,
        createCanvas: () => document.createElement('canvas')
      });
    } catch (error) {
      showToast(error.message + ' Reduce the export scale or grid size.', 'error');
      return null;
    }
  }

  function updateExportPreview(reuseRaster = false) {
    if (!state.doc || !dom.exportPreviewCanvas) return;
    const opts = getExportOptions();
    if (reuseRaster !== true) {
      const atlasData = generateAtlasCanvas(opts);
      const invalid = !atlasData;
      if (dom.btnExecuteGameExport) dom.btnExecuteGameExport.disabled = invalid;
      if (dom.btnQuickExportPng) dom.btnQuickExportPng.disabled = invalid;
      if (invalid) {
        dom.exportPreviewCanvas.width = dom.exportPreviewCanvas.height = 1;
        if (dom.exportDimensionBadge) dom.exportDimensionBadge.textContent = 'Export size exceeds allocation limit';
        return;
      }
      EditorCanvas.resize(dom.exportPreviewCanvas, atlasData.width, atlasData.height);
      const pctx = dom.exportPreviewCanvas.getContext('2d');
      pctx.clearRect(0, 0, atlasData.width, atlasData.height);
      pctx.drawImage(atlasData.canvas, 0, 0);
    }
    const atlasData = { width: dom.exportPreviewCanvas.width, height: dom.exportPreviewCanvas.height };

    // Apply Magnifying Zoom scaling to Atlas Preview
    let effZoom = exportPreviewZoom;
    if (exportPreviewZoom === 'fit') {
      const vp = document.getElementById('export-preview-viewport');
      const vpw = vp ? Math.max(64, vp.clientWidth - 24) : 200;
      const vph = vp ? Math.max(64, vp.clientHeight - 24) : 200;
      const fitRatio = Math.min(vpw / atlasData.width, vph / atlasData.height);
      if (fitRatio >= 1) {
        effZoom = Math.max(1, Math.floor(fitRatio));
      } else {
        effZoom = fitRatio;
      }
    } else {
      effZoom = Math.max(1, Number(exportPreviewZoom) || 4);
    }

    dom.exportPreviewCanvas.style.width = `${Math.round(atlasData.width * effZoom)}px`;
    dom.exportPreviewCanvas.style.height = `${Math.round(atlasData.height * effZoom)}px`;

    const doc = state.doc;
    const cols = doc.meta.grid.cols;
    const rows = doc.meta.grid.rows;
    const cw = doc.meta.cellSize.w;
    const ch = doc.meta.cellSize.h;
    const animCount = Object.keys(doc.animations || {}).length;

    if (dom.exportDimensionBadge) {
      dom.exportDimensionBadge.textContent = `${atlasData.width} × ${atlasData.height} px`;
    }
    if (dom.exportGridInfo) {
      dom.exportGridInfo.textContent = `${cols} Cols × ${rows} Rows (${cols * rows} cells)`;
    }
    if (dom.exportCellSizeInfo) {
      dom.exportCellSizeInfo.textContent = `${cw}×${ch} px (${cw * opts.scale}×${ch * opts.scale} px @ ${opts.scale}×)`;
    }
    if (dom.exportSpacingInfo) {
      dom.exportSpacingInfo.textContent = `${opts.spacing}px gap / ${opts.margin}px border`;
    }
    if (dom.exportClipsInfo) {
      dom.exportClipsInfo.textContent = `${animCount} animation clips`;
    }
    if (dom.exportBleedTag) {
      if (opts.spacing > 0 && opts.extrude) {
        dom.exportBleedTag.textContent = 'Active (Spacing + Extrude)';
        dom.exportBleedTag.style.background = 'rgba(16, 185, 129, 0.15)';
        dom.exportBleedTag.style.color = '#10b981';
      } else if (opts.spacing > 0) {
        dom.exportBleedTag.textContent = 'Active (Spacing Gap)';
        dom.exportBleedTag.style.background = 'rgba(99, 102, 241, 0.15)';
        dom.exportBleedTag.style.color = '#6366f1';
      } else {
        dom.exportBleedTag.textContent = 'None (0px Bleed Risk)';
        dom.exportBleedTag.style.background = 'rgba(239, 68, 68, 0.15)';
        dom.exportBleedTag.style.color = '#ef4444';
      }
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const gameExporter = StudioExport.create({
    sanitizeSafeFilename, downloadBlob, showToast, closeGameExportModal,
    createCanvas: () => document.createElement('canvas')
  });

  async function executeGameExport() {
    if (!state.doc) return;
    const opts = getExportOptions();
    return gameExporter.execute({
      doc: state.doc, opts, atlasData: generateAtlasCanvas(opts),
      format: currentExportFormat,
      trimmed: Boolean(document.getElementById('export-trimmed-bounds-checkbox')?.checked)
    });
  }

  function exportAtlasPng() {
    openGameExportModal();
  }

  function exportCurrentCellPng() {
    if (typeof commitFloatingSelection === 'function') {
      commitFloatingSelection();
    }
    const cell = state.getActiveCell();
    if (!cell || !state.doc) return;
    const cw = state.doc.meta.cellSize.w;
    const ch = state.doc.meta.cellSize.h;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = cw;
    exportCanvas.height = ch;
    const ctx = exportCanvas.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);

    for (const coord in cell.pixels) {
      const [px, py] = coord.split(',').map(Number);
      ctx.fillStyle = cell.pixels[coord];
      ctx.fillRect(px, py, 1, 1);
    }

    exportCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(cell.name || cell.id).toLowerCase().replace(/\s+/g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported frame ${cell.name || cell.id} PNG!`, 'success');
    });
  }

  async function openStudioDocument(file, handle = null) {
    if (handle) {
      for (const session of projectSessions) {
        let same = session.fileHandle === handle;
        if (!same && session.fileHandle?.isSameEntry) {
          try { same = await session.fileHandle.isSameEntry(handle); } catch (_) {}
        }
        if (same) {
          switchProjectSession(session.id);
          return;
        }
      }
    }
    const text = await file.text();
    const doc = PIX2.parseValidated(text);
    const validation = PIX2.validate(doc, { strict: false });
    if (!validation.valid) throw new Error(validation.errors[0] || 'Invalid PIX2 document');
    const session = createProjectSession(doc, file.name, handle);
    session.lastSavedContent = text;
    session.lastKnownFileModified = file.lastModified || 0;
    currentFileHandle = handle;
    currentFileName = file.name;
    currentFilePath = file.name;
    lastSavedContent = text;
    lastKnownFileModified = session.lastKnownFileModified;
    pendingExternalConflict = null;
    setDirty(false);
    if (handle) persistFileHandle(handle);
    persistAllProjectSessions();
    updateFileStatusUI();
    showToast('Opened ' + file.name + ' in a document tab', 'success');
  }

  async function handleFileOpenFromHandle(handle) {
    if (!handle) return;
    const file = await handle.getFile();
    if (/\.(pix2|txt)$/i.test(file.name)) return openStudioDocument(file, handle);
    handleFileOpen(file);
  }

  function handleFileOpen(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      showToast('File exceeds 25MB safety limit.', 'error');
      return;
    }
    const name = file.name.toLowerCase();
    if (name.endsWith('.pix2') || name.endsWith('.txt')) {
      openStudioDocument(file).catch(error => showToast('Cannot open file: ' + error.message, 'error'));
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          slicePngToProject(img, file.name);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  function slicePngToProject(img, filename) {
    if (!img || !img.width || !img.height || img.width > 4096 || img.height > 4096) {
      showToast('Image dimensions exceed supported 4096×4096 boundary.', 'error');
      return;
    }
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = img.width;
    tmpCanvas.height = img.height;
    const ctx = tmpCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);

    const isWispling = (img.width === 67 && img.height === 67);
    const defaultCols = 4, defaultRows = 4, defaultW = 16, defaultH = 16;
    const defaultGap = isWispling ? 1 : 0;

    const gap = parseInt(prompt(`Image dimensions: ${img.width}x${img.height} px.\nEnter inter-cell spacing (pixels):`, defaultGap), 10) || 0;

    const doc = PIX2.sliceImageIntoDoc(imgData, {
      width: img.width,
      height: img.height,
      cols: defaultCols,
      rows: defaultRows,
      cellW: defaultW,
      cellH: defaultH,
      gapX: gap,
      gapY: gap,
      marginX: 0,
      marginY: 0,
      title: filename.replace(/\.[^/.]+$/, '')
    });

    state.setDocument(doc);
    currentFileHandle = null;
    currentFileName = `${filename.replace(/\.[^/.]+$/, '')}.pix2`;
    currentFilePath = null;
    lastSavedContent = '';
    setDirty(true);
    refreshAll();
    showToast(`Imported ${filename} (${defaultCols}x${defaultRows} cells)!`, 'success');
  }

  function setResolution(newW, newH, centerArtwork = false) {
    if (!state.doc) return;
    newW = Math.min(Math.max(1, parseInt(newW, 10) || 16), 512);
    newH = Math.min(Math.max(1, parseInt(newH, 10) || 16), 512);
    const curW = state.doc.meta.cellSize.w;
    const curH = state.doc.meta.cellSize.h;
    if (curW === newW && curH === newH) return;

    state.saveSnapshot(`Change Canvas Bounds to ${newW}x${newH}`);

    // Always use non-destructive canvas bounds expansion/cropping:
    // Preserves existing pixel art with 100% mathematical fidelity! Zero pixel loss!
    PIX2.resizeCells(state.doc, newW, newH, 'expand');

    if (centerArtwork && (newW > curW || newH > curH)) {
      const dx = Math.floor((newW - curW) / 2);
      const dy = Math.floor((newH - curH) / 2);
      if (dx > 0 || dy > 0) {
        for (const cid in state.doc.cells) {
          Tools.nudge(state.doc.cells[cid], dx, dy, newW, newH);
        }
      }
    }

    triggerEventAutosave();
    refreshAll();
    showToast(`Canvas bounds set to ${newW}×${newH} px (${centerArtwork ? 'Centered' : 'Artwork preserved'})`, 'success');
  }

  // ===========================================================================
  // EVENT BINDINGS
  // ===========================================================================

  function exitRegionIsolation(cell, id = state.isolatedNodeId) {
    state.setIsolation(cell.id, null);
    const match = StructureOps.findNode(cell, id);
    if (match) {
      state.activeLayerId = match.layer.id;
      if (match.node.type === 'region') state.activeRegionId = id;
      regionSelection.focus(cell, state.activeLayerId, null, [(match.path[1] || match.node).id]);
    }
  }

  function bindEvents() {
    if (contextMenu) EditorMenu.populate(contextMenu);
    const inspector = document.querySelector('#view-cell-editor .right-sidebar');
    const inspectorWidth = Number(localStorage.getItem('noiradix_cell_inspector_width'));
    if (inspectorWidth >= 220) inspector.style.width = inspectorWidth + 'px';
    window.NoiraViewport.bindInspectorResize(document.getElementById('cell-inspector-resizer'), inspector,
      220, 240, 'noiradix_cell_inspector_width');
    brushSettings = Tools.bindBrushSettings();
    RegionSelection.bindActions(regionSelection, () => state.getActiveCell(), state, (cell, label) => {
      state.syncCellComposite(cell.id);
      state.saveSnapshot(label);
      triggerEventAutosave();
      refreshAll();
    }, showToast);
    if (dom.btnThemeToggle) dom.btnThemeToggle.addEventListener('click', toggleTheme);

    // Tool buttons
    dom.toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        regionSelection.cancel();
        state.currentTool = btn.dataset.tool;
        if (dom.canvasViewport) {
          dom.canvasViewport.classList.toggle('tool-pan', state.currentTool === 'pan');
        }
        if (state.currentTool !== 'select') {
          commitFloatingSelection();
          state.selection = null;
          renderCellOverlay();
        }
        updateStatusBarCoords(null, null);
      });

      if (btn.dataset.tool === 'pan') {
        btn.addEventListener('dblclick', () => {
          centerCellCanvas();
          showToast('Canvas centered');
        });
      }
    });

    // Cell Canvas Events
    dom.cellOverlay.addEventListener('mousedown', handleCellMouseDown);
    window.addEventListener('mousemove', handleCellMouseMove);
    window.addEventListener('mouseup', handleCellMouseUp);
    dom.cellOverlay.addEventListener('pointercancel', () => {
      if (regionSelection.cancel()) renderCellOverlay();
      if (isMovingSelection || isScalingSelection || isRotatingSelection) {
        isPointerDown = false;
        cancelFloatingSelection();
      }
    });
    dom.cellOverlay.addEventListener('dblclick', (e) => {
      if (state.currentTool !== 'region-select' || e.shiftKey || e.ctrlKey || e.metaKey) return;
      const point = getPixelCoords(e);
      const cell = state.getActiveCell();
      const hit = point && StructureOps.pickIsolationRegion(cell, point, state, e.altKey);
      if (hit && hit.node.id !== state.isolatedNodeId) {
        state.activeLayerId = hit.layer.id;
        state.activeRegionId = hit.node.id;
        state.setIsolation(cell.id, hit.node.id);
        regionSelection.focus(cell, state.activeLayerId, state.isolatedNodeId, [hit.node.id]);
        refreshAll();
      }
    });
    dom.cellOverlay.addEventListener('mouseleave', () => {
      renderCellOverlay(null, null);
      updateStatusBarCoords(null, null);
    });
    dom.cellOverlay.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      closeGridContextMenu();
      openContextMenu(e.clientX, e.clientY);
    });

    // Grid Canvas Events (Instant 1-Click Selection, Move/Delete/Clone Buttons & Row Drag Reorder)
    const handleGridCellSelect = (e) => {
      const rect = dom.gridCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // 1. Check if clicked on a Row Delete 'x' button
      const hitRow = getRowDeleteHit(mx, my);
      if (hitRow !== null) {
        confirmAndDeleteRow(hitRow);
        return;
      }

      // Check if clicked on a Row Duplicate button
      const hitDupRow = getRowDuplicateHit(mx, my);
      if (hitDupRow !== null) {
        promptAndDuplicateRow(hitDupRow);
        return;
      }

      // Check if clicked on a Row Move Up [▲] button
      const hitUp = getRowMoveUpHit(mx, my);
      if (hitUp !== null && hitUp > 0) {
        moveRow(hitUp, hitUp - 1);
        return;
      }

      // Check if clicked on a Row Move Down [▼] button
      const hitDown = getRowMoveDownHit(mx, my);
      if (hitDown !== null && state.doc && hitDown < state.doc.meta.grid.rows - 1) {
        moveRow(hitDown, hitDown + 1);
        return;
      }

      // 2. Check if clicked on a Column Delete 'x' button
      const hitCol = getColDeleteHit(mx, my);
      if (hitCol !== null) {
        confirmAndDeleteCol(hitCol);
        return;
      }

      // 3. Otherwise, select cell
      const cellId = getGridCellFromPos(mx, my);
      if (cellId) {
        selectedGridCellId = cellId;
        renderGridOverview();
        updateGridInspectorUI();
      }
    };

    dom.gridCanvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const rect = dom.gridCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check button hits first
      if (
        getRowDeleteHit(mx, my) !== null ||
        getColDeleteHit(mx, my) !== null ||
        getRowDuplicateHit(mx, my) !== null ||
        getRowMoveUpHit(mx, my) !== null ||
        getRowMoveDownHit(mx, my) !== null
      ) {
        return;
      }

      // Check if initiated drag on a Row Card
      const cardRow = getRowCardHit(mx, my);
      if (cardRow !== null) {
        rowDragState = {
          fromRow: cardRow,
          startY: my,
          currentY: my,
          targetRow: cardRow,
          isDragging: false
        };
        return;
      }

      // Check if clicked on a Cell
      const cellId = getGridCellFromPos(mx, my);
      if (cellId) {
        handleGridCellSelect(e);
        return;
      }

      // Otherwise: clicked on empty canvas area -> Start free 360° pan!
      isGridPanning = true;
      gridDragStartX = e.clientX;
      gridDragStartY = e.clientY;
      gridDragStartPanX = gridPanX;
      gridDragStartPanY = gridPanY;
      dom.gridCanvas.style.cursor = 'grabbing';
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    });

    // Viewport background pointerdown for free 360° canvas pan
    const gridViewport = document.querySelector('.grid-canvas-viewport');
    if (gridViewport) {
      gridViewport.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target !== gridViewport) return;
        isGridPanning = true;
        gridDragStartX = e.clientX;
        gridDragStartY = e.clientY;
        gridDragStartPanX = gridPanX;
        gridDragStartPanY = gridPanY;
        gridViewport.classList.add('is-panning');
        document.body.style.cursor = 'grabbing';
        e.preventDefault();
      });

      // Double-click empty background to re-center Grid
      gridViewport.addEventListener('dblclick', (e) => {
        if (e.target === gridViewport) {
          centerGridCanvas();
          showToast('Grid centered');
        }
      });

      // Mouse wheel zoom on Grid Viewport (Anchor-centered on cursor)
      gridViewport.addEventListener('wheel', (e) => {
        if (state.activeTabId === 'tab-grid-overview') {
          e.preventDefault();
          if (e.deltaY < 0) {
            zoomGridIn(e.clientX, e.clientY);
          } else {
            zoomGridOut(e.clientX, e.clientY);
          }
        }
      }, { passive: false });
    }

    dom.gridCanvas.addEventListener('click', (e) => {
      // Don't trigger cell select if user was panning or dragging
      if (isGridPanning) return;
      handleGridCellSelect(e);
    });

    window.addEventListener('pointermove', (e) => {
      if (isGridPanning) {
        const dx = e.clientX - gridDragStartX;
        const dy = e.clientY - gridDragStartY;
        gridPanX = Math.round(gridDragStartPanX + dx);
        gridPanY = Math.round(gridDragStartPanY + dy);
        applyGridPan();
      }
    });

    dom.gridCanvas.addEventListener('mousemove', (e) => {
      const rect = dom.gridCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (rowDragState) {
        if (!rowDragState.isDragging && Math.abs(my - rowDragState.startY) > 5) {
          rowDragState.isDragging = true;
        }
        if (rowDragState.isDragging) {
          rowDragState.currentY = my;
          const rows = state.doc ? state.doc.meta.grid.rows : 1;
          const { topHeaderH, cellGapY, zoom } = GRID_LAYOUT;
          const rowH = (state.doc ? state.doc.meta.cellSize.h : 16) * zoom + cellGapY;
          let targetR = Math.floor((my - topHeaderH + rowH / 2) / rowH);
          targetR = Math.max(0, Math.min(rows - 1, targetR));
          rowDragState.targetRow = targetR;
          dom.gridCanvas.style.cursor = 'grabbing';
          renderGridOverview();
          return;
        }
      }

      if (isGridPanning) {
        dom.gridCanvas.style.cursor = 'grabbing';
        return;
      }

      const isOverBtn = (
        getRowDeleteHit(mx, my) !== null ||
        getColDeleteHit(mx, my) !== null ||
        getRowDuplicateHit(mx, my) !== null ||
        getRowMoveUpHit(mx, my) !== null ||
        getRowMoveDownHit(mx, my) !== null
      );
      const isOverCard = (getRowCardHit(mx, my) !== null);
      const isOverCell = (getGridCellFromPos(mx, my) !== null);

      dom.gridCanvas.style.cursor = isOverBtn ? 'pointer' : (isOverCard ? 'grab' : (isOverCell ? 'pointer' : 'grab'));
    });

    window.addEventListener('pointerup', () => {
      if (isGridPanning) {
        isGridPanning = false;
        document.body.style.cursor = '';
        if (gridViewport) gridViewport.classList.remove('is-panning');
        if (dom.gridCanvas) dom.gridCanvas.style.cursor = 'grab';
      }

      if (rowDragState) {
        if (rowDragState.isDragging) {
          const fromR = rowDragState.fromRow;
          const toR = rowDragState.targetRow;
          rowDragState = null;
          if (dom.gridCanvas) dom.gridCanvas.style.cursor = 'default';
          if (fromR !== toR) {
            moveRow(fromR, toR);
          } else {
            renderGridOverview();
          }
        } else {
          rowDragState = null;
          if (dom.gridCanvas) dom.gridCanvas.style.cursor = 'default';
        }
      }
    });

    const handleGridContextMenu = (e) => {
      e.preventDefault();
      closeContextMenu();

      let clickedCellId = null;
      if (dom.gridCanvas) {
        const rect = dom.gridCanvas.getBoundingClientRect();
        clickedCellId = getGridCellFromPos(e.clientX - rect.left, e.clientY - rect.top);
      }

      // 1. If clicked on a specific cell -> select and open context menu
      if (clickedCellId) {
        selectedGridCellId = clickedCellId;
        renderGridOverview();
        updateGridInspectorUI();
        openGridContextMenu(e.clientX, e.clientY, clickedCellId);
        return;
      }

      // 2. If clicked on empty area or viewport, but a cell was already focused -> open menu for focused cell
      if (selectedGridCellId) {
        openGridContextMenu(e.clientX, e.clientY, selectedGridCellId);
        return;
      }

      // 3. Fallback: select first cell if none selected
      const firstCellId = Object.keys(state.doc ? state.doc.cells : {})[0];
      if (firstCellId) {
        selectedGridCellId = firstCellId;
        renderGridOverview();
        updateGridInspectorUI();
        openGridContextMenu(e.clientX, e.clientY, firstCellId);
      }
    };

    dom.gridCanvas.addEventListener('contextmenu', handleGridContextMenu);
    if (gridViewport) {
      gridViewport.addEventListener('contextmenu', handleGridContextMenu);
    }

    dom.gridCanvas.addEventListener('dblclick', (e) => {
      const rect = dom.gridCanvas.getBoundingClientRect();
      const cellId = getGridCellFromPos(e.clientX - rect.left, e.clientY - rect.top);
      if (cellId) {
        commitFloatingSelection();
        state.selection = null;
        closeContextMenu();
        closeGridContextMenu();
        state.openCellTab(cellId);
        refreshAll();
      }
    });

    // Close context menus on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.studio-context-menu')) {
        closeContextMenu();
        closeGridContextMenu();
      }
    });

    // Studio Cell Editor Context Menu Actions
    document.querySelectorAll('#studio-context-menu .context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        closeContextMenu();
        switch (action) {
          case 'cut': executeSelectionCut(); break;
          case 'copy': executeSelectionCopy(); break;
          case 'paste': executeSelectionPaste(); break;
          case 'fill': executeSelectionFill(); break;
          case 'rotate-90': executeSelectionRotate(); break;
          case 'align-center': document.getElementById('btn-align-center')?.click(); break;
          case 'flip-h': executeSelectionFlip(true); break;
          case 'flip-v': executeSelectionFlip(false); break;
          case 'select-all': executeSelectAll(); break;
          case 'deselect': executeDeselect(); break;
          case 'delete': executeSelectionDelete(); break;
        }
      });
    });

    // Grid Overview Context Menu Actions
    document.querySelectorAll('#grid-context-menu .context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.gridAction;
        const targetCellId = gridContextCellId || selectedGridCellId;
        closeGridContextMenu();
        if (!targetCellId) return;

        switch (action) {
          case 'edit':
            commitFloatingSelection();
            state.selection = null;
            state.openCellTab(targetCellId);
            refreshAll();
            break;
          case 'copy':
            executeCopyGridCell(targetCellId);
            break;
          case 'paste':
            executePasteGridCell(targetCellId);
            break;
          case 'duplicate':
            duplicateGridCellToNext(targetCellId);
            break;
          case 'flip-h':
            flipGridCell(targetCellId, true);
            break;
          case 'flip-v':
            flipGridCell(targetCellId, false);
            break;
          case 'clear':
            clearGridCell(targetCellId);
            break;
          case 'move-row-up': {
            const { r: selR } = getCellRowCol(targetCellId);
            if (selR > 0) moveRow(selR, selR - 1);
            break;
          }
          case 'move-row-down': {
            const { r: selR } = getCellRowCol(targetCellId);
            if (state.doc && selR < state.doc.meta.grid.rows - 1) moveRow(selR, selR + 1);
            break;
          }
          case 'duplicate-row': {
            const { r: selR } = getCellRowCol(targetCellId);
            promptAndDuplicateRow(selR);
            break;
          }
          case 'flip-row-h': {
            const { r: selR } = getCellRowCol(targetCellId);
            flipRow(selR, true);
            break;
          }
          case 'flip-row-v': {
            const { r: selR } = getCellRowCol(targetCellId);
            flipRow(selR, false);
            break;
          }
          case 'delete-row': {
            const { r: selR } = getCellRowCol(targetCellId);
            deleteSpecificRow(selR);
            break;
          }
          case 'delete-col': {
            const { c: selC } = getCellRowCol(targetCellId);
            deleteSpecificCol(selC);
            break;
          }
        }
      });
    });

    // External File Drag & Drop (Desktop -> Studio)
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!e.dataTransfer) return;

      // 1. Modern File System Access API: extract actual FileSystemFileHandle from drop
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const item = e.dataTransfer.items[0];
        if (typeof item.getAsFileSystemHandle === 'function') {
          try {
            const handle = await item.getAsFileSystemHandle();
            if (handle && handle.kind === 'file') {
              await handleFileOpenFromHandle(handle);
              return;
            }
          } catch (handleErr) {
            console.debug('Direct getAsFileSystemHandle not available, using standard file fallback:', handleErr);
          }
        }
      }

      // 2. Multi-Format Drag & Drop Routing (PIX2 1.1 Ingestion & Session Manager)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const pngFile = files.find(f => f.name.toLowerCase().endsWith('.png'));
        const jsonFile = files.find(f => f.name.toLowerCase().endsWith('.json'));
        const pix2Files = files.filter(f => f.name.toLowerCase().endsWith('.pix2') || f.name.toLowerCase().endsWith('.txt'));

        if (pngFile && jsonFile) {
          handlePairDropToImportSlice(pngFile, jsonFile);
        } else if (pngFile) {
          handleSingleFileToImportSlice(pngFile);
        } else if (jsonFile) {
          handleSingleFileToImportSlice(jsonFile);
        } else if (pix2Files.length > 0) {
          for (const pf of pix2Files) {
            const text = await pf.text();
            try {
              const doc = PIX2.parse(text);
              createProjectSession(doc, pf.name, null);
              showToast(`Opened ${pf.name} as project tab!`, 'success');
            } catch (pErr) {
              showToast(`Error parsing ${pf.name}: ${pErr.message}`, 'error');
            }
          }
        } else {
          handleFileOpen(files[0]);
        }
      }
    });

    // Grid Inspector actions
    if (dom.btnGridOpenEditor) {
      dom.btnGridOpenEditor.addEventListener('click', () => {
        if (selectedGridCellId) {
          state.openCellTab(selectedGridCellId);
          refreshAll();
        }
      });
    }

    if (dom.gridCellName) {
      dom.gridCellName.addEventListener('input', (e) => {
        if (state.doc && state.doc.cells[selectedGridCellId]) {
          state.doc.cells[selectedGridCellId].name = e.target.value.trim() || selectedGridCellId;
          renderGridOverview();
          renderTabs();
          triggerEventAutosave();
        }
      });
    }

    if (dom.gridCellIdInput) {
      dom.gridCellIdInput.addEventListener('change', (e) => {
        const rawId = e.target.value.trim();
        if (!rawId) return;
        if (typeof PIX2 !== 'undefined' && !PIX2.isSafeIdentifier(rawId)) {
          showToast(`Invalid cell ID: "${rawId}" is a reserved keyword.`, 'error');
          e.target.value = selectedGridCellId;
          return;
        }
        const newId = (typeof PIX2 !== 'undefined') ? PIX2.sanitizeKey(rawId, selectedGridCellId) : rawId;
        if (newId && state.doc && state.doc.cells[selectedGridCellId] && newId !== selectedGridCellId) {
          const cell = state.doc.cells[selectedGridCellId];
          delete state.doc.cells[selectedGridCellId];
          cell.id = newId;
          state.doc.cells[newId] = cell;

          for (const animName in state.doc.animations) {
            const anim = state.doc.animations[animName];
            const idx = anim.frames.indexOf(selectedGridCellId);
            if (idx >= 0) anim.frames[idx] = newId;
          }

          selectedGridCellId = newId;
          state.saveSnapshot(`Rename Cell ID to ${newId}`);
          triggerEventAutosave();
          refreshAll();
        }
      });
    }

    if (dom.gridCellDir) {
      dom.gridCellDir.addEventListener('change', (e) => {
        if (state.doc && state.doc.cells[selectedGridCellId]) {
          state.doc.cells[selectedGridCellId].direction = e.target.value;
          triggerEventAutosave();
        }
      });
    }

    if (dom.gridCellAnim) {
      dom.gridCellAnim.addEventListener('change', (e) => {
        const val = e.target.value;
        const { r: selR } = getCellRowCol(selectedGridCellId);

        if (val === '__new__') {
          const newName = prompt('Enter new animation state name for this row (e.g. idle_down, attack, dash):');
          if (newName && newName.trim()) {
            const key = newName.trim().toLowerCase().replace(/\s+/g, '_');
            assignRowToAnimation(selR, key, newName.trim());
          } else {
            updateGridInspectorUI();
          }
        } else if (val) {
          assignRowToAnimation(selR, val);
        }
      });
    }

    // Quick 4-Dir and 8-Dir Buttons on Grid Toolbar
    dom.btnQuick4dir?.addEventListener('click', () => openActionTemplateModal(4));
    dom.btnQuick8dir?.addEventListener('click', () => openActionTemplateModal(8));

    // Grid Overview Zoom Controls
    dom.btnGridZoomOut?.addEventListener('click', () => zoomGridOut());
    dom.btnGridZoomIn?.addEventListener('click', () => zoomGridIn());
    document.getElementById('btn-grid-zoom-fit')?.addEventListener('click', fitGridCanvas);
    dom.btnGridZoomReset?.addEventListener('click', () => setGridZoom(4));

    // Action Template Modal Event Handlers (2-Dir Platformer, 4-Dir, 8-Dir)
    dom.btnMode2dir?.addEventListener('click', () => {
      currentTemplateMode = 2;
      dom.btnMode2dir?.classList.add('active');
      dom.btnMode4dir?.classList.remove('active');
      dom.btnMode8dir?.classList.remove('active');
      renderTemplateLivePreview();
    });

    dom.btnMode4dir?.addEventListener('click', () => {
      currentTemplateMode = 4;
      dom.btnMode4dir.classList.add('active');
      dom.btnMode2dir?.classList.remove('active');
      dom.btnMode8dir?.classList.remove('active');
      renderTemplateLivePreview();
    });

    dom.btnMode8dir?.addEventListener('click', () => {
      currentTemplateMode = 8;
      dom.btnMode8dir.classList.add('active');
      dom.btnMode2dir?.classList.remove('active');
      dom.btnMode4dir.classList.remove('active');
      renderTemplateLivePreview();
    });

    dom.actionChipsContainer?.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip-btn');
      if (chip && chip.dataset.action) {
        if (dom.templateActionInput) dom.templateActionInput.value = chip.dataset.action;
        syncActiveActionChip();
        renderTemplateLivePreview();
      }
    });

    dom.templateActionInput?.addEventListener('input', () => {
      syncActiveActionChip();
      renderTemplateLivePreview();
    });

    [dom.templateColsInput, dom.templateFpsInput, dom.templateStartRow].forEach(input => {
      input?.addEventListener('input', renderTemplateLivePreview);
    });

    dom.btnCloseTemplateModal?.addEventListener('click', closeActionTemplateModal);
    dom.btnCancelTemplateModal?.addEventListener('click', closeActionTemplateModal);
    dom.btnApplyTemplateModal?.addEventListener('click', applyActionTemplate);

    dom.modalActionTemplate?.addEventListener('click', (e) => {
      if (e.target === dom.modalActionTemplate) {
        closeActionTemplateModal();
      }
    });

    // Structure & Layers Card Event Handlers (PIX2 1.1)
    dom.btnAddLayer?.addEventListener('click', () => {
      const cell = state.getActiveCell();
      if (!cell) return;
      const count = (cell.layers ? cell.layers.length : 0) + 1;
      const name = prompt('Enter Layer Name:', `Layer ${count}`);
      if (name) {
        state.addLayer(cell.id, name);
        refreshAll();
      }
    });

    dom.btnAddGroup?.addEventListener('click', () => {
      const cell = state.getActiveCell();
      if (!cell) return;
      if (!cell.layers || cell.layers.length === 0) {
        state.addLayer(cell.id, 'Layer 1');
      }
      const parentId = state.activeGroupId || state.activeLayerId || (cell.layers[0] ? cell.layers[0].id : null);
      if (!parentId) return;
      const name = prompt('Enter Group Name:', 'New Group');
      if (name) {
        state.addGroup(cell.id, parentId, name);
        refreshAll();
      }
    });

    dom.btnAddRegion?.addEventListener('click', () => {
      const cell = state.getActiveCell();
      if (!cell) return;
      if (!cell.layers || cell.layers.length === 0) {
        state.addLayer(cell.id, 'Layer 1');
      }
      const parentId = state.activeGroupId || state.activeLayerId || (cell.layers[0] ? cell.layers[0].id : null);
      if (!parentId) return;
      const name = prompt('Enter Region Name:', 'New Region');
      if (name) {
        state.addRegion(cell.id, parentId, name);
        refreshAll();
      }
    });

    dom.btnExitIsolation?.addEventListener('click', () => {
      const cell = state.getActiveCell();
      if (cell) exitRegionIsolation(cell);
      else state.isolatedNodeId = null;
      refreshAll();
    });

    // Import & Slice Studio Event Handlers (PIX2 1.1)
    dom.importSliceDropzone?.addEventListener('click', () => {
      dom.inputImportSliceFile?.click();
    });

    dom.importSliceDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dom.importSliceDropzone.style.borderColor = 'var(--accent-primary)';
    });

    dom.importSliceDropzone?.addEventListener('dragleave', () => {
      dom.importSliceDropzone.style.borderColor = 'var(--border-subtle)';
    });

    dom.importSliceDropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.importSliceDropzone.style.borderColor = 'var(--border-subtle)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const png = files.find(f => f.name.toLowerCase().endsWith('.png'));
        const json = files.find(f => f.name.toLowerCase().endsWith('.json'));
        if (png && json) {
          handlePairDropToImportSlice(png, json);
        } else if (png) {
          handleSingleFileToImportSlice(png);
        } else if (json) {
          handleSingleFileToImportSlice(json);
        }
      }
    });

    dom.inputImportSliceFile?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        const png = files.find(f => f.name.toLowerCase().endsWith('.png'));
        const json = files.find(f => f.name.toLowerCase().endsWith('.json'));
        if (png && json) {
          handlePairDropToImportSlice(png, json);
        } else if (png) {
          handleSingleFileToImportSlice(png);
        } else if (json) {
          handleSingleFileToImportSlice(json);
        }
      }
    });

    dom.selectSliceMethod?.addEventListener('change', () => {
      const method = dom.selectSliceMethod.value;
      if (dom.sliceOptsGrid) dom.sliceOptsGrid.style.display = (method === 'grid') ? 'flex' : 'none';
      if (dom.sliceOptsAlpha) dom.sliceOptsAlpha.style.display = (method === 'alpha') ? 'flex' : 'none';
      if (dom.sliceOptsAtlas) dom.sliceOptsAtlas.style.display = (method === 'atlas') ? 'flex' : 'none';
      updateImportSlices();
    });

    [dom.inputSliceCellW, dom.inputSliceCellH].forEach(input => {
      input?.addEventListener('input', () => {
        input.dataset.userModified = 'true';
      });
    });

    [dom.inputSliceCellW, dom.inputSliceCellH, dom.inputSliceCols, dom.inputSliceRows,
     dom.inputSliceSpacing, dom.inputSliceMargin, dom.inputSliceAlphaThresh, dom.inputSliceMinSize].forEach(input => {
      input?.addEventListener('input', updateImportSlices);
    });

    dom.btnRunSlicePreview?.addEventListener('click', updateImportSlices);
    dom.btnImportSliceCommit?.addEventListener('click', commitImportSlicesToProject);

    // Slicing Viewport Tool mode toggles
    dom.btnSliceToolSelect?.addEventListener('click', () => setSliceTool('select'));
    dom.btnSliceToolDraw?.addEventListener('click', () => setSliceTool('draw'));
    dom.btnSliceToolHand?.addEventListener('click', () => setSliceTool('hand'));

    // Slicing Viewport Zoom controls
    dom.btnSliceZoomOut?.addEventListener('click', () => setSliceZoom(importSliceState.zoom * 0.8));
    dom.btnSliceZoomIn?.addEventListener('click', () => setSliceZoom(importSliceState.zoom * 1.25));
    dom.btnSliceZoomFit?.addEventListener('click', fitSliceZoom);
    dom.btnSliceZoomReset?.addEventListener('click', () => setSliceZoom(1));

    // Slicing Viewport Selection actions
    dom.btnSliceSelectAll?.addEventListener('click', () => {
      if (importSliceState.frames && importSliceState.frames.length > 0) {
        importSliceState.selectedSliceIndex = 0;
        renderImportSliceView();
      }
    });
    dom.btnSliceDeselect?.addEventListener('click', () => {
      importSliceState.selectedSliceIndex = -1;
      renderImportSliceView();
    });
    dom.btnSliceDeleteSelected?.addEventListener('click', () => {
      if (importSliceState.selectedSliceIndex >= 0) {
        deleteImportSlice(importSliceState.selectedSliceIndex);
      }
    });
    dom.btnSliceClearAll?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all slices?')) {
        importSliceState.frames = [];
        importSliceState.selectedSliceIndex = -1;
        renderImportSliceView();
        showToast('Cleared all slices', 'info');
      }
    });

    // Inspector Deck Batch Tagging Actions
    dom.btnBatchTagPrefix?.addEventListener('click', batchTagPrefix);
    dom.btnAutoTag4Dir?.addEventListener('click', autoTag4Dir);
    dom.btnAutoTag8Dir?.addEventListener('click', autoTag8Dir);
    dom.btnClearAllTags?.addEventListener('click', clearAllTags);

    // Slicing Viewport Guides Toggles
    dom.btnSliceToggleGrid?.addEventListener('click', () => {
      importSliceState.showPixelGrid = !importSliceState.showPixelGrid;
      dom.btnSliceToggleGrid?.classList.toggle('active', importSliceState.showPixelGrid);
      renderImportSliceView();
    });
    dom.btnSliceToggleRulers?.addEventListener('click', () => {
      importSliceState.showRulers = !importSliceState.showRulers;
      dom.btnSliceToggleRulers?.classList.toggle('active', importSliceState.showRulers);
      renderImportSliceView();
    });
    dom.btnSliceToggleLabels?.addEventListener('click', () => {
      importSliceState.showLabels = !importSliceState.showLabels;
      dom.btnSliceToggleLabels?.classList.toggle('active', importSliceState.showLabels);
      renderImportSliceView();
    });

    // Cell Editor Resize Frame button
    dom.btnCellResizeFrame?.addEventListener('click', openResizeFrameModal);

    // Game Export Studio Modal Event Handlers
    dom.exportFormatOptions?.addEventListener('click', (e) => {
      const card = e.target.closest('.format-option-card');
      if (card && card.dataset.format) {
        currentExportFormat = card.dataset.format;
        syncExportFormatCards();
      }
    });

    [dom.exportSpacingSelect, dom.exportMarginSelect, dom.exportExtrudeCheckbox, dom.exportScaleSelect, dom.exportPivotSelect].forEach(elem => {
      elem?.addEventListener('change', updateExportPreview);
    });

    dom.btnCloseExportModal?.addEventListener('click', closeGameExportModal);
    dom.btnCancelExportModal?.addEventListener('click', closeGameExportModal);
    dom.btnQuickExportPng?.addEventListener('click', () => {
      const opts = getExportOptions();
      const atlasData = generateAtlasCanvas(opts);
      if (atlasData) {
        const baseName = (state.doc.meta.title || 'sprite_atlas').toLowerCase().replace(/\s+/g, '_');
        atlasData.canvas.toBlob(blob => {
          downloadBlob(blob, `${baseName}.png`);
          showToast(`Exported PNG Atlas (${atlasData.width}×${atlasData.height} px)!`, 'success');
          closeGameExportModal();
        });
      }
    });
    dom.btnExecuteGameExport?.addEventListener('click', executeGameExport);

    dom.modalGameExport?.addEventListener('click', (e) => {
      if (e.target === dom.modalGameExport) {
        closeGameExportModal();
      }
    });

    // New File Modal Events
    dom.btnCloseNewFileModal?.addEventListener('click', closeNewFileModal);
    dom.btnCancelNewFile?.addEventListener('click', closeNewFileModal);
    dom.btnConfirmNewFile?.addEventListener('click', confirmNewFileCreation);

    dom.modalNewFile?.addEventListener('click', (e) => {
      if (e.target === dom.modalNewFile) {
        closeNewFileModal();
      }
    });

    dom.newFileNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmNewFileCreation();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeNewFileModal();
      }
    });

    dom.newFileTitleInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmNewFileCreation();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeNewFileModal();
      }
    });

    dom.newFilePresets?.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip-btn');
      if (!btn) return;
      dom.newFilePresets.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cols = btn.dataset.cols;
      const rows = btn.dataset.rows;
      const cw = btn.dataset.cw;
      const ch = btn.dataset.ch;
      if (dom.newFileCols && cols) dom.newFileCols.value = cols;
      if (dom.newFileRows && rows) dom.newFileRows.value = rows;
      if (dom.newFileCellW && cw) dom.newFileCellW.value = cw;
      if (dom.newFileCellH && ch) dom.newFileCellH.value = ch;
      updateNewFileSummary();
    });

    const resPresets = document.getElementById('new-file-res-presets');
    resPresets?.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip-btn');
      if (!btn) return;
      resPresets.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const w = parseInt(btn.dataset.w || btn.dataset.res, 10);
      const h = parseInt(btn.dataset.h || btn.dataset.res, 10);
      if (w && dom.newFileCellW) dom.newFileCellW.value = w;
      if (h && dom.newFileCellH) dom.newFileCellH.value = h;
      updateNewFileSummary();
    });

    dom.newFileCols?.addEventListener('input', updateNewFileSummary);
    dom.newFileRows?.addEventListener('input', updateNewFileSummary);
    dom.newFileCellW?.addEventListener('input', updateNewFileSummary);
    dom.newFileCellH?.addEventListener('input', updateNewFileSummary);

    // Resize Frame Modal Events
    dom.btnResizeFrame?.addEventListener('click', openResizeFrameModal);
    dom.btnCloseResizeFrameModal?.addEventListener('click', closeResizeFrameModal);
    dom.btnCancelResizeFrame?.addEventListener('click', closeResizeFrameModal);
    dom.btnConfirmResizeFrame?.addEventListener('click', confirmResizeFrame);

    dom.resizeFramePresets?.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip-btn');
      if (!btn) return;
      dom.resizeFramePresets.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const w = parseInt(btn.dataset.w, 10);
      const h = parseInt(btn.dataset.h, 10);
      if (dom.resizeFrameW && w) dom.resizeFrameW.value = w;
      if (dom.resizeFrameH && h) dom.resizeFrameH.value = h;
    });

    const onResizeFrameKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmResizeFrame();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeResizeFrameModal();
      }
    };
    dom.resizeFrameW?.addEventListener('keydown', onResizeFrameKeydown);
    dom.resizeFrameH?.addEventListener('keydown', onResizeFrameKeydown);

    // Import PIX2 Code Modal Events
    dom.btnCloseImportModal?.addEventListener('click', closeImportCodeModal);
    dom.btnCancelImportCode?.addEventListener('click', closeImportCodeModal);
    dom.btnConfirmImportCode?.addEventListener('click', confirmImportCode);
    dom.btnImportPasteClipboard?.addEventListener('click', pasteClipboardIntoImport);
    dom.btnImportClearCode?.addEventListener('click', () => {
      if (dom.importCodeTextarea) {
        dom.importCodeTextarea.value = '';
        dom.importCodeTextarea.focus();
      }
      if (dom.importCodeError) {
        dom.importCodeError.classList.add('hidden');
        dom.importCodeError.textContent = '';
      }
    });

    dom.importCodeTextarea?.addEventListener('input', () => {
      if (dom.importCodeError && !dom.importCodeError.classList.contains('hidden')) {
        dom.importCodeError.classList.add('hidden');
        dom.importCodeError.textContent = '';
      }
      detectTitleInImportCode(dom.importCodeTextarea.value);
    });

    dom.importCodeTextarea?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        confirmImportCode();
      }
    });

    dom.modalImportCode?.addEventListener('click', (e) => {
      if (e.target === dom.modalImportCode) {
        closeImportCodeModal();
      }
    });

    dom.importFileNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmImportCode();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeImportCodeModal();
      }
    });

    // Export Atlas Preview Zoom level buttons (Magnifying Glass Controls)
    document.querySelectorAll('#export-zoom-group [data-scale]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#export-zoom-group [data-scale]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const scaleVal = btn.dataset.scale;
        exportPreviewZoom = (scaleVal === 'fit') ? 'fit' : parseInt(scaleVal, 10);
        updateExportPreview(true);
      });
    });

    // Mouse wheel zoom and drag-to-pan on Export preview viewport
    const exportViewport = document.getElementById('export-preview-viewport');
    if (exportViewport) {
      exportViewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scales = [1, 2, 4];
        let curIdx = scales.indexOf(exportPreviewZoom);
        if (curIdx === -1) {
          curIdx = e.deltaY < 0 ? 1 : 0;
        } else {
          if (e.deltaY < 0 && curIdx < scales.length - 1) {
            curIdx++;
          } else if (e.deltaY > 0 && curIdx > 0) {
            curIdx--;
          }
        }
        const nextScale = scales[curIdx];
        exportPreviewZoom = nextScale;
        document.querySelectorAll('#export-zoom-group [data-scale]').forEach(b => {
          b.classList.toggle('active', b.dataset.scale === String(nextScale));
        });
        updateExportPreview(true);
      }, { passive: false });

      exportViewport.addEventListener('dblclick', (e) => {
        e.preventDefault();
        const nextScale = (exportPreviewZoom === 'fit') ? 4 : 'fit';
        exportPreviewZoom = nextScale;
        document.querySelectorAll('#export-zoom-group [data-scale]').forEach(b => {
          b.classList.toggle('active', b.dataset.scale === String(nextScale));
        });
        updateExportPreview(true);
      });

      let isPanDragging = false;
      let panStartX = 0;
      let panStartY = 0;
      let scrollStartX = 0;
      let scrollStartY = 0;

      exportViewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0 && e.button !== 1) return;
        isPanDragging = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        scrollStartX = exportViewport.scrollLeft;
        scrollStartY = exportViewport.scrollTop;
      });

      window.addEventListener('mousemove', (e) => {
        if (!isPanDragging) return;
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        exportViewport.scrollLeft = scrollStartX - dx;
        exportViewport.scrollTop = scrollStartY - dy;
      });

      window.addEventListener('mouseup', () => {
        isPanDragging = false;
      });
    }

    if (dom.btnAddAnimClip) {
      dom.btnAddAnimClip.addEventListener('click', () => {
        const { r: selR } = getCellRowCol(selectedGridCellId);
        const newName = prompt('New Animation State name for this row:', 'attack');
        if (newName && newName.trim()) {
          const key = newName.trim().toLowerCase().replace(/\s+/g, '_');
          assignRowToAnimation(selR, key, newName.trim());
        }
      });
    }

    if (dom.btnQuickNewAnim) {
      dom.btnQuickNewAnim.addEventListener('click', () => {
        const name = prompt('New Animation State name:', 'attack');
        if (name && name.trim() && state.doc) {
          const key = name.trim().toLowerCase().replace(/\s+/g, '_');
          state.doc.animations[key] = { name: name.trim(), direction: 'none', frames: [], fps: 6, loop: true, mode: 'loop' };
          populateAnimDropdowns();
          triggerEventAutosave();
          showToast(`Created animation clip '${name.trim()}'!`, 'success');
        }
      });
    }

    // Grid Add/Remove Rows & Columns (Direct 1-Click based on active selection)
    if (dom.btnGridAddRow) dom.btnGridAddRow.addEventListener('click', addGridRow);
    if (dom.btnGridRemoveRow) dom.btnGridRemoveRow.addEventListener('click', removeSelectedRow);
    if (dom.btnGridAddCol) dom.btnGridAddCol.addEventListener('click', addGridCol);
    if (dom.btnGridRemoveCol) dom.btnGridRemoveCol.addEventListener('click', removeSelectedCol);

    // Animation Studio Active Frame Name & Edit
    if (dom.studioFrameNameInput) {
      dom.studioFrameNameInput.addEventListener('input', (e) => {
        if (!state.doc) return;
        const clip = state.doc.animations[activeStudioClipId];
        if (!clip || !clip.frames) return;
        const curIdx = studioAnimPlayer ? studioAnimPlayer.currentFrameIdx : 0;
        const cellId = clip.frames[curIdx];
        if (cellId && state.doc.cells[cellId]) {
          const newName = e.target.value.trim() || cellId;
          state.doc.cells[cellId].name = newName;
          if (dom.studioActiveFrameText) dom.studioActiveFrameText.textContent = `#${curIdx}: ${newName}`;
          if (dom.timelineSelectedFrameInfo) dom.timelineSelectedFrameInfo.textContent = `Selected: #${curIdx} - ${newName}`;
          if (dom.timelineFramesStrip) {
            const activeCard = dom.timelineFramesStrip.querySelector(`.timeline-frame-card[data-idx="${curIdx}"] .timeline-frame-info`);
            if (activeCard) activeCard.textContent = `#${curIdx}: ${newName}`;
          }
          triggerEventAutosave();
        }
      });
    }

    if (dom.btnStudioEditFramePixels) {
      dom.btnStudioEditFramePixels.addEventListener('click', () => {
        if (!state.doc) return;
        const clip = state.doc.animations[activeStudioClipId];
        if (!clip || !clip.frames) return;
        const curIdx = studioAnimPlayer ? studioAnimPlayer.currentFrameIdx : 0;
        const cellId = clip.frames[curIdx];
        if (cellId && state.doc.cells[cellId]) {
          state.openCellTab(cellId);
          refreshAll();
        }
      });
    }

    // Toggle Floating Preview
    if (dom.btnToggleFloatAnim) {
      dom.btnToggleFloatAnim.addEventListener('click', () => {
        if (!dom.animFloatingPanel) return;
        const isHidden = dom.animFloatingPanel.classList.contains('hidden') || dom.animFloatingPanel.style.display === 'none';
        if (isHidden) {
          dom.animFloatingPanel.classList.remove('hidden');
          dom.animFloatingPanel.style.display = 'flex';
          dom.btnToggleFloatAnim.classList.add('active');
          userClosedFloatingPreview = false;
          if (animPlayer) animPlayer.render();
          showToast('Preview panel opened');
        } else {
          dom.animFloatingPanel.classList.add('hidden');
          dom.animFloatingPanel.style.display = 'none';
          dom.btnToggleFloatAnim.classList.remove('active');
          userClosedFloatingPreview = true;
          showToast('Preview panel closed');
        }
      });
    }

    // Dedicated Animation Studio bindings
    if (dom.btnStudioAddAnim) {
      dom.btnStudioAddAnim.addEventListener('click', () => {
        const rawName = prompt('New Animation State name (e.g. attack, jump, death):', 'attack');
        if (!rawName) return;
        if (typeof PIX2 !== 'undefined' && !PIX2.isSafeIdentifier(rawName)) {
          showToast(`Invalid animation name: "${rawName}" is a reserved property.`, 'error');
          return;
        }
        const name = (typeof PIX2 !== 'undefined') ? PIX2.sanitizeKey(rawName.trim(), 'anim') : rawName.trim();
        if (name && state.doc) {
          state.doc.animations[name] = { name, direction: 'none', frames: [], fps: 6, loop: true, mode: 'loop' };
          activeStudioClipId = name;
          triggerEventAutosave();
          refreshAll();
          showToast(`Created animation '${name}'!`, 'success');
        }
      });
    }

    if (dom.studioClipName) {
      dom.studioClipName.addEventListener('change', (e) => {
        const rawName = e.target.value.trim();
        if (!rawName) return;
        if (typeof PIX2 !== 'undefined' && !PIX2.isSafeIdentifier(rawName)) {
          showToast(`Invalid animation name: "${rawName}" is a reserved property.`, 'error');
          e.target.value = activeStudioClipId;
          return;
        }
        const newName = (typeof PIX2 !== 'undefined') ? PIX2.sanitizeKey(rawName, activeStudioClipId) : rawName;
        if (newName && state.doc && state.doc.animations[activeStudioClipId] && newName !== activeStudioClipId) {
          const anim = state.doc.animations[activeStudioClipId];
          delete state.doc.animations[activeStudioClipId];
          anim.name = newName;
          state.doc.animations[newName] = anim;
          activeStudioClipId = newName;
          triggerEventAutosave();
          refreshAll();
        }
      });
    }

    if (dom.studioClipFps) {
      dom.studioClipFps.addEventListener('input', (e) => {
        const fps = parseInt(e.target.value, 10);
        if (state.doc && state.doc.animations[activeStudioClipId]) {
          state.doc.animations[activeStudioClipId].fps = fps;
          if (dom.studioClipFpsLabel) dom.studioClipFpsLabel.textContent = `${fps} fps`;
          if (studioAnimPlayer) studioAnimPlayer.fps = fps;
          triggerEventAutosave();
        }
      });
    }

    if (dom.studioClipMode) {
      dom.studioClipMode.addEventListener('change', (e) => {
        if (state.doc && state.doc.animations[activeStudioClipId]) {
          state.doc.animations[activeStudioClipId].mode = e.target.value;
          state.doc.animations[activeStudioClipId].loop = (e.target.value !== 'once');
          triggerEventAutosave();
        }
      });
    }

    if (dom.studioClipDir) {
      dom.studioClipDir.addEventListener('change', (e) => {
        if (state.doc && state.doc.animations[activeStudioClipId]) {
          state.doc.animations[activeStudioClipId].direction = e.target.value;
          triggerEventAutosave();
        }
      });
    }

    if (dom.btnStudioDeleteClip) {
      dom.btnStudioDeleteClip.addEventListener('click', () => {
        if (state.doc && state.doc.animations[activeStudioClipId]) {
          if (confirm(`Delete animation clip '${activeStudioClipId}'?`)) {
            delete state.doc.animations[activeStudioClipId];
            activeStudioClipId = Object.keys(state.doc.animations)[0] || '';
            triggerEventAutosave();
            refreshAll();
          }
        }
      });
    }

    if (dom.btnStudioOnionSkin) {
      dom.btnStudioOnionSkin.addEventListener('click', () => {
        if (studioAnimPlayer) {
          const active = studioAnimPlayer.toggleOnionSkin();
          dom.btnStudioOnionSkin.classList.toggle('active', active);
          if (dom.onionSkinLabel) dom.onionSkinLabel.textContent = `Onion Skin: ${active ? 'ON' : 'OFF'}`;
        }
      });
    }

    const btnTimelinePlay = document.getElementById('btn-timeline-play');
    const btnTimelinePrev = document.getElementById('btn-timeline-prev');
    const btnTimelineNext = document.getElementById('btn-timeline-next');

    const toggleStudioPlayback = () => {
      if (!studioAnimPlayer) return;
      if (studioAnimPlayer.isPlaying) {
        studioAnimPlayer.stop();
      } else {
        studioAnimPlayer.start();
      }
      updateStudioPlayButtonUI();
    };

    const stepStudioPrevFrame = () => {
      if (studioAnimPlayer) {
        if (studioAnimPlayer.isPlaying) {
          studioAnimPlayer.stop();
          updateStudioPlayButtonUI();
        }
        studioAnimPlayer.stepFrame(-1);
        studioAnimPlayer.render();
        selectStudioFrame(studioAnimPlayer.currentFrameIdx);
      }
    };

    const stepStudioNextFrame = () => {
      if (studioAnimPlayer) {
        if (studioAnimPlayer.isPlaying) {
          studioAnimPlayer.stop();
          updateStudioPlayButtonUI();
        }
        studioAnimPlayer.stepFrame(1);
        studioAnimPlayer.render();
        selectStudioFrame(studioAnimPlayer.currentFrameIdx);
      }
    };

    if (dom.btnStudioPlay) dom.btnStudioPlay.addEventListener('click', toggleStudioPlayback);
    if (btnTimelinePlay) btnTimelinePlay.addEventListener('click', toggleStudioPlayback);
    if (dom.btnStudioPrev) dom.btnStudioPrev.addEventListener('click', stepStudioPrevFrame);
    if (btnTimelinePrev) btnTimelinePrev.addEventListener('click', stepStudioPrevFrame);
    if (dom.btnStudioNext) dom.btnStudioNext.addEventListener('click', stepStudioNextFrame);
    if (btnTimelineNext) btnTimelineNext.addEventListener('click', stepStudioNextFrame);

    if (dom.timelineFramesStrip) {
      dom.timelineFramesStrip.addEventListener('click', (e) => {
        if (e.target.closest('.timeline-mini-btn')) return;
        const card = e.target.closest('.timeline-frame-card');
        if (!card) return;
        const idx = parseInt(card.getAttribute('data-idx'), 10);
        if (!isNaN(idx)) {
          selectStudioFrame(idx);
        }
      });
    }

    if (dom.btnTimelineAddFrame) {
      dom.btnTimelineAddFrame.addEventListener('click', () => {
        openFramePickerModal();
      });
    }

    if (dom.btnCloseFramePicker) dom.btnCloseFramePicker.addEventListener('click', closeFramePickerModal);
    if (dom.btnCancelFramePicker) dom.btnCancelFramePicker.addEventListener('click', closeFramePickerModal);
    if (dom.modalFramePicker) {
      dom.modalFramePicker.addEventListener('click', (e) => {
        if (e.target === dom.modalFramePicker) closeFramePickerModal();
      });
    }
    if (dom.framePickerRowFilter) {
      dom.framePickerRowFilter.addEventListener('change', renderFramePickerCards);
    }
    if (dom.framePickerSearch) {
      dom.framePickerSearch.addEventListener('input', renderFramePickerCards);
    }
    if (dom.btnFramePickerAddManual && dom.framePickerManualId) {
      dom.btnFramePickerAddManual.addEventListener('click', () => {
        const val = dom.framePickerManualId.value.trim();
        if (!val) return;
        if (state.doc && state.doc.cells[val]) {
          appendCellToActiveAnimation(val);
        } else {
          showToast(`Cell "${val}" does not exist in sprite sheet.`, 'error');
        }
      });
    }

    // Cell Editor frame name & animation tagging
    if (dom.cellAnimSelect) {
      dom.cellAnimSelect.addEventListener('change', (e) => {
        const cell = state.getActiveCell();
        if (cell) {
          assignCellToAnimation(cell.id, e.target.value);
        }
      });
    }

    if (dom.cellDirSelect) {
      dom.cellDirSelect.addEventListener('change', (e) => {
        const cell = state.getActiveCell();
        if (cell) {
          cell.direction = e.target.value;
          triggerEventAutosave();
        }
      });
    }

    // Primary & Secondary Color Swatch Pair (Click or 'X' to Swap)
    const colorPair = document.querySelector('.color-indicator-pair');
    if (colorPair) {
      colorPair.style.cursor = 'pointer';
      colorPair.addEventListener('click', () => {
        const tmp = state.primaryColor;
        state.primaryColor = state.secondaryColor;
        state.secondaryColor = tmp;
        updateColorUI();
        showToast('Swapped Primary / Secondary Colors (X)');
      });
    }

    // Color Pickers
    if (dom.colorPickerInput) {
      dom.colorPickerInput.addEventListener('input', (e) => {
        state.primaryColor = e.target.value;
        updateColorUI();
      });
    }

    if (dom.btnAddColor) {
      dom.btnAddColor.addEventListener('click', () => {
        if (!state.doc) return;
        const newColor = state.primaryColor;
        const exists = Object.values(state.doc.palette).includes(newColor);
        if (!exists) {
          const nextId = Object.keys(state.doc.palette).length + 1;
          state.doc.palette[nextId] = newColor;
          renderPalette();
          triggerEventAutosave();
          showToast(`Added ${newColor} to palette!`, 'success');
        }
      });
    }

    if (dom.paletteSelect) {
      dom.paletteSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === '__new_preset__') {
          promptAndSavePalettePreset();
          return;
        }

        if (val.startsWith('custom_')) {
          const key = val.replace('custom_', '');
          const customPalettes = loadCustomPalettes();
          const item = customPalettes[key];
          if (item && item.colors && state.doc) {
            state.beginStroke();
            state.doc.palette = {};
            item.colors.forEach((col, idx) => {
              state.doc.palette[idx + 1] = col;
            });
            state.endStroke(`Load Palette "${item.name}"`);
            renderPalette();
            triggerEventAutosave();
            showToast(`Loaded palette: "${item.name}" (${item.colors.length} colors)!`, 'success');
          }
          return;
        }

        if (state.presetPalettes && state.presetPalettes[val] && state.doc) {
          state.beginStroke();
          state.doc.palette = {};
          state.presetPalettes[val].forEach((col, idx) => {
            state.doc.palette[idx + 1] = col;
          });
          state.endStroke(`Load Preset Palette "${val}"`);
          renderPalette();
          triggerEventAutosave();
          showToast(`Loaded palette: ${val}!`, 'success');
        }
      });
    }

    const btnSavePalPreset = document.getElementById('btn-save-palette-preset');
    if (btnSavePalPreset) {
      btnSavePalPreset.addEventListener('click', () => {
        promptAndSavePalettePreset();
      });
    }

    // Palette Generator from Artwork Controls
    const btnTogglePalGen = document.getElementById('btn-toggle-palette-gen');
    const palGenBody = document.getElementById('palette-gen-body');
    const palGenChevron = document.getElementById('palette-gen-chevron');
    const selPalGenMode = document.getElementById('select-palette-gen-mode');
    const grpPalGenMax = document.getElementById('group-palette-gen-max');
    const btnAnalyzeArtwork = document.getElementById('btn-analyze-artwork');
    const btnApplyAddPalette = document.getElementById('btn-apply-add-palette');
    const btnApplyReplacePalette = document.getElementById('btn-apply-replace-palette');

    if (btnTogglePalGen && palGenBody) {
      btnTogglePalGen.addEventListener('click', () => {
        const isCollapsed = palGenBody.classList.toggle('hidden');
        if (palGenChevron) {
          palGenChevron.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
        }
      });
    }

    if (selPalGenMode && grpPalGenMax) {
      selPalGenMode.addEventListener('change', () => {
        grpPalGenMax.classList.toggle('hidden', selPalGenMode.value !== 'reduce');
      });
    }

    let detectedArtworkColors = [];

    if (btnAnalyzeArtwork) {
      btnAnalyzeArtwork.addEventListener('click', () => {
        if (!state.doc) return;
        const sourceSelect = document.getElementById('select-palette-gen-source');
        const sourceMode = sourceSelect ? sourceSelect.value : 'active-cell';
        const isReduce = selPalGenMode ? selPalGenMode.value === 'reduce' : false;
        const inputMax = document.getElementById('input-palette-gen-max');
        const maxLimit = inputMax ? parseInt(inputMax.value, 10) || 16 : 16;

        const colorFreq = {};
        const targetCells = [];

        if (sourceMode === 'active-cell') {
          const targetId = selectedGridCellId || state.activeCellId;
          const { r, c } = getCellRowCol(targetId);
          const cell = state.doc.cells[targetId] || getCellAtGrid(state.doc, r, c);
          if (cell) {
            targetCells.push(cell);
          } else {
            showToast('No active cell selected to analyze.', 'info');
            return;
          }
        } else {
          for (const cid in state.doc.cells) {
            targetCells.push(state.doc.cells[cid]);
          }
        }

        for (const cell of targetCells) {
          if (!cell || !cell.pixels) continue;
          for (const coord in cell.pixels) {
            const raw = cell.pixels[coord];
            if (!raw || raw === 'transparent' || raw === '#00000000') continue;
            const norm = raw.toLowerCase();
            colorFreq[norm] = (colorFreq[norm] || 0) + 1;
          }
        }

        const sorted = Object.keys(colorFreq).sort((a, b) => colorFreq[b] - colorFreq[a]);
        if (sorted.length === 0) {
          showToast('No painted pixels found in selected source.', 'info');
          return;
        }

        detectedArtworkColors = isReduce ? sorted.slice(0, maxLimit) : sorted;

        const resultsEl = document.getElementById('palette-gen-results');
        const countEl = document.getElementById('palette-gen-count');
        const previewEl = document.getElementById('palette-gen-preview-swatches');

        if (resultsEl) resultsEl.classList.remove('hidden');
        if (countEl) countEl.textContent = `Detected: ${detectedArtworkColors.length} unique color(s)`;
        if (previewEl) {
          previewEl.innerHTML = '';
          detectedArtworkColors.forEach(hex => {
            const sw = document.createElement('div');
            sw.className = 'palette-swatch';
            sw.style.backgroundColor = hex;
            sw.title = `${hex} (${colorFreq[hex] || 0} px)`;
            sw.addEventListener('click', () => {
              state.primaryColor = hex;
              updateColorUI();
            });
            previewEl.appendChild(sw);
          });
        }
        showToast(`Analyzed: detected ${detectedArtworkColors.length} color(s)!`, 'success');
      });
    }

    if (btnApplyAddPalette) {
      btnApplyAddPalette.addEventListener('click', () => {
        if (!state.doc || detectedArtworkColors.length === 0) {
          showToast('Please analyze artwork first.', 'info');
          return;
        }
        if (!state.doc.palette) state.doc.palette = {};
        const existingColors = new Set(Object.values(state.doc.palette).map(c => (c || '').toLowerCase()));
        let addedCount = 0;

        state.beginStroke();
        detectedArtworkColors.forEach(hex => {
          if (!existingColors.has(hex.toLowerCase())) {
            let nextKey = 1;
            while (state.doc.palette[nextKey]) nextKey++;
            state.doc.palette[nextKey] = hex;
            existingColors.add(hex.toLowerCase());
            addedCount++;
          }
        });

        state.endStroke(`Add ${addedCount} Colors to Palette`);
        triggerEventAutosave();
        renderPalette();
        showToast(addedCount > 0 ? `Added ${addedCount} new color(s) to palette!` : 'All detected colors already in palette.', addedCount > 0 ? 'success' : 'info');
      });
    }

    if (btnApplyReplacePalette) {
      btnApplyReplacePalette.addEventListener('click', () => {
        if (!state.doc || detectedArtworkColors.length === 0) {
          showToast('Please analyze artwork first.', 'info');
          return;
        }
        if (!confirm(`Replace current palette with ${detectedArtworkColors.length} detected colors? Existing cell pixels will be preserved and mapped to the new palette.`)) return;

        state.beginStroke();
        const newPalette = {};
        detectedArtworkColors.forEach((hex, i) => {
          newPalette[i + 1] = hex;
        });
        state.doc.palette = newPalette;

        state.endStroke(`Replace Palette from Artwork (${detectedArtworkColors.length} colors)`);
        triggerEventAutosave();
        renderPalette();
        showToast(`Palette replaced with ${detectedArtworkColors.length} colors!`, 'success');
      });
    }

    // Action Toolbar buttons
    for (const direction of ['center', 'left', 'right', 'top', 'bottom']) {
      bindAction('btn-align-' + direction, () => {
        const cell = state.getActiveCell();
        if (!cell) return;
        commitFloatingSelection();
        const target = getSelectionTarget(cell);
        if (!Tools.alignRaster(target, cell.size || state.doc.meta.cellSize, direction)) return;
        state.syncCellComposite(cell.id);
        state.saveSnapshot('Align ' + direction);
        triggerEventAutosave();
        refreshAll();
      });
    }

    bindAction('btn-flip-h', () => {
      if (state.selection || (floatingSelectionPixels && floatingOriginalSel)) {
        executeSelectionFlip(true);
      } else {
        const cell = state.getActiveCell();
        if (cell && state.doc) {
          Tools.flipHorizontal(cell, state.doc.meta.cellSize.w);
          state.saveSnapshot('Flip Cell Horizontal');
          triggerEventAutosave();
          refreshAll();
        }
      }
    });

    bindAction('btn-flip-v', () => {
      if (state.selection || (floatingSelectionPixels && floatingOriginalSel)) {
        executeSelectionFlip(false);
      } else {
        const cell = state.getActiveCell();
        if (cell && state.doc) {
          Tools.flipVertical(cell, state.doc.meta.cellSize.h);
          state.saveSnapshot('Flip Cell Vertical');
          triggerEventAutosave();
          refreshAll();
        }
      }
    });

    bindAction('btn-rotate-90', () => {
      executeSelectionRotate();
    });

    bindAction('btn-sheet-flip-h', () => {
      if (!state.doc) return;
      const targetCellId = selectedGridCellId || state.activeCellId || 'cell_0_0';
      const { r } = getCellRowCol(targetCellId);
      flipRow(r, true);
    });

    bindAction('btn-sheet-flip-v', () => {
      if (!state.doc) return;
      const targetCellId = selectedGridCellId || state.activeCellId || 'cell_0_0';
      const { r } = getCellRowCol(targetCellId);
      flipRow(r, false);
    });

    bindAction('btn-sheet-align-center', () => {
      if (state.doc) {
        for (const cid in state.doc.cells) {
          Tools.centerContent(state.doc.cells[cid], state.doc.meta.cellSize.w, state.doc.meta.cellSize.h);
        }
        state.saveSnapshot('Center All Cells');
        triggerEventAutosave();
        refreshAll();
      }
    });

    bindAction('btn-symmetry-toggle', (btn) => {
      state.symmetry = !state.symmetry;
      btn.classList.toggle('active', state.symmetry);
      renderCellEditor();
      updateStatusBarCoords(null, null);
      showToast(`Symmetry mode: ${state.symmetry ? 'ON (S)' : 'OFF (S)'}`);
    });

    bindAction('btn-toggle-sym-v', (btn) => {
      state.symmetryVertical = !state.symmetryVertical;
      btn.classList.toggle('active', state.symmetryVertical);
      renderCellEditor();
      updateStatusBarCoords(null, null);
    });
    bindAction('btn-undo', () => restoreEditorHistory('undo'));
    bindAction('btn-redo', () => restoreEditorHistory('redo'));

    bindAction('btn-grid-lines-toggle', (btn) => {
      state.showGridLines = !state.showGridLines;
      btn.classList.toggle('active', state.showGridLines);
      renderCellEditor();
    });

    bindAction('btn-clear-cell', executeSelectionDelete);

    // Zoom buttons
    const stepCellZoom = direction => {
      if (!state.getActiveCell()) return;
      const { w, h } = state.doc.meta.cellSize;
      const zoom = NoiraViewport.stepArtworkZoom(state.cellZoom, direction, w, h);
      if (zoom === state.cellZoom) return;
      state.cellZoom = zoom;
      renderCellEditor(true);
      renderCellRulers();
      renderCellOverlay();
      updateStatusBarCoords(null, null);
    };
    bindAction('btn-zoom-in', () => stepCellZoom(1));
    bindAction('btn-zoom-out', () => stepCellZoom(-1));
    bindAction('btn-cell-zoom-fit', fitCellCanvas);

    // Top Header File Actions (Desktop-native)
    bindAction('btn-new-file', openNewFileModal);
    bindAction('btn-open-file', openFileNative);
    bindAction('btn-save-pix2', () => saveFileNative(false));
    bindAction('btn-save-as-pix2', () => saveFileNative(true));

    // Empty Workspace Actions
    bindAction('btn-empty-new-project', openNewFileModal);
    bindAction('btn-empty-open-file', openFileNative);
    bindAction('btn-empty-load-sample', () => loadSampleProject('ghost'));
    bindAction('btn-empty-load-reaper', () => loadSampleProject('reaper'));

    const studioEmptyDropzone = document.getElementById('studio-empty-dropzone');
    if (studioEmptyDropzone) {
      studioEmptyDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        studioEmptyDropzone.classList.add('drag-over');
      });
      studioEmptyDropzone.addEventListener('dragleave', () => {
        studioEmptyDropzone.classList.remove('drag-over');
      });
      studioEmptyDropzone.addEventListener('drop', () => {
        studioEmptyDropzone.classList.remove('drag-over');
      });
    }

    function copyCurrentPathToClipboard() {
      const full = getProjectFullPath();
      if (full) {
        navigator.clipboard.writeText(full).then(() => {
          const hasRoot = Boolean(localStorage.getItem('noiradix_project_root_dir'));
          if (hasRoot) {
            showToast(`Copied full path: "${full}"`, 'success');
          } else {
            showToast(`Copied file: "${full}" (Tip: Click folder icon to set project folder for full absolute path)`, 'info');
          }
        }).catch(() => {
          prompt('File path (Press Ctrl+C to copy):', full);
        });
      } else {
        showToast('Project is in memory draft. Click Save to save to disk.', 'info');
      }
    }

    function promptConfigureProjectRoot() {
      const currentRoot = localStorage.getItem('noiradix_project_root_dir') || '';
      const userPath = prompt(
        'Set Project Base Directory (Optional):\nWeb browser sandbox hides absolute OS disk paths for security.\nEnter folder path (e.g. C:/Users/OS/Downloads or D:/ghoster) if you want 1-click full absolute path copying:',
        currentRoot
      );
      if (userPath !== null) {
        const trimmed = userPath.trim();
        if (trimmed) {
          localStorage.setItem('noiradix_project_root_dir', trimmed);
          updateFileStatusUI();
          updateProjectTitleUI();
          showToast(`Project root folder set to: "${trimmed}"`, 'success');
        } else {
          localStorage.removeItem('noiradix_project_root_dir');
          updateFileStatusUI();
          updateProjectTitleUI();
          showToast('Project root cleared (will copy file name only)', 'info');
        }
      }
    }

    const btnHeaderCopy = document.getElementById('btn-header-copy-path');
    if (btnHeaderCopy) {
      btnHeaderCopy.addEventListener('click', copyCurrentPathToClipboard);
    }

    const filePathPill = document.getElementById('file-path-pill');
    if (filePathPill) {
      filePathPill.addEventListener('click', copyCurrentPathToClipboard);
    }

    const btnReveal = document.getElementById('btn-reveal-explorer');
    if (btnReveal) {
      btnReveal.addEventListener('click', (e) => {
        if (e.shiftKey || !localStorage.getItem('noiradix_project_root_dir')) {
          promptConfigureProjectRoot();
        } else {
          copyCurrentPathToClipboard();
        }
      });
      btnReveal.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        promptConfigureProjectRoot();
      });
    }

    bindAction('btn-reload-file', handleManualFileReload);

    const previewViewport = document.getElementById('mini-preview-viewport');
    const savedPreviewHeight = Number(localStorage.getItem('noiradix_preview_height'));
    if (savedPreviewHeight >= 120) previewViewport.style.height = savedPreviewHeight + 'px';
    window.NoiraViewport.bindInspectorResize(document.getElementById('mini-preview-resizer'), previewViewport,
      120, 190, 'noiradix_preview_height', undefined, true);
    new ResizeObserver(() => {
      if (miniPreviewScale === 'fit') updateMiniPreviewZoom();
    }).observe(previewViewport);
    bindAction('preview-zoom-out', () => stepMiniPreviewZoom(-1));
    bindAction('preview-zoom-in', () => stepMiniPreviewZoom(1));
    bindAction('preview-zoom-fit', () => {
      miniPreviewScale = 'fit';
      updateMiniPreviewZoom();
    });
    previewViewport.addEventListener('wheel', event => {
      if (event.ctrlKey || event.shiftKey || !event.deltaY) return;
      event.preventDefault();
      stepMiniPreviewZoom(event.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    // Floating Animation Preview Zoom level buttons
    document.querySelectorAll('#anim-zoom-group [data-scale]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#anim-zoom-group [data-scale]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const scaleVal = btn.dataset.scale;
        if (animPlayer) {
          animPlayer.scale = (scaleVal === 'fit') ? 'fit' : parseInt(scaleVal, 10);
          animPlayer.render();
        }
      });
    });

    // Mouse wheel zoom on floating preview canvas wrapper
    const animCanvasWrapper = document.getElementById('anim-canvas-wrapper');
    if (animCanvasWrapper) {
      animCanvasWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!animPlayer) return;
        const scales = [4, 6, 8, 10, 'fit'];
        let curIdx = scales.indexOf(animPlayer.scale);
        if (curIdx === -1) curIdx = 2; // default 8
        if (e.deltaY < 0 && curIdx < scales.length - 1) {
          curIdx++;
        } else if (e.deltaY > 0 && curIdx > 0) {
          curIdx--;
        }
        const nextScale = scales[curIdx];
        animPlayer.scale = nextScale;
        document.querySelectorAll('#anim-zoom-group [data-scale]').forEach(b => {
          b.classList.toggle('active', b.dataset.scale === String(nextScale));
        });
        animPlayer.render();
      }, { passive: false });

      animCanvasWrapper.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (!animPlayer) return;
        const nextScale = (animPlayer.scale === 'fit') ? 8 : 'fit';
        animPlayer.scale = nextScale;
        document.querySelectorAll('#anim-zoom-group [data-scale]').forEach(b => {
          b.classList.toggle('active', b.dataset.scale === String(nextScale));
        });
        animPlayer.render();
      });
    }

    // Animation Studio Viewport Zoom Level buttons
    document.querySelectorAll('#studio-zoom-group [data-scale]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#studio-zoom-group [data-scale]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const scaleVal = btn.dataset.scale;
        if (studioAnimPlayer) {
          studioAnimPlayer.scale = (scaleVal === 'fit') ? 'fit' : parseInt(scaleVal, 10);
          studioAnimPlayer.render();
        }
      });
    });

    // Animation Studio Viewport mouse wheel zoom & free panning
    const animStudioViewport = document.getElementById('anim-studio-viewport');
    const animStudioContainer = document.getElementById('anim-studio-canvas-container');
    let studioPanX = 0, studioPanY = 0;
    let isStudioPanning = false;
    let studioDragStartX = 0, studioDragStartY = 0;
    let studioDragStartPanX = 0, studioDragStartPanY = 0;

    function applyStudioPan() {
      if (!animStudioContainer) return;
      if (studioPanX === 0 && studioPanY === 0) {
        animStudioContainer.style.transform = '';
      } else {
        animStudioContainer.style.transform = `translate(${studioPanX}px, ${studioPanY}px)`;
      }
    }

    window.centerStudioCanvas = function() {
      studioPanX = 0;
      studioPanY = 0;
      applyStudioPan();
    };

    if (animStudioViewport) {
      animStudioViewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!studioAnimPlayer) return;
        const scales = [8, 12, 16, 20, 'fit'];
        let curIdx = scales.indexOf(studioAnimPlayer.scale);
        if (curIdx === -1) curIdx = 2; // default 16
        if (e.deltaY < 0 && curIdx < scales.length - 1) {
          curIdx++;
        } else if (e.deltaY > 0 && curIdx > 0) {
          curIdx--;
        }
        const nextScale = scales[curIdx];
        studioAnimPlayer.scale = nextScale;
        document.querySelectorAll('#studio-zoom-group [data-scale]').forEach(b => {
          b.classList.toggle('active', b.dataset.scale === String(nextScale));
        });
        studioAnimPlayer.render();
      }, { passive: false });

      animStudioViewport.addEventListener('dblclick', (e) => {
        if (e.target === animStudioViewport || e.target === animStudioContainer || e.target.id === 'studio-anim-canvas') {
          e.preventDefault();
          if (!studioAnimPlayer) return;
          const nextScale = (studioAnimPlayer.scale === 'fit') ? 16 : 'fit';
          studioAnimPlayer.scale = nextScale;
          studioPanX = 0;
          studioPanY = 0;
          applyStudioPan();
          document.querySelectorAll('#studio-zoom-group [data-scale]').forEach(b => {
            b.classList.toggle('active', b.dataset.scale === String(nextScale));
          });
          studioAnimPlayer.render();
        }
      });

      // Free 360° Panning in Animation Studio Viewport
      animStudioViewport.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('#studio-zoom-group') || e.target.closest('button')) return;
        isStudioPanning = true;
        studioDragStartX = e.clientX;
        studioDragStartY = e.clientY;
        studioDragStartPanX = studioPanX;
        studioDragStartPanY = studioPanY;
        animStudioViewport.classList.add('is-panning');
        document.body.style.cursor = 'grabbing';
      });

      window.addEventListener('pointermove', (e) => {
        if (isStudioPanning) {
          const dx = e.clientX - studioDragStartX;
          const dy = e.clientY - studioDragStartY;
          studioPanX = Math.round(studioDragStartPanX + dx);
          studioPanY = Math.round(studioDragStartPanY + dy);
          applyStudioPan();
        }
      });

      window.addEventListener('pointerup', () => {
        if (isStudioPanning) {
          isStudioPanning = false;
          animStudioViewport.classList.remove('is-panning');
          document.body.style.cursor = '';
        }
      });
    }

    // Generic Horizontal Drag-to-Scroll & Wheel-Scroll Helper
    const { enableHorizontalDragScroll } = window.NoiraViewport;
    enableHorizontalDragScroll(document.querySelector('.cell-top-bar'));
    window.NoiraViewport.enableVerticalDragScroll(document.getElementById('studio-tool-rail'),
      'is-dragging', { dragFromButtons: true });
    enableHorizontalDragScroll(document.querySelector('.structure-action-group'), 'is-dragging', { dragFromButtons: true });
    enableHorizontalDragScroll(document.querySelector('.timeline-header'));
    enableHorizontalDragScroll(document.getElementById('timeline-frames-strip'));
    enableHorizontalDragScroll(document.getElementById('slice-viewport-header'));
    enableHorizontalDragScroll(document.getElementById('import-slices-header'));
    document.querySelectorAll('.view-sub-toolbar').forEach(tb => enableHorizontalDragScroll(tb));

    bindAction('btn-export-atlas', exportAtlasPng);
    bindAction('btn-load-demo', openDemoChooserModal);
    bindAction('btn-load-demo-ghost', () => {
      loadSampleProject('ghost');
      closeDemoChooserModal();
    });
    bindAction('btn-load-demo-reaper', () => {
      loadSampleProject('reaper');
      closeDemoChooserModal();
    });
    bindAction('btn-close-demo-chooser', closeDemoChooserModal);
    bindAction('btn-cancel-demo-chooser', closeDemoChooserModal);
    dom.modalDemoChooser?.addEventListener('click', (e) => {
      if (e.target === dom.modalDemoChooser) closeDemoChooserModal();
    });
    bindAction('btn-import-code', openImportCodeModal);

    // Code Editor Buttons
    if (dom.btnApplyCode) dom.btnApplyCode.addEventListener('click', applyCodeToDoc);
    if (dom.btnCopyAiPrompt) dom.btnCopyAiPrompt.addEventListener('click', copyAiPrompt);
    if (dom.btnCopyRawCode) dom.btnCopyRawCode.addEventListener('click', copyRawPix2Code);
    if (dom.btnToggleEditCode) dom.btnToggleEditCode.addEventListener('click', toggleCodeEditMode);
    if (dom.codeTextarea) {
      dom.codeTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = dom.codeTextarea.selectionStart;
          const end = dom.codeTextarea.selectionEnd;
          const val = dom.codeTextarea.value;
          if (e.shiftKey) {
            if (val.substring(start - 2, start) === '  ') {
              dom.codeTextarea.value = val.substring(0, start - 2) + val.substring(end);
              dom.codeTextarea.selectionStart = dom.codeTextarea.selectionEnd = Math.max(0, start - 2);
            }
          } else {
            dom.codeTextarea.value = val.substring(0, start) + '  ' + val.substring(end);
            dom.codeTextarea.selectionStart = dom.codeTextarea.selectionEnd = start + 2;
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          applyCodeToDoc();
        }
      });
    }
    if (dom.selectAiPromptMode) {
      dom.selectAiPromptMode.addEventListener('change', (e) => {
        updateAiGuidePane(e.target.value);
      });
    }

    if (dom.inputCellName) {
      dom.inputCellName.addEventListener('input', (e) => {
        const cell = state.getActiveCell();
        if (cell) {
          cell.name = e.target.value.trim() || cell.id;
          renderTabs();
          triggerEventAutosave();
        }
      });
    }

    if (dom.inputProjectTitle) {
      const commitRename = () => {
        if (!state.doc) return;
        const raw = dom.inputProjectTitle.value;
        const val = sanitizeSafeFilename(raw, '.pix2', currentFileName || 'untitled');

        if (currentFileHandle && currentFileHandle.name !== val) {
          // File has been renamed in UI: detach old handle so Save As triggers on next save
          currentFileHandle = null;
          clearPersistedFileHandle();
          localStorage.setItem('noiradix_session_type', 'draft');
        }

        currentFileName = val;
        currentFilePath = val;
        localStorage.setItem('noiradix_session_type', currentFileHandle ? 'disk' : 'draft');
        localStorage.setItem('noiradix_active_file_name', currentFileName);
        localStorage.setItem('noiradix_active_file_path', currentFilePath);

        // Sync doc.meta.title without .pix2 extension
        const baseTitle = val.replace(/\.pix2$/i, '').trim();
        state.doc.meta.title = baseTitle;

        dom.inputProjectTitle.value = val;
        setDirty(true);
        triggerEventAutosave();
        updateFileStatusUI();
        updateProjectTitleUI();
        showToast(`Project file set to: "${val}"`, 'success');
      };

      dom.inputProjectTitle.addEventListener('change', commitRename);
      dom.inputProjectTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          dom.inputProjectTitle.blur();
        }
      });
    }

    // Resolution preset buttons
    document.querySelectorAll('[data-res]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dims = btn.dataset.res.split('x').map(Number);
        setResolution(dims[0], dims[1]);
      });
    });

    // Floating Animation Controls
    bindAction('anim-play-pause', (btn) => {
      if (animPlayer.isPlaying) {
        animPlayer.stop();
        btn.innerHTML = '<i class="fa-solid fa-play"></i>';
      } else {
        animPlayer.start();
        btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      }
    });

    bindAction('anim-step-prev', () => {
      animPlayer.stepFrame(-1);
      animPlayer.render();
    });

    bindAction('anim-step-next', () => {
      animPlayer.stepFrame(1);
      animPlayer.render();
    });

    const fpsSlider = document.getElementById('anim-fps-slider');
    if (fpsSlider) {
      fpsSlider.addEventListener('input', (e) => {
        animPlayer.setFps(parseInt(e.target.value, 10));
        const label = document.getElementById('anim-fps-label');
        if (label) label.textContent = `${e.target.value} fps`;
      });
    }

    if (dom.animModeSelect) {
      dom.animModeSelect.addEventListener('change', (e) => {
        animPlayer.setMode(e.target.value);
        if (dom.animFloatingPanel) {
          dom.animFloatingPanel.classList.toggle('mode-4dir', e.target.value === '4dir');
        }
      });
    }

    if (dom.floatingAnimSelect) {
      dom.floatingAnimSelect.addEventListener('change', (e) => {
        animPlayer.setAnimation(e.target.value);
      });
    }

    document.querySelectorAll('[data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-dir]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        animPlayer.setDirection(btn.dataset.dir);
      });
    });
  }

  function bindAction(id, handler) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => handler(el));
    }
  }

  // ===========================================================================
  // KEYBOARD SHORTCUTS SUITE (Photoshop / Aseprite Standards)
  // ===========================================================================

  function restoreEditorHistory(direction) {
    if (floatingSelectionPixels) cancelFloatingSelection();
    state.selection = null;
    regionSelection.cancel();
    if (state[direction]()) {
      triggerEventAutosave();
      refreshAll();
    }
  }

  function bindKeyboardShortcuts() {
    window.addEventListener('pagehide', () => {
      if (floatingSelectionPixels) cancelFloatingSelection();
      persistAllProjectSessions();
    });
    window.addEventListener('beforeunload', (e) => {
      if (isDocumentDirty || (state.doc && !currentFileHandle && Object.keys(state.doc.cells).length > 0)) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Losing focus during a drag is equivalent to cancelling that gesture.
    // Do not leave lifted pixels detached from the artwork document.
    window.addEventListener('blur', () => {
      if (regionSelection.cancel()) renderCellOverlay();
      if (isMovingSelection || isScalingSelection || isRotatingSelection) {
        isPointerDown = false;
        cancelFloatingSelection();
      }
    });

    window.addEventListener('keydown', (e) => {
      const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      const key = e.key.toLowerCase();

      if (!isInputActive && key === 'enter' && floatingSelectionPixels) {
        e.preventDefault();
        commitFloatingSelection();
        refreshAll();
        renderCellOverlay();
        return;
      }

      // Save (Ctrl + S) & Save As (Ctrl + Shift + S) - Universal shortcut, active even inside inputs
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        if (isInputActive && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        saveFileNative(e.shiftKey);
        return;
      }

      // If user is actively typing in an input or textarea, skip single-key drawing tool shortcuts
      if (isInputActive) return;

      // Open (Ctrl + O)
      if ((e.ctrlKey || e.metaKey) && key === 'o') {
        e.preventDefault();
        openFileNative();
        return;
      }

      // New (Alt + N)
      if (e.altKey && key === 'n') {
        e.preventDefault();
        openNewFileModal();
        return;
      }

      // Import Code (Ctrl + I)
      if ((e.ctrlKey || e.metaKey) && key === 'i') {
        e.preventDefault();
        openImportCodeModal();
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
        e.preventDefault();
        restoreEditorHistory(key === 'y' || e.shiftKey ? 'redo' : 'undo');
        return;
      }

      // Reset Zoom & Frame (Ctrl + 0)
      if ((e.ctrlKey || e.metaKey) && key === '0') {
        e.preventDefault();
        if (state.activeTabId === 'tab-grid-overview') {
          centerGridCanvas();
          showToast('Grid centered (Ctrl+0)');
          return;
        }
        if (state.activeTabId === 'tab-anim-studio') {
          if (typeof centerStudioCanvas === 'function') centerStudioCanvas();
          showToast('Animation Studio centered (Ctrl+0)');
          return;
        }
        if (state.activeTabId === 'tab-grid-overview') {
          centerGridCanvas();
          showToast('Grid centered (Ctrl+0)');
          return;
        }
        if (state.activeTabId === 'tab-anim-studio') {
          if (typeof centerStudioCanvas === 'function') centerStudioCanvas();
          showToast('Animation Studio centered (Ctrl+0)');
          return;
        }
        if (!state.getActiveCell()) return;
        const { w, h } = state.doc.meta.cellSize;
        state.cellZoom = Math.min(24, NoiraViewport.artworkZoomLimit(w, h));
        centerCellCanvas();
        renderCellEditor();
        renderCellRulers();
        renderCellOverlay();
        updateStatusBarCoords(null, null);
        showToast(`Zoom reset to ${NoiraViewport.formatArtworkZoom(state.cellZoom)} and centered (Ctrl+0)`);
        return;
      }

      // Reload from disk (Ctrl + Shift + R)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'r') {
        e.preventDefault();
        handleManualFileReload();
        return;
      }

      // Copy (Ctrl + C)
      if ((e.ctrlKey || e.metaKey) && key === 'c') {
        if (state.activeTabId === 'tab-grid-overview' && selectedGridCellId) {
          e.preventDefault();
          executeCopyGridCell(selectedGridCellId);
          return;
        } else if (state.activeTabId.startsWith('cell_') || state.getActiveCell()) {
          e.preventDefault();
          executeSelectionCopy();
          return;
        }
      }

      // Cut (Ctrl + X)
      if ((e.ctrlKey || e.metaKey) && key === 'x') {
        if (state.activeTabId === 'tab-grid-overview' && selectedGridCellId) {
          e.preventDefault();
          executeCopyGridCell(selectedGridCellId);
          clearGridCell(selectedGridCellId);
          return;
        } else if (state.activeTabId.startsWith('cell_') || state.selection) {
          e.preventDefault();
          executeSelectionCut();
          return;
        }
      }

      // Paste (Ctrl + V)
      if ((e.ctrlKey || e.metaKey) && key === 'v') {
        if (state.activeTabId === 'tab-grid-overview' && selectedGridCellId) {
          e.preventDefault();
          executePasteGridCell(selectedGridCellId);
          return;
        } else if (state.activeTabId.startsWith('cell_') || state.getActiveCell()) {
          e.preventDefault();
          executeSelectionPaste();
          return;
        }
      }

      // Select All (Ctrl + A)
      if ((e.ctrlKey || e.metaKey) && key === 'a') {
        if (state.activeTabId.startsWith('cell_') || state.getActiveCell()) {
          e.preventDefault();
          executeSelectAll();
          return;
        }
      }

      // Close About Modal on Escape
      if (e.key === 'Escape' && dom.modalAboutStudio && !dom.modalAboutStudio.classList.contains('hidden')) {
        e.preventDefault();
        closeAboutModal();
        return;
      }

      // Close Demo Chooser Modal on Escape
      if (e.key === 'Escape' && dom.modalDemoChooser && !dom.modalDemoChooser.classList.contains('hidden')) {
        e.preventDefault();
        closeDemoChooserModal();
        return;
      }
      if (e.key === 'Escape' && state.activeTabId === 'tab-import-slice') return;

      // Deselect (Ctrl + D) or (Escape)
      if (((e.ctrlKey || e.metaKey) && key === 'd') || e.key === 'Escape') {
        e.preventDefault();
        if (e.key === 'Escape' && regionSelection.cancel()) {
          renderCellOverlay();
          return;
        }
        if (e.key === 'Escape' && state.isolatedNodeId) {
          const selectedId = state.isolatedNodeId;
          const activeCell = state.getActiveCell();
          if (floatingSelectionPixels) cancelFloatingSelection();
          if (activeCell) exitRegionIsolation(activeCell, selectedId);
          else state.isolatedNodeId = null;
          selectTool('region-select');
          showToast('Exited Isolation Mode');
          refreshAll();
          return;
        }
        if (state.currentTool === 'region-select' && !state.selection) {
          regionSelection.reset();
          renderCellOverlay();
          return;
        }
        if (e.key === 'Escape' && (isScalingSelection || isRotatingSelection)) {
          cancelFloatingSelection();
          showToast('Selection transform cancelled; original pixels restored');
          return;
        }
        if (e.key === 'Escape') {
          cancelFloatingSelection();
          showToast('Selection cancelled; original pixels restored');
        } else {
          executeDeselect();
        }
        closeContextMenu();
        closeGridContextMenu();
        return;
      }

      // Delete (Del / Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.activeTabId === 'tab-grid-overview' && selectedGridCellId) {
          e.preventDefault();
          clearGridCell(selectedGridCellId);
          return;
        } else if (state.selection) {
          e.preventDefault();
          executeSelectionDelete();
          return;
        }
      }

      // Single-Key Shortcuts (Guarded against modifier keys)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        // Swap Colors (X)
        if (key === 'x') {
          const tmp = state.primaryColor;
          state.primaryColor = state.secondaryColor;
          state.secondaryColor = tmp;
          updateColorUI();
          showToast('Swapped Primary / Secondary Colors (X)');
          return;
        }

        // Reset Default Colors (D)
        if (key === 'd') {
          state.primaryColor = '#57546f';
          state.secondaryColor = '#ffffff';
          updateColorUI();
          showToast('Reset Default Colors (D)');
          return;
        }

        // Tool shortcuts
        if (key === 'b') selectTool('pen');
        else if (key === 'e') selectTool('eraser');
        else if (key === 'i') selectTool('picker');
        else if (key === 'g') selectTool('bucket');
        else if (key === 'l') selectTool('line');
        else if (key === 'u') selectTool('rect');
        else if (key === 'v' && e.shiftKey) document.getElementById('btn-toggle-sym-v').click();
        else if (key === 'h' && e.shiftKey) document.getElementById('btn-symmetry-toggle').click();
        else if (key === 'v' || key === 'm') selectTool('select');
        else if (key === 'h') selectTool('pan');
        else if (key === 'r') {
          if (state.selection) {
            executeSelectionRotate();
          } else {
            selectTool('region-select');
          }
        }
        else if (key === 's') {
          const symBtn = document.getElementById('btn-symmetry-toggle');
          if (symBtn) symBtn.click();
        }
      }

      // Animation Studio keyboard controls (Space: Play/Pause, Left/Right: Prev/Next frame)
      if (state.activeTabId === 'tab-anim-studio') {
        if (e.code === 'Space' || key === ' ') {
          e.preventDefault();
          if (studioAnimPlayer) {
            if (studioAnimPlayer.isPlaying) studioAnimPlayer.stop();
            else studioAnimPlayer.start();
            updateStudioPlayButtonUI();
          }
          return;
        }
        if (e.key === 'ArrowLeft' || key === '[' || key === ',') {
          e.preventDefault();
          if (studioAnimPlayer) {
            if (studioAnimPlayer.isPlaying) {
              studioAnimPlayer.stop();
              updateStudioPlayButtonUI();
            }
            studioAnimPlayer.stepFrame(-1);
            studioAnimPlayer.render();
            selectStudioFrame(studioAnimPlayer.currentFrameIdx);
          }
          return;
        }
        if (e.key === 'ArrowRight' || key === ']' || key === '.') {
          e.preventDefault();
          if (studioAnimPlayer) {
            if (studioAnimPlayer.isPlaying) {
              studioAnimPlayer.stop();
              updateStudioPlayButtonUI();
            }
            studioAnimPlayer.stepFrame(1);
            studioAnimPlayer.render();
            selectStudioFrame(studioAnimPlayer.currentFrameIdx);
          }
          return;
        }
      }

      // Arrow keys nudge
      const cell = state.getActiveCell();
      if (cell && state.doc) {
        if (state.currentTool === 'region-select' && e.key.startsWith('Arrow')) {
          e.preventDefault();
          if (regionSelection.nudge(cell, state.activeLayerId, state.isolatedNodeId,
            cell.size || state.doc.meta.cellSize, e.key, () => state.beginStroke())) {
            state.syncCellComposite(cell.id);
            state.endStroke('Nudge regions');
            triggerEventAutosave();
            refreshAll();
          }
          return;
        }
        const cw = state.doc.meta.cellSize.w;
        const ch = state.doc.meta.cellSize.h;
        if (e.key === 'ArrowUp') { Tools.nudge(cell, 0, -1, cw, ch); triggerEventAutosave(); refreshAll(); }
        else if (e.key === 'ArrowDown') { Tools.nudge(cell, 0, 1, cw, ch); triggerEventAutosave(); refreshAll(); }
        else if (e.key === 'ArrowLeft') { Tools.nudge(cell, -1, 0, cw, ch); triggerEventAutosave(); refreshAll(); }
        else if (e.key === 'ArrowRight') { Tools.nudge(cell, 1, 0, cw, ch); triggerEventAutosave(); refreshAll(); }
      }
    });
  }

  function selectTool(name) {
    const btn = document.querySelector(`[data-tool="${name}"]`);
    if (btn) btn.click();
  }

  function showToast(msg, type = 'info') {
    let toast = document.getElementById('studio-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'studio-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `toast visible toast-${type}`;
    setTimeout(() => {
      toast.className = 'toast';
    }, 2800);
  }
})();
