// tests/test-import-slice.js
// Tests for Phase 5 Import & Slice (PNG Grid, Alpha Islands, TexturePacker & NOIRADIX Adapters)

const assert = require('assert');
const PIX2 = require('../js/pix2-format.js');
const ImportSlice = require('../js/import-slice.js');

console.log('====================================================');
console.log('RUNNING IMPORT & SLICE PIPELINE TEST SUITE');
console.log('====================================================\n');

let passCount = 0;
function pass(msg) {
  console.log(`  [PASS] ${msg}`);
  passCount++;
}

// -----------------------------------------------------------------------------
// Test 1: TexturePacker Hash & Array JSON Adapters
// -----------------------------------------------------------------------------
console.log('Test 1: TexturePacker JSON Adapters');

const tpHashJson = {
  frames: {
    "hero_idle_0.png": {
      frame: { x: 0, y: 0, w: 12, h: 14 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 2, y: 1, w: 12, h: 14 },
      sourceSize: { w: 16, h: 16 },
      pivot: { x: 0.5, y: 0.5 }
    },
    "hero_idle_1.png": {
      frame: { x: 16, y: 0, w: 14, h: 12 },
      rotated: true, // rotated 90 deg in atlas
      trimmed: true,
      spriteSourceSize: { x: 1, y: 2, w: 12, h: 14 },
      sourceSize: { w: 16, h: 16 },
      pivot: { x: 0.5, y: 0.5 }
    }
  }
};

const parsedHash = ImportSlice.parseAtlasJSON(tpHashJson);
assert.strictEqual(parsedHash.length, 2);
assert.strictEqual(parsedHash[0].name, 'hero_idle_0.png');
assert.strictEqual(parsedHash[0].sourceW, 16);
assert.strictEqual(parsedHash[0].trimX, 2);
assert.strictEqual(parsedHash[1].rotated, true);
pass('TexturePacker Hash JSON parsed correctly with trimmed offsets and rotation flag');

const tpArrayJson = {
  frames: [
    {
      filename: "spell_0.png",
      frame: { x: 0, y: 0, w: 8, h: 8 },
      rotated: false,
      trimmed: false,
      sourceSize: { w: 8, h: 8 }
    }
  ]
};

const parsedArray = ImportSlice.parseAtlasJSON(tpArrayJson);
assert.strictEqual(parsedArray.length, 1);
assert.strictEqual(parsedArray[0].name, 'spell_0.png');
pass('TexturePacker Array JSON parsed correctly');

assert.throws(
  () => ImportSlice.parseAtlasJSON({ frames: { 'bad.png': { frame: { x: '1\"><img src=x onerror=alert(1)>', y: 0, w: 8, h: 8 } } } }),
  /invalid x/,
  'Untrusted atlas geometry must reject strings before it reaches HTML attributes or raster operations',
);
assert.throws(
  () => ImportSlice.parseAtlasJSON(tpArrayJson, { width: 7, height: 8 }),
  /exceeds the 7×8 image bounds/,
  'Atlas frame rectangles must stay within the imported image dimensions',
);
assert.throws(
  () => ImportSlice.parseAtlasJSON({ frames: Array.from({ length: 3 }, (_, i) => ({ filename: `f${i}.png`, frame: { x: 0, y: 0, w: 1, h: 1 } })) }, { maxFrames: 2 }),
  /frame limit exceeded/,
  'Atlas metadata must respect the configured frame-count resource limit',
);
assert.throws(
  () => ImportSlice.parseAtlasJSON({ frames: [{ filename: 'too-large.png', frame: { x: 0, y: 0, w: 513, h: 1 } }] }, { maxFrameDim: 512 }),
  /exceeds supported raster limits/,
  'Atlas frames must respect the destination editor cell-dimension profile',
);
pass('Atlas metadata validates untrusted geometry, image bounds and frame-count limits');

// -----------------------------------------------------------------------------
// Test 2: Grid Slicing Calculation
// -----------------------------------------------------------------------------
console.log('\nTest 2: Uniform Grid Slicing');
const gridFrames = ImportSlice.sliceGrid(64, 32, {
  cellW: 16,
  cellH: 16,
  cols: 4,
  rows: 2,
  margin: 0,
  gap: 0
});

