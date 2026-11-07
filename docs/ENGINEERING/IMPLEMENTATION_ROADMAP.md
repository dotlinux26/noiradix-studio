# NOIRADIX Studio — Issues, Decisions & Engineering Roadmap

**Document Reference:** `docs/ENGINEERING/IMPLEMENTATION_ROADMAP.md`  
**Last Updated:** 2026-11-07  
**Status:** Phase 5: Soft Feature Freeze (NOIRADIX Studio) & PIX2 v1.0 Stabilization Candidate  

---

## 1. Resolved Issues & Verified Fixes

| Issue ID | Severity | Description | Resolution Status |
| :--- | :--- | :--- | :--- |
| **BUG-01** | **P0** | Lexer treated `#` in `#RRGGBB` colors as comment delimiters when followed by trailing comment. | **FIXED:** Strict comment parser: `;` is primary comment token; `#` is treated as comment only if preceded by whitespace and not a hex code. |
| **BUG-02** | **P0** | `normalizeHex` truncated 8-character `#RRGGBBAA` hex codes down to 7 characters, destroying alpha transparency. | **FIXED:** Supported `#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`. Alpha values preserved from 0 to 255. |
| **BUG-03** | **P0** | Grid slicing naive `img.width / 4` ignored inter-cell gap (1px) in `Player.png` (67x67 with 16x16 cells). | **FIXED:** Integrated configurable `gap`, `margin`, and `cellSize` parameters. |
| **BUG-04** | **P1** | Round playback buttons (`.icon-round-btn`, `.play-btn`) stretched into tall ovals due to flexbox line-height. | **FIXED:** Enforced `aspect-ratio: 1 / 1 !important; flex-shrink: 0 !important; width: 32px; height: 32px;`. |
| **BUG-05** | **P1** | Rulers disconnected from canvas, sitting at viewport top-left while canvas floated in center. | **FIXED:** Integrated `.canvas-container-with-rulers` wrapping directly around `.canvas-stack`. |
| **BUG-06** | **P1** | Hardcoded pitch black `#12131b` tab bar and status bar caused jarring dark patches in Light Mode. | **FIXED:** Bound all UI elements to CSS theme variables (`--bg-secondary`, `--tab-bar-bg`, `--statusbar-bg`). |

---

## 2. Completed User Feedback & Implemented Solutions (P0 / P1)

### Issue A: Smashed / Overlapping Grid Column Headers ("vỡ đồ họa nè dính nè")
- **Cause:** `Col 0 (Frame 0)` text in canvas header was wider (~85px) than column slot width ($16 \times 3 + 16 = 64\text{px}$), causing adjacent column titles to collide and overlap.
- **Resolution:** [RESOLVED & IMPLEMENTED]
  1. Replaced with compact badges: `Col 0`, `Col 1` with centered spacing.
  2. Increased inter-cell column gap to 24px in Grid Overview so text never collides.
  3. Added interactive inline editing and renaming for Row and Column labels.

### Issue B: Custom Animation Management & Unlocking 4-Dir Restriction
- **Feedback:** Need flexible panel to add/edit/delete rows, columns, and custom animations beyond standard 4 directions.
- **Resolution:** [RESOLVED & IMPLEMENTED]
  1. Unbound animations from fixed 4-directional rows to arbitrary named clips (`walk_down`, `attack`, `jump`, `death`, `idle`).
  2. Integrated dedicated **Animation Manager Panel** in Grid Inspector: create, rename, delete clips, and reorder frames.
  3. Floating Animation Studio & workspace dropdown supports previewing all animations with live FPS and looping controls.

### Issue C: Dedicated Animation Workspace / Screen ("chế độ màn hình xem chuyên biệt")
- **Feedback:** Need dedicated screen mode for full animation authoring and timeline scrubbing.
- **Resolution:** [RESOLVED & IMPLEMENTED]
  1. Added dedicated top-level **[🎬 Animation Studio]** (`#view-animation-studio`) tab alongside Grid Overview, Cell Editor, and Code & AI.
  2. Integrated centered animation canvas with dynamic zoom (up to 25x auto-fit).
  3. Built horizontal frame timeline strip with thumbnails, duplicate/delete controls, and onion skinning ghosting.

