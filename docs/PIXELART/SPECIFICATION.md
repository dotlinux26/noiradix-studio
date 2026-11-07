# NOIRADIX PixelArt — Functional & UI/UX Specification

**Document ID:** `docs/PIXELART/SPECIFICATION.md`  
**Version:** 1.0.0  
**Date:** 2026-11-08  
**Route:** `/pixelart/`  
**License:** Apache-2.0  

---

## 1. Product Overview

**NOIRADIX PixelArt** is an open-source, client-side, browser-based 2D pixel art editor featuring a live, two-way synchronized PIX2 source code editor.

* **Target Users:** Pixel artists, indie game creators, generative AI researchers, and developers who desire a clean, focused artboard for standalone illustrations with complete programmatic control over sprite coordinates.
* **Core Philosophy:** *Draw visually or write in code — the artboard and source are always one.*

---

## 2. Workspace Layout & User Interface

The workspace follows a responsive split-view architecture:

```
+----------------------------------------------------------------------------------------------------+
|  [Logo] NOIRADIX PixelArt [128x128]  |  New  Open  Save  Export  AI Assistant  |  [Split]  [Theme]  |
+----------------------------------------------------------------------------------------------------+
| Tools   | Canvas Artboard (Center)                         | Live PIX2 Source Code (Right)        |
| [Pencil]|                                                  | @pix2 1.0                            |
| [Eraser]|         +------------------------------+         | @meta                                |
| [Bucket]|         |                              |         |   title: "Sunset Mountain"           |
| [Line]  |         |      /\                      |         | @grid                                |
| [Rect]  |         |     /  \       *             |         |   columns: 1                         |
| [Picker]|         |    /    \     ***            |         |   rows: 1                            |
| [Mirror]|         |   /      \     *             |         |   default_cell: 128x128              |
| [Clear] |         |  /________\                  |         | @cell artwork                        |
|         |         +------------------------------+         |   p 64,32 #ffe66d                    |
| Undo    |                                                  |   line 20,80 64,40 #ff6b8b           |
| Redo    | [Zoom: 8x] [-] [+] [Fit] [Grid] (X: 64, Y: 32)   | @end                                 |
+---------+--------------------------------------------------+--------------------------------------+
| Palette: [Primary] [Secondary] [Swap]  #Hex [RGBA Slider]  | Status: [● Synced] (138 Pixels)      |
| Swatches: [ 1 ][ 2 ][ 3 ][ 4 ][ 5 ][ 6 ][ 7 ][ 8 ] [+]     | Diagnostics: Clean                   |
+----------------------------------------------------------------------------------------------------+
```

### 2.1 Top Navigation Bar
* **Brand Identity:** NOIRADIX logo icon + "NOIRADIX" title with `PixelArt` badge.
* **Return Link:** Quick button returning to NOIRADIX Studio (`../`).
* **Document Info:** Editable artwork title and current dimensions badge (e.g. `128×128 px`).
* **File Operations:**
  * **New Canvas (`Ctrl+N`):** Opens dimension picker modal.
  * **Open File (`Ctrl+O`):** Reads `.pix2` file from disk via File System Access API or file input.
  * **Save / Download (`Ctrl+S`):** Downloads `.pix2` source.
  * **Export PNG:** Opens export modal with integer scale multipliers ($1\times, 2\times, 4\times, 8\times, 16\times, 32\times$).
* **AI Assistant:** Opens AI Prompt Generator & PIX2 Code Injector modal.
* **View Modes:** Split View (50/50), Canvas Only, Code Only.
* **Theme Toggle:** Dark / Light mode with persistence in `localStorage`.

### 2.2 Left Toolbar
* **Pencil (`B`):** Freehand pixel drawing with continuous Bresenham interpolation between cursor samples.
* **Eraser (`E`):** Erases drawn pixels back to transparent.
* **Paint Bucket (`G`):** 4-way contiguous flood fill for closed regions.
* **Line Tool (`L`):** Renders straight lines using normative PIX2 Bresenham rasterization with real-time drag preview.
* **Rectangle Tool (`U`):** Draws rectangular boxes with toggles for Outline or Filled mode.
* **Eyedropper (`I`):** Samples pixel color from canvas into primary color.
* **Symmetry Mirror (`H` / `V`):** Horizontal and vertical mirror drawing for character faces, weapons, and symmetrical icons.
* **Clear Canvas:** Wipes current artboard (with confirmation / undo history).
* **Undo (`Ctrl+Z`) & Redo (`Ctrl+Y` / `Ctrl+Shift+Z`):** 50-level full document state history.

### 2.3 Canvas Artboard
* **Rendering Engine:** HTML5 Canvas with `image-rendering: pixelated; image-rendering: crisp-edges;`.
* **Pixel Grid:** Crisp 1px grid overlay at zoom levels $\ge 4\times$.
* **Viewport Navigation:**
  * Smooth Mouse Wheel Zoom (1x to 64x integer multiples).
  * Center-invariant zoom under mouse cursor.
  * Pan via Middle Mouse button or `Space + Left Drag`.
* **Status Overlay:** Real-time $(X, Y)$ coordinate readout and color under pointer.

### 2.4 Live PIX2 Source Code Editor
* **Editor Features:** High-performance monospace text area with dynamic line numbering.
* **Syntax Validation:**
  * Strict validation against the PIX2 v1.0 standard grammar.
  * Structured diagnostic banner showing line number and exact violation code (e.g. `PIX2_ERR_INVALID_COORD`).
* **Non-Destructive Typing:** The canvas will never blank out when user is in the middle of typing an incomplete directive; canvas updates only when the source forms a valid AST.
* **Direct Primitive Support:** Supports manual entry of `rect`, `line`, `fill`, `sym_dot`, `p`, and `dot`.

### 2.5 Palette & Color Deck
* **Dual Color Slots:** Primary color (Left click) and Secondary color (Right click / Alt). Quick swap via `X` shortcut.
* **Color Controls:** Hex input field (`#RRGGBB` or `#RRGGBBAA`) and visual RGBA sliders.
* **Preset Palettes:**
  * PICO-8 (16 colors)
  * Game Boy Classic (4 shades)
  * Sweetie 16 (Cozy pastel palette)
  * Endesga 32 (Popular game dev standard)
  * Noiradix Cyber (High contrast retro)
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
| `U` | Rectangle Tool |
| `I` | Eyedropper / Color Picker |
| `X` | Swap Primary & Secondary Colors |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo |
| `Ctrl + S` | Save `.pix2` file |
| `Ctrl + O` | Open file |
| `Ctrl + N` | New Canvas |
| `Space + Drag` | Pan canvas |
| `Mouse Wheel` | Zoom in / out (centered on cursor) |

---

## 4. Integration with AI Generation

PixelArt includes a built-in AI assistant interface with templates for prompting Large Language Models:
1. **Character Icon:** Symmetrical humanoid or monster headshot.
2. **Game Asset:** Weapons, potions, chests, and equipment.
3. **Landscape / Scenery:** Pixel art backdrop with mountains, trees, and sky gradients.
4. **Custom Prompt:** Free-form pixel art brief with embedded palette and canvas bounds.
The user copies the prompt, submits it to ChatGPT or Claude, and pastes the returned `.pix2` block directly into the editor for instant rendering.
