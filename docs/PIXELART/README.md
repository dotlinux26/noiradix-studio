# NOIRADIX PixelArt

Welcome to **NOIRADIX PixelArt** — the dedicated, standalone 2D pixel art painting studio and live bi-directional PIX2 source code editor.

Live Studio: [https://noiradix.me/pixelart/](https://noiradix.me/pixelart/)  
Local Entry: [`pixelart/index.html`](../../pixelart/index.html)

---

## 🎨 Why NOIRADIX PixelArt?

While [**NOIRADIX Studio**](../../README.md) is specialized for spritesheet animation, directional locomotion rows, and 1-click Unity 2D pipeline exports, **NOIRADIX PixelArt** is dedicated to:
* **Single Canvas Artwork:** Pure 2D pixel art illustrations, backgrounds, icons, and textures without timeline or animation overhead.
* **Flexible Sizing:** Choose any canvas dimension from 16×16 up to 512×512 (and custom sizes up to 1024×1024).
* **Live Bi-Directional PIX2 Code Editor:** Draw on the artboard and watch the structured `.pix2` source code generate in real time; or edit the code directly and watch the canvas artwork update instantly.
* **Safe View Only Mode with Auto-Lock on Apply:** Accidental typing or deletion is blocked by default; click **`[ Edit ]`** to modify code, and clicking **`[ Apply ]`** updates the canvas and automatically locks the editor back to View Only in one seamless click.
* **Free Multi-Angle Selection Rotation Handle:** Rotate any selection freely around its center with a dedicated stem knob, live degree readout, Shift 15° snapping, and tight bounding-box cropping that prevents box ballooning.
* **Zero-Data-Loss Native File System Persistence:** Save directly to disk files via the File System Access API (`Ctrl+S`). Page reloads (<kbd>F5</kbd>) automatically restore the active file from IndexedDB handles or cached disk content without losing a single stroke.
* **AI-Native Workflow:** AI models can directly emit structured `.pix2` code to paint crisp pixel art with zero diffusion blur.

---

## 🛠️ Key Capabilities & Features

### 1. Drawing Toolset & Geometry
* **Pencil (`B`):** Freehand pixel drawing with continuous Bresenham interpolation.
* **Eraser (`E`):** Erases drawn pixels back to transparent.
* **Paint Bucket (`G`):** 4-way contiguous flood fill.
* **Line Tool (`L`):** Normative Bresenham line rasterization with live drag preview.
* **Rectangle Outline (`U`) & Filled Rectangle (`Shift+U`):** Hold `Shift` for 1:1 square, `Alt` for center expansion.
* **Circle / Ellipse Outline (`C`) & Filled Circle (`Shift+C`):** Midpoint ellipse rasterization. Hold `Shift` for circle, `Alt` for center expansion.
* **Eyedropper (`I`):** Samples pixel color into primary slot.
* **Hand / Pan (`H` or hold `Space`):** Drags viewport freely.

### 2. Selection & Multi-Angle Rotation
* **Selection Marquee (`V` / `M`):** Single-pixel to multi-cell rectangular marquee. Drag inside to move floating pixels.
* **Clockwise 90° Rotation (`R`):** Swaps $W \leftrightarrow H$ dimensions instantaneously for active selection or full canvas.
* **Free Multi-Angle Rotation Handle:**
  * Circular pivot handle and stem located above the selection top-center.
  * Hover displays `grab` cursor; dragging turns to `grabbing` and rotates pixels in real-time (60 FPS).
  * Shows dynamic degree counter (e.g. `45°`, `90°`) directly above the knob.
  * Hold <kbd>Shift</kbd> to snap rotation to 15° increments.
  * **Tight Non-Empty Bounding Box Crop:** On release, rotated pixels are resampled via inverse nearest-neighbor and cropped tightly to the actual drawn pixels, preventing bounding-box inflation across repeated rotations.
* **Selection Clipboard:** Cut (`Ctrl+X`), Copy (`Ctrl+C`), Paste (`Ctrl+V`), Fill (`F`), Clear (`Del` / `Backspace`), Nudge (Arrow keys).

### 3. Symmetry & Alignment Guides
* **Bilateral Symmetry (`S`):** Toggles bilateral mirror mode.
* **Horizontal Symmetry (`Shift+H`):** Mirrors strokes across vertical center axis.
* **Vertical Symmetry (`Shift+V`):** Mirrors strokes across horizontal center axis.
* **Alignment Guides:** Center Crosshairs (`Center`), Vertical Guide (`V-Guide`), Horizontal Guide (`H-Guide`).

### 4. Live PIX2 Code Editor & Dual Sync
* **Safe View Only Mode (Default):** Code pane is read-only to prevent accidental backspacing or lost code.
* **Auto-Lock on Apply:** Clicking **`[ Edit ]`** unlocks the textarea; clicking **`[ Apply ]`** validates the AST, renders pixels onto the canvas, and automatically locks back to View Only.
* **AST Validation & Diagnostics:** Syntax errors are highlighted non-destructively in the status bar without overwriting the canvas.

### 5. High-Performance Canvas & Custom Backgrounds
* **Cached Checkerboard Pattern:** Offscreen 2×2 tile pattern eliminates 262,144 loop iterations on 512×512 canvases.
* **Configurable Backgrounds:** Transparent Checker, Pure White (`#ffffff`), Pure Black (`#000000`), or Custom Hex Color with automatic YIQ grid luminance adaptation.

### 6. AI Prompt Studio
* Integrated generator producing complete normative PIX2 specification prompts with custom dimensions and aspect ratio presets (1:1, 4:3, 16:9, 9:16) for LLMs (Claude, GPT-4o, Gemini).

---

## 📚 Documentation Tour

* **[Functional & UI/UX Specification](SPECIFICATION.md):** Complete specifications of workspace layout, drawing toolset, keyboard shortcuts, background modes, palette manager, and selection system.
* **[System Architecture & Code Reuse Plan](ARCHITECTURE_AND_REUSE_PLAN.md):** Detailed technical blueprint explaining how PixelArt reuses the core PIX2 reference engine (`js/pix2-format.js`) and algorithm suite (`js/tools.js`), state synchronization, and resource boundaries.
* **[NOIRADIX Studio Main Readme](../../README.md):** Overview of the parent spritesheet animation suite and Unity 2D pipeline.
* **[PIX2 Language Specification](../../PIX2_SPECIFICATION.md):** The normative specification for the `.pix2` semantic text standard.

---

## 🚀 Quickstart

1. Open `pixelart/index.html` in any modern web browser (or visit [https://noiradix.me/pixelart/](https://noiradix.me/pixelart/)).
2. Select your canvas size (e.g. 64×64 or 128×128).
3. Draw freely with the Pencil, Line, Rectangle, Fill bucket, or Symmetry mirrors.
4. Watch the PIX2 source code update live on the right pane!
5. Export as a crisp `.png` (at 1x to 32x integer scale) or save directly to a native `.pix2` file (`Ctrl+S`).

