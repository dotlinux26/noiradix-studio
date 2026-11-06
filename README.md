# NOIRADIX Studio v1.0

> **High-Performance, AI-Native Pixel Art & Spritesheet Studio for the `.pix2` Standard**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Format](https://img.shields.io/badge/Format-PIX2_v1.0-6366f1.svg)](PIX2_SPECIFICATION.md)
[![Pure Vanilla](https://img.shields.io/badge/Stack-Pure_Vanilla_Web-10b981.svg)](#architecture)
[![Game Engine Ready](https://img.shields.io/badge/Engine-Unity_%7C_Godot_%7C_Phaser-ff6b6b.svg)](#game-engine-integration)

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
│   ├── player_wispling.pix2     # Example 4-direction RPG character
│   └── Player.pix2              # Example character sheet
│
└── tests/
    └── test-roundtrip.js        # Deterministic parse-serialize roundtrip test suite
```

---

## 🧪 Testing & Validation

Run the deterministic roundtrip test suite using Node.js:
```bash
node tests/test-roundtrip.js
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

## 📄 License

NOIRADIX Studio is open-source software licensed under the [Apache License, Version 2.0](LICENSE).
Third-party font and icon licenses are detailed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
