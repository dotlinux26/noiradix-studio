# NOIRADIX Studio — Core Architecture & Design Philosophy

**Document Version:** 2.1.5 (stable)
**Project:** NOIRADIX Studio — Structured Pixel Art Editor & Open Sprite Description Language  
**Target Architecture:** Zero-dependency, browser-native, offline-capable, AI-native structured sprite authoring.  

---

## 1. Executive Vision: Sprite Editor + Sprite Description Language

PIX2 is deliberately **NOT** just another raster paint tool (like Aseprite, LibreSprite, or Pixelorama).  
While conventional editors treat sprites as flat arrays of bitmap RGBA integers (where semantic structure, frame roles, and directional relationships are discarded upon rasterization), **PIX2 treats sprites as addressable, structured code**.

```
                           +-------------------------------------+
                           |        Human Creator (Studio)       |
                           +------------------+------------------+
                                              |
                                              v
+-----------------------+          +---------------------+          +-----------------------+
|  AI Agent / Generator | <======> |   .PIX2 SOURCE OF   | <======> |  PNG / Sprite Sheet   |
| (Discrete Operations) |          |        TRUTH        |          |   (Export Artifact)   |
+-----------------------+          +---------------------+          +-----------------------+
                                              ^
                                              |
                           +------------------+------------------+
                           |  PIX2 Parser / Serializer / Engine  |
                           +-------------------------------------+
```

### Core Invariants
1. **Single Source of Truth (`.pix2`):** The `.pix2` file is the master project document. PNG images are purely derived, exported artifacts.
2. **Sparse Pixel Storage:** Only explicitly drawn pixels are stored. A missing coordinate record $(x, y)$ means 100% pure transparency. The engine **never** generates an implicit solid background canvas.
3. **Lossless RGBA Fidelity:** Supports `#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`. Non-opaque alpha ($0 < \alpha < 255$) is strictly preserved across import, parse, store, serialize, and export.
4. **Decoupled Identity:** Cell identifiers (`id`) are decoupled from grid row/col indices. A cell can be named `hero_idle_down`, `attack_slash_02`, etc., and assigned to any animation.
5. **Zero Runtime Dependencies:** Runs directly in any modern web browser via static HTML5, CSS3, Vanilla JavaScript, and Canvas 2D. No node runtime, no npm packages, no cloud upload, and 100% offline capable.

---

## 2. Four-Layer System Architecture

```
Layer 4: Interoperability Layer
  - Lossless Transparent PNG Export (Atlas & Individual Cell)
  - Unity Sprite Sheet Metadata & JSON Slicing Configs
  - Multi-frame Animated GIF / WebP Exporters

Layer 3: NOIRADIX Studio UI Layer
  - Grid Workspace (Sprite sheet layout, cell selection, row/col add/remove)
  - Pixel Editor (Pencil, Eraser, Eyedropper, Bucket, Line, Rect, Marquee Select, Symmetry)
  - Dedicated Animation Studio (Timeline, thumbnails, reorder, FPS, playback, Onion Skin)
  - Floating Animation Studio (Compact draggable 4-dir / 8-dir / custom animation dial)
  - PIX2 Code & AI Studio (Bidirectional live code view, AI prompt generation)

Layer 2: PIX2 Engine Core
  - Strict Token Lexer (Disambiguates ';' comments and '#' non-hex tokens)
  - Deterministic Parser & Serializer (Semantic Roundtrip Invariant)
  - Central Editor State & Snapshot History (Undo / Redo stack)
  - Precision PNG Slicer (Configurable gap, margins, cell dimensions, alpha preservation)
  - Document Lifecycle Manager (File System Access API, Autosave, Recovery)

Layer 1: PIX2 Language Specification
  - Grammar EBNF, direct addressing syntax (`Player.cell_id.pixel(x,y) = color`)
  - Semantic validation constraints & formal schema
```

---

## 3. The Three Coordinate Systems

To eliminate layout, zoom, and viewport scaling bugs, PIX2 strictly separates three coordinate spaces:

| Coordinate Space | Type | Mathematical Domain | Description |
| :--- | :--- | :--- | :--- |
| **Cell Space** | Integer | $(x, y) \in [0, W-1] \times [0, H-1]$ | Local pixel coordinate within a specific sprite cell (e.g. $16 \times 16$). |
| **Sheet Space** | Integer | $(X, Y) \in [0, \text{SheetW}-1] \times [0, \text{SheetH}-1]$ | Global pixel coordinate on the compiled sprite sheet atlas. |
| **Screen Space** | Float | $(x_s, y_s) \in \mathbb{R}^2$ | Physical CSS/Client pixels on the monitor. Screen coordinates are **never** stored in `.pix2`. |

