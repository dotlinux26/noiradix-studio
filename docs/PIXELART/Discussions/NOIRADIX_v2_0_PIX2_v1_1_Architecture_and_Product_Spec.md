# NOIRADIX 2.0 & PIX2 1.1 — Product / Architecture Blueprint

**Document type:** Product requirements + architecture proposal + migration strategy  
**Target product release:** NOIRADIX Studio `2.0.0`  
**Target format release:** PIX2 `1.1`  
**Baseline inspected:** `dotlinux26/noiradix-studio`, branch `main`, commit `6c8883da71a9b1aaebb3cacc61dd2779f0ccea03`  
**Date:** 2026-11-08  
**Status:** Proposed specification for implementation planning. PIX2 1.1 syntax examples below are design proposals, not an already implemented grammar.

---

## 0. Executive decision

This is a coordinated upgrade of the **document format**, **editing model**, **animation model**, **asset-ingestion workflow**, and **product shell**.

The version numbers are independent:

| Version | What it versions | Meaning |
|---|---|---|
| **PIX2 1.1** | `.pix2` document language / AST contract | Adds structural identity: layers, groups, named regions, tags, and extended animation metadata |
| **NOIRADIX Studio 2.0.0** | Main application release | Adds multi-layer editing, region-aware selection, platformer templates, atlas import/slicing, multi-document workflow, and updated UX |
| **NOIRADIX PixelArt 2.0.0** | Standalone PixelArt editor release | Adopts the same compatible structural editing model while retaining its large-canvas illustration workflow |

Do not use `PIX2 1.1` and `Studio 2.0.0` interchangeably. Studio 2.0 must open v1.0 documents; a future non-NOIRADIX tool may support PIX2 1.1 without being Studio 2.0.

### Product thesis

PIX2 evolves from a language that primarily describes *which pixels exist at which coordinates* into a language that also describes *which logical object owns those pixels*.

NOIRADIX evolves into a structured sprite production environment:

- Artists can select `left_eye`, not rediscover its coordinates.
- Agents can query and patch a stable object ID and verify unrelated regions did not change.
- Regions can live inside groups and layers, be isolated, moved, transformed, tagged, hidden, or locked.
- Existing grid cells remain independent sprites/frames; animations continue referencing those cells.
- Existing `.pix2` files remain readable; upgrade is explicit and loss-aware.
- Sprite-sheet ingestion becomes a first-class workflow whether metadata exists or manual slicing is required.

### Non-goals

This is not a rewrite of PIX2 v1.0, not a binary format, not a vector editor, and not semantic AI segmentation. PNG import is deterministic raster ingestion: preserve exact pixels and alpha, then place the raster content into a structured PIX2 model. It is not vector autotracing.

---

## 1. Verified repository baseline

