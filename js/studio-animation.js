/** Studio animation controller. App supplies document and view ports. */
const StudioAnimation = (() => {
  function create({ state, dom, view, DIRECTIONS_2, DIRECTIONS_4, DIRECTIONS_8, escapeHTML, getCellAtGrid, getCellRowCol, handleBeforeLeaveCodeTab, inferRowTitle, refreshAll, showToast, triggerEventAutosave, updateGridInspectorUI, updateStudioPlayButtonUI }) {
function openFramePickerModal() {
    if (!dom.modalFramePicker || !state.doc) return;
    const doc = state.doc;
    const clip = doc.animations[view.activeStudioClipId];
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
    if (dom.framePickerManualId) dom.framePickerManualId.value = view.selectedGridCellId || '';

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
    if (!state.doc || !state.doc.animations[view.activeStudioClipId]) return;
    const clip = state.doc.animations[view.activeStudioClipId];
    if (!clip.frames) clip.frames = [];
    clip.frames.push(cellId);

    state.saveSnapshot('Add Animation Frame');
    triggerEventAutosave();
    closeFramePickerModal();

    renderTimelineFramesStrip(clip);
    if (view.studioAnimPlayer) view.studioAnimPlayer.render();
    populateAnimDropdowns();

    const cell = state.doc.cells[cellId];
    showToast(`Added "${cell ? (cell.name || cellId) : cellId}" to ${clip.name || view.activeStudioClipId}!`, 'success');
  }

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
      if (view.animPlayer && view.animPlayer.activeAnimationName) {
        dom.floatingAnimSelect.value = view.animPlayer.activeAnimationName;
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
          if (state.activeTabId === 'tab-pix2-code') {
            if (typeof handleBeforeLeaveCodeTab === 'function' && !handleBeforeLeaveCodeTab()) return;
          }
          view.activeStudioClipId = animName;
          state.activeTabId = 'tab-anim-studio';
          refreshAll();
        });
        dom.animClipsList.appendChild(item);
      }
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
    if (view.studioAnimPlayer) view.studioAnimPlayer.render();
    if (view.animPlayer) view.animPlayer.render();
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
    if (view.animPlayer) view.animPlayer.render();
    if (view.studioAnimPlayer) view.studioAnimPlayer.render();
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

function openActionTemplateModal(mode = 4) {
    if (!dom.modalActionTemplate) return;
    view.currentTemplateMode = (mode === 8) ? 8 : ((mode === 2) ? 2 : 4);

    if (dom.btnMode2dir) dom.btnMode2dir.classList.toggle('active', view.currentTemplateMode === 2);
    if (dom.btnMode4dir) dom.btnMode4dir.classList.toggle('active', view.currentTemplateMode === 4);
    if (dom.btnMode8dir) dom.btnMode8dir.classList.toggle('active', view.currentTemplateMode === 8);

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
    const dirs = (view.currentTemplateMode === 8) ? DIRECTIONS_8 : ((view.currentTemplateMode === 2) ? DIRECTIONS_2 : DIRECTIONS_4);
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
    const dirs = (view.currentTemplateMode === 8) ? DIRECTIONS_8 : ((view.currentTemplateMode === 2) ? DIRECTIONS_2 : DIRECTIONS_4);
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
        action: action,
        template: (view.currentTemplateMode === 2) ? 'platformer_2dir' : ((view.currentTemplateMode === 8) ? '8dir' : '4dir'),
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
    closeActionTemplateModal();

    showToast(`Generated ${dirs.length}-Direction template for '${action}' (${dirs.length} rows × ${cols} frames)!`, 'success');
  }

function autoSetup4Directions() {
    openActionTemplateModal(4);
  }

function autoSetup8Directions() {
    openActionTemplateModal(8);
  }

function renderDedicatedAnimationStudio() {
    if (!state.doc) return;
    const anims = state.doc.animations;
    const animNames = Object.keys(anims);

    if (animNames.length === 0) {
      anims['idle'] = { name: 'Idle', direction: 'none', frames: ['cell_0_0'], fps: 6, loop: true, mode: 'loop' };
      view.activeStudioClipId = 'idle';
    } else if (!anims[view.activeStudioClipId]) {
      view.activeStudioClipId = animNames[0];
    }

    const currentClip = anims[view.activeStudioClipId];

    if (dom.studioAnimList) {
      dom.studioAnimList.innerHTML = '';
      animNames.forEach(name => {
        const clip = anims[name];
        const item = document.createElement('div');
        item.className = `anim-clip-item ${name === view.activeStudioClipId ? 'active' : ''}`;
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
          view.activeStudioClipId = name;
          renderDedicatedAnimationStudio();
        });
        dom.studioAnimList.appendChild(item);
      });
    }

    if (dom.studioClipName) dom.studioClipName.value = currentClip.name || view.activeStudioClipId;
    if (dom.studioClipFps) {
      dom.studioClipFps.value = currentClip.fps || 6;
      if (dom.studioClipFpsLabel) dom.studioClipFpsLabel.textContent = `${currentClip.fps || 6} fps`;
    }
    if (dom.studioClipMode) dom.studioClipMode.value = currentClip.mode || (currentClip.loop !== false ? 'loop' : 'once');
    if (dom.studioClipDir) dom.studioClipDir.value = currentClip.direction || 'none';
    if (dom.studioActiveClipTitle) dom.studioActiveClipTitle.textContent = currentClip.name || view.activeStudioClipId;

    if (view.studioAnimPlayer) {
      view.studioAnimPlayer.setAnimation(view.activeStudioClipId);
      view.studioAnimPlayer.fps = currentClip.fps || 6;
      view.studioAnimPlayer.render();
    }

    renderTimelineFramesStrip(currentClip);
  }

