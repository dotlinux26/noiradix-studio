// Roundtrip & Semantic Verification Test Suite for PIX2 Format Engine
const fs = require('fs');
const path = require('path');
const PIX2 = require('../js/pix2-format.js');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log('====================================================');
console.log('RUNNING PIX2 ENGINE SEMANTIC & ROUNDTRIP TEST SUITE');
console.log('====================================================\n');

// TEST 1: Comment stripping vs Hex colors
console.log('Test 1: Comment Lexer & Hex Disambiguation');
const testDocText = `@pix2 1.0
@meta
  title: "Test Sprite"
  grid: 2x2
  cell_size: 16x16

@palette
  1: #ffffff ; Semicolon comment
  2: #57546f # Hash comment with whitespace
  3: #ff6b8bcc ; 8-digit RGBA hex with alpha

@cell custom_hero_01
  name: "Hero Pose 1"
  direction: down
  frame: 0
  pixel 4,5 1
  pixel 6,7 #57546f ; inline comment
  pixel 8,9 #ff6b8bcc

@animation hero_idle
  direction: down
  frames: [custom_hero_01]
  fps: 8
  loop: true

@end
`;

const parsed1 = PIX2.parse(testDocText);
assert(parsed1.meta.title === 'Test Sprite', 'Meta title parsed correctly');
assert(parsed1.palette['1'] === '#ffffff', 'Palette 1 hex color preserved despite semicolon comment');
assert(parsed1.palette['2'] === '#57546f', 'Palette 2 hex color preserved despite hash comment');
assert(parsed1.palette['3'] === '#ff6b8bcc', 'Palette 3 8-digit RGBA hex preserved with alpha');

const heroCell = parsed1.cells['custom_hero_01'];
assert(heroCell !== undefined, 'Decoupled custom cell ID parsed correctly');
assert(heroCell.name === 'Hero Pose 1', 'Cell name parsed correctly');
assert(heroCell.direction === 'down', 'Cell direction tag parsed correctly');
assert(heroCell.pixels['4,5'] === '#ffffff', 'Pixel from palette ID resolved to #ffffff');
assert(heroCell.pixels['6,7'] === '#57546f', 'Pixel from direct hex resolved with comment stripped');
assert(heroCell.pixels['8,9'] === '#ff6b8bcc', 'Pixel with RGBA alpha preserved in cell storage');

const anim = parsed1.animations['hero_idle'];
assert(anim !== undefined, 'Custom animation parsed correctly');
assert(anim.frames.length === 1 && anim.frames[0] === 'custom_hero_01', 'Animation frames reference custom cell');
assert(anim.fps === 8, 'Animation FPS parsed as 8');
assert(anim.loop === true, 'Animation loop parsed as true');

// TEST 2: Roundtrip Serialization Determinism
console.log('\nTest 2: Semantic Roundtrip Determinism (Parse -> Serialize -> Parse)');
const serialized = PIX2.serialize(parsed1);
const parsed2 = PIX2.parse(serialized);

assert(parsed2.meta.title === parsed1.meta.title, 'Roundtrip: title identical');
assert(parsed2.meta.grid.cols === parsed1.meta.grid.cols, 'Roundtrip: grid cols identical');
assert(parsed2.meta.grid.rows === parsed1.meta.grid.rows, 'Roundtrip: grid rows identical');
assert(parsed2.cells['custom_hero_01'] !== undefined, 'Roundtrip: custom cell ID preserved');
assert(parsed2.cells['custom_hero_01'].pixels['4,5'] === parsed1.cells['custom_hero_01'].pixels['4,5'], 'Roundtrip: pixel 4,5 preserved');
assert(parsed2.cells['custom_hero_01'].pixels['8,9'] === '#ff6b8bcc', 'Roundtrip: RGBA alpha pixel preserved');
assert(parsed2.animations['hero_idle'] !== undefined, 'Roundtrip: animation preserved');

// TEST 3: Sample Player.pix2 validation
console.log('\nTest 3: Validating samples/Player.pix2');
const samplePath = path.join(__dirname, '..', 'samples', 'Player.pix2');
if (fs.existsSync(samplePath)) {
  const sampleContent = fs.readFileSync(samplePath, 'utf8');
  const sampleDoc = PIX2.parse(sampleContent);
  const cellCount = Object.keys(sampleDoc.cells).length;
  assert(cellCount > 0, `Player.pix2 loaded with ${cellCount} cells`);
  assert(sampleDoc.palette && Object.keys(sampleDoc.palette).length > 0, 'Player.pix2 palette loaded');
}

// TEST 4: Custom Cell Identifiers with grid_pos & Single-Line vs Multi-Line Pixels
console.log('\nTest 4: Custom Cell Identifiers & grid_pos Mapping (ChatGPT File Test)');
const testPix2Snippet = `@pix2 1.0
@meta
  title: "Ashen Reaper Test"
  grid: 4x4
  cell_size: 16x16
@palette
  1: #292438
@cell reaper_down_0
  name: "Reaper Down 1"
  direction: down
  frame: 0
  grid_pos: 0,0
  pixel 4,0 1
  pixel 5,0 1
@animation walk_down
  frames: [reaper_down_0]
@end`;

