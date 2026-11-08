# Agentic Implementation Prompt — NOIRADIX Studio 2.0 / PIX2 1.1

You are the senior implementation agent responsible for evolving `dotlinux26/noiradix-studio` from the current PIX2 v1.0 / Studio codebase into the planned PIX2 v1.1 and NOIRADIX Studio 2.0 architecture.

This is a coordinated format + editor + animation + importer + document-workspace upgrade. It is not permission to rewrite the application blindly.

## 0. Critical execution rules

1. **Read the complete master blueprint first:** `NOIRADIX_v2_0_PIX2_v1_1_Architecture_and_Product_Spec.md`. Treat it as the product/architecture source of truth.
2. The planning baseline was `main` commit `6c8883da71a9b1aaebb3cacc61dd2779f0ccea03`. `main` may have advanced. Fetch the actual current HEAD before doing anything.
3. Inspect `git status`, current diff, branches, and uncommitted work. Preserve in-progress changes. Do not reset, clean, force-push, or overwrite another agent's work.
4. A separate UX/performance fix may still be active. Do not conflict with or revert it. Integrate after it lands, or work on an isolated branch and rebase carefully.
5. Keep the static zero-runtime-dependency architecture. No framework migration, no bundler requirement, no new runtime dependency.
6. Do not change PIX2 v1.0 semantics. Keep all published v1.0 files readable and visually identical.
7. Version naming is fixed: **PIX2 1.1** is the format; **NOIRADIX Studio 2.0.0** is the product release.
8. Never claim a feature is complete because a UI control exists. Parser, AST, serializer, validator, editor, preview, export, migration and tests must preserve behavior.
9. Implement in reviewable phases, with tests and commits at each gate. Do not create one giant unreviewed commit.
10. Do not add unrelated features. Preserve current export workflows unless a planned change explicitly replaces them.

## 1. Mandatory source reconnaissance

Inspect at least:

- `PIX2_SPECIFICATION.md`
- `js/pix2-format.js`
- `js/editor-state.js`
- `js/animation-player.js`
- `js/app.js`
- `pixelart/js/pixelart-app.js`
- `README.md`
- `docs/PRODUCT_SPEC.md`
- `docs/UX_AND_INTERACTION_SPEC.md`
- `docs/PIXELART/ARCHITECTURE_AND_REUSE_PLAN.md`
- `docs/PIXELART/VIEWPORT_FRUSTUM_CULLING_AND_RENDER_OPTIMIZATION.md`
- all current tests and `.github/workflows/*.yml`

Record current behavior before patching:

- Parser currently supports v1.0 and emits an unsupported-version diagnostic for other versions.
- Serializer currently emits `@pix2 1.0`.
- Studio profile currently caps cell dimensions at 512; PixelArt profile caps at 1,024.
- Studio grid profile currently permits up to 128 columns × 256 rows and 4,096 cells.
- PixelArt grid profile permits up to 16×16 and 256 cells.
- Studio `EditorState.openCellTabs` are tabs for cells inside one document, not separate project documents.
- Current animations reference cell IDs.
- Current player supports 4dir / 8dir / explicit clips.
- README currently disclaims raster-to-PIX2 autotracing; the new Import & Slice feature must revise this carefully.
- Inspect current Unity exporter metadata before implementing its importer adapter.

Create a short architecture audit/decision record with actual source paths/functions, tests, and any changes since the baseline SHA.

## 2. Phase 0 — Freeze the v1.1 contract before coding

Produce and review:

1. Final normalized AST schema for cell/layer/group/region.
2. Final EBNF for new directives and property syntax.
3. Stable ID / naming / tags rules.
4. Parent/containment validation rules.
5. Region overlap and z-order semantics.
6. Layer opacity and alpha-compositing semantics.
7. Visibility and lock inheritance semantics.
8. Resource limits: nodes, max nesting depth, tag count/length, string limits, parser complexity.
9. v1.0 upgrade and v1.0 flatten/downgrade behavior.
10. Animation metadata changes for platformer 2dir.
11. Metadata adapter contracts for PNG import.
12. Regression/conformance fixtures.

