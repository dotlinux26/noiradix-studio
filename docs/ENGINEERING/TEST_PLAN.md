# Noiradix Studio — Automated Test Plan & Acceptance Matrix

## 1. Test Architecture
The test suite operates standalone using Node.js without third-party test framework dependencies (zero npm packages required).

- **Execution Command:**
  ```bash
  node tests/test-roundtrip.js
  node tests/test-security.js
  ```

## 2. Test Groups & Coverage

### Group 1: Lexer & Comment Disambiguation (14 tests)
- Semicolon comments (`; comment`).
- Hash comments with space (`# comment`).
- 3, 6, and 8-digit hex color preservation with alpha channels.
- Cell direction and animation references.

### Group 2: Semantic Roundtrip Determinism (7 tests)
- `Parse -> Serialize -> Parse` produces identical metadata, grid dimensions, cell pixel maps, and animations.

### Group 3: Real-World Ingestion (2 tests)
- Verification of standard `samples/Player.pix2` with 16 cells and custom palette.

### Group 4: Custom Cell IDs & Grid Mapping (4 tests)
- Verification of externally generated LLM files (e.g., ChatGPT `Ashen_Reaper_Walk_4Dir.pix2`).
- Mapping `grid_pos: r,c` into decoupled row/column indices.

### Group 5: Row Operations & Semantic Verification (6 tests)
- Row-only flip horizontal and vertical (verifies row 0 flips while row 1 remains strictly identical).
- Row duplication (clones cells, expands grid rows, creates animation sequence).

### Group 6: Security & Malicious Payload Defenses (13 tests)
- Prototype pollution protection (`__proto__`, `constructor`, `prototype`).
- Denial of Service (DoS) clamping of astronomical dimensions ($999999 \times 999999$).
- Bresenham line and flood fill loop guards.
- Client-side XSS and key sanitization.

**Current Test Status:** **46 / 46 PASSED (100%)**

