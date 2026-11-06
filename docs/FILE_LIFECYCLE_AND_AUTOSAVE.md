# NOIRADIX Studio — File Lifecycle, Autosave & Crash Recovery Architecture

**Document Version:** 1.0.0  
**Project:** NOIRADIX Studio  
**Target Capability:** Desktop-grade local file management in a zero-dependency web environment.

---

## 1. Architectural Philosophy: Desktop Application Experience in the Browser

Conventional web editors treat files as transient browser memory, forcing users to click "Download" repeatedly—producing clutter like `sprite (1).png`, `sprite (2).png`.

**NOIRADIX Studio implements a native desktop file lifecycle.**  
When running in a Chromium-based browser (Edge, Chrome, Opera, Brave), PIX2 uses the **File System Access API** to bind directly to actual `.pix2` files on the user's hard drive. In other browsers (Firefox, Safari), PIX2 provides a graceful, lossless download/upload fallback.

```
+-------------------------------------------------------------------------------+
|                             NOIRADIX Studio WORKSPACE                             |
+-------------------------------------------------------------------------------+
        |                                                 |
        v [Manual Save: Ctrl+S]                           v [Autosave Buffer: 30s / 1.5s]
+--------------------------------+               +--------------------------------+
|     ORIGINAL PROJECT FILE      |               |     LOCAL RECOVERY BUFFER      |
|        (e.g. Player.pix2)      |               |    (IndexedDB / LocalStorage)  |
| - Single source of truth       |               | - Crash protection only        |
| - Written via createWritable() |               | - Distinct from original file  |
| - Human & AI readable plaintext|               | - Timestamped session state    |
+--------------------------------+               +--------------------------------+
```

---

## 2. File Operations Workflow

### 2.1 Open (`Ctrl+O`)
1. Checks if current project has unsaved changes. If dirty, displays **Unsaved Changes Dialog** (`Save` / `Discard` / `Cancel`).
2. Invokes `window.showOpenFilePicker({ types: [{ description: 'PIX2 Sprite Files', accept: { 'application/x-pix2': ['.pix2', '.txt'] } }] })`.
   - *Fallback:* Standard hidden `<input type="file" accept=".pix2,.txt,image/png">`.
3. Stores the `FileSystemFileHandle` in editor state (`state.fileHandle`).
4. Reads and validates UTF-8 text using `PIX2.parse(content)`.
5. Updates project title, clears dirty flag (`isDirty = false`), resets undo/redo stack, and updates document tab title.

### 2.2 Save (`Ctrl+S`)
1. If an active writable file handle exists (`state.fileHandle`):
   - Requests write permission if necessary (`handle.requestPermission({ mode: 'readwrite' })`).
   - Serializes document: `const text = PIX2.serialize(state.doc)`.
   - Creates stream: `const writable = await state.fileHandle.createWritable()`.
   - Writes content: `await writable.write(text); await writable.close();`.
   - Clears dirty state (`isDirty = false`), shows toast: `"Saved Player.pix2"`.
2. If no file handle exists (e.g. freshly created new document):
   - Automatically diverts to **Save As**.

### 2.3 Save As (`Ctrl+Shift+S`)
1. Invokes `window.showSaveFilePicker({ suggestedName: `${title}.pix2`, types: [{ description: 'PIX2 Sprite File', accept: { 'application/x-pix2': ['.pix2'] } }] })`.
2. Serializes and writes to the new file handle.
3. Updates `state.fileHandle` and project title to point to the new destination.
4. *Fallback:* Generates Blob `URL.createObjectURL(new Blob([text]))` and triggers direct browser download.

### 2.4 New Project (`Ctrl+N`)
1. Prompts for Title, Columns, Rows, Cell Width, Cell Height.
2. Clears existing file handle (`state.fileHandle = null`), initializes blank document.
3. Sets clean state.

---

## 3. Document Dirty State & Visual Identity

The document identity clearly indicates modification status:
- Clean: `Player.pix2`
- Unsaved changes: `Player.pix2 ●` (or `* Player.pix2`)

### Dirty Trigger Criteria:
- Modifying pixel records (pencil, eraser, bucket, line, rect, symmetry).
- Modifying palette colors or adding new colors.
- Renaming cells or changing cell direction tags.
- Adding, removing, or reordering animation frames.
- Changing grid layout (adding/removing rows or columns).

### Non-Dirty Actions:
- Zooming or panning the canvas.
- Switching between tabs (`Grid Overview` $\leftrightarrow$ `Animation Studio`).
- Selecting a tool or hovering pixels.
- Opening/closing dialogs or dragging floating panels.

---

## 4. Autosave Architecture & Crash Recovery

### Principle: Local Recovery Snapshot $\neq$ Original File Overwrite
A web application must **NEVER** silently overwrite the user's master file without explicit intent. Therefore:
1. **Manual Save (`Ctrl+S`):** Commits to the real `.pix2` file on disk.
2. **Autosave Engine:** Writes to an isolated local recovery store (`IndexedDB` / `localStorage` key `pix2_recovery_snapshot`).

