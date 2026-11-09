/**
 * PIX2 Studio - Central Editor State Management
 * Full Document Undo/Redo & Decoupled Cell Identity
 */

const _PIX2 = (typeof PIX2 !== 'undefined' ? PIX2 : (typeof require !== 'undefined' ? require('./pix2-format.js') : (typeof window !== 'undefined' ? window.PIX2 : null)));
const _StructureOps = (typeof StructureOps !== 'undefined' ? StructureOps : (typeof require !== 'undefined' ? require('./structure-operations.js') : null));

class EditorState {
  constructor() {
    this.doc = null;
    this.activeTabId = 'tab-grid-overview'; // 'tab-grid-overview' | 'tab-anim-studio' | 'tab-pix2-code' | '<cellId>'
    this.openCellTabs = []; // Array of cellIds currently open as tabs

    // Active tool state
    this.currentTool = 'pen'; // 'pen' | 'eraser' | 'picker' | 'bucket' | 'line' | 'rect' | 'select' | 'pan'
    this.primaryColor = '#57546f';
    this.secondaryColor = '#ffffff';

    // Tool options
    this.rectFill = false; // outline vs fill
    this.symmetry = false; // vertical symmetry mirror
    this.symmetryVertical = false;
    this.showGridLines = true;
    this.showRulers = true;
    this.checkerboardBg = true;

    // Viewport transform for Cell Edit Canvas
    this.cellZoom = 24; // 1 pixel = 24 screen pixels
    this.cellPanX = 0;
    this.cellPanY = 0;
    this.hasCenteredCellPan = false;

    // Viewport for Grid Overview
    this.gridZoom = 4; // 4x scale
    this.gridPanX = 0;
    this.gridPanY = 0;

    // Selection marquee state
    this.selection = null; // { x, y, w, h }
    this.isDraggingSelection = false;

    // Cross-tab clipboard state (Persistent across cell tabs & document operations)
    this.clipboard = null; // { w, h, pixels: { 'relX,relY': hex }, originCellId, originX, originY }

    // PIX2 1.1 Structural Hierarchy & Isolation State
    this.activeLayerId = null;
    this.activeGroupId = null;
    this.activeRegionId = null;
    this.isolatedNodeId = null; // null = no isolation; string = nodeId

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

  // Load a new document into state (optionally preserving open tabs during external reload or Apply Code)
  setDocument(doc, preserveTabs = false) {
    this.doc = doc;
    if (!preserveTabs) {
      this.openCellTabs = [];
      this.activeTabId = 'tab-grid-overview';
      this.activeLayerId = null;
      this.activeGroupId = null;
      this.activeRegionId = null;
      this.isolatedNodeId = null;
    } else {
      if (this.doc && this.doc.cells) {
        this.openCellTabs = (this.openCellTabs || []).filter(cid => Boolean(this.doc.cells[cid]));
        if (this.activeTabId !== 'tab-grid-overview' &&
            this.activeTabId !== 'tab-anim-studio' &&
            this.activeTabId !== 'tab-pix2-code' &&
            !this.doc.cells[this.activeTabId]) {
          this.activeTabId = this.openCellTabs.length > 0 ? this.openCellTabs[0] : 'tab-grid-overview';
        }
      }
    }
    this.history = [];
    this.historyIndex = -1;
    this.selection = null;
    this.strokePreState = null;
    this.saveSnapshot('Initial Load');
  }

  // Begin a continuous stroke
  beginStroke() {
    if (!this.doc || !_PIX2) return;
    this.strokePreState = _PIX2.serialize(this.doc);
  }

  // End stroke and record single undo step if anything changed
  endStroke(strokeName = 'Draw Stroke') {
    if (!this.doc || !this.strokePreState || !_PIX2) return false;
    const currentState = _PIX2.serialize(this.doc);
    const changed = currentState !== this.strokePreState;
    if (changed) {
      this.saveSnapshot(strokeName);
    }
    this.strokePreState = null;
    return changed;
  }

  // Record undo snapshot
  saveSnapshot(actionName = 'Edit') {
    if (!this.doc || !_PIX2) return;
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const serialized = _PIX2.serialize(this.doc);
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
      this.doc = _PIX2.parse(snapshot.data);
      if (snapshot.activeTab) {
        if (snapshot.activeTab.startsWith('tab-') || (this.doc.cells && this.doc.cells[snapshot.activeTab])) {
          this.activeTabId = snapshot.activeTab;
        }
      }
      return true;
    }
    return false;
  }

