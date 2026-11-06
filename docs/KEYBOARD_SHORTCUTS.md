# NOIRADIX Studio — Master Keyboard Shortcuts Matrix

This matrix documents all keyboard shortcuts implemented in NOIRADIX Studio across views and platforms (Windows / macOS / Linux).

---

## 🎨 1. Cell Editor & Drawing Tools

Single-key tool shortcuts are active in the Cell Editor whenever text inputs or textareas are not focused.

| Shortcut | Tool / Action | Description |
| :--- | :--- | :--- |
| <kbd>B</kbd> / <kbd>P</kbd> | **Pencil (Pen)** | Discrete pixel placement tool. |
| <kbd>E</kbd> | **Eraser** | Erases pixels by removing coordinate entries. |
| <kbd>I</kbd> | **Eyedropper (Picker)** | Samples the color under the cursor into Primary Color. |
| <kbd>G</kbd> | **Paint Bucket** | 4-way discrete flood fill. |
| <kbd>L</kbd> | **Line Tool** | Bresenham discrete line rasterizer. |
| <kbd>U</kbd> / <kbd>R</kbd> | **Rectangle Tool** | Discrete rectangular bounding box tool. |
| <kbd>M</kbd> / <kbd>V</kbd> | **Marquee Selection** | Rectangular marquee selection and floating transform. |
| <kbd>H</kbd> | **Hand (Pan) Tool** | Activates viewport panning tool without needing to hold Space. |
| <kbd>S</kbd> | **Toggle Symmetry Axis** | Toggles bilateral vertical symmetry mirror line (`sym_dot`). |
| <kbd>X</kbd> | **Swap Colors** | Swaps Primary and Secondary colors. |
| <kbd>D</kbd> | **Default Colors** | Resets Primary (`#57546f`) and Secondary (`#ffffff`) to defaults. |
| <kbd>Space</kbd> + Drag | **Smooth Pan** | Pans the active canvas viewport smoothly in any direction. |
| <kbd>Ctrl</kbd> + Mouse Wheel | **Anchor Zoom** | High-precision anchor-centered zoom (`4×` to `64×`). |
| <kbd>Arrow Keys</kbd> | **Nudge Frame** | Nudges all pixels in the active cell by 1px (Up, Down, Left, Right). |

---

## 📁 2. File & Document Operations

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>N</kbd> | Global | Opens the **New File Modal** with file naming and layout presets. |
| <kbd>Ctrl</kbd> + <kbd>O</kbd> | Global | Opens a `.pix2` file from disk via File System Access API. |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Global | Saves directly to the disk file (Chromium) or downloads (Fallback). |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | Global | **Save As** dialog to commit document under a new file path. |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> | Global | Manually forces a **Live Reload** of the active file from disk. |

---

## 🔄 3. Edit & Clipboard Operations

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Global | **Undo** last stroke, tool mutation, or layout adjustment. |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Global | **Redo** previously undone action. |
| <kbd>Ctrl</kbd> + <kbd>C</kbd> | Cell Editor / Grid | Copies floating selection pixels or entire focused grid cell. |
| <kbd>Ctrl</kbd> + <kbd>X</kbd> | Cell Editor / Grid | Cuts floating selection or grid cell. |
| <kbd>Ctrl</kbd> + <kbd>V</kbd> | Cell Editor / Grid | Pastes copied selection or grid cell into active target. |
| <kbd>Ctrl</kbd> + <kbd>A</kbd> | Cell Editor | Selects all pixels within active cell bounds. |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> / <kbd>Esc</kbd> | Cell Editor | Deselects active marquee selection and commits floating buffer. |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Cell Editor / Grid | Clears pixels in selection or clears entire selected cell. |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | Viewports | Resets zoom level and re-centers canvas (Grid, Studio, or Editor). |

---

## 🎬 4. Animation & Navigation

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| <kbd>Space</kbd> | Grid Overview | Toggles the floating **Animation Studio** preview window. |
| <kbd>Esc</kbd> | Cell Editor | Closes the active cell tab and returns to the Sprite Sheet Overview. |
| <kbd>Enter</kbd> | Grid Overview | Opens the currently focused cell for pixel editing. |
| Drag & Drop | Global | Drops external `.pix2` file to load or `.png` to open Slicer. |

*(Note: On macOS, substitute <kbd>Cmd</kbd> for <kbd>Ctrl</kbd>).*