The inspected repository is [`dotlinux26/noiradix-studio`](https://github.com/dotlinux26/noiradix-studio), `main` at `6c8883da71a9b1aaebb3cacc61dd2779f0ccea03`.

| File | Current responsibility |
|---|---|
| [`PIX2_SPECIFICATION.md`](https://github.com/dotlinux26/noiradix-studio/blob/main/PIX2_SPECIFICATION.md) | Published PIX2 v1.0 syntax and grammar |
| [`js/pix2-format.js`](https://github.com/dotlinux26/noiradix-studio/blob/main/js/pix2-format.js) | Parser, serializer, validation, raster primitives, resource profiles |
| [`js/editor-state.js`](https://github.com/dotlinux26/noiradix-studio/blob/main/js/editor-state.js) | Studio document state, cell tabs, tools, undo/redo, animation preview state |
| [`js/animation-player.js`](https://github.com/dotlinux26/noiradix-studio/blob/main/js/animation-player.js) | 4-direction / 8-direction / explicit-clip preview |
| [`js/app.js`](https://github.com/dotlinux26/noiradix-studio/blob/main/js/app.js) | Studio UI, document workflows, grid/cell editing, import/export |
| [`pixelart/js/pixelart-app.js`](https://github.com/dotlinux26/noiradix-studio/blob/main/pixelart/js/pixelart-app.js) | Standalone PixelArt editor |
| [`README.md`](https://github.com/dotlinux26/noiradix-studio/blob/main/README.md) | Product positioning and supported workflows |
| [`docs/PIXELART/ARCHITECTURE_AND_REUSE_PLAN.md`](https://github.com/dotlinux26/noiradix-studio/blob/main/docs/PIXELART/ARCHITECTURE_AND_REUSE_PLAN.md) | PixelArt architecture and canvas assumptions |

### 1.1 Current PIX2 v1.0 model

The current parsed document is centered around:

```js
{
  meta,
  palette,
  animations,
  cells
}
```

A cell is currently a sprite/frame with metadata such as `id`, `name`, `row`, `col`, `direction`, `frame`, and a flat `pixels` object keyed by `"x,y"`.

The published v1.0 grammar includes `@pix2 1.0`, `@meta`, `@grid`, `@palette`, `@cell`, `@animation`, pixel instructions, and drawing commands such as `line`, `rect`, `fill`, and `sym_dot`. It has no layer/group/region tree.

The current parser reports an unsupported-version diagnostic for headers other than `1.0`, and the current serializer emits `@pix2 1.0`. v1.1 therefore needs deliberate version dispatch and serializer support; adding new directives alone is not enough.

### 1.2 Current resource profiles

The current `js/pix2-format.js` declares:

| Profile | Max cell dimension | Max grid columns × rows | Max total cells | Max file size | Max frames per animation |
|---|---:|---:|---:|---:|---:|
| Studio | 512 | 128 × 256 | 4,096 | 20 MiB | 512 |
| PixelArt | 1,024 | 16 × 16 | 256 | 20 MiB | 64 |
| Unlimited | 2,048 | 256 × 256 | 8,192 | 50 MiB | 1,024 |

The Studio New Project dialog must not suggest dimensions outside its active profile. Raising Studio from 512 to 1,024 is a separate resource-budget decision requiring parser, memory, performance, security, export, and browser testing. This proposal does not assume that increase.

### 1.3 Current tabs are not multi-project support

`EditorState` currently owns one `doc` and an `openCellTabs` array. Those are tabs for cells being edited inside one document, not independent project/file sessions.

Studio therefore needs two levels:

1. **Project/document tabs** — one per open `.pix2` project, with independent file handle, dirty state, history, and recovery.
2. **Cell tabs** — current per-sprite/frame tabs, scoped to the active project.

PixelArt also needs a document-session model to keep multiple `.pix2` files open simultaneously.

### 1.4 Current animation and raster-import behavior

The current `AnimationPlayer` supports 4dir, 8dir, and explicit clips whose frames reference cell IDs. v1.1 must preserve this cell-reference model.

The current README describes import as PIX2 code/file import and explicitly disclaims raster-to-PIX2 autotracing. Import & Slice intentionally extends that boundary through deterministic PNG raster ingestion and metadata-driven slicing. Do not market this as vector autotracing.

---

## 2. Core architecture: Region, Group, Layer are different

Do not collapse these concepts into one overloaded “object”.

### 2.1 Region — semantic/editable ownership

A **Region** is a named, addressable artwork component: `left_eye`, `right_eye`, `mouth`, `face_outline`, `hat`, `left_arm`.

A region:
- Has a stable machine ID independent of its display name.
- Has a human-readable name and optional tags.
- Owns its own pixel/primitive content.
- Has a derived bounding box; bounds are not identity.
- Can be selected, moved, copied, transformed, hidden, locked, renamed, tagged, and edited in isolation.
- Is the natural unit for targeted agentic edits and scoped diffs.

Region identity is authored structure. Do not infer semantic regions from connected components or guess which nearby pixels belong together.

### 2.2 Group — logical hierarchy

A **Group** organizes groups and regions:

```text
Character
├── Head
│   ├── Left Eye
│   ├── Right Eye
│   └── Mouth
└── Body
    ├── Left Arm
    └── Right Arm
```

A group has a stable ID, name, optional tags, and ordered children. It can nest and be selected/moved as a collection. It does not create an independent raster compositing surface in the initial v1.1 contract. Groups are not automatically layers.

### 2.3 Layer — visual stack/compositing

A **Layer** is a renderable stacking unit. It belongs to one cell, has stable ID/name/order, and owns render properties:
- `visible`
- `locked`
- `opacity` from 0 to 1
- `blend`

For the first v1.1 implementation, support `blend: normal` only. Reserve other blend modes until their color/alpha math is normatively specified and tested across every render/export path.

### 2.4 Proposed containment rules

```text
Document
└── Cell (sprite/frame)
    └── Layer (ordered visual stack)
        ├── Region (editable semantic leaf)
        └── Group (logical container)
            ├── Region
            └── Group
                └── Region
```

Rules:

1. A cell can contain one or more layers.
2. Layers cannot be nested inside groups or other layers.
3. A group can contain groups and regions.
4. A region is a leaf in v1.1; nested regions are not part of the initial schema.
5. Every node belongs to exactly one cell and one parent layer/group.
6. Every structural node ID is unique within the document.
7. Region coordinates are cell-local in v1.1; do not introduce parent-relative coordinate spaces yet.
8. A node's visual order is deterministic and retained by serialization.
9. Editing/erasing one region must not silently mutate another region.
10. Different regions may overlap visually. Their draw order must be explicit; later siblings composite over earlier siblings under the defined normal alpha-over rule.
11. Empty regions/groups may exist during authoring, but cannot create invalid render surfaces.
12. Parent references must resolve within the same cell. Cycles and cross-cell parents are validation errors.

### 2.5 Stable IDs, names, tags

```text
id: region_4f81c2
name: "Left Eye"
tags: [face, eye, left]
```

- `id`: stable identity; renaming must not change it.
- `name`: user-facing, editable.
- `tags`: searchable labels, not identity and not a replacement for the hierarchy.
- IDs must follow safe identifier rules and reject prototype-pollution keys.
- Duplicate IDs are hard validation errors; never silently overwrite.

### 2.6 Bounds and transforms

Region bounds are derived from actual content. A cached AABB is only an optimization; it must not become the authoritative geometry.

Initial v1.1 transform contract:
- Translation uses integer-pixel offsets.
- Resize uses nearest-neighbor resampling.
- Rotation follows the editor's deterministic pixel-art resampling policy; no smoothing or fractional fringe.
- A transform affects only the selected region(s).
- Serialize updated pixel coordinates in the first release. Non-destructive transform stacks may be considered later, but must not be improvised now.

## 3. PIX2 v1.1 document model and proposed syntax

**The following syntax is a design target to refine into the final EBNF and normative test vectors.** The AST semantics and compatibility rules are more important than the provisional spelling.

### 3.1 Internal AST target

```js
{
  meta: { version: "1.1", ... },
  palette: { ... },
  cells: {
    cell_0_0: {
      id: "cell_0_0",
      name: "Idle Right 0",
      size: { w: 32, h: 32 },
      direction: "right",
      frame: 0,
      layers: [
        {
          id: "layer_character",
          name: "Character",
          visible: true,
          locked: false,
          opacity: 1,
          blend: "normal",
          children: [
            {
              type: "group",
              id: "group_head",
              name: "Head",
              children: [
                {
                  type: "region",
                  id: "region_left_eye",
                  name: "Left Eye",
                  tags: ["face", "eye", "left"],
                  pixels: { "10,9": "#ffffff" }
                }
              ]
            }
          ]
        }
      ]
    }
  },
  animations: { ... }
}
```

### 3.2 Suggested textual example

```pix2
@pix2 1.1

@meta
  title: "Noiradix Character"
  author: "Artist"
  color_mode: "RGBA"
  coordinate_origin: "top-left"

@grid
  columns: 4
  rows: 4
  default_cell: 32x32
  background: none

@palette
  1: #57546f
  2: #f8f7fb
  3: #48b8e8

@cell cell_0_0
  name: "Idle Right 0"
  direction: right
  frame: 0
  grid_pos: 0,0
  size: 32x32

@layer layer_character
  cell: cell_0_0
  name: "Character"
  visible: true
  locked: false
  opacity: 1.0
  blend: normal

@group group_head
  cell: cell_0_0
  parent: layer_character
  name: "Head"
  visible: true
  locked: false

@region region_left_eye
  cell: cell_0_0
  parent: group_head
  name: "Left Eye"
  tags: [face, eye, left]
  p 10,9 2
  p 10,10 2

@region region_right_eye
  cell: cell_0_0
  parent: group_head
  name: "Right Eye"
  tags: [face, eye, right]
  p 20,9 2
  p 20,10 2

@animation idle_right
  name: "Idle Right"
  direction: right
  action: idle
  frames: [cell_0_0, cell_0_1]
  fps: 5
  loop: true
```

Implementation requirements:

- Every layer/group/region declares its owning `cell`.
- Non-layer nodes declare a `parent` referring to a layer/group in that same cell.
- Top-level layers are ordered in declaration order; children retain declaration order within their parent.
- Region drawing commands use that region's cell-local coordinate space.
- Emit precise line/column diagnostics for missing cell, missing parent, invalid/duplicate IDs, wrong parent type, cross-cell reference, cycle, invalid opacity, unsupported blend, and out-of-bounds coordinates.
- The final syntax may choose a more compact nested grammar, but AST semantics and compatibility rules must remain unchanged.

### 3.3 Legacy content in v1.1

If old pixel operations appear directly inside `@cell`, the v1.1 reader may normalize them into one deterministic default layer + region for that cell. The v1.1 serializer should emit canonical explicit structure after the user upgrades/saves as v1.1.

Do not allow ambiguous ownership for new v1.1 drawing commands. Report a diagnostic rather than silently attaching content to an unexpected region.

### 3.4 Serialization and deterministic rendering

- Serializing the same normalized AST twice must produce byte-identical text.
- Preserve stable IDs, names, tags, child order, layer order, opacity, visibility, lock flags, and animation metadata.
- Serialize region content deterministically (stable pixel ordering and primitive ordering).
- Render layers in declared order; recursively traverse groups in child order; render each region's content in stable instruction order.
- Baseline blend is normal source-over alpha compositing; layer opacity multiplies source alpha.
- Hidden ancestors hide descendants. Locked ancestors prevent direct edits to descendants unless a deliberate override is documented.
- PNG/atlas frames are flattened composites of visible layers; native PIX2 remains structurally editable.
- Do not silently export hidden layers.

---

## 4. Backward compatibility and migration

Compatibility is a release gate.

### 4.1 PIX2 v1.0 remains readable

A v1.1-capable parser must continue to parse every valid v1.0 file accepted by current conformance tests.

Normalize a v1.0 cell without structural data internally as:

```text
Cell
└── Layer: layer_legacy_<cellId>
    └── Region: region_legacy_<cellId>
        └── old pixels / primitives
```

Generated IDs must be deterministic for that cell, not random on every load. Opening v1.0 must not silently change the file's version. Keep it v1.0 until the user explicitly chooses **Upgrade to PIX2 1.1** or saves a v1.1 copy.

### 4.2 Upgrade path

**File → Upgrade Document to PIX2 1.1**

1. Parse and validate the original v1.0 document.
2. Create a v1.1 normalized AST with one default layer/region per cell.
3. Preserve pixel coordinates, colors, palette, metadata, cell IDs/order, animation names, animation frame references, fps, loop mode, and directions.
4. Run a render-equivalence check for every cell.
5. Create an undo/recovery snapshot.
6. Mark the document structurally upgraded/dirty.
7. Do not overwrite the original until the user saves; recommend Save As on first upgrade.

### 4.3 Downgrade/export to v1.0

A v1.1 document can be exported to v1.0 only by explicit user action.

- Composite visible layer content per cell.
- Respect layer order and opacity.
- Preserve cell IDs and animation references.
- Warn that group/region IDs, names/tags, layer names/visibility/locks/opacity, and other structural organization are lost.
- If v1.1 contains unsupported blend modes/constructs, block or require confirmed flattening; never approximate silently.
- Save to a new file by default.

Older v1.0-only builds must reject a v1.1 file safely. They must not parse it as v1.0 or silently drop structural sections.

### 4.4 Canonical fixtures

Add official fixtures:
- Minimal valid v1.0.
- Existing full NOIRADIX Ghost v1.0.
- Minimal v1.1 one-layer/one-region.
- Multi-layer document with overlapping regions.
- Nested group document.
- Multiple cells with distinct layer trees.
- Platformer 2dir animation document.
- Invalid duplicate ID, cycle, missing parent, cross-cell reference, invalid opacity, unsupported blend.
- v1.0 → normalized AST → v1.1 → parse → render equivalence.
- v1.1 → flatten → v1.0 with an expected metadata-loss report.

---

## 5. NOIRADIX Studio 2.0 editing UX

### 5.1 Workspace layout

Add a **Layers / Structure** panel to the existing workspace. Keep Grid Overview, Animation Studio, and PIX2 Code experiences. Add Import & Slice as a dedicated top-level tab.

```text
┌──────────────────────────────────────────────────────────────┐
│ Project tabs: Ghost.pix2 | Player.pix2 | +                  │
├──────────────┬─────────────────────────────┬─────────────────┤
│ Tools        │ Cell / Canvas editor        │ Structure       │
│ Select       │ Region labels / bounds      │ Layers          │
│ Region       │ Canvas                      │ Character       │
│ Pen          │                             │  ├ Head         │
│ Eraser       │                             │  │  ├ Left Eye  │
│ ...          │                             │  │  └ Right Eye │
│              │                             │ Body            │
├──────────────┴─────────────────────────────┴─────────────────┤
│ Status: cell / dimensions / zoom / selected region / dirty   │
└──────────────────────────────────────────────────────────────┘
```

Do not replace the existing grid/animation views. Add capabilities without breaking current navigation.

### 5.2 Region Select mode

Add a dedicated **Region Select** mode in both Studio's cell editor and PixelArt:

- Show visible region/group bounds as colored outlines.
- Show a small name tag on/near each region, with a compact node-type marker.
- Let users toggle label visibility to avoid clutter.
- Click selects a region; click-drag moves a selected region/group.
- Ctrl/Cmd-click toggles additional regions in a multi-selection.
- Selecting a group selects its descendants as a logical composite.
- Locked nodes cannot be transformed; show a lock affordance.
- Hidden nodes are not hit-testable on canvas but remain accessible in the structure tree.
- For overlapping regions, topmost visible region wins plain-click hit-testing; add modifier cycling only if needed.

Region Select must not paint. Normal marquee selection remains a separate canvas tool.

### 5.3 Isolation mode

Double-clicking a region enters **Region Isolation Mode**:

- Only the active region is directly editable.
- Other regions remain as dimmed context, with an option to hide them.
- Show breadcrumb path such as `Character / Head / Left Eye`.
- Drawing, erasing, fill, paste, and selection operations are scoped to the isolated region.
- Esc exits isolation and restores the previous context.
- Double-click outside also exits isolation.
- Provide a visible Exit Isolation control.
- Double-clicking a group isolates its descendants.
- A locked node may be inspected but not edited.

### 5.4 Region metadata inspector

Expose:
- Display name
- Stable ID (read-only by default, copyable)
- Tags editor
- Visibility / lock
- Computed bounds
- Parent group and owning layer
- Pixel/primitive count
- Select content
- Rename / duplicate / delete
- Move to…
- Create group from selection
- Extract selection to new region

Never derive identity from the label text. Rename must not break references.

### 5.5 Layer panel

Minimum actions:
- Add, rename, duplicate, delete layer
- Visibility and lock toggles
- Reorder by drag/drop
- Opacity slider from 0–100%
- Expand/collapse groups
- Add group and move selected regions into it
- Move region/group between layers
- Confirm deletion of non-empty layers
- Merge/flatten layers only as an explicit destructive operation with undo and warning

Do not expose unsupported blend modes. `Normal` is the only guaranteed v1.1 mode initially.

### 5.6 Shared selection/transform engine

PixelArt currently has richer selection transforms, including free-angle rotation; Studio's cell editor has a more limited selection path. Share one selection geometry/transform contract and common tests.

Required parity:
- Rectangular marquee
- Move, copy/cut/paste
- Nudge by one pixel (optional modifier nudge by a documented larger step)
- Free-angle rotate with nearest-neighbor rasterization
- Horizontal/vertical flip
- Scale handles around selection bounds
- Keyboard shortcuts to zoom around pointer/selection without moving selected content
- Esc cancels active transform or exits isolation according to a documented priority order

**Resize interaction proposal:**
- Corner drag without Shift: free X/Y scaling.
- Shift + corner drag: uniform scaling, preserving aspect ratio.
- Side handle: scale on that axis only.
- Keep nearest-neighbor resampling; no blur.
- Show live preview; commit on pointer release/Enter; Esc cancels.
- Keep original content recoverable through undo.

The interaction must be identical in Studio and PixelArt even if surrounding toolbars differ.

### 5.7 Undo/redo

Undo history must understand:
- Create/delete/rename/move region
- Create/delete/reorder layer
- Group/ungroup
- Visibility/lock/opacity changes
- Region move/transform
- Region-scoped paint/erase
- Merge/flatten
- Any imported-document transaction

Structural changes must not bypass dirty tracking. Undo restores structure and pixels atomically.

## 6. Animation system: Platformer 2D (Left/Right)

### 6.1 Preserve current templates

Keep 4-direction, 8-direction, and explicit custom animation clips. Add **Platformer 2D (Left/Right)**. Do not reinterpret an existing `direction: left/right` 4dir/8dir project just because it is opened by Studio 2.0. Template metadata must identify the intended model.

### 6.2 Platformer action model

Default action families:

| Action | Facing variants | Purpose |
|---|---|---|
| Idle | left, right | Stand / breathe |
| Run | left, right | Horizontal movement |
| Jump | left, right | Ascending / take-off |
| Fall | left, right | Descending |
| Optional Land | left, right | Landing transition |

Suggested clips:

```pix2
@animation idle_left
  name: "Idle Left"
  direction: left
  action: idle
  frames: [cell_0_0]
  fps: 5
  loop: true

@animation run_left
  name: "Run Left"
  direction: left
  action: run
  frames: [cell_1_0, cell_1_1, cell_1_2, cell_1_3]
  fps: 10
  loop: true

@animation jump_left
  name: "Jump Left"
  direction: left
  action: jump
  frames: [cell_2_0, cell_2_1, cell_2_2]
  fps: 10
  loop: false
```

Use the current explicit animation frame-reference model. `mode` continues to mean loop/once/ping-pong; do not repurpose it to mean template type.

### 6.3 Sheet layout

Default platformer tracks:
- Idle Left
- Idle Right
- Run Left
- Run Right
- Jump Left
- Jump Right
- Fall Left
- Fall Right

Each track uses columns for its frame sequence. Track action/facing are metadata; animation clips explicitly reference cell IDs. The default number of frames per track is editable. Empty cells must not be silently inserted into clips.

### 6.4 Animation preview upgrades

Add template selector (4dir / 8dir / Platformer 2D / Custom), action selector, facing selector, FPS, loop/once/ping-pong, frame stepping, frame index/cell ID, and missing-clip diagnostics.

Resolve explicit clip references first. Direction/action auto-detection is a convenience fallback, not an ambiguity resolver. If `fall_left` is missing, do not silently play `run_left` unless the document explicitly defines a fallback.

---

## 7. Import & Slice — PNG / spritesheet to PIX2

Add **Import & Slice** as a dedicated top-level tab alongside Grid Overview and Animation Studio. It is an ingestion workflow, not a replacement for opening native `.pix2` projects.

### 7.1 Supported input modes

1. **PNG only — manual slicing:** draw one or more rectangles, name each slice, assign each to a new cell or existing project, preserve source size and alpha.
2. **PNG only — grid slicing:** cell width/height, rows/columns, margins/spacing, optional transparent-border trim, preview before commit.
3. **PNG only — alpha-connected auto-slice:** explicit 4- or 8-connectivity, configurable alpha threshold, manual merge/split correction; do not infer semantic parts; warn about touching components that cannot be separated.
4. **PNG + JSON metadata:** import frame rectangles and names through a recognized adapter; create clips if animation sequences exist in the metadata.

### 7.2 Initial metadata adapters

Use a strict adapter interface:

```ts
interface AtlasMetadataAdapter {
  id: string;
  detect(json: unknown): boolean;
  parse(json: unknown, image: ImageInfo): AtlasImportPlan;
}
```

Initial adapters:
- NOIRADIX's own `.pix2.json` package metadata (inspect the exact current exporter schema before implementation).
- TexturePacker JSON Hash.
- TexturePacker JSON Array.

Do not claim support for arbitrary JSON. Do not hand-edit or guess at arbitrary Unity `.meta` serialization. Unity Sprite metadata is importer/editor data; the Sprite Editor exposes SpriteRect records and supports manual and automatic slicing. If direct Unity-project import is needed later, add a Unity Editor exporter that emits a documented neutral JSON manifest. References: [Unity SpriteMetaData](https://docs.unity.com/en-us/engine/7000.0/script-reference/unityeditor/spritemetadata), [Unity sprite slicing workflow](https://docs.unity.com/en-us/engine/7000.0/manual/unity2d/sprite/use-editor).

TexturePacker Hash/Array formats commonly store frame rectangles and, for trimmed frames, original size/offset information. Preserve these; do not mistake a trimmed crop for the full logical frame. References: [JSON Hash](https://packrat.clyde.games/json-hash.html), [JSON Array](https://packrat.clyde.games/json-array.html).

### 7.3 Metadata fields and edge cases

Adapters must handle or explicitly reject:
- `frame` rectangle x/y/w/h
- `rotated`
- `trimmed`
- `spriteSourceSize`
- `sourceSize`
- `pivot`
- optional `duration`
- optional `animations`
- optional multi-page textures

If a field cannot be interpreted faithfully (unsupported rotation encoding, malformed trim geometry, missing page image, out-of-bounds rectangle), stop that import item with a clear diagnostic. Never guess and silently return a distorted sprite.

### 7.4 Import pipeline

```text
Input files
  ↓
File type / size validation
  ↓
PNG decode (preserve RGBA)
  ↓
Optional JSON adapter detection
  ↓
Build import plan (rects, names, pivots, frame sequences)
  ↓
User preview / adjust / rename / assign
  ↓
Create cells + default Layer + imported Region per sprite
  ↓
Create animation clips when metadata/user assignment provides sequences
  ↓
Render-equivalence / pixel count / bounds validation
  ↓
Commit as one undoable document transaction
  ↓
Save native PIX2
```

The PNG raster becomes pixel data in a named region, not a vector path. Initial import can create one region per imported sprite/frame; later users can split/group regions using the structural tools.

### 7.5 Large PNG and memory handling

- Inspect dimensions before allocating large intermediate canvases.
- Enforce explicit file size and dimension limits.
- Use an import plan/preview before creating the final document.
- Never silently downscale. If over profile limits, offer reject/crop/resize with a clear target size and resampling choice. For pixel art, nearest-neighbor is the default.
- Preserve alpha; do not replace transparent pixels with white.
- Avoid repeated full-image `getImageData()` copies where possible.
- If decode/allocation fails, leave the active project untouched.
- Import is one undoable transaction.
- Multi-page atlases must be explicit.
- Normalize coordinates to PIX2 top-left origin.

### 7.6 Slice naming and animation mapping

- Default names may be `sprite_001`, etc.; users can rename before commit.
- Preserve metadata animation names and frame order.
- For manual slicing, provide sequence assignment: select slices → create animation → choose order → set fps/loop.
- Support natural filename sorting, grid row/column order, and manual drag order.
- Detect duplicate names; resolve without overwriting IDs.

---

## 8. New Project dialog: resolution, template, layout

Replace the bare grid/dimensions form with a guided project-creation dialog. Keep **frame resolution**, **sheet layout**, and **animation template** separate.

### 8.1 Frame dimensions

Presets within the current Studio profile maximum of 512×512:

**Micro:** 16×16, 24×24, 32×32  
**Standard:** 48×48, 64×64, 96×96  
**Large:** 128×128, 192×192, 256×256  
**Wide / platform:** 192×108, 320×180, 512×288, 512×512  
**Custom:** integer width/height within the active resource profile.

Show active profile maximum, estimated pixels/frame and total canvas area. Preserve aspect ratio only when the user explicitly links dimensions. Presets are suggestions, not the only valid sizes.

Do not silently present 1,024×1,024 as a Studio preset while Studio parser profile still caps cells at 512. PixelArt profile currently permits 1,024. Any Studio cap increase requires a separate performance/security decision.

That include re-adjust dimension can be change after create (can ref of re dimension change from pixelart editer side project)

### 8.2 Template

- Blank / Custom
- Static Sprite
- 4-Direction Character
- 8-Direction Character
- Platformer 2D (Left/Right)

Potential future templates: top-down idle/walk/attack, isometric, effects/VFX.

A template creates metadata and initial animation tracks; it must not force users to keep the preset layout.

### 8.3 Sheet layout

- Single cell
- Fixed grid (rows × columns)
- Animation tracks (one row per action/facing track)
- Custom layout

Explain what rows/columns mean for the selected template. Do not display one template and silently allocate another template's row semantics.

### 8.4 Project details

Project title, filename, author (optional), background mode, palette preset, Create/Cancel. Before creation show a summary: frame size, number of cells, template, sheet layout, and active limits.

---

## 9. Multi-document workflow and drag/drop

### 9.1 Project tabs

Add project-level tabs, separate from existing cell tabs. Each open document owns its own AST, file handle/path/name, dirty/revision state, history, recovery/autosave, active cell, animation-preview state, and selection state.

Switching tabs must not serialize or overwrite another tab's in-progress content. Save/Save As act on the active project only. Closing dirty project tabs prompts Save / Discard / Cancel. Maintain recent files and restore session tabs where browser permissions permit. Lazy-render inactive projects; do not retain full-resolution backing surfaces for every tab.

### 9.2 Drag/drop routing

Show a clear app-window drop overlay. Classify files:

| File | Default behavior |
|---|---|
| `.pix2` | Open as a new project tab |
| `.png` | Open Import & Slice with image loaded |
| Supported atlas `.json` with matching PNG | Pair and open Import & Slice |
| `.json` without recognized/matching image | Show metadata-only diagnostic |
| `.zip` | Import only documented NOIRADIX package archives; otherwise explain unsupported |

Multiple `.pix2` files open as separate project tabs. A PNG + JSON pair is matched using metadata image name/path where possible; otherwise show a pairing step. Do not assume drop order. Do not auto-open unexpected types. Prevent path traversal for ZIP entries. Duplicate already-open files require an explicit reopen/replace choice. Dropped files must not replace dirty content without confirmation.

---

## 10. PixelArt editor 2.0 alignment

PixelArt remains the dedicated standalone large-canvas illustration tool but adopts the shared structural model.

Required:
- Parse/render/edit PIX2 1.1 layers, groups, regions.
- Structure/Layers panel and Region Select.
- Region isolation, tags, and scoped operations.
- Shared selection transform math and nearest-neighbor resampling with Studio.
- Multiple `.pix2` document tabs.
- File drag/drop.
- Preserve large-canvas workflows, rulers, symmetry, floating selection, export, autosave/recovery, and disk watcher.
- Do not regress large-canvas performance while adding layer compositing.
- PNG export composites visible layer stack and commits floating selections.

Standalone editor maximum profile stays 1,024×1,024 unless performance architecture is deliberately changed and validated.

---

## 11. Version labels, About modals, release identity

### 11.1 Distinguish versions

Display:
- Product: `NOIRADIX Studio v2.0.0` / `NOIRADIX PixelArt v2.0.0`
- Format capability: `PIX2 v1.1`

Never call product version “PIX2 2.0” or format version “Studio 1.1”.

### 11.2 One source of truth

Use one application version source (e.g. `js/version.js` or a static version manifest) consumed by both About modals, footer/status, and release notes workflow. Do not scatter literal version strings across HTML.

### 11.3 About UI

Both About modals include product name/logo, version and channel (Stable/Beta/RC), PIX2 capability badge, concise release summary, GitHub repository, Discord Community, docs/changelog, and license.

The UI must not claim PIX2 1.1 support until parser, serializer, validator, editor, importer, and exporter gates pass.

---

## 12. GitHub tags and release process

The current `.github/workflows/deploy.yml` is main/PR oriented (plus manual dispatch); it does not currently define a tag-push trigger. Add tag verification deliberately rather than assuming a tag automatically runs the normal CI.

### 12.1 Version policy

Application uses SemVer: `v2.0.0-beta.1`, `v2.0.0-rc.1`, `v2.0.0`. PIX2 uses its own in-file language version: `@pix2 1.1`.

Never retarget/force-move a published stable tag. Corrections become a new patch version, e.g. `v2.0.1`.

### 12.2 Release checklist

1. Merge reviewed work into `main`.
2. Confirm clean worktree and record exact release commit SHA.
3. Run syntax, parser conformance, migration, security, editor, import/export, and UI regression tests.
4. Confirm GitHub Actions is green for the exact commit.
5. Update release notes and user-facing docs.
6. Update the one application version source.
7. Create an annotated tag pointing to the exact release commit.
8. Push the tag.
9. Create a GitHub Release from that existing tag; use Draft while assets/notes are still reviewed.
10. Publish; verify tag, release page, deployed app version, About modal, and smoke tests.

Example:

```bash
git switch main
git pull --ff-only origin main
git status --short
# Run the documented test commands and confirm CI is green.
git rev-parse HEAD
git tag -a v2.0.0 -m "NOIRADIX Studio v2.0.0"
git push origin v2.0.0
```

Then create a release from the existing tag in GitHub Releases UI, or:

```bash
gh release create v2.0.0 \\
  --title "NOIRADIX Studio 2.0.0" \\
  --notes-file RELEASE_NOTES.md
```

For a prerelease, use e.g. `v2.0.0-rc.1` and `--prerelease`. Follow [GitHub's release management guide](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).

### 12.3 CI changes

- Add a tag-push trigger such as `v*` to a test workflow, or create a dedicated release-validation workflow.
- Tag builds run the same tests used for `main`.
- Keep deployment deliberate: tag CI does not imply deploy from tag unless configured and tested.
- Validate that app display version equals tag version.
- Keep release notes in the repository so each release is reproducible.

---

## 13. Non-functional requirements and safety

### 13.1 Zero runtime dependencies

Preserve the current static, zero-runtime-dependency application architecture. Do not introduce a framework or bundler requirement merely to implement the structural editor.

### 13.2 Resource limits

Add PIX2 1.1 bounds for structural nodes, max nesting depth, tag count/length, names, parser complexity, and file size. Reject pathological depth/cycles before rendering. Prefer iterative traversal where safe. Preserve safe identifier/prototype-pollution protections. Never silently truncate structural nodes. Show limits in New Project and Import dialogs.

### 13.3 Determinism

The same document and render settings must produce the same composite pixels in Studio, PixelArt, animation preview, PNG export, and game-engine exports. Specify/test alpha and color behavior where browser APIs differ.

### 13.4 Performance

Do not claim 60 FPS or a speedup without measurements. Record frame size, layer/region counts, visible regions, browser/version, DPR, memory/backing estimates, median/p95 render time, input-to-paint latency, import time, and memory estimate. Do not serialize the full PIX2 text on every pointer move.

### 13.5 Accessibility

All layer/region actions must be keyboard- and pointer-accessible. Hover labels cannot be the only way to discover a name. Distinguish selected/locked/hidden/isolated states without relying only on color. Destructive actions need reliable undo or confirmation.

---

## 14. Phased implementation roadmap

Do not implement every feature in one unreviewed mega-commit. Keep every phase independently testable.

### Phase 0 — Architecture lock / RFC
Deliver final AST schema, EBNF, ownership/overlap/draw order/alpha/visibility/lock rules, resource limits, v1.0 compatibility policy, import adapters, UI wireflows, and test matrix.

**Gate:** No production UI implementation until AST and compatibility contracts are reviewed.

### Phase 1 — PIX2 1.1 core
Add version-aware parser, v1.1 AST, validator, serializer, deterministic v1.0 normalization, explicit upgrade/downgrade, structural resource limits, and fixtures.

**Gate:** All v1.0 vectors and visual outputs remain unchanged; v1.1 roundtrips byte-identically.

### Phase 2 — Shared document/render engine
Add layers/groups/regions per cell, compositing, region ownership, structural dirty tracking/undo, and a shared render API for editor, grid thumbnails, animation preview, and exports.

**Gate:** No v1.0 visual regression across cells or exporters.

### Phase 3 — Studio and PixelArt editing UX
Add Structure/Layers panel, Region Select, labels/tags, group selection, isolation, shared transforms, layer visibility/lock/opacity/reorder, multi-selection and scoped editing.

**Gate:** Same region/selection operations yield same documents and pixels in both editors.

### Phase 4 — Platformer 2D animation
Add platformer template metadata/tracks, action/facing resolution, New Project template, preview controls, and missing-clip diagnostics. Preserve 4dir/8dir.

**Gate:** Existing fixtures play identically; platformer fixtures resolve correct cell IDs.

### Phase 5 — Import & Slice
Add PNG manual/grid/alpha slicing, NOIRADIX and TexturePacker JSON adapters, trim/rotation/source-size/pivot behavior, cell/region/animation creation, large-image guards and undo transaction.

**Gate:** Imported composite exactly matches source slices; generated PIX2 reopens identically.

### Phase 6 — Multi-document + drag/drop
Add project tab/session manager, per-document dirty/save/history/recovery, drop overlay/routing, PNG+JSON pairing, close prompts, and lazy inactive rendering.

**Gate:** No cross-contamination of documents/file handles/dirty states.

### Phase 7 — New Project, About, version, release
Redesign New Project, display profile limits/custom sizes, About/version badges, one version source, tag CI and release process, and update README/spec/migration/docs.

**Gate:** Product/format labels are accurate and release tag points to tested code.

---

## 15. Acceptance criteria / definition of done

### PIX2 core
- [ ] Current v1.0 normative vectors pass unchanged.
- [ ] Every valid v1.0 fixture renders pixel-identically in v2.0.
- [ ] v1.0 files load as deterministic implicit layer/region.
- [ ] Upgrade preserves palette, IDs, grid, pixels, animations, fps, loop and directions.
- [ ] v1.1 serialize → parse → serialize is byte-identical.
- [ ] Duplicate IDs, missing parents, cycles, cross-cell parents, bad opacity, unsupported blend, unsafe IDs fail validation.
- [ ] Overlap order and alpha composition are deterministic.
- [ ] Downgrade produces a loss report and does not silently overwrite the original.

### Studio / PixelArt
- [ ] Region Select shows region/group boundaries and labels.
- [ ] Click selects, drag moves, double-click isolates, Esc exits.
- [ ] Isolation protects other regions.
- [ ] Layer visibility/lock/opacity/order changes render consistently.
- [ ] Studio and PixelArt share selection transform behavior.
- [ ] Shift-corner resize preserves aspect ratio; side handles scale one axis; no blur.
- [ ] Undo/redo restores both structure and pixels.
- [ ] v1.0 documents remain editable without manual migration.

### Animation
- [ ] Existing 4dir/8dir projects play as before.
- [ ] Platformer action/facing clips resolve by explicit cell IDs.
- [ ] Missing clips show diagnostics, not a wrong fallback.
- [ ] FPS, loop modes and frame stepping work.

### Import
- [ ] PNG manual, grid and alpha slicing work.
- [ ] Recognized JSON adapters import rectangles/names exactly.
- [ ] Trimmed/rotated metadata is reconstructed exactly or rejected precisely.
- [ ] PNG alpha/color values are preserved.
- [ ] Import failure leaves active project unchanged.
- [ ] Import is one undoable transaction.
- [ ] No silent downscaling or metadata loss.

### Multi-file
- [ ] Multiple `.pix2` files stay open independently.
- [ ] Tabs have independent file handles, dirty states, undo stacks and recovery.
- [ ] Drag/drop routes supported files correctly.
- [ ] Closing dirty tabs prompts Save/Discard/Cancel.
- [ ] Dropped files never overwrite dirty content without confirmation.

### Release
- [ ] About shows correct app SemVer.
- [ ] PIX2 support badge displays v1.1 only after all gates pass.
- [ ] Tag CI passes on exact release tag.
- [ ] GitHub Release points to the intended commit and has complete notes.
- [ ] Docs explain migration, imports, templates and limitations.

---

## 16. Suggested user-facing product language

The proposed line “Stop slicing sprites like it's 2010. Let NOIRADIX do the grunt work.” is memorable but can overpromise when assets have no metadata and still require manual slicing.

Safer primary positioning:

> **Turn sprite sheets into editable, structured PIX2 projects.**

Optional campaign line:

> **Bring the sheet. Keep every frame editable.**

Suggested v2.0 one-liner:

> **NOIRADIX Studio 2.0 — Structured pixel art, named regions, multi-layer editing, and smarter sprite-sheet workflows.**

---

## 17. External references

- [GitHub Docs — Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [Unity Docs — SpriteMetaData](https://docs.unity.com/en-us/engine/7000.0/script-reference/unityeditor/spritemetadata)
- [Unity Docs — Cut out sprites from a texture](https://docs.unity.com/en-us/engine/7000.0/manual/unity2d/sprite/use-editor)
- [TexturePacker-compatible JSON Hash](https://packrat.clyde.games/json-hash.html)
- [TexturePacker-compatible JSON Array](https://packrat.clyde.games/json-array.html)

---

## 18. Final instruction

Treat this as one coordinated product/format program but keep it phased. First make the format and normalized AST correct. Then make the render/edit engine consume it. Then upgrade both editors. Then add platformer animation and the importer. Finally add multi-file UX, New Project, About/version and release automation.

**Never ship a UI affordance the serialized format cannot preserve. Never ship a parser that silently discards structure. Never claim compatibility based only on the fact that a file opens.**
