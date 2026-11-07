# NOIRADIX PixelArt — Functional & UI/UX Specification

**Document ID:** `docs/PIXELART/SPECIFICATION.md`  
**Version:** 1.1.0  
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
| [Select]|         |   /      \     *        | |         |   default_cell: 128x128                  |
| [Picker]|         |  /________\             | |         | @cell artwork                            |
| [Pan]   |         +-------------------------+ |         |   p 64,32 #ffe66d                        |
| [Mirror]|                                     |         |   line 20,80 64,40 #ff6b8b               |
| [Rotate]|                                     |         | @end                                     |
| [Center]|                                     |         |                                          |
| Undo    |                                     |         |                                          |
| Redo    | [Zoom: 12x] [-] [+] [Fit] (X:64 Y:32|         | Status: [● Synced] (138 Pixels)          |
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

### 2.2 Left Toolbar & Feature Parity with Studio
* **Pencil (`B`):** Freehand pixel drawing with continuous Bresenham interpolation between cursor samples.
* **Eraser (`E`):** Erases drawn pixels back to transparent.
* **Paint Bucket (`G`):** 4-way contiguous flood fill for closed regions.
* **Line Tool (`L`):** Renders straight lines using normative PIX2 Bresenham rasterization with real-time drag preview.
* **Rectangle Outline Tool (`U`):** Draws rectangular outlines (`<i class="fa-regular fa-square"></i>`).
* **Filled Rectangle Tool (`Shift+U`):** Draws filled rectangles using the standard solid square icon (`<i class="fa-solid fa-square"></i>`).
* **Selection Marquee Tool (`M` / `V`):**
  * Drag to select rectangular area with animated dashed marquee.
  * **Copy (`Ctrl+C`):** Copies selected pixels to clipboard.
  * **Cut (`Ctrl+X`):** Copies and clears selected region.
  * **Paste (`Ctrl+V`):** Pastes clipboard content at selection origin.
  * **Delete (`Delete` / `Backspace`):** Clears all pixels in selection.
  * **Fill Selection (`F`):** Fills all pixels in selection with active color.
* **Eyedropper (`I`):** Samples pixel color from canvas into primary color.
* **Hand / Pan Tool (`P` / `Space + Drag`):** Drags the canvas view freely across the viewport.
* **Bilateral Symmetry Mirror (`H` / `V`):** Horizontal and vertical mirror drawing with purple dashed axis guidelines.
* **Transform Operations:**
  * **Rotate 90° Clockwise:** Rotates cell pixels $90^\circ$ around the canvas center.
  * **Flip Horizontal:** Mirrors the entire artwork across the vertical center line.
  * **Align Center:** Bounding-box aligns all drawn content to the exact center of the canvas.
  * **Nudge Pixels (Arrow Keys):** Moves all pixels 1px up, down, left, or right.
* **Undo (`Ctrl+Z`) & Redo (`Ctrl+Y` / `Ctrl+Shift+Z`):** 50-level full document state history.
* **Clear Canvas:** Wipes current artboard with confirmation and history snapshot.

### 2.3 Canvas Artboard & High-Precision Grid
* **Integer Resolution Matrix:** The HTML5 Canvas width and height are scaled to `w * zoom` and `h * zoom`. Pixels are drawn as `zoom × zoom` integer blocks, completely eliminating CSS subpixel floating-point drift.
* **Razor-Sharp Normative Grid:** Grid lines are rendered directly onto the canvas with half-pixel $(+0.5\text{px})$ offset at zoom levels $\ge 8\times$, perfectly separating pixel boundaries.
* **Viewport Navigation:** Smooth mouse wheel zoom (1x to 64x integer multiples) centered on cursor, and panning with middle click or Hand tool.
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
| `M` / `V` | Selection Marquee Tool |
| `I` | Eyedropper / Color Picker |
| `P` | Hand / Pan Tool |
| `X` | Swap Primary & Secondary Colors |
| `H` / `V` | Horizontal / Vertical Symmetry Mirror |
| `Arrows` | Nudge Pixels (1px Offset) |
| `Ctrl + C` / `Ctrl + V` | Copy / Paste Selection |
| `Ctrl + X` | Cut Selection |
| `Delete` / `Backspace` | Clear Selection |
| `F` | Fill Selection with Primary Color |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo |
| `Ctrl + S` | Save `.pix2` file |
| `Ctrl + O` | Open file |
| `Ctrl + N` | New Canvas |
| `Space + Drag` | Pan canvas |
| `Mouse Wheel` | Zoom in / out (centered on cursor) |

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
