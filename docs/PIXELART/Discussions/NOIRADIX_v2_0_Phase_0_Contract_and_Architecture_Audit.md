# NOIRADIX Studio 2.0 & PIX2 1.1 — Phase 0 Contract & Architecture Audit Record

**Document Version:** 1.0.0  
**Target Product Release:** NOIRADIX Studio `2.0.0` / NOIRADIX PixelArt `2.0.0`  
**Target Format Release:** PIX2 `1.1`  
**Baseline Inspected:** `dotlinux26/noiradix-studio`, branch `main`, commit `f0bc808129bf22ec60fc21b05a13787020c5e60f`  
**Date:** 2026-11-09  
**Status:** FROZEN PHASE 0 SPECIFICATION & CONTRACT  

---

## 1. Baseline Audit & Change History (Commit `6c8883d` to `f0bc808`)

The planning baseline commit was `6c8883da71a9b1aaebb3cacc61dd2779f0ccea03`. Seven verified commits have since landed on `main`:

| Commit | Summary | Source Files Touched |
| :--- | :--- | :--- |
| `13af922` | Core audit fixes: save revision race condition, new canvas discard guard, summary mode trap, studio new project guard, adaptive zoom cap, and watcher false-positive prevention | `js/app.js`, `pixelart/js/pixelart-app.js`, `tests/` |
| `5794a5d` | PixelArt 8x maximum zoom for both 1024x1024 and 512x512 with 16384px ruler clamp | `pixelart/js/pixelart-app.js` |
| `01debb9` | Data-integrity hardening: O(M) delta history, IndexedDB v2 recovery, and zoom safety invariants | `pixelart/js/pixelart-app.js` |
| `adfa93a` | Save after undo fix, real-time ruler blit, watcher false-positive prevention, and backup safety | `pixelart/js/pixelart-app.js` |
| `12d85b6` | Watcher strict string equality, history stroke baseline continuity, and ruler pan invalidation | `pixelart/js/pixelart-app.js` |
| `d4a112f` | Save concurrency counter lock (`activeSaveOperations`), watcher focus verification, and backup identity validation | `pixelart/js/pixelart-app.js`, `tests/test-audit-integrity.js` |
| `f0bc808` | W3C FileSystemHandle `isSameEntry()` identity validation, unverified draft UI transparency, and behavioral test suite hardening | `pixelart/js/pixelart-app.js`, `tests/test-audit-integrity.js` |

All 158 tests across 5 test suites pass with 100% success on the current HEAD. The working tree is clean.

---

## 2. Phase 0 Architectural Contract

### 2.1 Normalized AST Schema

The PIX2 1.1 AST represents sprite sheets as structured, layered, hierarchical vector/pixel documents:

```typescript
interface Pix2Document {
  meta: Pix2Meta;
  palette: Record<string, string>; // Shorthand color table: "1": "#ffffff"
  cells: Record<string, CellNode>; // Decoupled cell collection
  animations: Record<string, AnimationClip>; // Directional & action sequences
}

interface Pix2Meta {
  title: string;
  author?: string;
  version: "1.0" | "1.1";
  grid: { columns: number; rows: number };
  cellSize: { w: number; h: number };
  color_mode?: "RGBA" | "RGB";
  coordinate_origin?: "top-left";
  [key: string]: unknown;
}

interface CellNode {
  id: string; // e.g. "cell_0_0"
  name: string; // e.g. "Idle Right 0"
  size: { w: number; h: number };
  row?: number;
  col?: number;
  grid_pos?: [number, number];
  direction?: string; // "down" | "up" | "right" | "left" | ...
  frame?: number;
  layers: LayerNode[]; // Ordered render stack: index 0 = bottom, index N-1 = top
  pixels?: Record<string, string>; // Flat fallback cache for v1.0 backwards compatibility
}

interface LayerNode {
  type: "layer";
  id: string; // Unique within document
  cell: string; // Owning cell ID
  name: string; // User-facing display name
  visible: boolean; // Default true
  locked: boolean; // Default false
  opacity: number; // 0.0 to 1.0 (default 1.0)
  blend: "normal"; // Strictly "normal" in v1.1
  children: Array<GroupNode | RegionNode>; // Sibling order: index 0 = bottom
}

interface GroupNode {
  type: "group";
  id: string; // Unique within document
  cell: string; // Owning cell ID
  parent: string; // Owning Layer ID or Group ID
  name: string; // User-facing display name
  visible: boolean; // Inherits visibility; default true
  locked: boolean; // Inherits lock; default false
  tags: string[]; // Searchable labels
  children: Array<GroupNode | RegionNode>;
}

interface RegionNode {
  type: "region";
  id: string; // Unique within document (e.g. "region_left_eye")
  cell: string; // Owning cell ID
  parent: string; // Owning Layer ID or Group ID
  name: string; // User-facing display name (e.g. "Left Eye")
  tags: string[]; // Searchable labels (e.g. ["face", "eye", "left"])
  visible: boolean; // Default true
  locked: boolean; // Default false
  pixels: Record<string, string>; // Cell-local "x,y" => hexColor or paletteKey
  primitives?: PrimitiveCommand[]; // Optional high-level commands (line, rect, fill, sym_dot)
}

interface AnimationClip {
  name: string;
  direction?: string; // 4dir / 8dir / 2dir direction
  action?: string; // Platformer action: "idle" | "run" | "jump" | "fall" | "land"
  template?: "platformer_2dir" | "4dir" | "8dir" | "custom";
  frames: string[]; // Explicit cell IDs in sequence order
  fps: number; // Frames per second (default 6)
  loop: boolean; // Continuous loop
  mode?: "loop" | "once" | "pingpong";
}
```

