# RC2 audit and beta gate

> Historical checkpoint. For the later RC2 refactor, corrections, completed regression gaps and current verification, see [EDITOR_REFACTOR_PROGRESS.md](EDITOR_REFACTOR_PROGRESS.md). Original results below retain their original scope.

Baseline: main `6feb59e`, agent handbook `89c3dae`. Review branch: `rc2`. Product: **2.1.2-beta.1**; format: **PIX2 1.1**, retaining 1.0 reads.

## Changes reviewed since 2.1.0

The other agent added expanded shared AI prompts, the Reaper demo chooser, 2.1.1 metadata, comma dimensions and palette comments, PixelArt ingestion fitting, restored browser CI, and fractional export-preview Fit/pan. These are existing changes, not evidence that all historical requirements are closed.

## Findings and implementation

| ID | App | Repro / expected behavior | Implementation and evidence |
|---|---|---|---|
| RC2-001 | Shared parser | Quoted titles/names containing semicolons, apostrophes, escaped quotes, literal backslashes and hashes must round-trip. | Quote-aware comments and one-pass unescape. `test-rc2-hardening.js` passes. |
| RC2-002 | Shared parser | PixelArt limits must apply during parsing; oversized UTF-8, node sets and repeated primitives must be bounded. | Profile-specific limits, byte counting, structural/cell caps and raster-work budget. Hardening suite passes. |
| RC2-003 | Studio | Demo must open independently, preserve the previous project and support first Undo. | Demo uses normal session creation. `test-workspace.cjs` passes both demo cases. Native opening also uses normal sessions and handle identity. |
| RC2-004 | Both | Start save A, switch B, complete A; edit while saving; Save As while switching; failed write. | Shared ordered file-write adapter; immutable origin snapshot and handle; origin-session publication; failed stream abort; revision and content dirty checks. `test-file-lifecycle.cjs` passes both apps. |
| RC2-005 | Both | Invalid newer local catalog must not hide a valid IndexedDB fallback. | Validate catalog shape before timestamp arbitration. Workspace browser regression injects corruption before startup. Passes both apps. Original suspected valid-catalog timestamp race was not reproduced. |
| RC2-006 | PixelArt | Saving a standalone document must preserve grid metadata. | Removed save-time grid mutation using wrong `columns` property; resize uses `cols`. Source application reads effective cell size. Native lifecycle suite passes. |
| RC2-007 | Shared raster | A filled 1024-square rectangle must render; off-canvas huge outline must not become a smaller outline. | Clip original geometry to cell boundaries; bound work and allocation. Hardening suite checks exact pixel counts. |
| RC2-008 | Import/export | Extreme dimensions must be rejected before allocating pixel buffers. | Shared safe-integer, per-axis and total-area checks wired into public raster/import/export entry points. Hardening suite passes. |
| RC2-009 | Studio export UI | Fit must use visible modal dimensions; zoom should reuse preview raster; oversized output must disable export. | Preview opens before measuring; zoom reuses raster; invalid allocation clears preview and disables execution. Code reviewed; dedicated browser regression remains open. |
| RC2-010 | Both watchers | A delayed read for A must not publish into B or overwrite an edit made during the read. | Capture handle, session and revision; recheck after asynchronous reads and before publication. Code reviewed; delayed-read browser scenario remains open. |

## Verification on 2026-11-11

- All **19** `tests/test-*.js` Node suites pass, including AI prompts, security, format vectors, legacy compatibility, structural semantics and hardening.
- `tests/browser/test-workspace.cjs`: passes Studio and PixelArt normal entry points, persistence, corruption fallback, tab lifecycle, imports, legacy conversion, demo Undo and 4x4 grid of 512-square frames at DPR 2.
- `tests/browser/test-file-lifecycle.cjs`: passes both normal entry points with simulated native file handles and delayed/failing writes. This does not exercise an operating-system picker.
- Performance benchmark passes its existing gates. The scale benchmark had p95 62.9ms during concurrent browser testing; its blanket success text should not be read as every sample taking less than 16ms.
- Exact parser mirror equality and whitespace/syntax checks are required before commit.

## Remaining review coverage

This is a beta, not a claim of zero defects or exhaustive DoS protection. Dedicated export-preview and delayed watcher UI regressions, native picker cancellation/permission revocation, cross-browser coverage, long-running large projects and a full pass over the historical screenshot/request ledger remain open. Existing historical discussion reports are evidence, not current pass certificates. No stable release or merge to main is authorized by this beta push.

The user-owned untracked sample `samples/Arch-Lich Grim Reaper 48x48 After Human Touching.pix2` is excluded. Agent handbook changes alone were separately authorized and pushed to main.
