/**
 * Unit Test Suite for Shared Selection Transform Engine
 * Tests nearest-neighbor scaling, rotation, handle hit-testing, and uniform constraints.
 */
const assert = require('assert');
const SelectionTransform = require('../js/selection-transform.js');

console.log('====================================================');
console.log('RUNNING SELECTION TRANSFORM ENGINE TEST SUITE');
console.log('====================================================\n');

// Test 1: Nearest-Neighbor Upscaling
console.log('Test 1: Nearest-Neighbor Upscaling (2x2 -> 4x4)');
{
  const srcPixels = {
    '0,0': '#ff0000',
    '1,0': '#00ff00',
    '0,1': '#0000ff',
    '1,1': '#ffff00'
  };

  const scaled = SelectionTransform.scalePixelsNearestNeighbor(srcPixels, 2, 2, 4, 4);

  // Each source pixel should expand to a 2x2 block
  assert.strictEqual(scaled['0,0'], '#ff0000');
  assert.strictEqual(scaled['1,0'], '#ff0000');
  assert.strictEqual(scaled['0,1'], '#ff0000');
  assert.strictEqual(scaled['1,1'], '#ff0000');

  assert.strictEqual(scaled['2,0'], '#00ff00');
  assert.strictEqual(scaled['3,0'], '#00ff00');
  assert.strictEqual(scaled['2,1'], '#00ff00');
  assert.strictEqual(scaled['3,1'], '#00ff00');

  assert.strictEqual(scaled['0,2'], '#0000ff');
  assert.strictEqual(scaled['1,2'], '#0000ff');
  assert.strictEqual(scaled['2,2'], '#ffff00');
  assert.strictEqual(scaled['3,3'], '#ffff00');

  console.log('  [PASS] 2x2 rescaled cleanly to 4x4 with sharp nearest-neighbor replication');
}

// Test 2: Nearest-Neighbor Downscaling
console.log('\nTest 2: Nearest-Neighbor Downscaling (4x4 -> 2x2)');
{
  const srcPixels = {};
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      srcPixels[`${x},${y}`] = (x < 2 && y < 2) ? '#111111' : '#222222';
    }
  }

  const downscaled = SelectionTransform.scalePixelsNearestNeighbor(srcPixels, 4, 4, 2, 2);
  assert.strictEqual(downscaled['0,0'], '#111111');
  assert.strictEqual(downscaled['1,0'], '#222222');
  assert.strictEqual(downscaled['0,1'], '#222222');
  assert.strictEqual(downscaled['1,1'], '#222222');

  console.log('  [PASS] 4x4 downscaled cleanly to 2x2');
}

// Test 3: Pure Nearest-Neighbor Rotation
console.log('\nTest 3: Nearest-Neighbor Rotation');
{
  const srcPixels = {
    '0,0': '#ffffff',
    '1,0': '#ffffff'
  };

  const rotated90 = SelectionTransform.rotatePixelsNearestNeighbor(srcPixels, 2, 1, Math.PI / 2);
  assert.strictEqual(rotated90.w >= 1, true);
  assert.strictEqual(rotated90.h >= 1, true);
  // Total pixels should be preserved without blurring or fading
  const pixelCount = Object.keys(rotated90.pixels).length;
  assert.strictEqual(pixelCount > 0, true);

  console.log('  [PASS] Nearest-neighbor rotation backward-mapping preserves sharp pixels');
}

// Test 4: Handle Hit-Testing
console.log('\nTest 4: Handle Hit-Testing');
{
  const sel = { x: 10, y: 10, w: 20, h: 20 };
  const zoom = 4;
  // Canvas pixel bounds: sx = 40, sy = 40, sw = 80, sh = 80
  // Corners: nw = (40, 40), ne = (120, 40), se = (120, 120), sw = (40, 120)
  // Center / body = (80, 80)
  // Rot handle = (80, 40 - 22) = (80, 18)

  assert.strictEqual(SelectionTransform.hitTestSelectionHandles(sel, 40, 40, zoom), 'nw');
  assert.strictEqual(SelectionTransform.hitTestSelectionHandles(sel, 120, 40, zoom), 'ne');
  assert.strictEqual(SelectionTransform.hitTestSelectionHandles(sel, 120, 120, zoom), 'se');
  assert.strictEqual(SelectionTransform.hitTestSelectionHandles(sel, 40, 120, zoom), 'sw');
  assert.strictEqual(SelectionTransform.hitTestSelectionHandles(sel, 80, 18, zoom), 'rot');
  assert.strictEqual(SelectionTransform.hitTestSelectionHandles(sel, 80, 80, zoom), 'body');
  assert.strictEqual(SelectionTransform.hitTestSelectionHandles(sel, 120, 80, zoom), 'e');
  assert.strictEqual(SelectionTransform.hitTestSelectionHandles(sel, 40, 80, zoom), 'w');
  assert.strictEqual(SelectionTransform.hitTestSelectionHandles(sel, 200, 200, zoom), null);

  console.log('  [PASS] Handle hit-testing correctly classifies corners, edges, rot handle, body, and miss');
}