assert.strictEqual(gridFrames.length, 8, '64x32 sliced with 16x16 cells produces 8 frames');
assert.strictEqual(gridFrames[0].x, 0);
assert.strictEqual(gridFrames[0].y, 0);
assert.strictEqual(gridFrames[4].x, 0);
assert.strictEqual(gridFrames[4].y, 16);
assert.strictEqual(gridFrames[7].x, 48);
assert.strictEqual(gridFrames[7].y, 16);
pass('sliceGrid accurately computes grid cell boundaries');

// -----------------------------------------------------------------------------
// Test 3: Alpha Island Slicing
// -----------------------------------------------------------------------------
console.log('\nTest 3: Alpha Island Connected Component Slicing');
// Simulated 16x16 canvas with 2 distinct islands of non-transparent pixels
// Island 1: at (2,2) to (4,4)
// Island 2: at (10,10) to (12,12)
function mockPixelReader(x, y) {
  if (x >= 2 && x <= 4 && y >= 2 && y <= 4) {
    return { r: 255, g: 0, b: 0, a: 255 };
  }
  if (x >= 10 && x <= 12 && y >= 10 && y <= 12) {
    return { r: 0, g: 255, b: 0, a: 255 };
  }
  return { r: 0, g: 0, b: 0, a: 0 };
}

const islands = ImportSlice.sliceAlphaIslands(mockPixelReader, 16, 16, { minSize: 2 });
assert.strictEqual(islands.length, 2, '2 alpha islands detected');
assert.strictEqual(islands[0].x, 2);
assert.strictEqual(islands[0].y, 2);
assert.strictEqual(islands[0].w, 3);
assert.strictEqual(islands[0].h, 3);

assert.strictEqual(islands[1].x, 10);
assert.strictEqual(islands[1].y, 10);
assert.strictEqual(islands[1].w, 3);
assert.strictEqual(islands[1].h, 3);
pass('sliceAlphaIslands segments non-transparent pixel islands and computes bounding boxes');

// -----------------------------------------------------------------------------
// Test 4: Rotation & Trim Offset Reconstruction
// -----------------------------------------------------------------------------
console.log('\nTest 4: Sprite Rotation (90° CCW) and Trimmed Offset Extraction');
// Frame is 2x3 in atlas, rotated: true, trimX: 1, trimY: 1, sourceSize: 8x8
// Unrotated size in original sprite is 3x2
const rotatedFrame = {
  name: "rot_test",
  x: 0,
  y: 0,
  w: 2, // in atlas
  h: 3, // in atlas
  rotated: true,
  trimmed: true,
  sourceW: 8,
  sourceH: 8,
  trimX: 1,
  trimY: 1
};

// Fill atlas at (0,0) with red
function mockRotatedAtlas(x, y) {
  if (x === 0 && y === 0) return { r: 255, g: 0, b: 0, a: 255 };
  return { r: 0, g: 0, b: 0, a: 0 };
}

const extracted = ImportSlice.extractFramePixels(mockRotatedAtlas, rotatedFrame);
assert.strictEqual(extracted.width, 8);
assert.strictEqual(extracted.height, 8);
// With destX = trimX + fy = 1 + 0 = 1; destY = trimY + (fw - 1 - fx) = 1 + (2 - 1 - 0) = 2
assert.ok(extracted.pixels['1,2'], 'Unrotated pixel placed at correct (1, 2) position');
pass('extractFramePixels reconstructs rotated sprites and applies trim offset');

// -----------------------------------------------------------------------------
// Test 5: Full Document Import & Animation Sequence Auto-Detection
// -----------------------------------------------------------------------------
console.log('\nTest 5: Full Import into PIX2 Document with Animation Detection');
const doc = PIX2.createDocument('Imported Project', 4, 4, 16, 16);
doc.meta.version = '1.1';

const importFrames = [
  { name: 'walk_0', x: 0, y: 0, w: 4, h: 4, rotated: false, trimmed: false, sourceW: 16, sourceH: 16, trimX: 0, trimY: 0 },
  { name: 'walk_1', x: 4, y: 0, w: 4, h: 4, rotated: false, trimmed: false, sourceW: 16, sourceH: 16, trimX: 0, trimY: 0 },
  { name: 'walk_2', x: 8, y: 0, w: 4, h: 4, rotated: false, trimmed: false, sourceW: 16, sourceH: 16, trimX: 0, trimY: 0 }
];

