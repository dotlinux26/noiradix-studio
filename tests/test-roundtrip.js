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

console.log(`\n====================================================`);
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log(`====================================================\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
