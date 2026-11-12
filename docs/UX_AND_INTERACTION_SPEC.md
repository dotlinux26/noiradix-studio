# NOIRADIX Studio 2.0 — UX & Interaction Specification

> **Version:** 2.1.4
> **Format Specification:** PIX2 1.1 Structural Graphics  
> **Canonical Domain:** [https://noiradix.me/](https://noiradix.me/)  

---

## 1. Top Navigation & Document Sessions Strip
- **Branding Badge:** Displays official NOIRADIX logo, brand title "NOIRADIX Studio", and clickable version badge derived from `js/version.js`, opening the About modal.
- **Project Sessions Tab Strip (`#project-tabs-strip`):**
  - Displays tabs for open `.pix2` projects with document titles, dirty indicators (`*`), and close buttons (`×`).
  - `+` button opens Guided New Project modal.
  - Switching tabs seamlessly switches active document context without cross-contamination.
- **Quick Action Buttons:**
  - `New` (<kbd>Ctrl</kbd> + <kbd>N</kbd>): Opens Guided New Project modal with resolution presets & summary card.
  - `Open` (<kbd>Ctrl</kbd> + <kbd>O</kbd>): Opens `.pix2` file from disk via File System Access API.
  - `Save` (<kbd>Ctrl</kbd> + <kbd>S</kbd>): Direct disk serialization with serialized queue lock.
  - `Import Code` (<kbd>Ctrl</kbd> + <kbd>I</kbd>): Opens direct PIX2 code paste modal.
  - `Theme`: Toggles Light / Dark mode.
  - `Spec`: Opens PIX2 1.1 Specification modal.
  - `About`: Displays version `2.0.0`, PIX2 `1.1` compatibility, GitHub repo, Discord, and license.

---

## 2. Multi-Mode Workspaces
NOIRADIX Studio provides 3 dedicated top-level workspaces:
1. **Grid Overview Workspace (`#view-grid-overview`):**
   - High-level layout canvas showing all rows (directional tracks) and columns (animation frames).
   - Toolbar: `+ Row`, `- Row`, `+ Col`, `- Col`, `Resize Frame`, `Flip Row H`, `Flip Row V`, `Center All`.
   - Right-click context menus for cell-level and row-level operations.
2. **Cell Pixel Editor Workspace (`#view-cell-editor`):**
   - Precision pixel-art viewport with floating selection transform handles and rulers.
   - Structure & Layers Panel: Live layer/group/region hierarchy tree with visibility, lock, opacity, and layer addition controls.
   - Drawing Tools: Pen (<kbd>P</kbd>), Eraser (<kbd>E</kbd>), Line (<kbd>L</kbd>), Rectangle (<kbd>U</kbd>), Flood Fill (<kbd>G</kbd>), Color Picker (<kbd>I</kbd>), Marquee Select (<kbd>M</kbd>), Region Select, Pan (<kbd>H</kbd> / Space).
3. **Animation Studio Workspace (`#view-anim-studio`):**
   - Real-time sprite preview with 8x default integer scaling and auto-fit math.
   - Direction compass & locomotion mode selector (4-Direction, 8-Direction, Platformer 2D).
   - Animation clips list with FPS slider, loop modes (Loop, Once, Ping-Pong), and timeline scrubber.
   - Diagnostic panel warning about missing animation clips.

---

## 3. Structural Layers & Semantic Region Interaction
- **Structure & Layers Panel:**
  - `+ Layer`: Adds a new visual stratum with custom name.
  - `+ Group`: Adds an organizational group folder.
  - Eye icon toggles node visibility; Lock icon prevents accidental mutation.
  - Opacity slider adjusts layer compositing transparency in real-time.
- **Region Select Tool & Isolation Mode:**
  - Hovering over a region displays a dashed boundary box and name tag badge.
  - Single-click selects the region.
  - Double-click enters **Isolation Mode**:
    - Scopes all paint operations strictly to the isolated region.
    - Non-isolated background artwork is dimmed to `0.22` opacity.
    - Displays an isolation breadcrumb banner (`#pa-isolation-banner`) at the top of the viewport.
    - Pressing <kbd>Esc</kbd> or double-clicking outside the region exits isolation mode.

---

## 4. Selection Transforms & Keyboard Shortcuts
- **Selection Marquee:**
  - 8 resize handles (`nw`, `ne`, `se`, `sw`, `n`, `e`, `s`, `w`).
  - Corner drag: Free scale.
  - <kbd>Shift</kbd> + Corner drag: Uniform aspect ratio preservation.
  - Side handle drag: Single-axis scaling.
  - Top rotation handle: Free angle rotation with live degree badge; holding <kbd>Shift</kbd> snaps to 15° increments.
  - <kbd>Arrow Keys</kbd>: 1-pixel precision nudge.
  - <kbd>Enter</kbd>: Commit floating selection.
  - <kbd>Esc</kbd>: Cancel selection without modifying baseline pixels.

---

## 5. Game Engine Export Pipeline
- **Export Game Package Modal (`#modal-export-game`):**
  - **Atlas Formats:**
    1. Unity 2D Sprite Atlas (Automated `Pix2UnityImporter.cs` C# slicing script).
    2. TexturePacker Standard JSON Hash.
    3. Pure Transparent PNG Spritesheet.
    4. **Modular Component Package (.ZIP):** Independent layers and groups packed with `manifest.json`.
    5. Individual Numbered PNG Frames (.ZIP).
  - Anti-bleed padding controls (spacing, margin, extrude).
  - Live Atlas Preview with 1×, 2×, 4×, and Fit zoom pills.

## RC2 session/save clarification

Version badges and titles derive from `js/version.js`, including the beta suffix. Demo loading creates an independent session. Files with equal display names remain distinct when their native handles identify different entries. Save completion must preserve the active tab and all edits newer than its captured snapshot; failure keeps the unsaved indicator. Export preview Fit uses the visible viewport, and zoom reuses the current raster until export options change.

Verification status and platform gaps are maintained in `discussion/RC2_AUDIT.md`.
