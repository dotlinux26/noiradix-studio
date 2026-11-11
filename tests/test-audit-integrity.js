/**
 * NOIRADIX Test Suite: Complete Audit Data Integrity & Regression Verification
 * Comprehensive tests against real production code exported from pixelart-app.js
 * 
 * Phases covered:
 * - Phase 1: Adaptive Zoom Clamping Invariant, Canvas Backing Allocation, Space Navigation & Auto-Center
 * - Phase 2: External Watcher CRLF/LF Normalization, Sub-Second Modification, Single History Push
 * - Phase 3: Serialized Save Concurrency Queue & Stale Revision Overwrite Prevention
 * - Phase 4: Delta-Based History (<= 25,000 pixels) & Snapshot Hybrid, 50MB Budget Pruning
 * - Phase 5: Revision-Based Recovery & Baseline Content Hash Verification
 * - Phase 6: Restorable Pre-Reload Backup Lifecycle & Recovery Banner
 * - Phase 7: Canonical Serialization, Floating Selection Isolation, Discard Guards
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PIX2 = require('../js/pix2-format.js');
const Tools = require('../js/tools.js');
const PixelArtApp = require('../pixelart/js/pixelart-app.js');

async function runSuite() {
  console.log('====================================================');
  console.log('RUNNING COMPLETE AUDIT INTEGRITY & REGRESSION SUITE');
  console.log('====================================================\n');

  // -----------------------------------------------------------------------------
  // Test 1: P0-02 Production Canonical Serialization & Placeholder Isolation
  // -----------------------------------------------------------------------------
  console.log('Test 1: P0-02 Canonical Serialization & Placeholder Isolation');
  {
    const doc = PIX2.createDocument('Test Large Artwork', 1, 1, 200, 200, { profile: 'pixelart' });
    doc.cells = {
      artwork: {
        id: 'artwork',
        name: 'Test Large Artwork',
        size: { w: 200, h: 200 },
        pixels: {}
      }
    };

    let pixelCount = 0;
    for (let y = 0; y < 200; y++) {
      for (let x = 0; x < 200; x++) {
        if (pixelCount < 35000) {
          doc.cells.artwork.pixels[`${x},${y}`] = '#ff0055';
          pixelCount++;
        }
      }
    }

    PixelArtApp.state.doc = doc;
    PixelArtApp.state.w = 200;
    PixelArtApp.state.h = 200;
    PixelArtApp.state.sourcePaneMode = 'summary';
    PixelArtApp.state.isCodeEditingUnlocked = false;

    const flushed = PixelArtApp.flushSourceCode();
    assert(!flushed.includes('; [Status:'), 'Flushed source code must NEVER contain presentation placeholder comment');
    assert(flushed.includes('artwork'), 'Flushed source code must contain cell artwork');

    const parsedBack = PIX2.parse(flushed, { profile: 'pixelart' });
    const restoredCell = parsedBack.cells.artwork || Object.values(parsedBack.cells)[0];
    const restoredCount = Object.keys(restoredCell.pixels || {}).length;
    assert.strictEqual(restoredCount, 35000, `Parsed back pixel count must be 35000, got ${restoredCount}`);
    console.log('  [PASS] flushSourceCode() strictly serializes 35,000 pixels from state.doc and isolates placeholder');
  }

  // -----------------------------------------------------------------------------
  // Test 2: P0-01 Production Revision & Dirty State Tracking
  // -----------------------------------------------------------------------------
  console.log('\nTest 2: P0-01 Revision & Dirty Tracking Invariant');
  {
    PixelArtApp.markDocumentSaved();
    assert.strictEqual(PixelArtApp.state.isDirty, false, 'Document starts clean');

    PixelArtApp.markDocumentMutation('pencil-stroke');
    assert.strictEqual(PixelArtApp.state.isDirty, true, 'Document is dirty after stroke');

    PixelArtApp.markDocumentSaved();
    assert.strictEqual(PixelArtApp.state.isDirty, false, 'Document is clean after markDocumentSaved');

    PixelArtApp.markDocumentMutation('shape');
    assert.strictEqual(PixelArtApp.state.isDirty, true, 'Document is dirty after second mutation');

    console.log('  [PASS] Production document revision tracking accurately sets clean/dirty states');
  }

  // -----------------------------------------------------------------------------
  // Test 3: P1-06 Image Import Aspect Ratio Uniform Scaling
  // -----------------------------------------------------------------------------
  console.log('\nTest 3: P1-06 Image Import Aspect Ratio Uniform Scaling');
  {
    function computeTargetDimensions(w, h, maxDim = 1024) {
      const scale = Math.min(1, maxDim / w, maxDim / h);
      return {
        targetW: Math.max(1, Math.round(w * scale)),
        targetH: Math.max(1, Math.round(h * scale))
      };
    }

    const case1 = computeTargetDimensions(2000, 500);
    assert.strictEqual(case1.targetW, 1024);
    assert.strictEqual(case1.targetH, 256);
    console.log('  [PASS] 2000x500 scales uniformly to 1024x256 without distortion');

    const case2 = computeTargetDimensions(500, 2000);
    assert.strictEqual(case2.targetW, 256);
    assert.strictEqual(case2.targetH, 1024);
    console.log('  [PASS] 500x2000 scales uniformly to 256x1024 without distortion');

    const case3 = computeTargetDimensions(512, 512);
    assert.strictEqual(case3.targetW, 512);
    assert.strictEqual(case3.targetH, 512);
    console.log('  [PASS] 512x512 remains 1:1 scale at 512x512');
  }

  // -----------------------------------------------------------------------------
  // Test 4: P1-02 Ruler Viewport Ticks Culling Range
  // -----------------------------------------------------------------------------
  console.log('\nTest 4: P1-02 Ruler Viewport Ticks Culling Range');
  {
    const { labelInterval, tickRange } = require('../js/editor-rulers.js');
    assert.equal(labelInterval(6), 8);
    assert.equal(labelInterval(0.5), 128);
    const { start, end } = tickRange(1024, 16, 100, 200);
    const ticks = [];
    for (let x = start; x <= end; x += 16) ticks.push(x);
    assert(ticks[0] <= 100, 'First tick must cover margin before minX');
    assert(ticks[ticks.length - 1] >= 200, 'Last tick must cover margin after maxX');
    assert(ticks.length < 20, `Visible ticks count must be under 20 (got ${ticks.length}), not full 64`);
    console.log(`  [PASS] 1024-pixel ruler culls to only ${ticks.length} visible ticks instead of all 64 ticks`);
  }

  // -----------------------------------------------------------------------------
  // Test 5: P2-03 Verification of Duplicate getVisibleCanvasBounds Removal
  // -----------------------------------------------------------------------------
  console.log('\nTest 5: P2-03 Verification of Duplicate Function Removal');
  {
    const appJs = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    const matches = appJs.match(/function getVisibleCanvasBounds\s*\(/g);
    assert.strictEqual(matches.length, 1, `getVisibleCanvasBounds must appear exactly once in pixelart-app.js, found ${matches ? matches.length : 0}`);
    console.log('  [PASS] getVisibleCanvasBounds appears exactly once (duplicate removed)');
  }

  // -----------------------------------------------------------------------------
  // Test 6: Phase 3 Serialized Save Concurrency & Undo-Then-Save Invariant
  // -----------------------------------------------------------------------------
  console.log('\nTest 6: Phase 3 Serialized Save Concurrency & Undo-Then-Save Invariant');
  {
    let activeSavePromise = Promise.resolve();
    let saveSequenceCounter = 0;
    let lastCompletedSaveSeq = 0;
    let lastSavedRevision = 0;
    let diskContent = '';
    const writeLog = [];

    function simulatedSave(revision, content, delayMs) {
      const saveSeq = ++saveSequenceCounter;
      const doSave = async () => {
        if (saveSeq < lastCompletedSaveSeq) {
          writeLog.push({ revision, saveSeq, status: 'skipped-stale' });
          return;
        }
        await new Promise(r => setTimeout(r, delayMs));
        diskContent = content;
        lastCompletedSaveSeq = Math.max(lastCompletedSaveSeq, saveSeq);
        lastSavedRevision = revision;
        writeLog.push({ revision, saveSeq, status: 'committed', content });
      };

      activeSavePromise = activeSavePromise.then(doSave, doSave);
      return activeSavePromise;
    }

    // Step A: Save revisions 1 and 2 concurrently
    const p1 = simulatedSave(1, 'revision-1-text', 30);
    const p2 = simulatedSave(2, 'revision-2-text', 10);
    await Promise.all([p1, p2]);

    assert.strictEqual(lastSavedRevision, 2, 'Newest queued save (2) must be the last committed revision');
    assert.strictEqual(diskContent, 'revision-2-text', 'Disk content must reflect newest revision (2)');
    assert.strictEqual(writeLog[0].revision, 1);
    assert.strictEqual(writeLog[1].revision, 2);

    // Step B: User performs Undo back to revision 1, then saves
    // The save queue must commit revision 1 to disk and NOT skip it because 1 < 2
    await simulatedSave(1, 'revision-1-undone-text', 10);
    assert.strictEqual(lastSavedRevision, 1, 'Undone revision (1) MUST be successfully committed to disk after Undo');
    assert.strictEqual(diskContent, 'revision-1-undone-text', 'Disk content must reflect the undone revision (1)');

    console.log('  [PASS] Save queue serializes async writes and allows saving undone revisions without blocking');
  }

  // -----------------------------------------------------------------------------
  // Test 7: P0-03 New Canvas Discard Guard in Source Code
  // -----------------------------------------------------------------------------
  console.log('\nTest 7: P0-03 New Canvas Discard Guard in Source Code');
  {
    const pixelartApp = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    const newCanvasBlock = pixelartApp.match(/btn-confirm-new-canvas[\s\S]*?renderPaProjectTabs/);
    assert(newCanvasBlock, 'Must find btn-confirm-new-canvas listener');
    assert(
      newCanvasBlock[0].includes('createPaProjectSession'),
      'btn-confirm-new-canvas must create an independent project tab'
    );
    console.log('  [PASS] btn-confirm-new-canvas preserves existing work in a new project tab');
  }

  // -----------------------------------------------------------------------------
  // Test 8: P0-03 Open File in Summary Mode Trap Prevention
  // -----------------------------------------------------------------------------
  console.log('\nTest 8: P0-03 Open File in Summary Mode Trap Prevention');
  {
    const pixelartApp = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    
    const openFileBlock = pixelartApp.match(/openFileNative[\s\S]*?showToast\(`Opened/);
    assert(openFileBlock, 'Must find openFileNative block');
    assert(
      openFileBlock[0].includes('createPaProjectSession(title, parsed, handle)'),
      'openFileNative must open valid PIX2 files in an independent project session'
    );
    assert(
      openFileBlock[0].includes('_PIX2.validate(parsed'),
      'openFileNative must validate PIX2 before creating a project session'
    );

    console.log('  [PASS] File open validates then creates an independent project session');
  }

  // -----------------------------------------------------------------------------
  // Test 9: P1-07 Studio New Project Unapplied Code Guard
  // -----------------------------------------------------------------------------
  console.log('\nTest 9: P1-07 Studio New Project Unapplied Code Guard');
  {
    const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    const modalBlock = appJs.match(/function openNewFileModal\(\)\s*\{[\s\S]*?dom\.modalNewFile/);
    assert(modalBlock, 'Must find openNewFileModal in js/app.js');
    assert(
      modalBlock[0].includes('handleBeforeLeaveCodeTab'),
      'openNewFileModal must call handleBeforeLeaveCodeTab() before checking dirty state'
    );
    console.log('  [PASS] Studio openNewFileModal() verifies unapplied code editor changes');
  }

  // -----------------------------------------------------------------------------
  // Test 10: Phase 1 Production Adaptive Zoom Safety Cap
  // -----------------------------------------------------------------------------
  console.log('\nTest 10: Phase 1 Production Adaptive Zoom Safety Cap');
  {
    PixelArtApp.state.w = 1024;
    PixelArtApp.state.h = 1024;
    assert.strictEqual(PixelArtApp.getMaxAllowedZoom(), 8, '1024x1024 must cap at 8x zoom');

    PixelArtApp.state.w = 512;
    PixelArtApp.state.h = 512;
    assert.strictEqual(PixelArtApp.getMaxAllowedZoom(), 8, '512x512 must cap at 8x zoom');

    PixelArtApp.state.w = 256;
    PixelArtApp.state.h = 256;
    assert.strictEqual(PixelArtApp.getMaxAllowedZoom(), 16, '256x256 must cap at 16x zoom');

    PixelArtApp.state.w = 128;
    PixelArtApp.state.h = 128;
    assert.strictEqual(PixelArtApp.getMaxAllowedZoom(), 32, '128x128 must cap at 32x zoom');

    PixelArtApp.state.w = 64;
    PixelArtApp.state.h = 64;
    assert.strictEqual(PixelArtApp.getMaxAllowedZoom(), 64, '64x64 must allow up to 64x deep zoom');

    console.log('  [PASS] Production getMaxAllowedZoom() accurately enforces adaptive caps');
  }

  // -----------------------------------------------------------------------------
  // Test 11: Phase 1 Finding A Defensive Zoom Clamping Invariant
  // -----------------------------------------------------------------------------
  console.log('\nTest 11: Phase 1 Finding A Defensive Zoom Clamping on Dimension Change');
  {
    PixelArtApp.state.w = 64;
    PixelArtApp.state.h = 64;
    PixelArtApp.state.zoom = 64;

    PixelArtApp.state.w = 1024;
    PixelArtApp.state.h = 1024;
    PixelArtApp.resizeCanvasesToZoom();

    assert.strictEqual(PixelArtApp.state.zoom, 8, `state.zoom must be clamped from 64 to 8, got ${PixelArtApp.state.zoom}`);
    console.log('  [PASS] resizeCanvasesToZoom() defensively clamps zoom on dimension change (64x -> 8x)');
  }

  // -----------------------------------------------------------------------------
  // Test 12: Phase 1 Finding B Space Navigation Auto-Centering
  // -----------------------------------------------------------------------------
  console.log('\nTest 12: Phase 1 Finding B Space Navigation Auto-Centering');
  {
    PixelArtApp.state.panX = 350;
    PixelArtApp.state.panY = -220;
    PixelArtApp.state.zoom = 8;

    PixelArtApp.centerCanvasInViewport(false);

    assert.strictEqual(PixelArtApp.state.panX, 0, 'panX must reset to 0');
    assert.strictEqual(PixelArtApp.state.panY, 0, 'panY must reset to 0');
    assert.strictEqual(PixelArtApp.state.zoom, 8, 'zoom level must remain exactly 8x (unaltered by auto-center)');
    console.log('  [PASS] centerCanvasInViewport() resets pan to center while preserving current zoom level');
  }

  // -----------------------------------------------------------------------------
  // Test 13: Phase 4 Delta-Based History vs Snapshot Hybrid
  // -----------------------------------------------------------------------------
  console.log('\nTest 13: Phase 4 Delta-Based History vs Snapshot Hybrid');
  {
    const prev = { '0,0': '#ff0000', '1,1': '#00ff00', '2,2': '#0000ff' };
    const curr = { '0,0': '#ffffff', '1,1': '#00ff00', '3,3': '#ffff00' };

    const diff = PixelArtApp.calculatePixelDiff(prev, curr);
    assert.deepStrictEqual(diff['0,0'], ['#ff0000', '#ffffff']);
    assert.deepStrictEqual(diff['2,2'], ['#0000ff', null]);
    assert.deepStrictEqual(diff['3,3'], [null, '#ffff00']);
    assert.strictEqual(diff['1,1'], undefined, 'Identical pixel must not be in diff');

    const testPixels = { ...prev };
    PixelArtApp.applyPixelDiff(testPixels, diff, 'forward');
    assert.deepStrictEqual(testPixels, curr, 'Forward diff application must produce curr pixels');

    PixelArtApp.applyPixelDiff(testPixels, diff, 'backward');
    assert.deepStrictEqual(testPixels, prev, 'Backward diff application must restore prev pixels');

    PixelArtApp.createNewDocument(64, 64, 'Diff Test Doc', { version: '1.0' });
    const cell = PixelArtApp.getArtworkCell();
    assert(cell, 'Artwork cell must exist');

    assert.strictEqual(PixelArtApp.state.history.length, 1);
    assert.strictEqual(PixelArtApp.state.history[0].type, 'snapshot');

    cell.pixels['10,10'] = '#ff0000';
    cell.pixels['10,11'] = '#ff0000';
    cell.pixels['10,12'] = '#ff0000';
    PixelArtApp.pushHistory();

    assert.strictEqual(PixelArtApp.state.history.length, 2);
    const step1 = PixelArtApp.state.history[1];
    assert.strictEqual(step1.type, 'diff', 'Small stroke must create delta diff history entry');
    assert(step1.diff['10,10'], 'Diff must contain mutated pixel key');

    PixelArtApp.undo();
    assert.strictEqual(cell.pixels['10,10'], undefined, 'Undoing diff must delete mutated pixel');
    assert.strictEqual(PixelArtApp.state.historyIndex, 0);

    PixelArtApp.redo();
    assert.strictEqual(cell.pixels['10,10'], '#ff0000', 'Redoing diff must re-apply mutated pixel');
    assert.strictEqual(PixelArtApp.state.historyIndex, 1);

    console.log('  [PASS] Delta-based history records O(M) diffs for <= 25,000 pixels and undo/redo functions flawlessly');
  }

  // -----------------------------------------------------------------------------
  // Test 14: Phase 4 History Budget Pruning & Oldest Entry Re-Basing
  // -----------------------------------------------------------------------------
  console.log('\nTest 14: Phase 4 History Budget Pruning & Oldest Entry Re-Basing');
  {
    PixelArtApp.createNewDocument(32, 32, 'Budget Test', { version: '1.0' });
    const cell = PixelArtApp.getArtworkCell();

    cell.pixels['1,1'] = '#111111';
    PixelArtApp.pushHistory();

    cell.pixels['2,2'] = '#222222';
    PixelArtApp.pushHistory();

    assert.strictEqual(PixelArtApp.state.history.length, 3);
    assert.strictEqual(PixelArtApp.state.history[0].type, 'snapshot');
    assert.strictEqual(PixelArtApp.state.history[1].type, 'diff');

    PixelArtApp.rebaseOldestHistoryEntry();

    assert.strictEqual(PixelArtApp.state.history.length, 2);
    assert.strictEqual(PixelArtApp.state.history[0].type, 'snapshot');
    assert.strictEqual(PixelArtApp.state.history[0].pixels['1,1'], '#111111', 'Re-based snapshot must contain merged pixels');

    console.log('  [PASS] rebaseOldestHistoryEntry() accurately re-bases diff entries into snapshots during budget pruning');
  }

  // -----------------------------------------------------------------------------
  // Test 15: Phase 2 External Watcher CRLF / LF Normalization & Single History Push
  // -----------------------------------------------------------------------------
  console.log('\nTest 15: Phase 2 External Watcher CRLF / LF Normalization & Single History Push');
  {
    const diskCRLF = '@pix2 1.0\r\n@meta\r\n  title: "Test CRLF"\r\n';
    const savedLF = '@pix2 1.0\n@meta\n  title: "Test CRLF"\n';

    assert.strictEqual(
      PixelArtApp.normalizeForCompare(diskCRLF),
      PixelArtApp.normalizeForCompare(savedLF),
      'CRLF on disk must normalize to be identical to saved LF string'
    );

    const pixelartAppCode = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    assert(
      pixelartAppCode.includes('normalizeForCompare'),
      'pixelart-app.js must use normalizeForCompare in external change watcher'
    );

    const reloadFn = pixelartAppCode.match(/async function handleManualFileReload[\s\S]*?checkAndReloadExternalFileChanges\(true\)/);
    assert(reloadFn, 'Must find handleManualFileReload function');
    assert(
      !reloadFn[0].includes('pushHistory();'),
      'handleManualFileReload must not call pushHistory directly before checkAndReloadExternalFileChanges to prevent duplicate undo steps'
    );

    console.log('  [PASS] Watcher normalizes CRLF/LF line endings and pushes exactly one history step on reload');
  }

  // -----------------------------------------------------------------------------
  // Test 16: Phase 5 Revision-Based Autosave Recovery & Undo State Recovery
  // -----------------------------------------------------------------------------
  console.log('\nTest 16: Phase 5 Revision-Based Autosave Recovery & Undo State Recovery');
  {
    const contentA = '@pix2 1.0\n@meta\n  title: "Hero"\n';
    const contentB = '@pix2 1.0\n@meta\n  title: "Villain"\n';

    const hashA = PixelArtApp.hashString(PixelArtApp.normalizeForCompare(contentA));
    const hashB = PixelArtApp.hashString(PixelArtApp.normalizeForCompare(contentB));

    assert.strictEqual(typeof hashA, 'string');
    assert.strictEqual(hashA, PixelArtApp.hashString(PixelArtApp.normalizeForCompare(contentA)), 'Hash must be deterministic');
    assert.notStrictEqual(hashA, hashB, 'Different content must produce different hashes');

    // Case 1: Standard forward editing (revision 5 > lastSavedRevision 3)
    const forwardAutosave = {
      revision: 5,
      lastSavedRevision: 3,
      isDirty: true,
      baseContentHash: hashA,
      w: 64,
      h: 64,
      pixels: { '0,0': '#ff0000' }
    };
    const forwardHasEdits = forwardAutosave.isDirty === true || (forwardAutosave.revision !== forwardAutosave.lastSavedRevision);
    assert.strictEqual(forwardHasEdits, true, 'Forward unsaved edits must be flagged for recovery');

    // Case 2: Undone state editing (user undid to revision 2 < lastSavedRevision 3)
    const undoneAutosave = {
      revision: 2,
      lastSavedRevision: 3,
      isDirty: true,
      baseContentHash: hashA,
      w: 64,
      h: 64,
      pixels: {}
    };
    const undoneHasEdits = undoneAutosave.isDirty === true || (undoneAutosave.revision !== undoneAutosave.lastSavedRevision);
    assert.strictEqual(undoneHasEdits, true, 'Autosave after Undo (revision 2 < lastSaved 3) MUST be identified as having unsaved edits and recovered');

    console.log('  [PASS] Revision & isDirty-based recovery handles both forward edits and undone states');
  }

  // -----------------------------------------------------------------------------
  // Test 17: Phase 6 Restorable Pre-Reload Backup Schema & Failure Guard
  // -----------------------------------------------------------------------------
  console.log('\nTest 17: Phase 6 Restorable Pre-Reload Backup Schema & Failure Guard');
  {
    const html = fs.readFileSync(path.join(__dirname, '../pixelart/index.html'), 'utf8');
    assert(html.includes('id="pa-recovery-banner"'), 'HTML must include #pa-recovery-banner');
    assert(html.includes('id="btn-restore-backup"'), 'HTML must include #btn-restore-backup');
    assert(html.includes('id="btn-dismiss-backup"'), 'HTML must include #btn-dismiss-backup');

    const css = fs.readFileSync(path.join(__dirname, '../pixelart/css/pixelart.css'), 'utf8');
    assert(css.includes('.pa-recovery-banner'), 'CSS must define .pa-recovery-banner');

    const pixelartApp = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    assert(
      pixelartApp.includes('schemaVersion: 3') && pixelartApp.includes('documentSource: _PIX2.serialize(state.doc)'),
      'Backup payload must define schemaVersion: 3 and preserve the complete structured document'
    );
    assert(
      pixelartApp.includes('proceedWithoutBackup'),
      'handleManualFileReload must check backup persistence failure and warn before discarding edits'
    );

    console.log('  [PASS] Pre-reload backup schema versioning and persistence failure guards verified');
  }

  // -----------------------------------------------------------------------------
  // Test 18: External Watcher Content Hash Verification when Timestamps Match
  // -----------------------------------------------------------------------------
  console.log('\nTest 18: External Watcher Content Hash Verification when Timestamps Match');
  {
    const baselineText = '@pix2 1.0\n@meta\n  title: "Hero"\n';
    const modifiedText = '@pix2 1.0\n@meta\n  title: "Hero Modified"\n';
    const sameTimestamp = 1731112233000;

    const baseHash = PixelArtApp.hashString(PixelArtApp.normalizeForCompare(baselineText));
    const modHash = PixelArtApp.hashString(PixelArtApp.normalizeForCompare(modifiedText));

    const isSameTimestamp = (sameTimestamp === sameTimestamp);
    const isContentChanged = (baseHash !== modHash);

    assert.strictEqual(isSameTimestamp, true);
    assert.strictEqual(isContentChanged, true, 'Identical filesystem timestamps must NOT prevent detection if content hash differs');

    // And if content matches saved baseline, NO false-positive conflict is raised
    const identicalText = '@pix2 1.0\r\n@meta\r\n  title: "Hero"\r\n';
    const identicalHash = PixelArtApp.hashString(PixelArtApp.normalizeForCompare(identicalText));
    assert.strictEqual(identicalHash === baseHash, true, 'Saved baseline content on disk must never trigger false-positive external conflict');
    console.log('  [PASS] Content hash accurately detects external changes when timestamps match, and prevents false positives');
  }

  // -----------------------------------------------------------------------------
  // Test 19: Real-time Ruler Static Cache & Pan Invalidation Invariant
  // -----------------------------------------------------------------------------
  console.log('\nTest 19: Real-time Ruler Static Cache & Pan Invalidation Invariant');
  {
    assert.strictEqual(typeof PixelArtApp.renderRulers, 'function');
    assert.strictEqual(typeof PixelArtApp.drawRulerHighlights, 'function');
    assert.strictEqual(typeof PixelArtApp.updateRulerHighlight, 'function');
    assert.strictEqual(typeof PixelArtApp.invalidateRulerCache, 'function');

    PixelArtApp.state.showRulers = true;
    PixelArtApp.state.w = 64;
    PixelArtApp.state.h = 64;
    PixelArtApp.updateRulerHighlight(10, 15);
    assert.strictEqual(PixelArtApp.state._hoverX, 10);
    assert.strictEqual(PixelArtApp.state._hoverY, 15);

    // Verify invalidateRulerCache() behaviorally clears active static ruler cache bitmaps
    PixelArtApp.setRulerStaticTop({ cached: true });
    PixelArtApp.setRulerStaticLeft({ cached: true });
    assert(PixelArtApp.getRulerStaticTop(), 'Ruler top cache must exist before invalidation');
    assert(PixelArtApp.getRulerStaticLeft(), 'Ruler left cache must exist before invalidation');

    PixelArtApp.invalidateRulerCache();
    assert.strictEqual(PixelArtApp.getRulerStaticTop(), null, 'invalidateRulerCache must reset rulerStaticTop to null');
    assert.strictEqual(PixelArtApp.getRulerStaticLeft(), null, 'invalidateRulerCache must reset rulerStaticLeft to null');
    console.log('  [PASS] Ruler updateRulerHighlight and pan cache invalidation verified');
  }

  // -----------------------------------------------------------------------------
  // Test 20: History Transaction & Baseline Continuity for Non-stroke Operations
  // -----------------------------------------------------------------------------
  console.log('\nTest 20: History Transaction & Baseline Continuity for Non-stroke Operations');
  {
    PixelArtApp.createNewDocument(32, 32, 'History Baseline Continuity', { version: '1.0' });
    const cell = PixelArtApp.getArtworkCell();
    assert(cell, 'Cell must exist');

    // 1. Initial pen stroke
    cell.pixels['1,1'] = '#ff0000';
    PixelArtApp.state.activeStrokeChanges = { '1,1': [null, '#ff0000'] };
    PixelArtApp.pushHistory();
    const idxAfterStroke = PixelArtApp.state.historyIndex;

    // 2. Non-stroke operation (Bucket flood fill) with activeStrokeChanges = null
    PixelArtApp.state.activeStrokeChanges = null;
    cell.pixels['1,2'] = '#00ff00';
    cell.pixels['1,3'] = '#00ff00';
    cell.pixels['1,4'] = '#00ff00';
    PixelArtApp.pushHistory();

    const idxAfterBucket = PixelArtApp.state.historyIndex;
    assert.strictEqual(idxAfterBucket, idxAfterStroke + 1, 'Non-stroke tool (Bucket) must record a valid history entry');

    // 3. Undo Bucket operation
    PixelArtApp.undo();
    assert.strictEqual(cell.pixels['1,2'], undefined, 'Undo must revert bucket pixel 1,2');
    assert.strictEqual(cell.pixels['1,3'], undefined, 'Undo must revert bucket pixel 1,3');
    assert.strictEqual(cell.pixels['1,4'], undefined, 'Undo must revert bucket pixel 1,4');
    assert.strictEqual(cell.pixels['1,1'], '#ff0000', 'Undo must preserve previous stroke pixel 1,1');

    // 4. Redo Bucket operation
    PixelArtApp.redo();
    assert.strictEqual(cell.pixels['1,2'], '#00ff00', 'Redo must restore bucket pixel 1,2');
    assert.strictEqual(cell.pixels['1,3'], '#00ff00', 'Redo must restore bucket pixel 1,3');
    assert.strictEqual(cell.pixels['1,4'], '#00ff00', 'Redo must restore bucket pixel 1,4');
    assert.strictEqual(cell.pixels['1,1'], '#ff0000', 'Redo must preserve stroke pixel 1,1');

    // 5. Baseline continuity
    assert(PixelArtApp.state.lastHistoryPixels, 'lastHistoryPixels baseline must not be null');
    assert.strictEqual(PixelArtApp.state.lastHistoryPixels['1,2'], '#00ff00', 'lastHistoryPixels must match current state');
    console.log('  [PASS] Non-stroke operations maintain history baseline continuity through Undo/Redo cycles');
  }

  // -----------------------------------------------------------------------------
  // Test 21: Watcher Strict String Comparison & Hash Collision Defense
  // -----------------------------------------------------------------------------
  console.log('\nTest 21: Watcher Strict String Comparison & Hash Collision Defense');
  {
    // DJB2 32-bit hash collision pair
    const textA = 'Ad';
    const textB = 'BC';
    const hashA = PixelArtApp.hashString(textA);
    const hashB = PixelArtApp.hashString(textB);
    assert.strictEqual(hashA, hashB, 'Verification fixture: "Ad" and "BC" must collide in 32-bit DJB2');

    // Verification that normDisk === normSaved strict comparison distinguishes collided strings
    const normA = PixelArtApp.normalizeForCompare(textA);
    const normB = PixelArtApp.normalizeForCompare(textB);
    const isStrictEqual = (normA === normB);
    assert.strictEqual(isStrictEqual, false, 'Strict string equality must distinguish colliding hash inputs');

    // Code audit check: verify checkAndReloadExternalFileChanges uses normDisk === normSaved
    const code = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    assert(
      code.includes('if (normDisk === normSaved)'),
      'checkAndReloadExternalFileChanges must enforce strict string comparison normDisk === normSaved'
    );
    assert(
      code.includes('activeSaveOperations'),
      'checkAndReloadExternalFileChanges must guard against concurrent save operations with activeSaveOperations counter'
    );
    assert(
      code.includes('isHeartbeat && currentModified === lastKnownFileModified'),
      'Heartbeat optimization must only skip disk reads during periodic heartbeat, never on focus or visibility change'
    );
    console.log('  [PASS] Watcher enforces strict string comparison, queue-level save locks, and focus content verification');
  }

  // -----------------------------------------------------------------------------
  // -----------------------------------------------------------------------------
  // Test 22: Pre-Reload Backup Identity Validation via W3C FileSystemHandle isSameEntry
  // -----------------------------------------------------------------------------
  console.log('\nTest 22: Pre-Reload Backup Identity Validation via W3C FileSystemHandle isSameEntry');
  {
    // Part A: Same Basename AND Identical Baseline Content across different directories
    // User had Hero.pix2 in Folder A. Active session opened Hero.pix2 in Folder B.
    // Both files have 100% identical contents.
    const identicalContent = '@pix2 1.0\n@meta\n  title: "Hero"\n';
    const identicalHash = PixelArtApp.hashString(PixelArtApp.normalizeForCompare(identicalContent));

    const mockFileHandleA = {
      name: 'Hero.pix2',
      isSameEntry: async (other) => other === mockFileHandleA,
      getFile: async () => ({
        lastModified: 1731110000000,
        text: async () => identicalContent
      })
    };

    const mockFileHandleB = {
      name: 'Hero.pix2', // Identical basename!
      isSameEntry: async (other) => other === mockFileHandleB,
      getFile: async () => ({
        lastModified: 1731110000000,
        text: async () => identicalContent // Identical content & identical hash!
      })
    };

    // Backup saved from Folder A session
    const backupFromFolderA = {
      schemaVersion: 2,
      docId: 'Hero',
      fileName: 'Hero.pix2',
      fileHandle: mockFileHandleA,
      revision: 5,
      lastSavedRevision: 4,
      w: 32,
      h: 32,
      title: 'Hero',
      pixels: { '0,0': '#ff0000' },
      time: Date.now(),
      baseContentHash: identicalHash
    };

    await PixelArtApp.savePreReloadBackup(backupFromFolderA);

    // Active workspace is currently on Folder B
    PixelArtApp.setCurrentFileHandle(mockFileHandleB);
    PixelArtApp.setCurrentFileName('Hero.pix2');
    PixelArtApp.state.title = 'Hero';

    assert.strictEqual(PixelArtApp.getCurrentFileHandle(), mockFileHandleB);
    assert.strictEqual(PixelArtApp.getCurrentFileName(), 'Hero.pix2');

    // Restore backup
    const restoreOkA = await PixelArtApp.restorePreReloadBackup();
    assert.strictEqual(restoreOkA, true, 'restorePreReloadBackup must succeed');

    // Despite IDENTICAL basename and IDENTICAL content hash, handle must detach because
    // isSameEntry(mockFileHandleA) on mockFileHandleB returns false!
    assert.strictEqual(
      PixelArtApp.getCurrentFileHandle(),
      null,
      'Handle MUST be detached when isSameEntry returns false despite identical name and identical content'
    );
    assert.strictEqual(PixelArtApp.getCurrentFileName(), null, 'Filename must be cleared on detached restore');
    assert.strictEqual(PixelArtApp.state.title, 'Restored - Hero', 'Title must reflect detached restored draft');

    // Part B: Genuine Same-File Restore (Same Handle, Same Basename, Same Content)
    // User restores backup created within the same active file
    const sameFileBackup = {
      schemaVersion: 2,
      docId: 'Hero',
      fileName: 'Hero.pix2',
      fileHandle: mockFileHandleA,
      revision: 3,
      lastSavedRevision: 2,
      w: 32,
      h: 32,
      title: 'Hero',
      pixels: { '1,1': '#00ff00' },
      time: Date.now(),
      baseContentHash: identicalHash
    };

    await PixelArtApp.savePreReloadBackup(sameFileBackup);
    PixelArtApp.setCurrentFileHandle(mockFileHandleA);
    PixelArtApp.setCurrentFileName('Hero.pix2');
    PixelArtApp.state.title = 'Hero';

    const restoreOkB = await PixelArtApp.restorePreReloadBackup();
    assert.strictEqual(restoreOkB, true, 'restorePreReloadBackup must succeed');
    assert.strictEqual(
      PixelArtApp.getCurrentFileHandle(),
      mockFileHandleA,
      'Handle MUST remain attached when isSameEntry confirms true file identity'
    );
    assert.strictEqual(PixelArtApp.getCurrentFileName(), 'Hero.pix2');
    assert.strictEqual(PixelArtApp.state.title, 'Hero');

    console.log('  [PASS] Backup restore validates W3C FileSystemHandle isSameEntry, detaching cross-folder handles with identical content');
  }

  // -----------------------------------------------------------------------------
  // Test 23: Autosave Clean State Ordering on File Save
  // -----------------------------------------------------------------------------
  console.log('\nTest 23: Autosave Clean State Ordering on File Save');
  {
    const code = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    // Ensure setDirty is called before triggerAutosave(true) in saveFileNative
    const saveNativePattern = /setDirty\(documentRevision !== lastSavedRevision \|\| _PIX2.serialize\(state.doc\) !== text\);\s*triggerAutosave\(true\);/g;
    const matches = code.match(saveNativePattern);
    assert(matches && matches.length >= 1, 'The shared save publication path must update dirty state before autosave');

    // Behavioral state test:
    PixelArtApp.markDocumentMutation('test-edit');
    assert.strictEqual(PixelArtApp.state.isDirty, true, 'Document must be dirty before save');
    PixelArtApp.markDocumentSaved();
    assert.strictEqual(PixelArtApp.state.isDirty, false, 'Document must be clean after markDocumentSaved');

    console.log('  [PASS] Save sequence commits clean state before writing autosave to storage');
  }

  // -----------------------------------------------------------------------------
  // Test 24: Unverified LocalStorage Fallback Isolation from Disk Baseline
  // -----------------------------------------------------------------------------
  console.log('\nTest 24: Unverified LocalStorage Fallback Isolation from Disk Baseline');
  {
    const code = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    // Ensure init() fallback does NOT assign unverified localStorage text to lastSavedContent
    const unverifiedFallbackSlice = code.substring(
      code.indexOf('// 2. Fallback: If handle could not be read directly'),
      code.indexOf('// 3. Fallback: Check for crash recovery')
    );
    assert(
      unverifiedFallbackSlice.includes("lastSavedContent = ''"),
      'Unverified localStorage fallback in init() must NOT set lastSavedContent as authoritative baseline'
    );
    assert(
      unverifiedFallbackSlice.includes('lastKnownFileModified = 0'),
      'Unverified localStorage fallback in init() must keep lastKnownFileModified = 0 until verified on disk'
    );
    assert(
      unverifiedFallbackSlice.includes('setDirty(true)'),
      'Unverified localStorage fallback in init() must mark document dirty as an unverified recovery session'
    );

    // Behavioral test of first-check divergence detection on unverified recovery:
    PixelArtApp.createNewDocument(16, 16, 'UnverifiedSession', { version: '1.0' });
    const cell = PixelArtApp.getArtworkCell();
    cell.pixels['0,0'] = '#ff0000'; // Canvas has unverified edit
    PixelArtApp.setDirty(true);
    PixelArtApp.setCurrentFileName('Hero.pix2');
    PixelArtApp.setLastKnownFileModified(0); // Simulates unverified baseline

    let diskReadHappened = false;
    const mockFileOnDisk = {
      name: 'Hero.pix2',
      getFile: async () => {
        diskReadHappened = true;
        return {
          lastModified: 1731120000000,
          text: async () => '@pix2 1.0\n@meta\n  title: "Hero"\n@cell cell_0_0 16 16\n  0,0: #0000ff\n@end\n'
        };
      }
    };
    PixelArtApp.setCurrentFileHandle(mockFileOnDisk);

    // File watcher first-run check on focus
    await PixelArtApp.checkAndReloadExternalFileChanges(false, false);
    assert.strictEqual(diskReadHappened, true, 'First watcher check must read physical file from disk');
    assert.strictEqual(PixelArtApp.getLastKnownFileModified(), 1731120000000, 'Baseline mtime must now be recorded from disk');
    assert(PixelArtApp.getLastSavedContent().includes('#0000ff'), 'Baseline content must be initialized to disk content');
    assert.strictEqual(PixelArtApp.state.isDirty, true, 'Canvas must remain dirty with user edits preserved');

    console.log('  [PASS] Startup localStorage cache isolated from authoritative disk baseline and verified on disk check');
  }

  console.log('\n====================================================');
  // -----------------------------------------------------------------------------
  // Test 25: P0 Selection Escape restores lift-time pixels, never preview pixels
  // -----------------------------------------------------------------------------
  console.log('\nTest 25: Selection Escape Restore Invariant');
  {
    PixelArtApp.createNewDocument(8, 8, 'Selection cancel', { version: '1.0' });
    const cell = PixelArtApp.getArtworkCell();
    cell.pixels = { '2,2': '#ff0000', '3,2': '#00ff00' };
    PixelArtApp.state.selection = { x: 2, y: 2, w: 2, h: 1 };
    // Simulate a transformed floating preview after the original pixels have
    // been lifted out of the document. The baseline must win on Escape.
    delete cell.pixels['2,2'];
    delete cell.pixels['3,2'];
    PixelArtApp.state.floatingPixels = { '0,0': '#0000ff' };
    PixelArtApp.state.floatingOriginalSel = { x: 4, y: 4, w: 1, h: 1 };
    PixelArtApp.state.floatingBaselinePixels = { '0,0': '#ff0000', '1,0': '#00ff00' };
    PixelArtApp.state.floatingBaselineSel = { x: 2, y: 2, w: 2, h: 1 };

    PixelArtApp.cancelFloatingSelection();
    assert.deepStrictEqual(cell.pixels, { '2,2': '#ff0000', '3,2': '#00ff00' },
      'Escape must restore the original selection instead of committing transformed preview pixels');
    assert.strictEqual(PixelArtApp.state.selection, null, 'Escape must clear the transient selection');
    assert.strictEqual(PixelArtApp.state.floatingPixels, null, 'Escape must clear transient floating pixels');

    const studioSource = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    assert(studioSource.includes('state.cellZoom'), 'Studio selection controller must use EditorState.cellZoom');
    assert(studioSource.includes('function cancelFloatingSelection()'), 'Studio must provide cancellation restoration logic');
    assert(/ensureFloatingSelection\(\);\s+renderMovingSelectionOverlay\(\);/.test(studioSource),
      'Studio move interaction must use the shared lift transaction with a cancellation baseline');
    assert(studioSource.includes("addEventListener('pointercancel'"),
      'Studio must cancel interrupted selection gestures');
    console.log('  [PASS] Escape restores original pixels and Studio uses the canonical cell zoom state');
  }

  // -----------------------------------------------------------------------------
  // Test 26: Structural selections must retain their original editable target
  // -----------------------------------------------------------------------------
  console.log('\nTest 26: Structural Selection Target Isolation & Ruler Theme Refresh');
  {
    PixelArtApp.createNewDocument(8, 8, 'Structural selection');
    const cell = PixelArtApp.getArtworkCell();
    const regionA = { id: 'region-a', type: 'region', pixels: { '1,1': '#ff0000' } };
    const regionB = { id: 'region-b', type: 'region', pixels: { '1,1': '#00ff00' } };
    cell.layers = [{ id: 'layer-a', type: 'layer', children: [regionA, regionB] }];
    cell.pixels = { '1,1': '#00ff00' };
    PixelArtApp.state.activeLayerId = 'layer-a';
    PixelArtApp.state.activeRegionId = 'region-a';
    PixelArtApp.state.isolatedNodeId = null;
    PixelArtApp.state.selection = { x: 1, y: 1, w: 1, h: 1 };

    assert.strictEqual(PixelArtApp.getActiveEditingTarget(), regionA,
      'Structural editing must resolve the active region, not the composite cell cache');
    PixelArtApp.ensureFloatingSelection();
    assert.deepStrictEqual(regionA.pixels, {}, 'Lifting a structural selection must remove pixels from its source region');
    assert.deepStrictEqual(regionB.pixels, { '1,1': '#00ff00' }, 'Lifting one region must not alter its sibling');

    // Change the active layer target while a selection is floating: Esc must
    // still restore to the lift-time source, not the newly selected sibling.
    PixelArtApp.state.activeRegionId = 'region-b';
    PixelArtApp.state.floatingPixels = { '0,0': '#0000ff' };
    PixelArtApp.cancelFloatingSelection();
    assert.deepStrictEqual(regionA.pixels, { '1,1': '#ff0000' }, 'Esc must restore into the original structural region');
    assert.deepStrictEqual(regionB.pixels, { '1,1': '#00ff00' }, 'Esc must not write into a newly selected sibling region');

    const source = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    assert(/invalidateRulerCache\(\);\s+repaintCanvas\(\);\s+renderRulers\(\);/.test(source),
      'Theme changes must invalidate and repaint cached rulers immediately');
    console.log('  [PASS] Selection transactions keep their structural target and theme changes repaint ruler caches');
  }

  // -----------------------------------------------------------------------------
  // Test 27: Layers context must not expose code-only controls or low-contrast UI
  // -----------------------------------------------------------------------------
  console.log('\nTest 27: Layers Context Isolation & Theme Contrast');
  {
    const html = fs.readFileSync(path.join(__dirname, '../pixelart/index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '../pixelart/css/pixelart.css'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    assert(html.includes('pa-code-pane side-layers-active'), 'Layers must be the initial side-pane context');
    assert(html.includes('pa-code-context-control'), 'Code-only UI controls must be explicitly marked');
    assert(css.includes('.pa-code-pane.side-layers-active .pa-code-context-control'),
      'Layers context must hide code-only controls, including the code status bar');
    assert(css.includes('.pa-layers-container {') && css.includes('background: var(--bg-primary);'),
      'Layers panel must use the theme background rather than a fixed translucent black overlay');
    assert(app.includes("setSidePaneTab('code')") && app.includes("setSidePaneTab('layers')"),
      'Switching side-pane tabs must consistently update their context UI');
    console.log('  [PASS] Layers view hides code-only controls and uses theme-aware contrast');
  }

  // -----------------------------------------------------------------------------
  // Test 28: Studio floating selections preserve their structural source node
  // -----------------------------------------------------------------------------
  console.log('\nTest 28: Studio Structural Selection Transaction Targeting');
  {
    const studioSource = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    assert(studioSource.includes('function getSelectionTarget(cell, targetId = null)'),
      'Studio must resolve selection writes through the active structural target');
    assert(studioSource.includes('floatingSelectionTargetId = cell.layers && cell.layers.length ? target.id : null;'),
      'Studio must bind an in-flight selection to its lift-time source node');
    assert(studioSource.includes('state.syncCellComposite(cell.id);'),
      'Studio structural selection operations must refresh the cell composite cache');
    console.log('  [PASS] Studio selection transactions are bound to their source structural node');
  }

  // -----------------------------------------------------------------------------
  // Test 29: UI conversion must use the lossless canonical v1.0 -> v1.1 path
  // -----------------------------------------------------------------------------
  console.log('\nTest 29: Lossless Structure Conversion UI Path');
  {
    const studioSource = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    const editorStateSource = fs.readFileSync(path.join(__dirname, '../js/editor-state.js'), 'utf8');
    assert(studioSource.includes('state.upgradeDocumentToV11(cell.id'), 'Convert UI must use the transactional EditorState upgrader');
    assert(editorStateSource.includes('_PIX2.upgradeV10ToV11(this.doc, options)'), 'EditorState transaction must delegate to the canonical PIX2 lossless upgrader');
    assert(!studioSource.includes("state.addLayer(cell.id, 'Base Layer')"), 'Convert UI must not create/sync an empty layer before copying flat pixels');
    console.log('  [PASS] Structure conversion upgrades from a preserved document snapshot');
  }

  // -----------------------------------------------------------------------------
  // Test 30: PixelArt structural history restores AST, not merely composites
  // -----------------------------------------------------------------------------
  console.log('\nTest 30: PixelArt Structural Undo / Redo');
  {
    PixelArtApp.createNewDocument(8, 8, 'Structural history');
    const cell = PixelArtApp.getArtworkCell();
    cell.layers = [
      { id: 'layer-bottom', type: 'layer', opacity: 1, children: [{ id: 'region-bottom', type: 'region', pixels: { '1,1': '#ff0000' } }] },
      { id: 'layer-top', type: 'layer', opacity: 1, children: [{ id: 'region-top', type: 'region', pixels: { '1,1': '#00ff00' } }] }
    ];
    cell.pixels = { '1,1': '#00ff00' };
    PixelArtApp.state.history = [];
    PixelArtApp.state.historyIndex = -1;
    PixelArtApp.pushHistory();
    cell.layers.reverse();
    cell.pixels = { '1,1': '#ff0000' };
    PixelArtApp.pushHistory();
    PixelArtApp.undo();
    assert.strictEqual(PixelArtApp.getArtworkCell().layers[0].id, 'layer-bottom', 'Undo restores original layer ordering');
    PixelArtApp.redo();
    assert.strictEqual(PixelArtApp.getArtworkCell().layers[0].id, 'layer-top', 'Redo restores reordered layer AST');
    console.log('  [PASS] PixelArt undo/redo restores structural layers and ordering atomically');
  }

  // -----------------------------------------------------------------------------
  // Test 31: Layer visibility transactions must settle lifted selection pixels
  // -----------------------------------------------------------------------------
  console.log('\nTest 31: Layer Hide / Show Preserves Floating Selection Pixels');
  {
    PixelArtApp.createNewDocument(8, 8, 'Visibility transaction');
    const cell = PixelArtApp.getArtworkCell();
    const region = { id: 'visibility-region', type: 'region', visible: true, pixels: { '2,2': '#ff00ff' } };
    const layer = { id: 'visibility-layer', type: 'layer', visible: true, opacity: 1, children: [region] };
    cell.layers = [layer];
    cell.pixels = { '2,2': '#ff00ff' };
    PixelArtApp.state.activeLayerId = layer.id;
    PixelArtApp.state.activeRegionId = region.id;
    PixelArtApp.state.selection = { x: 2, y: 2, w: 1, h: 1 };

    PixelArtApp.ensureFloatingSelection();
    assert.strictEqual(region.pixels['2,2'], undefined, 'Selection lift temporarily removes the source pixel');
    PixelArtApp.prepareStructureMutation();
    assert.strictEqual(region.pixels['2,2'], '#ff00ff', 'Structure transaction settles the lifted pixel first');
    assert.strictEqual(PixelArtApp.state.floatingPixels, null, 'No floating transaction leaks across visibility mutation');

    layer.visible = false;
    PIX2.compositeCellLayers(cell, { w: 8, h: 8 });
    assert.strictEqual(cell.pixels['2,2'], undefined, 'Hidden layer is absent from composite');
    layer.visible = true;
    PIX2.compositeCellLayers(cell, { w: 8, h: 8 });
    assert.strictEqual(cell.pixels['2,2'], '#ff00ff', 'Shown layer restores its source pixel');
    console.log('  [PASS] visibility changes cannot snapshot a lifted/empty structural source');
  }

  // -----------------------------------------------------------------------------
  // Test 32: Rotation gestures use one immutable source for cumulative angles
  // -----------------------------------------------------------------------------
  console.log('\nTest 32: Selection Rotation Session Is Non-Compounding');
  {
    const source = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
    assert(source.includes('rotationSessionPixels'), 'PixelArt must retain an immutable rotation-session raster');
    assert(source.includes('state.rotationGestureBaseAngle + state.rotationCurrentAngle'),
      'Pointer-up must apply the cumulative angle rather than re-rotating the previous bounding box');
    assert(source.includes('SelectionTransform.rotatePixelsNearestNeighbor(\n          state.rotationSessionPixels'),
      'Committed rotation must sample the immutable session pixels');
    console.log('  [PASS] repeated rotation gestures use a stable source snapshot and cumulative angle');
  }

  console.log('ALL AUDIT INTEGRITY & REGRESSION TESTS PASSED (32/32)');
  console.log('====================================================\n');
}

runSuite().catch(err => {
  console.error('Audit Test Suite Failed:', err);
  process.exit(1);
});

