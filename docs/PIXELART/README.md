# NOIRADIX PixelArt

Welcome to **NOIRADIX PixelArt** — the dedicated, standalone 2D pixel art painting studio and live bi-directional PIX2 source code editor.

NOIRADIX PixelArt lives at `https://noiradix.me/pixelart/` (and locally at `pixelart/index.html`).

---

## 🎨 Why NOIRADIX PixelArt?

While [NOIRADIX Studio](../../README.md) is specialized for spritesheet animation, directional locomotion rows, and 1-click Unity 2D pipeline exports, **NOIRADIX PixelArt** is dedicated to:
* **Single Canvas Artwork:** Pure 2D pixel art illustrations, backgrounds, icons, and textures without timeline or animation overhead.
* **Flexible Sizing:** Choose any canvas dimension from 16×16 up to 512×512 pixels.
* **Live Bi-Directional PIX2 Code Editor:** Draw on the artboard and watch the structured `.pix2` source code generate in real time; or edit the code and watch the artwork re-render instantly.
* **AI-Native Workflow:** AI models can directly emit structured `.pix2` code to paint crisp pixel art with zero diffusion blur.

---

## 📚 Documentation Tour

* **[System Architecture & Code Reuse Plan](ARCHITECTURE_AND_REUSE_PLAN.md):** Detailed technical plan for how PixelArt reuses the core PIX2 reference engine (`js/pix2-format.js`) and algorithm suite (`js/tools.js`), how the bi-directional state synchronization functions, and resource boundaries.
* **[Functional & UI/UX Specification](SPECIFICATION.md):** Complete specifications of the workspace layout, drawing toolset, keyboard shortcuts, palette manager, and AI integration.

---

## 🚀 Quickstart

1. Open `pixelart/index.html` in any modern web browser (or visit `https://noiradix.me/pixelart/`).
2. Select your canvas size (e.g. 64×64 or 128×128).
3. Draw freely with the Pencil, Line, Rectangle, Fill bucket, or Symmetry mirror.
4. Watch the PIX2 source code update live on the right pane!
5. Export as a crisp `.png` (at 1x to 32x integer scale) or save as `.pix2`.