### Dual Autosave Triggers:
1. **Autosave by Time:** Every 30 seconds, if `isDirty === true`, serializes and caches the recovery snapshot with ISO timestamp.
2. **Autosave by Event (Debounced 1500ms):** When the user completes a continuous drawing stroke or modifies metadata, a 1500ms debounce timer triggers a background snapshot.

### Crash Recovery Workflow:
When NOIRADIX Studio launches:
1. Inspects `localStorage.getItem('pix2_recovery_snapshot')`.
2. If a snapshot exists with `timestamp > last_manual_save`:
   - Surfaces **Crash Recovery Banner / Modal**:
     > **Unsaved Session Recovered:** A recovery snapshot from `10:14 PM (2 mins ago)` was found.  
     > `[ Restore Recovery Session ]` `[ Discard Recovery ]`
3. Restoring the snapshot immediately repopulates the canvas and history stack without loss.

---

## 5. Document History & Undo / Redo Engine

### Full Document Scope
Undo (`Ctrl+Z`) and Redo (`Ctrl+Y` / `Ctrl+Shift+Z`) track the **entire document**, not merely canvas pixels:
- Pixel strokes & erasing
- Shape tools (Line, Rectangle, Flood Fill)
- Cell renaming & Direction tagging
- Palette edits & color replacements
- Grid additions & deletions (Rows, Columns)
- Animation frame additions, reordering, and FPS adjustments

### Stroke Grouping Invariant
Continuous mouse drag drawing MUST be recorded as **one logical undo step**, rather than hundreds of individual mouse-move events.
- On `mousedown`: Pre-stroke document state is preserved.
- On `mouseup`: If any pixel changed, push snapshot to undo stack.
- Pressing `Ctrl+Z` reverses the entire stroke in a single keystroke.

---

## 6. Real-Time External Change Detection & Live Hot-Reload Architecture

### 6.1 The Challenge: Multi-Process Collaboration (AI Agents, VS Code, Git)
When a user works with AI coding assistants (such as Antigravity, Claude, or Cursor) or modifies `.pix2` files using external editors or command-line scripts, the underlying file on disk changes independently of the running browser tab.

A naive web editor creates severe failure modes:
1. **Blind Cache:** The editor remains oblivious to external edits, continuing to display stale memory state.
2. **Silent Overwrite (Catastrophic Data Loss):** If the user later draws a pixel in the editor and presses `Ctrl+S`, the editor's in-memory document overwrites the disk file, destroying all external AI edits.

### 6.2 Triple-Trigger Live Hot-Reload Engine
NOIRADIX Studio integrates a non-polling, resource-efficient three-tier change detection engine:
1. **Window Focus Sync (`window.onfocus`):**
   When the user switches application focus from VS Code, terminal, or AI chat back to NOIRADIX Studio, the app immediately queries `currentFileHandle.getFile()`.
2. **Page Visibility Sync (`document.visibilitychange`):**
   Triggers whenever the browser tab transitions from `hidden` to `visible`.
3. **Heartbeat Observation (1500ms when tab is active):**
   When the user arranges VS Code and NOIRADIX Studio side-by-side on two monitors without switching active window focus, a lightweight 1500ms interval inspects `file.lastModified` and text content.

```
[ External AI Agent / Script / Git ]
             │ writes to disk
             ▼
      [ Disk: Player.pix2 ]
             ▲
             │ (1) Window Focus
             │ (2) Visibility Change
             │ (3) 1500ms Active Heartbeat
             │
[ NOIRADIX Studio Watcher Engine ]
             │
     ┌───────┴────────────────────────┐
     ▼                                ▼
[ If Studio is Clean (!isDirty) ]   [ If Studio has Unsaved Edits (isDirty) ]
  • Instant parse & re-render         • Surface non-destructive conflict alert
  • Toast: "⚡ Reloaded from disk"    • Pulse warning on Reload button
  • Update lastKnownFileModified      • Ask: [Reload from Disk] or [Keep Studio Edits]
```

---

## 7. Smart Conflict Resolution (Zero Data Loss Invariant)

### 7.1 Clean Auto-Reload
If the editor state is clean (`isDocumentDirty === false`):
- The new external content is automatically parsed via `PIX2.parse(text)`.
- The document state, canvas, rulers, timeline, and animation players update synchronously.
- `lastKnownFileModified` and `lastSavedContent` are synchronized.
- An informative toast notifies the artist: `⚡ Reloaded <filename> from disk (external update detected)!`.

### 7.2 Conflict Guardrails
If the artist has unsaved drawings in Studio (`isDocumentDirty === true`) when an external change is detected:
- Studio **NEVER** silently overwrites the artist's canvas.
- A warning toast alerts the user: `⚠️ "<filename>" changed externally on disk! Click "Reload Disk" in status bar or Save to overwrite.`.
- The status bar reload button (`#btn-reload-file`) activates a visual pulse warning (`.pulse-warning`).
- The user can either:
  1. **Click "Reload from Disk" (or `Ctrl+Shift+R`):** Prompts for confirmation, then discards Studio edits and pulls the latest disk version.
  2. **Press "Save" (`Ctrl+S`):** Explicitly commits the Studio version, intentionally overriding the external change.
