# Shared interaction decisions for both editors

## Selection and editing

| Interaction | Behavior |
|---|---|
| Select a Layer in Layers | Restricts canvas Region hit-testing to that Layer. If no Layer is selected, the first canvas selection establishes the scope. |
| Click Region Select | Hit-tests from front to back. Hidden, locked, or fully transparent Regions are skipped. The selected Region keeps its highlight after the pointer leaves it. |
| Click a Region inside a Group | Selects the outermost Group in the current scope. Dragging or using the arrow keys moves all Regions in that Group together. Movement is constrained by the full bounding box to preserve pixels. |
| Shift, Ctrl, or Cmd and click | Adds or removes an object from the selection on the canvas or in Layers. Group combines adjacent objects with the same parent to preserve draw order. Ungroup restores children to their positions in that order. |
| Ctrl/Cmd+G or Ctrl/Cmd+Shift+G | Groups when multiple nodes are selected; ungroups when exactly one Group is selected. The shortcuts match the toolbar and Layers commands. They are ignored during isolation, dialogs, or text entry. G alone still selects Paint Bucket. |
| Double-click a Region | Enters isolation for the Region under the pointer, including a Region inside a Group. The viewport hides other Regions, preserves existing alpha, and routes raster edits to the isolated Region. |
| Alt+double-click | Cycles through Regions with pixels at the clicked point in the selected Layer, from front to back. Continue while isolated to reach an obscured Region. Fully transparent, hidden, and locked nodes are skipped. |
| Esc | Cancels an uncommitted drag. In isolation, Esc returns to Region Select and restores the original focus. A second Esc clears the selection outline. |
| Marquee | Selects a pixel mask. Studio copy, cut, paste, fill, and raster transforms read and write the target Region's pixel payload. A floating selection retains its target from the moment it is lifted. |
| Brush and Eraser | Each tool has an independent square size from 1–32 px. Odd sizes are centered on a pixel; even sizes are centered on the nearest grid intersection. The cursor preview matches the paint or erase footprint, including at canvas edges. Brush, Eraser, and Ink each occupy one row with a synchronized slider and numeric input. |
| Node opacity | The UI edits Layer opacity from 0–100%. Layers, Groups, and Regions store opacity from 0–1 in PIX2 1.1. The composite multiplies RGBA alpha by the opacity of the Region and its ancestors. Ink % sets alpha on new strokes. |