Pointer-to-cell mapping must use the actual view transform, including fractional Fit zoom, canvas layout and DPR. Artwork zoom limits depend on dimensions; `js/viewport-pan-zoom.js` defines the shared ladder and cap. View state is never serialized into artwork.

---

## 4. AI-Native Pixel Addressing & Surgical Edits

Instead of using latent diffusion which hallucinates blurry pixels and destroys artistic line-work, an AI interacts with PIX2 through discrete, surgical mathematical operations:

```
Player.cell_id.pixel(x, y) = Color
```

### Standard AI Mutation Operations:
1. `set_pixel(cell_id, x, y, color)`: Plots a single pixel.
2. `erase_pixel(cell_id, x, y)`: Deletes the record at $(x, y)$, reverting to pure transparency.
3. `fill_region(cell_id, x, y, color)`: Flood fills connected matching color region.
4. `move_region(cell_id, x1, y1, w, h, dx, dy)`: Translates a bounding box by integer offsets.
5. `mirror_region(cell_id, axisX)`: Reflects pixels horizontally across a central axis.
6. `replace_color(cell_id, old_color, new_color)`: Re-indexes or swaps palette colors.
7. `add_frame(anim_id, cell_id)`: Appends cell to an animation sequence.
8. `remove_frame(anim_id, index)`: Removes a frame from an animation sequence.

---

## 5. Deployment & Distribution Architecture

- **Web Static Hosting:** Hostable on any static server or CDN (GitHub Pages, Cloudflare Pages, Netlify) with zero backend.
- **Desktop / Portable Edition:** Single zip folder containing `index.html`, `css/`, `js/`, `engine/`, and `samples/`. Double-click `index.html` or `start-pix2-studio.bat` to launch immediately without installing runtimes.
- **Open Format Ecosystem:** See repository license files for applicable terms when distributing the parser or format documentation.

---

## 6. Browser capabilities and measured support

Native file access is feature-detected. Automated local verification for this refactor used Chrome 157; CI uses Playwright Chromium. These checks do not establish a minimum supported browser version or certify Firefox, Safari, Edge and every Chromium derivative. File-input/Blob fallback remains part of the implementation. Manual OS picker behavior is separate from mocked native-handle tests.

## 7. Performance evidence

Canvas buffers and visibility-aware blits are shared. Each app owns render scheduling and viewport instances. Runtime JavaScript requires no package installation; external icon assets and browser capabilities can affect offline presentation.

Use `tests/benchmark-performance.js` and `tests/browser/benchmark-editors.cjs` with their recorded fixture/browser/DPR. Handler duration is not end-to-end frame latency; JS heap and connected canvas estimates exclude other allocations. There is no blanket promise of zero idle CPU, fixed RAM usage or every operation finishing below 16ms. Phase measurements and remaining coverage are recorded in `discussion/EDITOR_REFACTOR_PROGRESS.md`.

## RC2 file lifecycle and bounded processing contract

The 2.1.2-beta.1 implementation shares native write ordering, permissions and stream cleanup in `js/editor-file-save.js`. Apps own their session, history and persistence wiring. A save captures text, revision, originating session and handle before asynchronous work. Completion publishes only to that session; later edits remain dirty. Watcher reads are discarded if the handle, active session or revision changes while awaiting I/O.

Workspace catalog selection validates shape before choosing the newest timestamp across localStorage and IndexedDB. This is browser recovery, separate from disk saving; unavailable or cleared browser storage cannot guarantee recovery.

Both parser distributions must remain byte-identical. Public raster allocations require safe positive integer dimensions, at most 8192 per axis and 16,777,216 total pixels. Parser work budgets are implementation resource limits, not PIX2 artwork fields. See `discussion/RC2_AUDIT.md` for evidence and remaining beta coverage.

## Controller boundaries after P1/P5

Studio-specific UI controllers live in `js/studio-grid.js`, `studio-slice.js`, `studio-animation.js` and `studio-source.js`. The app connects their document/view ports and callbacks; they do not import each other. `studio-atlas.js` builds atlas rasters; `studio-export.js` packages them. Shared palette storage/dropdown behavior and immutable built-in color definitions live in `editor-palette-library.js` and `editor-palette-presets.js`; each editor receives separate mutable preset arrays. Core editor gestures and persistence remain app adapters during the next migration phases. See `discussion/EDITOR_REFACTOR_PROGRESS.md` for actual gates and outstanding work.

## Mutation publication after P2

Shared `Tools.editRaster` accepts a resolved source target and bounded integer coordinates and reports changed keys, optional before/after diff and dirty bounds. It does not resolve active application globals or publish history. App adapters resolve permissions, composite affected pixels, update their view and commit history. No-op commands must preserve revision, dirty state and redo. Dimension or structural changes remain edits even if the raster composite is unchanged.
