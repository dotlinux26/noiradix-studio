# History, autosave and recovery contract

Maintained for Studio and PixelArt RC2. Artwork and history belong to each app/session; shared engine commands report changes and never own a global undo stack.

## History

- Studio uses `EditorState` full-document serialized snapshots, currently capped at 50 entries. A continuous gesture is one beginStroke/endStroke transaction. `applyDocument` applies source/external replacement through existing history; new/open sessions use setDocument to establish a new baseline.
- PixelArt uses full structural snapshots for layered artwork and a raster snapshot/diff hybrid for flat artwork. Current limits are 50 entries and a byte budget of max(50 MiB, width × height × 80); pruning rebases the next entry before removing its base.
- A successful mutation after Undo removes the redo branch. No-op, focus, hover, zoom and pan do not create a content history entry. Failed/cancelled commands retain redo and dirty state.
- Pixel color, alpha, layer/group/region identity, order and dimensions must survive Undo/Redo. A composited pixel cache cannot substitute for structural source data.
- Floating selections retain a lift-time source and cancellation baseline through the shared session. Cancel restores that source; adapters own composite refresh and history publication. View state stays outside exported PIX2.

## Browser recovery and disk saving

These are separate outcomes. A browser draft indicator does not mean a file was saved to disk. Storage quota, permission denial, private browsing, eviction or clearing site data can prevent recovery.

| Area | Studio | PixelArt |
|---|---|---|
| Workspace catalog | `noiradix_open_project_sessions` | `noiradix_pixelart_open_sessions` |
| Catalog backend | Shared localStorage/IndexedDB fallback and timestamp arbitration | Same shared catalog mechanism |
| Event autosave | 1200ms debounce | 1000ms debounce; some lifecycle events request immediate persistence |
| Periodic trigger | 30 seconds when dirty | 20 seconds |
| Legacy/fallback active draft | `pix2_recovery_snapshot`, `pix2_draft_content` | `pix2_pixelart_autosave` plus IndexedDB autosaves |
| Recovery payload | Canonical document source and session catalog | Schema 3 canonical `documentSource`; legacy pixel payloads remain readable |
| Linked disk file | Studio may also queue a permission-allowed native save | Explicit native save path; recovery autosave persists browser draft |

Timing and storage keys describe this implementation and are not PIX2 file-format fields. Existing schema/keys remain compatible during refactoring.

## Recovery acceptance

- Validate catalog shape before selecting the newest local/IndexedDB copy. Corrupt newer local data must not hide a valid backup.
- Preserve an intentionally empty workspace after closing all tabs; do not resurrect discarded drafts.
- Restore canonical structural source, rather than only its composite. Legacy recovery readers remain supported where implemented.
- A delayed save/read must retain its originating session/handle/revision. Completing an older snapshot cannot mark later edits as saved.
- External invalid source must leave current artwork intact. Compare a recovered draft with its linked disk baseline before claiming disk synchronization.
- Checks and platform limits are recorded in `discussion/EDITOR_REFACTOR_PROGRESS.md`. Native API simulations are distinct from manual OS-picker verification.
