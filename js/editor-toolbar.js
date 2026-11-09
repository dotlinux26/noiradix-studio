// Shared drawing and action rail. Each editor binds the same controls to its document adapter.
const EditorToolbar = (() => {
  const markup = `
<button class="pa-tool-btn active" data-tool="pen" title="Pencil (B) — Draw pixels">
        <i class="fa-solid fa-pencil"></i>
      </button>
      <button class="pa-tool-btn" data-tool="eraser" title="Eraser (E) — Erase pixels">
        <i class="fa-solid fa-eraser"></i>
      </button>



      <button class="pa-tool-btn" data-tool="bucket" title="Paint Bucket (G) — 4-way flood fill">
        <i class="fa-solid fa-fill-drip"></i>
      </button>
      <button class="pa-tool-btn" data-tool="line" title="Line Tool (L) — Bresenham straight line">
        <i class="fa-solid fa-slash"></i>
      </button>
      <button class="pa-tool-btn" data-tool="rect" title="Rectangle Outline Tool (U) [Hold Shift for 1:1 Square, Alt for Center]">
        <i class="fa-regular fa-square"></i>
      </button>
      <button class="pa-tool-btn" data-tool="rect-fill" title="Filled Rectangle Tool (Shift+U) [Hold Shift for 1:1 Square, Alt for Center]">
        <i class="fa-solid fa-square"></i>
      </button>
      <button class="pa-tool-btn" data-tool="circle" title="Circle / Ellipse Outline Tool (C) [Hold Shift for 1:1 Circle, Alt for Center]">
        <i class="fa-regular fa-circle"></i>
      </button>
      <button class="pa-tool-btn" data-tool="circle-fill" title="Filled Circle / Ellipse Tool (Shift+C) [Hold Shift for 1:1 Circle, Alt for Center]">
        <i class="fa-solid fa-circle"></i>
      </button>
      <button class="pa-tool-btn" data-tool="select" title="Selection Marquee (V or M) — Drag to move selection">
        <i class="fa-solid fa-crop-simple"></i>
      </button>
      <button class="pa-tool-btn" data-tool="region-select" id="btn-pa-tool-region-select" title="Region Select (R) · Double-click to isolate · Alt+double-click to cycle overlapping regions">
        <i class="fa-solid fa-vector-square"></i>
      </button>
      <button type="button" class="pa-tool-btn" id="btn-group-regions" aria-label="Group" title="Group selected regions (Ctrl/Cmd-click to add)">
        <i class="fa-solid fa-folder-tree" aria-hidden="true"></i>
      </button>
      <button type="button" class="pa-tool-btn" id="btn-ungroup-regions" aria-label="Ungroup" title="Ungroup selected group">
        <i class="fa-solid fa-object-ungroup" aria-hidden="true"></i>
      </button>
      <button class="pa-tool-btn" data-tool="picker" title="Eyedropper (I) — Sample color">
        <i class="fa-solid fa-eye-dropper"></i>
      </button>
      <button class="pa-tool-btn" data-tool="pan" title="Hand / Pan Tool (H or Space+Drag)">
        <i class="fa-solid fa-hand"></i>
      </button>

      <div class="pa-tool-sep"></div>

      <!-- Symmetry Toggles (Custom Visual Mirror Axis SVGs) -->
      <button id="btn-toggle-sym-h" class="pa-tool-btn" title="Horizontal Symmetry Guide (Shift+H) [Mirror Left ↔ Right across vertical center]">
        <svg class="pa-sym-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="3 3"/>
          <circle cx="6" cy="12" r="3" fill="currentColor"/>
          <circle cx="18" cy="12" r="3" fill="currentColor"/>
        </svg>
      </button>
      <button id="btn-toggle-sym-v" class="pa-tool-btn" title="Vertical Symmetry Guide (Shift+V) [Mirror Top ↕ Bottom across horizontal center]">
        <svg class="pa-sym-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="3 3"/>
          <circle cx="12" cy="6" r="3" fill="currentColor"/>
          <circle cx="12" cy="18" r="3" fill="currentColor"/>
        </svg>
      </button>

      <div class="pa-tool-sep"></div>

      <!-- Transform Tools (Selection or Full Canvas) -->
      <button id="btn-rotate-90" class="pa-tool-btn" title="Rotate 90° Clockwise [Selection or Canvas]">
        <svg class="pa-tool-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.7L21 8"/>
          <polyline points="21 3 21 8 16 8"/>
          <text x="12" y="15.5" font-size="7.5" font-weight="900" fill="currentColor" stroke="none" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif">90°</text>
        </svg>
      </button>
      <button id="btn-flip-h" class="pa-tool-btn" title="Flip Horizontal (Mirror X) [Selection or Canvas]">
        <i class="fa-solid fa-arrows-left-right"></i>
      </button>
      <button id="btn-flip-v" class="pa-tool-btn" title="Flip Vertical (Mirror Y) [Selection or Canvas]">
        <i class="fa-solid fa-arrows-up-down"></i>
      </button>

      <div class="pa-tool-sep"></div>

      <!-- Align Tools -->
      <button id="btn-align-center" class="pa-tool-btn" title="Align Center (Both Axes)">
        <i class="fa-solid fa-crosshairs"></i>
      </button>
      <button id="btn-align-left" class="pa-tool-btn" title="Align Left (Snap to Left Canvas Edge)">
        <i class="fa-solid fa-arrows-up-to-line editor-align-side editor-align-left"></i>
      </button>
      <button id="btn-align-right" class="pa-tool-btn" title="Align Right (Snap to Right Canvas Edge)">
        <i class="fa-solid fa-arrows-up-to-line editor-align-side editor-align-right"></i>
      </button>
      <button id="btn-align-top" class="pa-tool-btn" title="Align Top (Snap to Top Canvas Edge)">
        <i class="fa-solid fa-arrows-up-to-line"></i>
      </button>
      <button id="btn-align-bottom" class="pa-tool-btn" title="Align Bottom (Snap to Bottom Canvas Edge)">
        <i class="fa-solid fa-arrows-down-to-line"></i>
      </button>

      <div class="pa-tool-sep"></div>

      <!-- History & Clear -->
      <button id="btn-undo" class="pa-tool-btn" title="Undo (Ctrl+Z)">
        <i class="fa-solid fa-arrow-rotate-left"></i>
      </button>
      <button id="btn-redo" class="pa-tool-btn" title="Redo (Ctrl+Y)">
        <i class="fa-solid fa-arrow-rotate-right"></i>
      </button>
      <button id="btn-clear-canvas" class="pa-tool-btn pa-tool-danger" title="Clear Canvas">
        <i class="fa-solid fa-trash-can"></i>
      </button>
  `;

  function mount(container, studio = false) {
    container.innerHTML = markup;
    if (!studio) return;
    container.querySelector('#btn-pa-tool-region-select').id = 'btn-tool-region-select';
    container.querySelector('#btn-toggle-sym-h').id = 'btn-symmetry-toggle';
    container.querySelector('#btn-clear-canvas').id = 'btn-clear-cell';
    for (const button of container.querySelectorAll('button')) button.classList.add('tool-btn');
  }
  return { mount };
})();
