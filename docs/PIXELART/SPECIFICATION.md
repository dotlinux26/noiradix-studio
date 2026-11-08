# NOIRADIX PixelArt — Functional & UI/UX Specification

**Document ID:** `docs/PIXELART/SPECIFICATION.md`  
**Version:** 1.3.0  
**Date:** 2026-11-08  
**Route:** `/pixelart/`  
**License:** Apache-2.0  

---

## 1. Product Overview

**NOIRADIX PixelArt** is an open-source, client-side, browser-based 2D pixel art editor featuring a live, two-way synchronized PIX2 source code editor.

* **Target Users:** Pixel artists, indie game creators, generative AI researchers, and developers who desire a clean, focused artboard for standalone illustrations with complete programmatic control over sprite coordinates.
* **Core Philosophy:** *Canvas là Vua, Code là Đầy Tớ* — Artists draw visually on the canvas; the human-readable `.pix2` code pane serves as an instantaneous interchange layer for copying/sharing projects in text, interfacing with generative AI, and inspecting pixel geometry.

---

## 2. Workspace Layout & User Interface

The workspace follows a responsive split-view architecture:

```
+----------------------------------------------------------------------------------------------------+
|  [Logo] NOIRADIX PixelArt [128x128]  |  New  Open  Save  Export  AI Assistant  |  [Split]  [Theme]  |
+----------------------------------------------------------------------------------------------------+
| Tools   | Canvas Artboard (Center)            |  Split  | Live PIX2 Source Code (Right)            |
| [Pencil]|                                     | Resizer | @pix2 1.0                                |
| [Eraser]|         +-------------------------+ | <=====> | @meta                                    |
| [Bucket]|         |                         | |         |   title: "Sunset Mountain"               |
| [Line]  |         |      /\                 | |         | @grid                                    |
| [Rect]  |         |     /  \       *        | |         |   columns: 1                             |
| [Fill-R]|         |    /    \     ***       | |         |   rows: 1                                |
| [Circle]|         |   /      \     *        | |         |   default_cell: 128x128                  |
| [Fill-C]|         |  /________\             | |         | @cell artwork                            |
| [Select]|         +-------------------------+ |         |   p 64,32 #ffe66d                        |
| [Picker]|                                     |         |   line 20,80 64,40 #ff6b8b               |
| [Pan]   |                                     |         | @end                                     |
| [Sym-H] |                                     |         |                                          |
| [Sym-V] |                                     |         |                                          |
| [Rotate]|                                     |         |                                          |
| [Flip-H]|                                     |         |                                          |
| [Flip-V]|                                     |         |                                          |
| [Align] |                                     |         | Status: [● Synced] (138 Pixels)          |
| Undo    | [Zoom: 12x] [-] [+] [Fit] [1x] (X,Y) |         | Diagnostics: Standard v1.0 Clean         |
+---------+-------------------------------------+---------+------------------------------------------+
| Palette: [Primary] [Secondary] [Swap]  #Hex [RGBA Slider]  | Status: [● Synced] (138 Pixels)      |
| Swatches: [ 1 ][ 2 ][ 3 ][ 4 ][ 5 ][ 6 ][ 7 ][ 8 ] [+]     | Diagnostics: Clean                   |
+----------------------------------------------------------------------------------------------------+
```

### 2.1 Top Navigation Bar
* **Brand Identity:** NOIRADIX logo icon + "NOIRADIX" title with `PixelArt` badge.
* **Return Link:** Quick button returning to NOIRADIX Studio (`../`).
* **Document Info:** Editable artwork title and current dimensions badge (e.g. `128×128 px`).
* **File Operations:**
  * **New Canvas (`Ctrl+N`):** Opens dimension picker modal with presets up to $1024 \times 1024$.
  * **Open File (`Ctrl+O`):** Reads `.pix2` file from disk via File System Access API or file input.
  * **Save / Download (`Ctrl+S`):** Downloads `.pix2` source.
  * **Export PNG:** Opens export modal with integer scale multipliers ($1\times, 2\times, 4\times, 8\times, 16\times, 32\times$).
* **AI Assistant:** Opens AI Prompt Generator & PIX2 Code Injector modal.
* **View Modes:** Split View (Dual Pane), Canvas Only, Code Only.
* **Theme Toggle:** Dark / Light mode with persistence in `localStorage`.
* **Universal Horizontal Drag-Scroll:** Protected with `flex-shrink: 0; white-space: nowrap;` and smooth mouse-wheel + background drag scrolling.

