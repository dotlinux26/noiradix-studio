# NOIRADIX Studio 2.0.0 & PIX2 1.1 Release Notes

> **Release Version:** NOIRADIX Studio v2.0.0 / PixelArt v2.0.0 / PIX2 Standard v1.1  
> **Release Date:** November 2026  
> **Canonical Domain:** [https://noiradix.me/](https://noiradix.me/)  
> **License:** Apache 2.0 / MIT Dual License  

---

## 🌟 Executive Overview

NOIRADIX Studio 2.0 and the PIX2 1.1 graphics specification represent a major architectural milestone. This release evolves pixel art from flat coordinate matrices into **Structured Semantic Graphics (Sprite as Structured Data - SaaD)**.

For generative AI models (Claude, ChatGPT, Gemini), artists, and game developers, PIX2 1.1 introduces first-class structural layers, grouping hierarchies, and named semantic regions (`@region`). This eliminates cross-region coordinate corruption during AI edits, brings non-destructive modular component exporting, and provides a native Import & Slice pipeline for existing raster artwork.

---

## 🚀 Key Highlights & New Capabilities

### 1. PIX2 1.1 Structural Graphics Standard
* **Hierarchical Document Model:**
  - `@cell <id>`: Top-level sprite frame container.
  - `@layer <id>`: Visual stratum with properties for `name`, `visible`, `opacity`, `blend`, and `z_index`.
  - `@group <id>`: Organizational folder with cascading visibility, opacity, and fold states.
  - `@region <id>`: Named semantic pixel partition (e.g., `left_eye`, `visor`, `torso`, `cape`) with accent colors and query tags.
* **Semantic Region Isolation & Zero Cross-Region Mutation Invariant:**
  - Double-clicking or targeting a region enters Isolation Mode, scoping drawing tools (Pen, Eraser, Line, Fill, Selection) strictly to that target.
  - Sibling and parent nodes remain completely immutable during edit transactions.
  - In-editor visual focus dims non-isolated artwork to `0.22` opacity for sharp context.
* **Porter-Duff Normal Alpha Compositing:**
  - Evaluates layer hierarchies in pre-order/z-depth with standard source-over alpha blending:
    $$\alpha_{\text{out}} = \alpha_A + \alpha_B (1 - \alpha_A)$$
    $$C_{\text{out}} = \frac{C_A \alpha_A + C_B \alpha_B (1 - \alpha_A)}{\alpha_{\text{out}}}$$
* **100% Backward & Forward Compatibility:**
  - Lossless automatic upgrade from flat PIX2 1.0 cells (`PIX2.upgradeV10ToV11`).
  - Deterministic downgrade back to flat PIX2 1.0 cells (`PIX2.flattenV11ToV10`).

### 2. Multi-Document Project Sessions
* **Independent Artwork Sessions:**
  - Studio and PixelArt support multi-project tab bars (`#project-tabs-strip`).
  - Each session retains its own independent AST, file path/handle, dirty/revision counter, undo/redo delta history, and canvas viewport state.
  - Session switching is strictly zero-copy and never serializes or overwrites another open tab's in-progress changes.
* **Session Close & Guard Protections:**
  - Unsaved sessions are guarded with dirty-state prompts (`Save / Discard / Cancel`).
  - Native file handles are preserved per tab across edits.

### 3. Guided New Project & Frame Resize Engine
* **Categorized Frame Resolution Presets:**
  - **Micro:** 16×16, 24×24, 32×32 (Classic RPGs, retro sprites)
  - **Standard:** 48×48, 64×64, 96×96 (Modern indie platformers)
  - **Large:** 128×128, 192×192, 256×256 (Detailed portraits, bosses)
  - **Wide / Platform:** 192×108, 320×180, 512×288, 512×512 (Platformer staging)
* **Pre-Create Project Specification Summary Card:**
  - Real-time feedback displaying frame dimensions, pixel density per frame, sheet layout, total cell count, animation template, and active resource profile limit.
* **Post-Create Frame Resize Dialog (`#modal-resize-frame`):**
  - Allows adjusting canvas bounds for all cells in active projects up to 512×512 px.
  - Non-destructive canvas expansion or cropping anchors to the top-left, re-compositing all structural layers with zero pixel loss or distortion.

### 4. Unified Selection Transforms (Studio & PixelArt Parity)
* **8 Transformation Handles:**
  - 4 corner handles (`nw`, `ne`, `se`, `sw`) and 4 side handles (`n`, `e`, `s`, `w`).
  - Single-axis scaling via side handles.
  - Uniform aspect ratio preservation via <kbd>Shift</kbd> + corner handle drag.
* **Nearest-Neighbor Zero-Blur Resampling:**
  - Discrete pixel snapping guarantees crisp pixel art with zero fractional smoothing or edge blurring.
* **Free Rotation & 15°/90° Snapping:**
  - Top rotation handle with interactive angle readout badge.
  - Snapping to 15° increments when holding <kbd>Shift</kbd>, or instant 90° flips.

### 5. Native Import & Slice Ingestion Pipeline
* **Raster PNG & Atlas Ingestion Without Vector Tracing:**
  - Replaces fragile Bézier curve fitting with mathematically exact discrete pixel slicing.
  - Supports TexturePacker JSON (Hash and Array formats), Aseprite JSON sheets, and uniform grid subdivision.
  - Preserves 100% color accuracy, RGBA transparency, and parses animation tags directly into working playback clips.

### 6. Modular Component Export (.ZIP)
* **Game Engine-Neutral Modular Packaging:**
  - Exports individual layers, groups, and regions as separate transparent PNGs.
  - Emits an engine-agnostic `manifest.json` documenting frame names, component hierarchies, relative pixel offsets, and animation tracks.
  - Fully compatible with Unity, Godot Engine, Phaser, Defold, and Raylib modular character rigs.

### 7. Platformer 2D Animation & Action Diagnostics
* **Platformer 2D (Left/Right) Template:**
  - Standardized locomotion tracks: `idle_right`, `idle_left`, `run_right`, `run_left`, optional `jump`, `fall`.
* **Action Scoping & Diagnostic Warnings:**
  - If an explicit action is requested (e.g. `jump`) but clips are missing, the AnimationPlayer emits detailed diagnostics via `getMissingClipDiagnostics()` and safely yields empty frames rather than silently playing the wrong clip.

---

## 🛠 Architectural & Reliability Invariants

1. **Zero External Runtime Dependencies:** Pure standard ECMAScript / Vanilla JavaScript. No bundlers, no npm runtime dependencies, no build steps required.
2. **Dual-File SHA-256 Parity:** Shared format core `js/pix2-format.js` and `pix2/js/pix2-format.js` are strictly cryptographically identical.
3. **Canonical Domain Enforcement:** Exclusively `https://noiradix.me/` across all codebases, metadata, schemas, and documentation.
4. **Comprehensive Test Suite:** 12 automated test suites encompassing 205 unit and regression assertions passing 100% locally and on CI.

---

## 📦 Upgrading from Studio 1.x

NOIRADIX Studio 2.0 is fully backward compatible with all `.pix2` v1.0 files:
- Simply open your existing `.pix2` file via native File Open or Drag & Drop.
- The editor will seamlessly parse and display your sprite frames.
- Adding structural layers or regions will automatically migrate the file to PIX2 1.1 format upon save.

