# NOIRADIX Studio 2.0 — Product Specification

> **Version:** 2.0.0  
> **Format Specification:** PIX2 1.1 Structural Graphics  
> **Canonical Domain:** [https://noiradix.me/](https://noiradix.me/)  
> **License:** Apache 2.0 / MIT Dual License  

---

## 1. Product Mission & Philosophy
NOIRADIX Studio is a static, browser-native sprite engineering workbench and animation sequencer built around the **PIX2** (`.pix2`) semantic graphics standard.

### Core Tenet: Sprite as Structured Data (SaaD)
> **"One structured source of truth: Human-readable, machine-verifiable, and AI-editable."**

Unlike opaque binary PNGs or monolithic image editors, `.pix2` treats sprites as structured text data. With PIX2 1.1, sprites evolve from an unorganized soup of coordinate pixels into structured semantic components (`@layer`, `@group`, `@region`). This enables AI models (Claude, ChatGPT, Gemini) and human artists to inspect, query, isolate, and patch specific named regions (e.g. `left_eye`, `visor`, `torso`) with zero cross-region coordinate corruption.

---

## 2. Hard Technical Constraints
1. **Zero External Runtime Dependencies:** Pure Vanilla ES2022+ web stack (no React, no Vue, no Babel, no Webpack/Vite bundlers required to run).
2. **100% Offline-First:** Runs completely locally in any modern browser via `file:///` protocol or static HTTP server. No cloud accounts, API keys, or backend servers required.
3. **Canonical Domain Guard:** Exclusively `https://noiradix.me/` (strictly no `.org` domains).
4. **Data Integrity & Non-Destructive Mutations:**
   - Alpha transparency (`0x00`) is preserved with 100% fidelity.
   - Zero Cross-Region Mutation Invariant: editing an isolated region never mutates sibling or parent nodes.
   - Non-destructive canvas expansion or cropping anchors to the top-left, preserving all structural layers without distortion.
5. **Memory Footprint & Budgets:** Under 50 MB baseline RAM footprint for fluid 60 FPS performance on lightweight consumer hardware.
6. **Dual-File Core Synchronization:** `js/pix2-format.js` and `pix2/js/pix2-format.js` are strictly cryptographically identical (SHA-256).

---

## 3. High-Level Feature Architecture

### 3.1 PIX2 1.1 Structural Graphics Model
- **`@layer <id>`:** Visual compositing stratum with `name`, `visible`, `opacity`, `blend`, and `z_index`.
- **`@group <id>`:** Hierarchical container for organizing related body parts, armor, or visual effects.
- **`@region <id>`:** Named semantic pixel partition for discrete anatomical or accessory features.
- **Semantic Region Isolation:** Dedicated paint boundary scoping drawing tools (pen, eraser, line, fill) strictly to the target region, with non-isolated background dimmed to `0.22` opacity.
- **Porter-Duff Alpha Compositing:** Standard source-over alpha blending across the layer hierarchy.

### 3.2 Multi-Document Project Sessions
- Tab bar (`#project-tabs-strip`) supporting multiple concurrent artwork documents.
- Complete session isolation: each session retains independent AST, dirty state, file handle/path, history stack, and viewport camera.
- Zero-copy switching and unsaved change guards (`Save / Discard / Cancel`).

### 3.3 Guided New Project & Frame Resize Dialog
- **Categorized Presets:** Micro (16×16, 24×24, 32×32), Standard (48×48, 64×64, 96×96), Large (128×128, 192×192, 256×256), and Wide/Platform (192×108, 320×180, 512×288, 512×512).
- **Pre-Create Summary Card:** Live calculation of frame size, pixel density per frame, sheet layout, total cell count, animation template, and active profile limits.
- **Frame Resize Dialog (`#modal-resize-frame`):** Non-destructive post-create resizing up to `512×512` px with top-left anchor preservation.

### 3.4 Unified Selection Transform Engine
- Parity across Studio and PixelArt Editor:
  - 8 transformation handles (4 corners, 4 sides).
  - Single-axis scaling on side handles.
  - Uniform aspect ratio preservation via <kbd>Shift</kbd> + corner drag.
  - Free rotation with live angle badge and 15°/90° snapping.
  - Nearest-neighbor zero-blur discrete pixel resampling.

### 3.5 Real-Time Directional Animation Studio
- **Supported Animation Templates:**
  - 4-Direction Locomotion (Down, Up, Right, Left)
  - 8-Direction Locomotion (Full Compass)
  - Platformer 2D Locomotion (Idle/Run Right, Left, Jump, Fall)
- **Playback Controls:** Live variable FPS (1–30), timeline scrubbing, frame reordering, onion skinning, and missing clip diagnostics.

### 3.6 Native Import & Slice Pipeline
- Mathematical discrete raster slicing for PNG sheets without vector autotracing.
- Built-in metadata adapters for **TexturePacker JSON** (Hash and Array) and **Aseprite JSON**.
- Direct ingestion into discrete `.pix2` cell frames, structural layers, and automated animation clips.

### 3.7 Modular Component Export (.ZIP)
- Game engine-neutral export packaging individual layers and groups as transparent PNGs.
- Outputs machine-readable `manifest.json` recording component hierarchies, pivots, relative pixel offsets, and animation tracks.
- Ready for runtime character customization in Unity, Godot, Phaser, Defold, and Raylib.
