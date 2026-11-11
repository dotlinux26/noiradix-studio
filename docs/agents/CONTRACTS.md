# Contracts and implementation ownership

## Maintained contracts

- [PIX2 1.1 specification](../../PIX2_SPECIFICATION.md) defines persisted document semantics. Older 1.0 references remain useful for compatibility. Reconcile contradictions against the current compiler and conformance fixtures.
- [Architecture](../ARCHITECTURE.md) describes the application boundaries. Verify performance and browser-support claims against actual measurements.
- [Editor behavior](../discussion/EDITOR_BEHAVIOR.md) records the shared interaction decisions. Trace gestures through the current controllers.
- [File lifecycle](../FILE_LIFECYCLE_SPEC.md), [history and recovery](../HISTORY_AUTOSAVE_RECOVERY_SPEC.md) and [selection](../SELECTION_AND_CONTEXT_MENU.md) cover their respective domains. Check them against implementation when changing those domains.

## Module boundaries

| Area | Owner |
|---|---|
| Parse, normalize, serialize, validate, composite and migration | `js/pix2-format.js` |
| Standalone PIX2 distribution | `pix2/js/pix2-format.js`, byte-identical to the root compiler |
| Raster tools and ownership guards | `js/tools.js`, `js/structure-operations.js` |
| Selection geometry and Region gestures | `js/selection-transform.js`, `js/region-selection.js` |
| Canvas buffers, viewport geometry and rulers | `js/editor-canvas.js`, `js/viewport-pan-zoom.js`, `js/editor-rulers.js` |
| Toolbars, tree, context menus and document tabs | `js/editor-toolbar.js`, `js/editor-outliner.js`, `js/editor-menu.js`, `js/tab-strip.js` |
| Browser workspace storage | `js/editor-workspace-storage.js` |
| AI format rules | `js/pix2-ai-prompt.js` |
| Studio document/frame history, file handles, UI and animation | `js/editor-state.js`, `js/app.js` and the Studio adapters |
| Standalone artwork history, file handles and UI | `pixelart/js/pixelart-app.js` |
| Product and format versions | `js/version.js` |

Persist artwork in cell coordinates. Keep zoom, hover, isolation, temporary selection and derived render buffers outside exported artwork. Structural identity uses IDs. Display names may coincide.

Preserve node order and alpha through parse, edit, Undo/Redo, export and reload. Resolve the exact editable target with ancestor lock/visibility checks before mutation. A pending transform retains its original destination and cancellation baseline.
