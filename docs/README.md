# NOIRADIX Studio & PIX2 Canonical Documentation

**NOIRADIX Studio** is a 100% browser-native, offline-first sprite editor and directional animation studio engineered specifically around **PIX2** (`.pix2`), the open structured sprite format designed for humans and AI systems.

---

## Documentation Index & Sitemap

### 1. Product & UX Specifications
- [PRODUCT_SPEC.md](PRODUCT_SPEC.md) — Master product requirements, constraints, runtime boundaries, and core design principles.
- [UX_AND_INTERACTION_SPEC.md](UX_AND_INTERACTION_SPEC.md) — Unified UX patterns, tab orchestration, floating previews, dialogs, and toast notifications.
- [KEYBOARD_SHORTCUTS.md](KEYBOARD_SHORTCUTS.md) — Complete keyboard shortcut matrix across all views and platforms (Windows / macOS / Linux).
- [FILE_LIFECYCLE_SPEC.md](FILE_LIFECYCLE_SPEC.md) — Document loading, export, drag-and-drop, autosave, and recovery mechanisms.
- [HISTORY_AUTOSAVE_RECOVERY_SPEC.md](HISTORY_AUTOSAVE_RECOVERY_SPEC.md) — Undo/Redo architecture, snapshot compression, localStorage session caching, and dirty tracking.

### 2. PIX2 Format Specifications (`docs/PIX2/`)
- [PIX2/PIX2_SPEC.md](PIX2/PIX2_SPEC.md) — Formal specification of the `.pix2` format, blocks (`@meta`, `@grid`, `@palette`, `@cell`, `@animation`), and semantics.
- [PIX2/PIX2_GRAMMAR.md](PIX2/PIX2_GRAMMAR.md) — Formal EBNF grammar, lexer rules, comment handling, and token definitions.
- [PIX2/PIX2_DATA_MODEL.md](PIX2/PIX2_DATA_MODEL.md) — In-memory JavaScript data models, decoupling of cell identifiers from grid rows/cols, and schemas.
- [PIX2/PIX2_COMPATIBILITY.md](PIX2/PIX2_COMPATIBILITY.md) — Backwards compatibility, version transitions, and external tool interoperability.
- [PIX2/PIX2_AI_AUTHORING_GUIDE.md](PIX2/PIX2_AI_AUTHORING_GUIDE.md) — Master prompt engineering, one-shot templates, and rules for LLM generation.
- [PIX2/PIX2_VALIDATION_RULES.md](PIX2/PIX2_VALIDATION_RULES.md) — Validation criteria, coordinate bounds, color normalization, and diagnostic error codes.
- [PIX2/PIX2_EXAMPLES.md](PIX2/PIX2_EXAMPLES.md) — Canonical, machine-verifiable `.pix2` document examples (Static item, 4-dir walk, 8-dir combat).

### 3. Feature Technical Deep Dives (`docs/FEATURES/`)
- [FEATURES/GRID_AND_CELL_MODEL.md](FEATURES/GRID_AND_CELL_MODEL.md) — Multi-tier grid lookup (`getCellAtGrid`), row operations, row duplication, and row-only flip.
- [FEATURES/ANIMATION_MODEL.md](FEATURES/ANIMATION_MODEL.md) — Directional animation clips, playback engine, frame reordering, FPS timing, and onion skinning.
- [FEATURES/PALETTE_AND_AUTO_GENERATION.md](FEATURES/PALETTE_AND_AUTO_GENERATION.md) — Palette management, automatic palette extraction from artwork (exact & reduced), and atomic color remapping.
- [FEATURES/SELECTION_AND_CONTEXT_MENUS.md](FEATURES/SELECTION_AND_CONTEXT_MENUS.md) — Marquee selection, floating selections, context menus, and frame vs row operations.
- [FEATURES/ZOOM_RULERS_COORDINATES.md](FEATURES/ZOOM_RULERS_COORDINATES.md) — Viewport transformation, pixel grid rendering, dynamic rulers, and status bar coordinate tracking.
- [FEATURES/LAYERS_PIVOT_HITBOX_FUTURE.md](FEATURES/LAYERS_PIVOT_HITBOX_FUTURE.md) — Forward-looking design for layers, pivot offsets, and collision hitboxes.

### 4. Engineering & Auditing (`docs/ENGINEERING/` & `docs/audits/`)
- [ENGINEERING/ARCHITECTURE.md](ENGINEERING/ARCHITECTURE.md) — System architecture, module boundaries, data flow, and dependency policies.
- [ENGINEERING/TEST_PLAN.md](ENGINEERING/TEST_PLAN.md) — Automated testing matrix: semantic roundtrip, security/DoS defense, and UI regression suites.
- [ENGINEERING/IMPLEMENTATION_ROADMAP.md](ENGINEERING/IMPLEMENTATION_ROADMAP.md) — Milestone roadmap, completed upgrades, and planned features.
- [ENGINEERING/KNOWN_LIMITATIONS.md](ENGINEERING/KNOWN_LIMITATIONS.md) — Documented constraints, browser boundary requirements, and architectural trade-offs.
- [audits/BASELINE_AUDIT.md](audits/BASELINE_AUDIT.md) — Baseline audit of the codebase, feature verification matrix, and test coverage report.
- [audits/IMPLEMENTATION_REPORT.md](audits/IMPLEMENTATION_REPORT.md) — Detailed implementation report of the master upgrade.
