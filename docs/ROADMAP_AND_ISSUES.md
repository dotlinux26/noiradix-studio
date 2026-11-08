# NOIRADIX Studio — Issues, Decisions, Roadmap & Open Source Strategy

**Document Version:** 1.0.0  
**Project:** NOIRADIX Studio  
**Reference Document:** `docs/ROADMAP_AND_ISSUES.md`  

---

## 1. Issue & Bug Tracking Matrix

| ID | Priority | Module | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | **P0** | Parser | Lexer truncated `#` in hex colors when followed by comments (`1: #ffffff # White`). | **RESOLVED & VERIFIED** (Passes roundtrip tests) |
| **BUG-02** | **P0** | Engine | `normalizeHex` stripped alpha channel from `#RRGGBBAA`. | **RESOLVED & VERIFIED** (Full RGBA 0-255 preserved) |
| **BUG-03** | **P0** | Engine | PNG slicing assumed 0 gap, corrupting 16x16 cells in `Player.png` (67x67 with 1px gap). | **RESOLVED & VERIFIED** (Configurable gap & alpha) |
| **BUG-04** | **P1** | UI | Circular buttons (`.icon-round-btn`) stretched into ovals due to flexbox font line-height. | **RESOLVED & VERIFIED** (`aspect-ratio: 1/1 !important`) |
| **BUG-05** | **P1** | UI | Secondary tab bar and status bar had hardcoded black backgrounds in light mode. | **RESOLVED & VERIFIED** (Bound to theme variables) |
| **BUG-06** | **P1** | UI | Grid Overview canvas column titles collided and overlapped horizontally. | **RESOLVED & VERIFIED** (Centered badges, 24px cell gap) |
| **BUG-07** | **P1** | Engine | Cell IDs rigidly hardcoded to `cell_r_c` preventing custom naming like `ghost_idle`. | **RESOLVED & VERIFIED** (Decoupled identity from grid pos) |
| **BUG-08** | **P1** | Studio | Animation player locked to 4 directional walk rows only. | **RESOLVED & VERIFIED** (Supports arbitrary custom clips) |
| **FEAT-01**| **P1** | Studio | Dedicated Animation Studio Tab with visual timeline strip & Onion Skin. | **IMPLEMENTED** (`#view-anim-studio`) |
| **FEAT-02**| **P1** | Engine | Anchor-centered zoom on mouse hover pixel / selection. | **IMPLEMENTED & VERIFIED** (Invariance math) |
| **FEAT-03**| **P1** | File | Desktop-like File Management (File System Access API `Ctrl+S`, `Ctrl+O`). | **IMPLEMENTED & VERIFIED** (Native + Fallback) |
| **FEAT-04**| **P1** | State | Dual Autosave (30s time + 1.5s event) with crash recovery snapshot. | **IMPLEMENTED & VERIFIED** (IndexedDB / LocalStorage) |

---

## 2. Open Source & Community Strategy

### Licensing Separation
- **NOIRADIX Studio (Editor Application):** **Apache 2.0 License** (permits indie & commercial game development without friction).
- **PIX2 Language Specification:** **CC BY 4.0** (Open standard for any tool, AI agent, or engine to implement).
- **Core Engine & Parsers:** **Apache 2.0 License** (encourages SDK integration in Python, Rust, Godot, Unity).
- **Wisplings Art Assets:** Proprietary / Custom game license.

### Funding & Community Support (Donations)
Rather than locking core pixel tools behind paywalls, PIX2 adopts a transparent donation model:
1. **GitHub Sponsors (Priority 1):** Official repository sponsor tiers (\$2 Supporter, \$5 Pixel Backer, \$10 Studio Sponsor, \$25 Game Dev Patron).
2. **Ko-fi (Priority 2):** Quick tip jar with 0% platform fee on one-off donations.
3. **Open Collective:** For long-term transparent community funds once multiple maintainers join.

### Distribution Channels
1. **GitHub Repository:** Public source code, README with live GIFs, formal specifications, and issue tracking.
2. **itch.io:** Free portable download (standalone HTML/JS bundle) targeting indie game developers.
3. **Web Hosted Edition:** Zero-install instant editor accessible at official domain or GitHub Pages.
4. **Community Outreach:** Showcasing structured pixel editing vs raster diffusion on Reddit (`r/PixelArt`, `r/gamedev`, `r/IndieDev`).

