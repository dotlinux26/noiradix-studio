/**
 * PIX2 Studio - Central Editor State Management
 * Full Document Undo/Redo & Decoupled Cell Identity
 */

class EditorState {
  constructor() {
    this.doc = null;
    this.activeTabId = 'tab-grid-overview'; // 'tab-grid-overview' | 'tab-anim-studio' | 'tab-pix2-code' | '<cellId>'
    this.openCellTabs = []; // Array of cellIds currently open as tabs

    // Active tool state
    this.currentTool = 'pen'; // 'pen' | 'eraser' | 'picker' | 'bucket' | 'line' | 'rect' | 'select'
    this.primaryColor = '#57546f';
    this.secondaryColor = '#ffffff';

    // Tool options
    this.rectFill = false; // outline vs fill
    this.symmetry = false; // vertical symmetry mirror
    this.showGridLines = true;
    this.showRulers = true;
    this.checkerboardBg = true;

    // Viewport transform for Cell Edit Canvas
    this.cellZoom = 24; // 1 pixel = 24 screen pixels
    this.cellPanX = 0;
    this.cellPanY = 0;

    // Viewport for Grid Overview
    this.gridZoom = 4; // 4x scale
    this.gridPanX = 0;
    this.gridPanY = 0;

    // Selection marquee state
    this.selection = null; // { x, y, w, h }
    this.isDraggingSelection = false;

    // Cross-tab clipboard state (Persistent across cell tabs & document operations)
    this.clipboard = null; // { w, h, pixels: { 'relX,relY': hex }, originCellId, originX, originY }

    // History undo/redo stacks
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 50;

    // Stroke grouping state
    this.strokePreState = null;

    // File Handle state (File System Access API)
    this.fileHandle = null;

    // Animation preview state
    this.animDirection = 'down';
    this.animMode = '4dir';
    this.animFps = 6;
    this.animIsPlaying = true;
    this.animCurrentFrameIndex = 0;

    // Pre-built palettes
    this.presetPalettes = {
      wispling: [
        '#ffffff', '#57546f', '#dde8ef', '#ffb0bc', '#46435c', '#181425', '#ff0044', '#00e436'
      ],
      pico8: [
        '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
        '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'
      ],
      gameboy: [
        '#0f380f', '#306230', '#8bac0f', '#9bbc0f'
      ],
      endesga32: [
        '#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633',
        '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e',
        '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
        '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'
      ]
    };
  }

  // Load a new document into state
  setDocument(doc) {
    this.doc = doc;
    this.openCellTabs = [];
    this.activeTabId = 'tab-grid-overview';
    this.history = [];
    this.historyIndex = -1;
    this.selection = null;
    this.strokePreState = null;
    this.saveSnapshot('Initial Load');
  }

  // Begin a continuous stroke
  beginStroke() {
    if (!this.doc) return;
    this.strokePreState = PIX2.serialize(this.doc);
  }

  // End stroke and record single undo step if anything changed
  endStroke(strokeName = 'Draw Stroke') {
    if (!this.doc || !this.strokePreState) return;
    const currentState = PIX2.serialize(this.doc);
    if (currentState !== this.strokePreState) {
      this.saveSnapshot(strokeName);
    }
    this.strokePreState = null;
  }

  // Record undo snapshot
  saveSnapshot(actionName = 'Edit') {
    if (!this.doc) return;
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const serialized = PIX2.serialize(this.doc);
    this.history.push({
      action: actionName,
      data: serialized,
      activeTab: this.activeTabId
    });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  // Undo
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const snapshot = this.history[this.historyIndex];
      this.doc = PIX2.parse(snapshot.data);
      return true;
    }
    return false;
  }

  // Redo
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const snapshot = this.history[this.historyIndex];
      this.doc = PIX2.parse(snapshot.data);
      return true;
    }
    return false;
  }

  // Decoupled getActiveCell: works for ANY cell ID!
  getActiveCell() {
    if (!this.doc) return null;
    if (this.activeTabId === 'tab-grid-overview' || this.activeTabId === 'tab-anim-studio' || this.activeTabId === 'tab-pix2-code') {
      return null;
    }
    return this.doc.cells[this.activeTabId] || null;
  }

  // Open a cell in tab bar
  openCellTab(cellId) {
    if (!this.doc) return;
    let targetId = cellId;
    if (!this.doc.cells[targetId]) {
      // Try resolving standard cell_R_C to custom cell at (R, C)
      const match = (cellId || '').match(/cell_(\d+)_(\d+)/);
      if (match) {
        const r = parseInt(match[1], 10);
        const c = parseInt(match[2], 10);
        for (const cid in this.doc.cells) {
          const cell = this.doc.cells[cid];
          if (cell && cell.row === r && cell.col === c) {
            targetId = cid;
            break;
          }
        }
      }
    }

    // If still not found, initialize draft cell so user is never locked out of editor
    if (!this.doc.cells[targetId]) {
      const match = (targetId || '').match(/cell_(\d+)_(\d+)/);
      const r = match ? parseInt(match[1], 10) : 0;
      const c = match ? parseInt(match[2], 10) : 0;
      this.doc.cells[targetId] = {
        id: targetId,
        name: targetId,
        row: r,
        col: c,
        direction: 'none',
        frame: c,
        pixels: {}
      };
    }

    if (!this.openCellTabs.includes(targetId)) {
      this.openCellTabs.push(targetId);
    }
    this.activeTabId = targetId;
    this.selection = null;
  }

  // Close cell tab
  closeCellTab(cellId) {
    const idx = this.openCellTabs.indexOf(cellId);
    if (idx >= 0) {
      this.openCellTabs.splice(idx, 1);
      if (this.activeTabId === cellId) {
        if (this.openCellTabs.length > 0) {
          const nextIdx = Math.max(0, idx - 1);
          this.activeTabId = this.openCellTabs[nextIdx];
        } else {
          this.activeTabId = 'tab-grid-overview';
        }
      }
    }
  }
}

// Global state singleton
window.state = new EditorState();
