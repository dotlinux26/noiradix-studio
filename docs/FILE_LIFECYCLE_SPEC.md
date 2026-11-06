# NOIRADIX Studio — File Lifecycle Specification

## 1. Document File Formats & Extensions
- **Primary Source Format:** `.pix2` (UTF-8 Plaintext Structured Sprite DSL).
- **Secondary / Export Artifacts:**
  - Raster Atlas: `.png` (lossless RGBA with nearest-neighbor point sampling).
  - Slice Frames Archive: `.zip` (individual `.png` files named by cell ID).
  - Unity Sprite Importer Metadata: `.pix2.json` (slices, bounding boxes, pivots, and animation FPS).

## 2. File Ingestion & Loading Protocols
Noiradix Studio implements a progressive, feature-detected file loading strategy:

### A. File System Access API (`window.showOpenFilePicker`)
- Supported in modern Chromium-based browsers (Chrome, Edge, Opera, Brave).
- Opens native OS file picker with MIME filter: `text/plain`, `.pix2`.
- Retains `FileSystemFileHandle` in memory to allow direct in-place saving (`Ctrl+S`) without repeatedly popping up download prompts.

### B. Fallback Standard Input (`<input type="file">`)
- Automatic fallback for Firefox, Safari, and isolated WebViews.
- Reads file stream asynchronously via `FileReader.readAsText()`.
- Transitions save operations to browser download streaming.

### C. Desktop Drag-and-Drop
- The entire window acts as a drop target (`dragover`, `drop`).
- Visual overlay indicates drop state.
- Inspects `DataTransfer.files` or `DataTransfer.items[0].getAsFileSystemHandle()`.
- Validates file extension (`.pix2` or `.png`).
  - If `.pix2`: parses and replaces active document (with dirty confirmation).
  - If `.png`: opens the interactive Sprite Sheet Slicer modal with configurable grid margins and dimensions.

## 3. Save & Save As Protocols
- **Save (`Ctrl+S`):**
  - If a valid `FileSystemFileHandle` exists with write permissions:
    - Atomically writes serialized `.pix2` text using `handle.createWritable()`.
    - Resets dirty tracking indicator to green (`Saved`).
  - If no writable handle exists:
    - Automatically routes to **Save As**.
- **Save As (`Ctrl+Shift+S`):**
  - Prompts with native `showSaveFilePicker` (default filename `${title}.pix2`).
  - Fallback: creates an ephemeral Blob URL (`data:text/plain;charset=utf-8,...`) and triggers an automatic anchor download with `.pix2` extension appended exactly once.

## 4. Unsaved Changes & Dirty Tracking
- Every mutation (stroke, row duplicate, palette change, animation tweak) flags `state.isDirty = true`.
- Window `beforeunload` listener intercepts tab closure when dirty:
  - Prompts user to prevent accidental data loss.
- Document title in header displays an asterisk (`*`) when dirty.
