# NOIRADIX Studio — History, Autosave & Recovery Specification

## 1. Undo/Redo Engine Architecture

### State Snapshot Model
The history manager maintains a linear ring buffer of up to **64 undo states** per document session:
- **Stroke Batching:**
  Continuous pointer movements during a brush, eraser, line, or shape drag are batched between `state.beginStroke()` and `state.endStroke(actionName)`.
  This ensures a complex continuous drawing action is undone as a single atomic step.
- **Single-Action Commands:**
  Operations like **Duplicate Row**, **Flip Row H/V**, **Align Center**, and **Apply Palette** record immediate, single-step snapshots with human-readable descriptions (e.g., `Duplicate Row 0 as "Walk Down Copy"`).
- **Redo Branch Invalidation:**
  Performing any new mutating action while navigating past undo states clears the redo stack, preventing divergent history trees.

## 2. Dual Autosave Mechanism

Noiradix Studio utilizes two complementary autosave triggers:

### A. Event-Driven Autosave (Debounced)
- Triggers after any state-mutating stroke or structural edit.
- Debounced by **300ms** to avoid freezing the UI thread during rapid mouse clicks.
- Completely ignores non-mutating view events:
  - Canvas zooming / panning.
  - Marquee selection activation.
  - Floating panel dragging or docking.
  - Tab switching.

### B. Periodic Autosave (Timer Interval)
- A background timer triggers every **30 seconds**.
- Runs only if `state.isDirty === true` and document modifications exist.
- Writes compressed document JSON to browser `localStorage` under key `noiradix_studio_autosave_doc`.

## 3. Crash Recovery Protocol

- Upon page load, Noiradix Studio inspects `localStorage` for `noiradix_studio_autosave_doc`.
- If an autosave snapshot exists whose timestamp is newer than the saved file or default template:
  - Displays a non-intrusive recovery toast with action buttons:
    - **Restore Session:** Restores the in-memory document state, open cell tabs, active zoom level, and color swatches.
    - **Discard:** Clears the autosave record from `localStorage`.
- Corrupt recovery records are safely caught, discarded, and flagged without crashing the application.

