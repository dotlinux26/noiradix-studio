# NOIRADIX Studio — Product Specification

## 1. Product Mission & Philosophy
NOIRADIX Studio is a static, browser-native sprite engineering studio and animation sequencer built around the **PIX2** (`.pix2`) structured sprite format.

### Core Tenet
> **"One structured source of truth: Human-readable, machine-verifiable, and AI-editable."**

Unlike opaque binary PNGs or complex layered PSDs, `.pix2` treats sprites as structured text code. This enables AI models (like Gemini and GPT-4) to create, inspect, edit, and animate sprites frame-by-frame with surgical precision.

## 2. Hard Technical Constraints
1. **Zero External Runtime Dependencies:** Pure Vanilla ES2022+ web stack (no React, no Vue, no Babel, no Webpack/Vite bundlers required to run).
2. **100% Offline Capable:** The studio runs entirely locally from `file:///` protocol or any static HTTP server. No cloud accounts, API keys, or backend servers required.
3. **Data Integrity First:**
   - Alpha transparency (`0x00`) is never discarded.
   - Non-destructive operations: flipping a row never alters other rows.
   - Atomic palette updates preserve coordinate maps.
4. **Memory Footprint:** 25 MB – 100 MB baseline RAM footprint for fluid performance on low-end hardware.
5. **Language & Internationalization:** 100% English UI and documentation standard.

## 3. High-Level Feature Architecture
- **Grid Overview Canvas:** Zoomable layout overview showing all rows (directional animations) and columns (frames), with non-overlapping headers, row duplication, row-only flipping, and column addition.
- **Cell Pixel Editor:** Precision pixel-art canvas with pencil, eraser, line, rectangle, paint bucket, color picker, marquee selection, floating transforms, symmetry guides, and pixel grid rulers.
- **Animation Studio:** Dedicated playback studio with timeline, multi-direction playback preview, FPS controls, frame reordering, and onion skinning.
- **Palette Generator from Artwork:** Instant 1-click scanning of active cell or entire document to extract unique colors (exact or reduced) with add/replace actions.
- **PIX2 Code & AI Prompt Studio:** Live two-way text editor with syntax highlighting, one-shot prompt generator, schema validator, and copy buttons.