---

### 2.2 PIX2 1.1 Extended Grammar (EBNF)

```ebnf
Document        ::= VersionDirective HeaderSection* CellSection* AnimationSection* EndDirective?

VersionDirective::= "@pix2" WS ("1.0" | "1.1") NL

HeaderSection   ::= MetaSection | GridSection | PaletteSection

MetaSection     ::= "@meta" NL (WS Property NL)*
GridSection     ::= "@grid" NL (WS Property NL)*
PaletteSection  ::= "@palette" NL (WS PaletteEntry NL)*

CellSection     ::= CellHeader NL (LayerSection | GroupSection | RegionSection | LegacyDrawingCommand)*

CellHeader      ::= "@cell" WS Identifier NL (WS Property NL)*

LayerSection    ::= "@layer" WS Identifier NL (WS LayerProperty NL)*
LayerProperty   ::= "cell:" WS Identifier
                  | "name:" WS QuotedString
                  | "visible:" WS Boolean
                  | "locked:" WS Boolean
                  | "opacity:" WS Float
                  | "blend:" WS ("normal")

GroupSection    ::= "@group" WS Identifier NL (WS GroupProperty NL)*
GroupProperty   ::= "cell:" WS Identifier
                  | "parent:" WS Identifier
                  | "name:" WS QuotedString
                  | "visible:" WS Boolean
                  | "locked:" WS Boolean
                  | "tags:" WS "[" (Identifier ("," WS Identifier)*)? "]"

RegionSection   ::= "@region" WS Identifier NL (WS RegionProperty | DrawingCommand NL)*
RegionProperty  ::= "cell:" WS Identifier
                  | "parent:" WS Identifier
                  | "name:" WS QuotedString
                  | "visible:" WS Boolean
                  | "locked:" WS Boolean
                  | "tags:" WS "[" (Identifier ("," WS Identifier)*)? "]"

DrawingCommand  ::= PixelCmd | LineCmd | RectCmd | FillCmd | SymDotCmd
PixelCmd        ::= "p" WS Coord WS ColorRef
LineCmd         ::= "line" WS Coord WS Coord WS ColorRef
RectCmd         ::= "rect" WS Coord WS Dimension WS ColorRef (WS ("outline" | "fill"))?
FillCmd         ::= "fill" WS Coord WS ColorRef
SymDotCmd       ::= "sym_dot" WS Coord WS ColorRef

Coord           ::= Integer "," Integer
Dimension       ::= Integer "x" Integer
ColorRef        ::= PaletteId | HexColor
PaletteId       ::= Integer
HexColor        ::= "#" [0-9a-fA-F]{6} | "#" [0-9a-fA-F]{8}

AnimationSection::= "@animation" WS Identifier NL (WS AnimProperty NL)*
AnimProperty    ::= "name:" WS QuotedString
                  | "direction:" WS Identifier
                  | "action:" WS Identifier
                  | "template:" WS Identifier
                  | "frames:" WS "[" (Identifier ("," WS Identifier)*)? "]"
                  | "fps:" WS Integer
                  | "loop:" WS Boolean
                  | "mode:" WS ("loop" | "once" | "pingpong")
```

---

### 2.3 Stable Identity, Naming, and Tag Rules

1. **`id`**: Unique alphanumeric identifier (e.g. `layer_character`, `group_head`, `region_left_eye`).
   - Must satisfy `isSafeIdentifier(id)`. Rejects prototype property collisions (`__proto__`, `constructor`, `toString`, etc.).
   - Immutable across user rename operations.
   - Duplicate IDs within a document fail validation as fatal errors.
2. **`name`**: Display string (e.g. `"Left Eye"`).
   - Editable in UI and serialized to `name: "..."`.
   - Renaming modifies only the `name` property; all references retain the immutable `id`.