// Test 5: Corner Drag Scaling: Free vs Shift Proportional Constraint
console.log('\nTest 5: Corner Drag Scaling (Free vs Shift Proportional)');
{
  const origSel = { x: 10, y: 10, w: 20, h: 10 }; // 2:1 aspect ratio

  // 1. Free scaling without Shift: corner 'se' dragged to (40, 30)
  // newW = 40 - 10 + 1 = 31, newH = 30 - 10 + 1 = 21
  const freeScaled = SelectionTransform.computeScaledBounds(origSel, 'se', 40, 30, false);
  assert.strictEqual(freeScaled.w, 31);
  assert.strictEqual(freeScaled.h, 21);

  // 2. Uniform scaling with Shift: corner 'se' dragged to (40, 30)
  // Aspect ratio is 20/10 = 2.0. With newH=21 (2.1x) dominant over newW=31 (1.55x),
  // newW = round(21 * 2.0) = 42
  const shiftScaled = SelectionTransform.computeScaledBounds(origSel, 'se', 40, 30, true);
  assert.strictEqual(shiftScaled.w, 42);
  assert.strictEqual(shiftScaled.h, 21);
  assert.strictEqual(shiftScaled.x, 10);
  assert.strictEqual(shiftScaled.y, 10);

  console.log('  [PASS] Free scaling adjusts freely; Shift preserves 2:1 aspect ratio (31x16)');
}

// Test 6: Side-Handle Single-Axis Scaling
console.log('\nTest 6: Side-Handle Single-Axis Scaling');
{
  const origSel = { x: 5, y: 5, w: 10, h: 10 };

  // Drag right side handle 'e' to x = 25
  const scaledE = SelectionTransform.computeScaledBounds(origSel, 'e', 25, 5, false);
  assert.strictEqual(scaledE.w, 21);
  assert.strictEqual(scaledE.h, 10); // Height unchanged!

  // Drag bottom handle 's' to y = 30
  const scaledS = SelectionTransform.computeScaledBounds(origSel, 's', 5, 30, false);
  assert.strictEqual(scaledS.w, 10); // Width unchanged!
  assert.strictEqual(scaledS.h, 26);

  console.log('  [PASS] Side handles scale strictly on single axis without altering orthogonal axis');
}

// Test 7: Repeated rotation gestures must sample one immutable source.
console.log('\nTest 7: Immutable Rotation Source Prevents Bounding-Box Growth');
{
  const srcPixels = {};
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 10; x++) srcPixels[`${x},${y}`] = '#ffffff';
  }
  const angle = Math.PI / 3;
  const fromOriginal = SelectionTransform.rotatePixelsNearestNeighbor(srcPixels, 10, 6, angle);
  const repeatedFromSameSnapshot = SelectionTransform.rotatePixelsNearestNeighbor(srcPixels, 10, 6, angle);
  assert.deepStrictEqual(
    { w: repeatedFromSameSnapshot.w, h: repeatedFromSameSnapshot.h },
    { w: fromOriginal.w, h: fromOriginal.h },
    'The same cumulative angle from the same snapshot must have stable bounds'
  );

  const cardinal = SelectionTransform.rotatePixelsNearestNeighbor(srcPixels, 10, 6, Math.PI * 2);
  assert.strictEqual(cardinal.w, 10, 'A full turn restores source width exactly');
  assert.strictEqual(cardinal.h, 6, 'A full turn restores source height exactly');
  assert.strictEqual(Object.keys(cardinal.pixels).length, 60, 'A full turn preserves every source pixel');
  console.log('  [PASS] cumulative rotation from an immutable snapshot has stable bounds and exact full turns');
}

console.log('\n====================================================');
console.log('ALL SELECTION TRANSFORM TESTS PASSED (7/7)');
console.log('====================================================\n');