Do not proceed to broad UI implementation while those decisions remain ambiguous.

### Required semantic distinction

Implement separate node types:

- **Layer:** render stack/compositing unit.
- **Group:** logical hierarchy and collection.
- **Region:** named editable content owner with stable ID, name, tags, and its own pixel/primitive content.

A layer can contain many groups and regions. A region is not automatically a layer.

Recommended containment:

```text
Cell
└── Layer
    ├── Region
    └── Group
        ├── Region
        └── Group
            └── Region
```

Rules:
- Layers cannot be nested.
- Groups can contain groups and regions.
- Regions are leaves in the initial v1.1 schema.
- Every node belongs to one cell.
- Every node has a stable unique ID.
- Region coordinates are cell-local.
- Region bounds are derived from content, not identity.
- Different regions may overlap; sibling draw order is deterministic.
- Editing/erasing one region must not silently mutate another.
- Initial blend support is `normal` only. Do not expose unsupported modes.

## 3. Phase 1 — PIX2 1.1 parser, AST, serializer, validator

Modify `js/pix2-format.js` with version-aware parsing/serialization.

Requirements:

- Parse `@pix2 1.0` exactly as before.
- Parse `@pix2 1.1` into the new structural AST.
- Preserve all current v1.0 conformance fixtures and security defenses.
- Serializer emits canonical v1.0 or v1.1 according to document version.
- Never serialize a v1.1 AST as v1.0 unless explicit downgrade/flatten was requested.
- Deterministic serialize → parse → serialize must be byte-identical.
- Preserve stable IDs and sibling order.
- Emit precise diagnostics for structural failures.
- Reject duplicate IDs; do not silently overwrite.
- Reject missing/cross-cell/wrong-type parents.
- Reject cycles and excessive nesting before rendering.
- Reject invalid opacity and unsupported blend values.
- Preserve safe identifier/prototype-pollution behavior.
- Do not silently ignore unknown v1.1 structural directives or silently drop properties/nodes on save.

### Legacy normalization

Normalize a valid v1.0 cell without structural data internally as:

```text
cell
└── layer_legacy_<cellId>
    └── region_legacy_<cellId>
        └── old cell pixels / primitives
```

Generated IDs must be deterministic. Do not randomize them per load. Do not rewrite the source version merely because a v1.1-capable app opened it.

### Upgrade/downgrade

Implement separate explicit functions (names may differ, behavior may not):

- `upgradeV10ToV11(doc)`
- `flattenV11ToV10(doc, options)`

Upgrade:
- Preserve every pixel, palette entry, cell ID, row/column, direction, frame, animation ID, frame reference, fps, loop/mode.
- Run render-equivalence tests before/after.
- Set version to 1.1 only after success.
- Create undo/recovery snapshot.
- Recommend Save As or explicit confirmation on first upgrade.

Downgrade:
- Composite visible layers per cell.
- Preserve animation references/cell IDs.
- Return a structured loss report listing discarded groups/region IDs/names/tags/layer properties.
- Block if unsupported constructs cannot be represented.
- Default to a new output file.

## 4. Phase 2 — Shared structural render/edit engine

Add a shared model/render API consumed by Studio and PixelArt. Names can follow the existing code style; behavior must cover:

- get cell layers
- find node by stable ID
- calculate node bounds
- create/move/reorder/delete layer/group/region
- set visibility/lock/opacity
- render region
- render full cell composite

The AST is authoritative. Do not keep a flat pixel map as the only source of truth for v1.1.

Rendering:
- composite in deterministic layer order;
- recurse through group order;
- render region payload in stable instruction order;
- normal source-over alpha compositing; multiply alpha by layer opacity;
- respect hidden/locked ancestors;
- preserve nearest-neighbor pixel-crisp rendering;
- expose one compositor for cell editor, grid thumbnails, animation preview, PNG and engine exports.

Do not serialize full PIX2 text on pointermove. Commit structural mutations at interaction completion. Integrate structural changes with dirty/revision tracking and undo/redo.

## 5. Phase 3 — Studio and PixelArt editor UX

### 5.1 Structure / Layers panel

Implement hierarchy tree actions:

