# NOIRADIX v2.0 — Engineering Execution Checkpoint

**Started:** 2026-11-09 (Asia/Saigon)  
**Execution prompt:** `NOIRADIX Studio 2.0 · PixelArt 2.0 · PIX2 1.1 — Prompt giao việc cho Codex`  
**Policy:** preserve all pre-existing local changes; no reset/clean/force-push/publish/deploy/tag mutation.

This is the resumable source of truth for the ongoing audit. A green unit test is evidence, not automatic completion. Browser-only requirements remain `CHƯA KIỂM` or `BỊ CHẶN` until the real production entry point is exercised.

## 1. Phase 00 baseline

| Item | Observed baseline |
|---|---|
| Repository | `dotlinux26/noiradix-studio` |
| Branch | `main` |
| HEAD | `04ef9de75cbe3ead6152cd7aa24ec6b9bd982c8c` |
| `origin/main` | `04ef9de75cbe3ead6152cd7aa24ec6b9bd982c8c` (verified with `git ls-remote`) |
| `v2.0.0^{commit}` | `04ef9de75cbe3ead6152cd7aa24ec6b9bd982c8c` |
| Runtime used locally | Node `v24.21.0` |
| CI runtime | Node `20` in `.github/workflows/deploy.yml` |
| Tracked local diff at Phase 00 start | 15 files, `1211 insertions(+), 323 deletions(-)` |
| Untracked local file | `js/structure-operations.js` |
| Product entries | `index.html`, `pixelart/index.html` |
| Product controllers | `js/app.js` (416,370 bytes), `pixelart/js/pixelart-app.js` (256,084 bytes) |
| Browser evidence | `BỊ CHẶN`: Work setting disables local browser use; Windows Computer Use stopped because it could not determine the current Edge URL with sufficient policy confidence. No UI case is marked passed from this attempt. |

### Preserved local changes

```text
M  css/style.css
M  docs/FEATURES/SELECTION_AND_CONTEXT_MENUS.md
M  docs/KEYBOARD_SHORTCUTS.md
M  docs/SELECTION_AND_CONTEXT_MENU.md
M  index.html
M  js/app.js
M  js/editor-state.js
M  js/selection-transform.js
M  js/tools.js
M  pixelart/css/pixelart.css
M  pixelart/index.html
M  pixelart/js/pixelart-app.js
M  tests/test-audit-integrity.js
M  tests/test-editor-state-structural.js
M  tests/test-selection-transform.js
?? js/structure-operations.js
```

No commit was created during Phase 00. Checkpoints use `HEAD + working-tree diff` until the user requests a commit/review boundary.

## 2. Source traceability

### Discussions source map

| Source | Sections checked | Current use |
|---|---|---|
| Phase 0 Contract & Architecture Audit | §1–§3, normalized AST, EBNF, IDs, containment, overlap/order, alpha, visibility/lock, limits, upgrade/flatten, platformer, adapters, modular manifest | Normative structural contract. `Cell → Layer → Group/Region`; Regions own editable raster content. |
| Architecture and Product Spec | §0–§18, including acceptance criteria, phased roadmap, import, sessions, release and final instruction | Product scope and non-functional requirements. Statements marked “proposed” defer to the frozen Phase 0 contract. |
| Agentic Implementation Prompt | §0–§14 and complete Modular Sprite Pipeline track §1–§13 | Original phases, mandatory tests, performance gates, documentation and modular export scope. |

### Additional specifications checked

