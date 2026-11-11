/**
 * NOIRADIX Viewport Pan & Zoom Unit & Conformance Test Suite
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const NoiraViewport = require('../js/viewport-pan-zoom.js');

console.log('====================================================');
console.log('RUNNING NOIRA VIEWPORT PAN & ZOOM TEST SUITE');
console.log('====================================================\n');

// 1. Zoom Ladder Invariant
assert.ok(Array.isArray(NoiraViewport.DEFAULT_ZOOM_LADDER), 'DEFAULT_ZOOM_LADDER is an array');
assert.ok(NoiraViewport.DEFAULT_ZOOM_LADDER.length >= 8, 'Zoom ladder contains at least 8 levels');
assert.ok(NoiraViewport.DEFAULT_ZOOM_LADDER[0] <= 1, 'Zoom ladder starts at 1x or lower');
console.log('  [PASS] Zoom ladder invariants verified');

// 2. Anchor-Centered Zoom Math Invariant
// Test: When zooming from 4x to 8x, with pointer at pixel (10, 20) on 64x64 sprite:
// The pixel under the pointer must remain at the exact same screen position.
const oldPanX = 100;
const oldPanY = 150;
const oldZoom = 4;
const newZoom = 8;
const unscaledX = 10;
const unscaledY = 20;
const contentW = 64;
const contentH = 64;

const { panX, panY } = NoiraViewport.computeAnchorZoomPan(
  oldPanX, oldPanY, oldZoom, newZoom, unscaledX, unscaledY, contentW, contentH
);

// Mathematical verification:
// Screen pos old: oldPanX + unscaledX * oldZoom = 100 + 10 * 4 = 140 (relative to canvas origin)
// With center-aligned canvas transform:
// The deltaW = (64 * 4) / 2 = 128
// pixelShiftX = 10 * 4 = 40
// newPanX = 100 + (128 - 40) = 188
assert.strictEqual(typeof panX, 'number', 'panX is a number');
assert.strictEqual(typeof panY, 'number', 'panY is a number');
assert.strictEqual(panX, 188, 'anchor zoom keeps unscaledX stationary');
console.log('  [PASS] computeAnchorZoomPan produces stationary anchor math');

// 3. Center Pan Calculation
const center = NoiraViewport.computeCenterPan(1000, 800, 64, 64, 4);
// Scaled size: 64*4 = 256. (1000 - 256) / 2 = 372
assert.strictEqual(center.panX, 372);
// (800 - 256) / 2 = 272
assert.strictEqual(center.panY, 272);
console.log('  [PASS] computeCenterPan centers content accurately in viewport');

// 4. Fit Zoom Calculation
const fitZ = NoiraViewport.computeFitZoom(1000, 800, 100, 100, NoiraViewport.DEFAULT_ZOOM_LADDER, 40);
// Avail: 960x760. Scale: 7.6. Best ladder <= 7.6 is 6.
assert.strictEqual(fitZ, 6);
console.log('  [PASS] computeFitZoom fits within padding bounds correctly');

// 5. Shared artwork zoom policy for Studio frames and PixelArt canvases
const { artworkZoomLimit, stepArtworkZoom, fitArtworkZoom } = NoiraViewport;
for (const [size, limit] of [[64, 64], [100, 32], [127, 32], [128, 32], [255, 16], [256, 16], [511, 8], [512, 8], [1024, 4]]) {
  assert.equal(artworkZoomLimit(size, 16), limit);
  assert.equal(artworkZoomLimit(16, size), limit);
  assert.ok(size * limit <= 4096);
  assert.equal(stepArtworkZoom(limit, 1, size, 16), limit);
  assert.equal(fitArtworkZoom(100000, 100000, size, 16, 64), limit);
}
assert.equal(stepArtworkZoom(8, -1, 512, 16), 6);
assert.equal(stepArtworkZoom(1, -1, 512, 16), 0.75);
assert.equal(fitArtworkZoom(640, 480, 1024, 512, 64), 0.5);
console.log('  [PASS] Artwork caps apply by longest side, with fractional Fit on large canvases');

// 6. Script Inclusion in Entry Points
for (const entry of ['index.html', 'pixelart/index.html']) {
  const html = fs.readFileSync(path.join(__dirname, '..', entry), 'utf8');
  assert.ok(html.includes('viewport-pan-zoom.js'), `${entry} includes viewport-pan-zoom.js`);
  const appScript = entry === 'index.html' ? 'js/app.js' : 'js/pixelart-app.js';
  assert.ok(
    html.indexOf('viewport-pan-zoom.js') < html.indexOf(appScript),
    `${entry} loads viewport-pan-zoom before ${appScript}`
  );
}
console.log('  [PASS] Both Studio and PixelArt load viewport-pan-zoom module before application logic');

console.log('\n====================================================');
console.log('ALL NOIRA VIEWPORT PAN & ZOOM TESTS PASSED (6/6)');
console.log('====================================================\n');