---

## 3. Product Development Phases

```
Phase 1: Format Core & Test Suite (COMPLETED)
  - PIX2 Specification v1.0 & EBNF Grammar
  - Parser & Serializer with roundtrip determinism
  - RGBA alpha preservation & comment lexer disambiguation
  - 23/23 unit tests passing

Phase 2: UI Overhaul & Workspace Structure (COMPLETED)
  - Dual theme (Light default / Dark supported) with high contrast
  - Dedicated Animation Studio tab with frame timeline
  - Draggable & minimizable floating preview panel
  - Symmetrical gutters & ruler integration
  - Column header text collision resolved

Phase 3: Desktop File Lifecycle & Anchor Zoom (COMPLETED)
  - Native File System Access API (real Ctrl+S save)
  - Anchor-centered zoom on hovered pixel
  - Dual autosave & crash recovery snapshot in LocalStorage/IndexedDB
  - Full document-wide Undo/Redo

Phase 4: AI Agent Interface & Security Hardening (COMPLETED)
  - Formal AI prompt templates & CLI parser
  - Real-time external hot-reload & smart conflict resolution (Live Human-AI pairing)
  - Contextual AI prompt generator (4 specialized prompt modes)
  - Complete client-side security hardening (Zero XSS, Prototype Pollution & DoS defenses)
  - 134/134 Automated tests passing across 4 suites

Phase 5: Total Feature Freeze & Specification Finalization (COMPLETED / CLOSED)
  - Canonical snake_case AST enforcement (cell_size)
  - Dual licensing (CC BY 4.0 for Specification, Apache-2.0 for Reference Engine)
  - Normative test vectors for third-party compiler implementers (11 test vectors)
  - Unified canonical specification (pix2/SPECIFICATION.md & EBNF determinism)
  - Structured Diagnostic API contract ({ code, severity, message, cell_id, coordinate })
  - VS Code language tooling with TextMate grammar
  - Continuous Integration via GitHub Actions running all 4 test suites (134/134 passing)
```

---

## Completed Feature Milestones

| Feature ID | Category | Description | Status |
|---|---|---|---|
| **FEAT-08** | **Live Sync** | **Real-Time External Hot-Reload & Smart Conflict Resolution:** Automatic three-tier change detection (`window.onfocus`, `visibilitychange`, 1500ms heartbeat) with non-destructive conflict alerts protecting in-progress drawings. | **SHIPPED** |
| **FEAT-09** | **AI Engine** | **Contextual AI Prompt Studio & Multi-Mode LLM Generator:** 4 specialized prompt templates (Full Character, Walk Animation, Accessory Overlay, Surgical Patch) with embedded palette and metadata. | **SHIPPED** |
| **SEC-04** | **Security** | **Client-Side Security Hardening:** Eliminated all hardcoded machine paths, prototype pollution guardrails, coordinate/dimension caps, and path traversal defenses in exporters. | **SHIPPED** |
| **UI-07** | **Statusbar** | **Separated Statusbar Spacing & Symmetry Divider:** Consistent 14px dividers and dynamic flex spacing ensuring no visual collisions across all viewports. | **SHIPPED** |
| **FEAT-10**| **Ecosystem** | **NOIRADIX PixelArt Sibling Application (`/pixelart/`):** Standalone pure 2D pixel art editor featuring live bi-directional PIX2 source synchronization, canvas sizing up to $1024 \times 1024$, 1:1 pixel-aligned canvas checkerboard, user-configurable canvas background modes (Transparent Checkerboard, Solid White, Solid Black, and Custom Hex Color with adaptive YIQ grid contrast and PNG export inclusion), analytical invariant cursor zoom, draggable split-pane resizer, full shape suite (Pencil, Eraser, Fill, Bresenham Line, Rect & Circle Outline/Fill with Shift 1:1 & Alt Center), interactive drag-to-move selection marquee, geometric transformations (Flip H/V, Rotate 90°, Multi-axis Alignment Left/Right/Top/Bottom/Center), and universal responsive drag-scroll architecture (Twin Drag-Scroll Pattern). Documented in `docs/PIXELART/`. | **SHIPPED v1.3.0** |
