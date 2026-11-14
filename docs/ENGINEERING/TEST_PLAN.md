# NOIRADIX Studio — Automated Test Plan & Acceptance Matrix

## 1. Test Architecture
The test suite operates standalone using Node.js without third-party test framework dependencies (zero npm packages required).

- **Execution Commands:**
  ```bash
  # 1. Semantic roundtrip determinism & feature verification suite (96 tests)
  node tests/test-roundtrip.js

  # 2. Security, prototype-pollution & anti-DoS defense suite (20 tests)
  node tests/test-security.js

  # 3. TextMate regex pattern & capture group suite (6 checks)
  node tests/test-tmLanguage.js

  # 4. Normative test vector conformance suite (11 tests)
  node tests/test-vectors-conformance.js

  # 5. Syntax validation across all engine modules
  node --check js/app.js
  node --check js/pix2-format.js
  node --check js/editor-state.js
  node --check js/animation-player.js
  node --check js/tools.js
  node --check pix2/js/pix2-format.js
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
  * Verification of the official template `samples/Noiradix_Ghost.pix2` (16 cells, 4-direction animations, 7-color palette).
* **Group 4: Custom Cell IDs & Grid Mapping (4 tests)**
  * Verification of decoupled cell identifiers (e.g., `reaper_down_0`).
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

### Test Suite 2: Security & Anti-DoS Defenses (`test-security.js` — 21 Tests)

* **Group 1: Prototype Pollution Defenses (4 tests)**
  * Rejects `@cell __proto__`, `@animation __proto__`, and `@palette __proto__` from polluting `Object.prototype`.
  * Immune color lookup against prototype properties (`toString`, `valueOf`, `constructor`).
* **Group 2: Denial-of-Service (DoS) & Resource Clamping (6 tests)**
  * Clamps astronomical grid dimensions ($999999 \times 999999$).
  * Clamps astronomical cell dimensions.
  * Limits massive rect fill and flood fill stack/heap execution.
  * Bresenham line step guards to prevent infinite loops.
  * Clamps out-of-bound coordinates ($|\text{coord}| > 2048$) and emits `PIX2_ERR_RESOURCE_LIMIT`.
* **Group 3: Document Validation & Strict Integer API (9 tests)**
  * Validates healthy `.pix2` documents and flags illegal keys.
  * Strict mode out-of-bounds coordinate detection.
  * Non-existent animation frame references (`phantom_cell`).
  * Strict integer validation strictly rejecting malformed coordinates (`1abc,3`), floats (`1.5`), and unsafe integer overflow.
  * Strict rectangle validation enforcing dimensions $\ge 1\times 1$ and valid modes (`outline` | `fill`).
  * Canonical `cell_size` synchronization with non-enumerable `cellSize` alias.
* **Group 4: Client-Side XSS & Sanitization Defense (2 tests)**
  * Preserves raw markup in document graph while shielding against DOM injection.
  * Sanitizes identifier keys, eliminating prototype pollution and path traversal tokens.

---

### Test Suite 3: TextMate Regex Pattern & Capture Group Tests (`test-tmLanguage.js` — 6 Checks)

* **Check 1: JSON Structure & Schema Conformance:** Validates strict JSON syntax and schema compliance.
* **Check 2: RegExp Pattern Compilation:** Ensures all regex patterns in repository compile cleanly without runtime errors.
* **Check 3: Comment vs Hex Color Disambiguation:** Strictly validates that `#RRGGBB` hex colors are not swallowed as comments, and comments require preceding whitespace. Rejects invalid 5 and 7-digit hex sequences.
* **Check 4: Directives & Section Identifier Captures:** Verifies capture group 1 (`@cell`, `@animation`, `@pix2`) and group 4 (section identifiers/versions) across all 9 directives.
* **Check 5: Negative Coordinate Parsing:** Verifies signed integer coordinates (`-5,-10`) retain minus signs without corruption.
* **Check 6: Standard Properties & Custom Palette Keys:** Verifies property key tokenization and strictly separated key-value punctuation (`support.type.property-name.pix2` + `punctuation.separator.key-value.pix2` with whitespace excluded).

---

### Test Suite 4: Normative Test Vector Conformance (`test-vectors-conformance.js` — 11 Tests)

* **Test 1:** Synchronization verification: byte-for-byte SHA-256 equivalence between standalone `pix2/js/pix2-format.js` and root `js/pix2-format.js`.
* **Test 2:** Deep semantic structural equality against immutable baseline `canonical_valid_hero.json`.
* **Test 3:** Canonical AST JSON serialization emitting only `cell_size` without duplicate keys.
* **Test 4:** Diagnostic emission for malformed coordinates (`invalid_syntax_coordinate.pix2`).
* **Test 5:** Strict validation error for missing animation frames (`invalid_missing_frame.pix2`).
* **Test 6:** Strict validation error for out-of-bounds coordinates with diagnostic code `PIX2_WARN_OUT_OF_BOUNDS` (`invalid_out_of_bounds.pix2`).
* **Test 7:** Roundtrip preservation of unused palette entries and string quotes.
* **Test 8:** Missing version parameter in `@pix2` directive flagged with diagnostic and failed strict validation.
* **Test 9:** Trailing non-comment content after `@end` marker flagged with diagnostic and failed strict validation.
* **Test 10:** Deterministic vector primitives rasterization (`canonical_primitives_raster.pix2`): Bresenham line, rect fill/outline, sym_dot, and Last-Write-Wins (LWW) overwrite rules.
* **Test 11:** Structured Diagnostic API contract emitting `code`, `severity`, `cell_id`, and exact `coordinate` metadata.

---

## 3. Overall Test Status

```text
====================================================
TEST RESULTS: 96 / 96 PASSED (Roundtrip & Features)
SECURITY TEST RESULTS: 21 / 21 PASSED (Defenses & Anti-DoS)
REGEX PATTERN RESULTS: 6 / 6 PASSED (TextMate Regex Patterns)
CONFORMANCE TEST RESULTS: 11 / 11 PASSED (Normative Vectors)
Historical acceptance count from the original plan: 134 / 134. This is not the current suite inventory; run `node tests/run-all.cjs` for current results.
====================================================
```