function updateStudioActiveFrameUI(idx, cellId) {
    if (!state.doc) return;
    const clip = state.doc.animations[view.activeStudioClipId];
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
    const clip = state.doc.animations[view.activeStudioClipId];
    if (!clip || !clip.frames || clip.frames.length === 0) return;
    const safeIdx = Math.max(0, Math.min(idx, clip.frames.length - 1));
    const cellId = clip.frames[safeIdx];

    // Explicit selection pauses playback so the user can inspect or edit that frame
    if (view.studioAnimPlayer) {
      if (view.studioAnimPlayer.isPlaying) {
        view.studioAnimPlayer.stop();
        updateStudioPlayButtonUI();
      }
      view.studioAnimPlayer.currentFrameIdx = safeIdx;
      view.studioAnimPlayer.render();
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
      card.className = `timeline-frame-card ${view.studioAnimPlayer && view.studioAnimPlayer.currentFrameIdx === idx ? 'active' : ''}`;
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
          if (view.studioAnimPlayer) view.studioAnimPlayer.render();
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
          if (view.studioAnimPlayer) view.studioAnimPlayer.render();
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
        if (view.studioAnimPlayer) view.studioAnimPlayer.render();
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

    const initialIdx = (view.studioAnimPlayer && view.studioAnimPlayer.currentFrameIdx !== undefined) ? view.studioAnimPlayer.currentFrameIdx : 0;
    updateStudioActiveFrameUI(initialIdx, frames[initialIdx]);
  }
    return { openFramePickerModal, closeFramePickerModal, renderFramePickerCards, appendCellToActiveAnimation, populateAnimDropdowns, assignRowToAnimation, assignCellToAnimation, applyRowBatchTag, ensureGridDimensions, openActionTemplateModal, closeActionTemplateModal, syncActiveActionChip, renderTemplateLivePreview, applyActionTemplate, autoSetup4Directions, autoSetup8Directions, renderDedicatedAnimationStudio, updateStudioActiveFrameUI, selectStudioFrame, renderTimelineFramesStrip };
  }
  return { create };
})();