| File | Role / finding |
|---|---|
| `PIX2_SPECIFICATION.md` | Published combined v1.0/v1.1 language and product guidance; contains historical/nested syntax prose that must be checked against canonical EBNF. |
| `docs/FILE_LIFECYCLE_SPEC.md` | Open/save/Save As/dirty contract. Its “drop replaces active document” sentence is superseded by the newer multi-project prompt. |
| `docs/HISTORY_AUTOSAVE_RECOVERY_SPEC.md` | 64-state/session and dual autosave target; current PixelArt history default is 50 and needs explicit reconciliation. |
| `docs/PRODUCT_SPEC.md` | Product boundaries, zero dependency, offline-first, dual PIX2 core sync, session/import/export requirements. |
| `docs/UX_AND_INTERACTION_SPEC.md` | Workspace, structure panel, isolation, selection behavior, export modal. |
| `docs/SELECTION_AND_CONTEXT_MENU.md` | Floating-selection transaction, Enter/Escape, pointer cancel/blur and active structural target. |
| `docs/KEYBOARD_SHORTCUTS.md` | Tool/file/edit/animation shortcut matrix; conflicts around Arrow-key scope require product decision recorded below. |
| `docs/PIXELART/ARCHITECTURE_AND_REUSE_PLAN.md` | Historical reuse/performance design; claims must be verified against current production code. |
| `docs/PIXELART/VIEWPORT_FRUSTUM_CULLING_AND_RENDER_OPTIMIZATION.md` | Rendering/culling invariants and historical benchmark claims; current QA must remeasure rather than inherit claims. |
| `.github/workflows/deploy.yml` | Already includes `push.tags: ['v*']`; older docs claiming tag CI is absent are stale. Deploy remains restricted to `refs/heads/main`. |

### Document conflicts and decisions

| Conflict | Decision for this execution |
|---|---|
| Modular track says Layer contains pixels and Group contains Layer; Phase 0 says Layer contains Group/Region and Region owns content. | Phase 0 wins. Modular “component layer” language maps to exportable components from the actual PIX2 tree; grammar is not changed. |
| Proposed nested syntax / `z_index`, group opacity/collapsed appears in older prose but frozen EBNF uses explicit `cell`/`parent` and array order. | Frozen EBNF and normalized AST win. Unsupported properties must not be exposed as functional controls. |
| Old lifecycle spec says dropped PIX2 replaces active document; newer prompt requires new project tab. | New project tab behavior wins. |
| History spec says 64 states; PixelArt controller currently sets 50. | `CHƯA KIỂM`; do not silently change until memory/history policy is measured. |
| Shortcut matrix says Arrow keys nudge frame; selection spec says active selection gets one-pixel nudge. | Selection first; otherwise document/canvas behavior may apply only when focus is canvas and no text control is active. |
| Selection prose historically described Escape as commit in one place. | Latest contract wins: Escape restores lift-time pixels and cancels preview; Enter commits once. |
| Phase 0 audit baseline says `f0bc808` and clean; current repository is `04ef9de` with local changes. | Treat the old baseline as historical only. |
| Architecture document says tag trigger is missing. | Current workflow evidence wins; no redundant workflow edit. |

## 3. Current ownership map

| Concern | Authoritative production path | Current owner / boundary |
|---|---|---|
| Parse / validate / serialize | `js/pix2-format.js` (`parse` ~447, compositor ~1572, upgrade ~1634, flatten ~1675, serialize ~1726, validate ~2108) | PIX2 module. Mirrored file `pix2/js/pix2-format.js` must remain SHA-256 identical. |
| AST | `state.doc` / `EditorState.doc`; `cell.layers` for v1.1 | AST is authoritative. `cell.pixels` is flat v1.0 data or derived composite cache for v1.1. |
| Composite | `PIX2.compositeCellLayers` | Shared core function, but consumers still need audit for consistent use in thumbnails, animation and all exports. |
| Structural operations | `js/editor-state.js` plus new `js/structure-operations.js` | Partially shared. `findNode`, move/reorder, bounds and raster-ownership normalization are shared; create/delete/rename/duplicate are still split/incomplete. |
| Tool target | `js/tools.js:getTargetForPlot/getTargetsForTransform`; app adapters provide active IDs | Region must be the raster write owner. Target is frozen at transaction start for selections. Ancestral lock/visibility still needs complete audit. |
| Selection math | `js/selection-transform.js` | Shared scale/rotate/handle math. Controllers still duplicate gesture lifecycle and commit/cancel routing. |
| Studio preview/input | `js/app.js` (`getSelectionTarget` ~4800, commit ~4843, cancel ~4879) | Studio-specific DOM/controller lifecycle. |
| PixelArt preview/input | `pixelart/js/pixelart-app.js` (active target ~1365, buffer ~1389, commit ~3455, cancel ~3492, lift ~3724) | PixelArt-specific DOM/controller lifecycle. Rotation now uses an immutable session snapshot in local diff. |
| Studio history | `js/editor-state.js` snapshot/history APIs plus `js/app.js` transactions | Per project session, needs transaction-count audit for every action. |
| PixelArt history | `pixelart/js/pixelart-app.js:pushHistory/restoreHistorySnapshot` | Flat delta + structural snapshot hybrid. Needs session completeness and preview exclusion audit. |
| Studio session | `js/app.js` project sessions ~533 plus `EditorState.openCellTabs` | Project tabs and cell tabs are separate concepts, but selection/tool/recovery isolation needs verification. |
| PixelArt session | `PaProjectSession` ~489 and switch/create APIs | Local implementation exists; completeness for selection/isolation/recovery/tool context is not yet proven. |
| Source sync/autosave | Studio controller and PixelArt `syncCanvasToSource` ~2437 / autosave APIs | Still app-specific. PixelArt autosave currently requires SAFE-05 audit for preserving hidden structural payload. |