- add/rename/delete/duplicate layer;
- visibility/lock toggles;
- reorder layers;
- opacity slider;
- add/rename/delete group;
- nested group expand/collapse;
- create/rename/delete region;
- edit tags;
- move selected regions to a layer/group;
- duplicate region/group;
- merge/flatten only as an explicit undoable destructive action.

Do not expose non-functional blend controls.

### 5.2 Region Select mode

Implement in both editors:

- Toggle into region-aware selection mode.
- Draw visible boundaries for regions/groups.
- Show label tags with human-readable region names.
- Allow labels to be hidden.
- Click selects; drag moves selected region/group.
- Ctrl/Cmd-click multi-selects.
- Topmost visible region wins plain-click hit-testing.
- Hidden nodes are not hit-testable.
- Locked nodes cannot transform.
- Multi-selection operations preserve per-region ownership.
- Normal marquee selection remains available separately.

### 5.3 Isolation mode

- Double-click region → isolate it.
- Only isolated region is directly editable.
- Other artwork remains dimmed context, optionally hideable.
- Show breadcrumb path.
- Esc exits isolation.
- Double-click outside exits isolation.
- Provide visible Exit Isolation UI.
- Double-click group isolates descendants.
- Locked nodes can be inspected but not edited.

### 5.4 Shared selection engine

Unify selection behavior in Studio and PixelArt. Do not regress PixelArt free-angle rotation.

Required: rectangular marquee, move, copy/cut/paste, one-pixel nudge, H/V flip, free rotation, scale handles, selection-anchored zoom, Esc cancel.

Resize behavior:
- corner drag without Shift = free X/Y scale;
- Shift + corner drag = uniform aspect-ratio-preserving scale;
- side handle = single-axis scaling;
- nearest-neighbor only;
- live preview;
- pointer release/Enter commits;
- Esc cancels;
- undo restores original content.

Share geometry/resampling functions and tests. Do not duplicate approximate math in each editor.

## 6. Phase 4 — Platformer 2D animation template

Keep existing 4dir, 8dir, and custom animation behavior unchanged.

Add `platformer_2dir` with left/right facing and clips:

- `idle_left` / `idle_right`
- `run_left` / `run_right`
- `jump_left` / `jump_right`
- `fall_left` / `fall_right`
- optional `land_left` / `land_right`

Use explicit frame references. Extend metadata with `action` if approved in v1.1 grammar; do not repurpose `mode` (loop/once/pingpong) to mean template type.

Update New Project template, row/track layout, Animation Studio action/facing controls, preview resolution, missing-clip diagnostics, frame stepping and fps. A missing jump clip must not silently play run.

Regression: existing 4dir/8dir fixtures identical; platformer fixtures resolve expected cell IDs in order.

## 7. Phase 5 — Import & Slice tab

Add a top-level Import & Slice tab alongside Grid Overview and Animation Studio.

Input modes:
1. PNG manual rectangles.
2. PNG grid slicing by cell size or row/column count.
3. PNG connected-alpha auto-slice with 4- or 8-connectivity, configurable alpha threshold, and manual correction.
4. PNG + supported JSON metadata adapters.

Initial adapters:
- NOIRADIX `.pix2.json` (inspect actual exporter schema first).
- TexturePacker JSON Hash.
- TexturePacker JSON Array.

Do not claim all Unity `.meta` formats are JSON. If direct Unity project importer access is required, plan a Unity Editor C# exporter that writes a documented neutral JSON manifest.

Handle `frame` rect x/y/w/h, `rotated`, `trimmed`, `spriteSourceSize`, `sourceSize`, `pivot`, optional `duration`, optional `animations`, and multiple pages. If metadata cannot be interpreted losslessly, report the exact issue and do not silently create distorted sprites.

Pipeline:
- validate files/dimensions;
- decode PNG and preserve RGBA;
- detect/parse metadata;
- build import plan;
- preview/adjust/rename/assign;
- create cells with a default layer and named imported region;
- create clips where metadata/user assignment provides sequences;
- validate bounds and cell refs;
- commit as one undoable transaction.

