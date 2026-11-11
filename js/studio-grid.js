/** Studio grid controller. App supplies document and view ports. */
const StudioGrid = (() => {
  function create({
    state,
    dom,
    view,
    GRID_LAYOUT,
    GRID_ZOOM_LEVELS,
    populateAnimDropdowns,
    refreshAll,
    showToast,
    triggerEventAutosave,
    updateGridInspectorUI,
  }) {
    function setGridZoom(newZoom, clientX, clientY) {
      if (!state.doc) return;
      const oldZoom = GRID_LAYOUT.zoom;
      if (newZoom === oldZoom) return;
      const anchor =
        Number.isFinite(clientX) && Number.isFinite(clientY)
          ? dom.gridCanvas.getBoundingClientRect()
          : null;
      GRID_LAYOUT.zoom = newZoom;
      dom.gridZoomLevel.textContent =
        newZoom < 0.1
          ? `${Number((newZoom * 100).toFixed(1))}%`
          : NoiraViewport.formatArtworkZoom(newZoom);
      renderGridOverview();

      if (anchor?.width && anchor.height) {
        const { cellSize, grid } = state.doc.meta;
        const { leftHeaderW, topHeaderH, cellGapX, cellGapY } = GRID_LAYOUT;
        const resized = dom.gridCanvas.getBoundingClientRect();
        const x = NoiraViewport.gridZoomOffset(
          clientX - anchor.left,
          leftHeaderW,
          cellSize.w,
          cellGapX,
          oldZoom,
          newZoom,
          grid.cols,
        );
        const y = NoiraViewport.gridZoomOffset(
          clientY - anchor.top,
          topHeaderH,
          cellSize.h,
          cellGapY,
          oldZoom,
          newZoom,
          grid.rows,
        );
        view.gridPanX += Math.round(clientX - resized.left - x);
        view.gridPanY += Math.round(clientY - resized.top - y);
        applyGridPan();
      }
    }

    function fitGridCanvas() {
      if (!state.doc) return;
      const viewport = dom.gridCanvas.parentElement;
      const style = getComputedStyle(viewport);
      const paddedWidth = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const paddedHeight = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const { cellSize, grid } = state.doc.meta;
      const { leftHeaderW, topHeaderH, cellGapX, cellGapY } = GRID_LAYOUT;
      const zoom = NoiraViewport.gridFitZoom(
        viewport.clientWidth - paddedWidth,
        viewport.clientHeight - paddedHeight,
        grid.cols * cellSize.w,
        grid.rows * cellSize.h,
        leftHeaderW + grid.cols * cellGapX + 36,
        topHeaderH + grid.rows * cellGapY + 40,
      );
      if (zoom === null) {
        showToast('The grid controls alone exceed the viewport. Zoom out and pan to browse.');
        setGridZoom(GRID_ZOOM_LEVELS[0]);
      } else {
        setGridZoom(zoom);
      }
      centerGridCanvas();
    }

    function zoomGridIn(clientX, clientY) {
      const cur = GRID_LAYOUT.zoom;
      setGridZoom(GRID_ZOOM_LEVELS.find((z) => z > cur) ?? cur, clientX, clientY);
    }

    function zoomGridOut(clientX, clientY) {
      const cur = GRID_LAYOUT.zoom;
      const next = GRID_ZOOM_LEVELS.findLast((z) => z < cur) ?? cur;
      setGridZoom(next, clientX, clientY);
    }

    function applyGridPan() {
      if (!dom.gridCanvas) return;
      if (view.gridPanX === 0 && view.gridPanY === 0) {
        dom.gridCanvas.style.transform = '';
      } else {
        dom.gridCanvas.style.transform = `translate(${view.gridPanX}px, ${view.gridPanY}px)`;
      }
    }

    function centerGridCanvas() {
      view.gridPanX = 0;
      view.gridPanY = 0;
      applyGridPan();
    }

    function getRowMoveUpHit(mx, my) {
      for (const btn of view.gridRowMoveUpButtons) {
        if (
          mx >= btn.x - 3 &&
          mx <= btn.x + btn.w + 3 &&
          my >= btn.y - 3 &&
          my <= btn.y + btn.h + 3
        ) {
          return btn.row;
        }
      }
      return null;
    }

    function getRowMoveDownHit(mx, my) {
      for (const btn of view.gridRowMoveDownButtons) {
        if (
          mx >= btn.x - 3 &&
          mx <= btn.x + btn.w + 3 &&
          my >= btn.y - 3 &&
          my <= btn.y + btn.h + 3
        ) {
          return btn.row;
        }
      }
      return null;
    }

    function getRowCardHit(mx, my) {
      for (const card of view.gridRowCards) {
        if (mx >= card.x && mx <= card.x + card.w && my >= card.y && my <= card.y + card.h) {
          return card.row;
        }
      }
      return null;
    }

    function getRowDuplicateHit(mx, my) {
      for (const btn of view.gridRowDuplicateButtons) {
        if (
          mx >= btn.x - 3 &&
          mx <= btn.x + btn.w + 3 &&
          my >= btn.y - 3 &&
          my <= btn.y + btn.h + 3
        ) {
          return btn.row;
        }
      }
      return null;
    }

    function getRowDeleteHit(mx, my) {
      for (const btn of view.gridRowDeleteButtons) {
        if (
          mx >= btn.x - 3 &&
          mx <= btn.x + btn.w + 3 &&
          my >= btn.y - 3 &&
          my <= btn.y + btn.h + 3
        ) {
          return btn.row;
        }
      }
      return null;
    }

    function getColDeleteHit(mx, my) {
      for (const btn of view.gridColDeleteButtons) {
        if (
          mx >= btn.x - 3 &&
          mx <= btn.x + btn.w + 3 &&
          my >= btn.y - 3 &&
          my <= btn.y + btn.h + 3
        ) {
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

      const artworkWarning =
        paintedCount > 0
          ? `⚠️ WARNING: This row contains ${paintedCount} frame(s) with pixel artwork that will be PERMANENTLY deleted!\n\n`
          : `(This row contains only empty frames).\n\n`;

      const message =
        `Are you sure you want to delete Row ${rowIdx} ("${rowName}")?\n\n` +
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

      const artworkWarning =
        paintedCount > 0
          ? `⚠️ WARNING: Column ${colIdx} contains ${paintedCount} cell(s) with pixel artwork that will be PERMANENTLY deleted!\n\n`
          : `(This column contains only empty cells).\n\n`;

      const message =
        `Are you sure you want to delete Column ${colIdx}?\n\n` +
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
      const directions = [
        'down',
        'up',
        'right',
        'left',
        'down_left',
        'down_right',
        'up_left',
        'up_right',
      ];
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
        if (
          typeof cell.row === 'number' &&
          !isNaN(cell.row) &&
          typeof cell.col === 'number' &&
          !isNaN(cell.col)
        ) {
          return { r: cell.row, c: cell.col };
        }
        const dirMap = {
          'down': 0,
          'up': 1,
          'right': 2,
          'left': 3,
          'down_left': 4,
          'down_right': 5,
          'up_left': 6,
          'up_right': 7,
        };
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

      view.gridColDeleteButtons = [];
      view.gridRowDeleteButtons = [];
      view.gridRowDuplicateButtons = [];
      view.gridRowMoveUpButtons = [];
      view.gridRowMoveDownButtons = [];
      view.gridRowCards = [];

      const sheetW = leftHeaderW + cols * (cw * zoom + cellGapX) + 36;
      const sheetH = topHeaderH + rows * (ch * zoom + cellGapY) + 40;

      // High-DPI Razor-Sharp Text & Canvas Rendering
      const dpr = Math.min(window.devicePixelRatio || 1, 4096 / sheetW, 4096 / sheetH);
      EditorCanvas.resize(canvas, Math.round(sheetW * dpr), Math.round(sheetH * dpr));
      canvas.style.width = `${sheetW}px`;
      canvas.style.height = `${sheetH}px`;
      ctx.setTransform(canvas.width / sheetW, 0, 0, canvas.height / sheetH, 0, 0);

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

        view.gridColDeleteButtons.push({ col: c, x: colBtnX, y: colBtnY, w: colBtnW, h: colBtnH });

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

        view.gridRowCards.push({ row: r, x: cardX, y: cardY, w: cardW, h: cardH });

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

        view.gridRowDeleteButtons.push({ row: r, x: delBtnX, y: delBtnY, w: delBtnW, h: delBtnH });

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

        view.gridRowDuplicateButtons.push({
          row: r,
          x: dupBtnX,
          y: dupBtnY,
          w: dupBtnW,
          h: dupBtnH,
        });

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

          view.gridRowMoveDownButtons.push({
            row: r,
            x: downBtnX,
            y: downBtnY,
            w: downBtnW,
            h: downBtnH,
          });

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

          view.gridRowMoveUpButtons.push({ row: r, x: upBtnX, y: upBtnY, w: upBtnW, h: upBtnH });

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
          const startX = cardX + 8 - offset;

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

          const isSelected =
            cellId === view.selectedGridCellId ||
            (!cell && view.selectedGridCellId === `cell_${r}_${c}`);

          // Checkerboard
          ctx.fillStyle = EditorCanvas.checker(ctx, zoom, isDark);
          ctx.fillRect(cx, cy, cw * zoom, ch * zoom);

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
          const labelText = cell ? cell.name || cellId : cellId;
          const pillW = Math.max(54, cw * zoom);
          const pillH = 20;
          const pillX = Math.round(cx + (cw * zoom - pillW) / 2);
          const pillY = cy + ch * zoom + 8;

          ctx.imageSmoothingEnabled = true;
          ctx.fillStyle = isSelected
            ? isDark
              ? '#312e81'
              : '#e0e7ff'
            : isDark
              ? '#1e2230'
              : '#ffffff';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 4);
          else ctx.rect(pillX, pillY, pillW, pillH);
          ctx.fill();
          ctx.strokeStyle = isSelected
            ? isDark
              ? '#818cf8'
              : '#4f46e5'
            : isDark
              ? '#4b5563'
              : '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = isSelected
            ? isDark
              ? '#c7d2fe'
              : '#312e81'
            : isDark
              ? '#f8fafc'
              : '#0f172a';
          ctx.font = isSelected
            ? 'bold 11px "Segoe UI", system-ui, sans-serif'
            : '600 11px "Segoe UI", system-ui, sans-serif';
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
            const startX = pillX + 5 - offset;

            ctx.textAlign = 'left';
            ctx.fillText(labelText, startX, pillY + pillH / 2);
            ctx.fillText(labelText, startX + totalLoopDist, pillY + pillH / 2);
            ctx.restore();
          }
        }
      }

      // Render row drag indicator if dragging a row card
      if (view.rowDragState && view.rowDragState.isDragging) {
        const targetR = view.rowDragState.targetRow;
        const targetRowY = topHeaderH + targetR * (ch * zoom + cellGapY);
        const lineY =
          targetR > view.rowDragState.fromRow
            ? targetRowY + ch * zoom + cellGapY / 2
            : targetRowY - cellGapY / 2;

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
        if (view.marqueeAnimFrameId) cancelAnimationFrame(view.marqueeAnimFrameId);
        view.marqueeAnimFrameId = requestAnimationFrame(() => {
          if (state.activeTabId === 'tab-grid-overview') {
            renderGridOverview();
          }
        });
      } else {
        if (view.marqueeAnimFrameId) {
          cancelAnimationFrame(view.marqueeAnimFrameId);
          view.marqueeAnimFrameId = null;
        }
      }
    }

    function inferRowTitle(rowIdx) {
      if (!state.doc) return 'Default';
      for (const animName in state.doc.animations) {
        const anim = state.doc.animations[animName];
        if (anim && anim.frames) {
          if (
            anim.frames.some((fid) => {
              if (fid.startsWith(`cell_${rowIdx}_`)) return true;
              const { r } = getCellRowCol(fid);
              return r === rowIdx;
            })
          ) {
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

      for (let row = 0; row < Math.ceil(h / size); row++) {
        const py = row * size;
        for (let col = 0; col < Math.ceil(w / size); col++) {
          const px = col * size;
          ctx.fillStyle = (col + row) % 2 === 0 ? c1 : c2;
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

    function addGridRow() {
      if (!state.doc) return;
      const doc = state.doc;
      const newR = doc.meta.grid.rows;

      const defaultName = `action_${newR}`;
      const inputName = prompt(
        `Enter Animation State name for new Row ${newR} (e.g. attack, jump, dash, idle_down):`,
        defaultName,
      );
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
          pixels: {},
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
        mode: 'loop',
      };

      view.selectedGridCellId = `cell_${newR}_0`;
      if (state.saveSnapshot(`Add Row ${newR} (${stateKey})`)) triggerEventAutosave();
      refreshAll();
      populateAnimDropdowns();
      updateGridInspectorUI();
      showToast(
        `Added Row ${newR} with State "${dispName}" (${doc.meta.grid.cols} frames)!`,
        'success',
      );
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
          pixels: {},
        };

        // Automatically append newly added frame to the animation sequence!
        if (rowAnim && Array.isArray(rowAnim.frames)) {
          if (!rowAnim.frames.includes(cid)) {
            rowAnim.frames.push(cid);
          }
        }
      }

      if (state.saveSnapshot('Add Column')) triggerEventAutosave();
      refreshAll();
      showToast(
        `Added Column ${newC} (all row animations extended to ${doc.meta.grid.cols} frames)`,
        'success',
      );
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
      const cleanPrefix =
        finalName
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
          direction: srcCell && srcCell.direction ? srcCell.direction : 'none',
          pixels: {},
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
        if (
          a &&
          a.frames &&
          a.frames.some((fid) => {
            const cell = doc.cells[fid];
            return cell && cell.row === sourceRowIdx;
          })
        ) {
          srcFps = a.fps || 6;
          srcLoop = a.loop !== undefined ? a.loop : true;
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
        frames: newFrameIds,
      };

      // 5. Select first cell of new row
      view.selectedGridCellId = newFrameIds[0];

      if (state.endStroke(`Duplicate Row ${sourceRowIdx} as "${finalName}"`))
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
      order.forEach((oldR, newR) => {
        oldToNew[oldR] = newR;
      });

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
            anim.frames = anim.frames.map((fid) => renameMap[fid] || fid);
          }
        }

        if (view.selectedGridCellId && renameMap[view.selectedGridCellId]) {
          view.selectedGridCellId = renameMap[view.selectedGridCellId];
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
      if (state.endStroke(`Move Row ${fromIdx} to Row ${toIdx} ("${fromTitle}")`))
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

        const newR = r > rowIdx ? r - 1 : r;

        for (let c = 0; c < cols; c++) {
          const existingCell = getCellAtGrid(doc, r, c);
          const oldId = existingCell ? existingCell.id : `cell_${r}_${c}`;
          const newId = `cell_${newR}_${c}`;
          idMapping[oldId] = newId;

          const cell = existingCell || {
            id: oldId,
            name: `Frame ${r},${c}`,
            pixels: {},
            row: r,
            col: c,
          };
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
            .map((fid) => (idMapping[fid] !== undefined ? idMapping[fid] : fid))
            .filter((fid) => fid !== null);
        }
      }

      // 3. Update selection
      if (view.selectedGridCellId && view.selectedGridCellId.startsWith(`cell_${rowIdx}_`)) {
        view.selectedGridCellId = `cell_0_0`;
      } else if (view.selectedGridCellId && idMapping[view.selectedGridCellId]) {
        view.selectedGridCellId = idMapping[view.selectedGridCellId];
      }

      if (state.endStroke(`Delete Row ${rowIdx}`)) triggerEventAutosave();
      refreshAll();
      showToast(
        `Deleted Row ${rowIdx} ("${rowName}"). Remaining rows: ${doc.meta.grid.rows}`,
        'success',
      );
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

        const newC = c > colIdx ? c - 1 : c;

        for (let r = 0; r < rows; r++) {
          const existingCell = getCellAtGrid(doc, r, c);
          const oldId = existingCell ? existingCell.id : `cell_${r}_${c}`;
          const newId = `cell_${r}_${newC}`;
          idMapping[oldId] = newId;

          const cell = existingCell || {
            id: oldId,
            name: `Frame ${r},${c}`,
            pixels: {},
            row: r,
            col: c,
          };
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
            .map((fid) => (idMapping[fid] !== undefined ? idMapping[fid] : fid))
            .filter((fid) => fid !== null);
        }
      }

      // 3. Update selection
      if (view.selectedGridCellId && view.selectedGridCellId.endsWith(`_${colIdx}`)) {
        view.selectedGridCellId = `cell_0_0`;
      } else if (view.selectedGridCellId && idMapping[view.selectedGridCellId]) {
        view.selectedGridCellId = idMapping[view.selectedGridCellId];
      }

      if (state.endStroke(`Delete Column ${colIdx}`)) triggerEventAutosave();
      refreshAll();
      showToast(`Deleted Column ${colIdx}. Remaining columns: ${doc.meta.grid.cols}`, 'success');
    }

    function removeSelectedRow() {
      if (!state.doc) return;
      const { r: selR } = getCellRowCol(view.selectedGridCellId);
      deleteSpecificRow(selR);
    }

    function removeSelectedCol() {
      if (!state.doc) return;
      const { c: selC } = getCellRowCol(view.selectedGridCellId);
      deleteSpecificCol(selC);
    }
    return {
      setGridZoom,
      fitGridCanvas,
      zoomGridIn,
      zoomGridOut,
      applyGridPan,
      centerGridCanvas,
      getRowMoveUpHit,
      getRowMoveDownHit,
      getRowCardHit,
      getRowDuplicateHit,
      getRowDeleteHit,
      getColDeleteHit,
      confirmAndDeleteRow,
      confirmAndDeleteCol,
      getCellAtGrid,
      getCellRowCol,
      renderGridOverview,
      inferRowTitle,
      getGridCellFromPos,
      addGridRow,
      addGridCol,
      promptAndDuplicateRow,
      moveRow,
      deleteSpecificRow,
      deleteSpecificCol,
      removeSelectedRow,
      removeSelectedCol,
    };
  }
  return { create };
})();
