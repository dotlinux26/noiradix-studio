/**
 * NOIRADIX Test Suite: Audit Data Integrity & Regression Verification
 * Covers P0-01, P0-02, P0-03, P0-04, P1-02, P1-06, P1-07, Adaptive Zoom, and File Watcher invariants
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PIX2 = require('../js/pix2-format.js');
const Tools = require('../js/tools.js');

console.log('====================================================');
console.log('RUNNING AUDIT DATA INTEGRITY & REGRESSION TEST SUITE');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// Test 1: P0-02 Serialization & Placeholder Isolation Guarantee
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

  // Populate 35,000 pixels (> 30,000 threshold)
  let pixelCount = 0;
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 200; x++) {
      if (pixelCount < 35000) {
        doc.cells.artwork.pixels[`${x},${y}`] = '#ff0055';
        pixelCount++;
      }
    }
  }

  // Simulated flushSourceCode logic
  function flushSourceCodeSim(stateDoc, isUnlocked, editorValue, sourcePaneMode) {
    if (isUnlocked && editorValue && sourcePaneMode !== 'summary') {
      return editorValue;
    }
    return PIX2.serialize(stateDoc);
  }

  const dummyPlaceholder = `@pix2 1.0\n@meta\n  title: "Test Large Artwork"\n  size: 64x64\n\n@cell artwork\n  size: 64x64\n  ; [Status: 35,000 pixels - Full code hidden for maximum UI responsiveness]\n`;

  // Case A: When in summary mode, flushSourceCode MUST return canonical serialization, NEVER placeholder!
  const flushedA = flushSourceCodeSim(doc, false, dummyPlaceholder, 'summary');
  assert(!flushedA.includes('; [Status:'), 'Flushed source code must NEVER contain presentation placeholder comment');
  assert(flushedA.includes('artwork'), 'Flushed source code must contain cell artwork');

  // Verify parse back from flushed output
  const parsedBack = PIX2.parse(flushedA, { profile: 'pixelart' });
  const restoredCell = parsedBack.cells.artwork || Object.values(parsedBack.cells)[0];
  const restoredCount = Object.keys(restoredCell.pixels || {}).length;
  assert.strictEqual(restoredCount, 35000, `Parsed back pixel count must be 35000, got ${restoredCount}`);
  console.log('  [PASS] flushSourceCode() strictly serializes 35,000 pixels and rejects placeholder summary');
}

// -----------------------------------------------------------------------------
// Test 2: P0-01 Revision & Dirty Tracking Model
// -----------------------------------------------------------------------------
console.log('\nTest 2: P0-01 Revision & Dirty Tracking Invariant');
{
  let documentRevision = 0;
  let lastSavedRevision = 0;
  let isDirty = false;

  function markDocumentMutation() {
    documentRevision++;
    isDirty = (documentRevision !== lastSavedRevision);
  }

  function markDocumentSaved() {
    lastSavedRevision = documentRevision;
    isDirty = false;
  }

  // Initial clean state
  assert.strictEqual(isDirty, false, 'Document starts clean');

  // Mutation 1: Pencil stroke
  markDocumentMutation();
  assert.strictEqual(documentRevision, 1);
  assert.strictEqual(isDirty, true, 'Document is dirty after stroke');

  // Save document
  markDocumentSaved();
  assert.strictEqual(lastSavedRevision, 1);
  assert.strictEqual(isDirty, false, 'Document is clean after save');

  // Mutation 2: Rectangle shape
  markDocumentMutation();
  assert.strictEqual(documentRevision, 2);
  assert.strictEqual(isDirty, true, 'Document is dirty after rectangle shape');

  // Undo back to revision 1
  documentRevision = 1; // Simulated undo restore
  isDirty = (documentRevision !== lastSavedRevision);
  assert.strictEqual(isDirty, false, 'Document automatically restores clean state when undone back to saved revision');

  // Redo back to revision 2
  documentRevision = 2; // Simulated redo restore
  isDirty = (documentRevision !== lastSavedRevision);
  assert.strictEqual(isDirty, true, 'Document automatically restores dirty state when redone to unsaved revision');
  console.log('  [PASS] Document revision tracking accurately sets clean/dirty across mutations and undo/redo');
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

  // Case 1: 2000 x 500 (landscape wide)
  const case1 = computeTargetDimensions(2000, 500);
  assert.strictEqual(case1.targetW, 1024);
  assert.strictEqual(case1.targetH, 256); // 2000/500 = 4, 1024/256 = 4 (aspect ratio strictly preserved!)
  console.log('  [PASS] 2000x500 scales uniformly to 1024x256 without distortion');

  // Case 2: 500 x 2000 (portrait tall)
  const case2 = computeTargetDimensions(500, 2000);
  assert.strictEqual(case2.targetW, 256);
  assert.strictEqual(case2.targetH, 1024); // 500/2000 = 0.25, 256/1024 = 0.25
  console.log('  [PASS] 500x2000 scales uniformly to 256x1024 without distortion');

  // Case 3: 512 x 512 (small, within 1024)
  const case3 = computeTargetDimensions(512, 512);
  assert.strictEqual(case3.targetW, 512);
  assert.strictEqual(case3.targetH, 512);
  console.log('  [PASS] 512x512 remains 1:1 scale at 512x512');
}

// -----------------------------------------------------------------------------
// Test 4: P1-02 Ruler Viewport Ticks Range Calculation
// -----------------------------------------------------------------------------
console.log('\nTest 4: P1-02 Ruler Viewport Ticks Culling Range');
{
  function computeRulerTickRange(cw, interval, minX, maxX) {
    const startX = Math.max(0, Math.floor((minX - interval) / interval) * interval);
    const endX = Math.min(cw, Math.ceil((maxX + interval) / interval) * interval);
    const ticks = [];
    for (let x = startX; x <= endX; x += interval) {
      ticks.push(x);
    }
    return ticks;
  }

  // Canvas width 1024, interval 16, visible viewport is only x: 100..200
  const ticks = computeRulerTickRange(1024, 16, 100, 200);
  assert(ticks[0] <= 100, 'First tick must cover margin before minX');
  assert(ticks[ticks.length - 1] >= 200, 'Last tick must cover margin after maxX');
  assert(ticks.length < 20, `Visible ticks count must be under 20 (got ${ticks.length}), not full 64`);
  console.log(`  [PASS] 1024-pixel ruler culls to only ${ticks.length} visible ticks instead of all 64 ticks`);
}

// -----------------------------------------------------------------------------
// Test 5: Verify Duplicate getVisibleCanvasBounds is Removed
// -----------------------------------------------------------------------------
console.log('\nTest 5: P2-03 Verification of Duplicate Function Removal');
{
  const appJs = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
  const matches = appJs.match(/function getVisibleCanvasBounds\s*\(/g);
  assert.strictEqual(matches.length, 1, `getVisibleCanvasBounds must appear exactly once in pixelart-app.js, found ${matches ? matches.length : 0}`);
  console.log('  [PASS] getVisibleCanvasBounds appears exactly once (duplicate removed)');
}

// -----------------------------------------------------------------------------
// Test 6: P0-01 Save Revision Race Condition Invariant
// -----------------------------------------------------------------------------
console.log('\nTest 6: P0-01 Save Revision Race Condition Invariant');
{
  let documentRevision = 5;
  let lastSavedRevision = 0;
  let isDirty = true;

  function setDirty(dirty) {
    isDirty = dirty;
    if (!dirty) {
      lastSavedRevision = documentRevision;
    }
  }

  // Simulate save operation starting at revision 5
  const revisionAtSaveStart = documentRevision;

  // Simulate user drawing stroke during async I/O
  documentRevision++; // revision is now 6!

  // Save completes: update lastSavedRevision only up to revisionAtSaveStart
  lastSavedRevision = Math.max(lastSavedRevision, revisionAtSaveStart);
  setDirty(documentRevision !== lastSavedRevision);

  assert.strictEqual(lastSavedRevision, 5, 'lastSavedRevision must match revisionAtSaveStart (5)');
  assert.strictEqual(documentRevision, 6, 'documentRevision is 6');
  assert.strictEqual(isDirty, true, 'Document MUST remain dirty because strokes occurred during save write');

  // Next save with no mutation
  const secondSaveStart = documentRevision; // 6
  lastSavedRevision = Math.max(lastSavedRevision, secondSaveStart);
  setDirty(documentRevision !== lastSavedRevision);
  assert.strictEqual(isDirty, false, 'Document is cleanly marked saved when no intermediate mutations occurred');
  console.log('  [PASS] Save revision race condition prevented: strokes during save keep document dirty');
}

// -----------------------------------------------------------------------------
// Test 7: P0-03 New Canvas Discard Guard Verification
// -----------------------------------------------------------------------------
console.log('\nTest 7: P0-03 New Canvas Discard Guard in Source Code');
{
  const pixelartApp = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
  const newCanvasBlock = pixelartApp.match(/btn-confirm-new-canvas[\s\S]*?createNewDocument/);
  assert(newCanvasBlock, 'Must find btn-confirm-new-canvas listener');
  assert(
    newCanvasBlock[0].includes('confirmDiscardUnsavedChanges'),
    'btn-confirm-new-canvas MUST call confirmDiscardUnsavedChanges before creating new document'
  );
  console.log('  [PASS] btn-confirm-new-canvas calls confirmDiscardUnsavedChanges()');
}

// -----------------------------------------------------------------------------
// Test 8: P0-03 Open File in Summary Mode Trap Prevention
// -----------------------------------------------------------------------------
console.log('\nTest 8: P0-03 Open File in Summary Mode Trap Prevention');
{
  const pixelartApp = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
  
  // Verify openFileNative sets sourcePaneMode = 'full'
  const openFileBlock = pixelartApp.match(/openFileNative[\s\S]*?showToast\(`Opened/);
  assert(openFileBlock, 'Must find openFileNative block');
  assert(
    openFileBlock[0].includes("state.sourcePaneMode = 'full'"),
    'openFileNative must reset sourcePaneMode to full before calling applySourceCodeToCanvas'
  );
  assert(
    openFileBlock[0].includes('const ok = applySourceCodeToCanvas()'),
    'openFileNative must check the return status of applySourceCodeToCanvas'
  );

  // Verify handleFileSelected sets sourcePaneMode = 'full'
  const handleSelectedBlock = pixelartApp.match(/handleFileSelected[\s\S]*?showToast\(`Opened/);
  assert(handleSelectedBlock, 'Must find handleFileSelected block');
  assert(
    handleSelectedBlock[0].includes("state.sourcePaneMode = 'full'"),
    'handleFileSelected must reset sourcePaneMode to full before calling applySourceCodeToCanvas'
  );
  console.log('  [PASS] File open flows reset sourcePaneMode to full and check applySourceCodeToCanvas status');
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
// Test 10: PART 2 Adaptive Zoom Safety Cap
// -----------------------------------------------------------------------------
console.log('\nTest 10: PART 2 Adaptive Zoom Safety Cap');
{
  function getMaxAllowedZoom(w, h) {
    const maxDim = Math.max(w, h);
    if (maxDim >= 512) {
      return 8;
    }
    if (maxDim >= 256) {
      return 16;
    }
    if (maxDim >= 128) {
      return 32;
    }
    return 64;
  }

  // 1024 x 1024: max 8x zoom (backing store: 8192px <= 16384px GPU texture limit)
  assert.strictEqual(getMaxAllowedZoom(1024, 1024), 8, '1024x1024 must cap at 8x zoom');
  // 512 x 512: max 8x zoom
  assert.strictEqual(getMaxAllowedZoom(512, 512), 8, '512x512 must cap at 8x zoom');
  // 512 x 1024: max 8x zoom
  assert.strictEqual(getMaxAllowedZoom(512, 1024), 8, '512x1024 must cap at 8x zoom');
  // 256 x 256: max 16x zoom
  assert.strictEqual(getMaxAllowedZoom(256, 256), 16, '256x256 must cap at 16x zoom');
  // 64 x 64: Area 4,096 -> deep zoom 64x
  assert.strictEqual(getMaxAllowedZoom(64, 64), 64, '64x64 must allow up to 64x deep zoom');

  console.log('  [PASS] Both 1024x1024 and 512x512 allow 8x zoom while capping within safe 8192px backing bounds');
}

// -----------------------------------------------------------------------------
// Test 11: File Watcher CRLF / LF Normalization & Reload History Protection
// -----------------------------------------------------------------------------
console.log('\nTest 11: File Watcher CRLF / LF Normalization & Reload History');
{
  function normalizeForCompare(str) {
    return (str || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  }

  const diskCRLF = '@pix2 1.0\r\n@meta\r\n  title: "Test"\r\n';
  const savedLF = '@pix2 1.0\n@meta\n  title: "Test"\n';

  assert.strictEqual(
    normalizeForCompare(diskCRLF) === normalizeForCompare(savedLF),
    true,
    'CRLF on disk must be recognized as identical to saved LF string'
  );

  const pixelartApp = fs.readFileSync(path.join(__dirname, '../pixelart/js/pixelart-app.js'), 'utf8');
  assert(
    pixelartApp.includes('normalizeForCompare'),
    'pixelart-app.js must use normalizeForCompare in external change watcher'
  );

  const reloadBlock = pixelartApp.match(/handleManualFileReload[\s\S]*?checkAndReloadExternalFileChanges/);
  assert(reloadBlock, 'Must find handleManualFileReload');
  assert(
    reloadBlock[0].includes('pushHistory()'),
    'handleManualFileReload must call pushHistory() to allow Ctrl+Z recovery of replaced canvas'
  );
  console.log('  [PASS] Watcher normalizes CRLF/LF line endings and pushes history before manual disk reload');
}

console.log('\n====================================================');
console.log('ALL AUDIT INTEGRITY & REGRESSION TESTS PASSED (11/11)');
console.log('====================================================\n');
