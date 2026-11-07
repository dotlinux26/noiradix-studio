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

## 2. Active User Feedback & Immediate Actions (P0 / P1)

### Issue A: Smashed / Overlapping Grid Column Headers ("vỡ đồ họa nè dính nè")
- **Cause:** `Col 0 (Frame 0)` text in canvas header was wider (~85px) than column slot width ($16 \times 3 + 16 = 64\text{px}$), causing adjacent column titles to collide and overlap.
- **Action:**
  1. Change column headers to compact, clean badges: `C0 (F0)`, `C1 (F1)` or simple `Col 0`, `Col 1` with auto-adjusting font size.
  2. Increase column gap and padding in Grid Overview so text never collides.
  3. Allow inline editing and renaming of Row and Column labels!

### Issue B: Custom Animation Management & Unlocking 4-Dir Restriction
- **Feedback:** "phần mềm này không khóa chết animation v đâu phải có panel để ng dùng tự thêm soát sửa cột hàng , tự thêm tự đặt tên cho animation và cái animation preview cũng phải hỗ trợ việc xem các animation tự thêm đấy ngoài các animaiton cơ bản ra"
- **Action:**
  1. Unbind animations from hardcoded rows.
  2. Add dedicated **Animation Manager Panel** in Grid Inspector and dedicated **Animation Studio Workspace**:
     - `+ New Animation` (name, direction tag, fps, loop mode).
     - Delete animation, rename animation.
     - Add/remove cells from animation sequence with click and reorder.
  3. In Floating Animation Studio & Animation Workspace:
     - Animation selector dropdown displays ALL animations in the project (`walk_down`, `attack`, `jump`, `death`, `idle`, etc.).
     - Playing/previewing any selected custom animation with live FPS and frame counter.

### Issue C: Dedicated Animation Workspace / Screen ("chế độ màn hình xem chuyên biệt")
- **Feedback:** "cần có chế độ màn hình xem chuyên biệt"
- **Action:**
  - Add a dedicated top-level tab: **[🎬 Animation Studio]** alongside [Grid Overview], [Cell Editor], and [PIX2 Code & AI].
  - Dedicated full-screen timeline workspace with:
    - Large centered animation canvas (zoomable 2x to 16x).
    - Horizontal frame timeline strip with thumbnails: `[Frame 0] [Frame 1] [Frame 2] ... [+]`.
    - Frame controls: duplicate, delete, move left/right, frame duration.
    - Animation clip library with quick switching.
    - Onion Skinning toggle with forward/backward frame ghosting.

### Issue D: Full Keyboard Shortcuts Suite
- **Required Shortcuts:**
  - `Alt + Wheel` / `Wheel`: Zoom in/out centered on mouse position.
  - `Space + Drag`: Pan workspace canvas.
  - `V`: Selection tool.
  - `B`: Pencil.
  - `E`: Eraser.
  - `G`: Paint Bucket.
  - `I`: Eyedropper.
  - `L`: Line tool.
  - `U`: Rectangle tool.
  - `S`: Symmetry Mirror toggle.
  - `X`: Swap primary & secondary colors.
  - `D`: Reset default colors.
  - `Ctrl + 0`: Reset zoom & pan.
  - `Ctrl + Z`: Undo.
  - `Ctrl + Y`: Redo.

### Issue E: Grid Row & Column Management
- **Action:**
  - Add buttons: `[+ Add Row]`, `[- Remove Row]`, `[+ Add Col]`, `[- Remove Col]`.
  - Allow renaming rows (e.g., Row 0: "Down", Row 1: "Up", or Row 0: "Idle", Row 1: "Attack").
  - Allow assigning any cell on the grid to any animation state.

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
- [x] TextMate grammar pattern behavior suite in `tests/test-tmLanguage.js` (6/6 checks PASSED)
- [x] Normative test vector conformance suite in `tests/test-vectors-conformance.js` (9/9 tests PASSED against immutable baseline)
- [x] Real-time external file watcher & live hot-reload engine with smart conflict resolution
- [x] AI Prompt Studio with 4 specialized prompt templates (Full Character, Walk Animation, Accessory Overlay, Surgical Patch)
- [x] Eliminated all hardcoded machine paths and hardened export templates
- [x] Standalone distribution in `pix2/` with dual licensing (Apache-2.0 / CC BY 4.0)
- [x] VS Code Extension distribution in `tools/vscode-pix2/` with TextMate grammar
- [x] GitHub Actions automated CI/CD deploying 100% green to `https://noiradix.me/`

---

## 4. Current Milestone: Phase 5 Soft Feature Freeze & Stabilization

- **NOIRADIX Studio Application:** Soft Feature Freeze. No new UI features or breaking architecture changes. Focus exclusively on performance, precision, and regression prevention.
- **PIX2 v1.0 Standard:** Stabilization Candidate & Formal Specification Freeze. EBNF, lexical grammar, and test vector baselines are fully decoupled, normative, and synchronized.
- **Acceptance Status:** 131/131 tests passing cleanly in continuous integration.
