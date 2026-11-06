# NOIRADIX Studio — Core Architecture & Design Philosophy

**Document Version:** 1.0.0  
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

$$\text{Zoom Invariant: } \forall z \in [4\times, 64\times], \quad \text{ScreenToCell}(x_s, y_s, z) \equiv (x, y)$$

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
- **Open Format Ecosystem:** The `.pix2` format specification and core parser are released under permissive open-source licenses (MIT / CC0) so external developers, game engines, and AI agents can build native tools around PIX2.

---

## 6. Browser Compatibility & Native File Engine Matrix

| Browser Environment | Minimum Version | Native `Ctrl+S` Disk Overwrite | Drag-and-Drop Handle Binding | Real-Time Live Watcher | Support Level |
|---|:---:|:---:|:---:|:---:|:---|
| **Google Chrome / Chromium** | **v86+** | ✅ Full Native | ✅ `DataTransferItem.getAsFileSystemHandle()` | ✅ Live 1500ms + Focus Sync | **Tier 1 (Recommended)** |
| **Microsoft Edge** | **v86+** | ✅ Full Native | ✅ `DataTransferItem.getAsFileSystemHandle()` | ✅ Live 1500ms + Focus Sync | **Tier 1 (Recommended)** |
| **Brave / Opera / Arc / Vivaldi** | **v86+** | ✅ Full Native | ✅ `DataTransferItem.getAsFileSystemHandle()` | ✅ Live 1500ms + Focus Sync | **Tier 1 (Recommended)** |
| **Mozilla Firefox** | **v90+** | 🔄 Lossless Blob Download | 🔄 In-Memory Draft Drop | ⚠️ Manual (`Ctrl+Shift+R`) | **Tier 2 (Graceful Fallback)** |
| **Apple Safari (WebKit)** | **v15.2+** | 🔄 Lossless Blob Download | 🔄 In-Memory Draft Drop | ⚠️ Manual (`Ctrl+Shift+R`) | **Tier 2 (Graceful Fallback)** |

---

## 7. Hardware & System Execution Profile

- **RAM Footprint:** ~25 MB to 100 MB typical consumption depending on grid size, zoom depth, and undo history buffer.
- **CPU Overhead:** 0% idle; minimal bursts during flood fill or atlas generation (< 16ms per frame, ensuring steady 60 FPS).
- **GPU Acceleration:** Standard HTML5 Canvas 2D hardware rasterizer.
- **Storage Requirement:** Zero local installation required; static bundle footprint is under 2 MB.
