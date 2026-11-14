# NOIRADIX Studio and PixelArt — Architecture

**Status:** Maintained overview. Product and PIX2 contracts are defined by their dedicated specifications; this page describes the current implementation boundaries.

## Product boundaries

- **Studio** owns sprite-sheet grids, frame editing, animation, slicing/import, atlas generation and game-engine packages.
- **PixelArt** owns the standalone artwork canvas.
- Both applications run as static browser applications. They share PIX2 parsing, serialization, raster operations and selected editor components from `js/`; each keeps its DOM, viewport instances, history and autosave/session wiring.
- PIX2 is the editable project source. PNG/atlas and engine packages are derived exports.

## Current shared boundaries

| Responsibility | Current owner |
|---|---|
| PIX2 parsing, validation, normalization, serialization and migration | `js/pix2-format.js`; standalone copy `pix2/js/pix2-format.js` must remain byte-identical |
| Raster edits and structural ownership operations | `js/tools.js`, `js/structure-operations.js` |
| Selection transforms and Region selection behavior | `js/selection-transform.js`, `js/region-selection.js`, `js/editor-floating-selection.js` |
| Canvas helpers, ruler geometry and shared zoom ladder | `js/editor-canvas.js`, `js/editor-rulers.js`, `js/viewport-pan-zoom.js` |
| Shared toolbar, outliner, menus and document tabs | `js/editor-toolbar.js`, `js/editor-outliner.js`, `js/editor-menu.js`, `js/tab-strip.js` |
| Studio grid, slice, animation, source, atlas and export controllers | `js/studio-grid.js`, `js/studio-slice.js`, `js/studio-animation.js`, `js/studio-source.js`, `js/studio-atlas.js`, `js/studio-export.js` |
| Shared save primitives and browser workspace storage | `js/editor-file-save.js`, `js/editor-workspace-storage.js` |
| Studio restored-session disk reconciliation | `js/studio-file-recovery.js` |
| Studio entry point and app-specific orchestration | `js/app.js` |
| PixelArt entry point and app-specific orchestration | `pixelart/js/pixelart-app.js` |

The app entry points still contain substantial UI and lifecycle orchestration. Their line counts alone do not establish a defect. Move code only when it creates a concrete shared rule, reduces duplicated ownership, or makes an independently testable boundary; do not move app-specific history, session, viewport or DOM wiring into a generic engine.

## PIX2 serialization and AI workflow

PIX2 stores sparse artwork as readable text. The current canonical serializer normalizes raster commands to explicit pixel records; parsing a `line`, `rect` or `fill` and serializing it does not preserve the original drawing command. This is deterministic and diffable, but it is not a compressed or token-minimal representation. Large sheets can make full-document prompts exceed an AI model's context window.

The AI prompt is guidance plus the serialized source document. Applying code parses and validates the submitted document, then replaces the active document; it is not a patch-merging protocol. Any UI mode that asks for partial directives must therefore either merge them by stable IDs or clearly request a complete document. See `docs/discussion/V2_2_0_AUDIT_AND_PLAN.md` for the verified issue and current remediation status.

## Rendering, coordinates and history

- Artwork coordinates are integer cell coordinates. Canvas/screen transforms, zoom, hover, selection overlays and isolation are view state and are not serialized.
- Both editors use shared viewport/ruler helpers but own their viewport instance and render scheduling.
- Studio history currently records canonical document snapshots around edits. This is simple and deterministic at the product's intended sprite sizes, with text size and snapshot cost growing with artwork complexity. No blanket performance claim is made for arbitrarily large artwork.
- PixelArt has its own artwork history adapter. Do not assume its memory/history behavior is identical to Studio.

## Export and external compatibility

Studio builds atlas geometry in `js/studio-atlas.js` and packages Unity, TexturePacker, PNG and frame exports in `js/studio-export.js`. Unity's importer consumes the exported JSON for exact sprite rectangles, point filtering, pivots and animation frames; importing the PNG alone does not carry that metadata. Unity-specific behavior still needs verification in supported Unity versions in addition to JavaScript package tests.

The generated package writers are currently separate implementations. Consolidating them is a maintenance opportunity only if the shared module preserves each package's path, byte, download and error-handling contracts; do not treat similar CRC/ZIP code as proof that its callers are interchangeable.

## Licensing

- Application code: Apache License 2.0 (`LICENSE`).
- PIX2 reference code: Apache License 2.0 (`pix2/LICENSE-CODE`).
- PIX2 specification text: CC BY 4.0 (`pix2/LICENSE-SPEC`).
- Third-party assets retain their own licenses as listed in `THIRD_PARTY_NOTICES.md`.

There is no project-wide Apache/MIT dual license. Check the relevant license file before redistributing a component.

## Verification and limits

Use `docs/agents/VERIFICATION.md` for current commands. Historical suite totals in older roadmap and release documents describe their original run only. Browser, operating-system file dialogs and Unity Editor behavior are not fully established by Node tests. Record fixture, environment and exact checks when claiming verification.

The document `docs/PIXELART/1M_PIXEL_LARGE_CANVAS_MEMORY_AND_PERFORMANCE_ANALYSIS.md` is a historical architecture proposal, not evidence that a typed-array engine or its projected performance is implemented. Likewise, old roadmaps and release notes may describe superseded plans; check current source before treating them as behavior contracts.