Keep both selection tools in the same toolbar because they operate on different data. Marquee edits pixels on a paint target. Region Select operates on identified nodes and the Group tree. Drag, nudge, scale, and rotate apply to child Regions in the same coordinate space while preserving the tree and IDs. Scale and rotate preview the bounds before commit. Object clipboard support remains open. See [Adobe Illustrator Group selection](https://helpx.adobe.com/illustrator/desktop/manage-objects/select-objects/select-object-groups-and-nested-object-groups.html), [Adobe Illustrator isolation](https://helpx.adobe.com/ie/illustrator/desktop/manage-objects/select-objects/isolate-objects.html), and [Aseprite brush and opacity controls](https://aseprite.org/docs/context-bar).

**New Group** creates an empty folder. **Group** groups selected nodes and suggests `Group`, `Group 2`, and so on based on names already used under the same parent. The commands use distinct icons. Group and Ungroup are available in the main toolbar and the horizontally scrollable Layers action bar. Double-click a name or press F2 to rename it; Enter confirms and Esc cancels. Two Groups may have the same name. Selection, dragging, reordering, and Ungroup use stable IDs. Tooltips include IDs to distinguish duplicate names.

Layers uses a shared renderer and displays frontmost nodes first at each Layer, Group, and Region level. Drag upward or use Move Up to bring a node forward. A Layer can be dropped into the gap beside a row or across child rows of the target Layer. PIX2 continues to store order back-to-front, preserving the appearance of existing artwork. Drag the divider between the canvas and inspector to resize the panel. Studio defaults to 360 px, and each app remembers its own width. Shift+Space fits the canvas to the viewport.

Scaling a Group or Region down uses nearest-neighbor sampling on the pixel grid and may lose detail. Scaling it back up uses the current data. Undo restores the pre-scale data. If sampling would remove every pixel from any non-empty Region, the entire transform is canceled and the affected Region is named. Selecting another Region in Layers can exit isolation and show the full artwork again, including content previously hidden from the viewport.

Both editors use the same vertical toolbar. Buttons have a 34×34 px square frame. When the toolbar overflows, drag vertically over the button rail. The cursor changes from an open hand to a closed hand while dragging, and the drag does not activate the button underneath.

The right-side Preview has −, +, and Fit controls, plus mouse-wheel zoom. When Fit is active, the image fits the viewport again after resize. The bottom edge adjusts the panel height. The canvas retains the frame's original resolution and uses CSS to scale the image.

The floating Animation Studio defaults to Fit so the full frame remains visible, including for large sprites. Fit is recalculated when the preview area changes size; users can still choose a fixed zoom level. Each direction-button press selects the next clip with valid frames tagged for that `direction`, following file order. Changing direction starts with that direction's first clip. If no tagged clip exists for a direction, playback uses the legacy row fallback and never silently plays a clip tagged for another direction.

## Code boundaries

| Module | Responsibility |
|---|---|
| `js/structure-operations.js` | Ancestor-aware lookup, edit permission checks, hit-testing, reparenting, grouping, and ungrouping. |
| `js/region-selection.js` | Per-cell/layer/isolation node selection, outline preview, drag, nudge, scale, and rotate. |
| `js/editor-outliner.js`, `js/editor-menu.js` | Layers tree, renaming, canvas and node context menus, and ID-based reordering. |
| `js/editor-toolbar.js` | One shared vertical toolbar for both editors, with the same order and icons. |
| `js/tab-strip.js`, `css/tab-strip.css` | Shared Studio-style document-tab component. `NoiraTabStrip.render(strip, sessions, activeId, options)` accepts sessions with optional `id`, `fileName` or `title`, `filePath`, and `isDirty`. The app supplies `onActivate`, `onClose`, and `onReorder`. |
| `js/pix2-ai-prompt.js` | Version- and profile-specific PIX2 rules. Both apps share the canonical prompt and use app-specific briefs. |
| `js/tools.js` | Raster-target routing, brush footprint, symmetry, clipping, stroke alpha, geometry, and edge alignment. |
| `js/pix2-format.js` | Canonical compositing. Isolation and incremental pixel updates return a separate view to preserve the full cache. The standalone copy is checked byte-for-byte. |
| `js/viewport-pan-zoom.js` | Shared pan/zoom geometry, zoom steps, Fit, and canvas-size limits for PixelArt and Studio Sprite Editor. Also provides toolbar dragging and panel resizing. Both Slice bars use the same single-registration binder. |
| `js/editor-rulers.js` | Shared two-axis ruler renderer from PixelArt, including zoom-aware label spacing, minor ticks, DPR, and pointer/marquee highlights. |
| `js/editor-canvas.js` | Shared checkerboard, composite updates for changed coordinates, 1× pixel buffers, viewport blitting, and zoom anchoring against actual layout position. |
| App controllers | Connect DOM, viewport, history, autosave, and app-specific workflows. PixelArt updates composites only at changed stroke coordinates to avoid scanning the whole canvas on every pointer move. |

## Additional issues found during hands-on use

- Studio treated 0% Layer opacity as 100% because it used `Number(value) || 100`. The input now accepts zero and preserves the previous value when the field is empty.
- Studio once passed ellipse-preview parameters in the wrong order. Its algorithm also started from the top and bottom edges instead of the center line, leaving center and corner pixels in hollow ellipses. Both editors now use PixelArt's center-origin algorithm and the same raster path for preview and commit.
- Studio's Rotate 90° button called the wrong API when no marquee existed. Both editors now use the shared exact 90° pixel rotation for marquees. A lifted selection keeps its preview until Enter. The selection is shifted inward when it fits; if the rotated bounds exceed the canvas, the operation stops before lifting pixels.
- Studio once used a fixed 64× zoom ceiling and ruler labels every four source pixels. Large canvases need Fit below 100%, and the old labels overlapped. Both editors now share 10%–64× zoom steps and a ceiling based on the longest canvas edge: up to 64× below 128 px, 32× from 128 px, 16× from 256 px, and 8× from 512 px. The ruler keeps at least 40 CSS px between labels.
- PixelArt Undo restored a new data tree while Layers retained handlers pointing to the old tree. Layers now rerenders after structural Undo/Redo before the next edit.
- PixelArt blocked Esc when the size input retained focus after clicking the canvas. Clicking the canvas now moves focus away from the input, applies its value, and restores keyboard shortcuts.
- Studio once used two horizontal-drag binders on the same Slice bars. Both apps now use one shared viewport binder.
- The Slice Inspector once rebuilt its entire table after each keystroke in a name, tag, or frame number. Editing now retains focus, and changing a tag recalculates the row instead of keeping a stale atlas/grid row.
- Studio Save/Undo on a new project once lost the initial snapshot when the adapter overwrote an empty history or changed index 0 to -1.
- The maintenance banner once covered the Create modal and received clicks over the Delete Slice button. The modal now appears above the banner; only the banner's close and Got it controls receive clicks. The interval remains 30 minutes.
- Studio Slice commit once edited the open project directly. PixelArt's fallback open flow once replaced the current tab. Both workflows now create a separate project. PixelArt PNG import puts alpha pixels in the source Region and reports dimensions beyond the profile limit.

## Isolation shortcut proposal

Double-clicking a Region enters isolation; Esc exits and restores focus to that Region. Ctrl+Enter or Cmd+Enter could be added for keyboard users. Proposed conditions: exactly one Region is selected, the canvas is active, no marquee is waiting for confirmation, and focus is outside text inputs and menus. Enter remains reserved for confirming a marquee. The new shortcut is still under discussion.

See the [stabilization ledger](STABILIZATION_LEDGER.md) and [shared engine audit](EDITOR_ENGINE_AUDIT.md) for executed cases and follow-up items.
