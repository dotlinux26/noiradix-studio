/** Studio atlas-import UI controller. Document/session publication belongs to the app. */
const StudioSlice = (() => {
  function create({
    dom,
    importSliceState,
    input,
    getActiveView,
    activateView,
    commitProject,
    refreshAll,
    escapeHTML,
    sanitizeSafeFilename,
    showToast,
  }) {
    function setSliceTool(tool) {
      importSliceState.activeTool = tool; // 'select' | 'draw' | 'hand'
      if (dom.btnSliceToolSelect)
        dom.btnSliceToolSelect.classList.toggle('active', tool === 'select');
      if (dom.btnSliceToolDraw) dom.btnSliceToolDraw.classList.toggle('active', tool === 'draw');
      if (dom.btnSliceToolHand) dom.btnSliceToolHand.classList.toggle('active', tool === 'hand');

      const canvas = dom.importSliceCanvas;
      const container = dom.importSliceViewportContainer;
      if (tool === 'hand') {
        if (canvas) canvas.style.cursor = 'grab';
        if (container) container.style.cursor = 'grab';
      } else if (tool === 'draw') {
        if (canvas) canvas.style.cursor = 'crosshair';
        if (container) container.style.cursor = 'crosshair';
      } else {
        if (canvas) canvas.style.cursor = 'default';
        if (container) container.style.cursor = 'default';
      }
    }

    function setSliceZoom(newZoom) {
      if (!importSliceState.image) return;
      const clamped = Math.max(0.25, Math.min(32, Math.round(newZoom * 100) / 100));
      importSliceState.zoom = clamped;
      applySliceZoom();
      updateSliceTransform();
      renderImportSliceView();
    }

    function updateSliceTransform() {
      const el = document.getElementById('slice-container-with-rulers');
      if (!el) return;
      el.style.transform = `translate(${importSliceState.panX || 0}px, ${importSliceState.panY || 0}px)`;
    }

    function applySliceZoom() {
      const canvas = dom.importSliceCanvas;
      const overlay = dom.importSliceOverlay;
      const wrapper = document.getElementById('import-slice-canvas-wrapper');
      if (!canvas || !importSliceState.image) return;
      const z = importSliceState.zoom || 1;
      const w = Math.round(importSliceState.image.width * z);
      const h = Math.round(importSliceState.image.height * z);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.imageRendering = 'pixelated';
      if (overlay) {
        overlay.style.width = `${w}px`;
        overlay.style.height = `${h}px`;
      }
      if (wrapper) {
        wrapper.style.width = `${w}px`;
        wrapper.style.height = `${h}px`;
      }
      if (dom.sliceZoomLevel) {
        dom.sliceZoomLevel.textContent = `${Math.round(z * 100)}%`;
      }
    }

    function fitSliceZoom() {
      const container = dom.importSliceViewportContainer;
      const img = importSliceState.image;
      if (!container || !img) return;
      const cw = container.clientWidth - 40;
      const ch = container.clientHeight - 40;
      if (cw <= 0 || ch <= 0) return;
      const scaleX = cw / img.width;
      const scaleY = ch / img.height;
      let fitScale = Math.min(scaleX, scaleY);
      if (fitScale >= 1) {
        fitScale = Math.floor(fitScale);
      } else {
        fitScale = Math.max(0.25, Math.round(fitScale * 100) / 100);
      }
      importSliceState.panX = 0;
      importSliceState.panY = 0;
      setSliceZoom(Math.max(0.25, fitScale));
    }

    function batchTagPrefix() {
      const frames = importSliceState.frames || [];
      if (frames.length === 0) {
        showToast('No slices to tag', 'error');
        return;
      }
      const hasSelection =
        importSliceState.selectedSliceIndex >= 0 &&
        importSliceState.selectedSliceIndex < frames.length;
      const targetDesc = hasSelection
        ? `selected slice #${importSliceState.selectedSliceIndex + 1}`
        : `all ${frames.length} slices`;
      const prefix = prompt(
        `Enter tag / animation prefix for ${targetDesc} (e.g. "idle", "walk_down", "attack"):`,
        hasSelection ? frames[importSliceState.selectedSliceIndex].tag || 'idle' : 'idle',
      );
      if (!prefix || !prefix.trim()) return;
      const cleanPrefix = prefix.trim();

      if (hasSelection) {
        frames[importSliceState.selectedSliceIndex].tag = cleanPrefix;
        showToast(
          `Tagged slice #${importSliceState.selectedSliceIndex + 1} with "${cleanPrefix}"`,
          'success',
        );
      } else {
        frames.forEach((f, idx) => {
          f.tag = cleanPrefix;
        });
        showToast(`Tagged ${frames.length} slices with "${cleanPrefix}"`, 'success');
      }
      renderImportSliceView();
    }

    function autoTag4Dir() {
      const frames = importSliceState.frames || [];
      if (frames.length === 0) {
        showToast('No slices to auto-tag', 'error');
        return;
      }
      // Sort frames geometrically: top to bottom, then left to right
      const sorted = [...frames].sort((a, b) => {
        if (Math.abs(a.frame.y - b.frame.y) > 8) return a.frame.y - b.frame.y;
        return a.frame.x - b.frame.x;
      });

      const rows = [];
      sorted.forEach((f) => {
        let r = rows.find((row) => Math.abs(row[0].frame.y - f.frame.y) <= 8);
        if (!r) {
          r = [];
          rows.push(r);
        }
        r.push(f);
      });

      const dirNames = ['down', 'up', 'right', 'left'];
      rows.forEach((row, rowIdx) => {
        const dir = dirNames[rowIdx % 4];
        row.sort((a, b) => a.frame.x - b.frame.x);
        row.forEach((f, colIdx) => {
          f.tag = `walk_${dir}`;
          f.row = rowIdx;
          f.col = colIdx;
          f.frameIndex = colIdx;
          f.name = `${dir}_${colIdx}`;
        });
      });

      showToast(`Auto-tagged ${frames.length} slices (Row = Tag, Col = Frame #)`, 'success');
      renderImportSliceView();
    }

    function autoTag8Dir() {
      const frames = importSliceState.frames || [];
      if (frames.length === 0) {
        showToast('No slices to auto-tag', 'error');
        return;
      }
      const sorted = [...frames].sort((a, b) => {
        if (Math.abs(a.frame.y - b.frame.y) > 8) return a.frame.y - b.frame.y;
        return a.frame.x - b.frame.x;
      });

      const rows = [];
      sorted.forEach((f) => {
        let r = rows.find((row) => Math.abs(row[0].frame.y - f.frame.y) <= 8);
        if (!r) {
          r = [];
          rows.push(r);
        }
        r.push(f);
      });

      const dirNames = [
        'down',
        'down_right',
        'right',
        'up_right',
        'up',
        'up_left',
        'left',
        'down_left',
      ];
      rows.forEach((row, rowIdx) => {
        const dir = dirNames[rowIdx % 8];
        row.sort((a, b) => a.frame.x - b.frame.x);
        row.forEach((f, colIdx) => {
          f.tag = `walk_${dir}`;
          f.row = rowIdx;
          f.col = colIdx;
          f.frameIndex = colIdx;
          f.name = `${dir}_${colIdx}`;
        });
      });

      showToast(`Auto-tagged ${frames.length} slices with 8-direction locomotion rows`, 'success');
      renderImportSliceView();
    }

    function clearAllTags() {
      const frames = importSliceState.frames || [];
      if (frames.length === 0) return;
      frames.forEach((f) => {
        f.tag = '';
      });
      showToast('Cleared all slice tags', 'info');
      renderImportSliceView();
    }

    function getSliceCanvasCoords(e) {
      const canvas = dom.importSliceCanvas;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.max(
        0,
        Math.min(canvas.width - 1, Math.floor((e.clientX - rect.left) * scaleX)),
      );
      const y = Math.max(
        0,
        Math.min(canvas.height - 1, Math.floor((e.clientY - rect.top) * scaleY)),
      );
      return { x, y };
    }

    function drawRoundedRect(ctx, x, y, width, height, radius, fill = true, stroke = false) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    }

    function hitTestSliceHandles(slice, e) {
      if (!slice || !slice.frame) return null;
      const canvas = dom.importSliceCanvas;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;

      const scaleX = rect.width / canvas.width;
      const scaleY = rect.height / canvas.height;
      const sx = rect.left + slice.frame.x * scaleX;
      const sy = rect.top + slice.frame.y * scaleY;
      const sw = slice.frame.w * scaleX;
      const sh = slice.frame.h * scaleY;

      const mx = e.clientX;
      const my = e.clientY;
      const hitR = 8; // 8 screen pixels

      if (Math.abs(mx - sx) <= hitR && Math.abs(my - sy) <= hitR) return 'nw';
      if (Math.abs(mx - (sx + sw)) <= hitR && Math.abs(my - sy) <= hitR) return 'ne';
      if (Math.abs(mx - (sx + sw)) <= hitR && Math.abs(my - (sy + sh)) <= hitR) return 'se';
      if (Math.abs(mx - sx) <= hitR && Math.abs(my - (sy + sh)) <= hitR) return 'sw';
      if (mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sh) return 'move';
      return null;
    }

    function renderSliceRulers(imgW, imgH, zoom) {
      if (!dom.sliceRulerTop || !dom.sliceRulerLeft) return;
      if (importSliceState.showRulers === false) {
        dom.sliceRulerTop.style.display = 'none';
        dom.sliceRulerLeft.style.display = 'none';
        if (dom.sliceRulerCorner) dom.sliceRulerCorner.style.display = 'none';
        return;
      }
      dom.sliceRulerTop.style.display = 'flex';
      dom.sliceRulerLeft.style.display = 'flex';
      if (dom.sliceRulerCorner) dom.sliceRulerCorner.style.display = 'flex';

      dom.sliceRulerTop.innerHTML = '';
      dom.sliceRulerLeft.innerHTML = '';

      let step = 16;
      if (zoom >= 8) step = 2;
      else if (zoom >= 4) step = 4;
      else if (zoom >= 2) step = 8;
      else if (zoom < 1) step = 32;

      for (let x = 0; x < imgW; x += step) {
        const tick = document.createElement('div');
        tick.className = 'ruler-tick';
        const tickW = Math.min(step, imgW - x) * zoom;
        tick.style.width = `${tickW}px`;
        tick.textContent = x;
        dom.sliceRulerTop.appendChild(tick);
      }

      for (let y = 0; y < imgH; y += step) {
        const tick = document.createElement('div');
        tick.className = 'ruler-tick-v';
        const tickH = Math.min(step, imgH - y) * zoom;
        tick.style.height = `${tickH}px`;
        tick.textContent = y;
        dom.sliceRulerLeft.appendChild(tick);
      }
    }

    function renderImportSliceView(refreshList = true) {
      if (!dom.views['import-slice']) return;
      const canvas = dom.importSliceCanvas;
      const overlay = dom.importSliceOverlay;
      if (!canvas) return;

      if (!importSliceState.image) {
        if (dom.sliceContainerWithRulers) dom.sliceContainerWithRulers.style.display = 'none';
        if (dom.importSliceEmptyPrompt) dom.importSliceEmptyPrompt.style.display = 'block';
        canvas.width = 320;
        canvas.height = 240;
        canvas.style.width = '320px';
        canvas.style.height = '240px';
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (overlay) {
          overlay.width = 320;
          overlay.height = 240;
          overlay.style.width = '320px';
          overlay.style.height = '240px';
          const octx = overlay.getContext('2d');
          octx.clearRect(0, 0, 320, 240);
        }
        if (dom.sliceZoomLevel) dom.sliceZoomLevel.textContent = '100%';
        if (refreshList) renderImportSlicesList();
        return;
      }

      if (dom.importSliceEmptyPrompt) dom.importSliceEmptyPrompt.style.display = 'none';
      if (dom.sliceContainerWithRulers) dom.sliceContainerWithRulers.style.display = 'inline-grid';

      const img = importSliceState.image;
      canvas.width = img.width;
      canvas.height = img.height;
      applySliceZoom();
      renderSliceRulers(img.width, img.height, importSliceState.zoom || 1);

      // 1. Draw Checkerboard and Source Image onto base canvas (1:1 pixels)
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const isDark = document.body.classList.contains('dark-theme');
      const c1 = isDark ? '#1f202e' : '#ffffff';
      const c2 = isDark ? '#171822' : '#e2e8f0';
      for (let y = 0; y < canvas.height; y += 8) {
        for (let x = 0; x < canvas.width; x += 8) {
          ctx.fillStyle = (x / 8 + y / 8) % 2 === 0 ? c1 : c2;
          ctx.fillRect(x, y, 8, 8);
        }
      }
      ctx.drawImage(img, 0, 0);

      // 2. High-DPI Sharp Vector Overlay for Grid, Slices, Handles, Labels, and Marquee
      if (overlay) {
        const dpr = window.devicePixelRatio || 1;
        const zoom = importSliceState.zoom || 1;
        const screenW = Math.round(img.width * zoom);
        const screenH = Math.round(img.height * zoom);
        overlay.width = Math.round(screenW * dpr);
        overlay.height = Math.round(screenH * dpr);
        overlay.style.width = `${screenW}px`;
        overlay.style.height = `${screenH}px`;

        const octx = overlay.getContext('2d');
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        octx.clearRect(0, 0, screenW, screenH);

        // Pixel Grid (Crisp 1px lines when zoom >= 3x and enabled)
        if (importSliceState.showPixelGrid !== false && zoom >= 3) {
          octx.save();
          octx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
          octx.lineWidth = 1;
          octx.beginPath();
          for (let x = 0; x <= img.width; x++) {
            const px = Math.floor(x * zoom) + 0.5;
            octx.moveTo(px, 0);
            octx.lineTo(px, screenH);
          }
          for (let y = 0; y <= img.height; y++) {
            const py = Math.floor(y * zoom) + 0.5;
            octx.moveTo(0, py);
            octx.lineTo(screenW, py);
          }
          octx.stroke();
          octx.restore();
        }

        const frames = importSliceState.frames || [];
        const showLabels = importSliceState.showLabels !== false;

        frames.forEach((f, idx) => {
          const rect = f.frame;
          const isSelected = idx === importSliceState.selectedSliceIndex;
          const sx = Math.floor(rect.x * zoom);
          const sy = Math.floor(rect.y * zoom);
          const sw = Math.floor(rect.w * zoom);
          const sh = Math.floor(rect.h * zoom);

          octx.save();
          if (isSelected) {
            // Selected slice fill and outline
            octx.fillStyle = 'rgba(16, 185, 129, 0.15)';
            octx.fillRect(sx, sy, sw, sh);

            octx.strokeStyle = '#10b981';
            octx.lineWidth = 2;
            octx.strokeRect(sx + 0.5, sy + 0.5, sw, sh);

            // Crisp screen handles (8x8 screen pixels, never blurry!)
            const handleSize = 8;
            const half = handleSize / 2;
            const handles = [
              [sx, sy],
              [sx + sw, sy],
              [sx + sw, sy + sh],
              [sx, sy + sh],
            ];
            octx.fillStyle = '#10b981';
            octx.strokeStyle = '#ffffff';
            octx.lineWidth = 1.5;
            handles.forEach(([hx, hy]) => {
              octx.fillRect(hx - half, hy - half, handleSize, handleSize);
              octx.strokeRect(hx - half + 0.5, hy - half + 0.5, handleSize, handleSize);
            });

            // Crisp label badge
            if (showLabels) {
              const colNum =
                f.frameIndex !== undefined ? f.frameIndex : f.col !== undefined ? f.col : idx;
              const tagDesc = f.tag
                ? `${f.tag} : f${colNum}`
                : f.row !== undefined
                  ? `row ${f.row} : f${colNum}`
                  : `f${colNum}`;
              const labelText = `${f.name || `slice_${idx}`} [${tagDesc}] (${rect.w}×${rect.h})`;
              octx.font =
                '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              const metrics = octx.measureText(labelText);
              const badgeW = metrics.width + 12;
              const badgeH = 18;
              const badgeY = sy - badgeH - 2 >= 0 ? sy - badgeH - 2 : sy + 2;

              octx.fillStyle = '#10b981';
              drawRoundedRect(octx, sx, badgeY, badgeW, badgeH, 3, true, false);
              octx.fillStyle = '#ffffff';
              octx.textBaseline = 'middle';
              octx.fillText(labelText, sx + 6, badgeY + badgeH / 2);
            }
          } else {
            // Unselected slice outline
            octx.strokeStyle = 'rgba(99, 102, 241, 0.85)';
            octx.lineWidth = 1.5;
            octx.strokeRect(sx + 0.5, sy + 0.5, sw, sh);

            // Compact badge for unselected slice
            if (showLabels) {
              const colNum =
                f.frameIndex !== undefined ? f.frameIndex : f.col !== undefined ? f.col : idx;
              const tagDesc = f.tag
                ? `${f.tag} : f${colNum}`
                : f.row !== undefined
                  ? `row ${f.row} : f${colNum}`
                  : `f${colNum}`;
              const labelText = `${f.name || `slice_${idx}`} [${tagDesc}]`;
              octx.font =
                '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              const metrics = octx.measureText(labelText);
              const badgeW = Math.min(sw, metrics.width + 10);
              const badgeH = 15;
              const badgeY = sy - badgeH - 1 >= 0 ? sy - badgeH - 1 : sy + 1;

              octx.fillStyle = 'rgba(99, 102, 241, 0.9)';
              drawRoundedRect(octx, sx, badgeY, badgeW, badgeH, 2, true, false);
              octx.fillStyle = '#ffffff';
              octx.textBaseline = 'middle';
              octx.save();
              octx.beginPath();
              octx.rect(sx, badgeY, badgeW, badgeH);
              octx.clip();
              octx.fillText(labelText, sx + 4, badgeY + badgeH / 2);
              octx.restore();
            }
          }
          octx.restore();
        });

        // Live drag marquee
        if (importSliceState.isDrawingSlice && importSliceState.currentDragRect) {
          const dr = importSliceState.currentDragRect;
          const dsx = Math.floor(dr.x * zoom);
          const dsy = Math.floor(dr.y * zoom);
          const dsw = Math.floor(dr.w * zoom);
          const dsh = Math.floor(dr.h * zoom);

          octx.save();
          octx.strokeStyle = '#10b981';
          octx.lineWidth = 1.5;
          octx.setLineDash([4, 4]);
          octx.strokeRect(dsx + 0.5, dsy + 0.5, dsw, dsh);
          octx.fillStyle = 'rgba(16, 185, 129, 0.12)';
          octx.fillRect(dsx, dsy, dsw, dsh);
          octx.setLineDash([]);

          const dimText = `${dr.w} × ${dr.h} px`;
          octx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const metrics = octx.measureText(dimText);
          const badgeW = metrics.width + 10;
          const badgeH = 18;
          const badgeY = dsy - badgeH - 2 >= 0 ? dsy - badgeH - 2 : dsy + 2;

          octx.fillStyle = '#10b981';
          drawRoundedRect(octx, dsx, badgeY, badgeW, badgeH, 3, true, false);
          octx.fillStyle = '#ffffff';
          octx.textBaseline = 'middle';
          octx.fillText(dimText, dsx + 5, badgeY + badgeH / 2);
          octx.restore();
        }
      }

      const frames = importSliceState.frames || [];
      if (dom.sliceCountBadge) {
        dom.sliceCountBadge.textContent = `${frames.length} slice${frames.length === 1 ? '' : 's'} detected`;
      }
      if (dom.btnSliceDeleteSelected) {
        dom.btnSliceDeleteSelected.disabled =
          importSliceState.selectedSliceIndex < 0 ||
          importSliceState.selectedSliceIndex >= frames.length;
      }

      if (refreshList) renderImportSlicesList();
    }

    function renderImportSlicesList() {
      if (!dom.importSlicesList) return;
      const frames = importSliceState.frames || [];
      if (dom.importSlicesCountText) {
        dom.importSlicesCountText.textContent = `(${frames.length} item${frames.length === 1 ? '' : 's'})`;
      }

      if (frames.length === 0) {
        dom.importSlicesList.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 11px;">
          No slices created yet. Click "Update Slice Preview" or use Draw Slice tool to draw boxes!
        </div>
      `;
        return;
      }

      let html = `
      <div style="display: grid; grid-template-columns: 32px 36px minmax(120px, 1.4fr) minmax(120px, 1.4fr) minmax(70px, 85px) minmax(150px, 180px) 52px; gap: 8px; padding: 5px 12px; background: var(--bg-card); font-size: 10px; font-weight: 600; color: var(--text-dim); border-bottom: 1px solid var(--border-subtle); position: sticky; top: 0; z-index: 2; min-width: 620px;">
        <span>#</span>
        <span>Thumb</span>
        <span>Slice Name</span>
        <span>Tag (Row)</span>
        <span style="text-align: center;">Frame # (Col)</span>
        <span>Rect (X, Y, W, H)</span>
        <span style="text-align: right;">Actions</span>
      </div>
    `;

      frames.forEach((f, idx) => {
        const isSel = idx === importSliceState.selectedSliceIndex;
        const colVal = f.frameIndex !== undefined ? f.frameIndex : f.col !== undefined ? f.col : 0;
        html += `
        <div class="slice-item-row ${isSel ? 'selected' : ''}" data-slice-idx="${idx}" style="display: grid; grid-template-columns: 32px 36px minmax(120px, 1.4fr) minmax(120px, 1.4fr) minmax(70px, 85px) minmax(150px, 180px) 52px; gap: 8px; align-items: center; padding: 4px 12px; min-width: 620px;">
          <span style="font-weight: 600; color: var(--text-dim);">${idx + 1}</span>
          <canvas class="slice-thumb-canvas" id="slice-thumb-${idx}" width="24" height="24"></canvas>
          <input type="text" class="slice-input-sm slice-name-input" data-slice-idx="${idx}" value="${escapeHTML(f.name)}" placeholder="Frame Name">
          <input type="text" class="slice-input-sm slice-tag-input" data-slice-idx="${idx}" value="${escapeHTML(f.tag || '')}" placeholder="Tag / Row (e.g. walk_down)">
          <input type="number" class="slice-input-sm slice-col-input" data-slice-idx="${idx}" value="${colVal}" min="0" max="256" style="width: 58px; text-align: center;" title="Frame sequence index / Column (0, 1, 2...)">
          <div style="display: flex; gap: 3px; align-items: center;">
            <input type="number" class="slice-input-sm slice-coord-w" data-slice-idx="${idx}" value="${f.frame.w}" style="width: 36px;" title="Width (px)">
            <span>×</span>
            <input type="number" class="slice-input-sm slice-coord-h" data-slice-idx="${idx}" value="${f.frame.h}" style="width: 36px;" title="Height (px)">
            <span style="color: var(--text-dim); font-size: 9px;">@${f.frame.x},${f.frame.y}</span>
          </div>
          <div style="display: flex; gap: 4px; justify-content: flex-end;">
            <button type="button" class="btn btn-xs btn-focus-slice" data-slice-idx="${idx}" title="Center slice in viewport" style="padding: 0; width: 20px; height: 20px; border: none; background: transparent; cursor: pointer; color: var(--accent-primary);">
              <i class="fa-solid fa-crosshairs"></i>
            </button>
            <button type="button" class="btn btn-xs btn-del-slice" data-slice-idx="${idx}" title="Delete Slice" style="padding: 0; width: 20px; height: 20px; color: #ef4444; border: none; background: transparent; cursor: pointer;">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      });

      dom.importSlicesList.innerHTML = html;

      if (importSliceState.image) {
        frames.forEach((f, idx) => {
          const thumbCanvas = document.getElementById(`slice-thumb-${idx}`);
          if (thumbCanvas && f.frame.w > 0 && f.frame.h > 0) {
            const tctx = thumbCanvas.getContext('2d');
            tctx.imageSmoothingEnabled = false;
            tctx.clearRect(0, 0, 24, 24);
            tctx.drawImage(
              importSliceState.image,
              f.frame.x,
              f.frame.y,
              f.frame.w,
              f.frame.h,
              0,
              0,
              24,
              24,
            );
          }
        });
      }

      dom.importSlicesList.querySelectorAll('.slice-item-row').forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
          const idx = parseInt(row.dataset.sliceIdx, 10);
          importSliceState.selectedSliceIndex = idx;
          renderImportSliceView();
        });
      });

      dom.importSlicesList.querySelectorAll('.slice-name-input').forEach((input) => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.sliceIdx, 10);
          if (importSliceState.frames[idx]) {
            importSliceState.frames[idx].name = e.target.value.trim() || `slice_${idx}`;
            input.value = importSliceState.frames[idx].name;
            renderImportSliceView(false);
          }
        });
      });

      dom.importSlicesList.querySelectorAll('.slice-tag-input').forEach((input) => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.sliceIdx, 10);
          const frame = importSliceState.frames[idx];
          const tag = input.value.trim();
          if (frame && frame.tag !== tag) {
            frame.tag = tag;
            delete frame.row;
            renderImportSliceView(false);
          }
        });
      });

      dom.importSlicesList.querySelectorAll('.slice-col-input').forEach((input) => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.sliceIdx, 10);
          const val = Math.max(
            0,
            Math.min(PIX2.PROFILES.studio.maxGridCols - 1, parseInt(e.target.value, 10) || 0),
          );
          if (importSliceState.frames[idx]) {
            importSliceState.frames[idx].col = val;
            importSliceState.frames[idx].frameIndex = val;
            input.value = val;
            renderImportSliceView(false);
          }
        });
      });

      dom.importSlicesList.querySelectorAll('.slice-coord-w').forEach((input) => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.sliceIdx, 10);
          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
          const slice = importSliceState.frames[idx];
          if (slice) {
            slice.frame.w = Math.min(val, importSliceState.image.width - slice.frame.x);
            syncUntrimmedSliceSize(slice);
            input.value = slice.frame.w;
            renderImportSliceView(false);
          }
        });
      });

      dom.importSlicesList.querySelectorAll('.slice-coord-h').forEach((input) => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.sliceIdx, 10);
          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
          const slice = importSliceState.frames[idx];
          if (slice) {
            slice.frame.h = Math.min(val, importSliceState.image.height - slice.frame.y);
            syncUntrimmedSliceSize(slice);
            input.value = slice.frame.h;
            renderImportSliceView(false);
          }
        });
      });

      dom.importSlicesList.querySelectorAll('.btn-focus-slice').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.sliceIdx, 10);
          importSliceState.selectedSliceIndex = idx;
          const f = importSliceState.frames[idx];
          if (f && dom.importSliceViewportContainer && importSliceState.image) {
            const z = importSliceState.zoom || 1;
            const img = importSliceState.image;
            const sliceCenterX = (f.frame.x + f.frame.w / 2) * z;
            const sliceCenterY = (f.frame.y + f.frame.h / 2) * z;
            importSliceState.panX = Math.round((img.width * z) / 2 - sliceCenterX);
            importSliceState.panY = Math.round((img.height * z) / 2 - sliceCenterY);
            updateSliceTransform();
          }
          renderImportSliceView();
        });
      });

      dom.importSlicesList.querySelectorAll('.btn-del-slice').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.sliceIdx, 10);
          deleteImportSlice(idx);
        });
      });
    }

    function deleteImportSlice(idx) {
      if (idx >= 0 && idx < importSliceState.frames.length) {
        importSliceState.frames.splice(idx, 1);
        if (importSliceState.selectedSliceIndex >= importSliceState.frames.length) {
          importSliceState.selectedSliceIndex = importSliceState.frames.length - 1;
        }
        renderImportSliceView();
        showToast('Deleted slice', 'info');
      }
    }

    function syncUntrimmedSliceSize(slice) {
      if (slice.rotated || slice.trimmed || slice.spriteSourceSize?.x || slice.spriteSourceSize?.y)
        return;
      const { w, h } = slice.frame;
      slice.sourceSize = { w, h };
      slice.spriteSourceSize = { x: 0, y: 0, w, h };
    }

    function initInspectorDeckResizer() {
      const resizer = document.getElementById('import-slices-deck-resizer');
      const deck = document.getElementById('import-slices-deck');
      const mainArea = document.querySelector('.import-slice-main-area');
      if (!resizer || !deck) return;

      const widthResizer = document.getElementById('slice-config-resizer');
      if (widthResizer && mainArea) {
        const settings = widthResizer.previousElementSibling;
        function resizeSettings(width) {
          mainArea.style.setProperty('--slice-config-width', `${Math.round(width)}px`);
        }
        widthResizer.addEventListener('pointerdown', (event) => {
          if (event.button === 0) widthResizer.setPointerCapture(event.pointerId);
        });
        widthResizer.addEventListener('pointermove', (event) => {
          if (widthResizer.hasPointerCapture(event.pointerId)) {
            resizeSettings(event.clientX - mainArea.getBoundingClientRect().left);
          }
        });
        widthResizer.addEventListener('keydown', (event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          resizeSettings(
            settings.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? -16 : 16),
          );
        });
      }

      let isDragging = false;
      let startY = 0;
      let startHeight = 0;

      resizer.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startHeight = deck.getBoundingClientRect().height;
        resizer.classList.add('is-dragging');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });

      window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dy = startY - e.clientY; // dragging up increases deck height
        const parentH = mainArea ? mainArea.getBoundingClientRect().height : window.innerHeight;
        const maxH = Math.round(parentH * 0.75);
        const newHeight = Math.max(100, Math.min(maxH, Math.round(startHeight + dy)));
        deck.style.height = `${newHeight}px`;
        deck.style.maxHeight = '80%';
      });

      window.addEventListener('pointerup', () => {
        if (isDragging) {
          isDragging = false;
          resizer.classList.remove('is-dragging');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }

    function initImportSliceCanvasEvents() {
      const canvas = dom.importSliceCanvas;
      const container = dom.importSliceViewportContainer;
      if (!canvas || !container) return;

      // Zoom on wheel (Anchor-centered on cursor via NoiraViewport)
      container.addEventListener(
        'wheel',
        (e) => {
          if (!importSliceState.image) return;
          e.preventDefault();
          const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
          const oldZoom = importSliceState.zoom || 1;
          const newZoom = Math.max(
            0.25,
            Math.min(32, Math.round(oldZoom * zoomFactor * 100) / 100),
          );
          if (newZoom === oldZoom) return;

          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const unscaledX = mx / oldZoom;
          const unscaledY = my / oldZoom;

          if (typeof NoiraViewport !== 'undefined' && NoiraViewport.computeAnchorZoomPan) {
            const { panX, panY } = NoiraViewport.computeAnchorZoomPan(
              importSliceState.panX || 0,
              importSliceState.panY || 0,
              oldZoom,
              newZoom,
              unscaledX,
              unscaledY,
              importSliceState.image.width,
              importSliceState.image.height,
            );
            importSliceState.panX = panX;
            importSliceState.panY = panY;
          }

          setSliceZoom(newZoom);
        },
        { passive: false },
      );

      const startSlicePan = (e) => {
        importSliceState.isPanning = true;
        importSliceState.panStartX = e.clientX;
        importSliceState.panStartY = e.clientY;
        importSliceState.dragStartPanX = importSliceState.panX || 0;
        importSliceState.dragStartPanY = importSliceState.panY || 0;
        container.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
        e.preventDefault();
      };

      // Pointer down on container for panning (middle click or hand tool or background)
      container.addEventListener('pointerdown', (e) => {
        if (!importSliceState.image) return;
        const isHand = importSliceState.activeTool === 'hand' || e.button === 1 || input.spaceHeld;
        if (isHand || e.target === container) {
          startSlicePan(e);
          return;
        }
      });

      // Pointer down on canvas
      canvas.addEventListener('pointerdown', (e) => {
        if (!importSliceState.image) return;
        const isHand = importSliceState.activeTool === 'hand' || e.button === 1 || input.spaceHeld;
        if (isHand) {
          startSlicePan(e);
          return;
        }

        const coords = getSliceCanvasCoords(e);
        if (!coords) return;

        const frames = importSliceState.frames || [];
        const selected =
          importSliceState.selectedSliceIndex >= 0
            ? frames[importSliceState.selectedSliceIndex]
            : null;

        // In draw tool mode: immediately start drawing new marquee
        if (importSliceState.activeTool === 'draw') {
          importSliceState.selectedSliceIndex = -1;
          importSliceState.isDrawingSlice = true;
          importSliceState.dragStartX = coords.x;
          importSliceState.dragStartY = coords.y;
          importSliceState.currentDragRect = { x: coords.x, y: coords.y, w: 1, h: 1 };
          renderImportSliceView();
          return;
        }

        // Check handle on currently selected slice
        if (selected) {
          const handle = hitTestSliceHandles(selected, e);
          if (handle && handle !== 'move') {
            importSliceState.isResizingSlice = true;
            importSliceState.activeHandle = handle;
            importSliceState.dragStartX = coords.x;
            importSliceState.dragStartY = coords.y;
            importSliceState.dragOriginRect = { ...selected.frame };
            return;
          }
        }

        // Hit-test slice bodies (top to bottom)
        let hitIdx = -1;
        for (let i = frames.length - 1; i >= 0; i--) {
          const f = frames[i];
          if (
            coords.x >= f.frame.x &&
            coords.x < f.frame.x + f.frame.w &&
            coords.y >= f.frame.y &&
            coords.y < f.frame.y + f.frame.h
          ) {
            hitIdx = i;
            break;
          }
        }

        if (hitIdx >= 0) {
          importSliceState.selectedSliceIndex = hitIdx;
          importSliceState.isDraggingSlice = true;
          importSliceState.dragStartX = coords.x;
          importSliceState.dragStartY = coords.y;
          importSliceState.dragOriginRect = { ...frames[hitIdx].frame };
          renderImportSliceView();
          return;
        }

        // Clicked on empty space: deselect, or if dragged, allow creating a slice
        importSliceState.selectedSliceIndex = -1;
        importSliceState.isDrawingSlice = true;
        importSliceState.dragStartX = coords.x;
        importSliceState.dragStartY = coords.y;
        importSliceState.currentDragRect = { x: coords.x, y: coords.y, w: 1, h: 1 };
        renderImportSliceView();
      });

      window.addEventListener('pointermove', (e) => {
        if (importSliceState.isPanning) {
          const dx = e.clientX - importSliceState.panStartX;
          const dy = e.clientY - importSliceState.panStartY;
          importSliceState.panX = Math.round((importSliceState.dragStartPanX || 0) + dx);
          importSliceState.panY = Math.round((importSliceState.dragStartPanY || 0) + dy);
          updateSliceTransform();
          return;
        }

        if (!importSliceState.image) return;
        const coords = getSliceCanvasCoords(e);
        if (!coords) return;

        if (dom.sliceCoordsInfo) {
          let text = `${coords.x}, ${coords.y}`;
          if (importSliceState.isDrawingSlice && importSliceState.currentDragRect) {
            const dr = importSliceState.currentDragRect;
            text = `${dr.w}×${dr.h} @ (${dr.x}, ${dr.y})`;
          } else if (
            importSliceState.selectedSliceIndex >= 0 &&
            importSliceState.frames[importSliceState.selectedSliceIndex]
          ) {
            const fr = importSliceState.frames[importSliceState.selectedSliceIndex].frame;
            text = `${coords.x}, ${coords.y} | Sel: ${fr.w}×${fr.h} @ (${fr.x}, ${fr.y})`;
          }
          dom.sliceCoordsInfo.textContent = text;
        }

        if (importSliceState.isDrawingSlice && importSliceState.currentDragRect) {
          const x1 = Math.min(importSliceState.dragStartX, coords.x);
          const y1 = Math.min(importSliceState.dragStartY, coords.y);
          const x2 = Math.max(importSliceState.dragStartX, coords.x);
          const y2 = Math.max(importSliceState.dragStartY, coords.y);
          importSliceState.currentDragRect = { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
          renderImportSliceView();
          return;
        }

        if (importSliceState.isDraggingSlice && importSliceState.selectedSliceIndex >= 0) {
          const slice = importSliceState.frames[importSliceState.selectedSliceIndex];
          if (slice && importSliceState.dragOriginRect) {
            const dx = coords.x - importSliceState.dragStartX;
            const dy = coords.y - importSliceState.dragStartY;
            const maxW = importSliceState.image.width;
            const maxH = importSliceState.image.height;
            slice.frame.x = Math.max(
              0,
              Math.min(maxW - slice.frame.w, importSliceState.dragOriginRect.x + dx),
            );
            slice.frame.y = Math.max(
              0,
              Math.min(maxH - slice.frame.h, importSliceState.dragOriginRect.y + dy),
            );
            renderImportSliceView();
          }
          return;
        }

        if (importSliceState.isResizingSlice && importSliceState.selectedSliceIndex >= 0) {
          const slice = importSliceState.frames[importSliceState.selectedSliceIndex];
          if (slice && importSliceState.dragOriginRect) {
            const dx = coords.x - importSliceState.dragStartX;
            const dy = coords.y - importSliceState.dragStartY;
            const orig = importSliceState.dragOriginRect;
            const handle = importSliceState.activeHandle;
            const right = orig.x + orig.w;
            const bottom = orig.y + orig.h;
            const left = handle.endsWith('w')
              ? Math.max(0, Math.min(right - 1, orig.x + dx))
              : orig.x;
            const top = handle.startsWith('n')
              ? Math.max(0, Math.min(bottom - 1, orig.y + dy))
              : orig.y;
            const nextRight = handle.endsWith('e')
              ? Math.max(left + 1, Math.min(importSliceState.image.width, right + dx))
              : right;
            const nextBottom = handle.startsWith('s')
              ? Math.max(top + 1, Math.min(importSliceState.image.height, bottom + dy))
              : bottom;
            slice.frame = { x: left, y: top, w: nextRight - left, h: nextBottom - top };
            renderImportSliceView();
          }
          return;
        }

        if (e.target === canvas || e.target === dom.importSliceOverlay) {
          if (importSliceState.activeTool === 'hand' || input.spaceHeld) {
            canvas.style.cursor = 'grab';
            return;
          }
          if (importSliceState.activeTool === 'draw') {
            canvas.style.cursor = 'crosshair';
            return;
          }

          const frames = importSliceState.frames || [];
          const selected =
            importSliceState.selectedSliceIndex >= 0
              ? frames[importSliceState.selectedSliceIndex]
              : null;
          if (selected) {
            const handle = hitTestSliceHandles(selected, e);
            if (handle === 'nw' || handle === 'se') {
              canvas.style.cursor = 'nwse-resize';
              return;
            } else if (handle === 'ne' || handle === 'sw') {
              canvas.style.cursor = 'nesw-resize';
              return;
            } else if (handle === 'move') {
              canvas.style.cursor = 'move';
              return;
            }
          }
          for (let i = frames.length - 1; i >= 0; i--) {
            const f = frames[i];
            if (
              coords.x >= f.frame.x &&
              coords.x < f.frame.x + f.frame.w &&
              coords.y >= f.frame.y &&
              coords.y < f.frame.y + f.frame.h
            ) {
              canvas.style.cursor = 'pointer';
              return;
            }
          }
          canvas.style.cursor = 'default';
        }
      });

      window.addEventListener('pointerup', () => {
        if (importSliceState.isPanning) {
          importSliceState.isPanning = false;
          container.style.cursor =
            importSliceState.activeTool === 'hand' || input.spaceHeld ? 'grab' : 'default';
          document.body.style.cursor = '';
        }

        if (importSliceState.isDrawingSlice && importSliceState.currentDragRect) {
          const dr = importSliceState.currentDragRect;
          if (importSliceState.activeTool === 'draw' || dr.w > 1 || dr.h > 1) {
            const nextIdx = importSliceState.frames.length;
            const newSlice = {
              name: `slice_${String(nextIdx).padStart(3, '0')}`,
              tag: '',
              frame: { ...dr },
              sourceSize: { w: dr.w, h: dr.h },
              spriteSourceSize: { x: 0, y: 0, w: dr.w, h: dr.h },
            };
            importSliceState.frames.push(newSlice);
            importSliceState.selectedSliceIndex = nextIdx;
            showToast(`Added Slice #${nextIdx + 1} (${dr.w}×${dr.h}px)`, 'success');
          }
          importSliceState.isDrawingSlice = false;
          importSliceState.currentDragRect = null;
          renderImportSliceView();
          return;
        }

        if (importSliceState.isDraggingSlice || importSliceState.isResizingSlice) {
          const slice = importSliceState.frames[importSliceState.selectedSliceIndex];
          if (slice && importSliceState.isResizingSlice) syncUntrimmedSliceSize(slice);
          importSliceState.isDraggingSlice = false;
          importSliceState.isResizingSlice = false;
          importSliceState.activeHandle = null;
          importSliceState.dragOriginRect = null;
          renderImportSliceView();
        }
      });

      function cancelSliceGesture() {
        const slice = importSliceState.frames[importSliceState.selectedSliceIndex];
        if (slice && importSliceState.dragOriginRect) slice.frame = importSliceState.dragOriginRect;
        importSliceState.dragOriginRect = null;
        importSliceState.currentDragRect = null;
        importSliceState.activeHandle = null;
        importSliceState.isDrawingSlice = false;
        importSliceState.isDraggingSlice = false;
        importSliceState.isResizingSlice = false;
        if (importSliceState.isPanning) document.body.style.cursor = '';
        importSliceState.isPanning = false;
        input.spaceHeld = false;
        container.style.cursor = importSliceState.activeTool === 'hand' ? 'grab' : 'default';
        if (getActiveView() === 'tab-import-slice') renderImportSliceView();
      }
      window.addEventListener('pointercancel', cancelSliceGesture);
      window.addEventListener('blur', cancelSliceGesture);

      window.addEventListener('keydown', (e) => {
        if (getActiveView() !== 'tab-import-slice') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
          if (!input.spaceHeld) {
            input.spaceHeld = true;
            container.style.cursor = 'grab';
          }
          e.preventDefault();
        } else if (e.key === 'v' || e.key === 'V') {
          setSliceTool('select');
        } else if (e.key === 'd' || e.key === 'D') {
          setSliceTool('draw');
        } else if (e.key === 'h' || e.key === 'H') {
          setSliceTool('hand');
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (importSliceState.selectedSliceIndex >= 0) {
            deleteImportSlice(importSliceState.selectedSliceIndex);
          }
        } else if (e.key === 'Escape') {
          if (!importSliceState.dragOriginRect && !importSliceState.currentDragRect)
            importSliceState.selectedSliceIndex = -1;
          cancelSliceGesture();
        } else if (e.key === '+' || e.key === '=') {
          setSliceZoom(importSliceState.zoom * 1.25);
        } else if (e.key === '-' || e.key === '_') {
          setSliceZoom(importSliceState.zoom * 0.8);
        } else if (e.key === '0') {
          setSliceZoom(1);
        }
      });

      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
          input.spaceHeld = false;
          container.style.cursor = importSliceState.activeTool === 'hand' ? 'grab' : 'default';
        }
      });
    }

    function updateImportSlices() {
      if (!importSliceState.image) return;
      const method = dom.selectSliceMethod ? dom.selectSliceMethod.value : 'grid';

      if (method === 'manual') {
        if (importSliceState.frames.length === 0) {
          showToast('Click and drag on the image to draw your first slice!', 'info');
        }
      } else if (method === 'grid') {
        const cellW = Math.max(1, parseInt(dom.inputSliceCellW?.value, 10) || 32);
        const cellH = Math.max(1, parseInt(dom.inputSliceCellH?.value, 10) || 32);
        const cols = dom.inputSliceCols?.value ? parseInt(dom.inputSliceCols.value, 10) : undefined;
        const rows = dom.inputSliceRows?.value ? parseInt(dom.inputSliceRows.value, 10) : undefined;
        const spacing = parseInt(dom.inputSliceSpacing?.value, 10) || 0;
        const margin = parseInt(dom.inputSliceMargin?.value, 10) || 0;

        const rects = ImportSlice.sliceGrid({
          imageWidth: importSliceState.image.width,
          imageHeight: importSliceState.image.height,
          cellWidth: cellW,
          cellHeight: cellH,
          columns: cols,
          rows: rows,
          spacing: spacing,
          margin: margin,
        });

        const dirNames4 = ['down', 'up', 'right', 'left'];
        importSliceState.frames = rects.map((r, i) => {
          const rowIdx = r.row !== undefined ? r.row : 0;
          const colIdx =
            r.col !== undefined ? r.col : r.frameIndex !== undefined ? r.frameIndex : i;
          const defaultTag =
            rects.length >= 4 && rowIdx < 4 ? `walk_${dirNames4[rowIdx]}` : `row_${rowIdx}`;
          const dirName = rowIdx < 4 ? dirNames4[rowIdx] : `anim_${rowIdx}`;
          return {
            name: `${dirName}_${colIdx}`,
            tag: defaultTag,
            row: rowIdx,
            col: colIdx,
            frameIndex: colIdx,
            frame: { x: r.x, y: r.y, w: r.w, h: r.h },
            sourceSize: { w: r.w, h: r.h },
            spriteSourceSize: { x: 0, y: 0, w: r.w, h: r.h },
          };
        });
      } else if (method === 'alpha') {
        const canvas = document.createElement('canvas');
        canvas.width = importSliceState.image.width;
        canvas.height = importSliceState.image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(importSliceState.image, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const alphaThresh = parseInt(dom.inputSliceAlphaThresh?.value, 10) || 10;
        const minSize = parseInt(dom.inputSliceMinSize?.value, 10) || 2;

        const islands = ImportSlice.sliceAlphaIslands(imgData, {
          alphaThreshold: alphaThresh,
          minIslandSize: minSize,
        });

        importSliceState.frames = islands.map((r, i) => ({
          name: `island_${String(i).padStart(3, '0')}`,
          tag: 'island',
          row: 0,
          col: i,
          frameIndex: i,
          frame: r,
          sourceSize: { w: r.w, h: r.h },
          spriteSourceSize: { x: 0, y: 0, w: r.w, h: r.h },
        }));
      } else if (method === 'atlas') {
        if (importSliceState.jsonAtlas) {
          const atlasFrames = ImportSlice.parseAtlasJSON(importSliceState.jsonAtlas, {
            width: importSliceState.image.width,
            height: importSliceState.image.height,
            maxFrames: PIX2.PROFILES.studio.maxTotalCells,
            maxFrameDim: PIX2.PROFILES.studio.maxCellDim,
          });
          importSliceState.frames = atlasFrames.map((f, i) => {
            const colVal =
              f.frameIndex !== undefined ? f.frameIndex : f.col !== undefined ? f.col : i;
            return {
              ...f,
              frame: { x: f.x, y: f.y, w: f.w, h: f.h },
              sourceSize: { w: f.sourceW, h: f.sourceH },
              spriteSourceSize: { x: f.trimX, y: f.trimY, w: f.trimW, h: f.trimH },
              col: colVal,
              frameIndex: colVal,
              row: f.row !== undefined ? f.row : 0,
            };
          });
        }
      }

      renderImportSliceView();
    }

    function commitImportSlicesToProject() {
      if (
        !importSliceState.image ||
        !importSliceState.frames ||
        importSliceState.frames.length === 0
      ) {
        showToast('No slices to import', 'error');
        return;
      }
      const layerName = dom.inputSliceLayerName
        ? dom.inputSliceLayerName.value.trim() || 'Imported'
        : 'Imported';
      const autoAnimate = dom.chkSliceAutoAnimate ? dom.chkSliceAutoAnimate.checked : true;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = importSliceState.image.width;
        canvas.height = importSliceState.image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(importSliceState.image, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const draft = PIX2.createDocument('Imported Sprites', 1, 1, 16, 16);
        const candidate = PIX2.createDocument('Imported Sprites', 1, 1, 16, 16);
        candidate.cells = {};
        ImportSlice.importFramesToDoc(candidate, importSliceState.frames, imgData, {
          layerName,
          createAnimations: autoAnimate,
          useGridCellIds: true,
          rejectDuplicateCells: true,
        });
        const validation = PIX2.validate(candidate, { strict: true });
        if (!validation.valid) throw new Error(validation.errors[0] || 'Invalid imported document');
        const fileName = sanitizeSafeFilename(
          dom.importSliceFileName?.textContent.replace(/\.png$/i, ''),
          '.pix2',
          'imported_sprites',
        );
        commitProject(draft, candidate, fileName, importSliceState.frames.length);
        showToast(
          `Imported ${importSliceState.frames.length} frames into a new project`,
          'success',
        );
      } catch (err) {
        showToast(`Import error: ${err.message}`, 'error');
      }
    }

    function handleSingleFileToImportSlice(file) {
      if (!file) return;
      const maxImportBytes = PIX2?.PROFILES?.studio?.maxFileSize || 20 * 1024 * 1024;
      if (file.size > maxImportBytes) {
        showToast(`Import file exceeds the ${Math.floor(maxImportBytes / (1024 * 1024))} MB safety limit.`, 'error');
        return;
      }
      const name = file.name.toLowerCase();
      if (name.endsWith('.png')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            try {
              PIX2.assertRasterSize(img.width, img.height);
            } catch (err) {
              showToast(`Image import rejected: ${err.message}`, 'error');
              return;
            }
            importSliceState.image = img;
            if (dom.importSliceFileInfo) dom.importSliceFileInfo.style.display = 'block';
            if (dom.importSliceFileName) dom.importSliceFileName.textContent = file.name;
            if (dom.importSliceImgDims)
              dom.importSliceImgDims.textContent = `${img.width}×${img.height}`;

            const maxDim = Math.max(img.width, img.height);
            if (maxDim <= 64) importSliceState.zoom = 6;
            else if (maxDim <= 128) importSliceState.zoom = 4;
            else if (maxDim <= 256) importSliceState.zoom = 2;
            else if (maxDim > 1024) importSliceState.zoom = 0.5;
            else importSliceState.zoom = 1;

            activateView('tab-import-slice');
            refreshAll();
            updateImportSlices();
            applySliceZoom();
            showToast(`Loaded ${file.name} for slicing!`);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else if (name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target.result);
            importSliceState.jsonAtlas = parsed;
            if (dom.selectSliceMethod) dom.selectSliceMethod.value = 'atlas';
            if (dom.atlasDetectedInfo) {
              dom.atlasDetectedInfo.innerHTML = `<span class="text-success"><i class="fa-solid fa-check"></i> Loaded Atlas JSON: ${escapeHTML(file.name)}</span>`;
            }
            activateView('tab-import-slice');
            refreshAll();
            updateImportSlices();
            showToast(`Loaded Atlas JSON: ${file.name}`);
          } catch (err) {
            showToast(`Invalid JSON file: ${err.message}`, 'error');
          }
        };
        reader.readAsText(file);
      }
    }

    function handlePairDropToImportSlice(pngFile, jsonFile) {
      const maxImportBytes = PIX2?.PROFILES?.studio?.maxFileSize || 20 * 1024 * 1024;
      if (!pngFile || !jsonFile || pngFile.size > maxImportBytes || jsonFile.size > maxImportBytes) {
        showToast(`Each import file must be no larger than ${Math.floor(maxImportBytes / (1024 * 1024))} MB.`, 'error');
        return;
      }
      const jsonReader = new FileReader();
      jsonReader.onload = (je) => {
        try {
          const parsed = JSON.parse(je.target.result);
          importSliceState.jsonAtlas = parsed;
          if (dom.selectSliceMethod) dom.selectSliceMethod.value = 'atlas';
          if (dom.atlasDetectedInfo) {
            dom.atlasDetectedInfo.innerHTML = `<span class="text-success"><i class="fa-solid fa-check"></i> Paired Atlas JSON: ${escapeHTML(jsonFile.name)}</span>`;
          }

          const pngReader = new FileReader();
          pngReader.onload = (pe) => {
            const img = new Image();
            img.onload = () => {
              try {
                PIX2.assertRasterSize(img.width, img.height);
              } catch (err) {
                showToast(`Image import rejected: ${err.message}`, 'error');
                return;
              }
              importSliceState.image = img;
              if (dom.importSliceFileInfo) dom.importSliceFileInfo.style.display = 'block';
              if (dom.importSliceFileName) dom.importSliceFileName.textContent = pngFile.name;
              if (dom.importSliceImgDims)
                dom.importSliceImgDims.textContent = `${img.width}×${img.height}`;

              const maxDim = Math.max(img.width, img.height);
              if (maxDim <= 64) importSliceState.zoom = 6;
              else if (maxDim <= 128) importSliceState.zoom = 4;
              else if (maxDim <= 256) importSliceState.zoom = 2;
              else if (maxDim > 1024) importSliceState.zoom = 0.5;
              else importSliceState.zoom = 1;

              activateView('tab-import-slice');
              refreshAll();
              updateImportSlices();
              applySliceZoom();
              showToast(
                `Paired ${pngFile.name} + ${jsonFile.name} loaded into Atlas Slicer!`,
                'success',
              );
            };
            img.src = pe.target.result;
          };
          pngReader.readAsDataURL(pngFile);
        } catch (err) {
          showToast(`Invalid Atlas JSON: ${err.message}`, 'error');
        }
      };
      jsonReader.readAsText(jsonFile);
    }
    return {
      setSliceTool,
      setSliceZoom,
      fitSliceZoom,
      batchTagPrefix,
      autoTag4Dir,
      autoTag8Dir,
      clearAllTags,
      renderImportSliceView,
      deleteImportSlice,
      initInspectorDeckResizer,
      initImportSliceCanvasEvents,
      updateImportSlices,
      commitImportSlicesToProject,
      handleSingleFileToImportSlice,
      handlePairDropToImportSlice,
    };
  }
  return { create };
})();