Large images:
- inspect dimensions before allocation;
- obey profile limits;
- never silently downscale;
- offer reject/crop/resize decisions;
- preserve alpha;
- ensure failure leaves active project unchanged.

No vector tracing. Import raster pixels and organize them as editable PIX2 regions.

## 8. Phase 6 — New Project dialog redesign

Separate:
1. Frame resolution.
2. Animation template.
3. Sheet layout.
4. Project details.

Presets within current Studio max 512×512:
- 16×16, 24×24, 32×32
- 48×48, 64×64, 96×96
- 128×128, 192×192, 256×256
- 192×108, 320×180, 512×288, 512×512
- Custom W×H within active profile

Show profile limits. Current Studio max is 512; PixelArt max is 1,024. Do not raise Studio cap without benchmarks/security review.

Templates: Blank/Custom, Static Sprite, 4dir, 8dir, Platformer 2D Left/Right.

Layouts: single cell, fixed grid, animation tracks, custom.

Show a pre-create summary: dimensions, number of cells, template, layout, and limits.

## 9. Phase 7 — Multi-file projects and drag/drop

Add a project-session manager separate from current cell tabs. Each project tab owns independent:
- doc/AST;
- file handle/path/name;
- dirty/revision state;
- history;
- active cell/tool context;
- recovery/autosave;
- selection/isolation state;
- animation-preview state.

Switching tabs must preserve all other projects. Save/Save As affect active project only. Closing dirty tabs prompts Save / Discard / Cancel. Maintain recent files/session restore where browser permissions allow. Lazy-render inactive projects; do not retain giant zoomed canvases for all tabs.

Drag/drop routing:
- `.pix2` → new project tab;
- `.png` → Import & Slice;
- recognized atlas `.json` with matching PNG → pair and import;
- `.zip` → only documented NOIRADIX package archives;
- unsupported types → clear diagnostic.

Multiple `.pix2` files open as separate tabs. Do not assume file drop order pairs PNG/JSON. Prevent ZIP path traversal. Duplicate already-open files require explicit handling. Dropped files must not replace dirty content without confirmation.

## 10. Version UI and release management

Use distinct labels:
- `NOIRADIX Studio v2.0.0`
- `NOIRADIX PixelArt v2.0.0`
- `PIX2 1.1`

Use one application-version source consumed by both About modals. Include product/logo, version/channel, PIX2 capability badge, release summary, GitHub, Discord, docs/changelog, license.

Update CI to run release-validation tests on tags such as `v*`. Existing deploy workflow is main/PR oriented; inspect current workflow and add a deliberate tag validation trigger. Do not deploy from tags unless explicitly configured and tested.

Release:
- clean main;
- tests green for exact commit;
- update version source and release notes;
- create annotated SemVer tag;
- push tag;
- create GitHub Release from that tag;
- verify release and deployed version.
Never force-move published stable tags.

## 11. Required automated tests

Do not write tests that merely reproduce an algorithm in a local helper and call them production regression tests. Prefer actual production modules/APIs. For browser DOM integration, extract production functions or use a lightweight harness that invokes the real code.

### PIX2
- all current v1.0 vectors unchanged;
- v1.0 fixture parse/render equivalence;
- v1.0 normalization to default layer/region;
- v1.0 → v1.1 migration preserves all cells/animations;
- v1.1 deterministic roundtrip;
- duplicate IDs, bad parent, cycle, cross-cell parent, bad opacity, invalid blend, unsafe ID;
- stable child/z order;
- overlapping region and alpha composition;
- downgrade/loss report.

### Editor
- create/move/delete/rename/group/ungroup;
- region hit-testing and labels;
- isolation mode and Esc;
- hidden/locked ancestry;
- layer opacity/visibility/order;
- structural undo/redo;
- same transform math in Studio and PixelArt;
- Shift proportional scale, edge scale, free rotation;
- no cross-region erasure.

### Animation
- 4dir unchanged;
- 8dir unchanged;
- platformer action/facing;
- missing clip diagnostics;
- fps/loop modes.