### Controller modularity finding

The two controllers total about 672 KiB and still own parallel pointer, keyboard, preview, history and structure-action paths. Shared math and tree operations exist, but CORE-03 is not complete: parity is presently maintained by tests and duplicated adapters rather than a single transaction/selection controller.

## 4. Phase 00 automated baseline

### Commands and results

| Gate | Command | Result |
|---|---|---|
| Syntax | `node --check` on 13 production JS files, including `js/structure-operations.js` | 13/13 pass, exit 0 |
| Roundtrip | `node tests/test-roundtrip.js` | 96/96 pass |
| Security | `node tests/test-security.js` | 21/21 pass |
| TextMate | `node tests/test-tmLanguage.js` | 6/6 pass |
| Normative vectors | `node tests/test-vectors-conformance.js` | 11/11 pass; dual PIX2 files SHA-256 identical |
| PIX2 v1.1 | `node tests/test-pix2-v11.js` | 9/9 pass |
| Structural editor | `node tests/test-editor-state-structural.js` | 12/12 pass |
| Modular export | `node tests/test-modular-export.js` | 4/4 pass |
| Import/slice | `node tests/test-import-slice.js` | 6/6 pass |
| Studio integration | `node tests/test-studio-v2.js` | 8/8 pass |
| Selection transform | `node tests/test-selection-transform.js` | 7/7 pass |
| PixelArt integration | `node tests/test-pixelart-v2.js` | 9/9 pass |
| Audit/regression | `node tests/test-audit-integrity.js` | 32/32 pass |
| Benchmark | `node tests/benchmark-performance.js` | exit 0 |

Total current automated checks reported by suites: **221**. This differs from stale workflow labels such as “207 Tests”.

### Benchmark snapshot (Node 24.21.0; not browser evidence)

| Case | Median | p95 |
|---|---:|---:|
| PIX2 1.0 parse, 16 cells / 8,192 pixels | 1.002 ms | 2.039 ms |
| PIX2 1.0 serialize | 0.619 ms | 1.003 ms |
| PIX2 1.1 composite, 5 layers / 40 regions | 0.049 ms | 0.115 ms |
| PIX2 1.1 hierarchy serialize | 0.172 ms | 0.259 ms |
| PIX2 1.1 structural parse | 0.025 ms | 0.140 ms |
| 512² resize crop/expand | 0.067 ms | 0.484 ms |
| 64² 45° rotate | 0.402 ms | 0.696 ms |
| 64² → 160² scale | 3.553 ms | 6.332 ms |

Process snapshot: RSS 86.74 MiB, heap used 20.50 MiB. The benchmark's blanket “all <16 ms” line is not sufficient for QA-01: browser input-to-paint, DPR, backing-store memory and large multi-session cases remain unmeasured.

## 5. Work-item status

