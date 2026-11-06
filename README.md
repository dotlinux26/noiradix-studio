<div align="center">
  <img src="noiradix-studio-logo.svg" alt="NOIRADIX Studio Logo" width="128" height="128">
  <h1>NOIRADIX Studio</h1>
  <p><strong>High-Performance, AI-Native Pixel Art & Spritesheet Studio for the <code>.pix2</code> Standard</strong></p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License"></a>
    <a href="PIX2_SPECIFICATION.md"><img src="https://img.shields.io/badge/Language-PIX2%20DSL-8b5cf6.svg" alt="Language: PIX2 DSL"></a>
    <a href="PIX2_SPECIFICATION.md"><img src="https://img.shields.io/badge/Standard-PIX2_v1.0-6366f1.svg" alt="PIX2 Standard"></a>
    <a href="https://github.com/dotlinux26"><img src="https://img.shields.io/badge/Author-dotlinux26-8b5cf6.svg" alt="Author"></a>
    <a href="DONATE.md"><img src="https://img.shields.io/badge/Donate-Sponsor%20%E2%99%A5-ff69b4.svg" alt="Donate"></a>
    <a href="CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg" alt="Code of Conduct"></a>
    <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
    <a href="SECURITY.md"><img src="https://img.shields.io/badge/Security-Private%20Reporting-success.svg" alt="Security Policy"></a>
  </p>
</div>

**NOIRADIX Studio** is a pure vanilla, offline-first pixel art editor and animation suite built from the ground up for the `.pix2` semantic text standard. It bridges the gap between AI generation, pixel artists, and modern game engines by providing deterministic sparse-pixel serialization, multi-directional character templates, and game-ready atlas export with anti-bleeding protection.

---

## 🌟 Key Highlights

* **100% Pure Vanilla Web Stack:** Zero build tools, zero npm packages, zero runtime frameworks. Runs directly in any modern browser by double-clicking `index.html` or executing `start-noiradix-studio.bat`.
* **AI-Native Sparse Pixel Format (`.pix2`):** Only explicitly drawn pixels are serialized into clean, token-efficient text. Cleanly diffable by Git and LLMs.
* **Game Export Studio (Anti-Bleeding Guard):**
  * Solves sub-pixel texture bleeding seams with configurable **Cell Spacing** (`0px`, `1px`, `2px`, `4px`) and **Outer Margins**.
  * **Extrude Edge Pixels:** Clones border pixels into padding to eliminate GPU texture filtering artifacts in Unity, Godot, and WebGL.
  * **Export Scaling:** Crisp pixel-perfect scaling (`1×` native, `2×`, `3×`, `4×`).
  * **Custom Sprite Pivots:** Presets for `Bottom-Center (0.5, 0.0)` (standard for 2D Top-Down RPG characters), `Center (0.5, 0.5)`, and `Top-Left (0.0, 1.0)`.
* **Universal Game Engine Targets:**
  * **Unity 2D Spritesheet Package (.ZIP):** Atlas PNG + Unity Metadata JSON + included C# `Pix2UnityImporter.cs` script for 1-click automatic sprite slicing and `.anim` AnimationClip generation.
  * **TexturePacker Standard JSON (.ZIP):** Universal Hash format directly readable by Godot, Phaser, Pixi.js, Defold, Raylib, and GameMaker.
  * **PNG Spritesheet Only:** High-res transparent atlas with spacing and extrude baked in.
  * **Individual Sliced Frames (.ZIP):** Standalone numbered PNG frames.
* **Character Action & Direction Template Generator:**
  * Auto 4-Direction (`Down`, `Up`, `Right`, `Left`) and Auto 8-Direction (`Down`, `Up`, `Right`, `Left`, `Down-Left`, `Down-Right`, `Up-Left`, `Up-Right`).
  * One-click action presets: `idle`, `walk`, `run`, `attack`, `dash`, `hurt`, `death`.
  * **100% Artwork Preservation:** Automatically expands grid dimensions without overwriting or erasing existing drawn pixels.
* **Visual Row & Column Management:**
  * Dedicated `×` delete buttons directly on each Row Card and Column Badge with detailed impact confirmation dialogs (protects against accidental artwork loss).
