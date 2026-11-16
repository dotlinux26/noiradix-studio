# Grid persistence and source-preserving selection

## Current implementation status

The entries below preserve the investigation history; their earlier incomplete statuses are superseded by this summary.

- Both shared toolbar entries are enabled through normal app entry points. PixelArt highlights the all-layer tool distinctly from ordinary selection.
- Browser checks cover source-preserving move, delete, cut/paste, quarter turns, flips and scale handles in both apps. PixelArt additionally covers shared-union alignment and paste into a new project; Studio covers paste into another frame with strict format validation and unique node IDs.
- PixelArt resize handles now accept clicks in the part of the handle outside the canvas boundary. This fixes a real edge-handle usability defect without allowing drawing outside the artwork.
- Studio conversion both ways, Undo/Redo, save and reopen preserve every frame's composite. PixelArt covers conversion warning cancellation, conversion both ways and Undo/Redo.
- Shared Node checks cover hidden/locked ancestors, isolation, overlap, transparent pixels, empty masks, canvas clipping and cancellation when source ownership changes.
- Verification: all 24 discovered Node suites, 37 runtime syntax files and 10 browser suites passed. After the full browser run, the focused tests passed again with added cross-project clipboard and Escape cancellation assertions. This implementation is included in v2.2.5; the release verification ledger records the publication gates.
- Limits of evidence: the Grid save/reopen fixture uses a simulated native file handle; it proves serialized content and app lifecycle, not a manual operating-system picker interaction. Arbitrary-angle raster rotation and downscaling can lose samples as expected for nearest-neighbor pixel art; structural ownership remains separate.

## Operation boundaries

All-layer selection edits only visible, unlocked source regions and respects isolation. Whole-frame Grid copy/duplicate/flip/clear operates on the complete frame hierarchy, including hidden or locked contents, while retaining their structural attributes. These are frame-level commands rather than edits to the focused region. Center All computes one union offset over the editable, visible source regions in each frame; it never centers individual regions independently.

PIX2 version conversion belongs to the document. Flatten warns before discarding hierarchy and composites visible content; cancelling leaves the original document intact. Upgrade wraps the flat raster in default source structure. Editor selection masks and floating transactions are transient and do not add format directives.

## GRID-01: structured frame operations

- App: Studio Grid Overview. Affected entry points include paste, duplicate, flip and clear.
- Repro: edit a PIX2 1.1 structured frame from Grid Overview, save and reload.
- Expected: the operation persists in the source regions and survives reload.
- Finding: the existing implementation mutates the derived composite cache, which is not the serialized structural source.
- Status: work in progress. Frame paste and duplicate, row duplicate, flip and clear now operate on structural sources. Copies get document-unique node IDs and parent links; row and cell ID changes rebind ownership. Review lock semantics, metadata undo, copy to flat frames and browser reload before release.
- Verification: `node tests/run-all.cjs` passed 23 Node suites, including structural clone serialization and ID checks; this does not verify the new UI paths.

## SELECT-01: multi-layer and free selection

- Apps: Studio and PixelArt. Expected: preserve source regions; free selection includes painted pixels only and Ctrl adds strokes.
- Alignment decision: when all layers are selected, calculate one bounding box for the union and apply one shared translation to all selected source regions. Never align each region independently.
- Grid Overview Center All uses one shared offset per frame across its editable, visible Regions; this preserves their relative positions. Each frame is still centered separately within its own canvas. A Node regression covers two separated regions.
- Status: incomplete. Studio and PixelArt free-selection create a painted-pixel mask through mouse gestures and Ctrl accumulation; raster extraction, cut/delete/fill honor the mask. Pending gestures cancel on Escape, blur and document switch. Browser regressions cover selecting, deleting and undoing a painted pixel in both apps and Ctrl accumulation in Studio. Both multi-layer adapters remain unwired, and the multi-layer button is still disabled.
- Verification: `node tests/test-multi-selection.js` covers overlapping source pixels, a free-selection mask, hidden ancestors, shared center and cancel when a parent becomes locked. `tests/browser/test-grid-roundtrip.cjs` exercises Grid copy/paste, context-menu flip, undo, Ctrl+S, reload and reopen with a simulated file handle; a native OS picker was not exercised. Browser interaction and the remaining transform cases have not been verified.