function mockAnimAtlas(x, y) {
  return { r: 100, g: 150, b: 200, a: 255 };
}

ImportSlice.importFramesToDoc(doc, importFrames, mockAnimAtlas, {
  createAnimations: true,
  fps: 12
});

assert.ok(doc.cells['imported_walk_0'], 'Cell walk_0 imported');
assert.ok(doc.cells['imported_walk_1'], 'Cell walk_1 imported');
assert.ok(doc.cells['imported_walk_2'], 'Cell walk_2 imported');
assert.strictEqual(doc.cells['imported_walk_0'].layers.length, 1, 'v1.1 layer tree generated');

const anim = doc.animations['walk'];
assert.ok(anim, 'Animation "walk" automatically detected from frame naming sequence');
assert.strictEqual(anim.fps, 12);
assert.deepStrictEqual(anim.frames, ['imported_walk_0', 'imported_walk_1', 'imported_walk_2']);
pass('importFramesToDoc imports frames into v1.1 cells and auto-assembles animation clips');

// -----------------------------------------------------------------------------
// Test 6: Tag-to-Row and Frame-Index-to-Column Mapping Invariant
// -----------------------------------------------------------------------------
console.log('\nTest 6: Tag-to-Row and Frame-Index-to-Column Mapping Invariant');
const doc2 = PIX2.createDocument('Row Col Tagging Project', 4, 4, 16, 16);
const taggedFrames = [
  { name: 'down_0', tag: 'walk_down', frameIndex: 0, x: 0, y: 0, w: 16, h: 16 },
  { name: 'down_1', tag: 'walk_down', frameIndex: 1, x: 16, y: 0, w: 16, h: 16 },
  { name: 'up_0', tag: 'walk_up', frameIndex: 0, x: 0, y: 16, w: 16, h: 16 },
  { name: 'up_1', tag: 'walk_up', frameIndex: 1, x: 16, y: 16, w: 16, h: 16 },
  { name: 'right_0', tag: 'walk_right', frameIndex: 0, x: 0, y: 32, w: 16, h: 16 },
  { name: 'right_1', tag: 'walk_right', frameIndex: 1, x: 16, y: 32, w: 16, h: 16 },
  { name: 'left_0', tag: 'walk_left', frameIndex: 0, x: 0, y: 48, w: 16, h: 16 },
  { name: 'left_1', tag: 'walk_left', frameIndex: 1, x: 16, y: 48, w: 16, h: 16 }
];

ImportSlice.importFramesToDoc(doc2, taggedFrames, mockAnimAtlas, {
  createAnimations: true,
  useGridCellIds: true
});

assert.strictEqual(doc2.cells['cell_0_0'].row, 0);
assert.strictEqual(doc2.cells['cell_0_0'].col, 0);
assert.strictEqual(doc2.cells['cell_0_0'].direction, 'down');

assert.strictEqual(doc2.cells['cell_0_1'].row, 0);
assert.strictEqual(doc2.cells['cell_0_1'].col, 1);

assert.strictEqual(doc2.cells['cell_1_0'].row, 1);
assert.strictEqual(doc2.cells['cell_1_0'].col, 0);
assert.strictEqual(doc2.cells['cell_1_0'].direction, 'up');

assert.strictEqual(doc2.cells['cell_2_0'].row, 2);
assert.strictEqual(doc2.cells['cell_2_0'].col, 0);
assert.strictEqual(doc2.cells['cell_2_0'].direction, 'right');

assert.strictEqual(doc2.cells['cell_3_0'].row, 3);
assert.strictEqual(doc2.cells['cell_3_0'].col, 0);
assert.strictEqual(doc2.cells['cell_3_0'].direction, 'left');

assert.deepStrictEqual(doc2.animations['walk_down'].frames, ['cell_0_0', 'cell_0_1']);
assert.deepStrictEqual(doc2.animations['walk_up'].frames, ['cell_1_0', 'cell_1_1']);
pass('Tag maps to Row, frameIndex maps to Column, and animations preserve sequential frames');

console.log('\n====================================================');
console.log(`ALL IMPORT & SLICE TESTS PASSED (${passCount}/${passCount})`);
console.log('====================================================\n');