* **Direct Disk File Access (`Ctrl+S`):**
  * Uses the modern Chromium File System Access API (`showOpenFilePicker` / `showSaveFilePicker`) with persistent `FileSystemFileHandle` caching via IndexedDB. Direct save without popup interruptions.
* **Smooth Ergonomic Navigation:**
  * Native scrollbars hidden across toolbars and bottom statusbar. Full horizontal mouse-wheel scrolling and click-and-drag panning (`cursor: grab / grabbing`).

---

## 🌐 Browser Compatibility & Recommended Setup

NOIRADIX Studio operates in two tiers based on modern browser file capabilities:

| Browser Tier | Supported Browsers | Recommended Version | Direct Disk `Ctrl+S` | Drag-and-Drop Handle Binding | Real-Time Live Watcher | Status |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **Tier 1 — Full Native (Recommended)** | **Google Chrome, Microsoft Edge, Brave, Opera, Arc, Vivaldi** | **v86+** (Chromium engine) | ✅ Yes (Direct write via `createWritable()`, zero popups) | ✅ Yes (Binds `FileSystemFileHandle` on drop) | ✅ Yes (Live auto-reload on external file edits) | **Optimal (100% Desktop-Grade Experience)** |
| **Tier 2 — Graceful Fallback** | **Mozilla Firefox** | **v90+** (Gecko engine) | 🔄 Fallback (Triggers direct file download) | 🔄 Fallback (In-Memory Draft) | ⚠️ Manual Only (Click reload button or `Ctrl+Shift+R`) | **Fully Supported (Lossless Web Fallback)** |
| **Tier 2 — Graceful Fallback** | **Apple Safari** (macOS, iPadOS, iOS) | **v15.2+** (WebKit engine) | 🔄 Fallback (Triggers direct file download) | 🔄 Fallback (In-Memory Draft) | ⚠️ Manual Only (Click reload button or `Ctrl+Shift+R`) | **Fully Supported (Lossless Web Fallback)** |

> [!TIP]
> **Why Chromium is Recommended:** Google Chrome, Microsoft Edge, Brave, and Opera implement the **File System Access API** (`window.showOpenFilePicker`, `showSaveFilePicker`, and `DataTransferItem.getAsFileSystemHandle()`). This unlocks instant `Ctrl+S` disk commits, drag-and-drop linking, and real-time external change detection when working alongside external AI coding assistants or VS Code. In Firefox and Safari, the studio gracefully falls back to lossless HTML5 file downloads with zero data loss.

---

## 📁 File System Architecture, Encoding & Security Boundaries

NOIRADIX Studio enforces a clean, deterministic architecture for local files and project metadata:

### 1. Document Title vs. Physical File Name
* **Physical File Name (`*.pix2`):** Displayed in the Top Header File Widget and Bottom Statusbar Pill (e.g. `player_wispling.pix2` or `Dũng Sĩ Bóng Đêm.pix2`). This directly represents the file handle on your local filesystem.
* **Internal Document Metadata (`@meta.title`):** Embedded inside the plain-text `.pix2` file. Synchronized automatically with the filename base (without the `.pix2` extension).
* **Inline Renaming Workflow:**
  * Clicking the file title input in the top header allows editing the filename directly.
  * Renaming in the header does **not** silently overwrite the physical disk file under a new name without user consent (prohibited by W3C browser security). Instead, it marks the project as **Dirty (`●`)**.
  * Pressing **`Ctrl + S`** after a rename automatically opens the system **Save As** dialog with the new filename prefilled, ensuring you have explicit control over where the new file is placed on disk.

### 2. Character Encoding & Multilingual Support Matrix
NOIRADIX Studio is 100% UTF-8 native across both the parser, serializer, and UI:

| Name / Path Feature | Support Level | Behavior & Rules |
|:---|:---:|:---|
| **Whitespaces (` `)** | ✅ 100% Full | Allowed in file names, titles, and cell names without stripping (e.g. `Player Wispling Final.pix2`). |
| **Vietnamese Diacritics** | ✅ 100% Full | Fully preserved with tone marks (e.g. `Dũng Sĩ Bóng Đêm.pix2`, `Đòn Đánh Sấm Sét 01`). |
| **CJK / Multilingual** | ✅ 100% Full | Japanese, Korean, Chinese, Cyrillic, and extended Unicode characters are fully supported (e.g. `勇者スプライト_v2.pix2`). |
| **Illegal OS Chars** | 🛡️ Auto-Sanitized | Windows/POSIX reserved characters (`\ / : * ? " < > \|`) are automatically converted to clean underscores (`_`). |