### Issue D: Full Keyboard Shortcuts Suite
- **Feedback:** Professional pixel artists require single-key shortcuts and canvas navigation.
- **Resolution:** [RESOLVED & IMPLEMENTED]
  Implemented full shortcut suite: `Alt + Wheel` / `Wheel` (anchor zoom), `Space + Drag` (canvas pan), `V` (Select), `B` (Pencil), `E` (Eraser), `G` (Bucket), `I` (Eyedropper), `L` (Line), `U` (Rect), `S` (Symmetry), `X` (Swap colors), `D` (Reset colors), `Ctrl + 0` (Reset view), `Ctrl + Z` (Undo), `Ctrl + Y` (Redo).

### Issue E: Grid Row & Column Management
- **Feedback:** Allow dynamic row and column addition/removal on canvas.
- **Resolution:** [RESOLVED & IMPLEMENTED]
  Added interactive `[+ Add Row]`, `[- Remove Row]`, `[+ Add Col]`, `[- Remove Col]` controls, row renaming, and cell-to-animation bindings.

---

## 3. Engineering Checklist

- [x] Create formal `docs/PIX2/PIX2_SPECIFICATION.md` & `pix2/SPECIFICATION.md`
- [x] Create formal `docs/PIX2/PIX2_GRAMMAR.md` with signed coordinate EBNF
- [x] Create formal `docs/PIX2/PIX2_AI_GUIDE.md` & `pix2/AI_GUIDE.md`
- [x] Create issue tracker `docs/ROADMAP_AND_ISSUES.md`
- [x] Upgrade `js/pix2-format.js` & `pix2/js/pix2-format.js` Engine:
  - [x] Strict comment parser (`;` and non-hex `#`)
  - [x] Full RGBA preservation (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`)
  - [x] Decouple Cell ID from grid row/col
  - [x] User-defined animation model with arbitrary names
  - [x] Strict header requirement (`@pix2 <version>`) and trailing content detection after `@end`
  - [x] Canonical `cell_size` AST standardization with non-enumerable legacy `cellSize` accessor
- [x] Fix Grid Overview Canvas rendering:
  - [x] Prevent column header text collision (`Col 0` badges with proper spacing)
  - [x] Editable Row and Column names
  - [x] Add Row / Add Col buttons
- [x] Add Dedicated Animation Studio Tab (`#view-animation-studio`):
  - [x] Fullscreen preview canvas
  - [x] Horizontal frame sequence timeline
  - [x] Custom animation list (create, edit, delete, assign)
  - [x] Onion skinning support
- [x] Upgrade Keyboard Shortcuts (`Alt+Wheel`, `Space+Drag`, `V`, `B`, `E`, `G`, `I`, `L`, `U`, `S`, `X`, `D`, `Ctrl+0`, `Ctrl+Shift+R`)
- [x] Roundtrip test suite in `tests/test-roundtrip.js` (96/96 PASSED across 12 groups)
- [x] Security test suite in `tests/test-security.js` (20/20 PASSED across 4 groups)
- [x] TextMate regex pattern & capture group suite in `tests/test-tmLanguage.js` (6/6 checks PASSED)
- [x] Normative test vector conformance suite in `tests/test-vectors-conformance.js` (11/11 tests PASSED against immutable baselines)
- [x] Real-time external file watcher & live hot-reload engine with smart conflict resolution
- [x] AI Prompt Studio with 4 specialized prompt templates (Full Character, Walk Animation, Accessory Overlay, Surgical Patch)
- [x] Eliminated all hardcoded machine paths and hardened export templates
- [x] Standalone distribution in `pix2/` with dual licensing (Apache-2.0 / CC BY 4.0)
- [x] Single canonical specification in `pix2/SPECIFICATION.md` & synchronized EBNF
- [x] Normative drawing primitives semantics (line Bresenham, rect outline/fill, sym_dot, LWW)
- [x] Structured Diagnostic API in `validate()` returning typed diagnostic metadata
- [x] VS Code Extension distribution in `tools/vscode-pix2/` with TextMate grammar
- [x] GitHub Actions automated CI/CD deploying 100% green to `https://noiradix.me/`

---

## 4. Current Milestone: Phase 5 Soft Feature Freeze & Stabilization

- **NOIRADIX Studio Application:** Soft Feature Freeze. No new UI features or breaking architecture changes. Focus exclusively on performance, precision, and regression prevention.
- **PIX2 Reference Engine:** Feature Freeze. Stable parser, serializer, and data model.
- **PIX2 v1.0 Standard:** Stabilization Candidate & Formal Specification Freeze. EBNF, lexical grammar, drawing primitives semantics, and test vector baselines are fully decoupled, normative, and synchronized.
- **Acceptance Status:** 133/133 tests passing cleanly in continuous integration.