  // Redo
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const snapshot = this.history[this.historyIndex];
      this.doc = _PIX2.parse(snapshot.data);
      if (snapshot.activeTab) {
        if (snapshot.activeTab.startsWith('tab-') || (this.doc.cells && this.doc.cells[snapshot.activeTab])) {
          this.activeTabId = snapshot.activeTab;
        }
      }
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
    // Opening an existing tab is view state, not a document edit. Keep the
    // current history entry's focus in sync so the first subsequent edit can
    // be undone without unexpectedly throwing the user back to Overview.
    // The snapshot data itself remains immutable.
    if (this.historyIndex >= 0 && this.history[this.historyIndex]) {
      this.history[this.historyIndex].activeTab = targetId;
    }
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
      if (this.historyIndex >= 0 && this.history[this.historyIndex]) {
        this.history[this.historyIndex].activeTab = this.activeTabId;
      }
    }
  }

  // ===========================================================================
  // PIX2 1.1 STRUCTURAL TREE OPERATIONS & ACTIVE REGION RESOLUTION
  // ===========================================================================

  upgradeDocumentToV11(preferredCellId = null, options = {}) {
    if (!this.doc || !_PIX2 || typeof _PIX2.upgradeV10ToV11 !== 'function') {
      return { success: false, error: 'No upgrade-capable document is loaded' };
    }

    const before = {
      doc: this.doc,
      history: this.history.slice(),
      historyIndex: this.historyIndex,
      activeLayerId: this.activeLayerId,
      activeGroupId: this.activeGroupId,
      activeRegionId: this.activeRegionId,
      serialized: _PIX2.serialize(this.doc)
    };
    const upgrade = _PIX2.upgradeV10ToV11(this.doc, options);
    if (!upgrade.success) return upgrade;

    try {
      const currentSnapshot = this.history[this.historyIndex];
      if (!currentSnapshot || currentSnapshot.data !== before.serialized) {
        this.saveSnapshot('Before PIX2 1.1 conversion');
      }

      this.doc = upgrade.doc;
      const cellId = preferredCellId && this.doc.cells[preferredCellId]
        ? preferredCellId
        : (this.activeTabId && this.doc.cells[this.activeTabId] ? this.activeTabId : Object.keys(this.doc.cells)[0]);
      const convertedCell = cellId ? this.doc.cells[cellId] : null;
      const firstLayer = convertedCell && convertedCell.layers && convertedCell.layers[0];
      const firstRegion = firstLayer && (firstLayer.children || []).find(node => node.type === 'region');
      this.activeLayerId = firstLayer ? firstLayer.id : null;
      this.activeGroupId = null;
      this.activeRegionId = firstRegion ? firstRegion.id : null;
      this.saveSnapshot('Convert document to PIX2 1.1 layers');
      return { ...upgrade, cellId, historyEntriesAdded: this.history.length - before.history.length };
    } catch (error) {
      this.doc = before.doc;
      this.history = before.history;
      this.historyIndex = before.historyIndex;
      this.activeLayerId = before.activeLayerId;
      this.activeGroupId = before.activeGroupId;
      this.activeRegionId = before.activeRegionId;
      return { success: false, error: `Conversion transaction rolled back: ${error.message}` };
    }
  }

  // Find node by ID within cell
  findNode(cellId, nodeId) {
    if (!this.doc || !this.doc.cells) return null;
    const cell = cellId ? this.doc.cells[cellId] : this.getActiveCell();
    if (!cell || !cell.layers) return null;
    if (_StructureOps) return _StructureOps.findNode(cell, nodeId);

    function search(nodes, parent, currentLayer) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const layer = currentLayer || (node.type === 'layer' ? node : null);
        if (node.id === nodeId) {
          return { node, parent, layer, cell, index: i, siblings: nodes };
        }
        if (node.children && node.children.length > 0) {
          const res = search(node.children, node, layer);
          if (res) return res;
        }
      }
      return null;
    }

    return search(cell.layers, null, null);
  }

  // Resolve active region target for painting/erasing
  getActiveRegion(cellId) {
    if (!this.doc || !this.doc.cells) return null;
    const cell = cellId ? this.doc.cells[cellId] : this.getActiveCell();
    if (!cell) return null;

    if (!cell.layers || cell.layers.length === 0) {
      // Pure v1.0 flat cell fallback
      return {
        id: `region_legacy_${cell.id}`,
        cell: cell.id,
        type: 'region',
        name: cell.name || 'Artwork',
        visible: true,
        locked: false,
        pixels: cell.pixels,
        tags: []
      };
    }

    // In isolation mode: target the isolated node
    if (this.isolatedNodeId) {
      const match = this.findNode(cell.id, this.isolatedNodeId);
      if (!_StructureOps.isEditable(match)) return null;
      return _StructureOps.firstEditableRegion(match.node);
    }

    // Verify activeLayerId belongs to this cell; invalidate if stale across cell tabs
    if (this.activeLayerId) {
      const layerCheck = this.findNode(cell.id, this.activeLayerId);
      if (!layerCheck || layerCheck.node.type !== 'layer') {
        this.activeLayerId = null;
      }
    }

    // An explicitly selected region wins when it belongs to the currently
    // active layer. A stale region from another layer must never steal paint.
    if (this.activeRegionId) {
      const match = this.findNode(cell.id, this.activeRegionId);
      if (match && match.node.type === 'region' &&
          (!this.activeLayerId || !match.layer || match.layer.id === this.activeLayerId)) {
        if (!this.activeLayerId && match.layer) {
          this.activeLayerId = match.layer.id;
        }
        return _StructureOps.isEditable(match) ? match.node : null;
      }
    }

    // A layer selection is an editing-focus change, not merely a tree-row
    // highlight. Resolve a concrete child region if no valid region is active.
    if (this.activeLayerId) {
      const layerMatch = this.findNode(cell.id, this.activeLayerId);
      if (layerMatch && layerMatch.node.type === 'layer') {
        const layer = layerMatch.node;
        if (layer.visible === false || layer.locked) return null;
        const target = _StructureOps.firstEditableRegion(layer);
        if (target) {
          this.activeRegionId = target.id;
          return target;
        }
        return null;
      }
    }

    // Default to first unlocked, visible region
    const first = cell.layers.map(_StructureOps.firstEditableRegion).find(Boolean);
    if (first) {
      this.activeRegionId = first.id;
      const firstMatch = this.findNode(cell.id, first.id);
      if (firstMatch && firstMatch.layer) {
        this.activeLayerId = firstMatch.layer.id;
      }
      return first;
    }

    return null;
  }

  // Synchronize composite cell pixels from layer tree
  syncCellComposite(cellId) {
    if (!this.doc || !this.doc.cells || !_PIX2) return;
    const cell = cellId ? this.doc.cells[cellId] : this.getActiveCell();
    if (!cell || !cell.layers || cell.layers.length === 0) return;
    const defaultSize = (this.doc.meta && (this.doc.meta.cell_size || this.doc.meta.cellSize)) || { w: 16, h: 16 };
    cell.pixels = _PIX2.compositeCellLayers(cell, defaultSize, {
      isolatedNodeId: this.isolatedNodeId
    });
  }

  // Add a new layer to cell
  addLayer(cellId, layerName = 'New Layer', options = {}) {
    if (!this.doc || !this.doc.cells) return null;
    const cell = cellId ? this.doc.cells[cellId] : this.getActiveCell();
    if (!cell) return null;
    if (!cell.layers) cell.layers = [];

    const layerId = options.id || `layer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newLayer = {
      type: 'layer',
      id: layerId,
      cell: cell.id,
      name: layerName,
      visible: options.visible !== false,
      locked: Boolean(options.locked),
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      blend: 'normal',
      children: []
    };

    // Also create a default region inside so user can paint immediately
    const regionId = `region_${layerId}`;
    const defaultRegion = {
      type: 'region',
      id: regionId,
      cell: cell.id,
      parent: layerId,
      name: `${layerName} Region`,
      tags: [],
      visible: true,
      locked: false,
      pixels: {},
      primitives: []
    };
    newLayer.children.push(defaultRegion);
    cell.layers.push(newLayer);

    this.activeLayerId = layerId;
    this.activeRegionId = regionId;
    this.syncCellComposite(cell.id);
    this.saveSnapshot(`Add Layer: ${layerName}`);
    return newLayer;
  }

  // Selecting a layer must also establish a concrete editable target. This is
  // intentionally centralized so Studio and any future UI reuse the same
  // active-layer semantics.
  selectLayer(cellId, layerId) {
    const match = this.findNode(cellId, layerId);
    if (!match || match.node.type !== 'layer') return false;
    this.activeLayerId = layerId;
    this.activeGroupId = null;
    this.activeRegionId = null;
    this.getActiveRegion(match.cell.id);
    return true;
  }

  // Add a group inside a layer or group
  addGroup(cellId, parentId, groupName = 'New Group', tags = []) {
    const parentMatch = this.findNode(cellId, parentId);
    if (!parentMatch || (parentMatch.node.type !== 'layer' && parentMatch.node.type !== 'group')) {
      return null;
    }
    const cell = parentMatch.cell;
    const groupId = `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newGroup = {
      type: 'group',
      id: groupId,
      cell: cell.id,
      parent: parentId,
      name: groupName,
      visible: true,
      locked: false,
      tags: Array.isArray(tags) ? [...tags] : [],
      children: []
    };
    parentMatch.node.children.push(newGroup);
    this.activeGroupId = groupId;
    this.saveSnapshot(`Add Group: ${groupName}`);
    return newGroup;
  }

  // Add a region inside a layer or group
  addRegion(cellId, parentId, regionName = 'New Region', tags = []) {
    const parentMatch = this.findNode(cellId, parentId);
    if (!parentMatch || (parentMatch.node.type !== 'layer' && parentMatch.node.type !== 'group')) {
      return null;
    }
    const cell = parentMatch.cell;
    const regionId = `reg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newRegion = {
      type: 'region',
      id: regionId,
      cell: cell.id,
      parent: parentId,
      name: regionName,
      tags: Array.isArray(tags) ? [...tags] : [],
      visible: true,
      locked: false,
      pixels: {},
      primitives: []
    };
    parentMatch.node.children.push(newRegion);
    if (parentMatch.layer) this.activeLayerId = parentMatch.layer.id;
    this.activeRegionId = regionId;
    this.saveSnapshot(`Add Region: ${regionName}`);
    return newRegion;
  }

  // Remove a structural node (layer, group, or region)
  removeNode(cellId, nodeId) {
    const match = this.findNode(cellId, nodeId);
    if (!match) return false;
    const { siblings, index, cell, node } = match;
    siblings.splice(index, 1);
    if (this.activeRegionId === nodeId) this.activeRegionId = null;
    if (this.activeGroupId === nodeId) this.activeGroupId = null;
    if (this.activeLayerId === nodeId) this.activeLayerId = null;
    if (this.isolatedNodeId === nodeId) this.isolatedNodeId = null;
    this.syncCellComposite(cell.id);
    this.saveSnapshot(`Delete Node: ${node.name || nodeId}`);
    return true;
  }

  // Shared tree operations: both products use StructureOps for ordering and
  // parentage, while this state owner contributes history/compositing.
  moveNode(cellId, nodeId, targetParentId = null, targetIndex = null) {
    const cell = cellId ? this.doc && this.doc.cells[cellId] : this.getActiveCell();
    if (!cell || !_StructureOps) return false;
    const result = _StructureOps.moveNode(cell, nodeId, targetParentId, targetIndex);
    if (!result.ok) return false;
    this.syncCellComposite(cell.id);
    this.saveSnapshot(`Move ${result.node.type}: ${result.node.name || result.node.id}`);
    return true;
  }

  reorderNode(cellId, nodeId, direction) {
    const cell = cellId ? this.doc && this.doc.cells[cellId] : this.getActiveCell();
    if (!cell || !_StructureOps) return false;
    const result = _StructureOps.reorderNode(cell, nodeId, direction);
    if (!result.ok) return false;
    this.syncCellComposite(cell.id);
    this.saveSnapshot(`Reorder ${result.node.type}: ${result.node.name || result.node.id}`);
    return true;
  }

  // Toggle or set node visibility
  setNodeVisibility(cellId, nodeId, visible) {
    const match = this.findNode(cellId, nodeId);
    if (!match) return false;
    match.node.visible = visible !== undefined ? Boolean(visible) : !match.node.visible;
    this.syncCellComposite(match.cell.id);
    this.saveSnapshot(`Toggle Visibility: ${match.node.name || nodeId}`);
    return true;
  }

  // Toggle or set node lock
  setNodeLocked(cellId, nodeId, locked) {
    const match = this.findNode(cellId, nodeId);
    if (!match) return false;
    match.node.locked = locked !== undefined ? Boolean(locked) : !match.node.locked;
    this.saveSnapshot(`Toggle Lock: ${match.node.name || nodeId}`);
    return true;
  }

  // Set layer opacity
  setLayerOpacity(cellId, layerId, opacity) {
    const match = this.findNode(cellId, layerId);
    if (!match || match.node.type !== 'layer') return false;
    match.node.opacity = Math.max(0, Math.min(1, Number(opacity) || 0));
    this.syncCellComposite(match.cell.id);
    this.saveSnapshot(`Set Opacity: ${match.node.name || layerId}`);
    return true;
  }

  // Set node name
  setNodeName(cellId, nodeId, name) {
    const match = this.findNode(cellId, nodeId);
    if (!match || typeof name !== 'string') return false;
    match.node.name = name.trim();
    this.saveSnapshot(`Rename Node: ${match.node.name}`);
    return true;
  }

  // Set node tags
  setNodeTags(cellId, nodeId, tags) {
    const match = this.findNode(cellId, nodeId);
    if (!match || !Array.isArray(tags)) return false;
    match.node.tags = [...tags];
    this.saveSnapshot(`Update Tags: ${match.node.name || nodeId}`);
    return true;
  }

  // Toggle or exit isolation mode (supports both setIsolation(nodeId) and setIsolation(cellId, nodeId))
  setIsolation(arg1 = null, arg2 = null) {
    let nodeId = arg1;
    if (arg2 !== null || (arg1 && this.doc && this.doc.cells && this.doc.cells[arg1])) {
      nodeId = arg2;
    }
    if (this.isolatedNodeId === nodeId) {
      this.isolatedNodeId = null;
    } else {
      this.isolatedNodeId = nodeId;
    }
    const cell = this.getActiveCell();
    if (cell) this.syncCellComposite(cell.id);
    return this.isolatedNodeId;
  }

  // Plot a pixel into the active region (or cell.pixels in v1.0)
  plotPixelAt(cellId, x, y, color) {
    const cell = cellId ? this.doc.cells[cellId] : this.getActiveCell();
    if (!cell) return false;

    if (!cell.layers || cell.layers.length === 0) {
      // v1.0 mode
      const key = `${x},${y}`;
      if (color === null) {
        delete cell.pixels[key];
      } else {
        cell.pixels[key] = color;
      }
      return true;
    }

    const region = this.getActiveRegion(cell.id);
    if (!region || region.locked || region.visible === false) {
      return false; // Can't draw in locked or hidden region
    }

    const key = `${x},${y}`;
    if (color === null) {
      delete region.pixels[key];
    } else {
      region.pixels[key] = color;
    }
    this.syncCellComposite(cell.id);
    return true;
  }
}

// Global state singleton & Node.js CommonJS export
if (typeof window !== 'undefined') {
  window.state = new EditorState();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EditorState;
}