3. **`tags`**: List of string tokens (e.g. `["face", "eye", "left"]`).
   - Capped at 32 tags per node, max 32 characters per tag.

---

### 2.4 Parent and Containment Validation Rules

1. **Cell Scoping**: Every Layer, Group, and Region must belong to exactly one Cell via `cell: <cell_id>`.
2. **Layer Containment**:
   - Layers have no parent; they reside in `cell.layers`.
   - Layers cannot be nested inside groups or layers.
3. **Group Containment**:
   - Every Group must declare `parent: <parent_id>`.
   - The `parent_id` must resolve to a Layer or Group belonging to the **same** Cell. Cross-cell references are rejected.
4. **Region Containment**:
   - Regions are leaves in v1.1. They cannot contain other nodes.
   - Every Region must declare `parent: <parent_id>` pointing to a Layer or Group in the same Cell.
5. **Acyclic Invariant**:
   - Cycle detection runs during validation. Any parent loop (`A -> B -> A`) fails validation immediately.
6. **Max Depth**: Nesting depth of groups within a layer is capped at 16 levels.

---

### 2.5 Region Overlap and Sibling Z-Order Semantics

1. Sibling nodes inside a Layer or Group composite in **declaration / array order** (index 0 is drawn first; higher indices composite on top).
2. Sibling draw order traversal:
   - For each Layer in `cell.layers`:
     - If `layer.visible === false`, skip layer entirely.
     - For each child in `layer.children`:
       - If Group: recursively traverse visible children.
       - If Region: if `region.visible !== false`, composite its pixels in instruction order.
3. **Zero Cross-Region Mutation**: Erasing or editing a pixel in Region A mutates only `regionA.pixels`. Overlapping pixels in Region B remain intact in the AST.

---

### 2.6 Layer Opacity and Alpha-Compositing Semantics

1. Compositing follows Porter-Duff **Source-Over** ($A \text{ over } B$).
2. Layer opacity $\alpha_{\text{layer}} \in [0.0, 1.0]$ scales the alpha channel of all rendered content within that layer:
   $$\alpha_{\text{effective}} = \alpha_{\text{pixel}} \times \alpha_{\text{layer}}$$
3. Initial blend mode is strictly `normal`. Unrecognized or non-normal blend modes fail validation.

---

### 2.7 Visibility and Lock Inheritance

1. **Visibility**:
   - If a Layer has `visible: false`, all its descendants are hidden during raster compositing and canvas hit-testing.
   - If a Group has `visible: false`, all its descendants are hidden.
2. **Locking**:
   - If a Layer has `locked: true`, all descendants are locked against canvas transformation, painting, erasure, and deletion.
   - If a Group has `locked: true`, its descendants cannot be edited.

---

### 2.8 Resource Limits

| Resource | Studio Profile Limit | PixelArt Profile Limit | Unlimited Profile |
| :--- | :--- | :--- | :--- |
| **Max Cell Dimensions** | 512 × 512 | 1,024 × 1,024 | 2,048 × 2,048 |
| **Max Grid Size** | 128 cols × 256 rows | 16 cols × 16 rows | 256 cols × 256 rows |
| **Max Cells** | 4,096 | 256 | 8,192 |
| **Max Structural Nodes (Total)** | 16,384 | 4,096 | 32,768 |
| **Max Layers per Cell** | 64 | 64 | 128 |
| **Max Group Nesting Depth** | 16 | 16 | 32 |
| **Max Tags per Node** | 32 | 32 | 64 |
| **Max Tag Length** | 32 characters | 32 characters | 64 characters |
| **Max Name / Title Length** | 256 characters | 256 characters | 512 characters |
| **Max File Size** | 20 MiB | 20 MiB | 50 MiB |

---

### 2.9 v1.0 Upgrade and v1.0 Flatten / Downgrade Specification

#### Upgrade (`upgradeV10ToV11(doc)`):
1. For every cell in `doc.cells`:
   - Generate deterministic IDs:
     - `layerId = "layer_legacy_" + cell.id`
     - `regionId = "region_legacy_" + cell.id`
   - Create Layer: `{ type: "layer", id: layerId, cell: cell.id, name: "Default", visible: true, locked: false, opacity: 1.0, blend: "normal", children: [] }`.
   - Create Region: `{ type: "region", id: regionId, cell: cell.id, parent: layerId, name: cell.name || "Artwork", tags: [], visible: true, locked: false, pixels: { ...cell.pixels } }`.
   - Attach Region as child of Layer.
   - Assign `cell.layers = [layer]`.
2. Set `doc.meta.version = "1.1"`.
3. Verify render equivalence between pre-upgrade cell pixels and post-upgrade composited output.