### 2.2 Left Toolbar & Feature Set
* **Pencil (`B`):** Freehand pixel drawing with continuous Bresenham interpolation between cursor samples.
* **Eraser (`E`):** Erases drawn pixels back to transparent.
* **Paint Bucket (`G`):** 4-way contiguous flood fill for closed regions.
* **Line Tool (`L`):** Renders straight lines using normative PIX2 Bresenham rasterization with real-time drag preview.
* **Rectangle Outline Tool (`U`):** Draws rectangular outlines (`<i class="fa-regular fa-square"></i>`). Holds `Shift` for 1:1 square, `Alt` to expand from center point outward.
* **Filled Rectangle Tool (`Shift+U`):** Draws filled rectangles using the standard solid square icon (`<i class="fa-solid fa-square"></i>`). Supports `Shift` and `Alt`.
* **Circle / Ellipse Outline Tool (`C`):** Integer Bresenham midpoint ellipse contour (`<i class="fa-regular fa-circle"></i>`). Holds `Shift` for 1:1 perfect circle, `Alt` to expand from center outward.
* **Filled Circle / Ellipse Tool (`Shift+C`):** Solid filled circle (`<i class="fa-solid fa-circle"></i>`). Supports `Shift` and `Alt`.
* **Selection Marquee Tool (`M` / `V`):**
  * Drag to select rectangular area with animated dashed marquee.
  * **Interactive Move/Drag:** Clicking inside active selection picks up pixels into a floating buffer, allowing smooth live drag-and-drop.
  * **Copy (`Ctrl+C`):** Copies selected pixels to clipboard.
  * **Cut (`Ctrl+X`):** Copies and clears selected region.
  * **Paste (`Ctrl+V`):** Pastes clipboard content at selection origin.
  * **Delete (`Delete` / `Backspace`):** Clears all pixels in selection.
  * **Fill Selection (`F`):** Fills all pixels in selection with active color.
* **Eyedropper (`I`):** Samples pixel color from canvas into primary color.
* **Hand / Pan Tool (`P` / `Space + Drag`):** Drags the canvas view freely across the viewport.
* **Bilateral Symmetry Guides (`H` / `Shift+H`):**
  * Horizontal Symmetry (Left ↔ Right): Dedicated SVG icon with vertical dashed mirror axis.
  * Vertical Symmetry (Top ↕ Bottom): Dedicated SVG icon with horizontal dashed mirror axis.
* **Geometric Transformation Engine:**
  * **Rotate 90° Clockwise (`R`):** Rotates selection if active, otherwise whole canvas.
  * **Flip Horizontal:** Mirrors selection if active across its midline, otherwise mirrors whole canvas.
  * **Flip Vertical:** Mirrors selection if active across its midline, otherwise mirrors whole canvas.
  * **Multi-Axis Alignment Suite:**
    * **Align Center (`fa-crosshairs`):** Centers content on both X & Y axes.
    * **Align Left (`fa-align-left`):** Snaps content to left canvas edge.
    * **Align Right (`fa-align-right`):** Snaps content to right canvas edge.
    * **Align Top (`fa-arrows-up-to-line`):** Snaps content to top canvas edge.
    * **Align Bottom (`fa-arrows-down-to-line`):** Snaps content to bottom canvas edge.
  * **Nudge Pixels (Arrow Keys):** Moves active selection or canvas pixels 1px up, down, left, or right.
* **Undo (`Ctrl+Z`) & Redo (`Ctrl+Y` / `Ctrl+Shift+Z`):** 50-level full document state history.
* **Clear Canvas:** Wipes current artboard with confirmation and history snapshot.
* **Vertical Drag-Scroll:** The toolbar supports smooth vertical scrolling on short screens (`enableVerticalDragScroll`).

### 2.3 Canvas Artboard & High-Precision Grid
* **Pixel-Aligned Checkerboard:** Rendered directly onto `dom.ctxMain`. At `zoom >= 4`, each checker tile is **EXACTLY** 1 artwork pixel (`zoom × zoom` screen px), eliminating all visual vibration/eye strain.
* **Razor-Sharp Normative Grid:** Grid lines are rendered directly onto the canvas with half-pixel $(+0.5\text{px})$ offset at zoom levels $\ge 4\times$, perfectly separating pixel boundaries.
* **Analytical Invariant Cursor Zoom:** Smooth mouse wheel zoom (1x to 64x integer multiples) mathematically invariant under the cursor position.
* **Status Readout:** Real-time $(X, Y)$ coordinate readout and color under cursor.

### 2.4 Draggable Split Pane Resizer
* A dedicated horizontal resize bar (`#pa-split-resizer`) sits between the canvas pane and code pane.
* Drag horizontally to resize the code pane width (clamped between 200px and `window.innerWidth - 300px`).
* User's preferred width is automatically persisted in `localStorage`.

### 2.5 Live PIX2 Source Code Editor
* **Editor Features:** High-performance monospace text area with dynamic line numbering.
* **On-Pointer-Up Sync Policy:** Code only updates when a stroke is completed (`pointerup`), keeping drawing at a locked 60fps even on $1024 \times 1024$ canvases.
* **Non-Destructive Error Handling:** When users type incomplete code, canvas remains untouched and a diagnostic banner reports the error.
* **Direct Primitive Support:** Supports manual entry of `rect`, `line`, `fill`, `sym_dot`, `p`, and `dot`.