### Import
- PNG RGBA exact pixels;
- grid/manual/alpha slicing;
- TexturePacker Hash/Array;
- NOIRADIX metadata adapter;
- trimmed/rotated/pivot handling;
- invalid bounds;
- large-image guard;
- failed import leaves project untouched;
- one-step undo.

### Multi-file
- independent dirty state;
- switching preserves each doc;
- save writes correct handle;
- close prompts;
- multiple file drop;
- PNG/JSON pair detection;
- no overwrite of dirty tabs.

### Release
- exact app version in both About modals;
- PIX2 badge accurate;
- tag-triggered CI passes;
- release tag points to tested commit.

## 12. Performance and benchmark gates

Record actual measurements; do not make unsupported 60 FPS claims.

Benchmark:
- single-layer v1.0;
- v1.1 with 5 layers / 40 regions;
- 512×512 sprite;
- maximum supported Studio frame dimensions;
- grid overview with many cells;
- platformer preview;
- selection move/rotate/scale;
- PNG import and atlas metadata import;
- several open project tabs.

Measure median and p95 render latency, input-to-paint latency, import duration, backing dimensions, and memory estimate. Include browser/version/DPR/hardware.

Do not serialize the full document on every pointermove. Keep pointer interaction frame-local; commit structural changes on interaction completion.

## 13. Documentation and release deliverables

Update:
- `PIX2_SPECIFICATION.md` (clearly separate v1.0 and v1.1)
- PIX2 EBNF and normative test vectors
- v1.0 ↔ v1.1 migration guide
- `README.md` positioning and import claims
- `docs/PRODUCT_SPEC.md`
- `docs/UX_AND_INTERACTION_SPEC.md`
- docs master index
- platformer template guide
- Import & Slice format-support matrix
- About/release/version guide
- release notes / `CHANGELOG.md` if needed

## 14. Delivery protocol

After each phase, report:
1. Current HEAD and git status.
2. Architecture decisions confirmed.
3. Files changed and why.
4. Tests added and exact commands.
5. Results, including failures.
6. Known limitations and untested browser-only paths.
7. Commit SHA for that phase.

Do not claim the whole Studio 2.0 release is complete until every acceptance criterion in the master blueprint passes.

**Priority:** format compatibility → AST/render correctness → structural editing UX → animation template → importer → multi-file/drop → New Project/About/release packaging.


## NEW FEATURE TRACK — MODULAR SPRITE PIPELINE & STRUCTURED COMPONENT EXPORT

### 1. Vision

NOIRADIX must evolve beyond exporting a sprite as a single flattened PNG or spritesheet.

With the introduction of PIX2 v1.1's structural graphics model, the editor should support exporting individual visual components as independent assets while preserving their identity, hierarchy, alignment, animation relationships, and metadata.

The goal is to bridge pixel-art creation and game runtime development.

A character should not be limited to one flattened image. Its head, torso, arms, legs, equipment, accessories, and visual effects should be independently exportable and usable by game code.

This feature is called **Modular Sprite Export** or **Component Export**.

### 2. Structural Semantics

The export pipeline must respect the distinct responsibilities of PIX2 structural elements:

- **Layer:** Contains pixel content and participates in compositing. Can be exported independently as a transparent image.
- **Group:** Organizes child layers and nested groups. Can be exported as a flattened composite of its descendants, or recursively as individual assets.
- **Region:** Represents a semantic content area. Region-based cropping/export may be supported as a separate capability, but Region must not be treated as a Layer or Group.

A Group must not duplicate or replace the content/compositing responsibilities of its child Layers.

Exporting a Group should preserve its descendant hierarchy in the package manifest.

### 3. Two Independent Export Modes

The existing composite export must remain available.

**Mode A — Composite Export**

- Flatten the visible sprite/layer stack into a single image.
- Preserve current PNG and spritesheet export behavior.
- Support current animation export workflows.

**Mode B — Modular Component Export**

- Export selected Layers independently.
- Export selected Groups as composites.
- Export every descendant Layer inside selected Groups.
- Export all eligible components across selected cells or animation frames.
- Optionally include the original composite alongside separated assets.
- Produce a structured asset package with a machine-readable manifest.

Exporting must never modify the source PIX2 document.

### 4. Alignment, Origin, Pivot and Trimming