### 3. Drag & Drop Architecture
* **Chromium (Chrome / Edge / Brave):** Dropping a `.pix2` file extracts a live `FileSystemFileHandle` via `DataTransferItem.getAsFileSystemHandle()`. Once loaded, pressing `Ctrl + S` writes directly back to that physical disk file without prompt interruptions.
* **Non-Chromium Fallback (Firefox / Safari):** Dropping a `.pix2` file reads the file stream into memory. Pressing `Ctrl + S` triggers a standard lossless download save.

### 4. Path Copying & Project Root Directory
* **Browser Security Sandbox Rule:** For privacy and security, modern web browsers intentionally conceal the full host filesystem path (e.g. `D:\ghoster\assets\...`) from client-side JavaScript.
* **Project Root Directory Feature:**
  * Click the **Folder icon** (`#btn-reveal-explorer`) in the bottom statusbar to set or change your project base directory (e.g. `D:/ghoster` or `Assets/_Game/Art`).
  * Once set, clicking the **Copy Path** button in the top header or statusbar copies the **full combined path** (`D:/ghoster/player_wispling.pix2`) directly to your clipboard for instant pasting into Unity, VS Code, or terminal commands.

---

## 💻 Hardware & System Requirements

NOIRADIX Studio is engineered with an ultra-lightweight, zero-overhead architecture:

| Component | Minimum Specification | Recommended Specification |
|:---|:---|:---|
| **Operating System** | Windows 10/11, macOS 10.15+, Linux (Ubuntu, Debian, Fedora, Arch), ChromeOS | Windows 11, macOS 14+, Linux |
| **Processor (CPU)** | 1.5 GHz Dual-Core (x86_64 or ARM64) | 2.0 GHz Quad-Core or Apple Silicon (M1/M2/M3/M4) |
| **Memory (RAM)** | 512 MB free RAM (Studio footprint is only ~25 MB – 100 MB) | 1 GB free RAM |
| **Graphics (GPU)** | Integrated Graphics with WebGL / HTML5 Canvas 2D support | Any modern integrated or dedicated GPU |
| **Display Resolution** | 1280×720 (HD) minimum | 1920×1080 (Full HD) or higher (supports 2K, 4K, Ultrawide) |
| **Input Devices** | Standard Mouse & Keyboard | Mouse, Keyboard, and Drawing Tablet (Wacom, Apple Pencil) |
| **Network / Internet** | **None** (100% Offline-Capable) | Offline (Zero telemetry, zero external network requests) |

---

## 📦 Zero-Dependency Architecture & Third-Party Transparency

NOIRADIX Studio follows a strict **Zero-Runtime-Dependency & Zero-Build** philosophy:

* **0 npm runtime packages:** Zero `node_modules` required for execution.
* **0 build steps:** No Webpack, Vite, Babel, Rollup, or esbuild. Source code in `js/` runs directly and natively in the browser.
* **Pure Web Standards:**
  * HTML5 Canvas 2D Context (`CanvasRenderingContext2D`) for pixel-perfect rendering.
  * Modern ECMAScript 2022+ (Vanilla JavaScript).
  * CSS Custom Properties (Variables) with clean light and dark theme switching.
  * Chromium File System Access API & IndexedDB for disk persistence.
* **Third-Party Assets Used:**
  * **FontAwesome 6 (Free Vector Icons):** Delivered with Subresource Integrity (SRI) SHA-512 hashes and fallback styling.
  * **Web Fonts:** Fira Code (Monospace) & Inter (UI typography) with clean native system font fallbacks (`monospace`, `system-ui`, `-apple-system`, `sans-serif`) when operating completely offline.
  * See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [LICENSE](LICENSE) for complete license attributions.

---

## 🚀 Quickstart

### Method 1: Instant 1-Click Launch (Windows)
Double-click `start-noiradix-studio.bat` in the repository root. It opens the studio directly in your default browser.

### Method 2: Any Web Server
Serve the repository root directory with any HTTP server:
```bash
# Python 3
python -m http.server 8080

# Node.js npx
npx serve .
```
Then navigate to `http://localhost:8080` in Chrome, Edge, or Brave.