### 2.6 Palette & Color Deck
* **Dual Color Slots:** Primary color (Left click) and Secondary color (Right click / Alt). Quick swap via `X` shortcut.
* **Color Controls:** Hex input field (`#RRGGBB` or `#RRGGBBAA`) and visual RGBA sliders.
* **Preset Palettes:** PICO-8 (16), Game Boy Classic (4), Sweetie 16, Endesga 32, Noiradix Cyber (8).
* **Custom Swatches:** Click swatch to select; right-click swatch to replace with current color; click `+` to append new color.
* **Auto-Synchronization:** Swatches automatically serialize into the `@palette` section of the `.pix2` document.
* **Universal Horizontal Drag-Scroll:** Smooth drag and wheel scrolling across colors and palette presets.

---

## 3. Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| `B` | Pencil Tool |
| `E` | Eraser Tool |
| `G` | Flood Fill Tool |
| `L` | Line Tool |
| `U` | Rectangle Outline Tool |
| `Shift + U` | Filled Rectangle Tool |
| `C` | Circle / Ellipse Outline Tool |
| `Shift + C` | Filled Circle / Ellipse Tool |
| `Hold Shift` | Constrain 1:1 Aspect Ratio (Square / Circle) |
| `Hold Alt` | Expand Shape from Center Point Outward |
| `M` / `V` | Selection Marquee Tool (Drag inside to move) |
| `I` | Eyedropper / Color Picker |
| `P` | Hand / Pan Tool (or hold `Space`) |
| `X` | Swap Primary & Secondary Colors |
| `H` / `Shift + H` | Horizontal / Vertical Bilateral Symmetry |
| `R` | Rotate 90° Clockwise (Selection or Canvas) |
| `Arrows` | Nudge Pixels / Selection (1px Offset) |
| `Ctrl + C` / `Ctrl + V` | Copy / Paste Selection |
| `Ctrl + X` | Cut Selection |
| `Delete` / `Backspace` | Clear Selection / Delete Floating Pixels |
| `F` | Fill Selection with Primary Color |
| `Enter` | Commit Floating Selection |
| `Escape` | Cancel / Commit Selection |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo |
| `Ctrl + S` | Save `.pix2` file |
| `Ctrl + O` | Open file |
| `Ctrl + N` | New Canvas |
| `Mouse Wheel` | Invariant Cursor-Centered Zoom |

---

## 4. Canvas Dimension Presets (1 to 1024 px)

* $16 \times 16$ — Micro sprite
* $24 \times 24$ — Classic RPG icon
* $32 \times 32$ — Standard character portrait
* $48 \times 48$ — Isometric asset
* $64 \times 64$ — Detailed avatar / mob
* $128 \times 128$ — Large artwork / illustration
* $192 \times 108$ — 16:9 Widescreen landscape
* $256 \times 256$ — Complex game backdrop
* $320 \times 180$ — Full 16:9 indie start screen
* $512 \times 512$ — Hi-bit master artwork
* $1024 \times 1024$ — Epic grand landscape / maximum hardware sweet spot

---

## 5. User-Configurable Canvas Background Modes

To ensure optimal contrast and eye comfort across different art styles (e.g. bright characters, dark silhouettes, game assets), the canvas background style is fully configurable via the Statusbar selector:

| Mode | Visual Presentation | Grid Line Adaptation | PIX2 Source Directives | Persistence Key |
| :--- | :--- | :--- | :--- | :--- |
| **`transparent`** (Default) | 1:1 Pixel-Aligned Checkerboard | Theme adaptive (`rgba(0,0,0,0.12)` or `rgba(255,255,255,0.12)`) | `@grid` $\to$ `background: none` | `pix2_canvas_bg_mode = "transparent"` |
| **`white`** | Solid Pure White (`#ffffff`) | High-contrast subtle dark grid (`rgba(0,0,0,0.12)`) | `@grid` $\to$ `background: #ffffff` | `pix2_canvas_bg_mode = "white"` |
| **`black`** | Solid Pure Black (`#000000`) | High-contrast subtle light grid (`rgba(255,255,255,0.15)`) | `@grid` $\to$ `background: #000000` | `pix2_canvas_bg_mode = "black"` |
| **`custom`** | User-selected Custom Hex Color | Dynamic YIQ luminance adaptive grid | `@grid` $\to$ `background: #<hex>` | `pix2_canvas_bg_mode = "custom"`, `pix2_canvas_bg_color = "#hex"` |

### 5.1 Bi-Directional Source Code Synchronization
* Setting a background mode automatically synchronizes the `@grid background:` property in the `.pix2` source editor.
* Editing or typing `background: none | #ffffff | #000000 | #hex` in the code editor immediately updates the visual canvas background mode and activates the matching UI button.

### 5.2 PNG Exporter Integration
* **Pure Alpha Export (Default):** Generates transparent RGBA `.png` files suitable for game engines and sprite workflows.
* **Canvas Background Option:** A dedicated checkbox in the PNG Export modal allows baking the chosen solid white, solid black, or custom background color directly into the final raster image.

