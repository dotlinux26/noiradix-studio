# Verification

Run commands from the repository root. Static runtime code requires no package installation.

## Node

```powershell
foreach ($file in Get-ChildItem tests/test-*.js) {
    node $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "Failed $($file.Name)" }
}
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
node tests/browser/test-editor.cjs
node tests/browser/test-workspace.cjs
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
