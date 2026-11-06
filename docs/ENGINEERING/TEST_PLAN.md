# NOIRADIX Studio — Automated Test Plan & Acceptance Matrix

## 1. Test Architecture
The test suite operates standalone using Node.js without third-party test framework dependencies (zero npm packages required).

- **Execution Commands:**
  ```bash
  # 1. Semantic roundtrip determinism & feature verification suite (96 tests)
  node tests/test-roundtrip.js

  # 2. Security, prototype-pollution & anti-DoS defense suite (14 tests)
  node tests/test-security.js

  # 3. Syntax validation across all engine modules
  node --check js/app.js
  node --check js/pix2-format.js
  node --check js/editor-state.js
  node --check js/animation-player.js
  node --check js/tools.js
  ```

---

## 2. Test Groups & Coverage Matrix

### Test Suite 1: Semantic Roundtrip & Feature Verification (`test-roundtrip.js` — 96 Tests)

* **Group 1: Lexer & Comment Disambiguation (14 tests)**
  * Semicolon comments (`; comment`).
  * Hash comments preceded by whitespace (`# comment`).
  * 3, 6, and 8-digit hex color preservation with alpha channels.
  * Cell direction tags and animation reference resolution.
* **Group 2: Semantic Roundtrip Determinism (7 tests)**
  * `Parse -> Serialize -> Parse` produces identical metadata, grid dimensions, sparse cell pixel maps, and animations.
* **Group 3: Official Reference Mascot Verification (3 tests)**
  * Verification of the official template `samples/Noiradix_Ghost.pix2` (16 cells, 4-direction animations, 7-color palette) **authored and synthesized by Gemini 3.8 Flash**.
* **Group 4: Custom Cell IDs & Grid Mapping (4 tests)**
  * Verification of decoupled cell identifiers (e.g., LLM-generated `reaper_down_0`).
  * Mapping `grid_pos: r,c` into decoupled row/column indices.
* **Group 5: Row-Only Flip & Duplication (6 tests)**
  * Row-only horizontal and vertical flip (verifies row 0 flips while other rows remain strictly identical).
  * Row duplication (clones cells, expands grid rows, creates new animation sequences without data loss).
* **Group 6: Row Movement & Safe Animation Assignment (8 tests)**
  * Row reordering without pixel loss.
  * Non-destructive animation binding over existing cells.
* **Group 7: Pan Tool & Analytical Cursor-Centered Zoom (9 tests)**
  * EditorState pan tool activation via single-key <kbd>H</kbd> and <kbd>Space</kbd>+Drag.
  * Analytical cursor-centered zoom formula maintaining invariant anchor coordinates across $4\times$ to $64\times$.
  * Right-click grid focus resolution.
* **Group 8: Animation Player Scaling & Auto-Fit Math (7 tests)**
  * Default crisp scale ($8\times$).
  * Dynamic integer auto-fitting ($16\times 16$ up to $25\times$).
* **Group 9: Grid Free Panning & Atlas Magnifying Zoom (5 tests)**
  * $360^\circ$ delta translations and multi-tier magnifying glass zoom controls ($1\times, 2\times, 4\times$, Fit).
* **Group 10: Multilingual UTF-8, Vietnamese Diacritics & Whitespace (15 tests)**
  * Preserves Vietnamese tone marks (e.g. `Dũng Sĩ Bóng Đêm.pix2`, `Đòn Đánh Sấm Sét 01`).
  * Full whitespace preservation and CJK character set compatibility.
  * Windows reserved device name shielding (`CON`, `AUX`, `NUL`, `COM1`).
  * Anti-overwrite protection when active filename differs from file handle.
* **Group 11: Cross-Platform Interoperability (8 tests)**
  * Unicode normalization (reconciling macOS NFD and Windows/Linux NFC).
  * Line ending agnostic parsing (`CRLF`, `LF`, `CR`, mixed).
* **Group 12: Editor State Stability & Tab Preservation (10 tests)**
  * Tab persistence across reloads.
  * Historical active tab tracking across Undo/Redo actions.

---

### Test Suite 2: Security & Malicious Payload Defenses (`test-security.js` — 14 Tests)

* **Group 1: Prototype Pollution Defenses (4 tests)**
  * Rejects `@cell __proto__`, `@animation __proto__`, and `@palette __proto__` from polluting `Object.prototype`.
  * Immune color lookup against prototype properties (`toString`, `valueOf`, `constructor`).
* **Group 2: Denial-of-Service (DoS) & Resource Clamping (6 tests)**
  * Clamps astronomical grid dimensions ($999999 \times 999999$).
  * Clamps astronomical cell dimensions.
  * Limits massive rect fill and flood fill stack/heap execution.
  * Bresenham line step guards to prevent infinite loops.
  * Clamps out-of-bound coordinates ($|\text{coord}| > 2048$).
* **Group 3: Document Validation API (2 tests)**
  * Validates healthy `.pix2` documents and flags illegal keys.
* **Group 4: Client-Side XSS & Sanitization Defense (2 tests)**
  * Sanitizes identifier keys, eliminating prototype pollution and path traversal tokens.

---

## 3. Overall Test Status

```text
====================================================
TEST RESULTS: 96 / 96 PASSED (Roundtrip & Features)
SECURITY TEST RESULTS: 14 / 14 PASSED (Defenses & Anti-DoS)
TOTAL ACCEPTANCE: 110 / 110 PASSED (100%)
====================================================
```