Pixel alignment is a core requirement.

Default behavior must be **Full Canvas Export**:

- Every exported component retains the original canvas width and height.
- All components share the same canvas origin.
- Transparent pixels are preserved.
- The original pivot/anchor relationship remains consistent.
- Layer coordinates and visual alignment are not changed.

This makes independently exported assets directly composable in a game engine without requiring users to manually calculate offsets.

An optional **Trim Transparent Bounds** mode may reduce file size.

When trimming is enabled, the manifest must record:

- Original canvas width and height.
- Trimmed rectangle.
- X/Y offset relative to the original canvas.
- Original pivot/anchor.
- Component identity.
- Frame identity where applicable.

Trimming must never discard information required to reconstruct the original positioning.

### 5. Animation-Aware Component Export

Studio must support exporting components across animation sequences.

Example:

Character → Run animation → Head, Body, LeftArm, RightArm.

Each component must have a stable identity across animation cells/frames.

Requirements:

- Match components using stable IDs, never list position alone.
- Preserve animation frame order and timing.
- Preserve direction/state information.
- Represent a missing component in a frame as an empty/transparent frame rather than shifting the sequence.
- Allow exporting one component's entire animation.
- Allow exporting all components for one animation.
- Support independent spritesheets or PNG sequences per component.

An animation export package must provide enough information for runtime code to reconstruct the component animation without guessing frame relationships.

### 6. Compositing and Visibility Rules

The exporter must respect:

- Layer ordering.
- Visibility.
- Alpha/transparency.
- Layer opacity.
- Supported blend modes.

Hidden layers should be excluded by default, with an explicit option to include them.

Locked state is an editing property and must not silently prevent export.

When opacity is baked into the exported PNG, the manifest must declare that opacity has already been applied to prevent consumers from applying it twice.

Blend modes that depend on the backdrop must not be silently represented as ordinary independent PNG layers if doing so changes the visual result. The exporter must either preserve sufficient metadata, flatten the relevant composition, or display a clear compatibility warning.

A Group export must composite its descendants in the correct document order.

### 7. Export Package and Manifest

Modular export should generate a downloadable package, preferably ZIP for multi-asset exports.

Suggested structure:

```text
Character_Export/
├── manifest.json
├── source/
│   └── character.pix2
├── composite/
│   ├── idle.png
│   └── run.png
├── groups/
│   ├── head/
│   └── body/
├── parts/
│   ├── head/
│   ├── torso/
│   ├── left_arm/
│   ├── right_arm/
│   └── equipment/
└── animations/
    └── run/
        ├── head.png
        ├── torso.png
        ├── left_arm.png
        └── right_arm.png
```

The manifest should be engine-neutral and contain:

- PIX2 format version.
- Exporter version.
- Source document identity.
- Canvas dimensions.
- Component IDs and names.
- Component types.
- Group parent/child relationships.
- Layer ordering.
- Visibility and opacity metadata.
- Asset paths.
- Original coordinates, dimensions and pivots.
- Trim offsets where applicable.
- Cell/frame mapping.
- Animation state, direction, frame order, FPS or duration.
- Whether visual properties such as opacity were baked into raster output.

Manifest generation must be deterministic for the same source document and export settings.

Do not treat an engine-specific import metadata file as the universal manifest. Keep the core export contract engine-neutral and add engine-specific adapters separately.

### 8. Shared Support in Studio and PixelArt

Both NOIRADIX Studio and PixelArt Editor must support modular export, using the same underlying PIX2 document model and export implementation.

**NOIRADIX PixelArt:**

- Export current composite.
- Export active Layer.
- Export selected Layer/Group.
- Export all Layers/Groups in the current artwork.
- Preserve structure when opening and saving PIX2 v1.1 documents.
- Provide a focused component/layer selection workflow.

**NOIRADIX Studio:**

- Batch export across multiple cells.
- Batch export across animation sequences.
- Export selected Groups and descendants.
- Export independent component animations.
- Preview the complete output hierarchy before export.
- Generate the full manifest and asset package.

Studio is the advanced project-level export environment. PixelArt provides focused artwork-level export.