| Phase | Code | Status | Evidence / limitation | Next |
|---|---|---|---|---|
| 00 | BASE | ĐẠT | Baseline, docs, ownership, conflicts, 12 suites, syntax and benchmark recorded. Browser settings blocker recorded separately. | SAFE-01 |
| 01 | SAFE-01 Convert | ĐÃ SỬA | Local UI path now uses `PIX2.upgradeV10ToV11(state.doc)` rather than creating an empty layer first. Existing test is insufficient: no multi-cell/alpha/clip/failed-conversion/save-reload fixture yet. | Build production fixture and transactional conversion test; run E01 when browser is available. |
| 01 | SAFE-02 Hide/show | ĐÃ SỬA | Local diff settles floating selection before structural mutations, normalizes legacy Layer payload to Region and adds behavioral hide/show test. Studio/PixelArt UI E02 and save-reload remain unverified. | Complete AST/pixel/alpha/opacity/undo/save-reload matrix. |
| 01 | SAFE-03 Escape/commit | ĐÃ SỬA | Escape baseline restoration and owner isolation tests pass. Blur/lost capture/tab/layer switch and exact history-count matrix are not complete. | Add production transaction tests. |
| 01 | SAFE-04 Rotation/Align | ĐÃ SỬA | PixelArt uses immutable rotation session and exact cardinal mapping. Studio parity, asymmetric-hole fixtures, align ownership and transform-order cases remain incomplete. | Add shared cumulative-rotation/align fixtures and parity harness. |
| 01 | SAFE-05 File safety | ĐANG ĐIỀU TRA | Historical save/watcher tests pass. Full AST autosave for hidden layers and two same-name files across sessions require audit. | Inspect recovery schema and run session fixtures. |
| 02 | PIX-01 Contract/parser | CHƯA KIỂM | Existing 1.1 tests pass but complete directive diagnostics/canonical-byte/resource-limit matrix must be traced. | After SAFE-05. |
| 02 | PIX-02 Migration | CHƯA KIỂM | Basic upgrade/flatten tests exist. Full metadata/loss/block/copy policy incomplete. | After PIX-01. |
| 03 | CORE-01 Target/compositor | TÍCH HỢP DỞ | Shared target/compositor exists; ancestral lock/visibility, RGBA source-over and all consumers need proof. | Sequential phase. |
| 03 | CORE-02 Transaction/history | TÍCH HỢP DỞ | Both apps have history, but no unified mutation pipeline. | Sequential phase. |
| 03 | CORE-03 Tách controller | TÍCH HỢP DỞ | Shared selection math/tree utilities only; controllers remain large and parallel. | Extract in small verified clusters. |
| 04 | EDIT-01 Selection/input | TÍCH HỢP DỞ | Partial implementations and tests exist. | Full matrix/UI evidence. |
| 04 | EDIT-02 Outliner | THIẾU | PixelArt tree lacks complete rename/duplicate/delete/nested DnD/context/keyboard operations. | Implement after core transaction boundary. |
| 04 | EDIT-03 Region Select/Isolation | TÍCH HỢP DỞ | Basic hit/isolation exists; multi-select and nested/topmost behavior incomplete. | Sequential phase. |
| 04 | EDIT-04 Tool parity | CHƯA KIỂM | No complete tool × app × owner matrix. | Sequential phase. |
| 05 | UX-01 Workspace | TÍCH HỢP DỞ | Local CSS/UI fixes exist; responsive and keyboard evidence missing. | E07 after structural safety. |
| 06 | ANIM-01 Platformer | TÍCH HỢP DỞ | Basic run/idle track support exists at HEAD. Full action/facing/save/export matrix incomplete. | Sequential phase. |
| 07 | IMPORT-01 | TÍCH HỢP DỞ | Production module tests pass six cases; UI/manual correction/multipage/transactional failure incomplete. | Sequential phase. |
| 08 | PROJ-01 New Project | TÍCH HỢP DỞ | UI exists; preset/profile/AST matrix incomplete. | Sequential phase. |
| 08 | PROJ-02 Multi-file/drop | TÍCH HỢP DỞ | Both controllers contain sessions; full state/handle/drop/close isolation incomplete. | Sequential phase. |
| 09 | EXP-01 Composite/Unity | CHƯA KIỂM | Export paths exist. | Sequential phase. |
| 09 | EXP-02 Modular package | TÍCH HỢP DỞ | Four module tests pass; group recursion, deterministic paths, UI and both-app parity incomplete. | Sequential phase. |
| 09 | EXP-03 Component animation | CHƯA KIỂM | Basic manifest tracks exist. | Sequential phase. |
| 09 | EXP-04 AI/adapter | MỐC SAU THEO SPEC | AI dependency/workflow not yet established; engine adapters remain separate/future where specified. | Record implementable preparation/confirmation path later. |
| 10 | QA-01 | CHƯA KIỂM | Node baseline captured only. | Full browser/perf regression after features. |
| 10 | REL-01 | CHƯA KIỂM | Existing tag points to current HEAD, but no release action authorized. | Documentation/readiness only; do not tag/publish/deploy. |

