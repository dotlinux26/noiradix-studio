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

  let animPlayer = null;
  let studioAnimPlayer = null;
  let selectedGridCellId = 'cell_0_0';
  let activeStudioClipId = 'walk_down';

  // Desktop File & Autosave State
  let currentFileHandle = null;
  let currentFileName = 'player_wispling.pix2';
  let currentFilePath = null;
  let isDocumentDirty = false;
  let periodicAutosaveTimer = null;
  let debouncedAutosaveTimer = null;
  let miniPreviewScale = 6;

  // Real-Time File Watcher & External Hot-Reload
  let lastKnownFileModified = 0;
  let lastSavedContent = '';
  let isExternalReloading = false;
  let pendingExternalConflict = null;
  let fileWatcherHeartbeatTimer = null;

  // Floating preview & marquee animation state
  let userClosedFloatingPreview = false;
  let marqueeAnimFrameId = null;

  // DOM Elements cache
  const dom = {};

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
    initDomCache();
    initTheme();
    initAnimationPlayers();
    initDraggablePanel();
    initFloatingAboutBubble();
    initHeaderScroll();
    bindEvents();
    bindKeyboardShortcuts();
    initCanvasPanningAndZoom();
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
    updateAutosaveIndicator('saved', Date.now());
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
    dom.views = {
      grid: document.getElementById('view-grid-overview'),
      anim: document.getElementById('view-anim-studio'),
      cell: document.getElementById('view-cell-editor'),
      code: document.getElementById('view-code-editor')
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

    containers.forEach(container => {
      if (!container) return;

      // 1. Mouse-Wheel horizontal scroll
      container.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      }, { passive: false });

      // 2. Drag-to-pan by holding left click on background
      let isDown = false;
      let startX = 0;
      let scrollStart = 0;

      container.addEventListener('mousedown', (e) => {
        if (e.target.closest('input, button, select, .chip-btn, .pill-btn, .file-path-pill, .studio-tab')) {
          return;
        }
        isDown = true;
        container.classList.add('is-dragging');
        startX = e.pageX;
        scrollStart = container.scrollLeft;
      });

      window.addEventListener('mouseup', () => {
        if (isDown) {
          isDown = false;
          container.classList.remove('is-dragging');
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const dx = e.pageX - startX;
        container.scrollLeft = scrollStart - dx;
      });
    });
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

  function setDirty(dirty) {
    isDocumentDirty = dirty;
    const title = (state.doc ? state.doc.meta.title : 'NOIRADIX Studio') || 'Untitled';
    const fileName = currentFileName || (currentFileHandle ? currentFileHandle.name : null) || sanitizeSafeFilename(title, '.pix2', 'untitled');
    const isDirectDiskLinked = Boolean(currentFileHandle);

    document.title = (dirty || !isDirectDiskLinked)
      ? `● ${fileName} - NOIRADIX Studio`
      : `${fileName} - NOIRADIX Studio`;

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
      updateAutosaveIndicator('saved', Date.now());
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

    const isDirectDiskLinked = Boolean(currentFileHandle);

    if (status === 'saving') {
      pill.className = 'autosave-pill saving';
      pill.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> <span id="autosave-status-text">Saving...</span>';
    } else if (status === 'saved') {
      const timeStr = time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now';
      if (isDirectDiskLinked) {
        pill.className = 'autosave-pill saved';
        pill.innerHTML = `<i class="fa-solid fa-hard-drive"></i> <span id="autosave-status-text">Saved to Disk ${timeStr}</span>`;
        pill.title = `All changes automatically synchronized to disk file (${currentFileHandle.name}) at ${timeStr}.`;
      } else {
        pill.className = 'autosave-pill memory-draft';
        pill.innerHTML = `<i class="fa-solid fa-memory"></i> <span id="autosave-status-text">Memory Cached ${timeStr} (Unsaved to Disk)</span>`;
        pill.title = `Draft cached in browser temporary storage at ${timeStr}. Not yet saved to physical disk! Press Ctrl+S to save to disk.`;
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
    if (typeof commitFloatingSelection === 'function' && floatingSelectionPixels) {
      commitFloatingSelection();
    }
    try {
      const text = PIX2.serialize(state.doc);
      const now = Date.now();
      const snapshot = {
        timestamp: now,
        title: state.doc.meta.title || 'Untitled',
        fileName: currentFileName || 'new_sprite.pix2',
        data: text
      };
      localStorage.setItem('pix2_recovery_snapshot', JSON.stringify(snapshot));
      localStorage.setItem('pix2_draft_content', text);
      localStorage.setItem('noiradix_active_file_name', currentFileName || snapshot.fileName);

      // Direct write to disk file if linked to matching filename
      const isDirectDiskValid = currentFileHandle &&
                                'createWritable' in currentFileHandle &&
                                (!currentFileName || currentFileHandle.name.normalize('NFC') === currentFileName.normalize('NFC'));

      if (isDirectDiskValid) {
        try {
          let hasPerm = true;
          if (currentFileHandle.queryPermission) {
            const p = await currentFileHandle.queryPermission({ mode: 'readwrite' });
            hasPerm = (p === 'granted');
          }
          if (hasPerm) {
            const writable = await currentFileHandle.createWritable();
            await writable.write(text);
            await writable.close();
            lastSavedContent = text;
            try {
              const fresh = await currentFileHandle.getFile();
              lastKnownFileModified = fresh.lastModified;
            } catch (_) {}
            pendingExternalConflict = null;
            setDirty(false);
          }
        } catch (diskErr) {
          console.debug('Direct disk autosave skipped:', diskErr);
        }
      } else {
        setDirty(false);
      }

      updateAutosaveIndicator('saved', now);
    } catch (err) {
      console.warn('Autosave snapshot failed:', err);
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

  function loadDefaultProject() {
    if (window.DEFAULT_SAMPLE_PIX2) {
      try {
        const doc = PIX2.parse(window.DEFAULT_SAMPLE_PIX2);
        state.setDocument(doc);
      } catch (err) {
        console.error('Failed parsing DEFAULT_SAMPLE_PIX2:', err);
        createBlankProject('noiradix_ghost.pix2', 'Noiradix Ghost', 4, 4, 16, 16);
      }
    } else {
      createBlankProject('noiradix_ghost.pix2', 'Noiradix Ghost', 4, 4, 16, 16);
    }
    currentFileHandle = null;
    clearPersistedFileHandle();
    currentFileName = 'noiradix_ghost.pix2';
    currentFilePath = 'noiradix_ghost.pix2';
    localStorage.setItem('noiradix_session_type', 'draft');
    localStorage.setItem('noiradix_active_file_name', currentFileName);
    localStorage.setItem('noiradix_active_file_path', currentFilePath);
    selectedGridCellId = 'cell_0_0';
    centerCellCanvas();
    centerGridCanvas();
    setDirty(false);
    refreshAll();
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
    const doc = PIX2.createDocument(title, actualCols, actualRows, actualW, actualH);
    state.setDocument(doc);
    currentFileHandle = null;
    clearPersistedFileHandle();
    currentFileName = cleanFileName;
    currentFilePath = cleanFileName;
    centerCellCanvas();
    centerGridCanvas();
    setDirty(false);
    lastSavedContent = PIX2.serialize(doc);
    const snapshot = {
      timestamp: Date.now(),
      title: doc.meta.title || 'Untitled',
      fileName: currentFileName,
      data: lastSavedContent
    };
    localStorage.setItem('pix2_recovery_snapshot', JSON.stringify(snapshot));
    localStorage.setItem('pix2_draft_content', lastSavedContent);
    localStorage.removeItem('pix2_last_saved_content');
    localStorage.setItem('noiradix_session_type', 'draft');
    localStorage.setItem('noiradix_active_file_name', currentFileName);
    localStorage.setItem('noiradix_active_file_path', currentFilePath);
  }

  function openNewFileModal() {
    if (isDocumentDirty) {
      if (!confirm('You have unsaved changes. Discard and create new file?')) {
        return;
      }
    }
    if (!dom.modalNewFile) return;

    if (dom.newFileNameInput) {
      dom.newFileNameInput.value = 'new_sprite.pix2';
    }
    if (dom.newFileTitleInput) {
      dom.newFileTitleInput.value = 'New Sprite';
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
    const cellW = dom.newFileCellW ? (parseInt(dom.newFileCellW.value, 10) || 16) : 16;
    const cellH = dom.newFileCellH ? (parseInt(dom.newFileCellH.value, 10) || 16) : 16;

    createBlankProject(cleanFileName, derivedTitle, cols, rows, cellW, cellH);
    closeNewFileModal();
    refreshAll();
    showToast(`Created new file "${cleanFileName}"!`, 'success');
  }

  // ===========================================================================
  // IMPORT PIX2 CODE MODAL (Paste & Load Direct to Studio)
  // ===========================================================================

  function openImportCodeModal() {
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

    currentFileHandle = null;
    clearPersistedFileHandle();
    currentFileName = targetFileName;
    currentFilePath = targetFileName;
    lastSavedContent = rawCode;
    lastKnownFileModified = Date.now();

    state.setDocument(parsedDoc, false);
    state.activeTabId = 'tab-grid-overview';

    centerCellCanvas();
    centerGridCanvas();
    closeImportCodeModal();
    setDirty(true);
    triggerEventAutosave();
    refreshAll();

    showToast(`Successfully imported "${targetFileName}" (${parsedDoc.cells.size} frames)!`, 'success');
  }

  function refreshAll() {
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
      } else {
        switchView('cell');
        renderCellEditor();
        renderCellRulers();
        renderMiniPreview();
        updateCellEditorTagUI();
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
        dom.views[key].classList.toggle('active', key === viewName);
      }
    }
  }

  function updateProjectTitleUI() {
    if (dom.inputProjectTitle && state.doc) {
      const displayFileName = currentFileName || (currentFileHandle ? currentFileHandle.name : null) || sanitizeSafeFilename(state.doc.meta.title, '.pix2', 'untitled');
      dom.inputProjectTitle.value = displayFileName;
      const fullPath = getProjectFullPath();
      dom.inputProjectTitle.title = isDocumentDirty
        ? `● ${displayFileName} (Unsaved Changes - Ctrl+S to save)\nFull Path: ${fullPath}`
        : `${displayFileName} (Saved)\nFull Path: ${fullPath}`;
    }
    const dirtyDot = document.getElementById('header-dirty-dot');
    if (dirtyDot) {
      dirtyDot.classList.toggle('is-dirty', isDocumentDirty);
    }
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

    // 1. Grid Overview Tab (Pinned)
    const gridTab = createTabElement({
      id: 'tab-grid-overview',
      title: 'Grid Overview',
      icon: 'fa-solid fa-table-cells',
      isActive: state.activeTabId === 'tab-grid-overview',
      closable: false
    });
    dom.tabsContainer.appendChild(gridTab);

    // 2. Dedicated Animation Studio Tab (Pinned)
    const animStudioTab = createTabElement({
      id: 'tab-anim-studio',
      title: 'Animation Studio',
      icon: 'fa-solid fa-clapperboard',
      isActive: state.activeTabId === 'tab-anim-studio',
      closable: false
    });
    dom.tabsContainer.appendChild(animStudioTab);

    // 3. Open Cell Tabs
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

    // 4. PIX2 Code & AI Tab
    const codeTab = createTabElement({
      id: 'tab-pix2-code',
      title: 'PIX2 Code & AI',
      icon: 'fa-solid fa-code',
      isActive: state.activeTabId === 'tab-pix2-code',
      closable: false
    });
    dom.tabsContainer.appendChild(codeTab);
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

  function applyGridPan() {
    if (!dom.gridCanvas) return;
    if (gridPanX === 0 && gridPanY === 0) {
      dom.gridCanvas.style.transform = '';
    } else {
      dom.gridCanvas.style.transform = `translate(${gridPanX}px, ${gridPanY}px)`;
    }
  }

  function centerGridCanvas() {
    gridPanX = 0;
    gridPanY = 0;
    applyGridPan();
  }

  function getRowMoveUpHit(mx, my) {
    for (const btn of gridRowMoveUpButtons) {
      if (mx >= btn.x - 3 && mx <= btn.x + btn.w + 3 && my >= btn.y - 3 && my <= btn.y + btn.h + 3) {
        return btn.row;
      }
    }
    return null;
  }

  function getRowMoveDownHit(mx, my) {
    for (const btn of gridRowMoveDownButtons) {
      if (mx >= btn.x - 3 && mx <= btn.x + btn.w + 3 && my >= btn.y - 3 && my <= btn.y + btn.h + 3) {
        return btn.row;
      }
    }
    return null;
  }

  function getRowCardHit(mx, my) {
    for (const card of gridRowCards) {
      if (mx >= card.x && mx <= card.x + card.w && my >= card.y && my <= card.y + card.h) {
        return card.row;
      }
    }
    return null;
  }

  function getRowDuplicateHit(mx, my) {
    for (const btn of gridRowDuplicateButtons) {
      if (mx >= btn.x - 3 && mx <= btn.x + btn.w + 3 && my >= btn.y - 3 && my <= btn.y + btn.h + 3) {
        return btn.row;
      }
    }
    return null;
  }

  function getRowDeleteHit(mx, my) {
    for (const btn of gridRowDeleteButtons) {
      if (mx >= btn.x - 3 && mx <= btn.x + btn.w + 3 && my >= btn.y - 3 && my <= btn.y + btn.h + 3) {
        return btn.row;
      }
    }
    return null;
  }

  function getColDeleteHit(mx, my) {
    for (const btn of gridColDeleteButtons) {
      if (mx >= btn.x - 3 && mx <= btn.x + btn.w + 3 && my >= btn.y - 3 && my <= btn.y + btn.h + 3) {
        return btn.col;
      }
    }
    return null;
  }

  function confirmAndDeleteRow(rowIdx) {
    if (!state.doc || state.doc.meta.grid.rows <= 1) {
      showToast('Cannot delete the only remaining row in the sprite sheet.', 'info');
      return;
    }
    const doc = state.doc;
    const rows = doc.meta.grid.rows;
    const cols = doc.meta.grid.cols;
    if (rowIdx < 0 || rowIdx >= rows) return;

    const rowName = inferRowTitle(rowIdx);
    let paintedCount = 0;
    for (let c = 0; c < cols; c++) {
      const cell = doc.cells[`cell_${rowIdx}_${c}`];
      if (cell && cell.pixels && Object.keys(cell.pixels).length > 0) {
        paintedCount++;
      }
    }

    const artworkWarning = paintedCount > 0
      ? `⚠️ WARNING: This row contains ${paintedCount} frame(s) with pixel artwork that will be PERMANENTLY deleted!\n\n`
      : `(This row contains only empty frames).\n\n`;

    const message = `Are you sure you want to delete Row ${rowIdx} ("${rowName}")?\n\n` +
      artworkWarning +
      `IMPACT SUMMARY:\n` +
      `• Row ${rowIdx} and all its ${cols} cells will be removed.\n` +
      `• Associated animation clip "${rowName}" will be deleted/updated.\n` +
      `• All rows below (Row ${rowIdx + 1} → ${rows - 1}) will shift up by 1.\n` +
      `• Total sheet rows will decrease from ${rows} to ${rows - 1}.\n\n` +
      `Click OK to confirm permanent deletion.`;

    if (confirm(message)) {
      deleteSpecificRow(rowIdx, true);
    }
  }

  function confirmAndDeleteCol(colIdx) {
    if (!state.doc || state.doc.meta.grid.cols <= 1) {
      showToast('Cannot delete the only remaining column in the sprite sheet.', 'info');
      return;
    }
    const doc = state.doc;
    const rows = doc.meta.grid.rows;
    const cols = doc.meta.grid.cols;
    if (colIdx < 0 || colIdx >= cols) return;

    let paintedCount = 0;
    for (let r = 0; r < rows; r++) {
      const cell = doc.cells[`cell_${r}_${colIdx}`];
      if (cell && cell.pixels && Object.keys(cell.pixels).length > 0) {
        paintedCount++;
      }
    }

    const artworkWarning = paintedCount > 0
      ? `⚠️ WARNING: Column ${colIdx} contains ${paintedCount} cell(s) with pixel artwork that will be PERMANENTLY deleted!\n\n`
      : `(This column contains only empty cells).\n\n`;

    const message = `Are you sure you want to delete Column ${colIdx}?\n\n` +
      artworkWarning +
      `IMPACT SUMMARY:\n` +
      `• Column ${colIdx} will be deleted across ALL ${rows} rows (${rows} cells removed).\n` +
      `• All columns to the right (Col ${colIdx + 1} → ${cols - 1}) will shift left by 1.\n` +
      `• All animation sequences will be shortened from ${cols} to ${cols - 1} frames.\n` +
      `• Total sheet columns will decrease from ${cols} to ${cols - 1}.\n\n` +
      `Click OK to confirm permanent deletion.`;

    if (confirm(message)) {
      deleteSpecificCol(colIdx, true);
    }
  }

  function getCellAtGrid(doc, r, c) {
    if (!doc || !doc.cells) return null;

    // 1. Prioritize cell with explicit row & col matching this position
    for (const cid in doc.cells) {
      const cell = doc.cells[cid];
      if (cell && cell.row === r && cell.col === c) return cell;
    }

    // 2. Standard fallback cell ID cell_r_c (only if row/col match or are unset)
    const stdId = `cell_${r}_${c}`;
    if (doc.cells[stdId]) {
      const cObj = doc.cells[stdId];
      if (cObj.row === undefined || cObj.row === r) return cObj;
    }

    // 3. Direction & Frame mapping (0: down, 1: up, 2: right, 3: left, 4..7: diagonals)
    const directions = ['down', 'up', 'right', 'left', 'down_left', 'down_right', 'up_left', 'up_right'];
    const targetDir = directions[r];
    if (targetDir) {
      for (const cid in doc.cells) {
        const cell = doc.cells[cid];
        if (cell && cell.direction === targetDir && cell.frame === c) return cell;
      }
    }

    // 4. Animation frame mapping: check if animation mapped to row r contains frame c
    if (doc.animations) {
      for (const aKey in doc.animations) {
        const anim = doc.animations[aKey];
        if (anim && anim.frames && anim.frames[c]) {
          if (anim.direction === targetDir || aKey.includes(targetDir || `row_${r}`)) {
            const fid = anim.frames[c];
            if (doc.cells[fid]) return doc.cells[fid];
          }
        }
      }
    }

    return null;
  }

  function getCellRowCol(cellId) {
    if (!state.doc || !state.doc.cells) return { r: 0, c: 0 };
    const cell = state.doc.cells[cellId];
    if (cell) {
      if (typeof cell.row === 'number' && !isNaN(cell.row) && typeof cell.col === 'number' && !isNaN(cell.col)) {
        return { r: cell.row, c: cell.col };
      }
      const dirMap = { 'down': 0, 'up': 1, 'right': 2, 'left': 3, 'down_left': 4, 'down_right': 5, 'up_left': 6, 'up_right': 7 };
      if (cell.direction && dirMap[cell.direction] !== undefined) {
        return { r: dirMap[cell.direction], c: typeof cell.frame === 'number' ? cell.frame : 0 };
      }
    }
    const match = (cellId || '').match(/cell_(\d+)_(\d+)/);
    if (match) {
      return { r: parseInt(match[1], 10), c: parseInt(match[2], 10) };
    }
    return { r: 0, c: 0 };
  }

  function renderGridOverview() {
    if (!state.doc || !dom.gridCanvas) return;
    const doc = state.doc;
    const canvas = dom.gridCanvas;
    const ctx = canvas.getContext('2d');
    const isDark = document.body.classList.contains('dark-theme');

    const cols = doc.meta.grid.cols;
    const rows = doc.meta.grid.rows;
    const cw = doc.meta.cellSize.w;
    const ch = doc.meta.cellSize.h;
    const { leftHeaderW, topHeaderH, cellGapX, cellGapY, zoom } = GRID_LAYOUT;
    let hasMarqueeLabels = false;

    gridColDeleteButtons = [];
    gridRowDeleteButtons = [];
    gridRowDuplicateButtons = [];
    gridRowMoveUpButtons = [];
    gridRowMoveDownButtons = [];
    gridRowCards = [];

    const sheetW = leftHeaderW + cols * (cw * zoom + cellGapX) + 36;
    const sheetH = topHeaderH + rows * (ch * zoom + cellGapY) + 40;

    // High-DPI Razor-Sharp Text & Canvas Rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(sheetW * dpr);
    canvas.height = Math.round(sheetH * dpr);
    canvas.style.width = `${sheetW}px`;
    canvas.style.height = `${sheetH}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, sheetW, sheetH);
    ctx.imageSmoothingEnabled = true;

    // 1. Draw Column Headers (High-Contrast Centered Pill Badges with 'x' Delete Button)
    for (let c = 0; c < cols; c++) {
      const cx = leftHeaderW + c * (cw * zoom + cellGapX);
      const colText = `Col ${c}`;
      const badgeW = Math.max(76, cw * zoom);
      const badgeH = 26;
      const badgeX = Math.round(cx + (cw * zoom - badgeW) / 2);
      const badgeY = 14;

      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = isDark ? '#1e2230' : '#ffffff';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      else ctx.rect(badgeX, badgeY, badgeW, badgeH);
      ctx.fill();

      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.font = 'bold 12px "Segoe UI", system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(colText, badgeX + (badgeW - 18) / 2, badgeY + badgeH / 2);

      // '×' delete button on right of column badge
      const colBtnW = 18;
      const colBtnH = 18;
      const colBtnX = badgeX + badgeW - colBtnW - 4;
      const colBtnY = badgeY + (badgeH - colBtnH) / 2;

      gridColDeleteButtons.push({ col: c, x: colBtnX, y: colBtnY, w: colBtnW, h: colBtnH });

      ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(colBtnX, colBtnY, colBtnW, colBtnH, 4);
      else ctx.rect(colBtnX, colBtnY, colBtnW, colBtnH);
      ctx.fill();

      ctx.strokeStyle = isDark ? '#f87171' : '#ef4444';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(colBtnX + 5, colBtnY + 5);
      ctx.lineTo(colBtnX + colBtnW - 5, colBtnY + colBtnH - 5);
      ctx.moveTo(colBtnX + colBtnW - 5, colBtnY + 5);
      ctx.lineTo(colBtnX + 5, colBtnY + colBtnH - 5);
      ctx.stroke();
    }

    // 2. Draw Rows and Cells
    for (let r = 0; r < rows; r++) {
      const rowY = topHeaderH + r * (ch * zoom + cellGapY);
      const rowName = inferRowTitle(r);

      // High-Contrast Row Card on the left (vertically centered relative to sprite cells)
      const cardW = 152;
      const cardH = 56;
      const cardX = 10;
      const cardY = Math.round(rowY + (ch * zoom - cardH) / 2);

      gridRowCards.push({ row: r, x: cardX, y: cardY, w: cardW, h: cardH });

      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = isDark ? '#1e2230' : '#ffffff';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      else ctx.rect(cardX, cardY, cardW, cardH);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isDark ? '#a5b4fc' : '#3730a3';
      ctx.font = 'bold 12px "Segoe UI", system-ui, -apple-system, sans-serif';
      ctx.fillText(`Row ${r}:`, cardX + 8, cardY + 8);

      // '×' delete button on top-right of row card
      const delBtnW = 18;
      const delBtnH = 18;
      const delBtnX = cardX + cardW - delBtnW - 6;
      const delBtnY = cardY + 6;

      gridRowDeleteButtons.push({ row: r, x: delBtnX, y: delBtnY, w: delBtnW, h: delBtnH });

      ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(delBtnX, delBtnY, delBtnW, delBtnH, 4);
      else ctx.rect(delBtnX, delBtnY, delBtnW, delBtnH);
      ctx.fill();

      ctx.strokeStyle = isDark ? '#f87171' : '#ef4444';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(delBtnX + 5, delBtnY + 5);
      ctx.lineTo(delBtnX + delBtnW - 5, delBtnY + delBtnH - 5);
      ctx.moveTo(delBtnX + delBtnW - 5, delBtnY + 5);
      ctx.lineTo(delBtnX + 5, delBtnY + delBtnH - 5);
      ctx.stroke();

      // Duplicate Row button directly to the left of the delete button
      const dupBtnW = 18;
      const dupBtnH = 18;
      const dupBtnX = delBtnX - dupBtnW - 4;
      const dupBtnY = cardY + 6;

      gridRowDuplicateButtons.push({ row: r, x: dupBtnX, y: dupBtnY, w: dupBtnW, h: dupBtnH });

      ctx.fillStyle = isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.12)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(dupBtnX, dupBtnY, dupBtnW, dupBtnH, 4);
      else ctx.rect(dupBtnX, dupBtnY, dupBtnW, dupBtnH);
      ctx.fill();

      // Duplicate icon: two crisp overlapping squares
      ctx.strokeStyle = isDark ? '#a5b4fc' : '#4f46e5';
      ctx.lineWidth = 1.3;
      ctx.strokeRect(dupBtnX + 6.5, dupBtnY + 3.5, 7, 7);
      ctx.fillStyle = isDark ? '#1e2230' : '#ffffff';
      ctx.fillRect(dupBtnX + 4.5, dupBtnY + 6.5, 7, 7);
      ctx.strokeRect(dupBtnX + 4.5, dupBtnY + 6.5, 7, 7);

      // Move Down button [▼] (if not last row)
      let downBtnX = dupBtnX;
      if (r < rows - 1) {
        const downBtnW = 18;
        const downBtnH = 18;
        downBtnX = dupBtnX - downBtnW - 4;
        const downBtnY = cardY + 6;

        gridRowMoveDownButtons.push({ row: r, x: downBtnX, y: downBtnY, w: downBtnW, h: downBtnH });

        ctx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.12)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(downBtnX, downBtnY, downBtnW, downBtnH, 4);
        else ctx.rect(downBtnX, downBtnY, downBtnW, downBtnH);
        ctx.fill();

        // Standard chevron-down icon (matches FontAwesome fa-chevron-down)
        const midX = downBtnX + downBtnW / 2;
        const midY = downBtnY + downBtnH / 2;
        ctx.strokeStyle = isDark ? '#cbd5e1' : '#475569';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(midX - 3.5, midY - 1.5);
        ctx.lineTo(midX, midY + 2.5);
        ctx.lineTo(midX + 3.5, midY - 1.5);
        ctx.stroke();
      }

      // Move Up button [▲] (if not first row)
      if (r > 0) {
        const upBtnW = 18;
        const upBtnH = 18;
        const upBtnX = (r < rows - 1 ? downBtnX : dupBtnX) - upBtnW - 4;
        const upBtnY = cardY + 6;

        gridRowMoveUpButtons.push({ row: r, x: upBtnX, y: upBtnY, w: upBtnW, h: upBtnH });

        ctx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.12)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(upBtnX, upBtnY, upBtnW, upBtnH, 4);
        else ctx.rect(upBtnX, upBtnY, upBtnW, upBtnH);
        ctx.fill();

        // Standard chevron-up icon (matches FontAwesome fa-chevron-up)
        const midX = upBtnX + upBtnW / 2;
        const midY = upBtnY + upBtnH / 2;
        ctx.strokeStyle = isDark ? '#cbd5e1' : '#475569';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(midX - 3.5, midY + 1.5);
        ctx.lineTo(midX, midY - 2.5);
        ctx.lineTo(midX + 3.5, midY + 1.5);
        ctx.stroke();
      }

      // Frame / Display name shifted comfortably lower (generous breathing room below buttons)
      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.font = '600 12px "Segoe UI", system-ui, -apple-system, sans-serif';

      const rowNameWidth = ctx.measureText(rowName).width;
      const maxRowNameW = cardW - 20;

      if (rowNameWidth <= maxRowNameW) {
        ctx.textAlign = 'left';
        ctx.fillText(rowName, cardX + 8, cardY + 34);
      } else {
        hasMarqueeLabels = true;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cardX + 8, cardY + 32, maxRowNameW, 20);
        ctx.clip();

        const now = performance.now();
        const scrollSpeed = 0.035;
        const textGap = 20;
        const totalDist = rowNameWidth + textGap;
        const offset = (now * scrollSpeed) % totalDist;
        const startX = (cardX + 8) - offset;

        ctx.textAlign = 'left';
        ctx.fillText(rowName, startX, cardY + 34);
        ctx.fillText(rowName, startX + totalDist, cardY + 34);
        ctx.restore();
      }

      // Draw Cells in Row
      for (let c = 0; c < cols; c++) {
        const cell = getCellAtGrid(doc, r, c);
        const cellId = cell ? cell.id : `cell_${r}_${c}`;
        const cx = Math.round(leftHeaderW + c * (cw * zoom + cellGapX));
        const cy = Math.round(rowY);

        const isSelected = (cellId === selectedGridCellId || (!cell && selectedGridCellId === `cell_${r}_${c}`));

        // Checkerboard
        drawChecker(ctx, cx, cy, cw * zoom, ch * zoom, 4 * zoom);

        // Cell border (selected = bright accent outline)
        if (isSelected) {
          ctx.strokeStyle = isDark ? '#818cf8' : '#4f46e5';
          ctx.lineWidth = 3;
          ctx.strokeRect(cx - 2, cy - 2, cw * zoom + 4, ch * zoom + 4);
        } else {
          ctx.strokeStyle = isDark ? '#4b5563' : '#94a3b8';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - 0.5, cy - 0.5, cw * zoom + 1, ch * zoom + 1);
        }

        // Draw pixels (crisp pixel art rasterization)
        if (cell && cell.pixels) {
          ctx.imageSmoothingEnabled = false;
          for (const coord in cell.pixels) {
            const [px, py] = coord.split(',').map(Number);
            ctx.fillStyle = cell.pixels[coord];
            ctx.fillRect(cx + px * zoom, cy + py * zoom, zoom, zoom);
          }
          // Restore smoothing for subsequent text rendering
          ctx.imageSmoothingEnabled = true;
        }

        // Cell label underneath in high-contrast pill (with 24px margin to next row)
        const labelText = cell ? (cell.name || cellId) : cellId;
        const pillW = Math.max(54, cw * zoom);
        const pillH = 20;
        const pillX = Math.round(cx + (cw * zoom - pillW) / 2);
        const pillY = cy + ch * zoom + 8;

        ctx.imageSmoothingEnabled = true;
        ctx.fillStyle = isSelected ? (isDark ? '#312e81' : '#e0e7ff') : (isDark ? '#1e2230' : '#ffffff');
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 4);
        else ctx.rect(pillX, pillY, pillW, pillH);
        ctx.fill();
        ctx.strokeStyle = isSelected ? (isDark ? '#818cf8' : '#4f46e5') : (isDark ? '#4b5563' : '#cbd5e1');
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = isSelected ? (isDark ? '#c7d2fe' : '#312e81') : (isDark ? '#f8fafc' : '#0f172a');
        ctx.font = isSelected ? 'bold 11px "Segoe UI", system-ui, sans-serif' : '600 11px "Segoe UI", system-ui, sans-serif';
        ctx.textBaseline = 'middle';

        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const maxVisibleW = pillW - 10; // 5px padding on each side

        if (textWidth <= maxVisibleW) {
          // Fits normally: statically centered, zero scrolling
          ctx.textAlign = 'center';
          ctx.fillText(labelText, pillX + pillW / 2, pillY + pillH / 2);
        } else {
          // Label is longer than the pill: clip inside the white box and marquee scroll continuously with a small gap
          hasMarqueeLabels = true;
          ctx.save();
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(pillX + 3, pillY + 1, pillW - 6, pillH - 2, 3);
          else ctx.rect(pillX + 3, pillY + 1, pillW - 6, pillH - 2);
          ctx.clip();

          const now = performance.now();
          const scrollSpeed = 0.035; // px per millisecond (smooth reading speed)
          const textGap = 20; // small spacing as requested
          const totalLoopDist = textWidth + textGap;
          const offset = (now * scrollSpeed) % totalLoopDist;
          const startX = (pillX + 5) - offset;

          ctx.textAlign = 'left';
          ctx.fillText(labelText, startX, pillY + pillH / 2);
          ctx.fillText(labelText, startX + totalLoopDist, pillY + pillH / 2);
          ctx.restore();
        }
      }
    }

    // Render row drag indicator if dragging a row card
    if (rowDragState && rowDragState.isDragging) {
      const targetR = rowDragState.targetRow;
      const targetRowY = topHeaderH + targetR * (ch * zoom + cellGapY);
      const lineY = (targetR > rowDragState.fromRow)
        ? (targetRowY + ch * zoom + cellGapY / 2)
        : (targetRowY - cellGapY / 2);

      ctx.save();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(10, lineY);
      ctx.lineTo(sheetW - 20, lineY);
      ctx.stroke();
      ctx.setLineDash([]);

      const badgeText = `Move to Row ${targetR}`;
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      const bTextW = ctx.measureText(badgeText).width;
      const bW = bTextW + 16;
      const bH = 22;
      ctx.fillStyle = '#4f46e5';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(14, lineY - bH / 2, bW, bH, 4);
      else ctx.rect(14, lineY - bH / 2, bW, bH);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, 14 + bW / 2, lineY);
      ctx.restore();
    }

    // Schedule next animation frame if there are long marquee labels in Grid Overview
    if (hasMarqueeLabels && state.activeTabId === 'tab-grid-overview') {
      if (marqueeAnimFrameId) cancelAnimationFrame(marqueeAnimFrameId);
      marqueeAnimFrameId = requestAnimationFrame(() => {
        if (state.activeTabId === 'tab-grid-overview') {
          renderGridOverview();
        }
      });
    } else {
      if (marqueeAnimFrameId) {
        cancelAnimationFrame(marqueeAnimFrameId);
        marqueeAnimFrameId = null;
      }
    }
  }

  function inferRowTitle(rowIdx) {
    if (!state.doc) return 'Default';
    for (const animName in state.doc.animations) {
      const anim = state.doc.animations[animName];
      if (anim && anim.frames) {
        if (anim.frames.some(fid => {
          if (fid.startsWith(`cell_${rowIdx}_`)) return true;
          const { r } = getCellRowCol(fid);
          return r === rowIdx;
        })) {
          return anim.name || animName.replace(/_/g, ' ');
        }
      }
    }
    const default4 = ['Down (S)', 'Up (W)', 'Right (D)', 'Left (A)'];
    return default4[rowIdx] || `Action ${rowIdx}`;
  }

  function drawChecker(ctx, x, y, w, h, size) {
    const isDark = document.body.classList.contains('dark-theme');
    const c1 = isDark ? '#1f202e' : '#ffffff';
    const c2 = isDark ? '#171822' : '#e2e8f0';

    for (let py = 0; py < h; py += size) {
      for (let px = 0; px < w; px += size) {
        ctx.fillStyle = ((px / size + py / size) % 2 === 0) ? c1 : c2;
        ctx.fillRect(x + px, y + py, Math.min(size, w - px), Math.min(size, h - py));
      }
    }
  }

  function getGridCellFromPos(mx, my) {
    if (!state.doc) return null;
    const doc = state.doc;
    const cols = doc.meta.grid.cols;
    const rows = doc.meta.grid.rows;
    const cw = doc.meta.cellSize.w;
    const ch = doc.meta.cellSize.h;
    const { leftHeaderW, topHeaderH, cellGapX, cellGapY, zoom } = GRID_LAYOUT;
    let hasMarqueeLabels = false;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = leftHeaderW + c * (cw * zoom + cellGapX);
        const cy = topHeaderH + r * (ch * zoom + cellGapY);
        // Generous hit test: covers sprite box + label pill underneath + 8px margins for instant 1-click select
        const hitLeft = cx - 8;
        const hitRight = cx + cw * zoom + 8;
        const hitTop = cy - 6;
        const hitBottom = cy + ch * zoom + 32;
        if (mx >= hitLeft && mx <= hitRight && my >= hitTop && my <= hitBottom) {
          const cell = getCellAtGrid(doc, r, c);
          return cell ? cell.id : `cell_${r}_${c}`;
        }
      }
    }
    return null;
  }

  // ===========================================================================
  // INTELLIGENT GRID ROW & COLUMN MANAGEMENT (SELECTION-AWARE & AUTO-FRAME EXTENSION)
  // ===========================================================================

  function addGridRow() {
    if (!state.doc) return;
    const doc = state.doc;
    const newR = doc.meta.grid.rows;

    const defaultName = `action_${newR}`;
    const inputName = prompt(`Enter Animation State name for new Row ${newR} (e.g. attack, jump, dash, idle_down):`, defaultName);
    if (inputName === null) {
      return; // Cancelled by user
    }
    const stateKey = (inputName.trim() || defaultName).toLowerCase().replace(/\s+/g, '_');
    const dispName = inputName.trim() || defaultName;

    doc.meta.grid.rows++;
    const rowCells = [];

    for (let c = 0; c < doc.meta.grid.cols; c++) {
      const cid = `cell_${newR}_${c}`;
      doc.cells[cid] = {
        id: cid,
        name: `${dispName} ${c}`,
        row: newR,
        col: c,
        direction: 'none',
        frame: c,
        pixels: {}
      };
      rowCells.push(cid);
    }

    // Auto-create and batch-assign animation state for this entire new row
    doc.animations[stateKey] = {
      name: dispName,
      direction: 'none',
      frames: rowCells,
      fps: 6,
      loop: true,
      mode: 'loop'
    };

    selectedGridCellId = `cell_${newR}_0`;
    state.saveSnapshot(`Add Row ${newR} (${stateKey})`);
    triggerEventAutosave();
    refreshAll();
    populateAnimDropdowns();
    updateGridInspectorUI();
    showToast(`Added Row ${newR} with State "${dispName}" (${doc.meta.grid.cols} frames)!`, 'success');
  }

  function addGridCol() {
    if (!state.doc) return;
    const doc = state.doc;
    const newC = doc.meta.grid.cols;
    doc.meta.grid.cols++;

    for (let r = 0; r < doc.meta.grid.rows; r++) {
      const cid = `cell_${r}_${newC}`;
      const prevCid = `cell_${r}_${newC - 1}`;
      const prevCell = doc.cells[prevCid];

      // Find if this row is part of an animation
      let rowAnim = null;
      for (const animName in doc.animations) {
        const anim = doc.animations[animName];
        if (anim.frames && Array.isArray(anim.frames) && anim.frames.includes(prevCid)) {
          rowAnim = anim;
          break;
        }
      }

      // Infer sequential naming: e.g. "Down 3" -> "Down 4"
      let cellName = `Frame ${r},${newC}`;
      let cellDir = 'none';
      if (prevCell && prevCell.name) {
        const match = prevCell.name.match(/^(.*?)\s*(\d+)$/);
        if (match) {
          cellName = `${match[1]} ${newC}`;
        } else {
          cellName = `${prevCell.name} ${newC}`;
        }
        cellDir = prevCell.direction || 'none';
      }

      doc.cells[cid] = {
        id: cid,
        name: cellName,
        row: r,
        col: newC,
        direction: cellDir,
        frame: newC,
        pixels: {}
      };

      // Automatically append newly added frame to the animation sequence!
      if (rowAnim && Array.isArray(rowAnim.frames)) {
        if (!rowAnim.frames.includes(cid)) {
          rowAnim.frames.push(cid);
        }
      }
    }

    state.saveSnapshot('Add Column');
    triggerEventAutosave();
    refreshAll();
    showToast(`Added Column ${newC} (all row animations extended to ${doc.meta.grid.cols} frames)`, 'success');
  }

  function promptAndDuplicateRow(rowIdx) {
    if (!state.doc) return;
    const doc = state.doc;
    const rows = doc.meta.grid.rows;
    if (rowIdx < 0 || rowIdx >= rows) return;

    const sourceTitle = inferRowTitle(rowIdx) || `Row ${rowIdx}`;
    const defaultName = `${sourceTitle} Copy`;
    const inputName = prompt(`Enter name for the duplicated row:`, defaultName);
    if (inputName === null) return; // User pressed Cancel
    const finalName = inputName.trim() || defaultName;

    duplicateSpecificRow(rowIdx, finalName);
  }

  function duplicateSpecificRow(sourceRowIdx, newRowName) {
    if (!state.doc) return;
    const doc = state.doc;
    const oldRows = doc.meta.grid.rows;
    const cols = doc.meta.grid.cols;
    const newRowIdx = oldRows;

    const sourceTitle = inferRowTitle(sourceRowIdx) || `Row ${sourceRowIdx}`;
    const finalName = (newRowName || `${sourceTitle} Copy`).trim();

    state.beginStroke();

    // 1. Expand row count
    doc.meta.grid.rows = oldRows + 1;

    // 2. Derive clean identifier prefix
    const cleanPrefix = finalName
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '') || `row_${newRowIdx}`;

    const newFrameIds = [];

    // 3. Clone all cells in the row
    for (let c = 0; c < cols; c++) {
      const srcCell = getCellAtGrid(doc, sourceRowIdx, c);
      const newCellId = `${cleanPrefix}_${c}`;

      const newCell = {
        id: newCellId,
        name: `${finalName} - Frame ${c}`,
        row: newRowIdx,
        col: c,
        frame: c,
        direction: (srcCell && srcCell.direction) ? srcCell.direction : 'none',
        pixels: {}
      };

      if (srcCell && srcCell.pixels) {
        for (const coord in srcCell.pixels) {
          newCell.pixels[coord] = srcCell.pixels[coord];
        }
      }

      doc.cells[newCellId] = newCell;
      newFrameIds.push(newCellId);
    }

    // 4. Create animation sequence
    if (!doc.animations) doc.animations = {};
    let srcFps = 6;
    let srcLoop = true;
    let srcDir = 'none';

    for (const aKey in doc.animations) {
      const a = doc.animations[aKey];
      if (a && a.frames && a.frames.some(fid => {
        const cell = doc.cells[fid];
        return cell && cell.row === sourceRowIdx;
      })) {
        srcFps = a.fps || 6;
        srcLoop = (a.loop !== undefined) ? a.loop : true;
        srcDir = a.direction || 'none';
        break;
      }
    }

    let animKey = cleanPrefix;
    let suffix = 1;
    while (doc.animations[animKey]) {
      animKey = `${cleanPrefix}_${suffix++}`;
    }

    doc.animations[animKey] = {
      name: finalName,
      fps: srcFps,
      loop: srcLoop,
      direction: srcDir,
      frames: newFrameIds
    };

    // 5. Select first cell of new row
    selectedGridCellId = newFrameIds[0];

    state.endStroke(`Duplicate Row ${sourceRowIdx} as "${finalName}"`);
    triggerEventAutosave();
    refreshAll();
    showToast(`Row ${sourceRowIdx} duplicated as "${finalName}" with ${cols} frames!`, 'success');
  }

  function moveRow(fromIdx, toIdx) {
    if (!state.doc) return;
    const doc = state.doc;
    const rows = doc.meta.grid.rows;
    const cols = doc.meta.grid.cols;
    if (fromIdx < 0 || fromIdx >= rows || toIdx < 0 || toIdx >= rows || fromIdx === toIdx) return;

    state.beginStroke();

    // 1. Calculate row permutation
    const order = [];
    for (let r = 0; r < rows; r++) order.push(r);
    const [moved] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, moved);

    const oldToNew = {};
    order.forEach((oldR, newR) => { oldToNew[oldR] = newR; });

    // 2. Collect cells by existing row
    const cellsByOldRow = [];
    for (let r = 0; r < rows; r++) {
      const rowCells = [];
      for (let c = 0; c < cols; c++) {
        const cell = getCellAtGrid(doc, r, c);
        rowCells.push(cell);
      }
      cellsByOldRow.push(rowCells);
    }

    // 3. Rename standard cells cell_R_C to prevent key collisions
    const renameMap = {};
    for (let oldR = 0; oldR < rows; oldR++) {
      const newR = oldToNew[oldR];
      if (oldR === newR) continue;
      for (let c = 0; c < cols; c++) {
        const cell = cellsByOldRow[oldR][c];
        if (cell && cell.id.startsWith('cell_')) {
          renameMap[cell.id] = `cell_${newR}_${c}`;
        }
      }
    }

    if (Object.keys(renameMap).length > 0) {
      const newCells = {};
      for (const cid in doc.cells) {
        if (!renameMap[cid]) {
          newCells[cid] = doc.cells[cid];
        }
      }
      for (const oldId in renameMap) {
        const cell = doc.cells[oldId];
        const newId = renameMap[oldId];
        cell.id = newId;
        newCells[newId] = cell;
      }
      doc.cells = newCells;

      for (const aName in doc.animations) {
        const anim = doc.animations[aName];
        if (anim && Array.isArray(anim.frames)) {
          anim.frames = anim.frames.map(fid => renameMap[fid] || fid);
        }
      }

      if (selectedGridCellId && renameMap[selectedGridCellId]) {
        selectedGridCellId = renameMap[selectedGridCellId];
      }
    }

    // 4. Update row index property on every cell
    for (let oldR = 0; oldR < rows; oldR++) {
      const newR = oldToNew[oldR];
      for (let c = 0; c < cols; c++) {
        const cell = cellsByOldRow[oldR][c];
        if (cell) {
          cell.row = newR;
          cell.col = c;
        }
      }
    }

    const fromTitle = inferRowTitle(fromIdx) || `Row ${fromIdx}`;
    state.endStroke(`Move Row ${fromIdx} to Row ${toIdx} ("${fromTitle}")`);
    triggerEventAutosave();
    refreshAll();
    showToast(`Moved "${fromTitle}" to Row ${toIdx}!`, 'success');
  }

  function deleteSpecificRow(rowIdx, skipConfirm = false) {
    if (!state.doc || state.doc.meta.grid.rows <= 1) {
      showToast('Cannot delete the only remaining row.');
      return;
    }
    const doc = state.doc;
    const rows = doc.meta.grid.rows;
    const cols = doc.meta.grid.cols;

    if (rowIdx < 0 || rowIdx >= rows) return;

    const rowName = inferRowTitle(rowIdx);
    if (!skipConfirm) {
      confirmAndDeleteRow(rowIdx);
      return;
    }

    state.beginStroke();

    // 1. Rebuild cells map with shifted rows
    const newCells = {};
    const idMapping = {}; // oldCellId -> newCellId

    for (let r = 0; r < rows; r++) {
      if (r === rowIdx) {
        for (let c = 0; c < cols; c++) {
          const doomedCell = getCellAtGrid(doc, r, c);
          if (doomedCell) idMapping[doomedCell.id] = null;
          idMapping[`cell_${r}_${c}`] = null;
        }
        continue;
      }

      const newR = (r > rowIdx) ? (r - 1) : r;

      for (let c = 0; c < cols; c++) {
        const existingCell = getCellAtGrid(doc, r, c);
        const oldId = existingCell ? existingCell.id : `cell_${r}_${c}`;
        const newId = `cell_${newR}_${c}`;
        idMapping[oldId] = newId;

        const cell = existingCell || { id: oldId, name: `Frame ${r},${c}`, pixels: {}, row: r, col: c };
        cell.id = newId;
        cell.row = newR;
        cell.col = c;
        newCells[newId] = cell;
      }
    }

    doc.cells = newCells;
    doc.meta.grid.rows--;

    // 2. Update animation frames
    for (const animName in doc.animations) {
      const anim = doc.animations[animName];
      if (anim.frames && Array.isArray(anim.frames)) {
        anim.frames = anim.frames
          .map(fid => idMapping[fid] !== undefined ? idMapping[fid] : fid)
          .filter(fid => fid !== null);
      }
    }

    // 3. Update selection
    if (selectedGridCellId && selectedGridCellId.startsWith(`cell_${rowIdx}_`)) {
      selectedGridCellId = `cell_0_0`;
    } else if (selectedGridCellId && idMapping[selectedGridCellId]) {
      selectedGridCellId = idMapping[selectedGridCellId];
    }

    state.endStroke(`Delete Row ${rowIdx}`);
    triggerEventAutosave();
    refreshAll();
    showToast(`Deleted Row ${rowIdx} ("${rowName}"). Remaining rows: ${doc.meta.grid.rows}`, 'success');
  }

  function deleteSpecificCol(colIdx, skipConfirm = false) {
    if (!state.doc || state.doc.meta.grid.cols <= 1) {
      showToast('Cannot delete the only remaining column.');
      return;
    }
    const doc = state.doc;
    const rows = doc.meta.grid.rows;
    const cols = doc.meta.grid.cols;

    if (colIdx < 0 || colIdx >= cols) return;

    if (!skipConfirm) {
      confirmAndDeleteCol(colIdx);
      return;
    }

    state.beginStroke();

    // 1. Rebuild cells map with shifted columns
    const newCells = {};
    const idMapping = {}; // oldCellId -> newCellId

    for (let c = 0; c < cols; c++) {
      if (c === colIdx) {
        for (let r = 0; r < rows; r++) {
          const doomedCell = getCellAtGrid(doc, r, c);
          if (doomedCell) idMapping[doomedCell.id] = null;
          idMapping[`cell_${r}_${c}`] = null;
        }
        continue;
      }

      const newC = (c > colIdx) ? (c - 1) : c;

      for (let r = 0; r < rows; r++) {
        const existingCell = getCellAtGrid(doc, r, c);
        const oldId = existingCell ? existingCell.id : `cell_${r}_${c}`;
        const newId = `cell_${r}_${newC}`;
        idMapping[oldId] = newId;

        const cell = existingCell || { id: oldId, name: `Frame ${r},${c}`, pixels: {}, row: r, col: c };
        cell.id = newId;
        cell.row = r;
        cell.col = newC;
        newCells[newId] = cell;
      }
    }

    doc.cells = newCells;
    doc.meta.grid.cols--;

    // 2. Update animation frames
    for (const animName in doc.animations) {
      const anim = doc.animations[animName];
      if (anim.frames && Array.isArray(anim.frames)) {
        anim.frames = anim.frames
          .map(fid => idMapping[fid] !== undefined ? idMapping[fid] : fid)
          .filter(fid => fid !== null);
      }
    }

    // 3. Update selection
    if (selectedGridCellId && selectedGridCellId.endsWith(`_${colIdx}`)) {
      selectedGridCellId = `cell_0_0`;
    } else if (selectedGridCellId && idMapping[selectedGridCellId]) {
      selectedGridCellId = idMapping[selectedGridCellId];
    }

    state.endStroke(`Delete Column ${colIdx}`);
    triggerEventAutosave();
    refreshAll();
    showToast(`Deleted Column ${colIdx}. Remaining columns: ${doc.meta.grid.cols}`, 'success');
  }

  function removeSelectedRow() {
    if (!state.doc) return;
    const { r: selR } = getCellRowCol(selectedGridCellId);
    deleteSpecificRow(selR);
  }

  function removeSelectedCol() {
    if (!state.doc) return;
    const { c: selC } = getCellRowCol(selectedGridCellId);
    deleteSpecificCol(selC);
  }

  // ===========================================================================
  // FRAME PICKER MODAL (ANIMATION STUDIO)
  // ===========================================================================

  function openFramePickerModal() {
    if (!dom.modalFramePicker || !state.doc) return;
    const doc = state.doc;
    const clip = doc.animations[activeStudioClipId];
    if (!clip) return;

    let clipRow = 0;
    if (clip.frames && clip.frames.length > 0) {
      const { r } = getCellRowCol(clip.frames[0]);
      clipRow = r;
    }

    if (dom.framePickerRowFilter) {
      dom.framePickerRowFilter.innerHTML = '';
      const optCurrent = document.createElement('option');
      optCurrent.value = `row_${clipRow}`;
      optCurrent.textContent = `Current Row (Row ${clipRow}: ${inferRowTitle(clipRow)})`;
      dom.framePickerRowFilter.appendChild(optCurrent);

      const optAll = document.createElement('option');
      optAll.value = 'all';
      optAll.textContent = 'All Sprite Cells';
      dom.framePickerRowFilter.appendChild(optAll);

      for (let r = 0; r < doc.meta.grid.rows; r++) {
        if (r === clipRow) continue;
        const opt = document.createElement('option');
        opt.value = `row_${r}`;
        opt.textContent = `Row ${r} (${inferRowTitle(r)})`;
        dom.framePickerRowFilter.appendChild(opt);
      }
      dom.framePickerRowFilter.value = `row_${clipRow}`;
    }

    if (dom.framePickerSearch) dom.framePickerSearch.value = '';
    if (dom.framePickerManualId) dom.framePickerManualId.value = selectedGridCellId || '';

    renderFramePickerCards();
    dom.modalFramePicker.classList.remove('hidden');
  }

  function closeFramePickerModal() {
    if (dom.modalFramePicker) {
      dom.modalFramePicker.classList.add('hidden');
    }
  }

  function renderFramePickerCards() {
    if (!dom.framePickerGrid || !state.doc) return;
    dom.framePickerGrid.innerHTML = '';

    const doc = state.doc;
    const filterRowVal = dom.framePickerRowFilter ? dom.framePickerRowFilter.value : 'all';
    const searchQuery = (dom.framePickerSearch ? dom.framePickerSearch.value.trim().toLowerCase() : '');

    const cellIds = Object.keys(doc.cells);
    const filteredCells = cellIds.filter(cid => {
      const cell = doc.cells[cid];
      if (!cell) return false;

      if (filterRowVal.startsWith('row_')) {
        const targetRow = parseInt(filterRowVal.split('_')[1], 10);
        if (cell.row !== targetRow) return false;
      }

      if (searchQuery) {
        const nameMatch = (cell.name || '').toLowerCase().includes(searchQuery);
        const idMatch = cid.toLowerCase().includes(searchQuery);
        if (!nameMatch && !idMatch) return false;
      }

      return true;
    });

    if (filteredCells.length === 0) {
      dom.framePickerGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">No matching cells found</div>`;
      return;
    }

    const cw = doc.meta.cellSize.w;
    const ch = doc.meta.cellSize.h;

    filteredCells.forEach(cid => {
      const cell = doc.cells[cid];
      const card = document.createElement('div');
      card.className = 'frame-picker-card';
      card.title = `Click to add ${cell.name || cid} to sequence`;

      const thumb = document.createElement('canvas');
      thumb.className = 'frame-picker-thumb';
      thumb.width = cw;
      thumb.height = ch;
      const tctx = thumb.getContext('2d');
      if (cell.pixels) {
        for (const coord in cell.pixels) {
          const [px, py] = coord.split(',').map(Number);
          tctx.fillStyle = cell.pixels[coord];
          tctx.fillRect(px, py, 1, 1);
        }
      }

      const nameEl = document.createElement('span');
      nameEl.className = 'card-name';
      nameEl.textContent = cell.name || cid;

      const idEl = document.createElement('span');
      idEl.className = 'card-id';
      idEl.textContent = cid;

      card.appendChild(thumb);
      card.appendChild(nameEl);
      card.appendChild(idEl);

      card.addEventListener('click', () => {
        appendCellToActiveAnimation(cid);
      });

      dom.framePickerGrid.appendChild(card);
    });
  }

  function appendCellToActiveAnimation(cellId) {
    if (!state.doc || !state.doc.animations[activeStudioClipId]) return;
    const clip = state.doc.animations[activeStudioClipId];
    if (!clip.frames) clip.frames = [];
    clip.frames.push(cellId);

    state.saveSnapshot('Add Animation Frame');
    triggerEventAutosave();
    closeFramePickerModal();

    renderTimelineFramesStrip(clip);
    if (studioAnimPlayer) studioAnimPlayer.render();
    populateAnimDropdowns();

    const cell = state.doc.cells[cellId];
    showToast(`Added "${cell ? (cell.name || cellId) : cellId}" to ${clip.name || activeStudioClipId}!`, 'success');
  }

  // ===========================================================================
  // INSPECTOR & ANIMATION TAGGING
  // ===========================================================================

  function populateAnimDropdowns() {
    if (!state.doc) return;
    const animNames = Object.keys(state.doc.animations);

    const buildOptions = (selectEl) => {
      if (!selectEl) return;
      selectEl.innerHTML = '';
      animNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        selectEl.appendChild(opt);
      });
      const newOpt = document.createElement('option');
      newOpt.value = '__new__';
      newOpt.textContent = '+ Create New Animation...';
      selectEl.appendChild(newOpt);
    };

    buildOptions(dom.gridCellAnim);
    buildOptions(dom.cellAnimSelect);

    if (dom.floatingAnimSelect) {
      dom.floatingAnimSelect.innerHTML = '';
      animNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        dom.floatingAnimSelect.appendChild(opt);
      });
      if (animPlayer && animPlayer.activeAnimationName) {
        dom.floatingAnimSelect.value = animPlayer.activeAnimationName;
      }
    }

    if (dom.animClipsList) {
      dom.animClipsList.innerHTML = '';
      for (const animName in state.doc.animations) {
        const anim = state.doc.animations[animName];
        const item = document.createElement('div');
        item.className = 'anim-clip-item';
        item.style.cursor = 'pointer';

        const titleSpan = document.createElement('span');
        const strongEl = document.createElement('strong');
        strongEl.textContent = animName;
        titleSpan.appendChild(strongEl);
        titleSpan.appendChild(document.createTextNode(` (${anim.fps || 6} fps)`));

        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'anim-clip-badge';
        badgeSpan.textContent = `${(anim.frames || []).length} frames`;

        item.appendChild(titleSpan);
        item.appendChild(badgeSpan);
        item.addEventListener('click', () => {
          activeStudioClipId = animName;
          state.activeTabId = 'tab-anim-studio';
          refreshAll();
        });
        dom.animClipsList.appendChild(item);
      }
    }
  }

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

  function assignRowToAnimation(rowIdx, animKey, customDisplayName) {
    if (!state.doc) return;
    const doc = state.doc;
    const cols = doc.meta.grid.cols;
    const rowCells = [];

    // 1. Collect the ACTUAL existing cells currently at this row (preserving all artwork!)
    for (let c = 0; c < cols; c++) {
      const existing = getCellAtGrid(doc, rowIdx, c);
      if (existing) {
        rowCells.push(existing.id);
      } else {
        const fallbackId = `cell_${rowIdx}_${c}`;
        rowCells.push(fallbackId);
      }
    }

    // 2. Detach these cells from any other animation
    for (const aName in doc.animations) {
      if (aName !== animKey && doc.animations[aName].frames && Array.isArray(doc.animations[aName].frames)) {
        doc.animations[aName].frames = doc.animations[aName].frames.filter(id => !rowCells.includes(id));
      }
    }

    const dispName = customDisplayName || animKey.replace(/_/g, ' ');

    // 3. Ensure target animation exists
    if (!doc.animations[animKey]) {
      doc.animations[animKey] = {
        name: dispName,
        direction: 'none',
        frames: [],
        fps: 6,
        loop: true,
        mode: 'loop'
      };
    }

    // 4. Assign all row cells to this animation
    doc.animations[animKey].frames = [...rowCells];

    // 5. Update cell metadata WITHOUT clearing or overwriting existing pixels!
    rowCells.forEach((cid, c) => {
      let cell = doc.cells[cid];
      if (!cell) {
        cell = {
          id: cid,
          name: `${dispName} ${c}`,
          row: rowIdx,
          col: c,
          direction: doc.animations[animKey].direction || 'none',
          frame: c,
          pixels: {}
        };
        doc.cells[cid] = cell;
      } else {
        // Cell exists: update coordinates and name, KEEP PIXELS INTACT!
        cell.row = rowIdx;
        cell.col = c;
        cell.frame = c;
        cell.name = `${dispName} ${c}`;
        if (doc.animations[animKey].direction && doc.animations[animKey].direction !== 'none') {
          cell.direction = doc.animations[animKey].direction;
        }
      }
    });

    state.saveSnapshot(`Assign Row ${rowIdx} to "${dispName}"`);
    triggerEventAutosave();
    refreshAll();
    populateAnimDropdowns();
    updateGridInspectorUI();
    if (studioAnimPlayer) studioAnimPlayer.render();
    if (animPlayer) animPlayer.render();
    showToast(`Row ${rowIdx} assigned to "${dispName}" (${cols} frames)!`, 'success');
  }

  function assignCellToAnimation(cellId, animName) {
    if (!state.doc || !state.doc.animations[animName]) return;

    for (const name in state.doc.animations) {
      const idx = state.doc.animations[name].frames.indexOf(cellId);
      if (idx >= 0) {
        state.doc.animations[name].frames.splice(idx, 1);
      }
    }

    state.doc.animations[animName].frames.push(cellId);
    triggerEventAutosave();
    if (animPlayer) animPlayer.render();
    if (studioAnimPlayer) studioAnimPlayer.render();
  }

  function applyRowBatchTag(rowIdx, actionName) {
    assignRowToAnimation(rowIdx, actionName);
  }

  function ensureGridDimensions(targetRows, targetCols = 4) {
    if (!state.doc) return;
    targetRows = Math.min(Math.max(1, parseInt(targetRows, 10) || 1), 256);
    targetCols = Math.min(Math.max(1, parseInt(targetCols, 10) || 1), 128);
    const doc = state.doc;

    // 1. Expand columns if needed
    while (doc.meta.grid.cols < targetCols) {
      const newC = doc.meta.grid.cols;
      doc.meta.grid.cols++;
      for (let r = 0; r < doc.meta.grid.rows; r++) {
        const cid = `cell_${r}_${newC}`;
        if (!doc.cells[cid]) {
          doc.cells[cid] = {
            id: cid,
            name: `Frame ${r},${newC}`,
            row: r,
            col: newC,
            direction: 'none',
            frame: newC,
            pixels: {}
          };
        }
      }
    }

    // 2. Expand rows if needed
    while (doc.meta.grid.rows < targetRows) {
      const newR = doc.meta.grid.rows;
      doc.meta.grid.rows++;
      for (let c = 0; c < doc.meta.grid.cols; c++) {
        const cid = `cell_${newR}_${c}`;
        if (!doc.cells[cid]) {
          doc.cells[cid] = {
            id: cid,
            name: `Action ${newR} Frame ${c}`,
            row: newR,
            col: c,
            direction: 'none',
            frame: c,
            pixels: {}
          };
        }
      }
    }
  }

  // ===========================================================================
  // ACTION & DIRECTION TEMPLATE GENERATOR MODAL LOGIC
  // ===========================================================================

  let currentTemplateMode = 4; // 4 or 8

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

  function openActionTemplateModal(mode = 4) {
    if (!dom.modalActionTemplate) return;
    currentTemplateMode = (mode === 8) ? 8 : 4;

    if (dom.btnMode4dir) dom.btnMode4dir.classList.toggle('active', currentTemplateMode === 4);
    if (dom.btnMode8dir) dom.btnMode8dir.classList.toggle('active', currentTemplateMode === 8);

    // Auto-populate columns from current grid
    if (state.doc && dom.templateColsInput) {
      dom.templateColsInput.value = state.doc.meta.grid.cols || 4;
    }

    // Auto-detect a smart starting row:
    if (state.doc && dom.templateStartRow) {
      let maxRow = 0;
      let hasCells = false;
      for (const cid in state.doc.cells) {
        const parts = cid.split('_');
        if (parts.length >= 3) {
          const r = parseInt(parts[1], 10);
          if (r >= maxRow) maxRow = r + 1;
          hasCells = true;
        }
      }
      const hasAnims = Object.keys(state.doc.animations || {}).length > 0;
      dom.templateStartRow.value = (hasCells && hasAnims) ? maxRow : 0;
    }

    syncActiveActionChip();
    renderTemplateLivePreview();

    dom.modalActionTemplate.classList.remove('hidden');
    if (dom.templateActionInput) {
      dom.templateActionInput.focus();
      dom.templateActionInput.select();
    }
  }

  function closeActionTemplateModal() {
    if (dom.modalActionTemplate) {
      dom.modalActionTemplate.classList.add('hidden');
    }
  }

  function syncActiveActionChip() {
    if (!dom.actionChipsContainer || !dom.templateActionInput) return;
    const currentVal = dom.templateActionInput.value.trim().toLowerCase();
    const chips = dom.actionChipsContainer.querySelectorAll('.chip-btn');
    chips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.action === currentVal);
    });
  }

  function renderTemplateLivePreview() {
    if (!dom.templateLivePreview) return;
    const actionRaw = dom.templateActionInput ? dom.templateActionInput.value.trim() : 'idle';
    const action = (actionRaw || 'action').toLowerCase().replace(/\s+/g, '_');
    const actionTitle = action.charAt(0).toUpperCase() + action.slice(1);
    const dirs = (currentTemplateMode === 8) ? DIRECTIONS_8 : DIRECTIONS_4;
    const cols = Math.max(1, parseInt(dom.templateColsInput?.value, 10) || 4);
    const fps = Math.max(1, parseInt(dom.templateFpsInput?.value, 10) || 6);
    const startRow = Math.max(0, parseInt(dom.templateStartRow?.value, 10) || 0);

    if (dom.templateSummaryBadge) {
      dom.templateSummaryBadge.textContent = `${dirs.length} Rows × ${cols} Frames (${dirs.length * cols} cells @ ${fps} FPS)`;
    }

    let html = '';
    dirs.forEach((d, idx) => {
      const rowIdx = startRow + idx;
      const clipKey = `${action}_${d.id}`;
      const clipName = `${actionTitle} ${d.label}`;
      const firstFrame = `${action}_${d.id}_0`;
      const lastFrame = `${action}_${d.id}_${cols - 1}`;
      const rangeText = (cols === 1) ? firstFrame : `${firstFrame} → ${lastFrame}`;

      let statusNotice = '';
      if (state.doc) {
        let hasArtwork = false;
        for (let c = 0; c < cols; c++) {
          const cid = `cell_${rowIdx}_${c}`;
          if (state.doc.cells[cid] && Object.keys(state.doc.cells[cid].pixels || {}).length > 0) {
            hasArtwork = true;
            break;
          }
        }
        if (hasArtwork) {
          statusNotice = `<span class="badge-tag" style="background: rgba(245, 158, 11, 0.15); color: #d97706;" title="Artwork in this row is 100% kept"><i class="fa-solid fa-shield-halved"></i> Keep Artwork</span>`;
        } else {
          statusNotice = `<span class="badge-tag" style="background: rgba(99, 102, 241, 0.12); color: #6366f1;">New Frames</span>`;
        }
      }

      const safeKey = escapeHTML(clipKey);
      const safeName = escapeHTML(clipName);
      const safeRange = escapeHTML(rangeText);

      html += `
        <div class="template-preview-row">
          <div>
            <strong class="anim-key">Row ${rowIdx}: ${safeKey}</strong>
            <span class="anim-tag">("${safeName}")</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="sub-text" style="font-size: 11px;">${safeRange}</span>
            ${statusNotice}
          </div>
        </div>
      `;
    });

    dom.templateLivePreview.innerHTML = html;
  }

  function applyActionTemplate() {
    if (!state.doc) return;
    const actionRaw = dom.templateActionInput ? dom.templateActionInput.value.trim() : 'idle';
    if (!actionRaw) {
      showToast('Please enter an action name!', 'error');
      return;
    }
    if (typeof PIX2 !== 'undefined' && !PIX2.isSafeIdentifier(actionRaw)) {
      showToast(`Action name contains reserved keyword "${actionRaw}".`, 'error');
      return;
    }
    const safeAction = (typeof PIX2 !== 'undefined') ? PIX2.sanitizeKey(actionRaw.toLowerCase().replace(/\s+/g, '_'), 'idle') : actionRaw.toLowerCase().replace(/\s+/g, '_');
    const action = safeAction;
    const actionTitle = action.charAt(0).toUpperCase() + action.slice(1);
    const dirs = (currentTemplateMode === 8) ? DIRECTIONS_8 : DIRECTIONS_4;
    const cols = Math.max(1, parseInt(dom.templateColsInput?.value, 10) || 4);
    const fps = Math.max(1, parseInt(dom.templateFpsInput?.value, 10) || 6);
    const startRow = Math.max(0, parseInt(dom.templateStartRow?.value, 10) || 0);

    state.beginStroke(`Apply Template ${action} (${dirs.length}-Dir)`);

    // Ensure grid has enough rows and cols
    const targetRows = Math.max(state.doc.meta.grid.rows, startRow + dirs.length);
    const targetCols = Math.max(state.doc.meta.grid.cols, cols);
    ensureGridDimensions(targetRows, targetCols);

    // Apply each direction row
    dirs.forEach((d, idx) => {
      const rowIdx = startRow + idx;
      const clipKey = `${action}_${d.id}`;
      const clipName = `${actionTitle} ${d.label}`;
      const frameList = [];

      for (let c = 0; c < cols; c++) {
        const cellId = `cell_${rowIdx}_${c}`;
        const frameName = `${action}_${d.id}_${c}`;

        if (!state.doc.cells[cellId]) {
          state.doc.cells[cellId] = {
            id: cellId,
            name: frameName,
            direction: d.id,
            pixels: {}
          };
        } else {
          // 100% PRESERVE EXISTING PIXEL ARTWORK
          state.doc.cells[cellId].name = frameName;
          state.doc.cells[cellId].direction = d.id;
        }
        frameList.push(cellId);
      }

      state.doc.animations[clipKey] = {
        name: clipName,
        direction: d.id,
        frames: frameList,
        fps: fps,
        loop: true,
        mode: 'loop'
      };
    });

    state.endStroke(`Applied Template: ${action}`);
    triggerEventAutosave();
    refreshAll();
    populateAnimDropdowns();
    updateGridInspectorUI();
    updateStudioUI();
    closeActionTemplateModal();

    showToast(`Generated ${dirs.length}-Direction template for '${action}' (${dirs.length} rows × ${cols} frames)!`, 'success');
  }

  function autoSetup4Directions() {
    openActionTemplateModal(4);
  }

  function autoSetup8Directions() {
    openActionTemplateModal(8);
  }

  // ===========================================================================
  // DEDICATED ANIMATION STUDIO WORKSPACE LOGIC
  // ===========================================================================

  function renderDedicatedAnimationStudio() {
    if (!state.doc) return;
    const anims = state.doc.animations;
    const animNames = Object.keys(anims);

    if (animNames.length === 0) {
      anims['idle'] = { name: 'Idle', direction: 'none', frames: ['cell_0_0'], fps: 6, loop: true, mode: 'loop' };
      activeStudioClipId = 'idle';
    } else if (!anims[activeStudioClipId]) {
      activeStudioClipId = animNames[0];
    }

    const currentClip = anims[activeStudioClipId];

    if (dom.studioAnimList) {
      dom.studioAnimList.innerHTML = '';
      animNames.forEach(name => {
        const clip = anims[name];
        const item = document.createElement('div');
        item.className = `anim-clip-item ${name === activeStudioClipId ? 'active' : ''}`;
        item.style.cursor = 'pointer';

        const titleSpan = document.createElement('span');
        const strongEl = document.createElement('strong');
        strongEl.textContent = clip.name || name;
        titleSpan.appendChild(strongEl);

        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'anim-clip-badge';
        badgeSpan.textContent = `${(clip.frames || []).length} frames @ ${clip.fps || 6}fps`;

        item.appendChild(titleSpan);
        item.appendChild(badgeSpan);
        item.addEventListener('click', () => {
          activeStudioClipId = name;
          renderDedicatedAnimationStudio();
        });
        dom.studioAnimList.appendChild(item);
      });
    }

    if (dom.studioClipName) dom.studioClipName.value = currentClip.name || activeStudioClipId;
    if (dom.studioClipFps) {
      dom.studioClipFps.value = currentClip.fps || 6;
      if (dom.studioClipFpsLabel) dom.studioClipFpsLabel.textContent = `${currentClip.fps || 6} fps`;
    }
    if (dom.studioClipMode) dom.studioClipMode.value = currentClip.mode || (currentClip.loop !== false ? 'loop' : 'once');
    if (dom.studioClipDir) dom.studioClipDir.value = currentClip.direction || 'none';
    if (dom.studioActiveClipTitle) dom.studioActiveClipTitle.textContent = currentClip.name || activeStudioClipId;

    if (studioAnimPlayer) {
      studioAnimPlayer.setAnimation(activeStudioClipId);
      studioAnimPlayer.fps = currentClip.fps || 6;
      studioAnimPlayer.render();
    }

    renderTimelineFramesStrip(currentClip);
  }

  function updateStudioActiveFrameUI(idx, cellId) {
    if (!state.doc) return;
    const clip = state.doc.animations[activeStudioClipId];
    const frames = clip ? (clip.frames || []) : [];
    const safeIdx = (idx !== undefined && idx !== null) ? Math.max(0, Math.min(idx, Math.max(0, frames.length - 1))) : 0;
    const actualCellId = cellId || (frames.length > 0 ? frames[safeIdx] : null);
    const cell = actualCellId ? state.doc.cells[actualCellId] : null;
    const frameName = cell ? (cell.name || actualCellId) : (actualCellId || 'None');

    if (dom.studioActiveFrameText) {
      dom.studioActiveFrameText.textContent = `#${safeIdx}: ${frameName}`;
    }
    if (dom.timelineSelectedFrameInfo) {
      dom.timelineSelectedFrameInfo.textContent = `Selected: #${safeIdx} - ${frameName}`;
    }
    if (dom.studioFrameIdxBadge) {
      dom.studioFrameIdxBadge.textContent = `#${safeIdx}`;
    }
    if (dom.studioFrameCellId) {
      dom.studioFrameCellId.value = actualCellId || '';
    }
    if (dom.studioFrameNameInput) {
      if (document.activeElement !== dom.studioFrameNameInput) {
        dom.studioFrameNameInput.value = (cell && cell.name) ? cell.name : (frameName || '');
      }
    }

    if (dom.timelineFramesStrip) {
      const cards = dom.timelineFramesStrip.querySelectorAll('.timeline-frame-card');
      cards.forEach((c) => {
        const cIdx = parseInt(c.getAttribute('data-idx'), 10);
        c.classList.toggle('active', cIdx === safeIdx);
      });
    }
  }

  function selectStudioFrame(idx) {
    if (!state.doc) return;
    const clip = state.doc.animations[activeStudioClipId];
    if (!clip || !clip.frames || clip.frames.length === 0) return;
    const safeIdx = Math.max(0, Math.min(idx, clip.frames.length - 1));
    const cellId = clip.frames[safeIdx];

    // Explicit selection pauses playback so the user can inspect or edit that frame
    if (studioAnimPlayer) {
      if (studioAnimPlayer.isPlaying) {
        studioAnimPlayer.stop();
        updateStudioPlayButtonUI();
      }
      studioAnimPlayer.currentFrameIdx = safeIdx;
      studioAnimPlayer.render();
    }
    updateStudioActiveFrameUI(safeIdx, cellId);
  }

  function renderTimelineFramesStrip(clip) {
    if (!dom.timelineFramesStrip || !clip) return;
    dom.timelineFramesStrip.innerHTML = '';

    const frames = clip.frames || [];
    if (dom.studioTimelineFrameCounter) {
      dom.studioTimelineFrameCounter.textContent = `${frames.length} frames`;
    }

    frames.forEach((cellId, idx) => {
      const cell = state.doc.cells[cellId];
      const card = document.createElement('div');
      card.setAttribute('data-idx', idx);
      card.className = `timeline-frame-card ${studioAnimPlayer && studioAnimPlayer.currentFrameIdx === idx ? 'active' : ''}`;
      card.title = `${cell ? (cell.name || cellId) : cellId} (${cellId}) - Click to select, Double-click to edit`;

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.className = 'timeline-thumbnail-canvas';
      thumbCanvas.width = 16;
      thumbCanvas.height = 16;
      const tctx = thumbCanvas.getContext('2d');
      if (cell && cell.pixels) {
        for (const coord in cell.pixels) {
          const [x, y] = coord.split(',').map(Number);
          tctx.fillStyle = cell.pixels[coord];
          tctx.fillRect(x, y, 1, 1);
        }
      }
      card.appendChild(thumbCanvas);

      const info = document.createElement('span');
      info.className = 'timeline-frame-info';
      info.textContent = `#${idx}: ${cell ? (cell.name || cellId) : cellId}`;
      card.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'timeline-card-actions';

      if (idx > 0) {
        const btnLeft = document.createElement('button');
        btnLeft.className = 'timeline-mini-btn';
        btnLeft.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        btnLeft.title = 'Move frame earlier';
        btnLeft.addEventListener('click', (e) => {
          e.stopPropagation();
          const tmp = clip.frames[idx - 1];
          clip.frames[idx - 1] = clip.frames[idx];
          clip.frames[idx] = tmp;
          triggerEventAutosave();
          renderTimelineFramesStrip(clip);
          if (studioAnimPlayer) studioAnimPlayer.render();
        });
        actions.appendChild(btnLeft);
      }

      if (idx < frames.length - 1) {
        const btnRight = document.createElement('button');
        btnRight.className = 'timeline-mini-btn';
        btnRight.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        btnRight.title = 'Move frame later';
        btnRight.addEventListener('click', (e) => {
          e.stopPropagation();
          const tmp = clip.frames[idx + 1];
          clip.frames[idx + 1] = clip.frames[idx];
          clip.frames[idx] = tmp;
          triggerEventAutosave();
          renderTimelineFramesStrip(clip);
          if (studioAnimPlayer) studioAnimPlayer.render();
        });
        actions.appendChild(btnRight);
      }

      const btnRemove = document.createElement('button');
      btnRemove.className = 'timeline-mini-btn btn-remove';
      btnRemove.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
      btnRemove.title = 'Remove frame from this animation';
      btnRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        clip.frames.splice(idx, 1);
        triggerEventAutosave();
        renderTimelineFramesStrip(clip);
        if (studioAnimPlayer) studioAnimPlayer.render();
      });
      actions.appendChild(btnRemove);

      card.appendChild(actions);

      card.addEventListener('click', (e) => {
        if (e.target.closest('.timeline-mini-btn')) return;
        selectStudioFrame(idx);
      });

      card.addEventListener('dblclick', (e) => {
        if (e.target.closest('.timeline-mini-btn')) return;
        selectStudioFrame(idx);
        if (cellId && state.doc && state.doc.cells[cellId]) {
          state.openCellTab(cellId);
          refreshAll();
        }
      });

      dom.timelineFramesStrip.appendChild(card);
    });

    const initialIdx = (studioAnimPlayer && studioAnimPlayer.currentFrameIdx !== undefined) ? studioAnimPlayer.currentFrameIdx : 0;
    updateStudioActiveFrameUI(initialIdx, frames[initialIdx]);
  }

  // ===========================================================================
  // CELL EDITOR RENDERING & DRAWING
  // ===========================================================================

  let isPointerDown = false;
  let lastPixelX = null;
  let lastPixelY = null;
  let dragStartX = null;
  let dragStartY = null;

  function renderCellEditor() {
    const cell = state.getActiveCell();
    if (!cell || !state.doc) return;

    const cw = state.doc.meta.cellSize.w;
    const ch = state.doc.meta.cellSize.h;
    const zoom = state.cellZoom;

    dom.cellCanvas.width = cw * zoom;
    dom.cellCanvas.height = ch * zoom;
    dom.cellOverlay.width = cw * zoom;
    dom.cellOverlay.height = ch * zoom;

    const ctx = dom.cellCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // 1. Checkerboard
    if (state.checkerboardBg) {
      drawChecker(ctx, 0, 0, cw * zoom, ch * zoom, zoom);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw * zoom, ch * zoom);
    }

    // 2. Draw non-transparent pixels
    for (const coord in cell.pixels) {
      const [x, y] = coord.split(',').map(Number);
      ctx.fillStyle = cell.pixels[coord];
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }

    // 3. Grid lines
    if (state.showGridLines && zoom >= 8) {
      const isDark = document.body.classList.contains('dark-theme');
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= cw; x++) {
        ctx.beginPath();
        ctx.moveTo(x * zoom - 0.5, 0);
        ctx.lineTo(x * zoom - 0.5, ch * zoom);
        ctx.stroke();
      }
      for (let y = 0; y <= ch; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * zoom - 0.5);
        ctx.lineTo(cw * zoom, y * zoom - 0.5);
        ctx.stroke();
      }
    }

    // 4. Symmetry Guide line
    if (state.symmetry) {
      const axisX = (cw - 1) / 2;
      const screenAxisX = (axisX + 0.5) * zoom;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(screenAxisX, 0);
      ctx.lineTo(screenAxisX, ch * zoom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (dom.labelResolution) {
      dom.labelResolution.textContent = `${cw} × ${ch} px`;
    }
  }

  function renderCellRulers() {
    if (!state.doc || !state.showRulers) {
      dom.rulerTop.style.display = 'none';
      dom.rulerLeft.style.display = 'none';
      return;
    }
    dom.rulerTop.style.display = 'flex';
    dom.rulerLeft.style.display = 'flex';

    const cw = state.doc.meta.cellSize.w;
    const ch = state.doc.meta.cellSize.h;
    const zoom = state.cellZoom;

    // Top ruler ticks
    dom.rulerTop.innerHTML = '';
    for (let x = 0; x < cw; x++) {
      const tick = document.createElement('div');
      tick.className = 'ruler-tick';
      tick.style.width = `${zoom}px`;
      if (x % 4 === 0 || x === cw - 1) {
        tick.textContent = x;
      }
      dom.rulerTop.appendChild(tick);
    }

    // Left ruler ticks
    dom.rulerLeft.innerHTML = '';
    for (let y = 0; y < ch; y++) {
      const tick = document.createElement('div');
      tick.className = 'ruler-tick-v';
      tick.style.height = `${zoom}px`;
      if (y % 4 === 0 || y === ch - 1) {
        tick.textContent = y;
      }
      dom.rulerLeft.appendChild(tick);
    }
  }

  function renderMiniPreview() {
    const cell = state.getActiveCell();
    if (!cell || !state.doc || !dom.miniPreviewCanvas) return;

    const cw = (cell.size && cell.size.w) || (state.doc ? state.doc.meta.cellSize.w : 16);
    const ch = (cell.size && cell.size.h) || (state.doc ? state.doc.meta.cellSize.h : 16);
    const scale = miniPreviewScale || 6;

    dom.miniPreviewCanvas.width = cw * scale;
    dom.miniPreviewCanvas.height = ch * scale;
    const ctx = dom.miniPreviewCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    drawChecker(ctx, 0, 0, cw * scale, ch * scale, 6);

    for (const coord in cell.pixels) {
      const [x, y] = coord.split(',').map(Number);
      ctx.fillStyle = cell.pixels[coord];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  // ===========================================================================
  // PALETTE UI & PRESETS LIBRARY (Custom Library + Built-in Presets)
  // ===========================================================================

  const CUSTOM_PALETTES_STORAGE_KEY = 'noiradix_custom_palettes';

  function loadCustomPalettes() {
    try {
      const raw = localStorage.getItem(CUSTOM_PALETTES_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveCustomPalettes(palettesObj) {
    try {
      localStorage.setItem(CUSTOM_PALETTES_STORAGE_KEY, JSON.stringify(palettesObj));
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
      { id: 'wispling', name: 'Wispling Ghost', count: 8 },
      { id: 'pico8', name: 'Pico-8', count: 16 },
      { id: 'gameboy', name: 'GameBoy', count: 4 },
      { id: 'endesga32', name: 'Endesga 32', count: 32 }
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
    newOpt.textContent = '+ Save Current Palette...';
    actionGroup.appendChild(newOpt);
    dom.paletteSelect.appendChild(actionGroup);

    if (prevVal && dom.paletteSelect.querySelector(`option[value="${prevVal}"]`)) {
      dom.paletteSelect.value = prevVal;
    }
  }

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

  function commitFloatingSelection() {
    if (!floatingSelectionPixels || !floatingOriginalSel) return;
    const cell = state.getActiveCell();
    if (cell) {
      const cw = (cell.size && cell.size.w) || (state.doc ? state.doc.meta.cellSize.w : 16);
      const ch = (cell.size && cell.size.h) || (state.doc ? state.doc.meta.cellSize.h : 16);
      if (!cell.pixels) cell.pixels = {};
      for (const relKey in floatingSelectionPixels) {
        const [rx, ry] = relKey.split(',').map(Number);
        const destX = floatingCurrentX + rx;
        const destY = floatingCurrentY + ry;
        if (destX >= 0 && destX < cw && destY >= 0 && destY < ch) {
          cell.pixels[`${destX},${destY}`] = floatingSelectionPixels[relKey];
        }
      }
      state.selection = {
        x: floatingCurrentX,
        y: floatingCurrentY,
        w: floatingOriginalSel.w,
        h: floatingOriginalSel.h
      };
      state.endStroke('Move Selection');
      triggerEventAutosave();
      renderCellEditor();
      renderMiniPreview();
    }
    floatingSelectionPixels = null;
    floatingOriginalSel = null;
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
  }

  function handleCellMouseDown(e) {
    if (e.button === 1 || e.spaceKey || state.currentTool === 'pan') return;
    if (e.button === 2) return; // Right-click handled by contextmenu listener

    const coords = getPixelCoords(e);
    if (!coords) return;

    const cell = state.getActiveCell();
    if (!cell) return;
    const tool = state.currentTool;

    // Check if clicking inside active selection
    if (state.selection && coords.x >= state.selection.x && coords.x < state.selection.x + state.selection.w &&
        coords.y >= state.selection.y && coords.y < state.selection.y + state.selection.h) {
      // User clicked INSIDE active selection -> Start moving/dragging it!
      isMovingSelection = true;
      isPointerDown = true;
      moveStartX = coords.x;
      moveStartY = coords.y;

      if (!floatingSelectionPixels) {
        floatingOriginalSel = { ...state.selection };
        floatingCurrentX = floatingOriginalSel.x;
        floatingCurrentY = floatingOriginalSel.y;
        floatingSelectionPixels = {};
        state.beginStroke();
        for (let py = 0; py < floatingOriginalSel.h; py++) {
          for (let px = 0; px < floatingOriginalSel.w; px++) {
            const key = `${floatingOriginalSel.x + px},${floatingOriginalSel.y + py}`;
            if (cell.pixels && cell.pixels[key]) {
              floatingSelectionPixels[`${px},${py}`] = cell.pixels[key];
              delete cell.pixels[key];
            }
          }
        }
        renderCellEditor();
      }
      renderMovingSelectionOverlay();
      return;
    }

    // User clicked OUTSIDE active selection:
    if (state.selection) {
      commitFloatingSelection();
      state.selection = null; // Disappears when clicking outside!
      renderCellOverlay(coords.x, coords.y);
    }

    isPointerDown = true;
    dragStartX = coords.x;
    dragStartY = coords.y;
    lastPixelX = coords.x;
    lastPixelY = coords.y;

    if (tool !== 'select') {
      state.beginStroke();
    }

    const color = (e.button === 2) ? state.secondaryColor : state.primaryColor;

    if (tool === 'pen') {
      Tools.plotPixel(cell, coords.x, coords.y, color, state.symmetry, state.doc.meta.cellSize.w);
      renderCellEditor();
      renderMiniPreview();
    } else if (tool === 'eraser') {
      Tools.erasePixel(cell, coords.x, coords.y, state.symmetry, state.doc.meta.cellSize.w);
      renderCellEditor();
      renderMiniPreview();
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
    } else if (tool === 'line' || tool === 'rect' || tool === 'select') {
      renderShapeOverlay(dragStartX, dragStartY, coords.x, coords.y, tool, color);
    }
  }

  function handleCellMouseMove(e) {
    const coords = getPixelCoords(e);
    updateStatusBarCoords(coords ? coords.x : null, coords ? coords.y : null);

    if (state.currentTool === 'pan') {
      dom.cellOverlay.style.cursor = 'grab';
      return;
    }

    // Hover cursor update: inside selection -> move cursor
    if (coords && state.selection && !isPointerDown) {
      if (coords.x >= state.selection.x && coords.x < state.selection.x + state.selection.w &&
          coords.y >= state.selection.y && coords.y < state.selection.y + state.selection.h) {
        dom.cellOverlay.style.cursor = 'move';
      } else {
        dom.cellOverlay.style.cursor = (state.currentTool === 'picker') ? 'crosshair' : 'default';
      }
    }

    if (!isPointerDown) {
      if (coords) renderCellOverlay(coords.x, coords.y);
      return;
    }

    if (!coords) return;

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

    if (tool === 'pen') {
      if (coords.x !== lastPixelX || coords.y !== lastPixelY) {
        Tools.plotLine(cell, lastPixelX, lastPixelY, coords.x, coords.y, color, state.symmetry, state.doc.meta.cellSize.w);
        lastPixelX = coords.x;
        lastPixelY = coords.y;
        renderCellEditor();
        renderMiniPreview();
      }
    } else if (tool === 'eraser') {
      if (coords.x !== lastPixelX || coords.y !== lastPixelY) {
        Tools.eraseLine(cell, lastPixelX, lastPixelY, coords.x, coords.y, state.symmetry, state.doc.meta.cellSize.w);
        lastPixelX = coords.x;
        lastPixelY = coords.y;
        renderCellEditor();
        renderMiniPreview();
      }
    } else if (tool === 'line' || tool === 'rect' || tool === 'select') {
      renderShapeOverlay(dragStartX, dragStartY, coords.x, coords.y, tool, color);
    }
  }

  function handleCellMouseUp(e) {
    if (!isPointerDown) return;
    isPointerDown = false;

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
    if (!cell || !coords) {
      renderCellOverlay();
      return;
    }

    const color = (e.button === 2) ? state.secondaryColor : state.primaryColor;
    const tool = state.currentTool;

    if (tool === 'line') {
      Tools.plotLine(cell, dragStartX, dragStartY, coords.x, coords.y, color, state.symmetry, state.doc.meta.cellSize.w);
      state.endStroke('Line Draw');
      triggerEventAutosave();
      refreshAll();
    } else if (tool === 'rect') {
      Tools.plotRect(cell, dragStartX, dragStartY, coords.x, coords.y, color, false, state.symmetry, state.doc.meta.cellSize.w);
      state.endStroke('Rectangle Draw');
      triggerEventAutosave();
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
    } else if (tool === 'pen' || tool === 'eraser') {
      state.endStroke(tool === 'pen' ? 'Pencil Stroke' : 'Eraser Stroke');
      triggerEventAutosave();
      refreshAll();
    }
    renderCellOverlay();
  }

  function clearOverlay() {
    if (!dom.cellOverlay) return;
    const ctx = dom.cellOverlay.getContext('2d');
    ctx.clearRect(0, 0, dom.cellOverlay.width, dom.cellOverlay.height);
  }

  function renderCellOverlay(hoverPx = null, hoverPy = null) {
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

        // 4 Corner grip handles
        const handleSize = Math.max(3, Math.min(6, Math.floor(zoom / 3)));
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(sx - handleSize/2, sy - handleSize/2, handleSize, handleSize);
        ctx.fillRect(sx + sw - handleSize/2, sy - handleSize/2, handleSize, handleSize);
        ctx.fillRect(sx - handleSize/2, sy + sh - handleSize/2, handleSize, handleSize);
        ctx.fillRect(sx + sw - handleSize/2, sy + sh - handleSize/2, handleSize, handleSize);
      }
    }

    // 2. Draw Hover Preview (Pixel cursor)
    if (hoverPx !== null && hoverPy !== null) {
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(hoverPx * zoom, hoverPy * zoom, zoom, zoom);
    }
  }

  function renderShapeOverlay(x0, y0, x1, y1, tool, color) {
    clearOverlay();
    if (!dom.cellOverlay || !state.doc) return;
    const ctx = dom.cellOverlay.getContext('2d');
    const zoom = state.cellZoom;
    const cw = state.doc.meta.cellSize.w;
    const ch = state.doc.meta.cellSize.h;

    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    if (tool === 'rect') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(minX * zoom, minY * zoom, (maxX - minX + 1) * zoom, (maxY - minY + 1) * zoom);

      if (state.symmetry) {
        const symMinX = cw - 1 - maxX;
        const symMaxX = cw - 1 - minX;
        ctx.strokeRect(symMinX * zoom, minY * zoom, (symMaxX - symMinX + 1) * zoom, (maxY - minY + 1) * zoom);
      }
    } else if (tool === 'line') {
      ctx.fillStyle = color;
      const plot = (x, y) => {
        if (x >= 0 && x < cw && y >= 0 && y < ch) {
          ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        }
        if (state.symmetry) {
          const symX = cw - 1 - x;
          if (symX >= 0 && symX < cw && y >= 0 && y < ch) {
            ctx.fillRect(symX * zoom, y * zoom, zoom, zoom);
          }
        }
      };

      if (typeof Tools !== 'undefined' && typeof Tools.line === 'function') {
        Tools.line(x0, y0, x1, y1, plot);
      } else if (typeof PIX2 !== 'undefined' && typeof PIX2.drawLineBresenham === 'function') {
        PIX2.drawLineBresenham(x0, y0, x1, y1, plot);
      } else {
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;
        let curX = x0, curY = y0;
        while (true) {
          plot(curX, curY);
          if (curX === x1 && curY === y1) break;
          let e2 = 2 * err;
          if (e2 > -dy) { err -= dy; curX += sx; }
          if (e2 < dx) { err += dx; curY += sy; }
        }
      }
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
    const copiedPixels = {};
    let count = 0;

    for (let py = 0; py < sel.h; py++) {
      for (let px = 0; px < sel.w; px++) {
        const key = `${sel.x + px},${sel.y + py}`;
        if (cell.pixels && cell.pixels[key]) {
          copiedPixels[`${px},${py}`] = cell.pixels[key];
          count++;
        }
      }
    }

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

    executeSelectionCopy();

    state.beginStroke();
    const sel = state.selection;
    for (let py = 0; py < sel.h; py++) {
      for (let px = 0; px < sel.w; px++) {
        const key = `${sel.x + px},${sel.y + py}`;
        if (cell.pixels) delete cell.pixels[key];
      }
    }

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

    const clip = state.clipboard;
    const cw = (cell.size && cell.size.w) || (state.doc ? state.doc.meta.cellSize.w : 16);
    const ch = (cell.size && cell.size.h) || (state.doc ? state.doc.meta.cellSize.h : 16);

    let px = (targetX !== null) ? targetX : (state.selection ? state.selection.x : clip.originX);
    let py = (targetY !== null) ? targetY : (state.selection ? state.selection.y : clip.originY);

    px = Math.max(0, Math.min(cw - 1, px));
    py = Math.max(0, Math.min(ch - 1, py));

    state.beginStroke();
    if (!cell.pixels) cell.pixels = {};

    let pastedCount = 0;
    for (const relKey in clip.pixels) {
      const [rx, ry] = relKey.split(',').map(Number);
      const destX = px + rx;
      const destY = py + ry;
      if (destX >= 0 && destX < cw && destY >= 0 && destY < ch) {
        cell.pixels[`${destX},${destY}`] = clip.pixels[relKey];
        pastedCount++;
      }
    }

    state.selection = {
      x: px,
      y: py,
      w: Math.min(clip.w, cw - px),
      h: Math.min(clip.h, ch - py)
    };

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
      floatingSelectionPixels = null;
      floatingOriginalSel = null;
      state.selection = null;
      state.endStroke('Delete Floating Selection');
      triggerEventAutosave();
      renderCellEditor();
      renderMiniPreview();
      renderCellOverlay();
      showToast('Deleted selection (Del)', 'info');
      return;
    }

    if (state.selection) {
      state.beginStroke();
      const sel = state.selection;
      for (let py = 0; py < sel.h; py++) {
        for (let px = 0; px < sel.w; px++) {
          const key = `${sel.x + px},${sel.y + py}`;
          if (cell.pixels) delete cell.pixels[key];
        }
      }
      state.selection = null;
      state.endStroke('Delete Selection');
      triggerEventAutosave();
      refreshAll();
      renderCellOverlay();
      showToast(`Deleted selection (${sel.w}×${sel.h}) (Del)`);
    } else {
      if (confirm(`Clear all pixels in ${cell.name || cell.id}?`)) {
        state.beginStroke();
        cell.pixels = {};
        state.endStroke('Clear Cell');
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
    state.beginStroke();
    const sel = state.selection;
    for (let py = 0; py < sel.h; py++) {
      for (let px = 0; px < sel.w; px++) {
        const key = `${sel.x + px},${sel.y + py}`;
        if (!cell.pixels) cell.pixels = {};
        cell.pixels[key] = state.primaryColor;
      }
    }
    state.endStroke('Fill Selection');
    triggerEventAutosave();
    refreshAll();
    renderCellOverlay();
    showToast(`Filled selection with ${state.primaryColor}`, 'success');
  }

  function executeSelectionFlip(horizontal = true) {
    const cell = state.getActiveCell();
    if (!cell) return;

    if (floatingSelectionPixels && floatingOriginalSel) {
      const temp = { ...floatingSelectionPixels };
      floatingSelectionPixels = {};
      for (const relKey in temp) {
        const [rx, ry] = relKey.split(',').map(Number);
        const newRx = horizontal ? (floatingOriginalSel.w - 1 - rx) : rx;
        const newRy = horizontal ? ry : (floatingOriginalSel.h - 1 - ry);
        floatingSelectionPixels[`${newRx},${newRy}`] = temp[relKey];
      }
      renderMovingSelectionOverlay();
      showToast(`Flipped selection ${horizontal ? 'Horizontally' : 'Vertically'}`);
      return;
    }

    if (!state.selection) {
      showToast('Select a region to flip.');
      return;
    }
    state.beginStroke();
    const sel = state.selection;
    const temp = {};

    for (let py = 0; py < sel.h; py++) {
      for (let px = 0; px < sel.w; px++) {
        const key = `${sel.x + px},${sel.y + py}`;
        if (cell.pixels && cell.pixels[key]) {
          temp[`${px},${py}`] = cell.pixels[key];
          delete cell.pixels[key];
        }
      }
    }

    for (const relKey in temp) {
      const [rx, ry] = relKey.split(',').map(Number);
      const newRx = horizontal ? (sel.w - 1 - rx) : rx;
      const newRy = horizontal ? ry : (sel.h - 1 - ry);
      cell.pixels[`${sel.x + newRx},${sel.y + newRy}`] = temp[relKey];
    }

    state.endStroke(horizontal ? 'Flip Horizontal' : 'Flip Vertical');
    triggerEventAutosave();
    refreshAll();
    renderCellOverlay();
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

    if (floatingSelectionPixels && floatingOriginalSel) {
      const temp = { ...floatingSelectionPixels };
      floatingSelectionPixels = {};
      const oldW = floatingOriginalSel.w;
      const oldH = floatingOriginalSel.h;
      for (const relKey in temp) {
        const [rx, ry] = relKey.split(',').map(Number);
        const newRx = oldH - 1 - ry;
        const newRy = rx;
        floatingSelectionPixels[`${newRx},${newRy}`] = temp[relKey];
      }
      floatingOriginalSel.w = oldH;
      floatingOriginalSel.h = oldW;
      if (state.selection) {
        state.selection.w = oldH;
        state.selection.h = oldW;
      }
      renderMovingSelectionOverlay();
      showToast(`Rotated selection 90° CW (${state.selection ? state.selection.w : oldH}×${state.selection ? state.selection.h : oldW})`);
      return;
    }

    if (!state.selection) {
      if (state.doc) {
        const cw = (cell.size && cell.size.w) || state.doc.meta.cellSize.w;
        const ch = (cell.size && cell.size.h) || state.doc.meta.cellSize.h;
        Tools.rotate90CW(cell, cw, ch);
        state.saveSnapshot('Rotate 90° Clockwise');
        triggerEventAutosave();
        refreshAll();
        showToast('Rotated cell 90° CW (R)');
      }
      return;
    }

    // Active selection on canvas (or full canvas via Ctrl+A)
    state.beginStroke();
    const sel = state.selection;
    const temp = {};
    for (let py = 0; py < sel.h; py++) {
      for (let px = 0; px < sel.w; px++) {
        const key = `${sel.x + px},${sel.y + py}`;
        if (cell.pixels && cell.pixels[key]) {
          temp[`${px},${py}`] = cell.pixels[key];
          delete cell.pixels[key];
        }
      }
    }

    const oldW = sel.w;
    const oldH = sel.h;
    sel.w = oldH;
    sel.h = oldW;

    const cellW = (cell.size && cell.size.w) || (state.doc ? state.doc.meta.cellSize.w : 16);
    const cellH = (cell.size && cell.size.h) || (state.doc ? state.doc.meta.cellSize.h : 16);

    for (const relKey in temp) {
      const [rx, ry] = relKey.split(',').map(Number);
      const newRx = oldH - 1 - ry;
      const newRy = rx;
      const destX = sel.x + newRx;
      const destY = sel.y + newRy;
      if (destX >= 0 && destX < cellW && destY >= 0 && destY < cellH) {
        cell.pixels[`${destX},${destY}`] = temp[relKey];
      }
    }

    state.endStroke('Rotate Selection 90° CW');
    triggerEventAutosave();
    refreshAll();
    renderCellOverlay();
    showToast(`Rotated selection 90° CW (${sel.w}×${sel.h}) (R)`);
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
    contextMenu.classList.remove('hidden');

    const menuW = 210;
    const menuH = 340;
    const posX = Math.min(x, window.innerWidth - menuW - 10);
    const posY = Math.min(y, window.innerHeight - menuH - 10);

    contextMenu.style.left = `${posX}px`;
    contextMenu.style.top = `${posY}px`;
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
    if (dom.statusZoomLabel) {
      dom.statusZoomLabel.textContent = `Zoom: ${state.cellZoom}×`;
    }
    if (dom.statusSymmetryLabel) {
      dom.statusSymmetryLabel.textContent = `Symmetry: ${state.symmetry ? 'ON (S)' : 'OFF (S)'}`;
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

  function initCanvasPanningAndZoom() {
    if (!dom.canvasViewport) return;

    let isSpacePressed = false;
    let isPanning = false;
    let startX = 0, startY = 0;
    let dragStartPanX = 0, dragStartPanY = 0;

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
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
      const rect = dom.cellOverlay.getBoundingClientRect();
      const oldZoom = state.cellZoom;
      const delta = e.deltaY < 0 ? 2 : -2;
      const newZoom = Math.max(4, Math.min(64, oldZoom + delta));
      if (newZoom === oldZoom) return;

      const cw = state.doc ? state.doc.meta.cellSize.w : 16;
      const ch = state.doc ? state.doc.meta.cellSize.h : 16;

      // Unscaled point under mouse cursor
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const unscaledX = mx / oldZoom;
      const unscaledY = my / oldZoom;

      state.cellZoom = newZoom;
      renderCellEditor();
      renderCellRulers();
      updateStatusBarCoords(null, null);

      // Keep pixel under mouse cursor stationary:
      const deltaW = (cw * (newZoom - oldZoom)) / 2;
      const deltaH = (ch * (newZoom - oldZoom)) / 2;
      const pixelShiftX = unscaledX * (newZoom - oldZoom);
      const pixelShiftY = unscaledY * (newZoom - oldZoom);

      panX += Math.round(deltaW - pixelShiftX);
      panY += Math.round(deltaH - pixelShiftY);
      applyCanvasTransform();
    }, { passive: false });
  }

  // ===========================================================================
  // DESKTOP-GRADE NATIVE FILE MANAGEMENT (File System Access API & Fallbacks)
  // ===========================================================================

  async function openFileNative() {
    if (isDocumentDirty) {
      const confirmDiscard = confirm('You have unsaved changes in current project. Discard changes and open new file?');
      if (!confirmDiscard) return;
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
        const file = await handle.getFile();
        const text = await file.text();
        const doc = PIX2.parse(text);
        currentFileHandle = handle;
        currentFileName = file.name;
        currentFilePath = file.name;
        lastSavedContent = text;
        lastKnownFileModified = file.lastModified;
        pendingExternalConflict = null;
        const btnReload = document.getElementById('btn-reload-file');
        if (btnReload) btnReload.classList.remove('pulse-warning');
        await persistFileHandle(handle);
        localStorage.setItem('noiradix_session_type', 'disk');
        localStorage.setItem('noiradix_active_file_name', currentFileName);
        localStorage.setItem('noiradix_active_file_path', currentFilePath);
        state.setDocument(doc);
        setDirty(false);
        refreshAll();
        showToast(`Opened ${file.name} from disk!`, 'success');
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

  async function saveFileNative(forceSaveAs = false) {
    if (!state.doc) return;
    if (typeof commitFloatingSelection === 'function') {
      commitFloatingSelection();
    }

    // If manual code editing is active, ensure edits are parsed into document before saving
    if (isCodeEditingUnlocked && dom.codeTextarea) {
      try {
        const parsed = PIX2.parse(dom.codeTextarea.value);
        state.setDocument(parsed, true);
      } catch (err) {
        showToast('Cannot save: PIX2 code has syntax errors. Please fix or lock before saving.', 'error');
        return;
      }
    }

    const text = PIX2.serialize(state.doc);

    // Direct Save to existing handle (Only if filename still matches and not forced to Save As)
    const isDirectHandleValid = currentFileHandle &&
                                'createWritable' in currentFileHandle &&
                                (!currentFileName || currentFileHandle.name.normalize('NFC') === currentFileName.normalize('NFC'));

    if (!forceSaveAs && isDirectHandleValid) {
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
        setDirty(false);
        lastSavedContent = text;
        try {
          const fresh = await currentFileHandle.getFile();
          lastKnownFileModified = fresh.lastModified;
        } catch (_) {}
        pendingExternalConflict = null;
        const btnReload = document.getElementById('btn-reload-file');
        if (btnReload) btnReload.classList.remove('pulse-warning');
        localStorage.setItem('noiradix_session_type', 'disk');
        localStorage.setItem('noiradix_active_file_name', currentFileName);
        localStorage.setItem('noiradix_active_file_path', currentFilePath);
        localStorage.setItem('pix2_last_saved_content', text);
        localStorage.removeItem('pix2_recovery_snapshot');
        showToast(`Saved to ${currentFileHandle.name}!`, 'success');
        updateFileStatusUI();
        return;
      } catch (err) {
        console.warn('Direct overwrite failed:', err);
        showToast(`Could not write directly to ${currentFileHandle.name}: ${err.message}`, 'error');
        return;
      }
    }

    // Save As via File System Access API (Only when forceSaveAs is true or no handle exists)
    if ('showSaveFilePicker' in window) {
      try {
        const suggested = currentFileName || sanitizeSafeFilename(state.doc ? state.doc.meta.title : null, '.pix2', 'sprite');
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
        currentFilePath = handle.name;
        lastSavedContent = text;
        try {
          const fresh = await handle.getFile();
          lastKnownFileModified = fresh.lastModified;
        } catch (_) {}
        pendingExternalConflict = null;
        const btnReload = document.getElementById('btn-reload-file');
        if (btnReload) btnReload.classList.remove('pulse-warning');
        await persistFileHandle(handle);
        localStorage.setItem('noiradix_session_type', 'disk');
        localStorage.setItem('noiradix_active_file_name', currentFileName);
        localStorage.setItem('noiradix_active_file_path', currentFilePath);
        localStorage.setItem('pix2_last_saved_content', text);
        setDirty(false);
        localStorage.removeItem('pix2_recovery_snapshot');
        refreshAll();
        showToast(`Saved as ${handle.name}!`, 'success');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Save file picker failed, falling back to download:', err);
      }
    }

    fallbackDownloadSave(text);
  }

  function fallbackDownloadSave(text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileNameToDownload = currentFileName || sanitizeSafeFilename(state.doc ? state.doc.meta.title : null, '.pix2', 'sprite');
    a.download = fileNameToDownload;
    a.click();
    URL.revokeObjectURL(url);
    setDirty(false);
    showToast(`Downloaded ${fileNameToDownload}!`, 'success');
  }

  // ===========================================================================
  // REAL-TIME FILE WATCHER & LIVE HOT-RELOAD (External AI & Tool Collaboration)
  // ===========================================================================

  async function checkAndReloadExternalFileChanges(force = false) {
    if (!currentFileHandle || isExternalReloading) return;
    if (typeof currentFileHandle.getFile !== 'function') return;

    try {
      isExternalReloading = true;
      const file = await currentFileHandle.getFile();
      const currentModified = file.lastModified;

      // Check if file modified time is newer than our recorded timestamp
      if (!force && lastKnownFileModified > 0 && currentModified <= lastKnownFileModified) {
        isExternalReloading = false;
        return;
      }

      const text = await file.text();
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
      const newDoc = PIX2.parse(text);
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

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function splitLineComment(rawLine) {
    if (!rawLine) return { code: '', comment: '' };
    const semiIdx = rawLine.indexOf(';');
    const text = (semiIdx >= 0 ? rawLine.slice(0, semiIdx) : rawLine);
    let comment = (semiIdx >= 0 ? rawLine.slice(semiIdx) : '');

    let code = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' || ch === "'") inQuote = !inQuote;
      if (!inQuote && ch === '#') {
        const rest = text.slice(i);
        const hexMatch = rest.match(/^#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?=[\s,;"']|$)/);
        if (hexMatch) {
          code += hexMatch[0];
          i += hexMatch[0].length - 1;
          continue;
        } else {
          comment = text.slice(i) + comment;
          break;
        }
      }
      code += ch;
    }
    return { code, comment };
  }

  function highlightPix2Code(code) {
    if (!code) return '';
    const lines = code.split('\n');
    return lines.map((line, idx) => {
      const { code: codePart, comment: commentPart } = splitLineComment(line);

      let html = escapeHtml(codePart);

      // 1. Strings (mask to avoid token collision)
      const strMap = [];
      html = html.replace(/(&quot;.*?&quot;|"[^"]*"|'[^']*')/g, (m) => {
        strMap.push('<span class="syn-str">' + m + '</span>');
        return '___PIXSTR_' + (strMap.length - 1) + '___';
      });

      // 2. Hex colors with color preview dot swatch (mask before number detection to prevent numeric hex like #080610 corruption)
      const colMap = [];
      html = html.replace(/(#[0-9a-fA-F]{3,8})\b/g, (m) => {
        colMap.push('<span class="syn-color"><span class="syn-swatch" style="background-color:' + m + '"></span>' + m + '</span>');
        return '___PIXCOL_' + (colMap.length - 1) + '___';
      });

      // 3. Section directives (@meta, @grid, @palette, @cell, etc.)
      html = html.replace(/(@[a-zA-Z0-9_]+)/g, '<span class="syn-dir">$1</span>');

      // 4. Keys followed by colon (key:) - mask to protect key names and colon
      const keyMap = [];
      html = html.replace(/\b([a-zA-Z0-9_]+):/g, (_, k) => {
        keyMap.push('<span class="syn-key">' + k + ':</span>');
        return '___PIXKEY_' + (keyMap.length - 1) + '___';
      });

      // 5. Drawing commands & vector macros
      html = html.replace(/\b(sym_dot|line|rect|fill|pixel|dot)\b/g, '<span class="syn-cmd">$1</span>');
      html = html.replace(/(^|\s)(p)(?=\s|$)/g, '$1<span class="syn-cmd">$2</span>');

      // 6. Keywords
      html = html.replace(/\b(true|false|loop|once|outline|none|down|up|right|left|down_right|down_left|up_right|up_left)\b/g, '<span class="syn-kw">$1</span>');

      // 7. Numbers, dimensions, coordinates (outside tags & tokens)
      html = html.replace(/\b(\d+(?:,\d+|\.\d+|x\d+)?)\b(?![^<]*>)/g, '<span class="syn-num">$1</span>');

      // 8. Restore tokens safely in reverse order
      html = html.replace(/___PIXKEY_(\d+)___/g, (_, i) => keyMap[i]);
      html = html.replace(/___PIXCOL_(\d+)___/g, (_, i) => colMap[i]);
      html = html.replace(/___PIXSTR_(\d+)___/g, (_, i) => strMap[i]);

      if (commentPart) {
        html += '<span class="syn-cmt">' + escapeHtml(commentPart) + '</span>';
      }

      const lineNum = '<span class="line-num">' + (idx + 1) + '</span>';
      return '<div class="code-line">' + lineNum + '<span class="line-content">' + (html || ' ') + '</span></div>';
    }).join('');
  }

  function renderCodeEditor() {
    if (!state.doc) return;

    if (!isCodeEditingUnlocked) {
      const serialized = PIX2.serialize(state.doc);
      if (dom.codeTextarea) dom.codeTextarea.value = serialized;
      if (dom.codeViewer) {
        dom.codeViewer.innerHTML = highlightPix2Code(serialized);
        dom.codeViewer.classList.remove('hidden');
      }
      if (dom.codeTextarea) {
        dom.codeTextarea.classList.add('hidden');
        dom.codeTextarea.readOnly = true;
      }
      if (dom.codeModeBadge) {
        dom.codeModeBadge.innerHTML = '<i class="fa-solid fa-lock"></i> View Only';
        dom.codeModeBadge.className = 'badge badge-subtle';
      }
      if (dom.btnToggleEditCode) {
        dom.btnToggleEditCode.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Code';
        dom.btnToggleEditCode.classList.remove('btn-warning');
        dom.btnToggleEditCode.classList.add('btn-secondary');
        dom.btnToggleEditCode.title = 'Unlock to edit PIX2 code manually';
      }
      if (dom.btnApplyCode) {
        dom.btnApplyCode.classList.add('hidden');
      }
    }
    updateAiGuidePane(dom.selectAiPromptMode ? dom.selectAiPromptMode.value : 'all-in-one');
  }

  function toggleCodeEditMode() {
    if (!dom.codeTextarea) return;

    if (!isCodeEditingUnlocked) {
      const confirmed = confirm(
        '⚠️ DIRECT CODE EDITING WARNING:\n\n' +
        'Manually modifying PIX2 code can corrupt sprite syntax or desynchronize animation sequences if the format grammar is not followed accurately.\n\n' +
        '💡 RECOMMENDED: Use your AI Copilot!\n' +
        'Click "Copy for AI Prompt" or "Copy PIX2 Code" to let an AI modify the code safely and intelligently.\n\n' +
        'Are you sure you want to unlock direct code editing?'
      );
      if (!confirmed) return;

      isCodeEditingUnlocked = true;
      if (dom.codeViewer) dom.codeViewer.classList.add('hidden');
      if (dom.codeTextarea) {
        dom.codeTextarea.classList.remove('hidden');
        dom.codeTextarea.readOnly = false;
        dom.codeTextarea.classList.add('editing-active');
        dom.codeTextarea.focus();
      }

      if (dom.btnToggleEditCode) {
        dom.btnToggleEditCode.innerHTML = '<i class="fa-solid fa-lock"></i> Lock Code';
        dom.btnToggleEditCode.classList.remove('btn-secondary');
        dom.btnToggleEditCode.classList.add('btn-warning');
        dom.btnToggleEditCode.title = 'Lock code and revert to safe syntax viewer';
      }

      if (dom.codeModeBadge) {
        dom.codeModeBadge.innerHTML = '<i class="fa-solid fa-pen"></i> Direct Editing Active';
        dom.codeModeBadge.className = 'badge badge-warning';
      }

      if (dom.btnApplyCode) {
        dom.btnApplyCode.classList.remove('hidden');
      }

      showToast('Direct code editing enabled. Click "Apply to Canvas" to commit changes.', 'warning');
    } else {
      // Check for unapplied code edits before locking
      if (dom.codeTextarea && state.doc) {
        const currentDocCode = PIX2.serialize(state.doc);
        if (dom.codeTextarea.value.trim() !== currentDocCode.trim()) {
          const wantApply = confirm(
            '⚠️ UNAPPLIED CODE EDITS DETECTED:\n\n' +
            'You have modified PIX2 code that has not been applied to the canvas.\n\n' +
            '• Click OK to apply your edits now and lock safely.\n' +
            '• Click Cancel to discard edits and revert to canvas state.'
          );
          if (wantApply) {
            applyCodeToDoc();
            return;
          }
        }
      }

      isCodeEditingUnlocked = false;
      if (dom.codeTextarea) {
        dom.codeTextarea.classList.add('hidden');
        dom.codeTextarea.readOnly = true;
        dom.codeTextarea.classList.remove('editing-active');
      }

      if (dom.codeViewer && state.doc) {
        const serialized = PIX2.serialize(state.doc);
        if (dom.codeTextarea) dom.codeTextarea.value = serialized;
        dom.codeViewer.innerHTML = highlightPix2Code(serialized);
        dom.codeViewer.classList.remove('hidden');
      }

      if (dom.btnToggleEditCode) {
        dom.btnToggleEditCode.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Code';
        dom.btnToggleEditCode.classList.remove('btn-warning');
        dom.btnToggleEditCode.classList.add('btn-secondary');
        dom.btnToggleEditCode.title = 'Unlock to edit PIX2 code manually';
      }

      if (dom.codeModeBadge) {
        dom.codeModeBadge.innerHTML = '<i class="fa-solid fa-lock"></i> View Only';
        dom.codeModeBadge.className = 'badge badge-subtle';
      }

      if (dom.btnApplyCode) {
        dom.btnApplyCode.classList.add('hidden');
      }

      showToast('Code locked in safe syntax view mode.', 'info');
    }
  }

  function copyRawPix2Code() {
    if (!state.doc) return;
    const code = dom.codeTextarea ? dom.codeTextarea.value : PIX2.serialize(state.doc);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        showToast('Copied raw .PIX2 code to clipboard!', 'success');
      }).catch(() => {
        fallbackCopyText(code);
      });
    } else {
      fallbackCopyText(code);
    }
  }

  function fallbackCopyText(text) {
    const tempTa = document.createElement('textarea');
    tempTa.value = text;
    tempTa.style.position = 'fixed';
    tempTa.style.opacity = '0';
    document.body.appendChild(tempTa);
    tempTa.select();
    try {
      document.execCommand('copy');
      showToast('Copied raw .PIX2 code to clipboard!', 'success');
    } catch (e) {
      alert('Could not copy automatically. You can copy the code manually.');
    }
    document.body.removeChild(tempTa);
  }

  function applyCodeToDoc() {
    if (!dom.codeTextarea) return;
    try {
      const code = dom.codeTextarea.value;
      const newDoc = PIX2.parse(code);
      state.setDocument(newDoc, true);
      state.saveSnapshot('Apply Code');
      triggerEventAutosave();

      // Automatically lock code editing after successful apply for safety
      isCodeEditingUnlocked = false;
      if (dom.codeTextarea) {
        dom.codeTextarea.classList.add('hidden');
        dom.codeTextarea.readOnly = true;
        dom.codeTextarea.classList.remove('editing-active');
      }
      if (dom.codeViewer) {
        dom.codeViewer.innerHTML = highlightPix2Code(code);
        dom.codeViewer.classList.remove('hidden');
      }
      if (dom.btnToggleEditCode) {
        dom.btnToggleEditCode.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Code';
        dom.btnToggleEditCode.classList.remove('btn-warning');
        dom.btnToggleEditCode.classList.add('btn-secondary');
      }
      if (dom.codeModeBadge) {
        dom.codeModeBadge.innerHTML = '<i class="fa-solid fa-lock"></i> View Only';
        dom.codeModeBadge.className = 'badge badge-subtle';
      }
      if (dom.btnApplyCode) {
        dom.btnApplyCode.classList.add('hidden');
      }

      refreshAll();
      showToast('PIX2 Code parsed & applied to canvas successfully!', 'success');
    } catch (err) {
      alert(`Error parsing PIX2 code:\n${err.message}`);
    }
  }

  // ===========================================================================
  // AI SPECIFICATION & CONTEXTUAL PROMPT STUDIO
  // ===========================================================================

  function getSpriteMath(cw, ch) {
    cw = Math.min(Math.max(1, parseInt(cw, 10) || 16), 512);
    ch = Math.min(Math.max(1, parseInt(ch, 10) || 16), 512);
    const axisX = (cw - 1) / 2;
    const axisXStr = axisX.toFixed(1);

    // Dynamic vertical landmarks proportional to canvas height
    const topMargin = Math.max(1, Math.round(ch * 0.05));
    const headEndY = Math.max(topMargin + 3, Math.round(ch * 0.38));
    const eyeStartY = Math.max(topMargin + 2, Math.round(ch * 0.28));
    const eyeEndY = Math.min(headEndY - 1, Math.round(ch * 0.36));
    const torsoStartY = headEndY + 1;
    const torsoEndY = Math.max(torsoStartY + 3, Math.round(ch * 0.72));
    const legsStartY = torsoEndY + 1;
    const legsEndY = Math.max(legsStartY + 1, ch - 2);
    const groundY = ch - 1;

    // Dynamic horizontal widths & bounds proportional to canvas width
    const bodyW = Math.max(6, Math.round(cw * 0.65));
    const startX = Math.floor((cw - bodyW) / 2);
    const endX = startX + bodyW - 1;

    const headW = Math.max(6, Math.round(cw * 0.55));
    const headStartX = Math.floor((cw - headW) / 2);
    const headEndX = headStartX + headW - 1;

    const eyeOffset = Math.max(1, Math.round(cw * 0.12));
    const eyeLeftX = Math.round(axisX - eyeOffset - 0.5);
    const eyeRightX = Math.round(axisX + eyeOffset + 0.5);

    return {
      cw, ch, axisX, axisXStr,
      head: { y: [topMargin, headEndY], w: headW, x: [headStartX, headEndX] },
      eyes: { y: [eyeStartY, eyeEndY], leftX: eyeLeftX, rightX: eyeRightX },
      torso: { y: [torsoStartY, torsoEndY], w: bodyW, x: [startX, endX] },
      legs: { y: [legsStartY, legsEndY] },
      groundY
    };
  }

  function updateAiGuidePane(mode = 'all-in-one') {
    const titleEl = document.getElementById('ai-guide-title');
    const contentEl = document.getElementById('ai-guide-content');
    if (!contentEl) return;

    const cw = (state.doc && state.doc.meta && state.doc.meta.cellSize) ? state.doc.meta.cellSize.w : 16;
    const ch = (state.doc && state.doc.meta && state.doc.meta.cellSize) ? state.doc.meta.cellSize.h : 16;
    const m = getSpriteMath(cw, ch);

    const canonicalTableHtml = `
      <table class="guide-table">
        <thead>
          <tr>
            <th>Cell Resolution</th>
            <th>Valid Coords</th>
            <th>Center Axis (axisX)</th>
            <th>Bilateral Symmetry Macro</th>
            <th>Reflection Math</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>16 × 16</strong></td>
            <td>0 to 15</td>
            <td><code>X = 7.5</code></td>
            <td><code>sym_dot x,y 7.5 &lt;color&gt;</code></td>
            <td><code>x' = 15 - x</code></td>
          </tr>
          <tr>
            <td><strong>24 × 24</strong></td>
            <td>0 to 23</td>
            <td><code>X = 11.5</code></td>
            <td><code>sym_dot x,y 11.5 &lt;color&gt;</code></td>
            <td><code>x' = 23 - x</code></td>
          </tr>
          <tr>
            <td><strong>32 × 32</strong></td>
            <td>0 to 31</td>
            <td><code>X = 15.5</code></td>
            <td><code>sym_dot x,y 15.5 &lt;color&gt;</code></td>
            <td><code>x' = 31 - x</code></td>
          </tr>
          <tr>
            <td><strong>64 × 64</strong></td>
            <td>0 to 63</td>
            <td><code>X = 31.5</code></td>
            <td><code>sym_dot x,y 31.5 &lt;color&gt;</code></td>
            <td><code>x' = 63 - x</code></td>
          </tr>
          <tr>
            <td><strong>W × H (Custom)</strong></td>
            <td>0..W-1, 0..H-1</td>
            <td><code>axisX = (W-1)/2</code></td>
            <td><code>sym_dot x,y axisX &lt;color&gt;</code></td>
            <td><code>x' = (W - 1) - x</code></td>
          </tr>
        </tbody>
      </table>
    `;

    const activeBoundsBoxHtml = `
      <div class="guide-formula-box" style="border-left: 3px solid #3b82f6; margin-bottom: 10px;">
        <p><strong>🎯 Active Canvas (${cw}×${ch}):</strong> Center Axis <code>axisX = ${m.axisXStr}</code></p>
        <p><strong>Head &amp; Hair:</strong> Y = ${m.head.y[0]}..${m.head.y[1]}, X = ${m.head.x[0]}..${m.head.x[1]} (Width ~ ${m.head.w}px)</p>
        <p><strong>Eyes:</strong> Y = ${m.eyes.y[0]}..${m.eyes.y[1]} (Left: X ≈ ${m.eyes.leftX}, Right: X ≈ ${m.eyes.rightX})</p>
        <p><strong>Torso / Outfit / Armor:</strong> Y = ${m.torso.y[0]}..${m.torso.y[1]}, X = ${m.torso.x[0]}..${m.torso.x[1]} (Width ~ ${m.torso.w}px)</p>
        <p><strong>Legs / Ghost Wisps:</strong> Y = ${m.legs.y[0]}..${m.legs.y[1]}</p>
        <p><strong>Ground Shadow / Clearance:</strong> Y = ${m.groundY} (Bottom boundary)</p>
      </div>
    `;

    if (mode === 'all-in-one') {
      if (titleEl) titleEl.textContent = '🌟 All-in-One Master Cognitive Guide (Complete Reference)';
      contentEl.innerHTML = `
        <h4>1. Canonical Coordinate &amp; Bilateral Symmetry Reference Table</h4>
        ${canonicalTableHtml}

        <h4>2. Live Computed Anatomy Landmarks for Active Canvas (${cw}×${ch})</h4>
        ${activeBoundsBoxHtml}

        <h4>3. Solid Sprite Mass Mandate (Strictly No Hollow Wireframes)</h4>
        <div class="guide-formula-box" style="border-left: 3px solid #ef4444;">
          <p><strong>Mandatory Solid Interior:</strong> Pixel art sprites are solid physical entities with volume, NOT hollow wireframes! The interior of the head, face, torso, clothing, and limbs MUST be 100% packed with solid color pixels.</p>
          <p><strong>Transparent Boundary:</strong> Transparent pixels exist ONLY in the open air outside the character silhouette.</p>
          <p><strong>Fast Solid Filling:</strong> Use <code>rect x,y w,h &lt;col&gt; fill</code> to instantly pack torso/cape blocks in 1 line! Use <code>sym_dot</code> to plot horizontal rows symmetrically.</p>
        </div>

        <h4>4. Mathematical Primitives &amp; Vector Macros in PIX2</h4>
        <ul class="guide-cmd-list">
          <li><code>p x,y &lt;pal_id|hex&gt;</code> — Plot single pixel (inline chaining supported: <code>p 5,2 1  p 6,2 2</code>)</li>
          <li><code>sym_dot x,y axisX &lt;col&gt;</code> — Automatic bilateral mirror reflection (axisX = ${m.axisXStr})</li>
          <li><code>rect x,y w,h &lt;col&gt; fill</code> — Solid rectangular fill (chest, body, robes)</li>
          <li><code>rect x,y w,h &lt;col&gt; outline</code> — Rectangular bounding box (shields, borders)</li>
          <li><code>line x0,y0 x1,y1 &lt;col&gt;</code> — Bresenham discrete line (swords, staves, diagonal edges)</li>
          <li><code>fill x,y &lt;col&gt;</code> — 4-way bounded flood fill</li>
        </ul>

        <h4>5. Anti-Lazy 4-Frame Locomotion Formulas</h4>
        <ul class="guide-cmd-list">
          <li><strong>Frame 0 (Contact / Hover High):</strong> Baseline standing or hovering pose, grounded at Y = ${m.legs.y[1]}.</li>
          <li><strong>Frame 1 (Step Left / Sway Right Dip):</strong> Torso bobs Y±1, left foot forward. For floating: tail wisps curl right (+1..+2px X).</li>
          <li><strong>Frame 2 (Passing / Hover Low):</strong> Feet cross center axis. Ghost tail elongates, glowing eyes pulse brighter.</li>
          <li><strong>Frame 3 (Step Right / Sway Left Dip):</strong> Torso bobs Y±1, right foot forward. For floating: tail wisps curl left (-1..-2px X).</li>
          <li><strong>Secondary Motion:</strong> Cloaks, hair tails, and ethereal wisps MUST lag 1 frame behind primary body motion.</li>
        </ul>

        <h4>6. Directional Perspective Standards</h4>
        <div class="guide-formula-box">
          <p><strong>Down:</strong> Frontal perspective. Perfect bilateral symmetry on <code>axisX = ${m.axisXStr}</code>. Both eyes visible.</p>
          <p><strong>Up:</strong> Back perspective. Center symmetry on <code>axisX = ${m.axisXStr}</code>. NO eyes, nose, or mouth (hair and cloak only).</p>
          <p><strong>Right:</strong> 3/4 profile facing right. Face and chest shifted towards right margin.</p>
          <p><strong>Left:</strong> Exact mathematical mirror of Right: <code>x_left = (${cw - 1}) - x_right</code>.</p>
        </div>

        <div class="tip-box">
          <i class="fa-solid fa-palette"></i>
          <span><strong>Cohesive 5-6 Tone Palette:</strong> 1: Outline Dark Slate &bull; 2: Deep Core Shadow &bull; 3: Midtone Body &bull; 4: Rim Highlight &bull; 5: Glowing Eyes &bull; 6: Accent Trim.</span>
        </div>
      `;
    } else if (mode === 'full-character') {
      if (titleEl) titleEl.textContent = '🧙‍♂️ Full Character (4-Dir / 8-Dir Generation)';
      contentEl.innerHTML = `
        <h4>1. Coordinate &amp; Symmetry Reference Table (${cw}×${ch})</h4>
        ${canonicalTableHtml}
        ${activeBoundsBoxHtml}

        <h4>2. Solid Sprite Mass Mandate</h4>
        <p class="guide-desc">The interior of the head, torso, clothing, and limbs MUST be 100% packed with solid color pixels. Never output an empty wireframe!</p>

        <h4>3. Directional Frame Mapping</h4>
        <ul class="guide-cmd-list">
          <li><code>down_0..3</code>: Front facing (bilateral symmetry, axisX = ${m.axisXStr}, 2 eyes visible)</li>
          <li><code>up_0..3</code>: Back view (bilateral symmetry, axisX = ${m.axisXStr}, hair/cloak only, 0 eyes)</li>
          <li><code>right_0..3</code>: Profile facing right (3/4 angle, eyes/nose facing right)</li>
          <li><code>left_0..3</code>: Exact horizontal mirror of Right: <code>x_left = ${cw - 1} - x_right</code></li>
        </ul>
      `;
    } else if (mode === 'walk-animation') {
      if (titleEl) titleEl.textContent = '🎬 Walk & Float Animation Engine';
      contentEl.innerHTML = `
        <h4>1. Mathematical 4-Frame Locomotion Formulas</h4>
        <div class="guide-formula-box">
          <p><strong>Frame 0 (Neutral):</strong> Neutral standing or hovering baseline pose.</p>
          <p><strong>Frame 1 (Step Left / Sway Right):</strong> Torso bobs Y±1, left foot steps forward or tail wisps sway right.</p>
          <p><strong>Frame 2 (Passing / Low Dip):</strong> Feet pass center axis or ghost tail elongates vertically.</p>
          <p><strong>Frame 3 (Step Right / Sway Left):</strong> Torso bobs Y±1, right foot steps forward or tail wisps sway left.</p>
        </div>

        <h4>2. Secondary Motion Physics</h4>
        <p class="guide-desc">Trailing capes, hair tails, antennae, and magical floating wisps MUST lag 1 frame behind body movement for fluid organic motion.</p>
      `;
    } else if (mode === 'accessory-equipment') {
      if (titleEl) titleEl.textContent = '🗡️ Equipment & Accessory Overlay';
      contentEl.innerHTML = `
        <h4>1. Equipment Attachment Zones on Canvas (${cw}×${ch})</h4>
        <div class="guide-formula-box">
          <p><strong>Hats / Helmets / Crowns:</strong> Top crown Y = 0 to ${m.head.y[0] + 3}</p>
          <p><strong>Weapons (Swords / Staves / Bows):</strong> Hand level X = 1..${m.torso.x[0]} or ${m.torso.x[1]}..${cw - 1}, Y = ${m.torso.y[0]}..${m.torso.y[1]}</p>
          <p><strong>Cloaks / Wings / Shields:</strong> Flanking sides X = 0..${m.torso.x[0]} and ${m.torso.x[1]}..${cw - 1}</p>
        </div>
        <h4>2. Weapon Drawing Directives</h4>
        <p class="guide-desc">Use <code>line x0,y0 x1,y1 &lt;col&gt;</code> for diagonal sword blades and staff shafts.</p>
      `;
    } else if (mode === 'surgical-patch') {
      if (titleEl) titleEl.textContent = '🩹 Surgical Frame / Color Patch';
      contentEl.innerHTML = `
        <h4>1. Surgical Frame-Level Addressing</h4>
        <p class="guide-desc">Output ONLY the specific <code>@cell &lt;id&gt;</code> or <code>@palette</code> directives that need changes, keeping all other frames untouched to save tokens and prevent regressions.</p>
        <pre><code>; Recolor eyes to Glowing Cyan
@cell cell_0_0
  p ${m.eyes.leftX},${m.eyes.y[0]} #00ffff  p ${m.eyes.rightX},${m.eyes.y[0]} #00ffff</code></pre>
      `;
    } else {
      if (titleEl) titleEl.textContent = '📋 Studio Architecture & Programmatic API';
      contentEl.innerHTML = `
        <h4>1. NOIRADIX Studio Overview</h4>
        <p class="guide-desc">A coordinate-addressed pixel art editor with live disk hot-reloading, 4-dir/8-dir animation player, and Unity/TexturePacker exporters.</p>
        <h4>2. JavaScript / Node.js Engine API</h4>
        <pre><code>const doc = PIX2.parse(fileContent);
doc.cells['cell_0_0'].pixels['${m.eyes.leftX},${m.eyes.y[0]}'] = '#00ffff';
const outText = PIX2.serialize(doc);</code></pre>
      `;
    }
  }

  function copyAiPrompt() {
    if (!state.doc) return;
    const mode = (dom.selectAiPromptMode && dom.selectAiPromptMode.value) || 'all-in-one';
    const serialized = PIX2.serialize(state.doc);
    const meta = state.doc.meta;
    const cw = meta.cellSize.w;
    const ch = meta.cellSize.h;
    const cols = meta.grid.cols;
    const rows = meta.grid.rows;
    const m = getSpriteMath(cw, ch);

    let paletteSummary = '';
    if (state.doc.palette && Object.keys(state.doc.palette).length > 0) {
      paletteSummary = Object.entries(state.doc.palette)
        .filter(([id, col]) => {
          const raw = typeof col === 'string' ? col : (col && typeof col.hex === 'string' ? col.hex : '');
          return /^#?[0-9a-fA-F]{3,8}$/.test(raw.trim());
        })
        .map(([id, col]) => {
          const raw = typeof col === 'string' ? col : col.hex;
          const hex = PIX2.normalizeHex(raw);
          const name = (typeof col === 'object' && col && col.name) ? col.name : `Color ${id}`;
          return `  ${id}: ${hex}  # ${name}`;
        })
        .join('\n');
    } else {
      paletteSummary = `  1: #181425  # Outline Dark Charcoal
  2: #2e2842  # Core Deep Shadow
  3: #5a4e7c  # Midtone Body Base
  4: #9d8ec2  # Highlight Rim Light
  5: #00ffff  # Glowing Accent / Eyes`;
    }

    let cellInventory = Object.keys(state.doc.cells || {}).join(', ') || 'none';

    let specializedInstructions = '';

    if (mode === 'all-in-one') {
      specializedInstructions = `### MASTER SPECIALIZATION: ALL-IN-ONE COGNITIVE GUIDE & ALL PRODUCTION RECIPES
You are equipped with the full suite of NOIRADIX Studio production capabilities. You can create complete characters, synthesize animations, craft equipment overlays, or execute surgical patches as requested:

#### PRODUCTION RECIPE 1: COMPLETE 4-DIRECTIONAL & 8-DIRECTIONAL CHARACTER CREATION
1. ANATOMY & SILHOUETTE GUIDE (${cw}x${ch} discrete pixels):
   - Center Axis: axisX = ${m.axisXStr}
   - Head & Hair: Top Y in [${m.head.y[0]}..${m.head.y[1]}], Width = ${m.head.w}px (X in [${m.head.x[0]}..${m.head.x[1]}])
   - Eyes: Y in [${m.eyes.y[0]}..${m.eyes.y[1]}], spaced across center (Left Eye X ~ ${m.eyes.leftX}, Right Eye X ~ ${m.eyes.rightX})
   - Torso & Garments: Y in [${m.torso.y[0]}..${m.torso.y[1]}], Width = ${m.torso.w}px (X in [${m.torso.x[0]}..${m.torso.x[1]}])
   - Legs / Ghost Wisps: Y in [${m.legs.y[0]}..${m.legs.y[1]}]. Leave transparent margin at bottom.
   - Ground Shadow: Y = ${m.groundY}
2. DIRECTIONAL PERSPECTIVES:
   - 'down_0': Frontal view with bilateral center symmetry on axisX = ${m.axisXStr}. Both eyes clearly visible.
   - 'up_0': Back view showing back of head, hair, and cloak. NO eyes, nose, or mouth visible.
   - 'right_0': 3/4 side profile facing right. Eyes shifted toward right edge (X ~ ${cw - 5}).
   - 'left_0': Facing left. STRICT INVARIANT: Exact horizontal mirror of 'right_0' (x_left = ${cw - 1} - x_right).
3. SOLID ACCELERATION MACROS:
   - Use 'sym_dot x,y ${m.axisXStr} <color>' for bilateral frontal symmetry.
   - Use 'rect x,y w,h <color> fill' to instantly fill solid rectangular body mass in 1 line.
   - Use 'p x,y <pal_id>' for compact sparse pixel placement.
4. ANIMATION BINDINGS (CANONICAL MULTI-LINE SYNTAX):
   - Hook up all walk animation cycles at 6fps loop:
@animation walk_down
  name: "Walk Down"
  direction: down
  frames: [cell_0_0, cell_0_1, cell_0_2, cell_0_3]
  fps: 6
  loop: true

@animation walk_up
  name: "Walk Up"
  direction: up
  frames: [cell_1_0, cell_1_1, cell_1_2, cell_1_3]
  fps: 6
  loop: true

@animation walk_right
  name: "Walk Right"
  direction: right
  frames: [cell_2_0, cell_2_1, cell_2_2, cell_2_3]
  fps: 6
  loop: true

@animation walk_left
  name: "Walk Left"
  direction: left
  frames: [cell_3_0, cell_3_1, cell_3_2, cell_3_3]
  fps: 6
  loop: true

#### PRODUCTION RECIPE 2: DISCRETE 4-FRAME WALK & GHOST LOCOMOTION FORMULAS
1. 4-FRAME MATHEMATICAL WALK FORMULA:
   - Frame 0 (Contact): Neutral standing contact pose, both feet grounded.
   - Frame 1 (Step Left): Bob the torso down by 1px (or bob up: Y - 1). Left foot forward, right foot trailing back.
   - Frame 2 (Passing): Neutral torso height. Legs passing each other in center.
   - Frame 3 (Step Right): Bob torso by 1px (Y - 1). Right foot forward, left foot trailing back.
2. 4-FRAME GHOST / FLOATING / FLYING FORMULA:
   - Frame 0 (Hover High): Body at top baseline. Tail wisps centered.
   - Frame 1 (Sway Right + Dip): Body bobs DOWN by 1px (Y + 1). Tail wisps trail and curl to the right (+1..+2px X shift).
   - Frame 2 (Hover Low): Body at lowest dip. Tail wisps stretch vertically. Eyes/core pulse brighter.
   - Frame 3 (Sway Left + Rise): Body rises up. Tail wisps trail and curl to the left (-1..-2px X shift).
3. SECONDARY MOTION PHYSICS:
   - Trailing capes, hair tails, antennae, and held weapons MUST lag 1 frame behind primary body bobbing.

#### PRODUCTION RECIPE 3: NON-DESTRUCTIVE ACCESSORY & EQUIPMENT OVERLAY
1. NON-DESTRUCTIVE OVERLAY INVARIANT:
   - Preserve existing character silhouette and facial pixels underneath unless intentionally obscured.
   - Hats / Helmets / Crowns: Draw on top crown Y in [0..${m.head.y[0] + 3}].
   - Weapons (Swords, Staves, Bows): Position at hand level (X in [1..${m.torso.x[0]}] or [${m.torso.x[1]}..${cw - 1}]). Use 'line x0,y0 x1,y1 <color>' for blades and shafts.
   - Cloaks, Wings, Shields: Attach to flanking sides (X in [0..${m.torso.x[0]}] and [${m.torso.x[1]}..${cw - 1}]) and behind back frames.
2. PALETTE EXPANSION:
   - Introduce new equipment material color IDs in '@palette' (e.g. gold '#ffd700', steel '#94a3b8', ruby '#ef4444').

#### PRODUCTION RECIPE 4: SURGICAL FRAME & COLOR PATCH DIRECTIVES
1. SURGICAL SPECIFICATION:
   - When requested to modify existing art, do NOT regenerate or output unchanged cells or animations.
   - Output ONLY the modified '@cell <id>' or '@palette' lines to conserve tokens and prevent regressions.
   - To ERASE a pixel, simply omit its coordinate from the cell record.
2. RECOLORING:
   - Modify the '@palette' hex value or remap palette IDs inside targeted cells.`;
    } else if (mode === 'full-character') {
      specializedInstructions = `### SPECIALIZED OBJECTIVE: COMPLETE 4-DIRECTIONAL & 8-DIRECTIONAL CHARACTER CREATION
You are tasked with generating a complete game character from scratch in all cardinal directions:
1. ANATOMY & SILHOUETTE GUIDE (${cw}x${ch} discrete pixels):
   - Center Axis: axisX = ${m.axisXStr}
   - Head & Hair: Top Y in [${m.head.y[0]}..${m.head.y[1]}], Width = ${m.head.w}px (X in [${m.head.x[0]}..${m.head.x[1]}])
   - Eyes: Y in [${m.eyes.y[0]}..${m.eyes.y[1]}], spaced across center (Left Eye X ~ ${m.eyes.leftX}, Right Eye X ~ ${m.eyes.rightX})
   - Torso & Clothing: Y in [${m.torso.y[0]}..${m.torso.y[1]}], Width = ${m.torso.w}px (X in [${m.torso.x[0]}..${m.torso.x[1]}])
   - Legs & Shadow: Y in [${m.legs.y[0]}..${m.legs.y[1]}]. Leave transparent margin below feet.
   - Ground Contact: Y = ${m.groundY}
2. DIRECTIONAL PERSPECTIVES:
   - 'down_0': Frontal view with bilateral center symmetry on axisX = ${m.axisXStr}. Both eyes clearly visible.
   - 'up_0': Back view showing back of head, hair, and cloak. NO eyes, nose, or mouth visible.
   - 'right_0': 3/4 side profile facing right. Eyes and nose shifted toward right edge (X ~ ${cw - 5}).
   - 'left_0': Facing left. STRICT INVARIANT: Exact horizontal mirror of 'right_0' (x_left = ${cw - 1} - x_right).
3. SOLID ACCELERATION MACROS:
   - Use 'sym_dot x,y ${m.axisXStr} <color>' for bilateral frontal symmetry.
   - Use 'rect x,y w,h <color> fill' to instantly fill solid rectangular body mass in 1 line.
   - Use 'p x,y <pal_id>' for compact sparse pixel placement.
4. ANIMATION BINDINGS (CANONICAL MULTI-LINE SYNTAX):
   - Hook up all walk animation cycles at 6fps loop:
@animation walk_down
  name: "Walk Down"
  direction: down
  frames: [cell_0_0, cell_0_1, cell_0_2, cell_0_3]
  fps: 6
  loop: true

@animation walk_up
  name: "Walk Up"
  direction: up
  frames: [cell_1_0, cell_1_1, cell_1_2, cell_1_3]
  fps: 6
  loop: true

@animation walk_right
  name: "Walk Right"
  direction: right
  frames: [cell_2_0, cell_2_1, cell_2_2, cell_2_3]
  fps: 6
  loop: true

@animation walk_left
  name: "Walk Left"
  direction: left
  frames: [cell_3_0, cell_3_1, cell_3_2, cell_3_3]
  fps: 6
  loop: true`;
    } else if (mode === 'walk-animation') {
      specializedInstructions = `### SPECIALIZED OBJECTIVE: DISCRETE WALK & GHOST LOCOMOTION ANIMATION
You are tasked with transforming static character poses into fluid, natural animations:
1. 4-FRAME MATHEMATICAL WALK FORMULA:
   - Frame 0 (Contact): Neutral standing contact pose, both feet grounded at Y = ${m.legs.y[1]}.
   - Frame 1 (Step Left): Bob the torso down by 1px (or bob up: Y - 1). Left foot forward, right foot trailing back.
   - Frame 2 (Passing): Neutral torso height. Legs passing each other in center.
   - Frame 3 (Step Right): Bob torso by 1px (Y - 1). Right foot forward, left foot trailing back.
2. 4-FRAME GHOST / FLOATING / FLYING FORMULA:
   - Frame 0 (Hover High): Body at top baseline. Tail wisps centered.
   - Frame 1 (Sway Right + Dip): Body bobs DOWN by 1px (Y + 1). Tail wisps trail and curl to the right (+1..+2px X shift).
   - Frame 2 (Hover Low): Body at lowest dip. Tail wisps stretch vertically. Eyes/core pulse brighter.
   - Frame 3 (Sway Left + Rise): Body rises up. Tail wisps trail and curl to the left (-1..-2px X shift).
3. SECONDARY MOTION PHYSICS:
   - Trailing capes, hair tails, antennae, and held weapons MUST lag 1 frame behind primary body bobbing.
4. OUTPUT FORMAT:
   - Provide the complete '@animation' definitions and corresponding '@cell' frame records.`;
    } else if (mode === 'accessory-equipment') {
      specializedInstructions = `### SPECIALIZED OBJECTIVE: NON-DESTRUCTIVE ACCESSORY & EQUIPMENT OVERLAY
You are tasked with adding equipment, costumes, weapons, or cosmetics onto existing character sprites:
1. NON-DESTRUCTIVE OVERLAY INVARIANT:
   - Preserve existing character silhouette and facial pixels underneath unless intentionally obscured.
   - Hats / Helmets / Crowns: Draw on top crown Y in [0..${m.head.y[0] + 3}].
   - Weapons (Swords, Staves, Bows): Position at hand level (X in [1..${m.torso.x[0]}] or [${m.torso.x[1]}..${cw - 1}]). Use 'line x0,y0 x1,y1 <color>' for blades and shafts.
   - Cloaks, Wings, Shields: Attach to flanking sides (X in [0..${m.torso.x[0]}] and [${m.torso.x[1]}..${cw - 1}]) and behind back frames.
2. PALETTE EXPANSION:
   - Introduce new equipment material color IDs in '@palette' (e.g. gold '#ffd700', steel '#94a3b8', ruby '#ef4444').`;
    } else if (mode === 'surgical-patch') {
      specializedInstructions = `### SPECIALIZED OBJECTIVE: SURGICAL FRAME / COLOR PATCH
You are tasked with making surgical, highly-targeted corrections with zero token waste:
1. SURGICAL SPECIFICATION:
   - Do NOT regenerate or output unchanged cells or animations.
   - Output ONLY the modified '@cell <id>' or '@palette' lines.
   - To ERASE a pixel, simply omit its coordinate from the cell record.
2. RECOLORING:
   - Modify the '@palette' hex value or remap palette IDs inside targeted cells.`;
    } else {
      specializedInstructions = `### SPECIALIZED OBJECTIVE: STUDIO ARCHITECTURE & PROGRAMMATIC API
You are tasked with programmatic interaction, compilation, or automated processing of PIX2 files:
1. JavaScript API: Parse via 'PIX2.parse(text)', mutate 'doc.cells[id].pixels', serialize via 'PIX2.serialize(doc)'.
2. Exporter Integration: Output spritesheet atlases formatted for Unity 2D (with 'Pix2UnityImporter.cs') or TexturePacker.`;
    }

    const prompt = `# SYSTEM PROMPT: NOIRADIX STUDIO & PIX2 SPRITE ENGINE SPECIALIST

## 1. WHAT IS NOIRADIX STUDIO?
NOIRADIX Studio is a desktop-grade, zero-dependency, AI-native structured pixel art editor and animation suite.
It bridges human game artists and AI coding assistants through deterministic sprite code:
- **Grid Matrix Overview:** Multi-cell grid matrix (e.g. ${cols} columns x ${rows} rows = ${cols * rows} cells) where each cell has a unique identifier (\`cell_0_0\`, \`down_0\`).
- **Animation Studio:** Real-time preview player supporting 4-direction (Down, Up, Right, Left) and 8-direction compass modes with configurable frame sequence strips, FPS control, and loop toggle.
- **Cell Editor:** High-precision canvas with anchor-centered zoom (4x to 64x), pixel rulers, bilateral symmetry mirror axis, and discrete drawing tools (Pencil, Eraser, Eyedropper, Paint Bucket, Line, Rectangle, Marquee Selection).
- **Real-Time Live Hot-Reload Engine:** Watches the active \`.pix2\` file on disk. When you (the AI) or an external script writes to the file on disk, Studio automatically reloads the canvas and animation timeline in real-time without user intervention.
- **Engine Exporters:** Automatically compiles sprite sheets into Unity 2D Spritesheet Packages (Atlas PNG + Metadata JSON + C# \`Pix2UnityImporter.cs\` script for 1-click automatic sprite slicing and \`.anim\` AnimationClip generation), TexturePacker JSON, and PNG Atlas with bleed protection.

## 2. THE PIX2 LANGUAGE PHILOSOPHY & SYNTAX SPECIFICATION
PIX2 is a deterministic, coordinate-addressed plain-text sprite format. Unlike raster PNGs or fuzzy diffusion images, PIX2 code is discrete, mathematically exact, and human/AI readable.

### Canonical Document Anatomy:
Every complete PIX2 document must follow this exact section structure:
\`\`\`pix2
@pix2 1.0

@meta
  title: "${meta.title || 'Hero'}"
  author: "User"
  version: "1.0"
  color_mode: RGBA
  coordinate_origin: top-left

@grid
  columns: ${cols}
  rows: ${rows}
  cell_size: ${cw}x${ch}
  gap: 0
  margin: 0

@palette
${paletteSummary}

@cell cell_0_0
  name: "Down 0"
  direction: down
  frame: 0
  grid_pos: 0,0
  p ${Math.floor(m.axisX)},${m.eyes.y[0]} 1

@animation walk_down
  name: "Walk Down"
  direction: down
  frames: [cell_0_0, cell_0_1, cell_0_2, cell_0_3]
  fps: 6
  loop: true

@end
\`\`\`

### Core Invariants:
1. SOLID SPRITE MASS MANDATE (ABSOLUTELY NO HOLLOW WIREFRAME SHELLS):
   - Pixel art sprites are SOLID game entities with mass, volume, and depth.
   - Drawing an empty outline loop with a hollow transparent inside is a CATASTROPHIC FAILURE.
   - The interior of the head, face, hair, chest, body, robes, cape, armor, and limbs MUST be 100% solidly packed with color pixels.
   - Transparent pixels exist ONLY as the empty air outside the character's outer boundary.
2. PURE CANVAS TRANSPARENCY:
   - Transparent pixels do NOT exist in the file. Only explicitly drawn pixels are saved.
   - NEVER output a background layer, black canvas fill, or transparent placeholder dots.
3. DISCRETE INTEGER COORDINATES:
   - Origin (0,0) is at the top-left corner.
   - Valid coordinates strictly satisfy non-negative integers: 0 <= x < ${cw} and 0 <= y < ${ch}.
   - Floating-point coordinates (e.g. 4.5, 7.2) or trailing characters (e.g. 1abc) are STRICTLY FORBIDDEN.
4. COLOR PALETTE ARCHITECTURE:
   - Pixels reference palette IDs defined in \`@palette\` (e.g. \`1\`, \`2\`, \`outline\`) or direct hex (\`#RRGGBB\` or \`#RRGGBBAA\` for semi-transparency).
   - Always define a cohesive 5-6 tone palette with:
     * 1: Outline / Silhouette (Dark Slate / Charcoal e.g. #181425)
     * 2: Deep Shadow / Ambient Shading (Muted tone e.g. #2e2842)
     * 3: Midtone Primary Body / Robe / Skin (Base color e.g. #5a4e7c)
     * 4: Highlight / Rim Light (Bright tone e.g. #9d8ec2)
     * 5: Glowing Accent / Eyes / Gem (Vivid saturated e.g. #00ffff, #ff0055, #ffd700)
5. MATHEMATICAL MACROS & DRAWING COMMANDS:
   - \`p x,y <pal_id|hex>\` or \`pixel x,y <pal_id|hex>\`: Plots a single discrete pixel at integer coordinates (x,y). Multiple pixel tokens can be placed on one line: \`p 5,2 1  p 6,2 2  p 7,2 #ffffff\`.
   - \`dot x,y <pal_id|hex>\` or \`d x,y <pal_id|hex>\`: Discrete dot drawing macro.
   - \`sym_dot x,y axisX <col>\`: Plots (x,y) and its bilateral reflection at Math.round(2*axisX - x, y). For cell width ${cw}, center axis is ${m.axisXStr}.
   - \`line x0,y0 x1,y1 <col>\`: Draws a Bresenham discrete line (weapons, outlines, diagonal borders).
   - \`rect x,y w,h <col> fill\`: Instantly fills a solid rectangular region of width w and height h. Highly recommended for filling solid torso, robe, and cloak bodies in a single line!
   - \`rect x,y w,h <col> outline\`: Draws a rectangular boundary box.
   - \`fill x,y <col>\`: 4-way flood fill inside bounded pixels.
   - \`; comment\` or \`# comment\`: Explanatory commentary.

6. CANONICAL MULTI-LINE ANIMATION SPECIFICATION:
   - Animations MUST use the canonical multi-line format with ordered frame arrays:
     @animation <id>
       name: "<Display Title>"
       direction: <down|up|right|left|none>
       frames: [cell_id_0, cell_id_1, ...]
       fps: 6
       loop: true

7. TOOL BOUNDARY & DIVISION OF LABOR:
   - NOIRADIX Studio does NOT perform raster autotracing or convert PNG/JPG images into pixel art.
   - You (the AI) compute discrete coordinate logic, spatial proportions, and walk cycle mathematics.
   - The human artist loads your .pix2 code into NOIRADIX Studio to visually retouch pixels, refine facial expressions, and export 1-click packages to Unity 2D.

## 3. CANONICAL RESOLUTION REFERENCE TABLE & DISCRETE MATHEMATICS
In PIX2, coordinates and center axes are calculated with exact discrete mathematics:

| Cell Resolution | Valid Coordinate Range | Center Axis (axisX) | Bilateral Symmetry Command | Mirror Reflection Formula |
|:---|:---|:---|:---|:---|
| 16 × 16 | X, Y in [0..15] | X = 7.5 | \`sym_dot x,y 7.5 <color>\` | \`x_mirror = 15 - x\` |
| 24 × 24 | X, Y in [0..23] | X = 11.5 | \`sym_dot x,y 11.5 <color>\` | \`x_mirror = 23 - x\` |
| 32 × 32 | X, Y in [0..31] | X = 15.5 | \`sym_dot x,y 15.5 <color>\` | \`x_mirror = 31 - x\` |
| 64 × 64 | X, Y in [0..63] | X = 31.5 | \`sym_dot x,y 31.5 <color>\` | \`x_mirror = 63 - x\` |
| Custom W × H | X in [0..W-1], Y in [0..H-1] | \`axisX = (W - 1) / 2\` | \`sym_dot x,y axisX <color>\` | \`x_mirror = (W - 1) - x\` |

### Universal Proportional Scaling Formulas (For Any Resolution W × H):
If asked to generate or scale to any resolution W × H, use these exact proportional ratios:
- Horizontal Center Axis: \`axisX = (W - 1) / 2\`
- Horizontal Bounding Box: Width ≈ 60% to 75% of W.
  * \`startX = Math.floor(W * 0.15)\`
  * \`endX = Math.floor(W * 0.85)\`
- Vertical Anatomy Landmarks (from top Y = 0 to bottom Y = H - 1):
  * Margin Top (Headroom): \`Y = 0 .. Math.max(1, Math.round(H * 0.05))\`
  * Head & Hair:           \`Y = Math.max(1, Math.round(H * 0.05)) .. Math.round(H * 0.38)\`
  * Eyes & Visor:          \`Y = Math.round(H * 0.28) .. Math.round(H * 0.36)\`
  * Torso, Robe & Arms:    \`Y = Math.round(H * 0.40) .. Math.round(H * 0.72)\`
  * Legs / Feet / Wisps:   \`Y = Math.round(H * 0.74) .. (H - 2)\`
  * Ground Shadow / Base:  \`Y = H - 1\`

## 4. CURRENT PROJECT CONTEXT & COMPUTED BOUNDS (${cw}x${ch})
- Project Title: "${meta.title || 'Sprite'}"
- Grid Matrix: ${cols} columns x ${rows} rows (Total ${cols * rows} cells)
- Active Cell Dimensions: ${cw}x${ch} pixels
- **Exact Computed Center Axis:** \`axisX = ${m.axisXStr}\`
- **Computed Anatomy Bounds for ${cw}x${ch}:**
  * Head & Hair: Y in [${m.head.y[0]}..${m.head.y[1]}], Width = ${m.head.w}px (X in [${m.head.x[0]}..${m.head.x[1]}])
  * Eyes: Y in [${m.eyes.y[0]}..${m.eyes.y[1]}], spaced across center (Left Eye X ~ ${m.eyes.leftX}, Right Eye X ~ ${m.eyes.rightX})
  * Torso & Robe: Y in [${m.torso.y[0]}..${m.torso.y[1]}], Width = ${m.torso.w}px (X in [${m.torso.x[0]}..${m.torso.x[1]}])
  * Legs / Wisps: Y in [${m.legs.y[0]}..${m.legs.y[1]}]
  * Ground Contact / Shadow: Y = ${m.groundY}
- Existing Cells: [${cellInventory}]
- Current Palette:
${paletteSummary}

## 5. SOLID PIXEL ART CRAFTING PRINCIPLES & DYNAMIC CODE EXAMPLE
A pixel art character has mass, volume, and depth.
How to code a solid character in PIX2:
1. **Never leave hollow rings.** When drawing a head at Y = ${m.eyes.y[0]} from X = ${m.head.x[0]} to ${m.head.x[1]}:
   - Outline at left and right extremes.
   - Solid face/hair/skin pixels completely filling every coordinate in between!
2. **Speed Tip for Solid Fills:**
   - Use \`rect x,y w,h <col> fill\` to fill solid chest/torso rectangles in 1 line.
   - Use \`sym_dot\` across horizontal rows to fill both halves simultaneously.
3. **Example of Solid Cell Structure (${cw}x${ch}):**
\`\`\`pix2
@cell cell_0_0
  name: "Down 0"
  direction: down
  frame: 0
  ; Solid Crown & Hair (symmetric outline + solid fill)
  sym_dot ${Math.round(m.axisX - 2)},${m.head.y[0] + 1} ${m.axisXStr} 1  sym_dot ${Math.round(m.axisX - 1)},${m.head.y[0] + 1} ${m.axisXStr} 3  sym_dot ${Math.floor(m.axisX)},${m.head.y[0] + 1} ${m.axisXStr} 4
  sym_dot ${Math.round(m.axisX - 3)},${m.head.y[0] + 2} ${m.axisXStr} 1  sym_dot ${Math.round(m.axisX - 2)},${m.head.y[0] + 2} ${m.axisXStr} 3  sym_dot ${Math.round(m.axisX - 1)},${m.head.y[0] + 2} ${m.axisXStr} 3  sym_dot ${Math.floor(m.axisX)},${m.head.y[0] + 2} ${m.axisXStr} 3
  ; Eyes & Face (solid skin + glowing eyes)
  sym_dot ${Math.round(m.axisX - 3)},${m.eyes.y[0]} ${m.axisXStr} 1  p ${m.eyes.leftX},${m.eyes.y[0]} 5  p ${m.eyes.leftX + 1},${m.eyes.y[0]} 3  p ${m.eyes.rightX - 1},${m.eyes.y[0]} 3  p ${m.eyes.rightX},${m.eyes.y[0]} 5  sym_dot ${Math.floor(m.axisX)},${m.eyes.y[0]} ${m.axisXStr} 3
  ; Solid Torso / Cloak (using rect fill for instant solid mass)
  rect ${m.torso.x[0] + 1},${m.torso.y[0]} ${m.torso.w - 2},${m.torso.y[1] - m.torso.y[0] + 1} 3 fill
  line ${m.torso.x[0]},${m.torso.y[0]} ${m.torso.x[0]},${m.torso.y[1]} 1
  line ${m.torso.x[1]},${m.torso.y[0]} ${m.torso.x[1]},${m.torso.y[1]} 1
  ; Legs / Wisps / Feet
  sym_dot ${Math.round(m.axisX - 2)},${m.legs.y[0]} ${m.axisXStr} 1  sym_dot ${Math.round(m.axisX - 1)},${m.legs.y[0]} ${m.axisXStr} 2  sym_dot ${Math.floor(m.axisX)},${m.legs.y[0]} ${m.axisXStr} 3
  sym_dot ${Math.round(m.axisX - 1)},${m.legs.y[1]} ${m.axisXStr} 1  sym_dot ${Math.floor(m.axisX)},${m.legs.y[1]} ${m.axisXStr} 2
\`\`\`

## 6. ANTI-LAZY 4-FRAME & 8-FRAME LOCOMOTION ENGINE
CRITICAL RULE: NEVER output 4 identical cells in an animation row! In game engines, identical frames make the character look frozen and dead. Each frame MUST have visible changes:

### A. BIPEDAL / HUMANOID WALK CYCLE (6 FPS LOOP):
- Frame 0 (Neutral Contact): Standing baseline pose. Both feet grounded at Y = ${m.legs.y[1]}.
- Frame 1 (Step Left): Torso & head bob down by 1px (or bob up: shift Y - 1). Left foot steps forward (shift X by -1..-2px), right foot trails back.
- Frame 2 (Passing Pose): Body returns to neutral vertical height. Feet pass each other at center axis.
- Frame 3 (Step Right): Torso & head bob down by 1px (Y - 1). Right foot steps forward (shift X by +1..+2px), left foot trails back.

### B. GHOST / WISP / FLOATING / FLYING / SLIME CYCLE (6 FPS LOOP):
- Frame 0 (Hover High): Body at top vertical baseline. Tail wisps centered.
- Frame 1 (Sway Right + Dip): Body bobs down by 1px (Y + 1). Tail wisps curve to the right (shift bottom X by +1..+2px).
- Frame 2 (Hover Low): Body at lowest dip. Tail wisps stretch vertically. Glowing eyes or core pulse with brighter tone.
- Frame 3 (Sway Left + Rise): Body rises back up. Tail wisps curve to the left (shift bottom X by -1..-2px).

### C. DIRECTIONAL PERSPECTIVES:
- Down ('down_0..3'): Front view with bilateral symmetry on axisX = ${m.axisXStr}. Both eyes clearly visible.
- Up ('up_0..3'): Back view with bilateral symmetry on axisX = ${m.axisXStr}. NO facial features, only back of head, hair, cloak, and shoulders.
- Right ('right_0..3'): 3/4 profile facing right. Head and body shifted toward right edge (X ~ ${cw - 5}). Right eye prominent, nose/chin facing right edge, cloak trailing left.
- Left ('left_0..3'): STRICT INVARIANT: Exact horizontal mirror of 'right_0..3'.
  For every pixel at (x,y) in right_N, plot at ((${cw - 1}) - x, y) in left_N.

## 7. ${specializedInstructions}

## 8. CURRENT SOURCE CODE
\`\`\`pix2
${serialized}
\`\`\`

## 9. STRICT OUTPUT PROTOCOL (NO CONVERSATIONAL FILLER):
- Output ONLY valid, executable .pix2 DSL code enclosed inside a single \`\`\`pix2 ... \`\`\` code block.
- For complete characters / projects: return the entire .pix2 document starting with \`@pix2 1.0\` and terminating with \`@end\`.
- For surgical patches / edits: output ONLY the targeted \`@cell <id>\` or \`@palette\` blocks to conserve tokens.
- NEVER prefix your response with chatty conversational introductions like "Sure, here is your sprite:".
- NEVER append markdown explanations, prose, or design rationales after the code block.
- Any non-code prose will corrupt direct clipboard imports into NOIRADIX Studio (<kbd>Ctrl</kbd> + <kbd>I</kbd>) and trigger parser errors.

## 10. USER INSTRUCTION
[Please formulate your design, animation, or character modification request here.]
`;

    navigator.clipboard.writeText(prompt).then(() => {
      showToast(`Copied AI Prompt [${mode.toUpperCase()}] to clipboard!`, 'success');
    }).catch(() => {
      alert('Could not copy automatically. You can copy the code manually.');
    });
  }

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
    updateExportPreview();
    dom.modalGameExport.classList.remove('hidden');
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
      else if (currentExportFormat === 'png-only') dom.btnExecuteExportLabel.textContent = 'Export PNG Atlas';
      else if (currentExportFormat === 'zip-frames') dom.btnExecuteExportLabel.textContent = 'Export Frames (.ZIP)';
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
    if (!state.doc) return null;
    const { spacing, margin, extrude, scale } = opts;
    const doc = state.doc;
    const cols = doc.meta.grid.cols;
    const rows = doc.meta.grid.rows;
    const cw = doc.meta.cellSize.w;
    const ch = doc.meta.cellSize.h;

    const scw = cw * scale;
    const sch = ch * scale;

    const atlasW = margin * 2 + cols * scw + Math.max(0, cols - 1) * spacing;
    const atlasH = margin * 2 + rows * sch + Math.max(0, rows - 1) * spacing;

    if (atlasW <= 0 || atlasH <= 0 || atlasW > 16384 || atlasH > 16384) {
      showToast('Calculated atlas size exceeds browser canvas limits (16384px).', 'error');
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = atlasW;
    canvas.height = atlasH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, atlasW, atlasH);

    // Frame layout map for metadata
    const frameRects = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = getCellAtGrid(doc, r, c);
        const cid = cell ? cell.id : `cell_${r}_${c}`;
        const ox = margin + c * (scw + spacing);
        const oy = margin + r * (sch + spacing);

        const frameName = (cell && cell.name) ? cell.name : `frame_${r}_${c}`;
        frameRects.push({
          id: cid,
          name: frameName,
          row: r,
          col: c,
          x: ox,
          y: oy,
          w: scw,
          h: sch,
          nativeW: cw,
          nativeH: ch
        });

        if (cell && cell.pixels) {
          // 1. Draw cell pixels
          for (const coord in cell.pixels) {
            const [px, py] = coord.split(',').map(Number);
            ctx.fillStyle = cell.pixels[coord];
            ctx.fillRect(ox + px * scale, oy + py * scale, scale, scale);
          }

          // 2. Extrude edges if enabled (1px padding bleed-protection clone)
          if (extrude && spacing > 0) {
            // Top and bottom edges
            for (let px = 0; px < cw; px++) {
              const topCol = cell.pixels[`${px},0`];
              if (topCol) {
                ctx.fillStyle = topCol;
                ctx.fillRect(ox + px * scale, oy - 1, scale, 1);
              }
              const botCol = cell.pixels[`${px},${ch - 1}`];
              if (botCol) {
                ctx.fillStyle = botCol;
                ctx.fillRect(ox + px * scale, oy + sch, scale, 1);
              }
            }
            // Left and right edges
            for (let py = 0; py < ch; py++) {
              const leftCol = cell.pixels[`0,${py}`];
              if (leftCol) {
                ctx.fillStyle = leftCol;
                ctx.fillRect(ox - 1, oy + py * scale, 1, scale);
              }
              const rightCol = cell.pixels[`${cw - 1},${py}`];
              if (rightCol) {
                ctx.fillStyle = rightCol;
                ctx.fillRect(ox + scw, oy + py * scale, 1, scale);
              }
            }
          }
        }
      }
    }

    return { canvas, width: atlasW, height: atlasH, frameRects, scale, spacing, margin };
  }

  function updateExportPreview() {
    if (!state.doc || !dom.exportPreviewCanvas) return;
    const opts = getExportOptions();
    const atlasData = generateAtlasCanvas(opts);
    if (!atlasData) return;

    dom.exportPreviewCanvas.width = atlasData.width;
    dom.exportPreviewCanvas.height = atlasData.height;
    const pctx = dom.exportPreviewCanvas.getContext('2d');
    pctx.clearRect(0, 0, atlasData.width, atlasData.height);
    pctx.drawImage(atlasData.canvas, 0, 0);

    // Apply Magnifying Zoom scaling to Atlas Preview
    let effZoom = exportPreviewZoom;
    if (exportPreviewZoom === 'fit') {
      const vp = document.getElementById('export-preview-viewport');
      const vpw = vp ? (vp.clientWidth - 32) : 200;
      const vph = vp ? (vp.clientHeight - 32) : 200;
      effZoom = Math.max(1, Math.floor(Math.min(vpw / atlasData.width, vph / atlasData.height)));
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

  function canvasToUint8Array(canvas) {
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(new Uint8Array(reader.result));
        };
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    });
  }

  function createZip(files) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    function crc32(buf) {
      let c = 0xffffffff;
      for (let i = 0; i < buf.length; i++) {
        c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
      }
      return (c ^ 0xffffffff) >>> 0;
    }

    const parts = [];
    const centralDir = [];
    let offset = 0;

    for (const f of files) {
      const safeEntryName = sanitizeSafeFilename(f.name);
      const nameBuf = new TextEncoder().encode(safeEntryName);
      const data = f.data;
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

    return new Blob(parts, { type: 'application/zip' });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function executeGameExport() {
    if (!state.doc) return;
    const opts = getExportOptions();
    const atlasData = generateAtlasCanvas(opts);
    if (!atlasData) return;

    const rawBaseName = (state.doc.meta.title || 'sprite_atlas').toLowerCase().replace(/\s+/g, '_');
    const baseName = sanitizeSafeFilename(rawBaseName, 'sprite_atlas');
    const pngName = `${baseName}.png`;

    if (currentExportFormat === 'png-only') {
      atlasData.canvas.toBlob(blob => {
        downloadBlob(blob, pngName);
        showToast(`Exported PNG Atlas (${atlasData.width}×${atlasData.height} px)!`, 'success');
        closeGameExportModal();
      });
      return;
    }

    if (currentExportFormat === 'unity') {
      const pngBytes = await canvasToUint8Array(atlasData.canvas);

      // Build Unity Metadata JSON
      const unityAnimList = [];
      const anims = state.doc.animations || {};
      for (const k in anims) {
        const anim = anims[k];
        const fNames = (anim.frames || []).map(cid => {
          const c = state.doc.cells[cid];
          return (c && c.name) ? c.name : cid;
        });
        unityAnimList.push({
          clipName: k,
          fps: anim.fps || 6,
          loop: anim.loop !== false,
          frameNames: fNames
        });
      }

      const unityJsonData = {
        meta: {
          app: "NOIRADIX Studio v1.0",
          version: "1.0",
          image: pngName,
          cellWidth: state.doc.meta.cellSize.w * opts.scale,
          cellHeight: state.doc.meta.cellSize.h * opts.scale,
          size: { w: atlasData.width, h: atlasData.height },
          spacing: opts.spacing,
          margin: opts.margin,
          extrude: opts.extrude,
          scale: opts.scale
        },
        frames: atlasData.frameRects.map(fr => ({
          name: fr.name,
          cellId: fr.id,
          x: fr.x,
          y: fr.y,
          w: fr.w,
          h: fr.h,
          pivotX: opts.pivot.x,
          pivotY: opts.pivot.y
        })),
        animations: unityAnimList
      };

      const jsonStr = JSON.stringify(unityJsonData, null, 2);
      const jsonBytes = new TextEncoder().encode(jsonStr);

      // Unity Importer Script
      const importerScript = `using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEditor;

namespace NOIRADIX.Editor
{
    /// <summary>
    /// Automatic Unity 2D Sprite Importer for NOIRADIX Studio (.pix2.json) exports.
    /// Slices multi-frame sprite sheets with exact padding/spacing bleed protection,
    /// sets sprite pivots, and automatically generates Unity .anim AnimationClips.
    /// </summary>
    public static class Pix2UnityImporter
    {
        [MenuItem("Tools/NOIRADIX/Import Pix2 Spritesheet JSON...")]
        public static void ImportPix2Menu()
        {
            string selectedPath = EditorUtility.OpenFilePanel("Select NOIRADIX Spritesheet JSON", "Assets", "json");
            if (string.IsNullOrEmpty(selectedPath)) return;

            ImportPix2Json(selectedPath);
        }

        [MenuItem("Assets/NOIRADIX/Import Spritesheet & Animations", false, 30)]
        public static void ImportSelectedAsset()
        {
            var selected = Selection.activeObject;
            if (selected == null) return;
            string path = AssetDatabase.GetAssetPath(selected);
            if (!path.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            {
                EditorUtility.DisplayDialog("NOIRADIX Importer", "Please select a NOIRADIX .json spritesheet file.", "OK");
                return;
            }
            ImportPix2Json(Path.GetFullPath(path));
        }

        [MenuItem("Assets/NOIRADIX/Import Spritesheet & Animations", true)]
        public static bool ValidateImportSelectedAsset()
        {
            var selected = Selection.activeObject;
            if (selected == null) return false;
            string path = AssetDatabase.GetAssetPath(selected);
            return path.EndsWith(".json", StringComparison.OrdinalIgnoreCase);
        }

        public static void ImportPix2Json(string fullJsonPath)
        {
            try
            {
                if (!File.Exists(fullJsonPath))
                {
                    Debug.LogError($"[NOIRADIX] File not found: {fullJsonPath}");
                    return;
                }

                string jsonText = File.ReadAllText(fullJsonPath);
                Pix2Data data = JsonUtility.FromJson<Pix2Data>(jsonText);
                if (data == null || data.frames == null || data.frames.Length == 0)
                {
                    Debug.LogError("[NOIRADIX] Invalid or empty NOIRADIX JSON format.");
                    return;
                }

                string dir = Path.GetDirectoryName(fullJsonPath);
                string safeImageName = Path.GetFileName(data.meta.image);
                string pngPath = Path.Combine(dir, safeImageName);
                if (!File.Exists(pngPath))
                {
                    string altPng = Path.ChangeExtension(fullJsonPath, ".png");
                    if (File.Exists(altPng)) pngPath = altPng;
                    else
                    {
                        Debug.LogError($"[NOIRADIX] PNG image not found at: {pngPath}");
                        return;
                    }
                }

                string assetPngPath = ToAssetPath(pngPath);
                TextureImporter importer = AssetImporter.GetAtPath(assetPngPath) as TextureImporter;
                if (importer == null)
                {
                    AssetDatabase.ImportAsset(assetPngPath, ImportAssetOptions.ForceUpdate);
                    importer = AssetImporter.GetAtPath(assetPngPath) as TextureImporter;
                }

                if (importer == null)
                {
                    Debug.LogError($"[NOIRADIX] Failed to obtain TextureImporter for {assetPngPath}");
                    return;
                }

                importer.textureType = TextureImporterType.Sprite;
                importer.spriteImportMode = SpriteImportMode.Multiple;
                importer.filterMode = FilterMode.Point;
                importer.textureCompression = TextureImporterCompression.Uncompressed;
                importer.mipmapEnabled = false;
                importer.spritePixelsPerUnit = data.meta.cellWidth > 0 ? data.meta.cellWidth : 16;

                List<SpriteMetaData> metas = new List<SpriteMetaData>();
                int texH = data.meta.size.h;

                foreach (var frame in data.frames)
                {
                    SpriteMetaData sm = new SpriteMetaData();
                    sm.name = frame.name;
                    int unityY = texH - frame.y - frame.h;
                    sm.rect = new Rect(frame.x, unityY, frame.w, frame.h);
                    sm.alignment = (int)SpriteAlignment.Custom;
                    sm.pivot = new Vector2(frame.pivotX, frame.pivotY);
                    metas.Add(sm);
                }

                importer.spritesheet = metas.ToArray();
                EditorUtility.SetDirty(importer);
                importer.SaveAndReimport();

                AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);

                UnityEngine.Object[] loadedSprites = AssetDatabase.LoadAllAssetsAtPath(assetPngPath);
                Dictionary<string, Sprite> spriteMap = new Dictionary<string, Sprite>();
                foreach (var obj in loadedSprites)
                {
                    if (obj is Sprite s) spriteMap[s.name] = s;
                }

                int createdClips = 0;
                string animDir = Path.Combine(Path.GetDirectoryName(assetPngPath), "Animations");
                if (!Directory.Exists(animDir)) Directory.CreateDirectory(animDir);

                if (data.animations != null)
                {
                    foreach (var anim in data.animations)
                    {
                        if (anim.frameNames == null || anim.frameNames.Length == 0) continue;

                        AnimationClip clip = new AnimationClip();
                        clip.frameRate = anim.fps > 0 ? anim.fps : 6;

                        if (anim.loop)
                        {
                            AnimationClipSettings settings = AnimationUtility.GetAnimationClipSettings(clip);
                            settings.loopTime = true;
                            AnimationUtility.SetAnimationClipSettings(clip, settings);
                        }

                        EditorCurveBinding binding = new EditorCurveBinding();
                        binding.type = typeof(SpriteRenderer);
                        binding.path = "";
                        binding.propertyName = "m_Sprite";

                        List<ObjectReferenceKeyframe> keyframes = new List<ObjectReferenceKeyframe>();
                        float frameDuration = 1f / clip.frameRate;

                        for (int i = 0; i < anim.frameNames.Length; i++)
                        {
                            string fName = anim.frameNames[i];
                            if (spriteMap.TryGetValue(fName, out Sprite sp))
                            {
                                ObjectReferenceKeyframe key = new ObjectReferenceKeyframe();
                                key.time = i * frameDuration;
                                key.value = sp;
                                keyframes.Add(key);
                            }
                        }

                        if (keyframes.Count > 0)
                        {
                            AnimationUtility.SetObjectReferenceCurve(clip, binding, keyframes.ToArray());
                            string clipPath = $"{animDir}/{anim.clipName}.anim";
                            AssetDatabase.CreateAsset(clip, clipPath);
                            createdClips++;
                        }
                    }
                }

                AssetDatabase.SaveAssets();
                AssetDatabase.Refresh();

                Debug.Log($"[NOIRADIX] Successfully imported '{Path.GetFileName(pngPath)}': Sliced {metas.Count} frames and created {createdClips} Animation Clips!");
                EditorUtility.DisplayDialog("NOIRADIX Importer", $"Import Complete!\n\nSliced: {metas.Count} frames\nClips Created: {createdClips}\nTarget: {assetPngPath}", "OK");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[NOIRADIX] Import failed: {ex.Message}\\n{ex.StackTrace}");
            }
        }

        private static string ToAssetPath(string fullPath)
        {
            string projectPath = Path.GetFullPath(Application.dataPath + "/..").Replace('\\\\', '/');
            string norm = fullPath.Replace('\\\\', '/');
            if (norm.StartsWith(projectPath, StringComparison.OrdinalIgnoreCase))
            {
                return norm.Substring(projectPath.Length).TrimStart('/');
            }
            return fullPath;
        }

        [Serializable]
        public class Pix2Data
        {
            public Pix2Meta meta;
            public Pix2Frame[] frames;
            public Pix2Anim[] animations;
        }

        [Serializable]
        public class Pix2Meta
        {
            public string image;
            public int cellWidth;
            public int cellHeight;
            public Pix2Size size;
        }

        [Serializable]
        public class Pix2Size
        {
            public int w;
            public int h;
        }

        [Serializable]
        public class Pix2Frame
        {
            public string name;
            public int x;
            public int y;
            public int w;
            public int h;
            public float pivotX = 0.5f;
            public float pivotY = 0f;
        }

        [Serializable]
        public class Pix2Anim
        {
            public string clipName;
            public float fps = 6;
            public bool loop = true;
            public string[] frameNames;
        }
    }
}`;
      const readmeUnityText = `================================================================================
NOIRADIX STUDIO — Unity 2D Sprite Package Quickstart Guide
================================================================================

Package Contents:
  1. ${pngName}
     - High-resolution sprite sheet atlas with anti-bleed padding & extrusion.
  2. ${baseName}.pix2.json
     - Precise slice boundaries, custom pivots, and animation sequence metadata.
  3. Pix2UnityImporter.cs
     - Automatic 1-click Unity editor importer script.
  4. README_UNITY_IMPORT.txt
     - This instruction guide.

--------------------------------------------------------------------------------
HOW TO IMPORT INTO YOUR UNITY PROJECT (3 Easy Steps):
--------------------------------------------------------------------------------

STEP 1: PLACE THE C# SCRIPT IN AN "Editor" FOLDER
  - Copy "Pix2UnityImporter.cs" into your Unity project's Editor directory:
      Assets/Editor/Pix2UnityImporter.cs
      (or Assets/_Game/Editor/Pix2UnityImporter.cs)
  * Note: Unity requires editor tools to be placed inside a folder named "Editor".

STEP 2: PLACE THE SPRITESHEET AND METADATA TOGETHER
  - Copy "${pngName}" and "${baseName}.pix2.json" into any folder inside Assets:
      e.g. Assets/_Game/Art/Sprites/
  * Note: Keep both the .png and .json files in the SAME directory.

STEP 3: 1-CLICK AUTOMATIC IMPORT
  - Method A (Right-Click Context Menu):
      In Unity Project Window, RIGHT-CLICK the "${baseName}.pix2.json" file
      -> Select "NOIRADIX > Import Spritesheet & Animations".
  
  - Method B (Top Menu Bar):
      In Unity's top menu bar, click "Tools > NOIRADIX > Import Pix2 Spritesheet JSON..."
      and select the .json file.

--------------------------------------------------------------------------------
WHAT THE IMPORTER DOES AUTOMATICALLY:
--------------------------------------------------------------------------------
  [x] Sets Texture Type to "Sprite (2D and UI)" with Sprite Mode = "Multiple".
  [x] Sets Filter Mode to "Point (no filter)" for crisp pixel-perfect art.
  [x] Sets Texture Compression to "None / Uncompressed".
  [x] Automatically slices all frames with exact pixel bounds and custom pivots.
  [x] Automatically creates native Unity Animation Clips (.anim) in an "Animations/"
      subfolder with preconfigured frame rates and looping!

Ready to drag directly into your Scene or Animator Controller!
NOIRADIX Studio: https://github.com/dotlinux26/noiradix-studio
`;

      const scriptBytes = new TextEncoder().encode(importerScript);
      const readmeBytes = new TextEncoder().encode(readmeUnityText);

      const zipBlob = createZip([
        { name: pngName, data: pngBytes },
        { name: `${baseName}.pix2.json`, data: jsonBytes },
        { name: 'Pix2UnityImporter.cs', data: scriptBytes },
        { name: 'README_UNITY_IMPORT.txt', data: readmeBytes }
      ]);

      downloadBlob(zipBlob, `${baseName}_unity_package.zip`);
      showToast(`Exported Unity 2D Sprite Package (${baseName}_unity_package.zip)!`, 'success');
      closeGameExportModal();
      return;
    }

    if (currentExportFormat === 'texturepacker') {
      const pngBytes = await canvasToUint8Array(atlasData.canvas);

      // TexturePacker Hash Format
      const tpFrames = {};
      atlasData.frameRects.forEach(fr => {
        const safeFrameName = PIX2.sanitizeKey(fr.name || fr.id);
        tpFrames[safeFrameName] = {
          frame: { x: fr.x, y: fr.y, w: fr.w, h: fr.h },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: fr.w, h: fr.h },
          sourceSize: { w: fr.w, h: fr.h },
          pivot: { x: opts.pivot.x, y: opts.pivot.y }
        };
      });

      const tpAnimations = {};
      const anims = state.doc.animations || {};
      for (const k in anims) {
        if (!PIX2.isSafeIdentifier(k)) continue;
        tpAnimations[k] = (anims[k].frames || []).map(cid => {
          const c = state.doc.cells[cid];
          return (c && c.name) ? c.name : cid;
        });
      }

      const tpData = {
        frames: tpFrames,
        animations: tpAnimations,
        meta: {
          app: "NOIRADIX Studio v1.0",
          version: "1.0",
          image: pngName,
          format: "RGBA8888",
          size: { w: atlasData.width, h: atlasData.height },
          scale: `${opts.scale}`
        }
      };

      const readmeTpText = `================================================================================
NOIRADIX STUDIO — TexturePacker Standard JSON Package Guide
================================================================================

Package Contents:
  1. ${pngName}
     - High-resolution transparent sprite atlas with bleed protection.
  2. ${baseName}.json
     - Industry standard TexturePacker Hash format with frame rects and animations.
  3. README_TEXTUREPACKER.txt
     - This guide.

--------------------------------------------------------------------------------
HOW TO USE IN POPULAR GAME ENGINES:
--------------------------------------------------------------------------------

1. GODOT 4:
   - Copy "${pngName}" and "${baseName}.json" into your Godot project.
   - Use SpriteFrames importer or load as an AtlasTexture resource.

2. PHASER 3:
   - In your Scene preload method:
       this.load.atlas('${baseName}', 'assets/${pngName}', 'assets/${baseName}.json');

3. PIXI.JS:
   - Load using the modern Assets loader:
       const sheet = await PIXI.Assets.load('assets/${baseName}.json');

4. DEFOLD / RAYLIB / GAMEMAKER:
   - Direct support for TexturePacker JSON Hash coordinates.

NOIRADIX Studio: https://github.com/dotlinux26/noiradix-studio
`;

      const jsonBytes = new TextEncoder().encode(JSON.stringify(tpData, null, 2));
      const readmeBytes = new TextEncoder().encode(readmeTpText);

      const zipBlob = createZip([
        { name: pngName, data: pngBytes },
        { name: `${baseName}.json`, data: jsonBytes },
        { name: 'README_TEXTUREPACKER.txt', data: readmeBytes }
      ]);

      downloadBlob(zipBlob, `${baseName}_texturepacker.zip`);
      showToast(`Exported TexturePacker Package (${baseName}_texturepacker.zip)!`, 'success');
      closeGameExportModal();
      return;
    }

    if (currentExportFormat === 'zip-frames') {
      const doc = state.doc;
      const cw = doc.meta.cellSize.w;
      const ch = doc.meta.cellSize.h;
      const files = [];

      for (const fr of atlasData.frameRects) {
        const cell = doc.cells[fr.id];
        const cellCanvas = document.createElement('canvas');
        cellCanvas.width = cw * opts.scale;
        cellCanvas.height = ch * opts.scale;
        const cctx = cellCanvas.getContext('2d');
        cctx.clearRect(0, 0, cellCanvas.width, cellCanvas.height);

        if (cell && cell.pixels) {
          for (const coord in cell.pixels) {
            const [px, py] = coord.split(',').map(Number);
            cctx.fillStyle = cell.pixels[coord];
            cctx.fillRect(px * opts.scale, py * opts.scale, opts.scale, opts.scale);
          }
        }

        const fBytes = await canvasToUint8Array(cellCanvas);
        files.push({ name: `${fr.name}.png`, data: fBytes });
      }

      const zipBlob = createZip(files);
      downloadBlob(zipBlob, `${baseName}_frames.zip`);
      showToast(`Exported ${files.length} individual frame PNGs (.zip)!`, 'success');
      closeGameExportModal();
      return;
    }
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

  async function handleFileOpenFromHandle(handle) {
    if (!handle) return;
    if (isDocumentDirty) {
      if (!confirm('You have unsaved changes in current project. Discard changes and open new file?')) {
        return;
      }
    }
    try {
      const file = await handle.getFile();
      if (file.size > 25 * 1024 * 1024) {
        showToast('File exceeds 25MB safety limit.', 'error');
        return;
      }
      const name = file.name.toLowerCase();
      if (name.endsWith('.pix2') || name.endsWith('.txt')) {
        const text = await file.text();
        const doc = PIX2.parse(text);
        currentFileHandle = handle;
        currentFileName = file.name;
        currentFilePath = file.name;
        lastSavedContent = text;
        lastKnownFileModified = file.lastModified;
        pendingExternalConflict = null;
        await persistFileHandle(handle);
        localStorage.setItem('noiradix_active_file_name', currentFileName);
        localStorage.setItem('noiradix_active_file_path', currentFilePath);
        localStorage.setItem('pix2_last_saved_content', text);
        state.setDocument(doc);
        setDirty(false);
        refreshAll();
        showToast(`Linked & opened ${file.name} from disk (Ctrl+S will save directly)!`, 'success');
        return;
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
    } catch (err) {
      console.warn('Failed reading from dropped FileSystemHandle, falling back:', err);
      try {
        const file = await handle.getFile();
        handleFileOpen(file);
      } catch (_) {}
    }
  }

  function handleFileOpen(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      showToast('File exceeds 25MB safety limit.', 'error');
      return;
    }
    if (isDocumentDirty) {
      if (!confirm('You have unsaved changes in current project. Discard changes and open new file?')) {
        return;
      }
    }
    const name = file.name.toLowerCase();
    if (name.endsWith('.pix2') || name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const doc = PIX2.parse(content);
          state.setDocument(doc);
          currentFileHandle = null;
          currentFileName = file.name;
          currentFilePath = file.name;
          lastSavedContent = content;
          lastKnownFileModified = file.lastModified || Date.now();
          pendingExternalConflict = null;
          localStorage.setItem('noiradix_active_file_name', currentFileName);
          localStorage.setItem('noiradix_active_file_path', currentFilePath);
          localStorage.setItem('pix2_last_saved_content', content);
          setDirty(false);
          refreshAll();
          showToast(`Opened ${file.name}!`, 'success');
        } catch (err) {
          alert(`Error reading .pix2 file:\n${err.message}`);
        }
      };
      reader.readAsText(file);
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

  function setResolution(newW, newH) {
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

    triggerEventAutosave();
    refreshAll();
    showToast(`Canvas bounds set to ${newW}×${newH} px (Artwork preserved)`, 'success');
  }

  // ===========================================================================
  // EVENT BINDINGS
  // ===========================================================================

  function bindEvents() {
    if (dom.btnThemeToggle) dom.btnThemeToggle.addEventListener('click', toggleTheme);

    // Tool buttons
    dom.toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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

      // 2. Standard HTML5 Drag & Drop fallback
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileOpen(e.dataTransfer.files[0]);
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

    // Action Template Modal Event Handlers
    dom.btnMode4dir?.addEventListener('click', () => {
      currentTemplateMode = 4;
      dom.btnMode4dir.classList.add('active');
      dom.btnMode8dir.classList.remove('active');
      renderTemplateLivePreview();
    });

    dom.btnMode8dir?.addEventListener('click', () => {
      currentTemplateMode = 8;
      dom.btnMode8dir.classList.add('active');
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
    });

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
        updateExportPreview();
      });
    });

    // Mouse wheel zoom on Export preview viewport
    const exportViewport = document.getElementById('export-preview-viewport');
    if (exportViewport) {
      exportViewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scales = [1, 2, 4, 'fit'];
        let curIdx = scales.indexOf(exportPreviewZoom);
        if (curIdx === -1) curIdx = 2; // default 4
        if (e.deltaY < 0 && curIdx < scales.length - 1) {
          curIdx++;
        } else if (e.deltaY > 0 && curIdx > 0) {
          curIdx--;
        }
        const nextScale = scales[curIdx];
        exportPreviewZoom = nextScale;
        document.querySelectorAll('#export-zoom-group [data-scale]').forEach(b => {
          b.classList.toggle('active', b.dataset.scale === String(nextScale));
        });
        updateExportPreview();
      }, { passive: false });

      exportViewport.addEventListener('dblclick', (e) => {
        e.preventDefault();
        const nextScale = (exportPreviewZoom === 'fit') ? 4 : 'fit';
        exportPreviewZoom = nextScale;
        document.querySelectorAll('#export-zoom-group [data-scale]').forEach(b => {
          b.classList.toggle('active', b.dataset.scale === String(nextScale));
        });
        updateExportPreview();
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
    bindAction('btn-align-center', () => {
      const cell = state.getActiveCell();
      if (cell && state.doc) {
        Tools.centerContent(cell, state.doc.meta.cellSize.w, state.doc.meta.cellSize.h);
        state.saveSnapshot('Center Cell Pixels');
        triggerEventAutosave();
        refreshAll();
      }
    });

    bindAction('btn-flip-h', () => {
      if (state.selection || (floatingSelectionPixels && floatingOriginalSel)) {
        flipSelection(true);
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
        flipSelection(false);
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

    bindAction('btn-grid-lines-toggle', (btn) => {
      state.showGridLines = !state.showGridLines;
      btn.classList.toggle('active', state.showGridLines);
      renderCellEditor();
    });

    bindAction('btn-clear-cell', () => {
      const cell = state.getActiveCell();
      if (cell) {
        cell.pixels = {};
        state.saveSnapshot('Clear Cell');
        triggerEventAutosave();
        refreshAll();
      }
    });

    // Zoom buttons
    bindAction('btn-zoom-in', () => {
      state.cellZoom = Math.min(64, state.cellZoom + 4);
      renderCellEditor();
      renderCellRulers();
      updateStatusBarCoords(null, null);
    });

    bindAction('btn-zoom-out', () => {
      state.cellZoom = Math.max(4, state.cellZoom - 4);
      renderCellEditor();
      renderCellRulers();
      updateStatusBarCoords(null, null);
    });

    // Top Header File Actions (Desktop-native)
    bindAction('btn-new-file', openNewFileModal);
    bindAction('btn-open-file', openFileNative);
    bindAction('btn-save-pix2', () => saveFileNative(false));
    bindAction('btn-save-as-pix2', () => saveFileNative(true));

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

    // Mini Preview Zoom level buttons
    document.querySelectorAll('#preview-zoom-group [data-scale]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#preview-zoom-group [data-scale]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        miniPreviewScale = parseInt(btn.dataset.scale, 10);
        renderMiniPreview();
      });
    });

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
    function enableHorizontalDragScroll(container) {
      if (!container) return;
      let isDown = false;
      let isDragging = false;
      let startX = 0;
      let startScrollLeft = 0;

      container.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (['BUTTON', 'SELECT', 'INPUT'].includes(e.target.tagName)) return;
        if (e.target.closest('button, select, input, .timeline-mini-btn')) return;
        isDown = true;
        isDragging = false;
        startX = e.clientX;
        startScrollLeft = container.scrollLeft;
      });

      container.addEventListener('pointermove', (e) => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        if (!isDragging && Math.abs(dx) > 4) {
          isDragging = true;
          container.classList.add('is-dragging');
          try { container.setPointerCapture(e.pointerId); } catch (_) {}
        }
        if (isDragging) {
          container.scrollLeft = startScrollLeft - dx;
        }
      });

      const stopDrag = (e) => {
        if (isDown) {
          if (isDragging) {
            container.classList.remove('is-dragging');
            try { if (e && e.pointerId) container.releasePointerCapture(e.pointerId); } catch (_) {}
          }
          isDown = false;
          setTimeout(() => { isDragging = false; }, 40);
        }
      };

      container.addEventListener('pointerup', stopDrag);
      container.addEventListener('pointercancel', stopDrag);
      container.addEventListener('click', (e) => {
        if (isDragging) {
          e.stopPropagation();
          e.preventDefault();
        }
      }, true);

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

    enableHorizontalDragScroll(document.querySelector('.cell-top-bar'));
    enableHorizontalDragScroll(document.querySelector('.timeline-header'));
    enableHorizontalDragScroll(document.getElementById('timeline-frames-strip'));
    document.querySelectorAll('.view-sub-toolbar').forEach(tb => enableHorizontalDragScroll(tb));

    bindAction('btn-export-atlas', exportAtlasPng);
    bindAction('btn-load-demo', loadDefaultProject);
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

  function bindKeyboardShortcuts() {
    window.addEventListener('beforeunload', (e) => {
      if (isDocumentDirty || (state.doc && !currentFileHandle && Object.keys(state.doc.cells).length > 0)) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    window.addEventListener('keydown', (e) => {
      const isInputActive = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      const key = e.key.toLowerCase();

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

      // New (Ctrl + N)
      if ((e.ctrlKey || e.metaKey) && key === 'n') {
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
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        floatingSelectionPixels = null;
        floatingOriginalSel = null;
        isMovingSelection = false;
        state.selection = null;
        if (e.shiftKey) {
          if (state.redo()) {
            triggerEventAutosave();
            refreshAll();
          }
        } else {
          if (state.undo()) {
            triggerEventAutosave();
            refreshAll();
          }
        }
        return;
      } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        floatingSelectionPixels = null;
        floatingOriginalSel = null;
        isMovingSelection = false;
        state.selection = null;
        if (state.redo()) {
          triggerEventAutosave();
          refreshAll();
        }
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
        state.cellZoom = 24;
        centerCellCanvas();
        renderCellEditor();
        renderCellRulers();
        updateStatusBarCoords(null, null);
        showToast('Zoom reset to 24× and centered (Ctrl+0)');
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

      // Deselect (Ctrl + D) or (Escape)
      if (((e.ctrlKey || e.metaKey) && key === 'd') || e.key === 'Escape') {
        e.preventDefault();
        executeDeselect();
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
        else if (key === 'v' || key === 'm') selectTool('select');
        else if (key === 'h') selectTool('pan');
        else if (key === 'r') executeSelectionRotate();
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