## MODE-01: PIX2 version conversion

- Apps: Studio and PixelArt. Expected: explicit conversion with a loss warning before flattening 1.1 to 1.0, with undo and persistence.
- Status: incomplete. Studio and PixelArt have explicit conversion controls with confirmation before flattening. PixelArt history captures the format for conversion undo. PixelArt browser regression covers warning cancellation, conversion both ways, Undo/Redo and retained pixels. Studio conversion and reload verification remain outstanding.

### Adapter verification update

- Both apps now connect the multi-source transaction to move, scale, rotate, flip, fill, delete and clipboard operations. The toolbar entry remains disabled until the remaining interaction matrix is verified; this is not a completed feature handoff.
- PixelArt browser regression now creates two separate layers/regions, deletes and restores both, cuts/pastes both, and moves both through the actual canvas. It asserts the second region retains its ID and its own blue pixel at the translated coordinate. PASS on the current working tree.
- The source-editor fixture explicitly returns to Split View after applying source, because Apply correctly switches to Canvas View. The previous timeout was a hidden test control, not a conversion failure.
- Alignment now bounds the union to the selection rectangle as well as the optional painted mask. Previously, a rectangular selection could align unrelated pixels outside that rectangle. A Node regression covers this exclusion.
- Verification: all 24 discovered Node suites pass. Remaining gates include browser scale/rotation, clipboard across frames/documents and flat-format compatibility, conversion reload in Studio, and the complete browser suite. Native disk-picker behavior is not proved by the simulated file handle.
- Clipboard ownership now uses project-session ID plus cell ID, so Undo/Redo replacing document objects does not mistakenly append a copied hierarchy when pasting back into the same source frame. PixelArt regression checks layer count after copy, Undo/Redo and paste.
- The complete browser runner passed 10 suites (including both new suites), and syntax checking passed 37 runtime files. The focused conversion regression passed again after adding clipboard history coverage. This still does not close the remaining multi-layer transform/lifecycle gates listed above.

### Transform and queued-source-parse update

- Browser coverage now verifies four quarter turns and two horizontal flips preserve each original source region in both apps. PixelArt also verifies that left alignment translates both layers with one union offset.
- A new reproduction exposed an actual PixelArt race: editing source queues a live parse for 200 ms; pressing Apply did not cancel it. If the user then moved a selection, the delayed parse replaced the active document mid-transaction. The ownership guard correctly refused to commit to a different document, but the user's move was lost.
- Fix: every explicit source application cancels the queued source parse before parsing. The browser sequence Apply → Undo/Redo → clipboard → canvas move now passed twice consecutively after the fix. No arbitrary test delay was added to mask this race.
- Flat PIX2 1.0 selection copies now use the existing raster clipboard path instead of incorrectly demanding a layered destination when pasted in another document.
- Remaining: direct scale-handle interactions, cross-document clipboard validation, Studio conversion reload and final feature enablement. This note records verified subsets, not release readiness.

### Studio scale and conversion persistence

- Studio browser regression drags a corner handle across a selection spanning two regions and compares the second region's resulting pixels with the shared nearest-neighbor transform. It retains the original region ID.
- Studio now exercises flatten, Undo, Redo, upgrade, Ctrl+S, page reload and reopening the saved serialized file, comparing every frame's composite pixels.
- This exposed a converter defect: JSON cloning removes the non-enumerable `meta.cellSize` alias. Flatten now reattaches it, as upgrade already does. It also composites each frame using its individual size, preventing larger frames from being clipped to the grid default. Root and standalone compiler copies were updated together.
- Node regression covers the alias and a painted coordinate outside the default frame size. All 24 Node suites and the focused Studio browser regression pass after the fix.
- Remaining verification: PixelArt scale handles, cross-document layered clipboard behavior and final toolbar enablement/lifecycle review.