const customDoc = PIX2.parse(testPix2Snippet);
assert(customDoc.cells['reaper_down_0'] !== undefined, 'Custom cell reaper_down_0 parsed');
assert(customDoc.cells['reaper_down_0'].row === 0 && customDoc.cells['reaper_down_0'].col === 0, 'grid_pos 0,0 parsed into row/col 0,0');
assert(customDoc.cells['reaper_down_0'].direction === 'down', 'Cell direction tag preserved');
assert(customDoc.animations['walk_down'].frames.includes('reaper_down_0'), 'Animation references custom cell ID');

// TEST 5: Row-Only Flip & Duplicate Logic Semantics
console.log('\nTest 5: Row-Only Flip & Row Duplication Verification');
const multiRowDoc = PIX2.createDocument('MultiRow Test', 4, 2, 16, 16);
multiRowDoc.cells['cell_0_0'].pixels = { '2,2': '#ffffff', '4,4': '#ffffff' };
multiRowDoc.cells['cell_1_0'].pixels = { '1,1': '#ff0000' };

// Flip row 0 horizontally (w = 16)
const originalRow1Pixels = { ...multiRowDoc.cells['cell_1_0'].pixels };
const newRow0Pixels = {};
for (const coord in multiRowDoc.cells['cell_0_0'].pixels) {
  const [x, y] = coord.split(',').map(Number);
  newRow0Pixels[`${16 - 1 - x},${y}`] = multiRowDoc.cells['cell_0_0'].pixels[coord];
}
multiRowDoc.cells['cell_0_0'].pixels = newRow0Pixels;

assert(multiRowDoc.cells['cell_0_0'].pixels['13,2'] === '#ffffff', 'Row 0 pixel 2,2 flipped to 13,2 horizontally');
assert(multiRowDoc.cells['cell_0_0'].pixels['11,4'] === '#ffffff', 'Row 0 pixel 4,4 flipped to 11,4 horizontally');
assert(multiRowDoc.cells['cell_1_0'].pixels['1,1'] === '#ff0000', 'Row 1 remained completely untouched during row 0 flip');

// Row duplication test
const oldRows = multiRowDoc.meta.grid.rows;
const newRowIdx = oldRows;
multiRowDoc.meta.grid.rows = oldRows + 1;
const dupName = 'Walk Run';
const cleanPrefix = 'walk_run';
const dupFrameIds = [];

for (let c = 0; c < multiRowDoc.meta.grid.cols; c++) {
  const newCellId = `${cleanPrefix}_${c}`;
  const srcCell = multiRowDoc.cells[`cell_0_${c}`];
  multiRowDoc.cells[newCellId] = {
    id: newCellId,
    name: `${dupName} - Frame ${c}`,
    row: newRowIdx,
    col: c,
    frame: c,
    pixels: { ...(srcCell ? srcCell.pixels : {}) }
  };
  dupFrameIds.push(newCellId);
}
multiRowDoc.animations[cleanPrefix] = {
  name: dupName,
  fps: 6,
  loop: true,
  frames: dupFrameIds
};

assert(multiRowDoc.meta.grid.rows === 3, 'Grid rows expanded from 2 to 3');
assert(multiRowDoc.cells['walk_run_0'].pixels['13,2'] === '#ffffff', 'Duplicated row 2 has cloned pixel data from row 0');
assert(multiRowDoc.animations['walk_run'].frames.length === 4, 'Animation sequence created with all 4 column frames');

// Row reordering & Animation state assignment verification
console.log('\nTest 6: Row Movement & Safe Animation Assignment (Zero Pixel Loss)');
// Move row 2 to row 0
const rows = multiRowDoc.meta.grid.rows;
const cols = multiRowDoc.meta.grid.cols;
const fromIdx = 2;
const toIdx = 0;
const order = [];
for (let r = 0; r < rows; r++) order.push(r);
const [moved] = order.splice(fromIdx, 1);
order.splice(toIdx, 0, moved);
const oldToNew = {};
order.forEach((oldR, newR) => { oldToNew[oldR] = newR; });

// Update cell row properties
for (const cid in multiRowDoc.cells) {
  const cell = multiRowDoc.cells[cid];
  if (cell && typeof cell.row === 'number') {
    cell.row = oldToNew[cell.row];
  }
}

assert(multiRowDoc.cells['walk_run_0'].row === 0, 'Moved row 2 cell walk_run_0 is now at row 0');
assert(multiRowDoc.cells['walk_run_0'].pixels['13,2'] === '#ffffff', 'Moved row preserved all pixel data without loss');

// Safe animation assignment to row 0 with new animation name "dash"
const row0Cells = [];
for (let c = 0; c < cols; c++) {
  // Find cell at row 0, col c
  let foundCell = null;
  for (const cid in multiRowDoc.cells) {
    if (multiRowDoc.cells[cid].row === 0 && multiRowDoc.cells[cid].col === c) {
      foundCell = multiRowDoc.cells[cid];
      break;
    }
  }
  assert(foundCell !== null, `Found cell at row 0 col ${c}`);
  row0Cells.push(foundCell.id);
}

multiRowDoc.animations['dash'] = {
  name: 'Dash',
  direction: 'none',
  frames: row0Cells,
  fps: 8,
  loop: true
};

assert(multiRowDoc.animations['dash'].frames[0] === 'walk_run_0', 'New animation state references existing cells');
assert(multiRowDoc.cells['walk_run_0'].pixels['13,2'] === '#ffffff', 'Artwork pixels completely preserved when assigned to new animation state');

console.log(`\n====================================================`);
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log(`====================================================\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
