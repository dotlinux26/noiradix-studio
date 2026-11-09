# NOIRADIX Studio — Marquee Selection & Context Menu Specification

**Document Version:** 1.1
**Status:** Approved & Implemented  
**Date:** 2026-11-06  
**Scope:** Marquee Selection (`V`/`M`), Right-Click Context Menu, Clipboard Operations, Selection Transformations, and Zoom Anchor Lock.

---

## 1. Executive Summary & Design Invariants

In professional pixel art and sprite authoring (Aseprite, Photoshop, Figma), **Selection** is not merely a temporary drag highlight—it is a discrete, persistent bounding region that defines the operative scope for transformations, clipboard operations, fills, deletions, and zoom focus.

### Core Architectural Invariants:
1. **Persistent Marquee:** When the user selects a region using the Selection tool (`V` or `M`), the marquee boundary must remain visible across tool switches and zoom levels until explicitly cleared (`Esc`, click outside, or Deselect).
2. **True Coordinate Addressing:** Selection coordinates `(x, y, w, h)` represent discrete integer pixel coordinates $[0, \text{cellWidth}-1] \times [0, \text{cellHeight}-1]$. They are completely independent of CSS display zoom.
3. **Anchor-Centered Zoom Priority:** When `state.selection` is active, `Alt + Wheel` zoom automatically anchors to the center of the active selection $(x + w/2, y + h/2)$, ensuring the user's region of interest never drifts out of view.
4. **Desktop Right-Click Context Menu:** Right-clicking on the canvas opens a native-feeling context menu providing instant actions: Cut, Copy, Paste, Delete, Fill, Flip H, Flip V, Rotate, Select All, and Deselect.
5. **Non-Destructive Floating Transaction:** Lifting a selection creates an immutable baseline. Preview movement, scaling, rotation, and flipping never enter document history until committed.

---

## 2. Selection Data Model (`editor-state.js`)

The centralized state manages selection and clipboard as follows:

```javascript
// State properties
this.selection = null; 
// When active: { x: number, y: number, w: number, h: number }

this.clipboard = null;
// When copied/cut: { w: number, h: number, pixels: { 'relX,relY': '#RRGGBBAA' } }
```

### Invariants:
- `selection.x` and `selection.y` are clamped to $[0, \text{cellSize.w} - 1]$ and $[0, \text{cellSize.h} - 1]$.
- `selection.w` and `selection.h` are positive integers $\ge 1$.
- `clipboard.pixels` stores relative coordinates $(px - x, py - y)$ so copied patterns can be pasted anywhere.

---

## 3. Visual Rendering & Animated Marching Ants

The selection marquee is rendered on `#cell-overlay`:

1. **Dual-Stroke Marching Ants:**
   - Base solid dark outline: `rgba(0, 0, 0, 0.8)`, width 1.5px.
   - Foreground dashed accent outline: `rgba(255, 255, 255, 0.95)` with dash pattern `[4, 4]`.
   - Guaranteed 100% contrast against pure black, pure white, transparent checkerboard, or colored pixels.
2. **Soft Tinted Scrim:**
   - Semi-transparent fill `rgba(79, 70, 229, 0.16)` tinting the interior of the selected region.
3. **Corner Grips:**
   - Subtle 3px square anchor notches on the four corners indicating transform readiness.

---

## 4. Right-Click Context Menu Actions

Right-clicking on the Cell Editor canvas opens `#studio-context-menu` at cursor position:

| Action | Shortcut | Description |
| :--- | :--- | :--- |
| **Cut** | `Ctrl + X` | Copies selected pixels to `state.clipboard` and erases them from the active cell. Single undo step. |
| **Copy** | `Ctrl + C` | Copies pixels inside selection bounds to `state.clipboard`. |
| **Paste** | `Ctrl + V` | Pastes copied pixels at current selection origin or mouse cursor position. Creates new selection around pasted content. |
| **Delete / Clear** | `Delete` / `Backspace` | Erases all pixels within the active selection. If no selection exists, prompts to clear cell. |
| **Fill with Primary** | — | Sets all pixel coordinates in `(x..x+w-1, y..y+h-1)` to `state.primaryColor`. Single undo step. |
| **Flip Horizontal** | — | Mirrors pixels within selection horizontally: $x' = w - 1 - x$. |
| **Flip Vertical** | — | Mirrors pixels within selection vertically: $y' = h - 1 - y$. |
| **Select All** | `Ctrl + A` | Expands selection to entire cell boundary: $(0, 0, \text{cellW}, \text{cellH})$. |
| **Deselect / Cancel** | `Escape` | Cancels a floating interaction, restores its original pixels, then clears the marquee. |

---

## 5. Keyboard Navigation & Interaction Matrix

- **Marquee Drag:** Click and drag on canvas with `select` tool (`V`/`M`) to define rectangle.
- **Click to Clear:** Clicking on empty canvas without dragging clears the selection.
- **`Enter` Key:** Commits the current floating selection to its preview position as one document mutation.
- **`Escape` Key:** Cancels the current floating selection, restores the exact lift-time pixels, clears the marquee, and hides the context menu. It never deletes artwork or commits the preview.
- **Pointer Cancellation / Window Blur:** During an active move, scale, or rotation gesture, a cancelled pointer or loss of focus follows the same restore path as `Escape`.
- **Active Structural Layer:** Selection-independent tools target the active region; selecting a layer resolves its first editable region, so stale region focus from another layer cannot receive edits.
- **`Alt + Wheel` Zoom:** Automatically locks zoom anchor to selection center $(x + w/2, y + h/2)$ when selection is active.
- **HUD Update:** Bottom status bar and top coordinate badge show:  
  `SELECTION: [X: 2, Y: 4, W: 8, H: 6] (48 px)`
