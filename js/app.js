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

  function sanitizeSafeFilename(raw, fallback = 'file') {
    if (!raw) return fallback;
    let clean = String(raw)
      .replace(/\\/g, '/')
      .replace(/\0/g, '')
      .split('/')
      .filter(seg => seg && seg !== '.' && seg !== '..')
      .join('_')
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    clean = clean.replace(/^\.+/, '');
    return clean || fallback;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initDomCache();
    initTheme();
    initAnimationPlayers();
    initDraggablePanel();
    initHeaderScroll();
    bindEvents();
    bindKeyboardShortcuts();
    initCanvasPanningAndZoom();
    initAutosave();

    await initAppSession();
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
    // 1. Try restoring persisted FileSystemFileHandle from IndexedDB
    try {
      const savedHandle = await retrievePersistedFileHandle();
      if (savedHandle) {
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
              docLoaded = true;
            }
          }
        } catch (readErr) {
          console.warn('Direct handle getFile read failed, trying cached content:', readErr);
        }

        // If direct read failed (e.g. permission reset on F5), load from last saved content
        if (!docLoaded) {
          const cached = localStorage.getItem('pix2_last_saved_content') || localStorage.getItem('pix2_recovery_snapshot');
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

    // 2. Check crash recovery next
    if (checkCrashRecovery()) {
      return true;
    }

    // 3. Fallback: load default demo
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

    // Tool buttons
    dom.toolButtons = document.querySelectorAll('[data-tool]');
    dom.colorPrimary = document.getElementById('color-primary');
    dom.colorSecondary = document.getElementById('color-secondary');
    dom.colorPickerInput = document.getElementById('color-picker-input');
    dom.paletteSwatches = document.getElementById('palette-swatches');
    dom.paletteSelect = document.getElementById('palette-select');
    dom.btnAddColor = document.getElementById('btn-add-color');

    // Code & Prompt
    dom.codeTextarea = document.getElementById('pix2-code-text');
    dom.btnApplyCode = document.getElementById('btn-apply-code');
    dom.btnCopyAiPrompt = document.getElementById('btn-copy-ai-prompt');

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
    dom.btnOpenSpec = document.getElementById('btn-open-spec');

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
  // SMOOTH DRAG-TO-SCROLL & MOUSE-WHEEL FOR TOOLBARS (No ugly native scrollbars)
  // ===========================================================================

  function initHeaderScroll() {
    const containers = [
      document.querySelector('.studio-header'),
      document.getElementById('tabs-container'),
      document.querySelector('.studio-statusbar'),
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
    if (!dom.btnStudioPlay) return;
    if (studioAnimPlayer && studioAnimPlayer.isPlaying) {
      dom.btnStudioPlay.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
      dom.btnStudioPlay.title = 'Pause Animation';
      dom.btnStudioPlay.classList.add('is-playing');
    } else {
      dom.btnStudioPlay.innerHTML = '<i class="fa-solid fa-play"></i> Play';
      dom.btnStudioPlay.title = 'Play Animation';
      dom.btnStudioPlay.classList.remove('is-playing');
    }
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
      animPlayer.scale = 4;
      window.animPlayer = animPlayer;
      animPlayer.start();
      updateFloatingPlayButtonUI();
    }

    if (dom.studioAnimCanvas) {
      studioAnimPlayer = new AnimationPlayer(dom.studioAnimCanvas);
      studioAnimPlayer.scale = 8;
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

  function setDirty(dirty) {
    isDocumentDirty = dirty;
    const title = (state.doc ? state.doc.meta.title : 'NOIRADIX Studio') || 'Untitled';
    const fileName = currentFileName || (currentFileHandle ? currentFileHandle.name : `${title.toLowerCase().replace(/\s+/g, '_')}.pix2`);
    document.title = dirty ? `● ${fileName} - NOIRADIX Studio` : `${fileName} - NOIRADIX Studio`;

    if (dom.inputProjectTitle) {
      dom.inputProjectTitle.title = dirty ? `${fileName} (Unsaved Changes)` : `${fileName} (Saved)`;
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

    const isLocal = Boolean(currentFileHandle || currentFilePath);

    if (fileSourceBadge && fileSourceText) {
      if (isLocal) {
        fileSourceBadge.className = 'file-source-badge local';
        fileSourceBadge.innerHTML = '<i class="fa-solid fa-hard-drive"></i> <span id="file-source-text">Local File</span>';
        fileSourceBadge.title = 'File located on local drive';
      } else {
        fileSourceBadge.className = 'file-source-badge draft';
        fileSourceBadge.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> <span id="file-source-text">In-Memory Draft</span>';
        fileSourceBadge.title = 'File exists only in temporary browser memory';
      }
    }

    if (filePathText && filePathPill) {
      if (isLocal) {
        const full = currentFilePath || (currentFileHandle ? currentFileHandle.name : currentFileName || 'player_wispling.pix2');
        filePathText.textContent = formatTruncatedPath(full);
        filePathPill.title = `File: ${full}\nClick to copy file name`;
        filePathPill.style.display = 'inline-flex';
      } else {
        filePathText.textContent = 'Unsaved Project (Memory)';
        filePathPill.title = 'Project is held in memory draft. Click Save to save to disk.';
      }
    }

    if (saveStatusBadge && saveStatusText) {
      if (isDocumentDirty) {
        saveStatusBadge.className = 'save-status-badge dirty';
        saveStatusBadge.innerHTML = '<i class="fa-solid fa-circle"></i> <span id="save-status-text">Unsaved</span>';
        saveStatusBadge.title = 'You have unsaved changes';
      } else {
        saveStatusBadge.className = 'save-status-badge clean';
        saveStatusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span id="save-status-text">Saved</span>';
        saveStatusBadge.title = 'All changes saved to disk';
      }
    }

    if (btnSave) {
      if (isDocumentDirty) {
        btnSave.classList.add('dirty');
        btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save *</span>';
      } else {
        btnSave.classList.remove('dirty');
        btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save</span>';
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
    if (debouncedAutosaveTimer) clearTimeout(debouncedAutosaveTimer);
    debouncedAutosaveTimer = setTimeout(() => {
      saveRecoverySnapshot();
    }, 1500); // 1500ms debounce
  }

  function saveRecoverySnapshot() {
    if (!state.doc) return;
    try {
      const text = PIX2.serialize(state.doc);
      const snapshot = {
        timestamp: Date.now(),
        title: state.doc.meta.title || 'Untitled',
        data: text
      };
      localStorage.setItem('pix2_recovery_snapshot', JSON.stringify(snapshot));
    } catch (err) {
      console.warn('Autosave snapshot failed:', err);
    }
  }

  function checkCrashRecovery() {
    try {
      const raw = localStorage.getItem('pix2_recovery_snapshot');
      if (!raw) return false;
      const snapshot = JSON.parse(raw);
      const timeAgoSec = Math.round((Date.now() - snapshot.timestamp) / 1000);
      if (timeAgoSec < 86400 * 7) {
        const timeStr = new Date(snapshot.timestamp).toLocaleTimeString();
        const restore = confirm(`Unsaved session found for "${snapshot.title}" from ${timeStr}.\n\nClick OK to RESTORE recovery session.\nClick Cancel to discard.`);
        if (restore) {
          const doc = PIX2.parse(snapshot.data);
          state.setDocument(doc);
          setDirty(true);
          refreshAll();
          showToast('Restored recovery snapshot!', 'success');
          return true;
        } else {
          localStorage.removeItem('pix2_recovery_snapshot');
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
        createBlankProject('Wispling Sprite', 4, 4, 16, 16);
      }
    } else {
      createBlankProject('Wispling Sprite', 4, 4, 16, 16);
    }
    currentFileHandle = null;
    currentFileName = 'player_wispling.pix2';
    currentFilePath = null;
    selectedGridCellId = 'cell_0_0';
    setDirty(false);
    refreshAll();
  }

  function createBlankProject(title, cols, rows, cellW, cellH) {
    const doc = PIX2.createDocument(title, cols, rows, cellW, cellH);
    state.setDocument(doc);
    currentFileHandle = null;
    currentFileName = null;
    currentFilePath = null;
    setDirty(false);
  }

  function refreshAll() {
    renderTabs();
    updateProjectTitleUI();
    updateFileStatusUI();
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
      dom.inputProjectTitle.value = state.doc.meta.title || 'Untitled';
    }
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

  // Layout metrics for Grid Overview (Generous vertical spacing to prevent cramped layout)
  const GRID_LAYOUT = {
    leftHeaderW: 164,
    topHeaderH: 56,
    cellGapX: 28,
    cellGapY: 52,
    zoom: 4
  };

  let gridRowDeleteButtons = [];
  let gridColDeleteButtons = [];

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
      ctx.strokeStyle = isDark ? '#4b5563' : '#94a3b8';
      ctx.lineWidth = 1;
      ctx.stroke();

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
      const cardW = 144;
      const cardH = 50;
      const cardX = 10;
      const cardY = Math.round(rowY + (ch * zoom - cardH) / 2);

      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = isDark ? '#1e2230' : '#ffffff';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      else ctx.rect(cardX, cardY, cardW, cardH);
      ctx.fill();
      ctx.strokeStyle = isDark ? '#4b5563' : '#94a3b8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isDark ? '#a5b4fc' : '#3730a3';
      ctx.font = 'bold 12px "Segoe UI", system-ui, -apple-system, sans-serif';
      ctx.fillText(`Row ${r}:`, cardX + 10, cardY + 8);

      // '×' delete button on top-right of row card
      const rowBtnW = 20;
      const rowBtnH = 20;
      const rowBtnX = cardX + cardW - rowBtnW - 6;
      const rowBtnY = cardY + 6;

      gridRowDeleteButtons.push({ row: r, x: rowBtnX, y: rowBtnY, w: rowBtnW, h: rowBtnH });

      ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rowBtnX, rowBtnY, rowBtnW, rowBtnH, 4);
      else ctx.rect(rowBtnX, rowBtnY, rowBtnW, rowBtnH);
      ctx.fill();

      ctx.strokeStyle = isDark ? '#f87171' : '#ef4444';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(rowBtnX + 5, rowBtnY + 5);
      ctx.lineTo(rowBtnX + rowBtnW - 5, rowBtnY + rowBtnH - 5);
      ctx.moveTo(rowBtnX + rowBtnW - 5, rowBtnY + 5);
      ctx.lineTo(rowBtnX + 5, rowBtnY + rowBtnH - 5);
      ctx.stroke();

      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.font = '600 12px "Segoe UI", system-ui, -apple-system, sans-serif';

      const rowNameWidth = ctx.measureText(rowName).width;
      const maxRowNameW = cardW - 32;

      if (rowNameWidth <= maxRowNameW) {
        ctx.textAlign = 'left';
        ctx.fillText(rowName, cardX + 10, cardY + 26);
      } else {
        hasMarqueeLabels = true;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cardX + 10, cardY + 24, maxRowNameW, 22);
        ctx.clip();

        const now = performance.now();
        const scrollSpeed = 0.035;
        const textGap = 20;
        const totalDist = rowNameWidth + textGap;
        const offset = (now * scrollSpeed) % totalDist;
        const startX = (cardX + 10) - offset;

        ctx.textAlign = 'left';
        ctx.fillText(rowName, startX, cardY + 26);
        ctx.fillText(rowName, startX + totalDist, cardY + 26);
        ctx.restore();
      }

      // Draw Cells in Row
      for (let c = 0; c < cols; c++) {
        const cellId = `cell_${r}_${c}`;
        const cell = doc.cells[cellId];
        const cx = Math.round(leftHeaderW + c * (cw * zoom + cellGapX));
        const cy = Math.round(rowY);

        const isSelected = (cellId === selectedGridCellId);

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
      if (anim.frames && anim.frames.some(fid => fid.startsWith(`cell_${rowIdx}_`))) {
        return animName.replace(/_/g, ' ');
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
          return `cell_${r}_${c}`;
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
          idMapping[`cell_${r}_${c}`] = null;
        }
        continue;
      }

      const newR = (r > rowIdx) ? (r - 1) : r;

      for (let c = 0; c < cols; c++) {
        const oldId = `cell_${r}_${c}`;
        const newId = `cell_${newR}_${c}`;
        idMapping[oldId] = newId;

        const cell = doc.cells[oldId] || { id: oldId, name: `Frame ${r},${c}`, pixels: {}, row: r, col: c };
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
          idMapping[`cell_${r}_${c}`] = null;
        }
        continue;
      }

      const newC = (c > colIdx) ? (c - 1) : c;

      for (let r = 0; r < rows; r++) {
        const oldId = `cell_${r}_${c}`;
        const newId = `cell_${r}_${newC}`;
        idMapping[oldId] = newId;

        const cell = doc.cells[oldId] || { id: oldId, name: `Frame ${r},${c}`, pixels: {}, row: r, col: c };
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
    const parts = (selectedGridCellId || 'cell_0_0').split('_');
    const selR = (parts.length >= 3) ? parseInt(parts[1], 10) : 0;
    deleteSpecificRow(selR);
  }

  function removeSelectedCol() {
    if (!state.doc) return;
    const parts = (selectedGridCellId || 'cell_0_0').split('_');
    const selC = (parts.length >= 3) ? parseInt(parts[2], 10) : 0;
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
      const parts = clip.frames[0].split('_');
      if (parts.length >= 3) clipRow = parseInt(parts[1], 10);
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

  function updateGridInspectorUI() {
    if (!state.doc || !dom.gridCellName) return;
    const cell = state.doc.cells[selectedGridCellId];
    if (!cell) return;

    if (dom.gridSelectedBadge) dom.gridSelectedBadge.textContent = selectedGridCellId;
    if (dom.gridCellIdInput) dom.gridCellIdInput.value = cell.id || selectedGridCellId;
    dom.gridCellName.value = cell.name || selectedGridCellId;

    const parts = selectedGridCellId.split('_');
    const selR = (parts.length >= 3) ? parseInt(parts[1], 10) : 0;
    const selC = (parts.length >= 3) ? parseInt(parts[2], 10) : 0;

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

    for (let c = 0; c < cols; c++) {
      rowCells.push(`cell_${rowIdx}_${c}`);
    }

    // 1. Detach all cells in this row from any animation
    for (const aName in doc.animations) {
      if (doc.animations[aName].frames && Array.isArray(doc.animations[aName].frames)) {
        doc.animations[aName].frames = doc.animations[aName].frames.filter(id => !rowCells.includes(id));
      }
    }

    const dispName = customDisplayName || animKey.replace(/_/g, ' ');

    // 2. Ensure target animation exists
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

    // 3. Assign all row cells to this animation
    doc.animations[animKey].frames = [...rowCells];

    // 4. Update cell names in this row
    rowCells.forEach((cid, c) => {
      if (!doc.cells[cid]) {
        doc.cells[cid] = {
          id: cid,
          name: `${dispName} ${c}`,
          row: rowIdx,
          col: c,
          direction: 'none',
          frame: c,
          pixels: {}
        };
      } else {
        doc.cells[cid].name = `${dispName} ${c}`;
      }
    });

    state.saveSnapshot(`Assign Row ${rowIdx} to ${animKey}`);
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
      card.title = `${cell ? (cell.name || cellId) : cellId} (${cellId})`;

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

      card.addEventListener('click', () => {
        if (studioAnimPlayer) {
          studioAnimPlayer.currentFrameIdx = idx;
          studioAnimPlayer.render();
        }
        updateStudioActiveFrameUI(idx, cellId);
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
  // PALETTE UI
  // ===========================================================================

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
    if (e.button === 1 || e.spaceKey) return;
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
      if (minX === maxX && minY === maxY) {
        state.selection = null; // Clicking single pixel deselects!
        renderCellOverlay();
      } else {
        state.selection = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
        renderCellOverlay();
        showToast(`Selected region: ${state.selection.w}×${state.selection.h}`);
      }
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
      const sx = state.selection.x * zoom;
      const sy = state.selection.y * zoom;
      const sw = state.selection.w * zoom;
      const sh = state.selection.h * zoom;

      // Soft purple scrim inside selection
      ctx.fillStyle = 'rgba(99, 102, 241, 0.16)';
      ctx.fillRect(sx, sy, sw, sh);

      // Base solid dark outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(sx, sy, sw, sh);

      // Foreground dashed bright accent
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);

      // 4 Corner grip handles
      const handleSize = Math.max(3, Math.min(6, zoom / 3));
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(sx - handleSize/2, sy - handleSize/2, handleSize, handleSize);
      ctx.fillRect(sx + sw - handleSize/2, sy - handleSize/2, handleSize, handleSize);
      ctx.fillRect(sx - handleSize/2, sy + sh - handleSize/2, handleSize, handleSize);
      ctx.fillRect(sx + sw - handleSize/2, sy + sh - handleSize/2, handleSize, handleSize);
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
    const parts = cellId.split('_');
    const r = parseInt(parts[1], 10);
    const c = parseInt(parts[2], 10);
    const nextC = c + 1;
    if (nextC < state.doc.meta.grid.cols) {
      const nextId = `cell_${r}_${nextC}`;
      state.beginStroke();
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

    const parts = (cellId || 'cell_0_0').split('_');
    const r = (parts.length >= 3) ? parseInt(parts[1], 10) : 0;
    const c = (parts.length >= 3) ? parseInt(parts[2], 10) : 0;

    const delRowLabel = document.getElementById('ctx-del-row-label');
    if (delRowLabel) delRowLabel.textContent = `Delete Row ${r}`;

    const delColLabel = document.getElementById('ctx-del-col-label');
    if (delColLabel) delColLabel.textContent = `Delete Column ${c}`;

    gridContextMenu.classList.remove('hidden');
    const menuW = 220;
    const menuH = 340;
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

  function initCanvasPanningAndZoom() {
    if (!dom.canvasViewport) return;

    let isSpacePressed = false;
    let isPanning = false;
    let startX = 0, startY = 0;
    let scrollLeft = 0, scrollTop = 0;

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
        isPanning = false;
        dom.canvasViewport.classList.remove('space-held', 'is-panning');
      }
    });

    dom.canvasViewport.addEventListener('mousedown', (e) => {
      if (isSpacePressed || e.button === 1) { // Space + click OR Middle Click
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        scrollLeft = dom.canvasViewport.scrollLeft;
        scrollTop = dom.canvasViewport.scrollTop;
        dom.canvasViewport.classList.add('is-panning');
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      dom.canvasViewport.scrollLeft = scrollLeft - dx;
      dom.canvasViewport.scrollTop = scrollTop - dy;
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

      // Determine pixel anchor: hovered pixel OR selection center OR cell center
      let anchorPx, anchorPy;
      let mouseCanvasX, mouseCanvasY;

      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        mouseCanvasX = e.clientX - rect.left;
        mouseCanvasY = e.clientY - rect.top;
        anchorPx = mouseCanvasX / oldZoom;
        anchorPy = mouseCanvasY / oldZoom;
      } else if (state.selection) {
        anchorPx = state.selection.x + state.selection.w / 2;
        anchorPy = state.selection.y + state.selection.h / 2;
        mouseCanvasX = anchorPx * oldZoom;
        mouseCanvasY = anchorPy * oldZoom;
      } else {
        const cw = state.doc ? state.doc.meta.cellSize.w : 16;
        const ch = state.doc ? state.doc.meta.cellSize.h : 16;
        anchorPx = cw / 2;
        anchorPy = ch / 2;
        mouseCanvasX = anchorPx * oldZoom;
        mouseCanvasY = anchorPy * oldZoom;
      }

      state.cellZoom = newZoom;
      renderCellEditor();
      renderCellRulers();
      updateStatusBarCoords(null, null);

      // Adjust viewport scroll so anchor pixel remains stationary under cursor
      const newMouseCanvasX = anchorPx * newZoom;
      const newMouseCanvasY = anchorPy * newZoom;
      dom.canvasViewport.scrollLeft += (newMouseCanvasX - mouseCanvasX);
      dom.canvasViewport.scrollTop += (newMouseCanvasY - mouseCanvasY);
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
        await persistFileHandle(handle);
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
    const text = PIX2.serialize(state.doc);

    // Direct Save to existing handle (No picker prompt!)
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
        setDirty(false);
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
        const suggested = currentFileName || `${(state.doc.meta.title || 'sprite').toLowerCase().replace(/\s+/g, '_')}.pix2`;
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
        await persistFileHandle(handle);
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
    a.download = `${(state.doc.meta.title || 'sprite').toLowerCase().replace(/\s+/g, '_')}.pix2`;
    a.click();
    URL.revokeObjectURL(url);
    setDirty(false);
    showToast('Downloaded .pix2 file!', 'success');
  }

  // ===========================================================================
  // PIX2 CODE & AI INTEGRATION
  // ===========================================================================

  function renderCodeEditor() {
    if (!state.doc || !dom.codeTextarea) return;
    dom.codeTextarea.value = PIX2.serialize(state.doc);
  }

  function applyCodeToDoc() {
    if (!dom.codeTextarea) return;
    try {
      const code = dom.codeTextarea.value;
      const newDoc = PIX2.parse(code);
      state.setDocument(newDoc);
      state.saveSnapshot('Apply Code');
      triggerEventAutosave();
      refreshAll();
      showToast('PIX2 Code parsed & applied successfully!', 'success');
    } catch (err) {
      alert(`Error parsing PIX2 code:\n${err.message}`);
    }
  }

  function copyAiPrompt() {
    if (!state.doc) return;
    const serialized = PIX2.serialize(state.doc);
    const prompt = `You are editing a pixel art sprite sheet in .pix2 format.

FORMAT PRINCIPLES:
1. Pure Transparency: Only explicitly drawn pixels are saved. No background layer.
2. Coordinates are top-left origin (0,0). Valid coordinates: 0 to width-1, 0 to height-1.
3. Every cell has unique ID and sparse pixels.
4. Format supports: pixel x,y <palette_id|hex>.

CURRENT SPRITE DATA:
\`\`\`pix2
${serialized}
\`\`\`

USER INSTRUCTION:
[Describe your modifications or character design request here. You can specify exact pixel coordinates, colors, animations, or shapes.]
`;
    navigator.clipboard.writeText(prompt).then(() => {
      showToast('AI Prompt copied to clipboard!', 'success');
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

  function openGameExportModal() {
    if (!dom.modalGameExport || !state.doc) return;
    syncExportFormatCards();
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
        const cid = `cell_${r}_${c}`;
        const cell = doc.cells[cid];
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
    public static class Pix2UnityImporter
    {
        [MenuItem("Tools/NOIRADIX/Import Pix2 Spritesheet JSON...")]
        public static void ImportPix2Menu()
        {
            string selectedPath = EditorUtility.OpenFilePanel("Select NOIRADIX Spritesheet JSON", "Assets", "json");
            if (string.IsNullOrEmpty(selectedPath)) return;
            ImportPix2Json(selectedPath);
        }

        public static void ImportPix2Json(string fullJsonPath)
        {
            try
            {
                if (!File.Exists(fullJsonPath)) return;
                string jsonText = File.ReadAllText(fullJsonPath);
                Pix2Data data = JsonUtility.FromJson<Pix2Data>(jsonText);
                string dir = Path.GetDirectoryName(fullJsonPath);
                string safeImageName = Path.GetFileName(data.meta.image);
                string pngPath = Path.Combine(dir, safeImageName);
                string assetPngPath = ToAssetPath(pngPath);

                TextureImporter importer = AssetImporter.GetAtPath(assetPngPath) as TextureImporter;
                if (importer == null) { AssetDatabase.ImportAsset(assetPngPath); importer = AssetImporter.GetAtPath(assetPngPath) as TextureImporter; }
                if (importer == null) return;

                importer.textureType = TextureImporterType.Sprite;
                importer.spriteImportMode = SpriteImportMode.Multiple;
                importer.filterMode = FilterMode.Point;
                importer.textureCompression = TextureImporterCompression.Uncompressed;
                importer.spritePixelsPerUnit = data.meta.cellWidth;

                List<SpriteMetaData> metas = new List<SpriteMetaData>();
                int texH = data.meta.size.h;
                foreach (var frame in data.frames)
                {
                    SpriteMetaData sm = new SpriteMetaData();
                    sm.name = frame.name;
                    sm.rect = new Rect(frame.x, texH - frame.y - frame.h, frame.w, frame.h);
                    sm.alignment = (int)SpriteAlignment.Custom;
                    sm.pivot = new Vector2(frame.pivotX, frame.pivotY);
                    metas.Add(sm);
                }
                importer.spritesheet = metas.ToArray();
                EditorUtility.SetDirty(importer);
                importer.SaveAndReimport();
                AssetDatabase.Refresh();
                Debug.Log($"[NOIRADIX] Imported {pngPath} with {metas.Count} sliced frames!");
            }
            catch (Exception ex) { Debug.LogError(ex); }
        }

        private static string ToAssetPath(string fullPath)
        {
            string projectPath = Path.GetFullPath(Application.dataPath + "/..").Replace('\\\\', '/');
            string norm = fullPath.Replace('\\\\', '/');
            return norm.StartsWith(projectPath) ? norm.Substring(projectPath.Length).TrimStart('/') : fullPath;
        }

        [Serializable] public class Pix2Data { public Pix2Meta meta; public Pix2Frame[] frames; }
        [Serializable] public class Pix2Meta { public string image; public int cellWidth; public Pix2Size size; }
        [Serializable] public class Pix2Size { public int w; public int h; }
        [Serializable] public class Pix2Frame { public string name; public int x; public int y; public int w; public int h; public float pivotX = 0.5f; public float pivotY = 0f; }
    }
}`;
      const scriptBytes = new TextEncoder().encode(importerScript);

      const zipBlob = createZip([
        { name: pngName, data: pngBytes },
        { name: `${baseName}.pix2.json`, data: jsonBytes },
        { name: 'Pix2UnityImporter.cs', data: scriptBytes }
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

      const jsonBytes = new TextEncoder().encode(JSON.stringify(tpData, null, 2));

      const zipBlob = createZip([
        { name: pngName, data: pngBytes },
        { name: `${baseName}.json`, data: jsonBytes }
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
          const doc = PIX2.parse(e.target.result);
          state.setDocument(doc);
          currentFileHandle = null;
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
    setDirty(false);
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
        if (state.currentTool !== 'select') {
          commitFloatingSelection();
          state.selection = null;
          renderCellOverlay();
        }
        updateStatusBarCoords(null, null);
      });
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

    // Grid Canvas Events (Instant 1-Click Selection & Delete Button Clicks)
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
      const rect = dom.gridCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (getRowDeleteHit(mx, my) !== null || getColDeleteHit(mx, my) !== null) {
        return;
      }
      handleGridCellSelect(e);
    });
    dom.gridCanvas.addEventListener('click', handleGridCellSelect);

    dom.gridCanvas.addEventListener('mousemove', (e) => {
      const rect = dom.gridCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const isOverDelete = (getRowDeleteHit(mx, my) !== null || getColDeleteHit(mx, my) !== null);
      dom.gridCanvas.style.cursor = isOverDelete ? 'pointer' : 'default';
    });

    dom.gridCanvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      closeContextMenu();
      const rect = dom.gridCanvas.getBoundingClientRect();
      const cellId = getGridCellFromPos(e.clientX - rect.left, e.clientY - rect.top);
      if (cellId) {
        selectedGridCellId = cellId;
        renderGridOverview();
        updateGridInspectorUI();
        openGridContextMenu(e.clientX, e.clientY, cellId);
      }
    });

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
          case 'delete-row': {
            const parts = targetCellId.split('_');
            const selR = (parts.length >= 3) ? parseInt(parts[1], 10) : 0;
            deleteSpecificRow(selR);
            break;
          }
          case 'delete-col': {
            const parts = targetCellId.split('_');
            const selC = (parts.length >= 3) ? parseInt(parts[2], 10) : 0;
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

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
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
        const parts = (selectedGridCellId || 'cell_0_0').split('_');
        const selR = (parts.length >= 3) ? parseInt(parts[1], 10) : 0;

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

    if (dom.btnAddAnimClip) {
      dom.btnAddAnimClip.addEventListener('click', () => {
        const parts = (selectedGridCellId || 'cell_0_0').split('_');
        const selR = (parts.length >= 3) ? parseInt(parts[1], 10) : 0;
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

    if (dom.btnStudioPlay) {
      dom.btnStudioPlay.addEventListener('click', () => {
        if (!studioAnimPlayer) return;
        if (studioAnimPlayer.isPlaying) {
          studioAnimPlayer.stop();
          dom.btnStudioPlay.innerHTML = '<i class="fa-solid fa-play"></i> Play';
        } else {
          studioAnimPlayer.start();
          dom.btnStudioPlay.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        }
      });
    }

    if (dom.btnStudioPrev) {
      dom.btnStudioPrev.addEventListener('click', () => {
        if (studioAnimPlayer) {
          studioAnimPlayer.stepFrame(-1);
          studioAnimPlayer.render();
          if (state.doc && state.doc.animations[activeStudioClipId]) {
            renderTimelineFramesStrip(state.doc.animations[activeStudioClipId]);
          }
        }
      });
    }

    if (dom.btnStudioNext) {
      dom.btnStudioNext.addEventListener('click', () => {
        if (studioAnimPlayer) {
          studioAnimPlayer.stepFrame(1);
          studioAnimPlayer.render();
          if (state.doc && state.doc.animations[activeStudioClipId]) {
            renderTimelineFramesStrip(state.doc.animations[activeStudioClipId]);
          }
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
        if (state.presetPalettes[val] && state.doc) {
          state.doc.palette = { ...state.presetPalettes[val] };
          renderPalette();
          triggerEventAutosave();
          showToast(`Loaded palette: ${val}`);
        }
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
      const cell = state.getActiveCell();
      if (cell && state.doc) {
        Tools.flipHorizontal(cell, state.doc.meta.cellSize.w);
        state.saveSnapshot('Flip Cell Horizontal');
        triggerEventAutosave();
        refreshAll();
      }
    });

    bindAction('btn-flip-v', () => {
      const cell = state.getActiveCell();
      if (cell && state.doc) {
        Tools.flipVertical(cell, state.doc.meta.cellSize.h);
        state.saveSnapshot('Flip Cell Vertical');
        triggerEventAutosave();
        refreshAll();
      }
    });

    bindAction('btn-rotate-90', () => {
      const cell = state.getActiveCell();
      if (cell && state.doc) {
        Tools.rotate90CW(cell, state.doc.meta.cellSize.w, state.doc.meta.cellSize.h);
        state.saveSnapshot('Rotate 90° Clockwise');
        triggerEventAutosave();
        refreshAll();
      }
    });

    bindAction('btn-sheet-flip-h', () => {
      if (state.doc) {
        for (const cid in state.doc.cells) {
          Tools.flipHorizontal(state.doc.cells[cid], state.doc.meta.cellSize.w);
        }
        state.saveSnapshot('Flip Whole Sheet Horizontal');
        triggerEventAutosave();
        refreshAll();
      }
    });

    bindAction('btn-sheet-flip-v', () => {
      if (state.doc) {
        for (const cid in state.doc.cells) {
          Tools.flipVertical(state.doc.cells[cid], state.doc.meta.cellSize.h);
        }
        state.saveSnapshot('Flip Whole Sheet Vertical');
        triggerEventAutosave();
        refreshAll();
      }
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
    bindAction('btn-new-file', () => {
      if (isDocumentDirty) {
        if (!confirm('You have unsaved changes. Discard and create new project?')) return;
      }
      const title = prompt('Project Title:', 'My Sprite Sheet') || 'Sprite Sheet';
      createBlankProject(title, 4, 4, 16, 16);
      refreshAll();
    });

    bindAction('btn-open-file', openFileNative);
    bindAction('btn-save-pix2', () => saveFileNative(false));
    bindAction('btn-save-as-pix2', () => saveFileNative(true));

    const filePathPill = document.getElementById('file-path-pill');
    if (filePathPill) {
      filePathPill.addEventListener('click', () => {
        const full = currentFilePath || (currentFileHandle ? currentFileHandle.name : currentFileName);
        if (full) {
          navigator.clipboard.writeText(full).then(() => {
            showToast(`Copied file: ${full}`, 'success');
          }).catch(() => {
            prompt('File name (Press Ctrl+C to copy):', full);
          });
        } else {
          showToast('Project is in memory draft. Click Save to save to disk.');
        }
      });
    }

    const btnReveal = document.getElementById('btn-reveal-explorer');
    if (btnReveal) {
      btnReveal.addEventListener('click', () => {
        const full = currentFilePath || (currentFileHandle ? currentFileHandle.name : currentFileName);
        if (full) {
          navigator.clipboard.writeText(full).then(() => {
            showToast(`Copied file: "${full}"`, 'success');
          }).catch(() => {
            prompt('File name:', full);
          });
        } else {
          showToast('File is not yet saved to disk. Click Save first.', 'info');
        }
      });
    }

    // Mini Preview Zoom level buttons
    document.querySelectorAll('#preview-zoom-group [data-scale]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#preview-zoom-group [data-scale]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        miniPreviewScale = parseInt(btn.dataset.scale, 10);
        renderMiniPreview();
      });
    });
    bindAction('btn-export-atlas', exportAtlasPng);
    bindAction('btn-load-demo', loadDefaultProject);
    bindAction('btn-open-spec', () => {
      state.activeTabId = 'tab-pix2-code';
      refreshAll();
    });

    // Code Editor Buttons
    if (dom.btnApplyCode) dom.btnApplyCode.addEventListener('click', applyCodeToDoc);
    if (dom.btnCopyAiPrompt) dom.btnCopyAiPrompt.addEventListener('click', copyAiPrompt);

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
      dom.inputProjectTitle.addEventListener('change', (e) => {
        if (state.doc) {
          state.doc.meta.title = e.target.value.trim();
          triggerEventAutosave();
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
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const key = e.key.toLowerCase();

      // Save (Ctrl + S) & Save As (Ctrl + Shift + S)
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        saveFileNative(e.shiftKey);
        return;
      }

      // Open (Ctrl + O)
      if ((e.ctrlKey || e.metaKey) && key === 'o') {
        e.preventDefault();
        openFileNative();
        return;
      }

      // New (Ctrl + N)
      if ((e.ctrlKey || e.metaKey) && key === 'n') {
        e.preventDefault();
        if (isDocumentDirty) {
          if (!confirm('You have unsaved changes. Discard and create new project?')) return;
        }
        const title = prompt('Project Title:', 'My Sprite Sheet') || 'Sprite Sheet';
        createBlankProject(title, 4, 4, 16, 16);
        refreshAll();
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
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
        if (state.redo()) {
          triggerEventAutosave();
          refreshAll();
        }
        return;
      }

      // Reset Zoom & Frame (Ctrl + 0)
      if ((e.ctrlKey || e.metaKey) && key === '0') {
        e.preventDefault();
        state.cellZoom = 24;
        renderCellEditor();
        renderCellRulers();
        updateStatusBarCoords(null, null);
        showToast('Zoom reset to 24× (Ctrl+0)');
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
        else if (key === 's') {
          const symBtn = document.getElementById('btn-symmetry-toggle');
          if (symBtn) symBtn.click();
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
