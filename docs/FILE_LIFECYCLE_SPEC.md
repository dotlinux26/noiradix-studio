# File lifecycle contract

Maintained for Studio and PixelArt RC2; source is UTF-8 PIX2 1.1 with 1.0 read compatibility. PNG and game packages are derived artifacts.

## Open and import

Apps feature-detect native File System Access APIs and use a file-input/download fallback when unavailable. Native handles identify disk entries; equal display names do not identify the same file. Studio reuses an already-open native entry; opening another file creates an independent session. PixelArt retains its own session-opening adapter. PNG ingestion goes through the app's artwork/atlas import flow.

Parse and validate before publishing into a working document. `PIX2.parseValidated(text, options)` rejects error-bearing partial parse results; `parse` remains available for diagnostic tooling. Rejected external source keeps both artwork and the code view intact. App-specific profile limits apply during parsing and validation.

## Save and Save As

- Capture document text, revision, originating session and handle before asynchronous work.
- Invoke a needed native picker within the initiating user gesture; serialize writes through the shared queue.
- Check write permission, write and close the stream; publish the saved baseline after successful completion. Abort a failing stream when supported.
- A completion updates its originating session. It cannot redirect a write or replace the active tab's handle. Edits newer than the captured snapshot remain unsaved.
- Permission denial, picker cancellation and write failure retain unsaved state and allow retry. Closing the originating tab does not reroute a write already in flight.
- Fallback creates a Blob download with the captured filename/content and revokes its URL. A download does not provide a native handle for future in-place writes.

## Watch and recovery

Studio stores the current native handle in IndexedDB with its project-session ID. On workspace restoration, reconnect only that session's matching filename/ID before activating it. Compare the on-disk PIX2 with the restored workspace: identical content is clean; a clean stale workspace adopts valid disk content; a dirty draft is preserved. Keep the previous saved-content baseline and file timestamp so an external edit made while the app was closed can be detected and surfaced as a conflict.

Capture file identity, active session and revision for an asynchronous read; discard stale completions. Dirty in-memory content requires conflict handling before external replacement. On window focus, compare file contents even if the filesystem timestamp is unchanged; periodic polling may use timestamps to avoid repeatedly reading large documents. Native file access and watcher availability depend on browser capabilities and permission, not a promised minimum browser version. If the saved handle cannot be read after reload, keep the browser draft and show it as unlinked rather than claiming it is saved to disk.

The download fallback is not a persistent file connection. A downloaded file cannot be silently mapped back to its original path after reload; reopen it or use Save As to grant a writable handle.

Browser recovery is independent of disk saving. See `HISTORY_AUTOSAVE_RECOVERY_SPEC.md` for catalogs, current timing, fallback behavior and storage failure limits.

## Export snapshots

Raster preview zoom reuses its encoded artwork until export options change. Fit measures the visible viewport. Reject oversized allocations before canvas/buffer creation and disable execution until options become valid.

An export retains invocation-time metadata/animations across PNG encoding. Per-frame ZIP encoding retains corresponding source pixels; Unity/TexturePacker metadata capture does not duplicate unused rasters. Full composite output remains independent of editor isolation.

## Evidence

`tests/browser/test-file-lifecycle.cjs` exercises both normal entry points with delayed/failing native-handle simulations, duplicate names, late edits, Save As, permission denial, cancelled pickers, retry and invalid external reload. `tests/browser/test-disk-restore.cjs` covers Studio handle reconnection and disk reconciliation through both HTTP and `file://`, including clean stale workspaces, dirty drafts and same-timestamp external edits. `test-workspace.cjs` reads downloaded Unity/TexturePacker/frame archives and checks a delayed PNG export snapshot. Manual OS pickers and other browser engines remain separate review coverage. Phase-by-phase findings: `discussion/EDITOR_REFACTOR_PROGRESS.md`.