### Method 3: Direct File Opening
Simply open `index.html` in any Chromium-based browser (Chrome, Edge, Brave, Opera, Arc).

---

## 🎮 Game Engine Integration

### Unity (2D Top-Down / Platformer)
1. In NOIRADIX Studio, click the **Export** button in the top header.
2. Select **Unity 2D Sprite Package** and your desired spacing (recommended: `1px`).
3. Click **Export Game Package** to download `{project}_unity_package.zip`.
4. Extract the folder into your Unity project (e.g. `Assets/_Game/Art/Sprites/`).
5. In Unity, right-click the `.pix2.json` file and select **Assets > NOIRADIX > Import Spritesheet & Animations** (or use top menu `Tools > NOIRADIX > Import Pix2 Spritesheet JSON...`).
6. The importer automatically:
   * Sets `TextureType` to **Sprite (2D and UI)**, `FilterMode` to **Point (no filter)**, and `Compression` to **None**.
   * Slices all frames with exact pixel bounds and pivots.
   * Generates `.anim` AnimationClips inside an `Animations/` subfolder at your specified FPS.

### Godot 4
1. Select **TexturePacker Standard (JSON Hash)** in the Export dialog.
2. Drop the generated `.png` and `.json` files into your Godot project.
3. Import into an `AnimatedSprite2D` or use a standard AtlasTexture resource.

### Phaser / Pixi.js / WebGL
Load the exported atlas directly using the standard Phaser atlas loader:
```javascript
this.load.atlas('player', 'assets/player_atlas.png', 'assets/player.json');
```

---

## 📂 Repository Structure

```
noiradix-studio/
├── index.html                   # Single-page studio interface & modals
├── start-noiradix-studio.bat    # 1-click launcher for Windows
├── PIX2_SPECIFICATION.md        # Official specification for the .pix2 format
├── THIRD_PARTY_NOTICES.md       # Third-party licenses & acknowledgments
├── LICENSE                      # Apache-2.0 open-source license
├── README.md                    # Studio documentation
│
├── css/
│   └── style.css                # Polished design system (Light & Dark themes)
│
├── js/
│   ├── pix2-format.js           # Core parser, serializer, & Bresenham rasterizer
│   ├── editor-state.js          # Undo/redo stack, document store, & tabs
│   ├── tools.js                 # Pencil, Line, Rect, Bucket Fill, Eraser
│   ├── animation-player.js      # Timeline playback engine
│   ├── default-sample.js        # Built-in character sprite template
│   └── app.js                   # UI controllers, modal managers, & export pipeline
│
├── samples/
│   └── Player.pix2              # Example 4-direction Wispling character sprite sheet
│
└── tests/
    ├── test-roundtrip.js        # Deterministic parse-serialize roundtrip test suite
    └── test-security.js         # Malicious payload & prototype pollution test suite
```

---

## 🧪 Testing & Validation

Run the deterministic roundtrip and security test suites using Node.js:
```bash
# Semantic roundtrip tests (23/23)
node tests/test-roundtrip.js

# Malicious payload & anti-DoS tests (11/11)
node tests/test-security.js
```
Expected output:
```
====================================================
TEST RESULTS: 23 / 23 PASSED
====================================================
```

Verify JavaScript syntax:
```bash
node --check js/app.js
node --check js/pix2-format.js
```

---

## 💖 Donate & Sponsor

If you find NOIRADIX Studio useful in your game development pipeline, please consider supporting its continuous development:

* 👉 **[GitHub Sponsors (@dotlinux26)](https://github.com/sponsors/dotlinux26)**
* 🍵 **[Ko-fi (@dotlinux26)](https://ko-fi.com/dotlinux26)**
* See [DONATE.md](DONATE.md) for full domestic and international options.

---

## 👤 Author & Maintainer

* **Created & Maintained by:** Nguyen Duc Canh ([@dotlinux26](https://github.com/dotlinux26))
* **Email:** [0206canh@gmail.com](mailto:0206canh@gmail.com)

---

## 📄 License & Copyright

NOIRADIX Studio is open-source software created by **dotlinux26 (Nguyen Duc Canh)** and licensed under the [Apache License, Version 2.0](LICENSE).

```text
Copyright (c) 2026 dotlinux26 (Nguyen Duc Canh)
```

See [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for complete attributions and third-party notices.

