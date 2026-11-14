# Verification

Run commands from the repository root. Static runtime code requires no package installation.

## Node

```powershell
node scripts/build-changelog-page.cjs --check
node tests/run-all.cjs --syntax
node tests/run-all.cjs
node tests/benchmark-performance.js
git diff --check
```

The compiler conformance test compares the root and standalone compiler byte for byte. Use the current suite inventory instead of a historical test count. Benchmark numbers describe their fixture, runtime and hardware.

## Browser

Run a local server in a separate terminal.

```powershell
py -m http.server 8769 --bind 127.0.0.1
```

Install QA tooling in a temporary directory.

```powershell
$qaDirectory = Join-Path $env:TEMP 'noiradix-editor-qa'
npm.cmd install --prefix $qaDirectory playwright@1.65.0 --no-audit --no-fund
$env:NODE_PATH = Join-Path $qaDirectory 'node_modules'
node tests/run-all.cjs --browser
```

For rendering changes, also run the dense fixture.

```powershell
$env:EDITOR_QA_DENSE = '1'
$env:EDITOR_QA_DPR = '2'
node tests/browser/test-editor.cjs
```

The runners default to installed Chrome. CI installs Playwright Chromium and sets `EDITOR_QA_CHANNEL=chromium`.

## Coverage by risk

| Change | Cases to exercise |
|---|---|
| Parser and language | Valid and malformed input, quoted text/comments, RGBA, mixed sibling order, parent references, cycles, profile limits, prototype keys, huge coordinates, parse/serialize/parse and compiler parity |
| Editing | Locked/hidden ancestors, overlapping Regions, isolation, Escape, all affected transform handles, canvas boundaries, switching tool/frame/file, Undo/Redo and exported pixels |
| File and persistence | Multiple documents, native and fallback routes, cancellation/permission failures, late asynchronous completion, save races, failed storage, reload and intentionally empty workspace |
| Export and import | Pixel dimensions and alpha, full composite during isolation, metadata and animation references, trimming, atlas errors, download/parse and reimport |
| UI and performance | Both apps, narrow layouts, pointer and keyboard access, small/large art, fractional zoom, DPR, buffer allocations and frame-time limitations |

Exercise the affected normal entry point. A unit test of a copied algorithm does not prove production wiring. Browser mocks must retain the real file lifecycle and storage code. Clearly distinguish simulated permission failures from a manual OS picker check.

For diagnostic size/performance measurements, run `node tests/browser/benchmark-editors.cjs`. Record the actual fixture dimensions and the meaning of each metric. Browser suites can also be run separately. Set `EDITOR_QA_URL` to use a server other than the default `http://127.0.0.1:8769`. Keep server logs redirected for repeated local runs.