#### Flatten / Downgrade (`flattenV11ToV10(doc, options)`):
1. Produce structured loss report:
   ```typescript
   interface FlattenLossReport {
     discardedLayers: string[];
     discardedGroups: string[];
     discardedRegions: string[];
     flattenedOpacityCount: number;
     warningCount: number;
   }
   ```
2. For each cell:
   - Composite all visible layers and regions in order into `cell.pixels`.
   - Delete `cell.layers`.
3. Set `doc.meta.version = "1.0"`.
4. Output to a new file or require explicit confirmation.

---

### 2.10 Animation Metadata for Platformer 2D (Left / Right)

1. **Template**: `platformer_2dir`
2. **Directions**: `left`, `right`
3. **Standard Actions**: `idle`, `run`, `jump`, `fall`, `land`
4. **Standard Clip Names**:
   - `idle_left`, `idle_right`
   - `run_left`, `run_right`
   - `jump_left`, `jump_right`
   - `fall_left`, `fall_right`
   - `land_left`, `land_right`
5. **Frame References**: Explicit cell ID arrays (e.g. `frames: ["cell_1_0", "cell_1_1", "cell_1_2"]`).
6. **Diagnostics**: Missing clip displays a warning in Animation Studio instead of silently substituting a different action.

---

### 2.11 Atlas Metadata Adapter Contracts for PNG Import

```typescript
interface ImageInfo {
  width: number;
  height: number;
  rgbaData: Uint8ClampedArray;
}

interface AtlasImportSlice {
  name: string;
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  pivot: { x: number; y: number };
  duration?: number;
}

interface AtlasImportPlan {
  adapterId: string;
  imageName?: string;
  slices: AtlasImportSlice[];
  animations: Array<{
    name: string;
    fps: number;
    loop: boolean;
    frameNames: string[];
  }>;
}

interface AtlasMetadataAdapter {
  id: string;
  detect(json: unknown): boolean;
  parse(json: unknown, image: ImageInfo): AtlasImportPlan;
}
```

Registered Adapters:
1. `noiradix-pix2-json`: Detects `json.meta && json.meta.app && json.meta.app.startsWith("NOIRADIX")`.
2. `texturepacker-json-hash`: Detects `json.frames && typeof json.frames === "object" && !Array.isArray(json.frames) && json.meta`.
3. `texturepacker-json-array`: Detects `json.frames && Array.isArray(json.frames) && json.meta`.

---

### 2.12 Modular Component Export Specification & Manifest Schema

#### Export Modes
- **Mode A (Composite Export)**: Flattens visible layers into single-image PNGs / spritesheets / atlas packages.
- **Mode B (Modular Component Export)**: Exports independent visual components as separate transparent PNG assets with an engine-neutral manifest.

#### Alignment & Trimming
- **Full Canvas Alignment (Default)**: Every exported asset has the identical canvas width/height and origin `(0, 0)`. Zero manual offset calculation needed at game runtime.
- **Trimmed Bounds (Optional)**: Trims transparent margins. Manifest records exact `trimOffset` `{ x, y, w, h }` and `sourceSize` `{ w, h }` to reconstruct original positioning.

#### Engine-Neutral Manifest Schema (`manifest.json`)
```json
{
  "$schema": "https://noiradix.me/schemas/pix2-manifest-v1.json",
  "formatVersion": "1.1",
  "generator": "NOIRADIX Studio 2.0.0",
  "document": {
    "title": "Character",
    "cellSize": { "w": 32, "h": 32 },
    "grid": { "cols": 4, "rows": 4 }
  },
  "exportMode": "modular",
  "trimmed": false,
  "opacityBaked": true,
  "components": [
    {
      "id": "layer_head",
      "type": "layer",
      "name": "Head",
      "path": "parts/head.png",
      "size": { "w": 32, "h": 32 },
      "pivot": { "x": 0.5, "y": 0.5 },
      "trimOffset": null,
      "order": 1,
      "visible": true,
      "opacity": 1.0
    }
  ],
  "animations": [
    {
      "name": "run",
      "fps": 10,
      "loop": true,
      "components": {
        "layer_head": ["animations/run/head_0.png", "animations/run/head_1.png"]
      }
    }
  ]
}
```

---

## 3. Review & Transition to Phase 1

This Phase 0 document establishes the frozen, non-ambiguous foundation for:
1. Version-aware parsing and serialization in `js/pix2-format.js` and `pix2/js/pix2-format.js`.
2. AST validation and structural security defenses.
3. Deterministic upgrade/downgrade transforms.
4. Shared rendering and modular component export across NOIRADIX Studio and PixelArt.

Phase 0 is complete and ready to execute Phase 1.