## 6. Browser case ledger

| Case | Studio | PixelArt | Status |
|---|---|---|---|
| E01 Convert | CHƯA KIỂM | N/A unless a conversion UI is exposed | Browser automation blocked |
| E02 Hide/show | CHƯA KIỂM | CHƯA KIỂM | Browser automation blocked |
| E03 Rotation | CHƯA KIỂM | CHƯA KIỂM | Browser automation blocked |
| E04 Escape/commit | CHƯA KIỂM | CHƯA KIỂM | Browser automation blocked |
| E05 Target/outliner | CHƯA KIỂM | CHƯA KIỂM | Browser automation blocked |
| E06 Multi-file safety | CHƯA KIỂM | CHƯA KIỂM | Browser automation blocked |
| E07 Workspace/focus | CHƯA KIỂM | CHƯA KIỂM | Browser automation blocked |
| E08 Platform/import/export | CHƯA KIỂM | CHƯA KIỂM | Browser automation blocked |

## 7. Commit protocol (owner override)

The repository owner explicitly authorized committing and pushing each stage
directly to `origin/main` (`git@github.com:dotlinux26/noiradix-studio.git`,
SSH configured). The earlier "no remote writes" rule is superseded for this
execution. Force-push, reset, tag mutation, release and destructive cleanup
remain out of scope unless separately requested.

## 8. Stage log

| Stage | Scope | Result |
|---|---|---|
| C1 | Transactional v1.0→v1.1 conversion (`SAFE-01`), structural visibility/legacy-payload normalization (`SAFE-02`), non-compounding rotation, full-document autosave + recovery for hidden-only artwork, escape/commit transaction cleanup, new regression suites `test-safe-conversion`, `test-safe-visibility`, `test-safe-recovery` | All 16 suites + benchmark exit 0 |
| C2 | Shared project tab strip (`js/tab-strip.js`): narrower width, smart horizontal drag-scroll, drag-and-drop tab reordering, pinned new-tab action, roving-tabindex keyboard nav + Alt+Arrow reorder; wired into Studio and PixelArt adapters; `tests/test-tab-strip.js` ordering/wiring contract | `test-tab-strip` 10/10; all suites exit 0; gesture UI remains a browser case |
| C3 | Layout fix: PixelArt body → flex column; pa-header/docbar/workspace/palette-deck proper flex values; new-tab button in HTML (not JS); Studio docbar already correct; both apps render cleanly at 1600×900 | `pa-shot2.png`, `studio-shot2.png` captured; all 17 suites + benchmark exit 0 |

Browser gesture cases (B12) are still `BỊ CHẶN` until a real browser session is
available; the ordering math and static wiring are covered by production tests.

## 9. Resume pointer

**First not-passed work item:** `SAFE-05 File safety` (per-session autosave
identity, same-basename file disambiguation) followed by `PIX-01`.

Required next cycle:

1. Create a deterministic v1.0 fixture with RGBA alpha, multiple cells, palette, grid metadata and animation clip references.
2. Invoke the production `upgradeV10ToV11` and the actual Studio conversion transaction.
3. Compare pre/post composite per cell and metadata byte/semantic identity where applicable.
4. Add failure-injection coverage proving the original document and dirty/history state are unchanged.
5. Add undo/redo and serialize/parse reload coverage.
6. Update this checkpoint before moving to SAFE-02.