Neither application may silently flatten or destroy structural data when handling a document containing layers/groups.

### 9. AI-Assisted Component Decomposition

Introduce an optional workflow:

**Prepare for Modular Export**

Given a flattened sprite, AI can propose a component hierarchy suitable for runtime use.

Possible output:

```text
Character
├── Head
├── Hair
├── Torso
├── LeftArm
├── RightArm
├── LeftLeg
├── RightLeg
├── Equipment
└── Effects
```

The assistant may propose:

- Component boundaries.
- Group hierarchy.
- Layer order.
- Pivot/anchor positions.
- Suggested attachment points.
- Which components should be independent for animation or customization.

This workflow must be non-destructive and require user approval before changing the document structure.

Important limitation: hidden pixels behind occluded parts cannot be reliably reconstructed from a flattened image. The UI must identify incomplete areas requiring manual repair rather than presenting a false complete separation.

### 10. Future Runtime Integration

The engine-neutral manifest should provide a stable contract for game code.

Potential future adapters:

- Unity import/export workflow.
- Runtime component hierarchy generation.
- C# component ID/constants or data definitions.
- Sprite attachment points and pivots.
- Animation mapping for individual components.
- Character customization and equipment replacement.

Do not make the core PIX2 format dependent on Unity-specific runtime concepts.

Unity Prefab generation, automatic C# behavior generation, skeletal rigging and runtime assembly can be separate future milestones.

### 11. UX Requirements

The export dialog should distinguish:

- Export Composite.
- Export Selected Components.
- Export Selected Group.
- Export All Components.
- Export Component Animations.
- Export Full Modular Package.

Before export, provide an output preview showing:

- Which assets will be generated.
- Which layers/groups are included.
- Which hidden or empty layers will be skipped.
- Whether trimming is enabled.
- Whether any blend mode cannot be represented independently.
- Any component identity mismatch across frames.
- Whether the output preserves full-canvas alignment.

Support safe filename generation and stable asset paths based on component IDs.

### 12. Acceptance Criteria

The feature is not complete until the following are verified:

1. A Layer can be exported independently with transparency preserved.
2. A Group can be exported as a composite of its descendants.
3. A Group can recursively export its child Layers.
4. Full Canvas exports preserve exact dimensions and pixel alignment.
5. Trimmed exports preserve enough metadata to reconstruct original positioning.
6. Multiple components can be exported across multiple animation frames.
7. Stable component IDs preserve frame relationships.
8. Missing components do not shift animation sequences.
9. Opacity is not accidentally applied twice.
10. Unsupported blend modes produce correct handling or explicit warnings.
11. Hidden layers follow the selected export policy.
12. Exporting does not mutate the source document.
13. UTF-8 names and duplicate display names do not produce asset path collisions.
14. The manifest is deterministic for identical source and settings.
15. Studio and PixelArt produce compatible outputs from the same PIX2 source.
16. Existing composite PNG and spritesheet export remains fully functional.

### 13. Recommended Implementation Sequence

**Stage 1 — Structural Export Foundation**

- Define the engine-neutral manifest contract.
- Implement Layer and Group export.
- Preserve full-canvas coordinates and pivots.
- Generate ZIP packages.
- Keep existing composite export intact.

**Stage 2 — Animation-Aware Export**

- Stable component ID mapping across cells.
- Per-component animation sequences/spritesheets.
- Frame timing and direction metadata.
- Batch export from Studio.

**Stage 3 — Editor Workflow Integration**

- Component-aware export dialog.
- Layer/Group output preview.
- Focused export workflow in PixelArt.
- Project-level batch export in Studio.

**Stage 4 — AI-Assisted Modularization**

- Component decomposition suggestions.
- Suggested hierarchy and pivots.
- Attachment-point recommendations.
- Human approval and manual repair workflow.

**Stage 5 — Engine Adapters**

- Unity-specific import workflow.
- Optional runtime data/code generation.
- Future support for additional engines without changing the core manifest.

The central design principle is:

**A PIX2 document should be able to produce both a flattened visual asset and a structured set of independent, runtime-ready components without losing their spatial, semantic, or animation relationships.**